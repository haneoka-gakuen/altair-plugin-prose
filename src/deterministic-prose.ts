import type {
  AltairAdaptationRequest,
  AltairAdaptationResult,
  AltairAiProvenance,
} from "@haneoka/altair/protocol";
import {
  cloneStoryValue,
  createEmptyStoryProject,
  importedStoryId,
  type JsonObject,
  type StoryProject,
  type StoryProjectCommand,
} from "@haneoka/altair/model";

type StoryDiagnostic =
  AltairAdaptationResult["diagnostics"][number];

/**
 * Deterministic implementation options owned by the prose plugin.
 *
 * This is intentionally not part of Altair core: hosts only need the
 * browser-neutral AI provider contract exposed through `/protocol`.
 */
export interface AltairDeterministicProseOptions {
  readonly now?: () => Date;
}

const storyDiagnostic = (
  severity: StoryDiagnostic["severity"],
  code: string,
  path: string,
  message: string,
  fidelity?: StoryDiagnostic["fidelity"],
): StoryDiagnostic => ({
  severity,
  code,
  path,
  message,
  ...(fidelity === undefined ? {} : { fidelity }),
});

/**
 * Haneoka ADV Talk opcode.
 *
 * The value is part of the stable 0–100 story protocol, not an Altair editor
 * implementation detail. Keeping it here lets this plugin own prose adaptation
 * without importing Altair's built-in command implementation.
 */
export const ALTAIR_PROSE_TALK_OPCODE = 2 as const;

const FNV_1A_64_OFFSET = 0xcbf29ce484222325n;
const FNV_1A_64_PRIME = 0x100000001b3n;
const FINGERPRINT_ABORT_INTERVAL = 4_096;

const abortError = (signal: AbortSignal): Error => {
  if (signal.reason instanceof Error) return signal.reason;
  const message =
    signal.reason === undefined
      ? "Altair prose adaptation was aborted"
      : String(signal.reason);
  const error =
    typeof DOMException === "function"
      ? new DOMException(message, "AbortError")
      : new Error(message);
  if (error.name !== "AbortError") {
    Object.defineProperty(error, "name", {
      configurable: true,
      value: "AbortError",
    });
  }
  return error;
};

const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw abortError(signal);
};

/**
 * Deterministic UTF-8 source identity used by imported IDs and provenance.
 */
export const altairProseSourceFingerprint = (
  source: string,
  signal?: AbortSignal,
): string => {
  if (typeof source !== "string") {
    throw new TypeError("Altair prose source must be a string");
  }
  throwIfAborted(signal);
  let hash = FNV_1A_64_OFFSET;
  const bytes = new TextEncoder().encode(source);
  for (let index = 0; index < bytes.length; index += 1) {
    if (index % FINGERPRINT_ABORT_INTERVAL === 0) {
      throwIfAborted(signal);
    }
    hash ^= BigInt(bytes[index]!);
    hash = BigInt.asUintN(64, hash * FNV_1A_64_PRIME);
  }
  throwIfAborted(signal);
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
};

const requireAdaptableProject = (project: StoryProject): void => {
  if (!Array.isArray(project.scenes)) {
    throw new TypeError("Altair project scenes must be an array");
  }
  if (typeof project.entrySceneId !== "string") {
    throw new TypeError("Altair project entry scene ID must be a string");
  }
  if (!project.meta || typeof project.meta !== "object") {
    throw new TypeError("Altair project metadata must be an object");
  }
};

const proseBlockToCommand = (
  block: string,
  index: number,
  id: string,
  diagnostics: StoryDiagnostic[],
): StoryProjectCommand => {
  const speakerMatch = block.match(
    /^([^:\n：]{1,48})[：:]\s*([\s\S]+)$/,
  );
  const quotedMatch = block.match(
    /^([^「『“"]{0,48})[「『“"]([\s\S]*?)[」』”"]$/,
  );
  const speaker = (speakerMatch?.[1] || quotedMatch?.[1] || "").trim();
  const text = (
    speakerMatch?.[2] ||
    quotedMatch?.[2] ||
    block
  ).trim();
  if (!speakerMatch && !quotedMatch) {
    diagnostics.push(
      storyDiagnostic(
        "info",
        "altair.prose-as-narration",
        `source.blocks.${index}`,
        "Paragraph imported as narration",
        "approximate",
      ),
    );
  }
  const fields: JsonObject = { text };
  if (speaker) fields.targetName = speaker;
  return {
    id,
    command: ALTAIR_PROSE_TALK_OPCODE,
    fields,
    source: {
      format: "prose",
      raw: block,
      line: index + 1,
    },
    extensions: { "altair:review": true },
  };
};

/**
 * Convert prose into a review-required Altair project without a model,
 * network service, or Altair feature implementation.
 */
export const adaptProseDeterministically = (
  request: AltairAdaptationRequest,
  options: AltairDeterministicProseOptions = {},
  signal?: AbortSignal,
): AltairAdaptationResult => {
  if (!request || typeof request !== "object") {
    throw new TypeError("Altair prose adaptation request must be an object");
  }
  if (typeof request.source !== "string") {
    throw new TypeError("Altair prose source must be a string");
  }
  throwIfAborted(signal);

  const project = request.existingProject
    ? cloneStoryValue(request.existingProject)
    : createEmptyStoryProject({
        title: request.title || "Untitled adaptation",
        ...(request.locale === undefined
          ? {}
          : { locale: request.locale }),
      });
  requireAdaptableProject(project);

  const scene =
    project.scenes.find(({ id }) => id === project.entrySceneId) ??
    project.scenes[0];
  if (!scene) throw new Error("Altair project has no scene");
  if (!Array.isArray(scene.commands)) {
    throw new TypeError("Altair project scene commands must be an array");
  }

  const diagnostics: StoryDiagnostic[] = [];
  const sourceHash = altairProseSourceFingerprint(
    request.source,
    signal,
  );
  const blocks = request.source
    .replace(/\r\n?/gu, "\n")
    .split(/\n{2,}/u)
    .map((value) => value.trim())
    .filter(Boolean);
  const occupiedIds = new Set(
    project.scenes.flatMap((item) =>
      Array.isArray(item.commands)
        ? item.commands.map((command) => command.id)
        : [],
    ),
  );
  const commands: StoryProjectCommand[] = [];
  for (const [index, block] of blocks.entries()) {
    throwIfAborted(signal);
    const baseId = importedStoryId(
      "prose",
      sourceHash.slice("fnv1a64:".length),
      index,
    );
    let id = baseId;
    for (let suffix = 2; occupiedIds.has(id); suffix += 1) {
      id = `${baseId}-${suffix}`;
    }
    occupiedIds.add(id);
    commands.push(
      proseBlockToCommand(block, index, id, diagnostics),
    );
  }
  throwIfAborted(signal);
  scene.commands.push(...commands);

  const generatedAt = (options.now?.() ?? new Date()).toISOString();
  throwIfAborted(signal);
  const provenance: AltairAiProvenance = {
    provider: "altair.deterministic",
    generatedAt,
    sourceHash,
    reviewed: false,
  };
  project.meta.provenance = {
    ...(project.meta.provenance ?? {}),
    altairAdaptation: cloneStoryValue(
      provenance,
    ) as unknown as JsonObject,
  };
  diagnostics.push(
    storyDiagnostic(
      "warning",
      "altair.review-required",
      "project",
      "Adapted prose is a draft and must be reviewed before release",
      "approximate",
    ),
  );
  throwIfAborted(signal);

  return {
    project,
    diagnostics,
    provenance,
  };
};

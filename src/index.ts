import type { AltairAiProvider } from "@haneoka/altair/protocol";
import {
  defineAltairPlugin,
  type AltairPluginV2,
} from "@haneoka/altair/plugins";
import {
  adaptProseDeterministically,
  type AltairDeterministicProseOptions,
} from "./deterministic-prose.js";

export {
  adaptProseDeterministically,
  ALTAIR_PROSE_TALK_OPCODE,
  altairProseSourceFingerprint,
} from "./deterministic-prose.js";
export type { AltairDeterministicProseOptions } from "./deterministic-prose.js";

export const ALTAIR_DETERMINISTIC_PROSE_PROVIDER_ID =
  "altair.deterministic";

export const createAltairDeterministicProseProvider = (
  options: AltairDeterministicProseOptions = {},
): AltairAiProvider => {
  if (options.now !== undefined && typeof options.now !== "function") {
    throw new TypeError("Altair deterministic prose clock must be a function");
  }
  const deterministicOptions: AltairDeterministicProseOptions =
    options.now === undefined ? {} : Object.freeze({ now: options.now });
  return Object.freeze({
    id: ALTAIR_DETERMINISTIC_PROSE_PROVIDER_ID,
    name: "Altair Deterministic Prose",
    async adapt(request, signal) {
      return adaptProseDeterministically(
        request,
        deterministicOptions,
        signal,
      );
    },
  } satisfies AltairAiProvider);
};

const pluginWithProvider = (
  provider: AltairAiProvider,
): AltairPluginV2 =>
  defineAltairPlugin({
    manifest: {
      id: "haneoka.altair-prose",
      name: "Altair Prose",
      version: "0.1.0",
      apiVersion: 2,
      description:
        "Deterministic, review-required prose adaptation for Altair",
      capabilities: ["ai"],
    },
    setup(context) {
      context.contribute("ai", provider);
    },
  });

export const createAltairProsePlugin = (
  options: AltairDeterministicProseOptions = {},
): AltairPluginV2 =>
  pluginWithProvider(createAltairDeterministicProseProvider(options));

export const altairDeterministicProseProvider =
  createAltairDeterministicProseProvider();

export const altairProsePlugin = pluginWithProvider(
  altairDeterministicProseProvider,
);

export default altairProsePlugin;

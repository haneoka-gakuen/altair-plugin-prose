# Altair Prose

Altair Prose turns a block of plain prose into an editable
[Altair](https://github.com/haneoka-gakuen/altair) scene. Paste a chapter of
a novel or a script draft and every paragraph becomes a Talk command: lines
with a speaker get that speaker, quoted dialogue is unwrapped, and everything
else becomes narration. The result is a first draft you then stage — add
characters, backgrounds and music — in the editor.

It runs entirely on your machine. There is no model, no network request and
no randomness: the same text always gives the same commands with the same ids,
so converting again after editing the source lines up with what you already
have.

## Install

```sh
pnpm add @haneoka/altair @haneoka/altair-plugin-prose
```

ESM only; Node 20 or a current browser.

## Use it in Altair

```ts
import { AltairPluginHost } from "@haneoka/altair/plugins";
import { altairProsePlugin } from "@haneoka/altair-plugin-prose";

const host = new AltairPluginHost();
await host.install(altairProsePlugin);

const result = await host.runAi("altair.deterministic", { source: text, title: "Chapter 1" }, signal);
```

The plugin (`haneoka.altair-prose`) registers one adaptation provider with the
id `altair.deterministic` under the host's `ai` contributions. Other
adaptation providers can be installed next to it; each is called by its id.

## What gets recognized

The text is split into blocks at blank lines. Each block becomes one Talk
command:

| Block | Result |
| --- | --- |
| `Anon: Let's go.` or `愛音：行こう` | Speaker `Anon`, text `Let's go.` — a name of up to 48 characters before `:` or `：`. |
| `Soyo「おはよう」`, `灯『……』`, `“Hello”` | The quoted text, with the name before the quote as speaker if there is one. Works with 「」, 『』, “” and `""`. |
| Anything else | Narration, with an info diagnostic `altair.prose-as-narration`. |

Lines inside a block stay together, so a speech that spans several lines is
one command.

## The result

`runAi` (or `provider.adapt(request, signal)`) returns
`{ project, diagnostics }`:

- If the request has an `existingProject`, the commands are appended to its
  entry scene; otherwise a new project is created with the request's `title`
  and `locale`.
- Each command keeps its source block in `source.raw` and its block number in
  `source.line`, and is marked `altair:review` so the editor highlights it
  until someone has looked at it.
- Command ids are derived from a fingerprint of the source text and the block
  number. If an id is already taken, a suffix is added.
- The project records where it came from under
  `meta.provenance.altairAdaptation`: the provider id, the time, the source
  fingerprint and `reviewed: false`.
- A warning `altair.review-required` is always included, so a converted draft
  is never mistaken for a finished scene.

Every step honours the abort signal; cancelling a long conversion stops it
cleanly.

## API

| Export | Description |
| --- | --- |
| `altairProsePlugin` (default) | The plugin with the default provider. |
| `createAltairProsePlugin({ now })` | The plugin with a custom clock for the provenance timestamp. |
| `altairDeterministicProseProvider` | The provider on its own. |
| `createAltairDeterministicProseProvider({ now })` | A provider with a custom clock. |
| `adaptProseDeterministically(request, options?, signal?)` | The conversion as a plain function. |
| `altairProseSourceFingerprint(text, signal?)` | The FNV-1a 64-bit fingerprint used for ids, as `fnv1a64:<hex>`. |
| `ALTAIR_DETERMINISTIC_PROSE_PROVIDER_ID` | `"altair.deterministic"` |
| `ALTAIR_PROSE_TALK_OPCODE` | `2`, the ADV Talk command. |

## License

MPL-2.0. See [LICENSE](LICENSE).

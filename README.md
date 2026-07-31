# Altair Prose

Converts prose into editable Altair scenes without a network service or model.

```sh
pnpm add @haneoka/altair @haneoka/altair-plugin-prose
```

```ts
import { altairProsePlugin } from "@haneoka/altair-plugin-prose";

await host.install(altairProsePlugin);
const provider = host.contributions("ai")[0];
const draft = await provider.adapt({ source: prose }, signal);
```

Speaker-prefixed dialogue, Chinese and Japanese quoted dialogue, and narration paragraphs are supported. Generated commands have stable IDs and are marked for review.

MPL-2.0.

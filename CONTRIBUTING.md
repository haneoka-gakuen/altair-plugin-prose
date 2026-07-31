# Contributing

Use Node.js 20 or newer and pnpm 11. Run `pnpm check` before opening a change.
Keep adaptation deterministic, framework-neutral, review-required, and
cancellation-safe. Add tests for provenance, stable IDs, repeated imports,
language patterns, and plugin lifecycle changes.

Do not add network calls, model runtimes, credentials, training data, extracted
game content, or duplicated Altair adaptation code.

Maintainers publish from GitHub releases through npm trusted publishing. The
npm package must authorize this repository's `.github/workflows/publish.yml`
workflow before the first release.

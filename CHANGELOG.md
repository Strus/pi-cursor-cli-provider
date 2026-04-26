# Changelog

## [0.9.2]

### Changed

- Documentation refresh: added an npm version badge, embedded a screenshot in the README, fixed some grammar and spelling.

## [0.9.1]

### Fixed

- Follow-up packaging release to fix an npm publish issue.

## [0.9.0]

### Added

- **Cursor session resume support**: Pi sessions can now be mapped back to saved Cursor sessions so later turns can resume the existing Cursor chat instead of resending the full conversation.
- **Image support**: pasted images and non-interactive image blobs are written to temporary files and forwarded to Cursor CLI as file paths.
- **Richer streaming rendering**: added support for rendering thinking blocks, todo-related tool calls, edit tool diffs, and improved tool call formatting in general.

### Changed

- Forked and repackaged the project as `@akepka/pi-cursor-cli-provider`.
- Rewrote the README
- Updated the discovered models list and added the Cursor CLI `--yolo` flag

### Fixed

- Fixed reasoning effort mapping for Cursor model variants.
- Do not register the provider when `agent models` fails, avoiding a broken provider state at startup.

## [0.1.2]

### Added

- **Duration and TTFT**: Assistant messages now include optional `duration` (total turn time) and `ttft` (time to first token) for display or logging.
- **Canonical model ID mapping**: You can select models by canonical IDs (e.g. `claude-sonnet-4-5`). When Pi provides a reasoning/thinking level, the provider resolves to the correct CLI model (e.g. thinking variant). Unmapped model IDs continue to work as before.
- **README model reference table**: Documented available models in a single table (Canonical ID, CLI model ID, Name, Reasoning) and noted that canonical IDs can use the thinking variant when reasoning is enabled.
- **Tooling**: `npm run lint` (Biome check), `npm run format` (Biome check --write), and `npm run typecheck` (TypeScript noEmit). Added `biome.json` and `tsconfig.json`.

## [0.1.1]

Small fixes.

## [0.1.0]

Initial release with Cursor Agent CLI provider, dynamic model discovery, and auth commands.

# Contributing to Jan Agent Team

Jan Agent Team is a fork of [janhq/jan](https://github.com/janhq/jan). This repository keeps Jan's original desktop client experience and adds Agent / Agent Team features backed by a local AG2 runtime.

## Scope

Contributions should stay focused on this fork:

- Agent and Agent Team management
- Multi-agent chat behavior
- AG2 runtime integration
- Jan-compatible UI and settings improvements
- Build and release fixes for this fork
- Upstream Jan compatibility fixes

For issues in unmodified Jan features, please first check whether the same issue exists in upstream Jan.

## Development Setup

Prerequisites:

- Node.js >= 20
- Yarn >= 4.5.3
- Rust stable
- Tauri platform dependencies
- macOS Apple Silicon builds require Xcode Command Line Tools

Install dependencies:

```bash
corepack enable
corepack prepare yarn@4.5.3 --activate
yarn install
```

Run in development:

```bash
yarn dev
```

## Useful Commands

Type-check the web app:

```bash
yarn workspace @janhq/web-app tsc -b
```

Run web app tests:

```bash
yarn workspace @janhq/web-app test
```

Build macOS Apple Silicon:

```bash
yarn tauri build --target aarch64-apple-darwin
```

## Project Areas

- `web-app/` - React UI, settings pages, chat UI, Agent / Team selection
- `src-tauri/` - Tauri backend, app resources, runtime process management
- `src-tauri/resources/agent-runtime/` - local Python runtime for Agent Team mode
- `core/` - shared TypeScript SDK and types inherited from Jan
- `extensions/` - Jan extension modules inherited from Jan
- `.github/workflows/` - build and release workflows

## Pull Requests

Please include:

- A short description of the user-facing change
- Screenshots or screen recordings for UI changes
- Test results for the relevant area
- Notes about any upstream Jan compatibility risk

Keep changes small when possible. Avoid unrelated refactors in the same PR.

## Upstream Jan Updates

This fork should keep `janhq/jan` as an upstream remote:

```bash
git remote add upstream https://github.com/janhq/jan.git
git fetch upstream
git merge upstream/main
```

When merging upstream, pay special attention to:

- Thread, assistant, provider, and model data structures
- Tauri resource bundling and permissions
- Settings routes and generated route tree
- Chat input and Assistant selector behavior
- Runtime process startup and bundled resource paths

## Do Not Commit

- API keys, tokens, cookies, or private provider configs
- Local build output, installers, DMG files, zip artifacts, or temporary tools
- `node_modules/`
- User-specific app data or logs

## License

This project follows the upstream Jan license. See [LICENSE](LICENSE).

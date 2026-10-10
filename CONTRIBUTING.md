# Contributing

Thanks for helping on RepoWiki→PDF. This project is a TypeScript npm-workspaces monorepo
(`core`, `theme`, `app`); read [ARCHITECTURE.md](./ARCHITECTURE.md) before touching the
pipeline.

## Getting set up

```bash
git clone <repo>
cd repowiki-to-pdf
npm install
```

Requirements: Windows + Node.js ≥ 20 / npm (workspaces). The `app` package needs Electron;
its binary is fetched by the normal `npm` postinstall.

## Branch model

- `main` holds the releasable state.
- Feature work happens on `feat/<short-description>` branches (also `fix/…`, `chore/…`).
- Open a **pull request** and **squash-merge** into `main`. Keep one logical change per PR.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <summary in the imperative, ≤ ~72 chars>
```

Common types: `feat`, `fix`, `test`, `docs`, `ci`, `chore`. Scopes map to packages or areas:
`core`, `theme`, `app`, `release`. Example: `fix(app): use pageSize not width/height in printToPDF`.

## Checks before you push

All of these must be green from the **repo root**:

```bash
npm run lint          # biome check .
npm run typecheck     # tsc --noEmit -p tsconfig.json
npm test              # Vitest unit tests for @repowiki-pdf/core
```

For changes that touch the export/print pipeline, also run the end-to-end fixture test
(needs Electron + a display-capable Windows session):

```bash
npm run test:integration -w @repowiki-pdf/app
```

Building the app and the installer:

```bash
npm run build -w @repowiki-pdf/app     # tsc (core+theme+electron) + vite build (renderer)
npm run dist  -w @repowiki-pdf/app     # electron-builder → release/ installer + portable
```

## Architecture Decision Records

Any significant, hard-to-reverse technical choice gets a short ADR, numbered
`NNNN-short-title.md` with **Status / Context / Decision
/ Consequences**. Add one when you introduce (or change) a decision like the printing engine,
the bookmark mechanism, or a dependency. Link the ADR from the PR description. (ADRs are kept
out of the public tree — ask the maintainers for the register.)

## Scope notes for v1

The core must never import Electron. The app is GUI-only (no CLI). Everything runs offline —
do not add CDN fetches or telemetry. Keep code `as any`-free and lint-clean.

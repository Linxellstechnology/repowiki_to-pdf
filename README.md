# REPOWIKI TO PDF

![Version](https://img.shields.io/badge/version-0.1.8-7C6BF5?style=flat-square)
[![Platform](https://img.shields.io/badge/platform-Windows-0067B8?style=flat-square)](#quick-start)
[![License](https://img.shields.io/badge/license-MIT-1d1d1f?style=flat-square)](LICENSE)
[![Built with](https://img.shields.io/badge/built%20with-Electron%20%2B%20TypeScript-2b78e4?style=flat-square)](https://www.electronjs.org)

**Turn a Qoder Repo Wiki into a single, vector, print-ready PDF — the technical documentation your clients actually open.**

You generate the wiki in Qoder. We typeset it: a cover, a clickable table of contents, native PDF bookmarks, Mermaid diagrams as real vectors, working internal links — A4 or Letter, ready to print or deliver.

![REPOWIKI TO PDF — English UI](assets/screenshots/ui-en.png)

The app ships with a full **中文 interface** as well — switch instantly from the header:

![REPOWIKI TO PDF — 中文 UI](assets/screenshots/ui-zh.png)

## Features

- **Vector text, never screenshots.** Selectable, searchable text with GitHub-style typography — headings, tables, lists, blockquotes and syntax-highlighted code.
- **Mermaid diagrams as inline SVG** — rendered offline with **Mermaid v12**, the same major Qoder uses, plus an auto-repair pass for the non-standard dialect Qoder tolerates. Broken diagrams degrade to a visible fallback instead of aborting the build.
- **Native PDF bookmarks** — a hierarchical outline mirroring the wiki tree, so readers can jump from the sidebar of any PDF viewer.
- **Clickable TOC + working internal links** — wiki-to-wiki links become in-document anchors; heading fragments resolve to the right section; external links stay clickable URIs.
- **Print-ready A4 / Letter** — per-section page breaks, cover page toggle, footer page numbers and gutter margins that keep content clear of the staple edge.
- **Two TOC sources** — the hierarchy is read from `wiki_plan.yaml` when present, and from Qoder's newer `repowiki-metadata.json` + the `content/` tree when it isn't; file order is the last resort. Every fallback is reported, never silent.
- **EN / 中文 app UI** — one click to switch, remembered between runs; documentation and About built in.
- **Offline and private.** No telemetry, no network calls, nothing leaves your machine. Your wiki is your business.

## Quick start (from source)

**Prerequisites:** Windows x64, [Node.js](https://nodejs.org/) ≥ 20 and npm (workspaces). End users need nothing — just the installer.

```bash
npm install                                  # core + theme + app workspaces

npm run dev   -w @repowiki-pdf/app           # Vite renderer + Electron, hot reload
npm run start -w @repowiki-pdf/app            # build Electron main, run it directly

npm test                                     # core unit tests (Vitest)
npm run typecheck                            # tsc across the monorepo
npm run lint                                 # Biome

npm run test:window    -w @repowiki-pdf/app   # real-window smoke gate
npm run test:integration -w @repowiki-pdf/app # fixture → PDF structural assertions

npm run dist -w @repowiki-pdf/app             # electron-builder → release/ (NSIS + portable)
```

> Installers are not published here (GitHub file-size limits): grab `repowiki-to-pdf Setup 0.1.8.exe` / `repowiki-to-pdf Portable 0.1.8.exe` from the release distribution channel.

## How to use

1. **Load Wiki Folder** — pick the project root that contains `.qoder/repowiki` (generate the wiki in Qoder first, then commit or pull it).
2. **Check** — the app scans the wiki, lists languages and page counts, and unlocks the next steps.
3. **Options** — page size (A4 / Letter), cover on/off, language, output folder (blank = project root).
4. **Build PDF** — progress advances page by page; a live WYSIWYG preview sits beside the controls.
5. **Open / Print** — a report shows the output path, page count and warnings, with one-click **Open The File** and **Print**. The document is written to `<Project>-Documentation.pdf`.

## Warning codes

The build never fails on a single local problem — it degrades gracefully and tells you exactly what happened:

| Code | Meaning |
|------|---------|
| `PLAN_MISSING` | No `wiki_plan.yaml` — pages were ordered alphabetically. |
| `PLAN_METADATA_USED` | `wiki_plan.yaml` was missing, so titles and numbering were inferred from the wiki metadata files. |
| `PLAN_TITLE_UNMATCHED` | A table-of-contents entry in the plan matches no page title. |
| `PAGE_NOT_IN_PLAN` | A wiki page exists but is not listed in the plan. |
| `MERMAID_INVALID` | A diagram could not be parsed even after the repair pass — a placeholder was rendered. |
| `MERMAID_REPAIRED` | Non-standard Qoder diagram syntax was auto-corrected before rendering (normal, informational). |
| `BROKEN_LINK` | A Markdown link points to a file that does not exist in the wiki. |
| `IMAGE_MISSING` | A referenced image file was not found. |
| `LINK_FRAG_DROPPED` | A link's `#fragment` could not be mapped to a specific page; the link still points to that page. |
| `SECTION_MARK_MISSING` | An expected section anchor was not found while building bookmarks or internal links. |

## Limitations

- **No automatic landscape pages.** Very wide diagrams scale to fit the portrait width; the landscape hook exists in the print CSS but is dormant (decision recorded internally — Architecture Decision Records available on request).
- **EXE file icon is the Electron default.** The signing/rcedit step is skipped in our build environment, so the binary itself keeps stock branding; window, taskbar and installer icons are custom.
- **Core-produced messages remain in French** (errors, phase labels, warning detail text). The app UI — including Documentation and About — is fully EN/中文; warning *codes* are technical and always verbatim.
- One language per export; GUI-only (no CLI); folder input is picker or paste, not drag-and-drop.

## Architecture

A small TypeScript monorepo: a pure **core** (no Electron), a **theme** package, and the Electron **app** (main / preload / renderer). Full pipeline and IPC contract: [ARCHITECTURE.md](ARCHITECTURE.md). Architectural decisions are recorded as Architecture Decision Records, available on request.

## Credits

Developed by **Hello Dati** — [contact@hellodati.com](mailto:contact@hellodati.com) — By **Nizar HAMDI**.

## License

MIT — see [LICENSE](LICENSE).

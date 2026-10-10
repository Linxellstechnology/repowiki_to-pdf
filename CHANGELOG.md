# Changelog

All notable changes to this project are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.11] - 2026-10-10

### Changed

- The interface is now **fully** in the selected language (EN / 中文): engine report lines (all ten codes) are localized sentences instead of raw French, progress phase labels are localized, and known engine errors (missing wiki, unwritable output, missing language) show a localized message. The original technical message stays available under each line's collapsible *technical detail*.
- "Warnings" renamed to **"Info"** throughout the UI (the codes are informational by design; severity is carried by the code itself).
- The PDF's own fixed texts (cover kicker, table-of-contents title, missing-page and diagram placeholders, and the Cover/Contents bookmarks) now follow the **wiki's** language — English or 中文 wikis produce English/Chinese chrome; other wiki languages fall back to French. UI language never affects the PDF.

### Internal

- `CoreWarning.vars` machine tokens (code + kind) drive UI localization; the IPC error envelope can carry `errorCode`/`errorVars`; new `pdfCopyFor()` copy table; +19 tests (core vars, resolver EN/zh, dictionary parity).

## [0.1.10] - 2026-10-10

### Fixed

- **Output folder on an existing directory (incl. drive roots like `D:\`) no longer fails with `EPERM`** — the app now creates the folder only when it is missing. Verified with a real export to a drive root.
- **Installers can no longer ship a stale UI bundle** — `npm run dist` now always rebuilds the renderer and main process before packaging (the 0.1.9 installer shipped a pre-bump renderer, which is why Help → About showed v0.1.8).
- Writing the PDF now fails with a clear message ("close the PDF if it is open in a reader, or pick another output folder") instead of a raw OS error.

## [0.1.9] - 2026-10-10

### Fixed

- erDiagram attributes with multi-word types (`enum identity_status status`) and space-separated constraint keys (`uuid property_id PK FK`) are now auto-adapted on export instead of falling back to the code block.
- sequenceDiagram actors named `Activate` (reserved-word collision) are now renamed even when glued to the left of an arrow (`Activate->>DB`).

### Internal

- Mermaid repair engine: two new validated erDiagram rules (R7, R8) and a rename-boundary bug fix in rule R1 (it silently skipped identifiers immediately followed by an arrow, producing partial renames).

## [0.1.8] - 2026-10-10

### Added

- Public launch: the repository is now open on GitHub with launch-ready documentation.
- The About dialog now shows a one-line product description (EN / 中文) under the tagline.

### Internal

- Test fixtures are generated on demand by a core fixture factory, so every run tests against freshly built, identical sample wikis.

## [0.1.7] - 2026-10-09

### Fixed

- Documentation and About dialogs are now high-contrast and readable on every backdrop — all text, links and code chips meet WCAG contrast targets.

### Changed

- README and community files (issue templates, security policy, code of conduct, contributing guide) polished for a public repository.

## [0.1.6] - 2026-10-09

### Added

- Full **中文 interface** — one-click language switch in the header, remembered between runs; first launch follows your system language.
- Application **Help menu** with in-app **Documentation** (how-to guide incl. every warning code) and **About** dialogs, both fully localized.

### Changed

- The version is now canonized in the About dialog only, keeping the main screen uncluttered.

## [0.1.5] - 2026-10-09

### Added

- **Glassmorphism redesign** — frosted cards, indigo→violet gradient backdrop and English flow labels (`Load Wiki Folder` / `Check` / `Options` / `Build PDF`) across the whole app.
- Custom **app icon** and uppercase **REPOWIKI TO PDF** branding in the window, taskbar and installer.

## [0.1.4] - 2026-10-09

### Added

- The running version is now visible in the app footer, so different builds can always self-identify.

## [0.1.3] - 2026-10-09

### Added

- **Mermaid v12 parity** — diagrams that render in Qoder now render in the PDF: `<<enum>>`/`<<union>>` class diagrams, generics, quoted members and sequence-diagram keywords included.
- **Repair-on-failure** — the non-standard Mermaid dialect Qoder tolerates is auto-corrected before rendering (reported as informational `MERMAID_REPAIRED`); genuinely broken syntax still degrades gracefully.
- **Metadata TOC fallback** — when `wiki_plan.yaml` is absent (newer Qoder versions), the hierarchy and page order are rebuilt from Qoder's wiki metadata instead of falling back to file order.

### Fixed

- Diagrams taller than the page are scaled to fit and always render complete on a single page.
- `MERMAID_INVALID` warnings now carry Mermaid's real parse error and a source excerpt instead of a bare "invalid diagram".

## [0.1.2] - 2026-10-09

### Fixed

- **Silent preload failure** — the folder picker and scan could hang without any message on some builds; the bridge now loads reliably and every failure surfaces as a visible error.

### Added

- **Print** action in the export report — send the finished PDF straight to your default printer.
- Clear analysis status (`Checking…` / success / error) with step cards that gate Options, Preview and Build until a valid wiki is found.

## [0.1.1] - 2026-10-09

### Fixed

- **Blank main window** in the packaged app — the renderer path resolved one directory too deep; a real-window smoke test now guards against this class of failure.

## [0.1.0] - 2026-10-09

Initial release: a Windows app that turns a Qoder Repo Wiki into one vector, print-ready PDF.

### Added

- Full pipeline: scan `.qoder/repowiki`, read the plan-driven table of contents, render Markdown with GitHub-style typography and syntax-highlighted code, convert Mermaid diagrams to inline SVG, rewrite internal links to in-document anchors and embed images.
- Single print-ready document: cover page, clickable TOC, per-section page breaks, A4/Letter, footer page numbers, native PDF bookmarks.
- GUI with folder picker, options, progress reporting, sandboxed WYSIWYG preview and an export report grouped by warning code.
- Graceful degradation: any local problem (missing plan, broken diagram, missing image or link) produces a warning and a usable PDF — never a failed build.
- Windows packaging: NSIS installer and portable `.exe`, fully offline.

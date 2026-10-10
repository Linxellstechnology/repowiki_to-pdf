// Dictionnaire anglais — source de vérité des libellés du renderer. Toute
// chaîne visible par l'utilisateur VIT ICI (composants : zéro littéral).
// Les valeurs sont des gabarits à jetons {name} interpolés par makeT ; les
// messages du core (erreurs scan/export, libellés de phase, warnings)
// restent verbatim — hors périmètre renderer.
export const en = {
  // Marque / chrome
  brand: 'REPOWIKI TO PDF',
  tagline: 'Turn a Qoder Repo Wiki into one print-ready PDF.',
  uiLanguageSwitch: 'Interface language',

  // Carte 1 — Load Wiki Folder
  loadWikiFolder: 'Load Wiki Folder',
  projectFolder: 'Project folder',
  browse: 'Browse…',
  check: 'Check',
  checking: 'Checking…',
  enterFolderFirst: 'Enter the project folder first.',
  wikiFound: 'Wiki found — {n} pages · languages: {langs}',
  noLanguageFound: 'No language with a content/ folder in this wiki.',
  scanLangPages: '{lang} — {n} pages',
  scanTotal: 'Total: {pages} pages, {langs} languages.',
  scanNoPlan: 'No wiki_plan.yaml: alphabetical order used.',

  // Carte 2 — Options
  options: 'Options',
  noLangAvailable:
    'No language available: check a project with a populated RepoWiki.',
  language: 'Language',
  languageOptionPages: '{lang} ({n} pages)',
  format: 'Format',
  coverPage: 'Cover page',
  outputFolder: 'Output folder',
  leaveEmptyOutput: 'Leave empty to write the PDF at the project root.',

  // Carte 3 — Preview
  preview: 'Preview',
  renderingPreview: 'Rendering preview…',
  previewBanner: 'Same rendering as the PDF — simulated A4 page',
  previewDocumentTitle: 'Document preview',
  previewGatedHint: 'Run a successful check first to preview the document.',
  previewIdle: 'Preview of the full document before building the PDF.',

  // Carte 4 — Build PDF
  buildPdf: 'Build PDF',
  buildingPdf: 'Building…',
  done: 'Done',
  failed: 'Failed',
  gatingHint: 'Run a successful check first.',
  buildDefaultNote:
    'The PDF is written to the output folder (project root by default).',
  progressMessage:
    'Building your document — this may take a while on larger projects.',
  preparingExport: 'Preparing the export…',

  // Rapport (actions + warnings)
  openTheFile: 'Open The File',
  openTheFileTitle: 'Open the PDF with the default application.',
  print: 'Print',
  printing: 'Printing…',
  printTitle: 'Print on the default printer (Windows).',
  printSent: 'Print job sent to the default printer.',
  pageWarningCount: '{pages} pages · {warnings} warnings',
  warningsGroup: 'Warnings ({n})',

  // Replicat localisable du message « bridge absent » (bridge.ts)
  bridgeUnavailable:
    'Electron bridge unavailable (window.api missing) — restart the app.',

  // Fenêtre À propos
  aboutTitle: 'About REPOWIKI TO PDF',
  // Description produit (0.1.8) — fenêtre À propos.
  aboutDescription:
    'REPOWIKI TO PDF turns a Qoder-generated Repo Wiki into a single, vector, print-ready PDF — cover, clickable table of contents, native bookmarks, Mermaid diagrams as SVG and working internal links. Built for developers delivering technical documentation to clients.',
  developedBy: 'Developed by Hello Dati',
  authorBy: 'By Nizar HAMDI',
  close: 'Close',

  // Fenêtre Documentation
  docsTitle: 'Documentation',
  docsWhatTitle: 'What it does',
  docsWhatBody:
    'For developers using Qoder: turns the generated Repo Wiki into a single vector, print-ready PDF (A4 or Letter) with a cover, clickable table of contents, native PDF bookmarks, Mermaid diagrams rendered as vectors and working internal links — the technical documentation deliverable for your clients.',
  docsHowTitle: 'How to use',
  docsStep1:
    'Generate the Repo Wiki in Qoder first (Repo Wiki panel → Generate).',
  docsStep2: 'Commit or pull it along with the repository.',
  docsStep3:
    'Here: Load Wiki Folder = the PROJECT ROOT containing .qoder/repowiki.',
  docsStep4: 'Check → Options → Build PDF → Open or Print.',
  docsReportTitle: 'Understanding the report',
  docsReportIntro:
    'Build warnings are grouped by code — here is what each one means.',
  warnTableCode: 'Code',
  warnTableMeaning: 'Meaning',
  warnPlanMissing: 'No wiki_plan.yaml — pages were ordered alphabetically.',
  warnPlanMetadataUsed:
    'wiki_plan.yaml was missing, so titles and numbering were inferred from the wiki metadata files.',
  warnPlanTitleUnmatched:
    'A table-of-contents entry in the plan matches no page title.',
  warnPageNotInPlan: 'A wiki page exists but is not listed in the plan.',
  warnMermaidInvalid:
    'A diagram could not be parsed even after the repair pass — a placeholder was rendered.',
  warnMermaidRepaired:
    'Non-standard Qoder diagram syntax was auto-corrected before rendering (normal, informational).',
  warnBrokenLink:
    'A Markdown link points to a file that does not exist in the wiki.',
  warnImageMissing: 'A referenced image file was not found.',
  warnLinkFragDropped:
    "A link's #fragment could not be mapped to a specific PDF page; the link still points to that page.",
  warnSectionMarkMissing:
    'An expected section anchor was not found while building bookmarks or internal links.',
  docsTipsTitle: 'Tips',
  docsTipTall: 'Diagrams taller than one page are automatically scaled to fit.',
  docsTipRepair:
    'Non-standard Qoder diagram syntax is auto-adapted — MERMAID_REPAIRED is normal, not an error.',
  docsTipOutput: 'By default the PDF is written to the project root.',
};

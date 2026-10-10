export interface WikiPlanDocument {
  title: string;
  goal?: string;
  parent?: string;
}

export interface PlanFile {
  documents: WikiPlanDocument[];
}

export interface WikiPageFile {
  name: string;
  path: string; // path absolu
}

export interface LanguageScan {
  language: string;
  contentDir: string;
  files: WikiPageFile[];
  /** `<lang>/meta/repowiki-metadata.json` si présent (Qoder récent), sinon null. */
  metaPath: string | null;
}

export interface ScanResult {
  projectRoot: string;
  projectName: string;
  wikiDir: string;
  planPath: string | null;
  languages: LanguageScan[];
}

export interface TocNode {
  id: string;
  title: string;
  filePath: string | null;
  level: number;
  children: TocNode[];
}

export interface CoreWarning {
  code: string;
  message: string;
  page?: string;
}

export interface RenderedPage {
  id: string;
  title: string;
  html: string;
}

export interface SectionMark {
  id: string;
  level: number;
  title: string;
}

export interface OutlineItem {
  title: string;
  level: number;
  pageIndex: number; // pageIndex 0-based
}

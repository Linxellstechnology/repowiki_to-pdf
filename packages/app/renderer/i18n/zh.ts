import type { UiStrings } from './index.js';

// Chinois simplifié — registre développeur naturel (pas de traduction
// littérale) : 加载 Wiki 文件夹 / 检查 / 选项 / 生成 PDF / 预览 / 完成 /
// 失败 / 警告… Les jetons {name} sont conservés à l'identique (test de
// parité) ; « Wiki », « PDF », « Mermaid », « Qoder » et les codes de
// warning restent tels quels dans le texte chinois.
export const zh: UiStrings = {
  // Marque / chrome
  brand: 'REPOWIKI TO PDF',
  tagline: '将 Qoder 生成的 Repo Wiki 转换为可直接打印的 PDF。',
  uiLanguageSwitch: '界面语言',

  // Carte 1 — 加载 Wiki 文件夹
  loadWikiFolder: '加载 Wiki 文件夹',
  projectFolder: '项目文件夹',
  browse: '浏览…',
  check: '检查',
  checking: '检查中…',
  enterFolderFirst: '请先填写项目文件夹路径。',
  wikiFound: '已找到 Wiki —— {n} 页 · 语言：{langs}',
  noLanguageFound: '该 Wiki 中没有包含 content/ 文件夹的语言。',
  scanLangPages: '{lang} —— {n} 页',
  scanTotal: '共 {pages} 页，{langs} 种语言。',
  scanNoPlan: '未找到 wiki_plan.yaml：将按字母顺序排列。',

  // Carte 2 — 选项
  options: '选项',
  noLangAvailable: '没有可用语言：请加载一个已生成 RepoWiki 的项目。',
  language: '语言',
  languageOptionPages: '{lang}（{n} 页）',
  format: '纸张',
  coverPage: '封面页',
  outputFolder: '输出文件夹',
  leaveEmptyOutput: '留空即把 PDF 写入项目根目录。',

  // Carte 3 — 预览
  preview: '预览',
  renderingPreview: '正在生成预览…',
  previewBanner: '渲染效果与 PDF 完全一致 —— 模拟 A4 页面',
  previewDocumentTitle: '文档预览',
  previewGatedHint: '请先成功完成一次检查，再预览文档。',
  previewIdle: '在生成 PDF 之前预览完整文档。',

  // Carte 4 — 生成 PDF
  buildPdf: '生成 PDF',
  buildingPdf: '正在生成…',
  done: '完成',
  failed: '失败',
  gatingHint: '请先成功完成一次检查。',
  buildDefaultNote: 'PDF 将写入输出文件夹（默认为项目根目录）。',
  progressMessage: '正在生成文档 —— 大型项目可能需要较长时间。',
  preparingExport: '正在准备导出…',

  // 报告（操作 + 警告）
  openTheFile: '打开文件',
  openTheFileTitle: '用默认应用打开 PDF。',
  print: '打印',
  printing: '正在打印…',
  printTitle: '用默认打印机打印（Windows）。',
  printSent: '打印任务已发送到默认打印机。',
  pageWarningCount: '共 {pages} 页 · {warnings} 条警告',
  warningsGroup: '警告（{n}）',

  // Replicat localisable du message « bridge absent » (bridge.ts)
  bridgeUnavailable: 'Electron 桥接不可用（缺少 window.api）—— 请重启应用。',

  // 关于窗口
  aboutTitle: '关于 REPOWIKI TO PDF',
  // Description produit (0.1.8) — fenêtre À propos.
  aboutDescription:
    'REPOWIKI TO PDF 将 Qoder 生成的 Repo Wiki 转换为单个矢量、可直接打印的 PDF——包含封面、可点击目录、原生 PDF 书签、以 SVG 渲染的 Mermaid 图表以及可用的内部链接。专为向客户交付技术文档的开发者打造。',
  developedBy: '由 Hello Dati 开发',
  authorBy: '作者：Nizar HAMDI',
  close: '关闭',

  // 文档窗口
  docsTitle: '使用文档',
  docsWhatTitle: '功能说明',
  docsWhatBody:
    '面向使用 Qoder 的开发者：把已生成的 Repo Wiki 转换为单个矢量、可直接打印的 PDF（A4 或 Letter），包含封面、可点击目录、原生 PDF 书签、矢量渲染的 Mermaid 图表以及可用的内部链接 —— 一份可直接交付客户的技术文档。',
  docsHowTitle: '使用步骤',
  docsStep1: '先在 Qoder 中生成 Repo Wiki（Repo Wiki 面板 → 生成）。',
  docsStep2: '随仓库一起提交或拉取该 Wiki。',
  docsStep3:
    '在本应用中：加载 Wiki 文件夹 = 包含 .qoder/repowiki 的项目根目录。',
  docsStep4: '检查 → 选项 → 生成 PDF → 打开或打印。',
  docsReportTitle: '解读构建报告',
  docsReportIntro: '构建警告按代码分组，各代码含义如下。',
  warnTableCode: '代码',
  warnTableMeaning: '含义',
  warnPlanMissing: '缺少 wiki_plan.yaml —— 页面按字母顺序排列。',
  warnPlanMetadataUsed:
    '缺少 wiki_plan.yaml，标题与编号已从 Wiki 元数据文件推断。',
  warnPlanTitleUnmatched: '计划目录中的某个条目找不到匹配的页面标题。',
  warnPageNotInPlan: '某个 Wiki 页面未被计划收录。',
  warnMermaidInvalid: '某个图表经修复后仍无法解析 —— 已渲染占位图。',
  warnMermaidRepaired:
    'Qoder 的非标准图表语法已在渲染前自动修正（正常提示，无需处理）。',
  warnBrokenLink: '某个 Markdown 链接指向 Wiki 中不存在的文件。',
  warnImageMissing: '引用的图片文件未找到。',
  warnLinkFragDropped:
    '链接的 #锚点 无法映射到具体 PDF 页面，链接仍指向该页面。',
  warnSectionMarkMissing: '构建书签或内部链接时未找到预期的章节锚点。',
  docsTipsTitle: '使用小贴士',
  docsTipTall: '超过一页高度的图表会自动缩放以适配页面。',
  docsTipRepair:
    '非标准的 Qoder 图表语法会被自动适配 —— MERMAID_REPAIRED 属正常情况，并非错误。',
  docsTipOutput: '默认情况下，PDF 会写入项目根目录。',
};

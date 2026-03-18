// Main export: the Vitest reporter class
export { TestSpecReporter } from "./reporter/test-spec-reporter.js";

// Default export for vitest reporter registration via package name
export { TestSpecReporter as default } from "./reporter/test-spec-reporter.js";

// Type exports
export type {
  TestSpecConfig,
  TestRunData,
  TestCaseData,
  TestSuiteData,
  LayerStats,
  ArchLayer,
  LayerMapping,
  TestState,
} from "./types/index.js";

// Utility exports for programmatic use
export { classifyLayer } from "./classifier/layer-classifier.js";
export { generateReport, generateSplitReport } from "./generator/report-generator.js";
export type { SplitReportResult } from "./generator/report-generator.js";
export { MarkdownBuilder } from "./generator/markdown-builder.js";
export { resolveConfig } from "./config/schema.js";
export { getMessages } from "./i18n/index.js";
export type { Locale, LocaleMessages } from "./i18n/index.js";

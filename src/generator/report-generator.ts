import type { Locale, LocaleMessages } from "../i18n/index.js";
import { getMessages } from "../i18n/index.js";
import type { TestCaseData, TestRunData, TestSuiteData, LayerStats } from "../types/index.js";
import { MarkdownBuilder } from "./markdown-builder.js";

function stateIcon(state: string): string {
  switch (state) {
    case "passed":
      return "✅";
    case "failed":
      return "❌";
    case "skipped":
      return "⏭";
    default:
      return "❓";
  }
}

function formatDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Convert a layer name to a safe filename slug. */
function layerSlug(layer: string): string {
  return layer.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/** Write the header + summary section shared by both modes. */
function writeHeader(md: MarkdownBuilder, data: TestRunData, t: LocaleMessages): void {
  md.heading(1, `${t.reportTitle} - ${data.projectName}`);
  md.blockquote(
    `${t.generatedAt}: ${formatDate(data.generatedAt)}\n` +
      `${t.total}: ${data.totalTests} ${t.tests} | ` +
      `✅ ${data.totalPassed} ${t.passed} | ` +
      `❌ ${data.totalFailed} ${t.failed} | ` +
      `⏭ ${data.totalSkipped} ${t.skipped} | ` +
      `${t.duration}: ${formatDuration(data.totalDuration)}`,
  );
}

/** Format coverage ratio as percentage string. */
function formatCoveragePercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** Build coverage suffix for suite heading (e.g., " (2/4 methods, 50%)"). */
function coverageSuffix(suite: TestSuiteData): string {
  if (!suite.coverage || suite.coverage.publicMethods.length === 0) return "";
  const { testedMethods, publicMethods, coverageRatio } = suite.coverage;
  return ` (${testedMethods.length}/${publicMethods.length} methods, ${formatCoveragePercent(coverageRatio)})`;
}

/** Write the suite detail table for a single suite. */
function writeSuiteTable(
  md: MarkdownBuilder,
  suite: TestSuiteData,
  t: LocaleMessages,
  headingLevel: number = 3,
): void {
  const hasFailure = suite.tests.some((test) => test.state === "failed");
  const prefix = hasFailure ? "❌ " : "";
  md.heading(headingLevel, `${prefix}${suite.name}${coverageSuffix(suite)}`);
  md.paragraph(`\`${suite.filePath}\``);

  md.table(
    [t.headerIndex, t.headerTarget, t.headerPerspective, t.headerResult, t.headerDuration],
    suite.tests.map((test, i) => [
      String(i + 1),
      test.target || "-",
      test.name,
      stateIcon(test.state),
      formatDuration(test.duration),
    ]),
  );

  // Untested methods list
  if (suite.coverage && suite.coverage.untestedMethods.length > 0) {
    md.heading(headingLevel + 1, t.untestedMethods);
    for (const method of suite.coverage.untestedMethods) {
      md.raw(`- \`${method.signature}\``);
    }
    md.raw("");
  }
}

/** Compute method coverage stats per layer for summary table. */
function computeLayerCoverage(
  suites: readonly TestSuiteData[],
  layer: string,
): { tested: number; total: number } {
  let tested = 0;
  let total = 0;
  for (const suite of suites) {
    if (suite.layer !== layer || !suite.coverage) continue;
    tested += suite.coverage.testedMethods.length;
    total += suite.coverage.publicMethods.length;
  }
  return { tested, total };
}

/** Write the layer summary table (with optional links for split mode). */
function writeSummaryTable(
  md: MarkdownBuilder,
  data: TestRunData,
  t: LocaleMessages,
  withLinks = false,
): void {
  const headers = [t.headerLayer, t.headerTestCount, t.headerPassed, t.headerFailed];
  if (data.coverageAnalyzed) headers.push(t.headerMethodCoverage);
  headers.push(t.headerPerspectives);

  const rows = data.layerStats.map((s) => {
    const layerLabel = withLinks
      ? `[${s.layer}](./${layerSlug(s.layer)}.md)`
      : s.layer;
    const row = [layerLabel, String(s.total), String(s.passed), String(s.failed)];
    if (data.coverageAnalyzed) {
      const { tested, total } = computeLayerCoverage(data.suites, s.layer);
      row.push(total > 0 ? `${tested}/${total} (${formatCoveragePercent(tested / total)})` : "-");
    }
    row.push(s.perspectives.join(", "));
    return row;
  });

  md.table(headers, rows);
}

/** Write the failed tests detail section. */
function writeFailedSection(
  md: MarkdownBuilder,
  failedTests: readonly TestCaseData[],
  t: LocaleMessages,
): void {
  if (failedTests.length === 0) return;

  md.heading(2, t.failedTestsDetail);
  for (const test of failedTests) {
    md.heading(3, `❌ ${test.fullName}`);
    md.paragraph(`**${t.file}**: \`${test.filePath}\``);
    for (const error of test.errors) {
      md.codeBlock(error, "");
    }
  }
}

/**
 * Generate a single-file Markdown test perspective report.
 */
export function generateReport(
  data: TestRunData,
  locale: Locale = "ja",
): string {
  const md = new MarkdownBuilder();
  const t = getMessages(locale);

  writeHeader(md, data, t);

  // Layer Summary Table
  md.heading(2, t.perspectiveSummary);
  writeSummaryTable(md, data, t);

  // Detailed per-suite tables
  md.heading(2, t.details);
  for (const suite of data.suites) {
    const hasFailure = suite.tests.some((test) => test.state === "failed");
    const prefix = hasFailure ? "❌ " : "";
    md.heading(3, `${prefix}${suite.layer} / ${suite.name}${coverageSuffix(suite)}`);
    md.paragraph(`\`${suite.filePath}\``);

    md.table(
      [t.headerIndex, t.headerTarget, t.headerPerspective, t.headerResult, t.headerDuration],
      suite.tests.map((test, i) => [
        String(i + 1),
        test.target || "-",
        test.name,
        stateIcon(test.state),
        formatDuration(test.duration),
      ]),
    );

    // Untested methods list
    if (suite.coverage && suite.coverage.untestedMethods.length > 0) {
      md.heading(4, t.untestedMethods);
      for (const method of suite.coverage.untestedMethods) {
        md.raw(`- \`${method.signature}\``);
      }
      md.raw("");
    }
  }

  writeFailedSection(md, data.failedTests, t);

  return md.build();
}

/**
 * Result of split report generation.
 * Keys are relative file paths (e.g., "index.md", "domain.md").
 */
export interface SplitReportResult {
  /** The index/summary file content. Key = relative filename. */
  readonly files: ReadonlyMap<string, string>;
}

/**
 * Generate per-layer Markdown files + an index summary file.
 *
 * Output structure:
 * - index file (outputPath)    → summary table with links to layer files
 * - layer files (outputDir/)   → detail tables per layer
 */
export function generateSplitReport(
  data: TestRunData,
  locale: Locale = "ja",
): SplitReportResult {
  const t = getMessages(locale);
  const files = new Map<string, string>();

  // Group suites by layer
  const suitesByLayer = new Map<string, TestSuiteData[]>();
  for (const suite of data.suites) {
    const arr = suitesByLayer.get(suite.layer);
    if (arr) {
      arr.push(suite);
    } else {
      suitesByLayer.set(suite.layer, [suite]);
    }
  }

  // Generate per-layer files
  for (const [layer, suites] of suitesByLayer) {
    const md = new MarkdownBuilder();
    const slug = layerSlug(layer);

    const layerStats = data.layerStats.find((s) => s.layer === layer);
    const total = layerStats?.total ?? 0;
    const passed = layerStats?.passed ?? 0;
    const failed = layerStats?.failed ?? 0;

    md.heading(1, `${layer}`);
    md.blockquote(
      `${t.total}: ${total} ${t.tests} | ` +
        `✅ ${passed} ${t.passed} | ` +
        `❌ ${failed} ${t.failed}`,
    );

    for (const suite of suites) {
      writeSuiteTable(md, suite, t, 2);
    }

    // Failed tests for this layer
    const layerFailedTests = data.failedTests.filter((test) =>
      suites.some((s) => s.tests.some((st) => st.fullName === test.fullName)),
    );
    writeFailedSection(md, layerFailedTests, t);

    files.set(`${slug}.md`, md.build());
  }

  // Generate index file
  const indexMd = new MarkdownBuilder();
  writeHeader(indexMd, data, t);

  // Layer Summary Table with links
  indexMd.heading(2, t.perspectiveSummary);
  writeSummaryTable(indexMd, data, t, true);

  // Failed tests summary in index
  writeFailedSection(indexMd, data.failedTests, t);

  files.set("index.md", indexMd.build());

  return { files };
}

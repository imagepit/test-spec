import type { Locale, LocaleMessages } from "../i18n/index.js";
import { getMessages } from "../i18n/index.js";
import type { TestCaseData, TestRunData, TestSuiteData } from "../types/index.js";
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

/** Write the suite detail table for a single suite. */
function writeSuiteTable(
  md: MarkdownBuilder,
  suite: TestSuiteData,
  t: LocaleMessages,
  headingLevel: number = 3,
): void {
  const hasFailure = suite.tests.some((test) => test.state === "failed");
  const prefix = hasFailure ? "❌ " : "";
  md.heading(headingLevel, `${prefix}${suite.name}`);
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
  md.table(
    [t.headerLayer, t.headerTestCount, t.headerPassed, t.headerFailed, t.headerPerspectives],
    data.layerStats.map((s) => [
      s.layer,
      String(s.total),
      String(s.passed),
      String(s.failed),
      s.perspectives.join(", "),
    ]),
  );

  // Detailed per-suite tables
  md.heading(2, t.details);
  for (const suite of data.suites) {
    const hasFailure = suite.tests.some((test) => test.state === "failed");
    const prefix = hasFailure ? "❌ " : "";
    md.heading(3, `${prefix}${suite.layer} / ${suite.name}`);
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
  indexMd.table(
    [t.headerLayer, t.headerTestCount, t.headerPassed, t.headerFailed, t.headerPerspectives],
    data.layerStats.map((s) => {
      const slug = layerSlug(s.layer);
      return [
        `[${s.layer}](./${slug}.md)`,
        String(s.total),
        String(s.passed),
        String(s.failed),
        s.perspectives.join(", "),
      ];
    }),
  );

  // Failed tests summary in index
  writeFailedSection(indexMd, data.failedTests, t);

  files.set("index.md", indexMd.build());

  return { files };
}

import type { Locale } from "../i18n/index.js";
import { getMessages } from "../i18n/index.js";
import type { TestRunData } from "../types/index.js";
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

/**
 * Generate a Markdown test perspective report from TestRunData.
 */
export function generateReport(
  data: TestRunData,
  locale: Locale = "ja",
): string {
  const md = new MarkdownBuilder();
  const t = getMessages(locale);

  // Header
  md.heading(1, `${t.reportTitle} - ${data.projectName}`);
  md.blockquote(
    `${t.generatedAt}: ${formatDate(data.generatedAt)}\n` +
      `${t.total}: ${data.totalTests} ${t.tests} | ` +
      `✅ ${data.totalPassed} ${t.passed} | ` +
      `❌ ${data.totalFailed} ${t.failed} | ` +
      `⏭ ${data.totalSkipped} ${t.skipped} | ` +
      `${t.duration}: ${formatDuration(data.totalDuration)}`,
  );

  // Layer Summary Table
  md.heading(2, t.perspectiveSummary);
  md.table(
    [
      t.headerLayer,
      t.headerTestCount,
      t.headerPassed,
      t.headerFailed,
      t.headerPerspectives,
    ],
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

  // Failed Tests Detail Section
  if (data.failedTests.length > 0) {
    md.heading(2, t.failedTestsDetail);

    for (const test of data.failedTests) {
      md.heading(3, `❌ ${test.fullName}`);
      md.paragraph(`**${t.file}**: \`${test.filePath}\``);

      for (const error of test.errors) {
        md.codeBlock(error, "");
      }
    }
  }

  return md.build();
}

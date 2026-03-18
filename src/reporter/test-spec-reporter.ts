import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { resolveConfig } from "../config/schema.js";
import { TestDataCollector } from "../collector/test-data-collector.js";
import { generateReport } from "../generator/report-generator.js";
import type { TestSpecConfig, TestState } from "../types/index.js";

// Use type-only imports for vitest types.
// TestCase, TestModule, Vitest are exported from "vitest/node".
// Reporter is exported from "vitest/reporters".
import type { Reporter } from "vitest/reporters";
import type { TestCase, TestModule, Vitest } from "vitest/node";

/**
 * Walk the parent chain to collect all suite names from top to bottom.
 * Returns [topSuiteName, ...intermediateSuiteNames].
 *
 * Example: describe('Course Entity') > describe('execute()') > it('test')
 * → ["Course Entity", "execute()"]
 */
function getSuiteChain(testCase: TestCase): string[] {
  const chain: string[] = [];
  let current: TestCase["parent"] = testCase.parent;

  while (current && current.type === "suite") {
    chain.push(current.name);
    current = current.parent;
  }

  // chain is bottom-up, reverse to get top-down
  return chain.reverse();
}

/**
 * Extract error messages from a test case result.
 */
function extractErrors(testCase: TestCase): string[] {
  const result = testCase.result();
  if (result.state !== "failed" || !result.errors) return [];
  return result.errors.map((e) => {
    if (typeof e === "object" && e !== null && "message" in e) {
      return String((e as { message: string }).message);
    }
    return String(e);
  });
}

/**
 * Vitest custom reporter that generates Markdown test perspective reports.
 *
 * Usage in vitest.config.ts:
 * ```typescript
 * reporters: [
 *   "default",
 *   ["test-spec", { projectName: "my-project", outputPath: "docs/test-report.md" }],
 * ]
 * ```
 */
export class TestSpecReporter implements Reporter {
  private collector!: TestDataCollector;
  private config!: TestSpecConfig;

  constructor(options: Record<string, unknown> = {}) {
    this.config = resolveConfig(options);
    this.collector = new TestDataCollector(this.config);
  }

  onInit(vitest: Vitest): void {
    // Update projectRoot from vitest if not explicitly configured
    if (vitest.config?.root) {
      const updatedConfig = {
        ...this.config,
        projectRoot: vitest.config.root,
      };
      this.config = updatedConfig;
      this.collector = new TestDataCollector(updatedConfig);
    }
  }

  onTestCaseResult(testCase: TestCase): void {
    const result = testCase.result();
    const diagnostic = testCase.diagnostic();
    const state: TestState =
      result.state === "passed" || result.state === "failed"
        ? result.state
        : "skipped";

    const suiteChain = getSuiteChain(testCase);
    const suiteName = suiteChain[0] ?? "";
    // Intermediate describes = test target (method/function name)
    const target = suiteChain.slice(1).join(" > ");

    this.collector.addTestCase({
      fullName: testCase.fullName,
      name: testCase.name,
      target,
      state,
      duration: diagnostic?.duration ?? 0,
      errors: extractErrors(testCase),
      moduleId: testCase.module.moduleId,
      suiteName,
    });
  }

  async onTestRunEnd(
    _testModules: ReadonlyArray<TestModule>,
    _unhandledErrors: ReadonlyArray<unknown>,
    _reason: string,
  ): Promise<void> {
    const runData = this.collector.buildTestRunData();
    const markdown = generateReport(runData, this.config.locale);

    const outputPath = resolve(this.config.projectRoot, this.config.outputPath);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, markdown, "utf-8");

    console.log(`\n[test-spec] Report generated: ${this.config.outputPath}`);
    console.log(
      `[test-spec] ${runData.totalTests} tests | ` +
        `✅ ${runData.totalPassed} passed | ` +
        `❌ ${runData.totalFailed} failed | ` +
        `⏭ ${runData.totalSkipped} skipped`,
    );
  }
}

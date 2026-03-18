import path from "node:path";
import { classifyLayer } from "../classifier/layer-classifier.js";
import type {
  ArchLayer,
  LayerStats,
  TestCaseData,
  TestRunData,
  TestSpecConfig,
  TestState,
  TestSuiteData,
} from "../types/index.js";

/** Intermediate collected data for a single test case. */
interface RawTestCase {
  readonly fullName: string;
  readonly name: string;
  readonly state: TestState;
  readonly duration: number;
  readonly errors: readonly string[];
  readonly moduleId: string;
  readonly suiteName: string;
}

/**
 * Accumulates test results during a Vitest test run
 * and builds the final TestRunData for report generation.
 */
export class TestDataCollector {
  private readonly cases: RawTestCase[] = [];
  private readonly config: TestSpecConfig;

  constructor(config: TestSpecConfig) {
    this.config = config;
  }

  /**
   * Add a completed test case.
   * Called from the reporter's onTestCaseResult hook.
   */
  addTestCase(data: {
    fullName: string;
    name: string;
    state: TestState;
    duration: number;
    errors: readonly string[];
    moduleId: string;
    suiteName: string;
  }): void {
    this.cases.push(data);
  }

  /** Build the final TestRunData from all accumulated test cases. */
  buildTestRunData(): TestRunData {
    const suites = this.groupIntoSuites();
    const layerStats = this.computeLayerStats(suites);
    const failedTests = this.cases
      .filter((c) => c.state === "failed")
      .map((c) => this.toTestCaseData(c));

    let totalDuration = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const c of this.cases) {
      totalDuration += c.duration;
      if (c.state === "passed") totalPassed++;
      else if (c.state === "failed") totalFailed++;
      else totalSkipped++;
    }

    return {
      projectName: this.config.projectName,
      generatedAt: new Date(),
      suites,
      layerStats,
      totalTests: this.cases.length,
      totalPassed,
      totalFailed,
      totalSkipped,
      totalDuration,
      failedTests,
    };
  }

  private toTestCaseData(raw: RawTestCase): TestCaseData {
    return {
      fullName: raw.fullName,
      name: raw.name,
      state: raw.state,
      duration: raw.duration,
      errors: raw.errors,
      filePath: this.relativePath(raw.moduleId),
    };
  }

  private relativePath(moduleId: string): string {
    if (path.isAbsolute(moduleId)) {
      return path.relative(this.config.projectRoot, moduleId);
    }
    return moduleId;
  }

  /**
   * Group collected test cases into suites by (moduleId + suiteName).
   */
  private groupIntoSuites(): TestSuiteData[] {
    const groupKey = (c: RawTestCase) => `${c.moduleId}::${c.suiteName}`;
    const groups = new Map<string, RawTestCase[]>();

    for (const c of this.cases) {
      const key = groupKey(c);
      const arr = groups.get(key);
      if (arr) {
        arr.push(c);
      } else {
        groups.set(key, [c]);
      }
    }

    const suites: TestSuiteData[] = [];
    for (const [, cases] of groups) {
      const first = cases[0];
      const layer = classifyLayer(
        first.moduleId,
        this.config.projectRoot,
        this.config.layerMapping,
      );
      suites.push({
        name: first.suiteName || path.basename(first.moduleId, ".test.ts"),
        layer,
        filePath: this.relativePath(first.moduleId),
        tests: cases.map((c) => this.toTestCaseData(c)),
      });
    }

    // Sort by layer then suite name
    const knownOrder: Record<string, number> = {
      Domain: 0,
      Application: 1,
      Presentation: 2,
      Infrastructure: 3,
      App: 4,
      Lib: 5,
      Other: 99,
    };
    const layerSort = (layer: string) => knownOrder[layer] ?? 50;
    suites.sort(
      (a, b) =>
        layerSort(a.layer) - layerSort(b.layer) ||
        a.name.localeCompare(b.name),
    );

    return suites;
  }

  /**
   * Compute per-layer statistics from grouped suites.
   */
  private computeLayerStats(suites: readonly TestSuiteData[]): LayerStats[] {
    const statsMap = new Map<
      ArchLayer,
      { total: number; passed: number; failed: number; skipped: number; perspectives: Set<string> }
    >();

    for (const suite of suites) {
      let entry = statsMap.get(suite.layer);
      if (!entry) {
        entry = { total: 0, passed: 0, failed: 0, skipped: 0, perspectives: new Set() };
        statsMap.set(suite.layer, entry);
      }
      entry.perspectives.add(suite.name);
      for (const test of suite.tests) {
        entry.total++;
        if (test.state === "passed") entry.passed++;
        else if (test.state === "failed") entry.failed++;
        else entry.skipped++;
      }
    }

    // Sort layers using same order as suites
    const knownOrder: Record<string, number> = {
      Domain: 0,
      Application: 1,
      Presentation: 2,
      Infrastructure: 3,
      App: 4,
      Lib: 5,
      Other: 99,
    };
    const sortedLayers = [...statsMap.keys()].sort(
      (a, b) => (knownOrder[a] ?? 50) - (knownOrder[b] ?? 50),
    );

    return sortedLayers.map((layer) => {
        const entry = statsMap.get(layer)!;
        return {
          layer,
          total: entry.total,
          passed: entry.passed,
          failed: entry.failed,
          skipped: entry.skipped,
          perspectives: [...entry.perspectives],
        };
      });
  }
}

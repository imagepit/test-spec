/** Result state of a single test */
export type TestState = "passed" | "failed" | "skipped";

/**
 * Architecture layer classification.
 * Well-known layers are predefined, but any string is accepted
 * to support custom layers (e.g., "App", "Lib", "Shared").
 */
export type ArchLayer =
  | "Domain"
  | "Application"
  | "Presentation"
  | "Infrastructure"
  | "App"
  | "Lib"
  | "Other"
  | (string & {});

/** A single layer mapping rule */
export interface LayerMapping {
  /** Substring pattern to match against test file paths */
  readonly pattern: string;
  /** Layer to assign when pattern matches */
  readonly layer: ArchLayer;
}

/** A single test case result */
export interface TestCaseData {
  /** Full name including parent suites (e.g., "GetCourseDetailUseCase > コース詳細を取得できる") */
  readonly fullName: string;
  /** Individual test name (the it() label) */
  readonly name: string;
  /** Result state */
  readonly state: TestState;
  /** Duration in ms */
  readonly duration: number;
  /** Error messages if failed */
  readonly errors: readonly string[];
  /** Source module file path (relative to project root) */
  readonly filePath: string;
}

/** A test suite (describe block) grouping */
export interface TestSuiteData {
  /** Suite name (the top-level describe() label) */
  readonly name: string;
  /** Layer classification */
  readonly layer: ArchLayer;
  /** Source file path (relative to project root) */
  readonly filePath: string;
  /** Test cases within this suite */
  readonly tests: readonly TestCaseData[];
}

/** Per-layer statistics */
export interface LayerStats {
  readonly layer: ArchLayer;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  /** Top-level describe names as covered perspectives */
  readonly perspectives: readonly string[];
}

/** Complete test run data for report generation */
export interface TestRunData {
  readonly projectName: string;
  readonly generatedAt: Date;
  readonly suites: readonly TestSuiteData[];
  readonly layerStats: readonly LayerStats[];
  readonly totalTests: number;
  readonly totalPassed: number;
  readonly totalFailed: number;
  readonly totalSkipped: number;
  readonly totalDuration: number;
  readonly failedTests: readonly TestCaseData[];
}

/** Reporter configuration */
export interface TestSpecConfig {
  /** Project name displayed in report header */
  readonly projectName: string;
  /** Output file path (default: "docs/test-report.md") */
  readonly outputPath: string;
  /** Display locale ("ja" | "en", default: "ja") */
  readonly locale: "ja" | "en";
  /** Layer classification rules: maps path patterns to layers */
  readonly layerMapping: readonly LayerMapping[];
  /** Project root directory */
  readonly projectRoot: string;
}

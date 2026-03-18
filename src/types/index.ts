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
  /** Full name including parent suites (e.g., "GetCourseDetailUseCase > execute() > コース詳細を取得できる") */
  readonly fullName: string;
  /** Individual test name (the it() label) */
  readonly name: string;
  /** Test target — intermediate describe name(s) between top suite and test (e.g., "execute()", "章の順序制御") */
  readonly target: string;
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
  /** Method coverage analysis (only when analyzeCoverage is enabled) */
  readonly coverage?: SuiteCoverage;
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
  /** Whether source coverage analysis was performed */
  readonly coverageAnalyzed: boolean;
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
  /** Split report into per-layer files (default: false) */
  readonly splitByLayer: boolean;
  /** Enable source code analysis for method coverage (default: false) */
  readonly analyzeCoverage: boolean;
  /** Path to tsconfig.json for ts-morph (auto-detected if omitted) */
  readonly tsConfigPath?: string;
  /** Custom test-to-source file resolution patterns */
  readonly sourceFilePatterns?: readonly SourceFilePattern[];
}

// --- Coverage Analysis Types ---

/** A public method or function found in source code */
export interface SourceMethod {
  /** Method/function name */
  readonly name: string;
  /** Kind of declaration */
  readonly kind: "method" | "function" | "constructor" | "getter" | "setter";
  /** Full signature (e.g., "execute(input: CourseInput): Promise<Course>") */
  readonly signature: string;
}

/** Coverage analysis result for a single test suite */
export interface SuiteCoverage {
  /** Suite name (matches TestSuiteData.name) */
  readonly suiteName: string;
  /** Resolved source file path (null if not found) */
  readonly sourceFilePath: string | null;
  /** All public methods found in source */
  readonly publicMethods: readonly SourceMethod[];
  /** Method names that have matching test targets */
  readonly testedMethods: readonly string[];
  /** Methods without matching test targets */
  readonly untestedMethods: readonly SourceMethod[];
  /** Coverage ratio (0.0 to 1.0) */
  readonly coverageRatio: number;
}

/** Custom pattern for resolving test files to source files */
export interface SourceFilePattern {
  /** Regex pattern to match test file path */
  readonly testPattern: string;
  /** Replacement string for source file path */
  readonly sourceReplace: string;
}

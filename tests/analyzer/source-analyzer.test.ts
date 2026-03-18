import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { analyzeSourceCoverage, attachCoverage, inferTestTargets } from "../../src/analyzer/source-analyzer.js";
import type { TestSuiteData, TestSpecConfig } from "../../src/types/index.js";
import { DEFAULT_LAYER_MAPPINGS } from "../../src/config/defaults.js";

const fixturesDir = resolve(__dirname, "../fixtures");

function createConfig(overrides: Partial<TestSpecConfig> = {}): TestSpecConfig {
  return {
    projectName: "test-project",
    outputPath: "docs/test-report.md",
    locale: "ja",
    layerMapping: DEFAULT_LAYER_MAPPINGS,
    projectRoot: fixturesDir,
    splitByLayer: false,
    analyzeCoverage: true,
    ...overrides,
  };
}

function createSuite(overrides: Partial<TestSuiteData> = {}): TestSuiteData {
  return {
    name: "SampleService",
    layer: "Domain",
    filePath: "sample-class.test.ts",
    tests: [
      {
        fullName: "SampleService > execute() > runs correctly",
        name: "runs correctly",
        target: "execute()",
        state: "passed",
        duration: 5,
        errors: [],
        filePath: "sample-class.test.ts",
      },
      {
        fullName: "SampleService > validate() > validates input",
        name: "validates input",
        target: "validate()",
        state: "passed",
        duration: 3,
        errors: [],
        filePath: "sample-class.test.ts",
      },
    ],
    ...overrides,
  };
}

describe("analyzeSourceCoverage", () => {
  it("extracts public methods and matches against test targets", async () => {
    // sample-class.test.ts → sample-class.ts (co-located strategy)
    const config = createConfig();
    const suites = [createSuite()];

    const coverageMap = await analyzeSourceCoverage(suites, config);
    const key = "sample-class.test.ts::SampleService";
    const coverage = coverageMap.get(key);

    expect(coverage).toBeDefined();
    expect(coverage!.sourceFilePath).toBe("sample-class.ts");

    // publicMethods includes all extracted (including constructor for reference)
    // but coverable methods exclude constructor for coverage calculation
    const methodNames = coverage!.publicMethods.map((m) => m.name);
    expect(methodNames).toContain("execute");
    expect(methodNames).toContain("validate");
    expect(methodNames).toContain("toDTO");
    expect(methodNames).toContain("helperFunction");
    expect(methodNames).toContain("formatValue");
    expect(methodNames).not.toContain("transform"); // private
    expect(methodNames).not.toContain("constructor"); // excluded from coverage

    // Tested: execute, validate (from test targets),
    // + toDTO, name (from test file content scan — fixture test file references them)
    expect(coverage!.testedMethods).toContain("execute");
    expect(coverage!.testedMethods).toContain("validate");
    expect(coverage!.testedMethods).toContain("toDTO");

    // Untested: helperFunction, formatValue (not referenced in fixture test file)
    const untestedNames = coverage!.untestedMethods.map((m) => m.name);
    expect(untestedNames).toContain("helperFunction");
    expect(untestedNames).toContain("formatValue");
    expect(untestedNames).not.toContain("execute");
    expect(untestedNames).not.toContain("validate");
    expect(untestedNames).not.toContain("constructor");

    // Coverage ratio: >0 and <1
    expect(coverage!.coverageRatio).toBeGreaterThan(0);
    expect(coverage!.coverageRatio).toBeLessThan(1);
  });

  it("matches methods via test names when targets are scenario names", async () => {
    // Simulate: describe('正常系') > it('executeが正しく動作する')
    // The target is '正常系' (doesn't match 'execute'), but test name contains 'execute'
    const config = createConfig();
    const suites = [
      createSuite({
        tests: [
          {
            fullName: "SampleService > 正常系 > executeが正しく動作する",
            name: "executeが正しく動作する",
            target: "正常系",
            state: "passed",
            duration: 5,
            errors: [],
            filePath: "sample-class.test.ts",
          },
        ],
      }),
    ];

    const coverageMap = await analyzeSourceCoverage(suites, config);
    const coverage = coverageMap.get("sample-class.test.ts::SampleService");

    // 'execute' should match via fallback (found in test name)
    expect(coverage!.testedMethods).toContain("execute");
  });

  it("matches methods by scanning test file source code for method calls", async () => {
    // Simulate flat-structure Japanese tests that call methods in test body
    // but don't mention method names in describe/it names.
    const config = createConfig();
    const suites = [
      createSuite({
        // Use the fixture test file that has Japanese test names
        // but calls execute(), validate(), toDTO() in the code body
        filePath: "sample-class.test.ts",
        tests: [
          {
            fullName: "SampleService > メインの処理を正しく実行できる",
            name: "メインの処理を正しく実行できる",
            target: "",
            state: "passed",
            duration: 5,
            errors: [],
            filePath: "sample-class.test.ts",
          },
          {
            fullName: "SampleService > 入力を検証できる",
            name: "入力を検証できる",
            target: "",
            state: "passed",
            duration: 3,
            errors: [],
            filePath: "sample-class.test.ts",
          },
          {
            fullName: "SampleService > DTOに変換できる",
            name: "DTOに変換できる",
            target: "",
            state: "passed",
            duration: 2,
            errors: [],
            filePath: "sample-class.test.ts",
          },
        ],
      }),
    ];

    const coverageMap = await analyzeSourceCoverage(suites, config);
    const coverage = coverageMap.get("sample-class.test.ts::SampleService");

    expect(coverage).toBeDefined();
    // These methods are called in the test file body (svc.execute, svc.validate, svc.toDTO)
    expect(coverage!.testedMethods).toContain("execute");
    expect(coverage!.testedMethods).toContain("validate");
    expect(coverage!.testedMethods).toContain("toDTO");

    // helperFunction, formatValue are NOT called in the test file
    const untestedNames = coverage!.untestedMethods.map((m) => m.name);
    expect(untestedNames).toContain("helperFunction");
    expect(untestedNames).toContain("formatValue");
  });

  it("returns null sourceFilePath when source file is not found", async () => {
    const config = createConfig();
    const suites = [
      createSuite({
        filePath: "nonexistent.test.ts",
        tests: [],
      }),
    ];

    const coverageMap = await analyzeSourceCoverage(suites, config);
    const key = "nonexistent.test.ts::SampleService";
    const coverage = coverageMap.get(key);

    expect(coverage).toBeDefined();
    expect(coverage!.sourceFilePath).toBeNull();
    expect(coverage!.publicMethods).toHaveLength(0);
    expect(coverage!.coverageRatio).toBe(0);
  });
});

describe("attachCoverage", () => {
  it("attaches coverage data to suites", async () => {
    const config = createConfig();
    const suites = [createSuite()];

    const coverageMap = await analyzeSourceCoverage(suites, config);
    const enriched = attachCoverage(suites, coverageMap);

    expect(enriched).toHaveLength(1);
    expect(enriched[0].coverage).toBeDefined();
    expect(enriched[0].coverage!.suiteName).toBe("SampleService");
    expect(enriched[0].coverage!.testedMethods).toContain("execute");
  });

  it("returns suite without coverage when not in map", () => {
    const suites = [createSuite()];
    const emptyMap = new Map();

    const result = attachCoverage(suites, emptyMap);
    expect(result).toHaveLength(1);
    expect(result[0].coverage).toBeUndefined();
  });
});

describe("inferTestTargets", () => {
  it("infers targets from test file code blocks for tests with empty targets", async () => {
    const config = createConfig();
    const suites = [
      createSuite({
        filePath: "sample-class.test.ts",
        tests: [
          {
            fullName: "SampleService > メインの処理を正しく実行できる",
            name: "メインの処理を正しく実行できる",
            target: "",
            state: "passed",
            duration: 5,
            errors: [],
            filePath: "sample-class.test.ts",
          },
          {
            fullName: "SampleService > 入力を検証できる",
            name: "入力を検証できる",
            target: "",
            state: "passed",
            duration: 3,
            errors: [],
            filePath: "sample-class.test.ts",
          },
          {
            fullName: "SampleService > DTOに変換できる",
            name: "DTOに変換できる",
            target: "",
            state: "passed",
            duration: 2,
            errors: [],
            filePath: "sample-class.test.ts",
          },
        ],
      }),
    ];

    const coverageMap = await analyzeSourceCoverage(suites, config);
    const result = inferTestTargets(suites, config, coverageMap);

    // "メインの処理を正しく実行できる" block contains svc.execute() → target = "execute()"
    expect(result[0].tests[0].target).toBe("execute()");
    // "入力を検証できる" block contains svc.validate() → target = "validate()"
    expect(result[0].tests[1].target).toBe("validate()");
    // "DTOに変換できる" block contains svc.toDTO() → target = "toDTO()"
    expect(result[0].tests[2].target).toBe("toDTO()");
  });

  it("preserves existing targets and only fills empty ones", async () => {
    const config = createConfig();
    const suites = [
      createSuite({
        filePath: "sample-class.test.ts",
        tests: [
          {
            fullName: "SampleService > execute() > runs correctly",
            name: "runs correctly",
            target: "execute()",
            state: "passed",
            duration: 5,
            errors: [],
            filePath: "sample-class.test.ts",
          },
          {
            fullName: "SampleService > DTOに変換できる",
            name: "DTOに変換できる",
            target: "",
            state: "passed",
            duration: 2,
            errors: [],
            filePath: "sample-class.test.ts",
          },
        ],
      }),
    ];

    const coverageMap = await analyzeSourceCoverage(suites, config);
    const result = inferTestTargets(suites, config, coverageMap);

    // Existing target preserved
    expect(result[0].tests[0].target).toBe("execute()");
    // Empty target filled
    expect(result[0].tests[1].target).toBe("toDTO()");
  });
});

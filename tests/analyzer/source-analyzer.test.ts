import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { analyzeSourceCoverage, attachCoverage } from "../../src/analyzer/source-analyzer.js";
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

    // Tested: execute, validate (from test targets)
    expect(coverage!.testedMethods).toContain("execute");
    expect(coverage!.testedMethods).toContain("validate");

    // Untested: toDTO, name, helperFunction, formatValue (constructor excluded)
    const untestedNames = coverage!.untestedMethods.map((m) => m.name);
    expect(untestedNames).toContain("toDTO");
    expect(untestedNames).not.toContain("execute");
    expect(untestedNames).not.toContain("validate");
    expect(untestedNames).not.toContain("constructor");

    // Coverage ratio: 2 tested / 7 coverable (no constructor)
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

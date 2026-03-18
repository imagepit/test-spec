import { describe, expect, it } from "vitest";
import {
  generateReport,
  generateSplitReport,
} from "../../src/generator/report-generator.js";
import type { TestRunData } from "../../src/types/index.js";

function createTestRunData(
  overrides: Partial<TestRunData> = {},
): TestRunData {
  return {
    projectName: "test-project",
    generatedAt: new Date("2026-03-18T14:30:00"),
    suites: [
      {
        name: "GetCourseDetailUseCase",
        layer: "Application",
        filePath: "src/application/use-cases/get-course-detail.test.ts",
        tests: [
          {
            fullName: "GetCourseDetailUseCase > execute() > コース詳細を取得できる",
            name: "コース詳細を取得できる",
            target: "execute()",
            state: "passed",
            duration: 3,
            errors: [],
            filePath: "src/application/use-cases/get-course-detail.test.ts",
          },
          {
            fullName: "GetCourseDetailUseCase > execute() > 存在しないIDでエラー",
            name: "存在しないIDでエラー",
            target: "execute()",
            state: "passed",
            duration: 2,
            errors: [],
            filePath: "src/application/use-cases/get-course-detail.test.ts",
          },
        ],
      },
    ],
    layerStats: [
      {
        layer: "Application",
        total: 2,
        passed: 2,
        failed: 0,
        skipped: 0,
        perspectives: ["GetCourseDetailUseCase"],
      },
    ],
    totalTests: 2,
    totalPassed: 2,
    totalFailed: 0,
    totalSkipped: 0,
    totalDuration: 5,
    failedTests: [],
    coverageAnalyzed: false,
    ...overrides,
  };
}

describe("generateReport", () => {
  it("generates Markdown with header, summary, and details", () => {
    const data = createTestRunData();
    const md = generateReport(data, "ja");

    expect(md).toContain("# テストレポート - test-project");
    expect(md).toContain("2026-03-18");
    expect(md).toContain("## テスト観点サマリー");
    expect(md).toContain("Application");
    expect(md).toContain("GetCourseDetailUseCase");
    expect(md).toContain("execute()");
    expect(md).toContain("コース詳細を取得できる");
    expect(md).toContain("✅");
  });

  it("generates English report when locale is en", () => {
    const data = createTestRunData();
    const md = generateReport(data, "en");

    expect(md).toContain("# Test Report - test-project");
    expect(md).toContain("## Test Perspective Summary");
    expect(md).toContain("## Details");
  });

  it("includes failed test details section when there are failures", () => {
    const data = createTestRunData({
      totalFailed: 1,
      failedTests: [
        {
          fullName: "MyUseCase > should reject invalid input",
          name: "should reject invalid input",
          target: "",
          state: "failed",
          duration: 10,
          errors: ["AssertionError: expected 403 to be 401"],
          filePath: "src/application/use-cases/my.test.ts",
        },
      ],
    });
    const md = generateReport(data, "ja");

    expect(md).toContain("## 失敗テスト詳細");
    expect(md).toContain("❌ MyUseCase > should reject invalid input");
    expect(md).toContain("AssertionError: expected 403 to be 401");
  });

  it("does not include failed section when all tests pass", () => {
    const data = createTestRunData();
    const md = generateReport(data, "ja");

    expect(md).not.toContain("失敗テスト詳細");
  });

  it("marks suites with failures using ❌ prefix", () => {
    const data = createTestRunData({
      suites: [
        {
          name: "FailingSuite",
          layer: "Domain",
          filePath: "src/domain/failing.test.ts",
          tests: [
            {
              fullName: "FailingSuite > breaks",
              name: "breaks",
              target: "",
              state: "failed",
              duration: 5,
              errors: ["Error"],
              filePath: "src/domain/failing.test.ts",
            },
          ],
        },
      ],
    });
    const md = generateReport(data, "ja");

    expect(md).toContain("### ❌ Domain / FailingSuite");
  });

  it("includes file path under each suite heading", () => {
    const data = createTestRunData();
    const md = generateReport(data, "ja");

    expect(md).toContain(
      "`src/application/use-cases/get-course-detail.test.ts`",
    );
  });
});

describe("generateSplitReport", () => {
  it("generates index and per-layer files", () => {
    const data = createMultiLayerData();
    const { files } = generateSplitReport(data, "ja");

    expect(files.has("index.md")).toBe(true);
    expect(files.has("application.md")).toBe(true);
    expect(files.has("domain.md")).toBe(true);
  });

  it("index contains summary table with links to layer files", () => {
    const data = createMultiLayerData();
    const { files } = generateSplitReport(data, "ja");
    const index = files.get("index.md")!;

    expect(index).toContain("[Domain](./domain.md)");
    expect(index).toContain("[Application](./application.md)");
    expect(index).toContain("## テスト観点サマリー");
  });

  it("layer file contains suite details for that layer only", () => {
    const data = createMultiLayerData();
    const { files } = generateSplitReport(data, "ja");
    const domain = files.get("domain.md")!;
    const app = files.get("application.md")!;

    expect(domain).toContain("UserEntity");
    expect(domain).not.toContain("GetCourseDetailUseCase");
    expect(app).toContain("GetCourseDetailUseCase");
    expect(app).not.toContain("UserEntity");
  });

  it("index does not contain per-suite detail tables", () => {
    const data = createMultiLayerData();
    const { files } = generateSplitReport(data, "ja");
    const index = files.get("index.md")!;

    // Index should have summary but no suite-level detail headings
    expect(index).not.toContain("## UserEntity");
    expect(index).not.toContain("## GetCourseDetailUseCase");
  });
});

function createMultiLayerData(): TestRunData {
  return {
    projectName: "test-project",
    generatedAt: new Date("2026-03-18T14:30:00"),
    suites: [
      {
        name: "UserEntity",
        layer: "Domain",
        filePath: "src/domain/entities/user.test.ts",
        tests: [
          {
            fullName: "UserEntity > validates email",
            name: "validates email",
            target: "",
            state: "passed",
            duration: 3,
            errors: [],
            filePath: "src/domain/entities/user.test.ts",
          },
        ],
      },
      {
        name: "GetCourseDetailUseCase",
        layer: "Application",
        filePath: "src/application/use-cases/get-course-detail.test.ts",
        tests: [
          {
            fullName: "GetCourseDetailUseCase > execute() > コース詳細を取得できる",
            name: "コース詳細を取得できる",
            target: "execute()",
            state: "passed",
            duration: 2,
            errors: [],
            filePath: "src/application/use-cases/get-course-detail.test.ts",
          },
        ],
      },
    ],
    layerStats: [
      { layer: "Domain", total: 1, passed: 1, failed: 0, skipped: 0, perspectives: ["UserEntity"] },
      { layer: "Application", total: 1, passed: 1, failed: 0, skipped: 0, perspectives: ["GetCourseDetailUseCase"] },
    ],
    totalTests: 2,
    totalPassed: 2,
    totalFailed: 0,
    totalSkipped: 0,
    totalDuration: 5,
    failedTests: [],
    coverageAnalyzed: false,
  };
}

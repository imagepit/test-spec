import { describe, expect, it } from "vitest";
import { TestDataCollector } from "../../src/collector/test-data-collector.js";
import type { TestSpecConfig } from "../../src/types/index.js";
import { DEFAULT_LAYER_MAPPINGS } from "../../src/config/defaults.js";

function createConfig(overrides: Partial<TestSpecConfig> = {}): TestSpecConfig {
  return {
    projectName: "test-project",
    outputPath: "docs/test-report.md",
    locale: "ja",
    layerMapping: DEFAULT_LAYER_MAPPINGS,
    projectRoot: "/home/user/project",
    splitByLayer: false,
    ...overrides,
  };
}

describe("TestDataCollector", () => {
  it("collects test cases and builds run data", () => {
    const collector = new TestDataCollector(createConfig());

    collector.addTestCase({
      fullName: "UserEntity > validates email",
      name: "validates email",
      target: "",
      state: "passed",
      duration: 5,
      errors: [],
      moduleId: "/home/user/project/src/domain/entities/user.test.ts",
      suiteName: "UserEntity",
    });

    collector.addTestCase({
      fullName: "UserEntity > rejects empty name",
      name: "rejects empty name",
      target: "",
      state: "passed",
      duration: 3,
      errors: [],
      moduleId: "/home/user/project/src/domain/entities/user.test.ts",
      suiteName: "UserEntity",
    });

    const data = collector.buildTestRunData();

    expect(data.totalTests).toBe(2);
    expect(data.totalPassed).toBe(2);
    expect(data.totalFailed).toBe(0);
    expect(data.totalSkipped).toBe(0);
    expect(data.suites).toHaveLength(1);
    expect(data.suites[0].name).toBe("UserEntity");
    expect(data.suites[0].layer).toBe("Domain");
    expect(data.suites[0].tests).toHaveLength(2);
  });

  it("groups tests from different suites in same file separately", () => {
    const collector = new TestDataCollector(createConfig());

    collector.addTestCase({
      fullName: "SuiteA > test1",
      name: "test1",
      target: "",
      state: "passed",
      duration: 1,
      errors: [],
      moduleId: "/home/user/project/src/domain/entities/user.test.ts",
      suiteName: "SuiteA",
    });

    collector.addTestCase({
      fullName: "SuiteB > test2",
      name: "test2",
      target: "",
      state: "passed",
      duration: 2,
      errors: [],
      moduleId: "/home/user/project/src/domain/entities/user.test.ts",
      suiteName: "SuiteB",
    });

    const data = collector.buildTestRunData();
    expect(data.suites).toHaveLength(2);
  });

  it("collects failed tests separately", () => {
    const collector = new TestDataCollector(createConfig());

    collector.addTestCase({
      fullName: "MyUseCase > fails gracefully",
      name: "fails gracefully",
      target: "",
      state: "failed",
      duration: 10,
      errors: ["Expected 200, got 500"],
      moduleId: "/home/user/project/src/application/use-cases/my.test.ts",
      suiteName: "MyUseCase",
    });

    const data = collector.buildTestRunData();
    expect(data.totalFailed).toBe(1);
    expect(data.failedTests).toHaveLength(1);
    expect(data.failedTests[0].errors).toContain("Expected 200, got 500");
  });

  it("computes layer stats with perspectives", () => {
    const collector = new TestDataCollector(createConfig());

    collector.addTestCase({
      fullName: "UserEntity > test",
      name: "test",
      target: "",
      state: "passed",
      duration: 1,
      errors: [],
      moduleId: "/home/user/project/src/domain/entities/user.test.ts",
      suiteName: "UserEntity",
    });

    collector.addTestCase({
      fullName: "OrderEntity > test",
      name: "test",
      target: "",
      state: "passed",
      duration: 1,
      errors: [],
      moduleId: "/home/user/project/src/domain/entities/order.test.ts",
      suiteName: "OrderEntity",
    });

    const data = collector.buildTestRunData();
    const domainStats = data.layerStats.find((s) => s.layer === "Domain");
    expect(domainStats).toBeDefined();
    expect(domainStats!.total).toBe(2);
    expect(domainStats!.perspectives).toContain("UserEntity");
    expect(domainStats!.perspectives).toContain("OrderEntity");
  });

  it("sorts suites by layer order then name", () => {
    const collector = new TestDataCollector(createConfig());

    collector.addTestCase({
      fullName: "Button > renders",
      name: "renders",
      target: "",
      state: "passed",
      duration: 1,
      errors: [],
      moduleId: "/home/user/project/src/presentation/components/Button.test.tsx",
      suiteName: "Button",
    });

    collector.addTestCase({
      fullName: "UserEntity > validates",
      name: "validates",
      target: "",
      state: "passed",
      duration: 1,
      errors: [],
      moduleId: "/home/user/project/src/domain/entities/user.test.ts",
      suiteName: "UserEntity",
    });

    const data = collector.buildTestRunData();
    expect(data.suites[0].layer).toBe("Domain");
    expect(data.suites[1].layer).toBe("Presentation");
  });
});

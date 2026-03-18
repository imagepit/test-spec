import { describe, expect, it } from "vitest";
import { classifyLayer } from "../../src/classifier/layer-classifier.js";
import { DEFAULT_LAYER_MAPPINGS } from "../../src/config/defaults.js";

describe("classifyLayer", () => {
  const projectRoot = "/home/user/project";

  it("classifies domain layer from absolute path", () => {
    const result = classifyLayer(
      "/home/user/project/src/domain/entities/user.test.ts",
      projectRoot,
      DEFAULT_LAYER_MAPPINGS,
    );
    expect(result).toBe("Domain");
  });

  it("classifies application layer from use-cases path", () => {
    const result = classifyLayer(
      "/home/user/project/src/application/use-cases/get-user.test.ts",
      projectRoot,
      DEFAULT_LAYER_MAPPINGS,
    );
    expect(result).toBe("Application");
  });

  it("classifies presentation layer from components path", () => {
    const result = classifyLayer(
      "/home/user/project/src/presentation/components/Button.test.tsx",
      projectRoot,
      DEFAULT_LAYER_MAPPINGS,
    );
    expect(result).toBe("Presentation");
  });

  it("classifies infrastructure layer from repositories path", () => {
    const result = classifyLayer(
      "/home/user/project/tests/infrastructure/repositories/api-repo.test.ts",
      projectRoot,
      DEFAULT_LAYER_MAPPINGS,
    );
    expect(result).toBe("Infrastructure");
  });

  it("classifies pages as presentation", () => {
    const result = classifyLayer(
      "/home/user/project/src/presentation/pages/Home.test.tsx",
      projectRoot,
      DEFAULT_LAYER_MAPPINGS,
    );
    expect(result).toBe("Presentation");
  });

  it("classifies app directory as App layer", () => {
    const result = classifyLayer(
      "/home/user/project/src/app/admin/trainings/detail.test.tsx",
      projectRoot,
      DEFAULT_LAYER_MAPPINGS,
    );
    expect(result).toBe("App");
  });

  it("classifies lib directory as Lib layer", () => {
    const result = classifyLayer(
      "/home/user/project/src/lib/api/client.test.ts",
      projectRoot,
      DEFAULT_LAYER_MAPPINGS,
    );
    expect(result).toBe("Lib");
  });

  it("classifies tests/app/api as App (app segment matched first)", () => {
    const result = classifyLayer(
      "/home/user/project/tests/app/api/users.test.ts",
      projectRoot,
      DEFAULT_LAYER_MAPPINGS,
    );
    expect(result).toBe("App");
  });

  it("returns Other for unrecognized paths", () => {
    const result = classifyLayer(
      "/home/user/project/tests/misc/helper.test.ts",
      projectRoot,
      DEFAULT_LAYER_MAPPINGS,
    );
    expect(result).toBe("Other");
  });

  it("respects user-provided mappings before defaults (first match wins)", () => {
    const customMappings = [
      { pattern: "custom-layer", layer: "Domain" },
      ...DEFAULT_LAYER_MAPPINGS,
    ];
    const result = classifyLayer(
      "/home/user/project/src/custom-layer/thing.test.ts",
      projectRoot,
      customMappings,
    );
    expect(result).toBe("Domain");
  });

  it("handles relative paths", () => {
    const result = classifyLayer(
      "src/domain/entities/user.test.ts",
      projectRoot,
      DEFAULT_LAYER_MAPPINGS,
    );
    expect(result).toBe("Domain");
  });

  it("is case insensitive for matching", () => {
    const result = classifyLayer(
      "/home/user/project/src/Domain/Entities/User.test.ts",
      projectRoot,
      DEFAULT_LAYER_MAPPINGS,
    );
    expect(result).toBe("Domain");
  });

  it("does not match filename, only directory segments", () => {
    // "api-repo.test.ts" should NOT match "api" pattern — only dir segments
    const result = classifyLayer(
      "/home/user/project/tests/misc/api-repo.test.ts",
      projectRoot,
      DEFAULT_LAYER_MAPPINGS,
    );
    expect(result).toBe("Other");
  });
});

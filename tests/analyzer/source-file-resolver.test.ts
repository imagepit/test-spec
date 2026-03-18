import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { resolveSourceFile } from "../../src/analyzer/source-file-resolver.js";

// Mock existsSync to control which files "exist"
vi.mock("node:fs", () => ({
  existsSync: vi.fn((path: string) => {
    return mockExistingFiles.has(path);
  }),
}));

let mockExistingFiles: Set<string>;

beforeEach(() => {
  mockExistingFiles = new Set();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveSourceFile", () => {
  const projectRoot = "/home/user/project";

  describe("co-located strategy", () => {
    it("resolves .test.ts to .ts", () => {
      mockExistingFiles.add("/home/user/project/src/domain/user.ts");
      const result = resolveSourceFile("src/domain/user.test.ts", projectRoot);
      expect(result).toBe("/home/user/project/src/domain/user.ts");
    });

    it("resolves .spec.ts to .ts", () => {
      mockExistingFiles.add("/home/user/project/src/domain/user.ts");
      const result = resolveSourceFile("src/domain/user.spec.ts", projectRoot);
      expect(result).toBe("/home/user/project/src/domain/user.ts");
    });

    it("resolves .test.tsx to .tsx", () => {
      mockExistingFiles.add("/home/user/project/src/components/Button.tsx");
      const result = resolveSourceFile(
        "src/components/Button.test.tsx",
        projectRoot,
      );
      expect(result).toBe("/home/user/project/src/components/Button.tsx");
    });
  });

  describe("tests/ → src/ strategy", () => {
    it("replaces tests/ with src/ and removes test suffix", () => {
      mockExistingFiles.add("/home/user/project/src/domain/user.ts");
      const result = resolveSourceFile(
        "tests/domain/user.test.ts",
        projectRoot,
      );
      expect(result).toBe("/home/user/project/src/domain/user.ts");
    });
  });

  describe("__tests__/ strategy", () => {
    it("moves file up from __tests__ directory", () => {
      mockExistingFiles.add("/home/user/project/src/domain/user.ts");
      const result = resolveSourceFile(
        "src/domain/__tests__/user.test.ts",
        projectRoot,
      );
      expect(result).toBe("/home/user/project/src/domain/user.ts");
    });
  });

  describe("custom patterns", () => {
    it("applies custom regex pattern first", () => {
      mockExistingFiles.add("/home/user/project/lib/utils/format.ts");
      const result = resolveSourceFile(
        "spec/utils/format.test.ts",
        projectRoot,
        [{ testPattern: "^spec/(.+)\\.test\\.ts$", sourceReplace: "lib/$1.ts" }],
      );
      expect(result).toBe("/home/user/project/lib/utils/format.ts");
    });

    it("falls back to default strategies if custom pattern does not match", () => {
      mockExistingFiles.add("/home/user/project/src/domain/user.ts");
      const result = resolveSourceFile(
        "src/domain/user.test.ts",
        projectRoot,
        [{ testPattern: "^spec/", sourceReplace: "lib/" }],
      );
      expect(result).toBe("/home/user/project/src/domain/user.ts");
    });
  });

  it("returns null when no source file is found", () => {
    // No files exist
    const result = resolveSourceFile(
      "src/domain/nonexistent.test.ts",
      projectRoot,
    );
    expect(result).toBeNull();
  });
});

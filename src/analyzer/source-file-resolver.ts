import { existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import type { SourceFilePattern } from "../types/index.js";

/**
 * Resolve a test file path to its corresponding source file path.
 *
 * Tries strategies in order:
 * 1. Custom user patterns (if provided)
 * 2. Co-located: remove .test.ts/.spec.ts suffix
 * 3. tests/ → src/ directory replacement
 * 4. __tests__/ → parent directory
 *
 * Returns null if no source file is found on disk.
 */
export function resolveSourceFile(
  testFilePath: string,
  projectRoot: string,
  customPatterns?: readonly SourceFilePattern[],
): string | null {
  const absTestPath = join(projectRoot, testFilePath);

  // Try custom patterns first
  if (customPatterns) {
    for (const { testPattern, sourceReplace } of customPatterns) {
      const regex = new RegExp(testPattern);
      if (regex.test(testFilePath)) {
        const candidate = join(projectRoot, testFilePath.replace(regex, sourceReplace));
        if (existsSync(candidate)) return candidate;
      }
    }
  }

  // Strategy 1: Co-located — remove .test.ts/.spec.ts
  const colocated = removeTestSuffix(absTestPath);
  if (colocated && existsSync(colocated)) return colocated;

  // Strategy 2: tests/ → src/ replacement
  const testsDirReplaced = replaceTestsDir(absTestPath);
  if (testsDirReplaced && existsSync(testsDirReplaced)) return testsDirReplaced;

  // Strategy 3: __tests__/ → move up to parent
  const underscoreTests = resolveUnderscoreTests(absTestPath);
  if (underscoreTests && existsSync(underscoreTests)) return underscoreTests;

  return null;
}

/** Remove .test.ts/.test.tsx/.spec.ts/.spec.tsx from filename */
function removeTestSuffix(absPath: string): string | null {
  const match = absPath.match(/^(.+)\.(test|spec)\.(tsx?|jsx?)$/);
  if (!match) return null;
  return `${match[1]}.${match[3]}`;
}

/** Replace /tests/ with /src/ in path and remove test suffix */
function replaceTestsDir(absPath: string): string | null {
  // Match tests/ at project root level
  const normalized = absPath.replace(/\\/g, "/");
  const testsIdx = normalized.indexOf("/tests/");
  if (testsIdx === -1) return null;

  const withSrc = normalized.slice(0, testsIdx) + "/src/" + normalized.slice(testsIdx + "/tests/".length);
  return removeTestSuffix(withSrc);
}

/** Handle __tests__/ subdirectory pattern */
function resolveUnderscoreTests(absPath: string): string | null {
  const normalized = absPath.replace(/\\/g, "/");
  if (!normalized.includes("/__tests__/")) return null;

  // Move file up one level: foo/__tests__/bar.test.ts → foo/bar.ts
  const parts = normalized.split("/__tests__/");
  if (parts.length !== 2) return null;

  const dir = parts[0];
  const file = parts[1];
  const withoutTest = removeTestSuffix(join(dir, file));
  return withoutTest;
}

import { join, relative } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import type {
  SourceMethod,
  SuiteCoverage,
  TestSuiteData,
  TestSpecConfig,
} from "../types/index.js";
import { resolveSourceFile } from "./source-file-resolver.js";

// ts-morph types (lazy loaded)
type Project = import("ts-morph").Project;
type SourceFile = import("ts-morph").SourceFile;

/**
 * Analyze source code coverage for test suites.
 * Uses ts-morph to extract public methods from corresponding source files,
 * then matches them against test targets.
 *
 * Returns a Map keyed by "filePath::suiteName" to SuiteCoverage.
 */
export async function analyzeSourceCoverage(
  suites: readonly TestSuiteData[],
  config: TestSpecConfig,
): Promise<Map<string, SuiteCoverage>> {
  const { Project, Scope, Node, VariableDeclarationKind } = await import("ts-morph");

  const project = createProject(Project, config);
  const coverageMap = new Map<string, SuiteCoverage>();
  // Cache: sourceFilePath → SourceMethod[]
  const methodCache = new Map<string, readonly SourceMethod[]>();

  for (const suite of suites) {
    const key = `${suite.filePath}::${suite.name}`;
    const sourceFilePath = resolveSourceFile(
      suite.filePath,
      config.projectRoot,
      config.sourceFilePatterns,
    );

    if (!sourceFilePath) {
      coverageMap.set(key, {
        suiteName: suite.name,
        sourceFilePath: null,
        publicMethods: [],
        testedMethods: [],
        untestedMethods: [],
        coverageRatio: 0,
      });
      continue;
    }

    // Extract methods (cached per source file)
    let publicMethods = methodCache.get(sourceFilePath);
    if (!publicMethods) {
      project.addSourceFilesAtPaths(sourceFilePath);
      const sf = project.getSourceFile(sourceFilePath);
      publicMethods = sf
        ? extractPublicMethods(sf, Scope, Node, VariableDeclarationKind)
        : [];
      methodCache.set(sourceFilePath, publicMethods);
    }

    // Exclude constructors — DI constructors are not directly tested
    const coverableMethods = publicMethods.filter((m) => m.kind !== "constructor");

    // Collect test targets from this suite
    const testTargets = new Set<string>();
    for (const test of suite.tests) {
      if (test.target) {
        for (const t of test.target.split(",")) {
          testTargets.add(normalizeTarget(t.trim()));
        }
      }
    }

    // Collect all test text for fallback matching (test names + fullNames)
    const allTestText = suite.tests
      .flatMap((test) => [test.name, test.fullName, test.target])
      .join(" ")
      .toLowerCase();

    // Fuzzy match: primary = test target, fallback = search test text for method name
    const testedMethods: string[] = [];
    let untestedMethods: SourceMethod[] = [];

    for (const method of coverableMethods) {
      const normalizedName = normalizeTarget(method.name);
      if (testTargets.has(normalizedName)) {
        // Direct match via test target (describe block)
        testedMethods.push(method.name);
      } else if (allTestText.includes(normalizedName)) {
        // Fallback: method name found in test names/fullNames
        testedMethods.push(method.name);
      } else {
        untestedMethods.push(method);
      }
    }

    // 3rd tier: scan test file source code for method name references.
    // Catches cases where test names are in Japanese but code calls the method directly
    // (e.g., `training.updateSchedule(newSchedule)` in the test body).
    if (untestedMethods.length > 0) {
      const testFilePath = join(config.projectRoot, suite.filePath);
      if (existsSync(testFilePath)) {
        try {
          const testFileContent = readFileSync(testFilePath, "utf-8").toLowerCase();
          const stillUntested: SourceMethod[] = [];
          for (const method of untestedMethods) {
            if (testFileContent.includes(method.name.toLowerCase())) {
              testedMethods.push(method.name);
            } else {
              stillUntested.push(method);
            }
          }
          untestedMethods = stillUntested;
        } catch {
          // Ignore file read errors — proceed with current matching
        }
      }
    }

    // Single-method heuristic: if there's exactly 1 coverable method,
    // tests exist, but nothing matched, mark it as tested.
    // (e.g., UseCase with execute() where tests are scenario-organized in Japanese)
    if (
      coverableMethods.length === 1 &&
      suite.tests.length > 0 &&
      testedMethods.length === 0
    ) {
      testedMethods.push(coverableMethods[0].name);
      untestedMethods = [];
    }

    const total = coverableMethods.length;
    const coverageRatio = total > 0 ? testedMethods.length / total : 0;
    const relSourcePath = relative(config.projectRoot, sourceFilePath);

    coverageMap.set(key, {
      suiteName: suite.name,
      sourceFilePath: relSourcePath,
      publicMethods: [...coverableMethods],
      testedMethods,
      untestedMethods,
      coverageRatio,
    });
  }

  return coverageMap;
}

/**
 * Attach coverage data to test suites (immutable — returns new array).
 */
export function attachCoverage(
  suites: readonly TestSuiteData[],
  coverageMap: Map<string, SuiteCoverage>,
): TestSuiteData[] {
  return suites.map((suite) => {
    const key = `${suite.filePath}::${suite.name}`;
    const coverage = coverageMap.get(key);
    return coverage ? { ...suite, coverage } : suite;
  });
}

// --- Internal helpers ---

function createProject(
  ProjectClass: typeof import("ts-morph").Project,
  config: TestSpecConfig,
): Project {
  const tsConfigPath =
    config.tsConfigPath ??
    (existsSync(join(config.projectRoot, "tsconfig.json"))
      ? join(config.projectRoot, "tsconfig.json")
      : undefined);

  return new ProjectClass({
    tsConfigFilePath: tsConfigPath,
    skipAddingFilesFromTsConfig: true,
  });
}

/**
 * Extract all public methods/functions from a source file.
 * Includes: class methods (non-private), standalone functions, arrow function exports.
 */
function extractPublicMethods(
  sf: SourceFile,
  Scope: typeof import("ts-morph").Scope,
  Node: typeof import("ts-morph").Node,
  VariableDeclarationKind: typeof import("ts-morph").VariableDeclarationKind,
): SourceMethod[] {
  const methods: SourceMethod[] = [];

  // 1. Class methods (exported classes, non-private methods)
  for (const classDecl of sf.getClasses()) {
    if (!classDecl.isExported()) continue;

    // Constructor
    const ctor = classDecl.getConstructors()[0];
    if (ctor) {
      const params = ctor.getParameters().map((p) => {
        const opt = p.isOptional() ? "?" : "";
        return `${p.getName()}${opt}: ${p.getType().getText(p)}`;
      });
      methods.push({
        name: "constructor",
        kind: "constructor",
        signature: `constructor(${params.join(", ")})`,
      });
    }

    // Methods
    for (const method of classDecl.getMethods()) {
      if (method.getScope() === Scope.Private) continue;
      const name = method.getName();
      const params = method.getParameters().map((p) => {
        const opt = p.isOptional() ? "?" : "";
        return `${p.getName()}${opt}: ${p.getType().getText(p)}`;
      });
      const returnType = method.getReturnType().getText(method);
      methods.push({
        name,
        kind: "method",
        signature: `${name}(${params.join(", ")}): ${returnType}`,
      });
    }

    // Getters
    for (const getter of classDecl.getGetAccessors()) {
      if (getter.getScope() === Scope.Private) continue;
      methods.push({
        name: getter.getName(),
        kind: "getter",
        signature: `get ${getter.getName()}(): ${getter.getReturnType().getText(getter)}`,
      });
    }

    // Setters
    for (const setter of classDecl.getSetAccessors()) {
      if (setter.getScope() === Scope.Private) continue;
      const param = setter.getParameters()[0];
      const paramType = param ? param.getType().getText(param) : "unknown";
      methods.push({
        name: setter.getName(),
        kind: "setter",
        signature: `set ${setter.getName()}(${param?.getName() ?? "value"}: ${paramType})`,
      });
    }
  }

  // 2. Standalone exported functions
  for (const funcDecl of sf.getFunctions()) {
    if (!funcDecl.isExported()) continue;
    const name = funcDecl.getName() ?? "anonymous";
    const params = funcDecl.getParameters().map((p) => {
      const opt = p.isOptional() ? "?" : "";
      return `${p.getName()}${opt}: ${p.getType().getText(p)}`;
    });
    const returnType = funcDecl.getReturnType().getText(funcDecl);
    methods.push({
      name,
      kind: "function",
      signature: `${name}(${params.join(", ")}): ${returnType}`,
    });
  }

  // 3. Exported arrow functions / function expressions
  for (const varStmt of sf.getVariableStatements()) {
    if (!varStmt.isExported()) continue;
    if (varStmt.getDeclarationKind() !== VariableDeclarationKind.Const) continue;
    for (const decl of varStmt.getDeclarations()) {
      const init = decl.getInitializer();
      if (!init) continue;
      if (!Node.isArrowFunction(init) && !Node.isFunctionExpression(init)) continue;
      const name = decl.getName();
      const params = init.getParameters().map((p) => {
        const opt = p.isOptional() ? "?" : "";
        return `${p.getName()}${opt}: ${p.getType().getText(p)}`;
      });
      const returnType = init.getReturnType().getText(init);
      methods.push({
        name,
        kind: "function",
        signature: `${name}(${params.join(", ")}): ${returnType}`,
      });
    }
  }

  return methods;
}

/**
 * Normalize a test target name for fuzzy matching.
 * - Strip trailing "()" and leading/trailing whitespace
 * - Lowercase
 */
function normalizeTarget(target: string): string {
  return target
    .replace(/\(\)$/, "")
    .replace(/\(.*\)$/, "")
    .trim()
    .toLowerCase();
}

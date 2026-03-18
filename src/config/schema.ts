import { z } from "zod";
import type { TestSpecConfig } from "../types/index.js";
import { DEFAULT_LAYER_MAPPINGS } from "./defaults.js";

const layerMappingSchema = z.object({
  pattern: z.string().min(1),
  layer: z.string().min(1),
});

const sourceFilePatternSchema = z.object({
  testPattern: z.string().min(1),
  sourceReplace: z.string(),
});

export const testSpecOptionsSchema = z.object({
  projectName: z.string().default("Project"),
  outputPath: z.string().default("docs/test-report.md"),
  locale: z.enum(["ja", "en"]).default("ja"),
  layerMapping: z.array(layerMappingSchema).optional(),
  projectRoot: z.string().optional(),
  splitByLayer: z.boolean().default(false),
  analyzeCoverage: z.boolean().default(false),
  tsConfigPath: z.string().optional(),
  sourceFilePatterns: z.array(sourceFilePatternSchema).optional(),
});

export type TestSpecOptions = z.input<typeof testSpecOptionsSchema>;

/**
 * Resolve reporter options into a full config.
 * User-provided layerMapping is prepended to defaults (first match wins).
 */
export function resolveConfig(
  options: Record<string, unknown> = {},
): TestSpecConfig {
  const parsed = testSpecOptionsSchema.parse(options);
  const userMappings = parsed.layerMapping ?? [];
  return {
    projectName: parsed.projectName,
    outputPath: parsed.outputPath,
    locale: parsed.locale,
    layerMapping: [...userMappings, ...DEFAULT_LAYER_MAPPINGS],
    projectRoot: parsed.projectRoot ?? process.cwd(),
    splitByLayer: parsed.splitByLayer,
    analyzeCoverage: parsed.analyzeCoverage,
    tsConfigPath: parsed.tsConfigPath,
    sourceFilePatterns: parsed.sourceFilePatterns,
  };
}

import path from "node:path";
import type { ArchLayer, LayerMapping } from "../types/index.js";

/**
 * Classify a test file into an architecture layer based on its file path.
 *
 * Matching strategy:
 * 1. Resolve the path relative to project root
 * 2. Split into path segments (directory names)
 * 3. For each mapping pattern, check if any segment matches
 * 4. First mapping match wins
 *
 * Segment-based matching avoids false positives like
 * "src/lib/api/" matching "api" instead of "lib".
 *
 * @param moduleId - Absolute or relative file path of the test module
 * @param projectRoot - Project root directory for resolving relative paths
 * @param mappings - Layer mapping rules (first match wins)
 * @returns The classified layer
 */
export function classifyLayer(
  moduleId: string,
  projectRoot: string,
  mappings: readonly LayerMapping[],
): ArchLayer {
  const relativePath = path.isAbsolute(moduleId)
    ? path.relative(projectRoot, moduleId)
    : moduleId;

  // Normalize to forward slashes and extract directory segments
  const normalized = relativePath.replace(/\\/g, "/").toLowerCase();
  const segments = normalized.split("/").slice(0, -1); // exclude filename

  for (const { pattern, layer } of mappings) {
    const lowerPattern = pattern.toLowerCase();

    // If pattern contains "/", use substring match (e.g., "use-cases")
    // Otherwise, match against individual path segments
    if (lowerPattern.includes("/")) {
      if (normalized.includes(lowerPattern)) {
        return layer;
      }
    } else {
      if (segments.includes(lowerPattern)) {
        return layer;
      }
    }
  }

  return "Other";
}

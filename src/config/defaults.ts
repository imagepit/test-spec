import type { LayerMapping } from "../types/index.js";

/**
 * Default layer mappings based on common architecture directory conventions.
 *
 * Order matters — first match wins.
 * Specific layer directories are checked first, then common sub-directories.
 * "app" and "lib" are recognized as distinct layers (Next.js App Router, shared libs).
 */
export const DEFAULT_LAYER_MAPPINGS: readonly LayerMapping[] = [
  // Primary layer directories
  { pattern: "domain", layer: "Domain" },
  { pattern: "application", layer: "Application" },
  { pattern: "presentation", layer: "Presentation" },
  { pattern: "infrastructure", layer: "Infrastructure" },
  // Next.js / framework layers
  { pattern: "app", layer: "App" },
  { pattern: "lib", layer: "Lib" },
  // Common sub-directory conventions (fallback)
  { pattern: "use-cases", layer: "Application" },
  { pattern: "usecases", layer: "Application" },
  { pattern: "components", layer: "Presentation" },
  { pattern: "pages", layer: "Presentation" },
  { pattern: "hooks", layer: "Presentation" },
  { pattern: "repositories", layer: "Infrastructure" },
  { pattern: "adapters", layer: "Infrastructure" },
  { pattern: "api", layer: "Infrastructure" },
];

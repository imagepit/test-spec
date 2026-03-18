import { ja } from "./ja.js";
import { en } from "./en.js";

export interface LocaleMessages {
  readonly reportTitle: string;
  readonly generatedAt: string;
  readonly total: string;
  readonly tests: string;
  readonly passed: string;
  readonly failed: string;
  readonly skipped: string;
  readonly duration: string;
  readonly perspectiveSummary: string;
  readonly details: string;
  readonly failedTestsDetail: string;
  readonly headerLayer: string;
  readonly headerTestCount: string;
  readonly headerPassed: string;
  readonly headerFailed: string;
  readonly headerPerspectives: string;
  readonly headerIndex: string;
  readonly headerPerspective: string;
  readonly headerResult: string;
  readonly headerDuration: string;
  readonly file: string;
}

export type Locale = "ja" | "en";

const messages: Record<Locale, LocaleMessages> = { ja, en };

export function getMessages(locale: Locale): LocaleMessages {
  return messages[locale];
}

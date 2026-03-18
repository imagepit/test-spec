/**
 * Sample class for testing source analyzer method extraction.
 */
export class SampleService {
  private secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  /** Execute the main operation */
  execute(input: string): string {
    return this.transform(input);
  }

  /** Validate input */
  validate(input: string): boolean {
    return input.length > 0;
  }

  /** Convert to DTO */
  toDTO(): { name: string } {
    return { name: this.secret };
  }

  get name(): string {
    return this.secret;
  }

  set name(value: string) {
    this.secret = value;
  }

  private transform(input: string): string {
    return input.toUpperCase();
  }
}

/** Standalone exported function */
export function helperFunction(a: number, b: number): number {
  return a + b;
}

/** Exported arrow function */
export const formatValue = (value: string): string => {
  return value.trim();
};

// Not exported — should be excluded
function internalHelper(): void {
  // noop
}

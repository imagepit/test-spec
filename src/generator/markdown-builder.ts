/** Fluent builder for programmatic Markdown generation. */
export class MarkdownBuilder {
  private lines: string[] = [];

  /**
   * Add a YAML frontmatter block.
   * @param data - Key/value pairs for frontmatter
   */
  frontmatter(data: Record<string, string>): this {
    this.lines.push("---");
    for (const [key, value] of Object.entries(data)) {
      this.lines.push(`${key}: ${value}`);
    }
    this.lines.push("---");
    this.lines.push("");
    return this;
  }

  /**
   * Add a heading at the specified level.
   * @param level - Heading level (1-6)
   * @param text - Heading text
   */
  heading(level: number, text: string): this {
    this.lines.push(`${"#".repeat(level)} ${text}`);
    this.lines.push("");
    return this;
  }

  /**
   * Add a paragraph.
   * @param text - Paragraph text
   */
  paragraph(text: string): this {
    this.lines.push(text);
    this.lines.push("");
    return this;
  }

  /**
   * Add a blockquote.
   * @param text - Quote text (supports multiline)
   */
  blockquote(text: string): this {
    const lines = text.split("\n").map((l) => `> ${l}`);
    this.lines.push(...lines);
    this.lines.push("");
    return this;
  }

  /**
   * Add a Markdown table.
   * @param headers - Header string array
   * @param rows - 2D array of data rows
   */
  table(headers: string[], rows: string[][]): this {
    if (rows.length === 0) return this;

    const esc = (cell: string) => cell.replace(/\|/g, "\\|");
    const headerRow = `| ${headers.map(esc).join(" | ")} |`;
    const separator = `| ${headers.map(() => "---").join(" | ")} |`;
    const dataRows = rows.map((row) => `| ${row.map(esc).join(" | ")} |`);

    this.lines.push(headerRow);
    this.lines.push(separator);
    this.lines.push(...dataRows);
    this.lines.push("");
    return this;
  }

  /**
   * Add a fenced code block.
   * @param code - Code string
   * @param lang - Language identifier (default: "ts")
   */
  codeBlock(code: string, lang: string = "ts"): this {
    this.lines.push(`\`\`\`${lang}`);
    this.lines.push(code);
    this.lines.push("```");
    this.lines.push("");
    return this;
  }

  /**
   * Add a bullet list.
   * @param items - List item strings
   */
  list(items: string[]): this {
    for (const item of items) {
      this.lines.push(`- ${item}`);
    }
    this.lines.push("");
    return this;
  }

  /**
   * Add raw text (no trailing blank line).
   * @param text - Raw text to append
   */
  raw(text: string): this {
    this.lines.push(text);
    return this;
  }

  /**
   * Add raw text as a block (with trailing blank line).
   * @param text - Raw text to append
   */
  rawBlock(text: string): this {
    this.lines.push(text);
    this.lines.push("");
    return this;
  }

  /**
   * Build the final Markdown string.
   */
  build(): string {
    return this.lines.join("\n");
  }
}

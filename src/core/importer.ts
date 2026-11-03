/**
 * Transcript importer: turns pasted / OCR'd transcript text into course rows.
 * Tolerant of Arabic and English layouts, tabs, pipes, commas and plain spaces.
 */
export interface ImportedRow {
  code?: string;
  name: string;
  credits?: number;
  /** Numeric mark 0..100 */
  mark?: number;
  /** Letter grade if present instead of (or alongside) a mark */
  letter?: string;
  /** Raw source line for the preview */
  raw: string;
  confidence: "high" | "medium" | "low";
}

const LETTER_RE = /(?<![A-Za-z])([ABCD][+-]?|F)(?![A-Za-z+-])/;
const CODE_RE = /\b([A-Z]{0,4}\d{4,7})\b/;

/** Convert Arabic-Indic digits to ASCII. */
export function normalizeDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

export function parseTranscriptText(text: string): ImportedRow[] {
  const rows: ImportedRow[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = normalizeDigits(rawLine).replace(/ +/g, " ").trim();
    if (!line || /^(code|course|رمز|المقرر|اسم|name|credits|الساعات|mark|العلامة|grade)/i.test(line) && line.length < 60) continue;
    const cells = line.split(/\s*[|\t,;]\s*/).filter(Boolean);
    const row = cells.length >= 3 ? parseCells(cells, line) : parseFreeform(line);
    if (row) rows.push(row);
  }
  return rows;
}

function parseCells(cells: string[], raw: string): ImportedRow | undefined {
  let code: string | undefined, name = "", credits: number | undefined, mark: number | undefined, letter: string | undefined;
  const nums: number[] = [];
  for (const c of cells) {
    if (!code && CODE_RE.test(c) && !/[a-z؀-ۿ]/i.test(c.replace(CODE_RE, ""))) { code = CODE_RE.exec(c)![1]; continue; }
    if (!letter && /^[ABCD][+-]?$|^F$/.test(c)) { letter = c; continue; }
    const n = Number(c);
    if (Number.isFinite(n) && c !== "") { nums.push(n); continue; }
    if (!name && /[a-z؀-ۿ]/i.test(c)) name = c;
  }
  // credits are small (0.5..6), marks are 0..100
  for (const n of nums) {
    if (credits === undefined && n >= 0.5 && n <= 6 && Number.isInteger(n * 2)) credits = n;
    else if (mark === undefined && n >= 0 && n <= 100) mark = n;
  }
  if (!name && !code) return undefined;
  const confidence = name && credits !== undefined && (mark !== undefined || letter) ? "high" : name ? "medium" : "low";
  return { code, name: name || code || "", credits, mark, letter, raw, confidence };
}

function parseFreeform(line: string): ImportedRow | undefined {
  // e.g. "301201 Engineering Analysis (1) 3 72" or "تحليل هندسي 3 72 C+"
  const code = CODE_RE.exec(line)?.[1];
  let rest = code ? line.replace(code, " ") : line;
  const letter = LETTER_RE.exec(rest)?.[1];
  if (letter) rest = rest.replace(LETTER_RE, " ");
  const nums = [...rest.matchAll(/(?<![\w(])(\d+(?:\.\d+)?)(?![\w)])/g)].map((m) => Number(m[1]));
  let credits: number | undefined, mark: number | undefined;
  for (const n of nums) {
    if (credits === undefined && n >= 0.5 && n <= 6 && Number.isInteger(n * 2)) credits = n;
    else if (mark === undefined && n >= 0 && n <= 100) mark = n;
  }
  const name = rest.replace(/(?<![\w(])\d+(?:\.\d+)?(?![\w)])/g, " ").replace(/\s+/g, " ").trim();
  if (!name && !code) return undefined;
  // A line with words only (no code, number or letter) is not a course row.
  if (!code && credits === undefined && mark === undefined && !letter) return undefined;
  if (!/[a-z؀-ۿ]/i.test(name) && !code) return undefined;
  const confidence = name && credits !== undefined && (mark !== undefined || letter) ? "high" : name || code ? "medium" : "low";
  return { code, name: name || code || "", credits, mark, letter, raw: line, confidence };
}

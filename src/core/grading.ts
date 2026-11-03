/**
 * Grading scale: converts numeric marks (0–100) ↔ letter grades ↔ GPA points.
 * Scales are data, not code, so each university can supply its own.
 */

export interface GradeBand {
  /** Inclusive lower bound of the numeric mark */
  min: number;
  /** Inclusive upper bound of the numeric mark */
  max: number;
  letter: string;
  points: number;
  /** Whether the course counts as passed */
  pass: boolean;
}

export interface GradingScale {
  id: string;
  nameAr: string;
  nameEn: string;
  maxPoints: number;
  bands: GradeBand[];
  /** Official percentage equivalent of a GPA: percent = gpa × multiplier + offset. Falls back to gpa ÷ maxPoints × 100. */
  percent?: { multiplier: number; offset: number; noteAr: string };
}

/** Default scale taken from the provided grade table (Syrian private universities, 4.00 system). */
export const DEFAULT_SCALE: GradingScale = {
  id: "sy-private-4.0",
  nameAr: "سلّم الجامعات الخاصة السورية (4.00)",
  nameEn: "Syrian private universities (4.00)",
  maxPoints: 4,
  percent: { multiplier: 20, offset: 20, noteAr: "النسبة المئوية = المعدل النقطي × 20 + 20 (المادة 26/د من النظام الموحد)" },
  bands: [
    { min: 98, max: 100, letter: "A+", points: 4.0, pass: true },
    { min: 95, max: 97, letter: "A", points: 3.75, pass: true },
    { min: 90, max: 94, letter: "A-", points: 3.5, pass: true },
    { min: 85, max: 89, letter: "B+", points: 3.25, pass: true },
    { min: 80, max: 84, letter: "B", points: 3.0, pass: true },
    { min: 75, max: 79, letter: "B-", points: 2.75, pass: true },
    { min: 70, max: 74, letter: "C+", points: 2.5, pass: true },
    { min: 65, max: 69, letter: "C", points: 2.25, pass: true },
    { min: 60, max: 64, letter: "C-", points: 2.0, pass: true },
    { min: 55, max: 59, letter: "D+", points: 1.75, pass: true },
    { min: 50, max: 54, letter: "D", points: 1.5, pass: true },
    { min: 0, max: 49, letter: "F", points: 0, pass: false },
  ],
};

/** A classic US-style 4.0 scale as a second example of a configurable scale. */
export const US_SCALE: GradingScale = {
  id: "us-4.0",
  nameAr: "السلّم الأمريكي التقليدي (4.00)",
  nameEn: "Classic US 4.00 scale",
  maxPoints: 4,
  bands: [
    { min: 93, max: 100, letter: "A", points: 4.0, pass: true },
    { min: 90, max: 92, letter: "A-", points: 3.7, pass: true },
    { min: 87, max: 89, letter: "B+", points: 3.3, pass: true },
    { min: 83, max: 86, letter: "B", points: 3.0, pass: true },
    { min: 80, max: 82, letter: "B-", points: 2.7, pass: true },
    { min: 77, max: 79, letter: "C+", points: 2.3, pass: true },
    { min: 73, max: 76, letter: "C", points: 2.0, pass: true },
    { min: 70, max: 72, letter: "C-", points: 1.7, pass: true },
    { min: 67, max: 69, letter: "D+", points: 1.3, pass: true },
    { min: 60, max: 66, letter: "D", points: 1.0, pass: true },
    { min: 0, max: 59, letter: "F", points: 0, pass: false },
  ],
};

export const SCALES: GradingScale[] = [DEFAULT_SCALE, US_SCALE];

export function getScale(id: string): GradingScale {
  return SCALES.find((s) => s.id === id) ?? DEFAULT_SCALE;
}

/** Convert a GPA to the scale's official percentage equivalent. */
export function gpaToPercent(gpa: number, scale: GradingScale = DEFAULT_SCALE): number {
  if (scale.percent) return gpa * scale.percent.multiplier + scale.percent.offset;
  return (gpa / scale.maxPoints) * 100;
}

export function isValidMark(mark: unknown): mark is number {
  return typeof mark === "number" && Number.isFinite(mark) && mark >= 0 && mark <= 100;
}

export function markToBand(mark: number, scale: GradingScale = DEFAULT_SCALE): GradeBand {
  if (!isValidMark(mark)) throw new RangeError(`Mark out of range: ${mark}`);
  // Marks are integers in the official table; a fractional mark falls in the band whose range contains its floor.
  const m = Math.floor(mark);
  const band = scale.bands.find((b) => m >= b.min && m <= b.max);
  if (!band) throw new Error(`No band for mark ${mark} in scale ${scale.id}`);
  return band;
}

export function letterToBand(letter: string, scale: GradingScale = DEFAULT_SCALE): GradeBand | undefined {
  const norm = letter.trim().toUpperCase();
  return scale.bands.find((b) => b.letter.toUpperCase() === norm);
}

export function pointsToLetter(points: number, scale: GradingScale = DEFAULT_SCALE): string {
  // Highest band whose points are <= the given points
  const sorted = [...scale.bands].sort((a, b) => b.points - a.points);
  return (sorted.find((b) => b.points <= points + 1e-9) ?? sorted[sorted.length - 1]).letter;
}

/** Smallest band (lowest mark) with at least `points` GPA points, or undefined if none exists. */
export function minBandForPoints(points: number, scale: GradingScale = DEFAULT_SCALE): GradeBand | undefined {
  return [...scale.bands]
    .filter((b) => b.points >= points - 1e-9)
    .sort((a, b) => a.points - b.points)[0];
}

export type GradeInput =
  | { kind: "mark"; value: number }
  | { kind: "letter"; value: string }
  | { kind: "none" };

export function resolveGrade(
  input: GradeInput,
  scale: GradingScale = DEFAULT_SCALE,
): { band: GradeBand; mark?: number } | undefined {
  if (input.kind === "mark") {
    if (!isValidMark(input.value)) return undefined;
    return { band: markToBand(input.value, scale), mark: input.value };
  }
  if (input.kind === "letter") {
    const band = letterToBand(input.value, scale);
    return band ? { band } : undefined;
  }
  return undefined;
}

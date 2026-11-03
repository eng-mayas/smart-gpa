/** Display-only rounding. Internal math keeps full precision. */
export function fmtGpa(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toFixed(digits);
}

export function fmtDelta(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const s = v.toFixed(3);
  return v > 0 ? `+${s}` : s;
}

/** Approximate percentage equivalent of a GPA (GPA ÷ max × 100). Universities differ; shown as an estimate. */
export function gpaToPct(gpa: number | null | undefined, max = 4): string {
  if (gpa === null || gpa === undefined || !Number.isFinite(gpa)) return "—";
  return `${((gpa / max) * 100).toFixed(1)}%`;
}

export function fmtPct(v: number): string {
  return `${Math.round(v)}%`;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

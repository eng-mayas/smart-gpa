/**
 * Study plan engine: curriculum model, student progress, eligibility, registration
 * suggestions, repeat strategy and graduation projection. Pure, deterministic.
 */
import { DEFAULT_SCALE, GradingScale, letterToBand, markToBand } from "./grading";

export type PlanCourseType = "core" | "elective" | "university";

export interface PlanCourse {
  code: string;
  name: string;
  nameAr?: string;
  credits: number;
  prereqs: string[];
  coreqs?: string[];
  type: PlanCourseType;
  note?: string;
}

export interface StudyPlan {
  id: string;
  universityAr: string;
  universityEn?: string;
  majorAr: string;
  majorEn?: string;
  degree?: string;
  totalCredits: number;
  verification: "verified" | "draft";
  sourceRef: string;
  courses: PlanCourse[];
}

export type PlanCourseStatus = "done" | "registered" | "remaining";

export interface PlanProgressEntry {
  status: PlanCourseStatus;
  /** Letter of the best passed/latest attempt */
  letter?: string;
  /** Raw mark if known */
  mark?: number;
  /** Number of attempts so far */
  attempts?: number;
}

export type PlanProgress = Record<string, PlanProgressEntry>;

/** Level (year) from the 4th digit of a 6-digit code, else undefined. */
export function levelOf(code: string): number | undefined {
  const m = /^\d{3}(\d)\d{2}$/.exec(code.trim());
  return m ? Number(m[1]) : undefined;
}

export function courseLabel(c: PlanCourse): string {
  return c.nameAr ? `${c.nameAr} — ${c.name}` : c.name;
}

export interface PlanSummary {
  totalCredits: number;
  doneCredits: number;
  registeredCredits: number;
  remainingCredits: number;
  doneCount: number;
  remainingCount: number;
  /** CGPA computed from graded done courses, or null */
  cgpaFromPlan: number | null;
  gpaHours: number;
  failedCourses: PlanCourse[];
}

function pointsOf(e: PlanProgressEntry, scale: GradingScale): number | undefined {
  if (e.letter) return letterToBand(e.letter, scale)?.points;
  if (e.mark !== undefined) return markToBand(e.mark, scale).points;
  return undefined;
}

export function summarizePlan(plan: StudyPlan, progress: PlanProgress, scale: GradingScale = DEFAULT_SCALE): PlanSummary {
  let done = 0, reg = 0, doneCount = 0, w = 0, h = 0;
  const failed: PlanCourse[] = [];
  for (const c of plan.courses) {
    const e = progress[c.code];
    if (!e) continue;
    if (e.status === "done") {
      const pts = pointsOf(e, scale);
      const passed = pts === undefined ? true : (e.letter ? letterToBand(e.letter, scale)?.pass : markToBand(e.mark!, scale).pass) !== false;
      if (passed) { done += c.credits; doneCount++; } else failed.push(c);
      if (pts !== undefined) { w += pts * c.credits; h += c.credits; }
    } else if (e.status === "registered") reg += c.credits;
  }
  const total = Math.max(plan.totalCredits, plan.courses.reduce((s, c) => s + c.credits, 0));
  return {
    totalCredits: total,
    doneCredits: done,
    registeredCredits: reg,
    remainingCredits: Math.max(0, total - done),
    doneCount,
    remainingCount: plan.courses.length - doneCount,
    cgpaFromPlan: h > 0 ? w / h : null,
    gpaHours: h,
    failedCourses: failed,
  };
}

function isPassed(progress: PlanProgress, code: string, scale: GradingScale): boolean {
  const e = progress[code];
  if (!e || e.status !== "done") return false;
  if (e.letter) return letterToBand(e.letter, scale)?.pass ?? true;
  if (e.mark !== undefined) return markToBand(e.mark, scale).pass;
  return true;
}

export interface Eligibility {
  course: PlanCourse;
  eligible: boolean;
  missing: string[];
  /** Corequisites that must be taken in the same semester */
  coreqsPending: string[];
}

/** Courses the student can register now (prerequisites passed, not already passed). */
export function eligibleCourses(plan: StudyPlan, progress: PlanProgress, scale: GradingScale = DEFAULT_SCALE): Eligibility[] {
  const codes = new Set(plan.courses.map((c) => c.code));
  return plan.courses
    .filter((c) => !isPassed(progress, c.code, scale))
    .map((c) => {
      const missing = c.prereqs.filter((p) => codes.has(p) && !isPassed(progress, p, scale));
      const coreqsPending = (c.coreqs ?? []).filter((p) => !isPassed(progress, p, scale));
      return { course: c, eligible: missing.length === 0, missing, coreqsPending };
    });
}

/** How many later courses depend (transitively) on this one — unlocking value. */
export function unlockCount(plan: StudyPlan, code: string): number {
  const seen = new Set<string>();
  const stack = [code];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const c of plan.courses) {
      if ((c.prereqs.includes(cur) || (c.coreqs ?? []).includes(cur)) && !seen.has(c.code)) {
        seen.add(c.code);
        stack.push(c.code);
      }
    }
  }
  return seen.size;
}

export interface RegistrationSuggestion {
  courses: PlanCourse[];
  credits: number;
  maxCredits: number;
  rationaleAr: string;
}

/**
 * Suggest next-semester registration: eligible courses ordered by (failed-to-repeat first,
 * then lower level, then unlocking value), packed up to maxCredits. Corequisites are pulled in together.
 */
export function suggestRegistration(
  plan: StudyPlan,
  progress: PlanProgress,
  opts: { maxCredits: number; atRisk?: boolean },
  scale: GradingScale = DEFAULT_SCALE,
): RegistrationSuggestion {
  const maxCredits = opts.atRisk ? Math.min(opts.maxCredits, 15) : opts.maxCredits;
  const elig = eligibleCourses(plan, progress, scale).filter((e) => e.eligible);
  const score = (c: PlanCourse) => {
    const e = progress[c.code];
    const failed = e?.status === "done" && !isPassed(progress, c.code, scale);
    return (failed ? -1000 : 0) + (levelOf(c.code) ?? 9) * 100 - unlockCount(plan, c.code) * 5 - (c.type === "core" ? 1 : 0);
  };
  const ordered = elig.map((e) => e.course).sort((a, b) => score(a) - score(b));
  const chosen: PlanCourse[] = [];
  const has = (code: string) => chosen.some((c) => c.code === code);
  let credits = 0;
  for (const c of ordered) {
    if (has(c.code)) continue;
    const group = [c, ...(c.coreqs ?? []).map((k) => ordered.find((x) => x.code === k)).filter((x): x is PlanCourse => !!x && !has(x.code))];
    const g = group.reduce((s, x) => s + x.credits, 0);
    if (credits + g > maxCredits) continue;
    chosen.push(...group);
    credits += g;
  }
  return {
    courses: chosen,
    credits,
    maxCredits,
    rationaleAr: opts.atRisk
      ? `حمل مخفّف (${maxCredits} ساعة كحد أقصى) لأنك في وضع إنذار: الأولوية لإعادة المقررات الراسبة ثم مقررات المستوى الأدنى التي تفتح أكبر عدد من المقررات اللاحقة.`
      : `الأولوية لإعادة المقررات الراسبة، ثم مقررات المستوى الأدنى التي تفتح أكبر عدد من المقررات اللاحقة، مع ضم المتطلبات المتزامنة.`,
  };
}

export interface RepeatCandidate {
  course: PlanCourse;
  currentLetter: string;
  currentPoints: number;
  /** CGPA gain if the course is repeated with target letter */
  gainAtTarget: number;
  /** CGPA gain if repeated with maximum points */
  gainAtMax: number;
}

/** Which passed/failed courses give the biggest CGPA lift when repeated (old attempt replaced). */
export function repeatStrategy(
  plan: StudyPlan,
  progress: PlanProgress,
  targetLetter = "B",
  scale: GradingScale = DEFAULT_SCALE,
): RepeatCandidate[] {
  const s = summarizePlan(plan, progress, scale);
  if (s.gpaHours === 0 || s.cgpaFromPlan === null) return [];
  const target = letterToBand(targetLetter, scale)?.points ?? 3;
  const totalPoints = s.cgpaFromPlan * s.gpaHours;
  const out: RepeatCandidate[] = [];
  for (const c of plan.courses) {
    const e = progress[c.code];
    if (!e || e.status !== "done") continue;
    const pts = pointsOf(e, scale);
    if (pts === undefined || pts >= target) continue;
    const letter = e.letter ?? markToBand(e.mark!, scale).letter;
    const gain = (p: number) => (totalPoints - pts * c.credits + p * c.credits) / s.gpaHours - s.cgpaFromPlan!;
    out.push({ course: c, currentLetter: letter, currentPoints: pts, gainAtTarget: gain(target), gainAtMax: gain(scale.maxPoints) });
  }
  return out.sort((a, b) => b.gainAtTarget - a.gainAtTarget);
}

export interface GraduationProjection {
  remainingCredits: number;
  semestersNeeded: number;
  projectedCgpa: number | null;
  /** Semester GPA needed over the remaining credits to graduate at targetCgpa, or null if impossible */
  gpaNeededForTarget: number | null;
}

export function projectGraduation(
  summary: PlanSummary,
  assumedGpa: number,
  creditsPerSemester: number,
  targetCgpa?: number,
  scale: GradingScale = DEFAULT_SCALE,
): GraduationProjection {
  const rem = summary.remainingCredits;
  const sems = creditsPerSemester > 0 ? Math.ceil(rem / creditsPerSemester) : 0;
  const H = summary.gpaHours;
  const G = summary.cgpaFromPlan ?? 0;
  const projected = H + rem > 0 ? (G * H + assumedGpa * rem) / (H + rem) : null;
  let needed: number | null = null;
  if (targetCgpa !== undefined && rem > 0) {
    needed = (targetCgpa * (H + rem) - G * H) / rem;
    if (needed > scale.maxPoints + 1e-9) needed = null;
    if (needed !== null && needed < 0) needed = 0;
  }
  return { remainingCredits: rem, semestersNeeded: sems, projectedCgpa: projected, gpaNeededForTarget: needed };
}

/* ---------- Import: CSV / pasted text ---------- */

/**
 * Parse a plan from CSV or pasted text. Accepts lines like:
 *   301201, Engineering Analysis (1), 3, 601102
 *   301201 | تحليل هندسي | 3 | 601102;601101
 *   301201	Engineering Analysis	3
 * Columns: code, name, credits, [prereqs separated by ; or space], [type]
 */
export function parsePlanText(text: string): { courses: PlanCourse[]; errors: string[] } {
  const courses: PlanCourse[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const [i, line] of lines.entries()) {
    if (/^(code|رمز)/i.test(line)) continue; // header
    const cells = line.split(/\s*[,\t|]\s*/).map((c) => c.trim());
    if (cells.length < 3) {
      // try "CODE NAME... CREDITS" with whitespace
      const m = /^([A-Za-z]*\d{4,7})\s+(.+?)\s+(\d+(?:\.\d+)?)\s*$/.exec(line);
      if (!m) { errors.push(`السطر ${i + 1}: تعذّر التعرف على الأعمدة`); continue; }
      courses.push({ code: m[1], name: m[2], credits: Number(m[3]), prereqs: [], type: "core" });
      continue;
    }
    const [code, name, creditsRaw, prereqRaw = "", typeRaw = ""] = cells;
    const credits = Number(creditsRaw);
    if (!code || !name || !Number.isFinite(credits)) { errors.push(`السطر ${i + 1}: بيانات ناقصة`); continue; }
    const prereqs = prereqRaw.split(/[;\s/&]+/).map((p) => p.trim()).filter((p) => /\d{3,}/.test(p));
    const type: PlanCourseType = /elect|اختيار/i.test(typeRaw) ? "elective" : /univ|جامع/i.test(typeRaw) ? "university" : "core";
    courses.push({ code, name, credits, prereqs, type });
  }
  return { courses, errors };
}

export function planToCsv(plan: StudyPlan): string {
  const head = "code,name,credits,prereqs,type";
  const rows = plan.courses.map((c) => [c.code, `"${(c.nameAr ?? c.name).replace(/"/g, '""')}"`, c.credits, c.prereqs.join(";"), c.type].join(","));
  return [head, ...rows].join("\n");
}

/* ---------- Built-in plans registry ---------- */
import { SAMPLE_COMPUTER_ENGINEERING } from "./plans/sample-computer-engineering";
export const BUILTIN_PLANS: StudyPlan[] = [SAMPLE_COMPUTER_ENGINEERING];

/* ---------- Student overrides (fix a prerequisite without waiting for a new release) ---------- */
export interface PlanCourseOverride { prereqs?: string[]; coreqs?: string[]; credits?: number }
export type PlanOverrides = Record<string, Record<string, PlanCourseOverride>>; // planId → code → override

export function applyOverrides(plan: StudyPlan, overrides: Record<string, PlanCourseOverride> | undefined): StudyPlan {
  if (!overrides || Object.keys(overrides).length === 0) return plan;
  return { ...plan, courses: plan.courses.map((c) => (overrides[c.code] ? { ...c, ...overrides[c.code] } : c)) };
}

/** Parse "601102, 601101" / "601102;601101" into codes. */
export function parseCodes(text: string): string[] {
  return text.split(/[,;\s/&]+/).map((t) => t.trim()).filter((t) => /\d{3,}/.test(t));
}

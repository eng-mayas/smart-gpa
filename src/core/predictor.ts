/**
 * What-if / target GPA predictor. Deterministic math only.
 */
import { combineCgpa, calculateSemester, Course, SemesterResult } from "./gpa";
import { DEFAULT_SCALE, GradingScale, minBandForPoints } from "./grading";

export interface TargetInput {
  previousCgpa: number;
  previousGpaHours: number;
  semesterHours: number;
  targetCgpa: number;
}

export interface TargetResult {
  /** Semester GPA needed to hit the target exactly */
  requiredSemesterGpa: number | null;
  /** Whether it is achievable within [0, maxPoints] this semester */
  achievable: boolean;
  /** Best possible CGPA if every course is max */
  maxReachableCgpa: number;
  /** Worst possible CGPA if every course is F */
  minReachableCgpa: number;
  /** Letter grade (lowest band) that, if earned in every course, reaches the target */
  uniformLetter?: string;
  /** If not achievable: minimum hours of future coursework at maxPoints to reach target */
  hoursNeededAtMax: number | null;
  /** If not achievable: semesters needed at given load with maxPoints */
  semestersNeededAtMax: number | null;
  /** Hours of future coursework at a realistic GPA (e.g. 3.0) */
  hoursNeededAtRealistic: number | null;
  realisticGpa: number;
  reason?: string;
}

export function requiredSemesterGpa(input: TargetInput): number | null {
  const { previousCgpa, previousGpaHours, semesterHours, targetCgpa } = input;
  if (semesterHours <= 0) return null;
  return (targetCgpa * (previousGpaHours + semesterHours) - previousCgpa * previousGpaHours) / semesterHours;
}

/** Hours at GPA g (constant) needed so that CGPA reaches target: solve (P + g·h)/(H + h) = T → h = (T·H − P)/(g − T) */
export function hoursNeededAtGpa(prevCgpa: number, prevHours: number, target: number, g: number): number | null {
  if (prevCgpa >= target) return 0;
  if (g <= target) return null; // impossible: can never pull the average above g
  const h = (target * prevHours - prevCgpa * prevHours) / (g - target);
  return Math.ceil(h - 1e-9);
}

export function analyzeTarget(input: TargetInput, scale: GradingScale = DEFAULT_SCALE, realisticGpa = 3.0): TargetResult {
  const max = scale.maxPoints;
  const req = requiredSemesterGpa(input);
  const maxReach = combineCgpa(input.previousCgpa, input.previousGpaHours, max, input.semesterHours);
  const minReach = combineCgpa(input.previousCgpa, input.previousGpaHours, 0, input.semesterHours);
  const achievable = req !== null && req <= max + 1e-9;
  const alreadyMet = req !== null && req <= 0;
  const hoursMax = achievable ? null : hoursNeededAtGpa(input.previousCgpa, input.previousGpaHours, input.targetCgpa, max);
  const hoursReal = achievable
    ? null
    : hoursNeededAtGpa(input.previousCgpa, input.previousGpaHours, input.targetCgpa, realisticGpa);
  let uniformLetter: string | undefined;
  if (achievable && req !== null) {
    uniformLetter = minBandForPoints(Math.max(0, req), scale)?.letter;
  }
  let reason: string | undefined;
  if (req === null) reason = "عدد ساعات الفصل يجب أن يكون أكبر من صفر.";
  else if (alreadyMet) reason = "المعدل التراكمي الحالي يحقق الهدف أصلاً؛ أي معدل فصلي ≥ 0 يُبقيه فوق الهدف فقط إذا كان المعدل الفصلي ≥ الهدف.";
  else if (!achievable)
    reason = `حتى لو حصلت على ${max.toFixed(2)} في كل المقررات سيصل معدلك إلى ${maxReach.toFixed(3)} فقط، أي أقل من الهدف ${input.targetCgpa.toFixed(2)}.`;
  return {
    requiredSemesterGpa: req,
    achievable,
    maxReachableCgpa: maxReach,
    minReachableCgpa: minReach,
    uniformLetter,
    hoursNeededAtMax: hoursMax,
    semestersNeededAtMax:
      hoursMax === null || input.semesterHours <= 0 ? null : Math.ceil(hoursMax / input.semesterHours),
    hoursNeededAtRealistic: hoursReal,
    realisticGpa,
    reason,
  };
}

/* ---------- Scenario simulation ---------- */

export interface Scenario {
  id: string;
  nameAr: string;
  descriptionAr: string;
  courses: Course[];
}

export interface ScenarioOutcome {
  scenario: Scenario;
  semester: SemesterResult;
  newCgpa: number | null;
}

export function runScenario(
  scenario: Scenario,
  prevCgpa: number,
  prevHours: number,
  scale: GradingScale = DEFAULT_SCALE,
): ScenarioOutcome {
  const semester = calculateSemester(scenario.courses, scale);
  const newCgpa =
    semester.gpa === null && prevHours === 0
      ? null
      : combineCgpa(prevCgpa, prevHours, semester.gpa ?? 0, semester.gpaCredits);
  return { scenario, semester, newCgpa };
}

function withLetter(courses: Course[], letter: string): Course[] {
  return courses.map((c) => ({ ...c, grade: { kind: "letter", value: letter } }));
}

/** Build the standard comparison scenarios (A: all C, B: B in heavy courses, C: fail one, plus all-A and all-D). */
export function standardScenarios(courses: Course[], scale: GradingScale = DEFAULT_SCALE): Scenario[] {
  const passLetters = scale.bands.filter((b) => b.pass).sort((a, b) => a.points - b.points);
  const cBand = scale.bands.find((b) => b.letter === "C") ?? passLetters[Math.floor(passLetters.length / 2)];
  const bBand = scale.bands.find((b) => b.letter === "B") ?? passLetters[Math.floor(passLetters.length * 0.7)];
  const minPass = passLetters[0];
  const top = scale.bands.reduce((a, b) => (b.points > a.points ? b : a));
  const failBand = scale.bands.find((b) => !b.pass)!;

  const maxCredits = Math.max(...courses.map((c) => c.credits), 0);
  const heavy = courses.map((c) => ({
    ...c,
    grade: { kind: "letter" as const, value: c.credits >= maxCredits && maxCredits > 0 ? bBand.letter : cBand.letter },
  }));
  const failOne = courses.map((c, i) => ({
    ...c,
    grade: { kind: "letter" as const, value: i === 0 ? failBand.letter : cBand.letter },
  }));
  return [
    { id: "A", nameAr: `السيناريو A: ${cBand.letter} في كل المقررات`, descriptionAr: "النجاح بمستوى متوسط في جميع المقررات", courses: withLetter(courses, cBand.letter) },
    { id: "B", nameAr: `السيناريو B: ${bBand.letter} في المقررات ذات الساعات الأعلى`, descriptionAr: `${bBand.letter} في المقررات الأثقل و${cBand.letter} في الباقي`, courses: heavy },
    { id: "C", nameAr: `السيناريو C: رسوب في مقرر واحد`, descriptionAr: `رسوب في المقرر الأول و${cBand.letter} في الباقي`, courses: failOne },
    { id: "D", nameAr: `الحد الأدنى: ${minPass.letter} في كل المقررات`, descriptionAr: "أدنى نجاح ممكن", courses: withLetter(courses, minPass.letter) },
    { id: "E", nameAr: `الأفضل: ${top.letter} في كل المقررات`, descriptionAr: "السقف الأعلى الممكن", courses: withLetter(courses, top.letter) },
  ];
}

/**
 * Impact of each course: how much the new CGPA changes if that course moves
 * from minimum passing grade to maximum grade, holding others at the midpoint.
 */
export function courseImpact(
  courses: Course[],
  prevCgpa: number,
  prevHours: number,
  scale: GradingScale = DEFAULT_SCALE,
): { course: Course; impact: number; sharePct: number }[] {
  const gpaCourses = courses.filter((c) => c.status !== "withdrawn" && c.status !== "excluded" && c.status !== "passfail");
  const totalHours = prevHours + gpaCourses.reduce((s, c) => s + c.credits, 0);
  if (totalHours === 0) return [];
  return gpaCourses
    .map((c) => ({
      course: c,
      impact: (c.credits * scale.maxPoints) / totalHours,
      sharePct: (c.credits / totalHours) * 100,
    }))
    .sort((a, b) => b.impact - a.impact);
}

/**
 * Minimum uniform letter grade that reaches a target CGPA, and a greedy
 * per-course suggestion (heavier courses get the higher grade first).
 */
export function minimumGradesForTarget(
  courses: Course[],
  prevCgpa: number,
  prevHours: number,
  target: number,
  scale: GradingScale = DEFAULT_SCALE,
): { feasible: boolean; requiredGpa: number | null; uniform?: string; perCourse?: { course: Course; letter: string }[] } {
  const gpaCourses = courses.filter((c) => c.status !== "withdrawn" && c.status !== "excluded" && c.status !== "passfail");
  const hours = gpaCourses.reduce((s, c) => s + c.credits, 0);
  const req = requiredSemesterGpa({ previousCgpa: prevCgpa, previousGpaHours: prevHours, semesterHours: hours, targetCgpa: target });
  if (req === null || req > scale.maxPoints + 1e-9) return { feasible: false, requiredGpa: req };
  const uniform = minBandForPoints(Math.max(0, req), scale)?.letter;
  // Greedy: start all at min passing, raise heaviest courses one band at a time until weighted avg >= req
  const bands = [...scale.bands].filter((b) => b.pass).sort((a, b) => a.points - b.points);
  const idx = new Map<string, number>(gpaCourses.map((c) => [c.id, 0]));
  const avg = () => {
    let w = 0;
    for (const c of gpaCourses) w += bands[idx.get(c.id)!].points * c.credits;
    return hours > 0 ? w / hours : 0;
  };
  const sorted = [...gpaCourses].sort((a, b) => b.credits - a.credits);
  let guard = 0;
  while (avg() < req - 1e-9 && guard++ < 1000) {
    // raise the course that currently yields the biggest gain per step and is not maxed
    const candidate = sorted.find((c) => idx.get(c.id)! < bands.length - 1);
    if (!candidate) break;
    idx.set(candidate.id, idx.get(candidate.id)! + 1);
    // re-sort so that the next raise goes to the course with lowest band among heaviest
    sorted.sort((a, b) => idx.get(a.id)! - idx.get(b.id)! || b.credits - a.credits);
  }
  return {
    feasible: avg() >= req - 1e-9,
    requiredGpa: req,
    uniform,
    perCourse: gpaCourses.map((c) => ({ course: c, letter: bands[idx.get(c.id)!].letter })),
  };
}

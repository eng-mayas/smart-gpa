/**
 * GPA calculation service. Pure, deterministic functions.
 * Full precision internally; rounding is a display concern (see format.ts).
 */
import { DEFAULT_SCALE, GradeInput, GradingScale, resolveGrade } from "./grading";

export type CourseStatus =
  | "normal" // counts toward GPA
  | "repeat" // repeated course: replaces an older attempt (old points/hours removed from CGPA)
  | "withdrawn" // W: excluded from GPA
  | "passfail" // P/F: counts toward completed credits only, not GPA
  | "excluded"; // any other excluded course (transfer, audit...)

export interface Course {
  id: string;
  name: string;
  credits: number;
  grade: GradeInput;
  status: CourseStatus;
  /** For repeated courses: points of the previous attempt being replaced (0 if it was an F). */
  previousPoints?: number;
}

export interface CourseResult {
  course: Course;
  letter?: string;
  points?: number;
  /** points × credits (weighted grade points) */
  weighted?: number;
  countsInGpa: boolean;
  passed?: boolean;
  error?: string;
}

export interface SemesterResult {
  courses: CourseResult[];
  /** Σ credits of courses that count toward GPA and have a grade */
  gpaCredits: number;
  /** Σ credits of all registered courses (excluding withdrawn) */
  totalCredits: number;
  /** Σ weighted points */
  totalWeighted: number;
  /** Semester GPA, or null if no gradable course */
  gpa: number | null;
  /** Credits earned (passed, incl. pass/fail) */
  earnedCredits: number;
  failedCourses: number;
  missingGrades: number;
}

export function isValidCredits(c: unknown): c is number {
  return typeof c === "number" && Number.isFinite(c) && c >= 0 && c <= 30 && Number.isInteger(c * 2);
}

export function evaluateCourse(course: Course, scale: GradingScale = DEFAULT_SCALE): CourseResult {
  if (!isValidCredits(course.credits)) {
    return { course, countsInGpa: false, error: "ساعات معتمدة غير صالحة" };
  }
  if (course.status === "withdrawn" || course.status === "excluded") {
    return { course, countsInGpa: false };
  }
  const resolved = resolveGrade(course.grade, scale);
  if (!resolved) {
    return { course, countsInGpa: false, error: course.grade.kind === "none" ? "لا توجد علامة" : "علامة غير صالحة" };
  }
  const { band } = resolved;
  if (course.status === "passfail") {
    return { course, letter: band.pass ? "P" : "F", points: undefined, countsInGpa: false, passed: band.pass };
  }
  if (course.credits === 0) {
    return { course, letter: band.letter, points: band.points, weighted: 0, countsInGpa: false, passed: band.pass };
  }
  return {
    course,
    letter: band.letter,
    points: band.points,
    weighted: band.points * course.credits,
    countsInGpa: true,
    passed: band.pass,
  };
}

export function calculateSemester(courses: Course[], scale: GradingScale = DEFAULT_SCALE): SemesterResult {
  const results = courses.map((c) => evaluateCourse(c, scale));
  let gpaCredits = 0;
  let totalWeighted = 0;
  let totalCredits = 0;
  let earned = 0;
  let failed = 0;
  let missing = 0;
  for (const r of results) {
    if (r.course.status !== "withdrawn" && r.course.status !== "excluded" && isValidCredits(r.course.credits)) {
      totalCredits += r.course.credits;
    }
    if (r.error && r.course.grade.kind === "none") missing++;
    if (r.countsInGpa && r.weighted !== undefined) {
      gpaCredits += r.course.credits;
      totalWeighted += r.weighted;
    }
    if (r.passed === true) earned += r.course.credits;
    if (r.passed === false) failed++;
  }
  return {
    courses: results,
    gpaCredits,
    totalCredits,
    totalWeighted,
    gpa: gpaCredits > 0 ? totalWeighted / gpaCredits : null,
    earnedCredits: earned,
    failedCourses: failed,
    missingGrades: missing,
  };
}

export interface CumulativeInput {
  previousCgpa: number;
  previousGpaHours: number;
  semester: SemesterResult;
}

export interface CumulativeResult {
  previousCgpa: number;
  previousGpaHours: number;
  semesterGpa: number | null;
  semesterGpaHours: number;
  /** Points removed because repeated courses replace old attempts */
  replacedPoints: number;
  replacedHours: number;
  newCgpa: number | null;
  totalGpaHours: number;
  delta: number | null;
}

/**
 * New CGPA = [(prevCGPA × prevHours) + Σ(new weighted) − Σ(replaced old weighted)] / (prevHours + newHours − replacedHours)
 * Repeated courses: the old attempt (hours + points) is removed and the new attempt added, so hours are not double counted.
 */
export function calculateCumulative(input: CumulativeInput): CumulativeResult {
  const { previousCgpa, previousGpaHours, semester } = input;
  let replacedPoints = 0;
  let replacedHours = 0;
  for (const r of semester.courses) {
    if (r.course.status === "repeat" && r.countsInGpa) {
      replacedHours += r.course.credits;
      replacedPoints += (r.course.previousPoints ?? 0) * r.course.credits;
    }
  }
  const prevPoints = previousCgpa * previousGpaHours;
  const totalHours = previousGpaHours + semester.gpaCredits - replacedHours;
  const totalPoints = prevPoints + semester.totalWeighted - replacedPoints;
  const newCgpa = totalHours > 0 ? totalPoints / totalHours : null;
  return {
    previousCgpa,
    previousGpaHours,
    semesterGpa: semester.gpa,
    semesterGpaHours: semester.gpaCredits,
    replacedPoints,
    replacedHours,
    newCgpa,
    totalGpaHours: totalHours,
    delta: newCgpa === null || previousGpaHours === 0 ? null : newCgpa - previousCgpa,
  };
}

/** Convenience: combine prior CGPA with a semester GPA over N hours (no repeats). */
export function combineCgpa(prevCgpa: number, prevHours: number, semGpa: number, semHours: number): number {
  const h = prevHours + semHours;
  if (h === 0) return 0;
  return (prevCgpa * prevHours + semGpa * semHours) / h;
}

export function newCourse(partial: Partial<Course> = {}): Course {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2, 10),
    name: partial.name ?? "",
    credits: partial.credits ?? 3,
    grade: partial.grade ?? { kind: "none" },
    status: partial.status ?? "normal",
    previousPoints: partial.previousPoints,
  };
}

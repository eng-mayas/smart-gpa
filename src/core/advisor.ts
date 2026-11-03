/**
 * Advisor engine: classify a cohort of students with the rules engine.
 * Input is a CSV exported from the university's SIS; everything stays in the browser.
 */
import { AcademicPolicy, AcademicState, AcademicStatus, INITIAL_STATE, RiskLevel, nextThresholds, riskLevel, transition } from "./rules";
import { requiredSemesterGpa } from "./predictor";
import { normalizeDigits } from "./importer";

export interface StudentRecord {
  id: string;
  name: string;
  major?: string;
  cgpa: number;
  gpaHours: number;
  completedCredits: number;
  warnings: number;
  /** Current registered credits (for required-GPA computation) */
  registeredCredits?: number;
  /** Optional: current status code if the SIS exports it */
  status?: AcademicStatus;
  remaining?: number;
}

export interface StudentAssessment {
  student: StudentRecord;
  state: AcademicState;
  risk: RiskLevel;
  /** Status if the CGPA stays as it is at the next evaluation */
  nextIfUnchanged: AcademicStatus;
  requiredGpaSafe: number | null;
  requiredGpaSurvive: number | null;
  surviveCgpa: number | null;
  flagsAr: string[];
}

const HEADER_ALIASES: Record<keyof StudentRecord, string[]> = {
  id: ["id", "student_id", "studentid", "رقم", "الرقم الجامعي", "رقم الطالب"],
  name: ["name", "student", "الاسم", "اسم الطالب"],
  major: ["major", "specialization", "التخصص", "القسم"],
  cgpa: ["cgpa", "gpa", "cumulative", "المعدل", "المعدل التراكمي"],
  gpaHours: ["gpa_hours", "gpahours", "hours", "credit_hours", "الساعات", "ساعات المعدل", "الساعات المحسوبة"],
  completedCredits: ["completed", "completed_credits", "earned", "الساعات المنجزة", "المنجزة"],
  warnings: ["warnings", "warning", "الإنذارات", "عدد الإنذارات", "انذارات"],
  registeredCredits: ["registered", "registered_credits", "المسجلة", "الساعات المسجلة"],
  status: ["status", "الحالة"],
  remaining: ["remaining", "المتبقي", "الفصول المتبقية"],
};

function matchHeader(h: string): keyof StudentRecord | undefined {
  const n = h.trim().toLowerCase();
  for (const [k, aliases] of Object.entries(HEADER_ALIASES) as [keyof StudentRecord, string[]][]) {
    if (aliases.some((a) => n === a || n.includes(a))) return k;
  }
  return undefined;
}

export function parseStudentsCsv(text: string): { students: StudentRecord[]; errors: string[] } {
  const lines = normalizeDigits(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const errors: string[] = [];
  if (lines.length < 2) return { students: [], errors: ["الملف فارغ أو بلا صفوف"] };
  const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map(matchHeader);
  if (!headers.includes("cgpa")) errors.push("لم يُعثر على عمود المعدل التراكمي (cgpa / المعدل)");
  const students: StudentRecord[] = [];
  for (const [i, line] of lines.slice(1).entries()) {
    const cells = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const rec: Partial<StudentRecord> = { warnings: 0, completedCredits: 0, gpaHours: 0 };
    headers.forEach((h, j) => {
      if (!h || cells[j] === undefined) return;
      const v = cells[j];
      if (h === "id" || h === "name" || h === "major") (rec as Record<string, unknown>)[h] = v;
      else if (h === "status") rec.status = v as AcademicStatus;
      else (rec as Record<string, unknown>)[h] = Number(v);
    });
    if (!Number.isFinite(rec.cgpa)) { errors.push(`السطر ${i + 2}: معدل غير صالح`); continue; }
    students.push({ id: rec.id ?? String(i + 1), name: rec.name ?? `طالب ${i + 1}`, ...rec } as StudentRecord);
  }
  return { students, errors };
}

function stateFor(s: StudentRecord): AcademicState {
  const byWarnings: AcademicStatus = s.warnings <= 0 ? "good" : s.warnings === 1 ? "warning_1" : "warning_2";
  const known: AcademicStatus[] = ["good", "warning_1", "warning_2", "remedial_short", "remedial_long", "exception"];
  const status = s.status && known.includes(s.status) ? s.status : byWarnings;
  return { ...INITIAL_STATE, status, warnings: s.warnings, remaining: s.remaining ?? (status === "remedial_long" ? 2 : 1), semesterIndex: Math.max(2, Math.round(s.gpaHours / 15)) };
}

export function assessStudent(s: StudentRecord, policy: AcademicPolicy): StudentAssessment {
  const state = stateFor(s);
  const th = nextThresholds(state, policy, s.completedCredits);
  const next = transition(state, s.cgpa, policy, s.completedCredits).to.status;
  const reg = s.registeredCredits ?? 15;
  const req = (t: number | null) => (t === null ? null : requiredSemesterGpa({ previousCgpa: s.cgpa, previousGpaHours: s.gpaHours, semesterHours: reg, targetCgpa: t }));
  const flags: string[] = [];
  const reqSafe = req(th.safe);
  const reqSurvive = req(th.survive);
  if (s.cgpa < policy.specializationDismissalBelow) flags.push("المعدل دون حد الفصل من التخصص");
  if (next === "dismissed_specialization" || next === "dismissed_university") flags.push("إن بقي المعدل كما هو → حالة فصل في التقييم القادم");
  if (reqSurvive !== null && reqSurvive > 4) flags.push("تجنّب الفصل غير ممكن رياضياً هذا الفصل");
  else if (reqSurvive !== null && reqSurvive > 3) flags.push("يحتاج معدلاً فصلياً مرتفعاً جداً لتجنّب الفصل");
  if (reqSafe !== null && reqSafe > 4) flags.push("العودة للوضع السليم تحتاج أكثر من فصل");
  if (policy.exception && s.completedCredits >= policy.exception.minCompletedCredits && s.cgpa >= policy.exception.minCgpa && state.status !== "good") flags.push("مؤهل للاستثناء");
  const risk: RiskLevel = next === "dismissed_specialization" || next === "dismissed_university" ? "critical" : riskLevel(state);
  return { student: s, state, risk, nextIfUnchanged: next, requiredGpaSafe: reqSafe, requiredGpaSurvive: reqSurvive, surviveCgpa: th.survive, flagsAr: flags };
}

export function assessCohort(students: StudentRecord[], policy: AcademicPolicy): StudentAssessment[] {
  const order: RiskLevel[] = ["critical", "high", "medium", "low", "none"];
  return students.map((s) => assessStudent(s, policy)).sort((a, b) => order.indexOf(a.risk) - order.indexOf(b.risk) || a.student.cgpa - b.student.cgpa);
}

export const SAMPLE_STUDENTS_CSV = `id,name,major,cgpa,hours,completed,warnings,registered
2021001,أحمد س.,هندسة الحاسوب,1.21,45,39,2,15
2021002,ليان م.,هندسة الحاسوب,1.62,60,57,2,12
2021003,كرم ع.,صيدلة,1.88,30,30,1,18
2021004,هبة ر.,هندسة الحاسوب,2.45,75,75,0,18
2021005,سامر ق.,إدارة أعمال,0.95,30,24,1,15
2021006,نور د.,هندسة الحاسوب,1.79,102,99,2,12
2021007,ريم ح.,صيدلة,3.42,90,90,0,18
2021008,طارق ن.,هندسة الحاسوب,1.98,48,45,1,16`;

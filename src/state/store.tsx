/**
 * Application state with LocalStorage persistence (guest mode).
 * The persistence layer is isolated here so a Supabase adapter can replace it later.
 */
import React, { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import { Course, calculateSemester, newCourse } from "../core/gpa";
import { DEFAULT_SCALE } from "../core/grading";
import { SemesterRecord } from "../core/rules";

/**
 * A completed semester in "فصولي". Either detailed (courses with grades — everything else is derived)
 * or quick (only the semester GPA and hours, for old semesters the student does not want to itemize).
 */
export interface SemesterEntry {
  id: string;
  label: string;
  kind: "detailed" | "quick";
  courses: Course[];
  /** quick only */
  gpa?: number | null;
  gpaHours?: number;
  earnedCredits?: number;
}
import { PlanOverrides, PlanProgress, StudyPlan } from "../core/plan";
import { GradeComponent } from "../core/components";
import { StudentRecord } from "../core/advisor";

export interface Profile {
  name: string;
  university: string;
  faculty: string;
  major: string;
  academicSystem: string;
  academicYear: string;
  planCredits: number; // total study plan credits
  previousCgpa: number;
  previousGpaHours: number;
  completedCredits: number;
  previousWarnings: number;
  remainingCourses: number;
}

export interface AppState {
  version: 1;
  theme: "light" | "dark";
  lang: "ar" | "en";
  scaleId: string;
  policyId: string;
  profile: Profile;
  /** Current semester courses (shared by semester/cumulative/predictor pages) */
  courses: Course[];
  /** Completed semesters — the single source of truth (GPA history, plan progress and profile numbers derive from it) */
  semesters: SemesterEntry[];
  /** @deprecated migrated into semesters; kept for old backups */
  history?: SemesterRecord[];
  /** Saved what-if scenarios */
  savedScenarios: { id: string; name: string; courses: Course[]; createdAt: string }[];
  /** Active study plan id (built-in) or "custom" */
  planId: string | null;
  /** Custom plan uploaded by the student */
  customPlan: StudyPlan | null;
  /** Per-course status within the plan */
  planProgress: PlanProgress;
  /** Student corrections to plan courses (prerequisites, credits) */
  planOverrides: PlanOverrides;
  /** In-semester grade components per current course id */
  components: Record<string, GradeComponent[]>;
  /** Advisor mode: imported cohort (stays local) */
  advisorStudents: StudentRecord[];
  /** Optional URL of an extraction service for photo/PDF import */
  extractionEndpoint: string;
  /** True while the preloaded demo data has not been touched */
  demo: boolean;
  /** First-run flow dismissed */
  onboarded: boolean;
  /** ISO date of the last JSON export */
  lastBackup: string | null;
}

export const SAMPLE_COURSES: Course[] = [
  newCourse({ id: "c1", name: "رياضيات 2", credits: 4, grade: { kind: "mark", value: 72 } }),
  newCourse({ id: "c2", name: "برمجة 1", credits: 3, grade: { kind: "mark", value: 88 } }),
  newCourse({ id: "c3", name: "فيزياء", credits: 3, grade: { kind: "letter", value: "C-" } }),
  newCourse({ id: "c4", name: "لغة إنكليزية", credits: 2, grade: { kind: "mark", value: 91 } }),
  newCourse({ id: "c5", name: "ثقافة", credits: 2, grade: { kind: "mark", value: 46 } }),
  newCourse({ id: "c6", name: "دارات كهربائية", credits: 3, grade: { kind: "none" } }),
];

export const SAMPLE_SEMESTERS: SemesterEntry[] = [
  { id: "s1", label: "2023-2024 / ف1", kind: "quick", courses: [], gpa: 1.95, gpaHours: 15, earnedCredits: 15 },
  { id: "s2", label: "2023-2024 / ف2", kind: "quick", courses: [], gpa: 1.62, gpaHours: 16, earnedCredits: 13 },
  { id: "s3", label: "2024-2025 / ف1", kind: "quick", courses: [], gpa: 2.35, gpaHours: 15, earnedCredits: 15 },
  {
    id: "s4", label: "2024-2025 / ف2", kind: "detailed", courses: [
      newCourse({ id: "p1", name: "رياضيات 1", credits: 4, grade: { kind: "mark", value: 52 } }),
      newCourse({ id: "p2", name: "مقدمة برمجة", credits: 3, grade: { kind: "mark", value: 61 } }),
      newCourse({ id: "p3", name: "فيزياء 1", credits: 3, grade: { kind: "mark", value: 48 } }),
      newCourse({ id: "p4", name: "لغة عربية", credits: 2, grade: { kind: "mark", value: 74 } }),
      newCourse({ id: "p5", name: "مهارات حاسوب", credits: 2, grade: { kind: "mark", value: 66 } }),
    ],
  },
];

/** Convert a semester entry to the record the rules engine consumes. */
export function semesterToRecord(s: SemesterEntry, scale = DEFAULT_SCALE): SemesterRecord {
  if (s.kind === "quick") return { label: s.label, gpa: s.gpa ?? null, gpaHours: s.gpaHours ?? 0, earnedCredits: s.earnedCredits ?? s.gpaHours ?? 0 };
  const r = calculateSemester(s.courses, scale);
  return { label: s.label, gpa: r.gpa, gpaHours: r.gpaCredits, earnedCredits: r.earnedCredits };
}

export const DEFAULT_PROFILE: Profile = {
  name: "",
  university: "جامعة خاصة سورية",
  faculty: "الهندسة المعلوماتية",
  major: "هندسة البرمجيات",
  academicSystem: "الساعات المعتمدة (4.00)",
  academicYear: "2025-2026",
  planCredits: 165,
  previousCgpa: 1.85,
  previousGpaHours: 60,
  completedCredits: 57,
  previousWarnings: 1,
  remainingCourses: 30,
};

export const EMPTY_PROFILE: Profile = { ...DEFAULT_PROFILE, university: "", faculty: "", major: "", planCredits: 0, previousCgpa: 0, previousGpaHours: 0, completedCredits: 0, previousWarnings: 0, remainingCourses: 0 };

/** First run starts empty; the student enters their own data (sample data is available from Settings). */
export const INITIAL_APP_STATE: AppState = {
  version: 1,
  theme: "light",
  lang: "ar",
  scaleId: "sy-private-4.0",
  policyId: "sy-private-unified-v1",
  profile: EMPTY_PROFILE,
  courses: [],
  semesters: [],
  savedScenarios: [],
  planId: null,
  customPlan: null,
  planProgress: {},
  planOverrides: {},
  components: {},
  advisorStudents: [],
  extractionEndpoint: "",
  demo: false,
  onboarded: false,
  lastBackup: null,
};

type Action =
  | { type: "set"; patch: Partial<AppState> }
  | { type: "profile"; patch: Partial<Profile> }
  | { type: "courses"; courses: Course[] }
  | { type: "semesters"; semesters: SemesterEntry[] }
  | { type: "saveScenario"; name: string; courses: Course[] }
  | { type: "deleteScenario"; id: string }
  | { type: "planProgress"; progress: PlanProgress }
  | { type: "planOverride"; planId: string; code: string; override: PlanOverrides[string][string] | null }
  | { type: "components"; courseId: string; components: GradeComponent[] }
  | { type: "advisorStudents"; students: StudentRecord[] }
  | { type: "reset" }
  | { type: "loadSample" };

const KEY = "smart-gpa:v1";

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return INITIAL_APP_STATE;
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.version !== 1) return INITIAL_APP_STATE;
    const merged: AppState = { ...INITIAL_APP_STATE, ...parsed, profile: { ...EMPTY_PROFILE, ...parsed.profile } };
    // Migration: GPA-only history → quick semesters.
    if (!parsed.semesters && Array.isArray(parsed.history)) {
      merged.semesters = parsed.history.map((h, i) => ({ id: `mig-${i}`, label: h.label, kind: "quick" as const, courses: [], gpa: h.gpa, gpaHours: h.gpaHours, earnedCredits: h.earnedCredits ?? h.gpaHours }));
    }
    merged.semesters = merged.semesters ?? [];
    delete merged.history;
    // Migration: the hand-drawn draft was the only policy before the verified unified system was added.
    if (parsed.policyId === "sy-private-draft" && !("policyMigrated" in parsed)) merged.policyId = "sy-private-unified-v1";
    return merged;
  } catch {
    return INITIAL_APP_STATE;
  }
}

function reducer(state: AppState, action: Action): AppState {
  const next = reduce(state, action);
  // Any real data entry ends demo mode; UI-only settings keep it.
  if (action.type === "loadSample") return { ...next, demo: true, onboarded: true };
  if (action.type === "reset") return { ...next, demo: false, onboarded: false };
  if (action.type !== "set") return { ...next, demo: false };
  return next;
}

function reduce(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "set":
      return { ...state, ...action.patch };
    case "profile":
      return { ...state, profile: { ...state.profile, ...action.patch } };
    case "courses":
      return { ...state, courses: action.courses };
    case "semesters":
      return { ...state, semesters: action.semesters };
    case "saveScenario":
      return {
        ...state,
        savedScenarios: [
          ...state.savedScenarios,
          { id: Math.random().toString(36).slice(2, 9), name: action.name, courses: action.courses, createdAt: new Date().toISOString() },
        ],
      };
    case "deleteScenario":
      return { ...state, savedScenarios: state.savedScenarios.filter((s) => s.id !== action.id) };
    case "planProgress":
      return { ...state, planProgress: action.progress };
    case "planOverride": {
      const forPlan = { ...(state.planOverrides[action.planId] ?? {}) };
      if (action.override === null) delete forPlan[action.code];
      else forPlan[action.code] = { ...forPlan[action.code], ...action.override };
      return { ...state, planOverrides: { ...state.planOverrides, [action.planId]: forPlan } };
    }
    case "components":
      return { ...state, components: { ...state.components, [action.courseId]: action.components } };
    case "advisorStudents":
      return { ...state, advisorStudents: action.students };
    case "reset":
      return { ...INITIAL_APP_STATE, theme: state.theme, lang: state.lang, scaleId: state.scaleId, policyId: state.policyId, extractionEndpoint: state.extractionEndpoint };
    case "loadSample":
      return { ...INITIAL_APP_STATE, theme: state.theme, lang: state.lang, profile: DEFAULT_PROFILE, courses: SAMPLE_COURSES, semesters: SAMPLE_SEMESTERS };
  }
}

const Ctx = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* quota or private mode: ignore */
    }
  }, [state]);
  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = state.lang;
  }, [state.theme, state.lang]);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore outside provider");
  return ctx;
}

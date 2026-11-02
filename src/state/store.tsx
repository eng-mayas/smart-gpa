/**
 * Application state with LocalStorage persistence (guest mode).
 * The persistence layer is isolated here so a Supabase adapter can replace it later.
 */
import React, { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import { Course, newCourse } from "../core/gpa";
import { SemesterRecord } from "../core/rules";

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
  /** Academic history, one record per completed semester */
  history: SemesterRecord[];
  /** Saved what-if scenarios */
  savedScenarios: { id: string; name: string; courses: Course[]; createdAt: string }[];
}

export const SAMPLE_COURSES: Course[] = [
  newCourse({ id: "c1", name: "رياضيات 2", credits: 4, grade: { kind: "mark", value: 72 } }),
  newCourse({ id: "c2", name: "برمجة 1", credits: 3, grade: { kind: "mark", value: 88 } }),
  newCourse({ id: "c3", name: "فيزياء", credits: 3, grade: { kind: "letter", value: "C-" } }),
  newCourse({ id: "c4", name: "لغة إنكليزية", credits: 2, grade: { kind: "mark", value: 91 } }),
  newCourse({ id: "c5", name: "ثقافة", credits: 2, grade: { kind: "mark", value: 46 } }),
  newCourse({ id: "c6", name: "دارات كهربائية", credits: 3, grade: { kind: "none" } }),
];

export const SAMPLE_HISTORY: SemesterRecord[] = [
  { label: "2023-2024 / ف1", gpa: 1.95, gpaHours: 15 },
  { label: "2023-2024 / ف2", gpa: 1.62, gpaHours: 16 },
  { label: "2024-2025 / ف1", gpa: 2.35, gpaHours: 15 },
  { label: "2024-2025 / ف2", gpa: 1.48, gpaHours: 14 },
];

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

export const INITIAL_APP_STATE: AppState = {
  version: 1,
  theme: "light",
  lang: "ar",
  scaleId: "sy-private-4.0",
  policyId: "sy-private-draft",
  profile: DEFAULT_PROFILE,
  courses: SAMPLE_COURSES,
  history: SAMPLE_HISTORY,
  savedScenarios: [],
};

type Action =
  | { type: "set"; patch: Partial<AppState> }
  | { type: "profile"; patch: Partial<Profile> }
  | { type: "courses"; courses: Course[] }
  | { type: "history"; history: SemesterRecord[] }
  | { type: "saveScenario"; name: string; courses: Course[] }
  | { type: "deleteScenario"; id: string }
  | { type: "reset" }
  | { type: "loadSample" };

const KEY = "smart-gpa:v1";

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return INITIAL_APP_STATE;
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.version !== 1) return INITIAL_APP_STATE;
    return { ...INITIAL_APP_STATE, ...parsed, profile: { ...DEFAULT_PROFILE, ...parsed.profile } };
  } catch {
    return INITIAL_APP_STATE;
  }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "set":
      return { ...state, ...action.patch };
    case "profile":
      return { ...state, profile: { ...state.profile, ...action.patch } };
    case "courses":
      return { ...state, courses: action.courses };
    case "history":
      return { ...state, history: action.history };
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
    case "reset":
      return { ...INITIAL_APP_STATE, courses: [], history: [], profile: { ...DEFAULT_PROFILE, previousCgpa: 0, previousGpaHours: 0, completedCredits: 0, previousWarnings: 0 }, theme: state.theme };
    case "loadSample":
      return { ...INITIAL_APP_STATE, theme: state.theme };
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

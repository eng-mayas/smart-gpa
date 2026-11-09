import { useMemo } from "react";
import { useStore, semesterToRecord } from "./store";
import { getScale } from "../core/grading";
import { calculateCumulative, calculateSemester } from "../core/gpa";
import { AcademicState, UNIFIED_SY_PRIVATE_POLICY, INITIAL_STATE, POLICIES, evaluateHistory, transition } from "../core/rules";
import { BUILTIN_PLANS, applyOverrides, PlanProgress, StudyPlan } from "../core/plan";

/** Derive the current FSM state from the profile's warning count (used when no semesters are recorded). */
export function stateFromProfile(previousWarnings: number, previousGpaHours: number, semestersDone: number): AcademicState {
  const status = previousWarnings <= 0 ? (previousGpaHours > 0 ? "good" : "not_evaluated") : previousWarnings === 1 ? "warning_1" : "warning_2";
  return { ...INITIAL_STATE, status, warnings: previousWarnings, semesterIndex: semestersDone };
}

/** Match a course entered in a semester to a plan course (by picker id, then by name). */
export function matchPlanCode(plan: StudyPlan | null, course: { id: string; name: string }): string | undefined {
  if (!plan) return undefined;
  if (course.id.startsWith("plan-")) return course.id.slice(5);
  const n = course.name.trim();
  return plan.courses.find((p) => p.nameAr === n || p.name === n || `${p.nameAr} — ${p.name}` === n)?.code;
}

export function useAcademic() {
  const { state, dispatch } = useStore();
  return useMemo(() => {
    const scale = getScale(state.scaleId);
    const policy = POLICIES.find((p) => p.id === state.policyId) ?? UNIFIED_SY_PRIVATE_POLICY;
    const semester = calculateSemester(state.courses, scale);

    const basePlan: StudyPlan | null = state.planId === "custom" ? state.customPlan : BUILTIN_PLANS.find((p) => p.id === state.planId) ?? null;
    const activePlan = basePlan ? applyOverrides(basePlan, state.planOverrides[basePlan.id]) : null;

    // --- Derived academic history from "فصولي" ---
    const records = state.semesters.map((s) => semesterToRecord(s, scale));
    const timeline = evaluateHistory(records, policy);
    const hasSemesters = state.semesters.length > 0;
    const historyHours = records.reduce((s, r) => s + (r.gpa !== null ? r.gpaHours : 0), 0);
    const historyPoints = records.reduce((s, r) => s + (r.gpa !== null ? r.gpa * r.gpaHours : 0), 0);
    const last = timeline[timeline.length - 1];

    // Profile numbers: derived from semesters when they exist, otherwise the manually entered ones.
    const previousCgpa = hasSemesters ? (historyHours > 0 ? historyPoints / historyHours : 0) : state.profile.previousCgpa;
    const previousGpaHours = hasSemesters ? historyHours : state.profile.previousGpaHours;
    const completedCredits = hasSemesters ? (last?.completedCredits ?? 0) : state.profile.completedCredits;
    const previousWarnings = hasSemesters ? (last?.transition.to.warnings ?? 0) : state.profile.previousWarnings;
    const derivedProfile = { ...state.profile, previousCgpa, previousGpaHours, completedCredits, previousWarnings };

    const cumulative = calculateCumulative({ previousCgpa, previousGpaHours, semester });
    const currentState: AcademicState = hasSemesters && last
      ? last.transition.to
      : stateFromProfile(previousWarnings, previousGpaHours, previousGpaHours > 0 ? Math.max(2, Math.round(previousGpaHours / 15)) : 0);
    const projectedCredits = completedCredits + semester.earnedCredits;
    const predicted = transition(currentState, cumulative.newCgpa, policy, projectedCredits);

    // --- Derived plan progress: detailed semesters → done/failed, current courses → registered, manual entries fill gaps ---
    const planProgress: PlanProgress = { ...state.planProgress };
    if (activePlan) {
      for (const s of state.semesters) {
        if (s.kind !== "detailed") continue;
        const res = calculateSemester(s.courses, scale);
        for (const r of res.courses) {
          const code = matchPlanCode(activePlan, r.course);
          if (!code || !r.letter) continue;
          const prev = planProgress[code];
          // keep the best attempt
          const better = !prev || prev.status !== "done" || (r.points ?? 0) >= (prev.letter ? (scale.bands.find((b) => b.letter === prev.letter)?.points ?? 0) : 0);
          if (better) planProgress[code] = { status: "done", letter: r.letter === "P" ? undefined : r.letter, mark: r.course.grade.kind === "mark" ? r.course.grade.value : undefined, attempts: (prev?.attempts ?? 0) + 1 };
        }
      }
      for (const c of state.courses) {
        const code = matchPlanCode(activePlan, c);
        if (code && planProgress[code]?.status !== "done") planProgress[code] = { ...planProgress[code], status: "registered" };
      }
    }

    return { state, dispatch, scale, policy, semester, cumulative, timeline, historyHours, currentState, predicted, projectedCredits, activePlan, planProgress, derivedProfile, hasSemesters };
  }, [state, dispatch]);
}

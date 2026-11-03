import { useMemo } from "react";
import { useStore } from "./store";
import { getScale } from "../core/grading";
import { calculateCumulative, calculateSemester } from "../core/gpa";
import { AcademicState, UNIFIED_SY_PRIVATE_POLICY, INITIAL_STATE, POLICIES, evaluateHistory, transition } from "../core/rules";
import { BUILTIN_PLANS, applyOverrides, StudyPlan } from "../core/plan";

/** Derive the current FSM state: from the history when present, otherwise from the profile's warning count. */
export function stateFromProfile(previousWarnings: number, previousGpaHours: number, semestersDone: number): AcademicState {
  const status = previousWarnings <= 0 ? (previousGpaHours > 0 ? "good" : "not_evaluated") : previousWarnings === 1 ? "warning_1" : "warning_2";
  return { ...INITIAL_STATE, status, warnings: previousWarnings, semesterIndex: semestersDone };
}

export function useAcademic() {
  const { state, dispatch } = useStore();
  return useMemo(() => {
    const scale = getScale(state.scaleId);
    const policy = POLICIES.find((p) => p.id === state.policyId) ?? UNIFIED_SY_PRIVATE_POLICY;
    const semester = calculateSemester(state.courses, scale);
    const { previousCgpa, previousGpaHours, completedCredits, previousWarnings } = state.profile;
    const cumulative = calculateCumulative({ previousCgpa, previousGpaHours, semester });

    const timeline = evaluateHistory(state.history, policy);
    const historyHours = state.history.reduce((s, r) => s + (r.gpa !== null ? r.gpaHours : 0), 0);
    const currentState: AcademicState =
      timeline.length > 0
        ? timeline[timeline.length - 1].transition.to
        : stateFromProfile(previousWarnings, previousGpaHours, previousGpaHours > 0 ? Math.max(2, Math.round(previousGpaHours / 15)) : 0);

    const projectedCredits = completedCredits + semester.earnedCredits;
    const predicted = transition(currentState, cumulative.newCgpa, policy, projectedCredits);

    const basePlan: StudyPlan | null = state.planId === "custom" ? state.customPlan : BUILTIN_PLANS.find((p) => p.id === state.planId) ?? null;
    const activePlan = basePlan ? applyOverrides(basePlan, state.planOverrides[basePlan.id]) : null;

    return { state, dispatch, scale, policy, semester, cumulative, timeline, historyHours, currentState, predicted, projectedCredits, activePlan };
  }, [state, dispatch]);
}

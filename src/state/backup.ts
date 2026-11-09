import { AppState } from "./store";

export function exportBackup(state: AppState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `smart-gpa-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}

/** True when real data exists and no backup was made in the last `days`. */
export function backupDue(state: AppState, days = 14): boolean {
  if (state.demo) return false;
  if (!state.lastBackup) return state.semesters.length > 0 || state.courses.length > 2 || Object.keys(state.planProgress).length > 0;
  return Date.now() - new Date(state.lastBackup).getTime() > days * 86400000;
}

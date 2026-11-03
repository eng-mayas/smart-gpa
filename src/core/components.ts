/**
 * In-semester grade components (quizzes, assignments, lab, final) and the
 * "what do I need in the final?" calculation. Deterministic.
 */
import { DEFAULT_SCALE, GradingScale } from "./grading";

export interface GradeComponent {
  id: string;
  name: string;
  /** Weight in percent of the course mark (all weights should sum to 100) */
  weight: number;
  /** Score obtained, on a 0..max scale; undefined if not yet taken */
  score?: number;
  /** Maximum score of this component (default 100) */
  max?: number;
  /** Marks the component the student still has to sit (usually the final exam) */
  isFinal?: boolean;
}

export const DEFAULT_COMPONENTS: GradeComponent[] = [
  { id: "q1", name: "مذاكرة 1", weight: 15 },
  { id: "q2", name: "مذاكرة 2", weight: 15 },
  { id: "hw", name: "وظائف/مشاركة", weight: 10 },
  { id: "lab", name: "عملي", weight: 20 },
  { id: "final", name: "الامتحان النهائي", weight: 40, isFinal: true },
];

export interface ComponentsStanding {
  /** Σ weights of all components */
  totalWeight: number;
  /** Σ weights of components with a score */
  doneWeight: number;
  /** Course-mark points already secured (0..100) */
  securedMark: number;
  /** Mark if the remaining components are scored at the current average */
  projectedMark: number | null;
  /** Mark if every remaining component scores 100 */
  maxPossibleMark: number;
  /** Mark if every remaining component scores 0 */
  minPossibleMark: number;
  /** Average percentage on the components already done */
  currentAverage: number | null;
  /** Weight of the components not yet scored */
  remainingWeight: number;
  weightsValid: boolean;
}

export function standing(components: GradeComponent[]): ComponentsStanding {
  let total = 0, done = 0, secured = 0, pctSum = 0;
  for (const c of components) {
    total += c.weight;
    if (c.score !== undefined && Number.isFinite(c.score)) {
      const pct = Math.max(0, Math.min(1, c.score / (c.max ?? 100)));
      done += c.weight;
      secured += pct * c.weight;
      pctSum += pct * c.weight;
    }
  }
  const remaining = total - done;
  const avg = done > 0 ? pctSum / done : null;
  return {
    totalWeight: total,
    doneWeight: done,
    securedMark: secured,
    projectedMark: avg === null ? null : secured + avg * remaining,
    maxPossibleMark: secured + remaining,
    minPossibleMark: secured,
    currentAverage: avg === null ? null : avg * 100,
    remainingWeight: remaining,
    weightsValid: Math.abs(total - 100) < 1e-9,
  };
}

export interface NeededInRemaining {
  letter: string;
  targetMark: number;
  /** Percentage needed on the remaining components (0..100), null when already secured */
  neededPct: number | null;
  achievable: boolean;
  alreadySecured: boolean;
}

/**
 * For every passing band: the percentage needed across the remaining (unscored) components —
 * typically just the final — to land on that band's minimum mark.
 */
export function neededForEachLetter(components: GradeComponent[], scale: GradingScale = DEFAULT_SCALE): NeededInRemaining[] {
  const s = standing(components);
  return scale.bands
    .filter((b) => b.pass)
    .sort((a, b) => a.min - b.min)
    .map((b) => {
      if (s.securedMark >= b.min - 1e-9) return { letter: b.letter, targetMark: b.min, neededPct: null, achievable: true, alreadySecured: true };
      if (s.remainingWeight <= 0) return { letter: b.letter, targetMark: b.min, neededPct: null, achievable: false, alreadySecured: false };
      const needed = ((b.min - s.securedMark) / s.remainingWeight) * 100;
      return { letter: b.letter, targetMark: b.min, neededPct: needed, achievable: needed <= 100 + 1e-9, alreadySecured: false };
    });
}

/** Percentage needed on the remaining components to reach a specific mark. */
export function neededForMark(components: GradeComponent[], targetMark: number): number | null {
  const s = standing(components);
  if (s.remainingWeight <= 0) return null;
  return ((targetMark - s.securedMark) / s.remainingWeight) * 100;
}

/**
 * Academic Rules Engine — a configurable, versioned finite-state machine.
 *
 * Nothing here is hard-wired to a university. A policy object describes thresholds,
 * warning limits, remedial opportunities and exceptional provisions. The engine
 * only *interprets* the policy; it never claims to issue an official decision.
 */

export type AcademicStatus =
  | "not_evaluated" // CGPA not yet computed (e.g. first semester)
  | "good" // good standing
  | "warning_1" // first academic warning
  | "warning_2" // second (final) academic warning
  | "remedial_short" // one remedial semester, must climb to the "upper recovery" band
  | "remedial_long" // remedial semesters granted, must reach good standing
  | "exception" // exceptional extension (e.g. ≥ N credits and CGPA ≥ X)
  | "dismissed_specialization" // dismissal from the specialization (may transfer within the university)
  | "dismissed_university"; // dismissal from the university

export type RiskLevel = "none" | "low" | "medium" | "high" | "critical";

export interface AcademicPolicy {
  id: string;
  version: string;
  universityId: string;
  universityNameAr: string;
  academicSystem: string; // e.g. "credit-hours-4.0"
  effectiveFrom: string; // academic year, e.g. "2024-2025"
  verification: "verified" | "draft" | "unverified";
  sourceRef: string;
  notesAr?: string;

  /** CGPA is first computed at the end of this semester (1-based). */
  cgpaStartsAtSemester: number;
  /** CGPA at or above → good standing */
  goodStandingMin: number;
  /** CGPA below → dismissal from specialization (at any evaluated stage) */
  specializationDismissalBelow: number;
  /** Number of warnings before remedial stage */
  maxWarnings: number;
  /** After the final warning: CGPA ≥ this → long remedial track */
  upperRecoveryMin: number;
  /** Semesters granted in the long remedial track */
  longRemedialSemesters: number;
  /** Semesters granted in the short remedial track (CGPA between dismissal threshold and upperRecoveryMin) */
  shortRemedialSemesters: number;
  /** After a short remedial semester, reaching upperRecoveryMin grants this many extra semesters */
  shortToLongSemesters: number;
  /** A student dismissed from a specialization for CGPA < threshold may continue in another one; a second time → university dismissal */
  specializationDismissalAllowsTransfer?: boolean;
  /** Max credit load while in remedial study (informational, used by registration suggestions) */
  remedialMaxCredits?: number;
  /** Article references for display */
  articlesAr?: string[];
  /** Exceptional provision (optional) */
  exception?: {
    minCompletedCredits: number;
    minCgpa: number;
    extraSemesters: number;
    descriptionAr: string;
  };
}

/** Draft policy transcribed from the provided hand-drawn flowchart. MUST be verified against official regulations. */
export const DRAFT_SY_PRIVATE_POLICY: AcademicPolicy = {
  id: "sy-private-draft",
  version: "0.1.0",
  universityId: "sy-private-generic",
  universityNameAr: "جامعة خاصة سورية (نموذج أولي)",
  academicSystem: "credit-hours-4.0",
  effectiveFrom: "2024-2025",
  verification: "draft",
  sourceRef: "مخطط يدوي مقدَّم من المستخدم — بحاجة إلى مطابقة مع اللائحة الرسمية",
  notesAr:
    "لا يُحتسب المعدل التراكمي في نهاية الفصل الأول. تبدأ المتابعة في نهاية الفصل الثاني.",
  cgpaStartsAtSemester: 2,
  goodStandingMin: 2.0,
  specializationDismissalBelow: 1.0,
  maxWarnings: 2,
  upperRecoveryMin: 1.5,
  longRemedialSemesters: 2,
  shortRemedialSemesters: 1,
  shortToLongSemesters: 1,
  exception: {
    minCompletedCredits: 99,
    minCgpa: 1.75,
    extraSemesters: 2,
    descriptionAr: "من أنهى 99 ساعة معتمدة وكان معدله 1.75 فما فوق يُمنح فصلين إضافيين قبل الفصل من الجامعة.",
  },
};

/**
 * Unified Examination & Evaluation System of Syrian Private Universities
 * (نظام الامتحانات والتقويم الموحد للجامعات الخاصة السورية), Articles 5, 13–15, 21–26.
 * Verified against the identical texts published by SPU, AIU, AUST and MAS (Nov 2026).
 */
export const UNIFIED_SY_PRIVATE_POLICY: AcademicPolicy = {
  id: "sy-private-unified-v1",
  version: "1.0.0",
  universityId: "sy-private-unified",
  universityNameAr: "النظام الموحد للجامعات الخاصة السورية",
  academicSystem: "credit-hours-4.0",
  effectiveFrom: "2024-2025",
  verification: "verified",
  sourceRef: "نظام الامتحانات والتقويم الموحد للجامعات الخاصة السورية — المواد 5، 13–15، 21–26 (نصوص منشورة على مواقع الجامعة السورية الخاصة، الجامعة العربية الدولية، الجامعة العربية الخاصة للعلوم والتكنولوجيا، جامعة المعالي)",
  notesAr:
    "يبدأ توجيه الإنذار من الفصل التالي لفصل التسجيل ولا يُحتسب الفصل الصيفي. يُلغى الإنذار برفع المعدل إلى 2.00 خلال فصلين. من لم يرفعه يُفصل من التخصص ويجوز قبوله في الدراسة الخاصة الاستدراكية: معدل ≥ 1.50 → أربعة فصول؛ معدل 1.00–1.49 → فصل واحد للوصول إلى 1.50 ثم ثلاثة فصول. من أنهى 99 ساعة بمعدل ≥ 1.75 يُمنح فصلين إضافيين. أقل من 1.00 بعد الفصل الأول → فصل من التخصص، وتكراره → فصل من الجامعة. العبء الأقصى في الاستدراكية 15 ساعة (6 صيفاً). ملاحظة: نسخة إحدى الجامعات تذكر 1.75 بدل 1.50 كحد للمسار الأطول.",
  articlesAr: [
    "المادة 21: الإنذار الأكاديمي عند نزول المعدل التراكمي عن نقطتين، ويُلغى برفعه إلى نقطتين خلال فصلين كحد أقصى.",
    "المادة 22: الدراسة الخاصة الاستدراكية — أربعة فصول لمن معدله ≥ 1.5؛ فصل واحد لرفع المعدل إلى 1.5 ثم ثلاثة فصول لمن معدله 1–1.49؛ استثناء 99 ساعة ومعدل ≥ 1.75 بفصلين إضافيين؛ العبء 15 ساعة.",
    "المادة 23: الفصل من التخصص عند أقل من نقطة واحدة في أي فصل بعد الأول (عدا الصيفي)، وتكراره يؤدي إلى الفصل من الجامعة.",
    "المادة 24: الطالب الحاصل على تقدير غير مكتمل (I) وهو تحت طائلة الفصل لا يتابع إلا بعد استكمال علاماته.",
    "المادة 26 (د): المعدل المئوي = المعدل النقطي × 20 + 20.",
  ],
  cgpaStartsAtSemester: 2,
  goodStandingMin: 2.0,
  specializationDismissalBelow: 1.0,
  maxWarnings: 2,
  upperRecoveryMin: 1.5,
  longRemedialSemesters: 4,
  shortRemedialSemesters: 1,
  shortToLongSemesters: 3,
  specializationDismissalAllowsTransfer: true,
  remedialMaxCredits: 15,
  exception: {
    minCompletedCredits: 99,
    minCgpa: 1.75,
    extraSemesters: 2,
    descriptionAr: "من أنهى بنجاح 99 ساعة معتمدة وفق خطته ومعدله التراكمي ≥ 1.75 يُمنح فصلين إضافيين كحد أعلى.",
  },
};

export const POLICIES: AcademicPolicy[] = [UNIFIED_SY_PRIVATE_POLICY, DRAFT_SY_PRIVATE_POLICY];

export interface AcademicState {
  status: AcademicStatus;
  /** Warnings received so far (cumulative, not reset) */
  warnings: number;
  /** Remaining semesters in the current remedial/exception track */
  remaining: number;
  /** Whether the exceptional provision has already been used */
  exceptionUsed: boolean;
  /** Number of semesters evaluated so far (1-based index of the last one) */
  semesterIndex: number;
}

export const INITIAL_STATE: AcademicState = {
  status: "not_evaluated",
  warnings: 0,
  remaining: 0,
  exceptionUsed: false,
  semesterIndex: 0,
};

export interface TransitionResult {
  from: AcademicState;
  to: AcademicState;
  cgpa: number | null;
  explanationAr: string;
  /** Whether the step was skipped because CGPA is not computed yet */
  evaluated: boolean;
}

export const STATUS_LABELS_AR: Record<AcademicStatus, string> = {
  not_evaluated: "لم يُحتسب المعدل بعد",
  good: "وضع أكاديمي سليم",
  warning_1: "إنذار أكاديمي أول",
  warning_2: "إنذار أكاديمي ثانٍ (نهائي)",
  remedial_short: "فصل استدراكي (فرصة قصيرة)",
  remedial_long: "فصول استدراكية",
  exception: "استثناء (فصول إضافية)",
  dismissed_specialization: "حالة فصل من التخصص*",
  dismissed_university: "حالة فصل من الجامعة*",
};

export const STATUS_COLORS: Record<AcademicStatus, "gray" | "green" | "yellow" | "orange" | "red"> = {
  not_evaluated: "gray",
  good: "green",
  warning_1: "yellow",
  warning_2: "orange",
  remedial_short: "orange",
  remedial_long: "orange",
  exception: "orange",
  dismissed_specialization: "red",
  dismissed_university: "red",
};

export function riskLevel(state: AcademicState): RiskLevel {
  switch (state.status) {
    case "not_evaluated":
      return "none";
    case "good":
      return "low";
    case "warning_1":
      return "medium";
    case "warning_2":
      return "high";
    case "remedial_short":
    case "remedial_long":
    case "exception":
      return state.remaining <= 1 ? "critical" : "high";
    default:
      return "critical";
  }
}

export function isTerminal(status: AcademicStatus): boolean {
  return status === "dismissed_specialization" || status === "dismissed_university";
}

const f = (n: number) => n.toFixed(2);
/** Arabic phrase for N semesters */
const sems = (n: number) => (n === 1 ? "فصلاً واحداً" : n === 2 ? "فصلين" : `${n} فصول`);

/** Apply one end-of-semester evaluation. `completedCredits` is used for exceptional provisions. */
export function transition(
  state: AcademicState,
  cgpa: number | null,
  policy: AcademicPolicy,
  completedCredits = 0,
): TransitionResult {
  const next: AcademicState = { ...state, semesterIndex: state.semesterIndex + 1 };
  const base = (to: Partial<AcademicState>, explanationAr: string, evaluated = true): TransitionResult => ({
    from: state,
    to: { ...next, ...to },
    cgpa,
    explanationAr,
    evaluated,
  });

  if (state.status === "dismissed_university") {
    return base({}, "الحالة نهائية ضمن هذه السياسة؛ لا تُطبَّق انتقالات إضافية.", false);
  }
  if (state.status === "dismissed_specialization") {
    if (!policy.specializationDismissalAllowsTransfer) return base({}, "الحالة نهائية ضمن هذه السياسة؛ لا تُطبَّق انتقالات إضافية.", false);
    if (cgpa === null || !Number.isFinite(cgpa)) return base({}, "لا يمكن تقييم الوضع الأكاديمي بدون معدل تراكمي.", false);
    // Student continued in another specialization (allowed once).
    if (cgpa < policy.specializationDismissalBelow) {
      return base({ status: "dismissed_university", remaining: 0 }, `تكرر الحصول على أقل من ${f(policy.specializationDismissalBelow)} (${f(cgpa)}) بعد الفصل من التخصص: السياسة تنص على الفصل من الجامعة.*`);
    }
    if (cgpa >= policy.goodStandingMin) return base({ status: "good", remaining: 0 }, `بعد الانتقال إلى تخصص آخر، المعدل ${f(cgpa)} ≥ ${f(policy.goodStandingMin)}: وضع أكاديمي سليم.`);
    return base({ status: "warning_1", warnings: state.warnings + 1 }, `بعد الانتقال إلى تخصص آخر، المعدل ${f(cgpa)} دون ${f(policy.goodStandingMin)}: إنذار أكاديمي.`);
  }
  if (next.semesterIndex < policy.cgpaStartsAtSemester) {
    return base(
      { status: "not_evaluated" },
      `وفق السياسة لا يُحتسب المعدل التراكمي قبل نهاية الفصل ${policy.cgpaStartsAtSemester}.`,
      false,
    );
  }
  if (cgpa === null || !Number.isFinite(cgpa)) {
    return base({}, "لا يمكن تقييم الوضع الأكاديمي بدون معدل تراكمي.", false);
  }

  const G = policy.goodStandingMin;
  const D = policy.specializationDismissalBelow;
  const U = policy.upperRecoveryMin;

  // Universal: reaching good standing clears everything (warnings stay counted in history).
  if (cgpa >= G) {
    const was = state.status;
    const msg =
      was === "good" || was === "not_evaluated"
        ? `المعدل ${f(cgpa)} ≥ ${f(G)}: وضع أكاديمي سليم.`
        : `المعدل ${f(cgpa)} ≥ ${f(G)}: تم رفع الإنذار/انتهاء الفترة الاستدراكية والعودة إلى الوضع السليم.`;
    return base({ status: "good", remaining: 0 }, msg);
  }

  // Universal: below the dismissal threshold → dismissal from specialization.
  if (cgpa < D) {
    return base(
      { status: "dismissed_specialization", remaining: 0 },
      `المعدل ${f(cgpa)} أقل من ${f(D)}: السياسة تنص على الفصل من التخصص. (قرار يحتاج تأكيداً رسمياً)`,
    );
  }

  // Now D ≤ cgpa < G
  switch (state.status) {
    case "not_evaluated":
    case "good": {
      return base(
        { status: "warning_1", warnings: state.warnings + 1 },
        `المعدل ${f(cgpa)} بين ${f(D)} و${f(G)}: إنذار أكاديمي أول.`,
      );
    }
    case "warning_1": {
      if (policy.maxWarnings <= 1) return afterFinalWarning();
      return base(
        { status: "warning_2", warnings: state.warnings + 1 },
        `المعدل ${f(cgpa)} ما زال دون ${f(G)}: إنذار أكاديمي ثانٍ (نهائي).`,
      );
    }
    case "warning_2":
      return afterFinalWarning();
    case "remedial_short": {
      if (cgpa >= U) {
        return base(
          { status: "remedial_long", remaining: policy.shortToLongSemesters },
          `ارتفع المعدل إلى ${f(cgpa)} (≥ ${f(U)}): يُمنح ${sems(policy.shortToLongSemesters)} استدراكياً إضافياً للوصول إلى ${f(G)}.`,
        );
      }
      return base(
        { status: "dismissed_specialization", remaining: 0 },
        `لم يرتفع المعدل إلى ${f(U)} بعد الفصل الاستدراكي (${f(cgpa)}): السياسة تنص على الفصل من التخصص.*`,
      );
    }
    case "remedial_long": {
      if (state.remaining > 1) {
        return base(
          { remaining: state.remaining - 1 },
          `المعدل ${f(cgpa)} ما زال دون ${f(G)}؛ تبقّى ${state.remaining - 1} فصل استدراكي.`,
        );
      }
      return exhaustedTrack();
    }
    case "exception": {
      if (state.remaining > 1) {
        return base(
          { remaining: state.remaining - 1 },
          `المعدل ${f(cgpa)} ما زال دون ${f(G)}؛ تبقّى ${state.remaining - 1} فصل من الاستثناء.`,
        );
      }
      return base(
        { status: "dismissed_university", remaining: 0 },
        `انتهت فصول الاستثناء والمعدل ${f(cgpa)} دون ${f(G)}: السياسة تنص على الفصل من الجامعة.*`,
      );
    }
    default:
      return base({}, "حالة غير معروفة.", false);
  }

  function afterFinalWarning(): TransitionResult {
    if (cgpa! >= U) {
      return base(
        { status: "remedial_long", remaining: policy.longRemedialSemesters },
        `بعد الإنذار النهائي، المعدل ${f(cgpa!)} ≥ ${f(U)}: يُمنح ${sems(policy.longRemedialSemesters)} استدراكية للوصول إلى ${f(G)}.`,
      );
    }
    return base(
      { status: "remedial_short", remaining: policy.shortRemedialSemesters },
      `بعد الإنذار النهائي، المعدل ${f(cgpa!)} بين ${f(D)} و${f(U)}: يُمنح فصل استدراكي واحد ويجب رفع المعدل إلى ${f(U)} على الأقل.`,
    );
  }

  function exhaustedTrack(): TransitionResult {
    const ex = policy.exception;
    if (ex && !state.exceptionUsed && completedCredits >= ex.minCompletedCredits && cgpa! >= ex.minCgpa) {
      return base(
        { status: "exception", remaining: ex.extraSemesters, exceptionUsed: true },
        `انتهت الفصول الاستدراكية، لكن ينطبق الاستثناء (${ex.minCompletedCredits} ساعة ومعدل ≥ ${f(ex.minCgpa)}): يُمنح ${sems(ex.extraSemesters)} إضافية.`,
      );
    }
    return base(
      { status: "dismissed_university", remaining: 0 },
      `انتهت الفصول الاستدراكية والمعدل ${f(cgpa!)} دون ${f(G)}${ex ? ` ولا ينطبق الاستثناء (${ex.minCompletedCredits} ساعة ومعدل ≥ ${f(ex.minCgpa)})` : ""}: السياسة تنص على الفصل من الجامعة.*`,
    );
  }
}

export interface SemesterRecord {
  label: string;
  gpa: number | null;
  gpaHours: number;
  /** Optional: credits earned this semester (defaults to gpaHours) */
  earnedCredits?: number;
}

export interface TimelineEntry {
  record: SemesterRecord;
  cgpa: number | null;
  cumulativeHours: number;
  completedCredits: number;
  transition: TransitionResult;
}

/** Replay a full academic history through the FSM. */
export function evaluateHistory(records: SemesterRecord[], policy: AcademicPolicy): TimelineEntry[] {
  let state = INITIAL_STATE;
  let points = 0;
  let hours = 0;
  let completed = 0;
  const out: TimelineEntry[] = [];
  for (const r of records) {
    if (r.gpa !== null && r.gpaHours > 0) {
      points += r.gpa * r.gpaHours;
      hours += r.gpaHours;
    }
    completed += r.earnedCredits ?? r.gpaHours;
    const cgpa = hours > 0 ? points / hours : null;
    const t = transition(state, cgpa, policy, completed);
    out.push({ record: r, cgpa, cumulativeHours: hours, completedCredits: completed, transition: t });
    state = t.to;
  }
  return out;
}

/**
 * Required CGPA thresholds for the *next* evaluation, given the current state:
 * - safe: CGPA that returns the student to good standing
 * - survive: minimum CGPA that avoids a dismissal state next semester
 */
export function nextThresholds(state: AcademicState, policy: AcademicPolicy, completedCredits = 0) {
  const G = policy.goodStandingMin;
  const D = policy.specializationDismissalBelow;
  const U = policy.upperRecoveryMin;
  let survive: number | null = D;
  let surviveNoteAr = `أي معدل ≥ ${f(D)} يتجنّب الفصل من التخصص في التقييم القادم.`;
  switch (state.status) {
    case "remedial_short":
      survive = U;
      surviveNoteAr = `يجب رفع المعدل إلى ${f(U)} على الأقل وإلا تنص السياسة على الفصل من التخصص.`;
      break;
    case "remedial_long":
      if (state.remaining <= 1) {
        const ex = policy.exception;
        if (ex && !state.exceptionUsed && completedCredits >= ex.minCompletedCredits) {
          survive = ex.minCgpa;
          surviveNoteAr = `هذا آخر فصل استدراكي: معدل ≥ ${f(ex.minCgpa)} يتيح الاستثناء (${ex.minCompletedCredits} ساعة)، وإلا الفصل من الجامعة.`;
        } else {
          survive = G;
          surviveNoteAr = `هذا آخر فصل استدراكي: يجب الوصول إلى ${f(G)} وإلا تنص السياسة على الفصل من الجامعة.`;
        }
      }
      break;
    case "exception":
      if (state.remaining <= 1) {
        survive = G;
        surviveNoteAr = `هذا آخر فصل من الاستثناء: يجب الوصول إلى ${f(G)} وإلا الفصل من الجامعة.`;
      }
      break;
    case "dismissed_specialization":
    case "dismissed_university":
      survive = null;
      surviveNoteAr = "الحالة نهائية ضمن هذه السياسة.";
      break;
  }
  return { safe: G, survive, surviveNoteAr };
}

/** Human-readable description of what the current state means. */
export function describeState(state: AcademicState, policy: AcademicPolicy): string {
  switch (state.status) {
    case "not_evaluated":
      return `لم يُحتسب المعدل التراكمي بعد؛ يبدأ التقييم في نهاية الفصل ${policy.cgpaStartsAtSemester}.`;
    case "good":
      return state.warnings > 0
        ? `وضع سليم حالياً (سبق أن تلقيت ${state.warnings} إنذار). الحفاظ على معدل ≥ ${f(policy.goodStandingMin)} يُبقيك في هذا الوضع.`
        : `وضع أكاديمي سليم. الحفاظ على معدل ≥ ${f(policy.goodStandingMin)} يُبقيك في هذا الوضع.`;
    case "warning_1":
      return `إنذار أول. إذا بقي المعدل دون ${f(policy.goodStandingMin)} في الفصل القادم ستحصل على إنذار ثانٍ، وإذا انخفض دون ${f(policy.specializationDismissalBelow)} تنص السياسة على الفصل من التخصص.`;
    case "warning_2":
      return `إنذار ثانٍ (نهائي). الفصل القادم حاسم: معدل ≥ ${f(policy.goodStandingMin)} يرفع الإنذار، بين ${f(policy.upperRecoveryMin)} و${f(policy.goodStandingMin)} يمنح ${sems(policy.longRemedialSemesters)} استدراكية، بين ${f(policy.specializationDismissalBelow)} و${f(policy.upperRecoveryMin)} ${sems(policy.shortRemedialSemesters)} استدراكياً فقط.`;
    case "remedial_short":
      return `فصل استدراكي واحد. يجب رفع المعدل إلى ${f(policy.upperRecoveryMin)} على الأقل للحصول على فرصة إضافية، أو إلى ${f(policy.goodStandingMin)} لرفع الإنذار نهائياً.`;
    case "remedial_long":
      return `فصول استدراكية (المتبقي: ${state.remaining}). يجب الوصول إلى ${f(policy.goodStandingMin)} قبل انتهائها.`;
    case "exception":
      return `فصول إضافية بموجب الاستثناء (المتبقي: ${state.remaining}). يجب الوصول إلى ${f(policy.goodStandingMin)} قبل انتهائها.`;
    case "dismissed_specialization":
      return policy.specializationDismissalAllowsTransfer
        ? "وفق السياسة تنطبق حالة الفصل من التخصص؛ يجوز الانتقال إلى تخصص آخر مرة واحدة، وتكرار المعدل دون الحد يعني الفصل من الجامعة. تقدير برمجي وليس قراراً رسمياً."
        : "وفق السياسة المهيّأة تنطبق حالة الفصل من التخصص. هذا تقدير برمجي وليس قراراً رسمياً — راجع شؤون الطلاب.";
    case "dismissed_university":
      return "وفق السياسة المهيّأة تنطبق حالة الفصل من الجامعة. هذا تقدير برمجي وليس قراراً رسمياً — راجع شؤون الطلاب.";
  }
}

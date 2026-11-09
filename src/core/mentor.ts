/**
 * Student mentor (المستشار): deterministic insights built from the student's semesters,
 * current courses, plan and the configured policy. No network, no AI — every line is traceable.
 */
import { Course, SemesterResult, combineCgpa } from "./gpa";
import { GradingScale, minBandForPoints } from "./grading";
import { AcademicPolicy, AcademicState, isTerminal, nextThresholds, riskLevel, transition, STATUS_LABELS_AR } from "./rules";
import { courseImpact, requiredSemesterGpa, hoursNeededAtGpa } from "./predictor";
import { GradeComponent, neededForEachLetter, standing } from "./components";
import { PlanProgress, StudyPlan, eligibleCourses, projectGraduation, repeatStrategy, suggestRegistration, summarizePlan, courseLabel, unlockCount } from "./plan";

export type Severity = "critical" | "warning" | "info" | "good" | "todo";

export interface Insight {
  id: string;
  severity: Severity;
  /** Section the insight belongs to */
  section: "status" | "this_semester" | "next_semester" | "graduation" | "data";
  title: string;
  detail: string;
  /** Optional in-app route to act on it */
  action?: { label: string; route: string };
  /** Policy article / rule reference */
  ref?: string;
}

export interface GraduationPath {
  id: "fast" | "balanced" | "safe";
  nameAr: string;
  creditsPerSemester: number;
  assumedGpa: number;
  semesters: number;
  projectedCgpa: number | null;
  risksAr: string[];
}

export interface MentorInput {
  scale: GradingScale;
  policy: AcademicPolicy;
  state: AcademicState;
  previousCgpa: number;
  previousGpaHours: number;
  completedCredits: number;
  semester: SemesterResult; // current semester (entered grades)
  courses: Course[];
  components: Record<string, GradeComponent[]>;
  plan: StudyPlan | null;
  progress: PlanProgress;
  semestersCount: number;
  quickSemesters: number;
  lastBackup: string | null;
}

const f2 = (n: number) => n.toFixed(2);
const SEV_ORDER: Severity[] = ["critical", "warning", "todo", "info", "good"];

export function mentor(input: MentorInput): { insights: Insight[]; paths: GraduationPath[]; headline: Insight | null } {
  const { scale, policy, state, previousCgpa, previousGpaHours, completedCredits, semester, courses, components, plan, progress } = input;
  const out: Insight[] = [];
  const hours = semester.totalCredits;
  const atRisk = state.status !== "good" && state.status !== "not_evaluated";
  const th = nextThresholds(state, policy, completedCredits);
  const projCgpa = semester.gpa === null ? null : combineCgpa(previousCgpa, previousGpaHours, semester.gpa, semester.gpaCredits);
  const predicted = transition(state, projCgpa, policy, completedCredits + semester.earnedCredits);

  /* ---------- 1. Status ---------- */
  if (previousGpaHours === 0 && semester.gpaCredits === 0) {
    out.push({ id: "no-data", severity: "todo", section: "data", title: "ابدأ بإدخال فصولك", detail: "أضف فصولك السابقة في «فصولي» (أو استوردها من كشف العلامات) ليبدأ المستشار بالتحليل.", action: { label: "فتح فصولي", route: "semesters" } });
    return { insights: out, paths: [], headline: out[0] };
  }
  if (isTerminal(state.status)) {
    out.push({ id: "terminal", severity: "critical", section: "status", title: `وفق السياسة: ${STATUS_LABELS_AR[state.status]}`, detail: "هذا تفسير برمجي للائحة وليس قراراً رسمياً. راجع شؤون الطلاب فوراً — قد تتوفر خيارات (انتقال تخصص، دراسة استدراكية) لا يعرفها التطبيق.", ref: "المادة 23" });
  } else if (state.status === "good") {
    out.push({ id: "good", severity: "good", section: "status", title: "وضعك الأكاديمي سليم", detail: `معدلك ${f2(previousCgpa)} ≥ ${f2(policy.goodStandingMin)}. للبقاء هنا يكفي معدل فصلي ≥ ${f2(policy.goodStandingMin)}.` + (state.warnings > 0 ? ` سبق أن تلقيت ${state.warnings} إنذاراً، فلا تعتمد على الهامش.` : "") });
  } else if (state.status !== "not_evaluated") {
    const reqSafe = requiredSemesterGpa({ previousCgpa, previousGpaHours, semesterHours: hours || 15, targetCgpa: th.safe });
    const reqSurvive = th.survive === null ? null : requiredSemesterGpa({ previousCgpa, previousGpaHours, semesterHours: hours || 15, targetCgpa: th.survive });
    const remainingNote = state.remaining > 0 ? ` تبقّى ${state.remaining} فصل في هذه الفرصة.` : "";
    out.push({
      id: "status", severity: riskLevel(state) === "critical" ? "critical" : "warning", section: "status",
      title: `${STATUS_LABELS_AR[state.status]} — معدلك ${f2(previousCgpa)}`,
      detail: (reqSafe !== null && reqSafe <= scale.maxPoints
        ? `للعودة إلى ${f2(th.safe)} تحتاج معدلاً فصلياً ${reqSafe <= 0 ? "عادياً" : f2(reqSafe)} على ${hours || 15} ساعة (أي ${minBandForPoints(Math.max(0, reqSafe), scale)?.letter ?? "—"} في كل مقرر).`
        : `العودة إلى ${f2(th.safe)} غير ممكنة في فصل واحد حتى بعلامات كاملة.`) +
        (reqSurvive !== null && reqSurvive > 0 ? ` ولتجنّب الفصل في التقييم القادم تحتاج ${reqSurvive > scale.maxPoints ? "أعلى من الممكن — تواصل مع المرشد فوراً" : f2(reqSurvive) + " على الأقل"}.` : "") + remainingNote,
      action: { label: "خطة تجنّب الاستنفاذ", route: "exhaustion" }, ref: state.status.startsWith("warning") ? "المادة 21" : "المادة 22",
    });
    if (reqSafe !== null && reqSafe > scale.maxPoints) {
      const h3 = hoursNeededAtGpa(previousCgpa, previousGpaHours, th.safe, 3.0);
      out.push({ id: "multi", severity: "info", section: "status", title: "التعافي يحتاج أكثر من فصل", detail: h3 === null ? `حتى بمعدل 3.00 لا يمكن بلوغ ${f2(th.safe)}؛ يلزم معدل أعلى.` : `بمعدل 3.00 تحتاج ${h3} ساعة (≈ ${Math.ceil(h3 / Math.max(hours || 15, 1))} فصل) لبلوغ ${f2(th.safe)}.`, action: { label: "محاكي ماذا لو", route: "predictor" } });
    }
  }
  if (predicted.evaluated && semester.gpaCredits > 0 && predicted.to.status !== state.status) {
    const worse = SEV_ORDER.indexOf(sevOf(predicted.to)) < SEV_ORDER.indexOf(sevOf(state));
    out.push({ id: "predicted", severity: worse ? "warning" : "good", section: "status", title: `نهاية هذا الفصل: ${STATUS_LABELS_AR[predicted.to.status]}`, detail: `بالعلامات المُدخلة (${semester.gpaCredits} من ${hours} ساعة) يصبح تراكميك ${f2(projCgpa!)}. ${predicted.explanationAr}` });
  }

  /* ---------- 2. This semester ---------- */
  const impacts = courseImpact(courses, previousCgpa, previousGpaHours, scale);
  const failing = semester.courses.filter((r) => r.passed === false);
  for (const r of failing.slice(0, 3)) {
    const needPass = scale.bands.filter((b) => b.pass).sort((a, b) => a.min - b.min)[0];
    out.push({ id: `fail-${r.course.id}`, severity: "warning", section: "this_semester", title: `«${r.course.name || "مقرر"}» راسب بالعلامة المُدخلة`, detail: `رفعه إلى ${needPass.min} (${needPass.letter}) يضيف ${((needPass.points * r.course.credits) / (previousGpaHours + semester.gpaCredits)).toFixed(3)} إلى تراكميك ويوفّر إعادة ${r.course.credits} ساعة.`, action: { label: "علاماتي خلال الفصل", route: "progress" } });
  }
  // borderline courses: within 3 marks below a band boundary
  for (const r of semester.courses) {
    if (r.course.grade.kind !== "mark" || !r.passed) continue;
    const m = r.course.grade.value;
    const next = scale.bands.filter((b) => b.min > m).sort((a, b) => a.min - b.min)[0];
    if (next && next.min - m <= 3) {
      const gain = ((next.points - (r.points ?? 0)) * r.course.credits) / (previousGpaHours + semester.gpaCredits);
      out.push({ id: `border-${r.course.id}`, severity: "info", section: "this_semester", title: `«${r.course.name}»: ${next.min - m} علامة تفصلك عن ${next.letter}`, detail: `من ${m} إلى ${next.min} يرفع تراكميك +${gain.toFixed(3)} — أعلى عائد لكل علامة في جدولك.` });
    }
  }
  // partial grades: needed in final
  for (const c of courses) {
    const comps = components[c.id];
    if (!comps) continue;
    const s = standing(comps);
    if (s.doneWeight === 0 || s.remainingWeight === 0) continue;
    const needed = neededForEachLetter(comps, scale);
    const pass = needed.find((n) => n.letter === scale.bands.filter((b) => b.pass).sort((a, b) => a.min - b.min)[0].letter);
    const target = needed.find((n) => n.targetMark >= 70) ?? pass;
    if (pass && !pass.alreadySecured) {
      out.push({ id: `final-${c.id}`, severity: pass.achievable && (pass.neededPct ?? 0) <= 70 ? "info" : "warning", section: "this_semester", title: `«${c.name}»: تحتاج ${pass.achievable ? pass.neededPct!.toFixed(0) + "%" : "أكثر من 100%"} في المتبقي للنجاح`, detail: `مضمون حتى الآن ${s.securedMark.toFixed(1)} من 100.` + (target && target !== pass && target.achievable ? ` وللحصول على ${target.letter} تحتاج ${target.neededPct!.toFixed(0)}%.` : ""), action: { label: "تفاصيل المكوّنات", route: "progress" } });
    }
  }
  if (impacts.length > 0 && hours > 0) {
    const top = impacts[0];
    out.push({ id: "impact", severity: "info", section: "this_semester", title: `ركّز على «${top.course.name || "المقرر الأثقل"}»`, detail: `${top.course.credits} ساعة — كل حرف فيه يحرّك تراكميك أكثر من أي مقرر آخر هذا الفصل (${((top.course.credits / hours) * 100).toFixed(0)}% من ساعات الفصل).` });
  }

  /* ---------- 3. Next semester ---------- */
  let paths: GraduationPath[] = [];
  if (plan) {
    const summary = summarizePlan(plan, progress, scale);
    const maxLoad = atRisk ? Math.min(policy.remedialMaxCredits ?? 15, 15) : 18;
    const sug = suggestRegistration(plan, progress, { maxCredits: maxLoad, atRisk }, scale);
    if (sug.courses.length > 0) {
      const reasons = sug.courses.slice(0, 6).map((c) => {
        const e = progress[c.code];
        const failed = e?.status === "done" && e.letter === "F";
        const unlocks = unlockCount(plan, c.code);
        return `${c.nameAr ?? c.name} (${c.credits}س)${failed ? " — إعادة راسب" : unlocks ? ` — يفتح ${unlocks} مقرراً` : ""}`;
      });
      out.push({ id: "next", severity: "info", section: "next_semester", title: `الفصل القادم: ${sug.courses.length} مقررات بـ ${sug.credits} ساعة`, detail: reasons.join(" · ") + (atRisk ? ` — حمل مخفّف لأنك في ${STATUS_LABELS_AR[state.status]} (الحد ${maxLoad} ساعة).` : ""), action: { label: "عرض الاقتراح واعتماده", route: "plan" }, ref: atRisk ? "المادة 22 (د)" : undefined });
    }
    const locked = eligibleCourses(plan, progress, scale).filter((e) => !e.eligible && e.missing.length === 1);
    const bottleneck = locked.map((e) => e.missing[0]).reduce<Record<string, number>>((m, code) => ((m[code] = (m[code] ?? 0) + 1), m), {});
    const worst = Object.entries(bottleneck).sort((a, b) => b[1] - a[1])[0];
    if (worst && worst[1] >= 3) {
      const pc = plan.courses.find((c) => c.code === worst[0]);
      out.push({ id: "bottleneck", severity: "warning", section: "next_semester", title: `«${pc ? courseLabel(pc) : worst[0]}» عنق زجاجة`, detail: `${worst[1]} مقررات تنتظر نجاحك فيه. تأخيره فصلاً يؤخر تخرجك فصلاً.`, action: { label: "خريطة الخطة", route: "plan" } });
    }
    const reps = repeatStrategy(plan, progress, "B", scale);
    if (reps.length > 0 && reps[0].gainAtTarget >= 0.03) {
      out.push({ id: "repeat", severity: atRisk ? "warning" : "info", section: "next_semester", title: `أعد «${reps[0].course.nameAr ?? reps[0].course.name}» أولاً`, detail: `من ${reps[0].currentLetter} إلى B يرفع تراكميك +${reps[0].gainAtTarget.toFixed(3)} — أكبر أثر متاح بالإعادة.`, action: { label: "جدول الإعادة", route: "plan" } });
    }

    /* ---------- 4. Graduation paths ---------- */
    const mk = (id: GraduationPath["id"], nameAr: string, load: number, gpa: number, risksAr: string[]): GraduationPath => {
      const g = projectGraduation(summary, gpa, load, undefined, scale);
      return { id, nameAr, creditsPerSemester: load, assumedGpa: gpa, semesters: g.semestersNeeded, projectedCgpa: g.projectedCgpa, risksAr };
    };
    const recent = semester.gpa ?? previousCgpa;
    paths = [
      mk("fast", "الأسرع", 18, Math.min(scale.maxPoints, recent + 0.25), ["حمل كامل كل فصل", atRisk ? "غير متاح في الاستدراكية (الحد 15)" : "يتطلب نجاح كل المقررات", "متطلبات متسلسلة قد تمنعه"]),
      mk("balanced", "المتوازن", 15, recent, ["يفترض أداءً مماثلاً لأدائك الحالي"]),
      mk("safe", "المحافظ", 12, Math.min(scale.maxPoints, recent + 0.5), ["فصلان إضافيان تقريباً", "الأنسب لرفع المعدل أولاً"]),
    ];
    const bal = paths[1];
    out.push({ id: "grad", severity: "info", section: "graduation", title: `التخرج بعد ≈ ${bal.semesters} فصل بمعدل ${bal.projectedCgpa === null ? "—" : f2(bal.projectedCgpa)}`, detail: `${summary.remainingCredits} ساعة متبقية من ${summary.totalCredits}. المسار الأسرع: ${paths[0].semesters} فصل، المحافظ: ${paths[2].semesters} فصل.`, action: { label: "محاكي التخرج", route: "plan" } });
    if (summary.remainingCredits > 0 && summary.cgpaFromPlan !== null && summary.cgpaFromPlan < policy.goodStandingMin) {
      const g = projectGraduation(summary, 0, 15, policy.goodStandingMin, scale);
      if (g.gpaNeededForTarget !== null) out.push({ id: "grad-min", severity: "warning", section: "graduation", title: `للتخرج بمعدل ≥ ${f2(policy.goodStandingMin)}`, detail: `تحتاج معدلاً فصلياً ≥ ${f2(g.gpaNeededForTarget)} في كل الساعات المتبقية.` });
    }
  } else {
    out.push({ id: "no-plan", severity: "todo", section: "next_semester", title: "اختر خطتك الدراسية", detail: "بدون خطة لا يستطيع المستشار اقتراح مقررات الفصل القادم أو حساب موعد التخرج.", action: { label: "اختيار الخطة", route: "plan" } });
  }

  /* ---------- 5. Data quality ---------- */
  if (semester.missingGrades > 0) out.push({ id: "missing", severity: "todo", section: "data", title: `${semester.missingGrades} مقرر بلا علامة`, detail: "أدخل العلامة المتوقعة أو الجزئية ليدخل في التوقعات.", action: { label: "فصولي", route: "semesters" } });
  if (input.quickSemesters > 0 && plan) out.push({ id: "quick", severity: "todo", section: "data", title: `${input.quickSemesters} فصل مُدخل بالمعدل فقط`, detail: "تفصيلها بالمقررات يجعل حالة الخطة واقتراح التسجيل أدق.", action: { label: "فصولي", route: "semesters" } });
  if (plan && plan.verification !== "verified") out.push({ id: "plan-draft", severity: "todo", section: "data", title: "خطتك مسودة", detail: "بعض المتطلبات السابقة مستنتجة؛ انقر على أي متطلب في الخطة لتصحيحه.", action: { label: "الخطة", route: "plan" } });
  if (!input.lastBackup && input.semestersCount > 0) out.push({ id: "backup", severity: "todo", section: "data", title: "لا نسخة احتياطية", detail: "بياناتك على هذا الجهاز فقط — احفظ نسخة من الإعدادات أو زر 💾.", action: { label: "حفظ نسخة", route: "settings" } });

  out.sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity));
  const headline = out.find((i) => i.section === "status") ?? out[0] ?? null;
  return { insights: out, paths, headline };
}

function sevOf(s: AcademicState): Severity {
  const r = riskLevel(s);
  return r === "critical" ? "critical" : r === "high" || r === "medium" ? "warning" : r === "low" ? "good" : "info";
}

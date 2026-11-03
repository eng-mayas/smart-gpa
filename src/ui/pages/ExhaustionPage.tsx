import React, { useMemo, useState } from "react";
import { useAcademic } from "../../state/useAcademic";
import { BUILTIN_PLANS } from "../../core/plan";
import { Field, NumberInput, StatusBadge, RiskBadge, BarChart } from "../components/common";
import { fmtGpa } from "../../core/format";
import { courseImpact, minimumGradesForTarget, requiredSemesterGpa, runScenario, standardScenarios, hoursNeededAtGpa } from "../../core/predictor";
import { AcademicState, AcademicStatus, INITIAL_STATE, isTerminal, nextThresholds, transition } from "../../core/rules";
import { CourseTable } from "../components/CourseTable";

const STATUS_OPTIONS: { value: AcademicStatus; label: string }[] = [
  { value: "good", label: "وضع سليم (لا إنذار)" },
  { value: "warning_1", label: "إنذار أول" },
  { value: "warning_2", label: "إنذار ثانٍ (نهائي)" },
  { value: "remedial_short", label: "فصل استدراكي (قصير)" },
  { value: "remedial_long", label: "فصول استدراكية" },
  { value: "exception", label: "استثناء (فصول إضافية)" },
];

export function ExhaustionPage() {
  const { state, dispatch, scale, semester, policy, currentState } = useAcademic();
  const activePlan = state.planId === "custom" ? state.customPlan : BUILTIN_PLANS.find((p) => p.id === state.planId) ?? null;
  const p = state.profile;
  const setP = (patch: Partial<typeof p>) => dispatch({ type: "profile", patch });

  const [status, setStatus] = useState<AcademicStatus>(isTerminal(currentState.status) ? "warning_2" : currentState.status === "not_evaluated" ? "good" : currentState.status);
  const [remaining, setRemaining] = useState<number | "">(currentState.remaining || 1);
  const [exceptionUsed, setExceptionUsed] = useState(currentState.exceptionUsed);

  const st: AcademicState = useMemo(() => ({
    ...INITIAL_STATE,
    status,
    warnings: status === "good" ? p.previousWarnings : Math.max(p.previousWarnings, status === "warning_1" ? 1 : 2),
    remaining: remaining === "" ? 1 : remaining,
    exceptionUsed,
    semesterIndex: Math.max(2, Math.round(p.previousGpaHours / 15)),
  }), [status, remaining, exceptionUsed, p.previousWarnings, p.previousGpaHours]);

  const hours = semester.totalCredits;
  const projectedCredits = p.completedCredits + hours;
  const th = nextThresholds(st, policy, projectedCredits);
  const reqSurvive = th.survive === null ? null : requiredSemesterGpa({ previousCgpa: p.previousCgpa, previousGpaHours: p.previousGpaHours, semesterHours: hours, targetCgpa: th.survive });
  const reqSafe = requiredSemesterGpa({ previousCgpa: p.previousCgpa, previousGpaHours: p.previousGpaHours, semesterHours: hours, targetCgpa: th.safe });
  const minSurvive = th.survive === null ? null : minimumGradesForTarget(state.courses, p.previousCgpa, p.previousGpaHours, th.survive, scale);
  const minSafe = minimumGradesForTarget(state.courses, p.previousCgpa, p.previousGpaHours, th.safe, scale);
  const impacts = courseImpact(state.courses, p.previousCgpa, p.previousGpaHours, scale);
  const scenarios = standardScenarios(state.courses, scale).map((s) => runScenario(s, p.previousCgpa, p.previousGpaHours, scale));
  const hoursToSafeAt3 = hoursNeededAtGpa(p.previousCgpa, p.previousGpaHours, th.safe, 3.0);
  const hoursToSafeAtMax = hoursNeededAtGpa(p.previousCgpa, p.previousGpaHours, th.safe, scale.maxPoints);
  const enough = hours > 0 && p.previousGpaHours > 0;

  const reqLevel = (v: number | null) => v === null ? "gray" : v <= 0 ? "green" : v <= 2.5 ? "green" : v <= 3.25 ? "yellow" : v <= scale.maxPoints ? "orange" : "red";

  return (
    <>
      <div className="topbar">
        <div>
          <h1>كيف أتجنب الاستنفاذ؟</h1>
          <p className="muted">أدخل وضعك الحالي ومقررات الفصل المسجّل، ويحسب التطبيق الحد الأدنى المطلوب لتجنّب الفصل وفق السياسة المهيّأة.</p>
        </div>
      </div>

      <div className="grid grid-3 mb">
        <div className="card">
          <h3>وضعك الحالي</h3>
          <div className="stack">
            <Field label="المعدل التراكمي الحالي"><NumberInput value={p.previousCgpa} min={0} max={scale.maxPoints} step={0.01} onChange={(v) => setP({ previousCgpa: v === "" ? 0 : v })} /></Field>
            <Field label="الساعات المحسوبة في المعدل"><NumberInput value={p.previousGpaHours} min={0} max={300} onChange={(v) => setP({ previousGpaHours: v === "" ? 0 : v })} /></Field>
            <Field label="الساعات المنجزة (المكتسبة)"><NumberInput value={p.completedCredits} min={0} max={300} onChange={(v) => setP({ completedCredits: v === "" ? 0 : v })} /></Field>
          </div>
        </div>
        <div className="card">
          <h3>حالة الإنذار</h3>
          <div className="stack">
            <Field label="الحالة الأكاديمية الحالية">
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value as AcademicStatus)}>
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="عدد الإنذارات السابقة"><NumberInput value={p.previousWarnings} min={0} max={5} onChange={(v) => setP({ previousWarnings: v === "" ? 0 : v })} /></Field>
            {(status === "remedial_long" || status === "exception" || status === "remedial_short") && (
              <Field label="الفصول المتبقية في الفرصة الحالية"><NumberInput value={remaining} min={1} max={4} onChange={setRemaining} /></Field>
            )}
            <label className="row tiny"><input type="checkbox" checked={exceptionUsed} onChange={(e) => setExceptionUsed(e.target.checked)} /> استُخدم الاستثناء سابقاً</label>
          </div>
        </div>
        <div className="card">
          <h3>خطة الدراسة</h3>
          <div className="stack">
            <Field label="المقررات المتبقية في الخطة"><NumberInput value={p.remainingCourses} min={0} max={100} onChange={(v) => setP({ remainingCourses: v === "" ? 0 : v })} /></Field>
            <Field label="الساعات المسجّلة هذا الفصل (من الجدول أدناه)"><input className="input num" value={hours} readOnly /></Field>
            <div className="row"><StatusBadge status={st.status} /><RiskBadge state={st} /></div>
          </div>
        </div>
      </div>

      {!enough && <div className="alert warn mb">⚠ البيانات غير كافية: أدخل معدلك وساعاتك السابقة وأضف مقررات الفصل المسجّل لإجراء التحليل.</div>}

      <div className="grid grid-2 mb">
        <div className="card" style={{ borderInlineStart: `5px solid var(--${reqLevel(reqSurvive) === "gray" ? "gray" : reqLevel(reqSurvive)})` }}>
          <h3>1) الحد الأدنى لتجنّب الفصل في التقييم القادم</h3>
          {th.survive === null ? <p className="muted">{th.surviveNoteAr}</p> : (
            <>
              <p className="muted">{th.surviveNoteAr}</p>
              <p>المعدل التراكمي المطلوب: <b className="num">{fmtGpa(th.survive)}</b> ← المعدل الفصلي المطلوب: <b className="num" style={{ fontSize: "1.3rem" }}>{reqSurvive === null ? "—" : reqSurvive <= 0 ? "أي معدل" : fmtGpa(reqSurvive, 3)}</b></p>
              {reqSurvive !== null && reqSurvive > scale.maxPoints && <div className="alert danger">❌ غير ممكن في هذا الفصل حتى بعلامات كاملة. انظر البدائل أدناه.</div>}
              {minSurvive?.feasible && minSurvive.uniform && reqSurvive !== null && reqSurvive > 0 && <p>أي <b>{minSurvive.uniform}</b> على الأقل في كل المقررات (أو التوزيع في الجدول أدناه).</p>}
            </>
          )}
        </div>
        <div className="card" style={{ borderInlineStart: `5px solid var(--${reqLevel(reqSafe)})` }}>
          <h3>2) المطلوب للعودة إلى الوضع السليم</h3>
          <p>المعدل التراكمي المطلوب: <b className="num">{fmtGpa(th.safe)}</b> ← المعدل الفصلي المطلوب: <b className="num" style={{ fontSize: "1.3rem" }}>{reqSafe === null ? "—" : reqSafe <= 0 ? "أي معدل" : fmtGpa(reqSafe, 3)}</b></p>
          {reqSafe !== null && reqSafe > scale.maxPoints ? (
            <div className="alert warn">
              <div>
                لا يمكن العودة إلى {fmtGpa(th.safe)} في فصل واحد. تحتاج إلى فصول إضافية:
                <ul style={{ margin: "0.2rem 0 0", paddingInlineStart: "1.2rem" }}>
                  <li>بعلامات كاملة ({scale.maxPoints.toFixed(2)}): {hoursToSafeAtMax === null ? "غير ممكن" : `${hoursToSafeAtMax} ساعة (≈ ${Math.ceil(hoursToSafeAtMax / Math.max(hours, 1))} فصل)`}</li>
                  <li>بمعدل 3.00: {hoursToSafeAt3 === null ? "غير ممكن" : `${hoursToSafeAt3} ساعة (≈ ${Math.ceil(hoursToSafeAt3 / Math.max(hours, 1))} فصل)`}</li>
                </ul>
              </div>
            </div>
          ) : minSafe.feasible && minSafe.uniform && reqSafe !== null && reqSafe > 0 ? (
            <p>أي <b>{minSafe.uniform}</b> على الأقل في كل المقررات. التعافي ممكن في فصل واحد ✅</p>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>مقررات الفصل المسجّل والعلامات المتوقعة</h2></div>
        <CourseTable courses={state.courses} onChange={(c) => dispatch({ type: "courses", courses: c })} result={semester} scale={scale} planCourses={activePlan?.courses} showWeighted={false} />
      </div>

      <div className="grid grid-2 mt">
        <div className="card">
          <h3>3) المقررات الأكثر تأثيراً في المعدل التراكمي</h3>
          <p className="tiny">الأثر = أقصى تغيّر يمكن أن يُحدثه المقرر وحده في المعدل التراكمي (من F إلى {scale.maxPoints}).</p>
          <BarChart data={impacts.slice(0, 8).map((i) => ({ label: (i.course.name || "مقرر").slice(0, 10), value: Number(i.impact.toFixed(3)) }))} />
        </div>
        <div className="card">
          <h3>أدنى علامات مطلوبة في كل مقرر</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>المقرر</th><th className="c">ساعات</th><th className="c">لتجنّب الفصل</th><th className="c">للوضع السليم</th></tr></thead>
              <tbody>
                {state.courses.filter((c) => c.status !== "withdrawn" && c.status !== "excluded" && c.status !== "passfail").map((c) => (
                  <tr key={c.id}>
                    <td>{c.name || "مقرر"}</td>
                    <td className="c num">{c.credits}</td>
                    <td className="c grade-cell">{reqSurvive !== null && reqSurvive <= 0 ? "D" : minSurvive?.feasible ? minSurvive.perCourse?.find((x) => x.course.id === c.id)?.letter : "✗"}</td>
                    <td className="c grade-cell">{reqSafe !== null && reqSafe <= 0 ? "D" : minSafe.feasible ? minSafe.perCourse?.find((x) => x.course.id === c.id)?.letter : "✗"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny">✗ = غير ممكن في هذا الفصل. "D" = يكفي النجاح فقط.</p>
        </div>
      </div>

      <div className="card mt">
        <h2>4–7) مقارنة السيناريوهات والوضع الأكاديمي التالي</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>السيناريو</th><th className="c">المعدل الفصلي</th><th className="c">التراكمي المتوقع</th><th className="c">الوضع التالي</th><th>ملاحظة</th></tr></thead>
            <tbody>
              {scenarios.map((o) => {
                const t = transition(st, o.newCgpa, policy, projectedCredits);
                const safe = o.newCgpa !== null && o.newCgpa >= th.safe;
                const survive = th.survive !== null && o.newCgpa !== null && o.newCgpa >= th.survive;
                return (
                  <tr key={o.scenario.id}>
                    <td>{o.scenario.nameAr}<div className="tiny">{o.scenario.descriptionAr}</div></td>
                    <td className="c num">{fmtGpa(o.semester.gpa)}</td>
                    <td className="c num" style={{ fontWeight: 700, color: safe ? "var(--green)" : survive ? "var(--orange)" : "var(--red)" }}>{fmtGpa(o.newCgpa)}</td>
                    <td className="c">{t.evaluated ? <StatusBadge status={t.to.status} /> : "—"}</td>
                    <td className="tiny">{t.evaluated ? t.explanationAr : "بيانات غير كافية"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="tiny mt">* حالات الفصل هي تفسير برمجي للسياسة المهيّأة ({policy.verification === "verified" ? "موثّقة" : "مسودة غير موثّقة"}) وليست قراراً رسمياً. راجع شؤون الطلاب في جامعتك.</p>
      </div>
    </>
  );
}

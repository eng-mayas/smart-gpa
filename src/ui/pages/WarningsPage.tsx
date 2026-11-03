import React from "react";
import { useAcademic } from "../../state/useAcademic";
import { StatusBadge, RiskBadge, Stat, RISK_LABEL, COLOR_VAR, STATUS_HELP_AR } from "../components/common";
import { fmtGpa } from "../../core/format";
import { AcademicStatus, describeState, nextThresholds, riskLevel, STATUS_COLORS, STATUS_LABELS_AR, transition } from "../../core/rules";
import { requiredSemesterGpa } from "../../core/predictor";

export function WarningsPage() {
  const { state, scale, policy, currentState, predicted, cumulative, semester, projectedCredits, timeline } = useAcademic();
  const p = state.profile;
  const th = nextThresholds(currentState, policy, p.completedCredits);
  const hours = semester.totalCredits;
  const reqSafe = requiredSemesterGpa({ previousCgpa: p.previousCgpa, previousGpaHours: p.previousGpaHours, semesterHours: hours, targetCgpa: th.safe });
  const reqSurvive = th.survive === null ? null : requiredSemesterGpa({ previousCgpa: p.previousCgpa, previousGpaHours: p.previousGpaHours, semesterHours: hours, targetCgpa: th.survive });

  // What happens if the student fails 1..3 courses (others unchanged)?
  const failImpacts = [1, 2, 3].map((k) => {
    const sorted = [...state.courses].filter((c) => c.status === "normal" || c.status === "repeat").sort((a, b) => b.credits - a.credits);
    const failed = new Set(sorted.slice(0, k).map((c) => c.id));
    let w = 0, h = 0;
    for (const r of semester.courses) {
      if (!r.countsInGpa || r.weighted === undefined) continue;
      h += r.course.credits;
      w += failed.has(r.course.id) ? 0 : r.weighted;
    }
    const semGpa = h > 0 ? w / h : null;
    const cg = semGpa === null ? null : (p.previousCgpa * p.previousGpaHours + w) / (p.previousGpaHours + h);
    return { k, semGpa, cg, t: transition(currentState, cg, policy, projectedCredits) };
  });

  const color = COLOR_VAR[STATUS_COLORS[currentState.status]];

  return (
    <>
      <div className="topbar">
        <div>
          <h1>الإنذارات الأكاديمية</h1>
          <p className="muted">الحالة المؤكدة (من السجل) مقابل الخطر المتوقع (من علامات الفصل الحالي).</p>
        </div>
      </div>

      <div className="grid grid-2 mb">
        <div className="card" style={{ borderTop: `5px solid ${color}` }}>
          <div className="card-head"><h2>الحالة الحالية (مؤكدة)</h2><span className="badge gray">{timeline.length > 0 ? "من السجل الأكاديمي" : "من الملف الشخصي"}</span></div>
          <div className="row mb"><StatusBadge status={currentState.status} lg /><RiskBadge state={currentState} /></div>
          <p>{describeState(currentState, policy)}</p>
          <div className="grid grid-3 mt">
            <Stat label="الإنذارات" value={currentState.warnings} sub={`الحد: ${policy.maxWarnings}`} accent={currentState.warnings === 0 ? "var(--green)" : currentState.warnings === 1 ? "var(--yellow)" : "var(--orange)"} />
            <Stat label="المعدل التراكمي" value={fmtGpa(p.previousCgpa)} sub={`${p.previousGpaHours} ساعة`} accent={p.previousCgpa >= policy.goodStandingMin ? "var(--green)" : "var(--orange)"} />
            <Stat label="مستوى الخطر" value={RISK_LABEL[riskLevel(currentState)]} accent={color} />
          </div>
        </div>
        <div className="card" style={{ borderTop: `5px solid ${predicted.evaluated ? COLOR_VAR[STATUS_COLORS[predicted.to.status]] : "var(--gray)"}` }}>
          <div className="card-head"><h2>الخطر المتوقع نهاية هذا الفصل</h2><span className="badge gray">توقع</span></div>
          {predicted.evaluated ? (
            <>
              <div className="row mb"><StatusBadge status={predicted.to.status} lg /><RiskBadge state={predicted.to} /></div>
              <p>{predicted.explanationAr}</p>
              <p className="tiny">المعدل التراكمي المتوقع: <b className="num">{fmtGpa(cumulative.newCgpa, 3)}</b> بناءً على {semester.gpaCredits} ساعة مُدخلة من {hours}.</p>
            </>
          ) : (
            <div className="alert info">{predicted.explanationAr} أدخل علامات الفصل الحالي في صفحة المعدل التراكمي.</div>
          )}
        </div>
      </div>

      <div className="grid grid-2 mb">
        <div className="card">
          <h3>ما المطلوب في هذا الفصل؟</h3>
          <div className="table-wrap">
            <table>
              <tbody>
                <tr><td>المعدل التراكمي للعودة إلى الوضع السليم</td><td className="c num"><b>{fmtGpa(th.safe)}</b></td><td className="c tiny">فصلي مطلوب: <b className="num">{reqSafe === null ? "—" : reqSafe <= 0 ? "أي" : reqSafe > scale.maxPoints ? "غير ممكن" : fmtGpa(reqSafe, 3)}</b></td></tr>
                <tr><td>المعدل التراكمي لتجنّب الفصل</td><td className="c num"><b>{fmtGpa(th.survive)}</b></td><td className="c tiny">فصلي مطلوب: <b className="num">{reqSurvive === null ? "—" : reqSurvive <= 0 ? "أي" : reqSurvive > scale.maxPoints ? "غير ممكن" : fmtGpa(reqSurvive, 3)}</b></td></tr>
                <tr><td>الفرص المتاحة</td><td colSpan={2} className="tiny">
                  {currentState.status === "good" && `إنذار يجب إلغاؤه خلال ${policy.maxWarnings} فصل، ثم دراسة استدراكية (${policy.longRemedialSemesters} فصول لمن معدله ≥ ${policy.upperRecoveryMin.toFixed(2)}، أو ${policy.shortRemedialSemesters}+${policy.shortToLongSemesters} لمن هو دونه)، ثم استثناء ${policy.exception ? `(${policy.exception.extraSemesters} فصل)` : "لا يوجد"}.`}
                  {currentState.status === "warning_1" && `إنذار واحد متبقٍ قبل المرحلة الاستدراكية.`}
                  {currentState.status === "warning_2" && `لا إنذارات متبقية؛ الفصل القادم يحدد المسار الاستدراكي.`}
                  {(currentState.status === "remedial_long" || currentState.status === "remedial_short" || currentState.status === "exception") && `${currentState.remaining} فصل متبقٍ في الفرصة الحالية.`}
                  {policy.exception && !currentState.exceptionUsed && currentState.status !== "good" && ` الاستثناء: ${policy.exception.descriptionAr}`}
                </td></tr>
              </tbody>
            </table>
          </div>
          <p className="tiny">{th.surviveNoteAr}</p>
        </div>
        <div className="card">
          <h3>ماذا لو رسبت في مقرر أو أكثر؟</h3>
          <p className="tiny">يفترض الرسوب في المقررات ذات الساعات الأعلى أولاً مع بقاء باقي العلامات المُدخلة كما هي.</p>
          <div className="table-wrap">
            <table>
              <thead><tr><th className="c">مقررات راسبة</th><th className="c">فصلي</th><th className="c">تراكمي</th><th className="c">الوضع</th></tr></thead>
              <tbody>
                {failImpacts.map((f) => (
                  <tr key={f.k}>
                    <td className="c">{f.k}</td>
                    <td className="c num">{fmtGpa(f.semGpa)}</td>
                    <td className="c num">{fmtGpa(f.cg)}</td>
                    <td className="c">{f.t.evaluated ? <StatusBadge status={f.t.to.status} /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>مسار الحالات وفق السياسة المهيّأة</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>من</th><th className="c">≥ {fmtGpa(policy.goodStandingMin)}</th><th className="c">{fmtGpa(policy.upperRecoveryMin)} – {fmtGpa(policy.goodStandingMin)}</th><th className="c">{fmtGpa(policy.specializationDismissalBelow)} – {fmtGpa(policy.upperRecoveryMin)}</th><th className="c">&lt; {fmtGpa(policy.specializationDismissalBelow)}</th></tr></thead>
            <tbody>
              <tr><td>وضع سليم</td><td className="c"><StatusBadge status="good" /></td><td className="c" colSpan={2}><StatusBadge status="warning_1" /></td><td className="c"><StatusBadge status="dismissed_specialization" /></td></tr>
              <tr><td>إنذار أول</td><td className="c"><StatusBadge status="good" /></td><td className="c" colSpan={2}><StatusBadge status="warning_2" /></td><td className="c"><StatusBadge status="dismissed_specialization" /></td></tr>
              <tr><td>إنذار ثانٍ</td><td className="c"><StatusBadge status="good" /></td><td className="c"><StatusBadge status="remedial_long" /> ({policy.longRemedialSemesters})</td><td className="c"><StatusBadge status="remedial_short" /> ({policy.shortRemedialSemesters})</td><td className="c"><StatusBadge status="dismissed_specialization" /></td></tr>
              <tr><td>فصل استدراكي قصير</td><td className="c"><StatusBadge status="good" /></td><td className="c"><StatusBadge status="remedial_long" /> ({policy.shortToLongSemesters})</td><td className="c"><StatusBadge status="dismissed_specialization" /></td><td className="c"><StatusBadge status="dismissed_specialization" /></td></tr>
              <tr><td>آخر فصل استدراكي</td><td className="c"><StatusBadge status="good" /></td><td className="c" colSpan={2}>{policy.exception ? <>استثناء إن توفرت شروطه، وإلا <StatusBadge status="dismissed_university" /></> : <StatusBadge status="dismissed_university" />}</td><td className="c"><StatusBadge status="dismissed_specialization" /></td></tr>
            </tbody>
          </table>
        </div>
        <p className="tiny mt">* الحالات المعلَّمة بنجمة هي تفسير برمجي للسياسة وليست قراراً رسمياً.</p>
      </div>
      <div className="card mt">
        <h3>ماذا تعني هذه المصطلحات؟</h3>
        <div className="table-wrap">
          <table>
            <tbody>
              {(Object.keys(STATUS_HELP_AR) as AcademicStatus[]).map((s) => (
                <tr key={s}><td style={{ width: 220 }}><StatusBadge status={s} /></td><td className="tiny">{STATUS_HELP_AR[s]}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

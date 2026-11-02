import React from "react";
import { useAcademic } from "../../state/useAcademic";
import { CourseTable } from "../components/CourseTable";
import { Field, Gauge, NumberInput, Stat, StatusBadge, RiskBadge } from "../components/common";
import { fmtDelta, fmtGpa } from "../../core/format";

export function CumulativePage() {
  const { state, dispatch, scale, semester, cumulative, predicted, policy } = useAcademic();
  const p = state.profile;
  const setP = (patch: Partial<typeof p>) => dispatch({ type: "profile", patch });
  const ready = p.previousGpaHours > 0 || semester.gpaCredits > 0;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>حساب المعدل التراكمي</h1>
          <p className="muted">أدخل معدلك التراكمي السابق وساعاته، ثم مقررات الفصل الحالي لمعرفة المعدل الجديد.</p>
        </div>
      </div>

      <div className="grid grid-3 mb">
        <div className="card">
          <h3>البيانات السابقة</h3>
          <div className="stack">
            <Field label="المعدل التراكمي السابق">
              <NumberInput value={p.previousCgpa} min={0} max={scale.maxPoints} step={0.01} onChange={(v) => setP({ previousCgpa: v === "" ? 0 : v })} />
            </Field>
            <Field label="الساعات المحسوبة في المعدل سابقاً" hint="الساعات التي دخلت في حساب المعدل التراكمي (دون المنسحب/المستثنى)">
              <NumberInput value={p.previousGpaHours} min={0} max={300} onChange={(v) => setP({ previousGpaHours: v === "" ? 0 : v })} />
            </Field>
          </div>
        </div>
        <div className="card row" style={{ justifyContent: "space-around" }}>
          <Gauge value={p.previousGpaHours > 0 ? p.previousCgpa : null} max={scale.maxPoints} label="السابق" color="var(--gray)" />
          <span style={{ fontSize: "2rem", color: "var(--text-3)" }}>←</span>
          <Gauge value={ready ? cumulative.newCgpa : null} max={scale.maxPoints} label="الجديد" />
        </div>
        <div className="stack">
          <Stat label="المعدل الفصلي الحالي" value={fmtGpa(cumulative.semesterGpa)} sub={`${cumulative.semesterGpaHours} ساعة`} accent="var(--teal)" />
          <Stat label="التغيّر في المعدل" value={fmtDelta(cumulative.delta)} sub={cumulative.delta === null ? "—" : cumulative.delta >= 0 ? "ارتفاع" : "انخفاض"} accent={cumulative.delta === null ? "var(--gray)" : cumulative.delta >= 0 ? "var(--green)" : "var(--red)"} />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>مقررات الفصل الحالي</h2>
          <span className="tiny">اختر حالة «إعادة» للمقررات المعادة وأدخل نقاط المحاولة السابقة ليُستبدل أثرها.</span>
        </div>
        <CourseTable courses={state.courses} onChange={(c) => dispatch({ type: "courses", courses: c })} result={semester} scale={scale} />
      </div>

      <div className="grid grid-2 mt">
        <div className="card">
          <h3>تفصيل الحساب</h3>
          <div className="table-wrap">
            <table>
              <tbody>
                <tr><td>نقاط سابقة (المعدل × الساعات)</td><td className="c num">{fmtGpa(p.previousCgpa * p.previousGpaHours)}</td></tr>
                <tr><td>+ نقاط الفصل الحالي</td><td className="c num">{fmtGpa(semester.totalWeighted)}</td></tr>
                {cumulative.replacedHours > 0 && (
                  <tr><td>− نقاط المحاولات المستبدلة ({cumulative.replacedHours} ساعة)</td><td className="c num">{fmtGpa(cumulative.replacedPoints)}</td></tr>
                )}
                <tr><td>÷ إجمالي الساعات</td><td className="c num">{cumulative.totalGpaHours}</td></tr>
                <tr><td><b>المعدل التراكمي الجديد</b></td><td className="c num"><b>{fmtGpa(cumulative.newCgpa, 3)}</b></td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h3>الوضع الأكاديمي المتوقع</h3>
          {predicted.evaluated ? (
            <>
              <div className="row mb"><StatusBadge status={predicted.to.status} lg /><RiskBadge state={predicted.to} /></div>
              <p className="muted">{predicted.explanationAr}</p>
              <p className="tiny">وفق سياسة: {policy.universityNameAr} (إصدار {policy.version} — {policy.verification === "verified" ? "موثّقة" : "مسودة غير موثّقة"}). هذا توقع وليس قراراً رسمياً.</p>
            </>
          ) : (
            <p className="muted">{predicted.explanationAr}</p>
          )}
        </div>
      </div>
    </>
  );
}

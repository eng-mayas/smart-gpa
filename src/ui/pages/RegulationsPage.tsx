import React, { useState } from "react";
import { useAcademic } from "../../state/useAcademic";
import { POLICIES, AcademicPolicy } from "../../core/rules";
import { SCALES } from "../../core/grading";
import { fmtGpa } from "../../core/format";

export function RegulationsPage() {
  const { state, dispatch, policy, scale } = useAcademic();
  const [showJson, setShowJson] = useState(false);
  const rows: [string, React.ReactNode][] = [
    ["معرّف السياسة / الإصدار", `${policy.id} / v${policy.version}`],
    ["الجامعة", policy.universityNameAr],
    ["النظام الأكاديمي", policy.academicSystem],
    ["سارية من العام", policy.effectiveFrom],
    ["حالة التحقق", policy.verification === "verified" ? <span className="badge green">موثّقة</span> : <span className="badge yellow">مسودة — بحاجة إلى تحقق</span>],
    ["المصدر / المرجع", policy.sourceRef],
    ["بداية احتساب المعدل التراكمي", `نهاية الفصل ${policy.cgpaStartsAtSemester}`],
    ["حد الوضع السليم", `≥ ${fmtGpa(policy.goodStandingMin)}`],
    ["حد الفصل من التخصص", `< ${fmtGpa(policy.specializationDismissalBelow)}`],
    ["عدد الإنذارات قبل المرحلة الاستدراكية", policy.maxWarnings],
    ["حد المسار الاستدراكي الطويل", `≥ ${fmtGpa(policy.upperRecoveryMin)} → ${policy.longRemedialSemesters} فصل`],
    ["المسار الاستدراكي القصير", `${fmtGpa(policy.specializationDismissalBelow)} – ${fmtGpa(policy.upperRecoveryMin)} → ${policy.shortRemedialSemesters} فصل، ثم ${policy.shortToLongSemesters} فصل إضافي إن ارتفع المعدل إلى ${fmtGpa(policy.upperRecoveryMin)}`],
    ["الاستثناء", policy.exception ? policy.exception.descriptionAr : "لا يوجد"],
    ["الانتقال بعد الفصل من التخصص", policy.specializationDismissalAllowsTransfer ? "مسموح مرة واحدة؛ تكرار المعدل دون الحد → فصل من الجامعة" : "غير محدد"],
    ["العبء الأقصى في الدراسة الاستدراكية", policy.remedialMaxCredits ? `${policy.remedialMaxCredits} ساعة` : "—"],
    ["ملاحظات", policy.notesAr ?? "—"],
  ];

  return (
    <>
      <div className="topbar">
        <div>
          <h1>الأنظمة الجامعية</h1>
          <p className="muted">القواعد الأكاديمية بيانات قابلة للتهيئة ومُصدَّرة بإصدارات؛ لا شيء منها مكتوب داخل الواجهة.</p>
        </div>
      </div>

      {policy.verification === "verified" ? (
        <div className="alert ok mb"><div>✅ السياسة الحالية <b>موثّقة</b> من نص النظام الموحد المنشور. قد تطبّق جامعتك تفاصيل إضافية؛ التطبيق أداة مساعدة ولا يُصدر قرارات أكاديمية.</div></div>
      ) : (
        <div className="alert warn mb"><div>⚠ السياسة الحالية <b>مسودة</b> مستخرجة من مخطط يدوي، وقد تختلف عن اللائحة الرسمية لجامعتك. التطبيق أداة مساعدة ولا يُصدر قرارات أكاديمية.</div></div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <h2>سياسة الإنذار والاستنفاذ</h2>
            <select className="input" style={{ width: "auto" }} value={state.policyId} onChange={(e) => dispatch({ type: "set", patch: { policyId: e.target.value } })}>
              {POLICIES.map((p) => <option key={p.id} value={p.id}>{p.universityNameAr} (v{p.version})</option>)}
            </select>
          </div>
          <table>
            <tbody>
              {rows.map(([k, v]) => <tr key={k}><td style={{ width: "45%" }} className="muted">{k}</td><td>{v}</td></tr>)}
            </tbody>
          </table>
          {policy.articlesAr && (
            <div className="mt">
              <h3>المواد المرجعية</h3>
              <ul style={{ margin: 0, paddingInlineStart: "1.2rem" }} className="tiny">{policy.articlesAr.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}
          <div className="row mt">
            <button className="btn" onClick={() => setShowJson(!showJson)}>{showJson ? "إخفاء" : "عرض"} تعريف السياسة (JSON)</button>
            <button className="btn" onClick={() => navigator.clipboard?.writeText(JSON.stringify(policy, null, 2))}>نسخ</button>
          </div>
          {showJson && <pre className="kbd" style={{ direction: "ltr", textAlign: "left", overflowX: "auto", padding: "0.8rem", marginTop: "0.6rem", whiteSpace: "pre" }}>{JSON.stringify(policy as AcademicPolicy, null, 2)}</pre>}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>سلّم العلامات</h2>
            <select className="input" style={{ width: "auto" }} value={state.scaleId} onChange={(e) => dispatch({ type: "set", patch: { scaleId: e.target.value } })}>
              {SCALES.map((s) => <option key={s.id} value={s.id}>{s.nameAr}</option>)}
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>العلامة المئوية</th><th className="c">المكافئ الحرفي</th><th className="c">المكافئ الرقمي من {scale.maxPoints}</th><th className="c">ناجح</th></tr></thead>
              <tbody>
                {scale.bands.map((b) => (
                  <tr key={b.letter}><td className="num">{b.min === 0 ? `أقل من ${b.max + 1}` : `${b.min}–${b.max}`}</td><td className="c grade-cell">{b.letter}</td><td className="c num">{b.points.toFixed(2)}</td><td className="c">{b.pass ? "✓" : "✗"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny mt">تحويل المعدل إلى نسبة مئوية: <b>{scale.percent?.noteAr ?? `المعدل ÷ ${scale.maxPoints} × 100`}</b></p>
          <p className="tiny mt">لإضافة جامعة جديدة: أضف كائن سياسة في <span className="kbd">src/core/rules.ts</span> وسلّم علامات في <span className="kbd">src/core/grading.ts</span>. الإصدارات القديمة تبقى محفوظة فلا تتغيّر الحالات المحسوبة سابقاً.</p>
        </div>
      </div>
    </>
  );
}

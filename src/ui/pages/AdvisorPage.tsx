import React, { useMemo, useRef, useState } from "react";
import { useAcademic } from "../../state/useAcademic";
import { BarChart, RISK_COLOR, RISK_LABEL, Stat, StatusBadge } from "../components/common";
import { fmtGpa, gpaToPct } from "../../core/format";
import { assessCohort, parseStudentsCsv, SAMPLE_STUDENTS_CSV, StudentAssessment } from "../../core/advisor";
import { RiskLevel, STATUS_LABELS_AR } from "../../core/rules";

export function AdvisorPage() {
  const { state, dispatch, policy, scale } = useAcademic();
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "all">("all");
  const [majorFilter, setMajorFilter] = useState("all");
  const [q, setQ] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const assessments = useMemo(() => assessCohort(state.advisorStudents, policy), [state.advisorStudents, policy]);
  const majors = [...new Set(state.advisorStudents.map((s) => s.major).filter(Boolean))] as string[];
  const visible = assessments.filter((a) => (riskFilter === "all" || a.risk === riskFilter) && (majorFilter === "all" || a.student.major === majorFilter) && (!q || a.student.name.includes(q) || a.student.id.includes(q)));
  const counts = (["critical", "high", "medium", "low"] as RiskLevel[]).map((r) => ({ r, n: assessments.filter((a) => a.risk === r).length }));

  const load = (t: string) => {
    const r = parseStudentsCsv(t);
    setErrors(r.errors);
    if (r.students.length) dispatch({ type: "advisorStudents", students: r.students });
  };
  const exportCsv = () => {
    const head = ["id", "name", "major", "cgpa", "percent", "warnings", "status", "risk", "next_if_unchanged", "required_gpa_safe", "required_gpa_survive", "flags"];
    const lines = visible.map((a) => [a.student.id, a.student.name, a.student.major ?? "", a.student.cgpa, gpaToPct(a.student.cgpa, scale), a.student.warnings, STATUS_LABELS_AR[a.state.status], RISK_LABEL[a.risk], STATUS_LABELS_AR[a.nextIfUnchanged], a.requiredGpaSafe === null ? "" : a.requiredGpaSafe.toFixed(2), a.requiredGpaSurvive === null ? "" : a.requiredGpaSurvive.toFixed(2), a.flagsAr.join(" / ")].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob(["﻿" + [head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "students-risk.csv"; a.click();
  };

  const reqCell = (v: number | null) => v === null ? "—" : v <= 0 ? "أي معدل" : v > scale.maxPoints ? <span style={{ color: "var(--red)" }}>غير ممكن</span> : fmtGpa(v);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>لوحة المرشد الأكاديمي <span className="badge blue">للجامعات</span></h1>
          <p className="muted">ارفع كشف الطلاب (CSV من نظام الجامعة) ليصنّفهم محرك القواعد حسب الخطر ويحدد من يحتاج تدخلاً مبكراً. البيانات تبقى على هذا الجهاز فقط.</p>
        </div>
        <div className="row">
          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" hidden onChange={(e) => e.target.files?.[0]?.text().then(load)} />
          <button className="btn primary" onClick={() => fileRef.current?.click()}>⬆ رفع CSV</button>
          <button className="btn" onClick={() => load(SAMPLE_STUDENTS_CSV)}>بيانات تجريبية</button>
          <button className="btn" onClick={() => { const blob = new Blob(["\uFEFFالرقم الجامعي,الاسم,التخصص,المعدل التراكمي,الساعات المحسوبة,الساعات المنجزة,عدد الإنذارات,الساعات المسجلة\n2021001,مثال,هندسة الحاسوب,1.62,60,57,2,12\n"], { type: "text/csv;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "students-template.csv"; a.click(); }}>⬇ قالب CSV</button>
          {assessments.length > 0 && <button className="btn" onClick={exportCsv}>⬇ تصدير التقييم</button>}
          {assessments.length > 0 && <button className="btn danger" onClick={() => dispatch({ type: "advisorStudents", students: [] })}>مسح</button>}
        </div>
      </div>

      {assessments.length === 0 && (
        <div className="card mb">
          <h3>أو الصق الجدول هنا</h3>
          <p className="tiny">الأعمدة المدعومة (بالعربية أو الإنكليزية): الرقم الجامعي، الاسم، التخصص، المعدل التراكمي، الساعات المحسوبة، الساعات المنجزة، عدد الإنذارات، الساعات المسجلة، الحالة (اختياري).</p>
          <textarea className="input" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={SAMPLE_STUDENTS_CSV.split("\n").slice(0, 3).join("\n")} style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.85rem" }} />
          <div className="row mt"><button className="btn primary" onClick={() => load(text)} disabled={!text.trim()}>تحليل</button></div>
        </div>
      )}
      {errors.length > 0 && <div className="alert warn mb"><div>{errors.slice(0, 5).map((e, i) => <div key={i}>{e}</div>)}</div></div>}

      {assessments.length > 0 && (
        <>
          <div className="grid grid-5 mb">
            <Stat label="إجمالي الطلاب" value={assessments.length} accent="var(--primary)" />
            {counts.map((c) => (
              <Stat key={c.r} label={`خطر ${RISK_LABEL[c.r]}`} value={c.n} sub={assessments.length ? `${Math.round((c.n / assessments.length) * 100)}%` : ""} accent={`var(--${RISK_COLOR[c.r]})`} />
            ))}
          </div>

          <div className="grid grid-3 mb">
            <div className="card" style={{ gridColumn: "span 2" }}>
              <h3>يحتاجون تدخلاً فورياً</h3>
              <p className="tiny">طلاب سيصلون إلى حالة فصل إن بقي معدلهم كما هو، أو يحتاجون معدلاً فصلياً غير واقعي لتجنّبه.</p>
              <ul style={{ margin: 0, paddingInlineStart: "1.2rem" }}>
                {assessments.filter((a) => a.risk === "critical").slice(0, 8).map((a) => (
                  <li key={a.student.id}><b>{a.student.name}</b> <span className="tiny num">({a.student.id})</span> — معدل {fmtGpa(a.student.cgpa)} · {a.flagsAr[0] ?? STATUS_LABELS_AR[a.state.status]}</li>
                ))}
                {assessments.filter((a) => a.risk === "critical").length === 0 && <li className="muted">لا يوجد حالياً.</li>}
              </ul>
            </div>
            <div className="card">
              <h3>توزيع الخطر</h3>
              <BarChart data={counts.map((c) => ({ label: RISK_LABEL[c.r], value: c.n, color: `var(--${RISK_COLOR[c.r]})` }))} height={150} />
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>الطلاب ({visible.length})</h2>
              <div className="row">
                <input className="input" placeholder="بحث بالاسم أو الرقم" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 170 }} />
                {majors.length > 1 && (
                  <select className="input" style={{ width: "auto" }} value={majorFilter} onChange={(e) => setMajorFilter(e.target.value)}>
                    <option value="all">كل التخصصات</option>
                    {majors.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                )}
                <div className="segmented">
                  {(["all", "critical", "high", "medium", "low"] as const).map((r) => (
                    <button key={r} className={riskFilter === r ? "on" : ""} onClick={() => setRiskFilter(r)}>{r === "all" ? "الكل" : RISK_LABEL[r]}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>الطالب</th><th>التخصص</th><th className="c">المعدل</th><th className="c">%</th><th className="c">ساعات</th><th className="c">إنذارات</th><th className="c">الحالة</th><th className="c">الخطر</th><th className="c">إن بقي المعدل</th><th className="c">فصلي للتعافي</th><th className="c">فصلي لتجنّب الفصل</th><th style={{ minWidth: 220 }}>ملاحظات</th></tr></thead>
                <tbody>
                  {visible.map((a: StudentAssessment) => (
                    <tr key={a.student.id}>
                      <td><b>{a.student.name}</b><div className="tiny num">{a.student.id}</div></td>
                      <td className="tiny">{a.student.major ?? "—"}</td>
                      <td className="c num" style={{ fontWeight: 700, color: a.student.cgpa >= policy.goodStandingMin ? "var(--green)" : a.student.cgpa >= policy.upperRecoveryMin ? "var(--orange)" : "var(--red)" }}>{fmtGpa(a.student.cgpa)}</td>
                      <td className="c num">{gpaToPct(a.student.cgpa, scale)}</td>
                      <td className="c num">{a.student.completedCredits}</td>
                      <td className="c num">{a.student.warnings}</td>
                      <td className="c"><StatusBadge status={a.state.status} /></td>
                      <td className="c"><span className={`badge ${RISK_COLOR[a.risk]}`}>{RISK_LABEL[a.risk]}</span></td>
                      <td className="c"><StatusBadge status={a.nextIfUnchanged} /></td>
                      <td className="c num">{reqCell(a.requiredGpaSafe)}</td>
                      <td className="c num">{reqCell(a.requiredGpaSurvive)}</td>
                      <td className="tiny">{a.flagsAr.join(" · ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tiny mt">التقييم وفق سياسة {policy.universityNameAr} (إصدار {policy.version}، {policy.verification === "verified" ? "موثّقة" : "مسودة"}). المعدل الفصلي المطلوب محسوب على الساعات المسجّلة لكل طالب (أو 15 إن لم تُذكر). أداة دعم قرار وليست قراراً رسمياً.</p>
          </div>
        </>
      )}
    </>
  );
}

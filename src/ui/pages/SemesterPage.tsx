import React from "react";
import { useAcademic } from "../../state/useAcademic";
import { CourseTable } from "../components/CourseTable";
import { Gauge, Stat } from "../components/common";
import { fmtGpa } from "../../core/format";
import { pointsToLetter } from "../../core/grading";

export function SemesterPage() {
  const { state, dispatch, scale, semester } = useAcademic();
  return (
    <>
      <div className="topbar">
        <div>
          <h1>حساب المعدل الفصلي</h1>
          <p className="muted">أدخل المقررات بالعلامة المئوية أو المكافئ الحرفي، ويُحدَّث المعدل فوراً.</p>
        </div>
      </div>

      <div className="grid grid-4 mb">
        <Stat label="المعدل الفصلي" value={fmtGpa(semester.gpa)} sub={semester.gpa !== null ? `المكافئ: ${pointsToLetter(semester.gpa, scale)}` : "لا توجد علامات كافية"} accent={semester.gpa === null ? "var(--gray)" : semester.gpa >= 2 ? "var(--green)" : "var(--red)"} />
        <Stat label="ساعات الفصل" value={semester.totalCredits} sub={`تدخل في المعدل: ${semester.gpaCredits}`} accent="var(--primary)" />
        <Stat label="النقاط الموزونة" value={fmtGpa(semester.totalWeighted)} sub="Σ (النقاط × الساعات)" accent="var(--teal)" />
        <Stat label="الساعات المكتسبة" value={semester.earnedCredits} sub={semester.failedCourses > 0 ? `${semester.failedCourses} مقرر راسب` : "لا رسوب"} accent={semester.failedCourses > 0 ? "var(--orange)" : "var(--green)"} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>مقررات الفصل</h2>
          <span className="badge blue">السلّم: {scale.nameAr}</span>
        </div>
        <CourseTable courses={state.courses} onChange={(c) => dispatch({ type: "courses", courses: c })} result={semester} scale={scale} />
      </div>

      <div className="grid grid-2 mt">
        <div className="card">
          <h3>الصيغة</h3>
          <p className="muted">المعدل الفصلي = Σ(نقاط المقرر × ساعاته) ÷ Σ(الساعات)</p>
          <p className="num" style={{ direction: "ltr", textAlign: "left" }}>
            {fmtGpa(semester.totalWeighted)} ÷ {semester.gpaCredits} = <b>{fmtGpa(semester.gpa, 4)}</b>
          </p>
          <p className="tiny">تُحتسب القيم بدقة كاملة داخلياً ويُقرَّب العرض إلى منزلتين فقط. المقررات المنسحبة والمستثناة ومقررات (ناجح/راسب) والمقررات بصفر ساعة لا تدخل في المعدل.</p>
        </div>
        <div className="card row" style={{ justifyContent: "space-around" }}>
          <Gauge value={semester.gpa} max={scale.maxPoints} label="فصلي" />
          <div className="table-wrap" style={{ flex: 1, minWidth: 200 }}>
            <table>
              <thead><tr><th>المئوية</th><th className="c">الحرفي</th><th className="c">النقاط</th></tr></thead>
              <tbody>
                {scale.bands.map((b) => (
                  <tr key={b.letter}><td className="num">{b.min === 0 ? `< ${b.max + 1}` : `${b.min}–${b.max}`}</td><td className="c">{b.letter}</td><td className="c num">{b.points.toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

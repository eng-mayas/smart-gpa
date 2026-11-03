import React from "react";
import { useAcademic } from "../../state/useAcademic";
import { CourseTable } from "../components/CourseTable";
import { Gauge, Stat } from "../components/common";
import { fmtGpa, gpaToPct } from "../../core/format";
import { pointsToLetter } from "../../core/grading";

export function SemesterPage() {
  const { state, dispatch, scale, semester, activePlan } = useAcademic();
  const archive = () => {
    if (semester.gpa === null) return;
    const label = `${state.profile.academicYear} / فصل ${state.history.length + 1}`;
    dispatch({ type: "history", history: [...state.history, { label, gpa: semester.gpa, gpaHours: semester.gpaCredits, earnedCredits: semester.earnedCredits }] });
    // mark plan courses done
    if (activePlan) {
      const progress = { ...state.planProgress };
      for (const r of semester.courses) {
        const pc = activePlan.courses.find((p) => `plan-${p.code}` === r.course.id || p.nameAr === r.course.name || p.name === r.course.name);
        if (pc && r.letter) progress[pc.code] = { status: "done", letter: r.letter === "P" ? undefined : r.letter };
      }
      dispatch({ type: "planProgress", progress });
    }
    const newHours = state.profile.previousGpaHours + semester.gpaCredits;
    const newCgpa = newHours > 0 ? (state.profile.previousCgpa * state.profile.previousGpaHours + semester.totalWeighted) / newHours : 0;
    dispatch({ type: "profile", patch: { previousCgpa: newCgpa, previousGpaHours: newHours, completedCredits: state.profile.completedCredits + semester.earnedCredits } });
    dispatch({ type: "courses", courses: [] });
    alert(`تم ترحيل الفصل إلى السجل (معدل ${semester.gpa.toFixed(2)}). ابدأ فصلاً جديداً.`);
  };
  return (
    <>
      <div className="topbar">
        <div>
          <h1>حساب المعدل الفصلي</h1>
          <p className="muted">أدخل المقررات بالعلامة المئوية أو المكافئ الحرفي، ويُحدَّث المعدل فوراً.{activePlan ? " اكتب اسم المقرر لاختياره من الخطة." : ""}</p>
        </div>
        <button className="btn" onClick={() => confirm("سيُنقل هذا الفصل إلى السجل الأكاديمي ويُحدَّث المعدل التراكمي والخطة، ثم يُفرَّغ الجدول. متابعة؟") && archive()} disabled={semester.gpa === null || semester.missingGrades > 0} title={semester.missingGrades > 0 ? "أكمل العلامات أولاً" : ""}>📦 انتهى الفصل: ترحيل إلى السجل</button>
      </div>

      <div className="grid grid-4 mb">
        <Stat label="المعدل المئوي الفصلي" value={semester.markAverage === null ? "—" : `${semester.markAverage.toFixed(1)}%`} sub={semester.markAverage === null ? "أدخل علامات مئوية لحسابه" : semester.markCredits < semester.gpaCredits ? `متوسط العلامات المُدخلة (${semester.markCredits} ساعة)` : "متوسط العلامات المئوية الموزون بالساعات"} accent="var(--gold)" />
        <Stat label="المعدل الفصلي" value={fmtGpa(semester.gpa)} sub={semester.gpa !== null ? `المكافئ: ${pointsToLetter(semester.gpa, scale)} · النسبة الرسمية: ${gpaToPct(semester.gpa, scale)}` : "لا توجد علامات كافية"} accent={semester.gpa === null ? "var(--gray)" : semester.gpa >= 2 ? "var(--green)" : "var(--red)"} />
        <Stat label="ساعات الفصل" value={semester.totalCredits} sub={`تدخل في المعدل: ${semester.gpaCredits} · نقاط موزونة: ${fmtGpa(semester.totalWeighted)}`} accent="var(--primary)" />
        <Stat label="الساعات المكتسبة" value={semester.earnedCredits} sub={semester.failedCourses > 0 ? `${semester.failedCourses} مقرر راسب` : "لا رسوب"} accent={semester.failedCourses > 0 ? "var(--orange)" : "var(--green)"} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>مقررات الفصل</h2>
          <span className="badge blue">السلّم: {scale.nameAr}</span>
        </div>
        <CourseTable courses={state.courses} onChange={(c) => dispatch({ type: "courses", courses: c })} result={semester} scale={scale} planCourses={activePlan?.courses} />
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

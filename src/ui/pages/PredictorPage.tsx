import React, { useState } from "react";
import { useAcademic } from "../../state/useAcademic";
import { CourseTable } from "../components/CourseTable";
import { Field, NumberInput, Stat, StatusBadge } from "../components/common";
import { fmtGpa } from "../../core/format";
import { analyzeTarget, minimumGradesForTarget, runScenario, standardScenarios } from "../../core/predictor";
import { calculateSemester, combineCgpa } from "../../core/gpa";
import { transition } from "../../core/rules";

export function PredictorPage() {
  const { state, dispatch, scale, semester, cumulative, currentState, policy, projectedCredits } = useAcademic();
  const p = state.profile;
  const [target, setTarget] = useState<number | "">(2.0);
  const [scenarioName, setScenarioName] = useState("");

  const hours = semester.totalCredits;
  const tgt = target === "" ? 0 : target;
  const analysis = analyzeTarget({ previousCgpa: p.previousCgpa, previousGpaHours: p.previousGpaHours, semesterHours: hours, targetCgpa: tgt }, scale);
  const minGrades = minimumGradesForTarget(state.courses, p.previousCgpa, p.previousGpaHours, tgt, scale);
  const scenarios = standardScenarios(state.courses, scale).map((s) => runScenario(s, p.previousCgpa, p.previousGpaHours, scale));

  return (
    <>
      <div className="topbar">
        <div>
          <h1>توقع المعدل (محاكي ماذا لو؟)</h1>
          <p className="muted">غيّر العلامات المتوقعة وشاهد أثرها فوراً، أو حدّد معدلاً مستهدفاً لمعرفة ما تحتاجه.</p>
        </div>
      </div>

      <div className="grid grid-4 mb">
        <Stat label="المعدل السابق" value={fmtGpa(p.previousCgpa)} sub={`${p.previousGpaHours} ساعة`} accent="var(--gray)" />
        <Stat label="المعدل الفصلي المتوقع" value={fmtGpa(semester.gpa)} sub={`${semester.gpaCredits} من ${hours} ساعة مُدخلة`} accent="var(--teal)" />
        <Stat label="المعدل التراكمي المتوقع" value={fmtGpa(cumulative.newCgpa)} accent={cumulative.newCgpa !== null && cumulative.newCgpa >= policy.goodStandingMin ? "var(--green)" : "var(--orange)"} />
        <Stat label="الفارق عن الهدف" value={cumulative.newCgpa === null ? "—" : (cumulative.newCgpa - tgt >= 0 ? "+" : "") + (cumulative.newCgpa - tgt).toFixed(3)} accent={cumulative.newCgpa !== null && cumulative.newCgpa >= tgt ? "var(--green)" : "var(--red)"} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>العلامات الافتراضية</h2>
          <div className="row">
            <input className="input" placeholder="اسم السيناريو" value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} style={{ width: 180 }} />
            <button className="btn" disabled={!scenarioName.trim()} onClick={() => { dispatch({ type: "saveScenario", name: scenarioName.trim(), courses: state.courses }); setScenarioName(""); }}>💾 حفظ السيناريو</button>
          </div>
        </div>
        <CourseTable courses={state.courses} onChange={(c) => dispatch({ type: "courses", courses: c })} result={semester} scale={scale} showWeighted={false} />
      </div>

      {state.savedScenarios.length > 0 && (
        <div className="card mt">
          <h3>السيناريوهات المحفوظة</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>الاسم</th><th className="c">المعدل الفصلي</th><th className="c">التراكمي المتوقع</th><th className="c">الوضع</th><th></th></tr></thead>
              <tbody>
                {state.savedScenarios.map((s) => {
                  const sem = calculateSemester(s.courses, scale);
                  const cg = sem.gpa === null ? null : combineCgpa(p.previousCgpa, p.previousGpaHours, sem.gpa, sem.gpaCredits);
                  const st = transition(currentState, cg, policy, projectedCredits);
                  return (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td className="c num">{fmtGpa(sem.gpa)}</td>
                      <td className="c num">{fmtGpa(cg)}</td>
                      <td className="c">{st.evaluated ? <StatusBadge status={st.to.status} /> : "—"}</td>
                      <td className="row">
                        <button className="btn sm" onClick={() => dispatch({ type: "courses", courses: s.courses })}>تحميل</button>
                        <button className="btn sm ghost danger" onClick={() => dispatch({ type: "deleteScenario", id: s.id })}>حذف</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-2 mt">
        <div className="card">
          <h2>حاسبة الهدف</h2>
          <Field label="المعدل التراكمي المستهدف">
            <NumberInput value={target} min={0} max={scale.maxPoints} step={0.05} onChange={setTarget} />
          </Field>
          <div className="stack mt">
            {analysis.requiredSemesterGpa === null ? (
              <div className="alert warn">أضف مقررات الفصل (بساعاتها) أولاً.</div>
            ) : analysis.requiredSemesterGpa <= 0 ? (
              <div className="alert ok">معدلك السابق يحقق الهدف. للبقاء فوقه يكفي معدل فصلي ≥ {fmtGpa(tgt)}.</div>
            ) : analysis.achievable ? (
              <>
                <div className="alert ok">
                  <div>
                    المعدل الفصلي المطلوب هذا الفصل: <b className="num">{fmtGpa(analysis.requiredSemesterGpa, 3)}</b> على {hours} ساعة.
                    {analysis.uniformLetter && <> أي ما يعادل <b>{analysis.uniformLetter}</b> على الأقل في كل المقررات.</>}
                  </div>
                </div>
                {minGrades.feasible && minGrades.perCourse && (
                  <div>
                    <h3>أدنى توزيع مقترح للعلامات</h3>
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>المقرر</th><th className="c">الساعات</th><th className="c">الحد الأدنى</th></tr></thead>
                        <tbody>
                          {minGrades.perCourse.map((x) => (
                            <tr key={x.course.id}><td>{x.course.name || "مقرر"}</td><td className="c num">{x.course.credits}</td><td className="c grade-cell">{x.letter}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="tiny">التوزيع يفضّل رفع العلامة في المقررات ذات الساعات الأعلى أولاً لأن أثرها على المعدل أكبر.</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="alert danger"><div>❌ الهدف غير قابل للتحقيق في فصل واحد. {analysis.reason}</div></div>
                <div className="alert info">
                  <div>
                    <b>خطط بديلة:</b>
                    <ul style={{ margin: "0.3rem 0 0", paddingInlineStart: "1.2rem" }}>
                      {analysis.hoursNeededAtMax !== null ? (
                        <li>بمعدل {scale.maxPoints.toFixed(2)} في كل المقررات: تحتاج <b>{analysis.hoursNeededAtMax}</b> ساعة إضافية (≈ {analysis.semestersNeededAtMax} فصل بحمل {hours} ساعة).</li>
                      ) : <li>لا يمكن الوصول إلى الهدف حتى بأعلى معدل ممكن.</li>}
                      {analysis.hoursNeededAtRealistic !== null ? (
                        <li>بمعدل واقعي {analysis.realisticGpa.toFixed(2)}: تحتاج <b>{analysis.hoursNeededAtRealistic}</b> ساعة إضافية.</li>
                      ) : <li>بمعدل {analysis.realisticGpa.toFixed(2)} لا يمكن الوصول إلى الهدف أبداً (الهدف ≥ المعدل المفترض).</li>}
                      <li>أقصى معدل تراكمي ممكن بعد هذا الفصل: <b className="num">{fmtGpa(analysis.maxReachableCgpa, 3)}</b>، وأدناه: <b className="num">{fmtGpa(analysis.minReachableCgpa, 3)}</b>.</li>
                    </ul>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <h2>مقارنة السيناريوهات القياسية</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>السيناريو</th><th className="c">فصلي</th><th className="c">تراكمي</th><th className="c">الوضع المتوقع</th></tr></thead>
              <tbody>
                {scenarios.map((o) => {
                  const st = transition(currentState, o.newCgpa, policy, projectedCredits);
                  return (
                    <tr key={o.scenario.id} title={o.scenario.descriptionAr}>
                      <td>{o.scenario.nameAr}<div className="tiny">{o.scenario.descriptionAr}</div></td>
                      <td className="c num">{fmtGpa(o.semester.gpa)}</td>
                      <td className="c num" style={{ color: o.newCgpa !== null && o.newCgpa >= tgt ? "var(--green)" : "var(--red)", fontWeight: 700 }}>{fmtGpa(o.newCgpa)}</td>
                      <td className="c">{st.evaluated ? <StatusBadge status={st.to.status} /> : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {state.courses.length === 0 && <p className="tiny">أضف مقررات لعرض السيناريوهات.</p>}
        </div>
      </div>
    </>
  );
}

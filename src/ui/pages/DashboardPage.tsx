import React from "react";
import { useAcademic } from "../../state/useAcademic";
import { Gauge, Stat, StatusBadge, RiskBadge, Progress, LineChart, BarChart, RISK_LABEL, COLOR_VAR } from "../components/common";
import { fmtGpa, fmtPct } from "../../core/format";
import { describeState, nextThresholds, riskLevel, STATUS_COLORS } from "../../core/rules";
import { requiredSemesterGpa } from "../../core/predictor";

export function DashboardPage({ go }: { go: (p: string) => void }) {
  const { state, scale, policy, semester, cumulative, currentState, predicted, timeline, historyHours } = useAcademic();
  const p = state.profile;
  const th = nextThresholds(currentState, policy, p.completedCredits);
  const reqSafe = requiredSemesterGpa({ previousCgpa: p.previousCgpa, previousGpaHours: p.previousGpaHours, semesterHours: semester.totalCredits, targetCgpa: th.safe });
  const creditsDone = p.completedCredits;
  const remainingCredits = Math.max(0, p.planCredits - creditsDone);
  const projectedGradGpa = (() => {
    // if the student keeps the current semester GPA for all remaining credits
    const g = semester.gpa ?? p.previousCgpa;
    const H = p.previousGpaHours + remainingCredits;
    return H > 0 ? (p.previousCgpa * p.previousGpaHours + g * remainingCredits) / H : null;
  })();

  // grade distribution of current semester
  const dist: Record<string, number> = {};
  for (const r of semester.courses) if (r.letter) dist[r.letter] = (dist[r.letter] ?? 0) + 1;
  const distData = scale.bands.map((b) => ({ label: b.letter, value: dist[b.letter] ?? 0, color: b.pass ? (b.points >= 3 ? "var(--green)" : b.points >= 2 ? "var(--teal)" : "var(--orange)") : "var(--red)" })).filter((d) => d.value > 0);

  const hist = timeline.length > 0;

  return (
    <>
      <div className="hero mb">
        <div className="row between">
          <img className="hero-logo" src="./atmata-logo.png" alt="Atmata Group" />
          <div style={{ flex: 1 }}>
            <h1>مرحباً{p.name ? `، ${p.name}` : ""} 👋</h1>
            <p className="muted">{p.university} · {p.faculty} · {p.major} · {p.academicYear}</p>
          </div>
          <div className="row">
            <StatusBadge status={currentState.status} lg />
          </div>
        </div>
      </div>

      <div className="grid grid-4 mb">
        <Stat label="المعدل التراكمي الحالي" value={fmtGpa(p.previousCgpa)} sub={`${p.previousGpaHours} ساعة محسوبة`} accent={p.previousCgpa >= policy.goodStandingMin ? "var(--green)" : p.previousCgpa >= policy.upperRecoveryMin ? "var(--orange)" : "var(--red)"} />
        <Stat label="المعدل الفصلي الحالي (متوقع)" value={fmtGpa(semester.gpa)} sub={`${semester.gpaCredits} ساعة مُدخلة`} accent="var(--teal)" />
        <Stat label="التراكمي المتوقع" value={fmtGpa(cumulative.newCgpa)} sub={cumulative.delta === null ? "—" : (cumulative.delta >= 0 ? "▲ " : "▼ ") + Math.abs(cumulative.delta).toFixed(3)} accent={cumulative.newCgpa !== null && cumulative.newCgpa >= policy.goodStandingMin ? "var(--green)" : "var(--orange)"} />
        <Stat label="مستوى الخطر" value={RISK_LABEL[riskLevel(currentState)]} sub={`${currentState.warnings} إنذار`} accent={COLOR_VAR[STATUS_COLORS[currentState.status]]} />
      </div>

      <div className="grid grid-3 mb">
        <div className="card" style={{ gridColumn: "span 2" }}>
          <div className="card-head"><h2>الوضع الأكاديمي</h2><RiskBadge state={currentState} /></div>
          <p>{describeState(currentState, policy)}</p>
          <div className="grid grid-3 mt">
            <div>
              <div className="tiny">المعدل المطلوب للتعافي</div>
              <div className="num" style={{ fontSize: "1.3rem", fontWeight: 800 }}>{fmtGpa(th.safe)}</div>
            </div>
            <div>
              <div className="tiny">أدنى معدل فصلي مطلوب</div>
              <div className="num" style={{ fontSize: "1.3rem", fontWeight: 800, color: reqSafe !== null && reqSafe > scale.maxPoints ? "var(--red)" : undefined }}>
                {reqSafe === null ? "—" : reqSafe <= 0 ? "محقق" : reqSafe > scale.maxPoints ? "غير ممكن" : fmtGpa(reqSafe, 2)}
              </div>
            </div>
            <div>
              <div className="tiny">المتوقع نهاية الفصل</div>
              <div>{predicted.evaluated ? <StatusBadge status={predicted.to.status} /> : <span className="tiny">بيانات غير كافية</span>}</div>
            </div>
          </div>
          <div className="row mt">
            <button className="btn primary" onClick={() => go("exhaustion")}>كيف أتجنب الاستنفاذ؟</button>
            <button className="btn" onClick={() => go("predictor")}>محاكي ماذا لو</button>
            <button className="btn" onClick={() => go("warnings")}>تفاصيل الإنذارات</button>
          </div>
        </div>
        <div className="card row" style={{ justifyContent: "center" }}>
          <Gauge value={cumulative.newCgpa ?? (p.previousGpaHours > 0 ? p.previousCgpa : null)} max={scale.maxPoints} label="التراكمي المتوقع" />
        </div>
      </div>

      <div className="grid grid-3 mb">
        <div className="card">
          <h3>تقدّم الخطة الدراسية</h3>
          <div className="row between"><span className="tiny">{creditsDone} / {p.planCredits} ساعة</span><b className="num">{fmtPct(p.planCredits > 0 ? (creditsDone / p.planCredits) * 100 : 0)}</b></div>
          <Progress value={creditsDone} max={p.planCredits} />
          <p className="tiny mt">المتبقي: {remainingCredits} ساعة · معدل التخرج المتوقع إن استمرّ الأداء الحالي: <b className="num">{fmtGpa(projectedGradGpa)}</b></p>
        </div>
        <div className="card">
          <h3>توزيع علامات الفصل الحالي</h3>
          {distData.length > 0 ? <BarChart data={distData} height={140} /> : <p className="muted tiny">أدخل علامات في صفحة المعدل الفصلي.</p>}
        </div>
        <div className="card">
          <h3>مؤشرات سريعة</h3>
          <table>
            <tbody>
              <tr><td>مقررات الفصل</td><td className="c num">{state.courses.length}</td></tr>
              <tr><td>مقررات راسبة (متوقع)</td><td className="c num" style={{ color: semester.failedCourses ? "var(--red)" : undefined }}>{semester.failedCourses}</td></tr>
              <tr><td>الفصول المسجّلة في السجل</td><td className="c num">{timeline.length}</td></tr>
              <tr><td>الساعات في السجل</td><td className="c num">{historyHours}</td></tr>
              <tr><td>السياسة</td><td className="c tiny">{policy.verification === "verified" ? <span className="badge green">موثّقة</span> : <span className="badge yellow">مسودة</span>}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {hist && (
        <div className="card">
          <h3>اتجاه المعدل عبر الفصول</h3>
          <LineChart
            labels={[...timeline.map((e) => e.record.label.split("/").pop()?.trim() ?? ""), "متوقع"]}
            series={[
              { name: "فصلي", data: [...timeline.map((e) => e.record.gpa), semester.gpa], color: "var(--teal)" },
              { name: "تراكمي", data: [...timeline.map((e) => e.cgpa), cumulative.newCgpa], color: "var(--primary)" },
            ]}
            max={scale.maxPoints}
            thresholds={[
              { value: policy.goodStandingMin, label: "وضع سليم", color: "var(--green)" },
              { value: policy.upperRecoveryMin, label: "استدراكي", color: "var(--orange)" },
              { value: policy.specializationDismissalBelow, label: "فصل", color: "var(--red)" },
            ]}
          />
        </div>
      )}
    </>
  );
}

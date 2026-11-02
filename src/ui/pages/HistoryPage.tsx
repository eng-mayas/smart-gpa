import React from "react";
import { useAcademic } from "../../state/useAcademic";
import { NumberInput, StatusBadge, LineChart, COLOR_VAR } from "../components/common";
import { fmtGpa } from "../../core/format";
import { STATUS_COLORS } from "../../core/rules";

export function HistoryPage() {
  const { state, dispatch, scale, policy, timeline, historyHours } = useAcademic();
  const h = state.history;
  const update = (i: number, patch: Partial<(typeof h)[number]>) => dispatch({ type: "history", history: h.map((r, j) => (i === j ? { ...r, ...patch } : r)) });
  const remove = (i: number) => dispatch({ type: "history", history: h.filter((_, j) => j !== i) });
  const add = () => dispatch({ type: "history", history: [...h, { label: `فصل ${h.length + 1}`, gpa: 2.0, gpaHours: 15 }] });
  const last = timeline[timeline.length - 1];
  const syncProfile = () => {
    if (!last) return;
    dispatch({ type: "profile", patch: { previousCgpa: last.cgpa ?? 0, previousGpaHours: historyHours, completedCredits: last.completedCredits, previousWarnings: last.transition.to.warnings } });
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>السجل الأكاديمي</h1>
          <p className="muted">أدخل الفصول المكتملة (المعدل الفصلي وساعاته)؛ يُعاد حساب المعدل التراكمي والوضع الأكاديمي فصلاً بفصل عبر محرك القواعد.</p>
        </div>
        <div className="row">
          <button className="btn" onClick={syncProfile} disabled={!last}>↻ مزامنة الملف الشخصي من السجل</button>
          <button className="btn primary" onClick={add}>+ إضافة فصل</button>
        </div>
      </div>

      <div className="card mb">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>الفصل</th><th className="c">المعدل الفصلي</th><th className="c">الساعات</th><th className="c">التراكمي</th><th className="c">الساعات التراكمية</th><th className="c">الوضع الأكاديمي</th><th>التفسير</th><th></th></tr>
            </thead>
            <tbody>
              {timeline.map((e, i) => (
                <tr key={i}>
                  <td className="num">{i + 1}</td>
                  <td><input className="input" value={e.record.label} onChange={(ev) => update(i, { label: ev.target.value })} style={{ minWidth: 120 }} /></td>
                  <td className="c" style={{ width: 100 }}><NumberInput value={e.record.gpa ?? ""} min={0} max={scale.maxPoints} step={0.01} onChange={(v) => update(i, { gpa: v === "" ? null : v })} /></td>
                  <td className="c" style={{ width: 90 }}><NumberInput value={e.record.gpaHours} min={0} max={30} onChange={(v) => update(i, { gpaHours: v === "" ? 0 : v })} /></td>
                  <td className="c num"><b>{fmtGpa(e.cgpa, 3)}</b></td>
                  <td className="c num">{e.cumulativeHours}</td>
                  <td className="c"><StatusBadge status={e.transition.to.status} /></td>
                  <td className="tiny" style={{ maxWidth: 300 }}>{e.transition.explanationAr}</td>
                  <td><button className="btn ghost sm danger" onClick={() => remove(i)}>✕</button></td>
                </tr>
              ))}
              {h.length === 0 && <tr><td colSpan={9} className="c muted">لا توجد فصول بعد. أضف فصلاً أو حمّل البيانات التجريبية من الإعدادات.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {timeline.length > 0 && (
        <div className="grid grid-2">
          <div className="card">
            <h3>تطور المعدل الفصلي والتراكمي</h3>
            <LineChart
              labels={timeline.map((e) => e.record.label.split("/").pop()?.trim() ?? "")}
              series={[
                { name: "فصلي", data: timeline.map((e) => e.record.gpa), color: "var(--teal)" },
                { name: "تراكمي", data: timeline.map((e) => e.cgpa), color: "var(--primary)" },
              ]}
              max={scale.maxPoints}
              thresholds={[
                { value: policy.goodStandingMin, label: "سليم", color: "var(--green)" },
                { value: policy.specializationDismissalBelow, label: "فصل", color: "var(--red)" },
              ]}
            />
          </div>
          <div className="card">
            <h3>الخط الزمني للحالة الأكاديمية</h3>
            <ul className="timeline">
              {timeline.map((e, i) => (
                <li key={i}>
                  <span className="dot" style={{ ["--dot" as string]: COLOR_VAR[STATUS_COLORS[e.transition.to.status]] }} />
                  <div className="row between">
                    <b>{e.record.label}</b>
                    <StatusBadge status={e.transition.to.status} />
                  </div>
                  <div className="tiny">فصلي {fmtGpa(e.record.gpa)} · تراكمي {fmtGpa(e.cgpa)} · {e.cumulativeHours} ساعة · إنذارات: {e.transition.to.warnings}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

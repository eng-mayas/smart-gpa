import React from "react";
import { Course, CourseStatus, SemesterResult, newCourse, isValidCredits } from "../../core/gpa";
import { GradingScale, isValidMark } from "../../core/grading";
import { fmtGpa } from "../../core/format";
import { NumberInput } from "./common";

const STATUS_LABEL: Record<CourseStatus, string> = {
  normal: "عادي",
  repeat: "إعادة",
  withdrawn: "منسحب (W)",
  passfail: "ناجح/راسب",
  excluded: "مستثنى",
};

export function CourseTable({
  courses, onChange, result, scale, showWeighted = true,
}: {
  courses: Course[];
  onChange: (c: Course[]) => void;
  result: SemesterResult;
  scale: GradingScale;
  showWeighted?: boolean;
}) {
  const update = (id: string, patch: Partial<Course>) => onChange(courses.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const remove = (id: string) => onChange(courses.filter((c) => c.id !== id));
  const add = () => onChange([...courses, newCourse({ name: `مقرر ${courses.length + 1}` })]);
  // Letter of the previous attempt: the band whose points match (closest from below).
  const prevLetter = (points: number) =>
    [...scale.bands].sort((a, b) => b.points - a.points).find((b) => b.points <= points + 1e-9)?.letter ?? scale.bands[scale.bands.length - 1].letter;

  return (
    <div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: 150 }}>المقرر</th>
              <th className="c">الساعات</th>
              <th className="c">طريقة الإدخال</th>
              <th className="c" style={{ minWidth: 110 }}>العلامة</th>
              <th className="c">الحالة</th>
              <th className="c">الحرفي</th>
              <th className="c">النقاط</th>
              {showWeighted && <th className="c">الموزون</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => {
              const r = result.courses.find((x) => x.course.id === c.id);
              const markInvalid = c.grade.kind === "mark" && !isValidMark(c.grade.value);
              return (
                <tr key={c.id}>
                  <td>
                    <input className="input" value={c.name} placeholder="اسم المقرر" aria-label="اسم المقرر"
                      onChange={(e) => update(c.id, { name: e.target.value })} />
                  </td>
                  <td className="c" style={{ width: 90 }}>
                    <NumberInput value={c.credits} min={0} max={30} step={0.5} ariaLabel="الساعات المعتمدة" invalid={!isValidCredits(c.credits)}
                      onChange={(v) => update(c.id, { credits: v === "" ? 0 : v })} />
                  </td>
                  <td className="c">
                    <div className="segmented">
                      <button className={c.grade.kind !== "letter" ? "on" : ""} onClick={() => update(c.id, { grade: c.grade.kind === "mark" ? c.grade : { kind: "none" } })}>رقمي</button>
                      <button className={c.grade.kind === "letter" ? "on" : ""} onClick={() => update(c.id, { grade: { kind: "letter", value: c.grade.kind === "letter" ? c.grade.value : "B" } })}>حرفي</button>
                    </div>
                  </td>
                  <td className="c">
                    {c.grade.kind === "letter" ? (
                      <select className="input" value={c.grade.value} aria-label="المكافئ الحرفي" onChange={(e) => update(c.id, { grade: { kind: "letter", value: e.target.value } })}>
                        {scale.bands.map((b) => <option key={b.letter} value={b.letter}>{b.letter} ({b.points})</option>)}
                      </select>
                    ) : (
                      <NumberInput value={c.grade.kind === "mark" ? c.grade.value : ""} min={0} max={100} ariaLabel="العلامة المئوية" placeholder="0–100" invalid={markInvalid}
                        onChange={(v) => update(c.id, { grade: v === "" ? { kind: "none" } : { kind: "mark", value: v } })} />
                    )}
                  </td>
                  <td className="c">
                    <select className="input" value={c.status} aria-label="حالة المقرر" onChange={(e) => update(c.id, { status: e.target.value as CourseStatus })}>
                      {(Object.keys(STATUS_LABEL) as CourseStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                    {c.status === "repeat" && (
                      <div className="row" style={{ marginTop: 4, gap: 4, justifyContent: "center", flexWrap: "nowrap" }}>
                        <span className="tiny" style={{ whiteSpace: "nowrap" }}>العلامة السابقة</span>
                        <select className="input" style={{ width: "auto" }} aria-label="المكافئ الحرفي للمحاولة السابقة"
                          value={prevLetter(c.previousPoints ?? 0)}
                          onChange={(e) => update(c.id, { previousPoints: scale.bands.find((b) => b.letter === e.target.value)?.points ?? 0 })}>
                          {scale.bands.map((b) => <option key={b.letter} value={b.letter}>{b.letter} ({b.points})</option>)}
                        </select>
                      </div>
                    )}
                  </td>
                  <td className="c grade-cell">{r?.error ? <span className="tiny" style={{ color: "var(--red)" }}>{r.error}</span> : r?.letter ?? "—"}</td>
                  <td className="c num">{r?.points !== undefined ? r.points.toFixed(2) : "—"}</td>
                  {showWeighted && <td className="c num">{r?.weighted !== undefined ? fmtGpa(r.weighted) : "—"}</td>}
                  <td><button className="btn ghost sm danger" aria-label="حذف" onClick={() => remove(c.id)}>✕</button></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>المجموع</td>
              <td className="c num">{result.totalCredits}</td>
              <td colSpan={4} className="c tiny">ساعات تدخل في المعدل: <b className="num">{result.gpaCredits}</b></td>
              <td className="c num">{result.gpa === null ? "—" : fmtGpa(result.gpa, 3)}</td>
              {showWeighted && <td className="c num">{fmtGpa(result.totalWeighted)}</td>}
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="row mt">
        <button className="btn primary" onClick={add}>+ إضافة مقرر</button>
        <button className="btn" onClick={() => onChange([])} disabled={courses.length === 0}>مسح الكل</button>
        {result.missingGrades > 0 && <span className="tiny">⚠ {result.missingGrades} مقرر بدون علامة (لا يدخل في الحساب)</span>}
      </div>
    </div>
  );
}

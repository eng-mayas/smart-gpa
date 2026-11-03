import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SCALE, US_SCALE, markToBand, letterToBand, minBandForPoints, isValidMark, gpaToPercent } from "../src/core/grading";
import { calculateSemester, calculateCumulative, combineCgpa, newCourse } from "../src/core/gpa";
import { analyzeTarget, requiredSemesterGpa, hoursNeededAtGpa, minimumGradesForTarget, standardScenarios, runScenario, courseImpact } from "../src/core/predictor";
import { DRAFT_SY_PRIVATE_POLICY as P, INITIAL_STATE, transition, evaluateHistory, nextThresholds, AcademicState } from "../src/core/rules";

const close = (a: number | null, b: number, eps = 1e-9) => {
  assert.ok(a !== null, "expected a number");
  assert.ok(Math.abs(a - b) < eps, `expected ${a} ≈ ${b}`);
};

describe("grading scale boundaries", () => {
  test("every boundary of the provided table maps correctly", () => {
    const cases: [number, string, number][] = [
      [100, "A+", 4], [98, "A+", 4], [97, "A", 3.75], [95, "A", 3.75], [94, "A-", 3.5], [90, "A-", 3.5],
      [89, "B+", 3.25], [85, "B+", 3.25], [84, "B", 3], [80, "B", 3], [79, "B-", 2.75], [75, "B-", 2.75],
      [74, "C+", 2.5], [70, "C+", 2.5], [69, "C", 2.25], [65, "C", 2.25], [64, "C-", 2], [60, "C-", 2],
      [59, "D+", 1.75], [55, "D+", 1.75], [54, "D", 1.5], [50, "D", 1.5], [49, "F", 0], [0, "F", 0],
    ];
    for (const [mark, letter, pts] of cases) {
      const b = markToBand(mark);
      assert.equal(b.letter, letter, `mark ${mark}`);
      assert.equal(b.points, pts, `mark ${mark}`);
    }
  });
  test("scale covers 0..100 with no gaps or overlaps", () => {
    for (let m = 0; m <= 100; m++) {
      const hits = DEFAULT_SCALE.bands.filter((b) => m >= b.min && m <= b.max);
      assert.equal(hits.length, 1, `mark ${m}`);
    }
  });
  test("invalid marks are rejected", () => {
    assert.equal(isValidMark(-1), false);
    assert.equal(isValidMark(101), false);
    assert.equal(isValidMark(NaN), false);
    assert.throws(() => markToBand(120));
  });
  test("letters are case-insensitive and whitespace-tolerant", () => {
    assert.equal(letterToBand(" b+ ")?.points, 3.25);
    assert.equal(letterToBand("x"), undefined);
  });
  test("percentage equivalent uses the scale's official formula (gpa × 20 + 20)", () => {
    assert.equal(gpaToPercent(4, DEFAULT_SCALE), 100);
    assert.equal(gpaToPercent(2, DEFAULT_SCALE), 60);
    assert.equal(gpaToPercent(3.25, DEFAULT_SCALE), 85);
    assert.equal(gpaToPercent(2, US_SCALE), 50); // fallback gpa/max×100
  });
  test("minBandForPoints picks the lowest band satisfying the requirement", () => {
    assert.equal(minBandForPoints(2.0)?.letter, "C-");
    assert.equal(minBandForPoints(2.01)?.letter, "C");
    assert.equal(minBandForPoints(4.01), undefined);
  });
});

describe("semester GPA", () => {
  test("weighted average", () => {
    const r = calculateSemester([
      newCourse({ credits: 3, grade: { kind: "mark", value: 85 } }), // B+ 3.25
      newCourse({ credits: 2, grade: { kind: "letter", value: "A" } }), // 3.75
      newCourse({ credits: 4, grade: { kind: "mark", value: 45 } }), // F 0
    ]);
    close(r.gpa, (3.25 * 3 + 3.75 * 2 + 0) / 9);
    assert.equal(r.gpaCredits, 9);
    assert.equal(r.earnedCredits, 5);
    assert.equal(r.failedCourses, 1);
    // percentage average uses only mark-entered courses: (85×3 + 45×4) / 7
    close(r.markAverage, (85 * 3 + 45 * 4) / 7);
    assert.equal(r.markCredits, 7);
  });
  test("zero-credit, withdrawn, excluded and pass/fail do not affect GPA", () => {
    const r = calculateSemester([
      newCourse({ credits: 3, grade: { kind: "letter", value: "B" } }),
      newCourse({ credits: 0, grade: { kind: "letter", value: "A+" } }),
      newCourse({ credits: 3, grade: { kind: "letter", value: "F" }, status: "withdrawn" }),
      newCourse({ credits: 3, grade: { kind: "letter", value: "A+" }, status: "excluded" }),
      newCourse({ credits: 2, grade: { kind: "mark", value: 70 }, status: "passfail" }),
    ]);
    close(r.gpa, 3.0);
    assert.equal(r.gpaCredits, 3);
    assert.equal(r.earnedCredits, 5); // 3 + 0 + 2 (pass/fail passed)
  });
  test("missing grades are counted and GPA is null when nothing is gradable", () => {
    const r = calculateSemester([newCourse({ credits: 3 })]);
    assert.equal(r.gpa, null);
    assert.equal(r.missingGrades, 1);
  });
  test("invalid credits produce an error, not a crash", () => {
    const r = calculateSemester([newCourse({ credits: -3, grade: { kind: "letter", value: "A" } })]);
    assert.ok(r.courses[0].error);
    assert.equal(r.gpa, null);
  });
});

describe("cumulative GPA", () => {
  test("standard formula", () => {
    const sem = calculateSemester([newCourse({ credits: 18, grade: { kind: "letter", value: "B" } })]);
    const c = calculateCumulative({ previousCgpa: 1.75, previousGpaHours: 60, semester: sem });
    close(c.newCgpa, (1.75 * 60 + 3 * 18) / 78);
    close(c.delta, (1.75 * 60 + 3 * 18) / 78 - 1.75);
  });
  test("repeated course replaces the old attempt (hours not double counted)", () => {
    // Previously: 30 hours at 2.0 = 60 points, including a 3-credit F (0 pts).
    const sem = calculateSemester([
      newCourse({ credits: 3, grade: { kind: "letter", value: "B" }, status: "repeat", previousPoints: 0 }),
    ]);
    const c = calculateCumulative({ previousCgpa: 2.0, previousGpaHours: 30, semester: sem });
    assert.equal(c.totalGpaHours, 30);
    close(c.newCgpa, (60 - 0 + 9) / 30);
  });
  test("repeating a passed course removes its old points", () => {
    const sem = calculateSemester([
      newCourse({ credits: 3, grade: { kind: "letter", value: "A+" }, status: "repeat", previousPoints: 1.5 }),
    ]);
    const c = calculateCumulative({ previousCgpa: 2.0, previousGpaHours: 30, semester: sem });
    close(c.newCgpa, (60 - 4.5 + 12) / 30);
  });
  test("first semester (no previous hours)", () => {
    const sem = calculateSemester([newCourse({ credits: 3, grade: { kind: "letter", value: "A" } })]);
    const c = calculateCumulative({ previousCgpa: 0, previousGpaHours: 0, semester: sem });
    close(c.newCgpa, 3.75);
    assert.equal(c.delta, null);
  });
  test("full precision internally", () => {
    close(combineCgpa(2.333333333, 15, 2.0, 15), (2.333333333 * 15 + 30) / 30, 1e-12);
  });
});

describe("target predictor", () => {
  test("example from spec: 1.75 over 60h, 18h semester, target 2.00", () => {
    const req = requiredSemesterGpa({ previousCgpa: 1.75, previousGpaHours: 60, semesterHours: 18, targetCgpa: 2.0 });
    close(req, (2 * 78 - 1.75 * 60) / 18); // 2.8333
    const a = analyzeTarget({ previousCgpa: 1.75, previousGpaHours: 60, semesterHours: 18, targetCgpa: 2.0 });
    assert.equal(a.achievable, true);
    assert.equal(a.uniformLetter, "B"); // 3.00 ≥ 2.833, B- (2.75) insufficient
  });
  test("impossible target explains and computes alternative plan", () => {
    const a = analyzeTarget({ previousCgpa: 1.0, previousGpaHours: 90, semesterHours: 12, targetCgpa: 2.0 });
    assert.equal(a.achievable, false);
    assert.ok(a.reason);
    // (P + 4h)/(H + h) = 2 → h = (2·90 − 90)/(4 − 2) = 45
    assert.equal(a.hoursNeededAtMax, 45);
    assert.equal(a.semestersNeededAtMax, 4);
    assert.equal(hoursNeededAtGpa(1.0, 90, 2.0, 2.0), null); // never reachable at 2.0 exactly
  });
  test("already-met target requires ≤ 0", () => {
    const req = requiredSemesterGpa({ previousCgpa: 3.5, previousGpaHours: 30, semesterHours: 15, targetCgpa: 2.0 });
    assert.ok(req! < 0);
  });
  test("minimum grades greedy allocation reaches the target", () => {
    const courses = [
      newCourse({ id: "a", credits: 4 }), newCourse({ id: "b", credits: 3 }), newCourse({ id: "c", credits: 2 }),
    ];
    const r = minimumGradesForTarget(courses, 1.75, 60, 2.0);
    assert.equal(r.feasible, true);
    const sem = calculateSemester(courses.map((c) => ({ ...c, grade: { kind: "letter", value: r.perCourse!.find((p) => p.course.id === c.id)!.letter } })));
    const cg = combineCgpa(1.75, 60, sem.gpa!, 9);
    assert.ok(cg >= 2.0 - 1e-9);
  });
  test("scenarios and impact", () => {
    const courses = [newCourse({ credits: 4 }), newCourse({ credits: 2 })];
    const sc = standardScenarios(courses);
    assert.equal(sc.length, 5);
    const out = runScenario(sc[0], 2.0, 30);
    close(out.semester.gpa, 2.25);
    const imp = courseImpact(courses, 2.0, 30);
    assert.equal(imp[0].course.credits, 4);
    close(imp[0].impact, (4 * 4) / 36);
  });
});

describe("academic rules FSM (draft policy)", () => {
  const step = (s: AcademicState, cgpa: number | null, credits = 0) => transition(s, cgpa, P, credits).to;

  test("CGPA not evaluated before semester 2", () => {
    const t = transition(INITIAL_STATE, 1.2, P);
    assert.equal(t.evaluated, false);
    assert.equal(t.to.status, "not_evaluated");
  });
  test("end of semester 2 branches", () => {
    const s1 = step(INITIAL_STATE, null);
    assert.equal(step(s1, 2.0).status, "good");
    assert.equal(step(s1, 1.999).status, "warning_1");
    assert.equal(step(s1, 1.0).status, "warning_1");
    assert.equal(step(s1, 0.999).status, "dismissed_specialization");
  });
  test("warning 1 → lift / warning 2 / dismissal", () => {
    const w1: AcademicState = { ...INITIAL_STATE, status: "warning_1", warnings: 1, semesterIndex: 2 };
    assert.equal(step(w1, 2.0).status, "good");
    assert.equal(step(w1, 1.5).status, "warning_2");
    assert.equal(step(w1, 1.5).warnings, 2);
    assert.equal(step(w1, 0.5).status, "dismissed_specialization");
  });
  test("after final warning: long and short remedial tracks", () => {
    const w2: AcademicState = { ...INITIAL_STATE, status: "warning_2", warnings: 2, semesterIndex: 3 };
    const long = step(w2, 1.5);
    assert.equal(long.status, "remedial_long");
    assert.equal(long.remaining, 2);
    const short = step(w2, 1.49);
    assert.equal(short.status, "remedial_short");
    assert.equal(short.remaining, 1);
    assert.equal(step(w2, 2.1).status, "good");
  });
  test("short remedial → second remedial or dismissal", () => {
    const s: AcademicState = { ...INITIAL_STATE, status: "remedial_short", warnings: 2, remaining: 1, semesterIndex: 4 };
    assert.equal(step(s, 1.5).status, "remedial_long");
    assert.equal(step(s, 1.5).remaining, 1);
    assert.equal(step(s, 1.3).status, "dismissed_specialization");
    assert.equal(step(s, 2.0).status, "good");
  });
  test("long remedial exhausts → university dismissal unless exception applies", () => {
    const r2: AcademicState = { ...INITIAL_STATE, status: "remedial_long", warnings: 2, remaining: 2, semesterIndex: 4 };
    const r1 = step(r2, 1.6);
    assert.equal(r1.status, "remedial_long");
    assert.equal(r1.remaining, 1);
    assert.equal(step(r1, 1.6, 50).status, "dismissed_university");
    const ex = step(r1, 1.8, 99);
    assert.equal(ex.status, "exception");
    assert.equal(ex.remaining, 2);
    assert.equal(ex.exceptionUsed, true);
    assert.equal(step(r1, 1.74, 120).status, "dismissed_university"); // CGPA below exception threshold
  });
  test("exception exhausts → dismissal; recovery → good", () => {
    const e: AcademicState = { ...INITIAL_STATE, status: "exception", warnings: 2, remaining: 1, exceptionUsed: true, semesterIndex: 7 };
    assert.equal(step(e, 1.9).status, "dismissed_university");
    assert.equal(step(e, 2.0).status, "good");
  });
  test("terminal states absorb", () => {
    const d: AcademicState = { ...INITIAL_STATE, status: "dismissed_university", semesterIndex: 8 };
    const t = transition(d, 3.5, P);
    assert.equal(t.to.status, "dismissed_university");
    assert.equal(t.evaluated, false);
  });
  test("null CGPA never produces a status decision", () => {
    const g: AcademicState = { ...INITIAL_STATE, status: "good", semesterIndex: 3 };
    const t = transition(g, null, P);
    assert.equal(t.evaluated, false);
    assert.equal(t.to.status, "good");
  });
  test("history replay", () => {
    const tl = evaluateHistory(
      [
        { label: "F1", gpa: 1.2, gpaHours: 15 },
        { label: "F2", gpa: 1.4, gpaHours: 15 }, // cgpa 1.3 → warning 1
        { label: "F3", gpa: 1.6, gpaHours: 15 }, // cgpa 1.4 → warning 2
        { label: "F4", gpa: 2.0, gpaHours: 15 }, // cgpa 1.55 → remedial_long(2)
        { label: "F5", gpa: 3.6, gpaHours: 15 }, // cgpa 1.96 → remedial_long(1)
        { label: "F6", gpa: 3.0, gpaHours: 15 }, // cgpa 2.133 → good
      ],
      P,
    );
    assert.deepEqual(
      tl.map((e) => e.transition.to.status),
      ["not_evaluated", "warning_1", "warning_2", "remedial_long", "remedial_long", "good"],
    );
    assert.equal(tl[5].transition.to.warnings, 2);
  });
  test("next thresholds reflect the stage", () => {
    assert.equal(nextThresholds({ ...INITIAL_STATE, status: "remedial_short", remaining: 1 }, P).survive, 1.5);
    assert.equal(nextThresholds({ ...INITIAL_STATE, status: "remedial_long", remaining: 1 }, P, 50).survive, 2.0);
    assert.equal(nextThresholds({ ...INITIAL_STATE, status: "remedial_long", remaining: 1 }, P, 99).survive, 1.75);
    assert.equal(nextThresholds({ ...INITIAL_STATE, status: "dismissed_university" }, P).survive, null);
  });
});

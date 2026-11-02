import React from "react";
import { AcademicState, AcademicStatus, STATUS_COLORS, STATUS_LABELS_AR, RiskLevel, riskLevel } from "../../core/rules";
import { fmtGpa } from "../../core/format";

export function Stat({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: string }) {
  return (
    <div className="stat" style={{ ["--accent" as string]: accent }}>
      <div className="label">{label}</div>
      <div className="value num">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export const COLOR_VAR: Record<string, string> = {
  green: "var(--green)", yellow: "var(--yellow)", orange: "var(--orange)", red: "var(--red)", gray: "var(--gray)", blue: "var(--primary)", teal: "var(--teal)",
};

export function StatusBadge({ status, lg }: { status: AcademicStatus; lg?: boolean }) {
  return <span className={`badge ${STATUS_COLORS[status]} ${lg ? "lg" : ""}`}>{STATUS_LABELS_AR[status]}</span>;
}

export const RISK_LABEL: Record<RiskLevel, string> = { none: "غير محدد", low: "منخفض", medium: "متوسط", high: "مرتفع", critical: "حرج" };
export const RISK_COLOR: Record<RiskLevel, string> = { none: "gray", low: "green", medium: "yellow", high: "orange", critical: "red" };

export function RiskBadge({ state }: { state: AcademicState }) {
  const r = riskLevel(state);
  return <span className={`badge ${RISK_COLOR[r]}`}>خطر {RISK_LABEL[r]}</span>;
}

export function NumberInput({
  value, onChange, min = 0, max = 100, step = 1, className = "", placeholder, invalid, ariaLabel,
}: {
  value: number | ""; onChange: (v: number | "") => void; min?: number; max?: number; step?: number; className?: string; placeholder?: string; invalid?: boolean; ariaLabel?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      className={`input num ${invalid ? "invalid" : ""} ${className}`}
      value={value}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "") return onChange("");
        const n = Number(v);
        onChange(Number.isFinite(n) ? n : "");
      }}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <span className="tiny">{hint}</span>}
    </label>
  );
}

/** Circular GPA gauge (0..max) */
export function Gauge({ value, max = 4, label, color }: { value: number | null; max?: number; label?: string; color?: string }) {
  const r = 62, c = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value / max));
  const stroke = color ?? (value === null ? "var(--gray)" : value >= 2 ? "var(--green)" : value >= 1.5 ? "var(--orange)" : "var(--red)");
  return (
    <div className="gauge" role="img" aria-label={`${label ?? ""} ${fmtGpa(value)}`}>
      <svg viewBox="0 0 150 150" width="150" height="150">
        <circle cx="75" cy="75" r={r} fill="none" stroke="var(--gray-soft)" strokeWidth="12" />
        <circle cx="75" cy="75" r={r} fill="none" stroke={stroke} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 75 75)" style={{ transition: "stroke-dasharray 0.4s" }} />
      </svg>
      <div className="center">
        <div>
          <b className="num">{fmtGpa(value)}</b>
          {label && <div className="tiny">{label}</div>}
        </div>
      </div>
    </div>
  );
}

/** Line chart with optional threshold lines; pure SVG, RTL-safe (numbers drawn LTR). */
export function LineChart({
  series, labels, max = 4, min = 0, thresholds = [], height = 220,
}: {
  series: { name: string; data: (number | null)[]; color: string }[];
  labels: string[];
  max?: number; min?: number;
  thresholds?: { value: number; label: string; color: string }[];
  height?: number;
}) {
  const w = 640, h = height, padL = 36, padR = 16, padT = 16, padB = 34;
  const n = labels.length;
  const x = (i: number) => padL + (n <= 1 ? (w - padL - padR) / 2 : (i * (w - padL - padR)) / (n - 1));
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (h - padT - padB);
  const ticks = [];
  for (let v = min; v <= max + 1e-9; v += (max - min) / 4) ticks.push(v);
  return (
    <div style={{ direction: "ltr" }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ overflow: "visible" }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray="3 4" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="chart-tip">{t.toFixed(1)}</text>
          </g>
        ))}
        {thresholds.map((t) => (
          <g key={t.label}>
            <line x1={padL} x2={w - padR} y1={y(t.value)} y2={y(t.value)} stroke={t.color} strokeWidth="1.5" strokeDasharray="6 4" />
            <text x={padL + 4} y={y(t.value) - 4} textAnchor="start" fontSize="11" fill={t.color} fontWeight={700}>{t.label}</text>
          </g>
        ))}
        {series.map((s, si) => {
          const pts = s.data.map((v, i) => (v === null ? null : [x(i), y(v)] as const));
          const d = pts.map((p, i) => (p ? `${i === 0 || !pts[i - 1] ? "M" : "L"}${p[0]},${p[1]}` : "")).join(" ");
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" />
              {pts.map((p, i) => p && (
                <g key={i}>
                  <circle cx={p[0]} cy={p[1]} r="4.5" fill="var(--bg-elev)" stroke={s.color} strokeWidth="2.5" />
                  <text x={p[0]} y={si % 2 === 0 ? p[1] + 18 : p[1] - 9} textAnchor="middle" fontSize="11" fill={s.color} fontWeight={700}>{s.data[i]!.toFixed(2)}</text>
                </g>
              ))}
            </g>
          );
        })}
        {labels.map((l, i) => (
          <text key={i} x={x(i)} y={h - 10} textAnchor="middle" className="chart-tip">{l}</text>
        ))}
      </svg>
      <div className="row" style={{ justifyContent: "center", gap: "1rem", direction: "rtl" }}>
        {series.map((s) => (
          <span key={s.name} className="tiny row" style={{ gap: "0.3rem" }}>
            <span style={{ width: 12, height: 3, background: s.color, display: "inline-block", borderRadius: 2 }} /> {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BarChart({ data, max, height = 180, color = "var(--primary)" }: { data: { label: string; value: number; color?: string }[]; max?: number; height?: number; color?: string }) {
  const m = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", height, padding: "0 0.3rem" }}>
      {data.map((d) => (
        <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
          <span className="tiny num">{d.value}</span>
          <div style={{ width: "100%", maxWidth: 46, height: Math.max(3, (d.value / m) * (height - 48)), background: d.color ?? color, borderRadius: "8px 8px 3px 3px", transition: "height 0.3s" }} />
          <span className="tiny">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Disclaimer({ text }: { text: string }) {
  return <p className="footer-note">⚖️ {text}</p>;
}

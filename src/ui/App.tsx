import React, { useEffect, useState } from "react";
import { useStore } from "../state/store";
import { makeT, Key } from "./i18n";
import { DashboardPage } from "./pages/DashboardPage";
import { SemesterPage } from "./pages/SemesterPage";
import { CumulativePage } from "./pages/CumulativePage";
import { PredictorPage } from "./pages/PredictorPage";
import { ExhaustionPage } from "./pages/ExhaustionPage";
import { WarningsPage } from "./pages/WarningsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { RegulationsPage } from "./pages/RegulationsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { Disclaimer } from "./components/common";

const ROUTES: { id: string; key: Key; icon: string }[] = [
  { id: "dashboard", key: "nav_dashboard", icon: "▦" },
  { id: "history", key: "nav_history", icon: "🗓" },
  { id: "semester", key: "nav_semester", icon: "∑" },
  { id: "cumulative", key: "nav_cumulative", icon: "Σ" },
  { id: "predictor", key: "nav_predictor", icon: "◎" },
  { id: "exhaustion", key: "nav_exhaustion", icon: "🛟" },
  { id: "warnings", key: "nav_warnings", icon: "⚠" },
  { id: "regulations", key: "nav_regulations", icon: "§" },
  { id: "settings", key: "nav_settings", icon: "⚙" },
];

function useHashRoute() {
  const get = () => (location.hash.replace(/^#\/?/, "") || "dashboard");
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const h = () => setRoute(get());
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  return [route, (r: string) => { location.hash = r; }] as const;
}

export function App() {
  const { state, dispatch } = useStore();
  const t = makeT(state.lang);
  const [route, go] = useHashRoute();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [route]);

  const page = (() => {
    switch (route) {
      case "semester": return <SemesterPage />;
      case "cumulative": return <CumulativePage />;
      case "predictor": return <PredictorPage />;
      case "exhaustion": return <ExhaustionPage />;
      case "warnings": return <WarningsPage />;
      case "history": return <HistoryPage />;
      case "regulations": return <RegulationsPage />;
      case "settings": return <SettingsPage />;
      default: return <DashboardPage go={go} />;
    }
  })();

  return (
    <div className="app">
      {open && <div className="backdrop" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <div className="logo"><img src="./atmata-logo.png" alt="Atmata Group" width={42} height={42} /></div>
          <div><b>{t("appName")}</b><small>{t("brandSub")}</small></div>
        </div>
        <nav className="nav stack" style={{ gap: 2 }}>
          {ROUTES.map((r) => (
            <a key={r.id} href={`#${r.id}`} className={route === r.id ? "active" : ""}>
              <span className="ic">{r.icon}</span>{t(r.key)}
            </a>
          ))}
        </nav>
        <div className="spacer" />
        <div className="row" style={{ padding: "0 0.4rem" }}>
          <button className="btn sm" onClick={() => dispatch({ type: "set", patch: { theme: state.theme === "light" ? "dark" : "light" } })}>
            {state.theme === "light" ? "🌙 " + t("theme_dark") : "☀ " + t("theme_light")}
          </button>
          <button className="btn sm" onClick={() => dispatch({ type: "set", patch: { lang: state.lang === "ar" ? "en" : "ar" } })}>
            {state.lang === "ar" ? "EN" : "ع"}
          </button>
        </div>
      </aside>
      <main className="main">
        <button className="btn menu-btn mb" onClick={() => setOpen(true)} aria-label="القائمة">☰ {t("appName")}</button>
        {page}
        <div className="credit">
          <img src="./atmata-logo.png" alt="Atmata Group" />
          <div>
            <div>{t("developedBy")} <b>Atmata Group</b> — أتمتة غروب</div>
            <div className="en">Automating Tomorrow</div>
          </div>
        </div>
        <Disclaimer text={t("disclaimer")} />
      </main>
    </div>
  );
}

import { useState, useEffect, useRef, createContext, useContext } from "react";

const API_BASE = "http://localhost:8000";
async function api(path, opts = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers: { "Content-Type": "application/json", ...opts.headers }, ...opts });
    return await res.json();
  } catch (e) { return { error: e.message }; }
}

const ThemeCtx = createContext();
const useTheme = () => useContext(ThemeCtx);

const THEMES = {
  dark: {
    name: "dark",
    bg: "#03060f",
    bgCard: "rgba(6,14,30,0.85)",
    bgInput: "rgba(0,229,255,0.04)",
    bgSidebar: "rgba(3,8,20,0.98)",
    bgTopbar: "rgba(3,6,15,0.95)",
    bgHover: "rgba(0,229,255,0.06)",
    bgTableRow: "rgba(0,229,255,0.025)",
    text: "#94b8d4",
    textMuted: "#4a6a82",
    textDim: "#1e3347",
    textBright: "#e8f4ff",
    border: "rgba(0,229,255,0.12)",
    borderAccent: "rgba(0,229,255,0.25)",
    borderInput: "rgba(0,229,255,0.2)",
    accent: "#00e5ff",
    accentGlow: "rgba(0,229,255,0.3)",
    accentDim: "rgba(0,229,255,0.15)",
    green: "#00ffa3",
    red: "#ff2d55",
    orange: "#ff6b1a",
    yellow: "#ffd60a",
    pink: "#bf5af2",
    blue: "#0a84ff",
    violet: "#a855f7",
    termBg: "rgba(0,8,16,0.95)",
    termBorder: "rgba(0,255,163,0.2)",
    termText: "#00ffa3",
    termPrompt: "#00e5ff",
    scrollTrack: "transparent",
    scrollThumb: "rgba(0,229,255,0.2)",
    cardShadow: "0 0 40px rgba(0,229,255,0.04), inset 0 1px 0 rgba(0,229,255,0.08)",
    sideText: "#00e5ff",
    sideTextDim: "#2a4a62",
    sideActive: "rgba(0,229,255,0.08)",
    sideActiveBorder: "#00e5ff",
    sideHover: "#94b8d4",
    sideClock: "#00e5ff",
    sideClockDim: "#1e5070",
    gradStart: "#00e5ff",
    gradEnd: "#a855f7",
  },
  light: {
    name: "light",
    bg: "#f0f4f8",
    bgCard: "rgba(255,255,255,0.9)",
    bgInput: "rgba(14,52,96,0.04)",
    bgSidebar: "rgba(10,20,40,0.97)",
    bgTopbar: "rgba(248,251,255,0.95)",
    bgHover: "rgba(14,52,96,0.05)",
    bgTableRow: "rgba(14,52,96,0.025)",
    text: "#334e68",
    textMuted: "#627d98",
    textDim: "#bcccdc",
    textBright: "#102a43",
    border: "rgba(14,52,96,0.12)",
    borderAccent: "rgba(14,52,96,0.2)",
    borderInput: "rgba(14,52,96,0.2)",
    accent: "#0077b6",
    accentGlow: "rgba(0,119,182,0.25)",
    accentDim: "rgba(0,119,182,0.1)",
    green: "#00875a",
    red: "#c0392b",
    orange: "#d35400",
    yellow: "#9a7b00",
    pink: "#7c3aed",
    blue: "#0060df",
    violet: "#7c3aed",
    termBg: "rgba(10,20,40,0.97)",
    termBorder: "rgba(0,135,90,0.3)",
    termText: "#00ffa3",
    termPrompt: "#00e5ff",
    scrollTrack: "transparent",
    scrollThumb: "rgba(0,119,182,0.25)",
    cardShadow: "0 4px 24px rgba(14,52,96,0.08), 0 1px 4px rgba(14,52,96,0.06)",
    sideText: "#00e5ff",
    sideTextDim: "rgba(255,255,255,0.35)",
    sideActive: "rgba(0,229,255,0.12)",
    sideActiveBorder: "#00e5ff",
    sideHover: "rgba(255,255,255,0.7)",
    sideClock: "#00e5ff",
    sideClockDim: "rgba(255,255,255,0.3)",
    gradStart: "#0077b6",
    gradEnd: "#7c3aed",
  },
};

const SEV = { critical: "red", high: "orange", medium: "yellow", low: "blue", info: "green" };
const SEC_COLORS = { open: "red", wep: "orange", wpa: "yellow", wpa2: "blue", wpa3: "green", unknown: "textDim" };
function tc(t, k) { return t[k] || k; }

// ═══════ GLOBAL STYLES ═══════
function GlobalStyles({ t }) {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: ${t.bg}; }
      ::-webkit-scrollbar { width: 4px; height: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: ${t.scrollThumb}; border-radius: 2px; }
      input, select, textarea { font-family: 'Space Mono', monospace !important; }
      input:focus, select:focus { outline: none; border-color: ${t.accent} !important; box-shadow: 0 0 0 1px ${t.accentDim}, 0 0 16px ${t.accentDim}; }
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      @keyframes ping { 0%{transform:scale(1);opacity:1} 75%,100%{transform:scale(2);opacity:0} }
      @keyframes slideIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      @keyframes borderRotate { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
      @keyframes gridScroll { 0%{transform:translateY(0)} 100%{transform:translateY(40px)} }
      @keyframes glitch1 { 0%,100%{clip-path:inset(0 0 98% 0)} 20%{clip-path:inset(33% 0 60% 0)} 40%{clip-path:inset(70% 0 10% 0)} 60%{clip-path:inset(10% 0 85% 0)} 80%{clip-path:inset(50% 0 40% 0)} }
      @keyframes glitch2 { 0%,100%{clip-path:inset(0 0 98% 0);transform:translateX(-2px)} 20%{clip-path:inset(80% 0 0% 0);transform:translateX(2px)} 40%{clip-path:inset(20% 0 70% 0);transform:translateX(-1px)} 60%{clip-path:inset(60% 0 30% 0);transform:translateX(2px)} 80%{clip-path:inset(10% 0 80% 0);transform:translateX(-2px)} }
      .nav-item { transition: all 0.18s cubic-bezier(0.4,0,0.2,1); }
      .nav-item:hover { background: ${t.sideActive}; }
      .btn-glow:hover { box-shadow: 0 0 24px var(--btn-glow-color, ${t.accentGlow}); }
      .card-hover:hover { border-color: ${t.borderAccent}; transform: translateY(-1px); }
      .tr-hover:hover { background: ${t.bgHover} !important; }
      .page-content { animation: slideIn 0.25s ease; }
    `}</style>
  );
}

// ═══════ BACKGROUND GRID ═══════
function GridBg({ t }) {
  if (t.name === "light") return null;
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
      <div style={{
        position: "absolute", inset: "-40px",
        backgroundImage: `linear-gradient(${t.border} 1px, transparent 1px), linear-gradient(90deg, ${t.border} 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
        animation: "gridScroll 8s linear infinite",
        maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
      }} />
      <div style={{ position: "absolute", top: "20%", left: "30%", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, ${t.accentDim} 0%, transparent 70%)`, filter: "blur(60px)", opacity: 0.3 }} />
      <div style={{ position: "absolute", bottom: "10%", right: "20%", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%)`, filter: "blur(60px)", opacity: 0.4 }} />
    </div>
  );
}

// ═══════ COMPONENTS ═══════

function GlitchText({ text, style: sx = {} }) {
  const t = useTheme();
  return (
    <div style={{ position: "relative", display: "inline-block", marginBottom: 24, ...sx }}>
      <h2 style={{
        fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: 15,
        color: t.accent, letterSpacing: "0.2em", textTransform: "uppercase",
        textShadow: t.name === "dark" ? `0 0 20px ${t.accentGlow}` : "none",
      }}>{text}</h2>
      {t.name === "dark" && <>
        <h2 aria-hidden style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: 15, color: t.violet, letterSpacing: "0.2em", textTransform: "uppercase", position: "absolute", top: 0, left: 0, animation: "glitch1 4s infinite", opacity: 0.5 }}>{text}</h2>
        <h2 aria-hidden style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: 15, color: "#ff2d55", letterSpacing: "0.2em", textTransform: "uppercase", position: "absolute", top: 0, left: 0, animation: "glitch2 4s infinite 0.1s", opacity: 0.4 }}>{text}</h2>
      </>}
      <div style={{ position: "absolute", bottom: -6, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, ${t.accent}, ${t.violet}, transparent)` }} />
    </div>
  );
}

function TerminalLog({ lines = [], maxH = 200 }) {
  const t = useTheme(); const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [lines]);
  return (
    <div ref={ref} style={{
      background: t.termBg, border: `1px solid ${t.termBorder}`, borderRadius: 8,
      padding: "12px 14px", fontFamily: "'Space Mono', monospace", fontSize: 11,
      color: t.termText, maxHeight: maxH, overflowY: "auto", whiteSpace: "pre-wrap",
      wordBreak: "break-all", lineHeight: 1.7,
      boxShadow: `inset 0 0 30px rgba(0,255,163,0.03), 0 0 20px rgba(0,255,163,0.05)`,
    }}>
      {lines.length === 0 && <span style={{ color: t.textDim, fontStyle: "italic" }}>// awaiting output...</span>}
      {lines.map((l, i) => (
        <div key={i} style={{ marginBottom: 2 }}>
          <span style={{ color: t.termPrompt, marginRight: 8 }}>❯</span>
          <span>{l}</span>
        </div>
      ))}
    </div>
  );
}

function Badge({ children, color = "accent", small = false }) {
  const t = useTheme(); const c = tc(t, color);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: small ? "2px 7px" : "3px 10px",
      borderRadius: 4, background: c + "18", color: c,
      border: `1px solid ${c}30`,
      fontSize: small ? 9 : 10, fontFamily: "'Space Mono', monospace",
      textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700,
    }}>
      {children}
    </span>
  );
}

function StatusDot({ color = "green" }) {
  const t = useTheme(); const c = tc(t, color);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 10, height: 10 }}>
      <span style={{ position: "absolute", width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.3, animation: "ping 1.5s ease-in-out infinite" }} />
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c, boxShadow: `0 0 6px ${c}` }} />
    </span>
  );
}

function Btn({ children, onClick, color = "accent", disabled = false, small = false, danger = false, style: sx = {} }) {
  const t = useTheme();
  const c = tc(t, danger ? "red" : color);
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      className="btn-glow"
      style={{
        "--btn-glow-color": c + "44",
        padding: small ? "5px 12px" : "9px 20px",
        background: disabled ? "rgba(255,255,255,0.03)" : hov ? c + "22" : c + "12",
        color: disabled ? t.textDim : c,
        border: `1px solid ${disabled ? t.border : c + "50"}`,
        borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'Space Mono', monospace", fontSize: small ? 10 : 11,
        letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700,
        transition: "all 0.18s ease", display: "inline-flex", alignItems: "center", gap: 6,
        ...sx
      }}
    >{children}</button>
  );
}

function Input({ label, value, onChange, placeholder, type = "text", style: sx = {} }) {
  const t = useTheme();
  return (
    <div style={{ marginBottom: 12, ...sx }}>
      {label && (
        <label style={{
          display: "block", fontSize: 9, color: t.accent, textTransform: "uppercase",
          letterSpacing: "0.15em", marginBottom: 5, fontFamily: "'Orbitron', sans-serif", fontWeight: 700,
        }}>{label}</label>
      )}
      <input
        type={type} value={value}
        onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{
          width: "100%", padding: "8px 12px",
          background: t.bgInput, border: `1px solid ${t.borderInput}`,
          borderRadius: 6, color: t.textBright, fontFamily: "'Space Mono', monospace",
          fontSize: 11, transition: "all 0.18s ease",
        }}
      />
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  const t = useTheme();
  return (
    <div style={{ marginBottom: 12 }}>
      {label && (
        <label style={{
          display: "block", fontSize: 9, color: t.accent, textTransform: "uppercase",
          letterSpacing: "0.15em", marginBottom: 5, fontFamily: "'Orbitron', sans-serif", fontWeight: 700,
        }}>{label}</label>
      )}
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", padding: "8px 12px",
          background: t.bgInput, border: `1px solid ${t.borderInput}`,
          borderRadius: 6, color: t.textBright, fontFamily: "'Space Mono', monospace",
          fontSize: 11,
        }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Card({ title, children, color = "accent", style: sx = {} }) {
  const t = useTheme(); const c = tc(t, color);
  return (
    <div className="card-hover" style={{
      background: t.bgCard, border: `1px solid ${c}20`,
      borderRadius: 10, padding: "16px 18px", marginBottom: 14,
      borderLeft: `2px solid ${c}`,
      boxShadow: t.cardShadow,
      backdropFilter: t.name === "dark" ? "blur(20px)" : "none",
      WebkitBackdropFilter: t.name === "dark" ? "blur(20px)" : "none",
      transition: "all 0.2s ease",
      ...sx
    }}>
      {title && (
        <div style={{
          fontSize: 9, color: c, textTransform: "uppercase", letterSpacing: "0.18em",
          marginBottom: 14, fontFamily: "'Orbitron', sans-serif", fontWeight: 700,
          borderBottom: `1px solid ${c}15`, paddingBottom: 8,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <div style={{ width: 3, height: 3, borderRadius: "50%", background: c, boxShadow: `0 0 6px ${c}` }} />
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function DataTable({ columns, data, onRowClick }) {
  const t = useTheme();
  return (
    <div style={{ overflowX: "auto", borderRadius: 6, border: `1px solid ${t.border}` }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Space Mono', monospace", fontSize: 11 }}>
        <thead>
          <tr style={{ background: t.bgHover }}>
            {columns.map((c) => (
              <th key={c.key} style={{
                textAlign: "left", padding: "8px 12px", color: t.accent,
                fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em",
                fontFamily: "'Orbitron', sans-serif", fontWeight: 700,
                borderBottom: `1px solid ${t.border}`, whiteSpace: "nowrap",
              }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i} className="tr-hover"
              onClick={() => onRowClick?.(row)}
              style={{ cursor: onRowClick ? "pointer" : "default", borderBottom: `1px solid ${t.border}`, transition: "background 0.15s" }}
            >
              {columns.map((c) => (
                <td key={c.key} style={{ padding: "7px 12px", color: t.text, whiteSpace: "nowrap" }}>
                  {c.render ? c.render(row[c.key], row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={{ padding: 32, textAlign: "center", color: t.textDim, fontStyle: "italic" }}>
                // no data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, color = "accent", icon }) {
  const t = useTheme(); const c = tc(t, color);
  return (
    <div style={{
      background: t.bgCard, border: `1px solid ${c}25`,
      borderRadius: 10, padding: "14px 18px", minWidth: 110, flex: 1,
      boxShadow: t.cardShadow, position: "relative", overflow: "hidden",
      backdropFilter: t.name === "dark" ? "blur(20px)" : "none",
    }}>
      <div style={{
        position: "absolute", top: 0, right: 0, width: 60, height: 60,
        background: `radial-gradient(circle at top right, ${c}15, transparent 70%)`,
        borderRadius: "0 10px 0 60px",
      }} />
      <div style={{ fontSize: 9, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.15em", fontFamily: "'Orbitron', sans-serif", fontWeight: 700, marginBottom: 8 }}>
        {icon && <span style={{ marginRight: 6, fontSize: 12 }}>{icon}</span>}{label}
      </div>
      <div style={{ fontSize: 24, color: c, fontFamily: "'Orbitron', sans-serif", fontWeight: 700, textShadow: t.name === "dark" ? `0 0 20px ${c}66` : "none" }}>{value}</div>
    </div>
  );
}

function Chk({ label, checked, onChange }) {
  const t = useTheme();
  return (
    <label style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: t.textMuted, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
      <div style={{
        width: 16, height: 16, borderRadius: 4, border: `1px solid ${checked ? t.accent : t.border}`,
        background: checked ? t.accent + "20" : "transparent", display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s", flexShrink: 0,
      }}>
        {checked && <div style={{ width: 8, height: 8, borderRadius: 2, background: t.accent }} />}
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ display: "none" }} />
      {label}
    </label>
  );
}

// ═══════ PAGES ═══════

function DashboardPage() {
  const t = useTheme();
  const [pf, setPf] = useState(null); const [ld, setLd] = useState(false);
  const run = async () => { setLd(true); setPf(await api("/system/preflight")); setLd(false); };
  useEffect(() => { run(); }, []);
  const tools = pf?.tools || {}; const inst = Object.values(tools).filter(x => x.installed).length; const tot = Object.keys(tools).length;
  return (
    <div className="page-content">
      <GlitchText text="// SYSTEM OVERVIEW" />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <Stat label="Status" value={pf?.ready ? "READY" : "OFFLINE"} color={pf?.ready ? "green" : "red"} icon="◉" />
        <Stat label="Root Access" value={pf?.system?.is_root ? "YES" : "NO"} color={pf?.system?.is_root ? "green" : "red"} icon="⚡" />
        <Stat label="Tools" value={`${inst}/${tot}`} color={inst === tot ? "green" : "yellow"} icon="⚙" />
        <Stat label="OS" value={pf?.system?.release?.slice(0, 14) || "—"} color="accent" icon="▣" />
      </div>
      {pf?.missing_critical?.length > 0 && (
        <Card title="Missing Critical Tools" color="red">
          {pf.missing_critical.map(x => (
            <div key={x} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 10px", background: "rgba(255,45,85,0.05)", borderRadius: 6, marginBottom: 6, fontFamily: "'Space Mono', monospace", fontSize: 11 }}>
              <span style={{ color: t.red }}>✗</span>
              <span style={{ color: t.textBright }}>{x}</span>
              <span style={{ color: t.textMuted }}>→</span>
              <code style={{ color: t.yellow, background: "rgba(255,214,10,0.08)", padding: "2px 8px", borderRadius: 4 }}>apt install {tools[x]?.package}</code>
            </div>
          ))}
        </Card>
      )}
      <Card title="Tool Status">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
          {Object.entries(tools).map(([n, info]) => (
            <div key={n} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 12px", background: t.bgTableRow, borderRadius: 6,
              border: `1px solid ${info.installed ? t.green + "20" : t.red + "20"}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <StatusDot color={info.installed ? "green" : "red"} />
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: t.text }}>{n}</span>
              </div>
              <Badge color={info.installed ? "green" : "red"} small>{info.installed ? "OK" : "MISS"}</Badge>
            </div>
          ))}
        </div>
      </Card>
      {pf?.warnings?.map((w, i) => (
        <div key={i} style={{ padding: "10px 14px", background: "rgba(255,214,10,0.05)", border: `1px solid rgba(255,214,10,0.2)`, borderLeft: `2px solid ${t.yellow}`, borderRadius: 6, color: t.yellow, fontSize: 11, fontFamily: "'Space Mono', monospace", marginBottom: 8 }}>
          ⚠ {w}
        </div>
      ))}
      <Btn onClick={run} disabled={ld}>{ld ? "⟳ Checking..." : "↺ Re-run Preflight"}</Btn>
    </div>
  );
}

function InterfacesPage() {
  const t = useTheme();
  const [ifaces, setIfaces] = useState([]); const [ld, setLd] = useState(false); const [log, setLog] = useState([]); const [mac, setMac] = useState("");
  const refresh = async () => { setLd(true); const d = await api("/interfaces/"); if (Array.isArray(d)) setIfaces(d); setLd(false); };
  useEffect(() => { refresh(); }, []);
  const addL = (m) => setLog(p => [...p, m]);
  return (
    <div className="page-content">
      <GlitchText text="// NETWORK INTERFACES" />
      <Btn onClick={refresh} disabled={ld} style={{ marginBottom: 16 }}>{ld ? "⟳ Scanning..." : "↺ Refresh"}</Btn>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", marginBottom: 20 }}>
        {ifaces.map(iface => (
          <Card key={iface.name} title={iface.name} color={iface.mode === "monitor" ? "green" : "accent"}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: t.textMuted, lineHeight: 2, marginBottom: 12 }}>
              {[["MAC", iface.mac], ["Driver", iface.driver || "?"], ["Chipset", iface.chipset || "?"]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 8 }}>
                  <span style={{ color: t.textDim, minWidth: 60 }}>{k}</span>
                  <span style={{ color: t.textBright }}>{v}</span>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <span style={{ color: t.textDim, minWidth: 60 }}>Mode</span>
                <Badge color={iface.mode === "monitor" ? "green" : "blue"}>{iface.mode}</Badge>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ color: t.textDim, minWidth: 60 }}>Status</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <StatusDot color={iface.is_up ? "green" : "red"} />
                  <span style={{ color: iface.is_up ? t.green : t.red }}>{iface.is_up ? "UP" : "DOWN"}</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {iface.mode === "managed"
                ? <Btn small onClick={async () => { addL(`airmon-ng start ${iface.name}`); addL(JSON.stringify(await api(`/interfaces/${iface.name}/monitor`, { method: "POST" }), null, 2)); refresh(); }} color="green">⚡ Enable Monitor</Btn>
                : <Btn small onClick={async () => { addL(`airmon-ng stop ${iface.name}`); addL(JSON.stringify(await api(`/interfaces/${iface.name}/managed`, { method: "POST" }), null, 2)); refresh(); }} color="yellow">↩ Restore Managed</Btn>}
              <Btn small onClick={async () => { addL(`macchanger ${mac || "-r"} ${iface.name}`); addL(JSON.stringify(await api(`/interfaces/${iface.name}/mac?new_mac=${mac || ""}`, { method: "POST" }), null, 2)); refresh(); }} color="pink">⟳ Change MAC</Btn>
            </div>
          </Card>
        ))}
        {ifaces.length === 0 && !ld && (
          <div style={{ color: t.textDim, fontFamily: "'Space Mono', monospace", fontSize: 11, padding: 20, textAlign: "center" }}>
            // no wireless interfaces detected
          </div>
        )}
      </div>
      <Input label="Custom MAC (empty = random)" value={mac} onChange={setMac} placeholder="AA:BB:CC:DD:EE:FF" />
      <Card title="Operation Log" color="green"><TerminalLog lines={log} maxH={180} /></Card>
    </div>
  );
}

function WifiScanPage() {
  const t = useTheme();
  const [iface, setIface] = useState("wlan0mon"); const [ch, setCh] = useState(""); const [dur, setDur] = useState("30"); const [tb, setTb] = useState("");
  const [scanning, setScanning] = useState(false); const [res, setRes] = useState(null); const [scans, setScans] = useState([]); const [sel, setSel] = useState(null);
  const doScan = async () => { setScanning(true); setRes(null); setRes(await api("/wifi/scan", { method: "POST", body: JSON.stringify({ interface: iface, duration: parseInt(dur) || 30, channel: ch ? parseInt(ch) : null, target_bssid: tb || null }) })); setScanning(false); };
  const loadScans = async () => { const d = await api("/wifi/scans"); if (Array.isArray(d)) setScans(d); };
  useEffect(() => { loadScans(); }, []);
  const aps = res?.access_points || [];
  const cols = [
    { key: "essid", label: "ESSID", render: v => <span style={{ color: t.textBright, fontWeight: 700 }}>{v || "<hidden>"}</span> },
    { key: "bssid", label: "BSSID", render: v => <span style={{ color: t.textMuted }}>{v}</span> },
    { key: "channel", label: "CH", render: v => <span style={{ color: t.accent }}>{v}</span> },
    { key: "power", label: "PWR", render: v => <span style={{ color: v > -50 ? t.green : v > -70 ? t.yellow : t.red, fontWeight: 700 }}>{v} dBm</span> },
    { key: "security", label: "Sec", render: v => <Badge color={SEC_COLORS[v] || "textDim"} small>{v}</Badge> },
    { key: "cipher", label: "Cipher" },
    { key: "wps", label: "WPS", render: v => v ? <Badge color="orange" small>YES</Badge> : <span style={{ color: t.textDim }}>—</span> },
    { key: "clients", label: "Cli", render: v => <span style={{ color: t.accent }}>{v?.length || 0}</span> },
    { key: "data_packets", label: "Data" },
  ];
  return (
    <div className="page-content">
      <GlitchText text="// WIFI SCANNER" />
      <Card title="Scan Configuration">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          <Input label="Interface" value={iface} onChange={setIface} />
          <Input label="Channel" value={ch} onChange={setCh} placeholder="all" />
          <Input label="Duration (s)" value={dur} onChange={setDur} />
          <Input label="BSSID Filter" value={tb} onChange={setTb} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <Btn onClick={doScan} disabled={scanning} color="green">{scanning ? "⟳ Scanning..." : "▶ Start Scan"}</Btn>
          <Btn onClick={loadScans} small color="blue">↻ Load Previous</Btn>
        </div>
      </Card>
      {scanning && (
        <div style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 13, color: t.accent, fontFamily: "'Orbitron', sans-serif", fontWeight: 700, letterSpacing: "0.2em", animation: "pulse 1.5s infinite", textShadow: `0 0 20px ${t.accentGlow}` }}>
            ◉ SCANNING — {dur}s
          </div>
          <div style={{ marginTop: 12, height: 2, background: `linear-gradient(90deg, transparent, ${t.accent}, transparent)`, animation: "pulse 1.5s infinite", borderRadius: 1 }} />
        </div>
      )}
      {res && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <Stat label="Networks" value={aps.length} color="accent" icon="📡" />
            <Stat label="Clients" value={res.client_count || 0} color="pink" icon="📱" />
            <Stat label="Open" value={aps.filter(a => a.security === "open").length} color="red" icon="⚠" />
            <Stat label="WPA2" value={aps.filter(a => a.security === "wpa2").length} color="blue" icon="🔒" />
          </div>
          <Card title={`Access Points (${aps.length})`}>
            <DataTable columns={cols} data={aps} onRowClick={setSel} />
          </Card>
        </>
      )}
      {sel && (
        <Card title={`AP Detail — ${sel.essid || sel.bssid}`} color="pink">
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: t.text, lineHeight: 2 }}>
            {Object.entries(sel).map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 12, borderBottom: `1px solid ${t.border}`, padding: "3px 0" }}>
                <span style={{ color: t.blue, minWidth: 120 }}>{k}</span>
                <span style={{ color: t.textBright }}>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
              </div>
            ))}
          </div>
          <Btn small onClick={() => setSel(null)} style={{ marginTop: 12 }}>✕ Close</Btn>
        </Card>
      )}
      {scans.length > 0 && (
        <Card title="Previous Scans">
          {scans.map(s => (
            <div key={s.id} onClick={async () => setRes(await api(`/wifi/scans/${s.id}`))}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: t.bgTableRow, borderRadius: 6, marginBottom: 6, fontFamily: "'Space Mono', monospace", fontSize: 11, color: t.textMuted, cursor: "pointer", border: `1px solid ${t.border}`, transition: "all 0.15s" }}>
              <span style={{ color: t.accent }}>#{s.id}</span>
              <span>{s.access_points?.length || 0} APs</span>
              <Badge color={s.status === "completed" ? "green" : "yellow"} small>{s.status}</Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function HandshakePage() {
  const t = useTheme();
  const [iface, setIface] = useState("wlan0mon"); const [bssid, setBssid] = useState(""); const [ch, setCh] = useState("6"); const [to, setTo] = useState("120");
  const [deauth, setDeauth] = useState(true); const [dpkts, setDpkts] = useState("10"); const [caping, setCaping] = useState(false); const [capR, setCapR] = useState(null);
  const [capFile, setCapFile] = useState(""); const [crBssid, setCrBssid] = useState(""); const [wl, setWl] = useState("rockyou.txt"); const [cracking, setCracking] = useState(false); const [crR, setCrR] = useState(null);
  const [dI, setDI] = useState("wlan0mon"); const [dB, setDB] = useState(""); const [dC, setDC] = useState(""); const [dN, setDN] = useState("50"); const [dR, setDR] = useState(null);
  const doCap = async () => { setCaping(true); setCapR(null); const r = await api("/wifi/handshake", { method: "POST", body: JSON.stringify({ interface: iface, target_bssid: bssid, channel: parseInt(ch), timeout: parseInt(to), deauth_first: deauth, deauth_packets: parseInt(dpkts) }) }); setCapR(r); if (r.capture_file) { setCapFile(r.capture_file); setCrBssid(bssid); } setCaping(false); };
  const doCrack = async () => { setCracking(true); setCrR(null); setCrR(await api("/wifi/crack", { method: "POST", body: JSON.stringify({ capture_file: capFile, target_bssid: crBssid, wordlist: wl }) })); setCracking(false); };
  const doDeauth = async () => { setDR(await api("/wifi/deauth", { method: "POST", body: JSON.stringify({ interface: dI, target_bssid: dB, client_mac: dC || null, packets: parseInt(dN), reason: "Audit" }) })); };
  return (
    <div className="page-content">
      <GlitchText text="// HANDSHAKE & CRACK" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card title="Phase 1 — Capture Handshake" color="green">
          <Input label="Interface" value={iface} onChange={setIface} />
          <Input label="Target BSSID" value={bssid} onChange={setBssid} placeholder="AA:BB:CC:DD:EE:FF" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Channel" value={ch} onChange={setCh} />
            <Input label="Timeout (s)" value={to} onChange={setTo} />
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
            <Chk label="Deauth first" checked={deauth} onChange={setDeauth} />
            {deauth && <Input label="Packets" value={dpkts} onChange={setDpkts} style={{ marginBottom: 0, width: 100 }} />}
          </div>
          <Btn onClick={doCap} disabled={caping || !bssid} color="green">{caping ? "⟳ Capturing..." : "▶ Capture"}</Btn>
          {capR && (
            <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 6, background: capR.handshake_captured ? "rgba(0,255,163,0.06)" : "rgba(255,45,85,0.06)", border: `1px solid ${capR.handshake_captured ? t.green : t.red}30` }}>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: capR.handshake_captured ? t.green : t.red, fontWeight: 700 }}>
                {capR.handshake_captured ? "✓ HANDSHAKE CAPTURED" : "✗ No handshake detected"}
              </div>
              {capR.capture_file && <div style={{ color: t.textDim, fontSize: 10, marginTop: 4, fontFamily: "'Space Mono', monospace" }}>→ {capR.capture_file}</div>}
            </div>
          )}
        </Card>
        <Card title="Phase 2 — Crack WPA Key" color="yellow">
          <Input label="Capture File" value={capFile} onChange={setCapFile} />
          <Input label="Target BSSID" value={crBssid} onChange={setCrBssid} />
          <Input label="Wordlist" value={wl} onChange={setWl} />
          <Btn onClick={doCrack} disabled={cracking || !capFile} color="yellow">{cracking ? "⟳ Cracking..." : "▶ Crack"}</Btn>
          {crR && (
            <div style={{ marginTop: 14 }}>
              {crR.success ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: t.green, fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: 13, marginBottom: 12 }}>✓ KEY FOUND</div>
                  <div style={{ fontSize: 18, color: t.yellow, fontFamily: "'Space Mono', monospace", fontWeight: 700, padding: "12px 20px", background: "rgba(255,214,10,0.08)", borderRadius: 8, border: `1px solid ${t.yellow}30`, display: "inline-block", textShadow: `0 0 20px ${t.yellow}66` }}>{crR.key}</div>
                </div>
              ) : <div style={{ color: t.red, fontFamily: "'Space Mono', monospace", fontSize: 12 }}>✗ Key not found in wordlist</div>}
            </div>
          )}
        </Card>
      </div>
      <Card title="Deauth Tool" color="orange" style={{ marginTop: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          <Input label="Interface" value={dI} onChange={setDI} />
          <Input label="BSSID" value={dB} onChange={setDB} />
          <Input label="Client" value={dC} onChange={setDC} placeholder="broadcast" />
          <Input label="Packets" value={dN} onChange={setDN} />
        </div>
        <Btn onClick={doDeauth} disabled={!dB} color="orange" style={{ marginTop: 4 }}>⚡ Send Deauth</Btn>
        {dR && <div style={{ marginTop: 12 }}><TerminalLog lines={[JSON.stringify(dR, null, 2)]} maxH={100} /></div>}
      </Card>
    </div>
  );
}

function ReconPage() {
  const t = useTheme();
  const [tgt, setTgt] = useState("192.168.0.0/24"); const [st, setSt] = useState("quick"); const [ports, setPorts] = useState(""); const [ca, setCa] = useState(""); const [to, setTo] = useState("300");
  const [scanning, setScanning] = useState(false); const [res, setRes] = useState(null); const [rr, setRr] = useState(null); const [ri, setRi] = useState("192.168.0.1"); const [sel, setSel] = useState(null);
  const stOpts = [{ value: "quick", label: "Quick" }, { value: "full", label: "Full" }, { value: "vuln", label: "Vuln" }, { value: "os_detect", label: "OS Detect" }, { value: "service", label: "Service" }, { value: "stealth", label: "Stealth" }, { value: "udp", label: "UDP" }, { value: "custom", label: "Custom" }];
  const doScan = async () => { setScanning(true); setRes(null); setRes(await api("/recon/scan", { method: "POST", body: JSON.stringify({ target: tgt, scan_type: st, ports: ports || null, custom_args: ca || null, timeout: parseInt(to) }) })); setScanning(false); };
  const doDiscover = async () => { setScanning(true); setRes(null); setRes(await api(`/recon/discover?cidr=${encodeURIComponent(tgt)}`, { method: "POST" })); setScanning(false); };
  const doDeep = async ip => { setScanning(true); setRes(await api(`/recon/deep/${ip}`, { method: "POST" })); setScanning(false); };
  const doVuln = async ip => { setScanning(true); setRes(await api(`/recon/vuln/${ip}`, { method: "POST" })); setScanning(false); };
  const hosts = res?.hosts || [];
  const hCols = [
    { key: "ip", label: "IP", render: v => <span style={{ color: t.accent, fontWeight: 700 }}>{v}</span> },
    { key: "mac", label: "MAC", render: v => <span style={{ color: t.textMuted }}>{v || "—"}</span> },
    { key: "hostname", label: "Host", render: v => v || <span style={{ color: t.textDim }}>—</span> },
    { key: "os_guess", label: "OS", render: v => v ? <span style={{ color: t.pink }}>{v}</span> : <span style={{ color: t.textDim }}>—</span> },
    { key: "ports", label: "Open", render: v => <span style={{ color: t.green, fontWeight: 700 }}>{v?.filter(p => p.state === "open").length || 0}</span> },
    { key: "_a", label: "", render: (_, row) => <div style={{ display: "flex", gap: 4 }}><Btn small onClick={() => doDeep(row.ip)} color="blue">Deep</Btn><Btn small onClick={() => doVuln(row.ip)} color="orange">Vuln</Btn></div> },
  ];
  return (
    <div className="page-content">
      <GlitchText text="// NETWORK RECON" />
      <Card title="Scan Configuration">
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12 }}>
          <Input label="Target" value={tgt} onChange={setTgt} />
          <Select label="Scan Type" value={st} onChange={setSt} options={stOpts} />
          <Input label="Ports" value={ports} onChange={setPorts} placeholder="22,80,443" />
          <Input label="Timeout (s)" value={to} onChange={setTo} />
        </div>
        {st === "custom" && <Input label="Custom Args" value={ca} onChange={setCa} />}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <Btn onClick={doScan} disabled={scanning} color="blue">{scanning ? "⟳ Scanning..." : "▶ Scan"}</Btn>
          <Btn onClick={doDiscover} disabled={scanning} color="green">⌖ Discover</Btn>
        </div>
      </Card>
      {res?.command && (
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: t.textDim, marginBottom: 12, padding: "6px 12px", background: t.bgTableRow, borderRadius: 6, border: `1px solid ${t.border}` }}>
          <span style={{ color: t.accent }}>CMD </span><span style={{ color: t.termPrompt }}>{res.command}</span>
        </div>
      )}
      {res && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <Stat label="Hosts" value={hosts.length} color="accent" icon="🖥" />
            <Stat label="Scan Type" value={res.scan_type?.toUpperCase()} color="pink" />
            <Stat label="Status" value={res.status?.toUpperCase()} color={res.status === "completed" ? "green" : "yellow"} />
          </div>
          <Card title={`Hosts (${hosts.length})`}><DataTable columns={hCols} data={hosts} onRowClick={setSel} /></Card>
        </>
      )}
      {sel && (
        <Card title={`Host Detail — ${sel.ip}`} color="pink">
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, lineHeight: 1.8, color: t.text }}>
            {[["MAC", sel.mac || "N/A"], ["Hostname", sel.hostname || "N/A"], ["OS", sel.os_guess || "N/A"]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 12, marginBottom: 4 }}>
                <span style={{ color: t.textDim, minWidth: 80 }}>{k}</span>
                <span style={{ color: k === "OS" ? t.pink : t.textBright }}>{v}</span>
              </div>
            ))}
            {sel.ports?.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ color: t.accent, fontSize: 9, letterSpacing: "0.15em", fontFamily: "'Orbitron', sans-serif", marginBottom: 6 }}>PORTS</div>
                {sel.ports.map((p, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "4px 0", borderBottom: `1px solid ${t.border}`, alignItems: "center" }}>
                    <span style={{ color: t.yellow, minWidth: 60 }}>{p.port}/{p.protocol}</span>
                    <Badge color={p.state === "open" ? "green" : "red"} small>{p.state}</Badge>
                    <span style={{ color: t.textMuted }}>{p.service || ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Btn small onClick={() => setSel(null)} style={{ marginTop: 12 }}>✕ Close</Btn>
        </Card>
      )}
      <Card title="CTF — Router Probe" color="red" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <Input label="Router IP" value={ri} onChange={setRi} style={{ flex: 1, marginBottom: 0 }} />
          <Btn onClick={async () => { setRr(null); setRr(await api("/recon/router", { method: "POST", body: JSON.stringify({ target_ip: ri, check_default_creds: true, check_known_vulns: true }) })); }} color="red" style={{ marginBottom: 0 }}>⚡ Probe</Btn>
        </div>
        {rr && (
          <div style={{ marginTop: 14, fontFamily: "'Space Mono', monospace", fontSize: 11, lineHeight: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Reachable: <StatusDot color={rr.reachable ? "green" : "red"} />
              <span style={{ color: rr.reachable ? t.green : t.red }}>{rr.reachable ? "YES" : "NO"}</span>
            </div>
            {rr.reachable && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
                {[["HTTP", rr.http_open], ["HTTPS", rr.https_open], ["SSH", rr.ssh_open], ["Telnet", rr.telnet_open]].map(([n, v]) => (
                  <div key={n} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: t.textMuted }}>{n}</span>
                    <Badge color={v ? (n === "Telnet" ? "red" : "green") : "textDim"} small>{v ? "OPEN" : "CLOSED"}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function AttacksPage() {
  const t = useTheme();
  const [etI, setEtI] = useState("wlan1"); const [etE, setEtE] = useState(""); const [etC, setEtC] = useState("6"); const [etN, setEtN] = useState("eth0"); const [etP, setEtP] = useState(false);
  const [etS, setEtS] = useState(null); const [etL, setEtL] = useState(false);
  const [mI, setMI] = useState("wlan0"); const [mT, setMT] = useState(""); const [mG, setMG] = useState("192.168.0.1"); const [mP, setMP] = useState("8080"); const [mH, setMH] = useState("");
  const [mS, setMS] = useState(null); const [mL, setML] = useState(false);
  const rSt = async () => { setEtS(await api("/attacks/evil-twin/status")); setMS(await api("/attacks/mitm/status")); };
  useEffect(() => { rSt(); }, []);
  return (
    <div className="page-content">
      <GlitchText text="// ATTACK VECTORS" />
      <div style={{ padding: "8px 14px", background: "rgba(255,45,85,0.06)", border: `1px solid rgba(255,45,85,0.2)`, borderRadius: 6, color: t.red, fontSize: 10, fontFamily: "'Space Mono', monospace", marginBottom: 20, letterSpacing: "0.08em" }}>
        ⚠ FOR AUTHORIZED PENETRATION TESTING ONLY — UNAUTHORIZED USE IS ILLEGAL
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card title="Evil Twin AP" color="orange">
          <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <StatusDot color={etS?.active ? "green" : "red"} />
            <Badge color={etS?.active ? "green" : "textDim"}>{etS?.active ? "ACTIVE" : "INACTIVE"}</Badge>
          </div>
          {!etS?.active ? (
            <>
              <Input label="Interface" value={etI} onChange={setEtI} />
              <Input label="ESSID" value={etE} onChange={setEtE} placeholder="Company_WiFi" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Input label="Channel" value={etC} onChange={setEtC} />
                <Input label="Internet Iface" value={etN} onChange={setEtN} />
              </div>
              <div style={{ marginBottom: 12 }}><Chk label="Captive Portal" checked={etP} onChange={setEtP} /></div>
              <Btn onClick={async () => { setEtL(true); await api("/attacks/evil-twin/start", { method: "POST", body: JSON.stringify({ interface: etI, target_essid: etE, channel: parseInt(etC), internet_interface: etN || null, captive_portal: etP }) }); await rSt(); setEtL(false); }} disabled={etL || !etE} color="orange">{etL ? "⟳ Starting..." : "▶ Launch"}</Btn>
            </>
          ) : (
            <>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: t.text, lineHeight: 1.8, marginBottom: 14 }}>
                {etS.twin && Object.entries(etS.twin).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: 12 }}>
                    <span style={{ color: t.textDim, minWidth: 80 }}>{k}</span>
                    <span style={{ color: t.textBright }}>{String(v)}</span>
                  </div>
                ))}
              </div>
              <Btn onClick={async () => { await api("/attacks/evil-twin/stop", { method: "POST" }); await rSt(); }} danger>◼ Stop</Btn>
            </>
          )}
        </Card>
        <Card title="Man-in-the-Middle" color="pink">
          <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <StatusDot color={mS?.active ? "green" : "red"} />
            <Badge color={mS?.active ? "green" : "textDim"}>{mS?.active ? "ACTIVE" : "INACTIVE"}</Badge>
          </div>
          {!mS?.active ? (
            <>
              <Input label="Interface" value={mI} onChange={setMI} />
              <Input label="Target IPs" value={mT} onChange={setMT} placeholder="192.168.0.50, .51" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Input label="Gateway" value={mG} onChange={setMG} />
                <Input label="Proxy Port" value={mP} onChange={setMP} />
              </div>
              <Input label="Filter Hosts" value={mH} onChange={setMH} />
              <Btn onClick={async () => { setML(true); await api("/attacks/mitm/start", { method: "POST", body: JSON.stringify({ interface: mI, target_ips: mT.split(",").map(s => s.trim()).filter(Boolean), gateway: mG, proxy_port: parseInt(mP), filter_hosts: mH ? mH.split(",").map(s => s.trim()) : [] }) }); await rSt(); setML(false); }} disabled={mL || !mT} color="pink">{mL ? "⟳ Starting..." : "▶ Start"}</Btn>
            </>
          ) : (
            <>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: t.text, lineHeight: 1.8, marginBottom: 14 }}>
                {mS.session && Object.entries(mS.session).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: 12 }}>
                    <span style={{ color: t.textDim, minWidth: 80 }}>{k}</span>
                    <span style={{ color: t.textBright }}>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                  </div>
                ))}
              </div>
              <Btn onClick={async () => { await api("/attacks/mitm/stop", { method: "POST" }); await rSt(); }} danger>◼ Stop</Btn>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function SessionsPage() {
  const t = useTheme();
  const [sessions, setSessions] = useState([]); const [sel, setSel] = useState(null); const [report, setReport] = useState(null);
  const [name, setName] = useState(""); const [company, setCompany] = useState(""); const [auditor, setAuditor] = useState(""); const [notes, setNotes] = useState("");
  const [fCat, setFCat] = useState("wifi"); const [fSev, setFSev] = useState("medium"); const [fT, setFT] = useState(""); const [fD, setFD] = useState(""); const [fE, setFE] = useState(""); const [fR, setFR] = useState("");
  const refresh = async () => { const d = await api("/sessions/"); if (Array.isArray(d)) setSessions(d); };
  const select = async id => { setSel(await api(`/sessions/${id}`)); setReport(null); };
  useEffect(() => { refresh(); }, []);
  const sevOpts = [{ value: "critical", label: "Critical" }, { value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }, { value: "info", label: "Info" }];
  const catOpts = [{ value: "wifi", label: "WiFi" }, { value: "network", label: "Network" }, { value: "router", label: "Router" }, { value: "credentials", label: "Credentials" }, { value: "encryption", label: "Encryption" }, { value: "access_control", label: "Access Control" }, { value: "other", label: "Other" }];
  return (
    <div className="page-content">
      <GlitchText text="// AUDIT SESSIONS" />
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
        <div>
          <Card title="New Session" color="green">
            <Input label="Name" value={name} onChange={setName} />
            <Input label="Company" value={company} onChange={setCompany} />
            <Input label="Auditor" value={auditor} onChange={setAuditor} />
            <Input label="Notes" value={notes} onChange={setNotes} />
            <Btn onClick={async () => { await api("/sessions/", { method: "POST", body: JSON.stringify({ name, company, auditor, notes: notes || null }) }); setName(""); setCompany(""); setAuditor(""); setNotes(""); refresh(); }} disabled={!name || !company || !auditor} color="green">+ Create Session</Btn>
          </Card>
          <Card title="Sessions">
            {sessions.map(s => (
              <div key={s.id} onClick={() => select(s.id)} style={{
                padding: "10px 12px", background: sel?.id === s.id ? t.accentDim : t.bgTableRow,
                border: `1px solid ${sel?.id === s.id ? t.accent + "40" : t.border}`,
                borderLeft: `2px solid ${sel?.id === s.id ? t.accent : "transparent"}`,
                borderRadius: 6, marginBottom: 6, cursor: "pointer", transition: "all 0.15s",
              }}>
                <div style={{ color: t.textBright, fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{s.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: t.textMuted, fontFamily: "'Space Mono', monospace", fontSize: 10 }}>{s.company}</span>
                  <Badge color={s.status === "active" ? "green" : "textDim"} small>{s.status}</Badge>
                </div>
              </div>
            ))}
            {sessions.length === 0 && <div style={{ color: t.textDim, fontFamily: "'Space Mono', monospace", fontSize: 11, padding: 12, textAlign: "center" }}>// no sessions</div>}
          </Card>
        </div>
        <div>
          {sel ? (
            <>
              <Card title={sel.name} color="accent">
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: t.textMuted, lineHeight: 2, marginBottom: 12 }}>
                  {[["ID", sel.id], ["Company", sel.company], ["Auditor", sel.auditor]].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", gap: 12 }}>
                      <span style={{ color: t.textDim, minWidth: 70 }}>{k}</span>
                      <span style={{ color: t.textBright }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 12 }}>
                    <span style={{ color: t.textDim, minWidth: 70 }}>Status</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}><StatusDot color={sel.status === "active" ? "green" : "textDim"} /><Badge color={sel.status === "active" ? "green" : "textDim"} small>{sel.status}</Badge></div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {sel.status === "active" && <Btn small onClick={async () => { await api(`/sessions/${sel.id}/close`, { method: "POST" }); refresh(); select(sel.id); }} color="yellow">◼ Close</Btn>}
                  <Btn small onClick={async () => setReport(await api(`/sessions/${sel.id}/report`))} color="blue">↓ Report</Btn>
                </div>
              </Card>
              {sel.status === "active" && (
                <Card title="Add Finding" color="yellow">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Select label="Category" value={fCat} onChange={setFCat} options={catOpts} />
                    <Select label="Severity" value={fSev} onChange={setFSev} options={sevOpts} />
                  </div>
                  <Input label="Title" value={fT} onChange={setFT} />
                  <Input label="Description" value={fD} onChange={setFD} />
                  <Input label="Evidence" value={fE} onChange={setFE} />
                  <Input label="Recommendation" value={fR} onChange={setFR} />
                  <Btn onClick={async () => { await api(`/sessions/${sel.id}/findings`, { method: "POST", body: JSON.stringify({ session_id: sel.id, category: fCat, severity: fSev, title: fT, description: fD, evidence: fE || null, recommendation: fR || null }) }); setFT(""); setFD(""); setFE(""); setFR(""); select(sel.id); }} disabled={!fT || !fD} color="yellow">+ Add Finding</Btn>
                </Card>
              )}
              {sel.findings?.length > 0 && (
                <Card title={`Findings (${sel.findings.length})`}>
                  {sel.findings.map((f, i) => (
                    <div key={i} style={{
                      padding: "12px 14px", background: t.bgTableRow,
                      borderLeft: `3px solid ${tc(t, SEV[f.severity] || "textDim")}`,
                      borderRadius: 6, marginBottom: 8, fontFamily: "'Space Mono', monospace",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ color: t.textBright, fontSize: 12, fontWeight: 700 }}>{f.title}</span>
                        <Badge color={SEV[f.severity] || "textDim"} small>{f.severity}</Badge>
                      </div>
                      <div style={{ color: t.textMuted, fontSize: 11, marginBottom: 6 }}>{f.description}</div>
                      {f.recommendation && <div style={{ color: t.green, fontSize: 10 }}>→ {f.recommendation}</div>}
                      <div style={{ marginTop: 6 }}><Badge color="blue" small>{f.category}</Badge></div>
                    </div>
                  ))}
                </Card>
              )}
              {report && (
                <Card title="Audit Report" color="green">
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {Object.entries(report.audit_report?.summary || {}).filter(([k]) => k !== "total").map(([s, c]) => (
                      <Stat key={s} label={s} value={c} color={SEV[s] || "textDim"} />
                    ))}
                  </div>
                </Card>
              )}
            </>
          ) : (
            <div style={{ color: t.textDim, fontFamily: "'Space Mono', monospace", padding: 60, textAlign: "center", fontSize: 11 }}>
              ← Select or create a session to begin
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProcessesPage() {
  const t = useTheme();
  const [procs, setProcs] = useState([]); const [ld, setLd] = useState(false);
  const refresh = async () => { setLd(true); const d = await api("/system/processes"); if (Array.isArray(d)) setProcs(d); setLd(false); };
  useEffect(() => { refresh(); const i = setInterval(refresh, 5000); return () => clearInterval(i); }, []);
  const cols = [
    { key: "id", label: "ID", render: v => <span style={{ color: t.accent, fontWeight: 700 }}>{v}</span> },
    { key: "command", label: "Command", render: v => <code style={{ color: t.textBright, fontSize: 10, maxWidth: 360, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</code> },
    { key: "status", label: "Status", render: v => <div style={{ display: "flex", alignItems: "center", gap: 6 }}><StatusDot color={v === "running" ? "green" : v === "completed" ? "blue" : "red"} /><Badge color={v === "running" ? "green" : v === "completed" ? "blue" : "red"} small>{v}</Badge></div> },
    { key: "return_code", label: "RC", render: v => v !== null ? <span style={{ color: v === 0 ? t.green : t.red }}>{v}</span> : <span style={{ color: t.textDim }}>—</span> },
    { key: "started_at", label: "Started", render: v => v ? <span style={{ color: t.textMuted, fontSize: 10 }}>{new Date(v).toLocaleTimeString()}</span> : "—" },
    { key: "_a", label: "", render: (_, r) => r.status === "running" ? <Btn small danger onClick={async () => { await api(`/system/processes/${r.id}/cancel`, { method: "POST" }); refresh(); }}>✕ Kill</Btn> : null },
  ];
  return (
    <div className="page-content">
      <GlitchText text="// PROCESSES" />
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <Stat label="Total" value={procs.length} color="accent" icon="▣" />
        <Stat label="Running" value={procs.filter(p => p.status === "running").length} color="green" icon="◉" />
        <Stat label="Failed" value={procs.filter(p => p.status === "failed").length} color="red" icon="✗" />
        <Stat label="Completed" value={procs.filter(p => p.status === "completed").length} color="blue" icon="✓" />
      </div>
      <Card title="Managed Processes">
        <DataTable columns={cols} data={procs} />
      </Card>
      <Btn onClick={refresh} disabled={ld}>{ld ? "⟳ Refreshing..." : "↺ Refresh"}</Btn>
    </div>
  );
}

// ═══════ HELP PAGE ═══════

const HELP = [
  { id: "overview", title: "Visión General", icon: "📖", text: `**WFAudit** es una herramienta de auditoría WiFi profesional. Proporciona una interfaz gráfica sobre herramientas estándar (aircrack-ng, nmap, mitmproxy, hostapd) para ejecutar auditorías WiFi completas.\n\nLas 4 fases de auditoría:\n1. **Reconocimiento WiFi** — Escanear el espectro y descubrir redes\n2. **Análisis de red** — Mapear la red interna y sus servicios\n3. **Explotación** — Cracking WPA, Evil Twin, acceso al router\n4. **Interceptación** — Man-in-the-Middle para análisis de tráfico\n\nTodo bajo un marco de sesiones con sistema de hallazgos e informes.` },
  { id: "prereqs", title: "Requisitos Previos", icon: "⚙", text: `**Hardware necesario:**\n• Adaptador WiFi con soporte modo monitor (chipsets Atheros AR9271, Ralink RT3070, Realtek RTL8812AU)\n• Para Evil Twin: **dos** tarjetas WiFi\n• Conexión Ethernet recomendada\n\n**Software:**\n• Linux (Kali recomendado)\n• Python 3.11+\n• Herramientas: aircrack-ng, nmap, hostapd, dnsmasq, macchanger, mitmproxy\n• Ejecutar como **root**\n\n**Legal:**\n• Contrato de auditoría firmado\n• Alcance definido por escrito\n• Nunca auditar redes sin autorización` },
  { id: "system", title: "System", icon: "◉", text: `Tu punto de partida. El **Preflight Check** verifica:\n\n• Si estás ejecutando como root (obligatorio)\n• Qué herramientas están instaladas y cuáles faltan\n• Sistema operativo y arquitectura\n\n**READY** = todo listo. **NOT READY** = revisa las herramientas faltantes.\n\nEjecuta el Preflight **siempre** antes de empezar una auditoría.` },
  { id: "interfaces", title: "Interfaces", icon: "⚡", text: `Gestiona adaptadores WiFi:\n\n**Listar** — Nombre, MAC, driver, chipset, modo y estado.\n\n**Modo monitor** — Obligatorio para escanear. Ejecuta \`airmon-ng start\`. La interfaz se renombra a wlan0mon.\n\n**Modo managed** — Restaura WiFi normal con \`airmon-ng stop\`.\n\n**Cambiar MAC** — Aleatorio o manual. Útil para evitar detección.` },
  { id: "wifiscan", title: "WiFi Scanner", icon: "📡", text: `Descubre redes con airodump-ng:\n\n**Parámetros:** Interface (en monitor), Canal (vacío=todos), Duración, BSSID objetivo (opcional).\n\n**Resultados por red:**\n• **ESSID** — Nombre de la red\n• **BSSID** — MAC del AP\n• **Power** — Señal dBm (verde >-50, amarillo >-70, rojo <-70)\n• **Security** — Open, WEP, WPA, WPA2, WPA3\n• **WPS** — Si activo, vector de ataque adicional\n• **Clients** — Dispositivos conectados` },
  { id: "handshake", title: "Handshake & Crack", icon: "🔓", text: `Captura y crackea contraseñas WPA/WPA2:\n\n**Fase 1 — Capturar handshake:**\nEl handshake son 4 paquetes al conectarse un cliente.\n• "Deauth first" desconecta clientes para forzar reconexión\n• Si hay ✓ HANDSHAKE CAPTURED, el .cap se guarda\n\n**Fase 2 — Crackear:**\n• \`rockyou.txt\` = 14 millones de passwords\n• ✓ KEY FOUND = contraseña encontrada\n\n**Deauth Tool:** envía desconexiones para probar resiliencia DoS.` },
  { id: "recon", title: "Network Recon", icon: "🔍", text: `Mapea la red con nmap:\n\n**Tipos de escaneo:**\n• **Quick** — Ping sweep, descubre hosts vivos\n• **Full** — 65535 puertos + servicios + OS\n• **Vuln** — Scripts de vulnerabilidades\n• **Stealth** — SYN scan sigiloso\n• **Custom** — Argumentos nmap propios\n\n**Router Probe (CTF):**\nSondea el router: HTTP, HTTPS, SSH, Telnet.\n• Telnet abierto = hallazgo crítico` },
  { id: "attacks", title: "Attack Vectors", icon: "⚔", text: `**Evil Twin:**\nAP falso con el mismo nombre que la red objetivo.\n• Necesita 2ª tarjeta WiFi\n• Captive Portal redirige DNS a tu IP\n• Internamente: hostapd + dnsmasq + iptables NAT\n\n**MITM:**\n• ARP spoofing engaña dispositivos\n• mitmproxy captura flujos HTTP/S\n• HTTPS muestra warnings de certificado` },
  { id: "sessions", title: "Audit Sessions", icon: "📋", text: `Gestión de la auditoría:\n\n**Crear sesión:** nombre, empresa, auditor, notas.\n\n**Registrar hallazgos:**\n• **Severity** — Critical/High/Medium/Low/Info\n• **Evidence** — Ruta a capturas\n• **Recommendation** — Solución propuesta\n\n**Ejemplos:**\n• 🔴 Critical: Red sin cifrado → Implementar WPA3\n• 🟠 High: Password crackeada → Passphrase 16+ chars\n• 🔵 Low: WPS activado → Desactivar WPS` },
  { id: "processes", title: "Processes", icon: "▣", text: `Monitoriza subprocesos:\n\n• **Status:** running, completed, failed, cancelled\n• **Kill:** mata procesos colgados\n• Auto-refresh cada 5 segundos\n\nSi algo falla, revisa aquí.` },
  { id: "workflow", title: "Flujo Completo", icon: "🗺", text: `**ANTES del sitio:**\n1. ✅ Contrato y alcance firmados\n2. ✅ Hardware verificado\n3. ✅ Preflight OK\n\n**Fase 1 — Reconocimiento:**\n4. Interfaces → Monitor Mode\n5. WiFi Scanner → Scan 60s\n\n**Fase 2 — Cracking:**\n6. Handshake → Capturar\n7. Crack con wordlist\n\n**Fase 3 — Red interna:**\n8. Recon → Discover\n9. Router Probe\n\n**Después:**\n10. Revisar findings\n11. Exportar informe` },
  { id: "glossary", title: "Glosario", icon: "📚", text: `• **AP** — Access Point\n• **BSSID** — MAC del AP\n• **ESSID** — Nombre de la red WiFi\n• **Handshake** — 4 paquetes WPA con hash\n• **Deauth** — Paquete que fuerza desconexión\n• **Modo Monitor** — Captura todos los paquetes\n• **WPA/WPA2/WPA3** — Protocolos de cifrado\n• **WPS** — WiFi Protected Setup, vulnerable\n• **Evil Twin** — AP falso que imita una red\n• **MITM** — Man-in-the-Middle\n• **ARP Spoofing** — Engañar dispositivos\n• **CTF** — Capture The Flag\n• **Wordlist** — Diccionario de contraseñas` },
];

function HelpPage() {
  const t = useTheme();
  const [active, setActive] = useState("overview");
  const sec = HELP.find(s => s.id === active);
  const renderMd = (text) => text.split("\n").map((line, i) => {
    if (line.startsWith("**") && line.endsWith("**")) return <div key={i} style={{ color: t.accent, fontSize: 11, fontFamily: "'Orbitron', sans-serif", fontWeight: 700, letterSpacing: "0.12em", marginTop: 16, marginBottom: 8, textTransform: "uppercase" }}>{line.replace(/\*\*/g, "")}</div>;
    if (line.startsWith("• **")) { const m = line.match(/• \*\*(.+?)\*\*\s*—?\s*(.*)/); if (m) return <div key={i} style={{ paddingLeft: 14, marginBottom: 5, fontSize: 12, lineHeight: 1.8 }}><span style={{ color: t.accent }}>▸ </span><span style={{ color: t.textBright, fontWeight: 700 }}>{m[1]}</span>{m[2] && <span style={{ color: t.text }}> — {m[2]}</span>}</div>; }
    if (line.startsWith("• ")) return <div key={i} style={{ paddingLeft: 14, marginBottom: 4, fontSize: 12, lineHeight: 1.8, color: t.text }}><span style={{ color: t.accent }}>▸ </span>{renderInline(line.slice(2))}</div>;
    const nm = line.match(/^(\d+)\.\s+(.*)/); if (nm) return <div key={i} style={{ paddingLeft: 14, marginBottom: 4, fontSize: 12, lineHeight: 1.8, color: t.text }}><span style={{ color: t.yellow, marginRight: 8, fontFamily: "'Orbitron', sans-serif", fontWeight: 700 }}>{nm[1]}.</span>{renderInline(nm[2])}</div>;
    if (line.startsWith("→")) return <div key={i} style={{ paddingLeft: 24, marginBottom: 3, fontSize: 11, color: t.green, lineHeight: 1.8, fontFamily: "'Space Mono', monospace" }}>{line}</div>;
    if (line.trim() === "") return <div key={i} style={{ height: 10 }} />;
    return <div key={i} style={{ fontSize: 12.5, lineHeight: 1.9, color: t.text, marginBottom: 2 }}>{renderInline(line)}</div>;
  });
  const renderInline = (txt) => {
    const parts = []; let rem = txt; let k = 0;
    while (rem.length > 0) {
      const bm = rem.match(/\*\*(.+?)\*\*/); const cm = rem.match(/`(.+?)`/);
      let fm = null, mt = null;
      if (bm && (!cm || bm.index <= cm.index)) { fm = bm; mt = "b"; } else if (cm) { fm = cm; mt = "c"; }
      if (!fm) { parts.push(<span key={k++}>{rem}</span>); break; }
      if (fm.index > 0) parts.push(<span key={k++}>{rem.slice(0, fm.index)}</span>);
      if (mt === "b") parts.push(<span key={k++} style={{ color: t.textBright, fontWeight: 700 }}>{fm[1]}</span>);
      if (mt === "c") parts.push(<code key={k++} style={{ background: "rgba(0,229,255,0.08)", padding: "1px 7px", borderRadius: 4, fontSize: 10, color: t.green, fontFamily: "'Space Mono', monospace", border: `1px solid rgba(0,229,255,0.15)` }}>{fm[1]}</code>);
      rem = rem.slice(fm.index + fm[0].length);
    }
    return parts;
  };
  return (
    <div className="page-content">
      <GlitchText text="// HELP & DOCUMENTATION" />
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 20 }}>
        <Card title="Contents">
          {HELP.map(s => (
            <div key={s.id} onClick={() => setActive(s.id)}
              style={{
                padding: "8px 12px", background: active === s.id ? t.accentDim : "transparent",
                borderLeft: active === s.id ? `2px solid ${t.accent}` : "2px solid transparent",
                borderRadius: 4, cursor: "pointer", fontFamily: "'Space Mono', monospace",
                fontSize: 11, color: active === s.id ? t.accent : t.textMuted,
                marginBottom: 2, display: "flex", gap: 8, alignItems: "center",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { if (active !== s.id) e.currentTarget.style.color = t.textBright; }}
              onMouseLeave={e => { if (active !== s.id) e.currentTarget.style.color = t.textMuted; }}
            >
              <span style={{ fontSize: 13 }}>{s.icon}</span>
              {s.title}
            </div>
          ))}
        </Card>
        <div>
          {sec && (
            <Card title={`${sec.icon} ${sec.title}`}>
              <div style={{ fontFamily: "system-ui, sans-serif" }}>
                {renderMd(sec.text)}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════ MAIN ═══════

const NAV = [
  { id: "dashboard", label: "SYSTEM", icon: "◉", desc: "Overview" },
  { id: "interfaces", label: "INTERFACES", icon: "⚡", desc: "Adapters" },
  { id: "wifi", label: "WIFI SCAN", icon: "📡", desc: "Scanner" },
  { id: "handshake", label: "HANDSHAKE", icon: "🔓", desc: "Capture" },
  { id: "recon", label: "RECON", icon: "🔍", desc: "Network" },
  { id: "attacks", label: "ATTACKS", icon: "⚔", desc: "Vectors" },
  { id: "sessions", label: "SESSIONS", icon: "📋", desc: "Audit" },
  { id: "processes", label: "PROCESSES", icon: "▣", desc: "Monitor" },
  { id: "help", label: "HELP", icon: "?", desc: "Docs" },
];
const PAGES = { dashboard: DashboardPage, interfaces: InterfacesPage, wifi: WifiScanPage, handshake: HandshakePage, recon: ReconPage, attacks: AttacksPage, sessions: SessionsPage, processes: ProcessesPage, help: HelpPage };

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [themeName, setThemeName] = useState("dark");
  const [time, setTime] = useState(new Date());
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { const i = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(i); }, []);
  const t = THEMES[themeName]; const Page = PAGES[page];
  const navIdx = NAV.findIndex(n => n.id === page);

  return (
    <ThemeCtx.Provider value={t}>
      <div style={{ display: "flex", height: "100vh", background: t.bg, color: t.text, fontFamily: "'Space Mono', monospace", overflow: "hidden", position: "relative" }}>
        <GlobalStyles t={t} />
        <GridBg t={t} />

        {/* ═══ SIDEBAR ═══ */}
        <div style={{
          width: collapsed ? 56 : 200, background: t.bgSidebar,
          borderRight: `1px solid ${t.borderAccent}`, display: "flex", flexDirection: "column",
          transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)", flexShrink: 0,
          position: "relative", zIndex: 10, overflow: "hidden",
        }}>
          {/* Logo */}
          <div onClick={() => setCollapsed(!collapsed)} style={{
            padding: collapsed ? "20px 0" : "20px 16px", cursor: "pointer",
            borderBottom: `1px solid ${t.borderAccent}`, textAlign: collapsed ? "center" : "left",
          }}>
            {collapsed ? (
              <div style={{ fontSize: 18, color: t.accent, fontFamily: "'Orbitron', sans-serif", fontWeight: 900, textShadow: `0 0 20px ${t.accentGlow}`, textAlign: "center" }}>W</div>
            ) : (
              <>
                <div style={{ fontSize: 14, color: t.accent, fontFamily: "'Orbitron', sans-serif", fontWeight: 900, letterSpacing: "0.15em", textShadow: `0 0 20px ${t.accentGlow}` }}>WFAUDIT</div>
                <div style={{ fontSize: 8, color: t.sideClockDim, letterSpacing: "0.3em", marginTop: 3, fontFamily: "'Space Mono', monospace" }}>NEURAL v1.0</div>
              </>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: "10px 0", overflowY: "auto" }}>
            {NAV.map((item, i) => (
              <div
                key={item.id} onClick={() => setPage(item.id)}
                className="nav-item"
                style={{
                  padding: collapsed ? "12px 0" : "10px 16px",
                  cursor: "pointer", justifyContent: collapsed ? "center" : "flex-start",
                  background: page === item.id ? t.sideActive : "transparent",
                  borderLeft: page === item.id ? `2px solid ${t.sideActiveBorder}` : "2px solid transparent",
                  color: page === item.id ? t.accent : t.sideTextDim,
                  display: "flex", alignItems: "center", gap: 10,
                  transition: "all 0.18s ease",
                  position: "relative",
                }}
              >
                {page === item.id && (
                  <div style={{
                    position: "absolute", inset: 0, background: `linear-gradient(90deg, ${t.accent}10, transparent)`,
                    pointerEvents: "none",
                  }} />
                )}
                <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && (
                  <div>
                    <div style={{ fontSize: 9, fontFamily: "'Orbitron', sans-serif", fontWeight: 700, letterSpacing: "0.12em", color: page === item.id ? t.accent : t.sideTextDim }}>{item.label}</div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Footer */}
          {!collapsed && (
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${t.borderAccent}` }}>
              <div
                onClick={() => setThemeName(themeName === "dark" ? "light" : "dark")}
                style={{
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                  padding: "7px 10px", borderRadius: 6, marginBottom: 12,
                  background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.08)`,
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
              >
                <span style={{ fontSize: 14 }}>{themeName === "dark" ? "☀" : "☾"}</span>
                <span style={{ fontSize: 9, color: t.sideTextDim, letterSpacing: "0.1em", fontFamily: "'Orbitron', sans-serif" }}>{themeName === "dark" ? "LIGHT" : "DARK"}</span>
              </div>
              <div style={{ fontSize: 9, color: t.sideClockDim, marginBottom: 2, fontFamily: "'Space Mono', monospace" }}>{time.toLocaleDateString()}</div>
              <div style={{ fontSize: 13, color: t.sideClock, fontFamily: "'Orbitron', sans-serif", fontWeight: 700, textShadow: t.name === "dark" ? `0 0 10px ${t.accentGlow}` : "none" }}>{time.toLocaleTimeString()}</div>
            </div>
          )}
        </div>

        {/* ═══ MAIN ═══ */}
        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
          {/* Topbar */}
          <div style={{
            padding: "0 24px", height: 52, borderBottom: `1px solid ${t.border}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: t.bgTopbar, position: "sticky", top: 0, zIndex: 10,
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: t.textDim }}>
                <span style={{ color: t.accent }}>root@wfaudit</span>
                <span style={{ color: t.textDim }}>:</span>
                <span style={{ color: t.green }}>~/{page}</span>
                <span style={{ color: t.accent, animation: "pulse 1s step-end infinite" }}>█</span>
              </div>
              {t.name === "dark" && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 4, background: "rgba(0,255,163,0.06)", border: "1px solid rgba(0,255,163,0.15)" }}>
                  <StatusDot color="green" />
                  <span style={{ fontSize: 9, color: t.green, fontFamily: "'Orbitron', sans-serif", fontWeight: 700, letterSpacing: "0.1em" }}>LIVE</span>
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ fontSize: 9, color: t.textDim, fontFamily: "'Orbitron', sans-serif", letterSpacing: "0.1em" }}>AUTHORIZED TESTING ONLY</div>
              {collapsed && (
                <div onClick={() => setThemeName(themeName === "dark" ? "light" : "dark")} style={{ cursor: "pointer", fontSize: 16 }}>
                  {themeName === "dark" ? "☀" : "☾"}
                </div>
              )}
              <div style={{
                display: "flex", gap: 1,
              }}>
                {NAV.map((_, i) => (
                  <div key={i} onClick={() => setPage(NAV[i].id)} style={{
                    width: 4, height: 4, borderRadius: "50%",
                    background: i === navIdx ? t.accent : t.textDim,
                    cursor: "pointer", transition: "all 0.2s",
                    boxShadow: i === navIdx ? `0 0 6px ${t.accent}` : "none",
                    margin: "0 1px",
                  }} />
                ))}
              </div>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: "28px 28px", flex: 1 }}>
            <Page />
          </div>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}

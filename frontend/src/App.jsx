import { useState, useEffect, useRef, createContext, useContext, useCallback, Fragment } from "react";
import { createPortal } from "react-dom";

const API = "http://localhost:8000";
const api = async (path, opts = {}) => {
  try {
    const r = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json", ...opts.headers }, ...opts });
    return await r.json();
  } catch (e) { return { error: e.message }; }
};

// ═══════════════════════════════════════════
// MODULE-LEVEL PERSISTENCE (survives page navigation)
// ═══════════════════════════════════════════
const wifiPersist = { res: null, scans: [], sel: null, pnl: null };

// ═══════════════════════════════════════════
// THEME SYSTEM
// ═══════════════════════════════════════════
const DARK = {
  bg: "#03070f", bgCard: "rgba(5,12,25,0.95)", bgInput: "#040b18", bgSidebar: "#020408",
  bgHover: "rgba(0,255,149,0.05)", bgTopbar: "rgba(3,7,16,0.98)",
  text: "#cdd6e0", textMuted: "#4a6070", textDim: "#162030",
  border: "#0c1e35", accent: "#00ff95", accentDim: "#00cc78",
  warn: "#ff9500", danger: "#ff2055", info: "#3ab5ff", purple: "#c084fc",
  glow: "0 0 24px rgba(0,255,149,0.2)", glowStrong: "0 0 48px rgba(0,255,149,0.35)",
  glass: "rgba(5,12,25,0.85)", glassBorder: "rgba(0,255,149,0.12)",
  isDark: true,
};
const LIGHT = {
  bg: "#e8edf6", bgCard: "rgba(255,255,255,0.98)", bgInput: "#f0f5fb", bgSidebar: "#0b1322",
  bgHover: "rgba(14,165,233,0.06)", bgTopbar: "rgba(255,255,255,0.99)",
  text: "#1a2740", textMuted: "#5a6e88", textDim: "#a0b0c0",
  border: "#d8e4f0", accent: "#0ea5e9", accentDim: "#0284c7",
  warn: "#f59e0b", danger: "#f43f5e", info: "#6366f1", purple: "#a855f7",
  glow: "0 4px 24px rgba(14,165,233,0.18)", glowStrong: "0 8px 40px rgba(14,165,233,0.28)",
  glass: "rgba(255,255,255,0.9)", glassBorder: "rgba(14,165,233,0.18)",
  isDark: false,
};

const ThemeCtx = createContext(DARK);
const useTheme = () => useContext(ThemeCtx);

const SEV = { critical: "#ff2055", high: "#ff6b35", medium: "#ff9500", low: "#3ab5ff", info: "#00ff95" };
const SEC = { open: "#ff2055", wep: "#ff6b35", wpa: "#ff9500", wpa2: "#3ab5ff", wpa3: "#00ff95", wpa2_enterprise: "#c084fc", wpa3_enterprise: "#c084fc", unknown: "#4a6070" };

const font = "'Space Mono', 'JetBrains Mono', monospace";
const fontDisplay = "'Orbitron', 'Space Mono', monospace";

const makeCSS = (C) => `
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Orbitron:wght@400;600;700;900&display=swap');
*{box-sizing:border-box;scrollbar-width:thin;scrollbar-color:${C.border} transparent}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}
::-webkit-scrollbar-thumb:hover{background:${C.accent}60}
body,html{margin:0;padding:0;font-size:14px}
:root{--tt-bg:${C.isDark?"rgba(6,14,30,0.98)":"rgba(255,255,255,0.99)"};--tt-border:${C.accent}55;--tt-text:${C.text};}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes pulseRing{0%{transform:scale(1);opacity:.6}100%{transform:scale(2.5);opacity:0}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes radarPing{0%{transform:scale(0);opacity:.9}100%{transform:scale(1.5);opacity:0}}
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes scanV{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}
@keyframes glowPulse{0%,100%{box-shadow:0 0 8px ${C.accent}30}50%{box-shadow:0 0 32px ${C.accent}60,0 0 64px ${C.accent}20}}
@keyframes glowDanger{0%,100%{box-shadow:0 0 8px ${C.danger}30}50%{box-shadow:0 0 32px ${C.danger}60}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes shimmer{0%{background-position:-300% center}100%{background-position:300% center}}
@keyframes countUp{from{opacity:0;transform:translateY(12px) scale(.9)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
@keyframes pageIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes dotPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.4)}}
@keyframes orbPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.06);opacity:.9}}
.anim-up{animation:slideUp .4s cubic-bezier(.22,1,.36,1) both}
.anim-fade{animation:fadeIn .3s ease both}
.anim-count{animation:countUp .5s cubic-bezier(.22,1,.36,1) both}
.page-in{animation:pageIn .38s cubic-bezier(.22,1,.36,1) both}
.nav-item{transition:all .18s cubic-bezier(.22,1,.36,1)}
.nav-item:hover .nav-label{letter-spacing:.16em!important}
.nav-item:hover .nav-icon{transform:scale(1.2)}
.card-hover{transition:transform .2s ease,box-shadow .2s ease}
.card-hover:hover{transform:translateY(-1px)}
.btn-base{position:relative;overflow:hidden;transition:all .18s cubic-bezier(.22,1,.36,1)!important}
.btn-base::before{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.07),transparent);transform:translateX(-100%);transition:transform .4s ease}
.btn-base:hover::before{transform:translateX(100%)}
.btn-base:active{transform:scale(.97)!important}
input:focus,select:focus{outline:none}
#wfaudit-tooltip{position:fixed;z-index:99999;pointer-events:none;top:0;left:0;width:0;height:0}
#wfaudit-tooltip .tt{position:absolute;background:var(--tt-bg)!important;border:1px solid var(--tt-border)!important;border-radius:8px;padding:11px 15px;font-size:13px!important;font-family:'Space Mono',monospace!important;color:var(--tt-text)!important;text-transform:none!important;letter-spacing:0!important;font-weight:400!important;font-style:normal!important;white-space:normal;word-break:break-word;min-width:200px;max-width:320px;line-height:1.65!important;box-shadow:0 16px 48px rgba(0,0,0,.75),0 0 0 1px rgba(0,0,0,.35);}
#wfaudit-tooltip .tt::after{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:6px solid transparent;border-top-color:var(--tt-border)!important;}
@media(max-width:900px){.hero-grid{grid-template-columns:1fr!important}.hero-radar{display:none!important}.sessions-grid{grid-template-columns:1fr!important}.grid-2{grid-template-columns:1fr!important}.grid-3{grid-template-columns:1fr 1fr!important}.grid-4{grid-template-columns:1fr 1fr!important}.adv-tab-bar{grid-template-columns:1fr 1fr!important}.main-pad{padding:14px 12px!important}.topbar-hint{display:none!important}}
@media(max-width:640px){.grid-2,.grid-3,.grid-4{grid-template-columns:1fr!important}.stat-row{flex-wrap:wrap!important}.main-pad{padding:10px 8px!important}}`

// ═══════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════
const Badge = ({ children, color, sm }) => {
  const C = useTheme();
  const c = color || C.accent;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center",
      padding: sm ? "2px 8px" : "3px 12px",
      borderRadius: 3, background: `${c}14`, color: c,
      border: `1px solid ${c}35`, fontSize: sm ? 10 : 11,
      fontFamily: font, textTransform:"uppercase", letterSpacing:".1em", fontWeight:700,
    }}>{children}</span>
  );
};

const Spinner = ({ size = 18, color }) => {
  const C = useTheme();
  const c = color || C.accent;
  return (
    <span style={{
      display:"inline-block", width: size, height: size,
      border: `2px solid ${c}20`,
      borderTopColor: c, borderRightColor: `${c}70`,
      borderRadius:"50%", animation:"spin .65s linear infinite", flexShrink:0,
    }} />
  );
};

// Tooltip — uses React portal to render at document.body, never clipped or overridden
// The portal container #wfaudit-tooltip is created once and reused
let _ttContainer = null;
const getTTContainer = () => {
  if (!_ttContainer) {
    _ttContainer = document.createElement("div");
    _ttContainer.id = "wfaudit-tooltip";
    document.body.appendChild(_ttContainer);
  }
  return _ttContainer;
};

const Tip = ({ children, tip }) => {
  const [pos, setPos] = useState(null);
  const ref = useRef(null);

  const show = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    // Keep tooltip inside viewport horizontally
    const x = Math.max(160, Math.min(window.innerWidth - 160, r.left + r.width / 2));
    const y = r.top - 12;
    setPos({ x, y });
  };
  const hide = () => setPos(null);

  const tooltip = pos ? createPortal(
    <div className="tt" style={{ left: pos.x, top: pos.y }}>
      {tip}
    </div>,
    getTTContainer()
  ) : null;

  return (
    <span ref={ref} style={{ position:"relative", display:"inline-flex", alignItems:"center" }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}>
      {children}
      {tooltip}
    </span>
  );
};

const TipIcon = ({ tip, color }) => {
  const C = useTheme();
  const c = color || C.accent;
  return (
    <Tip tip={tip}>
      <span style={{
        display:"inline-flex", alignItems:"center", justifyContent:"center",
        width:18, height:18, borderRadius:"50%",
        background:`${c}20`, border:`1px solid ${c}55`,
        color:c, fontSize:11, cursor:"help", fontFamily:font, fontWeight:700,
        marginLeft:6, flexShrink:0, lineHeight:1,
        transition:"background .15s",
      }}>?</span>
    </Tip>
  );
};

const LoadingOverlay = ({ message = "Processing...", duration = 0 }) => {
  const C = useTheme();
  const [dots, setDots] = useState("");
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  useEffect(() => {
    startRef.current = Date.now();
    const di = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 420);
    const pi = setInterval(() => {
      const el = (Date.now() - startRef.current) / 1000;
      setElapsed(Math.round(el));
      setProgress(duration > 0 ? Math.min(99, (el / duration) * 100) : p => Math.min(95, p + .4));
    }, 100);
    return () => { clearInterval(di); clearInterval(pi); };
  }, [duration]);
  const p = Math.round(progress);
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"clamp(28px,8vw,56px) clamp(16px,6vw,40px)", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", left:0, right:0, height:1, background:`linear-gradient(90deg,transparent,${C.accent}60,transparent)`, animation:"scanV 2.8s linear infinite", pointerEvents:"none", top:0 }} />
      <div style={{ position:"relative", width:96, height:96, marginBottom:28, flexShrink:0 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ position:"absolute", inset: i*12, borderRadius:"50%", border:`1px solid ${C.accent}${["40","26","14"][i]}`, animation:`pulseRing ${1.4+i*.5}s ease-out infinite ${i*.4}s` }} />
        ))}
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ width:38, height:38, borderRadius:"50%", border:`2px solid ${C.accent}20`, borderTopColor:C.accent, borderRightColor:`${C.accent}70`, animation:"spin .55s linear infinite" }} />
        </div>
        <div style={{ position:"absolute", inset:8, borderRadius:"50%", border:`1px solid ${C.accent}12`, borderBottomColor:C.accent, animation:"spin 1.5s linear infinite reverse" }} />
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:fontDisplay, fontSize:13, color:C.accent, fontWeight:700 }}>{p}%</div>
      </div>
      <div style={{ width:240, height:3, background:`${C.accent}15`, borderRadius:3, marginBottom:18, overflow:"hidden" }}>
        <div style={{ height:"100%", borderRadius:3, background:`linear-gradient(90deg,${C.accent}80,${C.accent},${C.accent}80)`, backgroundSize:"200% auto", animation:"shimmer 1.2s linear infinite", width:`${progress}%`, transition:"width .1s linear", boxShadow:`0 0 10px ${C.accent}` }} />
      </div>
      <div style={{ fontFamily:font, fontSize:11, color:C.accent, letterSpacing:".22em", textTransform:"uppercase" }}>{message}{dots}</div>
      <div style={{ marginTop:7, fontFamily:font, fontSize:10, color:C.textMuted, letterSpacing:".1em" }}>
        {duration > 0 ? `${elapsed}s / ${duration}s elapsed` : `${elapsed}s elapsed`}
      </div>
    </div>
  );
};

const Btn = ({ children, onClick, color, disabled, sm, lg, danger, ghost, sx = {} }) => {
  const C = useTheme();
  const c = danger ? C.danger : (color || C.accent);
  const [h, setH] = useState(false);
  return (
    <button className="btn-base" onClick={onClick} disabled={disabled}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        padding: lg ? "11px 24px" : sm ? "5px 14px" : "9px 20px",
        background: ghost ? "transparent" : disabled ? `${C.textDim}20` : h ? `${c}24` : `${c}14`,
        color: disabled ? C.textMuted : c,
        border: `1px solid ${disabled ? C.textDim + "20" : h ? c + "80" : c + "42"}`,
        borderRadius: 4, cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: font, fontSize: lg ? 13 : sm ? 11 : 12,
        letterSpacing:".09em", textTransform:"uppercase", fontWeight:700,
        display:"inline-flex", alignItems:"center", gap:7,
        boxShadow: h && !disabled ? `0 0 20px ${c}28, inset 0 0 14px ${c}08` : "none",
        transition:"all .18s",
        ...sx,
      }}>{children}</button>
  );
};

const Input = ({ label, value, onChange, placeholder, type = "text", sx = {}, tip }) => {
  const C = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom:10, ...sx }}>
      {label && (
        <label style={{ display:"flex", alignItems:"center", fontSize:10, color: focused ? C.accent : C.textMuted, textTransform:"uppercase", letterSpacing:".14em", marginBottom:5, fontFamily:font, fontWeight:700, transition:"color .15s" }}>
          {label}{tip && <TipIcon tip={tip} color={C.accent} />}
        </label>
      )}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width:"100%", padding:"9px 13px", background: focused ? `${C.accent}07` : C.bgInput, border:`1px solid ${focused ? C.accent+"65" : C.border}`, borderRadius:4, color:C.text, fontFamily:font, fontSize:13, outline:"none", transition:"all .18s", boxShadow: focused ? `0 0 0 3px ${C.accent}14,0 0 16px ${C.accent}10` : "none" }}
      />
    </div>
  );
};

const Select = ({ label, value, onChange, options, tip }) => {
  const C = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom:10 }}>
      {label && (
        <label style={{ display:"flex", alignItems:"center", fontSize:10, color: focused ? C.accent : C.textMuted, textTransform:"uppercase", letterSpacing:".14em", marginBottom:5, fontFamily:font, fontWeight:700, transition:"color .15s" }}>
          {label}{tip && <TipIcon tip={tip} color={C.accent} />}
        </label>
      )}
      <select value={value} onChange={e => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width:"100%", padding:"9px 13px", background:C.bgInput, border:`1px solid ${focused ? C.accent+"65" : C.border}`, borderRadius:4, color:C.text, fontFamily:font, fontSize:13, outline:"none", cursor:"pointer", transition:"all .18s", boxShadow: focused ? `0 0 0 3px ${C.accent}14` : "none" }}>
        {options.map(o => <option key={o.value} value={o.value} style={{ background:C.bgInput }}>{o.label}</option>)}
      </select>
    </div>
  );
};

const CheckLabel = ({ checked, onChange, children, tip }) => {
  const C = useTheme();
  return (
    <label style={{ fontFamily:font, fontSize:12, color:C.textMuted, display:"flex", gap:9, marginBottom:9, cursor:"pointer", alignItems:"center" }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width:14, height:14, accentColor:C.accent }} />
      <span>{children}</span>
      {tip && <TipIcon tip={tip} color={C.warn} />}
    </label>
  );
};

const Card = ({ title, children, color, accent, sx = {}, className="" }) => {
  const C = useTheme();
  const c = color || C.accent;
  return (
    <div className={`anim-up card-hover ${className}`}
      style={{ background:C.bgCard, borderRadius:7, padding:"clamp(12px,2vw,18px)", marginBottom:14, border:`1px solid ${c}18`, borderLeft:`2px solid ${c}75`, position:"relative", overflow:"hidden", backdropFilter:"blur(12px)", boxShadow:`0 4px 28px ${C.isDark?"rgba(0,0,0,.5)":"rgba(0,0,0,.08)"},inset 0 1px 0 ${c}10`, ...sx }}>
      {accent && <div style={{ position:"absolute", top:0, right:0, width:90, height:90, background:`radial-gradient(circle at top right,${c}10,transparent 70%)`, pointerEvents:"none" }} />}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:1, background:`linear-gradient(90deg,transparent,${c}35,transparent)`, pointerEvents:"none" }} />
      {title && (
        <div style={{ fontSize:11, color:c, textTransform:"uppercase", letterSpacing:".18em", marginBottom:12, fontFamily:fontDisplay, fontWeight:700, display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ width:6, height:6, background:c, borderRadius:"50%", boxShadow:`0 0 8px ${c},0 0 16px ${c}60`, flexShrink:0, display:"block", animation:"dotPulse 2s ease-in-out infinite" }} />
          {title}
        </div>
      )}
      {children}
    </div>
  );
};

const Stat = ({ label, value, color, icon }) => {
  const C = useTheme();
  const c = color || C.accent;
  return (
    <div className="anim-count card-hover" style={{ background:C.bgCard, border:`1px solid ${c}22`, borderRadius:7, padding:"12px 14px", minWidth:"clamp(80px,25vw,100px)", flex:1, position:"relative", overflow:"hidden", boxShadow:`0 4px 22px ${C.isDark?"rgba(0,0,0,.4)":"rgba(0,0,0,.07)"}`, backdropFilter:"blur(8px)" }}>
      <div style={{ position:"absolute", bottom:0, right:0, width:70, height:70, background:`radial-gradient(circle at bottom right,${c}14,transparent 70%)`, pointerEvents:"none" }} />
      <div style={{ fontSize:10, color:C.textMuted, textTransform:"uppercase", letterSpacing:".12em", fontFamily:font, marginBottom:7, display:"flex", alignItems:"center", gap:6 }}><span>{icon}</span>{label}</div>
      <div style={{ fontSize:"clamp(18px,4vw,26px)", color:c, fontFamily:fontDisplay, fontWeight:700, textShadow:`0 0 22px ${c}55` }}>{value}</div>
    </div>
  );
};

const Log = ({ lines = [], maxH = 200 }) => {
  const C = useTheme();
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [lines]);
  return (
    <div ref={ref} style={{ background:C.isDark?"#02060e":"#f7f9fc", border:`1px solid ${C.border}`, borderRadius:5, padding:"12px 14px", fontFamily:font, fontSize:12, color:C.accent, maxHeight:maxH, overflowY:"auto", whiteSpace:"pre-wrap", wordBreak:"break-all", lineHeight:1.7, boxShadow:`inset 0 2px 8px ${C.isDark?"rgba(0,0,0,.6)":"rgba(0,0,0,.04)"}` }}>
      {lines.length === 0 && <span style={{ color:C.textMuted }}><span style={{ animation:"blink 1s step-end infinite", display:"inline-block" }}>▋</span>{" "}Awaiting output...</span>}
      {lines.map((l, i) => {
        let isJson = false, formatted = l;
        try { if (l.trim().startsWith("{") || l.trim().startsWith("[")) { formatted = JSON.stringify(JSON.parse(l), null, 2); isJson = true; } } catch(e){}
        return (
          <div key={i} className="anim-fade" style={{ display:"flex", gap:9, marginBottom: isJson ? 7 : 0 }}>
            <span style={{ color:`${C.accent}50`, flexShrink:0 }}>›</span>
            {isJson
              ? <pre style={{ margin:0, padding:"7px 11px", background:`${C.accent}06`, borderRadius:4, border:`1px solid ${C.border}`, fontSize:11, color:C.info, overflowX:"auto", maxWidth:"100%", lineHeight:1.5 }}>{formatted}</pre>
              : <span style={{ color: l.includes("error")||l.includes("fail") ? C.danger : l.includes("✓")||l.includes("success") ? C.accent : C.text }}>{l}</span>}
          </div>
        );
      })}
    </div>
  );
};

const Table = ({ cols, data, onRow }) => {
  const C = useTheme();
  return (
    <div style={{ overflowX:"auto", borderRadius:5 }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:font, fontSize:12 }}>
        <thead>
          <tr style={{ background:`${C.accent}09` }}>
            {cols.map(c => <th key={c.key} style={{ textAlign:"left", padding:"9px 12px", color:C.accent, borderBottom:`1px solid ${C.border}`, fontSize:10, textTransform:"uppercase", letterSpacing:".13em", whiteSpace:"nowrap", fontWeight:700, fontFamily:fontDisplay }}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={i} onClick={() => onRow?.(r)}
              style={{ cursor:onRow?"pointer":"default", borderBottom:`1px solid ${C.border}45`, transition:"all .14s" }}
              onMouseEnter={e => { e.currentTarget.style.background=C.bgHover; if(onRow) e.currentTarget.style.boxShadow=`inset 3px 0 0 ${C.accent}`; }}
              onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.boxShadow="none"; }}>
              {cols.map(c => <td key={c.key} style={{ padding:"8px 12px", color:C.text, whiteSpace:"nowrap" }}>{c.render ? c.render(r[c.key], r) : r[c.key]}</td>)}
            </tr>
          ))}
          {data.length === 0 && <tr><td colSpan={cols.length} style={{ padding:32, textAlign:"center", color:C.textMuted, fontStyle:"italic" }}>No data available</td></tr>}
        </tbody>
      </table>
    </div>
  );
};

const PageTitle = ({ children, sub }) => {
  const C = useTheme();
  return (
    <div style={{ marginBottom:26 }}>
      <div style={{ display:"flex", alignItems:"center", gap:11, marginBottom:5 }}>
        <div style={{ width:3, height:24, background:C.accent, borderRadius:2, boxShadow:`0 0 12px ${C.accent}` }} />
        <h2 style={{ fontFamily:fontDisplay, color:C.accent, fontSize:"clamp(13px,3vw,18px)", fontWeight:700, margin:0, letterSpacing:".12em", textTransform:"uppercase", textShadow:`0 0 22px ${C.accent}45` }}>{children}</h2>
      </div>
      {sub && <div style={{ fontSize:12, color:C.textMuted, fontFamily:font, marginTop:3, paddingLeft:14 }}>{sub}</div>}
    </div>
  );
};

const Grid = ({ cols = 2, gap = 14, children, className="" }) => (
  <div className={`grid-${cols} ${className}`} style={{ display:"grid", gridTemplateColumns:`repeat(${cols},1fr)`, gap }}>{children}</div>
);
const Row = ({ gap = 9, wrap, children, sx = {}, className="" }) => (
  <div className={`stat-row ${className}`} style={{ display:"flex", gap, flexWrap:wrap?"wrap":"nowrap", ...sx }}>{children}</div>
);

// Modal component
const Modal = ({ title, children, onClose, color, wide }) => {
  const C = useTheme();
  const c = color || C.accent;
  useEffect(() => {
    const esc = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.7)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:20 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="anim-up" style={{ background:C.bgCard, border:`1px solid ${c}35`, borderRadius:9, padding:26, width:"100%", maxWidth: wide?860:560, maxHeight:"90vh", overflowY:"auto", width:"calc(100vw - 32px)", boxShadow:`0 32px 80px rgba(0,0,0,.7),0 0 40px ${c}12`, position:"relative" }}>
        <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${c}60,transparent)`, borderRadius:"9px 9px 0 0" }} />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontFamily:fontDisplay, fontSize:14, color:c, letterSpacing:".12em", textTransform:"uppercase", display:"flex", alignItems:"center", gap:9 }}>
            <span style={{ width:7, height:7, background:c, borderRadius:"50%", boxShadow:`0 0 9px ${c}` }} />
            {title}
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:4, color:C.textMuted, cursor:"pointer", padding:"4px 10px", fontFamily:font, fontSize:12 }}>✕ ESC</button>
        </div>
        {children}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
// PAGE: DASHBOARD — Full redesign with tool inventory
// ═══════════════════════════════════════════
const TOOL_ICONS = {
  wifi:"📡", capture:"📦", crack:"🔑", network:"🔍", attack:"⚔️",
  mitm:"🌐", enterprise:"🏢", crypto:"🔐", utility:"🔧", scan:"🛰", analysis:"🧪",
};
const TOOL_CAT_COLORS = {
  wifi:"#00ff95", capture:"#3ab5ff", crack:"#ff9500", network:"#6366f1",
  attack:"#ff2055", mitm:"#c084fc", enterprise:"#3ab5ff", crypto:"#ff9500",
  utility:"#4a6070", scan:"#00ff95", analysis:"#c084fc",
};

function DashboardPage() {
  const C = useTheme();
  const [pf, setPf] = useState(null);
  const [ld, setLd] = useState(false);
  const [angle, setAngle] = useState(0);
  const [pingDots, setPingDots] = useState([]);
  const [catFilter, setCatFilter] = useState("all");
  const [showMissing, setShowMissing] = useState(false);

  const run = useCallback(async () => {
    setLd(true); setPf(await api("/system/preflight")); setLd(false);
  }, []);
  useEffect(() => { run(); }, [run]);

  // Radar sweep
  useEffect(() => {
    const i = setInterval(() => setAngle(a => (a + 2) % 360), 20);
    return () => clearInterval(i);
  }, []);
  useEffect(() => {
    const i = setInterval(() => {
      const r = 28 + Math.random() * 58;
      const theta = Math.random() * Math.PI * 2;
      setPingDots(d => [...d.slice(-7), { id: Date.now(), x: 50 + r*Math.cos(theta), y: 50 + r*Math.sin(theta) }]);
    }, 1200);
    return () => clearInterval(i);
  }, []);

  const t = pf?.tools || {};
  const allTools = Object.entries(t);
  const inst = allTools.filter(([,v]) => v.installed).length;
  const tot = allTools.length;
  const ready = pf?.ready;
  const pct = tot > 0 ? Math.round((inst/tot)*100) : 0;

  // Group tools by category
  const categories = [...new Set(allTools.map(([,v]) => v.category||"utility"))].sort();
  const toolsByCategory = categories.reduce((acc, cat) => {
    acc[cat] = allTools.filter(([,v]) => (v.category||"utility") === cat);
    return acc;
  }, {});

  const displayTools = catFilter === "all"
    ? allTools
    : (toolsByCategory[catFilter] || []);
  const filtered = showMissing ? displayTools.filter(([,v]) => !v.installed) : displayTools;

  return (
    <div className="page-in">
      <PageTitle sub="System health, environment status, and complete tools inventory">System Overview</PageTitle>

      {/* ── HERO GRID ── */}
      <div style={{ display:"grid", gridTemplateColumns:"260px 1fr", gap:18, marginBottom:20 }}>

        {/* Radar panel */}
        <div className="hero-radar" style={{ background:C.bgCard, borderRadius:9, padding:18, border:`1px solid ${ready?C.accent:C.danger}22`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden", backdropFilter:"blur(12px)" }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:1, background:`linear-gradient(90deg,transparent,${ready?C.accent:C.danger}55,transparent)` }} />
          <div style={{ position:"relative", width:180, height:180, marginBottom:14 }}>
            <svg viewBox="0 0 100 100" style={{ width:"100%", height:"100%", position:"absolute", inset:0 }}>
              {[15,30,45].map(r => <circle key={r} cx="50" cy="50" r={r} fill="none" stroke={`${ready?C.accent:C.danger}18`} strokeWidth=".5"/>)}
              {[0,45,90,135].map(a => { const rad=a*Math.PI/180; return <line key={a} x1={50+48*Math.cos(rad)} y1={50+48*Math.sin(rad)} x2={50-48*Math.cos(rad)} y2={50-48*Math.sin(rad)} stroke={`${ready?C.accent:C.danger}12`} strokeWidth=".4"/>; })}
              <g transform={`rotate(${angle},50,50)`}>
                <path d={`M50,50 L50,5 A45,45 0 0,1 ${50+45*Math.sin(Math.PI*0.35)},${50-45*Math.cos(Math.PI*0.35)} Z`} fill={`${ready?C.accent:C.danger}20`}/>
                <line x1="50" y1="50" x2="50" y2="5" stroke={ready?C.accent:C.danger} strokeWidth="1.2" strokeLinecap="round" style={{filter:`drop-shadow(0 0 4px ${ready?C.accent:C.danger})`}}/>
              </g>
              {pingDots.map(d => <circle key={d.id} cx={d.x} cy={d.y} r="2.2" fill={ready?C.accent:C.warn} style={{animation:"radarPing 1.2s ease-out forwards",transformOrigin:`${d.x}px ${d.y}px`,opacity:.9}}/>)}
              <circle cx="50" cy="50" r="3" fill={ready?C.accent:C.danger} style={{filter:`drop-shadow(0 0 5px ${ready?C.accent:C.danger})`,animation:"orbPulse 2s ease-in-out infinite"}}/>
            </svg>
          </div>
          {ld ? <div style={{fontFamily:fontDisplay,fontSize:11,color:C.textMuted,letterSpacing:".15em"}}>SCANNING...</div> : (
            <>
              <div style={{fontFamily:fontDisplay,fontSize:18,fontWeight:900,color:ready?C.accent:C.danger,letterSpacing:".1em",textShadow:`0 0 22px ${ready?C.accent:C.danger}60`,textAlign:"center",animation:ready?"none":"glowDanger 2s ease-in-out infinite"}}>
                {ready?"SYSTEM READY":"NOT READY"}
              </div>
              <div style={{fontFamily:font,fontSize:11,color:C.textMuted,marginTop:6,textAlign:"center",lineHeight:1.6}}>
                {pf?.system?.distro?.slice(0,24)||"—"}<br/>
                Python {pf?.system?.python||"—"}
              </div>
              <div style={{marginTop:10,fontFamily:font,fontSize:12,color:pf?.system?.is_root?C.accent:C.danger}}>
                {pf?.system?.is_root ? "✓ Running as root" : "✗ Not root — required!"}
              </div>
            </>
          )}
        </div>

        {/* Right stats + tool coverage */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <Row gap={12} wrap>
            {[
              ["STATUS", ld?"…":ready?"READY":"FAIL", ready?C.accent:C.danger, "◉"],
              ["ROOT",   ld?"…":pf?.system?.is_root?"YES":"NO", pf?.system?.is_root?C.accent:C.danger, "⚡"],
              ["TOOLS",  ld?"…":`${inst}/${tot}`, pct===100?C.accent:pct>70?C.warn:C.danger, "⚙"],
              ["KERNEL", ld?"…":pf?.system?.kernel?.slice(0,12)||"—", C.info, "▣"],
            ].map(([l,v,c,i]) => <Stat key={l} label={l} value={v} color={c} icon={i}/>)}
          </Row>

          {/* Coverage bar card */}
          <div style={{ background:C.bgCard, borderRadius:7, padding:"16px 20px", border:`1px solid ${C.border}`, flex:1 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={{ fontFamily:fontDisplay, fontSize:11, color:C.accent, textTransform:"uppercase", letterSpacing:".15em" }}>Tool Coverage</div>
              <div style={{ fontFamily:fontDisplay, fontSize:24, color:pct===100?C.accent:C.warn, fontWeight:700, textShadow:`0 0 16px ${pct===100?C.accent:C.warn}60` }}>{pct}%</div>
            </div>
            {/* Segmented progress bar */}
            <div style={{ display:"flex", gap:2, marginBottom:14 }}>
              {categories.map(cat => {
                const catTools = toolsByCategory[cat] || [];
                const catInst = catTools.filter(([,v])=>v.installed).length;
                const catPct = catTools.length > 0 ? catInst/catTools.length : 0;
                const cc = TOOL_CAT_COLORS[cat] || C.textMuted;
                const w = `${(catTools.length/tot)*100}%`;
                return (
                  <Tip key={cat} tip={`${cat}: ${catInst}/${catTools.length} installed`}>
                    <div style={{ flex:catTools.length, height:8, borderRadius:2, background:`${cc}18`, overflow:"hidden", cursor:"help" }}>
                      <div style={{ height:"100%", width:`${catPct*100}%`, background:cc, borderRadius:2, transition:"width .8s cubic-bezier(.22,1,.36,1)", boxShadow:catPct===1?`0 0 6px ${cc}80`:"none" }}/>
                    </div>
                  </Tip>
                );
              })}
            </div>
            {/* Quick category stats */}
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {categories.map(cat => {
                const catTools = toolsByCategory[cat] || [];
                const catInst = catTools.filter(([,v])=>v.installed).length;
                const cc = TOOL_CAT_COLORS[cat] || C.textMuted;
                const all = catInst === catTools.length;
                return (
                  <div key={cat} onClick={()=>setCatFilter(f=>f===cat?"all":cat)} style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 9px", borderRadius:20, background:`${cc}${catFilter===cat?"22":"0e"}`, border:`1px solid ${cc}${catFilter===cat?"55":"25"}`, cursor:"pointer", transition:"all .18s" }}>
                    <span style={{ fontSize:12 }}>{TOOL_ICONS[cat]||"🔧"}</span>
                    <span style={{ fontFamily:font, fontSize:10, color:catFilter===cat?cc:C.textMuted }}>{cat}</span>
                    <span style={{ fontFamily:fontDisplay, fontSize:10, color:all?cc:C.warn, fontWeight:700 }}>{catInst}/{catTools.length}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── MISSING CRITICAL ── */}
      {pf?.missing_critical?.length > 0 && (
        <Card title="Missing Critical Tools — Install Required" color={C.danger} accent sx={{marginBottom:16}}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:8 }}>
            {pf.missing_critical.map(x => (
              <div key={x} style={{ padding:"10px 14px", background:`${C.danger}09`, borderRadius:5, border:`1px solid ${C.danger}22`, fontFamily:font }}>
                <div style={{ color:C.danger, fontSize:12, fontWeight:700, marginBottom:4 }}>✗ {x}</div>
                <div style={{ color:C.warn, fontSize:11, fontFamily:"monospace", background:`${C.warn}10`, padding:"3px 8px", borderRadius:3 }}>sudo apt install {t[x]?.package || x}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── TOOL INVENTORY ── */}
      <div style={{ marginBottom:12, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
        <div style={{ fontFamily:fontDisplay, fontSize:12, color:C.accent, textTransform:"uppercase", letterSpacing:".15em" }}>
          Tool Inventory
          {catFilter !== "all" && <span style={{ color:C.warn, marginLeft:10, fontSize:10 }}>· {catFilter}</span>}
        </div>
        <Row gap={8}>
          <button onClick={()=>setShowMissing(m=>!m)} style={{ background:showMissing?`${C.danger}20`:"transparent", border:`1px solid ${showMissing?C.danger+"55":C.border}`, borderRadius:4, color:showMissing?C.danger:C.textMuted, cursor:"pointer", padding:"5px 12px", fontFamily:font, fontSize:11, transition:"all .18s" }}>
            {showMissing?"✓ Showing missing only":"Show missing only"}
          </button>
          {catFilter !== "all" && <Btn sm ghost onClick={()=>setCatFilter("all")} color={C.textMuted}>✕ Clear filter</Btn>}
        </Row>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:8, marginBottom:14 }}>
        {filtered.map(([name, info]) => {
          const cat = info.category || "utility";
          const cc = TOOL_CAT_COLORS[cat] || C.textMuted;
          const ok = info.installed;
          return (
            <div key={name} className="card-hover" style={{ background:C.bgCard, borderRadius:6, padding:"12px 14px", border:`1px solid ${ok?cc+"18":C.danger+"22"}`, position:"relative", overflow:"hidden", backdropFilter:"blur(8px)", transition:"all .2s" }}>
              {/* left edge accent */}
              <div style={{ position:"absolute", left:0, top:0, bottom:0, width:3, background:ok?cc:C.danger, borderRadius:"3px 0 0 3px", boxShadow:`0 0 8px ${ok?cc:C.danger}50` }}/>
              {/* top shimmer */}
              {ok && <div style={{ position:"absolute", top:0, left:0, right:0, height:1, background:`linear-gradient(90deg,transparent,${cc}30,transparent)` }}/>}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", paddingLeft:8 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
                    <span style={{ fontSize:15 }}>{TOOL_ICONS[cat]||"🔧"}</span>
                    <span style={{ fontFamily:fontDisplay, fontSize:11, color:ok?C.text:C.textMuted, fontWeight:700, letterSpacing:".04em" }}>{name}</span>
                  </div>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    <Badge color={ok?cc:C.danger} sm>{ok?"✓ installed":"✗ missing"}</Badge>
                    <Badge color={TOOL_CAT_COLORS[cat]||C.textMuted} sm>{cat}</Badge>
                  </div>
                  {ok && info.version && (
                    <div style={{ marginTop:5, fontFamily:font, fontSize:10, color:C.textMuted }}>v{info.version}</div>
                  )}
                  {!ok && info.package && (
                    <div style={{ marginTop:6, fontFamily:"monospace", fontSize:10, color:C.warn, background:`${C.warn}0a`, padding:"2px 7px", borderRadius:3, display:"inline-block" }}>
                      apt install {info.package}
                    </div>
                  )}
                </div>
                {/* Status indicator */}
                <div style={{ width:10, height:10, borderRadius:"50%", background:ok?cc:C.danger, boxShadow:`0 0 8px ${ok?cc:C.danger}80`, flexShrink:0, marginTop:2, animation:ok?"none":"pulse 2s ease-in-out infinite" }}/>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ gridColumn:"1/-1", padding:"32px", textAlign:"center", fontFamily:font, fontSize:12, color:C.textMuted }}>
            {showMissing ? "All tools installed! ✓" : "No tools found."}
          </div>
        )}
      </div>

      {/* ── WARNINGS ── */}
      {pf?.warnings?.map((w, i) => (
        <div key={i} style={{ padding:"10px 16px", background:`${C.warn}08`, border:`1px solid ${C.warn}28`, borderLeft:`3px solid ${C.warn}`, borderRadius:5, color:C.warn, fontSize:12, fontFamily:font, marginBottom:9, display:"flex", gap:9, alignItems:"center" }}>
          <span>⚠</span>{w}
        </div>
      ))}

      <Btn onClick={run} disabled={ld} sx={{ marginTop:4 }}>{ld?<><Spinner size={14}/>Checking...</>:"↺ Re-run Preflight"}</Btn>
    </div>
  );
}

// ═══════════════════════════════════════════
// PAGE: INTERFACES
// ═══════════════════════════════════════════
function InterfacesPage() {
  const C = useTheme();
  const [ifs, setIfs] = useState([]); const [ld, setLd] = useState(false);
  const [log, setLog] = useState([]); const [mac, setMac] = useState(""); const [vendor, setVendor] = useState("");
  const refresh = async () => { setLd(true); const d = await api("/interfaces/"); if (Array.isArray(d)) setIfs(d); setLd(false); };
  useEffect(() => { refresh(); }, []);
  const act = async (n, a) => { setLog(p=>[...p,`${a} → ${n}`]); const r = await api(`/interfaces/${n}/${a}`, {method:"POST"}); setLog(p=>[...p,JSON.stringify(r,null,2)]); refresh(); };
  const chgMac = async n => { const q = vendor?`?vendor_prefix=${vendor}`:mac?`?new_mac=${mac}`:""; setLog(p=>[...p,`MAC change on ${n}${q}`]); const r = await api(`/interfaces/${n}/mac${q}`, {method:"POST"}); setLog(p=>[...p,JSON.stringify(r,null,2)]); refresh(); };
  const getChannels = async n => { const r = await api(`/interfaces/${n}/channels`); setLog(p=>[...p,`Channels for ${n}:`, JSON.stringify(r,null,2)]); };
  if (ld && ifs.length === 0) return <LoadingOverlay message="Scanning network interfaces" />;
  return (
    <div className="page-in">
      <PageTitle sub="Manage wireless adapters — monitor mode, MAC spoofing, TX power, channel support">Network Interfaces</PageTitle>
      <Btn onClick={refresh} disabled={ld} sx={{ marginBottom:16 }}>{ld?<><Spinner size={14}/>Scanning...</>:"↺ Refresh Interfaces"}</Btn>
      <div style={{ display:"grid", gap:14, gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", marginBottom:18 }}>
        {ifs.map(i => {
          const mc = i.mode==="monitor" ? C.accent : C.info;
          return (
            <div key={i.name} className="anim-up card-hover" style={{ background:C.bgCard, borderRadius:8, overflow:"hidden", border:`1px solid ${mc}22`, boxShadow:`0 4px 24px ${C.isDark?"rgba(0,0,0,.5)":"rgba(0,0,0,.08)"}`, backdropFilter:"blur(12px)" }}>
              <div style={{ height:3, background:`linear-gradient(90deg,${mc}90,${mc}30,transparent)` }} />
              <div style={{ padding:"13px 18px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:11, height:11, borderRadius:"50%", background:mc, boxShadow:`0 0 9px ${mc}`, animation:i.mode==="monitor"?"pulse 2s infinite":"none" }} />
                  <span style={{ fontFamily:fontDisplay, fontSize:15, color:mc, fontWeight:700, letterSpacing:".08em" }}>{i.name}</span>
                </div>
                <Row gap={5}><Badge color={mc}>{i.mode}</Badge><Badge color={i.is_up?C.accent:C.danger} sm>{i.is_up?"UP":"DOWN"}</Badge></Row>
              </div>
              <div style={{ padding:"13px 18px" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, fontFamily:font, fontSize:12, marginBottom:13 }}>
                  {[["MAC",i.mac||"—"],["Driver",i.driver||"—"],["Chipset",(i.chipset||"—").slice(0,28)],["TX Power",i.tx_power?`${i.tx_power} dBm`:"—"]].map(([k,v])=>(
                    <div key={k} style={{ padding:"6px 9px", background:C.bgInput, borderRadius:4, border:`1px solid ${C.border}45` }}>
                      <div style={{ fontSize:9, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em", marginBottom:2 }}>{k}</div>
                      <div style={{ color:C.text, fontSize:12, wordBreak:"break-all" }}>{v}</div>
                    </div>
                  ))}
                </div>
                <Row gap={5} sx={{ marginBottom:12, flexWrap:"wrap" }}>
                  <Badge color={i.supports_5ghz?C.accent:C.textMuted} sm>5 GHz {i.supports_5ghz?"✓":"✗"}</Badge>
                  <Badge color={i.supports_monitor?C.accent:C.textMuted} sm>Monitor {i.supports_monitor?"✓":"✗"}</Badge>
                </Row>
                <Row gap={7} sx={{ flexWrap:"wrap" }}>
                  {i.mode==="managed" ? <Btn sm onClick={()=>act(i.name,"monitor")} color={C.accent}>▶ Monitor Mode</Btn>
                    : <Btn sm onClick={()=>act(i.name,"managed")} color={C.warn}>◼ Managed Mode</Btn>}
                  <Btn sm onClick={()=>chgMac(i.name)} color={C.purple}>MAC Spoof</Btn>
                  <Btn sm onClick={()=>getChannels(i.name)} color={C.info} ghost>Channels</Btn>
                </Row>
              </div>
            </div>
          );
        })}
        {ifs.length === 0 && !ld && <div style={{ color:C.textMuted, fontFamily:font, padding:28, textAlign:"center" }}>No wireless interfaces detected</div>}
      </div>
      <Grid cols={2}>
        <Input label="Custom MAC" value={mac} onChange={setMac} placeholder="AA:BB:CC:DD:EE:FF" tip="Set a specific MAC address for the selected interface" />
        <Input label="Vendor Prefix (spoof)" value={vendor} onChange={setVendor} placeholder="00:1A:2B (mimics vendor)" tip="Spoof the first 3 octets to mimic a specific hardware vendor (e.g. Cisco, Apple, TP-Link)" />
      </Grid>
      <Card title="Operations Log" color={C.accentDim}><Log lines={log} /></Card>
    </div>
  );
}

// ═══════════════════════════════════════════
// PAGE: WIFI SCAN  — inline expandable rows, no modal
// ═══════════════════════════════════════════
function WifiScanPage() {
  const C = useTheme();
  const [iface, sI] = useState("wlan0mon"); const [ch, sCh] = useState(""); const [dur, sD] = useState("30");
  const [bssid, sB] = useState(""); const [essid, sE] = useState(""); const [band, sBa] = useState("bg");
  const [scanning, setSc] = useState(false);
  const [expandedBssid, setExpandedBssid] = useState(null);

  // Persistent state via module-level object
  const [res, setRes] = useState(wifiPersist.res);
  const [scans, setScans] = useState(wifiPersist.scans);
  const [pnl, setPnl] = useState(wifiPersist.pnl);

  const bands = [{value:"bg",label:"2.4 GHz"},{value:"a",label:"5 GHz"},{value:"abg",label:"Dual-Band"}];

  const loadScans = async () => { const d = await api("/wifi/scans"); if(Array.isArray(d)){setScans(d);wifiPersist.scans=d;} };
  const loadScan = async id => { const d = await api(`/wifi/scans/${id}`); setRes(d); wifiPersist.res=d; };
  const loadPnl = async id => { const r = await api(`/wifi/scans/${id}/pnl`); setPnl(r); wifiPersist.pnl=r; };
  useEffect(() => { loadScans(); }, []);

  const scan = async () => {
    setSc(true); setRes(null); setPnl(null); setExpandedBssid(null);
    wifiPersist.res=null; wifiPersist.pnl=null;
    const r = await api("/wifi/scan", {method:"POST", body:JSON.stringify({interface:iface,duration:parseInt(dur)||30,channel:ch?parseInt(ch):null,target_bssid:bssid||null,target_essid:essid||null,band})});
    setRes(r); wifiPersist.res=r; setSc(false); loadScans();
  };

  const aps = [...(res?.access_points||[])].sort((a,b) => (b.power||0)-(a.power||0));
  const clients = res?.clients||[];
  const pwrColor = v => v > -50 ? C.accent : v > -70 ? C.warn : C.danger;

  return (
    <div className="page-in">
      <PageTitle sub="Discover WiFi networks with airodump-ng — click any row to expand details · sorted by signal strength">WiFi Scanner</PageTitle>
      <Card title="Scan Configuration" accent>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10}}>
          <Input label="Interface" value={iface} onChange={sI} tip="Monitor-mode interface, e.g. wlan0mon" />
          <Select label="Band" value={band} onChange={sBa} options={bands} tip="2.4 GHz is most common. Use Dual-Band for full coverage" />
          <Input label="Channel" value={ch} onChange={sCh} placeholder="all" tip="Lock to a specific channel or leave blank to hop all channels" />
          <Input label="Duration (s)" value={dur} onChange={sD} tip="Scan duration in seconds. 30s for quick, 120s+ for thorough" />
          <Input label="Target BSSID" value={bssid} onChange={sB} placeholder="optional" tip="Focus on a specific AP by MAC address" />
          <Input label="Target ESSID" value={essid} onChange={sE} placeholder="optional" tip="Focus on a specific network by name" />
        </div>
        <Row gap={9} sx={{marginTop:10}}>
          <Btn onClick={scan} disabled={scanning} color={C.accent} lg>{scanning?<><Spinner size={14}/>Scanning...</>:"▶ Start Scan"}</Btn>
          <Btn onClick={loadScans} sm ghost>↺ History ({scans.length})</Btn>
        </Row>
      </Card>

      {scanning && <LoadingOverlay message={`Scanning ${band==="abg"?"dual-band":band==="a"?"5 GHz":"2.4 GHz"} airwaves`} duration={parseInt(dur)||30} />}

      {res && !scanning && (
        <>
          <Row gap={12} wrap sx={{marginBottom:14}}>
            {[["Networks",aps.length,C.accent,"📡"],["Clients",clients.length,C.purple,"📱"],["Open",aps.filter(a=>a.security==="open").length,C.danger,"⚠"],["Enterprise",aps.filter(a=>a.security?.includes("enterprise")).length,C.purple,"🏢"],["WPA3",aps.filter(a=>a.security==="wpa3").length,C.accent,"🔒"]].map(([l,v,c,i])=><Stat key={l} label={l} value={v} color={c} icon={i}/>)}
          </Row>
          <Card title={`Access Points (${aps.length}) — click any row to expand`} accent>
            <div style={{ overflowX:"auto", borderRadius:5 }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:font, fontSize:12 }}>
                <thead>
                  <tr style={{ background:`${C.accent}09` }}>
                    {["ESSID","BSSID","CH","PWR ↓","SEC","AUTH","BAND","VENDOR","CLI","PMKID",""].map(h=>(
                      <th key={h} style={{ textAlign:"left", padding:"9px 12px", color:C.accent, borderBottom:`1px solid ${C.border}`, fontSize:10, textTransform:"uppercase", letterSpacing:".13em", whiteSpace:"nowrap", fontWeight:700, fontFamily:fontDisplay }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {aps.map((ap) => {
                    const isOpen = expandedBssid === ap.bssid;
                    const key = ap.bssid || ap.essid || Math.random().toString();
                    return (
                      <Fragment key={key}>
                        <tr onClick={() => setExpandedBssid(isOpen ? null : ap.bssid)}
                          style={{ cursor:"pointer", borderBottom: isOpen ? "none" : `1px solid ${C.border}45`, background: isOpen ? `${C.purple}0a` : "transparent", transition:"background .14s" }}
                          onMouseEnter={e => { if(!isOpen) e.currentTarget.style.background = C.bgHover; }}
                          onMouseLeave={e => { e.currentTarget.style.background = isOpen ? `${C.purple}0a` : "transparent"; }}>
                          <td style={{padding:"8px 12px",fontWeight:700,color:C.text}}>{ap.essid||"<hidden>"}</td>
                          <td style={{padding:"8px 12px",color:C.textMuted,fontSize:11}}>{ap.bssid}</td>
                          <td style={{padding:"8px 12px",color:C.textMuted}}>{ap.channel}</td>
                          <td style={{padding:"8px 12px"}}><span style={{color:pwrColor(ap.power),fontWeight:700}}>{ap.power} dBm</span></td>
                          <td style={{padding:"8px 12px"}}><Badge color={SEC[ap.security]||C.textMuted} sm>{ap.security}</Badge></td>
                          <td style={{padding:"8px 12px",color:C.textMuted,fontSize:11}}>{ap.auth||"—"}</td>
                          <td style={{padding:"8px 12px",color:C.textMuted}}>{ap.band||"—"}</td>
                          <td style={{padding:"8px 12px"}}><span style={{color:C.purple,fontSize:11}}>{ap.manufacturer||"—"}</span></td>
                          <td style={{padding:"8px 12px"}}><span style={{color:C.accent,fontWeight:700}}>{ap.clients?.length||0}</span></td>
                          <td style={{padding:"8px 12px"}}>{ap.pmkid_available?<Badge color={C.warn} sm>YES</Badge>:"—"}</td>
                          <td style={{padding:"8px 12px",color:isOpen?C.purple:C.textMuted,fontSize:14,transition:"transform .2s",display:"inline-block",transform:isOpen?"rotate(180deg)":"rotate(0)"}}>▾</td>
                        </tr>
                        {isOpen && (
                          <tr key={`${key}-detail`}>
                            <td colSpan={11} style={{padding:0,borderBottom:`1px solid ${C.border}45`}}>
                              <div className="anim-up" style={{padding:"16px 20px",background:C.isDark?`rgba(10,5,30,0.96)`:`rgba(240,245,255,0.98)`,borderLeft:`3px solid ${C.purple}`}}>
                                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8,marginBottom:12}}>
                                  {[["BSSID",ap.bssid,C.text],["ESSID",ap.essid||"<hidden>",C.accent],["Channel",ap.channel,C.info],["Power",`${ap.power} dBm`,pwrColor(ap.power)],["Security",ap.security,SEC[ap.security]||C.textMuted],["Auth",ap.auth||"—",C.textMuted],["Band",ap.band||"—",C.textMuted],["Vendor",ap.manufacturer||"—",C.purple],["Beacons",ap.beacons||"—",C.textMuted],["Encryption",ap.encryption||"—",C.textMuted]].map(([k,v,c])=>(
                                    <div key={k} style={{padding:"6px 9px",background:C.bgInput,borderRadius:4,border:`1px solid ${C.border}40`}}>
                                      <div style={{fontSize:9,color:C.textMuted,textTransform:"uppercase",letterSpacing:".1em",marginBottom:2}}>{k}</div>
                                      <div style={{color:c,fontSize:12,wordBreak:"break-all",fontFamily:font,fontWeight:600}}>{String(v||"—")}</div>
                                    </div>
                                  ))}
                                </div>
                                {ap.pmkid_available&&<div style={{marginBottom:10,padding:"7px 12px",background:`${C.warn}10`,border:`1px solid ${C.warn}30`,borderRadius:5,fontFamily:font,fontSize:12,color:C.warn}}>⚡ PMKID available — try clientless attack via Advanced → PMKID tab first</div>}
                                {ap.security==="open"&&<div style={{marginBottom:10,padding:"7px 12px",background:`${C.danger}10`,border:`1px solid ${C.danger}30`,borderRadius:5,fontFamily:font,fontSize:12,color:C.danger}}>⚠ OPEN NETWORK — Critical finding. All traffic is in plaintext.</div>}
                                {ap.clients?.length>0&&(
                                  <div>
                                    <div style={{fontFamily:fontDisplay,fontSize:10,color:C.purple,textTransform:"uppercase",letterSpacing:".14em",marginBottom:7}}>Associated Clients ({ap.clients.length})</div>
                                    <Row gap={7} wrap>{ap.clients.map((c,ci)=><div key={ci} style={{padding:"5px 10px",background:C.bgInput,borderRadius:4,fontFamily:font,fontSize:11,color:C.text,border:`1px solid ${C.border}`}}>{typeof c==="object"?(c.mac||JSON.stringify(c)):c}</div>)}</Row>
                                  </div>
                                )}
                                <div style={{marginTop:10,fontFamily:font,fontSize:10,color:C.textMuted}}>▲ Click the row again to collapse</div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {aps.length===0&&<tr><td colSpan={11} style={{padding:32,textAlign:"center",color:C.textMuted,fontStyle:"italic"}}>No access points found</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
          {res.id && <Btn onClick={()=>loadPnl(res.id)} color={C.purple} sm sx={{marginBottom:14}}>Analyze PNL (Preferred Network Lists)</Btn>}
        </>
      )}

      {pnl && (
        <Card title="PNL Analysis — Evil Twin Intelligence" color={C.warn} accent>
          <Row gap={12} wrap sx={{marginBottom:12}}>
            <Stat label="Total Clients" value={pnl.total_clients} color={C.info}/>
            <Stat label="Associated" value={pnl.associated_clients} color={C.accent}/>
            <Stat label="Unassociated" value={pnl.unassociated_clients} color={C.warn}/>
          </Row>
          {pnl.evil_twin_candidates?.length>0&&(
            <div style={{padding:"11px 16px",background:`${C.danger}08`,border:`1px solid ${C.danger}28`,borderLeft:`3px solid ${C.danger}`,borderRadius:5,marginBottom:12}}>
              <div style={{color:C.danger,fontSize:11,fontFamily:fontDisplay,textTransform:"uppercase",letterSpacing:".15em",marginBottom:7}}>⚠ Evil Twin Candidates</div>
              {pnl.evil_twin_candidates.map(s=><div key={s} style={{color:C.warn,fontSize:13,fontFamily:font,marginBottom:3}}>• "{s}" — probed by multiple unassociated clients</div>)}
            </div>
          )}
          {pnl.unique_probed_networks?.length>0&&<div style={{fontFamily:font,fontSize:12,color:C.textMuted,marginBottom:10}}>All probed SSIDs: {pnl.unique_probed_networks.join(", ")}</div>}
          {pnl.clients?.map((c,i)=>(
            <div key={i} style={{padding:"9px 13px",background:C.bgInput,borderRadius:4,marginBottom:6,fontFamily:font,fontSize:12,borderLeft:`2px solid ${c.vulnerability_notes?.length?C.warn:C.accent}`}}>
              <Row gap={9} sx={{justifyContent:"space-between"}}>
                <span style={{color:C.text,fontWeight:700}}>{c.client_mac}</span>
                <span style={{color:C.purple}}>{c.manufacturer||"Unknown"}</span>
                <Badge color={c.is_associated?C.accent:C.textMuted} sm>{c.is_associated?"Assoc":"Free"}</Badge>
              </Row>
              {c.probed_networks?.length>0&&<div style={{color:C.textMuted,marginTop:4}}>Probes: {c.probed_networks.join(", ")}</div>}
              {c.vulnerability_notes?.map((n,j)=><div key={j} style={{color:C.warn,fontSize:11,marginTop:3}}>→ {n}</div>)}
            </div>
          ))}
        </Card>
      )}

      {scans.length>0&&!scanning&&(
        <Card title={`Scan History (${scans.length})`} color={C.info}>
          <div style={{maxHeight:220,overflowY:"auto"}}>
            {scans.map(s=>(
              <div key={s.id} onClick={()=>loadScan(s.id)}
                style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 13px",background:res?.id===s.id?`${C.accent}09`:C.bgInput,borderRadius:5,marginBottom:5,cursor:"pointer",fontFamily:font,fontSize:12,transition:"all .14s",borderLeft:`2px solid ${res?.id===s.id?C.accent:"transparent"}`}}
                onMouseEnter={e=>e.currentTarget.style.background=C.bgHover}
                onMouseLeave={e=>e.currentTarget.style.background=res?.id===s.id?`${C.accent}09`:C.bgInput}>
                <span style={{color:C.text}}>#{s.id} — {s.interface} ({s.band||"bg"})</span>
                <Row gap={7}><span style={{color:C.textMuted}}>{s.access_points?.length||0} APs</span><Badge color={s.status==="completed"?C.accent:C.warn} sm>{s.status}</Badge></Row>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// PAGE: HANDSHAKE & CRACK
// ═══════════════════════════════════════════
function HandshakePage() {
  const C = useTheme();
  const [iface,sI]=useState("wlan0mon");const [bssid,sB]=useState("");const [essid,sE]=useState("");const [ch,sCh]=useState("6");const [tout,sT]=useState("120");
  const [dea,sDa]=useState(true);const [dp,sDp]=useState("10");const [dc,sDc]=useState("");const [band,sBa]=useState("bg");
  const [cap,sCp]=useState(false);const [capR,sCR]=useState(null);
  const [cf,sCf]=useState("");const [cb,sCB]=useState("");const [wl,sWl]=useState("rockyou.txt");const [crk,sCrk]=useState(false);const [ckR,sCkR]=useState(null);
  const [di,sDI]=useState("wlan0mon");const [db,sDB]=useState("");const [dcc,sDCC]=useState("");const [dn,sDN]=useState("50");const [de,sDE]=useState("");const [dR,sDR]=useState(null);

  const capture=async()=>{sCp(true);sCR(null);const r=await api("/wifi/handshake",{method:"POST",body:JSON.stringify({interface:iface,target_bssid:bssid,target_essid:essid||null,channel:parseInt(ch),timeout:parseInt(tout),deauth_first:dea,deauth_packets:parseInt(dp),deauth_client:dc||null,band})});sCR(r);if(r.capture_file){sCf(r.capture_file);sCB(bssid);}sCp(false);};
  const crack=async()=>{sCrk(true);sCkR(null);sCkR(await api("/wifi/crack",{method:"POST",body:JSON.stringify({capture_file:cf,target_bssid:cb,wordlist:wl})}));sCrk(false);};
  const deauth=async()=>{sDR(await api("/wifi/deauth",{method:"POST",body:JSON.stringify({interface:di,target_bssid:db,client_mac:dcc||null,packets:parseInt(dn),use_essid:de||null,reason:"audit"})}));};

  return (
    <div className="page-in">
      <PageTitle sub="Capture WPA/WPA2 4-way handshake and crack with dictionary attack">Handshake & Crack</PageTitle>
      <Grid cols={2}>
        <Card title="1 · Capture Handshake" color={C.accent} accent>
          <Input label="Interface" value={iface} onChange={sI} tip="Monitor-mode interface for packet capture (e.g. wlan0mon)" />
          <Input label="Target BSSID" value={bssid} onChange={sB} placeholder="AA:BB:CC:DD:EE:FF" tip="MAC address of the target access point" />
          <Input label="Target ESSID (optional)" value={essid} onChange={sE} tip="Network name — optional, used for file naming" />
          <Grid cols={3}>
            <Input label="Channel" value={ch} onChange={sCh} tip="WiFi channel of the target AP (1-13 for 2.4GHz)" />
            <Input label="Timeout (s)" value={tout} onChange={sT} tip="Max seconds to wait for a handshake" />
            <Select label="Band" value={band} onChange={sBa} options={[{value:"bg",label:"2.4G"},{value:"a",label:"5G"},{value:"abg",label:"Dual"}]} />
          </Grid>
          <CheckLabel checked={dea} onChange={sDa} tip="Send aireplay-ng deauth packets to force clients to reconnect — triggering a new handshake capture">Send deauth to force reconnect</CheckLabel>
          {dea&&<Grid cols={2}><Input label="Deauth packets" value={dp} onChange={sDp} tip="Number of deauth frames to send (10-100 recommended)"/><Input label="Target client MAC" value={dc} onChange={sDc} placeholder="all (broadcast)" tip="Target a specific client MAC for stealth, or leave blank for broadcast deauth"/></Grid>}
          <Btn onClick={capture} disabled={cap||!bssid} lg>{cap?<><Spinner size={14}/>Capturing...</>:"▶ Capture Handshake"}</Btn>
          {cap&&<LoadingOverlay message="Capturing WPA handshake" duration={parseInt(tout)||120}/>}
          {capR&&!cap&&(
            <div className="anim-up" style={{marginTop:14,padding:"15px 19px",borderRadius:7,background:capR.handshake_captured?`${C.accent}09`:capR.error?`${C.danger}09`:`${C.warn}09`,border:`1px solid ${capR.handshake_captured?C.accent:capR.error?C.danger:C.warn}32`,borderLeft:`3px solid ${capR.handshake_captured?C.accent:capR.error?C.danger:C.warn}`}}>
              {capR.error?<div style={{color:C.danger,fontSize:13,fontWeight:600}}>✗ Error: {capR.error}</div>
              :capR.handshake_captured?<div><div style={{color:C.accent,fontSize:15,fontWeight:700,fontFamily:fontDisplay,letterSpacing:".08em"}}>✓ HANDSHAKE CAPTURED!</div><div style={{color:C.textMuted,fontSize:12,marginTop:6}}>Target: {capR.target_bssid}{capR.target_essid&&` (${capR.target_essid})`}</div>{capR.capture_file&&<div style={{color:C.info,fontSize:12,marginTop:4}}>📁 {capR.capture_file}</div>}<div style={{color:C.accent,fontSize:11,marginTop:7}}>→ File auto-loaded. Ready to crack →</div></div>
              :<div><div style={{color:C.warn,fontSize:13,fontWeight:600}}>⚠ No handshake captured</div><div style={{color:C.textMuted,fontSize:12,marginTop:5}}>Try: increase timeout, verify clients are connected, or use PMKID.</div></div>}
            </div>
          )}
        </Card>
        <Card title="2 · Crack WPA Key" color={C.warn} accent>
          <Input label="Capture File (.cap)" value={cf} onChange={sCf} tip="Path to the .cap file containing the WPA handshake" />
          <Input label="Target BSSID" value={cb} onChange={sCB} tip="MAC of the AP whose handshake you're cracking" />
          <Input label="Wordlist path" value={wl} onChange={sWl} tip="Path to dictionary file. /usr/share/wordlists/rockyou.txt is the standard starting point" />
          <Btn onClick={crack} disabled={crk||!cf} color={C.warn} lg>{crk?<><Spinner size={14}/>Cracking...</>:"▶ Crack Key"}</Btn>
          {ckR&&(
            <div className="anim-up" style={{marginTop:14}}>
              {ckR.success?(
                <div style={{padding:"20px",background:`${C.accent}06`,border:`1px solid ${C.accent}32`,borderRadius:7,textAlign:"center"}}>
                  <div style={{color:C.accent,fontSize:14,marginBottom:10,fontFamily:fontDisplay,fontWeight:700,letterSpacing:".12em"}}>✓ KEY FOUND!</div>
                  <div style={{color:C.warn,fontSize:28,fontFamily:fontDisplay,fontWeight:900,padding:"12px 22px",background:`${C.warn}12`,borderRadius:7,border:`2px solid ${C.warn}55`,display:"inline-block",textShadow:`0 0 32px ${C.warn}80`,animation:"glowPulse 2s ease-in-out infinite",letterSpacing:".06em"}}>{ckR.key}</div>
                  <div style={{color:C.textMuted,fontSize:12,marginTop:10,fontFamily:font}}>Target: {ckR.target_bssid}</div>
                </div>
              ):<div style={{padding:"15px 19px",background:`${C.danger}09`,border:`1px solid ${C.danger}28`,borderLeft:`3px solid ${C.danger}`,borderRadius:5}}><div style={{color:C.danger,fontSize:13,fontWeight:600}}>✗ Key not found in this wordlist</div><div style={{color:C.textMuted,fontSize:12,marginTop:5}}>Try a larger wordlist or generate custom ones with cewl/crunch.</div></div>}
            </div>
          )}
        </Card>
      </Grid>
      <Card title="Deauth Tool" color={C.danger} accent>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10}}>
          <Input label="Interface" value={di} onChange={sDI} tip="Monitor-mode interface to send deauth frames from"/>
          <Input label="AP BSSID" value={db} onChange={sDB} tip="MAC of the target access point"/>
          <Input label="Client MAC" value={dcc} onChange={sDCC} placeholder="broadcast" tip="Target a specific client or leave blank to disconnect ALL clients from the AP"/>
          <Input label="Packets" value={dn} onChange={sDN} tip="Number of deauth packets (50-200 typical)"/>
          <Input label="Or ESSID" value={de} onChange={sDE} placeholder="target by name" tip="Alternative: target by network name instead of BSSID"/>
        </div>
        <Btn onClick={deauth} disabled={!db&&!de} color={C.danger}>⚡ Send Deauth</Btn>
        {dR&&<div className="anim-up" style={{marginTop:11,padding:"11px 16px",borderRadius:5,background:`${dR.success?C.accent:dR.error?C.danger:C.warn}08`,border:`1px solid ${dR.success?C.accent:dR.error?C.danger:C.warn}28`,borderLeft:`3px solid ${dR.success?C.accent:dR.error?C.danger:C.warn}`}}>
          {dR.error?<div style={{color:C.danger,fontFamily:font,fontSize:12}}>✗ {dR.error}</div>:<div style={{fontFamily:font,fontSize:12}}><div style={{color:dR.success?C.accent:C.danger,fontWeight:600}}>{dR.success?"✓ Deauth sent":"✗ Failed"}</div><div style={{color:C.textMuted,fontSize:11,marginTop:4}}>Packets: {dR.packets_sent} · Target: {dR.target} · Client: {dR.client}</div></div>}
        </div>}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════
// PAGE: ADVANCED ATTACKS — Improved tabs + loading
// ═══════════════════════════════════════════
const AdvancedTabs = [
  {id:"pmkid",label:"PMKID",icon:"⚡",desc:"Clientless WPA2",color:"#ff9500"},
  {id:"apless",label:"AP-Less",icon:"◈",desc:"Honeypot Attack",color:"#c084fc"},
  {id:"enterprise",label:"Enterprise",icon:"🏢",desc:"802.1X / RADIUS",color:"#3ab5ff"},
  {id:"wpa3",label:"WPA3",icon:"🔒",desc:"SAE Attacks",color:"#00ff95"},
];

function AdvancedPage() {
  const C = useTheme();
  const [tab,setTab]=useState("pmkid");
  const [pI,sPI]=useState("wlan0mon");const [pB,sPB]=useState("");const [pCh,sPCh]=useState("6");const [pT,sPT]=useState("60");const [pLd,sPLd]=useState(false);const [pR,sPR]=useState(null);
  const [pcF,sPcF]=useState("");const [pcB,sPcB]=useState("");const [pcE,sPcE]=useState("");const [pcW,sPcW]=useState("rockyou.txt");const [pcLd,sPcLd]=useState(false);const [pcR,sPcR]=useState(null);
  const [aM,sAM]=useState("wlan0mon");const [aA,sAA]=useState("wlan1");const [aE,sAE]=useState("");const [aCh,sACh]=useState("6");const [aP,sAP]=useState("fakepassword123");const [aT,sAT]=useState("300");const [aLd,sALd]=useState(false);const [aR,sAR]=useState(null);const [aS,sAS]=useState(null);
  // AP-Less crack panel
  const [alCf,sAlCf]=useState("");const [alCb,sAlCb]=useState("");const [alWl,sAlWl]=useState("rockyou.txt");const [alCrk,sAlCrk]=useState(false);const [alCkR,sAlCkR]=useState(null);
  // AP-Less deauth panel
  const [alDi,sAlDi]=useState("wlan0mon");const [alDb,sAlDb]=useState("");const [alDcc,sAlDcc]=useState("");const [alDn,sAlDn]=useState("50");const [alDe,sAlDe]=useState("");const [alDR,sAlDR]=useState(null);
  const [eM,sEM]=useState("wlan0mon");const [eA,sEA]=useState("wlan1");const [eE,sEE]=useState("");const [eCh,sECh]=useState("6");const [eEap,sEEap]=useState("PEAP");const [eLd,sELd]=useState(false);const [eS,sES]=useState(null);const [eCreds,sECreds]=useState([]);
  const [w3I,sW3I]=useState("wlan0mon");const [w3B,sW3B]=useState("");const [w3Ch,sW3Ch]=useState("6");const [w3T,sW3T]=useState("transition_mode");const [w3Ld,sW3Ld]=useState(false);const [w3R,sW3R]=useState(null);

  const capPmkid=async()=>{sPLd(true);sPR(null);sPR(await api("/advanced/pmkid/capture",{method:"POST",body:JSON.stringify({interface:pI,target_bssid:pB,channel:parseInt(pCh),timeout:parseInt(pT)})}));sPLd(false);};
  const crkPmkid=async()=>{sPcLd(true);sPcR(null);sPcR(await api("/advanced/pmkid/crack",{method:"POST",body:JSON.stringify({pmkid_file:pcF,target_bssid:pcB,target_essid:pcE,wordlist:pcW})}));sPcLd(false);};
  const startApless=async()=>{sALd(true);sAR(null);const r=await api("/advanced/apless/start",{method:"POST",body:JSON.stringify({monitor_interface:aM,ap_interface:aA,target_essid:aE,channel:parseInt(aCh),fake_passphrase:aP,capture_timeout:parseInt(aT)})});sAR(r);if(r.capture_file){sAlCf(r.capture_file);}sALd(false);};
  const crackApless=async()=>{sAlCrk(true);sAlCkR(null);sAlCkR(await api("/wifi/crack",{method:"POST",body:JSON.stringify({capture_file:alCf,target_bssid:alCb,wordlist:alWl})}));sAlCrk(false);};
  const deauthApless=async()=>{sAlDR(await api("/wifi/deauth",{method:"POST",body:JSON.stringify({interface:alDi,target_bssid:alDb,client_mac:alDcc||null,packets:parseInt(alDn),use_essid:alDe||null,reason:"audit"})}));}
  const startEnt=async()=>{sELd(true);const r=await api("/advanced/enterprise/start",{method:"POST",body:JSON.stringify({monitor_interface:eM,ap_interface:eA,target_essid:eE,channel:parseInt(eCh),eap_type:eEap})});sES(r);sELd(false);};
  const stopEnt=async()=>{const r=await api("/advanced/enterprise/stop",{method:"POST"});sECreds(r.captured_credentials||[]);sES(null);};
  const w3Attack=async()=>{sW3Ld(true);sW3R(null);sW3R(await api("/advanced/wpa3/attack",{method:"POST",body:JSON.stringify({interface:w3I,target_bssid:w3B,channel:parseInt(w3Ch),attack_type:w3T,timeout:60})}));sW3Ld(false);};
  useEffect(()=>{api("/advanced/apless/status").then(sAS);api("/advanced/enterprise/status").then(sES);},[]);

  const curTab = AdvancedTabs.find(t=>t.id===tab);

  return (
    <div className="page-in">
      <PageTitle sub="PMKID clientless attack, AP-less honeypot, WPA2-Enterprise credential capture, WPA3 exploitation">Advanced Attacks</PageTitle>

      {/* Redesigned tab bar */}
      <div className="adv-tab-bar" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:22,background:C.bgCard,borderRadius:9,padding:8,border:`1px solid ${C.border}`}}>
        {AdvancedTabs.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={()=>setTab(t.id)} className="btn-base" style={{
              padding:"14px 10px", background:active?`${t.color}18`:"transparent",
              border:`1px solid ${active?t.color+"50":"transparent"}`,
              borderRadius:7, cursor:"pointer", fontFamily:font, transition:"all .22s",
              boxShadow:active?`0 0 20px ${t.color}30,inset 0 0 16px ${t.color}08`:"none",
              display:"flex", flexDirection:"column", alignItems:"center", gap:5,
            }}>
              <span style={{fontSize:22,filter:active?`drop-shadow(0 0 8px ${t.color})`:"none",transition:"filter .2s"}}>{t.icon}</span>
              <span style={{fontFamily:fontDisplay,fontSize:10,color:active?t.color:C.textMuted,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",transition:"color .2s"}}>{t.label}</span>
              <span style={{fontFamily:font,fontSize:10,color:active?`${t.color}b0`:C.textDim,transition:"color .2s"}}>{t.desc}</span>
              {active&&<div style={{width:28,height:2,background:t.color,borderRadius:1,boxShadow:`0 0 6px ${t.color}`,marginTop:3}}/>}
            </button>
          );
        })}
      </div>

      {/* Tab content indicator */}
      <div style={{marginBottom:16,padding:"10px 16px",background:`${curTab.color}08`,border:`1px solid ${curTab.color}25`,borderRadius:6,display:"flex",alignItems:"center",gap:10,fontFamily:font,fontSize:12,color:C.textMuted}}>
        <span style={{fontSize:18}}>{curTab.icon}</span>
        <div>
          <span style={{color:curTab.color,fontWeight:700}}>{curTab.label}</span>
          {tab==="pmkid"&&" — Try this first on any WPA2 target. No clients needed, only the AP must be on."}
          {tab==="apless"&&" — Creates a fake AP to capture handshakes from probing clients when the real AP is absent."}
          {tab==="enterprise"&&" — Deploys rogue RADIUS to intercept 802.1X credentials. Requires two WiFi adapters."}
          {tab==="wpa3"&&" — Detects WPA3 transition mode (WPA2+WPA3) which is vulnerable to downgrade attacks."}
        </div>
      </div>

      {tab==="pmkid"&&(
        <Grid cols={2}>
          <Card title="PMKID Capture (No Clients Needed)" color={C.warn} accent>
            <div style={{fontSize:12,color:C.textMuted,fontFamily:font,marginBottom:12,lineHeight:1.7}}>Captures PMKID from the AP's first EAPOL frame. No connected clients needed — only the AP must be powered on.</div>
            <Input label="Interface (monitor)" value={pI} onChange={sPI} tip="Monitor-mode interface, e.g. wlan0mon"/>
            <Input label="Target BSSID" value={pB} onChange={sPB} placeholder="AA:BB:CC:DD:EE:FF" tip="MAC address of the target access point"/>
            <Grid cols={2}><Input label="Channel" value={pCh} onChange={sPCh} tip="WiFi channel of target AP"/><Input label="Timeout (s)" value={pT} onChange={sPT} tip="Seconds to attempt capture"/></Grid>
            <Btn onClick={capPmkid} disabled={pLd||!pB} color={C.warn} lg>{pLd?<><Spinner size={14}/>Capturing PMKID...</>:"▶ Capture PMKID"}</Btn>
            {pLd&&<LoadingOverlay message="Capturing PMKID hash" duration={parseInt(pT)||60}/>}
            {pR&&!pLd&&(
              <div className="anim-up" style={{marginTop:12,padding:"13px 17px",borderRadius:7,background:pR.pmkid_captured?`${C.accent}09`:pR.error?`${C.danger}09`:`${C.warn}09`,border:`1px solid ${pR.pmkid_captured?C.accent:pR.error?C.danger:C.warn}32`,borderLeft:`3px solid ${pR.pmkid_captured?C.accent:pR.error?C.danger:C.warn}`}}>
                {pR.error?<div style={{color:C.danger,fontFamily:font,fontSize:12}}>✗ {pR.error}</div>
                :pR.pmkid_captured?<div><div style={{color:C.accent,fontSize:14,fontWeight:700,fontFamily:fontDisplay}}>✓ PMKID CAPTURED!</div><div style={{color:C.textMuted,fontSize:12,fontFamily:font,marginTop:5}}>Method: <span style={{color:C.info}}>{pR.method}</span></div>{pR.hash_file&&<div style={{color:C.warn,fontSize:12,fontFamily:font}}>Hash: {pR.hash_file}</div>}<div style={{color:C.accent,fontSize:11,fontFamily:font,marginTop:7}}>→ Copy hash file path to Crack panel →</div></div>
                :<div><div style={{color:C.warn,fontSize:13,fontFamily:font,fontWeight:600}}>⚠ No PMKID captured</div><div style={{color:C.textMuted,fontSize:12,fontFamily:font,marginTop:5}}>This AP may not support PMKID. Try traditional handshake instead.</div></div>}
              </div>
            )}
          </Card>
          <Card title="Crack PMKID" color={C.warn} accent>
            <div style={{fontSize:12,color:C.textMuted,fontFamily:font,marginBottom:12,lineHeight:1.7}}>GPU-accelerated cracking with hashcat (.22000 files) or CPU with aircrack-ng (.cap files).</div>
            <Input label="PMKID File (.22000 or .cap)" value={pcF} onChange={sPcF} tip="Full path to hash file from capture step"/>
            <Input label="Target BSSID" value={pcB} onChange={sPcB} tip="MAC of the target AP"/>
            <Input label="Target ESSID" value={pcE} onChange={sPcE} tip="Network name — improves crack performance"/>
            <Input label="Wordlist" value={pcW} onChange={sPcW} tip="Path to wordlist. rockyou.txt has ~14M passwords"/>
            <Btn onClick={crkPmkid} disabled={pcLd||!pcF} color={C.warn} lg>{pcLd?<><Spinner size={14}/>Cracking...</>:"▶ Crack PMKID"}</Btn>
            {pcLd&&<LoadingOverlay message="Running hashcat / aircrack-ng"/>}
            {pcR&&!pcLd&&(
              <div className="anim-up" style={{marginTop:12,fontFamily:font}}>
                {pcR.success?<div style={{padding:"18px",background:`${C.accent}07`,border:`1px solid ${C.accent}30`,borderRadius:7,textAlign:"center"}}><div style={{color:C.accent,fontSize:13}}>✓ KEY FOUND:</div><div style={{color:C.warn,fontSize:22,fontFamily:fontDisplay,fontWeight:900,marginTop:6}}>{pcR.key}</div></div>
                :<div style={{color:C.danger}}>✗ Not found in wordlist</div>}
              </div>
            )}
          </Card>
        </Grid>
      )}

      {tab==="apless"&&(
        <div>
          {/* MAC Spoofing recommendation banner */}
          <div style={{marginBottom:14,padding:"11px 16px",background:`${C.warn}09`,border:`1px solid ${C.warn}28`,borderLeft:`3px solid ${C.warn}`,borderRadius:6,fontFamily:font,fontSize:12,color:C.warn,display:"flex",gap:10,alignItems:"flex-start"}}>
            <span style={{fontSize:16,flexShrink:0}}>💡</span>
            <div>
              <div style={{fontWeight:700,marginBottom:3}}>Recommended: Spoof your AP interface MAC to match the target BSSID</div>
              <div style={{color:C.textMuted,lineHeight:1.6}}>
                Go to <span style={{color:C.accent}}>Interfaces</span> → select your AP adapter → click <span style={{color:C.accent}}>MAC Spoof</span> → enter the target AP's BSSID as the custom MAC.
                This makes clients believe they are connecting to the real AP, significantly increasing the success rate of the honeypot capture.
              </div>
            </div>
          </div>

          <Grid cols={2}>
            {/* Left: Honeypot capture */}
            <Card title="AP-Less Honeypot Capture" color={C.purple} accent>
              <div style={{fontSize:12,color:C.textMuted,fontFamily:font,marginBottom:12,lineHeight:1.7}}>Creates a fake AP with the target ESSID. When a client probes for this SSID, it connects and the WPA handshake is captured. <span style={{color:C.warn,fontWeight:600}}>Requires TWO WiFi adapters.</span></div>
              <Grid cols={3}>
                <Input label="Monitor Interface" value={aM} onChange={sAM} tip="Interface in monitor mode for packet capture"/>
                <Input label="AP Interface (2nd)" value={aA} onChange={sAA} tip="Second WiFi adapter for running the fake AP. Spoof its MAC to match the real AP's BSSID for better results."/>
                <Input label="Target ESSID" value={aE} onChange={sAE} placeholder="Corp_WiFi" tip="The exact SSID name your target clients are searching for"/>
              </Grid>
              <Grid cols={3}>
                <Input label="Channel" value={aCh} onChange={sACh} tip="WiFi channel for the honeypot AP. Use the same channel as the real AP."/>
                <Input label="Fake Passphrase" value={aP} onChange={sAP} tip="Any passphrase — the client tries its real password which causes PSK-MISMATCH, but the handshake was already captured"/>
                <Input label="Timeout (s)" value={aT} onChange={sAT} tip="How long to keep the honeypot running"/>
              </Grid>
              <Btn onClick={startApless} disabled={aLd||!aE} color={C.purple} lg>
                {aLd?<><Spinner size={14}/>Running honeypot...</>:"▶ Launch AP-Less Attack"}
              </Btn>
              {aLd&&<LoadingOverlay message="Honeypot active — waiting for client probes" duration={parseInt(aT)||300}/>}
              {aR&&!aLd&&(
                <div className="anim-up" style={{marginTop:12,padding:"14px 18px",borderRadius:7,fontFamily:font,fontSize:12,background:aR.handshake_captured?`${C.accent}09`:aR.error?`${C.danger}09`:`${C.warn}09`,border:`1px solid ${aR.handshake_captured?C.accent:aR.error?C.danger:C.warn}32`,borderLeft:`3px solid ${aR.handshake_captured?C.accent:aR.error?C.danger:C.warn}`}}>
                  {aR.error ? <div style={{color:C.danger}}>✗ {aR.error}</div>
                  : aR.handshake_captured ? (
                    <div>
                      <div style={{color:C.accent,fontSize:14,fontWeight:700,fontFamily:fontDisplay}}>✓ HANDSHAKE CAPTURED!</div>
                      {aR.capture_file && <div style={{color:C.info,fontSize:12,marginTop:5}}>📁 {aR.capture_file}</div>}
                      <div style={{color:C.accent,fontSize:11,marginTop:7}}>→ File auto-loaded in Crack panel →</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{color:C.warn,fontSize:13,fontWeight:600}}>⚠ No handshake captured</div>
                      <div style={{color:C.textMuted,fontSize:12,marginTop:5}}>No client probed for this SSID. Try increasing timeout, confirm the SSID is in clients' PNL, or spoof the AP MAC.</div>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Right: Crack the captured handshake */}
            <Card title="Crack Captured Handshake" color={C.warn} accent>
              <div style={{fontSize:12,color:C.textMuted,fontFamily:font,marginBottom:12,lineHeight:1.7}}>
                Crack the WPA key from the handshake captured by the honeypot. The capture file path is auto-filled after a successful capture.
              </div>
              <Input label="Capture File (.cap)" value={alCf} onChange={sAlCf} tip="Path to the .cap file from the honeypot capture. Auto-filled after successful capture."/>
              <Input label="Target BSSID" value={alCb} onChange={sAlCb} placeholder="AA:BB:CC:DD:EE:FF" tip="MAC of the real AP (the BSSID you're targeting)"/>
              <Input label="Wordlist" value={alWl} onChange={sAlWl} tip="Path to wordlist. /usr/share/wordlists/rockyou.txt is the standard starting point"/>
              <Btn onClick={crackApless} disabled={alCrk||!alCf} color={C.warn} lg>
                {alCrk?<><Spinner size={14}/>Cracking...</>:"▶ Crack Handshake"}
              </Btn>
              {alCrk&&<LoadingOverlay message="Running aircrack-ng dictionary attack"/>}
              {alCkR && !alCrk && (
                <div className="anim-up" style={{marginTop:14}}>
                  {alCkR.success ? (
                    <div style={{padding:"20px",background:`${C.accent}06`,border:`1px solid ${C.accent}32`,borderRadius:7,textAlign:"center"}}>
                      <div style={{color:C.accent,fontSize:14,marginBottom:10,fontFamily:fontDisplay,fontWeight:700,letterSpacing:".12em"}}>✓ KEY FOUND!</div>
                      <div style={{color:C.warn,fontSize:28,fontFamily:fontDisplay,fontWeight:900,padding:"12px 22px",background:`${C.warn}12`,borderRadius:7,border:`2px solid ${C.warn}55`,display:"inline-block",textShadow:`0 0 32px ${C.warn}80`,animation:"glowPulse 2s ease-in-out infinite",letterSpacing:".06em"}}>{alCkR.key}</div>
                      <div style={{color:C.textMuted,fontSize:12,marginTop:10,fontFamily:font}}>Target: {alCkR.target_bssid}</div>
                    </div>
                  ) : (
                    <div style={{padding:"15px 19px",background:`${C.danger}09`,border:`1px solid ${C.danger}28`,borderLeft:`3px solid ${C.danger}`,borderRadius:5}}>
                      <div style={{color:C.danger,fontSize:13,fontWeight:600}}>✗ Key not found in this wordlist</div>
                      <div style={{color:C.textMuted,fontSize:12,marginTop:5}}>Try a larger wordlist or generate a custom one with cewl or crunch.</div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </Grid>

          {/* Deauth tool for AP-Less */}
          <Card title="Deauth Tool — Force Clients to Disconnect" color={C.danger} accent sx={{marginTop:0}}>
            <div style={{fontSize:12,color:C.textMuted,fontFamily:font,marginBottom:10,lineHeight:1.6}}>
              Send deauth frames to force clients off the real AP. Combined with the honeypot, clients will probe for the SSID and connect to your fake AP, triggering handshake capture.
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10}}>
              <Input label="Monitor Interface" value={alDi} onChange={sAlDi} tip="Interface in monitor mode for sending deauth frames"/>
              <Input label="Real AP BSSID" value={alDb} onChange={sAlDb} tip="MAC of the legitimate AP you want to deauth clients from"/>
              <Input label="Client MAC" value={alDcc} onChange={sAlDcc} placeholder="broadcast (all)" tip="Target a specific client or leave blank to disconnect ALL clients"/>
              <Input label="Packets" value={alDn} onChange={sAlDn} tip="Number of deauth packets (50-200 typical). More = faster client disconnection."/>
              <Input label="Or ESSID" value={alDe} onChange={sAlDe} placeholder="target by name" tip="Alternative: target by network name instead of BSSID"/>
            </div>
            <Btn onClick={deauthApless} disabled={!alDb&&!alDe} color={C.danger}>⚡ Send Deauth</Btn>
            {alDR&&(
              <div className="anim-up" style={{marginTop:11,padding:"11px 16px",borderRadius:5,background:`${alDR.success?C.accent:alDR.error?C.danger:C.warn}08`,border:`1px solid ${alDR.success?C.accent:alDR.error?C.danger:C.warn}28`,borderLeft:`3px solid ${alDR.success?C.accent:alDR.error?C.danger:C.warn}`}}>
                {alDR.error?<div style={{color:C.danger,fontFamily:font,fontSize:12}}>✗ {alDR.error}</div>
                :<div style={{fontFamily:font,fontSize:12}}><div style={{color:alDR.success?C.accent:C.danger,fontWeight:600}}>{alDR.success?"✓ Deauth packets sent":"✗ Failed"}</div><div style={{color:C.textMuted,fontSize:11,marginTop:4}}>Packets: {alDR.packets_sent} · Target: {alDR.target}</div></div>}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab==="enterprise"&&(
        <Card title="WPA2-Enterprise / 802.1X Attack" color={C.info} accent>
          <div style={{fontSize:12,color:C.textMuted,fontFamily:font,marginBottom:12,lineHeight:1.7,maxWidth:700}}>Deploys a rogue RADIUS server + Evil Twin AP to intercept EAP credentials (PEAP, EAP-TTLS). Captures usernames and password hashes. <span style={{color:C.warn,fontWeight:600}}>Requires TWO WiFi adapters.</span></div>
          <Grid cols={3}><Input label="Monitor Interface" value={eM} onChange={sEM} tip="Monitor-mode interface"/><Input label="AP Interface" value={eA} onChange={sEA} tip="Second adapter for the rogue AP"/><Input label="Target ESSID" value={eE} onChange={sEE} placeholder="Corp_Enterprise" tip="Must exactly match the enterprise network name"/></Grid>
          <Grid cols={2}><Input label="Channel" value={eCh} onChange={sECh}/><Select label="EAP Type" value={eEap} onChange={sEEap} options={[{value:"PEAP",label:"PEAP (most common)"},{value:"EAP-TTLS",label:"EAP-TTLS"},{value:"EAP-TLS",label:"EAP-TLS (cert-based)"}]} tip="PEAP is the most common enterprise protocol. Use EAP-TTLS for Cisco environments."/></Grid>
          {!eS?.active?<Btn onClick={startEnt} disabled={eLd||!eE} color={C.info} lg>{eLd?<><Spinner size={14}/>Deploying RADIUS...</>:"▶ Start Enterprise Attack"}</Btn>
          :<div><Badge color={C.accent}>ACTIVE</Badge><Btn onClick={stopEnt} danger sm sx={{marginLeft:9}}>◼ Stop & Extract Creds</Btn></div>}
          {eLd&&<LoadingOverlay message="Deploying rogue RADIUS server"/>}
          {eCreds.length>0&&(
            <Card title={`Captured Credentials (${eCreds.length})`} color={C.danger} sx={{marginTop:12}}>
              {eCreds.map((c,i)=>(
                <div key={i} style={{padding:"7px 12px",background:C.bgInput,borderRadius:4,marginBottom:5,fontFamily:font,fontSize:12}}>
                  <Badge color={C.warn} sm>{c.type}</Badge>
                  {c.username&&<span style={{color:C.text,marginLeft:9}}>{c.username}</span>}
                  {c.password&&<span style={{color:C.danger,marginLeft:9}}>{c.password}</span>}
                </div>
              ))}
            </Card>
          )}
        </Card>
      )}

      {tab==="wpa3"&&(
        <Card title="WPA3 / SAE Attacks" color={C.accent} accent>
          <div style={{fontSize:12,color:C.textMuted,fontFamily:font,marginBottom:12,lineHeight:1.7,maxWidth:700}}>WPA3 uses SAE (Dragonfly handshake) which resists offline dictionary attacks. However, APs in Transition Mode (WPA2+WPA3) are vulnerable to downgrade attacks that force clients back to WPA2.</div>
          <Grid cols={4}><Input label="Interface" value={w3I} onChange={sW3I} tip="Monitor-mode interface"/><Input label="Target BSSID" value={w3B} onChange={sW3B} tip="MAC of the WPA3 target AP"/><Input label="Channel" value={w3Ch} onChange={sW3Ch}/><Select label="Attack Type" value={w3T} onChange={sW3T} options={[{value:"transition_mode",label:"Check Transition Mode"},{value:"downgrade",label:"Downgrade Exploit"},{value:"dos",label:"SAE DoS Flood"}]} tip="Check Transition Mode first — if detected, use Downgrade Exploit"/></Grid>
          <Btn onClick={w3Attack} disabled={w3Ld||!w3B} color={C.accent} lg>{w3Ld?<><Spinner size={14}/>Executing...</>:"▶ Execute"}</Btn>
          {w3Ld&&<LoadingOverlay message="Executing WPA3 attack"/>}
          {w3R&&!w3Ld&&(
            <div className="anim-up" style={{marginTop:14}}>
              {w3R.error?<div style={{padding:"13px 17px",background:`${C.danger}09`,border:`1px solid ${C.danger}30`,borderLeft:`3px solid ${C.danger}`,borderRadius:5,fontFamily:font,fontSize:12,color:C.danger}}>✗ {w3R.error}</div>
              :<div style={{padding:"15px 19px",borderRadius:7,fontFamily:font,fontSize:12,lineHeight:1.8,background:w3R.transition_mode_detected?`${C.warn}09`:`${C.accent}07`,border:`1px solid ${w3R.transition_mode_detected?C.warn:C.accent}28`,borderLeft:`3px solid ${w3R.transition_mode_detected?C.warn:C.accent}`}}>
                {w3R.transition_mode_detected!==undefined&&<div style={{fontFamily:fontDisplay,fontSize:14,fontWeight:700,color:w3R.transition_mode_detected?C.warn:C.accent,marginBottom:9,letterSpacing:".06em"}}>{w3R.transition_mode_detected?"⚠ TRANSITION MODE — VULNERABLE":"✓ WPA3-ONLY — SECURE"}</div>}
                {w3R.security_info&&<div style={{color:C.text}}>{w3R.security_info}</div>}
                {w3R.recommendation&&<div style={{color:C.info,marginTop:9,padding:"8px 12px",background:`${C.info}08`,borderRadius:4,borderLeft:`2px solid ${C.info}40`}}>{w3R.recommendation}</div>}
                {w3R.next_steps&&<div style={{marginTop:9}}>{w3R.next_steps.map((s,i)=><div key={i} style={{color:C.text,fontSize:12,padding:"2px 0"}}>{s}</div>)}</div>}
                {w3R.note&&<div style={{color:C.warn,marginTop:9,fontStyle:"italic"}}>{w3R.note}</div>}
              </div>}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// PAGE: RECON — HostDetailPanel OUTSIDE component to prevent re-renders
// ═══════════════════════════════════════════
// Persist base hosts and detail across navigation
const reconPersist = { baseHosts: [], scanInfo: null, scans: [], detailHost: null };

// Standalone component — defined OUTSIDE ReconPage to prevent remount on every render
function HostDetailPanel({ host, onClose, C }) {
  if (!host) return null;
  const openPorts = host.ports?.filter(p => p.state === "open") || [];
  const vulns = host.vulnerabilities || host.vuln_scripts || [];
  const isSingleHost = host._isSingleHost;
  const color = host._scanType === "vuln" ? C.warn : C.info;

  return (
    <div className="anim-up" style={{ padding:"18px 22px", background:C.isDark?`rgba(5,2,20,0.97)`:`rgba(238,244,255,0.99)`, border:`1px solid ${color}35`, borderLeft:`3px solid ${color}`, borderRadius:7, marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ fontFamily:fontDisplay, fontSize:13, color, letterSpacing:".1em" }}>
          {host._scanType==="vuln" ? "🔍 VULN SCAN" : "🔎 DEEP SCAN"} — {host._ip || host.ip}
        </div>
        <Btn sm onClick={onClose} color={C.textMuted} ghost>✕ Close</Btn>
      </div>

      {/* Host meta */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:8, marginBottom:14 }}>
        {[["IP", host.ip||host._ip, C.text], ["MAC", host.mac||"—", C.textMuted], ["Hostname", host.hostname||"—", C.info], ["OS", host.os_guess||"—", C.purple], ["Status", host.status||"—", host.status==="up"?C.accent:C.danger]].map(([k,v,c]) => (
          <div key={k} style={{ padding:"7px 10px", background:C.bgInput, borderRadius:4, border:`1px solid ${C.border}45` }}>
            <div style={{ fontSize:9, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em" }}>{k}</div>
            <div style={{ color:c, fontSize:12, marginTop:2, wordBreak:"break-all", fontFamily:font }}>{String(v)}</div>
          </div>
        ))}
      </div>

      {/* Open ports */}
      {openPorts.length > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontFamily:fontDisplay, fontSize:11, color:C.accent, textTransform:"uppercase", letterSpacing:".14em", marginBottom:9 }}>Open Ports ({openPorts.length})</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:6 }}>
            {openPorts.map((p, i) => (
              <div key={i} style={{ display:"flex", gap:10, padding:"7px 11px", background:C.bgInput, borderRadius:5, border:`1px solid ${C.border}40`, alignItems:"center" }}>
                <span style={{ color:C.warn, minWidth:75, fontWeight:700, fontFamily:fontDisplay, fontSize:11 }}>{p.port}/{p.protocol}</span>
                <span style={{ color:C.text, flex:1, fontFamily:font, fontSize:12 }}>{p.service||"unknown"}</span>
                {p.version && <Badge color={C.info} sm>{p.version}</Badge>}
                {p.scripts && Object.keys(p.scripts).length > 0 && <Badge color={C.danger} sm>scripts</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Services */}
      {host.services?.length > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontFamily:fontDisplay, fontSize:11, color:C.info, textTransform:"uppercase", letterSpacing:".14em", marginBottom:9 }}>Service Details</div>
          {host.services.map((s, i) => (
            <div key={i} style={{ padding:"6px 11px", background:C.bgInput, borderRadius:4, marginBottom:5, display:"flex", gap:9, alignItems:"center", fontFamily:font, fontSize:12 }}>
              <Badge color={C.warn} sm>{s.port}</Badge>
              <span style={{ color:C.text }}>{s.name}</span>
              <span style={{ color:C.accent }}>{s.product}</span>
              {s.version && <Badge color={C.info} sm>v{s.version}</Badge>}
              {s.extra && <span style={{ color:C.textMuted, fontSize:11 }}>({s.extra})</span>}
            </div>
          ))}
        </div>
      )}

      {/* Vulnerabilities */}
      {vulns.length > 0 && (
        <div>
          <div style={{ fontFamily:fontDisplay, fontSize:11, color:C.danger, textTransform:"uppercase", letterSpacing:".14em", marginBottom:9 }}>Vulnerabilities ({vulns.length})</div>
          {vulns.map((v, i) => (
            <div key={i} style={{ padding:"9px 13px", background:`${C.danger}07`, border:`1px solid ${C.danger}25`, borderLeft:`3px solid ${C.danger}`, borderRadius:5, marginBottom:7, fontFamily:font, fontSize:12 }}>
              <div style={{ color:C.danger, fontWeight:700 }}>{v.name||v.id||"Vulnerability"}</div>
              {v.description && <div style={{ color:C.textMuted, marginTop:3, lineHeight:1.6 }}>{v.description}</div>}
              {v.cvss && <div style={{ marginTop:4 }}><Badge color={C.danger} sm>CVSS {v.cvss}</Badge></div>}
            </div>
          ))}
        </div>
      )}

      {openPorts.length === 0 && vulns.length === 0 && !host.services?.length && (
        <div style={{ fontFamily:font, fontSize:12, color:C.textMuted, padding:"14px", textAlign:"center" }}>
          No open ports or vulnerabilities found for this host.
        </div>
      )}
    </div>
  );
}

function ReconPage() {
  const C = useTheme();
  const [tgt,sT]=useState("192.168.0.0/24");const [sty,sS]=useState("quick");const [pts,sP]=useState("");const [ca,sCA]=useState("");const [to,sTO]=useState("300");
  const [sc,sSc]=useState(false);const [lastCmd,setLastCmd]=useState("");const [scanErr,setScanErr]=useState(null);
  const [baseHosts,setBaseHosts]=useState(reconPersist.baseHosts);
  const [scanInfo,setScanInfo]=useState(reconPersist.scanInfo);
  const [detailHost,setDetailHost]=useState(reconPersist.detailHost);
  const [detailLoading,setDetailLoading]=useState(null);
  const [scans,setScans]=useState(reconPersist.scans);
  const [ri,sRI]=useState("192.168.0.1");const [rr,sRR]=useState(null);const [rLd,setRLd]=useState(false);

  const sts=[{value:"quick",label:"Quick Ping"},{value:"full",label:"Full (All Ports+OS)"},{value:"vuln",label:"Vuln Scripts"},{value:"os_detect",label:"OS Detect"},{value:"service",label:"Service Versions"},{value:"stealth",label:"Stealth SYN"},{value:"udp",label:"UDP Top 100"},{value:"custom",label:"Custom Args"}];

  const loadScans = useCallback(async () => {
    const d = await api("/recon/scans");
    if (Array.isArray(d)) { setScans(d); reconPersist.scans=d; }
  }, []);

  useEffect(() => { loadScans(); }, [loadScans]);

  // Determine if a scan result is a single-host deep scan (has ports/services) vs a network scan
  const isSingleHostResult = (d) => {
    const h = d?.hosts || [];
    return h.length === 1 && (h[0]?.ports?.length > 0 || h[0]?.services?.length > 0);
  };

  const applyBaseResult = (d) => {
    if (!d || d.error) { setScanErr(d?.error||"Scan failed"); return; }
    setScanErr(null);
    const h = d.hosts || [];
    if (isSingleHostResult(d)) {
      // Single-host deep/service scan from history — show as detail, keep existing baseHosts
      const host = { ...h[0], _ip: h[0].ip, _scanType: d.scan_type==="vuln"?"vuln":"deep", _isSingleHost: true };
      setDetailHost(host); reconPersist.detailHost = host;
    } else {
      // Network scan — update baseHosts
      setBaseHosts(h); reconPersist.baseHosts=h;
      setScanInfo(d); reconPersist.scanInfo=d;
      setDetailHost(null); reconPersist.detailHost=null;
    }
    setLastCmd(d.command||"");
  };

  const doS = async () => {
    sSc(true); setScanErr(null);
    const d = await api("/recon/scan",{method:"POST",body:JSON.stringify({target:tgt,scan_type:sty,ports:pts||null,custom_args:ca||null,timeout:parseInt(to)})});
    applyBaseResult(d);
    sSc(false); loadScans();
  };

  const disc = async () => {
    sSc(true); setScanErr(null); setDetailHost(null); reconPersist.detailHost=null;
    const d = await api(`/recon/discover?cidr=${encodeURIComponent(tgt)}`,{method:"POST"});
    if (d && !d.error) {
      const h = d.hosts||[];
      setBaseHosts(h); reconPersist.baseHosts=h;
      setScanInfo(d); reconPersist.scanInfo=d;
      setLastCmd(d.command||"");
    } else setScanErr(d?.error||"Discovery failed");
    sSc(false); loadScans();
  };

  const loadOldScan = async (id) => {
    sSc(true);
    const d = await api(`/recon/scans/${id}`);
    applyBaseResult(d);
    sSc(false);
  };

  // Deep/Vuln: never touches baseHosts — only updates detailHost
  const runDetail = async (ip, type) => {
    setDetailLoading(ip);
    reconPersist.detailHost = null;
    const endpoint = type==="deep" ? `/recon/deep/${ip}` : `/recon/vuln/${ip}`;
    const d = await api(endpoint, {method:"POST"});
    if (d && !d.error) {
      const raw = d?.hosts?.[0] || d;
      const host = { ...raw, _ip: ip, _scanType: type, _isSingleHost: true };
      setDetailHost(host); reconPersist.detailHost = host;
    }
    setDetailLoading(null);
    loadScans();
  };

  const probe=async()=>{setRLd(true);sRR(await api("/recon/router",{method:"POST",body:JSON.stringify({target_ip:ri,check_default_creds:true,check_known_vulns:true})}));setRLd(false);};

  const displayHosts = baseHosts.map(h => {
    if (detailHost && (detailHost._ip===h.ip || detailHost.ip===h.ip)) return { ...h, ...detailHost };
    return h;
  });

  return (
    <div className="page-in">
      <PageTitle sub="Network reconnaissance with nmap — discover hosts, then deep-scan individual targets">Network Recon</PageTitle>

      <Card title="Nmap Configuration" accent>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>
          <Input label="Target (IP/CIDR)" value={tgt} onChange={sT} tip="Target IP, hostname, or CIDR range. e.g. 192.168.0.0/24"/>
          <Select label="Scan Type" value={sty} onChange={sS} options={sts} tip="Start with Quick Ping to map live hosts, then use Deep/Vuln buttons on specific targets."/>
          <Input label="Ports" value={pts} onChange={sP} placeholder="22,80,443" tip="Specific ports or ranges. Leave blank for nmap defaults"/>
          <Input label="Timeout (s)" value={to} onChange={sTO} tip="Max seconds before scan times out"/>
        </div>
        {sty==="custom"&&<Input label="Custom Args" value={ca} onChange={sCA} placeholder="-sS -T4 --script=http-enum"/>}
        <Row gap={8} sx={{marginTop:4,marginBottom:6,flexWrap:"wrap"}}>
          <Btn sm ghost onClick={()=>sP("1-65535")} color={C.warn}>All 65535 Ports</Btn>
          <Btn sm ghost onClick={()=>sP("1-1024")} color={C.info}>Top 1024</Btn>
          <Btn sm ghost onClick={()=>sP("")} color={C.textMuted}>Default</Btn>
        </Row>
        <Row gap={9} sx={{marginTop:9}}>
          <Btn onClick={doS} disabled={sc}>{sc?<><Spinner size={14}/>Scanning...</>:"▶ Scan"}</Btn>
          <Btn onClick={disc} disabled={sc} color={C.accent} ghost>Quick Discover</Btn>
        </Row>
      </Card>

      <div style={{ marginBottom:12, padding:"9px 14px", background:C.bgInput, borderRadius:5, border:`1px solid ${C.border}`, fontFamily:font, fontSize:12, color:C.textMuted, display:"flex", gap:14, flexWrap:"wrap" }}>
        <span><Badge color={C.info} sm>DEEP</Badge><span style={{marginLeft:6}}>Full service/version scan on a single IP. Other hosts stay visible.</span></span>
        <span><Badge color={C.warn} sm>VULN</Badge><span style={{marginLeft:6}}>Run nmap vuln scripts on a single IP to detect CVEs. May be slow/noisy.</span></span>
      </div>

      {sc && <LoadingOverlay message="Running nmap scan" duration={parseInt(to)||300}/>}
      {lastCmd && <div style={{fontFamily:font,fontSize:12,color:C.textMuted,marginBottom:9,padding:"7px 12px",background:C.bgInput,borderRadius:4,borderLeft:`2px solid ${C.info}`}}>$ {lastCmd}</div>}
      {scanErr && <div className="anim-up" style={{padding:"14px 18px",background:`${C.danger}09`,border:`1px solid ${C.danger}30`,borderLeft:`3px solid ${C.danger}`,borderRadius:5,fontFamily:font,fontSize:12,color:C.danger,marginBottom:14}}>✗ {scanErr}</div>}

      {baseHosts.length > 0 && !sc && (
        <>
          <Row gap={12} sx={{marginBottom:14}} wrap>
            <Stat label="Hosts Found" value={baseHosts.length} color={C.accent} icon="🖥"/>
            <Stat label="Scan Type" value={(scanInfo?.scan_type||"—").toUpperCase()} color={C.purple} icon="⚡"/>
            <Stat label="Status" value={(scanInfo?.status||"—").toUpperCase()} color={scanInfo?.status==="completed"?C.accent:C.danger} icon="◉"/>
            {detailHost && <Stat label="Detail For" value={detailHost._ip||detailHost.ip} color={C.purple} icon="🔍"/>}
          </Row>
          <Card title={`Hosts (${baseHosts.length}) — Deep/Vuln results appear below without replacing this list`} accent>
            <div style={{ overflowX:"auto", borderRadius:5 }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:font, fontSize:12 }}>
                <thead>
                  <tr style={{ background:`${C.accent}09` }}>
                    {["IP","MAC","Hostname","OS","Open Ports","Actions"].map(h=>(
                      <th key={h} style={{ textAlign:"left", padding:"9px 12px", color:C.accent, borderBottom:`1px solid ${C.border}`, fontSize:10, textTransform:"uppercase", letterSpacing:".13em", whiteSpace:"nowrap", fontWeight:700, fontFamily:fontDisplay }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayHosts.map((h) => {
                    const isDetailTarget = detailHost && (detailHost._ip===h.ip||detailHost.ip===h.ip);
                    const isLoadingThis = detailLoading === h.ip;
                    const openCount = h.ports?.filter(p=>p.state==="open").length||0;
                    return (
                      <tr key={h.ip} style={{ borderBottom:`1px solid ${C.border}45`, background:isDetailTarget?`${C.purple}08`:"transparent", transition:"background .2s" }}>
                        <td style={{padding:"8px 12px",fontWeight:700,color:C.text}}>{h.ip}</td>
                        <td style={{padding:"8px 12px",color:C.textMuted,fontSize:11}}>{h.mac||"—"}</td>
                        <td style={{padding:"8px 12px",color:C.info}}>{h.hostname||"—"}</td>
                        <td style={{padding:"8px 12px"}}>{h.os_guess?<span style={{color:C.purple}}>{h.os_guess}</span>:"—"}</td>
                        <td style={{padding:"8px 12px"}}>
                          <span style={{color:openCount>0?C.accent:C.textMuted,fontWeight:700}}>{openCount}</span>
                          {isDetailTarget&&openCount>0&&<span style={{color:C.purple,fontSize:10,marginLeft:6}}>↓ detail below</span>}
                        </td>
                        <td style={{padding:"8px 12px"}}>
                          <Row gap={5}>
                            <Tip tip="Deep scan: full port + service/version detection on this IP. The host list stays visible.">
                              <Btn sm onClick={()=>runDetail(h.ip,"deep")} color={C.info} disabled={!!detailLoading}>
                                {isLoadingThis?<><Spinner size={10}/>...</>:"Deep"}
                              </Btn>
                            </Tip>
                            <Tip tip="Vuln scan: run nmap NSE vulnerability scripts. Detects known CVEs. May trigger IDS.">
                              <Btn sm onClick={()=>runDetail(h.ip,"vuln")} color={C.warn} disabled={!!detailLoading}>
                                {isLoadingThis?<><Spinner size={10}/>...</>:"Vuln"}
                              </Btn>
                            </Tip>
                          </Row>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {detailLoading && <LoadingOverlay message={`Running deep scan on ${detailLoading}`} duration={120}/>}
      {detailHost && !detailLoading && (
        <HostDetailPanel
          host={detailHost}
          onClose={() => { setDetailHost(null); reconPersist.detailHost=null; }}
          C={C}
        />
      )}

      {/* Scan history */}
      {scans.length > 0 && (
        <Card title={`Scan History (${scans.length}) — click to reload`} color={C.info} sx={{marginBottom:14}}>
          <div style={{ maxHeight:200, overflowY:"auto" }}>
            {scans.map(s => (
              <div key={s.id} onClick={()=>loadOldScan(s.id)}
                style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 13px", background:C.bgInput, borderRadius:5, marginBottom:5, cursor:"pointer", fontFamily:font, fontSize:12, transition:"all .14s" }}
                onMouseEnter={e=>e.currentTarget.style.background=C.bgHover}
                onMouseLeave={e=>e.currentTarget.style.background=C.bgInput}>
                <span style={{color:C.text}}>#{s.id} — {s.target} ({s.scan_type})</span>
                <Row gap={7}>
                  <span style={{color:C.textMuted}}>{s.hosts?.length||0} hosts</span>
                  <Badge color={s.status==="completed"?C.accent:C.warn} sm>{s.status}</Badge>
                </Row>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="🏴 CTF — Router Probe" color={C.danger} accent sx={{marginTop:9}}>
        <div style={{fontSize:12,color:C.textMuted,fontFamily:font,marginBottom:10,lineHeight:1.6}}>Scan the gateway/router for open admin panels (HTTP/HTTPS), SSH, Telnet and management services.</div>
        <Row gap={9} sx={{alignItems:"end",flexWrap:"wrap"}}>
          <Input label="Router IP" value={ri} onChange={sRI} sx={{flex:"1 1 180px",marginBottom:0}}/>
          <Btn onClick={probe} disabled={rLd} color={C.danger}>{rLd?<><Spinner size={14}/>Probing...</>:"▶ Probe"}</Btn>
        </Row>
        {rLd&&<LoadingOverlay message="Probing router ports"/>}
        {rr&&!rLd&&(
          <div className="anim-up" style={{marginTop:14,padding:"15px 19px",background:rr.reachable?`${C.accent}07`:`${C.danger}07`,border:`1px solid ${rr.reachable?C.accent:C.danger}28`,borderLeft:`3px solid ${rr.reachable?C.accent:C.danger}`,borderRadius:5}}>
            <div style={{fontFamily:fontDisplay,fontSize:14,color:rr.reachable?C.accent:C.danger,marginBottom:11,letterSpacing:".1em"}}>{rr.reachable?"✓ ROUTER REACHABLE":"✗ UNREACHABLE"}</div>
            {rr.reachable&&<div style={{fontFamily:font,fontSize:12,lineHeight:2}}>
              {[["HTTP (80)",rr.http_open],["HTTPS (443)",rr.https_open],["SSH (22)",rr.ssh_open],["Telnet (23)",rr.telnet_open]].map(([l,v])=><div key={l}>{l}: <Badge color={v?(l.includes("Telnet")?C.danger:C.accent):C.textMuted} sm>{v?"OPEN":"CLOSED"}</Badge>{v&&l.includes("Telnet")&&<span style={{color:C.danger,fontSize:11,marginLeft:8}}>⚠ Critical — plaintext auth!</span>}</div>)}
              {rr.services?.map((s,i)=><div key={i} style={{color:C.textMuted}}>:{s.port} → <span style={{color:C.accent}}>{s.product} {s.version}</span></div>)}
            </div>}
          </div>
        )}
      </Card>
    </div>
  );
}


// ═══════════════════════════════════════════
// PAGE: ATTACKS — Tabbed layout (Evil Twin + MITM)
// ═══════════════════════════════════════════
const AttackTabs = [
  {id:"eviltwin",label:"Evil Twin",icon:"📡",desc:"Rogue Access Point",color:"#ff9500"},
  {id:"mitm",label:"MITM",icon:"🌐",desc:"Man-in-the-Middle",color:"#c084fc"},
];

function AttacksPage() {
  const C = useTheme();
  const [tab,setTab]=useState("eviltwin");
  const [ei,sEI]=useState("wlan1");const [ee,sEE]=useState("");const [ec,sEC]=useState("6");const [en,sEN]=useState("eth0");const [ecp,sECP]=useState(false);
  const [edl,sEDL]=useState(false);const [edi,sEDI]=useState("wlan0mon");const [edb,sEDB]=useState("");const [edp,sEDP]=useState("50");
  const [es,sES]=useState(null);const [el,sEL]=useState(false);
  const [mi,sMI]=useState("wlan0");const [mt,sMT]=useState("");const [mg,sMG]=useState("192.168.0.1");const [mp,sMP]=useState("8080");const [mh,sMH]=useState("");const [ms,sMS]=useState(null);const [ml,sML]=useState(false);
  const [mStealth,setMStealth]=useState(true);
  const [flowData,setFlowData]=useState(null);const [flowHost,setFlowHost]=useState("");const [flowMethod,setFlowMethod]=useState("");const [flowCreds,setFlowCreds]=useState(false);const [flowAuto,setFlowAuto]=useState(true);const [flowLoading,setFlowLoading]=useState(false);
  const [caInfo,setCaInfo]=useState(null);

  const ref=async()=>{sES(await api("/attacks/evil-twin/status"));sMS(await api("/attacks/mitm/status"));};
  useEffect(()=>{ref();},[]);
  const sET=async()=>{sEL(true);await api("/attacks/evil-twin/start",{method:"POST",body:JSON.stringify({interface:ei,target_essid:ee,channel:parseInt(ec),internet_interface:en||null,captive_portal:ecp,deauth_legitimate:edl,deauth_interface:edl?edi:null,deauth_bssid:edl?edb:null,deauth_packets:parseInt(edp)})});await ref();sEL(false);};
  const xET=async()=>{await api("/attacks/evil-twin/stop",{method:"POST"});ref();};
  const sM=async()=>{sML(true);await api("/attacks/mitm/start",{method:"POST",body:JSON.stringify({interface:mi,target_ips:mt.split(",").map(s=>s.trim()).filter(Boolean),gateway:mg,proxy_port:parseInt(mp),stealth:mStealth,filter_hosts:mh?mh.split(",").map(s=>s.trim()):[]})});await ref();sML(false);};
  const xM=async()=>{await api("/attacks/mitm/stop",{method:"POST"});setFlowData(null);ref();};
  const loadFlows=async()=>{setFlowLoading(true);const p=new URLSearchParams({limit:"200"});if(flowHost)p.set("host",flowHost);if(flowMethod)p.set("method",flowMethod);if(flowCreds)p.set("credentials_only","true");setFlowData(await api(`/attacks/mitm/flows?${p.toString()}`));setFlowLoading(false);};
  useEffect(()=>{if(ms?.active)loadFlows();},[ms?.active,flowHost,flowMethod,flowCreds]);
  useEffect(()=>{if(!ms?.active||!flowAuto)return;const i=setInterval(loadFlows,3000);return()=>clearInterval(i);},[ms?.active,flowAuto,flowHost,flowMethod,flowCreds]);
  const loadCa=async()=>setCaInfo(await api("/attacks/mitm/ca-cert"));

  const stats=flowData?.stats||{};const flows=flowData?.flows||[];
  const typeColors={HTML:"#3ab5ff",API:"#c084fc",JS:"#ff9500",CSS:"#00ff95",IMG:"#ff6b35",FONT:"#3d5166",OTHER:"#5a6e88",DNS:"#00ff95",TLS:"#3ab5ff",HTTP:"#ff9500"};
  const methodColors={GET:C.accent,POST:C.warn,PUT:"#3ab5ff",DELETE:"#ff2055",PATCH:"#c084fc",DNS:"#00ff95",TLS:"#3ab5ff",HTTP:"#ff9500"};
  const statusColor=(s)=>!s?"#5a6e88":s>=200&&s<300?C.accent:s>=300&&s<400?"#3ab5ff":s>=400&&s<500?C.warn:s>=500?"#ff2055":"#5a6e88";
  const curTab=AttackTabs.find(t=>t.id===tab);

  return (
    <div className="page-in">
      <PageTitle sub="Evil Twin rogue AP, Man-in-the-Middle traffic interception with stealth mode">Attack Vectors</PageTitle>

      {/* Tab bar */}
      <div style={{display:"grid",gridTemplateColumns:`repeat(${AttackTabs.length},1fr)`,gap:8,marginBottom:22,background:C.bgCard,borderRadius:9,padding:8,border:`1px solid ${C.border}`}}>
        {AttackTabs.map(t=>{const active=tab===t.id;return(
          <button key={t.id} onClick={()=>setTab(t.id)} className="btn-base" style={{padding:"14px 10px",background:active?`${t.color}18`:"transparent",border:`1px solid ${active?t.color+"50":"transparent"}`,borderRadius:7,cursor:"pointer",fontFamily:font,transition:"all .22s",boxShadow:active?`0 0 20px ${t.color}30,inset 0 0 16px ${t.color}08`:"none",display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
            <span style={{fontSize:22,filter:active?`drop-shadow(0 0 8px ${t.color})`:"none",transition:"filter .2s"}}>{t.icon}</span>
            <span style={{fontFamily:fontDisplay,fontSize:10,color:active?t.color:C.textMuted,fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",transition:"color .2s"}}>{t.label}</span>
            <span style={{fontFamily:font,fontSize:10,color:active?`${t.color}b0`:C.textDim,transition:"color .2s"}}>{t.desc}</span>
            {active&&<div style={{width:28,height:2,background:t.color,borderRadius:1,boxShadow:`0 0 6px ${t.color}`,marginTop:3}}/>}
          </button>
        );})}
      </div>

      {/* Tab description */}
      <div style={{marginBottom:16,padding:"10px 16px",background:`${curTab.color}08`,border:`1px solid ${curTab.color}25`,borderRadius:6,display:"flex",alignItems:"center",gap:10,fontFamily:font,fontSize:12,color:C.textMuted}}>
        <span style={{fontSize:18}}>{curTab.icon}</span>
        <div><span style={{color:curTab.color,fontWeight:700}}>{curTab.label}</span>
          {tab==="eviltwin"&&" — Creates a fake AP impersonating the target network. Clients auto-connect and route traffic through your machine."}
          {tab==="mitm"&&" — ARP spoof + transparent proxy to intercept and analyze target network traffic in real time."}
        </div>
      </div>

      {/* ═══════ EVIL TWIN TAB ═══════ */}
      {tab==="eviltwin"&&(
        <Card title="Evil Twin AP" color={C.warn} accent>
          <div style={{marginBottom:12}}><Badge color={es?.active?C.accent:C.textMuted}>{es?.active?"ACTIVE":"INACTIVE"}</Badge></div>
          {!es?.active?(
            <div>
              <Grid cols={2}><Input label="AP Interface" value={ei} onChange={sEI} tip="WiFi adapter for the fake AP"/><Input label="Target ESSID" value={ee} onChange={sEE} placeholder="Corp_WiFi" tip="Network name to impersonate"/></Grid>
              <Grid cols={2}><Input label="Channel" value={ec} onChange={sEC}/><Input label="Internet Interface" value={en} onChange={sEN} tip="Interface for routing victim traffic"/></Grid>
              <CheckLabel checked={ecp} onChange={sECP}>Enable Captive Portal</CheckLabel>
              <CheckLabel checked={edl} onChange={sEDL}>Deauth legitimate AP (force clients over)</CheckLabel>
              {edl&&<Grid cols={3}><Input label="Deauth Iface" value={edi} onChange={sEDI}/><Input label="AP BSSID" value={edb} onChange={sEDB}/><Input label="Pkts" value={edp} onChange={sEDP}/></Grid>}
              <Btn onClick={sET} disabled={el||!ee} color={C.warn} lg>{el?<><Spinner size={14}/>Launching...</>:"▶ Launch Evil Twin"}</Btn>
              {el&&<LoadingOverlay message="Launching Evil Twin AP"/>}
            </div>
          ):(
            <div style={{fontFamily:font,fontSize:12,color:C.textMuted,lineHeight:1.9}}>
              {Object.entries(es.twin||{}).map(([k,v])=><div key={k}><span style={{color:C.textMuted}}>{k}:</span> <span style={{color:C.text}}>{String(v)}</span></div>)}
              <Btn onClick={xET} danger sx={{marginTop:12}}>◼ Stop Evil Twin</Btn>
            </div>
          )}
        </Card>
      )}

      {/* ═══════ MITM TAB ═══════ */}
      {tab==="mitm"&&(<>
        <Card title="MITM Configuration" color={C.purple} accent>
          <div style={{marginBottom:12,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <Badge color={ms?.active?C.accent:C.textMuted}>{ms?.active?"ACTIVE":"INACTIVE"}</Badge>
            {ms?.active&&<Badge color={ms.session?.mode==="stealth"?C.accent:C.warn} sm>{ms.session?.mode==="stealth"?"🔇 STEALTH":"🔓 FULL"}</Badge>}
            {ms?.active&&<span style={{fontFamily:font,fontSize:11,color:C.accent}}>{ms.total_flows||0} flows</span>}
          </div>
          {!ms?.active?(
            <div>
              {/* Mode selector */}
              <div style={{padding:"12px 16px",background:mStealth?`${C.accent}08`:`${C.warn}08`,border:`1px solid ${mStealth?C.accent:C.warn}25`,borderRadius:6,marginBottom:14}}>
                <div style={{display:"flex",gap:8,marginBottom:8}}>
                  <div onClick={()=>setMStealth(true)} style={{flex:1,padding:"12px",borderRadius:5,cursor:"pointer",textAlign:"center",background:mStealth?`${C.accent}18`:"transparent",border:`1px solid ${mStealth?C.accent+"50":"transparent"}`,transition:"all .2s"}}>
                    <div style={{fontFamily:fontDisplay,fontSize:12,color:mStealth?C.accent:C.textMuted,fontWeight:700,letterSpacing:".08em"}}>🔇 STEALTH</div>
                    <div style={{fontFamily:font,fontSize:10,color:C.textMuted,marginTop:3}}>Invisible — no warnings</div>
                  </div>
                  <div onClick={()=>setMStealth(false)} style={{flex:1,padding:"12px",borderRadius:5,cursor:"pointer",textAlign:"center",background:!mStealth?`${C.warn}18`:"transparent",border:`1px solid ${!mStealth?C.warn+"50":"transparent"}`,transition:"all .2s"}}>
                    <div style={{fontFamily:fontDisplay,fontSize:12,color:!mStealth?C.warn:C.textMuted,fontWeight:700,letterSpacing:".08em"}}>🔓 FULL INTERCEPTION</div>
                    <div style={{fontFamily:font,fontSize:10,color:C.textMuted,marginTop:3}}>Requires CA cert on target</div>
                  </div>
                </div>
                <div style={{fontFamily:font,fontSize:11,color:C.textMuted,lineHeight:1.6}}>
                  {mStealth?"Captures DNS queries, TLS connections (SNI), and HTTP traffic. HTTPS passes through untouched — target sees no warnings. Requires tshark.":"Intercepts ALL traffic including HTTPS content. Target will see SSL warnings unless mitmproxy CA cert is installed."}
                </div>
              </div>
              <Grid cols={2}><Input label="Interface" value={mi} onChange={sMI} tip="Network interface (managed mode)"/><Input label="Target IPs" value={mt} onChange={sMT} placeholder="192.168.1.98" tip="IPs to ARP-spoof"/></Grid>
              <Grid cols={2}><Input label="Gateway" value={mg} onChange={sMG}/><Input label="Proxy Port" value={mp} onChange={sMP}/></Grid>
              <Input label="Filter Hosts (optional)" value={mh} onChange={sMH} placeholder="bank.com, mail.google.com"/>
              <Btn onClick={sM} disabled={ml||!mt} color={C.purple} lg>{ml?<><Spinner size={14}/>Starting...</>:"▶ Start MITM"}</Btn>
              {ml&&<LoadingOverlay message={`Initializing ${mStealth?"stealth":"full"} MITM`}/>}
            </div>
          ):(
            <div>
              <div style={{fontFamily:font,fontSize:12,color:C.textMuted,padding:"10px 14px",background:C.bgInput,borderRadius:5,marginBottom:10,display:"flex",gap:16,flexWrap:"wrap",lineHeight:1.8}}>
                <span>Interface: <span style={{color:C.text}}>{ms.session?.interface}</span></span>
                <span>Gateway: <span style={{color:C.text}}>{ms.session?.gateway}</span></span>
                <span>Targets: <span style={{color:C.text}}>{ms.session?.targets?.join(", ")}</span></span>
                <span>Port: <span style={{color:C.text}}>{ms.session?.proxy_port}</span></span>
                {ms.mitm_listening!==undefined&&<span>Proxy: <Badge color={ms.mitm_listening?C.accent:"#ff2055"} sm>{ms.mitm_listening?"UP":"DOWN"}</Badge></span>}
              </div>
              <div style={{display:"flex",gap:6}}><Btn onClick={xM} danger sm>◼ Stop MITM</Btn><Btn onClick={loadFlows} color={C.purple} sm ghost>↺ Refresh</Btn>{!mStealth&&<Btn onClick={loadCa} color={C.info} sm ghost>🔐 SSL Cert</Btn>}</div>
            </div>
          )}
        </Card>

        {/* CA cert panel */}
        {caInfo&&(<Card title="🔐 mitmproxy CA Certificate" color={C.info} accent>
          <div style={{fontFamily:font,fontSize:11,color:C.textMuted,marginBottom:10,lineHeight:1.7}}>Install this certificate on the target device to avoid HTTPS warnings in full mode.</div>
          <Grid cols={2}>{Object.entries(caInfo.instructions||{}).map(([os,steps])=>(<div key={os} style={{padding:"10px 14px",background:C.bgInput,borderRadius:4,border:`1px solid ${C.border}`}}><div style={{fontFamily:fontDisplay,fontSize:11,color:C.info,textTransform:"uppercase",letterSpacing:".1em",marginBottom:4}}>{os}</div><div style={{fontFamily:font,fontSize:10,color:C.text,lineHeight:1.6}}>{steps}</div></div>))}</Grid>
          <div style={{display:"flex",gap:6,marginTop:10}}>{["pem","cer","p12"].map(fmt=>(<Btn key={fmt} sm color={C.info} onClick={()=>window.open(`${API}/attacks/mitm/ca-cert/download/${fmt}`,"_blank")}>.{fmt}</Btn>))}<Btn sm ghost onClick={()=>setCaInfo(null)}>Close</Btn></div>
        </Card>)}

        {/* ═══════ FLOW VIEWER (full width) ═══════ */}
        {ms?.active&&(<div className="anim-up">
          {/* Mode banner */}
          <div style={{padding:"10px 16px",marginBottom:12,borderRadius:6,fontFamily:font,fontSize:11,display:"flex",alignItems:"center",gap:10,background:ms.session?.mode==="stealth"?`${C.accent}06`:`${C.warn}08`,border:`1px solid ${ms.session?.mode==="stealth"?C.accent:C.warn}20`,borderLeft:`3px solid ${ms.session?.mode==="stealth"?C.accent:C.warn}`}}>
            <span style={{fontSize:16}}>{ms.session?.mode==="stealth"?"🔇":"🔓"}</span>
            <div><span style={{color:ms.session?.mode==="stealth"?C.accent:C.warn,fontWeight:700,fontFamily:fontDisplay,letterSpacing:".08em"}}>{ms.session?.mode==="stealth"?"STEALTH MODE":"FULL INTERCEPTION"}</span><span style={{color:C.textMuted,marginLeft:10}}>{ms.session?.mode==="stealth"?"DNS + TLS SNI + HTTP — invisible to target":"All HTTP + HTTPS content"}</span></div>
          </div>
          {/* Stats */}
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}><Stat label="Total Flows" value={stats.total_flows||0} color={C.purple} icon="🌐"/><Stat label="Unique Hosts" value={stats.unique_hosts||0} color={C.info} icon="🔗"/><Stat label="Credentials" value={stats.credentials_detected||0} color={stats.credentials_detected>0?"#ff2055":C.textMuted} icon="🔑"/><Stat label="Data" value={stats.total_data_human||"0 KB"} color={C.warn} icon="📦"/></div>
          {/* Top hosts */}
          {stats.top_hosts?.length>0&&(<Card title={`Top Hosts (${stats.unique_hosts} unique)`} color={C.info}><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{stats.top_hosts.slice(0,20).map((h,i)=>(<div key={i} onClick={()=>setFlowHost(flowHost===h.host?"":h.host)} style={{padding:"4px 10px",background:flowHost===h.host?`${C.info}20`:C.bgInput,borderRadius:3,fontFamily:font,fontSize:11,cursor:"pointer",border:`1px solid ${flowHost===h.host?C.info+"50":C.border}`,transition:"all .15s",display:"flex",gap:6,alignItems:"center"}}><span style={{color:C.text}}>{h.host}</span><span style={{color:C.info,fontWeight:700,fontSize:10}}>{h.count}</span></div>))}{flowHost&&<div onClick={()=>setFlowHost("")} style={{padding:"4px 10px",background:"#ff205515",borderRadius:3,fontFamily:font,fontSize:10,cursor:"pointer",color:"#ff2055",border:"1px solid #ff205530"}}>✕ Clear</div>}</div></Card>)}
          {/* Filters */}
          <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center",flexWrap:"wrap",padding:"8px 12px",background:C.bgCard,borderRadius:4,border:`1px solid ${C.border}`}}>
            <input value={flowHost} onChange={e=>setFlowHost(e.target.value)} placeholder="Filter host..." style={{padding:"5px 10px",background:C.bgInput,border:`1px solid ${C.border}`,borderRadius:3,color:C.text,fontFamily:font,fontSize:11,width:180,outline:"none"}}/>
            <select value={flowMethod} onChange={e=>setFlowMethod(e.target.value)} style={{padding:"5px 10px",background:C.bgInput,border:`1px solid ${C.border}`,borderRadius:3,color:C.text,fontFamily:font,fontSize:11,outline:"none"}}><option value="">All methods</option>{["GET","POST","PUT","DELETE","DNS","TLS","HTTP"].map(m=><option key={m} value={m}>{m}</option>)}</select>
            <label style={{fontFamily:font,fontSize:10,color:flowCreds?"#ff2055":C.textMuted,display:"flex",gap:5,alignItems:"center",cursor:"pointer"}}><input type="checkbox" checked={flowCreds} onChange={e=>setFlowCreds(e.target.checked)}/>🔑 Credentials</label>
            <label style={{fontFamily:font,fontSize:10,color:C.textMuted,display:"flex",gap:5,alignItems:"center",cursor:"pointer"}}><input type="checkbox" checked={flowAuto} onChange={e=>setFlowAuto(e.target.checked)}/>↺ Auto (3s)</label>
            <Btn sm ghost onClick={loadFlows} color={C.purple}>↺</Btn>{flowLoading&&<Spinner size={12} color={C.purple}/>}
            <span style={{fontFamily:font,fontSize:9,color:C.textMuted,marginLeft:"auto"}}>{flowData?.showing||0} / {flowData?.total||0}</span>
          </div>
          {/* Flow table */}
          <Card title="Intercepted Traffic" color={C.purple} accent><div style={{overflowX:"auto",maxHeight:600,overflowY:"auto"}}>
            {flows.length===0?(<div style={{textAlign:"center",padding:40,fontFamily:font,color:C.textMuted}}>{flowData?.total===0?"⏳ Waiting for traffic...":"No flows match filters."}</div>):(
            <table style={{width:"100%",borderCollapse:"collapse",fontFamily:font,fontSize:11}}><thead><tr style={{background:`${C.purple}08`,position:"sticky",top:0,zIndex:2}}>{["Time","Method","Status","Type","Protocol","Host","Path","Size","Duration","Client"].map(h=>(<th key={h} style={{textAlign:"left",padding:"7px 8px",color:C.purple,fontSize:9,textTransform:"uppercase",letterSpacing:".1em",fontFamily:fontDisplay,fontWeight:700,borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap",background:C.bgCard}}>{h}</th>))}</tr></thead>
            <tbody>{flows.map((f,i)=>{const mc=methodColors[f.method]||C.textMuted;const sc=statusColor(f.status_code);const tc=typeColors[f.type_tag]||C.textMuted;return(
              <tr key={f.id??i} style={{borderBottom:`1px solid ${C.border}30`,background:f.has_credentials?"#ff205506":"transparent",transition:"background .1s"}} onMouseEnter={e=>e.currentTarget.style.background=f.has_credentials?"#ff205512":C.bgHover} onMouseLeave={e=>e.currentTarget.style.background=f.has_credentials?"#ff205506":"transparent"}>
                <td style={{padding:"5px 8px",color:C.textMuted,whiteSpace:"nowrap",fontSize:10}}>{f.timestamp?.split(" ")[1]||"—"}</td>
                <td style={{padding:"5px 8px"}}><span style={{padding:"1px 7px",borderRadius:2,fontSize:9,fontWeight:700,background:`${mc}15`,color:mc,border:`1px solid ${mc}30`}}>{f.method}</span></td>
                <td style={{padding:"5px 8px",color:sc,fontWeight:700,fontSize:11}}>{f.status_code||"—"}</td>
                <td style={{padding:"5px 8px"}}><span style={{padding:"0 5px",borderRadius:2,fontSize:8,background:`${tc}15`,color:tc}}>{f.type_tag}</span></td>
                <td style={{padding:"5px 8px"}}>{f.is_https?<span style={{color:C.accent,fontSize:10}}>🔒 HTTPS</span>:<span style={{color:C.warn,fontSize:10}}>⚠ HTTP</span>}</td>
                <td style={{padding:"5px 8px",color:C.info,fontWeight:600,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.host}</td>
                <td style={{padding:"5px 8px",color:C.text,maxWidth:350,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={f.path}>{f.path}</td>
                <td style={{padding:"5px 8px",color:C.textMuted,whiteSpace:"nowrap",fontSize:10}}>{f.response_size>1048576?`${(f.response_size/1048576).toFixed(1)}M`:f.response_size>1024?`${(f.response_size/1024).toFixed(0)}K`:`${f.response_size}B`}</td>
                <td style={{padding:"5px 8px",color:f.duration_ms>1000?C.warn:f.duration_ms>300?"#ff9500":C.textMuted,whiteSpace:"nowrap",fontSize:10}}>{f.duration_ms?`${f.duration_ms}ms`:"—"}</td>
                <td style={{padding:"5px 8px",color:C.textMuted,fontSize:10,whiteSpace:"nowrap"}}>{f.client_ip||"—"}{f.has_credentials&&<span style={{color:"#ff2055",fontWeight:700,marginLeft:6,animation:"pulse 1.5s infinite"}}>🔑</span>}</td>
              </tr>);})}</tbody></table>)}
          </div></Card>
          {/* Methods */}
          {stats.methods&&Object.keys(stats.methods).length>0&&(<div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>{Object.entries(stats.methods).sort((a,b)=>b[1]-a[1]).map(([m,c])=>(<div key={m} onClick={()=>setFlowMethod(flowMethod===m?"":m)} style={{padding:"3px 8px",background:flowMethod===m?`${C.purple}20`:C.bgInput,borderRadius:3,fontFamily:font,fontSize:10,cursor:"pointer",border:`1px solid ${flowMethod===m?C.purple+"50":C.border}`}}><span style={{color:methodColors[m]||C.text,fontWeight:600}}>{m}</span> <span style={{color:C.purple}}>{c}</span></div>))}</div>)}
        </div>)}
      </>)}
    </div>
  );
}

// ═══════════════════════════════════════════
// PAGE: CAPTURES — comprehensive file listing
// ═══════════════════════════════════════════
const FILE_TYPE_META = {
  cap:     { color:"#00ff95", icon:"📡", desc:"WPA Handshake capture — use with aircrack-ng or convert to hashcat" },
  pcapng:  { color:"#3ab5ff", icon:"📦", desc:"Extended capture (hcxdumptool/Wireshark) — convert to .22000 for hashcat" },
  "22000": { color:"#ff9500", icon:"🔑", desc:"Hashcat PMKID/handshake format — GPU-accelerated cracking" },
  csv:     { color:"#c084fc", icon:"📊", desc:"airodump-ng scan results — contains AP list and client probes" },
  xml:     { color:"#6366f1", icon:"🗂",  desc:"nmap scan report (XML) — open with zenmap or parse programmatically" },
  flow:    { color:"#ff9500", icon:"🌐", desc:"mitmproxy intercepted HTTP/HTTPS flows — view with mitmweb" },
  json:    { color:"#a855f7", icon:"📋", desc:"Scan/report JSON data" },
  txt:     { color:"#4a6070", icon:"📄", desc:"Log or text output file" },
  log:     { color:"#4a6070", icon:"📄", desc:"Process log file" },
  hccapx:  { color:"#ff9500", icon:"🔑", desc:"Legacy hashcat handshake format" },
  netxml:  { color:"#6366f1", icon:"🗂",  desc:"Kismet/airodump-ng network XML" },
};
const getFileMeta = ext => FILE_TYPE_META[ext?.toLowerCase()] || { color:"#4a6070", icon:"📎", desc:"Capture or data file" };

function CapturesPage() {
  const C = useTheme();
  const [files, setF] = useState([]);
  const [ld, setLd] = useState(false);
  const [checkR, setChk] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLd(true);
    // The /captures/ endpoint returns all capture files
    const d = await api("/captures/");
    let result = [];
    if (Array.isArray(d)) result = d;
    else if (d?.files && Array.isArray(d.files)) result = d.files;
    else if (d?.captures && Array.isArray(d.captures)) result = d.captures;
    setF(result);
    setLd(false);
  };

  useEffect(() => { load(); }, []);

  const check = async fp => { setChk(await api(`/captures/check-handshake?filepath=${encodeURIComponent(fp)}`, {method:"POST"})); };
  const del = async fp => {
    if (confirm("Delete this capture file?")) {
      await api(`/captures/?filepath=${encodeURIComponent(fp)}`, {method:"DELETE"});
      load();
    }
  };

  // Derive extension — try file_type field first, then filename
  const getExt = f => {
    if (f.file_type) return f.file_type.replace(/^\./,"").toLowerCase();
    const fn = f.filename || f.name || f.filepath || "";
    const parts = fn.split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : "unknown";
  };

  // Derive readable name
  const getName = f => f.filename || f.name || (f.filepath ? f.filepath.split("/").pop() : "—");
  const getSize = f => {
    const b = f.size_bytes || f.size || f.filesize;
    if (!b) return "—";
    if (b < 1024) return `${b} B`;
    if (b < 1024*1024) return `${(b/1024).toFixed(1)} KB`;
    return `${(b/1024/1024).toFixed(2)} MB`;
  };
  const getDate = f => {
    const d = f.created_at || f.date || f.timestamp || f.modified_at;
    if (!d) return "—";
    try { return new Date(d).toLocaleDateString(); } catch { return d; }
  };
  const getTarget = f => f.target_essid || f.target || f.network || f.essid || "—";
  const getPath = f => f.filepath || f.path || f.file || "—";

  const allTypes = [...new Set(files.map(f => getExt(f)))].sort();
  const filtered = files.filter(f => {
    const ext = getExt(f);
    const matchType = filter === "all" || ext === filter;
    const lq = search.toLowerCase();
    const matchSearch = !search ||
      (getName(f)||"").toLowerCase().includes(lq) ||
      (getTarget(f)||"").toLowerCase().includes(lq) ||
      (getPath(f)||"").toLowerCase().includes(lq);
    return matchType && matchSearch;
  });

  const typeStats = allTypes.map(t => ({
    type: t,
    count: files.filter(f => getExt(f) === t).length,
    meta: getFileMeta(t),
  }));

  const isCheckable = ext => ["cap","pcapng","22000","hccapx"].includes(ext);

  return (
    <div className="page-in">
      <PageTitle sub="All capture files — handshakes, PMKID, nmap XML, mitmproxy flows, airodump CSV and more">Capture Files</PageTitle>

      {/* Type filter badges */}
      {typeStats.length > 0 && (
        <Row gap={9} wrap sx={{marginBottom:16}}>
          <div onClick={()=>setFilter("all")} className="card-hover"
            style={{padding:"9px 15px",background:C.bgCard,borderRadius:7,border:`1px solid ${filter==="all"?C.accent+"55":C.border}`,cursor:"pointer",transition:"all .18s",boxShadow:filter==="all"?`0 0 14px ${C.accent}22`:"none",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontFamily:fontDisplay,fontSize:10,color:filter==="all"?C.accent:C.textMuted,textTransform:"uppercase",letterSpacing:".12em"}}>ALL</span>
            <span style={{fontFamily:fontDisplay,fontSize:18,color:filter==="all"?C.accent:C.text,fontWeight:700}}>{files.length}</span>
          </div>
          {typeStats.map(({type,count,meta}) => (
            <div key={type} onClick={()=>setFilter(f=>f===type?"all":type)} className="card-hover"
              style={{padding:"9px 15px",background:C.bgCard,borderRadius:7,border:`1px solid ${filter===type?meta.color+"55":C.border}`,cursor:"pointer",transition:"all .18s",boxShadow:filter===type?`0 0 14px ${meta.color}22`:"none",display:"flex",alignItems:"center",gap:8,minWidth:100}}>
              <span style={{fontSize:18}}>{meta.icon}</span>
              <div>
                <div style={{fontFamily:fontDisplay,fontSize:9,color:filter===type?meta.color:C.textMuted,textTransform:"uppercase",letterSpacing:".12em"}}>.{type}</div>
                <div style={{fontFamily:fontDisplay,fontSize:17,color:filter===type?meta.color:C.text,fontWeight:700}}>{count}</div>
              </div>
            </div>
          ))}
        </Row>
      )}

      {/* Controls row */}
      <Row gap={9} sx={{marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <Btn onClick={load} disabled={ld}>{ld?<><Spinner size={14}/>Loading...</>:"↺ Refresh All Files"}</Btn>
        {filter!=="all"&&<Btn sm ghost onClick={()=>setFilter("all")} color={C.warn}>✕ Clear .{filter} filter</Btn>}
        <div style={{flex:1,minWidth:200,maxWidth:400}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search filename, target, path..."
            style={{width:"100%",padding:"8px 12px",background:C.bgInput,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontFamily:font,fontSize:12,outline:"none",transition:"border .18s"}}
            onFocus={e=>e.target.style.borderColor=`${C.accent}60`}
            onBlur={e=>e.target.style.borderColor=C.border}
          />
        </div>
        <span style={{fontFamily:font,fontSize:11,color:C.textMuted}}>{filtered.length} / {files.length} files</span>
      </Row>

      {files.length === 0 && !ld ? (
        <div style={{padding:"48px 24px",textAlign:"center",fontFamily:font,fontSize:13,color:C.textMuted,background:C.bgCard,borderRadius:7,border:`1px solid ${C.border}`}}>
          No capture files found. Run a WiFi scan, handshake capture, PMKID capture, nmap scan, MITM session or AP-less attack to generate files.
        </div>
      ) : (
        <Card title={`Files (${filtered.length})`}>
          <div style={{overflowX:"auto",borderRadius:5}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontFamily:font,fontSize:12}}>
              <thead>
                <tr style={{background:`${C.accent}09`}}>
                  {["Type","Filename","Size","Target / ESSID","Date","Path","Actions"].map(h=>(
                    <th key={h} style={{textAlign:"left",padding:"9px 12px",color:C.accent,borderBottom:`1px solid ${C.border}`,fontSize:10,textTransform:"uppercase",letterSpacing:".12em",whiteSpace:"nowrap",fontWeight:700,fontFamily:fontDisplay}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((f,i) => {
                  const ext = getExt(f);
                  const meta = getFileMeta(ext);
                  const fp = getPath(f);
                  return (
                    <tr key={fp||i} style={{borderBottom:`1px solid ${C.border}45`,transition:"all .14s"}}
                      onMouseEnter={e=>e.currentTarget.style.background=C.bgHover}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <td style={{padding:"8px 12px"}}>
                        <Tip tip={meta.desc}>
                          <span style={{display:"flex",alignItems:"center",gap:6,cursor:"help"}}>
                            <span style={{fontSize:15}}>{meta.icon}</span>
                            <Badge color={meta.color} sm>.{ext}</Badge>
                          </span>
                        </Tip>
                      </td>
                      <td style={{padding:"8px 12px",fontWeight:600,color:C.text,maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{getName(f)}</td>
                      <td style={{padding:"8px 12px",color:C.textMuted,whiteSpace:"nowrap"}}>{getSize(f)}</td>
                      <td style={{padding:"8px 12px",color:C.accent,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{getTarget(f)}</td>
                      <td style={{padding:"8px 12px",color:C.textMuted,whiteSpace:"nowrap"}}>{getDate(f)}</td>
                      <td style={{padding:"8px 12px",color:C.textMuted,fontSize:11,maxWidth:280,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fp}</td>
                      <td style={{padding:"8px 12px"}}>
                        <Row gap={5}>
                          {isCheckable(ext) && fp !== "—" && <Btn sm onClick={()=>check(fp)} color={C.info}>Check</Btn>}
                          {fp !== "—" && <Btn sm onClick={()=>del(fp)} danger>Del</Btn>}
                        </Row>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Capture check modal */}
      {checkR && (
        <Modal title="Capture File Analysis" onClose={()=>setChk(null)} color={C.accent} wide>
          <div style={{fontFamily:font,fontSize:12,color:C.textMuted,marginBottom:14,padding:"9px 13px",background:C.bgInput,borderRadius:5,wordBreak:"break-all"}}>{checkR.filepath}</div>
          <Grid cols={2}>
            <div style={{padding:"22px",background:checkR.has_handshake?`${C.accent}09`:`${C.danger}07`,border:`1px solid ${checkR.has_handshake?C.accent:C.danger}28`,borderRadius:7,textAlign:"center"}}>
              <div style={{fontSize:36,marginBottom:9}}>{checkR.has_handshake?"✓":"✗"}</div>
              <div style={{fontFamily:fontDisplay,fontSize:12,color:checkR.has_handshake?C.accent:C.danger,letterSpacing:".1em"}}>WPA HANDSHAKE</div>
              <div style={{fontFamily:font,fontSize:11,color:C.textMuted,marginTop:6,lineHeight:1.6}}>{checkR.has_handshake?"4-way handshake present\n→ crack with aircrack-ng or hashcat":"No handshake found in file"}</div>
            </div>
            <div style={{padding:"22px",background:checkR.has_pmkid?`${C.warn}09`:`${C.danger}07`,border:`1px solid ${checkR.has_pmkid?C.warn:C.danger}28`,borderRadius:7,textAlign:"center"}}>
              <div style={{fontSize:36,marginBottom:9}}>{checkR.has_pmkid?"✓":"✗"}</div>
              <div style={{fontFamily:fontDisplay,fontSize:12,color:checkR.has_pmkid?C.warn:C.danger,letterSpacing:".1em"}}>PMKID</div>
              <div style={{fontFamily:font,fontSize:11,color:C.textMuted,marginTop:6,lineHeight:1.6}}>{checkR.has_pmkid?"PMKID present — crackable\nwithout any connected clients":"No PMKID found in file"}</div>
            </div>
          </Grid>
          {checkR.networks_found > 0 && <div style={{marginTop:12,fontFamily:font,fontSize:12,color:C.textMuted}}>Networks in file: <span style={{color:C.accent,fontWeight:700}}>{checkR.networks_found}</span></div>}
          {checkR.raw_output && (
            <div style={{marginTop:16}}>
              <div style={{fontSize:10,fontFamily:fontDisplay,color:C.textMuted,textTransform:"uppercase",letterSpacing:".12em",marginBottom:8}}>Raw Output</div>
              <div style={{fontFamily:font,fontSize:12,color:C.text,background:C.isDark?"#02060e":"#f7f9fc",borderRadius:5,padding:"14px 16px",minHeight:250,maxHeight:480,overflowY:"auto",whiteSpace:"pre-wrap",wordBreak:"break-all",lineHeight:1.9,border:`1px solid ${C.border}`,boxShadow:`inset 0 2px 8px ${C.isDark?"rgba(0,0,0,.5)":"rgba(0,0,0,.04)"}`}}>
                {checkR.raw_output}
              </div>
            </div>
          )}
          <Btn onClick={()=>setChk(null)} sx={{marginTop:16,width:"100%"}}>Close</Btn>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// PAGE: SESSIONS — Full redesign
// ═══════════════════════════════════════════
const SEV_META = {
  critical: { color:"#ff2055", icon:"🔴", label:"Critical" },
  high:     { color:"#ff6b35", icon:"🟠", label:"High" },
  medium:   { color:"#ff9500", icon:"🟡", label:"Medium" },
  low:      { color:"#3ab5ff", icon:"🔵", label:"Low" },
  info:     { color:"#00ff95", icon:"🟢", label:"Info" },
};
const CAT_ICONS = { wifi:"📡", network:"🔍", router:"🏠", credentials:"🔑", encryption:"🔐", access_control:"🚫", other:"📋" };

function SessionsPage() {
  const C = useTheme();
  const [ss, sSs] = useState([]);
  const [sel, sSel] = useState(null);
  const [rpt, sRpt] = useState(null);
  const [rptModal, setRptModal] = useState(false);
  const [showAddFinding, setShowAddFinding] = useState(false);

  // New session form
  const [nm,sNm]=useState("");const [co,sCo]=useState("");const [au,sAu]=useState("");const [nt,sNt]=useState("");const [creating,setCreating]=useState(false);

  // Add finding form
  const [fc,sFc]=useState("wifi");const [fs,sFs]=useState("medium");const [ft,sFt]=useState("");const [fd,sFd]=useState("");const [fe,sFe]=useState("");const [fr,sFr]=useState("");const [addingFinding,setAddingFinding]=useState(false);

  // Finding filter
  const [sevFilter, setSevFilter] = useState("all");

  const ref = async () => { const d = await api("/sessions/"); if(Array.isArray(d)) sSs(d); };
  useEffect(() => { ref(); }, []);

  const loadSel = async id => { sSel(await api(`/sessions/${id}`)); sRpt(null); setShowAddFinding(false); };
  const cr = async () => {
    setCreating(true);
    await api("/sessions/",{method:"POST",body:JSON.stringify({name:nm,company:co,auditor:au,notes:nt||null})});
    sNm("");sCo("");sAu("");sNt("");
    await ref(); setCreating(false);
  };
  const af = async () => {
    if (!sel) return;
    setAddingFinding(true);
    await api(`/sessions/${sel.id}/findings`,{method:"POST",body:JSON.stringify({session_id:sel.id,category:fc,severity:fs,title:ft,description:fd,evidence:fe||null,recommendation:fr||null})});
    sFt("");sFd("");sFe("");sFr("");sFc("wifi");sFs("medium");
    await loadSel(sel.id);
    setAddingFinding(false);
    setShowAddFinding(false);
  };
  const cl = async id => { await api(`/sessions/${id}/close`,{method:"POST"}); ref(); if(sel?.id===id) loadSel(id); };
  const ex = async id => { const r = await api(`/sessions/${id}/report`); sRpt(r); setRptModal(true); };

  const findings = sel?.findings || [];
  const filteredFindings = sevFilter === "all" ? findings : findings.filter(f => f.severity === sevFilter);

  // Severity counts for current session
  const sevCounts = Object.keys(SEV_META).reduce((acc, s) => { acc[s] = findings.filter(f=>f.severity===s).length; return acc; }, {});
  const totalFindings = findings.length;

  return (
    <div className="page-in">
      <PageTitle sub="Document audit findings, manage sessions, export severity reports">Audit Sessions</PageTitle>

      <div className="sessions-grid" style={{ display:"grid", gridTemplateColumns:"minmax(280px,320px) 1fr", gap:18, alignItems:"start" }}>
        {/* ── LEFT PANEL ── */}
        <div>
          {/* New session card */}
          <Card title="New Audit Session" color={C.accent} accent>
            <Input label="Session Name" value={nm} onChange={sNm} placeholder="WiFi Audit Q2 2026"/>
            <Input label="Company / Client" value={co} onChange={sCo} placeholder="Acme Corp"/>
            <Input label="Auditor" value={au} onChange={sAu} placeholder="Your Name"/>
            <Input label="Notes / Scope" value={nt} onChange={sNt} placeholder="Networks in scope, hours..."/>
            <Btn onClick={cr} disabled={!nm||!co||!au||creating} sx={{width:"100%"}} lg>
              {creating?<><Spinner size={14}/>Creating...</>:"+ Create Session"}
            </Btn>
          </Card>

          {/* Session list */}
          <div style={{ background:C.bgCard, borderRadius:7, padding:14, border:`1px solid ${C.border}`, backdropFilter:"blur(8px)" }}>
            <div style={{ fontFamily:fontDisplay, fontSize:10, color:C.accent, textTransform:"uppercase", letterSpacing:".18em", marginBottom:12, display:"flex", alignItems:"center", gap:7 }}>
              <span style={{ width:5, height:5, background:C.accent, borderRadius:"50%", display:"block", animation:"dotPulse 2s infinite", boxShadow:`0 0 6px ${C.accent}` }}/>
              Sessions ({ss.length})
            </div>
            {ss.length === 0 && <div style={{ color:C.textMuted, fontFamily:font, fontSize:12, padding:"12px 0", textAlign:"center" }}>No sessions yet</div>}
            <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:460, overflowY:"auto" }}>
              {ss.map(s => {
                const active = sel?.id === s.id;
                const sFindings = s.findings || [];
                const hasCritical = sFindings.some(f=>f.severity==="critical");
                const hasHigh = sFindings.some(f=>f.severity==="high");
                const statusColor = s.status==="active" ? C.accent : C.textMuted;
                return (
                  <div key={s.id} onClick={()=>loadSel(s.id)} className="card-hover" style={{
                    padding:"12px 14px", background: active?`${C.accent}0d`:C.bgInput,
                    border:`1px solid ${active?C.accent+"40":C.border}`,
                    borderRadius:7, cursor:"pointer", fontFamily:font, transition:"all .2s",
                    position:"relative", overflow:"hidden",
                  }}>
                    {active && <div style={{ position:"absolute", left:0, top:0, bottom:0, width:3, background:C.accent, boxShadow:`0 0 10px ${C.accent}` }}/>}
                    {/* severity flash for critical */}
                    {hasCritical && <div style={{ position:"absolute", top:8, right:8, width:8, height:8, borderRadius:"50%", background:C.danger, boxShadow:`0 0 8px ${C.danger}`, animation:"pulse 1.5s infinite" }}/>}
                    <div style={{ paddingLeft: active?8:0, transition:"padding .2s" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:5 }}>
                        <div style={{ color:active?C.accent:C.text, fontSize:13, fontWeight:700, lineHeight:1.3 }}>{s.name}</div>
                        <Badge color={statusColor} sm>{s.status}</Badge>
                      </div>
                      <div style={{ color:C.textMuted, fontSize:11, marginBottom:6 }}>{s.company} · {s.auditor}</div>
                      {sFindings.length > 0 ? (
                        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                          {Object.entries(SEV_META).map(([sev,meta]) => {
                            const cnt = sFindings.filter(f=>f.severity===sev).length;
                            if (!cnt) return null;
                            return (
                              <span key={sev} style={{ fontFamily:fontDisplay, fontSize:10, color:meta.color, background:`${meta.color}15`, border:`1px solid ${meta.color}30`, borderRadius:12, padding:"1px 7px" }}>
                                {meta.icon} {cnt}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ color:C.textDim, fontSize:10, fontFamily:font }}>No findings yet</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div>
          {sel ? (
            <>
              {/* Session header */}
              <div className="anim-up" style={{ marginBottom:16, borderRadius:9, background:C.bgCard, border:`1px solid ${C.accent}22`, overflow:"hidden", backdropFilter:"blur(12px)" }}>
                {/* Top gradient bar */}
                <div style={{ height:3, background:`linear-gradient(90deg,${C.accent}70,${C.purple}50,transparent)` }}/>
                <div style={{ padding:"18px 22px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                    <div>
                      <div style={{ fontFamily:fontDisplay, fontSize:18, color:C.accent, fontWeight:700, letterSpacing:".06em", marginBottom:4 }}>{sel.name}</div>
                      <div style={{ fontFamily:font, fontSize:12, color:C.textMuted }}>{sel.company} · {sel.auditor} · <span style={{ color:C.textDim }}>{sel.id}</span></div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <Badge color={sel.status==="active"?C.accent:C.textMuted}>{sel.status}</Badge>
                    </div>
                  </div>

                  {/* Severity summary bar */}
                  {totalFindings > 0 && (
                    <div style={{ marginBottom:14 }}>
                      <div style={{ display:"flex", gap:2, height:10, borderRadius:5, overflow:"hidden", marginBottom:8 }}>
                        {Object.entries(SEV_META).map(([sev,meta]) => {
                          const cnt = sevCounts[sev];
                          if (!cnt) return null;
                          return <div key={sev} style={{ flex:cnt, background:meta.color, transition:"flex .5s" }}/>;
                        })}
                      </div>
                      <Row gap={8} wrap>
                        {Object.entries(SEV_META).map(([sev,meta]) => {
                          const cnt = sevCounts[sev];
                          return (
                            <div key={sev} onClick={()=>setSevFilter(f=>f===sev?"all":sev)}
                              style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer", opacity: cnt===0?0.3:1, padding:"3px 8px", borderRadius:4, background:sevFilter===sev?`${meta.color}20`:"transparent", border:`1px solid ${sevFilter===sev?meta.color+"40":"transparent"}`, transition:"all .18s" }}>
                              <span style={{ fontSize:12 }}>{meta.icon}</span>
                              <span style={{ fontFamily:fontDisplay, fontSize:10, color:meta.color }}>{cnt}</span>
                              <span style={{ fontFamily:font, fontSize:10, color:C.textMuted }}>{meta.label}</span>
                            </div>
                          );
                        })}
                        <div style={{ fontFamily:fontDisplay, fontSize:14, color:C.accent, fontWeight:700, marginLeft:"auto" }}>{totalFindings} total</div>
                      </Row>
                    </div>
                  )}

                  <Row gap={8} wrap>
                    {sel.status==="active" && (
                      <Btn onClick={()=>setShowAddFinding(v=>!v)} color={C.warn} sm>
                        {showAddFinding?"✕ Cancel":"+ Add Finding"}
                      </Btn>
                    )}
                    {sel.status==="active" && <Btn sm onClick={()=>cl(sel.id)} color={C.textMuted} ghost>Close Session</Btn>}
                    <Btn sm onClick={()=>ex(sel.id)} color={C.info}>📊 Export Report</Btn>
                  </Row>
                </div>
              </div>

              {/* Add Finding panel — slides in */}
              {showAddFinding && sel.status==="active" && (
                <div className="anim-up" style={{ marginBottom:16, background:C.bgCard, borderRadius:8, border:`2px solid ${C.warn}35`, overflow:"hidden" }}>
                  <div style={{ height:2, background:`linear-gradient(90deg,${C.warn}70,transparent)` }}/>
                  <div style={{ padding:"18px 22px" }}>
                    <div style={{ fontFamily:fontDisplay, fontSize:11, color:C.warn, textTransform:"uppercase", letterSpacing:".16em", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ width:6, height:6, background:C.warn, borderRadius:"50%", boxShadow:`0 0 8px ${C.warn}` }}/>
                      Add Finding
                    </div>

                    {/* Severity quick-select */}
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontFamily:font, fontSize:10, color:C.textMuted, textTransform:"uppercase", letterSpacing:".14em", marginBottom:6 }}>Severity</div>
                      <Row gap={7} wrap>
                        {Object.entries(SEV_META).map(([sev,meta]) => (
                          <button key={sev} onClick={()=>sFs(sev)} style={{
                            padding:"6px 12px", borderRadius:5, cursor:"pointer", fontFamily:font, fontSize:11, fontWeight:700,
                            background: fs===sev ? `${meta.color}22` : "transparent",
                            border: `1px solid ${fs===sev ? meta.color+"55" : meta.color+"20"}`,
                            color: fs===sev ? meta.color : C.textMuted,
                            transition:"all .18s",
                            display:"flex", gap:5, alignItems:"center",
                          }}>
                            {meta.icon} {meta.label}
                          </button>
                        ))}
                      </Row>
                    </div>

                    {/* Category quick-select */}
                    <div style={{ marginBottom:14 }}>
                      <div style={{ fontFamily:font, fontSize:10, color:C.textMuted, textTransform:"uppercase", letterSpacing:".14em", marginBottom:6 }}>Category</div>
                      <Row gap={6} wrap>
                        {Object.entries(CAT_ICONS).map(([cat,icon]) => (
                          <button key={cat} onClick={()=>sFc(cat)} style={{
                            padding:"5px 10px", borderRadius:4, cursor:"pointer", fontFamily:font, fontSize:11,
                            background: fc===cat ? `${C.accent}18` : "transparent",
                            border: `1px solid ${fc===cat ? C.accent+"50" : C.border}`,
                            color: fc===cat ? C.accent : C.textMuted,
                            transition:"all .18s", display:"flex", gap:5, alignItems:"center",
                          }}>
                            {icon} {cat.replace("_"," ")}
                          </button>
                        ))}
                      </Row>
                    </div>

                    <Grid cols={2}>
                      <Input label="Title" value={ft} onChange={sFt} placeholder="e.g. Open WiFi Network Detected"/>
                      <Input label="Evidence" value={fe} onChange={sFe} placeholder="File path, screenshot, output..."/>
                    </Grid>
                    <Input label="Description" value={fd} onChange={sFd} placeholder="What was found, how it was detected, impact..."/>
                    <Input label="Recommendation" value={fr} onChange={sFr} placeholder="What the client should do to fix this..."/>
                    <Row gap={9}>
                      <Btn onClick={af} disabled={!ft||!fd||addingFinding} color={C.warn} lg>
                        {addingFinding?<><Spinner size={14}/>Adding...</>:"+ Add Finding"}
                      </Btn>
                      <Btn ghost onClick={()=>setShowAddFinding(false)} color={C.textMuted}>Cancel</Btn>
                    </Row>
                  </div>
                </div>
              )}

              {/* Findings list */}
              {findings.length > 0 && (
                <div>
                  {/* Filter bar */}
                  {sevFilter !== "all" && (
                    <div style={{ marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
                      <Badge color={SEV_META[sevFilter]?.color}>{SEV_META[sevFilter]?.label}</Badge>
                      <span style={{ fontFamily:font, fontSize:11, color:C.textMuted }}>filter active — {filteredFindings.length} finding(s)</span>
                      <Btn sm ghost onClick={()=>setSevFilter("all")} color={C.textMuted}>✕ Clear</Btn>
                    </div>
                  )}
                  {filteredFindings.map((f, i) => {
                    const sm = SEV_META[f.severity] || { color:C.textMuted, icon:"•", label:f.severity };
                    const catIcon = CAT_ICONS[f.category] || "📋";
                    return (
                      <div key={i} className="anim-up card-hover" style={{
                        marginBottom:10, background:C.bgCard, borderRadius:7,
                        border:`1px solid ${C.border}40`,
                        borderLeft:`4px solid ${sm.color}`,
                        overflow:"hidden", backdropFilter:"blur(8px)",
                        boxShadow:`0 2px 16px ${C.isDark?"rgba(0,0,0,.35)":"rgba(0,0,0,.06)"}, inset 0 0 30px ${sm.color}05`,
                      }}>
                        <div style={{ padding:"14px 18px" }}>
                          {/* Header row */}
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                            <div style={{ flex:1, marginRight:10 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                                <span style={{ fontSize:14 }}>{sm.icon}</span>
                                <span style={{ fontFamily:font, fontSize:13, color:C.text, fontWeight:700 }}>{f.title}</span>
                              </div>
                              <Row gap={6}>
                                <Badge color={sm.color} sm>{sm.label}</Badge>
                                <span style={{ fontFamily:font, fontSize:11, color:C.textMuted }}>{catIcon} {f.category?.replace("_"," ")}</span>
                              </Row>
                            </div>
                            {f.timestamp && <div style={{ fontFamily:font, fontSize:10, color:C.textDim, whiteSpace:"nowrap" }}>{new Date(f.timestamp).toLocaleString()}</div>}
                          </div>
                          {/* Description */}
                          <div style={{ fontFamily:font, fontSize:12, color:C.textMuted, lineHeight:1.7, marginBottom: (f.evidence||f.recommendation)?8:0 }}>{f.description}</div>
                          {/* Evidence */}
                          {f.evidence && (
                            <div style={{ display:"flex", alignItems:"flex-start", gap:6, padding:"7px 11px", background:`${C.info}08`, borderRadius:4, border:`1px solid ${C.info}20`, marginBottom:6 }}>
                              <span style={{ fontSize:13 }}>📁</span>
                              <span style={{ fontFamily:font, fontSize:11, color:C.info, wordBreak:"break-all" }}>{f.evidence}</span>
                            </div>
                          )}
                          {/* Recommendation */}
                          {f.recommendation && (
                            <div style={{ display:"flex", alignItems:"flex-start", gap:6, padding:"7px 11px", background:`${C.accent}08`, borderRadius:4, border:`1px solid ${C.accent}20`, borderLeft:`2px solid ${C.accent}50` }}>
                              <span style={{ fontSize:13 }}>💡</span>
                              <span style={{ fontFamily:font, fontSize:11, color:C.accent, lineHeight:1.6 }}>{f.recommendation}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {filteredFindings.length === 0 && sevFilter !== "all" && (
                    <div style={{ padding:28, textAlign:"center", fontFamily:font, fontSize:12, color:C.textMuted }}>No {sevFilter} findings in this session.</div>
                  )}
                </div>
              )}

              {findings.length === 0 && (
                <div style={{ padding:"48px 20px", textAlign:"center", background:C.bgCard, borderRadius:8, border:`1px dashed ${C.border}` }}>
                  <div style={{ fontSize:36, marginBottom:10, opacity:.3 }}>🔍</div>
                  <div style={{ fontFamily:fontDisplay, fontSize:12, color:C.textMuted, letterSpacing:".1em" }}>NO FINDINGS YET</div>
                  <div style={{ fontFamily:font, fontSize:12, color:C.textDim, marginTop:6 }}>Click "+ Add Finding" to start documenting</div>
                </div>
              )}
            </>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"80px 40px", background:C.bgCard, borderRadius:9, border:`1px dashed ${C.border}`, backdropFilter:"blur(8px)" }}>
              <div style={{ fontSize:52, marginBottom:16, opacity:.2 }}>📋</div>
              <div style={{ fontFamily:fontDisplay, fontSize:14, letterSpacing:".12em", textTransform:"uppercase", color:C.textMuted }}>No Session Selected</div>
              <div style={{ fontFamily:font, fontSize:12, marginTop:8, color:C.textDim }}>Create or select a session from the left</div>
            </div>
          )}
        </div>
      </div>

      {/* ── REPORT MODAL ── */}
      {rptModal && rpt && (
        <Modal title="Audit Report" onClose={()=>setRptModal(false)} color={C.accent} wide>
          <div style={{ marginBottom:18 }}>
            <div style={{ fontFamily:fontDisplay, fontSize:14, color:C.accent, marginBottom:4 }}>{sel?.name}</div>
            <div style={{ fontFamily:font, fontSize:12, color:C.textMuted }}>{sel?.company} · {sel?.auditor}</div>
            {rpt.audit_report?.generated_at && <div style={{ fontFamily:font, fontSize:11, color:C.textDim, marginTop:3 }}>Generated: {new Date(rpt.audit_report.generated_at).toLocaleString()}</div>}
          </div>

          {/* Total finding count */}
          <div style={{ textAlign:"center", marginBottom:20, padding:"20px", background:`${C.accent}07`, borderRadius:8, border:`1px solid ${C.accent}20` }}>
            <div style={{ fontFamily:fontDisplay, fontSize:48, color:C.accent, fontWeight:900, textShadow:`0 0 30px ${C.accent}50` }}>{rpt.audit_report?.summary?.total||0}</div>
            <div style={{ fontFamily:font, fontSize:11, color:C.textMuted, textTransform:"uppercase", letterSpacing:".15em", marginTop:4 }}>Total Findings</div>
          </div>

          {/* Severity breakdown */}
          <Row gap={10} wrap sx={{ marginBottom:18 }}>
            {Object.entries(SEV_META).map(([sev,meta]) => {
              const cnt = rpt.audit_report?.summary?.[sev] || 0;
              return (
                <div key={sev} style={{ flex:1, minWidth:80, padding:"14px 16px", background:`${meta.color}10`, border:`1px solid ${meta.color}28`, borderRadius:7, textAlign:"center" }}>
                  <div style={{ fontSize:22, marginBottom:4 }}>{meta.icon}</div>
                  <div style={{ fontFamily:fontDisplay, fontSize:22, color:meta.color, fontWeight:700 }}>{cnt}</div>
                  <div style={{ fontFamily:font, fontSize:10, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em", marginTop:2 }}>{meta.label}</div>
                </div>
              );
            })}
          </Row>

          {/* Findings by severity */}
          {Object.entries(SEV_META).map(([sev,meta]) => {
            const sevFindings = (rpt.audit_report?.findings_by_severity?.[sev] || []);
            if (!sevFindings.length) return null;
            return (
              <div key={sev} style={{ marginBottom:14 }}>
                <div style={{ fontFamily:fontDisplay, fontSize:11, color:meta.color, textTransform:"uppercase", letterSpacing:".15em", marginBottom:8, display:"flex", alignItems:"center", gap:7 }}>
                  <span>{meta.icon}</span>{meta.label} ({sevFindings.length})
                </div>
                {sevFindings.map((f,i) => (
                  <div key={i} style={{ padding:"8px 12px", background:`${meta.color}07`, borderRadius:5, marginBottom:5, borderLeft:`3px solid ${meta.color}50`, fontFamily:font, fontSize:12 }}>
                    <div style={{ color:C.text, fontWeight:700, marginBottom:2 }}>{f.title}</div>
                    <div style={{ color:C.textMuted, fontSize:11 }}>{f.description}</div>
                  </div>
                ))}
              </div>
            );
          })}

          <Btn onClick={()=>setRptModal(false)} sx={{ width:"100%", marginTop:8 }}>Close Report</Btn>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// PAGE: PROCESSES
// ═══════════════════════════════════════════
function ProcessesPage() {
  const C = useTheme();
  const [ps,sPs]=useState([]);const [ld,sLd]=useState(false);
  const ref=async()=>{sLd(true);const d=await api("/system/processes");if(Array.isArray(d))sPs(d);sLd(false);};
  useEffect(()=>{ref();const i=setInterval(ref,5000);return()=>clearInterval(i);},[]);
  const kill=async id=>{await api(`/system/processes/${id}/cancel`,{method:"POST"});ref();};
  const cols=[
    {key:"id",label:"ID",render:v=><span style={{color:C.accent,fontFamily:fontDisplay,fontSize:10}}>{v}</span>},
    {key:"command",label:"Command",render:v=><span style={{color:C.text,maxWidth:360,display:"inline-block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</span>},
    {key:"status",label:"Status",render:v=><Badge color={v==="running"?C.accent:v==="completed"?C.info:C.danger} sm>{v}</Badge>},
    {key:"return_code",label:"RC",render:v=>v!==null?v:"—"},
    {key:"started_at",label:"Started",render:v=>v?new Date(v).toLocaleTimeString():"—"},
    {key:"_",label:"",render:(_,r)=>r.status==="running"?<Btn sm danger onClick={()=>kill(r.id)}>Kill</Btn>:null},
  ];
  return (
    <div className="page-in">
      <PageTitle sub="Monitor and manage all background processes — airodump, nmap, hostapd, mitmproxy">Processes</PageTitle>
      <Row gap={12} sx={{marginBottom:16}} wrap>
        <Stat label="Total" value={ps.length} color={C.info}/>
        <Stat label="Running" value={ps.filter(p=>p.status==="running").length} color={C.accent}/>
        <Stat label="Failed" value={ps.filter(p=>p.status==="failed").length} color={C.danger}/>
      </Row>
      <Card title="Managed Processes"><Table cols={cols} data={ps}/></Card>
      <Btn onClick={ref} disabled={ld} sx={{marginTop:9}}>↺ Refresh</Btn>
    </div>
  );
}

// ═══════════════════════════════════════════
// PAGE: HELP — Comprehensive content
// ═══════════════════════════════════════════
function HelpPage() {
  const C = useTheme();
  const [open,setOpen]=useState(null);
  const tog=id=>setOpen(open===id?null:id);
  const A=({children})=><span style={{color:C.accent,fontWeight:700}}>{children}</span>;
  const P=({children,sx={}})=><p style={{color:C.textMuted,fontSize:12,lineHeight:1.9,margin:"6px 0",fontFamily:font,...sx}}>{children}</p>;
  const Cd=({children})=><code style={{background:C.bgInput,padding:"2px 7px",borderRadius:3,fontSize:11,fontFamily:font,color:C.accent,border:`1px solid ${C.border}`}}>{children}</code>;
  const H=({children})=><div style={{fontFamily:fontDisplay,fontSize:12,color:C.accent,textTransform:"uppercase",letterSpacing:".14em",marginTop:14,marginBottom:6,paddingBottom:5,borderBottom:`1px solid ${C.border}`}}>{children}</div>;
  const Li=({label,children})=><div style={{display:"flex",gap:9,padding:"4px 0",fontFamily:font,fontSize:12}}><span style={{color:C.accent,minWidth:5}}>•</span><div style={{color:C.textMuted,lineHeight:1.7}}>{label&&<span style={{color:C.text,fontWeight:600}}>{label}: </span>}{children}</div></div>;
  const Step=({n,title,desc})=><div style={{display:"flex",gap:11,alignItems:"flex-start",padding:"6px 0",fontFamily:font,fontSize:12}}><span style={{background:`${C.accent}18`,color:C.accent,border:`1px solid ${C.accent}40`,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:700,flexShrink:0,minWidth:30,textAlign:"center"}}>{n}</span><div><span style={{color:C.text,fontWeight:700}}>{title}</span><span style={{color:C.textMuted}}> — {desc}</span></div></div>;

  const secs=[
    {id:"overview",title:"📖  What is WFAudit?",c:()=><div>
      <P>WFAudit is a professional WiFi security auditing platform that orchestrates industry-standard tools through a unified REST API backend. It covers the complete penetration testing lifecycle.</P>
      <H>Integrated Tools</H>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:7,marginBottom:8}}>
        {[["aircrack-ng","WPA/WEP handshake capture + crack"],["hcxdumptool","PMKID clientless capture"],["hcxpcapngtool","Convert .pcapng to hashcat format"],["hashcat","GPU-accelerated hash cracking"],["nmap","Network port scanning + OS detection"],["hostapd","Fake AP creation (Evil Twin, honeypot)"],["mitmproxy","HTTP/HTTPS traffic interception"],["freeradius","Rogue RADIUS for 802.1X attacks"],["arpspoof","ARP cache poisoning for MITM"],["aireplay-ng","Deauthentication packet injection"],["airodump-ng","802.11 packet capture / scanner"],["macchanger","MAC address spoofing"]].map(([t,d])=>(
          <div key={t} style={{padding:"8px 11px",background:C.bgInput,borderRadius:5,border:`1px solid ${C.border}40`}}>
            <div style={{fontFamily:font,fontSize:12,color:C.accent,fontWeight:700,marginBottom:2}}>{t}</div>
            <div style={{fontFamily:font,fontSize:11,color:C.textMuted,lineHeight:1.5}}>{d}</div>
          </div>
        ))}
      </div>
      <div style={{padding:"11px 16px",background:`${C.danger}08`,border:`1px solid ${C.danger}28`,borderLeft:`3px solid ${C.danger}`,borderRadius:5,marginTop:10}}>
        <div style={{color:C.danger,fontFamily:font,fontSize:12,fontWeight:700}}>⚠ LEGAL NOTICE</div>
        <div style={{color:C.textMuted,fontFamily:font,fontSize:12,marginTop:4,lineHeight:1.7}}>Only use under a signed written audit contract. Unauthorized WiFi attacks are illegal in all jurisdictions. Always document authorization before testing. You are solely responsible for compliance with local laws.</div>
      </div>
    </div>},

    {id:"workflow",title:"🗺  Recommended Audit Workflow",c:()=><div>
      <P>Follow this sequence for a complete WiFi security audit. Each step builds on the previous one.</P>
      {[["1","System Overview","Verify root, tools installed, distro. Run preflight."],["2","Create Session","Start documenting BEFORE scanning. Everything gets logged."],["3","Interfaces","Select adapter → Enable monitor mode → Optionally spoof MAC"],["4","Dual-Band Scan","Scan 2.4 GHz + 5 GHz simultaneously for complete coverage"],["5","PNL Analysis","Analyze probe requests to find Evil Twin candidates"],["6","PMKID Attack","Try first — clientless, only the AP needed. Fast."],["7","Handshake Capture","If PMKID fails: capture 4-way handshake with optional deauth"],["8","AP-Less Honeypot","If no clients present: fake AP to catch probing devices"],["9","Enterprise Attack","For WPA2-Enterprise: rogue RADIUS to intercept credentials"],["10","WPA3 Downgrade","Check transition mode — most WPA3 networks are still vulnerable"],["11","Network Recon","After gaining access: nmap the internal network"],["12","Router Probe","Scan gateway for open admin panels, Telnet (critical finding)"],["13","Document Findings","Category, severity, evidence, recommendation for every issue"],["14","Export Report","Generate JSON report grouped by severity"]].map(([n,t,d])=><Step key={n} n={n} title={t} desc={d}/>)}
    </div>},

    {id:"interfaces",title:"⚡  Interfaces Panel",c:()=><div>
      <H>What It Does</H>
      <P>Manages your WiFi adapters — switches between normal (managed) and monitor mode, spoofs MAC addresses, reads hardware capabilities.</P>
      <H>Monitor Mode</H>
      <P>In <A>managed mode</A> (default), your adapter only processes packets addressed to your MAC. In <A>monitor mode</A>, it captures ALL WiFi packets in the air — beacon frames, probe requests, authentication, data. Required for scanning and all attacks.</P>
      <Li label="Enable">Click "Monitor Mode" on the interface card → adapter gets renamed to e.g. wlan0mon</Li>
      <Li label="Disable">Click "Managed Mode" to restore normal connectivity</Li>
      <Li label="Warning">Monitor mode disconnects your WiFi — connect via Ethernet before enabling</Li>
      <H>MAC Spoofing</H>
      <P>Changes your adapter's hardware MAC address. Three modes:</P>
      <Li label="Random">No input — assigns a completely random MAC</Li>
      <Li label="Specific">Enter a full MAC (AA:BB:CC:DD:EE:FF) to use an exact address</Li>
      <Li label="Vendor">Enter first 3 octets (00:1A:2B) to mimic a specific manufacturer (e.g. appear as a printer or IoT device)</Li>
      <H>Reading the Interface Card</H>
      <Li label="Status dot">Green pulsing = monitor mode active; solid blue = managed</Li>
      <Li label="5 GHz ✓">Adapter supports 5 GHz scanning and attacks. Alfa AWUS036ACH recommended.</Li>
      <Li label="TX Power">Transmit power in dBm. Higher = more range but more detectable by IDS</Li>
      <Li label="Chipset">Determines driver capabilities. Atheros/Ralink generally better for monitor mode than Intel/Broadcom</Li>
    </div>},

    {id:"scanner",title:"📡  WiFi Scanner Panel",c:()=><div>
      <H>What It Does</H>
      <P>Uses <Cd>airodump-ng</Cd> to capture 802.11 beacon frames from access points and probe requests from client devices. Results are sorted by signal strength (strongest first).</P>
      <H>Band Selection</H>
      <Li label="2.4 GHz (bg)">Default. Slower, more range, channels 1-13. Most IoT/older devices</Li>
      <Li label="5 GHz (a)">Faster, shorter range, channels 36-165+. Most enterprise networks</Li>
      <Li label="Dual-Band (abg)">ALWAYS use this for a complete audit — scans both frequencies simultaneously. Requires adapter with 5 GHz support.</Li>
      <H>Results Table — Key Columns</H>
      <Li label="ESSID">Network name. &lt;hidden&gt; = broadcast suppressed (still exploitable)</Li>
      <Li label="PWR">Signal strength in dBm. -30 excellent, -60 good, -75 weak, -90+ barely detectable. Table is sorted strongest-first.</Li>
      <Li label="SEC">Security type. OPEN = critical finding. WEP = crackable in minutes. WPA/WPA2-PSK = crackable via handshake. Enterprise = needs RADIUS attack. WPA3 = most secure.</Li>
      <Li label="PMKID">AP advertises PMKID in EAPOL — means clientless attack is possible. Go to Advanced → PMKID tab first.</Li>
      <Li label="Vendor">OUI lookup of AP manufacturer. Helps identify the device (router vs enterprise AP).</Li>
      <Li label="Click any row">Opens a detailed modal with all captured fields for that AP</Li>
      <H>PNL Analysis</H>
      <P>Clients constantly broadcast "probe requests" asking "is network X here?". This analysis captures those probes and identifies:</P>
      <Li label="Evil Twin candidates">SSIDs probed by multiple unassociated clients that don't match any visible AP — ideal targets for fake AP attacks</Li>
      <Li label="Unassociated clients">Devices looking for networks — most likely to connect to your Evil Twin</Li>
      <H>Scan History</H>
      <P>All scans are stored and persist across page navigation. Click any history entry to reload its results. Use the ↺ History button to see all past scans.</P>
    </div>},

    {id:"handshake",title:"🔓  Handshake & Crack Panel",c:()=><div>
      <H>How WPA2-PSK Authentication Works</H>
      <P>When a client connects to a WPA2-PSK network, a <A>4-way handshake</A> is exchanged. This handshake contains a hash derived from the password (PMK). If captured, the hash can be cracked offline by testing wordlist entries.</P>
      <H>Step 1 — Capture Handshake</H>
      <Li label="Interface">Must be in monitor mode. After enabling monitor mode in Interfaces, use e.g. wlan0mon</Li>
      <Li label="BSSID">MAC of target AP — get it from WiFi Scanner results</Li>
      <Li label="Channel">Must match the AP's channel — check the scanner PWR column for the right channel</Li>
      <Li label="Timeout">How long to listen. If clients are actively connected, 30s is often enough. If not, send deauth first.</Li>
      <Li label="Send Deauth">Forces connected clients to disconnect and reconnect — triggering a new handshake. 10-20 packets usually sufficient. Broadcast deauth affects all clients.</Li>
      <H>Step 2 — Crack the Key</H>
      <Li label="Wordlist">rockyou.txt (~14M passwords) is the standard starting point: /usr/share/wordlists/rockyou.txt</Li>
      <Li label="Custom wordlists"><Cd>cewl [target-website]</Cd> scrapes words from company site. <Cd>crunch 8 12 abc123</Cd> generates pattern-based passwords</Li>
      <Li label="Speed">CPU with aircrack-ng: ~1M/s. GPU with hashcat: 100M-1B/s. Always convert to .22000 format for GPU cracking.</Li>
      <H>Deauth Tool</H>
      <P>Standalone deauthentication sender. Use to:</P>
      <Li>Force handshake capture without starting a full capture session</Li>
      <Li>Test IDS detection thresholds</Li>
      <Li>Targeted (specific client MAC) is stealthier than broadcast deauth</Li>
    </div>},

    {id:"advanced",title:"⬡  Advanced Attacks Panel",c:()=><div>
      <H>PMKID Tab — Try This First</H>
      <P>The PMKID attack is a <A>clientless WPA2 attack</A> — you only need the AP to be on, no connected clients required. The AP includes the PMKID hash in its first EAPOL message.</P>
      <Li label="PMKID formula">HMAC-SHA1(PMK, "PMK Name" || AP_MAC || Client_MAC) — contains a derivation of the password</Li>
      <Li label="hcxdumptool">Primary tool — creates .pcapng files, convert with hcxpcapngtool to .22000 (hashcat format)</Li>
      <Li label="airodump-ng fallback">Also captures PMKIDs — shows "PMKID" in Notes column</Li>
      <Li label="GPU crack">hashcat -m 22000 hash.22000 rockyou.txt — orders of magnitude faster than CPU</Li>
      <Li label="Limitation">Not all APs send PMKID. If capture fails after 60s, use traditional handshake instead.</Li>
      <H>AP-Less Tab</H>
      <P>Creates a fake AP with the target ESSID using hostapd. When a device with that SSID in its Preferred Network List (PNL) walks by, it automatically connects — and the PSK handshake is captured even though the real AP is absent.</P>
      <Li label="Two adapters needed">Monitor interface captures packets; AP interface broadcasts the fake network</Li>
      <Li label="PSK mismatch trick">Any passphrase works — the client tries its real password, hostapd rejects it (PSK-MISMATCH), but the handshake was already captured by airodump-ng</Li>
      <Li label="Use case">Employee's laptop searching for "OfficeWiFi" at a coffee shop → fake "OfficeWiFi" AP → capture handshake</Li>
      <H>Enterprise Tab</H>
      <P>WPA2-Enterprise networks use RADIUS for authentication. Each user has individual credentials verified via EAP (PEAP, EAP-TTLS, EAP-TLS).</P>
      <Li label="Attack flow">Fake AP + embedded RADIUS server. Client connects → sends EAP identity + hash → captured by rogue RADIUS</Li>
      <Li label="Captured data">EAP identities (usernames), MSCHAP-v2 hashes (crackable), sometimes plaintext PAP passwords</Li>
      <Li label="Limitation">Modern clients (Windows 11, iOS 16+) may validate server certificates and refuse to connect</Li>
      <H>WPA3 Tab</H>
      <P>WPA3 uses SAE (Simultaneous Authentication of Equals / Dragonfly handshake). Each auth attempt requires live interaction — making offline dictionary attacks impossible on pure WPA3.</P>
      <Li label="Transition mode vulnerability">Most "WPA3" networks run in mixed WPA2+WPA3 mode. Create an Evil Twin that only advertises WPA2 → deauth clients → they fall back to WPA2 → capture WPA2 handshake normally</Li>
      <Li label="SAE DoS">Flood AP with SAE commit messages. If AP crashes = missing anti-clogging token protection = critical finding</Li>
      <Li label="WPA3-only = positive finding">Document it — the organization has properly secured their wireless. No further WPA attack recommended.</Li>
    </div>},

    {id:"recon",title:"🔍  Network Recon Panel",c:()=><div>
      <H>What It Does</H>
      <P>After gaining access to a WiFi network, map the internal infrastructure using nmap. Find live hosts, open ports, running services, OS versions, and potential vulnerabilities.</P>
      <H>Scan Profiles</H>
      <Li label="Quick (Ping)"><Cd>-sn</Cd> — Just finds live hosts. Fast, ~5s. Always start here to map the network.</Li>
      <Li label="Service"><Cd>-sV -sC</Cd> — Identifies software + version on open ports. Detects Apache vs Nginx, OpenSSH version, etc.</Li>
      <Li label="Full"><Cd>-sV -sC -O -p-</Cd> — All 65535 ports + OS detection. Thorough but slow (minutes per host).</Li>
      <Li label="Vuln Scripts"><Cd>--script vuln</Cd> — Runs NSE scripts to detect known CVEs. May trigger IDS.</Li>
      <Li label="OS Detect"><Cd>-O</Cd> — TCP/IP stack fingerprinting to guess OS. Requires root.</Li>
      <Li label="Stealth SYN"><Cd>-sS -T2 -f</Cd> — SYN scan with packet fragmentation and slow timing. Harder to detect by IDS.</Li>
      <Li label="UDP Top 100"><Cd>-sU --top-ports 100</Cd> — DNS (53), SNMP (161), DHCP (67/68), TFTP (69) all use UDP. Frequently missed.</Li>
      <H>CTF — Router Probe</H>
      <P>Specifically probes the gateway/router for admin panels and management services:</P>
      <Li label="Telnet open (23)">Critical finding — plaintext authentication. Attacker can capture admin credentials in transit.</Li>
      <Li label="HTTP (80) / HTTPS (443)">Web admin panel. Check for default credentials (admin/admin, admin/1234).</Li>
      <Li label="SSH (22)">Usually patched but check version — older OpenSSH has known CVEs.</Li>
      <Li label="SNMP (161)">Community string "public" = read access to router config. "private" = write access.</Li>
    </div>},

    {id:"attacks",title:"⚔  Attacks Panel (Evil Twin + MITM)",c:()=><div>
      <H>Evil Twin AP</H>
      <P>Creates a rogue access point broadcasting the same ESSID as a legitimate network. Clients connect to the strongest signal, making them prefer your Evil Twin when deauth is used simultaneously.</P>
      <Li label="AP Interface">Must support hostapd AP mode. Different from monitor interface. Use a second USB adapter.</Li>
      <Li label="Captive Portal">Redirects all HTTP traffic to a custom webpage — useful for phishing credentials or showing a fake login page. Combined with DNS hijacking.</Li>
      <Li label="Internet Forwarding">Route victim traffic through your Ethernet connection via iptables NAT. Gives victims internet access, making the attack far less detectable.</Li>
      <Li label="Integrated Deauth">Sends continuous deauth to the real AP while your Evil Twin is running. Forces clients to switch. Requires monitor-mode adapter + BSSID of real AP.</Li>
      <H>Man-in-the-Middle</H>
      <P>After victims connect to your Evil Twin (or you're on the same network), intercepts all their traffic using ARP cache poisoning.</P>
      <Li label="Target IPs">Specific hosts to intercept. Leave blank for entire subnet (noisy). Multiple targets = comma-separated.</Li>
      <Li label="Gateway">Router IP — traffic is redirected: victim → your machine → router (you see everything)</Li>
      <Li label="mitmproxy">Transparent proxy saves all HTTP/HTTPS flows to .flow files. View with <Cd>mitmweb</Cd> for full request/response inspection.</Li>
      <Li label="Filter Hosts">Focus capture on specific domains. Critical for reducing noise: target bank.com, mail.google.com, etc.</Li>
      <Li label="Captures">HTTPS traffic requires the victim to accept your certificate (or pre-installed cert). HTTP is plaintext.</Li>
    </div>},

    {id:"captures",title:"📁  Captures Panel",c:()=><div>
      <H>Supported File Types</H>
      <Li label=".cap">Standard airodump-ng capture. Contains WPA handshakes and PMKID data. Use with aircrack-ng.</Li>
      <Li label=".pcapng">Extended pcap format from hcxdumptool. Higher quality PMKID captures. Convert to .22000 with hcxpcapngtool.</Li>
      <Li label=".22000">Hashcat-native format for PMKID/handshake cracking. GPU-accelerated — 100x faster than CPU.</Li>
      <Li label=".csv">airodump-ng scan results. Contains all APs and clients detected during scan.</Li>
      <H>Check Handshake Tool</H>
      <P>Clicks the Check button on any .cap/.22000 file to verify it actually contains crackable data before wasting time on wordlist attacks:</P>
      <Li label="WPA Handshake ✓">Complete 4-way handshake present. Use aircrack-ng or convert to .22000 for hashcat.</Li>
      <Li label="PMKID ✓">PMKID hash captured. Convert to .22000 format: <Cd>hcxpcapngtool -o out.22000 capture.pcapng</Cd></Li>
      <Li label="Both missing">Capture failed or was too short. Retry with longer timeout or closer proximity to AP.</Li>
    </div>},

    {id:"sessions",title:"📋  Sessions & Findings Panel",c:()=><div>
      <H>Why Sessions Matter</H>
      <P>Every professional pentest requires documented evidence. Sessions allow you to track all findings in real-time and generate a structured report — essential for the final audit deliverable.</P>
      <H>Creating a Session</H>
      <P>Create a session <A>before</A> you start scanning. Fill in name, company, and auditor. The session ID is a timestamp-based unique identifier.</P>
      <H>Adding Findings</H>
      <P>Document every issue you discover. Required fields:</P>
      <Li label="Category">wifi / network / router / credentials / encryption / access_control / other</Li>
      <Li label="Severity"><span style={{color:SEV.critical}}>Critical</span> (open network, telnet, default creds) → <span style={{color:SEV.high}}>High</span> (WEP, no encryption) → <span style={{color:SEV.medium}}>Medium</span> (WPA, weak config) → <span style={{color:SEV.low}}>Low</span> → <span style={{color:SEV.info}}>Info</span> (WPA3 = positive)</Li>
      <Li label="Evidence">File paths, screenshots, output snippets — anything that proves the finding</Li>
      <Li label="Recommendation">What the client should do to fix it. Always include a remediation.</Li>
      <H>Report Export</H>
      <P>Generates a structured JSON report with findings grouped by severity and numerical counts. The severity bar at the top of the findings list shows the visual risk distribution at a glance.</P>
    </div>},

    {id:"tips",title:"💡  Tips & Common Mistakes",c:()=><div>
      <H>Preparation Checklist</H>
      <Li>2+ USB WiFi adapters (Alfa AWUS036ACH recommended for 5 GHz)</Li>
      <Li>Ethernet cable (monitor mode disconnects WiFi)</Li>
      <Li>Custom wordlists — rockyou.txt is just the starting point</Li>
      <Li>Written authorization with network names and allowed testing hours</Li>
      <Li>Kali Linux or similar distro with all tools pre-installed</Li>
      <H>WPA2 Attack Priority</H>
      <Step n="1" title="PMKID" desc="Fastest — only AP needed. Try 60-120s."/>
      <Step n="2" title="Handshake + Deauth" desc="Need connected clients. 2-5 minutes."/>
      <Step n="3" title="AP-Less Honeypot" desc="No clients visible — wait for probe requests. 5-30 min."/>
      <Step n="4" title="Evil Twin" desc="Most visible. Use when other methods fail."/>
      <H>Common Mistakes</H>
      <Li label="Forgetting monitor mode">Always verify with <Cd>iwconfig</Cd> or check the Interfaces panel before scanning</Li>
      <Li label="Not running as root">Most tools require root. Check System panel — ROOT must show YES.</Li>
      <Li label="Only scanning 2.4 GHz">Enterprise networks often use 5 GHz exclusively. Always use dual-band.</Li>
      <Li label="Rockyou.txt only">Common passwords: company name + year, Spanish words (for Spanish companies), keyboard patterns</Li>
      <Li label="Not documenting real-time">Memory is unreliable. Add every finding as you discover it.</Li>
      <Li label="Forgetting to restore managed mode">Always run <Cd>airmon-ng stop wlan0mon</Cd> at end of engagement</Li>
      <H>When to Escalate vs. Document</H>
      <Li label="Open network">Critical — immediate finding. All traffic in plaintext.</Li>
      <Li label="WEP">Critical — crackable in minutes. Document without cracking in scope.</Li>
      <Li label="Default router credentials">Critical — document but DO NOT log in beyond confirming credentials work.</Li>
      <Li label="WPA3-only, no transition">Positive/Info finding — the organization has done something right. Document it positively.</Li>
    </div>},
  ];

  return (
    <div className="page-in">
      <PageTitle sub="Complete documentation — panels, attack techniques, tips, and common mistakes">Help & Documentation</PageTitle>
      <div style={{marginBottom:16,padding:"12px 18px",background:`${C.accent}07`,border:`1px solid ${C.accent}22`,borderRadius:7,fontFamily:font,fontSize:12,color:C.textMuted}}>
        Click any section to expand. Press <kbd style={{background:C.bgInput,border:`1px solid ${C.border}`,borderRadius:3,padding:"1px 6px",fontFamily:font,fontSize:11}}>Esc</kbd> while expanded to collapse. This documentation covers all {secs.length} panels.
      </div>
      {secs.map(s=>(
        <div key={s.id} style={{marginBottom:7}}>
          <div onClick={()=>tog(s.id)} style={{padding:"14px 18px",background:C.bgCard,border:`1px solid ${open===s.id?C.accent+"45":C.border}`,borderLeft:`3px solid ${open===s.id?C.accent:"transparent"}`,borderRadius:open===s.id?"7px 7px 0 0":7,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all .2s",backdropFilter:"blur(8px)",boxShadow:open===s.id?`0 0 24px ${C.accent}12`:"none"}}
            onMouseEnter={e=>{if(open!==s.id)e.currentTarget.style.borderLeftColor=`${C.accent}55`;}}
            onMouseLeave={e=>{if(open!==s.id)e.currentTarget.style.borderLeftColor="transparent";}}>
            <span style={{fontFamily:font,fontSize:13,color:open===s.id?C.accent:C.text,fontWeight:700}}>{s.title}</span>
            <span style={{color:C.accent,fontSize:16,transition:"transform .25s cubic-bezier(.22,1,.36,1)",transform:open===s.id?"rotate(180deg)":"rotate(0)",display:"inline-block"}}>▾</span>
          </div>
          {open===s.id&&(
            <div className="anim-up" style={{padding:"18px 24px",background:C.bgCard,border:`1px solid ${C.accent}30`,borderTop:"none",borderRadius:"0 0 7px 7px",borderLeft:`3px solid ${C.accent}`,backdropFilter:"blur(8px)"}}>
              {s.c()}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════
const NAV=[
  {id:"dashboard",label:"SYSTEM",icon:"◉",color:"#00ff95"},
  {id:"interfaces",label:"INTERFACES",icon:"⚡",color:"#3ab5ff"},
  {id:"wifi",label:"WIFI SCAN",icon:"◈",color:"#00ff95"},
  {id:"handshake",label:"HANDSHAKE",icon:"◎",color:"#ff9500"},
  {id:"advanced",label:"ADVANCED",icon:"⬡",color:"#c084fc"},
  {id:"recon",label:"RECON",icon:"◐",color:"#3ab5ff"},
  {id:"attacks",label:"ATTACKS",icon:"◆",color:"#ff2055"},
  {id:"captures",label:"CAPTURES",icon:"▤",color:"#ff9500"},
  {id:"sessions",label:"SESSIONS",icon:"◧",color:"#00ff95"},
  {id:"processes",label:"PROCESSES",icon:"▣",color:"#3ab5ff"},
  {id:"help",label:"HELP",icon:"?",color:"#ff9500"},
];
const PAGES={dashboard:DashboardPage,interfaces:InterfacesPage,wifi:WifiScanPage,handshake:HandshakePage,advanced:AdvancedPage,recon:ReconPage,attacks:AttacksPage,captures:CapturesPage,sessions:SessionsPage,processes:ProcessesPage,help:HelpPage};

// ═══════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════
export default function App(){
  const [page,setPage]=useState("dashboard");
  const [time,setTime]=useState(new Date());
  const [isDark,setIsDark]=useState(()=>{
    try{const s=window.localStorage?.getItem("wfaudit-theme");if(s)return s==="dark";}catch(e){}
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches??true;
  });
  const [pageKey,setPageKey]=useState(0);

  // Auto-collapse sidebar on mobile
  const [col,setCol]=useState(() => typeof window!=="undefined" && window.innerWidth < 900);
  useEffect(()=>{
    const onResize=()=>{ if(window.innerWidth<900) setCol(true); };
    window.addEventListener("resize",onResize);
    return ()=>window.removeEventListener("resize",onResize);
  },[]);

  const C=isDark?DARK:LIGHT;
  useEffect(()=>{try{window.localStorage?.setItem("wfaudit-theme",isDark?"dark":"light");}catch(e){}}, [isDark]);
  useEffect(()=>{const i=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(i);},[]);

  // Inject viewport meta for mobile
  useEffect(()=>{
    if(!document.querySelector('meta[name="viewport"]')){
      const m=document.createElement("meta");
      m.name="viewport";
      m.content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no";
      document.head.appendChild(m);
    }
  },[]);

  const navigate=id=>{setPage(id);setPageKey(k=>k+1);};
  const Page=PAGES[page];

  return (
    <ThemeCtx.Provider value={C}>
      <div style={{display:"flex",height:"100vh",background:C.bg,color:C.text,fontFamily:font,overflow:"hidden",transition:"background .3s,color .3s"}}>
        <style>{makeCSS(C)}</style>

        {/* Background */}
        <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,backgroundImage:`radial-gradient(${C.accent}08 1px,transparent 1px)`,backgroundSize:"30px 30px"}}/>
        {C.isDark&&<>
          <div style={{position:"fixed",top:"-20%",left:"-10%",width:"55vw",height:"55vh",background:`radial-gradient(ellipse,${C.accent}06 0%,transparent 70%)`,pointerEvents:"none",zIndex:0}}/>
          <div style={{position:"fixed",bottom:"-20%",right:"-10%",width:"55vw",height:"55vh",background:`radial-gradient(ellipse,${C.purple}05 0%,transparent 70%)`,pointerEvents:"none",zIndex:0}}/>
        </>}

        {/* ── SIDEBAR ── */}
        <div style={{width:col?52:182,minWidth:col?52:182,background:C.bgSidebar,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",transition:"width .25s cubic-bezier(.22,1,.36,1),min-width .25s",flexShrink:0,position:"relative",zIndex:20,boxShadow:`4px 0 28px ${C.isDark?"rgba(0,0,0,.55)":"rgba(0,0,0,.12)"}`}}>
          <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(${C.accent}09 1px,transparent 1px)`,backgroundSize:"20px 20px",pointerEvents:"none"}}/>
          <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${C.accent}45,transparent)`,pointerEvents:"none"}}/>

          {/* Logo */}
          <div onClick={()=>setCol(!col)} style={{padding:col?"13px 8px":"17px 14px",borderBottom:`1px solid ${C.border}`,cursor:"pointer",position:"relative",zIndex:1,display:"flex",flexDirection:"column",alignItems:col?"center":"flex-start",userSelect:"none"}}>
            <div style={{fontFamily:fontDisplay,fontSize:col?13:16,color:C.accent,fontWeight:900,letterSpacing:col?".05em":".12em",textShadow:`0 0 26px ${C.accent}65`,transition:"all .25s"}}>{col?"W":"WFAUDIT"}</div>
            {!col&&<div style={{fontSize:8,color:C.textMuted,letterSpacing:".22em",marginTop:2,textTransform:"uppercase"}}>v2.0.0 · TACTICAL</div>}
          </div>

          {/* Nav */}
          <nav style={{flex:1,padding:"8px 0",position:"relative",zIndex:1,display:"flex",flexDirection:"column",overflowY:"auto",overflowX:"hidden"}}>
            {NAV.map(item=>{
              const a=page===item.id,isHelp=item.id==="help";
              return(
                <div key={item.id} className="nav-item"
                  onClick={()=>{ navigate(item.id); if(window.innerWidth<640) setCol(true); }}
                  style={{padding:col?"10px 0":"8px 14px",cursor:"pointer",background:a?`${item.color}12`:"transparent",borderLeft:a?`2px solid ${item.color}`:"2px solid transparent",color:a?item.color:C.textMuted,fontSize:10,letterSpacing:".12em",display:"flex",alignItems:"center",gap:8,justifyContent:col?"center":"flex-start",marginTop:isHelp?"auto":0,borderTop:isHelp?`1px solid ${C.border}`:"none",fontFamily:fontDisplay,fontWeight:600,transition:"all .18s cubic-bezier(.22,1,.36,1)",position:"relative"}}
                  onMouseEnter={e=>{if(!a){e.currentTarget.style.color=item.color;e.currentTarget.style.borderLeftColor=`${item.color}45`;}}}
                  onMouseLeave={e=>{if(!a){e.currentTarget.style.color=C.textMuted;e.currentTarget.style.borderLeftColor="transparent";}}}>
                  <span className="nav-icon" style={{fontSize:col?17:15,width:col?24:22,textAlign:"center",display:"block",color:"inherit",filter:a?`drop-shadow(0 0 7px ${item.color})`:"none",transition:"transform .18s,filter .18s",flexShrink:0}}>{item.icon}</span>
                  {!col&&<span className="nav-label" style={{fontSize:10,overflow:"hidden",whiteSpace:"nowrap"}}>{item.label}</span>}
                  {a&&!col&&<div style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",width:5,height:5,borderRadius:"50%",background:item.color,boxShadow:`0 0 9px ${item.color}`}}/>}
                </div>
              );
            })}
          </nav>

          {/* Clock */}
          {!col&&(
            <div style={{padding:"10px 14px",borderTop:`1px solid ${C.border}`,fontSize:10,color:C.textMuted,position:"relative",zIndex:1,fontFamily:font}}>
              <div style={{letterSpacing:".08em"}}>{time.toLocaleDateString()}</div>
              <div style={{fontSize:15,color:C.accent,fontWeight:700,fontFamily:fontDisplay,textShadow:`0 0 14px ${C.accent}55`,letterSpacing:".06em"}}>{time.toLocaleTimeString()}</div>
            </div>
          )}
        </div>

        {/* ── MAIN CONTENT ── */}
        <div style={{flex:1,overflow:"auto",position:"relative",zIndex:10,minWidth:0}}>
          {/* Topbar */}
          <div style={{padding:"0 14px",height:46,borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:C.bgTopbar,position:"sticky",top:0,zIndex:30,backdropFilter:"blur(18px)",boxShadow:`0 1px 0 ${C.border}`,gap:8}}>
            <div style={{fontFamily:font,fontSize:11,display:"flex",alignItems:"center",gap:2,overflow:"hidden",minWidth:0,flexShrink:1}}>
              <span style={{color:C.accent,textShadow:`0 0 11px ${C.accent}55`,whiteSpace:"nowrap"}}>root@wfaudit</span>
              <span style={{color:C.textMuted}}>:</span>
              <span style={{color:C.accentDim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>~/{page}</span>
              <span style={{color:C.accent,animation:"blink 1.2s step-end infinite",marginLeft:2}}>█</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              <span className="topbar-hint" style={{fontSize:10,color:C.textMuted,fontFamily:font,letterSpacing:".1em",display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap"}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:C.danger,boxShadow:`0 0 6px ${C.danger}`,display:"block",flexShrink:0}}/>
                AUTHORIZED TESTING ONLY
              </span>
              <button onClick={()=>setIsDark(!isDark)} title={isDark?"Light":"Dark"}
                style={{width:44,height:24,borderRadius:12,cursor:"pointer",background:isDark?`linear-gradient(135deg,${C.accent}32,${C.purple}26)`:`linear-gradient(135deg,${C.accent}22,${C.info}18)`,border:`1px solid ${C.accent}45`,padding:0,position:"relative",transition:"all .3s cubic-bezier(.22,1,.36,1)",outline:"none",flexShrink:0}}>
                <div style={{position:"absolute",top:3,left:isDark?22:3,width:16,height:16,borderRadius:"50%",background:isDark?C.accent:C.warn,transition:"all .3s cubic-bezier(.22,1,.36,1)",boxShadow:isDark?`0 0 12px ${C.accent}90`:`0 0 10px ${C.warn}70`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:isDark?C.bg:"#fff"}}>{isDark?"☽":"☀"}</div>
              </button>
              <div style={{position:"relative",width:10,height:10,flexShrink:0}}>
                <div style={{position:"absolute",inset:0,borderRadius:"50%",background:C.accent,opacity:.28,animation:"pulseRing 2s ease-out infinite"}}/>
                <div style={{position:"absolute",inset:2,borderRadius:"50%",background:C.accent,boxShadow:`0 0 9px ${C.accent}`}}/>
              </div>
            </div>
          </div>

          {/* Page content */}
          <div className="main-pad" style={{padding:"22px 24px",minWidth:0}} key={pageKey}>
            <Page/>
          </div>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}

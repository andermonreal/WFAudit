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

// ─── ActiveSessionCtx ─── Tracks which session captures/findings belong to.
// Read with useActiveSession(); also exposes the setter.
const ActiveSessionCtx = createContext({session:null, setSession:()=>{}});
function useActiveSession(){ return useContext(ActiveSessionCtx); }

// ─── RunningOpsCtx ─── Persists "operation in progress" state across panel
// navigation. Each panel registers an op key (e.g. "wpa_crack:<file>") with
// {status, result}. Spinners check this on mount so they survive navigation.
const RunningOpsCtx = createContext({ops:{}, setOp:()=>{}, removeOp:()=>{}});
function useRunningOps(){ return useContext(RunningOpsCtx); }

// ─── DraftCtx ─── Preserves in-progress form text (e.g. unsaved finding
// description) across panel switches so users don't lose work.
const DraftCtx = createContext({drafts:{}, setDraft:()=>{}});
function useDraft(){ return useContext(DraftCtx); }

// ─── usePersistentOp ─── Convenience hook combining useRunningOps state
// with local mirror so panels can survive navigation away/back without
// losing the spinner and result. Each panel registers a unique opKey.
function usePersistentOp(opKey){
  const {ops, setOp, removeOp} = useRunningOps();
  const op = ops[opKey];
  const [running, setRunning] = useState(op?.status === "running");
  const [result, setResult] = useState(op?.status === "done" ? op.result : null);

  // Sync local state when global op state changes (panel mount, op finishes)
  useEffect(()=>{
    if(op?.status === "running"){ setRunning(true); }
    else if(op?.status === "done"){ setResult(op.result); setRunning(false); }
    else if(!op){ setRunning(false); /* keep result */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[op?.status]);

  // run(asyncFn) — register start, await, register completion
  const run = async (asyncFn) => {
    setRunning(true);
    setResult(null);
    setOp(opKey, {status:"running", started_at: Date.now()});
    try {
      const r = await asyncFn();
      setResult(r);
      setOp(opKey, {status:"done", result:r, finished_at: Date.now()});
      return r;
    } catch(e){
      const errResult = {success:false, error:String(e)};
      setResult(errResult);
      setOp(opKey, {status:"done", result:errResult, finished_at: Date.now()});
      return errResult;
    } finally {
      setRunning(false);
    }
  };

  const clear = () => removeOp(opKey);

  return {running, result, run, clear, op};
}
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
  const [netStatus, setNetStatus] = useState(null);

  const refresh = async () => {
    setLd(true);
    const d = await api("/interfaces/");
    if (Array.isArray(d)) setIfs(d);
    // Also fetch network status (all interfaces, ethernet too)
    const ns = await api("/interfaces/network-status");
    setNetStatus(ns);
    setLd(false);
  };
  useEffect(() => { refresh(); }, []);

  // act() — surgical mode switch by default. NEVER kills NetworkManager globally.
  const act = async (n, a) => {
    setLog(p=>[...p,`${a} → ${n}`]);
    const r = await api(`/interfaces/${n}/${a}`, {method:"POST"});
    setLog(p=>[...p,JSON.stringify(r,null,2)]);
    refresh();
  };
  const chgMac = async n => { const q = vendor?`?vendor_prefix=${vendor}`:mac?`?new_mac=${mac}`:""; setLog(p=>[...p,`MAC change on ${n}${q}`]); const r = await api(`/interfaces/${n}/mac${q}`, {method:"POST"}); setLog(p=>[...p,JSON.stringify(r,null,2)]); refresh(); };
  const getChannels = async n => { const r = await api(`/interfaces/${n}/channels`); setLog(p=>[...p,`Channels for ${n}:`, JSON.stringify(r,null,2)]); };

  if (ld && ifs.length === 0) return <LoadingOverlay message="Scanning network interfaces" />;

  return (
    <div className="page-in">
      <PageTitle sub="Manage adapters — monitor mode is now SURGICAL: switching one card to monitor never disrupts ethernet or other adapters">Network Interfaces</PageTitle>

      {/* Safety banner */}
      <div style={{marginBottom:16,padding:"12px 16px",background:`linear-gradient(135deg, ${C.accent}10, ${C.bgCard})`,border:`1px solid ${C.accent}35`,borderLeft:`3px solid ${C.accent}`,borderRadius:7,fontFamily:font,fontSize:12,color:C.textMuted,lineHeight:1.7}}>
        <span style={{color:C.accent,fontWeight:700}}>✓ Surgical mode switching active.</span> Switching a single WiFi adapter to monitor mode no longer kills NetworkManager globally. Your <span style={{color:C.text,fontWeight:600}}>ethernet cable</span> and other WiFi adapters keep working — perfect for Evil Twin attacks where you need: cable for internet + monitor adapter + AP adapter.
      </div>

      {/* Network status panel — shows ALL interfaces (ethernet + wifi) */}
      {netStatus&&(
        <div style={{marginBottom:18,padding:"14px 18px",background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:8}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:11,flexWrap:"wrap",gap:10}}>
            <div style={{fontFamily:fontDisplay,fontSize:11,color:C.info,letterSpacing:".15em",textTransform:"uppercase",fontWeight:700,display:"flex",alignItems:"center",gap:8}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:netStatus.internet_available?C.accent:C.danger,boxShadow:`0 0 8px ${netStatus.internet_available?C.accent:C.danger}`}}/>
              Network Status — {netStatus.internet_available?"Internet available":"No internet detected"}
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))",gap:10}}>
            {/* Ethernet */}
            <div style={{padding:"10px 12px",background:`${C.info}06`,border:`1px solid ${C.info}25`,borderRadius:6}}>
              <div style={{fontFamily:fontDisplay,fontSize:9,color:C.info,letterSpacing:".15em",fontWeight:700,marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
                🔌 ETHERNET <span style={{color:C.textDim,fontSize:9,marginLeft:"auto"}}>{netStatus.ethernet?.length||0}</span>
              </div>
              {netStatus.ethernet?.length>0?netStatus.ethernet.map((e,i)=>(
                <div key={i} style={{fontFamily:font,fontSize:11,padding:"4px 0",display:"flex",justifyContent:"space-between",alignItems:"center",gap:6}}>
                  <span style={{color:C.text,fontWeight:600}}>{e.interface}</span>
                  <div style={{display:"flex",gap:5,alignItems:"center"}}>
                    {e.ipv4&&<span style={{fontFamily:"monospace",fontSize:10,color:C.accent}}>{e.ipv4}</span>}
                    <Badge color={e.state==="up"?C.accent:C.danger} sm>{e.state}</Badge>
                  </div>
                </div>
              )):<div style={{fontFamily:font,fontSize:10,color:C.textDim,fontStyle:"italic"}}>No ethernet detected</div>}
            </div>

            {/* WiFi managed */}
            <div style={{padding:"10px 12px",background:`${C.warn}06`,border:`1px solid ${C.warn}25`,borderRadius:6}}>
              <div style={{fontFamily:fontDisplay,fontSize:9,color:C.warn,letterSpacing:".15em",fontWeight:700,marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
                📶 WIFI MANAGED <span style={{color:C.textDim,fontSize:9,marginLeft:"auto"}}>{netStatus.wifi_managed?.length||0}</span>
              </div>
              {netStatus.wifi_managed?.length>0?netStatus.wifi_managed.map((e,i)=>(
                <div key={i} style={{fontFamily:font,fontSize:11,padding:"4px 0",display:"flex",justifyContent:"space-between",alignItems:"center",gap:6}}>
                  <span style={{color:C.text,fontWeight:600}}>{e.interface}</span>
                  <div style={{display:"flex",gap:5,alignItems:"center"}}>
                    {e.ipv4&&<span style={{fontFamily:"monospace",fontSize:10,color:C.accent}}>{e.ipv4}</span>}
                    <Badge color={e.state==="up"?C.accent:C.danger} sm>{e.state}</Badge>
                  </div>
                </div>
              )):<div style={{fontFamily:font,fontSize:10,color:C.textDim,fontStyle:"italic"}}>None — all WiFi in monitor mode</div>}
            </div>

            {/* WiFi monitor */}
            <div style={{padding:"10px 12px",background:`${C.accent}06`,border:`1px solid ${C.accent}25`,borderRadius:6}}>
              <div style={{fontFamily:fontDisplay,fontSize:9,color:C.accent,letterSpacing:".15em",fontWeight:700,marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
                👁 WIFI MONITOR <span style={{color:C.textDim,fontSize:9,marginLeft:"auto"}}>{netStatus.wifi_monitor?.length||0}</span>
              </div>
              {netStatus.wifi_monitor?.length>0?netStatus.wifi_monitor.map((e,i)=>(
                <div key={i} style={{fontFamily:font,fontSize:11,padding:"4px 0",display:"flex",justifyContent:"space-between",alignItems:"center",gap:6}}>
                  <span style={{color:C.text,fontWeight:600}}>{e.interface}</span>
                  <Badge color={C.accent} sm>monitor</Badge>
                </div>
              )):<div style={{fontFamily:font,fontSize:10,color:C.textDim,fontStyle:"italic"}}>No interfaces in monitor mode</div>}
            </div>
          </div>

          {/* Suggestions */}
          {netStatus.suggestions?.length>0&&(
            <div style={{marginTop:11,display:"flex",flexDirection:"column",gap:5}}>
              {netStatus.suggestions.map((s,i)=>{
                const col = s.level==="ok"?C.accent:s.level==="warning"?C.danger:C.info;
                return(
                  <div key={i} style={{padding:"6px 12px",background:`${col}08`,borderRadius:4,border:`1px solid ${col}25`,fontFamily:font,fontSize:11,color:col,display:"flex",alignItems:"center",gap:8}}>
                    <span>{s.level==="ok"?"✓":s.level==="warning"?"⚠":"ℹ"}</span>
                    <span style={{color:C.textMuted}}>{s.message}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Btn onClick={refresh} disabled={ld} sx={{ marginBottom:16 }}>{ld?<><Spinner size={14}/>Scanning...</>:"↺ Refresh"}</Btn>

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
                  {i.mode==="managed" ? <Btn sm onClick={()=>act(i.name,"monitor")} color={C.accent} tip="Surgical: only this interface is affected. Ethernet and other adapters keep working.">▶ Monitor Mode</Btn>
                    : <Btn sm onClick={()=>act(i.name,"managed")} color={C.warn} tip="Returns this interface to managed mode (re-enables NetworkManager control)">◼ Managed Mode</Btn>}
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
  const {session} = useActiveSession();
  const [iface,sI]=useState("wlan0mon");const [bssid,sB]=useState("");const [essid,sE]=useState("");const [ch,sCh]=useState("6");const [tout,sT]=useState("120");
  const [dea,sDa]=useState(true);const [dp,sDp]=useState("10");const [dc,sDc]=useState("");const [band,sBa]=useState("bg");
  const [di,sDI]=useState("wlan0mon");const [db,sDB]=useState("");const [dcc,sDCC]=useState("");const [dn,sDN]=useState("50");const [de,sDE]=useState("");const [dR,sDR]=useState(null);

  // Capture op survives navigation away/back
  const capOp = usePersistentOp(`handshake_capture:${bssid||"_"}`);
  const cap = capOp.running;
  const capR = capOp.result;

  const capture = ()=> capOp.run(()=>api("/wifi/handshake",{method:"POST",body:JSON.stringify({interface:iface,target_bssid:bssid,target_essid:essid||null,channel:parseInt(ch),timeout:parseInt(tout),deauth_first:dea,deauth_packets:parseInt(dp),deauth_client:dc||null,band,session_id:session?.id||null})}));
  const deauth=async()=>{sDR(await api("/wifi/deauth",{method:"POST",body:JSON.stringify({interface:di,target_bssid:db,client_mac:dcc||null,packets:parseInt(dn),use_essid:de||null,reason:"audit"})}));};

  return (
    <div className="page-in">
      <PageTitle sub="Capture WPA/WPA2 4-way handshake. Once captured, head to the WPA Crack panel for offline cracking.">Handshake Capture</PageTitle>

      <div style={{marginBottom:16,padding:"12px 16px",background:`${C.info}08`,border:`1px solid ${C.info}30`,borderLeft:`3px solid ${C.info}`,borderRadius:6,fontFamily:font,fontSize:12,color:C.textMuted,lineHeight:1.7}}>
        <span style={{color:C.info,fontWeight:700}}>Workflow:</span> Capture the 4-way handshake here → file gets saved to captures → open the <span style={{color:C.warn,fontWeight:700}}>WPA Crack</span> panel and pick the file from the dropdown. For PMKID-based attacks (no client needed), use the <span style={{color:C.purple,fontWeight:700}}>Advanced</span> panel.
      </div>

      <Grid cols={2}>
        <Card title="Capture Handshake" color={C.accent} accent>
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
              :capR.handshake_captured?<div><div style={{color:C.accent,fontSize:15,fontWeight:700,fontFamily:fontDisplay,letterSpacing:".08em"}}>✓ HANDSHAKE CAPTURED!</div><div style={{color:C.textMuted,fontSize:12,marginTop:6}}>Target: {capR.target_bssid}{capR.target_essid&&` (${capR.target_essid})`}</div>{capR.capture_file&&<div style={{color:C.info,fontSize:12,marginTop:4,wordBreak:"break-all"}}>📁 {capR.capture_file}</div>}<div style={{color:C.warn,fontSize:11,marginTop:9,fontFamily:font,fontWeight:600}}>→ Now go to the <span style={{color:C.accent}}>WPA Crack</span> panel to crack it.</div></div>
              :<div><div style={{color:C.warn,fontSize:13,fontWeight:600}}>⚠ No handshake captured</div><div style={{color:C.textMuted,fontSize:12,marginTop:5}}>Try: increase timeout, verify clients are connected, or use PMKID (Advanced panel).</div></div>}
            </div>
          )}
        </Card>

        <Card title="⚡ Deauth Tool" color={C.danger} accent>
          <div style={{fontFamily:font,fontSize:11,color:C.textMuted,marginBottom:10,lineHeight:1.6}}>
            Standalone deauthentication tool. Useful for forcing clients to reconnect (and re-perform handshakes) or as standalone DoS testing. Different monitor interface than for capture.
          </div>
          <Input label="Interface" value={di} onChange={sDI} tip="Monitor-mode interface to send deauth frames from"/>
          <Input label="AP BSSID" value={db} onChange={sDB} tip="MAC of the target access point"/>
          <Input label="Client MAC (optional)" value={dcc} onChange={sDCC} placeholder="broadcast" tip="Target a specific client or leave blank to disconnect ALL clients"/>
          <Grid cols={2}>
            <Input label="Packets" value={dn} onChange={sDN} tip="Number of deauth packets (50-200)"/>
            <Input label="Or ESSID" value={de} onChange={sDE} placeholder="by name" tip="Alternative: target by network name"/>
          </Grid>
          <Btn onClick={deauth} disabled={!db&&!de} color={C.danger} sx={{width:"100%"}}>⚡ Send Deauth</Btn>
          {dR&&<div className="anim-up" style={{marginTop:11,padding:"11px 16px",borderRadius:5,background:`${dR.success?C.accent:dR.error?C.danger:C.warn}08`,border:`1px solid ${dR.success?C.accent:dR.error?C.danger:C.warn}28`,borderLeft:`3px solid ${dR.success?C.accent:dR.error?C.danger:C.warn}`}}>
            {dR.error?<div style={{color:C.danger,fontFamily:font,fontSize:12}}>✗ {dR.error}</div>:<div style={{fontFamily:font,fontSize:12}}><div style={{color:dR.success?C.accent:C.danger,fontWeight:600}}>{dR.success?"✓ Deauth sent":"✗ Failed"}</div><div style={{color:C.textMuted,fontSize:11,marginTop:4}}>Packets: {dR.packets_sent} · Target: {dR.target}</div></div>}
          </div>}
        </Card>
      </Grid>
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

          {/* 50/25/25 layout: Honeypot (50%) — Deauth (25%, middle) — Crack (25%) */}
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:12}}>

            {/* ═══ HONEYPOT CAPTURE (50%) ═══ */}
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
                      {aR.capture_file && <div style={{color:C.info,fontSize:11,marginTop:5,wordBreak:"break-all"}}>📁 {aR.capture_file}</div>}
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

            {/* ═══ DEAUTH (25%, middle) ═══ */}
            <Card title="⚡ Deauth" color={C.danger} accent>
              <div style={{fontSize:10,color:C.textMuted,fontFamily:font,marginBottom:10,lineHeight:1.55}}>
                Kick clients off the real AP so they probe for the SSID and connect to your honeypot.
              </div>
              <Input label="Monitor Iface" value={alDi} onChange={sAlDi} placeholder="wlan0mon" tip="Interface in monitor mode for sending deauth frames"/>
              <Input label="Real AP BSSID" value={alDb} onChange={sAlDb} placeholder="AA:BB:CC:DD:EE:FF" tip="MAC of the legit AP"/>
              <Input label="Client MAC" value={alDcc} onChange={sAlDcc} placeholder="blank = all" tip="Target one client, or blank for broadcast"/>
              <Grid cols={2}>
                <Input label="Packets" value={alDn} onChange={sAlDn} tip="50-200 typical"/>
                <Input label="Or ESSID" value={alDe} onChange={sAlDe} placeholder="by name" tip="Alternative: target by network name"/>
              </Grid>
              <Btn onClick={deauthApless} disabled={!alDb&&!alDe} color={C.danger} lg sx={{width:"100%"}}>⚡ Launch</Btn>
              <div style={{marginTop:6,display:"flex",justifyContent:"center"}}>
                {alDcc?<Badge color={C.danger} sm>🎯 Targeted</Badge>:<Badge color={C.warn} sm>📡 Broadcast</Badge>}
              </div>
              {alDR&&(
                <div className="anim-up" style={{marginTop:10,padding:"8px 10px",borderRadius:4,background:`${alDR.success?C.accent:alDR.error?C.danger:C.warn}08`,border:`1px solid ${alDR.success?C.accent:alDR.error?C.danger:C.warn}30`,borderLeft:`3px solid ${alDR.success?C.accent:alDR.error?C.danger:C.warn}`,fontFamily:font,fontSize:10}}>
                  {alDR.error?<div style={{color:C.danger,fontSize:10,wordBreak:"break-word"}}>✗ {alDR.error}</div>
                  :<div>
                    <div style={{color:alDR.success?C.accent:C.danger,fontWeight:700,marginBottom:4,fontSize:10}}>{alDR.success?"✓ Sent":"✗ Failed"}</div>
                    <div style={{color:C.textMuted,lineHeight:1.7,fontSize:9}}>
                      <div>Packets: <span style={{color:C.accent,fontWeight:700}}>{alDR.packets_sent}</span></div>
                      <div style={{wordBreak:"break-all"}}>Target: <span style={{color:C.text,fontFamily:"monospace",fontSize:9}}>{alDR.target}</span></div>
                    </div>
                  </div>}
                </div>
              )}
            </Card>

            {/* ═══ CRACK (25%, right) ═══ */}
            <Card title="Crack Handshake" color={C.warn} accent>
              <div style={{fontSize:10,color:C.textMuted,fontFamily:font,marginBottom:10,lineHeight:1.55}}>
                Crack the WPA key from the honeypot capture. Path auto-fills on successful capture.
              </div>
              <Input label="Capture File (.cap)" value={alCf} onChange={sAlCf} tip="Path to the .cap file from the honeypot capture. Auto-filled after successful capture." sx={{wordBreak:"break-all"}}/>
              <Input label="Target BSSID" value={alCb} onChange={sAlCb} placeholder="AA:BB:CC:DD:EE:FF" tip="MAC of the real AP (the BSSID you're targeting)"/>
              <Input label="Wordlist" value={alWl} onChange={sAlWl} tip="Path to wordlist. /usr/share/wordlists/rockyou.txt is the standard starting point"/>
              <Btn onClick={crackApless} disabled={alCrk||!alCf} color={C.warn} lg sx={{width:"100%"}}>
                {alCrk?<><Spinner size={14}/>Cracking</>:"▶ Crack"}
              </Btn>
              {alCrk&&<LoadingOverlay message="Dictionary attack"/>}
              {alCkR && !alCrk && (
                <div className="anim-up" style={{marginTop:10}}>
                  {alCkR.success ? (
                    <div style={{padding:"14px 12px",background:`${C.accent}06`,border:`1px solid ${C.accent}32`,borderRadius:6,textAlign:"center"}}>
                      <div style={{color:C.accent,fontSize:11,marginBottom:7,fontFamily:fontDisplay,fontWeight:700,letterSpacing:".1em"}}>✓ KEY FOUND!</div>
                      <div style={{color:C.warn,fontSize:18,fontFamily:fontDisplay,fontWeight:900,padding:"8px 10px",background:`${C.warn}12`,borderRadius:5,border:`2px solid ${C.warn}55`,display:"inline-block",textShadow:`0 0 24px ${C.warn}80`,animation:"glowPulse 2s ease-in-out infinite",letterSpacing:".04em",wordBreak:"break-all",maxWidth:"100%"}}>{alCkR.key}</div>
                      <div style={{color:C.textMuted,fontSize:10,marginTop:8,fontFamily:font,wordBreak:"break-all"}}>{alCkR.target_bssid}</div>
                    </div>
                  ) : (
                    <div style={{padding:"10px 12px",background:`${C.danger}09`,border:`1px solid ${C.danger}28`,borderLeft:`3px solid ${C.danger}`,borderRadius:5}}>
                      <div style={{color:C.danger,fontSize:11,fontWeight:600}}>✗ Key not found</div>
                      <div style={{color:C.textMuted,fontSize:10,marginTop:4,lineHeight:1.5}}>Try a larger wordlist or generate one with cewl/crunch.</div>
                    </div>
                  )}
                </div>
              )}
            </Card>

          </div>
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
// PAGE: RECON — Compact, with inline expandable host details
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// PAGE: NETWORK RECON — Full redesign
// ═══════════════════════════════════════════
// Module-level persist:
// hostDetails[ip] = {
//   expanded: bool,
//   deep:  { data: NmapScanResult | null, loading: bool },
//   vuln:  { data: NmapScanResult | null, loading: bool },
// }
const reconPersist = {
  baseHosts:  [],
  scanInfo:   null,
  scans:      [],
  hostDetails: {},   // keyed by IP
};

// ── INLINE PORT TABLE ──────────────────────
function PortTable({ ports, C }) {
  const open = (ports||[]).filter(p => p.state === "open");
  if (!open.length) return <div style={{fontFamily:font,fontSize:11,color:C.textMuted,padding:"6px 0"}}>No open ports found.</div>;
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:5}}>
      {open.map((p,i)=>(
        <div key={i} style={{display:"flex",gap:8,padding:"6px 10px",background:C.bgCard,borderRadius:4,border:`1px solid ${C.border}45`,alignItems:"center",fontFamily:font,fontSize:11}}>
          <span style={{color:C.warn,minWidth:70,fontWeight:700,fontFamily:fontDisplay,fontSize:10,letterSpacing:".04em"}}>{p.port}/{p.protocol}</span>
          <span style={{color:C.text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.service||"unknown"}</span>
          {p.version&&<span style={{color:C.info,fontSize:10,whiteSpace:"nowrap",fontFamily:"monospace"}}>{p.version}</span>}
        </div>
      ))}
    </div>
  );
}

// ── SERVICE TABLE ──────────────────────────
function ServiceTable({ services, C }) {
  if (!services?.length) return null;
  return (
    <div style={{marginTop:8}}>
      <div style={{fontFamily:fontDisplay,fontSize:9.5,color:C.info,textTransform:"uppercase",letterSpacing:".14em",marginBottom:5,fontWeight:700}}>Service versions</div>
      {services.map((s,i)=>(
        <div key={i} style={{padding:"5px 10px",background:C.bgCard,borderRadius:4,marginBottom:3,display:"flex",gap:8,alignItems:"center",fontFamily:font,fontSize:11,border:`1px solid ${C.border}40`}}>
          <Badge color={C.warn} sm>{s.port}</Badge>
          <span style={{color:C.text,fontWeight:600}}>{s.name}</span>
          {s.product&&<span style={{color:C.accent}}>{s.product}</span>}
          {s.version&&<Badge color={C.info} sm>v{s.version}</Badge>}
          {s.extra&&<span style={{color:C.textMuted,fontSize:10}}>({s.extra})</span>}
        </div>
      ))}
    </div>
  );
}

// ── VULN LIST ─────────────────────────────
function VulnList({ scripts_output, hosts, C }) {
  const vulns = (hosts?.[0]?.vulnerabilities) || [];
  const raw = scripts_output || hosts?.[0]?.scripts_output || "";
  if (!vulns.length && !raw) return <div style={{fontFamily:font,fontSize:11,color:C.textMuted,padding:"6px 0"}}>No vulnerabilities detected.</div>;
  return (
    <div>
      {vulns.map((v,i)=>(
        <div key={i} style={{padding:"7px 11px",background:`${C.danger}07`,border:`1px solid ${C.danger}25`,borderLeft:`3px solid ${C.danger}`,borderRadius:4,marginBottom:5,fontFamily:font,fontSize:11}}>
          <div style={{color:C.danger,fontWeight:700}}>{v.name||v.id||"Vulnerability"}</div>
          {v.description&&<div style={{color:C.textMuted,marginTop:3,lineHeight:1.5,fontSize:10.5}}>{v.description}</div>}
          {v.cvss&&<div style={{marginTop:4}}><Badge color={C.danger} sm>CVSS {v.cvss}</Badge></div>}
        </div>
      ))}
      {raw&&!vulns.length&&(
        <pre style={{fontFamily:"monospace",fontSize:10,color:C.textMuted,background:C.bgInput,padding:"10px",borderRadius:4,maxHeight:260,overflow:"auto",lineHeight:1.5,wordBreak:"break-all",whiteSpace:"pre-wrap"}}>
          {raw}
        </pre>
      )}
    </div>
  );
}

// ── PER-HOST INLINE DRAWER ─────────────────
// Shows both deep and vuln results in the same panel, each in its own section
function HostDrawer({ ip, slot, onClose, onRunDeep, onRunVuln, C }) {
  const [activeTab, setActiveTab] = useState(slot.deep?.data ? "deep" : slot.vuln?.data ? "vuln" : "deep");
  const deepData   = slot.deep?.data?.hosts?.[0]  || slot.deep?.data  || null;
  const vulnData   = slot.vuln?.data?.hosts?.[0]  || slot.vuln?.data  || null;
  const deepPorts  = deepData?.ports?.filter(p=>p.state==="open") || [];
  const vulnPorts  = vulnData?.ports?.filter(p=>p.state==="open") || [];
  const hasDeep    = !!deepData;
  const hasVuln    = !!vulnData;
  const deepLoading = slot.deep?.loading;
  const vulnLoading = slot.vuln?.loading;

  // Switch tab to new result when it arrives
  useEffect(()=>{ if(slot.deep?.data && !slot.deep?.loading) setActiveTab("deep"); }, [slot.deep?.data]);
  useEffect(()=>{ if(slot.vuln?.data && !slot.vuln?.loading) setActiveTab("vuln"); }, [slot.vuln?.data]);

  const hostMeta = deepData || vulnData;

  return (
    <div className="anim-up" style={{
      padding:"14px 16px",
      background:`linear-gradient(160deg, ${C.info}05 0%, ${C.bgInput} 100%)`,
      border:`1px solid ${C.info}28`,
      borderLeft:`3px solid ${C.info}`,
      borderRadius:6,
      margin:"0 0 2px",
    }}>
      {/* Drawer header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:6}}>
        <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap"}}>
          <span style={{fontFamily:fontDisplay,fontSize:10.5,color:C.info,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase"}}>
            📊 Analysis — <span style={{fontFamily:"monospace",color:C.text}}>{ip}</span>
          </span>
          {hostMeta?.hostname && <Badge color={C.textMuted} sm>{hostMeta.hostname}</Badge>}
          {hostMeta?.os_guess && <Badge color={C.purple} sm>{hostMeta.os_guess}</Badge>}
          {hostMeta?.mac && <span style={{fontFamily:"monospace",fontSize:10,color:C.textMuted}}>{hostMeta.mac}</span>}
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          {/* Run buttons — always visible inside drawer */}
          <Btn sm onClick={()=>onRunDeep(ip)} color={C.info} disabled={deepLoading}>
            {deepLoading ? <><Spinner size={10}/>Running...</> : hasDeep ? "↻ Re-run Deep" : "▶ Deep Scan"}
          </Btn>
          <Btn sm onClick={()=>onRunVuln(ip)} color={C.warn} disabled={vulnLoading}>
            {vulnLoading ? <><Spinner size={10}/>Running...</> : hasVuln ? "↻ Re-run Vuln" : "▶ Vuln Scan"}
          </Btn>
          <Btn sm onClick={()=>onClose(ip)} color={C.danger} ghost>✕</Btn>
        </div>
      </div>

      {/* Tab selector — only when we have 2+ results */}
      {(hasDeep || deepLoading) && (hasVuln || vulnLoading) && (
        <div style={{display:"flex",gap:4,marginBottom:12}}>
          {[
            {id:"deep",  label:"🔎 Deep Scan",   color:C.info,  badge: deepPorts.length > 0 ? `${deepPorts.length} ports` : null},
            {id:"vuln",  label:"🔍 Vuln Scan",   color:C.warn,  badge: null},
            {id:"both",  label:"⊞ Both",          color:C.accent, badge: null},
          ].map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
              padding:"4px 10px", borderRadius:5, cursor:"pointer",
              background:activeTab===t.id?`${t.color}20`:"transparent",
              border:`1px solid ${activeTab===t.id?t.color+"55":C.border}`,
              color:activeTab===t.id?t.color:C.textMuted,
              fontFamily:font, fontSize:10.5, fontWeight:600,
              display:"flex", alignItems:"center", gap:5,
              transition:"all .18s",
            }}>
              {t.label}
              {t.badge&&<span style={{fontSize:9,background:`${t.color}20`,padding:"1px 5px",borderRadius:8,color:t.color}}>{t.badge}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Loading states */}
      {deepLoading && !hasDeep && (
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px",background:`${C.info}07`,borderRadius:5,border:`1px solid ${C.info}20`,marginBottom:8,fontFamily:font,fontSize:11,color:C.info}}>
          <Spinner size={14} color={C.info}/>
          Running deep port + service scan on {ip} — this may take 30-120s...
        </div>
      )}
      {vulnLoading && !hasVuln && (
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px",background:`${C.warn}07`,borderRadius:5,border:`1px solid ${C.warn}20`,marginBottom:8,fontFamily:font,fontSize:11,color:C.warn}}>
          <Spinner size={14} color={C.warn}/>
          Running vuln scripts on {ip} — NSE scripts can take 1-5 minutes...
        </div>
      )}

      {/* DEEP SCAN SECTION */}
      {(activeTab==="deep"||activeTab==="both") && (hasDeep || deepLoading) && (
        <div style={{marginBottom:activeTab==="both"?14:0}}>
          {activeTab==="both"&&<div style={{fontFamily:fontDisplay,fontSize:10,color:C.info,textTransform:"uppercase",letterSpacing:".14em",marginBottom:7,fontWeight:700,display:"flex",alignItems:"center",gap:6}}>
            <span style={{width:5,height:5,background:C.info,borderRadius:"50%",boxShadow:`0 0 6px ${C.info}`,display:"block"}}/>
            Deep Scan Results
          </div>}
          {hasDeep ? (
            <>
              {/* compact open-ports count badge */}
              {deepPorts.length > 0 && (
                <div style={{marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
                  <Badge color={C.accent}>{deepPorts.length} open port{deepPorts.length!==1?"s":""}</Badge>
                  {deepData?.os_guess&&<Badge color={C.purple} sm>{deepData.os_guess}</Badge>}
                </div>
              )}
              <PortTable ports={deepData?.ports} C={C}/>
              <ServiceTable services={deepData?.services} C={C}/>
              {deepPorts.length===0&&<div style={{fontFamily:font,fontSize:11,color:C.textMuted,padding:"6px 0"}}>No open ports found.</div>}
            </>
          ) : deepLoading ? null : (
            <div style={{fontFamily:font,fontSize:11,color:C.textMuted}}>No deep scan yet — click ▶ Deep Scan above.</div>
          )}
        </div>
      )}

      {/* DIVIDER between sections in both-mode */}
      {activeTab==="both" && hasDeep && hasVuln && (
        <div style={{height:1,background:`${C.border}`,marginBottom:14}}/>
      )}

      {/* VULN SCAN SECTION */}
      {(activeTab==="vuln"||activeTab==="both") && (hasVuln || vulnLoading) && (
        <div>
          {activeTab==="both"&&<div style={{fontFamily:fontDisplay,fontSize:10,color:C.warn,textTransform:"uppercase",letterSpacing:".14em",marginBottom:7,fontWeight:700,display:"flex",alignItems:"center",gap:6}}>
            <span style={{width:5,height:5,background:C.warn,borderRadius:"50%",boxShadow:`0 0 6px ${C.warn}`,display:"block"}}/>
            Vulnerability Scan Results
          </div>}
          {hasVuln ? (
            <>
              {vulnPorts.length > 0 && (
                <div style={{marginBottom:8}}><Badge color={C.accent}>{vulnPorts.length} open port{vulnPorts.length!==1?"s":""}</Badge></div>
              )}
              <VulnList
                scripts_output={slot.vuln.data?.scripts_output}
                hosts={slot.vuln.data?.hosts}
                C={C}
              />
            </>
          ) : vulnLoading ? null : (
            <div style={{fontFamily:font,fontSize:11,color:C.textMuted}}>No vuln scan yet — click ▶ Vuln Scan above.</div>
          )}
        </div>
      )}

      {/* Nothing yet */}
      {!hasDeep && !hasVuln && !deepLoading && !vulnLoading && (
        <div style={{fontFamily:font,fontSize:11,color:C.textMuted,textAlign:"center",padding:"14px 0"}}>
          Use the buttons above to run a Deep or Vuln scan on this host.
        </div>
      )}
    </div>
  );
}

function ReconPage() {
  const C = useTheme();
  const {session} = useActiveSession();

  const [tgt,sT]        = useState("192.168.0.0/24");
  const [sty,sS]        = useState("quick");
  const [pts,sP]        = useState("");
  const [ca,sCA]        = useState("");
  const [to,sTO]        = useState("300");

  const [sc,sSc]         = useState(false);
  const [lastCmd,setLCmd]= useState("");
  const [scanErr,setSErr]= useState(null);

  const [baseHosts,setBH] = useState(reconPersist.baseHosts);
  const [scanInfo,setSI]  = useState(reconPersist.scanInfo);
  const [scans,setScans]  = useState(reconPersist.scans);

  // hostDetails[ip] = { expanded, deep: {data,loading}, vuln: {data,loading} }
  const [hostDetails,setHD] = useState(reconPersist.hostDetails);

  const isSingleHost = t => /^[\d.]+$/.test((t||"").trim()) && !t.includes("/") && !t.includes("-");
  const targetIsSingle = isSingleHost(tgt);

  const sts = [
    {value:"quick",    label:"Quick Ping",       desc:"Fast host discovery (-sn, no port scan)"},
    {value:"full",     label:"Full + OS",         desc:"All ports + OS fingerprint + services"},
    {value:"service",  label:"Service Versions",  desc:"Port scan + service/version detection (-sV)"},
    {value:"vuln",     label:"Vuln Scripts",      desc:"NSE vuln scripts — slow, may trigger IDS"},
    {value:"os_detect",label:"OS Detect",         desc:"TCP/IP fingerprinting only (-O)"},
    {value:"stealth",  label:"Stealth SYN",       desc:"Half-open SYN scan (-sS)"},
    {value:"udp",      label:"UDP Top 100",       desc:"Top 100 UDP ports (DNS, SNMP, DHCP…)"},
    {value:"custom",   label:"Custom Args",       desc:"Provide your own nmap arguments"},
  ];

  const loadScans = useCallback(async()=>{
    const d = await api("/recon/scans");
    if(Array.isArray(d)){setScans(d);reconPersist.scans=d;}
  },[]);
  useEffect(()=>{ loadScans(); },[loadScans]);

  // Update a single host's detail slot immutably
  const updateSlot = useCallback((ip, type, patch) => {
    setHD(prev => {
      const existing = prev[ip] || {expanded:true, deep:{data:null,loading:false}, vuln:{data:null,loading:false}};
      const updated = { ...existing, [type]: { ...existing[type], ...patch } };
      const next = { ...prev, [ip]: updated };
      reconPersist.hostDetails = next;
      return next;
    });
  }, []);

  const applyNetworkResult = (d) => {
    if(!d||d.error){setSErr(d?.error||"Scan failed");return;}
    setSErr(null);
    const h = d.hosts||[];
    setBH(h); reconPersist.baseHosts = h;
    setSI(d);  reconPersist.scanInfo  = d;
    setLCmd(d.command||"");
  };

  // Main network scan
  const doScan = async () => {
    sSc(true); setSErr(null);
    const d = await api("/recon/scan",{method:"POST",body:JSON.stringify({
      target:tgt, scan_type:sty, ports:pts||null,
      custom_args:ca||null, timeout:parseInt(to),
      session_id:session?.id||null,
    })});
    applyNetworkResult(d);
    sSc(false); loadScans();
  };

  // Quick CIDR discovery
  const doDiscover = async () => {
    sSc(true); setSErr(null);
    const d = await api(`/recon/discover?cidr=${encodeURIComponent(tgt)}`,{method:"POST"});
    applyNetworkResult(d);
    sSc(false); loadScans();
  };

  // Load old scan from history
  const loadOldScan = async (id) => {
    sSc(true);
    const d = await api(`/recon/scans/${id}`);
    if(d && !d.error) applyNetworkResult(d);
    sSc(false);
  };

  // Toggle drawer open/closed for a host row
  const toggleDrawer = (ip) => {
    setHD(prev => {
      const existing = prev[ip] || {expanded:false, deep:{data:null,loading:false}, vuln:{data:null,loading:false}};
      const next = { ...prev, [ip]: {...existing, expanded: !existing.expanded} };
      reconPersist.hostDetails = next;
      return next;
    });
  };

  // Ensure a drawer exists and is open (used when clicking Deep/Vuln from the actions column)
  const ensureOpen = (ip) => {
    setHD(prev => {
      if(prev[ip]?.expanded) return prev;
      const existing = prev[ip] || {expanded:false, deep:{data:null,loading:false}, vuln:{data:null,loading:false}};
      const next = {...prev, [ip]: {...existing, expanded:true}};
      reconPersist.hostDetails = next;
      return next;
    });
  };

  const closeDrawer = (ip) => {
    setHD(prev => {
      const next = {...prev};
      delete next[ip];
      reconPersist.hostDetails = next;
      return next;
    });
  };

  // Run deep scan on a single host
  const runDeep = async (ip) => {
    ensureOpen(ip);
    updateSlot(ip, "deep", {loading:true});
    const d = await api(`/recon/deep/${ip}`,{method:"POST"});
    updateSlot(ip, "deep", {loading:false, data: d?.error ? null : d});
    if(d?.error) setSErr(`Deep scan on ${ip}: ${d.error}`);
    loadScans();
  };

  // Run vuln scan on a single host
  const runVuln = async (ip) => {
    ensureOpen(ip);
    updateSlot(ip, "vuln", {loading:true});
    const d = await api(`/recon/vuln/${ip}`,{method:"POST"});
    updateSlot(ip, "vuln", {loading:false, data: d?.error ? null : d});
    if(d?.error) setSErr(`Vuln scan on ${ip}: ${d.error}`);
    loadScans();
  };

  const anyLoading = Object.values(hostDetails).some(s=>s.deep?.loading||s.vuln?.loading);
  const scannedCount = Object.values(hostDetails).filter(s=>s.deep?.data||s.vuln?.data).length;
  const expandedCount = Object.values(hostDetails).filter(s=>s.expanded).length;

  return (
    <div className="page-in">
      <PageTitle sub="Network reconnaissance — discover hosts then deep-scan or vuln-scan any target inline">Network Recon</PageTitle>

      {/* ── SECTION 1: NETWORK SCAN CONFIG ── */}
      <div style={{
        marginBottom:16, padding:"16px 18px",
        background:`linear-gradient(135deg,${C.info}07,${C.bgCard})`,
        border:`1px solid ${C.info}28`, borderLeft:`3px solid ${C.info}`,
        borderRadius:8,
      }}>
        {/* Header row */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontFamily:fontDisplay,fontSize:11,color:C.info,letterSpacing:".12em",fontWeight:700,textTransform:"uppercase"}}>
              1 — Network Discovery
            </span>
            <span style={{
              padding:"3px 9px", borderRadius:5, fontFamily:font, fontSize:10, fontWeight:700, letterSpacing:".05em",
              background:targetIsSingle?`${C.warn}15`:`${C.accent}15`,
              border:`1px solid ${targetIsSingle?C.warn+"40":C.accent+"40"}`,
              color:targetIsSingle?C.warn:C.accent,
            }}>
              {targetIsSingle ? "🎯 Single host" : "🌐 Network range"}
            </span>
          </div>
          {!targetIsSingle && (
            <span style={{fontFamily:font,fontSize:10,color:C.textMuted,fontStyle:"italic"}}>
              Enter a single IP to switch to direct host scan mode
            </span>
          )}
        </div>

        {/* Config grid */}
        <div style={{display:"grid",gridTemplateColumns:"2fr 1.4fr 1fr 0.7fr auto",gap:8,alignItems:"flex-end",marginBottom:0}} className="grid-4">
          <Input label="Target (IP / CIDR / range)" value={tgt} onChange={sT} sx={{marginBottom:0}} placeholder="192.168.0.0/24 or 192.168.0.5"/>
          <Select label="Scan type" value={sty} onChange={sS} options={sts.map(s=>({value:s.value,label:s.label}))} sx={{marginBottom:0}}/>
          <Input label="Ports" value={pts} onChange={sP} placeholder="22,80,443" sx={{marginBottom:0}}/>
          <Input label="Timeout (s)" value={to} onChange={sTO} sx={{marginBottom:0}}/>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",paddingBottom:2}}>
            <Btn onClick={doScan} disabled={sc}>{sc?<><Spinner size={14}/>Scanning...</>:"▶ Scan"}</Btn>
            {!targetIsSingle&&<Btn onClick={doDiscover} disabled={sc} color={C.accent} ghost>Discover</Btn>}
          </div>
        </div>

        {sty==="custom"&&(
          <div style={{marginTop:9}}>
            <Input label="Custom nmap arguments" value={ca} onChange={sCA} placeholder="-sS -T4 --script=http-enum" sx={{marginBottom:0}}/>
          </div>
        )}

        {/* Quick port presets */}
        <div style={{marginTop:10,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontFamily:font,fontSize:10,color:C.textMuted}}>Quick ports:</span>
          {[
            ["All 65535","1-65535",C.warn],
            ["Top 1024","1-1024",C.info],
            ["Common","21,22,23,25,53,80,110,143,443,445,3306,3389,5900,8080,8443",C.purple],
            ["Default (1000)","",C.textMuted],
          ].map(([lbl,v,c])=>(
            <Btn key={lbl} sm ghost onClick={()=>sP(v)} color={c}>{lbl}</Btn>
          ))}
          <span style={{marginLeft:"auto",fontFamily:font,fontSize:10,color:C.textDim,fontStyle:"italic"}}>
            {sts.find(s=>s.value===sty)?.desc}
          </span>
        </div>
      </div>

      {/* ── SECTION 2: PER-HOST ANALYSIS INFO ── */}
      <div style={{
        marginBottom:14, padding:"9px 14px",
        background:C.bgInput, borderRadius:6,
        border:`1px solid ${C.border}`,
        display:"flex", alignItems:"center", gap:12, flexWrap:"wrap",
        fontFamily:font, fontSize:11, color:C.textMuted,
      }}>
        <span style={{fontFamily:fontDisplay,fontSize:10,color:C.accent,textTransform:"uppercase",letterSpacing:".14em",fontWeight:700}}>2 — Host Analysis</span>
        <span>Click any host row to open its analysis drawer, or use the buttons on the right.</span>
        <div style={{marginLeft:"auto",display:"flex",gap:8,flexWrap:"wrap"}}>
          <Tip tip="Deep scan: full port + service version detection (-sV -O). Takes 30-120s per host.">
            <Badge color={C.info}>Deep</Badge>
          </Tip>
          <span style={{color:C.textMuted}}>full ports + versions</span>
          <Tip tip="Vuln scan: NSE vulnerability scripts (--script=vuln). Detects known CVEs. Takes 1-5min. May trigger IDS.">
            <Badge color={C.warn}>Vuln</Badge>
          </Tip>
          <span style={{color:C.textMuted}}>CVE / NSE scripts</span>
        </div>
      </div>

      {sc && <LoadingOverlay message="Running nmap scan" duration={parseInt(to)||300}/>}
      {lastCmd && (
        <div style={{fontFamily:"monospace",fontSize:11,color:C.textMuted,marginBottom:10,padding:"7px 12px",background:C.bgInput,borderRadius:4,borderLeft:`2px solid ${C.info}`,wordBreak:"break-all"}}>
          $ {lastCmd}
        </div>
      )}
      {scanErr && (
        <div className="anim-up" style={{padding:"10px 14px",background:`${C.danger}09`,border:`1px solid ${C.danger}30`,borderLeft:`3px solid ${C.danger}`,borderRadius:5,fontFamily:font,fontSize:12,color:C.danger,marginBottom:12}}>
          ✗ {scanErr}
        </div>
      )}

      {/* ── HOST TABLE ── */}
      {baseHosts.length > 0 && !sc && (
        <>
          <Row gap={10} sx={{marginBottom:12}} wrap>
            <Stat label="Hosts" value={baseHosts.length} color={C.accent} icon="🖥"/>
            <Stat label="Scan" value={(scanInfo?.scan_type||"—").toUpperCase()} color={C.purple} icon="⚡"/>
            <Stat label="Status" value={(scanInfo?.status||"—").toUpperCase()} color={scanInfo?.status==="completed"?C.accent:C.danger} icon="◉"/>
            {scannedCount>0 && <Stat label="Analysed" value={scannedCount} color={C.info} icon="🔍"/>}
            {expandedCount>0 && <Stat label="Open" value={expandedCount} color={C.accent} icon="▼"/>}
          </Row>

          <Card title={`Hosts (${baseHosts.length}) — click a row to open the analysis drawer`} accent>
            <div style={{overflowX:"auto",borderRadius:5}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontFamily:font,fontSize:12}}>
                <thead>
                  <tr style={{background:`${C.accent}07`}}>
                    {["","IP","MAC","Hostname","OS","Open Ports","Scans","Actions"].map(h=>(
                      <th key={h} style={{textAlign:"left",padding:"8px 10px",color:C.accent,borderBottom:`1px solid ${C.border}`,fontSize:10,textTransform:"uppercase",letterSpacing:".12em",whiteSpace:"nowrap",fontWeight:700,fontFamily:fontDisplay}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {baseHosts.map(h => {
                    const slot  = hostDetails[h.ip] || {expanded:false,deep:{data:null,loading:false},vuln:{data:null,loading:false}};
                    const open  = slot.expanded;
                    const hasD  = !!slot.deep?.data;
                    const hasV  = !!slot.vuln?.data;
                    const dLoad = slot.deep?.loading;
                    const vLoad = slot.vuln?.loading;
                    const deepPorts = slot.deep?.data?.hosts?.[0]?.ports?.filter(p=>p.state==="open") || [];
                    const basePorts = h.ports?.filter(p=>p.state==="open") || [];
                    const portCount = hasD ? deepPorts.length : basePorts.length;
                    const rowBg = open ? `${C.info}07` : "transparent";

                    return (
                      <Fragment key={h.ip}>
                        {/* ── HOST ROW ── */}
                        <tr
                          onClick={() => toggleDrawer(h.ip)}
                          style={{
                            cursor:"pointer",
                            borderBottom: open ? "none" : `1px solid ${C.border}45`,
                            background: rowBg,
                            transition:"background .15s",
                          }}
                          onMouseEnter={e => { if(!open) e.currentTarget.style.background=C.bgHover; }}
                          onMouseLeave={e => { e.currentTarget.style.background=rowBg; }}
                        >
                          {/* Chevron */}
                          <td style={{padding:"8px 6px 8px 10px",width:20}}>
                            <span style={{
                              color: open ? C.info : C.textMuted,
                              fontSize:11, display:"inline-block",
                              transition:"transform .2s",
                              transform: open ? "rotate(90deg)" : "rotate(0deg)",
                            }}>▶</span>
                          </td>
                          <td style={{padding:"8px 10px",fontWeight:700,color:C.text,fontFamily:"monospace",fontSize:11.5}}>{h.ip}</td>
                          <td style={{padding:"8px 10px",color:C.textMuted,fontSize:10.5,fontFamily:"monospace"}}>{h.mac||"—"}</td>
                          <td style={{padding:"8px 10px",color:C.info}}>{h.hostname||"—"}</td>
                          <td style={{padding:"8px 10px"}}>{h.os_guess?<span style={{color:C.purple}}>{h.os_guess}</span>:"—"}</td>
                          <td style={{padding:"8px 10px"}}>
                            <span style={{color:portCount>0?C.accent:C.textMuted,fontWeight:700}}>{portCount}</span>
                            {hasD&&<span style={{fontSize:9,color:C.textDim,marginLeft:5}}>deep</span>}
                          </td>
                          {/* Scan badges */}
                          <td style={{padding:"8px 10px"}}>
                            <Row gap={4}>
                              {(hasD||dLoad)&&<Badge color={C.info} sm>{dLoad?"…":"deep ✓"}</Badge>}
                              {(hasV||vLoad)&&<Badge color={C.warn} sm>{vLoad?"…":"vuln ✓"}</Badge>}
                              {!hasD&&!dLoad&&!hasV&&!vLoad&&<span style={{color:C.textDim,fontSize:10}}>—</span>}
                            </Row>
                          </td>
                          {/* Action buttons — stop propagation so they don't toggle the drawer */}
                          <td style={{padding:"8px 10px"}} onClick={e=>e.stopPropagation()}>
                            <Row gap={5}>
                              <Tip tip="Deep scan: full port + service/version detection on this IP. Opens the drawer with results.">
                                <Btn sm onClick={()=>runDeep(h.ip)} color={C.info} disabled={dLoad||vLoad}>
                                  {dLoad?<><Spinner size={9}/>...</>:hasD?"↻ Deep":"Deep"}
                                </Btn>
                              </Tip>
                              <Tip tip="Vuln scan: run nmap NSE vulnerability scripts. Detects known CVEs. May be slow and trigger IDS.">
                                <Btn sm onClick={()=>runVuln(h.ip)} color={C.warn} disabled={dLoad||vLoad}>
                                  {vLoad?<><Spinner size={9}/>...</>:hasV?"↻ Vuln":"Vuln"}
                                </Btn>
                              </Tip>
                              {(hasD||hasV)&&(
                                <Btn sm onClick={()=>closeDrawer(h.ip)} color={C.danger} ghost>✕</Btn>
                              )}
                            </Row>
                          </td>
                        </tr>

                        {/* ── EXPANDABLE DRAWER ROW ── */}
                        {open && (
                          <tr style={{borderBottom:`1px solid ${C.border}45`}}>
                            <td colSpan={8} style={{padding:"0 10px 8px",background:`${C.info}03`}}>
                              <HostDrawer
                                ip={h.ip}
                                slot={slot}
                                onClose={closeDrawer}
                                onRunDeep={runDeep}
                                onRunVuln={runVuln}
                                C={C}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ── SCAN HISTORY ── */}
      {scans.length > 0 && (
        <Card title={`Scan History (${scans.length}) — click to reload`} color={C.info} sx={{marginTop:14}}>
          <div style={{maxHeight:200,overflowY:"auto"}}>
            {scans.map(s=>(
              <div key={s.id} onClick={()=>loadOldScan(s.id)}
                style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 12px",background:C.bgInput,borderRadius:5,marginBottom:4,cursor:"pointer",fontFamily:font,fontSize:11,transition:"all .14s"}}
                onMouseEnter={e=>e.currentTarget.style.background=C.bgHover}
                onMouseLeave={e=>e.currentTarget.style.background=C.bgInput}>
                <span style={{color:C.text}}>
                  #{s.id} — <span style={{fontFamily:"monospace"}}>{s.target}</span>
                  <span style={{color:C.textMuted,marginLeft:6}}>({s.scan_type})</span>
                </span>
                <Row gap={7}>
                  <span style={{color:C.textMuted}}>{s.hosts?.length||0} hosts</span>
                  <Badge color={s.status==="completed"?C.accent:C.warn} sm>{s.status}</Badge>
                </Row>
              </div>
            ))}
          </div>
        </Card>
      )}
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
  const [etMode,setEtMode]=useState("plain"); // plain, captive, deauth, enterprise
  const [edl,sEDL]=useState(false);const [edi,sEDI]=useState("wlan0mon");const [edb,sEDB]=useState("");const [edp,sEDP]=useState("50");
  const [es,sES]=useState(null);const [el,sEL]=useState(false);
  // Standalone deauth panel
  const [deauthIface,setDeauthIface]=useState("wlan0mon");const [deauthBssid,setDeauthBssid]=useState("");const [deauthClient,setDeauthClient]=useState("");const [deauthChannel,setDeauthChannel]=useState("");const [deauthPackets,setDeauthPackets]=useState("50");const [deauthLoading,setDeauthLoading]=useState(false);const [deauthResult,setDeauthResult]=useState(null);
  // Evil Twin flow viewer
  const [etFlowData,setEtFlowData]=useState(null);const [etHost,setEtHost]=useState("");const [etMethod,setEtMethod]=useState("");const [etAuto,setEtAuto]=useState(true);const [etLoading,setEtLoading]=useState(false);
  const [mi,sMI]=useState("wlan0");const [mt,sMT]=useState("");const [mg,sMG]=useState("192.168.0.1");const [mp,sMP]=useState("8080");const [mh,sMH]=useState("");const [ms,sMS]=useState(null);const [ml,sML]=useState(false);
  const [mStealth,setMStealth]=useState(true);
  const [flowData,setFlowData]=useState(null);const [flowHost,setFlowHost]=useState("");const [flowMethod,setFlowMethod]=useState("");const [flowCreds,setFlowCreds]=useState(false);const [flowAuto,setFlowAuto]=useState(true);const [flowLoading,setFlowLoading]=useState(false);
  const [caInfo,setCaInfo]=useState(null);

  const ref=async()=>{sES(await api("/attacks/evil-twin/status"));sMS(await api("/attacks/mitm/status"));};
  useEffect(()=>{ref();},[]);
  const sET=async()=>{
    sEL(true);
    const captive = etMode === "captive";
    const deauth = etMode === "deauth";
    await api("/attacks/evil-twin/start",{method:"POST",body:JSON.stringify({interface:ei,target_essid:ee,channel:parseInt(ec),internet_interface:en||null,captive_portal:captive,deauth_legitimate:deauth,deauth_interface:deauth?edi:null,deauth_bssid:deauth?edb:null,deauth_packets:parseInt(edp)})});
    await ref();
    sEL(false);
  };
  const xET=async()=>{await api("/attacks/evil-twin/stop",{method:"POST"});setEtFlowData(null);ref();};
  // Standalone deauth
  const sendDeauth=async()=>{
    setDeauthLoading(true);setDeauthResult(null);
    const body={interface:deauthIface,target_bssid:deauthBssid,packets:parseInt(deauthPackets)};
    if(deauthClient)body.client_mac=deauthClient;
    if(deauthChannel)body.channel=parseInt(deauthChannel);
    setDeauthResult(await api("/attacks/evil-twin/deauth",{method:"POST",body:JSON.stringify(body)}));
    setDeauthLoading(false);
  };
  // Evil Twin flow loading
  const loadEtFlows=async()=>{
    setEtLoading(true);
    const p=new URLSearchParams({limit:"200"});
    if(etHost)p.set("host",etHost);if(etMethod)p.set("method",etMethod);
    setEtFlowData(await api(`/attacks/evil-twin/flows?${p.toString()}`));
    setEtLoading(false);
  };
  useEffect(()=>{if(es?.active)loadEtFlows();},[es?.active,etHost,etMethod]);
  useEffect(()=>{if(!es?.active||!etAuto)return;const i=setInterval(()=>{loadEtFlows();ref();},3000);return()=>clearInterval(i);},[es?.active,etAuto,etHost,etMethod]);
  const sM=async()=>{sML(true);await api("/attacks/mitm/start",{method:"POST",body:JSON.stringify({interface:mi,target_ips:mt.split(",").map(s=>s.trim()).filter(Boolean),gateway:mg,proxy_port:parseInt(mp),stealth:mStealth,filter_hosts:mh?mh.split(",").map(s=>s.trim()):[]})});await ref();sML(false);};
  const xM=async()=>{await api("/attacks/mitm/stop",{method:"POST"});setFlowData(null);ref();};
  const loadFlows=async()=>{setFlowLoading(true);const p=new URLSearchParams({limit:"200"});if(flowHost)p.set("host",flowHost);if(flowMethod)p.set("method",flowMethod);if(flowCreds)p.set("credentials_only","true");setFlowData(await api(`/attacks/mitm/flows?${p.toString()}`));setFlowLoading(false);};
  useEffect(()=>{if(ms?.active)loadFlows();},[ms?.active,flowHost,flowMethod,flowCreds]);
  useEffect(()=>{if(!ms?.active||!flowAuto)return;const i=setInterval(loadFlows,3000);return()=>clearInterval(i);},[ms?.active,flowAuto,flowHost,flowMethod,flowCreds]);
  const loadCa=async()=>setCaInfo(await api("/attacks/mitm/ca-cert"));

  const stats=flowData?.stats||{};const flows=flowData?.flows||[];
  const etStats=etFlowData?.stats||{};const etFlows=etFlowData?.flows||[];
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
      {tab==="eviltwin"&&(<>
        {/* 80/20 side-by-side: Evil Twin config (80%) + Standalone Deauth (20%) */}
        <div style={{display:"grid",gridTemplateColumns:"4fr 1fr",gap:12,marginBottom:12}}>

          {/* ═══ EVIL TWIN AP (80%) ═══ */}
          <Card title="Evil Twin AP" color={C.warn} accent>
            <div style={{marginBottom:12,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <Badge color={es?.active?C.accent:C.textMuted}>{es?.active?"ACTIVE":"INACTIVE"}</Badge>
              {es?.active&&<Badge color={C.warn} sm>MODE: {(es.twin?.mode||"plain").toUpperCase()}</Badge>}
              {es?.active&&es?.client_count!==undefined&&<span style={{fontFamily:font,fontSize:11,color:C.info}}>{es.client_count} client{es.client_count!==1?"s":""} connected</span>}
              {es?.active&&es?.total_flows!==undefined&&<span style={{fontFamily:font,fontSize:11,color:C.accent}}>{es.total_flows} flows captured</span>}
            </div>

            {!es?.active?(
              <div>
                {/* Mode selector — 4 modes */}
                <div style={{marginBottom:14}}>
                  <div style={{fontFamily:fontDisplay,fontSize:10,color:C.textMuted,textTransform:"uppercase",letterSpacing:".12em",marginBottom:7}}>Attack Mode</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4, 1fr)",gap:8}}>
                    {[
                      {id:"plain",label:"Plain",icon:"📡",desc:"Just rogue AP + internet forwarding + MITM monitor",color:C.warn},
                      {id:"captive",label:"Captive Portal",icon:"🎣",desc:"Redirect all DNS to serve a fake login page",color:"#c084fc"},
                      {id:"deauth",label:"With Deauth",icon:"⚡",desc:"Simultaneously deauth legit AP to force clients over",color:"#ff2055"},
                      {id:"enterprise",label:"Enterprise",icon:"🏢",desc:"Use Advanced → Enterprise panel for 802.1X",color:C.info,disabled:true},
                    ].map(m=>{
                      const active = etMode===m.id;
                      return(
                        <div key={m.id} onClick={()=>{if(!m.disabled)setEtMode(m.id);}} style={{
                          padding:"10px 11px",borderRadius:5,cursor:m.disabled?"not-allowed":"pointer",
                          background:active?`${m.color}18`:m.disabled?`${C.bgInput}50`:C.bgInput,
                          border:`1px solid ${active?m.color+"60":C.border}`,
                          borderLeft:active?`3px solid ${m.color}`:`3px solid transparent`,
                          transition:"all .18s",opacity:m.disabled?0.45:1,
                          boxShadow:active?`0 0 14px ${m.color}22`:"none",
                        }}>
                          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                            <span style={{fontSize:14}}>{m.icon}</span>
                            <span style={{fontFamily:fontDisplay,fontSize:11,color:active?m.color:C.text,fontWeight:700,letterSpacing:".06em"}}>{m.label}</span>
                          </div>
                          <div style={{fontFamily:font,fontSize:10,color:active?m.color+"cc":C.textMuted,lineHeight:1.45}}>{m.desc}</div>
                          {m.disabled&&<div style={{fontFamily:font,fontSize:9,color:C.textDim,marginTop:3,fontStyle:"italic"}}>→ See Advanced panel</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Base AP config — always visible */}
                <Grid cols={2}>
                  <Input label="AP Interface" value={ei} onChange={sEI} tip="WiFi adapter for the fake AP (must support AP mode)"/>
                  <Input label="Target ESSID" value={ee} onChange={sEE} placeholder="Corp_WiFi" tip="Network name to impersonate"/>
                </Grid>
                <Grid cols={2}>
                  <Input label="Channel" value={ec} onChange={sEC} tip="Same channel as legitimate AP"/>
                  <Input label="Internet Interface" value={en} onChange={sEN} tip="Interface for routing victim traffic to internet"/>
                </Grid>

                {/* Mode-specific fields */}
                {etMode==="captive"&&(
                  <div style={{padding:"10px 14px",background:`${"#c084fc"}08`,border:`1px solid ${"#c084fc"}25`,borderLeft:`3px solid #c084fc`,borderRadius:5,marginBottom:10,fontFamily:font,fontSize:11,color:C.textMuted,lineHeight:1.6}}>
                    <div style={{color:"#c084fc",fontWeight:700,marginBottom:4,fontSize:11}}>🎣 Captive Portal Active</div>
                    dnsmasq will redirect <strong style={{color:C.text}}>all DNS queries</strong> to this machine. Victim browsers will hit your fake login page regardless of the URL they try to visit. Place your HTML template at <code style={{color:C.accent,background:C.bgCard,padding:"1px 4px",borderRadius:2}}>backend/captive_portal/index.html</code>.
                  </div>
                )}

                {etMode==="deauth"&&(<>
                  <div style={{padding:"10px 14px",background:`${"#ff2055"}08`,border:`1px solid ${"#ff2055"}25`,borderLeft:`3px solid #ff2055`,borderRadius:5,marginBottom:10,fontFamily:font,fontSize:11,color:C.textMuted,lineHeight:1.6}}>
                    <div style={{color:"#ff2055",fontWeight:700,marginBottom:4,fontSize:11}}>⚡ Deauth on Launch</div>
                    After starting the Evil Twin, <strong style={{color:C.text}}>aireplay-ng</strong> will deauth clients of the legitimate AP, forcing them to reconnect. Many will then join your Evil Twin (same ESSID, potentially stronger signal).
                  </div>
                  <Grid cols={3}>
                    <Input label="Monitor Iface" value={edi} onChange={sEDI} tip="Monitor-mode interface (different from AP interface)" placeholder="wlan0mon"/>
                    <Input label="Legit AP BSSID" value={edb} onChange={sEDB} tip="MAC of the REAL AP being attacked" placeholder="AA:BB:CC:DD:EE:FF"/>
                    <Input label="Packets" value={edp} onChange={sEDP} tip="Deauth packet count (50-500). 0 = continuous"/>
                  </Grid>
                </>)}

                <Btn onClick={sET} disabled={el||!ee||(etMode==="deauth"&&(!edi||!edb))} color={C.warn} lg>
                  {el?<><Spinner size={14}/>Launching...</>:`▶ Launch Evil Twin${etMode==="captive"?" + Captive":etMode==="deauth"?" + Deauth":""}`}
                </Btn>
                {el&&<LoadingOverlay message="Launching Evil Twin AP + traffic monitor"/>}
              </div>
            ):(
              <div>
                <div style={{fontFamily:font,fontSize:11,color:C.textMuted,padding:"10px 14px",background:C.bgInput,borderRadius:5,marginBottom:10,display:"flex",gap:16,flexWrap:"wrap",lineHeight:1.8}}>
                  <span>ESSID: <span style={{color:C.text}}>{es.twin?.essid}</span></span>
                  <span>Channel: <span style={{color:C.text}}>{es.twin?.channel}</span></span>
                  <span>Interface: <span style={{color:C.text}}>{es.twin?.interface}</span></span>
                  <span>Gateway: <span style={{color:C.text}}>{es.twin?.ip}</span></span>
                  <span>DHCP: <span style={{color:C.text}}>{es.twin?.dhcp_range}</span></span>
                  {es.twin?.monitor_active&&<Badge color={C.accent} sm>MONITOR ACTIVE</Badge>}
                </div>
                <Btn onClick={xET} danger sm>◼ Stop Evil Twin</Btn>
              </div>
            )}
          </Card>

          {/* ═══ STANDALONE DEAUTH (20%, compact) ═══ */}
          <div id="deauth-panel">
          <Card title="⚡ Deauth" color="#ff2055" accent>
            <div style={{fontFamily:font,fontSize:10,color:C.textMuted,marginBottom:10,lineHeight:1.55}}>
              Standalone attack. Requires monitor-mode iface (different from AP iface).
            </div>
            <Input label="Monitor Iface" value={deauthIface} onChange={setDeauthIface} placeholder="wlan0mon" tip="Monitor-mode interface"/>
            <Input label="AP BSSID" value={deauthBssid} onChange={setDeauthBssid} placeholder="AA:BB:CC:DD:EE:FF" tip="Target AP MAC"/>
            <Input label="Client MAC" value={deauthClient} onChange={setDeauthClient} placeholder="Blank = broadcast" tip="Optional — target one client"/>
            <Grid cols={2}>
              <Input label="Channel" value={deauthChannel} onChange={setDeauthChannel} placeholder="auto"/>
              <Input label="Packets" value={deauthPackets} onChange={setDeauthPackets} tip="0 = infinite"/>
            </Grid>
            <Btn onClick={sendDeauth} disabled={deauthLoading||!deauthIface||!deauthBssid} color="#ff2055" lg sx={{width:"100%"}}>
              {deauthLoading?<><Spinner size={14}/>Attacking</>:"⚡ Launch"}
            </Btn>
            <div style={{marginTop:6,display:"flex",justifyContent:"center"}}>
              {deauthClient?<Badge color="#ff2055" sm>🎯 Targeted</Badge>:<Badge color={C.warn} sm>📡 Broadcast</Badge>}
            </div>
            {deauthResult&&(
              <div className="anim-up" style={{marginTop:10,padding:"8px 10px",borderRadius:4,background:deauthResult.success?`${C.accent}08`:"#ff205508",border:`1px solid ${deauthResult.success?C.accent:"#ff2055"}30`,borderLeft:`3px solid ${deauthResult.success?C.accent:"#ff2055"}`,fontFamily:font,fontSize:10}}>
                <div style={{color:deauthResult.success?C.accent:"#ff2055",fontWeight:700,marginBottom:4,fontSize:10}}>
                  {deauthResult.success?"✓ Sent":"✗ Failed"}
                </div>
                <div style={{color:C.textMuted,lineHeight:1.7,fontSize:9}}>
                  <div>AP: <span style={{color:C.text,fontFamily:"monospace",fontSize:9}}>{deauthResult.target_bssid?.slice(0,17)}</span></div>
                  <div>Client: <span style={{color:C.text,fontFamily:"monospace",fontSize:9}}>{deauthResult.client_mac?.slice(0,17)||"broadcast"}</span></div>
                  <div>Packets: <span style={{color:C.accent,fontWeight:700}}>{deauthResult.packets_sent}</span></div>
                  {deauthResult.channel&&<div>Ch: <span style={{color:C.text}}>{deauthResult.channel}</span></div>}
                </div>
                {deauthResult.error&&<div style={{color:"#ff2055",marginTop:5,padding:"4px 6px",background:"#ff205510",borderRadius:2,fontFamily:"monospace",fontSize:9,wordBreak:"break-word"}}>{deauthResult.error}</div>}
              </div>
            )}
          </Card>
          </div>

        </div>

        {/* ═══════ EVIL TWIN TRAFFIC MONITOR (full width) ═══════ */}
        {es?.active&&(<div className="anim-up">
          {/* Monitor banner — emphasizes built-in MITM */}
          <div style={{padding:"12px 16px",marginBottom:12,borderRadius:6,fontFamily:font,fontSize:11,display:"flex",alignItems:"center",gap:12,background:`linear-gradient(90deg, ${C.warn}08, ${C.info}08)`,border:`1px solid ${C.info}25`,borderLeft:`3px solid ${C.info}`}}>
            <span style={{fontSize:22}}>📡</span>
            <div style={{flex:1}}>
              <div style={{color:C.info,fontWeight:700,fontFamily:fontDisplay,letterSpacing:".08em",fontSize:12,marginBottom:2}}>BUILT-IN MITM · TRAFFIC MONITOR ACTIVE</div>
              <div style={{color:C.textMuted,fontSize:11,lineHeight:1.5}}>
                Capturing <span style={{color:C.accent,fontWeight:700}}>DNS queries</span>,
                {" "}<span style={{color:C.info,fontWeight:700}}>TLS SNI</span> and
                {" "}<span style={{color:C.warn,fontWeight:700}}>HTTP requests</span> from all clients connected to <strong style={{color:C.text}}>{es.twin?.essid}</strong>.
                Since clients connect to <em>your</em> AP, no ARP spoofing is needed — you already see 100% of their traffic.
              </div>
            </div>
            {etAuto&&<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:C.accent,animation:"pulse 1.5s infinite",boxShadow:`0 0 10px ${C.accent}`}}/>
              <span style={{fontFamily:fontDisplay,fontSize:8,color:C.accent,letterSpacing:".1em",fontWeight:700}}>LIVE</span>
            </div>}
          </div>

          {/* Stats */}
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            <Stat label="Total Flows" value={etStats.total_flows||0} color={C.warn} icon="🌐"/>
            <Stat label="Clients Connected" value={es.client_count||0} color={C.info} icon="📱"/>
            <Stat label="Unique Hosts" value={etStats.unique_hosts||0} color={C.purple} icon="🔗"/>
            <Stat label="Unique Clients" value={etStats.client_count||0} color={C.accent} icon="👥"/>
          </div>

          {/* Connected clients list with quick-deauth buttons */}
          {es.connected_clients?.length>0&&(
            <Card title={`Connected Clients (${es.connected_clients.length})`} color={C.info}>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {es.connected_clients.map((cl,i)=>(
                  <div key={i} style={{padding:"8px 12px",background:C.bgInput,borderRadius:4,fontFamily:font,fontSize:11,border:`1px solid ${C.border}`,display:"flex",gap:12,alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{display:"flex",gap:12,alignItems:"center",flex:1,minWidth:0}}>
                      <span style={{color:C.accent,fontWeight:700,minWidth:90}}>● {cl.ip}</span>
                      <span style={{color:C.text,fontFamily:"monospace",fontSize:10}}>{cl.mac}</span>
                      {cl.hostname&&cl.hostname!=="unknown"&&<span style={{color:C.info,fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>📱 {cl.hostname}</span>}
                    </div>
                    <div style={{display:"flex",gap:4}}>
                      <Btn sm ghost color={C.purple} onClick={()=>{setFlowHost("");setEtHost(cl.ip);}}>🔍 Filter flows</Btn>
                      <Btn sm ghost color="#ff2055" onClick={()=>{setDeauthClient(cl.mac);document.getElementById("deauth-panel")?.scrollIntoView({behavior:"smooth"});}}>⚡ Deauth</Btn>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Top hosts */}
          {etStats.top_hosts?.length>0&&(
            <Card title={`Top Hosts (${etStats.unique_hosts} unique)`} color={C.purple}>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {etStats.top_hosts.slice(0,20).map((h,i)=>(
                  <div key={i} onClick={()=>setEtHost(etHost===h.host?"":h.host)} style={{
                    padding:"4px 10px",background:etHost===h.host?`${C.purple}20`:C.bgInput,
                    borderRadius:3,fontFamily:font,fontSize:11,cursor:"pointer",
                    border:`1px solid ${etHost===h.host?C.purple+"50":C.border}`,
                    transition:"all .15s",display:"flex",gap:6,alignItems:"center",
                  }}>
                    <span style={{color:C.text}}>{h.host}</span>
                    <span style={{color:C.purple,fontWeight:700,fontSize:10}}>{h.count}</span>
                  </div>
                ))}
                {etHost&&<div onClick={()=>setEtHost("")} style={{padding:"4px 10px",background:"#ff205515",borderRadius:3,fontFamily:font,fontSize:10,cursor:"pointer",color:"#ff2055",border:"1px solid #ff205530"}}>✕ Clear</div>}
              </div>
            </Card>
          )}

          {/* Filters */}
          <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center",flexWrap:"wrap",padding:"8px 12px",background:C.bgCard,borderRadius:4,border:`1px solid ${C.border}`}}>
            <input value={etHost} onChange={e=>setEtHost(e.target.value)} placeholder="Filter host or IP..." style={{padding:"5px 10px",background:C.bgInput,border:`1px solid ${C.border}`,borderRadius:3,color:C.text,fontFamily:font,fontSize:11,width:200,outline:"none"}}/>
            <select value={etMethod} onChange={e=>setEtMethod(e.target.value)} style={{padding:"5px 10px",background:C.bgInput,border:`1px solid ${C.border}`,borderRadius:3,color:C.text,fontFamily:font,fontSize:11,outline:"none"}}>
              <option value="">All methods</option>
              {["GET","POST","PUT","DELETE","DNS","TLS","HTTP"].map(m=><option key={m} value={m}>{m}</option>)}
            </select>
            <label style={{fontFamily:font,fontSize:10,color:etAuto?C.accent:C.textMuted,display:"flex",gap:5,alignItems:"center",cursor:"pointer"}}>
              <input type="checkbox" checked={etAuto} onChange={e=>setEtAuto(e.target.checked)}/>
              {etAuto?<span style={{display:"inline-flex",gap:4,alignItems:"center"}}><span style={{width:6,height:6,borderRadius:"50%",background:C.accent,animation:"pulse 1.5s infinite"}}/>LIVE</span>:"Paused"}
            </label>
            <Btn sm ghost onClick={loadEtFlows} color={C.warn}>↺ Refresh</Btn>
            {etLoading&&<Spinner size={12} color={C.warn}/>}
            {(etHost||etMethod)&&<Btn sm ghost onClick={()=>{setEtHost("");setEtMethod("");}}>✕ Clear filters</Btn>}
            <span style={{fontFamily:font,fontSize:9,color:C.textMuted,marginLeft:"auto"}}>Showing {etFlowData?.showing||0} of {etFlowData?.total||0} flows</span>
          </div>

          {/* Flow table — full width */}
          <Card title={`Intercepted Traffic${etAuto?" · LIVE":""}`} color={C.warn} accent>
            <div style={{overflowX:"auto",maxHeight:600,overflowY:"auto"}}>
              {etFlows.length===0?(
                <div style={{textAlign:"center",padding:40,fontFamily:font,color:C.textMuted}}>
                  {etFlowData?.total===0?"⏳ Waiting for traffic... Connect a device to the Evil Twin.":"No flows match the current filters."}
                </div>
              ):(
                <table style={{width:"100%",borderCollapse:"collapse",fontFamily:font,fontSize:11}}>
                  <thead>
                    <tr style={{background:`${C.warn}08`,position:"sticky",top:0,zIndex:2}}>
                      {["Time","Method","Type","Protocol","Host","Path","Size","Duration","Client"].map(h=>(
                        <th key={h} style={{textAlign:"left",padding:"7px 8px",color:C.warn,fontSize:9,textTransform:"uppercase",letterSpacing:".1em",fontFamily:fontDisplay,fontWeight:700,borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap",background:C.bgCard}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {etFlows.map((f,i)=>{
                      const mc=methodColors[f.method]||C.textMuted;
                      const tc=typeColors[f.type_tag]||C.textMuted;
                      return(
                        <tr key={f.id??i} style={{borderBottom:`1px solid ${C.border}30`,transition:"background .1s"}}
                          onMouseEnter={e=>e.currentTarget.style.background=C.bgHover}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{padding:"5px 8px",color:C.textMuted,whiteSpace:"nowrap",fontSize:10}}>{f.timestamp?.split(" ")[1]||"—"}</td>
                          <td style={{padding:"5px 8px"}}><span style={{padding:"1px 7px",borderRadius:2,fontSize:9,fontWeight:700,background:`${mc}15`,color:mc,border:`1px solid ${mc}30`}}>{f.method}</span></td>
                          <td style={{padding:"5px 8px"}}><span style={{padding:"0 5px",borderRadius:2,fontSize:8,background:`${tc}15`,color:tc}}>{f.type_tag}</span></td>
                          <td style={{padding:"5px 8px"}}>{f.is_https?<span style={{color:C.accent,fontSize:10}}>🔒</span>:f.scheme==="dns"?<span style={{color:C.info,fontSize:10}}>📡</span>:<span style={{color:C.warn,fontSize:10}}>⚠</span>} <span style={{fontSize:9,color:C.textMuted}}>{f.scheme?.toUpperCase()}</span></td>
                          <td style={{padding:"5px 8px",color:C.info,fontWeight:600,maxWidth:240,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:"pointer"}} onClick={()=>setEtHost(etHost===f.host?"":f.host)} title={`Click to filter by ${f.host}`}>{f.host}</td>
                          <td style={{padding:"5px 8px",color:C.text,maxWidth:350,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={f.path}>{f.path}</td>
                          <td style={{padding:"5px 8px",color:C.textMuted,whiteSpace:"nowrap",fontSize:10}}>{f.response_size>1048576?`${(f.response_size/1048576).toFixed(1)}M`:f.response_size>1024?`${(f.response_size/1024).toFixed(0)}K`:`${f.response_size}B`}</td>
                          <td style={{padding:"5px 8px",color:f.duration_ms>1000?C.warn:f.duration_ms>300?"#ff9500":C.textMuted,whiteSpace:"nowrap",fontSize:10}}>{f.duration_ms?`${f.duration_ms}ms`:"—"}</td>
                          <td style={{padding:"5px 8px",color:C.accent,fontSize:10,whiteSpace:"nowrap",fontFamily:"monospace",cursor:"pointer"}} onClick={()=>setEtHost(etHost===f.client_ip?"":f.client_ip)} title={`Click to filter by ${f.client_ip}`}>{f.client_ip||"—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>)}
      </>)}

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
    try {
      const date = new Date(d);
      return date.toLocaleString(undefined, {year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
    } catch { return d; }
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
// PAGE: SESSIONS — List/Detail mode with full finding management
// ═══════════════════════════════════════════
const SEV_META = {
  critical: { color:"#ff2055", icon:"🔴", label:"Critical" },
  high:     { color:"#ff6b35", icon:"🟠", label:"High" },
  medium:   { color:"#ff9500", icon:"🟡", label:"Medium" },
  low:      { color:"#3ab5ff", icon:"🔵", label:"Low" },
  info:     { color:"#00ff95", icon:"🟢", label:"Info" },
};
const CAT_ICONS = { wifi:"📡", network:"🔍", router:"🏠", credentials:"🔑", encryption:"🔐", access_control:"🚫", other:"📋" };
const CAT_OPTIONS = [
  {value:"wifi", label:"WiFi"}, {value:"network", label:"Network"},
  {value:"router", label:"Router"}, {value:"credentials", label:"Credentials"},
  {value:"encryption", label:"Encryption"}, {value:"access_control", label:"Access control"},
  {value:"other", label:"Other"},
];

// ── Multiline TextArea (matches Input styling) ──
function TextArea({label, value, onChange, placeholder, rows=4, tip, sx={}}){
  const C = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <div style={{marginBottom:10,...sx}}>
      {label && (
        <label style={{display:"flex",alignItems:"center",fontSize:10,color:focused?C.accent:C.textMuted,textTransform:"uppercase",letterSpacing:".14em",marginBottom:5,fontFamily:font,fontWeight:700,transition:"color .15s"}}>
          {label}{tip && <TipIcon tip={tip} color={C.accent}/>}
        </label>
      )}
      <textarea value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows}
        onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
        style={{width:"100%",padding:"9px 13px",background:focused?`${C.accent}07`:C.bgInput,border:`1px solid ${focused?C.accent+"65":C.border}`,borderRadius:4,color:C.text,fontFamily:font,fontSize:13,outline:"none",transition:"all .18s",boxShadow:focused?`0 0 0 3px ${C.accent}14,0 0 16px ${C.accent}10`:"none",resize:"vertical",lineHeight:1.6,boxSizing:"border-box"}}/>
    </div>
  );
}

function SessionsPage() {
  const C = useTheme();
  const {session: activeSession, setSession: setActiveSession} = useActiveSession();
  const {drafts, setDraft} = useDraft();

  const [ss, sSs] = useState([]);
  const [sel, sSel] = useState(null);          // currently opened session detail
  const [rpt, sRpt] = useState(null);
  const [rptModal, setRptModal] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddFinding, setShowAddFinding] = useState(false);
  const [editingFindingId, setEditingFindingId] = useState(null);

  // New session form (drafts persisted across navigation)
  const nm = drafts["new_session_name"] || "";
  const sNm = v => setDraft("new_session_name", v);
  const co = drafts["new_session_company"] || "";
  const sCo = v => setDraft("new_session_company", v);
  const au = drafts["new_session_auditor"] || "";
  const sAu = v => setDraft("new_session_auditor", v);
  const nt = drafts["new_session_notes"] || "";
  const sNt = v => setDraft("new_session_notes", v);
  const [creating, setCreating] = useState(false);

  // Add/Edit finding form (drafts persisted, scoped to session id)
  const sessId = sel?.id || "_none";
  const fc = drafts[`finding_${sessId}_cat`] || "wifi";
  const sFc = v => setDraft(`finding_${sessId}_cat`, v);
  const fs = drafts[`finding_${sessId}_sev`] || "medium";
  const sFs = v => setDraft(`finding_${sessId}_sev`, v);
  const ft = drafts[`finding_${sessId}_title`] || "";
  const sFt = v => setDraft(`finding_${sessId}_title`, v);
  const fd = drafts[`finding_${sessId}_desc`] || "";
  const sFd = v => setDraft(`finding_${sessId}_desc`, v);
  const fe = drafts[`finding_${sessId}_ev`] || "";
  const sFe = v => setDraft(`finding_${sessId}_ev`, v);
  const fr = drafts[`finding_${sessId}_rec`] || "";
  const sFr = v => setDraft(`finding_${sessId}_rec`, v);
  const [addingFinding, setAddingFinding] = useState(false);

  // Finding filter
  const [sevFilter, setSevFilter] = useState("all");

  const ref = async () => { const d = await api("/sessions/"); if(Array.isArray(d)) sSs(d); };
  useEffect(() => { ref(); }, []);

  // Auto-load active session on mount
  useEffect(()=>{
    if(activeSession?.id && !sel){ loadSel(activeSession.id); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[activeSession?.id]);

  const clearFindingDraft = ()=>{
    setDraft(`finding_${sessId}_title`, "");
    setDraft(`finding_${sessId}_desc`, "");
    setDraft(`finding_${sessId}_ev`, "");
    setDraft(`finding_${sessId}_rec`, "");
    setDraft(`finding_${sessId}_cat`, "wifi");
    setDraft(`finding_${sessId}_sev`, "medium");
  };

  const loadSel = async id => {
    const s = await api(`/sessions/${id}`);
    sSel(s);
    sRpt(null);
    setShowAddFinding(false);
    setEditingFindingId(null);
    // Auto-mark as active
    if(s) setActiveSession({id:s.id, name:s.name, company:s.company, auditor:s.auditor});
  };

  const closeDetail = ()=>{ sSel(null); setShowAddFinding(false); setEditingFindingId(null); ref(); };

  const cr = async () => {
    setCreating(true);
    const newSess = await api("/sessions/",{method:"POST",body:JSON.stringify({name:nm,company:co,auditor:au,notes:nt||null})});
    // Clear drafts
    sNm(""); sCo(""); sAu(""); sNt("");
    await ref();
    setCreating(false);
    setShowCreate(false);
    // Auto-open the new session
    if(newSess?.id){ loadSel(newSess.id); }
  };

  const af = async () => {
    if (!sel) return;
    setAddingFinding(true);
    let result;
    if (editingFindingId) {
      // PATCH to update an existing finding
      result = await api(`/sessions/${sel.id}/findings/${editingFindingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          session_id: sel.id,
          category: fc, severity: fs, title: ft,
          description: fd, evidence: fe || null, recommendation: fr || null,
        }),
      });
    } else {
      result = await api(`/sessions/${sel.id}/findings`, {
        method: "POST",
        body: JSON.stringify({
          session_id: sel.id,
          category: fc, severity: fs, title: ft,
          description: fd, evidence: fe || null, recommendation: fr || null,
        }),
      });
    }
    if (result?.error) {
      alert(`Error saving finding: ${result.error}`);
      setAddingFinding(false);
      return;
    }
    clearFindingDraft();
    await loadSel(sel.id);
    setAddingFinding(false);
    setShowAddFinding(false);
    setEditingFindingId(null);
  };

  const startEditFinding = (f) => {
    // f.id may come as f.id or f.finding_id — try both
    const fid = f.id ?? f.finding_id ?? f._id ?? null;
    if (!fid) {
      alert("This finding has no ID — it may have been created with an older backend version that doesn't support editing. Try deleting and re-adding it.");
      return;
    }
    setEditingFindingId(fid);
    // Write directly to drafts so the form picks them up immediately
    setDraft(`finding_${sessId}_cat`,  f.category     || "wifi");
    setDraft(`finding_${sessId}_sev`,  f.severity     || "medium");
    setDraft(`finding_${sessId}_title`, f.title       || "");
    setDraft(`finding_${sessId}_desc`, f.description  || "");
    setDraft(`finding_${sessId}_ev`,   f.evidence     || "");
    setDraft(`finding_${sessId}_rec`,  f.recommendation || "");
    setShowAddFinding(true);
  };

  const cancelEdit = () => {
    setEditingFindingId(null);
    clearFindingDraft();
    setShowAddFinding(false);
  };

  const deleteFinding = async (f) => {
    if (!sel) return;
    // Accept either a finding object or a raw id
    const fid = (typeof f === "object") ? (f.id ?? f.finding_id ?? f._id) : f;
    if (!fid) {
      alert("Cannot delete: finding has no ID. This may be a backend compatibility issue.");
      return;
    }
    if (!confirm(`Delete finding "${(typeof f === "object" ? f.title : fid)}"?`)) return;
    const result = await api(`/sessions/${sel.id}/findings/${fid}`, { method: "DELETE" });
    if (result?.error) {
      alert(`Error deleting finding: ${result.error}`);
      return;
    }
    await loadSel(sel.id);
  };

  const cl = async id => { await api(`/sessions/${id}/close`,{method:"POST"}); ref(); if(sel?.id===id) loadSel(id); };
  const reopen = async id => { await api(`/sessions/${id}/reopen`,{method:"POST"}); ref(); if(sel?.id===id) loadSel(id); };
  const generateReport = async () => { if(!sel) return; const r = await api(`/sessions/${sel.id}/report`); sRpt(r); setRptModal(true); };

  const filteredFindings = sel?.findings?.filter(f => sevFilter==="all" || f.severity===sevFilter) || [];
  const findingCounts = (sel?.findings || []).reduce((acc,f)=>{acc[f.severity]=(acc[f.severity]||0)+1;return acc;},{});

  // ═══════════════════════════════════════════════════════════
  // VIEW: SESSION LIST (when no session is open)
  // ═══════════════════════════════════════════════════════════
  if(!sel){
    return (
      <div className="page-in">
        <PageTitle sub="Audit sessions group all captures, findings, and evidence into a single project">Sessions</PageTitle>

        {/* Header bar */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,gap:12,flexWrap:"wrap"}}>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <div style={{padding:"10px 16px",background:`${C.purple}10`,border:`1px solid ${C.purple}30`,borderRadius:7,display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:18}}>📊</span>
              <div>
                <div style={{fontFamily:fontDisplay,fontSize:18,fontWeight:800,color:C.purple,letterSpacing:".05em",lineHeight:1}}>{ss.length}</div>
                <div style={{fontFamily:font,fontSize:9,color:C.textMuted,letterSpacing:".1em",textTransform:"uppercase",marginTop:3}}>Total sessions</div>
              </div>
            </div>
            {activeSession&&(
              <div style={{padding:"10px 16px",background:`${C.accent}10`,border:`1px solid ${C.accent}30`,borderRadius:7,display:"flex",alignItems:"center",gap:10}}>
                <span style={{width:8,height:8,borderRadius:"50%",background:C.accent,boxShadow:`0 0 8px ${C.accent}`,animation:"pulse 2s infinite"}}/>
                <div>
                  <div style={{fontFamily:font,fontSize:11,fontWeight:600,color:C.text,lineHeight:1}}>{activeSession.name}</div>
                  <div style={{fontFamily:font,fontSize:9,color:C.accent,letterSpacing:".1em",textTransform:"uppercase",marginTop:3,fontWeight:700}}>● Active</div>
                </div>
              </div>
            )}
          </div>

          <Btn onClick={()=>setShowCreate(true)} color={C.accent} lg>+ New Session</Btn>
        </div>

        {/* Create form (collapsed by default) */}
        {showCreate&&(
          <div className="anim-up" style={{marginBottom:18,padding:"18px 22px",background:`linear-gradient(135deg, ${C.accent}10, ${C.bgCard})`,border:`1px solid ${C.accent}40`,borderLeft:`3px solid ${C.accent}`,borderRadius:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontFamily:fontDisplay,fontSize:13,color:C.accent,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase"}}>New Session</div>
              <Btn sm ghost onClick={()=>setShowCreate(false)}>✕ Cancel</Btn>
            </div>
            <Grid cols={3}>
              <Input label="Session name *" value={nm} onChange={sNm} placeholder="ACME Q4 audit"/>
              <Input label="Company / Client *" value={co} onChange={sCo} placeholder="ACME Corp"/>
              <Input label="Auditor" value={au} onChange={sAu} placeholder="Your name"/>
            </Grid>
            <TextArea label="Notes (optional)" value={nt} onChange={sNt} rows={2} placeholder="Scope, contract reference, target site..."/>
            <Btn onClick={cr} disabled={creating||!nm||!co} color={C.accent}>{creating?<><Spinner size={14}/>Creating...</>:"✓ Create session"}</Btn>
          </div>
        )}

        {/* Session list */}
        <Card title={`All sessions (${ss.length})`} color={C.purple}>
          {ss.length===0?(
            <div style={{padding:"40px 20px",textAlign:"center",fontFamily:font,fontSize:13,color:C.textMuted}}>
              <div style={{fontSize:42,marginBottom:14,opacity:.3}}>📋</div>
              <div style={{marginBottom:14}}>No sessions yet. Create your first one to begin auditing.</div>
              <Btn onClick={()=>setShowCreate(true)} color={C.accent}>+ Create first session</Btn>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {ss.map(s=>{
                const isActive = activeSession?.id===s.id;
                const findings = s.findings_count ?? (s.findings?.length || 0);
                return(
                  <div key={s.id} onClick={()=>loadSel(s.id)} style={{
                    padding:"14px 18px",
                    background:isActive?`linear-gradient(90deg, ${C.accent}18, ${C.accent}06)`:C.bgInput,
                    border:`1px solid ${isActive?C.accent+"45":C.border}`,
                    borderLeft:`3px solid ${isActive?C.accent:s.status==="closed"?C.textDim:C.warn}`,
                    borderRadius:7,
                    cursor:"pointer",
                    transition:"all .18s",
                    display:"grid",
                    gridTemplateColumns:"1fr auto",
                    gap:14,alignItems:"center",
                  }} onMouseEnter={e=>{if(!isActive)e.currentTarget.style.borderLeftColor=C.accent+"80";}}
                     onMouseLeave={e=>{if(!isActive)e.currentTarget.style.borderLeftColor=s.status==="closed"?C.textDim:C.warn;}}>
                    <div style={{minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:5,flexWrap:"wrap"}}>
                        <div style={{fontFamily:fontDisplay,fontSize:14,color:C.text,fontWeight:700,letterSpacing:".03em"}}>{s.name}</div>
                        {isActive&&<Badge color={C.accent} sm>● ACTIVE</Badge>}
                        {s.status==="closed"&&<Badge color={C.textDim} sm>CLOSED</Badge>}
                        {s.status==="active"&&!isActive&&<Badge color={C.warn} sm>OPEN</Badge>}
                      </div>
                      <div style={{display:"flex",gap:12,fontFamily:font,fontSize:11,color:C.textMuted,flexWrap:"wrap"}}>
                        <span>🏢 {s.company||"—"}</span>
                        {s.auditor&&<span>👤 {s.auditor}</span>}
                        <span>📅 {(s.created_at||"").split("T")[0]}</span>
                        <span style={{color:findings>0?C.warn:C.textDim}}>📋 {findings} finding{findings!==1?"s":""}</span>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                      <Btn sm ghost color={C.purple}>Open →</Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // VIEW: SESSION DETAIL (when a session is open)
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="page-in">
      {/* Header with close button */}
      <div style={{marginBottom:18,padding:"18px 22px",background:`linear-gradient(135deg, ${C.accent}12, ${C.bgCard})`,border:`1px solid ${C.accent}35`,borderLeft:`3px solid ${C.accent}`,borderRadius:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
              <div style={{fontFamily:fontDisplay,fontSize:22,color:C.accent,fontWeight:800,letterSpacing:".04em",lineHeight:1.1}}>{sel.name}</div>
              {activeSession?.id===sel.id&&<Badge color={C.accent}>● ACTIVE SESSION</Badge>}
              <Badge color={sel.status==="closed"?C.textDim:C.warn}>{sel.status?.toUpperCase()}</Badge>
            </div>
            <div style={{display:"flex",gap:18,fontFamily:font,fontSize:12,color:C.textMuted,flexWrap:"wrap",marginBottom:6}}>
              <span>🏢 <span style={{color:C.text,fontWeight:600}}>{sel.company}</span></span>
              {sel.auditor&&<span>👤 <span style={{color:C.text}}>{sel.auditor}</span></span>}
              <span>📅 <span style={{color:C.text}}>{(sel.created_at||"").split("T")[0]}</span></span>
              <span>📋 <span style={{color:C.warn,fontWeight:700}}>{sel.findings?.length||0}</span> findings</span>
            </div>
            {sel.notes&&<div style={{fontFamily:font,fontSize:11,color:C.textMuted,marginTop:8,padding:"8px 12px",background:C.bgInput,borderRadius:5,fontStyle:"italic",lineHeight:1.6}}>{sel.notes}</div>}
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {activeSession?.id!==sel.id&&<Btn sm onClick={()=>setActiveSession({id:sel.id,name:sel.name,company:sel.company,auditor:sel.auditor})} color={C.accent}>Set as active</Btn>}
            <Btn sm ghost onClick={generateReport} color={C.warn}>📊 Report</Btn>
            {sel.status==="active"?(
              <Btn sm ghost onClick={()=>cl(sel.id)} color={C.danger}>🔒 Close session</Btn>
            ):(
              <Btn sm ghost onClick={()=>reopen(sel.id)} color={C.warn}>🔓 Reopen</Btn>
            )}
            <Btn sm onClick={closeDetail} color={C.purple}>✕ Back to list</Btn>
          </div>
        </div>
      </div>

      {/* Severity counts */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5, 1fr)",gap:8,marginBottom:14}}>
        {["critical","high","medium","low","info"].map(sev=>{
          const meta = SEV_META[sev];
          const count = findingCounts[sev]||0;
          const sel2 = sevFilter===sev;
          return(
            <div key={sev} onClick={()=>setSevFilter(sel2?"all":sev)} style={{
              padding:"10px 12px",borderRadius:7,cursor:"pointer",
              background:sel2?`${meta.color}15`:C.bgInput,
              border:`1px solid ${sel2?meta.color+"50":C.border}`,
              borderLeft:`3px solid ${meta.color}`,
              transition:"all .15s",
            }}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                <span style={{fontSize:11}}>{meta.icon}</span>
                <span style={{fontFamily:fontDisplay,fontSize:9,color:meta.color,letterSpacing:".1em",fontWeight:700,textTransform:"uppercase"}}>{meta.label}</span>
              </div>
              <div style={{fontFamily:fontDisplay,fontSize:18,color:count>0?meta.color:C.textDim,fontWeight:800,letterSpacing:".04em"}}>{count}</div>
            </div>
          );
        })}
      </div>
      {sevFilter!=="all"&&<div style={{fontFamily:font,fontSize:11,color:C.textMuted,marginBottom:10}}>Filtering by <span style={{color:SEV_META[sevFilter].color,fontWeight:700}}>{SEV_META[sevFilter].label}</span> · <span onClick={()=>setSevFilter("all")} style={{color:C.accent,cursor:"pointer",textDecoration:"underline"}}>clear</span></div>}

      {/* Findings list + Add/Edit panel */}
      <div style={{display:"grid",gridTemplateColumns:showAddFinding?"3fr 2fr":"1fr",gap:14}}>
        {/* Findings list */}
        <Card title={`Findings (${filteredFindings.length}${filteredFindings.length!==(sel.findings?.length||0)?` of ${sel.findings?.length||0}`:""})`} color={C.warn} accent>
          <div style={{marginBottom:10}}>
            {!showAddFinding&&<Btn onClick={()=>{setEditingFindingId(null);clearFindingDraft();setShowAddFinding(true);}} color={C.accent} sm>+ Add finding</Btn>}
          </div>

          {filteredFindings.length===0?(
            <div style={{padding:"30px 20px",textAlign:"center",fontFamily:font,fontSize:12,color:C.textMuted}}>
              <div style={{fontSize:32,marginBottom:8,opacity:.3}}>📝</div>
              {sel.findings?.length===0?"No findings yet. Add the first one as you discover issues.":"No findings match this filter."}
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {filteredFindings.map(f=>{
                const meta = SEV_META[f.severity]||SEV_META.medium;
                return(
                  <div key={f.id??f.finding_id??f._id??f.title} style={{padding:"12px 14px",background:C.bgInput,borderRadius:6,borderLeft:`3px solid ${meta.color}`,border:`1px solid ${C.border}`,fontFamily:font,fontSize:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:6,flexWrap:"wrap"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0,flexWrap:"wrap"}}>
                        <span style={{fontSize:14}}>{meta.icon}</span>
                        <span style={{padding:"1px 7px",background:`${meta.color}18`,borderRadius:3,fontSize:9,fontFamily:fontDisplay,color:meta.color,letterSpacing:".1em",fontWeight:700}}>{meta.label.toUpperCase()}</span>
                        <span style={{fontSize:11,color:C.textMuted}}>{CAT_ICONS[f.category]||"📋"} {f.category}</span>
                        {!(f.id??f.finding_id??f._id)&&<span style={{fontSize:9,color:C.warn,background:`${C.warn}15`,padding:"1px 6px",borderRadius:3,fontFamily:font}}>⚠ no id — edit/delete unavailable</span>}
                      </div>
                      <div style={{display:"flex",gap:4}}>
                        <Btn sm ghost color={C.info} onClick={()=>startEditFinding(f)}>✎ Edit</Btn>
                        <Btn sm ghost color={C.danger} onClick={()=>deleteFinding(f)}>🗑 Delete</Btn>
                      </div>
                    </div>
                    <div style={{fontFamily:fontDisplay,fontSize:13,color:C.text,fontWeight:700,marginBottom:6}}>{f.title}</div>
                    {f.description&&<div style={{fontFamily:font,fontSize:11.5,color:C.textMuted,lineHeight:1.7,whiteSpace:"pre-wrap",marginBottom:6}}>{f.description}</div>}
                    {f.evidence&&<div style={{fontFamily:"monospace",fontSize:10.5,color:C.info,padding:"6px 10px",background:`${C.info}08`,borderRadius:4,borderLeft:`2px solid ${C.info}40`,marginBottom:6,wordBreak:"break-word",whiteSpace:"pre-wrap"}}>📎 {f.evidence}</div>}
                    {f.recommendation&&<div style={{fontFamily:font,fontSize:11,color:C.accent,padding:"6px 10px",background:`${C.accent}08`,borderRadius:4,borderLeft:`2px solid ${C.accent}40`,whiteSpace:"pre-wrap"}}>💡 {f.recommendation}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Add/Edit finding panel (right side) */}
        {showAddFinding&&(
          <Card title={editingFindingId?"✎ Edit finding":"+ Add finding"} color={editingFindingId?C.info:C.accent} accent>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <div>
                <label style={{display:"block",fontSize:10,color:C.textMuted,textTransform:"uppercase",letterSpacing:".14em",marginBottom:5,fontFamily:font,fontWeight:700}}>Severity</label>
                <select value={fs} onChange={e=>sFs(e.target.value)} style={{width:"100%",padding:"9px 13px",background:C.bgInput,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontFamily:font,fontSize:13,outline:"none",cursor:"pointer"}}>
                  {Object.entries(SEV_META).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{display:"block",fontSize:10,color:C.textMuted,textTransform:"uppercase",letterSpacing:".14em",marginBottom:5,fontFamily:font,fontWeight:700}}>Category</label>
                <select value={fc} onChange={e=>sFc(e.target.value)} style={{width:"100%",padding:"9px 13px",background:C.bgInput,border:`1px solid ${C.border}`,borderRadius:4,color:C.text,fontFamily:font,fontSize:13,outline:"none",cursor:"pointer"}}>
                  {CAT_OPTIONS.map(o=><option key={o.value} value={o.value}>{CAT_ICONS[o.value]} {o.label}</option>)}
                </select>
              </div>
            </div>
            <Input label="Title *" value={ft} onChange={sFt} placeholder="Concise issue title"/>
            <TextArea label="Description *" value={fd} onChange={sFd} rows={6} placeholder="Detailed technical description of the finding. Include specific evidence: BSSIDs, IPs, hash samples, etc."/>
            <TextArea label="Evidence" value={fe} onChange={sFe} rows={3} placeholder="Capture file paths, hash strings, command output, screenshots references..."/>
            <TextArea label="Recommendation" value={fr} onChange={sFr} rows={5} placeholder="Specific remediation steps. Reference industry standards (NIST, OWASP, vendor guidance)."/>
            <div style={{display:"flex",gap:6,marginTop:8}}>
              <Btn onClick={af} disabled={addingFinding||!ft||!fd} color={editingFindingId?C.info:C.accent}>
                {addingFinding?<><Spinner size={14}/>{editingFindingId?"Saving...":"Adding..."}</>:editingFindingId?"✓ Save changes":"✓ Add finding"}
              </Btn>
              <Btn ghost onClick={cancelEdit} color={C.danger}>✕ Cancel</Btn>
            </div>
            {(ft||fd||fe||fr)&&!editingFindingId&&(
              <div style={{marginTop:10,padding:"6px 10px",background:`${C.warn}08`,borderRadius:4,fontFamily:font,fontSize:10,color:C.warn,fontStyle:"italic"}}>
                💾 Draft auto-saved — your text persists if you navigate away.
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Report modal */}
      {rptModal&&rpt&&(
        <Modal open={rptModal} onClose={()=>setRptModal(false)} title={`📊 Report: ${sel.name}`}>
          <div style={{maxHeight:"60vh",overflowY:"auto",padding:6,fontFamily:font,fontSize:12,lineHeight:1.7,color:C.text}}>
            <pre style={{whiteSpace:"pre-wrap",wordBreak:"break-word",fontFamily:"monospace",fontSize:11,color:C.textMuted,background:C.bgInput,padding:14,borderRadius:5}}>{JSON.stringify(rpt,null,2)}</pre>
          </div>
          <Btn onClick={()=>setRptModal(false)} sx={{width:"100%",marginTop:8}}>Close Report</Btn>
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
  const [ps,sPs]=useState([]);
  const [ld,sLd]=useState(false);
  const [hovered,setHovered]=useState(null);

  const ref=async()=>{sLd(true);const d=await api("/system/processes");if(Array.isArray(d))sPs(d);sLd(false);};
  useEffect(()=>{ref();const i=setInterval(ref,5000);return()=>clearInterval(i);},[]);
  const kill=async id=>{await api(`/system/processes/${id}/cancel`,{method:"POST"});ref();};

  return (
    <div className="page-in">
      <PageTitle sub="Monitor and manage all background processes — airodump, nmap, hostapd, mitmproxy">Processes</PageTitle>

      <Row gap={12} sx={{marginBottom:16}} wrap>
        <Stat label="Total" value={ps.length} color={C.info} icon="▣"/>
        <Stat label="Running" value={ps.filter(p=>p.status==="running").length} color={C.accent} icon="▶"/>
        <Stat label="Completed" value={ps.filter(p=>p.status==="completed").length} color={C.info} icon="✓"/>
        <Stat label="Failed" value={ps.filter(p=>p.status==="failed").length} color={C.danger} icon="✗"/>
        <Btn sm ghost onClick={ref} disabled={ld} color={C.purple} sx={{marginLeft:"auto"}}>{ld?<><Spinner size={12}/>Loading...</>:"↺ Refresh"}</Btn>
      </Row>

      <Card title={`Managed Processes (${ps.length})`} color={C.info} accent>
        {ps.length===0?(
          <div style={{padding:"40px 20px",textAlign:"center",fontFamily:font,fontSize:12,color:C.textMuted}}>
            <div style={{fontSize:32,marginBottom:8,opacity:.3}}>▣</div>
            No background processes are currently being tracked.
          </div>
        ):(
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontFamily:font,fontSize:11,tableLayout:"fixed"}}>
              <colgroup>
                <col style={{width:50}}/>
                <col style={{width:90}}/>
                <col style={{width:"auto"}}/>
                <col style={{width:80}}/>
                <col style={{width:90}}/>
                <col style={{width:80}}/>
              </colgroup>
              <thead>
                <tr style={{background:`${C.info}06`}}>
                  {["ID","Status","Command","RC","Started","Actions"].map(h=>(
                    <th key={h} style={{textAlign:"left",padding:"9px 10px",color:C.info,fontSize:9,textTransform:"uppercase",letterSpacing:".12em",fontFamily:fontDisplay,fontWeight:700,borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ps.map((p,i)=>{
                  const isHovered = hovered === p.id;
                  const statusColor = p.status==="running"?C.accent:p.status==="completed"?C.info:p.status==="failed"?C.danger:C.textMuted;
                  return(
                    <tr key={p.id} onMouseEnter={()=>setHovered(p.id)} onMouseLeave={()=>setHovered(null)} style={{borderBottom:`1px solid ${C.border}40`,transition:"background .12s",background:isHovered?C.bgHover:"transparent",position:"relative"}}>
                      <td style={{padding:"7px 10px",color:C.accent,fontFamily:"monospace",fontSize:10,fontWeight:700}}>{p.id}</td>
                      <td style={{padding:"7px 10px",whiteSpace:"nowrap"}}>
                        <span style={{padding:"2px 8px",borderRadius:3,fontSize:9,fontFamily:fontDisplay,letterSpacing:".08em",fontWeight:700,background:`${statusColor}15`,color:statusColor,border:`1px solid ${statusColor}40`,textTransform:"uppercase",display:"inline-flex",alignItems:"center",gap:5}}>
                          {p.status==="running"&&<span style={{width:5,height:5,borderRadius:"50%",background:statusColor,boxShadow:`0 0 6px ${statusColor}`,animation:"pulse 1.5s infinite"}}/>}
                          {p.status}
                        </span>
                      </td>
                      <td style={{padding:"7px 10px",position:"relative"}}>
                        <div style={{
                          color:C.text,fontFamily:"monospace",fontSize:10.5,
                          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                          maxWidth:"100%",cursor:"help",
                        }} title={p.command}>
                          {p.command}
                        </div>
                        {/* Tooltip on hover with full command */}
                        {isHovered&&p.command&&p.command.length>60&&(
                          <div style={{
                            position:"absolute",top:"100%",left:10,marginTop:4,zIndex:50,
                            padding:"10px 14px",background:C.bgCard,border:`1px solid ${C.accent}45`,borderRadius:6,
                            fontFamily:"monospace",fontSize:11,color:C.text,
                            maxWidth:600,wordBreak:"break-all",whiteSpace:"pre-wrap",
                            boxShadow:`0 8px 24px rgba(0,0,0,.5), 0 0 20px ${C.accent}20`,
                            pointerEvents:"none",lineHeight:1.6,
                          }}>
                            <div style={{fontFamily:fontDisplay,fontSize:9,color:C.accent,letterSpacing:".12em",fontWeight:700,marginBottom:6,textTransform:"uppercase"}}>Full Command</div>
                            {p.command}
                          </div>
                        )}
                      </td>
                      <td style={{padding:"7px 10px",color:p.return_code===0?C.accent:p.return_code===null?C.textMuted:C.danger,fontFamily:"monospace",fontSize:10,fontWeight:700}}>
                        {p.return_code!==null&&p.return_code!==undefined?p.return_code:"—"}
                      </td>
                      <td style={{padding:"7px 10px",color:C.textMuted,whiteSpace:"nowrap",fontSize:10}}>
                        {p.started_at?new Date(p.started_at).toLocaleTimeString():"—"}
                      </td>
                      <td style={{padding:"7px 10px",whiteSpace:"nowrap"}}>
                        {p.status==="running"&&<Btn sm danger onClick={()=>kill(p.id)}>Kill</Btn>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════
// PAGE: HELP — Comprehensive documentation
// ═══════════════════════════════════════════
function HelpPage() {
  const C = useTheme();
  const [open,setOpen] = useState(null);
  const tog = id => setOpen(open === id ? null : id);

  const A = ({children}) => <span style={{color:C.accent,fontWeight:700}}>{children}</span>;
  const W = ({children}) => <span style={{color:C.warn,fontWeight:700}}>{children}</span>;
  const D = ({children}) => <span style={{color:"#ff2055",fontWeight:700}}>{children}</span>;
  const I = ({children}) => <span style={{color:C.info,fontWeight:700}}>{children}</span>;
  const B = ({children}) => <strong style={{color:C.text,fontWeight:700}}>{children}</strong>;

  const P = ({children,sx={}}) => <p style={{color:C.textMuted,fontSize:12.5,lineHeight:1.95,margin:"8px 0",fontFamily:font,...sx}}>{children}</p>;
  const Cd = ({children}) => <code style={{background:C.bgInput,padding:"2px 7px",borderRadius:3,fontSize:11,fontFamily:"monospace",color:C.accent,border:`1px solid ${C.border}`}}>{children}</code>;

  const H = ({children,color}) => <div style={{fontFamily:fontDisplay,fontSize:13,color:color||C.accent,textTransform:"uppercase",letterSpacing:".14em",marginTop:20,marginBottom:8,paddingBottom:6,borderBottom:`1px solid ${color||C.accent}30`,display:"flex",alignItems:"center",gap:8}}>{children}</div>;
  const H2 = ({children,color}) => <div style={{fontFamily:fontDisplay,fontSize:11,color:color||C.info,textTransform:"uppercase",letterSpacing:".1em",marginTop:12,marginBottom:5,fontWeight:700}}>{children}</div>;

  const Li = ({label,children}) => <div style={{display:"flex",gap:10,padding:"5px 0",fontFamily:font,fontSize:12.5}}><span style={{color:C.accent,minWidth:8,fontSize:14}}>▸</span><div style={{color:C.textMuted,lineHeight:1.8}}>{label && <span style={{color:C.text,fontWeight:700}}>{label}: </span>}{children}</div></div>;

  const Step = ({n,title,desc}) => <div style={{display:"flex",gap:11,alignItems:"flex-start",padding:"7px 0",fontFamily:font,fontSize:12.5}}><span style={{background:`${C.accent}18`,color:C.accent,border:`1px solid ${C.accent}50`,borderRadius:4,padding:"2px 9px",fontSize:10,fontWeight:700,flexShrink:0,minWidth:32,textAlign:"center",fontFamily:fontDisplay}}>{n}</span><div style={{lineHeight:1.75}}><span style={{color:C.text,fontWeight:700}}>{title}</span><span style={{color:C.textMuted}}> — {desc}</span></div></div>;

  // Tool card — for explaining individual tools
  const Tool = ({name,desc,flags}) => (
    <div style={{padding:"12px 16px",background:C.bgInput,borderRadius:5,border:`1px solid ${C.border}`,marginBottom:8}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
        <code style={{fontFamily:"monospace",fontSize:13,color:C.accent,fontWeight:700,background:`${C.accent}12`,padding:"2px 8px",borderRadius:3,border:`1px solid ${C.accent}30`}}>{name}</code>
      </div>
      <div style={{fontFamily:font,fontSize:12,color:C.textMuted,lineHeight:1.7,marginBottom:flags?8:0}}>{desc}</div>
      {flags && (
        <div style={{display:"flex",flexDirection:"column",gap:3,marginTop:6,padding:"8px 10px",background:C.bgCard,borderRadius:3,borderLeft:`2px solid ${C.info}`}}>
          {flags.map(([f,d],i)=>(
            <div key={i} style={{fontFamily:font,fontSize:11,lineHeight:1.6,display:"flex",gap:8}}>
              <code style={{fontFamily:"monospace",fontSize:10,color:C.info,flexShrink:0,minWidth:110}}>{f}</code>
              <span style={{color:C.textMuted}}>{d}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Alert box
  const Box = ({type="info",title,children}) => {
    const colors = {info:C.info,warn:C.warn,danger:"#ff2055",success:C.accent};
    const icons = {info:"ℹ️",warn:"⚠️",danger:"🚨",success:"✓"};
    const col = colors[type];
    return (
      <div style={{padding:"12px 16px",background:`${col}08`,border:`1px solid ${col}30`,borderLeft:`3px solid ${col}`,borderRadius:5,margin:"10px 0"}}>
        <div style={{color:col,fontFamily:fontDisplay,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:4,display:"flex",alignItems:"center",gap:6}}>
          <span>{icons[type]}</span>{title}
        </div>
        <div style={{color:C.textMuted,fontFamily:font,fontSize:12.5,lineHeight:1.8}}>{children}</div>
      </div>
    );
  };

  // Requirements box
  const Reqs = ({items}) => (
    <div style={{padding:"12px 14px",background:`${C.warn}06`,border:`1px solid ${C.warn}25`,borderRadius:5,margin:"10px 0"}}>
      <div style={{color:C.warn,fontFamily:fontDisplay,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:6}}>📋 Requirements</div>
      {items.map((x,i)=><div key={i} style={{fontFamily:font,fontSize:12,color:C.textMuted,padding:"3px 0",lineHeight:1.6}}>• {x}</div>)}
    </div>
  );

  const secs = [

    // ════════════════════════════════════════════
    // OVERVIEW
    // ════════════════════════════════════════════
    {id:"overview",title:"📖  What is WFAudit?",c:()=>(<div>
      <P>
        WFAudit is a <B>professional WiFi security auditing platform</B> designed for penetration testers and red team operators conducting authorized wireless network assessments. It orchestrates a comprehensive suite of industry-standard offensive security tools through a unified REST API backend and a React-based web interface.
      </P>
      <P>
        Rather than requiring you to memorize dozens of disparate command-line invocations for tools like <Cd>aircrack-ng</Cd>, <Cd>hcxdumptool</Cd>, <Cd>hashcat</Cd>, <Cd>hostapd</Cd>, <Cd>arpspoof</Cd>, or <Cd>mitmproxy</Cd>, WFAudit presents them through intuitive panels with guided workflows, real-time visualizations, and automatic state management. Everything is orchestrated through <A>62 endpoints</A> organized into <A>11 functional modules</A>.
      </P>

      <H>What You Can Do</H>
      <Li label="Reconnaissance"><A>Scan 2.4 GHz, 5 GHz, or dual-band</A> simultaneously; enumerate APs with security type, encryption, channel, signal strength, connected clients, and PMKID availability; analyze Preferred Network Lists (PNL) from probe requests.</Li>
      <Li label="WPA/WPA2 attacks"><A>Capture handshakes</A> with targeted or broadcast deauth; <A>PMKID clientless attacks</A> that work without connected clients; AP-less honeypot attacks for targets outside their home network.</Li>
      <Li label="Enterprise attacks"><A>Rogue RADIUS servers</A> with Evil Twin Enterprise to capture <B>PEAP/EAP-TTLS credentials</B> from 802.1X networks.</Li>
      <Li label="WPA3 attacks"><A>Detect transition-mode weaknesses</A>, exploit WPA2/WPA3 downgrades, and perform SAE denial-of-service attacks.</Li>
      <Li label="Network-layer attacks"><A>Evil Twin APs</A> with integrated deauth and automatic built-in MITM traffic monitoring; <A>ARP spoofing MITM</A> with both <B>stealth mode</B> (invisible to target) and <B>full interception</B> modes.</Li>
      <Li label="Post-access recon"><A>nmap integration</A> with 8 scanning profiles including vulnerability scanning, OS detection, and service enumeration.</Li>
      <Li label="Reporting"><A>Session-based audit tracking</A> with findings categorized by severity (critical/high/medium/low/info), complete capture file management, and structured JSON report export.</Li>

      <H>System Architecture</H>
      <P>
        WFAudit uses a <B>three-layer architecture</B>: a FastAPI-based backend (Python 3.11+) that exposes the REST API and orchestrates subprocesses, a service layer containing business logic and attack orchestration, and a utility layer with parsers, OUI lookups, and process management. The frontend is a single-file React application that communicates with the backend via HTTP/JSON.
      </P>
      <P>
        All long-running operations (scans, captures, cracks, attacks) execute as <B>async subprocesses</B> with proper cancellation, timeout management, and cleanup. The system is designed to handle multiple concurrent operations without blocking the API.
      </P>

      <Box type="danger" title="⚖️  Legal Notice">
        This platform is intended <B>exclusively for authorized security audits</B> under a signed written contract. Unauthorized WiFi network attacks are illegal in virtually all jurisdictions worldwide (in Spain: Articles 197 and 264 of the Penal Code; in the EU: Directive 2013/40/EU; in the USA: Computer Fraud and Abuse Act, 18 U.S.C. §1030). Always obtain explicit written authorization from the network owner before testing, clearly document the scope and timeframe, and retain proof of authorization. <B>You are solely responsible for legal compliance.</B>
      </Box>
    </div>)},

    // ════════════════════════════════════════════
    // WORKFLOW
    // ════════════════════════════════════════════
    {id:"workflow",title:"🗺  Recommended Audit Workflow",c:()=>(<div>
      <P>
        A well-executed WiFi audit follows a structured progression from reconnaissance to exploitation to post-access analysis. This workflow maximizes information gathered while minimizing detection risk and avoiding irreversible actions during early phases.
      </P>

      <H>Phase 1 — Preparation & Verification</H>
      <Step n="1" title="System health check" desc="Dashboard → verify backend is running as root, all tools are installed (preflight check). Any missing dependencies should be resolved before proceeding." />
      <Step n="2" title="Create audit session" desc="Sessions panel → New Session. Document the client, scope, authorized assets, and timeframe. All findings will be linked to this session for the final report." />
      <Step n="3" title="Adapter preparation" desc="Interfaces panel → identify your WiFi cards, verify monitor-mode capability, create monitor interface (airmon-ng start wlan0 → wlan0mon). Optionally randomize MAC for anonymity." />

      <H>Phase 2 — Passive Reconnaissance</H>
      <Step n="4" title="Dual-band wireless scan" desc="WiFi Scan panel → 60-120 second scan in 'abg' mode captures both 2.4 GHz and 5 GHz networks simultaneously. Don't limit to 2.4 GHz — you'll miss corporate networks." />
      <Step n="5" title="Analyze Preferred Network List" desc="After scan completes, check the PNL analysis to see what networks each client device is searching for. These probe requests reveal travel patterns, home networks, and Evil Twin opportunities." />
      <Step n="6" title="Target prioritization" desc="Review scan results. Prioritize: open networks (trivial), WEP (critical + trivial), WPS-enabled APs, networks with PMKID available, enterprise (WPA2-Enterprise) for potential credential harvesting." />

      <H>Phase 3 — Credential Extraction</H>
      <Step n="7" title="PMKID attempt first" desc="Advanced → PMKID. Try this first for any WPA2 target — it's fast (30-60s), clientless, and silent. ~70-80% of modern APs are vulnerable." />
      <Step n="8" title="Handshake capture fallback" desc="If PMKID fails, go to Handshake panel with active clients. Use targeted deauth (not broadcast — less noisy and more effective)." />
      <Step n="9" title="Offline cracking" desc="Once you have the hash, crack it with hashcat (mode 22000) using appropriate wordlists. Start with rockyou.txt, escalate to larger dictionaries only if needed." />

      <H>Phase 4 — Network-Layer Attacks</H>
      <Step n="10" title="Evil Twin if credentials not obtained" desc="Attacks panel → Evil Twin tab. Clone an attractive network, deauth the legitimate AP to force clients over. Built-in MITM monitor captures all traffic automatically." />
      <Step n="11" title="Enterprise credential harvesting" desc="If WPA2-Enterprise is in scope, Advanced → Enterprise launches a Rogue RADIUS with Evil Twin to capture PEAP/EAP-TTLS credentials (crackable with hashcat mode 5500)." />
      <Step n="12" title="Post-access MITM" desc="Once connected to the target network (via cracked password or Evil Twin), Attacks → MITM tab. Use STEALTH mode for invisible monitoring of a specific user." />

      <H>Phase 5 — Internal Reconnaissance</H>
      <Step n="13" title="Network discovery" desc="Recon panel → nmap quick scan to identify all live hosts, then service scan on interesting hosts. Don't do full scans on /24 networks unless specifically in scope." />
      <Step n="14" title="Router/gateway audit" desc="Recon → Router Probe. Check for default credentials, known CVEs for the router model, admin interfaces exposed on LAN." />

      <H>Phase 6 — Documentation & Cleanup</H>
      <Step n="15" title="Finding registration" desc="For each issue discovered, Sessions → Add Finding with severity, description, evidence (screenshots, capture files), and recommendation. Do this in real time — don't rely on memory." />
      <Step n="16" title="Stop all attacks, restore state" desc="Attacks → Stop ALL. This cleans iptables, restores ARP caches, kills all subprocesses. Critical before disconnecting." />
      <Step n="17" title="Return adapters to managed mode" desc="Interfaces → Managed mode for all monitor interfaces. Failure to do this leaves your system in an altered state until reboot." />
      <Step n="18" title="Export session report" desc="Sessions → Export JSON. Save everything: findings, captures, session metadata. Keep for contractual and legal reasons." />

      <Box type="info" title="Timing Guidance">
        A typical small business WiFi audit (1-3 APs, single building) takes <B>4-8 hours</B>. A full corporate audit with multiple sites, enterprise networks, and extensive post-access testing can take <B>3-5 days</B> or more. Always allocate 25-30% of the time budget for documentation and reporting.
      </Box>
    </div>)},

    // ════════════════════════════════════════════
    // DASHBOARD
    // ════════════════════════════════════════════
    {id:"dashboard",title:"◉  Dashboard Panel",c:()=>(<div>
      <P>
        The Dashboard is the <B>first screen you see</B> when opening WFAudit and serves as the central health indicator for the entire platform. It provides a quick summary of system status, verifies that all required dependencies are installed and functional, and surfaces any issues that would prevent attacks from working correctly.
      </P>

      <H>What It Displays</H>
      <Li label="Hero Status Section">Large visual indicator (✓ or ⚠) showing whether the system is ready for auditing. Green means all required tools are installed and the backend is running as root. Red means something critical is missing.</Li>
      <Li label="Status Card">Backend connectivity indicator. Shows the API endpoint being used and whether responses are being received.</Li>
      <Li label="Root Card">Confirms that the backend process is running with root privileges. <B>This is non-negotiable</B> — raw socket operations, iptables modifications, and monitor-mode interface manipulation all require root. If this shows red, you cannot proceed.</Li>
      <Li label="Tools Card">Count of required vs. detected tools on the system. Clicking reveals the full breakdown.</Li>
      <Li label="Distro Card">Identifies the Linux distribution (Kali / Parrot / Debian / Ubuntu / Arch / Fedora). The installation script uses this to know which package manager to use.</Li>
      <Li label="Tool Inventory Grid">Comprehensive list of all auditing tools with installation status (green = installed, red = missing), version when available, and full path.</Li>

      <H>Tools Checked</H>
      <H2>Critical — required for core functionality</H2>
      <Tool name="aircrack-ng" desc="Foundational suite for WPA/WEP attacks. Provides airodump-ng (scanner/sniffer), aireplay-ng (packet injector), airmon-ng (monitor-mode management), and aircrack-ng itself (dictionary attack engine)." />
      <Tool name="hcxdumptool" desc="Modern replacement for airodump-ng specifically designed for PMKID capture. Faster and more efficient at targeting specific APs. Required for PMKID attacks." />
      <Tool name="hcxtools" desc="Provides hcxpcapngtool which converts .pcapng files produced by hcxdumptool into the .22000 format that hashcat requires. Without this you can't crack captured PMKIDs." />
      <Tool name="hashcat" desc="GPU-accelerated hash cracking engine. Supports 300+ hash types. Typical speeds: 500,000-5,000,000 WPA password attempts per second on a modern GPU, versus 500-5,000 per second on CPU." />
      <Tool name="nmap" desc="The industry-standard network mapper. Used for port scanning, service version detection, OS fingerprinting, and vulnerability checks via NSE scripts." />
      <Tool name="hostapd" desc="User-space daemon that converts a WiFi adapter into a fully functional Access Point. Used for Evil Twin, AP-less honeypot, and WPA3 attacks. Supports virtually all AP modes and authentication types." />
      <Tool name="dnsmasq" desc="Lightweight DHCP/DNS server. Paired with hostapd in Evil Twin to assign IP addresses to connected clients and resolve DNS queries (or redirect them in captive portal mode)." />

      <H2>Attack-specific — required for certain modules</H2>
      <Tool name="mitmproxy / mitmdump" desc="Transparent HTTP/HTTPS proxy with Python scripting. Used in the MITM module to intercept, decrypt (with CA cert), modify, and log web traffic in real time." />
      <Tool name="tshark" desc="Command-line version of Wireshark. Used in MITM stealth mode to passively extract DNS queries and TLS SNI information from live traffic without breaking HTTPS." />
      <Tool name="dsniff (arpspoof)" desc="Provides arpspoof, the tool that sends gratuitous ARP replies to poison the ARP cache of target devices and their gateway, redirecting traffic through the attacker." />
      <Tool name="freeradius" desc="Full-featured RADIUS server. Used in WPA2-Enterprise attacks to accept EAP authentication attempts from victims and log the resulting hashes for offline cracking." />
      <Tool name="macchanger" desc="Utility to modify the MAC address of a network interface. Used for anonymization before attacks." />

      <H>Using This Panel</H>
      <Step n="1" title="Verify readiness" desc="If Status + Root + Tools are all green, you can start operating immediately. If any is red, address it first." />
      <Step n="2" title="Install missing tools" desc="If the tool inventory shows missing items, run the install script: sudo ./wfaudit install (detects your distro and installs everything automatically) OR install manually with apt/pacman/dnf." />
      <Step n="3" title="Troubleshoot permissions" desc="Red 'Root' card means the backend is not running as root. Stop it and restart with: sudo uvicorn app.main:app --host 0.0.0.0 --port 8000 OR use the ./wfaudit start command." />

      <Reqs items={[
        "Backend process running as root (euid == 0)",
        "At least one WiFi interface connected to the system",
        "All critical tools installed (aircrack-ng suite, hcxdumptool, hcxtools, hashcat, nmap, hostapd)",
      ]} />
    </div>)},

    // ════════════════════════════════════════════
    // INTERFACES
    // ════════════════════════════════════════════
    {id:"interfaces",title:"⚡  Interfaces Panel",c:()=>(<div>
      <P>
        The Interfaces panel manages the <B>wireless network adapters</B> attached to your system. Every WiFi attack requires your adapter to be in the correct mode (monitor or managed), operating on the correct channel, and often with a specific MAC address to avoid detection or bypass filters. This panel centralizes all of those concerns.
      </P>

      <H>What It Shows</H>
      <Li label="Interface Name">The Linux kernel name (e.g., <Cd>wlan0</Cd>, <Cd>wlan1</Cd>, <Cd>wlan0mon</Cd>). Adapters typically get sequential numbers based on connection order.</Li>
      <Li label="MAC Address">The current hardware or spoofed MAC address. This is what the adapter broadcasts.</Li>
      <Li label="Mode">Either <A>managed</A> (normal client mode, receives only packets addressed to this interface) or <A>monitor</A> (promiscuous wireless mode, sees all 802.11 frames in range).</Li>
      <Li label="Driver & Chipset">Linux kernel driver (ath9k_htc, rtl8812au, mt76, etc.) and the underlying hardware chipset. Chipset determines capabilities — some drivers support monitor mode but not injection, for example.</Li>
      <Li label="Supported Bands">Which frequency bands the adapter can operate in (2.4 GHz, 5 GHz, or both). Critical for scanning the correct spectrum.</Li>
      <Li label="Supported Channels">Every channel the adapter can tune to. In 2.4 GHz this is typically 1-13 (1-14 in Japan). In 5 GHz it can range from 36 to 165 depending on regulatory domain.</Li>
      <Li label="Capability Badges">Quick indicators for monitor-mode support, packet injection support, AP mode support, and mesh/P2P capabilities.</Li>
      <Li label="Current Channel & Power">Live status of what channel the interface is tuned to and its transmit power in dBm.</Li>

      <H>Operations Available</H>
      <Tool name="Monitor Mode Toggle"
        desc="Creates a monitor-mode virtual interface from a managed interface, or destroys it to return to normal operation. In monitor mode, the adapter captures all 802.11 frames in range (beacons, probe requests/responses, data frames, management frames), bypassing normal WiFi driver filtering."
        flags={[
          ["airmon-ng start","Creates wlan0mon from wlan0, which becomes the monitor interface used by airodump-ng, aireplay-ng, hcxdumptool"],
          ["airmon-ng check kill","Kills NetworkManager/wpa_supplicant processes that would otherwise interfere with monitor mode"],
          ["iw dev wlan0 set type monitor","Alternative method that doesn't require airmon-ng"],
        ]} />
      <Tool name="Channel Selection"
        desc="Locks the interface to a specific 2.4 GHz (1-13) or 5 GHz (36+) channel. During capture, your adapter only sees frames on this channel. Channel hopping (automatic) scans many channels but misses transient frames; channel locking (manual) focuses on one channel for exhaustive capture."
        flags={[
          ["iw dev wlan0mon set channel <N>","Direct kernel API method"],
          ["iwconfig wlan0mon channel <N>","Legacy method, still supported"],
        ]} />
      <Tool name="MAC Address Change"
        desc="Modifies the interface's MAC address. Useful for: anonymization, bypassing MAC filters, or impersonating specific devices. Works by bringing the interface down, changing the MAC, and bringing it back up. You can set a specific MAC or randomize."
        flags={[
          ["macchanger -A <iface>","Random MAC from the same kernel-recognized vendor (preserves OUI)"],
          ["macchanger -r <iface>","Completely random MAC (random OUI — may be suspicious)"],
          ["macchanger -m <MAC> <iface>","Set a specific MAC address"],
          ["macchanger -p <iface>","Restore to permanent (hardware) MAC"],
        ]} />

      <H>Recommended Chipsets for Auditing</H>
      <P>
        Not all WiFi adapters support the capabilities needed for offensive security work. The most important requirements are: <B>monitor mode</B>, <B>packet injection</B>, and preferably <B>AP mode</B>. Many consumer adapters only support connection as a client.
      </P>
      <Li label="Atheros AR9271"><A>Gold standard</A> for 2.4 GHz work. Native Linux driver (ath9k_htc) with excellent injection support. Used in Alfa AWUS036NHA, TP-Link TL-WN722N v1.</Li>
      <Li label="Realtek RTL8812AU">Dual-band (2.4 + 5 GHz), excellent injection. Used in Alfa AWUS036ACH, AWUS1900. Requires out-of-tree driver on some kernels (aircrack-ng/rtl8812au).</Li>
      <Li label="Ralink RT3070/RT5572">Reliable dual-band option. Used in Alfa AWUS036NH, AWUS051NH.</Li>
      <Li label="MediaTek MT7612U">Modern dual-band with good Linux support. Used in Alfa AWUS036ACM.</Li>

      <Box type="warn" title="Avoid These">
        TP-Link TL-WN722N v2/v3 (chipset changed from Atheros to Realtek RTL8188EUS, poor injection); Intel integrated adapters (iwlwifi driver blocks injection); most Broadcom adapters (poor Linux support).
      </Box>

      <H>Testing Your Adapter</H>
      <P>
        Before running any attack, verify your adapter actually works in monitor mode with injection capability. Put it in monitor mode via this panel, then run <Cd>sudo aireplay-ng --test wlan0mon</Cd> from a terminal. If it responds with "Injection is working!" you're ready. If it doesn't respond, your driver doesn't support injection and you'll need a different adapter.
      </P>

      <Reqs items={[
        "At least one WiFi adapter with monitor-mode and injection support",
        "Root privileges to modify interfaces",
        "iw, iwconfig, macchanger, airmon-ng utilities installed",
      ]} />
    </div>)},

    // ════════════════════════════════════════════
    // WIFI SCAN
    // ════════════════════════════════════════════
    {id:"scanner",title:"◈  WiFi Scanner Panel",c:()=>(<div>
      <P>
        The WiFi Scanner is the <B>starting point of every audit</B>. Before you can attack a network, you need to identify it, characterize its security configuration, find its connected clients, and understand the wireless environment you're operating in. This panel performs comprehensive passive reconnaissance of the RF spectrum.
      </P>

      <H>What It Does</H>
      <P>
        The scanner puts your WiFi adapter in monitor mode and captures all 802.11 management and data frames in range. It parses these frames in real time to extract Access Points (APs), their configuration (ESSID, channel, security, cipher, authentication), their connected clients, and any <A>probe requests</A> being sent by nearby devices.
      </P>
      <P>
        Unlike active scanning (where you send probe requests and listen for responses), WFAudit uses <B>purely passive scanning</B>: it only listens. This means you don't generate any transmissions yourself, making you effectively invisible on the air. The trade-off is that it takes longer to discover hidden networks and non-broadcasting APs.
      </P>

      <H>Band Selection Explained</H>
      <Tool name="2.4 GHz only (bg)"
        desc="Scans channels 1-13 (or 1-14 in Japan). Fast scan (30-60 seconds typical), captures legacy WiFi-B/G/N networks. Most consumer routers and IoT devices operate here. Higher density of clients and probe requests, but also higher interference. If you only scan here, you'll miss most modern corporate networks."
        flags={[
          ["airodump-ng --band bg","Scans only 2.4 GHz channels"],
          ["Channel 1, 6, 11","Non-overlapping 2.4 GHz channels — most APs use these three"],
        ]} />
      <Tool name="5 GHz only (a)"
        desc="Scans 5 GHz channels (36, 40, 44, 48, 52-64, 100-144, 149-165 depending on regulatory domain). Most corporate and modern consumer networks. Less interference but shorter range. Includes DFS (Dynamic Frequency Selection) channels where APs must yield to radar."
        flags={[
          ["airodump-ng --band a","Scans only 5 GHz channels"],
          ["DFS channels","52-144 — APs here may temporarily vanish if radar detected"],
        ]} />
      <Tool name="Dual-band (abg)"
        desc="Scans both 2.4 GHz and 5 GHz simultaneously. Recommended for most audits — gives complete picture of the wireless environment. Takes slightly longer than single-band scanning. Requires an adapter that supports both bands (older adapters like AR9271 are 2.4 GHz only)."
        flags={[
          ["airodump-ng --band abg","Scans both bands"],
        ]} />

      <H>Primary Tool: airodump-ng</H>
      <Tool name="airodump-ng"
        desc="The workhorse of wireless auditing. Puts your adapter in monitor mode, hops through channels, captures all 802.11 frames, and parses them into both a human-readable terminal display and machine-readable CSV + pcap output files. WFAudit's scanner is essentially a wrapper that runs airodump-ng, parses its CSV output in real time, and enriches results with OUI/vendor lookups and PNL analysis."
        flags={[
          ["-w <prefix>","Writes output files (.cap, .csv, .kismet.netxml) with this prefix"],
          ["--band bg/a/abg","Restricts scanning to specific frequency bands"],
          ["--channel <N>","Lock to single channel instead of hopping"],
          ["--bssid <MAC>","Filter to show only a specific AP (saves CPU/bandwidth)"],
          ["--essid <name>","Filter to show only APs with matching network name"],
          ["--output-format csv","Output in CSV format (needed by our parser)"],
          ["--wps","Enable WPS detection in output"],
        ]} />

      <H>Understanding the Results</H>
      <P>
        Each Access Point discovered shows a rich set of attributes. Understanding these is critical for prioritizing targets and selecting the right attack.
      </P>
      <Li label="BSSID">The MAC address of the AP (physical address of its radio). Always unique per AP.</Li>
      <Li label="ESSID">The human-readable network name. Can be empty/hidden (0 bytes) or contain a legitimate name. If empty, the AP is in "hidden" mode but can often be discovered from probe responses.</Li>
      <Li label="Channel">The RF channel the AP operates on. Your adapter needs to be on this channel to capture traffic from this AP.</Li>
      <Li label="Power (PWR)">Signal strength in dBm (always negative; closer to 0 = stronger). -30 is very close, -70 is far, -90 is barely detectable. For attacks, you want -70 or better.</Li>
      <Li label="Beacons">Number of beacon frames received. Beacons are broadcast ~10 times per second by APs.</Li>
      <Li label="Data packets">Number of data frames observed. Non-zero means clients are active on the network.</Li>
      <Li label="Encryption / Cipher / Authentication">The security configuration. Common combinations: <W>OPN</W> (no security), <D>WEP</D> (broken), <W>WPA/CCMP/PSK</W> (WPA2 with AES), <A>WPA2/CCMP/MGT</A> (Enterprise), <A>WPA3/SAE</A> (WPA3-Personal).</Li>
      <Li label="WPS">Whether Wi-Fi Protected Setup is enabled. If yes, potentially vulnerable to PIN brute-force via reaver/bully.</Li>
      <Li label="PMKID available">Whether the AP includes a PMKID in its first EAPOL message (M1). If yes, vulnerable to PMKID attack (fast, clientless).</Li>
      <Li label="Vendor">Manufacturer identified from the OUI (first 3 bytes of BSSID). Useful for known-vulnerable device identification.</Li>

      <H>Preferred Network List (PNL) Analysis</H>
      <P>
        When a WiFi-enabled device is not connected to a network, it typically sends <B>probe requests</B> searching for networks it has previously connected to. These probes are visible to anyone in monitor mode and reveal the device's travel history, home network, office network, and more.
      </P>
      <Li label="Probed ESSIDs">For each client seen, which networks it's searching for.</Li>
      <Li label="Evil Twin candidates">Networks probed by clients but NOT currently broadcasting in the area. Perfect candidates for an Evil Twin attack — the client will auto-connect if you broadcast one.</Li>
      <Li label="Device fingerprinting">Combined with the OUI, probe requests can reveal specific device types and their usage patterns.</Li>
      <Li label="MAC randomization detection">Modern iOS (14+) and Android (10+) devices randomize their MAC in probes. The panel detects randomized MACs (locally-administered bit set) and marks them.</Li>

      <Box type="info" title="Scanning Duration Guide">
        <B>30 seconds:</B> Quick reconnaissance, discovers active APs and clients with frequent traffic<br/>
        <B>60-120 seconds:</B> Balanced scan, captures most APs and active clients (recommended default)<br/>
        <B>300+ seconds:</B> Thorough scan, captures hidden networks, infrequent clients, and weak signals<br/>
        <B>600+ seconds:</B> Long-term monitoring, captures rare probes and intermittent clients
      </Box>

      <Reqs items={[
        "WiFi adapter in monitor mode (done automatically by the scanner if needed)",
        "Adapter supports the target band(s)",
        "Root privileges",
      ]} />
    </div>)},

    // ════════════════════════════════════════════
    // HANDSHAKE
    // ════════════════════════════════════════════
    {id:"handshake",title:"◎  Handshake & Crack Panel",c:()=>(<div>
      <P>
        This panel performs the <B>classic attack against WPA/WPA2-Personal networks</B>: capturing the 4-way handshake exchanged when a client authenticates to an AP, then performing offline dictionary attacks against the captured hash to recover the original passphrase. It's the oldest and most widely-supported WiFi attack, working against essentially 100% of WPA/WPA2-PSK networks that have at least one connected client.
      </P>

      <H>How the 4-Way Handshake Works</H>
      <P>
        When a WiFi client connects to a WPA/WPA2 network, it performs a 4-way handshake with the Access Point to derive session encryption keys from the Pre-Shared Key (PSK). The handshake consists of four EAPOL (Extensible Authentication Protocol over LAN) messages:
      </P>
      <Li label="Message 1 (AP → Client)">AP sends ANonce (random number). This is where a vulnerable AP would include the PMKID.</Li>
      <Li label="Message 2 (Client → AP)">Client sends SNonce + MIC calculated from PTK (Pairwise Transient Key), which is derived from PSK + ANonce + SNonce + MAC addresses.</Li>
      <Li label="Message 3 (AP → Client)">AP verifies MIC, sends install key + its own MIC.</Li>
      <Li label="Message 4 (Client → AP)">Client ACKs, connection is established.</Li>
      <P>
        <B>The security weakness</B>: the MIC values in messages 2 and 3 can be verified offline against any candidate passphrase. Given a captured handshake, an attacker calculates what the MIC <i>would be</i> for each candidate passphrase and checks if it matches the captured value. If it matches, the passphrase is correct.
      </P>

      <H>Phase 1: Capture</H>
      <Tool name="airodump-ng"
        desc="Primary capture tool. Locked to the target AP's channel, writes all frames to a .cap file. Must capture at minimum messages 2 and 3 of the 4-way handshake (or messages 1 and 2 plus a valid key confirmation)."
        flags={[
          ["-c <channel>","Lock to specific channel (critical — must match target AP)"],
          ["--bssid <MAC>","Filter to specific AP (reduces file size and CPU)"],
          ["-w <prefix>","Write output files"],
        ]} />
      <Tool name="aireplay-ng (deauth)"
        desc="Sends 802.11 deauthentication frames to force a client to disconnect. When the client reconnects (automatically, within seconds), it re-performs the 4-way handshake — which airodump-ng captures. The deauth frame is a management frame with reason code 7 ('Class 3 frame from nonassociated STA')."
        flags={[
          ["--deauth <N>","Send N deauth packets (typically 5-50)"],
          ["-a <AP_MAC>","Target AP (mandatory)"],
          ["-c <client_MAC>","Target specific client (recommended — less noisy and more effective)"],
          ["Without -c","Broadcasts deauth to all clients of the AP (very noisy, often less effective due to frame collision)"],
        ]} />

      <H>Deauth Strategies</H>
      <Li label="Targeted deauth (recommended)">Specify a single client with <Cd>-c</Cd>. Only that client is disconnected; they reconnect quickly, typically capturing a clean handshake. Less disruptive, less detectable, higher success rate.</Li>
      <Li label="Broadcast deauth">Omit <Cd>-c</Cd>. All clients of the AP are disconnected simultaneously. Produces more reconnection attempts but also more collisions — handshakes from different clients interleave. More noticeable to network administrators.</Li>
      <Li label="Continuous deauth">Larger packet counts (100-500+) repeat deauths continuously. Useful against clients with aggressive auto-reconnect logic that quickly authenticate.</Li>

      <Box type="warn" title="Handshake Capture Challenges">
        Some scenarios make capture difficult or impossible: <B>802.11w (PMF — Protected Management Frames)</B> authenticates management frames, making deauth attacks ineffective. <B>Aggressive roaming</B> can cause the client to jump to a different AP/channel before completing handshake. <B>Adjacent channel interference</B> can corrupt captured frames. If you can't capture a handshake after repeated attempts, switch to PMKID attack instead.
      </Box>

      <H>Phase 2: Cracking</H>
      <P>
        Once you have a valid handshake capture, the next step is offline cracking. This is computationally expensive (each candidate passphrase requires PBKDF2 with 4096 iterations of HMAC-SHA1) but parallelizes perfectly across GPU cores.
      </P>
      <Tool name="aircrack-ng"
        desc="CPU-only cracking. Simple and works out of the box, but slow. Typical speeds: 500-5,000 passwords per second per core. Good for small wordlists or when GPU is unavailable. Expect 4-8 hours to exhaust rockyou.txt (14M passwords) on a modern 8-core CPU."
        flags={[
          ["-w <wordlist>","Wordlist file to try"],
          ["-b <BSSID>","Target AP if multiple in capture"],
          ["<capture.cap>","The handshake file"],
        ]} />
      <Tool name="hashcat (mode 22000)"
        desc="GPU-accelerated cracking. Vastly faster — 500,000-5,000,000+ passwords per second on a modern GPU (RTX 3080, RX 6800, etc.). Requires converting the .cap to .22000 format first (done automatically by WFAudit via hcxpcapngtool). Mode 22000 handles both PMKID and EAPOL handshakes in one file format."
        flags={[
          ["-m 22000","Hash mode: WPA-PBKDF2-PMKID+EAPOL"],
          ["-a 0","Attack mode: straight dictionary"],
          ["-a 3 ?d?d?d?d?d?d?d?d","Attack mode 3: mask attack (e.g., 8 digits)"],
          ["-r rules/best64.rule","Apply wordlist rules for variations"],
          ["--show","Display already-cracked hashes"],
          ["--status","Show live progress and speed"],
        ]} />

      <H>Wordlist Strategy</H>
      <P>
        The success of a dictionary attack depends entirely on whether the passphrase is in your wordlist. Start small and specific, then escalate.
      </P>
      <Li label="rockyou.txt (14M)">The classic starting point. Derived from leaked passwords. Located at /usr/share/wordlists/rockyou.txt in Kali (uncompress if needed).</Li>
      <Li label="Custom based on target">For targeted audits, build custom wordlists using crunch or cupp based on target information (company name, keywords, phone numbers, birth dates).</Li>
      <Li label="Large corpus lists">SecLists, weakpass, hashmob lists — tens to hundreds of millions of entries. Only use after rockyou fails.</Li>
      <Li label="Mask attacks">For suspected patterns like 10 digits (phone numbers), 8-12 digits (birth dates + year), or specific character set constraints.</Li>
      <Li label="Rules">Apply transformations (capitalization, append digits, common substitutions) to extend a small wordlist dramatically.</Li>

      <Reqs items={[
        "Successfully captured 4-way handshake OR PMKID",
        "Wordlist (rockyou.txt minimum, preferably larger)",
        "Hashcat + compatible GPU for reasonable speed (or prepare for long CPU cracks with aircrack-ng)",
      ]} />
    </div>)},

    // ════════════════════════════════════════════
    // ADVANCED
    // ════════════════════════════════════════════
    {id:"advanced",title:"⬡  Advanced Attacks Panel",c:()=>(<div>
      <P>
        The Advanced panel contains <B>four specialized attack vectors</B> that go beyond the traditional handshake-and-crack workflow. Each targets specific classes of WiFi deployments and has different prerequisites. They're organized as tabs: PMKID, AP-Less, Enterprise, and WPA3.
      </P>

      <H color="#ff9500">PMKID Attack (WPA/WPA2 Clientless)</H>
      <P>
        Discovered by Jens Steube (author of hashcat) in 2018, the PMKID attack completely eliminates the requirement to capture a 4-way handshake. Instead, it extracts a PMKID value from the first message of the handshake (M1) sent by the AP — even when no client ever responds. This means <B>you can attack APs with no connected clients</B>.
      </P>
      <P>
        The PMKID is a hash included in M1 for "PMKSA caching" (a fast-roaming optimization): <Cd>PMKID = HMAC-SHA1-128(PMK, "PMK Name" || MAC_AP || MAC_STA)</Cd>. Since PMK is derived from the passphrase via PBKDF2, a dictionary attack against the PMKID is functionally equivalent to attacking a full handshake — but requires only a single frame from the AP.
      </P>
      <Tool name="hcxdumptool"
        desc="Specialized tool designed specifically for PMKID capture. Actively solicits M1 messages from target APs (unlike passive airodump-ng). Much faster at obtaining PMKIDs than traditional methods. Writes .pcapng files with richer metadata than .cap."
        flags={[
          ["-i <iface>","Monitor-mode interface"],
          ["-c <channel>","Lock to channel"],
          ["--enable_status=15","Verbose output including PMKID detection notifications"],
          ["-o <file.pcapng>","Output file"],
          ["--filterlist_ap <file>","Filter to specific BSSIDs"],
        ]} />
      <Tool name="hcxpcapngtool"
        desc="Conversion tool that extracts PMKIDs (and EAPOL handshakes) from .pcapng files and outputs them in hashcat .22000 format for offline cracking."
        flags={[
          ["-o <out.22000>","Output hashcat-format file"],
          ["<input.pcapng>","Input capture file"],
        ]} />
      <P><B>Vulnerability rate:</B> Approximately 70-80% of consumer/SOHO APs deployed after ~2015 include PMKID in M1 and are therefore vulnerable. Many enterprise APs and newer devices have mitigations.</P>
      <P><B>Advantages over handshake capture:</B> No clients required, no deauth needed (silent), faster capture (30-60 seconds typical), single packet sufficient.</P>

      <H color="#c084fc">AP-Less (KARMA-style)</H>
      <P>
        The AP-less attack targets devices when their home network is <B>not nearby</B> (e.g., auditing a corporate executive in a hotel, airport, or cafe — far from their office). Instead of attacking an AP, you attack the <B>client's auto-connect behavior</B>.
      </P>
      <P>
        When a device is not connected and has networks in its Preferred Network List (PNL), it constantly sends probe requests searching for those networks. Your attack: create a rogue AP with the same ESSID as one of the probed networks. When the victim's device sees the match, it automatically attempts to connect, and during that attempt you capture a handshake derived from the REAL PSK of the victim's saved network (because PMK is derived from PSK + SSID, and SSID matches).
      </P>
      <Tool name="hostapd"
        desc="Configured to broadcast the target ESSID with any WPA2-PSK password (doesn't need to match the real one — the handshake capture works regardless of whether the connection ultimately succeeds)."
        flags={[
          ["ssid=<target>","Exact ESSID from PNL"],
          ["wpa=2 + wpa_key_mgmt=WPA-PSK","WPA2-PSK mode"],
          ["wpa_passphrase=xyz","Any passphrase — doesn't need to match"],
        ]} />
      <P><B>Key insight:</B> The PMK = PBKDF2(passphrase, SSID). When the victim's device tries to connect, it calculates PMK using the REAL passphrase it has saved. Your rogue AP captures that handshake attempt. Even though the connection fails (your passphrase doesn't match), the captured partial handshake is sufficient for offline cracking.</P>
      <P><B>Limitations:</B> Only works against WPA/WPA2-PSK. Modern iOS/Android with randomized MACs and "verify captive portal" features reduce success rate. Doesn't work against WPA3-SAE (different key derivation).</P>

      <H color="#3ab5ff">Enterprise (WPA2-Enterprise / 802.1X)</H>
      <P>
        WPA2-Enterprise (also called WPA2-EAP) replaces shared passwords with per-user authentication via RADIUS server. Instead of PSK, each user has individual credentials authenticated through EAP (Extensible Authentication Protocol). Common variants: <B>EAP-PEAP</B> (MSCHAPv2 inside TLS tunnel), <B>EAP-TTLS</B> (any inner method inside TLS), <B>EAP-TLS</B> (mutual certificate authentication — secure).
      </P>
      <P>
        The attack: set up a <B>Rogue RADIUS server</B> with a generic (fake) SSL certificate and broadcast an Evil Twin of the target Enterprise network. When clients try to authenticate, they send their credentials (or challenge/response hashes) through the fake tunnel to your RADIUS, which logs them for offline cracking.
      </P>
      <Tool name="freeradius"
        desc="Full-featured RADIUS server. Configured in 'capture' mode: accepts any EAP authentication attempt, logs challenges/responses and captured hashes to files. Does not actually authenticate anyone — just records."
        flags={[
          ["default_eap_type=peap","Advertise PEAP support"],
          ["tls_file=<cert.pem>","Use self-signed SSL certificate"],
          ["private_key_file=<key.pem>","Private key"],
        ]} />
      <Tool name="hostapd (Enterprise mode)"
        desc="Configured to broadcast WPA2-Enterprise AP, forwarding EAP requests to the local rogue RADIUS."
        flags={[
          ["wpa=2 + wpa_key_mgmt=WPA-EAP","WPA2-Enterprise mode"],
          ["ieee8021x=1","Enable 802.1X authentication"],
          ["auth_server_addr=127.0.0.1","Our rogue RADIUS"],
          ["auth_server_port=1812","Standard RADIUS port"],
        ]} />
      <P><B>What you capture:</B> Username (always in clear), plus MSCHAPv2 challenge/response (for PEAP). Crack with <Cd>hashcat -m 5500</Cd>.</P>
      <P><B>Mitigations that defeat this attack:</B> Certificate validation on clients (reject certs not signed by the corporate CA); EAP-TLS (mutual cert auth — requires client cert you don't have); strong passwords (MSCHAPv2 is weak regardless). Many enterprises with proper MDM have certificate validation enabled and this attack fails.</P>

      <H color="#00ff95">WPA3</H>
      <P>
        WPA3 (released 2018) introduced <B>SAE (Simultaneous Authentication of Equals / Dragonfly)</B> as the replacement for the 4-way PSK handshake. SAE is resistant to offline dictionary attacks because each authentication attempt requires interactive participation with the AP — you can't precompute hashes or do offline cracking.
      </P>
      <P>
        However, WPA3 deployment is challenged by <B>Transition Mode</B>: for compatibility with older devices, APs can offer both WPA2 and WPA3 simultaneously on the same ESSID. This creates a <B>downgrade vulnerability</B> — an attacker can force a WPA3-capable client to fall back to WPA2 and then attack the WPA2 handshake as usual.
      </P>
      <Tool name="WPA3 Detection"
        desc="Parses 802.11 beacons/probe responses to detect RSN (Robust Security Network) Information Elements. Determines if an AP is WPA2-only, WPA3-only (Pure), or WPA2+WPA3 (Transition Mode)."
        flags={[
          ["RSN IE with AKM=PSK","WPA2 supported"],
          ["RSN IE with AKM=SAE","WPA3 supported"],
          ["Both present","Transition mode (vulnerable)"],
        ]} />
      <P><B>Transition Mode Downgrade:</B> Send a targeted deauth to the client, then when it attempts to reconnect, respond as a WPA2-only AP (via Evil Twin or frame modification). The client falls back to WPA2 handshake which can be captured and cracked normally.</P>
      <P><B>SAE DoS (Dragonblood):</B> CVE-2019-9494 and related. The SAE commit phase requires the AP to compute a scalar multiplication on an elliptic curve; flooding with SAE commits can overload the AP's CPU.</P>

      <Box type="info" title="Choosing Which Advanced Attack">
        <B>WPA2-PSK target, AP has clients:</B> Try PMKID first → fall back to Handshake capture if needed<br/>
        <B>WPA2-PSK target, no clients:</B> PMKID is your only option (Handshake requires a client)<br/>
        <B>Target device is outside its home network:</B> AP-less honeypot<br/>
        <B>Enterprise network (WPA2-EAP):</B> Enterprise module<br/>
        <B>Modern network supporting WPA3:</B> Check transition mode first, attack accordingly
      </Box>
    </div>)},

    // ════════════════════════════════════════════
    // RECON
    // ════════════════════════════════════════════
    {id:"recon",title:"🔍  Network Recon Panel",c:()=>(<div>
      <P>
        Once you have access to the target network (either via cracked credentials or via an Evil Twin), the Recon panel performs <B>internal network reconnaissance</B>: discovering live hosts, enumerating open ports and services, identifying operating systems, and detecting known vulnerabilities. This is where WiFi auditing transitions into traditional internal penetration testing.
      </P>

      <H>Primary Tool: nmap</H>
      <Tool name="nmap"
        desc="The industry-standard network mapper. Features TCP/UDP port scanning, OS fingerprinting, service version detection, and a scripting engine (NSE) with thousands of pre-built scripts for vulnerability detection, credential guessing, and protocol analysis. WFAudit offers 8 pre-configured profiles that wrap the most useful flag combinations."
        flags={[
          ["-sS","TCP SYN scan (stealthy, default)"],
          ["-sT","TCP Connect scan (no root required)"],
          ["-sU","UDP scan (slow but reveals UDP services)"],
          ["-sV","Version detection — probes each open port to identify the exact service and version"],
          ["-sC","Run default NSE scripts (safe baseline checks)"],
          ["-O","OS detection via TCP/IP fingerprinting"],
          ["-p <ports>","Specify port range (e.g., -p 22,80,443 or -p-  for all 65535)"],
          ["-T0 to -T5","Timing template (0=paranoid, 3=normal, 4=aggressive, 5=insane)"],
          ["--script <name>","Run specific NSE script(s)"],
          ["--script vuln","Run all vulnerability detection scripts"],
          ["-oX -","Output XML format (used by our parser)"],
        ]} />

      <H>Scan Profiles Explained</H>
      <Li label="quick"><Cd>-T4 -F</Cd> — Fast scan of 100 most common ports. Completes in &lt;1 minute per host. Use for initial sweep of a subnet.</Li>
      <Li label="full"><Cd>-T4 -p-</Cd> — Full port scan (all 65535 TCP ports). Takes 5-30 minutes per host depending on response. Use after quick scan identifies interesting hosts.</Li>
      <Li label="vuln"><Cd>--script vuln</Cd> — Runs vulnerability detection NSE scripts. Can identify CVEs, default credentials, known-vulnerable versions. Noisy and slow (20-60 min).</Li>
      <Li label="service"><Cd>-sV -sC</Cd> — Service version detection + default scripts. Balanced approach: identifies what's running on each port. Typical workhorse scan (3-15 min).</Li>
      <Li label="os_detect"><Cd>-O</Cd> — TCP/IP stack fingerprinting for OS detection. Often combined with other scans.</Li>
      <Li label="stealth"><Cd>-sS -T2</Cd> — SYN scan with slow timing. Less likely to trigger IDS alerts. Takes 10-30 min per host.</Li>
      <Li label="udp"><Cd>-sU --top-ports 100</Cd> — UDP scan (DNS, SNMP, NTP, NetBIOS, etc.). Inherently slow (20-60 min) because UDP scanning requires timeouts to detect closed ports.</Li>
      <Li label="custom">User-defined flags for maximum control.</Li>

      <H>Router Probe (Specialized)</H>
      <P>
        Gateway/router devices are a <B>high-value target</B> in any network audit — compromising them typically yields full control of the network. The Router Probe feature is a focused scan of the default gateway or a specified router IP, optimized for administrative interface discovery and default-credential checks.
      </P>
      <Li label="Default ports scanned">21 (FTP), 22 (SSH), 23 (Telnet), 53 (DNS), 80/8080 (HTTP admin), 443/8443 (HTTPS admin), 1900 (UPnP), 5000 (often UPnP/web admin).</Li>
      <Li label="Service detection">Identifies the router model and firmware version via HTTP banners, SSH keys, and SNMP responses.</Li>
      <Li label="Default credential check (optional)">Tests common default username/password combos (admin/admin, admin/password, root/root, etc.) against discovered services.</Li>
      <Li label="Full port scan option">Extends from the default ports to all 65535 for comprehensive audit.</Li>

      <H>ARP Sweep</H>
      <P>
        A quick way to enumerate all devices on the local LAN: sends ARP requests to every IP in the subnet. Faster than nmap ping sweep on local networks because ARP operates at layer 2 and can't be blocked by firewalls (assuming you're on the same L2 network). Returns MAC addresses along with IPs, which you can resolve to vendors via OUI lookup.
      </P>

      <Box type="warn" title="Post-Access Recon Discipline">
        Once inside a network, <B>resist the urge to scan everything at full speed</B>. Corporate networks often have IDS/IPS that will alert security teams on aggressive scans. Start with quick scans, move to targeted service detection on interesting hosts, and save comprehensive scans for specific targets already validated as in scope. Respect the terms of your audit authorization — "inside the network" doesn't mean "unlimited scanning."
      </Box>

      <Reqs items={[
        "Access to the target network (connected as client OR transparent bridge via Evil Twin)",
        "nmap installed",
        "Target IP ranges or hosts",
      ]} />
    </div>)},

    // ════════════════════════════════════════════
    // ATTACKS
    // ════════════════════════════════════════════
    {id:"attacks",title:"◆  Attacks Panel (Evil Twin + MITM)",c:()=>(<div>
      <P>
        The Attacks panel houses the <B>two most operationally complex modules</B>: Evil Twin and Man-in-the-Middle. Both are organized as tabs and each has its own distinct purpose. Evil Twin creates a rogue access point to harvest credentials or serve as a pivot; MITM intercepts traffic of devices already on a network you have access to.
      </P>

      <H color="#ff9500">EVIL TWIN TAB</H>
      <P>
        An Evil Twin is a <B>rogue Access Point that impersonates a legitimate network</B>. Clients, believing they're connecting to a known network, associate with the fake AP instead. Since the attacker controls the AP, they act as the upstream gateway for all victim traffic — making this an <B>automatic MITM setup</B> without needing ARP spoofing.
      </P>

      <H2>How the Attack Works</H2>
      <Li label="1. Setup">Configure hostapd with the target ESSID, same channel as legitimate AP, matching security (open/WPA2). No security at all or WPA2 with any random passphrase.</Li>
      <Li label="2. Broadcast">hostapd starts broadcasting. Victims in range see the network name and may auto-connect.</Li>
      <Li label="3. DHCP/DNS">dnsmasq assigns IP addresses to connected clients from a controlled range (10.0.0.0/24). Your machine is the gateway (10.0.0.1).</Li>
      <Li label="4. NAT/forwarding">iptables rules route victim traffic through your internet-connected interface, so they get real internet access and don't notice anything wrong.</Li>
      <Li label="5. Monitoring">tshark captures all traffic from connected clients (DNS queries, TLS SNI, HTTP requests) and logs to JSONL for real-time display.</Li>
      <Li label="6. Optional deauth">aireplay-ng sends deauth to the legitimate AP, forcing its clients to disconnect. Many will then auto-connect to your Evil Twin (same name, strong signal).</Li>

      <H2>Tools Used</H2>
      <Tool name="hostapd"
        desc="User-space daemon that converts a WiFi adapter into a fully functional AP. Configured via a text file that specifies the interface, ESSID, channel, hardware mode, security (open/WPA2/WPA3), and encryption settings."
        flags={[
          ["interface=<iface>","WiFi adapter to use (must support AP mode)"],
          ["ssid=<name>","ESSID to broadcast"],
          ["hw_mode=g","802.11g — 2.4 GHz"],
          ["hw_mode=a","802.11a — 5 GHz"],
          ["channel=<N>","Channel to operate on"],
          ["wpa=2","WPA2 security"],
          ["wpa_passphrase=<pw>","WPA2-PSK passphrase"],
          ["wpa_key_mgmt=WPA-PSK","Authentication method"],
          ["ignore_broadcast_ssid=0","Visible (not hidden) network"],
        ]} />
      <Tool name="dnsmasq"
        desc="Lightweight DHCP server + DNS caching resolver. Assigns IPs to clients connecting to our Evil Twin, provides DNS resolution (or redirects all queries to our captive portal)."
        flags={[
          ["interface=<iface>","Listen on our AP interface only"],
          ["dhcp-range=10.0.0.10,10.0.0.100,12h","IP pool + lease time"],
          ["dhcp-option=3,10.0.0.1","Default gateway (our machine)"],
          ["dhcp-option=6,10.0.0.1","DNS server (our machine)"],
          ["server=8.8.8.8","Upstream DNS (for actual resolution)"],
          ["address=/#/10.0.0.1","Captive portal: redirect ALL DNS to our IP"],
          ["log-queries","Log every DNS query (useful for analysis)"],
        ]} />
      <Tool name="aireplay-ng (deauth)"
        desc="Sends deauth frames to the LEGITIMATE AP, causing its clients to disconnect. After disconnection, their devices look for the network again — and may choose our Evil Twin if the signal is stronger."
        flags={[
          ["--deauth <N>","Number of deauth packets (0 = continuous)"],
          ["-a <BSSID>","Target AP (the real one, not our Evil Twin)"],
          ["-c <client>","Optional: target specific client only"],
        ]} />
      <Tool name="tshark (built-in MITM)"
        desc="Wireshark's CLI. Captures all network traffic flowing through our gateway interface, extracts DNS queries, TLS SNI (visible in ClientHello), and HTTP requests. Writes structured JSONL for real-time display in the UI."
        flags={[
          ["-i <iface>","Capture on our AP interface"],
          ["-Y 'dns or tls or http'","Display filter"],
          ["-T json","Output in JSON format"],
        ]} />

      <H2>Possibilities & Options</H2>
      <Li label="Plain Evil Twin">Just the rogue AP with internet forwarding. Victims connect, surf normally, all their traffic flows through you (DNS + SNI + HTTP fully visible).</Li>
      <Li label="Evil Twin + Captive Portal">dnsmasq configured to redirect ALL DNS queries to our machine. We serve a fake login page (for Gmail, corporate portal, etc.) to harvest credentials. Works because the victim's browser thinks every URL resolves to our IP.</Li>
      <Li label="Evil Twin + Deauth">Simultaneously deauth the legitimate AP to accelerate victim migration. Best combined with SSID cloning + matching channel + good signal strength.</Li>
      <Li label="Evil Twin Enterprise">Via the Advanced panel — adds a Rogue RADIUS for 802.1X credential harvesting.</Li>

      <H2>Per-Client Actions</H2>
      <P>
        When clients connect to your Evil Twin, the panel shows them in a live-updated list with IP, MAC, and hostname. Each client has two quick action buttons:
      </P>
      <Li label="🔍 Filter flows">Filter the traffic monitor to show only this client's traffic. Useful when multiple devices are connected.</Li>
      <Li label="⚡ Deauth">Pre-fills the standalone deauth panel with this client's MAC and scrolls to it. Useful to eject clients who become suspicious or to force reconnection.</Li>

      <H2>Standalone Deauth (No Evil Twin Required)</H2>
      <P>
        The Evil Twin panel also includes a <B>standalone deauth tool</B> that works independently — you don't need to launch the Evil Twin first. Useful for: DoS testing, forcing client reconnections to capture handshakes, clearing suspected attackers from your network.
      </P>
      <Li label="Required">Monitor-mode interface (different from your AP interface), target AP BSSID.</Li>
      <Li label="Optional">Specific client MAC (targeted deauth) vs. blank (broadcast to all clients), channel (auto-detected if blank), packet count.</Li>
      <Li label="Packets">50 = quick disruption, 100-500 = sustained, 0 = continuous until stopped.</Li>

      <H color="#c084fc">MITM TAB</H>
      <P>
        The MITM module intercepts traffic of <B>devices already connected to a network</B> (i.e., you don't control the AP — they do). This uses <B>ARP spoofing</B> to redirect victim traffic through your machine, then selectively intercepts HTTP/HTTPS content. Two modes are available with very different trade-offs.
      </P>

      <H2>🔇 STEALTH Mode — Invisible to Target</H2>
      <P>
        In stealth mode, traffic flows through your machine but <B>nothing is actively intercepted or modified at the application layer</B>. HTTPS traffic passes through completely untouched — no SSL certificate warnings, no connection degradation, no visible signs to the victim. Meanwhile, you extract valuable intelligence from unencrypted parts of the traffic:
      </P>
      <Li label="DNS queries">Every domain the victim's device resolves is captured (UDP port 53). Reveals every website visited, every app backend called, every tracker contacted.</Li>
      <Li label="TLS Server Name Indication (SNI)">In TLS ClientHello messages, the destination hostname is sent in <B>plaintext</B> — even for HTTPS. Captured SNI reveals the exact hostname of every HTTPS connection.</Li>
      <Li label="HTTP traffic">Any plaintext HTTP traffic is fully captured (uncommon but not extinct — IoT devices, legacy systems).</Li>
      <P><B>Use stealth mode when:</B> Monitoring a target without alerting them; mapping network behavior patterns; identifying services used; building profile for later targeted attack. The victim will not detect this attack under any circumstances (except a network admin monitoring ARP tables or latency).</P>

      <H2>🔓 FULL Mode — Complete HTTPS Interception</H2>
      <P>
        In full mode, <B>ALL HTTPS traffic is actively intercepted and decrypted</B>. This is done by mitmproxy acting as a transparent proxy that terminates the TLS connection from the victim, reads/modifies the plaintext content, and establishes its own TLS connection to the real destination.
      </P>
      <P>
        <B>Critical limitation:</B> This generates an SSL certificate signed by mitmproxy's Certificate Authority (CA), which the victim's device does NOT trust by default. The victim will see <B>certificate warnings</B> on every HTTPS site. In authorized audits, the mitmproxy CA is installed on the victim's device first (panel provides download links for Android, iOS, Windows, Linux).
      </P>
      <Li label="What you see in full mode">Complete HTTPS traffic: headers, request bodies (including POST credentials), response bodies, cookies, API calls, JWT tokens — everything.</Li>
      <Li label="When to use">Only in authorized audits where the victim's device has been prepared beforehand, or where SSL warnings are acceptable (uncommon — most users will abort on warnings).</Li>

      <H2>Tools Used</H2>
      <Tool name="arpspoof (bidirectional)"
        desc="Sends gratuitous ARP replies to poison the ARP cache of both the victim and the gateway. Victim now thinks YOU are the gateway; gateway thinks YOU are the victim. All traffic between them flows through you. Two arpspoof processes are started: victim → gateway direction and gateway → victim direction."
        flags={[
          ["-i <iface>","Interface to send spoofed ARP from"],
          ["-t <target>","Target to poison (sends 'I am gateway' to this IP)"],
          ["<gateway>","Address being impersonated (usually the real gateway)"],
        ]} />
      <Tool name="iptables (NAT + forwarding)"
        desc="Kernel firewall. Configures IP forwarding (kernel routes packets through your machine) and port redirection (HTTP/HTTPS traffic gets redirected to mitmproxy in full mode, or just passes through in stealth mode)."
        flags={[
          ["-t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8080","Redirect HTTP to mitmproxy"],
          ["-t nat -A PREROUTING -p tcp --dport 443 -j REDIRECT --to-port 8080","Redirect HTTPS to mitmproxy (full mode only)"],
          ["-A FORWARD -j ACCEPT","Allow kernel forwarding (both directions)"],
          ["-t nat -A POSTROUTING -j MASQUERADE","Rewrite source IP for outbound traffic"],
        ]} />
      <Tool name="mitmproxy (mitmdump)"
        desc="Transparent HTTP/HTTPS proxy with Python scripting. In full mode: receives redirected connections, terminates TLS using its CA, decrypts content, logs full requests/responses via our custom addon, re-encrypts with real server's cert. In stealth mode: only handles HTTP (since HTTPS is not redirected to it)."
        flags={[
          ["--mode transparent","Accept redirected connections"],
          ["--listen-port <N>","Port for redirected traffic"],
          ["--ssl-insecure","Accept upstream SSL errors"],
          ["-s <addon.py>","Load custom scripting addon"],
        ]} />
      <Tool name="tshark (stealth metadata)"
        desc="In stealth mode, tshark captures DNS queries and TLS SNI passively without interfering with traffic. Traffic still flows through our machine (ARP spoofing) but is not intercepted at application level."
        flags={[
          ["-Y 'dns.flags.response==0'","DNS query extraction"],
          ["-Y 'tls.handshake.type==1'","TLS ClientHello (contains SNI)"],
        ]} />

      <H2>Real-Time Flow Viewer</H2>
      <P>
        Both modes feed captured data into a shared real-time display: <B>a full-width table</B> with 10+ columns showing timestamp, method, status, type (HTML/API/JS/CSS/IMG), protocol (🔒 HTTPS / ⚠ HTTP / 📡 DNS), host, path, size, duration, and client IP. Auto-refresh every 3 seconds. Click any host or client IP to filter. Checkbox to show only flows with detected credentials. Methods breakdown with clickable filter chips. Top hosts list showing the most-contacted domains.
      </P>

      <Box type="info" title="Choosing MITM Mode">
        <B>Stealth mode:</B> Authorized monitoring where discovery must be avoided; large volume of devices; no need for full content<br/>
        <B>Full mode:</B> Authorized audit of specific device with pre-installed CA; capturing specific credentials or API tokens; testing app security<br/>
        <B>Neither:</B> Just monitoring network behavior? Use Evil Twin instead (simpler, doesn't require ARP spoofing)
      </Box>

      <Reqs items={[
        "For Evil Twin: at least 2 WiFi adapters (one for AP, one for monitor/deauth) OR 1 adapter + ethernet for upstream",
        "For MITM: access to the target LAN (connected as regular client to the real network)",
        "For Full MITM: mitmproxy CA installed on victim device (for clean operation without warnings)",
      ]} />
    </div>)},

    // ════════════════════════════════════════════
    // CAPTURES
    // ════════════════════════════════════════════
    {id:"captures",title:"📁  Captures Panel",c:()=>(<div>
      <P>
        The Captures panel is the <B>centralized file manager</B> for all artifacts generated during your audit: handshake captures, PMKID hashes, full packet captures, MITM flow logs, scan results, and more. Every tool that writes output files produces it here in standardized formats.
      </P>

      <H>File Types Explained</H>
      <Tool name=".cap / .pcap"
        desc="Standard packet capture format (libpcap). Contains raw 802.11 frames. Produced by airodump-ng during scans and handshake captures. Openable with Wireshark for manual analysis, aircrack-ng for cracking, cowpatty for verification. Files can contain multiple APs and clients if captured during general scan." />
      <Tool name=".pcapng"
        desc="Next-generation packet capture format (successor to pcap). Supports richer metadata, multiple interfaces in one file, nanosecond timestamps. Produced by hcxdumptool during PMKID captures. Convert to .22000 format with hcxpcapngtool for hashcat cracking." />
      <Tool name=".22000"
        desc="Hashcat's modern WPA hash format (replaces the older 2500 mode). A text file with one hash per line containing either a PMKID or a full EAPOL handshake, in a format hashcat can load with -m 22000. Generated by hcxpcapngtool from .pcapng or .cap files." />
      <Tool name=".csv"
        desc="Comma-separated values output from airodump-ng. Contains a list of all APs seen during a scan (BSSID, first seen, last seen, channel, speed, privacy, cipher, auth, power, beacons, #IV, LAN IP, ID length, ESSID, key) followed by a list of all clients seen. Human-readable, easily parsed." />
      <Tool name=".jsonl"
        desc="JSON Lines — one JSON object per line. Used by our MITM modules to stream captured flow data. Each line represents one captured request (DNS query, TLS handshake, or HTTP request) with all metadata: timestamp, client IP, host, path, size, duration, credentials detected, etc. Easily filterable and processable." />
      <Tool name=".xml"
        desc="XML output from nmap. Machine-readable scan results containing all hosts, open ports, services, versions, OS detection, and script output. Parsed by our nmap service to produce structured JSON responses." />
      <Tool name=".flow"
        desc="mitmproxy's binary format for saved HTTP(S) flows. Contains full request/response data, preserving TLS session keys so decrypted content is reviewable. Readable with mitmweb or mitmdump -r <file>." />
      <Tool name=".json"
        desc="Session exports — the structured audit report produced from a Sessions panel export. Contains session metadata, all findings, related captures, timestamps. For archival and reporting." />

      <H>File Management Features</H>
      <Li label="Download">Get a local copy of any file for backup or external analysis.</Li>
      <Li label="Preview">For text-based formats (csv, jsonl, xml), inline preview of file contents.</Li>
      <Li label="Metadata">File size, creation time, modification time, detected file type, checksum.</Li>
      <Li label="Search / filter">Find captures by type, date range, or filename pattern.</Li>
      <Li label="Delete">Remove files to reclaim space. Confirm before deleting.</Li>
      <Li label="Rename">Add human-readable context to files (e.g., "office_ap_handshake.cap").</Li>

      <H>Storage Location</H>
      <P>
        Files are stored in a configured captures directory on the backend host (default: <Cd>backend/captures/</Cd>). Each session typically produces 5-50 MB of capture data; extended audits with full-packet MITM captures can produce gigabytes. Clean up regularly.
      </P>

      <Box type="info" title="Backup Strategy">
        Critical evidence files (handshakes, PMKID hashes, key credentials) should be <B>copied off the audit machine</B> immediately after capture. Store encrypted backups on external media. The audit report should reference these files by checksum (SHA-256) for integrity verification.
      </Box>
    </div>)},

    // ════════════════════════════════════════════
    // SESSIONS
    // ════════════════════════════════════════════
    {id:"sessions",title:"📋  Sessions & Findings Panel",c:()=>(<div>
      <P>
        The Sessions panel is WFAudit's <B>audit documentation and reporting engine</B>. Every engagement you perform should be organized under a session that tracks the scope, timeline, findings, and supporting evidence. At the end of the audit, you export the session as a structured report for the client.
      </P>

      <H>What a Session Contains</H>
      <Li label="Metadata">Client name, authorization reference, audit scope, start/end dates, auditor name, engagement type.</Li>
      <Li label="Findings">Discovered issues, each with severity, description, evidence, and recommendation.</Li>
      <Li label="Captures">Supporting evidence files linked to the session.</Li>
      <Li label="Notes">Free-form engagement notes, observations, client communications.</Li>

      <H>Findings System</H>
      <P>
        Findings are the <B>actionable outputs</B> of your audit. Each finding represents one security issue requiring client attention. Structure and consistency in findings are what distinguish a professional audit report from a dump of raw output.
      </P>
      <H2>Required Fields</H2>
      <Li label="Severity">
        <A>Critical</A> — Immediate exploitation possible, significant impact (open network, default router credentials, cracked WiFi password to privileged network).
        <br /><W>High</W> — Exploitable with some effort, material impact (crackable WiFi password with observed weak complexity, WPS vulnerable to reaver).
        <br /><I>Medium</I> — Requires conditions to exploit, moderate impact (WPA2-Enterprise with MSCHAPv2, WPA3 transition mode with active clients).
        <br /><span style={{color:C.textMuted,fontWeight:700}}>Low</span> — Limited exploitability, minor impact (weak WPS PIN policy, overly permissive broadcast SSID).
        <br /><span style={{color:C.textDim}}>Info</span> — Observation without direct security impact (all APs detected, PNL analysis, network topology).
      </Li>
      <Li label="Title">Concise description of the issue (&lt;80 chars). E.g., "Default credentials on network router" not "The router has weak passwords which should be changed".</Li>
      <Li label="Description">Detailed technical explanation of what was found and why it's a problem. Include specific evidence: BSSIDs, ESSIDs, IP addresses, usernames, hash samples.</Li>
      <Li label="Evidence">Attached captures, screenshots, log excerpts, command outputs. Keep originals unmodified.</Li>
      <Li label="Recommendation">Specific, actionable steps to remediate. Reference industry standards where applicable (NIST, OWASP, vendor guidance).</Li>

      <H2>CVSS Scoring</H2>
      <P>
        When applicable, include a CVSS v3.1 score for the finding. This provides a standardized severity metric that compares your findings to the global vulnerability database. Most WiFi findings fall in the 7.5-9.5 range when impact is high.
      </P>

      <H>Report Export</H>
      <P>
        When the engagement is complete, export the session as structured JSON (or other formats). The export contains everything: session metadata, all findings with their severity and descriptions, references to all related capture files, and a chronological activity log. This JSON can be ingested by report templates, ticketing systems, or GRC platforms.
      </P>

      <Box type="warn" title="Documentation Discipline">
        <B>Document findings as you discover them</B>, not at the end of the audit. Memory is unreliable; crucial details (MAC addresses, signal strengths, timing) are easily lost. Every discovered issue should become a finding within minutes of discovery, even if you'll refine the description later.
      </Box>
    </div>)},

    // ════════════════════════════════════════════
    // PROCESSES
    // ════════════════════════════════════════════
    {id:"processes",title:"▣  Processes Panel",c:()=>(<div>
      <P>
        The Processes panel is a <B>live monitor of all subprocess activity</B> on the backend. Every tool WFAudit runs (airodump-ng, hostapd, mitmdump, nmap, hashcat, etc.) is executed as a managed subprocess. This panel lets you see what's running, how long it's been running, and kill processes if they misbehave.
      </P>

      <H>What You See</H>
      <Li label="Process ID (PID)">Linux kernel process ID. Useful for cross-referencing with <Cd>ps</Cd>, <Cd>top</Cd>, <Cd>htop</Cd>.</Li>
      <Li label="Command">The full command line including flags.</Li>
      <Li label="Service">Which WFAudit service launched this process (e.g., aircrack_service, mitm_service).</Li>
      <Li label="Status">Running / Completed / Failed / Killed.</Li>
      <Li label="Runtime">How long the process has been alive.</Li>
      <Li label="CPU / Memory">Resource usage snapshot.</Li>
      <Li label="Output preview">Last N lines of stdout/stderr.</Li>

      <H>When to Use This Panel</H>
      <Li label="Debugging">A scan or attack isn't producing results — check if the process is actually running and what its output looks like.</Li>
      <Li label="Cancellation">A long-running process (hashcat cracking a large wordlist, for example) needs to be stopped but the UI doesn't offer a direct stop button.</Li>
      <Li label="Resource monitoring">Verify that your system isn't overwhelmed; identify runaway processes.</Li>
      <Li label="Auto-refresh every 5s">The panel automatically updates so you see live state.</Li>

      <Box type="warn" title="Killing Processes">
        When you kill a process directly from this panel, WFAudit's service layer may not be aware and could still be expecting output. For attack modules, <B>always use the module's own Stop button first</B> (which does cleanup: iptables flush, ARP cache restore, etc.). Use direct process kill only as a last resort.
      </Box>
    </div>)},

    // ════════════════════════════════════════════
    // TIPS & MISTAKES
    // ════════════════════════════════════════════
    {id:"tips",title:"💡  Tips & Common Mistakes",c:()=>(<div>
      <H>Top 10 Common Mistakes</H>
      <Li label="1. Scanning only 2.4 GHz">Missing 5 GHz networks means missing most modern corporate deployments. Always use band "abg" unless you have a specific reason not to.</Li>
      <Li label="2. Using broadcast deauth first">Broadcast deauths are noisier and often less effective than targeted deauths. Start with targeted (-c specific client). Only escalate to broadcast if you need to move all clients simultaneously.</Li>
      <Li label="3. Attempting handshake before PMKID">PMKID is faster, silent, and doesn't require clients. Try PMKID first — fall back to handshake only if PMKID fails.</Li>
      <Li label="4. Not validating the handshake before cracking">An incomplete handshake is uncrackable. Always verify with <Cd>cowpatty -r &lt;file.cap&gt;</Cd> or similar before launching hashcat. Don't waste hours cracking a bad capture.</Li>
      <Li label="5. Starting with 10-billion-word wordlists">Start with rockyou.txt (14M words). ~70% of cracked passwords come from it. Escalate only after basic lists fail.</Li>
      <Li label="6. Using aircrack-ng when you have a GPU">aircrack-ng is CPU-only. A modern GPU is 100-1000x faster. Always use hashcat with GPU when possible.</Li>
      <Li label="7. Forgetting to restore managed mode">After an engagement, run <Cd>airmon-ng stop wlan0mon</Cd> to return the interface to normal state. Otherwise your system may not reconnect to WiFi until reboot.</Li>
      <Li label="8. MITM without confirming mitmproxy is running">If mitmproxy silently crashed on startup, ARP spoofing still redirects traffic but nothing captures it — target loses connectivity. Always check the "mitm_listening" status indicator after starting.</Li>
      <Li label="9. Not closing attacks cleanly">Killing the backend process directly (Ctrl+C) skips cleanup — iptables rules remain, ARP tables are poisoned, ip_forward is still enabled. Always use Stop buttons within the UI.</Li>
      <Li label="10. Not documenting in real time">Memory is unreliable. Add every finding as you discover it.</Li>

      <H>Tips for Success</H>
      <Li label="Antenna placement matters">Get line-of-sight to targets. Walls and obstructions can drop signal by 20-40 dB. Use directional antennas for targeted attacks at distance.</Li>
      <Li label="Multiple adapters unlock scenarios">One adapter in monitor mode + one in managed mode + ethernet for uplink = full Evil Twin with internet + deauth. Three adapters = Evil Twin + deauth + separate monitoring.</Li>
      <Li label="Monitor channel hop vs. lock">For general scanning, let airodump-ng hop channels. For targeted attacks, always lock to the target AP's channel with -c.</Li>
      <Li label="Save wordlist progress">hashcat has built-in session management: <Cd>--session=audit1 --restore</Cd> lets you resume interrupted cracks.</Li>
      <Li label="Keep a notebook">Text file with discovered BSSIDs, ESSIDs, channels, clients, and findings. Easier to grep than navigating the UI.</Li>

      <H>When to Escalate vs. Document</H>
      <Li label="Open network">Critical — immediate finding. All traffic in plaintext. Test scope-allowed services only.</Li>
      <Li label="WEP">Critical — crackable in minutes. Document without actually cracking if it's trivially broken in scope.</Li>
      <Li label="Default router credentials">Critical — document that credentials work, but DO NOT log in beyond verification. Anything more requires explicit authorization.</Li>
      <Li label="WPA3-only (no transition)">Positive/Info finding — the organization has done something right. Document it positively — modern security is rare and worth celebrating.</Li>
    </div>)},

  ];

  return (
    <div className="page-in">
      <PageTitle sub="Exhaustive documentation — every panel, tool, flag, option, and best practice">Help & Documentation</PageTitle>

      <div style={{marginBottom:16,padding:"14px 20px",background:`${C.accent}07`,border:`1px solid ${C.accent}22`,borderRadius:7,fontFamily:font,fontSize:12.5,color:C.textMuted,lineHeight:1.7}}>
        Click any section below to expand its documentation. Each section covers purpose, underlying tools, flags, requirements, and best practices. This documentation covers all <A>{secs.length}</A> panels of WFAudit. Press <kbd style={{background:C.bgInput,border:`1px solid ${C.border}`,borderRadius:3,padding:"1px 6px",fontFamily:font,fontSize:11}}>Esc</kbd> while expanded to collapse.
      </div>

      {secs.map(s=>(
        <div key={s.id} style={{marginBottom:8}}>
          <div onClick={()=>tog(s.id)} style={{padding:"15px 20px",background:C.bgCard,border:`1px solid ${open===s.id?C.accent+"45":C.border}`,borderLeft:`3px solid ${open===s.id?C.accent:"transparent"}`,borderRadius:open===s.id?"7px 7px 0 0":7,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all .2s",backdropFilter:"blur(8px)",boxShadow:open===s.id?`0 0 24px ${C.accent}12`:"none"}}
            onMouseEnter={e=>{if(open!==s.id)e.currentTarget.style.borderLeftColor=`${C.accent}55`;}}
            onMouseLeave={e=>{if(open!==s.id)e.currentTarget.style.borderLeftColor="transparent";}}>
            <span style={{fontFamily:font,fontSize:13.5,color:open===s.id?C.accent:C.text,fontWeight:700}}>{s.title}</span>
            <span style={{color:C.accent,fontSize:16,transition:"transform .25s cubic-bezier(.22,1,.36,1)",transform:open===s.id?"rotate(180deg)":"rotate(0)",display:"inline-block"}}>▾</span>
          </div>
          {open===s.id&&(
            <div className="anim-up" style={{padding:"20px 26px",background:C.bgCard,border:`1px solid ${C.accent}30`,borderTop:"none",borderRadius:"0 0 7px 7px",borderLeft:`3px solid ${C.accent}`,backdropFilter:"blur(8px)"}}>
              {s.c()}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════
// PAGE: WORDLISTS — Beautiful generator + manager
// ═══════════════════════════════════════════

const WordlistTabs = [
  {id:"generate",label:"Generate",icon:"⚙",desc:"Build custom wordlists",color:"#c084fc"},
  {id:"manage",label:"Manage",icon:"📚",desc:"Existing wordlists",color:"#3ab5ff"},
];

// Category colors for mutation types
const MutationColors = {
  case:        "#3ab5ff", // cyan
  letter:      "#c084fc", // purple
  numbers:     "#ff9500", // orange
  symbols:     "#ff2055", // pink/red
  combine:     "#00ff95", // green
  base:        "#ffe14a", // yellow
};

// ─── Helper components — defined OUTSIDE WordlistsPage to keep stable identity ───
// (Defining them inside causes inputs to lose focus on every keystroke because
//  React unmounts/remounts components when their function reference changes.)

function WLSection({color,icon,title,desc,count}){
  const C = useTheme();
  return (
    <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14,paddingBottom:10,borderBottom:`1px solid ${color}25`}}>
      <div style={{width:42,height:42,borderRadius:10,background:`linear-gradient(135deg, ${color}28, ${color}12)`,border:`1px solid ${color}45`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:`0 0 22px ${color}25, inset 0 1px 0 ${color}30`}}>{icon}</div>
      <div style={{flex:1}}>
        <div style={{fontFamily:fontDisplay,fontSize:13,color:color,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",display:"flex",alignItems:"center",gap:8}}>
          {title}
          {count!==undefined&&<span style={{fontSize:9,padding:"1px 6px",background:`${color}18`,borderRadius:8,color:color,letterSpacing:"0",textTransform:"none",fontWeight:600}}>{count}</span>}
        </div>
        <div style={{fontFamily:font,fontSize:11,color:C.textMuted,marginTop:2,letterSpacing:0,fontWeight:400,textTransform:"none",lineHeight:1.5}}>{desc}</div>
      </div>
    </div>
  );
}

function WLToggle({checked,onChange,label,desc,example,color,disabled=false}){
  const C = useTheme();
  const col = color || C.purple;
  return (
    <div onClick={()=>!disabled&&onChange(!checked)} style={{
      padding:"11px 13px",
      background:checked?`linear-gradient(135deg, ${col}14, ${col}08)`:C.bgInput,
      border:`1px solid ${checked?col+"55":C.border}`,
      borderLeft:`3px solid ${checked?col:"transparent"}`,
      borderRadius:7,
      cursor:disabled?"not-allowed":"pointer",
      opacity:disabled?0.4:1,
      transition:"all .2s cubic-bezier(.22,1,.36,1)",
      display:"flex",gap:11,alignItems:"flex-start",
      boxShadow:checked?`0 0 16px ${col}18, inset 0 1px 0 ${col}15`:"none",
    }}
    onMouseEnter={e=>{if(!disabled){e.currentTarget.style.transform="translateY(-1px)";if(!checked)e.currentTarget.style.borderLeftColor=col+"60";}}}
    onMouseLeave={e=>{if(!disabled){e.currentTarget.style.transform="translateY(0)";if(!checked)e.currentTarget.style.borderLeftColor="transparent";}}}>
      <div style={{
        width:16,height:16,borderRadius:4,marginTop:1,flexShrink:0,
        background:checked?`linear-gradient(135deg, ${col}, ${col}cc)`:"transparent",
        border:`1.5px solid ${checked?col:C.textMuted}`,
        display:"flex",alignItems:"center",justifyContent:"center",
        color:C.bg,fontSize:11,fontWeight:900,
        boxShadow:checked?`0 0 10px ${col}55`:"none",
        transition:"all .15s",
      }}>{checked?"✓":""}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:font,fontSize:11.5,color:checked?C.text:C.textMuted,fontWeight:700,marginBottom:2}}>{label}</div>
        {desc&&<div style={{fontFamily:font,fontSize:10,color:C.textDim,lineHeight:1.5,marginBottom:example?4:0}}>{desc}</div>}
        {example&&<div style={{fontFamily:"monospace",fontSize:10,color:checked?col:C.textDim,opacity:.85,padding:"3px 7px",background:checked?`${col}10`:C.bgCard,borderRadius:3,display:"inline-block",letterSpacing:".02em",border:`1px solid ${checked?col+"30":C.border}`}}>{example}</div>}
      </div>
    </div>
  );
}

function WLSegmented({options,value,onChange,color,label}){
  const C = useTheme();
  const col = color || C.purple;
  return (
    <div>
      {label&&<div style={{fontFamily:fontDisplay,fontSize:9,color:C.textMuted,letterSpacing:".12em",textTransform:"uppercase",marginBottom:6,fontWeight:700}}>{label}</div>}
      <div style={{display:"flex",gap:5,padding:3,background:C.bgInput,borderRadius:6,border:`1px solid ${C.border}`}}>
        {options.map(opt=>{
          const active = value===opt.id;
          return(
            <div key={opt.id} onClick={()=>onChange(opt.id)} style={{
              flex:1,padding:"6px 10px",borderRadius:4,cursor:"pointer",textAlign:"center",
              background:active?`linear-gradient(135deg, ${col}25, ${col}12)`:"transparent",
              border:`1px solid ${active?col+"55":"transparent"}`,
              fontFamily:font,fontSize:10.5,fontWeight:600,
              color:active?col:C.textMuted,
              transition:"all .18s",
              boxShadow:active?`0 0 12px ${col}25`:"none",
            }}>
              <div style={{fontWeight:700}}>{opt.label}</div>
              {opt.desc&&<div style={{fontSize:9,color:active?col+"b0":C.textDim,marginTop:1,fontWeight:500}}>{opt.desc}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WLGlassCard({color,children,sx={}}){
  const C = useTheme();
  return (
    <div style={{
      padding:"16px 18px",
      background:`linear-gradient(135deg, ${color}08, ${C.bgCard})`,
      border:`1px solid ${color}28`,
      borderRadius:10,
      backdropFilter:"blur(12px)",
      marginBottom:12,
      position:"relative",
      overflow:"hidden",
      ...sx,
    }}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:`linear-gradient(90deg, transparent, ${color}40, transparent)`}}/>
      {children}
    </div>
  );
}

function WLPresetCard({id,label,icon,desc,color,active,onClick,count}){
  const C = useTheme();
  return (
    <div onClick={onClick} style={{
      padding:"14px 12px",
      background:active?`linear-gradient(135deg, ${color}22, ${color}08)`:C.bgInput,
      border:`1px solid ${active?color+"60":C.border}`,
      borderLeft:`3px solid ${active?color:"transparent"}`,
      borderRadius:8,cursor:"pointer",textAlign:"center",
      transition:"all .25s cubic-bezier(.22,1,.36,1)",
      boxShadow:active?`0 0 24px ${color}30, inset 0 1px 0 ${color}25`:"none",
      transform:active?"translateY(-1px)":"translateY(0)",
      position:"relative",overflow:"hidden",
    }}
    onMouseEnter={e=>{if(!active){e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.borderLeftColor=color+"60";}}}
    onMouseLeave={e=>{if(!active){e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.borderLeftColor="transparent";}}}>
      {active&&<div style={{position:"absolute",top:0,right:0,width:60,height:60,background:`radial-gradient(circle, ${color}40, transparent)`,filter:"blur(20px)"}}/>}
      <div style={{fontSize:24,marginBottom:5,filter:active?`drop-shadow(0 0 12px ${color})`:"none"}}>{icon}</div>
      <div style={{fontFamily:fontDisplay,fontSize:11,color:active?color:C.text,fontWeight:700,letterSpacing:".08em"}}>{label}</div>
      <div style={{fontFamily:font,fontSize:10,color:C.textMuted,marginTop:3,lineHeight:1.4}}>{desc}</div>
      <div style={{fontFamily:fontDisplay,fontSize:9,color:active?color:C.textDim,marginTop:6,letterSpacing:".05em",fontWeight:700}}>{count}</div>
    </div>
  );
}

function WordlistsPage(){
  const C = useTheme();
  const [tab,setTab] = useState("generate");

  // ─── Generation state ───
  const [seedInput,setSeedInput] = useState("");
  const [seeds,setSeeds] = useState([]);
  const [filename,setFilename] = useState("custom_wordlist.txt");
  const [preset,setPreset] = useState("balanced");

  // Mutation toggles
  const [useLower,setUseLower] = useState(true);
  const [useUpper,setUseUpper] = useState(true);
  const [useCap,setUseCap] = useState(true);
  const [useAlt,setUseAlt] = useState(false);

  const [useLeet,setUseLeet] = useState(true);
  const [leetIntensity,setLeetIntensity] = useState("medium");
  const [useDoubling,setUseDoubling] = useState(true);
  const [useStretching,setUseStretching] = useState(false);
  const [useReverse,setUseReverse] = useState(true);
  const [usePalindrome,setUsePalindrome] = useState(false);
  const [useNumberInfix,setUseNumberInfix] = useState(true);

  const [useNumbers,setUseNumbers] = useState(true);
  const [numberMaxLen,setNumberMaxLen] = useState(4);
  const [useYears,setUseYears] = useState(true);
  const [useBirthYears,setUseBirthYears] = useState(true);

  const [useSymbols,setUseSymbols] = useState(true);
  const [useDoubleSymbols,setUseDoubleSymbols] = useState(true);
  const [useSymbolPairs,setUseSymbolPairs] = useState(true);

  const [combineWords,setCombineWords] = useState(true);
  const [combine3Words,setCombine3Words] = useState(false);
  const [useSeparators,setUseSeparators] = useState(true);

  const [addCommonBase,setAddCommonBase] = useState(true);
  const [addSpanishBase,setAddSpanishBase] = useState(true);
  const [addSpanishNames,setAddSpanishNames] = useState(true);

  const [minLen,setMinLen] = useState(6);
  const [maxLen,setMaxLen] = useState(32);
  const [maxTotal,setMaxTotal] = useState(10000000);

  const [estimating,setEstimating] = useState(false);
  const [estimate,setEstimate] = useState(null);
  const [generating,setGenerating] = useState(false);
  const [genResult,setGenResult] = useState(null);
  const [previewData,setPreviewData] = useState(null);
  const [previewLoading,setPreviewLoading] = useState(false);

  // Manage state
  const [wordlists,setWordlists] = useState([]);
  const [totalSize,setTotalSize] = useState("0 B");
  const [selectedFile,setSelectedFile] = useState(null);
  const [fileInfo,setFileInfo] = useState(null);
  const [loadingList,setLoadingList] = useState(false);

  const buildParams = ()=>({
    seed_words:seeds,
    output_filename:filename||"custom_wordlist.txt",
    use_lowercase:useLower, use_uppercase:useUpper, use_capitalize:useCap, use_alternating_case:useAlt,
    use_leet:useLeet, leet_intensity:leetIntensity,
    use_doubling:useDoubling, use_stretching:useStretching,
    use_reverse:useReverse, use_palindrome:usePalindrome,
    use_number_infix:useNumberInfix,
    use_numbers:useNumbers, number_max_length:parseInt(numberMaxLen),
    use_years:useYears, use_birth_years:useBirthYears,
    use_symbols:useSymbols, use_double_symbols:useDoubleSymbols, use_symbol_pairs:useSymbolPairs,
    combine_words:combineWords, combine_3_words:combine3Words,
    use_separators:useSeparators, use_reverse_combine:true,
    add_common_base:addCommonBase, add_spanish_base:addSpanishBase, add_spanish_names:addSpanishNames,
    min_length:parseInt(minLen), max_length:parseInt(maxLen),
    max_total:parseInt(maxTotal),
  });

  // Add seeds
  const addSeed = ()=>{
    const w = seedInput.trim();
    if(w && !seeds.includes(w)){
      setSeeds([...seeds, w]);
      setSeedInput("");
    }
  };
  const removeSeed = i=>setSeeds(seeds.filter((_,idx)=>idx!==i));
  const addBulk = ()=>{
    const items = seedInput.split(/[,\n;]/).map(s=>s.trim()).filter(Boolean);
    const newSeeds = [...seeds];
    items.forEach(item=>{ if(!newSeeds.includes(item)) newSeeds.push(item); });
    setSeeds(newSeeds);
    setSeedInput("");
  };

  // Apply preset
  const applyPreset = (id)=>{
    setPreset(id);
    const presets = {
      fast: {leet:"low",doubling:false,stretch:false,alt:false,palin:false,infix:false,numLen:2,years:false,birthYears:false,doubleSym:false,symPairs:false,combine:false,combine3:false,common:false,spanish:false,names:false},
      balanced: {leet:"medium",doubling:true,stretch:false,alt:false,palin:false,infix:true,numLen:4,years:true,birthYears:true,doubleSym:true,symPairs:true,combine:true,combine3:false,common:true,spanish:true,names:true},
      exhaustive: {leet:"high",doubling:true,stretch:true,alt:true,palin:true,infix:true,numLen:4,years:true,birthYears:true,doubleSym:true,symPairs:true,combine:true,combine3:true,common:true,spanish:true,names:true},
      spanish: {leet:"medium",doubling:true,stretch:false,alt:false,palin:false,infix:true,numLen:4,years:true,birthYears:true,doubleSym:true,symPairs:true,combine:true,combine3:false,common:false,spanish:true,names:true},
    };
    const p = presets[id]; if(!p) return;
    setLeetIntensity(p.leet); setUseDoubling(p.doubling); setUseStretching(p.stretch);
    setUseAlt(p.alt); setUsePalindrome(p.palin); setUseNumberInfix(p.infix);
    setNumberMaxLen(p.numLen); setUseYears(p.years); setUseBirthYears(p.birthYears);
    setUseDoubleSymbols(p.doubleSym); setUseSymbolPairs(p.symPairs);
    setCombineWords(p.combine); setCombine3Words(p.combine3);
    setAddCommonBase(p.common); setAddSpanishBase(p.spanish); setAddSpanishNames(p.names);
  };

  // Estimate / Preview / Generate
  const doEstimate = async()=>{
    if(seeds.length===0){setEstimate({error:"Add at least one seed word"});return;}
    setEstimating(true);
    const r = await api("/wordlists/estimate",{method:"POST",body:JSON.stringify(buildParams())});
    setEstimate(r);
    setEstimating(false);
  };

  const doPreview = async()=>{
    if(seeds.length===0)return;
    setPreviewLoading(true);
    const r = await api("/wordlists/preview",{method:"POST",body:JSON.stringify(buildParams())});
    setPreviewData(r);
    setPreviewLoading(false);
  };

  const doGenerate = async()=>{
    if(seeds.length===0){setGenResult({error:"Add at least one seed word"});return;}
    setGenerating(true);
    setGenResult(null);
    const r = await api("/wordlists/generate",{method:"POST",body:JSON.stringify(buildParams())});
    setGenResult(r);
    setGenerating(false);
    if(r.success){loadWordlists();}
  };

  // Auto-preview when seeds change (debounced)
  useEffect(()=>{
    if(seeds.length===0){setPreviewData(null);return;}
    const timer = setTimeout(()=>{doPreview();}, 600);
    return ()=>clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[seeds, useLeet, leetIntensity, useDoubling, useStretching, useNumberInfix, useNumbers, useYears, useSymbols, useSymbolPairs, combineWords, combine3Words, addSpanishBase, addSpanishNames]);

  // Load wordlists
  const loadWordlists = async()=>{
    setLoadingList(true);
    const r = await api("/wordlists");
    setWordlists(r.wordlists||[]);
    setTotalSize(r.total_size_human||"0 B");
    setLoadingList(false);
  };

  const openFile = async(fname)=>{
    setSelectedFile(fname);
    const r = await api(`/wordlists/${encodeURIComponent(fname)}/info`);
    setFileInfo(r);
  };

  const deleteFile = async(fname)=>{
    if(!confirm(`Delete ${fname}?`)) return;
    await api(`/wordlists/${encodeURIComponent(fname)}`,{method:"DELETE"});
    if(selectedFile===fname){setSelectedFile(null);setFileInfo(null);}
    loadWordlists();
  };

  useEffect(()=>{if(tab==="manage")loadWordlists();},[tab]);

  const curTab = WordlistTabs.find(t=>t.id===tab);

  return(
    <div className="page-in">
      {/* Hero header */}
      <div style={{marginBottom:18}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:6}}>
          <div style={{
            width:54,height:54,borderRadius:14,
            background:`linear-gradient(135deg, ${C.purple}, ${C.warn})`,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,
            boxShadow:`0 0 30px ${C.purple}50, 0 4px 20px rgba(0,0,0,.3)`,
          }}>⚏</div>
          <div>
            <div style={{fontFamily:fontDisplay,fontSize:24,fontWeight:800,letterSpacing:".06em",background:`linear-gradient(90deg, ${C.purple}, ${C.warn})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1}}>WORDLIST GENERATOR</div>
            <div style={{fontFamily:font,fontSize:12,color:C.textMuted,marginTop:5,letterSpacing:".02em"}}>Massive custom dictionary engine — leetspeak, infix, combinations, Spanish-tuned</div>
          </div>
        </div>
      </div>

      {/* Tab bar — beautiful pill style */}
      <div style={{display:"grid",gridTemplateColumns:`repeat(${WordlistTabs.length},1fr)`,gap:10,marginBottom:18,background:C.bgCard,borderRadius:12,padding:8,border:`1px solid ${C.border}`,boxShadow:"inset 0 1px 0 rgba(255,255,255,.04)"}}>
        {WordlistTabs.map(t=>{const active=tab===t.id;return(
          <button key={t.id} onClick={()=>setTab(t.id)} className="btn-base" style={{
            padding:"16px 14px",
            background:active?`linear-gradient(135deg, ${t.color}22, ${t.color}10)`:"transparent",
            border:`1px solid ${active?t.color+"55":"transparent"}`,
            borderRadius:9,cursor:"pointer",fontFamily:font,
            transition:"all .25s cubic-bezier(.22,1,.36,1)",
            boxShadow:active?`0 0 24px ${t.color}30, inset 0 1px 0 ${t.color}20`:"none",
            display:"flex",flexDirection:"column",alignItems:"center",gap:6,
          }}>
            <span style={{fontSize:24,filter:active?`drop-shadow(0 0 10px ${t.color})`:"none"}}>{t.icon}</span>
            <span style={{fontFamily:fontDisplay,fontSize:11,color:active?t.color:C.textMuted,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase"}}>{t.label}</span>
            <span style={{fontFamily:font,fontSize:10,color:active?`${t.color}c0`:C.textDim,fontWeight:500}}>{t.desc}</span>
            {active&&<div style={{width:32,height:2.5,background:`linear-gradient(90deg, ${t.color}, ${t.color}80)`,borderRadius:2,boxShadow:`0 0 8px ${t.color}`,marginTop:3}}/>}
          </button>
        );})}
      </div>

      {/* ═══════ GENERATE TAB ═══════ */}
      {tab==="generate"&&(<>
        {/* Top intro card */}
        <div style={{
          marginBottom:18,padding:"16px 22px",
          background:`linear-gradient(135deg, ${C.purple}12, ${C.bgCard})`,
          border:`1px solid ${C.purple}30`,
          borderRadius:10,
          fontFamily:font,fontSize:12.5,color:C.textMuted,lineHeight:1.7,
          position:"relative",overflow:"hidden",
        }}>
          <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,background:`radial-gradient(circle, ${C.purple}25, transparent)`,filter:"blur(30px)"}}/>
          <div style={{position:"relative"}}>
            <span style={{color:C.purple,fontWeight:700}}>How it works:</span> Provide seed words from OSINT — target's name, dog name, kid names, partner, birth year, sport team, favorite city. The engine combines them with mutations from real-world password leaks: <span style={{color:C.text,fontWeight:600}}>leetspeak</span> (a→4, e→3, i→1...), <span style={{color:C.text,fontWeight:600}}>numbers between letters</span> (an1der), <span style={{color:C.text,fontWeight:600}}>doubling</span> (anderr), <span style={{color:C.text,fontWeight:600}}>combinations</span> (anderibai2008), Spanish base words and 100+ common Spanish names. From 3 seeds you can generate <span style={{color:C.warn,fontWeight:700}}>millions of password candidates</span> in seconds.
          </div>
        </div>

        {/* 60/40 layout: Config (60%) + Seeds & Preview (40%) */}
        <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:14}}>

          {/* ═══ LEFT: Mutation config ═══ */}
          <div>
            {/* PRESETS */}
            <WLGlassCard color={C.info}>
              <WLSection color={C.info} icon="✨" title="Quick Presets" desc="One-click configurations tuned for different scenarios"/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                <WLPresetCard id="fast" label="Fast" icon="⚡" desc="Basic mutations, quick test" color="#00ff95" active={preset==="fast"} onClick={()=>applyPreset("fast")} count="~50K"/>
                <WLPresetCard id="balanced" label="Balanced" icon="⚖" desc="Most common mutations" color="#c084fc" active={preset==="balanced"} onClick={()=>applyPreset("balanced")} count="1-2M"/>
                <WLPresetCard id="exhaustive" label="Exhaustive" icon="🔥" desc="Every mutation, slow" color="#ff2055" active={preset==="exhaustive"} onClick={()=>applyPreset("exhaustive")} count="5-10M"/>
                <WLPresetCard id="spanish" label="Spanish" icon="🇪🇸" desc="ES-tuned, names + cities" color="#ff9500" active={preset==="spanish"} onClick={()=>applyPreset("spanish")} count="~1.5M"/>
              </div>
            </WLGlassCard>

            {/* CASE MUTATIONS */}
            <WLGlassCard color={MutationColors.case}>
              <WLSection color={MutationColors.case} icon="Aa" title="Case Variants" desc="How letters are capitalized. Each toggle adds 1 mutation per word."/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <WLToggle checked={useLower} onChange={setUseLower} label="lowercase" desc="All letters lowercase" example="ander" color={MutationColors.case}/>
                <WLToggle checked={useUpper} onChange={setUseUpper} label="UPPERCASE" desc="All letters uppercase" example="ANDER" color={MutationColors.case}/>
                <WLToggle checked={useCap} onChange={setUseCap} label="Capitalize" desc="First letter uppercase" example="Ander" color={MutationColors.case}/>
                <WLToggle checked={useAlt} onChange={setUseAlt} label="aLtErNaTiNg" desc="Alternating case (slow, lots of variants)" example="aNdEr / AnDeR" color={MutationColors.case}/>
              </div>
            </WLGlassCard>

            {/* LETTER MUTATIONS */}
            <WLGlassCard color={MutationColors.letter}>
              <WLSection color={MutationColors.letter} icon="L" title="Letter Mutations" desc="Transform individual letters: leetspeak (number/symbol substitutions), repetition, reversal."/>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                <WLToggle checked={useLeet} onChange={setUseLeet} label="Leetspeak" desc="Replace letters with similar-looking numbers/symbols. Most heavily-used mutation." example="4nd3r, @nd3r, 4nder" color={MutationColors.letter}/>
                <WLToggle checked={useNumberInfix} onChange={setUseNumberInfix} label="Number infix" desc="Insert digits BETWEEN letters at every position. Common in real passwords." example="an1der, and3r, ande5r" color={MutationColors.letter}/>
                <WLToggle checked={useDoubling} onChange={setUseDoubling} label="Letter doubling" desc="Repeat first or last letter 1-4 times. Common pattern." example="aander, anderr, anderrr" color={MutationColors.letter}/>
                <WLToggle checked={useStretching} onChange={setUseStretching} label="Letter stretching" desc="Double EVERY letter (less common but seen in real leaks)" example="aannddeerr" color={MutationColors.letter}/>
                <WLToggle checked={useReverse} onChange={setUseReverse} label="Reverse" desc="Word backwards in 3 case variants" example="redna, REDNA, Redna" color={MutationColors.letter}/>
                <WLToggle checked={usePalindrome} onChange={setUsePalindrome} label="Palindrome" desc="Word + reverse word concatenated" example="anderredna" color={MutationColors.letter}/>
              </div>

              {useLeet&&(
                <div style={{padding:"10px 12px",background:`${MutationColors.letter}06`,borderRadius:6,border:`1px solid ${MutationColors.letter}25`,marginTop:10}}>
                  <WLSegmented label="Leetspeak Intensity" color={MutationColors.letter} value={leetIntensity} onChange={setLeetIntensity}
                    options={[
                      {id:"low",label:"Low",desc:"~10 variants/word"},
                      {id:"medium",label:"Medium",desc:"~30 variants, all common subs"},
                      {id:"high",label:"High",desc:"All combos (exponential)"},
                    ]}/>
                  <div style={{marginTop:8,padding:"7px 10px",background:C.bgInput,borderRadius:4,fontFamily:"monospace",fontSize:10,color:C.textMuted,lineHeight:1.7}}>
                    <span style={{color:MutationColors.letter,fontWeight:700}}>Substitutions: </span>
                    a→<span style={{color:C.warn}}>4 @ ^</span> · b→<span style={{color:C.warn}}>8 6</span> · c→<span style={{color:C.warn}}>{"( <"}</span> · e→<span style={{color:C.warn}}>3 & €</span> · g→<span style={{color:C.warn}}>9 6</span> · i→<span style={{color:C.warn}}>1 ! |</span> · l→<span style={{color:C.warn}}>1 | 7 !</span> · o→<span style={{color:C.warn}}>0 *</span> · s→<span style={{color:C.warn}}>5 $ z §</span> · t→<span style={{color:C.warn}}>7 + 1</span> · z→<span style={{color:C.warn}}>2 s</span>
                    <span style={{color:C.textDim,fontSize:9,marginLeft:4}}>(+12 more)</span>
                  </div>
                </div>
              )}
            </WLGlassCard>

            {/* NUMBERS & YEARS */}
            <WLGlassCard color={MutationColors.numbers}>
              <WLSection color={MutationColors.numbers} icon="#" title="Numbers & Years" desc="Append numeric suffixes (most common pattern in WiFi passwords). 4-digit length covers ~70% of real-world appendages."/>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                <WLToggle checked={useNumbers} onChange={setUseNumbers} label="Numeric suffixes" desc="Append 0-9999 numbers to base words" example="ander0, ander99, ander9999" color={MutationColors.numbers}/>
                <WLToggle checked={useYears} onChange={setUseYears} label="Year suffixes" desc="Append common years (2024, 2025, recent dates)" example="ander2024, ander2025" color={MutationColors.numbers}/>
                <WLToggle checked={useBirthYears} onChange={setUseBirthYears} disabled={!useYears} label="Birth years 1950-2030" desc="Full birth year range — useful if target's age is unknown" example="ander1985, ander1992" color={MutationColors.numbers}/>
              </div>

              {useNumbers&&(
                <div style={{padding:"10px 12px",background:`${MutationColors.numbers}06`,borderRadius:6,border:`1px solid ${MutationColors.numbers}25`}}>
                  <WLSegmented label="Number suffix length" color={MutationColors.numbers} value={String(numberMaxLen)} onChange={v=>setNumberMaxLen(parseInt(v))}
                    options={[
                      {id:"1",label:"1 digit",desc:"0-9"},
                      {id:"2",label:"2 digits",desc:"00-99"},
                      {id:"3",label:"3 digits",desc:"000-999"},
                      {id:"4",label:"4 digits",desc:"0000-9999"},
                    ]}/>
                </div>
              )}
            </WLGlassCard>

            {/* SYMBOLS */}
            <WLGlassCard color={MutationColors.symbols}>
              <WLSection color={MutationColors.symbols} icon="!@" title="Symbols & Punctuation" desc="15 most common WiFi password symbols + their pairs and combinations."/>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                <WLToggle checked={useSymbols} onChange={setUseSymbols} label="Single symbols" desc="Append/prepend ! @ # $ % & ? * . _ - + = ~ ^" example="ander!, ander@, !ander" color={MutationColors.symbols}/>
                <WLToggle checked={useDoubleSymbols} onChange={setUseDoubleSymbols} disabled={!useSymbols} label="Double/triple symbols" desc="Repeated symbols (common in real leaks)" example="ander!!, ander!!!, ander..." color={MutationColors.symbols}/>
                <WLToggle checked={useSymbolPairs} onChange={setUseSymbolPairs} disabled={!useSymbols} label="Symbol pairs" desc="40+ combinations of two different symbols" example="ander!@, ander!1, ander#." color={MutationColors.symbols}/>
              </div>

              <div style={{padding:"8px 12px",background:`${MutationColors.symbols}06`,borderRadius:6,border:`1px solid ${MutationColors.symbols}25`,fontFamily:"monospace",fontSize:11,color:C.textMuted,letterSpacing:".05em"}}>
                <span style={{color:MutationColors.symbols,fontWeight:700,letterSpacing:".1em"}}>SYMBOLS: </span>
                <span style={{color:C.warn,fontWeight:700,fontSize:13,letterSpacing:".15em"}}>! @ # $ % & ? * . _ - + = ~ ^</span>
              </div>
            </WLGlassCard>

            {/* WORD COMBINATIONS */}
            <WLGlassCard color={MutationColors.combine}>
              <WLSection color={MutationColors.combine} icon="◈" title="Word Combinations" desc="Combine multiple seed words. Triples are exponentially more passwords but also exponentially more useful when targeting families."/>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <WLToggle checked={combineWords} onChange={setCombineWords} label="2-word combinations" desc="Concatenate every pair of seeds with full appendages" example="anderibai, ibaiander, ander_ibai" color={MutationColors.combine}/>
                <WLToggle checked={combine3Words} onChange={setCombine3Words} disabled={!combineWords} label="3-word combinations" desc="Concatenate every triple. Adds millions of variants — perfect for family-related contexts" example="anderibai2008, ibai_ander_2008" color={MutationColors.combine}/>
                <WLToggle checked={useSeparators} onChange={setUseSeparators} disabled={!combineWords} label="Use separators" desc="Join words with _ . - + @ #" example="ander_ibai, ander.ibai, ander-ibai" color={MutationColors.combine}/>
              </div>
            </WLGlassCard>

            {/* COMMON BASE WORDS */}
            <WLGlassCard color={MutationColors.base}>
              <WLSection color={MutationColors.base} icon="📚" title="Common Base Words" desc="Append/prepend common words. Spanish dictionary has 250+ entries (cities, family, food, sports, brands)."/>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <WLToggle checked={addCommonBase} onChange={setAddCommonBase} label="Universal common" desc="password, admin, wifi, root, qwerty..." example="passwordander, anderwifi" color={MutationColors.base}/>
                <WLToggle checked={addSpanishBase} onChange={setAddSpanishBase} label="Spanish base (250+)" desc="casa, amor, madrid, futbol, futbol clubs, family terms, food, brands" example="madridander, anderfutbol, casaibai" color={MutationColors.base}/>
                <WLToggle checked={addSpanishNames} onChange={setAddSpanishNames} label="Spanish first names (100+)" desc="Top 100 male+female names: maria, juan, sofia, javier..." example="mariaander, anderjuan2024, sofiaander" color={MutationColors.base}/>
              </div>
            </WLGlassCard>

            {/* LENGTH FILTER */}
            <WLGlassCard color={C.textMuted}>
              <WLSection color={C.info} icon="↔" title="Length Filter & Limits" desc="WPA requires 8+ characters. Filter to skip too-short or too-long candidates and cap total output."/>
              <Grid cols={3}>
                <Input label="Min length" value={minLen} onChange={setMinLen} tip="WPA-PSK requires 8+. Use 6 for general."/>
                <Input label="Max length" value={maxLen} onChange={setMaxLen} tip="WPA-PSK max is 63"/>
                <Input label="Max total" value={maxTotal} onChange={setMaxTotal} tip="Hard cap to prevent runaway generation"/>
              </Grid>
            </WLGlassCard>
          </div>

          {/* ═══ RIGHT: Seeds + Preview + Generate ═══ */}
          <div style={{position:"sticky",top:18,alignSelf:"flex-start"}}>
            {/* SEEDS — beautiful chips */}
            <WLGlassCard color={C.warn}>
              <WLSection color={C.warn} icon="🌱" title="Seed Words" desc="Add words from OSINT. Names, places, dates, kids, sport teams, dog names, anything related to the target." count={seeds.length}/>

              <div style={{display:"flex",gap:6,marginBottom:10}}>
                <input value={seedInput} onChange={e=>setSeedInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){addSeed();e.preventDefault();}}}
                  placeholder="Type a word or paste comma-separated..."
                  style={{flex:1,padding:"9px 12px",background:C.bgInput,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontFamily:font,fontSize:12,outline:"none",transition:"all .2s"}}
                  onFocus={e=>e.target.style.borderColor=C.warn+"80"}
                  onBlur={e=>e.target.style.borderColor=C.border}/>
                <Btn sm onClick={addSeed} color={C.warn}>+ Add</Btn>
                <Btn sm ghost onClick={addBulk} color={C.info} tip="Parse comma/newline separated">Bulk</Btn>
              </div>

              {seeds.length===0?(
                <div style={{padding:"22px 16px",fontFamily:font,fontSize:11,color:C.textDim,textAlign:"center",background:C.bgInput,borderRadius:6,border:`1px dashed ${C.border}`}}>
                  <div style={{fontSize:22,marginBottom:6,opacity:.4}}>🌱</div>
                  <div style={{fontStyle:"italic",lineHeight:1.6}}>No seeds yet. Try: <span style={{color:C.warn}}>Ander, Ibai, 2008, Madrid, Princesa</span></div>
                </div>
              ):(
                <div style={{display:"flex",flexWrap:"wrap",gap:5,maxHeight:180,overflowY:"auto",padding:8,background:C.bgInput,borderRadius:6,border:`1px solid ${C.border}`}}>
                  {seeds.map((s,i)=>(
                    <div key={i} style={{
                      padding:"4px 6px 4px 11px",
                      background:`linear-gradient(135deg, ${C.warn}20, ${C.warn}10)`,
                      border:`1px solid ${C.warn}40`,
                      borderRadius:5,fontFamily:font,fontSize:11.5,color:C.text,
                      display:"flex",alignItems:"center",gap:7,
                      boxShadow:`0 1px 2px rgba(0,0,0,.2), inset 0 1px 0 ${C.warn}20`,
                    }}>
                      <span style={{fontWeight:600}}>{s}</span>
                      <span onClick={()=>removeSeed(i)} style={{cursor:"pointer",color:C.textMuted,fontSize:14,lineHeight:1,padding:"0 5px",borderRadius:3,transition:"all .12s"}} onMouseEnter={e=>{e.target.style.color="#ff2055";e.target.style.background="#ff205525";}} onMouseLeave={e=>{e.target.style.color=C.textMuted;e.target.style.background="transparent";}}>×</span>
                    </div>
                  ))}
                </div>
              )}
              {seeds.length>0&&(
                <div style={{fontFamily:font,fontSize:10,color:C.textMuted,marginTop:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>{seeds.length} seed{seeds.length!==1?"s":""}</span>
                  <span onClick={()=>setSeeds([])} style={{cursor:"pointer",color:"#ff2055",fontSize:10,padding:"2px 7px",borderRadius:3,transition:"background .12s"}} onMouseEnter={e=>e.target.style.background="#ff205520"} onMouseLeave={e=>e.target.style.background="transparent"}>✕ Clear all</span>
                </div>
              )}
            </WLGlassCard>

            {/* OUTPUT FILENAME */}
            <WLGlassCard color={C.info}>
              <WLSection color={C.info} icon="📄" title="Output File" desc="Saved in wordlists directory. Use .txt extension for hashcat/aircrack-ng compatibility."/>
              <Input label="Filename" value={filename} onChange={setFilename}/>
            </WLGlassCard>

            {/* LIVE PREVIEW */}
            {seeds.length>0&&(
              <WLGlassCard color={C.purple}>
                <WLSection color={C.purple} icon="👁" title="Live Preview" desc="Sample of what the engine will produce. Updates as you change settings."/>
                {previewLoading?(
                  <div style={{padding:"22px",textAlign:"center"}}><Spinner size={18} color={C.purple}/></div>
                ):previewData&&previewData.categories?(
                  <div style={{display:"flex",flexDirection:"column",gap:7,maxHeight:340,overflowY:"auto"}}>
                    {[
                      ["case","Case","Aa",MutationColors.case],
                      ["leet","Leetspeak","L→1",MutationColors.letter],
                      ["doubling","Doubling","aa",MutationColors.letter],
                      ["infix","Number infix","a1b",MutationColors.letter],
                      ["appendage_numbers","Numbers","#",MutationColors.numbers],
                      ["appendage_years","Years","20",MutationColors.numbers],
                      ["appendage_symbols","Symbols","!@",MutationColors.symbols],
                      ["combinations","Combinations","◈",MutationColors.combine],
                      ["spanish","Spanish base","🇪🇸",MutationColors.base],
                      ["names","Names","👤",MutationColors.base],
                    ].map(([k,label,icon,color])=>{
                      const items = previewData.categories[k];
                      if(!items||items.length===0)return null;
                      return(
                        <div key={k} style={{padding:"8px 10px",background:C.bgInput,borderRadius:5,borderLeft:`2px solid ${color}`}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                            <span style={{fontSize:11}}>{icon}</span>
                            <span style={{fontFamily:fontDisplay,fontSize:9,color:color,letterSpacing:".1em",textTransform:"uppercase",fontWeight:700}}>{label}</span>
                            <span style={{fontFamily:font,fontSize:9,color:C.textDim,marginLeft:"auto"}}>{items.length} samples</span>
                          </div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                            {items.map((s,i)=>(
                              <span key={i} style={{
                                padding:"2px 7px",background:`${color}10`,
                                border:`1px solid ${color}30`,
                                borderRadius:3,fontFamily:"monospace",fontSize:10,
                                color:C.text,letterSpacing:".02em",
                              }}>{s}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ):(
                  <div style={{padding:"15px",textAlign:"center",fontFamily:font,fontSize:11,color:C.textDim}}>Adjust settings to refresh preview</div>
                )}
              </WLGlassCard>
            )}

            {/* GENERATE */}
            <WLGlassCard color={C.accent}>
              <WLSection color={C.accent} icon="⚡" title="Generate" desc="Estimate first to preview the output size, then generate."/>

              <div style={{display:"flex",gap:6,marginBottom:10}}>
                <Btn sm ghost onClick={doEstimate} disabled={estimating||seeds.length===0} color={C.info} sx={{flex:1}}>
                  {estimating?<><Spinner size={12}/>Estimating...</>:"📊 Estimate"}
                </Btn>
              </div>

              {estimate&&!estimate.error&&(
                <div className="anim-up" style={{padding:"12px 14px",background:`linear-gradient(135deg, ${C.info}10, ${C.info}05)`,border:`1px solid ${C.info}35`,borderLeft:`3px solid ${C.info}`,borderRadius:7,marginBottom:10}}>
                  <div style={{color:C.info,fontWeight:700,fontFamily:fontDisplay,fontSize:10,marginBottom:6,letterSpacing:".12em"}}>📊 ESTIMATE</div>
                  <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:"3px 10px",fontFamily:font,fontSize:11,lineHeight:1.7}}>
                    <span style={{color:C.textMuted}}>Passwords:</span><span style={{color:C.warn,fontWeight:700,fontSize:14,fontFamily:fontDisplay,letterSpacing:".04em"}}>~ {estimate.estimated_count_human}</span>
                    <span style={{color:C.textMuted}}>File size:</span><span style={{color:C.text}}>~ {estimate.estimated_size_human}</span>
                    <span style={{color:C.textMuted}}>Time:</span><span style={{color:C.text}}>~ {estimate.estimated_time_seconds}s</span>
                  </div>
                </div>
              )}

              {estimate?.error&&<div style={{color:"#ff2055",fontSize:11,marginBottom:10,padding:"6px 10px",background:"#ff205510",borderRadius:4}}>{estimate.error}</div>}

              <Btn onClick={doGenerate} disabled={generating||seeds.length===0} color={C.accent} lg sx={{width:"100%"}}>
                {generating?<><Spinner size={14}/>Generating...</>:"⚡ Generate Wordlist"}
              </Btn>

              {genResult&&genResult.success&&(
                <div className="anim-up" style={{marginTop:14,padding:"18px 20px",background:`linear-gradient(135deg, ${C.accent}12, ${C.accent}05)`,border:`1px solid ${C.accent}45`,borderLeft:`3px solid ${C.accent}`,borderRadius:8,fontFamily:font,position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",top:-30,right:-30,width:80,height:80,background:`radial-gradient(circle, ${C.accent}40, transparent)`,filter:"blur(25px)"}}/>
                  <div style={{position:"relative"}}>
                    <div style={{color:C.accent,fontWeight:700,fontFamily:fontDisplay,fontSize:14,marginBottom:10,letterSpacing:".1em",display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:18}}>✓</span> GENERATION COMPLETE
                    </div>
                    <div style={{fontSize:24,fontFamily:fontDisplay,fontWeight:900,color:C.warn,letterSpacing:".04em",marginBottom:8,textShadow:`0 0 30px ${C.warn}80`}}>
                      {genResult.total_passwords?.toLocaleString()}
                    </div>
                    <div style={{fontFamily:font,fontSize:11,color:C.textMuted,marginBottom:10}}>passwords generated</div>
                    <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:"3px 10px",fontSize:11,lineHeight:1.7}}>
                      <span style={{color:C.textMuted}}>File:</span><span style={{color:C.info,fontFamily:"monospace",wordBreak:"break-all",fontSize:10}}>{genResult.filename}</span>
                      <span style={{color:C.textMuted}}>Size:</span><span style={{color:C.text}}>{genResult.file_size_human}</span>
                      <span style={{color:C.textMuted}}>Time:</span><span style={{color:C.text}}>{genResult.elapsed_seconds}s ({genResult.rate_per_second?.toLocaleString()}/s)</span>
                    </div>
                    <Btn sm ghost color={C.purple} onClick={()=>{setTab("manage");}} sx={{marginTop:12}}>📚 View in Manage tab →</Btn>
                  </div>
                </div>
              )}

              {genResult&&genResult.error&&(
                <div className="anim-up" style={{marginTop:12,padding:"10px 14px",background:"#ff205510",border:"1px solid #ff205545",borderLeft:"3px solid #ff2055",borderRadius:6,color:"#ff2055",fontFamily:font,fontSize:11}}>
                  ✗ {genResult.error}
                </div>
              )}

              {generating&&<LoadingOverlay message="Generating wordlist (may take seconds to minutes for large lists)"/>}
            </WLGlassCard>
          </div>
        </div>
      </>)}

      {/* ═══════ MANAGE TAB ═══════ */}
      {tab==="manage"&&(<>
        <div style={{marginBottom:16,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{padding:"12px 18px",background:`linear-gradient(135deg, ${C.purple}15, ${C.purple}06)`,border:`1px solid ${C.purple}35`,borderRadius:8,display:"flex",alignItems:"center",gap:10,minWidth:160}}>
            <span style={{fontSize:22}}>📚</span>
            <div>
              <div style={{fontSize:18,fontFamily:fontDisplay,color:C.purple,fontWeight:800,letterSpacing:".05em"}}>{wordlists.length}</div>
              <div style={{fontFamily:font,fontSize:9,color:C.textMuted,letterSpacing:".1em",textTransform:"uppercase"}}>Wordlists</div>
            </div>
          </div>
          <div style={{padding:"12px 18px",background:`linear-gradient(135deg, ${C.info}15, ${C.info}06)`,border:`1px solid ${C.info}35`,borderRadius:8,display:"flex",alignItems:"center",gap:10,minWidth:160}}>
            <span style={{fontSize:22}}>💾</span>
            <div>
              <div style={{fontSize:18,fontFamily:fontDisplay,color:C.info,fontWeight:800,letterSpacing:".05em"}}>{totalSize}</div>
              <div style={{fontFamily:font,fontSize:9,color:C.textMuted,letterSpacing:".1em",textTransform:"uppercase"}}>Total Size</div>
            </div>
          </div>
          <Btn sm ghost onClick={loadWordlists} color={C.purple} sx={{marginLeft:"auto"}}>↺ Refresh</Btn>
          {loadingList&&<Spinner size={14} color={C.purple}/>}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:14}}>
          {/* List */}
          <WLGlassCard color={C.purple}>
            <WLSection color={C.purple} icon="📚" title="Existing Wordlists" desc="All files in your wordlists/ directory"/>
            {wordlists.length===0?(
              <div style={{padding:"40px 20px",textAlign:"center",fontFamily:font,fontSize:12,color:C.textMuted}}>
                <div style={{fontSize:36,marginBottom:10,opacity:.3}}>📭</div>
                <div>No wordlists yet. <span onClick={()=>setTab("generate")} style={{color:C.accent,cursor:"pointer",textDecoration:"underline",fontWeight:600}}>Generate one</span></div>
              </div>
            ):(
              <div style={{maxHeight:600,overflowY:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontFamily:font,fontSize:11}}>
                  <thead>
                    <tr style={{background:`${C.purple}06`,position:"sticky",top:0,zIndex:2}}>
                      {["Filename","Size","Lines","Modified","Actions"].map(h=>(
                        <th key={h} style={{textAlign:"left",padding:"9px 10px",color:C.purple,fontSize:9,textTransform:"uppercase",letterSpacing:".12em",fontFamily:fontDisplay,fontWeight:700,borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap",background:C.bgCard}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {wordlists.map((w,i)=>{
                      const isSel = selectedFile===w.filename;
                      return(
                        <tr key={i} onClick={()=>openFile(w.filename)} style={{
                          borderBottom:`1px solid ${C.border}30`,
                          background:isSel?`${C.purple}10`:"transparent",
                          cursor:"pointer",transition:"background .15s",
                        }} onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background=C.bgHover;}} onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                          <td style={{padding:"8px 10px",color:isSel?C.purple:C.text,fontWeight:isSel?700:500,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontFamily:"monospace",fontSize:11}} title={w.filename}>
                            <span style={{color:C.purple,marginRight:6}}>📄</span>{w.filename}
                          </td>
                          <td style={{padding:"8px 10px",color:C.textMuted,whiteSpace:"nowrap"}}>{w.size_human}</td>
                          <td style={{padding:"8px 10px",color:C.warn,fontWeight:600,whiteSpace:"nowrap"}}>{w.lines!==null?w.lines?.toLocaleString():"—"}</td>
                          <td style={{padding:"8px 10px",color:C.textDim,fontSize:10,whiteSpace:"nowrap"}}>{w.modified_at?.split("T")[0]}</td>
                          <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>
                            <Btn sm ghost color={C.info} onClick={e=>{e.stopPropagation();window.open(`${API}/wordlists/${encodeURIComponent(w.filename)}/download`,"_blank");}}>⬇</Btn>{" "}
                            <Btn sm ghost color="#ff2055" onClick={e=>{e.stopPropagation();deleteFile(w.filename);}}>×</Btn>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </WLGlassCard>

          {/* Detail */}
          <WLGlassCard color={C.info}>
            {!fileInfo?(
              <div>
                <WLSection color={C.info} icon="📄" title="Details" desc="Click a wordlist on the left to see contents and samples"/>
                <div style={{padding:"40px",textAlign:"center",fontFamily:font,fontSize:11,color:C.textMuted}}>
                  <div style={{fontSize:36,marginBottom:10,opacity:.3}}>👈</div>
                  Select a wordlist to view details
                </div>
              </div>
            ):(
              <div>
                <WLSection color={C.info} icon="📄" title={fileInfo.filename} desc={`${fileInfo.lines?.toLocaleString()||"unknown"} lines · ${(fileInfo.size_bytes/1024/1024).toFixed(2)} MB`}/>

                <div style={{padding:"10px 14px",background:C.bgInput,borderRadius:6,marginBottom:12,fontFamily:font,fontSize:11,lineHeight:1.9,border:`1px solid ${C.border}`}}>
                  <div style={{color:C.textMuted}}>Path: <span style={{color:C.text,fontFamily:"monospace",fontSize:10,wordBreak:"break-all"}}>{fileInfo.path}</span></div>
                </div>

                {fileInfo.sample_first?.length>0&&(<>
                  <div style={{fontFamily:fontDisplay,fontSize:9,color:C.info,letterSpacing:".12em",textTransform:"uppercase",marginBottom:6,fontWeight:700}}>▸ First entries</div>
                  <div style={{padding:"10px 13px",background:C.bgInput,borderRadius:6,fontFamily:"monospace",fontSize:11,color:C.text,maxHeight:160,overflowY:"auto",border:`1px solid ${C.border}`,marginBottom:12,lineHeight:1.6}}>
                    {fileInfo.sample_first.map((line,i)=><div key={i} style={{padding:"1px 0"}}>{line}</div>)}
                  </div>
                </>)}

                {fileInfo.sample_random?.length>0&&(<>
                  <div style={{fontFamily:fontDisplay,fontSize:9,color:C.info,letterSpacing:".12em",textTransform:"uppercase",marginBottom:6,fontWeight:700}}>▸ Random sample</div>
                  <div style={{padding:"10px 13px",background:C.bgInput,borderRadius:6,fontFamily:"monospace",fontSize:11,color:C.text,maxHeight:160,overflowY:"auto",border:`1px solid ${C.border}`,marginBottom:12,lineHeight:1.6}}>
                    {fileInfo.sample_random.map((line,i)=><div key={i} style={{padding:"1px 0"}}>{line}</div>)}
                  </div>
                </>)}

                <div style={{display:"flex",gap:6}}>
                  <Btn sm color={C.info} onClick={()=>window.open(`${API}/wordlists/${encodeURIComponent(fileInfo.filename)}/download`,"_blank")}>⬇ Download</Btn>
                  <Btn sm ghost color="#ff2055" onClick={()=>deleteFile(fileInfo.filename)}>× Delete</Btn>
                </div>
              </div>
            )}
          </WLGlassCard>
        </div>
      </>)}
    </div>
  );
}


// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// PAGE: WPA CRACK — Standalone cracking panel with file dropdown
// ═══════════════════════════════════════════
function WPACrackPage(){
  const C = useTheme();
  const {ops,setOp,removeOp} = useRunningOps();
  const {session} = useActiveSession();

  const [captureFiles,setCaptureFiles] = useState([]);
  const [loadingFiles,setLoadingFiles] = useState(false);
  const [selectedFile,setSelectedFile] = useState("");
  const [bssid,setBssid] = useState("");
  const [wordlists,setWordlists] = useState([]);
  const [selectedWordlist,setSelectedWordlist] = useState("/usr/share/wordlists/rockyou.txt");
  const [useGPU,setUseGPU] = useState(false);
  const [result,setResult] = useState(null);
  const [running,setRunning] = useState(false);

  const opKey = `wpa_crack:${selectedFile}`;
  const op = ops[opKey];

  // Load capture files
  const loadFiles = async()=>{
    setLoadingFiles(true);
    const r = await api("/captures/");
    if(Array.isArray(r)){
      // Filter to handshake-capable formats
      const filtered = r.filter(f=>{
        const name = (f.filename || f.filepath || f.path || "").toLowerCase();
        return name.endsWith(".cap") || name.endsWith(".pcap") || name.endsWith(".pcapng") || name.endsWith(".22000") || name.endsWith(".hccapx");
      });
      setCaptureFiles(filtered);
    }
    setLoadingFiles(false);
  };

  // Load wordlists
  const loadWordlists = async()=>{
    const r = await api("/wordlists");
    if(r?.wordlists) setWordlists(r.wordlists);
  };

  useEffect(()=>{ loadFiles(); loadWordlists(); }, []);

  // Restore running state if op was registered before
  useEffect(()=>{
    if(op && op.status === "running"){
      setRunning(true);
    } else if(op && op.status === "done"){
      setResult(op.result);
      setRunning(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[op?.status]);

  const startCrack = async()=>{
    if(!selectedFile){alert("Select a capture file first");return;}
    setRunning(true);
    setResult(null);
    setOp(opKey, {status:"running", started_at: Date.now()});

    try{
      console.log("Starting WPA crack with:", {selectedFile, bssid, selectedWordlist, useGPU, session_id: session?.id});
      const r = await api("/wifi/crack",{
        method:"POST",
        body:JSON.stringify({
          capture_file: selectedFile,
          target_bssid: bssid || null,
          wordlist: selectedWordlist,
          use_gpu: useGPU,
          session_id: session?.id || null,
        }),
      });
      setResult(r);
      setOp(opKey, {status:"done", result:r, finished_at: Date.now()});
    } catch(e){
      const errResult = {success:false, error:String(e)};
      setResult(errResult);
      setOp(opKey, {status:"done", result:errResult, finished_at: Date.now()});
    }
    setRunning(false);
  };

  // Auto-fill BSSID when file changes (extract from selected file metadata)
  useEffect(()=>{
    if(!selectedFile) return;
    const f = captureFiles.find(x=>x.filepath===selectedFile || x.path===selectedFile || x.filename===selectedFile);
    if(f && f.bssid) setBssid(f.bssid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[selectedFile]);

  return(
    <div className="page-in">
      <PageTitle sub="Offline dictionary attack on WPA/WPA2 handshakes and PMKIDs">WPA Crack</PageTitle>

      {/* Description */}
      <div style={{marginBottom:16,padding:"14px 18px",background:`linear-gradient(135deg, ${C.warn}10, ${C.bgCard})`,border:`1px solid ${C.warn}30`,borderLeft:`3px solid ${C.warn}`,borderRadius:8,fontFamily:font,fontSize:12,color:C.textMuted,lineHeight:1.7}}>
        <span style={{color:C.warn,fontWeight:700}}>How it works:</span> Pick a captured handshake or PMKID file from the dropdown (auto-populated from your captures directory), choose a wordlist, and launch the dictionary attack. <span style={{color:C.text,fontWeight:600}}>aircrack-ng</span> runs on CPU; toggle <span style={{color:C.text,fontWeight:600}}>GPU acceleration</span> for hashcat (mode 22000, 100-1000× faster).
      </div>

      {/* 60/40 layout */}
      <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:14}}>

        {/* LEFT: Configuration */}
        <div>
          {/* File selection */}
          <Card title="📁 Capture File" color={C.warn} accent>
            <div style={{display:"flex",gap:8,alignItems:"flex-end",marginBottom:8}}>
              <div style={{flex:1}}>
                <label style={{display:"block",fontSize:10,color:C.textMuted,textTransform:"uppercase",letterSpacing:".14em",marginBottom:5,fontFamily:font,fontWeight:700}}>Select capture file</label>
                <select value={selectedFile} onChange={e=>setSelectedFile(e.target.value)} style={{width:"100%",padding:"9px 13px",background:C.bgInput,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,fontFamily:"monospace",fontSize:12,outline:"none",cursor:"pointer"}}>
                  <option value="">— Pick a file —</option>
                  {captureFiles.map((f,i)=>(
                    <option key={i} value={f.filepath||f.path||f.filename} style={{background:C.bgInput}}>
                      {f.filename} ({f.size_human||f.size_bytes ? `${((f.size_bytes||0)/1024).toFixed(1)} KB` : "?"})
                    </option>
                  ))}
                </select>
              </div>
              <Btn sm ghost onClick={loadFiles} color={C.warn} tip="Refresh file list">↺</Btn>
            </div>
            {captureFiles.length===0&&!loadingFiles&&(
              <div style={{padding:"10px 14px",background:`${C.danger}10`,border:`1px solid ${C.danger}30`,borderRadius:5,fontFamily:font,fontSize:11,color:C.danger}}>
                No capture files found. Capture a handshake or PMKID first using the Advanced or Handshake panels.
              </div>
            )}
            {selectedFile&&(
              <div style={{padding:"8px 12px",background:C.bgInput,borderRadius:4,fontFamily:"monospace",fontSize:10,color:C.textMuted,wordBreak:"break-all",border:`1px solid ${C.border}`}}>
                <span style={{color:C.accent,fontWeight:700}}>Selected:</span> {selectedFile}
              </div>
            )}
          </Card>

          {/* Target & Wordlist */}
          <Card title="🎯 Target & Wordlist" color={C.purple}>
            <Input label="Target BSSID (optional)" value={bssid} onChange={setBssid} placeholder="AA:BB:CC:DD:EE:FF" tip="Auto-detected when possible. Leave blank if the file contains only one AP."/>

            <div style={{marginTop:8}}>
              <label style={{display:"block",fontSize:10,color:C.textMuted,textTransform:"uppercase",letterSpacing:".14em",marginBottom:5,fontFamily:font,fontWeight:700}}>Wordlist</label>
              <select value={selectedWordlist} onChange={e=>setSelectedWordlist(e.target.value)} style={{width:"100%",padding:"9px 13px",background:C.bgInput,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,fontFamily:"monospace",fontSize:12,outline:"none",cursor:"pointer"}}>
                <optgroup label="System wordlists">
                  <option value="/usr/share/wordlists/rockyou.txt">rockyou.txt (system)</option>
                  <option value="/usr/share/wordlists/fasttrack.txt">fasttrack.txt</option>
                </optgroup>
                {wordlists.length>0&&(
                  <optgroup label="Generated wordlists">
                    {wordlists.map((w,i)=>(
                      <option key={i} value={w.path}>{w.filename} ({w.size_human})</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <div style={{marginTop:6,fontFamily:font,fontSize:10,color:C.textDim,fontStyle:"italic"}}>
                💡 Tip: Generate a custom wordlist tailored to the target via the Wordlists panel for much better hit rates than rockyou.txt.
              </div>
            </div>

            <div style={{marginTop:12,padding:"8px 12px",background:useGPU?`${C.accent}10`:C.bgInput,border:`1px solid ${useGPU?C.accent+"45":C.border}`,borderRadius:5,cursor:"pointer",display:"flex",alignItems:"center",gap:10}} onClick={()=>setUseGPU(!useGPU)}>
              <div style={{width:14,height:14,borderRadius:3,background:useGPU?C.accent:"transparent",border:`1.5px solid ${useGPU?C.accent:C.textMuted}`,display:"flex",alignItems:"center",justifyContent:"center",color:C.bg,fontSize:10,fontWeight:900}}>{useGPU?"✓":""}</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:font,fontSize:11,color:useGPU?C.accent:C.text,fontWeight:700}}>GPU acceleration (hashcat)</div>
                <div style={{fontFamily:font,fontSize:10,color:C.textDim,marginTop:1}}>100-1000× faster than CPU on a modern GPU. Requires hashcat + CUDA/OpenCL.</div>
              </div>
            </div>
          </Card>

          {/* Launch */}
          <Card title="⚡ Launch Attack" color={C.danger} accent>
            <Btn onClick={startCrack} disabled={running||!selectedFile} color={C.danger} lg sx={{width:"100%"}}>
              {running?<><Spinner size={14}/>Cracking...</>:"⚡ Start Crack"}
            </Btn>
            {running&&<LoadingOverlay message="Dictionary attack in progress — running in background, you can navigate freely"/>}
          </Card>
        </div>

        {/* RIGHT: Result */}
        <div>
          <Card title="🔑 Result" color={C.accent} accent>
            {!result&&!running&&(
              <div style={{padding:"40px 20px",textAlign:"center",fontFamily:font,fontSize:11,color:C.textMuted}}>
                <div style={{fontSize:36,marginBottom:10,opacity:.3}}>🔐</div>
                <div>Select a capture file and start cracking to see results here.</div>
              </div>
            )}
            {running&&!result&&(
              <div style={{padding:"40px 20px",textAlign:"center",fontFamily:font,fontSize:11,color:C.textMuted}}>
                <Spinner size={28} color={C.danger}/>
                <div style={{marginTop:14,color:C.warn,fontFamily:fontDisplay,fontSize:11,letterSpacing:".15em",fontWeight:700}}>CRACKING IN PROGRESS</div>
                <div style={{marginTop:6,fontSize:10,color:C.textDim}}>You can navigate to other panels — the attack continues in background.</div>
              </div>
            )}
            {result&&(
              <div className="anim-up">
                {result.success&&result.key?(
                  <div style={{padding:"22px 18px",background:`${C.accent}06`,border:`1px solid ${C.accent}40`,borderRadius:7,textAlign:"center"}}>
                    <div style={{color:C.accent,fontSize:14,marginBottom:12,fontFamily:fontDisplay,fontWeight:700,letterSpacing:".12em"}}>✓ KEY FOUND</div>
                    <div style={{color:C.warn,fontSize:24,fontFamily:fontDisplay,fontWeight:900,padding:"14px 18px",background:`${C.warn}12`,borderRadius:7,border:`2px solid ${C.warn}55`,display:"inline-block",textShadow:`0 0 28px ${C.warn}80`,animation:"glowPulse 2s ease-in-out infinite",letterSpacing:".06em",wordBreak:"break-all",maxWidth:"100%"}}>{result.key}</div>
                    {result.target_bssid&&<div style={{color:C.textMuted,fontSize:11,marginTop:14,fontFamily:font,wordBreak:"break-all"}}>Target: {result.target_bssid}</div>}
                    <div style={{marginTop:14,padding:"6px 12px",background:C.bgInput,borderRadius:4,display:"inline-block",fontFamily:"monospace",fontSize:10,color:C.textMuted,cursor:"pointer"}} onClick={()=>{navigator.clipboard?.writeText(result.key);}}>📋 Click to copy</div>
                  </div>
                ):(
                  <div style={{padding:"15px 19px",background:`${C.danger}09`,border:`1px solid ${C.danger}28`,borderLeft:`3px solid ${C.danger}`,borderRadius:5}}>
                    <div style={{color:C.danger,fontSize:13,fontWeight:600,fontFamily:font}}>✗ Key not found</div>
                    <div style={{color:C.textMuted,fontSize:11,marginTop:6,fontFamily:font,lineHeight:1.6}}>
                      {result.error || "The wordlist did not contain the target password. Try a larger or more targeted wordlist."}
                    </div>
                    <div style={{marginTop:10,fontFamily:font,fontSize:10,color:C.textDim}}>
                      💡 Generate a custom wordlist with OSINT-derived seeds via the Wordlists panel.
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// NAVIGATION — Grouped into zones for clarity
// ═══════════════════════════════════════════
const NAV_ZONES = [
  {
    id:"core",
    label:"CORE",
    color:"#00ff95",
    items:[
      {id:"dashboard",label:"System",icon:"◉",color:"#00ff95"},
      {id:"interfaces",label:"Interfaces",icon:"⚡",color:"#3ab5ff"},
      {id:"sessions",label:"Sessions",icon:"◧",color:"#00ff95"},
    ],
  },
  {
    id:"recon",
    label:"RECONNAISSANCE",
    color:"#3ab5ff",
    items:[
      {id:"wifi",label:"WiFi Scan",icon:"◈",color:"#00ff95"},
      {id:"recon",label:"Network Recon",icon:"◐",color:"#3ab5ff"},
    ],
  },
  {
    id:"attack",
    label:"OFFENSIVE",
    color:"#ff2055",
    items:[
      {id:"handshake",label:"Handshake",icon:"◎",color:"#ff9500"},
      {id:"advanced",label:"Advanced",icon:"⬡",color:"#c084fc"},
      {id:"attacks",label:"Evil Twin / MITM",icon:"◆",color:"#ff2055"},
      {id:"crack",label:"WPA Crack",icon:"⚙",color:"#ff9500"},
    ],
  },
  {
    id:"tools",
    label:"TOOLKIT",
    color:"#c084fc",
    items:[
      {id:"wordlists",label:"Wordlists",icon:"⚏",color:"#c084fc"},
      {id:"captures",label:"Captures",icon:"▤",color:"#ff9500"},
      {id:"processes",label:"Processes",icon:"▣",color:"#3ab5ff"},
    ],
  },
  {
    id:"info",
    label:"",
    color:"#ff9500",
    items:[
      {id:"help",label:"Help",icon:"?",color:"#ff9500"},
    ],
  },
];

// Flat NAV for backwards compat
const NAV = NAV_ZONES.flatMap(z=>z.items);
const PAGES={dashboard:DashboardPage,interfaces:InterfacesPage,wifi:WifiScanPage,handshake:HandshakePage,advanced:AdvancedPage,recon:ReconPage,attacks:AttacksPage,crack:WPACrackPage,wordlists:WordlistsPage,captures:CapturesPage,sessions:SessionsPage,processes:ProcessesPage,help:HelpPage};

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

  // ─── Active session (persisted in localStorage so it survives reloads) ───
  const [activeSession,setActiveSession]=useState(()=>{
    try{const s=window.localStorage?.getItem("wfaudit-active-session");if(s)return JSON.parse(s);}catch(e){}
    return null;
  });
  useEffect(()=>{
    try{
      if(activeSession) window.localStorage?.setItem("wfaudit-active-session", JSON.stringify(activeSession));
      else window.localStorage?.removeItem("wfaudit-active-session");
    }catch(e){}
  },[activeSession]);

  // ─── Running operations registry ───
  // Maps op key → {status: "running"|"done", result?, started_at, finished_at}
  const [ops,setOps]=useState({});
  const setOp = useCallback((key, value)=>{
    setOps(prev=>({...prev, [key]: value}));
  },[]);
  const removeOp = useCallback((key)=>{
    setOps(prev=>{const n={...prev};delete n[key];return n;});
  },[]);

  // ─── Drafts (in-progress form text persisted across panel switches) ───
  const [drafts,setDrafts]=useState({});
  const setDraft = useCallback((key, value)=>{
    setDrafts(prev=>({...prev, [key]: value}));
  },[]);

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

  // Find active item info for breadcrumb
  const activeItem = NAV.find(n=>n.id===page);

  return (
    <ThemeCtx.Provider value={C}>
    <ActiveSessionCtx.Provider value={{session:activeSession, setSession:setActiveSession}}>
    <RunningOpsCtx.Provider value={{ops, setOp, removeOp}}>
    <DraftCtx.Provider value={{drafts, setDraft}}>
      <div style={{display:"flex",height:"100vh",background:C.bg,color:C.text,fontFamily:font,overflow:"hidden",transition:"background .3s,color .3s"}}>
        <style>{makeCSS(C)}</style>

        {/* Background */}
        <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,backgroundImage:`radial-gradient(${C.accent}08 1px,transparent 1px)`,backgroundSize:"30px 30px"}}/>
        {C.isDark&&<>
          <div style={{position:"fixed",top:"-20%",left:"-10%",width:"55vw",height:"55vh",background:`radial-gradient(ellipse,${C.accent}06 0%,transparent 70%)`,pointerEvents:"none",zIndex:0}}/>
          <div style={{position:"fixed",bottom:"-20%",right:"-10%",width:"55vw",height:"55vh",background:`radial-gradient(ellipse,${C.purple}05 0%,transparent 70%)`,pointerEvents:"none",zIndex:0}}/>
        </>}

        {/* ── SIDEBAR — Zone-based navigation ── */}
        <div style={{width:col?52:200,minWidth:col?52:200,background:C.bgSidebar,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",transition:"width .25s cubic-bezier(.22,1,.36,1),min-width .25s",flexShrink:0,position:"relative",zIndex:20,boxShadow:`4px 0 28px ${C.isDark?"rgba(0,0,0,.55)":"rgba(0,0,0,.12)"}`}}>
          <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(${C.accent}09 1px,transparent 1px)`,backgroundSize:"20px 20px",pointerEvents:"none"}}/>
          <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${C.accent}45,transparent)`,pointerEvents:"none"}}/>

          {/* Logo */}
          <div onClick={()=>setCol(!col)} style={{padding:col?"15px 8px":"18px 16px",borderBottom:`1px solid ${C.border}`,cursor:"pointer",position:"relative",zIndex:1,display:"flex",alignItems:"center",gap:10,userSelect:"none",justifyContent:col?"center":"flex-start"}}>
            <div style={{width:col?26:32,height:col?26:32,borderRadius:8,background:`linear-gradient(135deg,${C.accent},${C.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:fontDisplay,fontWeight:900,color:C.bg,fontSize:col?12:15,boxShadow:`0 0 20px ${C.accent}55`,flexShrink:0}}>W</div>
            {!col&&<div style={{fontFamily:fontDisplay,fontSize:16,color:C.accent,fontWeight:900,letterSpacing:".12em",textShadow:`0 0 26px ${C.accent}65`,transition:"all .25s"}}>WFAUDIT</div>}
          </div>

          {/* Active session indicator */}
          {!col&&(
            <div onClick={()=>navigate("sessions")} style={{margin:"10px 12px 6px",padding:"9px 12px",borderRadius:7,background:activeSession?`linear-gradient(135deg, ${C.accent}15, ${C.accent}05)`:C.bgInput,border:`1px solid ${activeSession?C.accent+"35":C.border}`,cursor:"pointer",transition:"all .18s",position:"relative",zIndex:1}}>
              <div style={{fontFamily:fontDisplay,fontSize:8,color:activeSession?C.accent:C.textMuted,letterSpacing:".15em",textTransform:"uppercase",fontWeight:700,marginBottom:3}}>{activeSession?"● Active Session":"○ No Session"}</div>
              <div style={{fontFamily:font,fontSize:11,color:activeSession?C.text:C.textDim,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                {activeSession?activeSession.name:"Click to start"}
              </div>
              {activeSession?.company&&<div style={{fontFamily:font,fontSize:9,color:C.textMuted,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{activeSession.company}</div>}
            </div>
          )}
          {col&&(
            <div onClick={()=>navigate("sessions")} title={activeSession?activeSession.name:"No session"} style={{margin:"8px auto",width:32,height:32,borderRadius:8,background:activeSession?`${C.accent}18`:C.bgInput,border:`1px solid ${activeSession?C.accent+"50":C.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",zIndex:1}}>
              <span style={{fontSize:14,color:activeSession?C.accent:C.textMuted}}>◧</span>
              {activeSession&&<div style={{position:"absolute",top:-2,right:-2,width:8,height:8,borderRadius:"50%",background:C.accent,boxShadow:`0 0 6px ${C.accent}`}}/>}
            </div>
          )}

          {/* Nav with zones */}
          <nav style={{flex:1,padding:"4px 0 8px",position:"relative",zIndex:1,display:"flex",flexDirection:"column",overflowY:"auto",overflowX:"hidden"}}>
            {NAV_ZONES.map((zone,zi)=>(
              <div key={zone.id} style={{marginTop:zi===0?0:10}}>
                {!col&&zone.label&&(
                  <div style={{padding:"6px 16px 4px",fontFamily:fontDisplay,fontSize:8.5,color:zone.color,letterSpacing:".18em",textTransform:"uppercase",fontWeight:700,opacity:.85,display:"flex",alignItems:"center",gap:8}}>
                    <span style={{width:3,height:3,borderRadius:"50%",background:zone.color,boxShadow:`0 0 6px ${zone.color}`}}/>
                    {zone.label}
                  </div>
                )}
                {col&&zone.label&&zi>0&&(
                  <div style={{margin:"6px 12px",height:1,background:`linear-gradient(90deg, transparent, ${zone.color}40, transparent)`}}/>
                )}
                {zone.items.map(item=>{
                  const a=page===item.id;
                  return(
                    <div key={item.id} className="nav-item"
                      onClick={()=>{ navigate(item.id); if(window.innerWidth<640) setCol(true); }}
                      title={col?item.label:""}
                      style={{padding:col?"10px 0":"7px 16px",margin:col?"1px 8px":"1px 8px",cursor:"pointer",background:a?`linear-gradient(90deg, ${item.color}18, transparent)`:"transparent",borderLeft:a?`2px solid ${item.color}`:"2px solid transparent",borderRadius:5,color:a?item.color:C.textMuted,fontSize:11,letterSpacing:".02em",display:"flex",alignItems:"center",gap:10,justifyContent:col?"center":"flex-start",fontFamily:font,fontWeight:a?700:500,transition:"all .15s",position:"relative"}}
                      onMouseEnter={e=>{if(!a){e.currentTarget.style.color=item.color;e.currentTarget.style.background=`${item.color}08`;}}}
                      onMouseLeave={e=>{if(!a){e.currentTarget.style.color=C.textMuted;e.currentTarget.style.background="transparent";}}}>
                      <span className="nav-icon" style={{fontSize:col?16:14,width:col?24:18,textAlign:"center",display:"block",color:"inherit",filter:a?`drop-shadow(0 0 6px ${item.color})`:"none",transition:"all .18s",flexShrink:0}}>{item.icon}</span>
                      {!col&&<span className="nav-label" style={{fontSize:11.5,overflow:"hidden",whiteSpace:"nowrap",flex:1}}>{item.label}</span>}
                      {a&&!col&&<div style={{width:5,height:5,borderRadius:"50%",background:item.color,boxShadow:`0 0 9px ${item.color}`,flexShrink:0}}/>}
                    </div>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Clock */}
          {!col&&(
            <div style={{padding:"10px 16px",borderTop:`1px solid ${C.border}`,fontSize:10,color:C.textMuted,position:"relative",zIndex:1,fontFamily:font}}>
              <div style={{letterSpacing:".08em"}}>{time.toLocaleDateString()}</div>
              <div style={{fontSize:14,color:C.accent,fontWeight:700,fontFamily:fontDisplay,textShadow:`0 0 14px ${C.accent}55`,letterSpacing:".06em"}}>{time.toLocaleTimeString()}</div>
            </div>
          )}
        </div>

        {/* ── MAIN CONTENT ── */}
        <div style={{flex:1,overflow:"auto",position:"relative",zIndex:10,minWidth:0}}>
          {/* Topbar — with active session prominent */}
          <div style={{padding:"0 16px",height:48,borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:C.bgTopbar,position:"sticky",top:0,zIndex:30,backdropFilter:"blur(18px)",boxShadow:`0 1px 0 ${C.border}`,gap:12}}>
            {/* Breadcrumb */}
            <div style={{fontFamily:font,fontSize:11,display:"flex",alignItems:"center",gap:8,overflow:"hidden",minWidth:0,flexShrink:1}}>
              <span style={{color:C.accent,textShadow:`0 0 11px ${C.accent}55`,whiteSpace:"nowrap",fontFamily:fontDisplay,fontWeight:700,letterSpacing:".06em"}}>WFAUDIT</span>
              <span style={{color:C.textDim,fontSize:9}}>›</span>
              <span style={{color:activeItem?.color||C.textMuted,whiteSpace:"nowrap",fontWeight:600}}>{activeItem?.label||page.toUpperCase()}</span>
            </div>

            {/* Active session pill (clickable, takes you to Sessions) */}
            <div style={{display:"flex",alignItems:"center",gap:10,flex:"0 1 auto",overflow:"hidden",minWidth:0}}>
              {activeSession?(
                <div onClick={()=>navigate("sessions")} style={{padding:"6px 12px",background:`linear-gradient(135deg, ${C.accent}18, ${C.accent}06)`,border:`1px solid ${C.accent}45`,borderRadius:7,cursor:"pointer",display:"flex",alignItems:"center",gap:8,transition:"all .18s",minWidth:0,maxWidth:280}}
                  onMouseEnter={e=>e.currentTarget.style.background=`linear-gradient(135deg, ${C.accent}28, ${C.accent}10)`}
                  onMouseLeave={e=>e.currentTarget.style.background=`linear-gradient(135deg, ${C.accent}18, ${C.accent}06)`}>
                  <span style={{width:6,height:6,borderRadius:"50%",background:C.accent,boxShadow:`0 0 8px ${C.accent}`,flexShrink:0,animation:"pulse 2s ease-in-out infinite"}}/>
                  <div style={{minWidth:0,overflow:"hidden"}}>
                    <div style={{fontFamily:fontDisplay,fontSize:8,color:C.accent,letterSpacing:".15em",fontWeight:700,marginBottom:1}}>SESSION</div>
                    <div style={{fontFamily:font,fontSize:11,color:C.text,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",lineHeight:1}}>{activeSession.name}</div>
                  </div>
                </div>
              ):(
                <div onClick={()=>navigate("sessions")} style={{padding:"6px 12px",background:`${C.warn}10`,border:`1px solid ${C.warn}30`,borderRadius:7,cursor:"pointer",display:"flex",alignItems:"center",gap:7,transition:"all .18s"}}
                  onMouseEnter={e=>e.currentTarget.style.background=`${C.warn}18`}
                  onMouseLeave={e=>e.currentTarget.style.background=`${C.warn}10`}>
                  <span style={{fontSize:11}}>⚠</span>
                  <span style={{fontFamily:font,fontSize:10.5,color:C.warn,fontWeight:600,whiteSpace:"nowrap"}}>No active session</span>
                </div>
              )}
            </div>

            {/* Right controls */}
            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              <span className="topbar-hint" style={{fontSize:10,color:C.textMuted,fontFamily:font,letterSpacing:".1em",display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap"}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:C.danger,boxShadow:`0 0 6px ${C.danger}`,display:"block",flexShrink:0}}/>
                AUTH ONLY
              </span>
              <button onClick={()=>setIsDark(!isDark)} title={isDark?"Light":"Dark"}
                style={{width:44,height:24,borderRadius:12,cursor:"pointer",background:isDark?`linear-gradient(135deg,${C.accent}32,${C.purple}26)`:`linear-gradient(135deg,${C.accent}22,${C.info}18)`,border:`1px solid ${C.accent}45`,padding:0,position:"relative",transition:"all .3s cubic-bezier(.22,1,.36,1)",outline:"none",flexShrink:0}}>
                <div style={{position:"absolute",top:3,left:isDark?22:3,width:16,height:16,borderRadius:"50%",background:isDark?C.accent:C.warn,transition:"all .3s cubic-bezier(.22,1,.36,1)",boxShadow:isDark?`0 0 12px ${C.accent}90`:`0 0 10px ${C.warn}70`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:isDark?C.bg:"#fff"}}>{isDark?"☽":"☀"}</div>
              </button>
            </div>
          </div>

          {/* Page content */}
          <div className="main-pad" style={{padding:"22px 24px",minWidth:0}} key={pageKey}>
            <Page/>
          </div>
        </div>
      </div>
    </DraftCtx.Provider>
    </RunningOpsCtx.Provider>
    </ActiveSessionCtx.Provider>
    </ThemeCtx.Provider>
  );
}

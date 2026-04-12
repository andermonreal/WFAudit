import { useState, useEffect, useRef, createContext, useContext } from "react";

const API = "http://localhost:8000";
const api = async (path, opts = {}) => {
  try {
    const r = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json", ...opts.headers }, ...opts });
    return await r.json();
  } catch (e) { return { error: e.message }; }
};

// ═══════════════════════════════════════════
// THEME SYSTEM
// ═══════════════════════════════════════════
const DARK = {
  bg: "#03070f", bgCard: "rgba(5,12,25,0.92)", bgInput: "#040b18", bgSidebar: "#020408",
  bgHover: "rgba(0,255,149,0.05)", bgTopbar: "rgba(3,7,16,0.97)",
  text: "#cdd6e0", textMuted: "#3d5166", textDim: "#162030",
  border: "#0c1e35", accent: "#00ff95", accentDim: "#00cc78",
  warn: "#ff9500", danger: "#ff2055", info: "#3ab5ff", purple: "#c084fc",
  glow: "0 0 24px rgba(0,255,149,0.2)", glowStrong: "0 0 48px rgba(0,255,149,0.35)",
  glass: "rgba(5,12,25,0.85)", glassBorder: "rgba(0,255,149,0.12)",
  scanLine: "rgba(0,255,149,0.025)", isDark: true,
};
const LIGHT = {
  bg: "#ebeff8", bgCard: "rgba(255,255,255,0.97)", bgInput: "#f1f5fb", bgSidebar: "#0b1322",
  bgHover: "rgba(14,165,233,0.06)", bgTopbar: "rgba(255,255,255,0.98)",
  text: "#1a2740", textMuted: "#5a6e88", textDim: "#9aacbe",
  border: "#dce4ef", accent: "#0ea5e9", accentDim: "#0284c7",
  warn: "#f59e0b", danger: "#f43f5e", info: "#6366f1", purple: "#a855f7",
  glow: "0 4px 24px rgba(14,165,233,0.18)", glowStrong: "0 8px 40px rgba(14,165,233,0.28)",
  glass: "rgba(255,255,255,0.9)", glassBorder: "rgba(14,165,233,0.18)",
  scanLine: "rgba(14,165,233,0.015)", isDark: false,
};

const ThemeCtx = createContext(DARK);
const useTheme = () => useContext(ThemeCtx);

const SEV = { critical: "#ff2055", high: "#ff6b35", medium: "#ff9500", low: "#3ab5ff", info: "#00ff95" };
const SEC = { open: "#ff2055", wep: "#ff6b35", wpa: "#ff9500", wpa2: "#3ab5ff", wpa3: "#00ff95", wpa2_enterprise: "#c084fc", wpa3_enterprise: "#c084fc", unknown: "#3d5166" };

const font = "'Space Mono', 'JetBrains Mono', monospace";
const fontDisplay = "'Orbitron', 'Space Mono', monospace";

const makeCSS = (C) => `
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Orbitron:wght@400;600;700;900&display=swap');
*{box-sizing:border-box;scrollbar-width:thin;scrollbar-color:${C.border} transparent}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}
::-webkit-scrollbar-thumb:hover{background:${C.accent}50}
body,html{margin:0;padding:0}

@keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes pulseRing{0%{transform:scale(1);opacity:.6}100%{transform:scale(2.5);opacity:0}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes spinSlow{to{transform:rotate(360deg)}}
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideLeft{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}
@keyframes scanH{0%{left:-60%}100%{left:120%}}
@keyframes scanV{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}
@keyframes glowPulse{0%,100%{box-shadow:0 0 8px ${C.accent}30}50%{box-shadow:0 0 32px ${C.accent}60,0 0 64px ${C.accent}20}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes shimmer{0%{background-position:-300% center}100%{background-position:300% center}}
@keyframes loadBar{0%{width:0%;opacity:1}70%{width:85%;opacity:1}100%{width:100%;opacity:0}}
@keyframes countUp{from{opacity:0;transform:translateY(12px) scale(.9)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes borderFlicker{0%,100%{border-color:${C.accent}18}50%{border-color:${C.accent}50}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes rotateBorder{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
@keyframes pageIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes dotPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.4)}}

.anim-up{animation:slideUp .4s cubic-bezier(.22,1,.36,1) both}
.anim-left{animation:slideLeft .35s cubic-bezier(.22,1,.36,1) both}
.anim-fade{animation:fadeIn .3s ease both}
.anim-count{animation:countUp .5s cubic-bezier(.22,1,.36,1) both}
.page-in{animation:pageIn .4s cubic-bezier(.22,1,.36,1) both}

.nav-item{transition:all .18s cubic-bezier(.22,1,.36,1)}
.nav-item:hover .nav-label{letter-spacing:.14em!important}
.nav-item:hover .nav-icon{transform:scale(1.2)}

.card-hover{transition:transform .2s ease,box-shadow .2s ease}
.card-hover:hover{transform:translateY(-1px)}

.btn-base{position:relative;overflow:hidden;transition:all .18s cubic-bezier(.22,1,.36,1)!important}
.btn-base::before{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent);transform:translateX(-100%);transition:transform .4s ease}
.btn-base:hover::before{transform:translateX(100%)}
.btn-base:active{transform:scale(.97)!important}

input:focus,select:focus{outline:none}
`;

// ═══════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════
const Badge = ({ children, color, sm }) => {
  const C = useTheme();
  const c = color || C.accent;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center",
      padding: sm ? "1px 8px" : "3px 10px",
      borderRadius: 2, background: `${c}14`, color: c,
      border: `1px solid ${c}35`, fontSize: sm ? 9 : 10,
      fontFamily: font, textTransform:"uppercase", letterSpacing:".1em", fontWeight:700,
    }}>{children}</span>
  );
};

const Spinner = ({ size = 16, color }) => {
  const C = useTheme();
  const c = color || C.accent;
  return (
    <span style={{
      display:"inline-block", width: size, height: size,
      border: `2px solid ${c}18`,
      borderTopColor: c, borderRightColor: `${c}70`,
      borderRadius:"50%", animation:"spin .65s linear infinite", flexShrink:0,
    }} />
  );
};

const LoadingOverlay = ({ message = "Processing...", duration = 0 }) => {
  const C = useTheme();
  const [dots, setDots] = useState("");
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());
  useEffect(() => {
    startTime.current = Date.now();
    const di = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 420);
    const pi = setInterval(() => {
      const el = (Date.now() - startTime.current) / 1000;
      setElapsed(el);
      if (duration > 0) {
        setProgress(Math.min(99, (el / duration) * 100));
      } else {
        setProgress(p => p >= 95 ? 95 : p + 0.5);
      }
    }, 100);
    return () => { clearInterval(di); clearInterval(pi); };
  }, [duration]);
  return (
    <div style={{
      display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", padding:"64px 40px", position:"relative", overflow:"hidden",
    }}>
      {/* Scan line */}
      <div style={{
        position:"absolute", left:0, right:0, height:1,
        background:`linear-gradient(90deg,transparent,${C.accent}60,transparent)`,
        animation:"scanV 2.5s linear infinite", pointerEvents:"none", top:0,
      }} />
      {/* Rings */}
      <div style={{ position:"relative", width:88, height:88, marginBottom:28, flexShrink:0 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            position:"absolute",
            inset: i * 12, borderRadius:"50%",
            border: `1px solid ${C.accent}${["40","28","18"][i]}`,
            animation:`pulseRing ${1.4 + i * .4}s ease-out infinite ${i * .35}s`,
          }} />
        ))}
        <div style={{
          position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <div style={{
            width:36, height:36, borderRadius:"50%",
            border:`2px solid ${C.accent}25`,
            borderTopColor: C.accent, borderRightColor:`${C.accent}80`,
            animation:"spin .55s linear infinite",
          }} />
        </div>
        <div style={{
          position:"absolute", inset:6, borderRadius:"50%",
          border:`1px solid ${C.accent}15`,
          borderBottomColor: C.accent,
          animation:"spin 1.4s linear infinite reverse",
        }} />
      </div>
      {/* Progress bar */}
      <div style={{
        width:220, height:2, background:`${C.accent}15`, borderRadius:2, marginBottom:18, overflow:"hidden",
      }}>
        <div style={{
          height:"100%", borderRadius:2,
          background:`linear-gradient(90deg,${C.accent}80,${C.accent},${C.accent}80)`,
          backgroundSize:"200% auto", animation:"shimmer 1.2s linear infinite",
          width:`${progress}%`, transition:"width .06s linear",
          boxShadow:`0 0 8px ${C.accent}`,
        }} />
      </div>
      <div style={{ fontFamily:font, fontSize:10, color:C.accent, letterSpacing:".25em", textTransform:"uppercase" }}>
        {message}{dots}
      </div>
      <div style={{ marginTop:8, fontFamily:font, fontSize:9, color:C.textMuted, letterSpacing:".1em" }}>
        {Math.round(progress)}%{duration > 0 ? ` · ${Math.round(elapsed)}s / ${duration}s` : ` · ${Math.round(elapsed)}s elapsed`}
      </div>
    </div>
  );
};

const Btn = ({ children, onClick, color, disabled, sm, danger, ghost, sx = {} }) => {
  const C = useTheme();
  const c = danger ? C.danger : (color || C.accent);
  const [h, setH] = useState(false);
  const [active, setActive] = useState(false);
  return (
    <button
      className="btn-base"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => { setH(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        padding: sm ? "4px 12px" : "8px 18px",
        background: ghost ? "transparent"
          : disabled ? `${C.textDim}20`
          : h ? `${c}22` : `${c}12`,
        color: disabled ? C.textMuted : c,
        border: `1px solid ${disabled ? C.textDim + "20" : h ? c + "70" : c + "38"}`,
        borderRadius: 3, cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: font, fontSize: sm ? 10 : 12,
        letterSpacing:".08em", textTransform:"uppercase", fontWeight:700,
        display:"inline-flex", alignItems:"center", gap:6,
        boxShadow: h && !disabled ? `0 0 18px ${c}25, inset 0 0 12px ${c}08` : "none",
        transform: active ? "scale(.96)" : "scale(1)",
        ...sx,
      }}
    >{children}</button>
  );
};

const Input = ({ label, value, onChange, placeholder, type = "text", sx = {} }) => {
  const C = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom:8, ...sx }}>
      {label && (
        <label style={{
          display:"block", fontSize:9, color: focused ? C.accent : C.textMuted,
          textTransform:"uppercase", letterSpacing:".14em", marginBottom:4,
          fontFamily:font, fontWeight:700, transition:"color .15s",
        }}>{label}</label>
      )}
      <input
        type={type} value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width:"100%", padding:"7px 11px",
          background: focused ? `${C.accent}06` : C.bgInput,
          border: `1px solid ${focused ? C.accent + "60" : C.border}`,
          borderRadius:3, color:C.text,
          fontFamily:font, fontSize:12, outline:"none", transition:"all .18s",
          boxShadow: focused ? `0 0 0 3px ${C.accent}12, 0 0 16px ${C.accent}10` : "none",
        }}
      />
    </div>
  );
};

const Select = ({ label, value, onChange, options }) => {
  const C = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom:8 }}>
      {label && (
        <label style={{
          display:"block", fontSize:9, color: focused ? C.accent : C.textMuted,
          textTransform:"uppercase", letterSpacing:".14em", marginBottom:4,
          fontFamily:font, fontWeight:700, transition:"color .15s",
        }}>{label}</label>
      )}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width:"100%", padding:"7px 11px",
          background: C.bgInput, border:`1px solid ${focused ? C.accent + "60" : C.border}`,
          borderRadius:3, color:C.text, fontFamily:font, fontSize:11, outline:"none",
          cursor:"pointer", transition:"all .18s",
          boxShadow: focused ? `0 0 0 3px ${C.accent}12` : "none",
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ background: C.bgInput }}>{o.label}</option>
        ))}
      </select>
    </div>
  );
};

const Card = ({ title, children, color, accent, sx = {}, className="" }) => {
  const C = useTheme();
  const c = color || C.accent;
  return (
    <div
      className={`anim-up card-hover ${className}`}
      style={{
        background: C.bgCard, borderRadius:6, padding:16, marginBottom:12,
        border: `1px solid ${c}18`,
        borderLeft: `2px solid ${c}70`,
        position:"relative", overflow:"hidden",
        backdropFilter:"blur(12px)",
        boxShadow: `0 4px 24px ${C.isDark ? "rgba(0,0,0,.5)" : "rgba(0,0,0,.08)"}, inset 0 1px 0 ${c}10`,
        ...sx,
      }}
    >
      {/* Top-right corner glow */}
      {accent && (
        <div style={{
          position:"absolute", top:0, right:0, width:80, height:80,
          background: `radial-gradient(circle at top right, ${c}10, transparent 70%)`,
          pointerEvents:"none",
        }} />
      )}
      {/* Scan line effect */}
      <div style={{
        position:"absolute", top:0, left:0, right:0, height:1,
        background:`linear-gradient(90deg,transparent,${c}30,transparent)`,
        pointerEvents:"none",
      }} />
      {title && (
        <div style={{
          fontSize:10, color:c, textTransform:"uppercase",
          letterSpacing:".16em", marginBottom:10, fontFamily:fontDisplay,
          fontWeight:700, display:"flex", alignItems:"center", gap:8,
        }}>
          <span style={{
            width:5, height:5, background:c, borderRadius:"50%",
            boxShadow:`0 0 8px ${c}, 0 0 16px ${c}60`,
            flexShrink:0, display:"block",
            animation:"dotPulse 2s ease-in-out infinite",
          }} />
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
    <div className="anim-count card-hover" style={{
      background: C.bgCard, border:`1px solid ${c}20`,
      borderRadius:6, padding:"12px 16px", minWidth:90, flex:1,
      position:"relative", overflow:"hidden",
      boxShadow:`0 4px 20px ${C.isDark ? "rgba(0,0,0,.4)" : "rgba(0,0,0,.06)"}`,
      backdropFilter:"blur(8px)",
    }}>
      <div style={{
        position:"absolute", bottom:0, right:0, width:60, height:60,
        background:`radial-gradient(circle at bottom right, ${c}12, transparent 70%)`,
        pointerEvents:"none",
      }} />
      <div style={{
        fontSize:10, color:C.textMuted, textTransform:"uppercase",
        letterSpacing:".12em", fontFamily:font, marginBottom:6, display:"flex", alignItems:"center", gap:5,
      }}>
        <span>{icon}</span>{label}
      </div>
      <div style={{
        fontSize:24, color:c, fontFamily:fontDisplay, fontWeight:700,
        textShadow:`0 0 20px ${c}50`,
      }}>{value}</div>
    </div>
  );
};

const Log = ({ lines = [], maxH = 180 }) => {
  const C = useTheme();
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [lines]);
  return (
    <div ref={ref} style={{
      background: C.isDark ? "#02060e" : "#f8fafc",
      border:`1px solid ${C.border}`,
      borderRadius:4, padding:"10px 12px",
      fontFamily:font, fontSize:10, color:C.accent,
      maxHeight:maxH, overflowY:"auto",
      whiteSpace:"pre-wrap", wordBreak:"break-all", lineHeight:1.7,
      boxShadow:`inset 0 2px 8px ${C.isDark ? "rgba(0,0,0,.6)" : "rgba(0,0,0,.04)"}`,
    }}>
      {lines.length === 0 && (
        <span style={{ color:C.textMuted }}>
          <span style={{ animation:"blink 1s step-end infinite", display:"inline-block" }}>▋</span>
          {" "}Awaiting output...
        </span>
      )}
      {lines.map((l, i) => {
        let isJson = false;
        let formatted = l;
        try {
          if (l.trim().startsWith("{") || l.trim().startsWith("[")) {
            const parsed = JSON.parse(l);
            formatted = JSON.stringify(parsed, null, 2);
            isJson = true;
          }
        } catch(e) {}
        return (
          <div key={i} className="anim-fade" style={{ display:"flex", gap:8, marginBottom: isJson ? 6 : 0 }}>
            <span style={{ color:`${C.accent}50`, flexShrink:0 }}>›</span>
            {isJson ? (
              <pre style={{ margin:0, padding:"6px 10px", background:`${C.accent}05`, borderRadius:3, border:`1px solid ${C.border}`, fontSize:10, color:C.info, overflowX:"auto", maxWidth:"100%", lineHeight:1.5 }}>
                {formatted}
              </pre>
            ) : (
              <span style={{ color: l.includes("error") || l.includes("Error") || l.includes("fail") ? C.danger : l.includes("success") || l.includes("✓") ? C.accent : C.text }}>{l}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

const Table = ({ cols, data, onRow }) => {
  const C = useTheme();
  return (
    <div style={{ overflowX:"auto", borderRadius:4 }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:font, fontSize:12 }}>
        <thead>
          <tr style={{ background:`${C.accent}08` }}>
            {cols.map(c => (
              <th key={c.key} style={{
                textAlign:"left", padding:"8px 10px", color:C.accent,
                borderBottom:`1px solid ${C.border}`,
                fontSize:10, textTransform:"uppercase", letterSpacing:".12em",
                whiteSpace:"nowrap", fontWeight:700, fontFamily:fontDisplay,
              }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={i} onClick={() => onRow?.(r)}
              style={{
                cursor: onRow ? "pointer" : "default",
                borderBottom:`1px solid ${C.border}40`,
                transition:"all .15s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = C.bgHover;
                if (onRow) e.currentTarget.style.boxShadow = `inset 2px 0 0 ${C.accent}`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {cols.map(c => (
                <td key={c.key} style={{ padding:"7px 10px", color:C.text, whiteSpace:"nowrap" }}>
                  {c.render ? c.render(r[c.key], r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={cols.length} style={{
                padding:28, textAlign:"center", color:C.textMuted,
                fontStyle:"italic",
              }}>No data available</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const PageTitle = ({ children, sub }) => {
  const C = useTheme();
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
        <div style={{ width:3, height:22, background:C.accent, borderRadius:2, boxShadow:`0 0 10px ${C.accent}` }} />
        <h2 style={{
          fontFamily:fontDisplay, color:C.accent, fontSize:18, fontWeight:700,
          margin:0, letterSpacing:".12em", textTransform:"uppercase",
          textShadow:`0 0 20px ${C.accent}40`,
        }}>{children}</h2>
      </div>
      {sub && (
        <div style={{ fontSize:11, color:C.textMuted, fontFamily:font, marginTop:3, paddingLeft:13 }}>
          {sub}
        </div>
      )}
    </div>
  );
};

const Grid = ({ cols = 2, gap = 12, children }) => (
  <div style={{ display:"grid", gridTemplateColumns:`repeat(${cols}, 1fr)`, gap }}>{children}</div>
);
const Row = ({ gap = 8, wrap, children, sx = {} }) => (
  <div style={{ display:"flex", gap, flexWrap:wrap ? "wrap" : "nowrap", ...sx }}>{children}</div>
);

// ═══════════════════════════════════════════
// PAGE: DASHBOARD
// ═══════════════════════════════════════════
function DashboardPage() {
  const C = useTheme();
  const [pf, setPf] = useState(null);
  const [ld, setLd] = useState(false);
  const run = async () => { setLd(true); setPf(await api("/system/preflight")); setLd(false); };
  useEffect(() => { run(); }, []);
  const t = pf?.tools || {};
  const inst = Object.values(t).filter(x => x.installed).length;
  const tot = Object.keys(t).length;
  if (ld) return <LoadingOverlay message="Running system preflight checks" />;
  return (
    <div className="page-in">
      <PageTitle sub="System health, tools inventory, and environment verification">System Overview</PageTitle>
      {/* Hero status */}
      <div className="anim-up" style={{ padding:"20px 24px", marginBottom:16, borderRadius:8, background: pf?.ready ? `${C.accent}06` : `${C.danger}08`, border:`1px solid ${pf?.ready ? C.accent : C.danger}25`, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, transparent, ${pf?.ready ? C.accent : C.danger}60, transparent)` }} />
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:48, height:48, borderRadius:"50%", background:`${pf?.ready ? C.accent : C.danger}15`, border:`2px solid ${pf?.ready ? C.accent : C.danger}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, animation: pf?.ready ? "none" : "pulse 1.5s infinite" }}>
            {pf?.ready ? "✓" : "!"}
          </div>
          <div>
            <div style={{ fontFamily:fontDisplay, fontSize:20, fontWeight:900, color: pf?.ready ? C.accent : C.danger, letterSpacing:".1em", textShadow:`0 0 20px ${pf?.ready ? C.accent : C.danger}50` }}>
              {pf?.ready ? "SYSTEM READY" : "SYSTEM NOT READY"}
            </div>
            <div style={{ fontFamily:font, fontSize:11, color:C.textMuted, marginTop:2 }}>
              {pf?.system?.distro || "Unknown OS"} · Python {pf?.system?.python || "?"} · {pf?.system?.is_root ? "Running as root ✓" : "NOT running as root ✗"}
            </div>
          </div>
        </div>
      </div>
      <Row gap={10} wrap>
        {[
          ["STATUS", pf?.ready ? "READY" : "NOT READY", pf?.ready ? C.accent : C.danger, "◉"],
          ["ROOT", pf?.system?.is_root ? "YES" : "NO", pf?.system?.is_root ? C.accent : C.danger, "⚡"],
          ["TOOLS", `${inst}/${tot}`, inst === tot ? C.accent : C.warn, "⚙"],
          ["DISTRO", pf?.system?.distro?.slice(0, 20) || "—", C.info, "▣"],
        ].map(([l, v, c, i]) => <Stat key={l} label={l} value={v} color={c} icon={i} />)}
      </Row>
      {pf?.missing_critical?.length > 0 && (
        <Card title="Missing Critical Tools" color={C.danger} accent>
          {pf.missing_critical.map(x => (
            <div key={x} style={{ color:C.danger, fontSize:11, fontFamily:font, marginBottom:4, display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ color:C.danger }}>✗</span>
              <span style={{ color:C.text }}>{x}</span>
              <span style={{ color:C.warn }}>sudo apt install {t[x]?.package}</span>
            </div>
          ))}
        </Card>
      )}
      <Card title="Tool Inventory" accent>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px,1fr))", gap:6 }}>
          {Object.entries(t).map(([n, info]) => (
            <div key={n} style={{
              display:"flex", justifyContent:"space-between", alignItems:"center",
              padding:"6px 10px", background:C.bgInput, borderRadius:3,
              border:`1px solid ${info.installed ? C.accent + "18" : C.danger + "18"}`,
              transition:"border-color .2s",
            }}>
              <span style={{ fontFamily:font, fontSize:11, color:C.text }}>{n}</span>
              <Row gap={4}>
                <Badge color={C.textMuted} sm>{info.category}</Badge>
                <Badge color={info.installed ? C.accent : C.danger} sm>{info.installed ? "OK" : "✗"}</Badge>
              </Row>
            </div>
          ))}
        </div>
      </Card>
      {pf?.warnings?.map((w, i) => (
        <div key={i} style={{
          padding:"9px 14px", background:`${C.warn}08`, border:`1px solid ${C.warn}25`,
          borderLeft:`3px solid ${C.warn}`, borderRadius:4, color:C.warn,
          fontSize:11, fontFamily:font, marginTop:8, display:"flex", gap:8, alignItems:"center",
        }}>
          <span>⚠</span> {w}
        </div>
      ))}
      <Btn onClick={run} sx={{ marginTop:12 }}>↺ Re-run Preflight</Btn>
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
  const act = async (n, a) => {
    setLog(p => [...p, `${a} → ${n}`]);
    const r = await api(`/interfaces/${n}/${a}`, { method:"POST" });
    setLog(p => [...p, JSON.stringify(r, null, 2)]);
    refresh();
  };
  const chgMac = async n => {
    const q = vendor ? `?vendor_prefix=${vendor}` : mac ? `?new_mac=${mac}` : "";
    setLog(p => [...p, `MAC change on ${n}${q}`]);
    const r = await api(`/interfaces/${n}/mac${q}`, { method:"POST" });
    setLog(p => [...p, JSON.stringify(r, null, 2)]);
    refresh();
  };
  const getChannels = async n => {
    const r = await api(`/interfaces/${n}/channels`);
    setLog(p => [...p, `Channels for ${n}:`, JSON.stringify(r, null, 2)]);
  };
  return (
    <div className="page-in">
      <PageTitle sub="Manage wireless adapters — monitor mode, MAC spoofing, TX power, channel support">Network Interfaces</PageTitle>
      <Btn onClick={refresh} disabled={ld} sx={{ marginBottom:14 }}>
        {ld ? <><Spinner size={12} /> Scanning...</> : "↺ Refresh Interfaces"}
      </Btn>
      <div style={{ display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", marginBottom:16 }}>
        {ifs.map(i => {
          const modeColor = i.mode === "monitor" ? C.accent : C.info;
          const isUp = i.is_up;
          return (
          <div key={i.name} className="anim-up card-hover" style={{
            background:C.bgCard, borderRadius:8, overflow:"hidden",
            border:`1px solid ${modeColor}20`,
            boxShadow:`0 4px 24px ${C.isDark ? "rgba(0,0,0,.5)" : "rgba(0,0,0,.08)"}`,
            backdropFilter:"blur(12px)", position:"relative",
          }}>
            {/* Top accent bar */}
            <div style={{ height:3, background:`linear-gradient(90deg, ${modeColor}80, ${modeColor}20, transparent)` }} />
            {/* Header */}
            <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background: isUp ? modeColor : C.danger, boxShadow:`0 0 8px ${isUp ? modeColor : C.danger}`, animation: i.mode === "monitor" ? "pulse 2s infinite" : "none" }} />
                <span style={{ fontFamily:fontDisplay, fontSize:14, color:modeColor, fontWeight:700, letterSpacing:".08em" }}>{i.name}</span>
              </div>
              <Row gap={4}>
                <Badge color={modeColor}>{i.mode}</Badge>
                <Badge color={isUp ? C.accent : C.danger} sm>{isUp ? "UP" : "DOWN"}</Badge>
              </Row>
            </div>
            {/* Body */}
            <div style={{ padding:"12px 16px" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, fontFamily:font, fontSize:12, marginBottom:12 }}>
                {[["MAC", i.mac || "—"], ["Driver", i.driver || "—"], ["Chipset", (i.chipset || "—").slice(0,30)], ["TX Power", i.tx_power ? `${i.tx_power} dBm` : "—"]].map(([k, v]) => (
                  <div key={k} style={{ padding:"5px 8px", background:C.bgInput, borderRadius:3, border:`1px solid ${C.border}40` }}>
                    <div style={{ fontSize:9, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em", marginBottom:2 }}>{k}</div>
                    <div style={{ color:C.text, fontSize:11, wordBreak:"break-all" }}>{v}</div>
                  </div>
                ))}
              </div>
              <Row gap={4} sx={{ marginBottom:10 }}>
                <Badge color={i.supports_5ghz ? C.accent : C.textMuted} sm>5 GHz: {i.supports_5ghz ? "✓" : "✗"}</Badge>
                <Badge color={i.supports_monitor ? C.accent : C.textMuted} sm>Monitor: {i.supports_monitor ? "✓" : "✗"}</Badge>
              </Row>
              <Row gap={6} sx={{ flexWrap:"wrap" }}>
                {i.mode === "managed"
                  ? <Btn sm onClick={() => act(i.name, "monitor")} color={C.accent}>▶ Monitor Mode</Btn>
                  : <Btn sm onClick={() => act(i.name, "managed")} color={C.warn}>◼ Managed Mode</Btn>}
                <Btn sm onClick={() => chgMac(i.name)} color={C.purple}>MAC Spoof</Btn>
                <Btn sm onClick={() => getChannels(i.name)} color={C.info} ghost>Channels</Btn>
              </Row>
            </div>
          </div>
        );})}
        {ifs.length === 0 && !ld && (
          <div style={{ color:C.textMuted, fontFamily:font, padding:30, textAlign:"center" }}>No wireless interfaces detected. Connect a WiFi adapter.</div>
        )}
      </div>
      <Grid cols={2}>
        <Input label="Custom MAC" value={mac} onChange={setMac} placeholder="AA:BB:CC:DD:EE:FF" />
        <Input label="Vendor Prefix (spoof)" value={vendor} onChange={setVendor} placeholder="00:1A:2B (mimics vendor)" />
      </Grid>
      <Card title="Operations Log" color={C.accentDim}><Log lines={log} /></Card>
    </div>
  );
}

// ═══════════════════════════════════════════
// PAGE: WIFI SCAN
// ═══════════════════════════════════════════
function WifiScanPage() {
  const C = useTheme();
  const [iface, sI] = useState("wlan0mon"); const [ch, sCh] = useState(""); const [dur, sD] = useState("30");
  const [bssid, sB] = useState(""); const [essid, sE] = useState(""); const [band, sBa] = useState("bg");
  const [scanning, setSc] = useState(false); const [res, sR] = useState(null);
  const [sel, sS] = useState(null); const [pnl, sPnl] = useState(null);
  const [scans, setScans] = useState([]);
  const bands = [{ value:"bg", label:"2.4 GHz" }, { value:"a", label:"5 GHz" }, { value:"abg", label:"Dual-Band" }];
  const scan = async () => {
    setSc(true); sR(null); sPnl(null);
    const r = await api("/wifi/scan", { method:"POST", body:JSON.stringify({ interface:iface, duration:parseInt(dur) || 30, channel:ch ? parseInt(ch) : null, target_bssid:bssid || null, target_essid:essid || null, band }) });
    sR(r); setSc(false); loadScans();
  };
  const loadScans = async () => { const d = await api("/wifi/scans"); if (Array.isArray(d)) setScans(d); };
  const loadScan = async id => { const d = await api(`/wifi/scans/${id}`); sR(d); };
  const loadPnl = async id => { const r = await api(`/wifi/scans/${id}/pnl`); sPnl(r); };
  useEffect(() => { loadScans(); }, []);
  const aps = res?.access_points || []; const clients = res?.clients || [];
  const apCols = [
    { key:"essid", label:"ESSID", render:v => <span style={{ color:C.text, fontWeight:700 }}>{v || "<hidden>"}</span> },
    { key:"bssid", label:"BSSID" }, { key:"channel", label:"CH" },
    { key:"power", label:"PWR", render:v => <span style={{ color:v > -50 ? C.accent : v > -70 ? C.warn : C.danger }}>{v} dBm</span> },
    { key:"security", label:"SEC", render:v => <Badge color={SEC[v] || C.textMuted} sm>{v}</Badge> },
    { key:"auth", label:"AUTH" }, { key:"band", label:"Band", render:v => v || "—" },
    { key:"manufacturer", label:"Vendor", render:v => <span style={{ color:C.purple, fontSize:9 }}>{v || "—"}</span> },
    { key:"clients", label:"Cli", render:v => <span style={{ color:C.accent, fontWeight:700 }}>{v?.length || 0}</span> },
    { key:"pmkid_available", label:"PMKID", render:v => v ? <Badge color={C.warn} sm>YES</Badge> : "—" },
  ];
  return (
    <div className="page-in">
      <PageTitle sub="Discover WiFi networks with airodump-ng — 2.4 GHz, 5 GHz, and dual-band">WiFi Scanner</PageTitle>
      <Card title="Scan Configuration" accent>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr 1fr", gap:8 }}>
          <Input label="Interface" value={iface} onChange={sI} />
          <Select label="Band" value={band} onChange={sBa} options={bands} />
          <Input label="Channel" value={ch} onChange={sCh} placeholder="all" />
          <Input label="Duration (s)" value={dur} onChange={sD} />
          <Input label="Target BSSID" value={bssid} onChange={sB} placeholder="optional" />
          <Input label="Target ESSID" value={essid} onChange={sE} placeholder="optional" />
        </div>
        <Row gap={8} sx={{ marginTop:8 }}>
          <Btn onClick={scan} disabled={scanning} color={C.accent}>
            {scanning ? <><Spinner size={12} /> Scanning...</> : "▶ Start Scan"}
          </Btn>
          <Btn onClick={loadScans} sm ghost>↺ History ({scans.length})</Btn>
        </Row>
      </Card>
      {scanning && <LoadingOverlay message={`Scanning ${band === "abg" ? "dual-band" : band === "a" ? "5 GHz" : "2.4 GHz"} airwaves`} duration={parseInt(dur) || 30} />}
      {res && !scanning && <>
        <Row gap={10} wrap sx={{ marginBottom:12 }}>
          {[["Networks", aps.length, C.accent, "📡"], ["Clients", clients.length, C.purple, "📱"],
            ["Open", aps.filter(a => a.security === "open").length, C.danger, "⚠"],
            ["Enterprise", aps.filter(a => a.security?.includes("enterprise")).length, C.purple, "🏢"],
            ["WPA3", aps.filter(a => a.security === "wpa3").length, C.accent, "🔒"]
          ].map(([l, v, c, i]) => <Stat key={l} label={l} value={v} color={c} icon={i} />)}
        </Row>
        <Card title={`Access Points (${aps.length})`} accent>
          <Table cols={apCols} data={aps} onRow={sS} />
        </Card>
        {res.id && <Btn onClick={() => loadPnl(res.id)} color={C.purple} sm sx={{ marginBottom:12 }}>Analyze PNL (Preferred Network Lists)</Btn>}
      </>}
      {sel && (
        <Card title={`AP Detail: ${sel.essid || sel.bssid}`} color={C.purple} accent>
          <div style={{ fontFamily:font, fontSize:11, color:C.text, lineHeight:1.9, columnCount:2, columnGap:20 }}>
            {Object.entries(sel).map(([k, v]) => (
              <div key={k}><span style={{ color:C.accent }}>{k}:</span> {typeof v === "object" ? JSON.stringify(v) : String(v)}</div>
            ))}
          </div>
          <Btn sm onClick={() => sS(null)} sx={{ marginTop:10 }}>✕ Close</Btn>
        </Card>
      )}
      {pnl && (
        <Card title="PNL Analysis — Evil Twin Intelligence" color={C.warn} accent>
          <Row gap={10} wrap sx={{ marginBottom:10 }}>
            <Stat label="Total Clients" value={pnl.total_clients} color={C.info} />
            <Stat label="Associated" value={pnl.associated_clients} color={C.accent} />
            <Stat label="Unassociated" value={pnl.unassociated_clients} color={C.warn} />
          </Row>
          {pnl.evil_twin_candidates?.length > 0 && (
            <div style={{ padding:"10px 14px", background:`${C.danger}08`, border:`1px solid ${C.danger}25`, borderLeft:`3px solid ${C.danger}`, borderRadius:4, marginBottom:10 }}>
              <div style={{ color:C.danger, fontSize:10, fontFamily:fontDisplay, textTransform:"uppercase", letterSpacing:".15em", marginBottom:6 }}>⚠ Evil Twin Candidates</div>
              {pnl.evil_twin_candidates.map(s => (
                <div key={s} style={{ color:C.warn, fontSize:12, fontFamily:font, marginBottom:2 }}>• "{s}" — probed by multiple unassociated clients</div>
              ))}
            </div>
          )}
          {pnl.unique_probed_networks?.length > 0 && (
            <div style={{ fontFamily:font, fontSize:11, color:C.textMuted, marginBottom:8 }}>
              All probed SSIDs: {pnl.unique_probed_networks.join(", ")}
            </div>
          )}
          {pnl.clients?.map((c, i) => (
            <div key={i} style={{
              padding:"8px 12px", background:C.bgInput, borderRadius:3, marginBottom:5,
              fontFamily:font, fontSize:10,
              borderLeft:`2px solid ${c.vulnerability_notes?.length ? C.warn : C.accent}`,
            }}>
              <Row gap={8} sx={{ justifyContent:"space-between" }}>
                <span style={{ color:C.text }}>{c.client_mac}</span>
                <span style={{ color:C.purple }}>{c.manufacturer || "Unknown"}</span>
                <Badge color={c.is_associated ? C.accent : C.textMuted} sm>{c.is_associated ? "Assoc" : "Free"}</Badge>
              </Row>
              {c.probed_networks?.length > 0 && <div style={{ color:C.textMuted, marginTop:3 }}>Probes: {c.probed_networks.join(", ")}</div>}
              {c.vulnerability_notes?.map((n, j) => <div key={j} style={{ color:C.warn, fontSize:9, marginTop:2 }}>→ {n}</div>)}
            </div>
          ))}
        </Card>
      )}
      {scans.length > 0 && !scanning && (
        <Card title={`Scan History (${scans.length})`} color={C.info}>
          <div style={{ maxHeight:200, overflowY:"auto" }}>
            {scans.map(s => (
              <div key={s.id} onClick={() => loadScan(s.id)}
                style={{
                  display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"8px 12px", background: res?.id === s.id ? `${C.accent}08` : C.bgInput,
                  borderRadius:4, marginBottom:4, cursor:"pointer",
                  fontFamily:font, fontSize:11, transition:"all .15s",
                  borderLeft: res?.id === s.id ? `2px solid ${C.accent}` : `2px solid transparent`,
                }}
                onMouseEnter={e => e.currentTarget.style.background = C.bgHover}
                onMouseLeave={e => e.currentTarget.style.background = res?.id === s.id ? `${C.accent}08` : C.bgInput}
              >
                <span style={{ color:C.text }}>#{s.id} — {s.interface} ({s.band || "bg"})</span>
                <Row gap={6}>
                  <span style={{ color:C.textMuted }}>{s.access_points?.length || 0} APs</span>
                  <Badge color={s.status === "completed" ? C.accent : C.warn} sm>{s.status}</Badge>
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
// PAGE: HANDSHAKE & CRACK
// ═══════════════════════════════════════════
function HandshakePage() {
  const C = useTheme();
  const [iface, sI] = useState("wlan0mon"); const [bssid, sB] = useState(""); const [essid, sE] = useState(""); const [ch, sCh] = useState("6"); const [tout, sT] = useState("120");
  const [dea, sDa] = useState(true); const [dp, sDp] = useState("10"); const [dc, sDc] = useState(""); const [band, sBa] = useState("bg");
  const [cap, sCp] = useState(false); const [capR, sCR] = useState(null);
  const [cf, sCf] = useState(""); const [cb, sCB] = useState(""); const [wl, sWl] = useState("rockyou.txt"); const [crk, sCrk] = useState(false); const [ckR, sCkR] = useState(null);
  const [di, sDI] = useState("wlan0mon"); const [db, sDB] = useState(""); const [dcc, sDCC] = useState(""); const [dn, sDN] = useState("50"); const [de, sDE] = useState(""); const [dR, sDR] = useState(null);

  const capture = async () => {
    sCp(true); sCR(null);
    const r = await api("/wifi/handshake", { method:"POST", body:JSON.stringify({ interface:iface, target_bssid:bssid, target_essid:essid || null, channel:parseInt(ch), timeout:parseInt(tout), deauth_first:dea, deauth_packets:parseInt(dp), deauth_client:dc || null, band }) });
    sCR(r); if (r.capture_file) { sCf(r.capture_file); sCB(bssid); } sCp(false);
  };
  const crack = async () => { sCrk(true); sCkR(null); sCkR(await api("/wifi/crack", { method:"POST", body:JSON.stringify({ capture_file:cf, target_bssid:cb, wordlist:wl }) })); sCrk(false); };
  const deauth = async () => { sDR(await api("/wifi/deauth", { method:"POST", body:JSON.stringify({ interface:di, target_bssid:db, client_mac:dcc || null, packets:parseInt(dn), use_essid:de || null, reason:"audit" }) })); };

  return (
    <div className="page-in">
      <PageTitle sub="Capture WPA/WPA2 4-way handshake and crack with dictionary attack">Handshake & Crack</PageTitle>
      <Grid cols={2}>
        <Card title="1 · Capture Handshake" color={C.accent} accent>
          <Input label="Interface" value={iface} onChange={sI} />
          <Input label="Target BSSID" value={bssid} onChange={sB} placeholder="AA:BB:CC:DD:EE:FF" />
          <Input label="Target ESSID (optional)" value={essid} onChange={sE} />
          <Grid cols={3}>
            <Input label="Channel" value={ch} onChange={sCh} />
            <Input label="Timeout" value={tout} onChange={sT} />
            <Select label="Band" value={band} onChange={sBa} options={[{ value:"bg", label:"2.4G" }, { value:"a", label:"5G" }, { value:"abg", label:"Dual" }]} />
          </Grid>
          <label style={{ fontFamily:font, fontSize:10, color:C.textMuted, display:"flex", gap:8, marginBottom:8, cursor:"pointer", alignItems:"center" }}>
            <input type="checkbox" checked={dea} onChange={e => sDa(e.target.checked)} />
            Send deauth first
          </label>
          {dea && (
            <Grid cols={2}>
              <Input label="Deauth packets" value={dp} onChange={sDp} />
              <Input label="Target client MAC" value={dc} onChange={sDc} placeholder="all (broadcast)" />
            </Grid>
          )}
          <Btn onClick={capture} disabled={cap || !bssid}>
            {cap ? <><Spinner size={12} /> Capturing...</> : "▶ Capture Handshake"}
          </Btn>
          {cap && <LoadingOverlay message="Capturing WPA handshake" duration={parseInt(tout) || 120} />}
          {capR && !cap && (
            <div className="anim-up" style={{
              marginTop:14, fontFamily:font, padding:"14px 18px", borderRadius:6,
              background: capR.handshake_captured ? `${C.accent}08` : capR.error ? `${C.danger}08` : `${C.warn}08`,
              border: `1px solid ${capR.handshake_captured ? C.accent : capR.error ? C.danger : C.warn}30`,
              borderLeft: `3px solid ${capR.handshake_captured ? C.accent : capR.error ? C.danger : C.warn}`,
            }}>
              {capR.error ? (
                <div style={{ color:C.danger, fontSize:13, fontWeight:600 }}>✗ Error: {capR.error}</div>
              ) : capR.handshake_captured ? (
                <div>
                  <div style={{ color:C.accent, fontSize:14, fontWeight:700, fontFamily:fontDisplay, letterSpacing:".08em" }}>✓ HANDSHAKE CAPTURED!</div>
                  <div style={{ color:C.textMuted, fontSize:11, marginTop:6 }}>Target: {capR.target_bssid} {capR.target_essid && `(${capR.target_essid})`}</div>
                  <div style={{ color:C.textMuted, fontSize:11 }}>Channel: {capR.channel}</div>
                  {capR.capture_file && <div style={{ color:C.info, fontSize:11, marginTop:4 }}>📁 {capR.capture_file}</div>}
                  <div style={{ color:C.accent, fontSize:10, marginTop:6 }}>→ File auto-loaded in Crack panel. Ready to crack.</div>
                </div>
              ) : (
                <div>
                  <div style={{ color:C.warn, fontSize:13, fontWeight:600 }}>⚠ No handshake captured</div>
                  <div style={{ color:C.textMuted, fontSize:11, marginTop:4 }}>Try: increase timeout, verify clients are connected, or use PMKID attack instead.</div>
                </div>
              )}
            </div>
          )}
        </Card>
        <Card title="2 · Crack WPA Key" color={C.warn} accent>
          <Input label="Capture File (.cap)" value={cf} onChange={sCf} />
          <Input label="Target BSSID" value={cb} onChange={sCB} />
          <Input label="Wordlist" value={wl} onChange={sWl} />
          <Btn onClick={crack} disabled={crk || !cf} color={C.warn}>
            {crk ? <><Spinner size={12} /> Cracking...</> : "▶ Crack Key"}
          </Btn>
          {ckR && (
            <div className="anim-up" style={{ marginTop:14 }}>
              {ckR.error ? (
                <div style={{ padding:"12px 16px", background:`${C.danger}08`, border:`1px solid ${C.danger}30`, borderLeft:`3px solid ${C.danger}`, borderRadius:4, fontFamily:font, fontSize:12, color:C.danger }}>
                  ✗ Error: {ckR.error}
                </div>
              ) : ckR.success ? (
                <div style={{ padding:"18px", background:`${C.accent}06`, border:`1px solid ${C.accent}30`, borderRadius:6, textAlign:"center" }}>
                  <div style={{ color:C.accent, fontSize:14, marginBottom:10, fontFamily:fontDisplay, fontWeight:700, letterSpacing:".12em" }}>✓ KEY FOUND!</div>
                  <div style={{
                    color:C.warn, fontSize:26, fontFamily:fontDisplay, fontWeight:900,
                    padding:"12px 20px", background:`${C.warn}10`, borderRadius:6,
                    border:`2px solid ${C.warn}50`, display:"inline-block",
                    textShadow:`0 0 30px ${C.warn}80`,
                    animation:"glowPulse 2s ease-in-out infinite",
                    letterSpacing:".06em",
                  }}>{ckR.key}</div>
                  <div style={{ color:C.textMuted, fontSize:11, marginTop:10, fontFamily:font }}>
                    Wordlist: {ckR.wordlist} · Target: {ckR.target_bssid}
                  </div>
                </div>
              ) : (
                <div style={{ padding:"14px 18px", background:`${C.danger}08`, border:`1px solid ${C.danger}25`, borderLeft:`3px solid ${C.danger}`, borderRadius:4 }}>
                  <div style={{ color:C.danger, fontSize:13, fontFamily:font, fontWeight:600 }}>✗ Key not found with this wordlist</div>
                  <div style={{ color:C.textMuted, fontSize:11, fontFamily:font, marginTop:4 }}>Try a different wordlist. Generate custom ones with cewl (web scraping) or crunch (pattern-based).</div>
                </div>
              )}
            </div>
          )}
        </Card>
      </Grid>
      <Card title="Deauth Tool" color={C.danger} accent>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:8 }}>
          <Input label="Interface" value={di} onChange={sDI} />
          <Input label="AP BSSID" value={db} onChange={sDB} />
          <Input label="Client MAC" value={dcc} onChange={sDCC} placeholder="broadcast" />
          <Input label="Packets" value={dn} onChange={sDN} />
          <Input label="Or ESSID" value={de} onChange={sDE} placeholder="target by name" />
        </div>
        <Btn onClick={deauth} disabled={!db && !de} color={C.danger}>⚡ Send Deauth</Btn>
        {dR && (
          <div className="anim-up" style={{ marginTop:10, padding:"12px 16px", borderRadius:4, background: dR.success ? `${C.accent}06` : dR.error ? `${C.danger}08` : `${C.warn}06`, border:`1px solid ${dR.success ? C.accent : dR.error ? C.danger : C.warn}25`, borderLeft:`3px solid ${dR.success ? C.accent : dR.error ? C.danger : C.warn}` }}>
            {dR.error ? (
              <div style={{ color:C.danger, fontFamily:font, fontSize:12 }}>✗ Error: {dR.error}</div>
            ) : (
              <div style={{ fontFamily:font, fontSize:12 }}>
                <div style={{ color: dR.success ? C.accent : C.danger, fontWeight:600 }}>{dR.success ? "✓ Deauth packets sent" : "✗ Deauth failed"}</div>
                <div style={{ color:C.textMuted, fontSize:11, marginTop:4 }}>
                  Packets: {dR.packets_sent} · Target: {dR.target} · Client: {dR.client}
                </div>
                {dR.output && <div style={{ color:C.text, fontSize:10, marginTop:6, padding:"6px 8px", background:C.bgInput, borderRadius:3, whiteSpace:"pre-wrap", maxHeight:80, overflowY:"auto" }}>{dR.output}</div>}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════
// PAGE: ADVANCED ATTACKS
// ═══════════════════════════════════════════
function AdvancedPage() {
  const C = useTheme();
  const [tab, setTab] = useState("pmkid");
  const [pI, sPI] = useState("wlan0mon"); const [pB, sPB] = useState(""); const [pCh, sPCh] = useState("6"); const [pT, sPT] = useState("60"); const [pLd, sPLd] = useState(false); const [pR, sPR] = useState(null);
  const [pcF, sPcF] = useState(""); const [pcB, sPcB] = useState(""); const [pcE, sPcE] = useState(""); const [pcW, sPcW] = useState("rockyou.txt"); const [pcLd, sPcLd] = useState(false); const [pcR, sPcR] = useState(null);
  const [aM, sAM] = useState("wlan0mon"); const [aA, sAA] = useState("wlan1"); const [aE, sAE] = useState(""); const [aCh, sACh] = useState("6"); const [aP, sAP] = useState("fakepassword123"); const [aT, sAT] = useState("300"); const [aLd, sALd] = useState(false); const [aR, sAR] = useState(null); const [aS, sAS] = useState(null);
  const [eM, sEM] = useState("wlan0mon"); const [eA, sEA] = useState("wlan1"); const [eE, sEE] = useState(""); const [eCh, sECh] = useState("6"); const [eEap, sEEap] = useState("PEAP"); const [eLd, sELd] = useState(false); const [eS, sES] = useState(null); const [eCreds, sECreds] = useState([]);
  const [w3I, sW3I] = useState("wlan0mon"); const [w3B, sW3B] = useState(""); const [w3Ch, sW3Ch] = useState("6"); const [w3T, sW3T] = useState("transition_mode"); const [w3Ld, sW3Ld] = useState(false); const [w3R, sW3R] = useState(null);

  const capPmkid = async () => { sPLd(true); sPR(null); sPR(await api("/advanced/pmkid/capture", { method:"POST", body:JSON.stringify({ interface:pI, target_bssid:pB, channel:parseInt(pCh), timeout:parseInt(pT) }) })); sPLd(false); };
  const crkPmkid = async () => { sPcLd(true); sPcR(null); sPcR(await api("/advanced/pmkid/crack", { method:"POST", body:JSON.stringify({ pmkid_file:pcF, target_bssid:pcB, target_essid:pcE, wordlist:pcW }) })); sPcLd(false); };
  const startApless = async () => { sALd(true); sAR(null); sAR(await api("/advanced/apless/start", { method:"POST", body:JSON.stringify({ monitor_interface:aM, ap_interface:aA, target_essid:aE, channel:parseInt(aCh), fake_passphrase:aP, capture_timeout:parseInt(aT) }) })); sALd(false); };
  const startEnt = async () => { sELd(true); const r = await api("/advanced/enterprise/start", { method:"POST", body:JSON.stringify({ monitor_interface:eM, ap_interface:eA, target_essid:eE, channel:parseInt(eCh), eap_type:eEap }) }); sES(r); sELd(false); };
  const stopEnt = async () => { const r = await api("/advanced/enterprise/stop", { method:"POST" }); sECreds(r.captured_credentials || []); sES(null); };
  const w3Attack = async () => { sW3Ld(true); sW3R(null); sW3R(await api("/advanced/wpa3/attack", { method:"POST", body:JSON.stringify({ interface:w3I, target_bssid:w3B, channel:parseInt(w3Ch), attack_type:w3T, timeout:60 }) })); sW3Ld(false); };
  useEffect(() => { api("/advanced/apless/status").then(sAS); api("/advanced/enterprise/status").then(sES); }, []);

  const tabs = [{ id:"pmkid", label:"PMKID", color:C.warn }, { id:"apless", label:"AP-Less", color:C.purple }, { id:"enterprise", label:"Enterprise", color:C.info }, { id:"wpa3", label:"WPA3", color:C.accent }];

  return (
    <div className="page-in">
      <PageTitle sub="PMKID clientless attack, AP-less honeypot, WPA2-Enterprise credential capture, WPA3 exploitation">Advanced Attacks</PageTitle>
      <Row gap={4} sx={{ marginBottom:16 }}>
        {tabs.map(t => (
          <Btn key={t.id} onClick={() => setTab(t.id)} color={t.color} ghost={tab !== t.id} sm
            sx={tab === t.id ? { background:`${t.color}18`, boxShadow:`0 0 14px ${t.color}25` } : {}}>
            {t.label}
          </Btn>
        ))}
      </Row>

      {tab === "pmkid" && (
        <Grid cols={2}>
          <Card title="PMKID Capture (No Clients Needed)" color={C.warn} accent>
            <div style={{ fontSize:10, color:C.textMuted, fontFamily:font, marginBottom:10, lineHeight:1.7 }}>
              Captures PMKID from the AP's first EAPOL message. No connected clients required — only the AP needs to be on.
            </div>
            <Input label="Interface (monitor)" value={pI} onChange={sPI} />
            <Input label="Target BSSID" value={pB} onChange={sPB} placeholder="AA:BB:CC:DD:EE:FF" />
            <Grid cols={2}><Input label="Channel" value={pCh} onChange={sPCh} /><Input label="Timeout (s)" value={pT} onChange={sPT} /></Grid>
            <Btn onClick={capPmkid} disabled={pLd || !pB} color={C.warn}>
              {pLd ? <><Spinner size={12} /> Capturing PMKID...</> : "▶ Capture PMKID"}
            </Btn>
            {pR && (
              <div className="anim-up" style={{ marginTop:12, padding:"12px 16px", borderRadius:6, background: pR.pmkid_captured ? `${C.accent}08` : pR.error ? `${C.danger}08` : `${C.warn}08`, border:`1px solid ${pR.pmkid_captured ? C.accent : pR.error ? C.danger : C.warn}30`, borderLeft:`3px solid ${pR.pmkid_captured ? C.accent : pR.error ? C.danger : C.warn}` }}>
                {pR.error ? (
                  <div style={{ color:C.danger, fontFamily:font, fontSize:12 }}>✗ Error: {pR.error}</div>
                ) : pR.pmkid_captured ? (
                  <div>
                    <div style={{ color:C.accent, fontSize:14, fontWeight:700, fontFamily:fontDisplay }}>✓ PMKID CAPTURED!</div>
                    <div style={{ color:C.textMuted, fontSize:11, fontFamily:font, marginTop:4 }}>Method: <span style={{ color:C.info }}>{pR.method}</span></div>
                    {pR.hash_file && <div style={{ color:C.warn, fontSize:11, fontFamily:font, marginTop:2 }}>Hash file: {pR.hash_file}</div>}
                    <div style={{ color:C.accent, fontSize:10, fontFamily:font, marginTop:6 }}>→ Ready to crack. Use the Crack panel on the right.</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ color:C.warn, fontSize:13, fontFamily:font, fontWeight:600 }}>⚠ No PMKID captured</div>
                    <div style={{ color:C.textMuted, fontSize:11, fontFamily:font, marginTop:4 }}>This AP may not support PMKID. Try traditional handshake capture instead.</div>
                    <div style={{ color:C.textMuted, fontSize:10, fontFamily:font, marginTop:2 }}>Method used: {pR.method}</div>
                  </div>
                )}
              </div>
            )}
          </Card>
          <Card title="Crack PMKID" color={C.warn} accent>
            <div style={{ fontSize:10, color:C.textMuted, fontFamily:font, marginBottom:10, lineHeight:1.7 }}>
              Crack using hashcat (GPU, fast) for .22000 files or aircrack-ng for .cap files.
            </div>
            <Input label="PMKID File (.22000 or .cap)" value={pcF} onChange={sPcF} />
            <Input label="Target BSSID" value={pcB} onChange={sPcB} />
            <Input label="Target ESSID" value={pcE} onChange={sPcE} />
            <Input label="Wordlist" value={pcW} onChange={sPcW} />
            <Btn onClick={crkPmkid} disabled={pcLd || !pcF} color={C.warn}>
              {pcLd ? <><Spinner size={12} /> Cracking...</> : "▶ Crack PMKID"}
            </Btn>
            {pcR && (
              <div className="anim-up" style={{ marginTop:10, fontFamily:font }}>
                {pcR.success
                  ? <div><div style={{ color:C.accent, fontSize:13 }}>✓ KEY FOUND:</div><div style={{ color:C.warn, fontSize:18, fontFamily:fontDisplay, fontWeight:700, marginTop:4 }}>{pcR.key}</div></div>
                  : <div style={{ color:C.danger }}>✗ Not found in wordlist</div>}
              </div>
            )}
          </Card>
        </Grid>
      )}

      {tab === "apless" && (
        <Card title="AP-Less Honeypot Attack" color={C.purple} accent>
          <div style={{ fontSize:10, color:C.textMuted, fontFamily:font, marginBottom:10, lineHeight:1.7, maxWidth:700 }}>
            Creates a fake AP with the target ESSID using hostapd. When a client with this SSID in its PNL tries to connect, the WPA handshake is captured.{" "}
            <span style={{ color:C.warn }}>Requires TWO WiFi adapters.</span>
          </div>
          <Grid cols={3}>
            <Input label="Monitor Interface" value={aM} onChange={sAM} />
            <Input label="AP Interface (2nd card)" value={aA} onChange={sAA} />
            <Input label="Target ESSID" value={aE} onChange={sAE} placeholder="Corp_WiFi" />
          </Grid>
          <Grid cols={3}>
            <Input label="Channel" value={aCh} onChange={sACh} />
            <Input label="Fake Passphrase" value={aP} onChange={sAP} />
            <Input label="Timeout (s)" value={aT} onChange={sAT} />
          </Grid>
          <Btn onClick={startApless} disabled={aLd || !aE} color={C.purple}>
            {aLd ? <><Spinner size={12} /> Running honeypot...</> : "▶ Launch AP-Less Attack"}
          </Btn>
          {aR && (
            <div className="anim-up" style={{ marginTop:12, padding:"14px 18px", borderRadius:6, fontFamily:font, fontSize:12, background: aR.handshake_captured ? `${C.accent}08` : aR.error ? `${C.danger}08` : `${C.warn}08`, border:`1px solid ${aR.handshake_captured ? C.accent : aR.error ? C.danger : C.warn}30`, borderLeft:`3px solid ${aR.handshake_captured ? C.accent : aR.error ? C.danger : C.warn}` }}>
              {aR.error ? (
                <div style={{ color:C.danger }}>✗ Error: {aR.error}</div>
              ) : aR.handshake_captured ? (
                <div>
                  <div style={{ color:C.accent, fontSize:14, fontWeight:700, fontFamily:fontDisplay }}>✓ HANDSHAKE CAPTURED from probing client!</div>
                  {aR.capture_file && <div style={{ color:C.info, fontSize:11, marginTop:4 }}>📁 {aR.capture_file}</div>}
                  <div style={{ color:C.accent, fontSize:10, marginTop:6 }}>→ The client attempted to authenticate with the real password. Crack the handshake to retrieve it.</div>
                </div>
              ) : (
                <div>
                  <div style={{ color:C.warn, fontSize:13, fontWeight:600 }}>⚠ No handshake captured</div>
                  <div style={{ color:C.textMuted, fontSize:11, marginTop:4 }}>No client probed for this SSID during the capture window. Try increasing timeout or verify that clients have this network in their PNL.</div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {tab === "enterprise" && (
        <Card title="WPA2-Enterprise / 802.1X Attack" color={C.info} accent>
          <div style={{ fontSize:10, color:C.textMuted, fontFamily:font, marginBottom:10, lineHeight:1.7, maxWidth:700 }}>
            Deploys a rogue RADIUS server with an Evil Twin AP to intercept EAP credentials (PEAP, EAP-TTLS). Auto-generates SSL certificates.{" "}
            <span style={{ color:C.warn }}>Requires TWO WiFi adapters.</span>
          </div>
          <Grid cols={3}>
            <Input label="Monitor Interface" value={eM} onChange={sEM} />
            <Input label="AP Interface" value={eA} onChange={sEA} />
            <Input label="Target ESSID" value={eE} onChange={sEE} placeholder="Corp_Enterprise" />
          </Grid>
          <Grid cols={2}>
            <Input label="Channel" value={eCh} onChange={sECh} />
            <Select label="EAP Type" value={eEap} onChange={sEEap} options={[{ value:"PEAP", label:"PEAP (most common)" }, { value:"EAP-TTLS", label:"EAP-TTLS" }, { value:"EAP-TLS", label:"EAP-TLS (cert-based)" }]} />
          </Grid>
          {!eS?.active
            ? <Btn onClick={startEnt} disabled={eLd || !eE} color={C.info}>{eLd ? <><Spinner size={12} /> Deploying...</> : "▶ Start Enterprise Attack"}</Btn>
            : <div><Badge color={C.accent}>ACTIVE</Badge><Btn onClick={stopEnt} danger sm sx={{ marginLeft:8 }}>◼ Stop & Extract Creds</Btn></div>}
          {eCreds.length > 0 && (
            <Card title={`Captured Credentials (${eCreds.length})`} color={C.danger} sx={{ marginTop:10 }}>
              {eCreds.map((c, i) => (
                <div key={i} style={{ padding:"5px 10px", background:C.bgInput, borderRadius:3, marginBottom:4, fontFamily:font, fontSize:11 }}>
                  <Badge color={C.warn} sm>{c.type}</Badge>
                  {c.username && <span style={{ color:C.text, marginLeft:8 }}>{c.username}</span>}
                  {c.password && <span style={{ color:C.danger, marginLeft:8 }}>{c.password}</span>}
                </div>
              ))}
            </Card>
          )}
        </Card>
      )}

      {tab === "wpa3" && (
        <Card title="WPA3 / SAE Attacks" color={C.accent} accent>
          <div style={{ fontSize:10, color:C.textMuted, fontFamily:font, marginBottom:10, lineHeight:1.7, maxWidth:700 }}>
            WPA3 uses SAE (Dragonfly handshake) which resists offline dictionary attacks. However, APs in Transition Mode (WPA2+WPA3) are vulnerable to downgrade attacks.
          </div>
          <Grid cols={4}>
            <Input label="Interface" value={w3I} onChange={sW3I} />
            <Input label="Target BSSID" value={w3B} onChange={sW3B} />
            <Input label="Channel" value={w3Ch} onChange={sW3Ch} />
            <Select label="Attack Type" value={w3T} onChange={sW3T} options={[{ value:"transition_mode", label:"Check Transition Mode" }, { value:"downgrade", label:"Downgrade Exploit" }, { value:"dos", label:"SAE DoS Flood" }]} />
          </Grid>
          <Btn onClick={w3Attack} disabled={w3Ld || !w3B} color={C.accent}>
            {w3Ld ? <><Spinner size={12} /> Attacking...</> : "▶ Execute"}
          </Btn>
          {w3R && (
            <div className="anim-up" style={{ marginTop:14 }}>
              {w3R.error ? (
                <div style={{ padding:"12px 16px", background:`${C.danger}08`, border:`1px solid ${C.danger}30`, borderLeft:`3px solid ${C.danger}`, borderRadius:4, fontFamily:font, fontSize:12, color:C.danger }}>
                  ✗ Error: {w3R.error}
                </div>
              ) : (
                <div style={{ padding:"14px 18px", borderRadius:6, fontFamily:font, fontSize:12, lineHeight:1.8, background: w3R.transition_mode_detected ? `${C.warn}08` : w3R.vulnerable_to_downgrade === false ? `${C.accent}06` : `${C.info}06`, border:`1px solid ${w3R.transition_mode_detected ? C.warn : C.accent}25`, borderLeft:`3px solid ${w3R.transition_mode_detected ? C.warn : C.accent}` }}>
                  {w3R.transition_mode_detected !== undefined && (
                    <div style={{ fontFamily:fontDisplay, fontSize:14, fontWeight:700, color:w3R.transition_mode_detected ? C.warn : C.accent, marginBottom:8, letterSpacing:".06em" }}>
                      {w3R.transition_mode_detected ? "⚠ TRANSITION MODE — VULNERABLE" : "✓ WPA3-ONLY MODE — SECURE"}
                    </div>
                  )}
                  {w3R.security_info && <div style={{ color:C.text }}>{w3R.security_info}</div>}
                  {w3R.recommendation && <div style={{ color:C.info, marginTop:8, padding:"8px 12px", background:`${C.info}08`, borderRadius:4, borderLeft:`2px solid ${C.info}40` }}>{w3R.recommendation}</div>}
                  {w3R.next_steps && <div style={{ marginTop:8 }}>{w3R.next_steps.map((s, i) => <div key={i} style={{ color:C.text, fontSize:11, padding:"2px 0" }}>{s}</div>)}</div>}
                  {w3R.note && <div style={{ color:C.warn, marginTop:8, fontStyle:"italic" }}>{w3R.note}</div>}
                  {w3R.packets_sent && <div style={{ color:C.textMuted, marginTop:4 }}>Packets sent: {w3R.packets_sent}</div>}
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// PAGE: RECON
// ═══════════════════════════════════════════
function ReconPage() {
  const C = useTheme();
  const [tgt, sT] = useState("192.168.0.0/24"); const [sty, sS] = useState("quick"); const [pts, sP] = useState(""); const [ca, sCA] = useState(""); const [to, sTO] = useState("300");
  const [sc, sSc] = useState(false); const [res, sR] = useState(null); const [sel, sSel] = useState(null);
  const [ri, sRI] = useState("192.168.0.1"); const [rr, sRR] = useState(null); const [rPorts, sRPorts] = useState("22,23,53,80,443,8080,8443"); const [rLd, setRLd] = useState(false);
  const sts = [{ value:"quick", label:"Quick (Ping)" }, { value:"full", label:"Full (All Ports+OS)" }, { value:"vuln", label:"Vuln Scripts" }, { value:"os_detect", label:"OS Detect" }, { value:"service", label:"Service" }, { value:"stealth", label:"Stealth SYN" }, { value:"udp", label:"UDP Top 100" }, { value:"custom", label:"Custom Args" }];
  const doS = async () => { sSc(true); sR(null); sR(await api("/recon/scan", { method:"POST", body:JSON.stringify({ target:tgt, scan_type:sty, ports:pts || null, custom_args:ca || null, timeout:parseInt(to) }) })); sSc(false); };
  const disc = async () => { sSc(true); sR(await api(`/recon/discover?cidr=${encodeURIComponent(tgt)}`, { method:"POST" })); sSc(false); };
  const deep = async ip => { sSc(true); sR(await api(`/recon/deep/${ip}`, { method:"POST" })); sSc(false); };
  const vuln = async ip => { sSc(true); sR(await api(`/recon/vuln/${ip}`, { method:"POST" })); sSc(false); };
  const probe = async () => { setRLd(true); sRR(await api("/recon/router", { method:"POST", body:JSON.stringify({ target_ip:ri, check_default_creds:true, check_known_vulns:true }) })); setRLd(false); };
  const hosts = res?.hosts || [];
  const hc = [
    { key:"ip", label:"IP", render:v => <span style={{ color:C.text, fontWeight:700 }}>{v}</span> },
    { key:"mac", label:"MAC" }, { key:"hostname", label:"Host", render:v => v || "—" },
    { key:"os_guess", label:"OS", render:v => v ? <span style={{ color:C.purple }}>{v}</span> : "—" },
    { key:"ports", label:"Open", render:v => <span style={{ color:C.accent, fontWeight:700 }}>{v?.filter(p => p.state === "open").length || 0}</span> },
    { key:"_", label:"", render:(_, r) => <Row gap={4}><Btn sm onClick={() => deep(r.ip)} color={C.info}>Deep</Btn><Btn sm onClick={() => vuln(r.ip)} color={C.warn}>Vuln</Btn></Row> },
  ];
  return (
    <div className="page-in">
      <PageTitle sub="Network reconnaissance with nmap — 8 scan profiles, host discovery, vulnerability detection">Network Recon</PageTitle>
      <Card title="Nmap Configuration" accent>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:8 }}>
          <Input label="Target (IP/CIDR)" value={tgt} onChange={sT} />
          <Select label="Scan Type" value={sty} onChange={sS} options={sts} />
          <Input label="Ports (empty=default)" value={pts} onChange={sP} placeholder="22,80,443 or 1-65535" />
          <Input label="Timeout" value={to} onChange={sTO} />
        </div>
        {sty === "custom" && <Input label="Custom Args" value={ca} onChange={sCA} placeholder="-sS -T4 --script=http-enum" />}
        <Row gap={4} sx={{ marginTop:4, marginBottom:6 }}>
          <Btn sm ghost onClick={() => sP("1-65535")} color={C.warn}>All 65535 Ports</Btn>
          <Btn sm ghost onClick={() => sP("1-1024")} color={C.info}>Top 1024</Btn>
          <Btn sm ghost onClick={() => sP("")} color={C.textMuted}>Default</Btn>
        </Row>
        <Row gap={8} sx={{ marginTop:8 }}>
          <Btn onClick={doS} disabled={sc}>{sc ? <><Spinner size={12} /> Scanning...</> : "▶ Scan"}</Btn>
          <Btn onClick={disc} disabled={sc} color={C.accent} ghost>Quick Discover</Btn>
        </Row>
      </Card>
      {sc && <LoadingOverlay message="Running nmap scan" duration={parseInt(to) || 300} />}
      {res?.command && <div style={{ fontFamily:font, fontSize:11, color:C.textMuted, marginBottom:8, padding:"6px 10px", background:C.bgInput, borderRadius:3, borderLeft:`2px solid ${C.info}` }}>$ {res.command}</div>}
      {res && !sc && (
        <>
          {res.error ? (
            <div className="anim-up" style={{ padding:"14px 18px", background:`${C.danger}08`, border:`1px solid ${C.danger}30`, borderLeft:`3px solid ${C.danger}`, borderRadius:4, fontFamily:font, fontSize:12, color:C.danger, marginBottom:12 }}>
              ✗ Scan failed: {res.error}
            </div>
          ) : (
          <>
          <Row gap={10} sx={{ marginBottom:12 }} wrap>
            <Stat label="Hosts" value={hosts.length} color={hosts.length > 0 ? C.accent : C.warn} icon="🖥" />
            <Stat label="Type" value={res.scan_type?.toUpperCase()} color={C.purple} icon="⚡" />
            <Stat label="Status" value={res.status?.toUpperCase()} color={res.status === "completed" ? C.accent : C.danger} icon="◉" />
          </Row>
          <Card title={`Hosts (${hosts.length})`} accent><Table cols={hc} data={hosts} onRow={sSel} /></Card>
          </>)}</>
      )}
      {sel && (
        <Card title={`Host Detail: ${sel.ip}`} color={C.purple} accent>
          <div style={{ fontFamily:font, fontSize:12, lineHeight:1.7 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
              {[["IP", sel.ip, C.text], ["MAC", sel.mac || "—", C.textMuted], ["Hostname", sel.hostname || "—", C.info], ["OS", sel.os_guess || "—", C.purple]].map(([k, v, c]) => (
                <div key={k} style={{ padding:"6px 10px", background:C.bgInput, borderRadius:3 }}>
                  <div style={{ fontSize:9, color:C.textMuted, textTransform:"uppercase", letterSpacing:".1em" }}>{k}</div>
                  <div style={{ color:c, fontSize:12, marginTop:2, wordBreak:"break-all" }}>{v}</div>
                </div>
              ))}
            </div>
            {sel.ports?.filter(p => p.state === "open").length > 0 && (
              <div>
                <div style={{ fontSize:10, fontFamily:fontDisplay, color:C.accent, textTransform:"uppercase", letterSpacing:".12em", marginBottom:8 }}>
                  Open Ports ({sel.ports.filter(p => p.state === "open").length})
                </div>
                {sel.ports.filter(p => p.state === "open").map((p, i) => (
                  <div key={i} style={{ display:"flex", gap:12, padding:"5px 10px", background: i % 2 === 0 ? C.bgInput : "transparent", borderRadius:3, alignItems:"center" }}>
                    <span style={{ color:C.warn, minWidth:65, fontWeight:700 }}>{p.port}/{p.protocol}</span>
                    <span style={{ color:C.text, flex:1 }}>{p.service || "unknown"}</span>
                    {p.scripts && Object.keys(p.scripts).length > 0 && <Badge color={C.danger} sm>scripts</Badge>}
                  </div>
                ))}
              </div>
            )}
            {sel.services?.length > 0 && (
              <div style={{ marginTop:12 }}>
                <div style={{ fontSize:10, fontFamily:fontDisplay, color:C.info, textTransform:"uppercase", letterSpacing:".12em", marginBottom:8 }}>
                  Service Details
                </div>
                {sel.services.map((s, i) => (
                  <div key={i} style={{ padding:"6px 10px", background:C.bgInput, borderRadius:3, marginBottom:4, display:"flex", gap:8, alignItems:"center" }}>
                    <Badge color={C.warn} sm>{s.port}</Badge>
                    <span style={{ color:C.text }}>{s.name}</span>
                    <span style={{ color:C.accent }}>{s.product}</span>
                    {s.version && <Badge color={C.info} sm>v{s.version}</Badge>}
                    {s.extra && <span style={{ color:C.textMuted, fontSize:10 }}>({s.extra})</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <Btn sm onClick={() => sSel(null)} sx={{ marginTop:12 }}>✕ Close Detail</Btn>
        </Card>
      )}
      <Card title="🏴 CTF — Router Probe" color={C.danger} accent sx={{ marginTop:8 }}>
        <div style={{ fontSize:11, color:C.textMuted, fontFamily:font, marginBottom:8, lineHeight:1.6 }}>
          Scan the router/gateway for open management ports. Identifies HTTP panels, SSH, Telnet, and running services.
        </div>
        <Row gap={8} sx={{ alignItems:"end" }}>
          <Input label="Router IP" value={ri} onChange={sRI} sx={{ flex:1, marginBottom:0 }} />
          <Input label="Ports (editable)" value={rPorts} onChange={sRPorts} placeholder="22,23,80,443,8080,8443" sx={{ flex:1, marginBottom:0 }} />
          <Btn onClick={probe} disabled={rLd} color={C.danger}>{rLd ? <><Spinner size={12}/> Probing...</> : "▶ Probe"}</Btn>
        </Row>
        <Row gap={4} sx={{ marginTop:6 }}>
          <Btn sm ghost onClick={() => sRPorts("1-65535")} color={C.warn}>All Ports (1-65535)</Btn>
          <Btn sm ghost onClick={() => sRPorts("22,23,53,80,443,8080,8443")} color={C.info}>Common Ports</Btn>
          <Btn sm ghost onClick={() => sRPorts("21,22,23,25,53,80,110,139,143,443,445,993,995,1433,1521,3306,3389,5432,5900,8080,8443")} color={C.purple}>Extended</Btn>
        </Row>
        {rLd && <LoadingOverlay message="Probing router ports" />}
        {rr && !rLd && (
          <div className="anim-up" style={{ marginTop:14 }}>
            {rr.error ? (
              <div style={{ padding:"12px 16px", background:`${C.danger}0a`, border:`1px solid ${C.danger}30`, borderLeft:`3px solid ${C.danger}`, borderRadius:4, fontFamily:font, fontSize:12, color:C.danger }}>
                ✗ Error: {rr.error}
              </div>
            ) : (
              <div style={{ padding:"14px 18px", background: rr.reachable ? `${C.accent}06` : `${C.danger}06`, border:`1px solid ${rr.reachable ? C.accent : C.danger}25`, borderLeft:`3px solid ${rr.reachable ? C.accent : C.danger}`, borderRadius:4 }}>
                <div style={{ fontFamily:fontDisplay, fontSize:13, color: rr.reachable ? C.accent : C.danger, marginBottom:10, letterSpacing:".1em" }}>
                  {rr.reachable ? "✓ ROUTER REACHABLE" : "✗ ROUTER UNREACHABLE"}
                </div>
                {rr.reachable && (
                  <div style={{ fontFamily:font, fontSize:12, lineHeight:2 }}>
                    {rr.hostname && <div style={{ color:C.textMuted }}>Hostname: <span style={{ color:C.text }}>{rr.hostname}</span></div>}
                    {rr.os_guess && <div style={{ color:C.textMuted }}>OS: <span style={{ color:C.purple }}>{rr.os_guess}</span></div>}
                    {rr.mac && <div style={{ color:C.textMuted }}>MAC: <span style={{ color:C.text }}>{rr.mac}</span></div>}
                    <div style={{ marginTop:8, display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(130px, 1fr))", gap:6 }}>
                      {[["HTTP (80)", rr.http_open], ["HTTPS (443)", rr.https_open], ["SSH (22)", rr.ssh_open], ["Telnet (23)", rr.telnet_open]].map(([l, v]) => (
                        <div key={l} style={{ padding:"6px 10px", background:C.bgInput, borderRadius:3, border:`1px solid ${v ? (l.includes("Telnet") ? C.danger : C.accent) : C.border}30`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <span style={{ color:C.text, fontSize:11 }}>{l}</span>
                          <Badge color={v ? (l.includes("Telnet") ? C.danger : C.accent) : C.textDim} sm>{v ? "OPEN" : "—"}</Badge>
                        </div>
                      ))}
                    </div>
                    {rr.services?.length > 0 && (
                      <div style={{ marginTop:10 }}>
                        <div style={{ color:C.accent, fontSize:10, fontFamily:fontDisplay, textTransform:"uppercase", letterSpacing:".15em", marginBottom:6 }}>Detected Services</div>
                        {rr.services.map((s, i) => (
                          <div key={i} style={{ padding:"4px 10px", background:C.bgInput, borderRadius:3, marginBottom:3, display:"flex", gap:12, fontFamily:font, fontSize:11 }}>
                            <span style={{ color:C.warn, minWidth:50 }}>:{s.port}</span>
                            <span style={{ color:C.text }}>{s.name}</span>
                            <span style={{ color:C.accent }}>{s.product} {s.version}</span>
                            {s.extra && <span style={{ color:C.textMuted }}>{s.extra}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {rr.all_ports?.filter(p => p.state === "open").length > 0 && (
                      <div style={{ marginTop:8 }}>
                        <div style={{ color:C.info, fontSize:10, fontFamily:fontDisplay, textTransform:"uppercase", letterSpacing:".15em", marginBottom:6 }}>All Open Ports</div>
                        <Row gap={4} wrap>
                          {rr.all_ports.filter(p => p.state === "open").map((p, i) => (
                            <Badge key={i} color={C.info} sm>{p.port}/{p.protocol}</Badge>
                          ))}
                        </Row>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════
// PAGE: ATTACKS (Evil Twin + MITM)
// ═══════════════════════════════════════════
function AttacksPage() {
  const C = useTheme();
  const [ei, sEI] = useState("wlan1"); const [ee, sEE] = useState(""); const [ec, sEC] = useState("6"); const [en, sEN] = useState("eth0"); const [ecp, sECP] = useState(false);
  const [edl, sEDL] = useState(false); const [edi, sEDI] = useState("wlan0mon"); const [edb, sEDB] = useState(""); const [edp, sEDP] = useState("50");
  const [es, sES] = useState(null); const [el, sEL] = useState(false);
  const [mi, sMI] = useState("wlan0"); const [mt, sMT] = useState(""); const [mg, sMG] = useState("192.168.0.1"); const [mp, sMP] = useState("8080"); const [mh, sMH] = useState(""); const [ms, sMS] = useState(null); const [ml, sML] = useState(false);
  const ref = async () => { sES(await api("/attacks/evil-twin/status")); sMS(await api("/attacks/mitm/status")); };
  useEffect(() => { ref(); }, []);
  const sET = async () => { sEL(true); await api("/attacks/evil-twin/start", { method:"POST", body:JSON.stringify({ interface:ei, target_essid:ee, channel:parseInt(ec), internet_interface:en || null, captive_portal:ecp, deauth_legitimate:edl, deauth_interface:edl ? edi : null, deauth_bssid:edl ? edb : null, deauth_packets:parseInt(edp) }) }); await ref(); sEL(false); };
  const xET = async () => { await api("/attacks/evil-twin/stop", { method:"POST" }); ref(); };
  const sM = async () => { sML(true); await api("/attacks/mitm/start", { method:"POST", body:JSON.stringify({ interface:mi, target_ips:mt.split(",").map(s => s.trim()).filter(Boolean), gateway:mg, proxy_port:parseInt(mp), filter_hosts:mh ? mh.split(",").map(s => s.trim()) : [] }) }); await ref(); sML(false); };
  const xM = async () => { await api("/attacks/mitm/stop", { method:"POST" }); ref(); };
  return (
    <div className="page-in">
      <PageTitle sub="Evil Twin access point with integrated deauth, Man-in-the-Middle interception">Attack Vectors</PageTitle>
      <Grid cols={2}>
        <Card title="Evil Twin AP" color={C.warn} accent>
          <Badge color={es?.active ? C.accent : C.textMuted}>{es?.active ? "ACTIVE" : "INACTIVE"}</Badge>
          {!es?.active ? (
            <div style={{ marginTop:12 }}>
              <Input label="AP Interface" value={ei} onChange={sEI} />
              <Input label="Target ESSID" value={ee} onChange={sEE} placeholder="Corp_WiFi" />
              <Grid cols={2}><Input label="Channel" value={ec} onChange={sEC} /><Input label="Internet Iface" value={en} onChange={sEN} /></Grid>
              <label style={{ fontFamily:font, fontSize:10, color:C.textMuted, display:"flex", gap:8, marginBottom:6, cursor:"pointer", alignItems:"center" }}>
                <input type="checkbox" checked={ecp} onChange={e => sECP(e.target.checked)} /> Captive Portal
              </label>
              <label style={{ fontFamily:font, fontSize:10, color:C.textMuted, display:"flex", gap:8, marginBottom:8, cursor:"pointer", alignItems:"center" }}>
                <input type="checkbox" checked={edl} onChange={e => sEDL(e.target.checked)} /> Deauth legitimate AP
              </label>
              {edl && (
                <Grid cols={3}>
                  <Input label="Deauth Interface" value={edi} onChange={sEDI} />
                  <Input label="Legit AP BSSID" value={edb} onChange={sEDB} />
                  <Input label="Pkts" value={edp} onChange={sEDP} />
                </Grid>
              )}
              <Btn onClick={sET} disabled={el || !ee} color={C.warn}>
                {el ? <><Spinner size={12} /> Launching...</> : "▶ Launch Evil Twin"}
              </Btn>
            </div>
          ) : (
            <div style={{ marginTop:12, fontFamily:font, fontSize:11, color:C.textMuted, lineHeight:1.8 }}>
              {Object.entries(es.twin || {}).map(([k, v]) => (
                <div key={k}>{k}: <span style={{ color:C.text }}>{String(v)}</span></div>
              ))}
              <Btn onClick={xET} danger sx={{ marginTop:10 }}>◼ Stop Evil Twin</Btn>
            </div>
          )}
        </Card>
        <Card title="Man-in-the-Middle" color={C.purple} accent>
          <Badge color={ms?.active ? C.accent : C.textMuted}>{ms?.active ? "ACTIVE" : "INACTIVE"}</Badge>
          {!ms?.active ? (
            <div style={{ marginTop:12 }}>
              <Input label="Interface" value={mi} onChange={sMI} />
              <Input label="Target IPs (comma sep)" value={mt} onChange={sMT} placeholder="192.168.0.50" />
              <Grid cols={2}><Input label="Gateway" value={mg} onChange={sMG} /><Input label="Proxy Port" value={mp} onChange={sMP} /></Grid>
              <Input label="Filter Hosts" value={mh} onChange={sMH} placeholder="example.com" />
              <Btn onClick={sM} disabled={ml || !mt} color={C.purple}>
                {ml ? <><Spinner size={12} /></> : "▶ Start MITM"}
              </Btn>
            </div>
          ) : (
            <div style={{ marginTop:12, fontFamily:font, fontSize:11, color:C.textMuted, lineHeight:1.8 }}>
              {Object.entries(ms.session || {}).map(([k, v]) => (
                <div key={k}>{k}: <span style={{ color:C.text }}>{Array.isArray(v) ? v.join(", ") : String(v)}</span></div>
              ))}
              <Btn onClick={xM} danger sx={{ marginTop:10 }}>◼ Stop MITM</Btn>
            </div>
          )}
        </Card>
      </Grid>
    </div>
  );
}

// ═══════════════════════════════════════════
// PAGE: CAPTURES
// ═══════════════════════════════════════════
function CapturesPage() {
  const C = useTheme();
  const [files, setF] = useState([]); const [ld, setLd] = useState(false); const [checkR, setChk] = useState(null);
  const load = async () => { setLd(true); const d = await api("/captures/"); if (Array.isArray(d)) setF(d); setLd(false); };
  useEffect(() => { load(); }, []);
  const check = async fp => { setChk(await api(`/captures/check-handshake?filepath=${encodeURIComponent(fp)}`, { method:"POST" })); };
  const del = async fp => { if (confirm("Delete this capture file?")) await api(`/captures/?filepath=${encodeURIComponent(fp)}`, { method:"DELETE" }); load(); };
  const cols = [
    { key:"filename", label:"File", render:v => <span style={{ color:C.text, fontWeight:600 }}>{v}</span> },
    { key:"file_type", label:"Type", render:v => <Badge color={C.info} sm>{v}</Badge> },
    { key:"size_bytes", label:"Size", render:v => `${(v / 1024).toFixed(1)} KB` },
    { key:"target_essid", label:"Target", render:v => v || "—" },
    { key:"created_at", label:"Date", render:v => v ? new Date(v).toLocaleDateString() : "—" },
    { key:"_", label:"", render:(_, r) => <Row gap={4}><Btn sm onClick={() => check(r.filepath)} color={C.info}>Check</Btn><Btn sm onClick={() => del(r.filepath)} danger>Del</Btn></Row> },
  ];
  return (
    <div className="page-in">
      <PageTitle sub="Manage capture files — .cap, .pcapng, .csv, .22000 — verify handshakes and PMKIDs">Capture Files</PageTitle>
      <Btn onClick={load} disabled={ld} sx={{ marginBottom:14 }}>{ld ? <><Spinner size={12} /> Loading...</> : "↺ Refresh"}</Btn>
      <Card title={`Files (${files.length})`}><Table cols={cols} data={files} /></Card>
      {checkR && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.65)", backdropFilter:"blur(6px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }} onClick={() => setChk(null)}>
          <div onClick={e => e.stopPropagation()} className="anim-up" style={{ background:C.bgCard, border:`1px solid ${C.accent}30`, borderRadius:8, padding:24, minWidth:420, maxWidth:600, boxShadow:`0 24px 80px rgba(0,0,0,.6)` }}>
            <div style={{ fontFamily:fontDisplay, fontSize:14, color:C.accent, letterSpacing:".12em", textTransform:"uppercase", marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ width:6, height:6, background:C.accent, borderRadius:"50%", boxShadow:`0 0 8px ${C.accent}` }} />
              Capture File Analysis
            </div>
            <div style={{ fontFamily:font, fontSize:12, color:C.textMuted, marginBottom:12, padding:"8px 12px", background:C.bgInput, borderRadius:4 }}>
              {checkR.filepath}
            </div>
            <Grid cols={2}>
              <div style={{ padding:"16px", background: checkR.has_handshake ? `${C.accent}08` : `${C.danger}06`, border:`1px solid ${checkR.has_handshake ? C.accent : C.danger}25`, borderRadius:6, textAlign:"center" }}>
                <div style={{ fontSize:28, marginBottom:6 }}>{checkR.has_handshake ? "✓" : "✗"}</div>
                <div style={{ fontFamily:fontDisplay, fontSize:11, color:checkR.has_handshake ? C.accent : C.danger, letterSpacing:".1em" }}>WPA HANDSHAKE</div>
                <div style={{ fontFamily:font, fontSize:10, color:C.textMuted, marginTop:4 }}>{checkR.has_handshake ? "4-way handshake present — crackable" : "No handshake found"}</div>
              </div>
              <div style={{ padding:"16px", background: checkR.has_pmkid ? `${C.warn}08` : `${C.danger}06`, border:`1px solid ${checkR.has_pmkid ? C.warn : C.danger}25`, borderRadius:6, textAlign:"center" }}>
                <div style={{ fontSize:28, marginBottom:6 }}>{checkR.has_pmkid ? "✓" : "✗"}</div>
                <div style={{ fontFamily:fontDisplay, fontSize:11, color:checkR.has_pmkid ? C.warn : C.danger, letterSpacing:".1em" }}>PMKID</div>
                <div style={{ fontFamily:font, fontSize:10, color:C.textMuted, marginTop:4 }}>{checkR.has_pmkid ? "PMKID present — crackable without clients" : "No PMKID found"}</div>
              </div>
            </Grid>
            {checkR.networks_found > 0 && (
              <div style={{ marginTop:10, fontFamily:font, fontSize:11, color:C.textMuted }}>Networks in file: <span style={{ color:C.accent }}>{checkR.networks_found}</span></div>
            )}
            {checkR.raw_output && (
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:9, fontFamily:fontDisplay, color:C.textMuted, textTransform:"uppercase", letterSpacing:".12em", marginBottom:4 }}>Raw Output</div>
                <div style={{ fontFamily:font, fontSize:10, color:C.text, background:C.bgInput, borderRadius:4, padding:"8px 10px", maxHeight:120, overflowY:"auto", whiteSpace:"pre-wrap", wordBreak:"break-all", lineHeight:1.5 }}>
                  {checkR.raw_output}
                </div>
              </div>
            )}
            <Btn onClick={() => setChk(null)} sx={{ marginTop:14, width:"100%" }}>Close</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// PAGE: SESSIONS
// ═══════════════════════════════════════════
function SessionsPage() {
  const C = useTheme();
  const [ss, sSs] = useState([]); const [sel, sSel] = useState(null); const [rpt, sRpt] = useState(null);
  const [nm, sNm] = useState(""); const [co, sCo] = useState(""); const [au, sAu] = useState(""); const [nt, sNt] = useState("");
  const [fc, sFc] = useState("wifi"); const [fs, sFs] = useState("medium"); const [ft, sFt] = useState(""); const [fd, sFd] = useState(""); const [fe, sFe] = useState(""); const [fr, sFr] = useState("");
  const ref = async () => { const d = await api("/sessions/"); if (Array.isArray(d)) sSs(d); };
  useEffect(() => { ref(); }, []);
  const ld = async id => { sSel(await api(`/sessions/${id}`)); sRpt(null); };
  const cr = async () => { await api("/sessions/", { method:"POST", body:JSON.stringify({ name:nm, company:co, auditor:au, notes:nt || null }) }); sNm(""); sCo(""); sAu(""); sNt(""); ref(); };
  const af = async () => { if (!sel) return; await api(`/sessions/${sel.id}/findings`, { method:"POST", body:JSON.stringify({ session_id:sel.id, category:fc, severity:fs, title:ft, description:fd, evidence:fe || null, recommendation:fr || null }) }); sFt(""); sFd(""); sFe(""); sFr(""); ld(sel.id); };
  const cl = async id => { await api(`/sessions/${id}/close`, { method:"POST" }); ref(); if (sel?.id === id) ld(id); };
  const ex = async id => sRpt(await api(`/sessions/${id}/report`));
  return (
    <div className="page-in">
      <PageTitle sub="Document findings, manage audit sessions, generate severity-sorted reports">Audit Sessions</PageTitle>
      <div style={{ display:"grid", gridTemplateColumns:"340px 1fr", gap:16 }}>
        <div>
          <Card title="New Session" color={C.accent} accent>
            <Input label="Session Name" value={nm} onChange={sNm} placeholder="WiFi Audit Q1 2026" />
            <Input label="Company" value={co} onChange={sCo} placeholder="Acme Corp" />
            <Input label="Auditor" value={au} onChange={sAu} placeholder="Your Name" />
            <Input label="Notes (optional)" value={nt} onChange={sNt} placeholder="Scope, objectives..." />
            <Btn onClick={cr} disabled={!nm || !co || !au} sx={{ width:"100%" }}>+ Create Session</Btn>
          </Card>
          <Card title={`Sessions (${ss.length})`}>
            {ss.length === 0 && <div style={{ color:C.textMuted, fontFamily:font, fontSize:11, padding:10, textAlign:"center" }}>No sessions yet</div>}
            {ss.map(s => {
              const active = sel?.id === s.id;
              const findingCount = s.findings?.length || 0;
              return (
                <div key={s.id} onClick={() => ld(s.id)} className="card-hover" style={{
                  padding:"10px 14px", background: active ? `${C.accent}0a` : C.bgInput,
                  border:`1px solid ${active ? C.accent + "35" : C.border}`,
                  borderRadius:6, marginBottom:6, cursor:"pointer", fontFamily:font,
                  transition:"all .18s", position:"relative", overflow:"hidden",
                }}>
                  {active && <div style={{ position:"absolute", left:0, top:0, bottom:0, width:3, background:C.accent, boxShadow:`0 0 8px ${C.accent}` }} />}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <div style={{ color:C.text, fontSize:12, fontWeight:700, marginBottom:3 }}>{s.name}</div>
                      <div style={{ color:C.textMuted, fontSize:10 }}>{s.company} · {s.auditor}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <Badge color={s.status === "active" ? C.accent : C.textMuted} sm>{s.status}</Badge>
                      {findingCount > 0 && <div style={{ color:C.textMuted, fontSize:9, marginTop:3 }}>{findingCount} findings</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
        <div>
          {sel ? (
            <>
              {/* Session header card */}
              <div className="anim-up" style={{ padding:"16px 20px", marginBottom:14, borderRadius:8, background:`${C.accent}06`, border:`1px solid ${C.accent}20`, position:"relative", overflow:"hidden" }}>
                <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${C.accent}60, transparent)` }} />
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontFamily:fontDisplay, fontSize:16, color:C.accent, fontWeight:700, letterSpacing:".06em" }}>{sel.name}</div>
                    <div style={{ fontFamily:font, fontSize:12, color:C.textMuted, marginTop:4 }}>
                      {sel.company} · {sel.auditor} · ID: {sel.id}
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <Badge color={sel.status === "active" ? C.accent : C.textMuted}>{sel.status}</Badge>
                    <div style={{ fontFamily:fontDisplay, fontSize:18, color:C.accent, fontWeight:700, marginTop:4 }}>{sel.findings?.length || 0}</div>
                    <div style={{ fontFamily:font, fontSize:9, color:C.textMuted, textTransform:"uppercase" }}>findings</div>
                  </div>
                </div>
                <Row gap={6} sx={{ marginTop:12 }}>
                  {sel.status === "active" && <Btn sm onClick={() => cl(sel.id)} color={C.warn}>Close Session</Btn>}
                  <Btn sm onClick={() => ex(sel.id)} color={C.info}>Export Report</Btn>
                </Row>
              </div>
              {sel.status === "active" && (
                <Card title="Add Finding" color={C.warn} accent>
                  <Grid cols={2}>
                    <Select label="Category" value={fc} onChange={sFc} options={[{ value:"wifi", label:"WiFi" }, { value:"network", label:"Network" }, { value:"router", label:"Router" }, { value:"credentials", label:"Credentials" }, { value:"encryption", label:"Encryption" }, { value:"access_control", label:"Access Control" }, { value:"other", label:"Other" }]} />
                    <Select label="Severity" value={fs} onChange={sFs} options={[{ value:"critical", label:"Critical" }, { value:"high", label:"High" }, { value:"medium", label:"Medium" }, { value:"low", label:"Low" }, { value:"info", label:"Info" }]} />
                  </Grid>
                  <Input label="Title" value={ft} onChange={sFt} />
                  <Input label="Description" value={fd} onChange={sFd} />
                  <Input label="Evidence" value={fe} onChange={sFe} />
                  <Input label="Recommendation" value={fr} onChange={sFr} />
                  <Btn onClick={af} disabled={!ft || !fd} color={C.warn}>+ Add Finding</Btn>
                </Card>
              )}
              {sel.findings?.length > 0 && (
                <Card title={`Findings (${sel.findings.length})`} accent>
                  {/* Severity summary bar */}
                  <div style={{ display:"flex", gap:3, marginBottom:12, borderRadius:4, overflow:"hidden", height:6 }}>
                    {["critical","high","medium","low","info"].map(sev => {
                      const count = sel.findings.filter(f => f.severity === sev).length;
                      return count > 0 ? <div key={sev} style={{ flex:count, background:SEV[sev], minWidth:2 }} /> : null;
                    })}
                  </div>
                  {sel.findings.map((f, i) => (
                    <div key={i} className="anim-up card-hover" style={{
                      padding:"12px 16px", background:C.bgInput,
                      borderLeft:`4px solid ${SEV[f.severity] || C.textMuted}`,
                      borderRadius:4, marginBottom:8, fontFamily:font, fontSize:12,
                      border:`1px solid ${C.border}40`,
                      boxShadow:`inset 0 0 20px ${SEV[f.severity]}06`,
                    }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                        <span style={{ color:C.text, fontWeight:700, fontSize:13 }}>{f.title}</span>
                        <Row gap={4}>
                          <Badge color={C.textMuted} sm>{f.category}</Badge>
                          <Badge color={SEV[f.severity]}>{f.severity}</Badge>
                        </Row>
                      </div>
                      <div style={{ color:C.textMuted, lineHeight:1.6 }}>{f.description}</div>
                      {f.evidence && <div style={{ color:C.info, fontSize:11, marginTop:6 }}>📁 Evidence: {f.evidence}</div>}
                      {f.recommendation && <div style={{ color:C.accent, fontSize:11, marginTop:4, padding:"6px 10px", background:`${C.accent}06`, borderRadius:3, borderLeft:`2px solid ${C.accent}40` }}>💡 {f.recommendation}</div>}
                      {f.timestamp && <div style={{ color:C.textDim, fontSize:9, marginTop:6 }}>{new Date(f.timestamp).toLocaleString()}</div>}
                    </div>
                  ))}
                </Card>
              )}
              {rpt && (
                <Card title="Audit Report Summary" color={C.accent} accent>
                  <div style={{ textAlign:"center", marginBottom:14 }}>
                    <div style={{ fontFamily:fontDisplay, fontSize:32, color:C.accent, fontWeight:900 }}>{rpt.audit_report?.summary?.total || 0}</div>
                    <div style={{ fontFamily:font, fontSize:10, color:C.textMuted, textTransform:"uppercase", letterSpacing:".15em" }}>Total Findings</div>
                  </div>
                  <Row gap={10} wrap>
                    {Object.entries(rpt.audit_report?.summary || {}).filter(([k]) => k !== "total").map(([s, c]) => (
                      <Stat key={s} label={s} value={c} color={SEV[s] || C.textMuted} />
                    ))}
                  </Row>
                  <div style={{ marginTop:10, fontFamily:font, fontSize:10, color:C.textMuted }}>
                    Generated: {rpt.audit_report?.generated_at ? new Date(rpt.audit_report.generated_at).toLocaleString() : "—"}
                  </div>
                </Card>
              )}
            </>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:60, color:C.textMuted }}>
              <div style={{ fontSize:40, marginBottom:12, opacity:.3 }}>📋</div>
              <div style={{ fontFamily:fontDisplay, fontSize:13, letterSpacing:".12em", textTransform:"uppercase" }}>No Session Selected</div>
              <div style={{ fontFamily:font, fontSize:11, marginTop:6 }}>Create or select a session from the left panel</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// PAGE: PROCESSES
// ═══════════════════════════════════════════
function ProcessesPage() {
  const C = useTheme();
  const [ps, sPs] = useState([]); const [ld, sLd] = useState(false);
  const ref = async () => { sLd(true); const d = await api("/system/processes"); if (Array.isArray(d)) sPs(d); sLd(false); };
  useEffect(() => { ref(); const i = setInterval(ref, 5000); return () => clearInterval(i); }, []);
  const kill = async id => { await api(`/system/processes/${id}/cancel`, { method:"POST" }); ref(); };
  const cols = [
    { key:"id", label:"ID", render:v => <span style={{ color:C.accent, fontFamily:fontDisplay, fontSize:9 }}>{v}</span> },
    { key:"command", label:"Command", render:v => <span style={{ color:C.text, maxWidth:350, display:"inline-block", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v}</span> },
    { key:"status", label:"Status", render:v => <Badge color={v === "running" ? C.accent : v === "completed" ? C.info : C.danger} sm>{v}</Badge> },
    { key:"return_code", label:"RC", render:v => v !== null ? v : "—" },
    { key:"started_at", label:"Started", render:v => v ? new Date(v).toLocaleTimeString() : "—" },
    { key:"_", label:"", render:(_, r) => r.status === "running" ? <Btn sm danger onClick={() => kill(r.id)}>Kill</Btn> : null },
  ];
  return (
    <div className="page-in">
      <PageTitle sub="Monitor and manage all background processes — airodump, nmap, hostapd, mitmproxy">Processes</PageTitle>
      <Row gap={10} sx={{ marginBottom:14 }} wrap>
        <Stat label="Total" value={ps.length} color={C.info} />
        <Stat label="Running" value={ps.filter(p => p.status === "running").length} color={C.accent} />
        <Stat label="Failed" value={ps.filter(p => p.status === "failed").length} color={C.danger} />
      </Row>
      <Card title="Managed Processes"><Table cols={cols} data={ps} /></Card>
      <Btn onClick={ref} disabled={ld} sx={{ marginTop:8 }}>↺ Refresh</Btn>
    </div>
  );
}

// ═══════════════════════════════════════════
// PAGE: HELP
// ═══════════════════════════════════════════
function HelpPage() {
  const C = useTheme();
  const [open, setOpen] = useState(null);
  const tog = id => setOpen(open === id ? null : id);
  const A = ({ children }) => <span style={{ color:C.accent, fontWeight:600 }}>{children}</span>;
  const P = ({ children }) => <p style={{ color:C.textMuted, fontSize:11, lineHeight:1.8, margin:"5px 0", fontFamily:font }}>{children}</p>;
  const Cd = ({ children }) => <code style={{ background:C.bgInput, padding:"2px 6px", borderRadius:2, fontSize:10, fontFamily:font, color:C.accent, border:`1px solid ${C.border}` }}>{children}</code>;

  const secs = [
    { id:"overview", title:"What is WFAudit?", c:() => <div><P>WFAudit is a professional WiFi security auditing platform that orchestrates industry-standard tools (aircrack-ng, nmap, hostapd, mitmproxy, hcxdumptool, hashcat, freeradius) through a REST API. It covers the full penetration testing lifecycle: reconnaissance → vulnerability assessment → exploitation → post-exploitation → reporting.</P><P><span style={{ color:C.danger }}>⚠ LEGAL:</span> Only use under a signed audit contract. Unauthorized use is illegal.</P></div> },
    { id:"workflow", title:"Recommended Audit Workflow", c:() => <div>{[["1","System Overview","Run preflight checks — verify root, tools, system readiness"],["2","Create Session","Start documentation before any scanning"],["3","Interfaces","Select WiFi adapter, enable monitor mode"],["4","WiFi Scan (dual-band)","Discover all networks on 2.4 GHz + 5 GHz simultaneously"],["5","PNL Analysis","Identify Evil Twin candidates from client probe requests"],["6","PMKID (try first)","Clientless attack — no connected clients needed"],["7","Handshake Capture","If PMKID fails, capture handshake with deauth"],["8","AP-Less Honeypot","If no clients present, create honeypot for probing devices"],["9","Enterprise Attack","If WPA2-Enterprise, deploy rogue RADIUS"],["10","WPA3 Check","If WPA3, check transition mode for downgrade"],["11","Network Recon","Map internal network after gaining access"],["12","Router Probe","CTF — attempt admin panel access"],["13","Document Findings","Record every discovery with severity and recommendation"],["14","Export Report","Generate final audit report"]].map(([n,t,d]) => <div key={n} style={{ fontFamily:font, fontSize:11, lineHeight:2.1, color:C.text, display:"flex", gap:10, alignItems:"flex-start" }}><Badge color={C.accent} sm>{n}</Badge><span><A>{t}</A> — {d}</span></div>)}</div> },
    { id:"interfaces", title:"Interfaces — WiFi Adapter Management", c:() => <div><P><A>Monitor Mode</A> is required for ALL WiFi scanning and attacks. In managed mode, your adapter only processes packets addressed to it. In monitor mode, it captures ALL WiFi packets from the air.</P><P><A>MAC Spoofing</A> changes your adapter's MAC address. Three modes: random (default), specific MAC, or vendor-spoofed (mimics a specific manufacturer).</P><P><A>5 GHz Support</A> — Many enterprise networks use 5 GHz. Your adapter must support it (Alfa AWUS036ACH recommended).</P><P><span style={{ color:C.danger }}>⚠</span> Enabling monitor mode disconnects your WiFi. Use Ethernet cable.</P></div> },
    { id:"scanner", title:"WiFi Scanner — Network Discovery", c:() => <div><P>Uses <Cd>airodump-ng</Cd> to scan WiFi airwaves. Captures beacon frames from APs and probe requests from clients.</P><P><A>Band Selection</A> — <Cd>bg</Cd> = 2.4 GHz only, <Cd>a</Cd> = 5 GHz only, <Cd>abg</Cd> = dual-band scan. Always use dual-band for complete coverage.</P><P><A>PNL Analysis</A> — Analyzes probe requests from all detected clients. Identifies which SSIDs clients are searching for, especially SSIDs that don't match any visible AP — these are perfect Evil Twin candidates.</P></div> },
    { id:"handshake", title:"Handshake & Crack — WPA/WPA2 Audit", c:() => <div><P><A>The WPA 4-Way Handshake</A> is exchanged when a client connects to a WPA2-PSK AP. It contains a hash of the password that can be cracked offline with a dictionary.</P><P><A>Step 1 — Capture:</A> <Cd>airodump-ng</Cd> listens on the target's channel. When a client (re)connects, the handshake is captured in a .cap file.</P><P><A>Step 2 — Deauth:</A> <Cd>aireplay-ng</Cd> sends deauthentication packets to force clients to reconnect.</P><P><A>Step 3 — Crack:</A> <Cd>aircrack-ng</Cd> tests each word in a dictionary against the captured handshake. Common wordlist: <Cd>rockyou.txt</Cd> (~14M passwords).</P></div> },
    { id:"pmkid", title:"PMKID — Clientless WPA2 Attack", c:() => <div><P><A>Try this FIRST</A> in any WPA2 audit. The PMKID is a hash found in the AP's first EAPOL message during authentication. You don't need any connected clients — just the AP.</P><P><A>Two capture methods:</A></P><P>• <Cd>hcxdumptool</Cd> (preferred) — Creates .pcapng files, converted to hashcat .22000 format with <Cd>hcxpcapngtool</Cd></P><P>• <Cd>airodump-ng</Cd> (fallback) — Also captures PMKIDs. Shows "PMKID" in the Notes column when found.</P></div> },
    { id:"attacks", title:"Evil Twin & MITM", c:() => <div><P><A>Evil Twin:</A> Creates a fake AP with the same ESSID. Key features in v2:</P><P>• Captive portal — Redirect all DNS to your machine for fake login pages</P><P>• Internet forwarding — Give victims internet through your machine (via iptables NAT)</P><P>• <A>Integrated deauth</A> — Simultaneously deauth the legitimate AP to force clients to your Evil Twin</P><P><A>MITM:</A> After Evil Twin or on the same network, intercept traffic between targets and the gateway using ARP spoofing with <Cd>arpspoof</Cd> and <Cd>mitmproxy</Cd>.</P></div> },
    { id:"sessions", title:"Sessions & Reporting", c:() => <div><P>Every finding must be documented with: <A>Category</A> (wifi, network, router, credentials, encryption, access_control), <A>Severity</A> (critical, high, medium, low, info), title, description, evidence (file paths, screenshots), and remediation recommendation.</P><P>The <A>Export Report</A> generates a JSON summary with findings grouped by severity and numerical counts — ready for the final audit deliverable.</P></div> },
    { id:"tips", title:"Tips for Your First WiFi Audit", c:() => <div><P><A>Preparation:</A> Bring 2+ USB WiFi adapters, Ethernet cable, Kali Linux on USB, custom wordlists. Document the scope: which networks, which hours, what limits.</P><P><A>Order of attacks for WPA2:</A> PMKID first (fastest, no clients needed) → Handshake + deauth → AP-less honeypot → Evil Twin</P><P><A>Common mistakes:</A> Forgetting monitor mode · Not having root · Only scanning 2.4 GHz · Using only rockyou.txt · Not documenting findings in real-time · Forgetting to restore managed mode when done</P><P><A>WPA3?</A> Check transition mode first. If WPA3-only, it's a positive finding.</P><P><A>Open networks?</A> Critical finding. All traffic in plaintext. Document immediately.</P></div> },
  ];

  return (
    <div className="page-in">
      <PageTitle sub="Complete documentation — what each feature does, how it works, and when to use it">Help & Documentation</PageTitle>
      {secs.map(s => (
        <div key={s.id} style={{ marginBottom:6 }}>
          <div
            onClick={() => tog(s.id)}
            style={{
              padding:"12px 16px", background:C.bgCard,
              border:`1px solid ${open === s.id ? C.accent + "40" : C.border}`,
              borderLeft:`2px solid ${open === s.id ? C.accent : "transparent"}`,
              borderRadius:open === s.id ? "6px 6px 0 0" : 6,
              cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center",
              transition:"all .2s", backdropFilter:"blur(8px)",
              boxShadow: open === s.id ? `0 0 20px ${C.accent}12` : "none",
            }}
            onMouseEnter={e => { if (open !== s.id) e.currentTarget.style.borderLeftColor = `${C.accent}60`; }}
            onMouseLeave={e => { if (open !== s.id) e.currentTarget.style.borderLeftColor = "transparent"; }}
          >
            <span style={{ fontFamily:font, fontSize:12, color:open === s.id ? C.accent : C.text, fontWeight:600 }}>{s.title}</span>
            <span style={{ color:C.accent, fontSize:14, transition:"transform .25s cubic-bezier(.22,1,.36,1)", transform:open === s.id ? "rotate(180deg)" : "rotate(0)", display:"inline-block" }}>▾</span>
          </div>
          {open === s.id && (
            <div className="anim-up" style={{
              padding:"16px 20px", background:C.bgCard,
              border:`1px solid ${C.accent}30`, borderTop:"none",
              borderRadius:"0 0 6px 6px", borderLeft:`2px solid ${C.accent}`,
              backdropFilter:"blur(8px)",
            }}>
              {s.c()}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════
// NAVIGATION CONFIG
// ═══════════════════════════════════════════
const NAV = [
  { id:"dashboard", label:"SYSTEM", icon:"◉", color:"#00ff95" },
  { id:"interfaces", label:"INTERFACES", icon:"⚡", color:"#3ab5ff" },
  { id:"wifi", label:"WIFI SCAN", icon:"◈", color:"#00ff95" },
  { id:"handshake", label:"HANDSHAKE", icon:"◎", color:"#ff9500" },
  { id:"advanced", label:"ADVANCED", icon:"⬡", color:"#c084fc" },
  { id:"recon", label:"RECON", icon:"◐", color:"#3ab5ff" },
  { id:"attacks", label:"ATTACKS", icon:"◆", color:"#ff2055" },
  { id:"captures", label:"CAPTURES", icon:"▤", color:"#ff9500" },
  { id:"sessions", label:"SESSIONS", icon:"◧", color:"#00ff95" },
  { id:"processes", label:"PROCESSES", icon:"▣", color:"#3ab5ff" },
  { id:"help", label:"HELP", icon:"?", color:"#ff9500" },
];
const PAGES = { dashboard:DashboardPage, interfaces:InterfacesPage, wifi:WifiScanPage, handshake:HandshakePage, advanced:AdvancedPage, recon:ReconPage, attacks:AttacksPage, captures:CapturesPage, sessions:SessionsPage, processes:ProcessesPage, help:HelpPage };

// ═══════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════
export default function App() {
  const [page, setPage] = useState("dashboard");
  const [time, setTime] = useState(new Date());
  const [col, setCol] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    const saved = typeof window !== 'undefined' && window.localStorage?.getItem('wfaudit-theme');
    if (saved !== null) return saved === 'dark';
    if (typeof window !== 'undefined' && window.matchMedia) return window.matchMedia('(prefers-color-scheme: dark)').matches;
    return true;
  });
  useEffect(() => { try { window.localStorage?.setItem('wfaudit-theme', isDark ? 'dark' : 'light'); } catch(e){} }, [isDark]);
  const [pageKey, setPageKey] = useState(0);
  const C = isDark ? DARK : LIGHT;

  useEffect(() => { const i = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(i); }, []);

  const navigate = (id) => {
    setPage(id);
    setPageKey(k => k + 1);
  };

  const Page = PAGES[page];

  return (
    <ThemeCtx.Provider value={C}>
      <div style={{
        display:"flex", height:"100vh",
        background:C.bg, color:C.text,
        fontFamily:font, overflow:"hidden",
        transition:"background .3s ease, color .3s ease",
      }}>
        <style>{makeCSS(C)}</style>

        {/* ── BACKGROUND EFFECTS ── */}
        <div style={{
          position:"fixed", inset:0, pointerEvents:"none", zIndex:0,
          backgroundImage:`radial-gradient(${C.accent}07 1px, transparent 1px)`,
          backgroundSize:"28px 28px",
        }} />
        {C.isDark && (
          <>
            <div style={{
              position:"fixed", top:"-20%", left:"-10%", width:"50vw", height:"50vh",
              background:`radial-gradient(ellipse, ${C.accent}06 0%, transparent 70%)`,
              pointerEvents:"none", zIndex:0,
            }} />
            <div style={{
              position:"fixed", bottom:"-20%", right:"-10%", width:"50vw", height:"50vh",
              background:`radial-gradient(ellipse, ${C.purple}05 0%, transparent 70%)`,
              pointerEvents:"none", zIndex:0,
            }} />
          </>
        )}

        {/* ── SIDEBAR ── */}
        <div style={{
          width:col ? 52 : 172, background:C.bgSidebar,
          borderRight:`1px solid ${C.border}`,
          display:"flex", flexDirection:"column",
          transition:"width .25s cubic-bezier(.22,1,.36,1)", flexShrink:0,
          position:"relative", zIndex:20,
          boxShadow:`4px 0 24px ${C.isDark ? "rgba(0,0,0,.5)" : "rgba(0,0,0,.1)"}`,
        }}>
          {/* Sidebar grid bg */}
          <div style={{
            position:"absolute", inset:0,
            backgroundImage:`radial-gradient(${C.accent}08 1px, transparent 1px)`,
            backgroundSize:"18px 18px", pointerEvents:"none",
          }} />
          {/* Top edge glow */}
          <div style={{
            position:"absolute", top:0, left:0, right:0, height:1,
            background:`linear-gradient(90deg, transparent, ${C.accent}40, transparent)`,
            pointerEvents:"none",
          }} />

          {/* Logo */}
          <div
            onClick={() => setCol(!col)}
            style={{
              padding:"16px 12px", borderBottom:`1px solid ${C.border}`,
              cursor:"pointer", position:"relative", zIndex:1,
              display:"flex", flexDirection:"column", alignItems:col ? "center" : "flex-start",
            }}
          >
            <div style={{
              fontFamily:fontDisplay, fontSize:col ? 13 : 15, color:C.accent,
              fontWeight:900, letterSpacing:col ? ".05em" : ".12em",
              textShadow:`0 0 24px ${C.accent}60, 0 0 48px ${C.accent}20`,
              transition:"all .25s",
            }}>
              {col ? "W" : "WFAUDIT"}
            </div>
            {!col && (
              <div style={{
                fontSize:8, color:C.textMuted, letterSpacing:".22em",
                marginTop:2, textTransform:"uppercase",
              }}>v2.0.0 · TACTICAL</div>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex:1, padding:"8px 0", position:"relative", zIndex:1, display:"flex", flexDirection:"column", overflowY:"auto" }}>
            {NAV.map((item) => {
              const a = page === item.id;
              const isHelp = item.id === "help";
              return (
                <div key={item.id} className="nav-item"
                  onClick={() => navigate(item.id)}
                  style={{
                    padding:col ? "10px 0" : "8px 14px",
                    cursor:"pointer",
                    background:a ? `${item.color}10` : "transparent",
                    borderLeft:a ? `2px solid ${item.color}` : "2px solid transparent",
                    color:a ? item.color : C.textMuted,
                    fontSize:9, letterSpacing:".12em",
                    display:"flex", alignItems:"center", gap:8,
                    textAlign:col ? "center" : "left",
                    justifyContent:col ? "center" : "flex-start",
                    marginTop:isHelp ? "auto" : 0,
                    borderTop:isHelp ? `1px solid ${C.border}` : "none",
                    fontFamily:fontDisplay, fontWeight:600,
                    boxShadow:a ? `inset 0 0 20px ${item.color}08` : "none",
                    transition:"all .18s cubic-bezier(.22,1,.36,1)",
                    position:"relative",
                  }}
                  onMouseEnter={e => { if (!a) { e.currentTarget.style.color = item.color; e.currentTarget.style.borderLeftColor = `${item.color}40`; } }}
                  onMouseLeave={e => { if (!a) { e.currentTarget.style.color = C.textMuted; e.currentTarget.style.borderLeftColor = "transparent"; } }}
                >
                  <span className="nav-icon" style={{
                    fontSize:14, width:20, textAlign:"center", display:"block",
                    color:"inherit", filter:a ? `drop-shadow(0 0 6px ${item.color})` : "none",
                    transition:"transform .18s, filter .18s",
                  }}>{item.icon}</span>
                  {!col && <span className="nav-label" style={{ fontSize:9, transition:"letter-spacing .18s" }}>{item.label}</span>}
                  {/* Active indicator dot */}
                  {a && (
                    <div style={{
                      position:"absolute", right:col ? -1 : 8, top:"50%", transform:"translateY(-50%)",
                      width:4, height:4, borderRadius:"50%", background:item.color,
                      boxShadow:`0 0 8px ${item.color}`,
                    }} />
                  )}
                </div>
              );
            })}
          </nav>

          {/* Clock */}
          {!col && (
            <div style={{
              padding:"10px 14px", borderTop:`1px solid ${C.border}`,
              fontSize:9, color:C.textMuted, position:"relative", zIndex:1,
              fontFamily:font,
            }}>
              <div style={{ letterSpacing:".08em" }}>{time.toLocaleDateString()}</div>
              <div style={{
                fontSize:15, color:C.accent, fontWeight:700, fontFamily:fontDisplay,
                textShadow:`0 0 12px ${C.accent}50`, letterSpacing:".06em",
              }}>{time.toLocaleTimeString()}</div>
            </div>
          )}
        </div>

        {/* ── MAIN CONTENT ── */}
        <div style={{ flex:1, overflow:"auto", position:"relative", zIndex:10 }}>
          {/* Topbar */}
          <div style={{
            padding:"0 20px", height:44,
            borderBottom:`1px solid ${C.border}`,
            display:"flex", justifyContent:"space-between", alignItems:"center",
            background:C.bgTopbar, position:"sticky", top:0, zIndex:30,
            backdropFilter:"blur(16px)",
            boxShadow:`0 1px 0 ${C.border}`,
          }}>
            {/* Terminal path */}
            <div style={{ fontFamily:font, fontSize:11, display:"flex", alignItems:"center", gap:2 }}>
              <span style={{ color:C.accent, textShadow:`0 0 10px ${C.accent}50` }}>root@wfaudit</span>
              <span style={{ color:C.textMuted }}>:</span>
              <span style={{ color:C.accentDim }}>~/{page}</span>
              <span style={{ color:C.accent, animation:"blink 1.2s step-end infinite", marginLeft:2 }}>█</span>
            </div>

            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <span style={{ fontSize:9, color:C.textMuted, fontFamily:font, letterSpacing:".12em" }}>
                AUTHORIZED TESTING ONLY
              </span>

              {/* Theme toggle */}
              <button
                onClick={() => setIsDark(!isDark)}
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                style={{
                  width:44, height:24, borderRadius:12, cursor:"pointer",
                  background: isDark ? `linear-gradient(135deg, ${C.accent}30, ${C.purple}25)` : `linear-gradient(135deg, ${C.accent}20, ${C.info}15)`,
                  border:`1px solid ${C.accent}40`, padding:0, position:"relative",
                  transition:"all .3s cubic-bezier(.22,1,.36,1)",
                  boxShadow: isDark ? `0 0 14px ${C.accent}20, inset 0 1px 2px rgba(0,0,0,.3)` : `0 2px 8px rgba(0,0,0,.1)`,
                  outline:"none",
                }}
              >
                <div style={{
                  position:"absolute", top:3,
                  left: isDark ? 22 : 3,
                  width:16, height:16, borderRadius:"50%",
                  background: isDark ? C.accent : C.warn,
                  transition:"all .3s cubic-bezier(.22,1,.36,1)",
                  boxShadow: isDark ? `0 0 10px ${C.accent}80` : `0 0 10px ${C.warn}60`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:9, color: isDark ? C.bg : "#fff",
                }}>{isDark ? "☽" : "☀"}</div>
              </button>

              {/* Status dot */}
              <div style={{ position:"relative", width:10, height:10 }}>
                <div style={{
                  position:"absolute", inset:0, borderRadius:"50%",
                  background:C.accent, opacity:.3,
                  animation:"pulseRing 2s ease-out infinite",
                }} />
                <div style={{
                  position:"absolute", inset:2, borderRadius:"50%",
                  background:C.accent,
                  boxShadow:`0 0 8px ${C.accent}`,
                }} />
              </div>
            </div>
          </div>

          {/* Page content */}
          <div style={{ padding:"24px 24px" }} key={pageKey}>
            <Page />
          </div>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}

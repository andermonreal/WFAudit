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
    name: "dark", bg: "#080b10", bgCard: "#0d1117", bgInput: "#0a0a0a", bgSidebar: "#0a0d14",
    bgTopbar: "#0a0d14", bgHover: "#0ff08", bgTableRow: "#080c10", text: "#ccc", textMuted: "#556",
    textDim: "#333", textBright: "#fff", border: "#1a2a2a", borderAccent: "#0ff15", borderInput: "#1a3a3a",
    accent: "#0ff", accentGlow: "#0ff55", green: "#69f0ae", red: "#ff1744", orange: "#ff6d00",
    yellow: "#ffd600", pink: "#f0f", blue: "#0af", termBg: "#0a0a0a", termBorder: "#1a3a1a",
    termText: "#0f0", termPrompt: "#0a5", scanlineColor: "rgba(0,255,255,0.015)",
    scrollTrack: "#080b10", scrollThumb: "#1a3a3a", cardShadow: "none",
    helpCodeBg: "#080b10", sideText: "#0ff", sideTextDim: "#556", sideActive: "#0ff0d",
    sideActiveBorder: "#0ff", sideHover: "#0af", sideClock: "#0ff", sideClockDim: "#0a5",
    toggleBg: "#ffffff08", toggleBorder: "#ffffff10", toggleHoverBg: "#ffffff15", toggleText: "#889",
  },
  light: {
    name: "light", bg: "#f0f2f5", bgCard: "#ffffff", bgInput: "#f7f8fa", bgSidebar: "#0e1525",
    bgTopbar: "#ffffff", bgHover: "#e8f4fd", bgTableRow: "#f7f8fa", text: "#2d3748", textMuted: "#718096",
    textDim: "#a0aec0", textBright: "#1a202c", border: "#e2e8f0", borderAccent: "#0e152520",
    borderInput: "#cbd5e0", accent: "#0077b6", accentGlow: "#0077b644", green: "#0a8754",
    red: "#c41e3a", orange: "#c75000", yellow: "#9a7b00", pink: "#9b2d8e", blue: "#0066aa",
    termBg: "#1a1f2e", termBorder: "#2d3748", termText: "#69f0ae", termPrompt: "#4ade80",
    scanlineColor: "rgba(14,21,37,0.02)", scrollTrack: "#f0f2f5", scrollThumb: "#cbd5e0",
    cardShadow: "0 1px 4px rgba(0,0,0,0.07)", helpCodeBg: "#edf0f4",
    sideText: "#fff", sideTextDim: "#8899aa", sideActive: "#ffffff18", sideActiveBorder: "#fff",
    sideHover: "#dde", sideClock: "#fff", sideClockDim: "#8bb8a0",
    toggleBg: "#ffffff15", toggleBorder: "#ffffff20", toggleHoverBg: "#ffffff25", toggleText: "#aabbcc",
  },
};

const SEV = { critical: "red", high: "orange", medium: "yellow", low: "blue", info: "green" };
const SEC_COLORS = { open: "red", wep: "orange", wpa: "yellow", wpa2: "blue", wpa3: "green", unknown: "textDim" };
function tc(t, k) { return t[k] || k; }

// ═══════ COMPONENTS ═══════

function GlitchText({ text, style = {} }) {
  const t = useTheme();
  return <h2 style={{ fontFamily: "'Share Tech Mono', monospace", textShadow: t.name === "dark" ? `2px 0 ${t.accent}44, -2px 0 ${t.pink}44` : "none", letterSpacing: "0.05em", color: t.accent, fontSize: 20, margin: 0, marginBottom: 20, ...style }}>{text}</h2>;
}

function TerminalLog({ lines = [], maxH = 200 }) {
  const t = useTheme(); const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [lines]);
  return (
    <div ref={ref} style={{ background: t.termBg, border: `1px solid ${t.termBorder}`, borderRadius: 4, padding: 10, fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: t.termText, maxHeight: maxH, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
      {lines.length === 0 && <span style={{ color: t.textDim }}>Waiting for output...</span>}
      {lines.map((l, i) => <div key={i}><span style={{ color: t.termPrompt }}>$ </span>{l}</div>)}
    </div>
  );
}

function Badge({ children, color = "accent", small = false }) {
  const t = useTheme(); const c = tc(t, color);
  return <span style={{ display: "inline-block", padding: small ? "1px 6px" : "2px 10px", borderRadius: 3, background: c + "18", color: c, border: `1px solid ${c}33`, fontSize: small ? 10 : 11, fontFamily: "'Share Tech Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>{children}</span>;
}

function Btn({ children, onClick, color = "accent", disabled = false, small = false, danger = false, style: sx = {} }) {
  const t = useTheme(); const c = tc(t, danger ? "red" : color);
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: small ? "4px 10px" : "8px 18px", background: disabled ? t.bgInput : c + "15", color: disabled ? t.textDim : c, border: `1px solid ${disabled ? t.border : c + "55"}`, borderRadius: 4, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: small ? 11 : 12, letterSpacing: "0.05em", textTransform: "uppercase", transition: "all 0.2s", ...sx }}
      onMouseEnter={(e) => { if (!disabled) { e.target.style.background = c + "28"; e.target.style.boxShadow = `0 0 12px ${c}22`; } }}
      onMouseLeave={(e) => { if (!disabled) { e.target.style.background = c + "15"; e.target.style.boxShadow = "none"; } }}
    >{children}</button>
  );
}

function Input({ label, value, onChange, placeholder, type = "text", style: sx = {} }) {
  const t = useTheme();
  return (
    <div style={{ marginBottom: 10, ...sx }}>
      {label && <label style={{ display: "block", fontSize: 10, color: t.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4, fontFamily: "'Share Tech Mono', monospace" }}>{label}</label>}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", padding: "7px 10px", background: t.bgInput, border: `1px solid ${t.borderInput}`, borderRadius: 4, color: t.textBright, fontFamily: "'Share Tech Mono', monospace", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  const t = useTheme();
  return (
    <div style={{ marginBottom: 10 }}>
      {label && <label style={{ display: "block", fontSize: 10, color: t.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4, fontFamily: "'Share Tech Mono', monospace" }}>{label}</label>}
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", padding: "7px 10px", background: t.bgInput, border: `1px solid ${t.borderInput}`, borderRadius: 4, color: t.textBright, fontFamily: "'Share Tech Mono', monospace", fontSize: 12, outline: "none" }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Card({ title, children, color = "accent", style: sx = {} }) {
  const t = useTheme(); const c = tc(t, color);
  return (
    <div style={{ background: t.bgCard, border: `1px solid ${c}20`, borderRadius: 6, padding: 16, marginBottom: 14, borderLeft: `3px solid ${c}`, boxShadow: t.cardShadow, ...sx }}>
      {title && <div style={{ fontSize: 11, color: c, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10, fontFamily: "'Share Tech Mono', monospace", borderBottom: `1px solid ${c}18`, paddingBottom: 6 }}>{title}</div>}
      {children}
    </div>
  );
}

function DataTable({ columns, data, onRowClick }) {
  const t = useTheme();
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Share Tech Mono', monospace", fontSize: 11 }}>
        <thead><tr>{columns.map((c) => <th key={c.key} style={{ textAlign: "left", padding: "6px 8px", color: t.blue, borderBottom: `1px solid ${t.border}`, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap" }}>{c.label}</th>)}</tr></thead>
        <tbody>
          {data.map((row, i) => <tr key={i} onClick={() => onRowClick?.(row)} style={{ cursor: onRowClick ? "pointer" : "default", borderBottom: `1px solid ${t.border}08` }} onMouseEnter={(e) => e.currentTarget.style.background = t.bgHover} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            {columns.map((c) => <td key={c.key} style={{ padding: "5px 8px", color: t.text, whiteSpace: "nowrap" }}>{c.render ? c.render(row[c.key], row) : row[c.key]}</td>)}
          </tr>)}
          {data.length === 0 && <tr><td colSpan={columns.length} style={{ padding: 20, textAlign: "center", color: t.textDim }}>No data</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, color = "accent", icon }) {
  const t = useTheme(); const c = tc(t, color);
  return (
    <div style={{ background: t.bgCard, border: `1px solid ${c}20`, borderRadius: 6, padding: "12px 16px", minWidth: 100, flex: 1, boxShadow: t.cardShadow }}>
      <div style={{ fontSize: 10, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'Share Tech Mono', monospace" }}>{icon} {label}</div>
      <div style={{ fontSize: 22, color: c, fontFamily: "'Share Tech Mono', monospace", marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Chk({ label, checked, onChange }) {
  const t = useTheme();
  return <label style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: t.textMuted, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}</label>;
}

// ═══════ PAGES ═══════

function DashboardPage() {
  const t = useTheme();
  const [pf, setPf] = useState(null); const [ld, setLd] = useState(false);
  const run = async () => { setLd(true); setPf(await api("/system/preflight")); setLd(false); };
  useEffect(() => { run(); }, []);
  const tools = pf?.tools || {}; const inst = Object.values(tools).filter(x => x.installed).length; const tot = Object.keys(tools).length;
  return (<div>
    <GlitchText text="// SYSTEM OVERVIEW" />
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
      <Stat label="Status" value={pf?.ready ? "READY" : "NOT READY"} color={pf?.ready ? "green" : "red"} icon="◉" />
      <Stat label="Root" value={pf?.system?.is_root ? "YES" : "NO"} color={pf?.system?.is_root ? "green" : "red"} icon="⚡" />
      <Stat label="Tools" value={`${inst}/${tot}`} color={inst === tot ? "green" : "yellow"} icon="⚙" />
      <Stat label="OS" value={pf?.system?.release?.slice(0, 14) || "—"} color="accent" icon="▣" />
    </div>
    {pf?.missing_critical?.length > 0 && <Card title="Missing Critical Tools" color="red">{pf.missing_critical.map(x => <div key={x} style={{ color: t.red, fontSize: 12, fontFamily: "'Share Tech Mono', monospace", marginBottom: 4 }}>✗ {x} — <span style={{ color: t.yellow }}>apt install {tools[x]?.package}</span></div>)}</Card>}
    <Card title="Tool Status"><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>{Object.entries(tools).map(([n, info]) => <div key={n} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 10px", background: t.bgTableRow, borderRadius: 4, border: `1px solid ${info.installed ? t.green + "22" : t.red + "22"}` }}><span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: t.text }}>{n}</span><Badge color={info.installed ? "green" : "red"} small>{info.installed ? "OK" : "MISS"}</Badge></div>)}</div></Card>
    {pf?.warnings?.map((w, i) => <div key={i} style={{ padding: "8px 12px", background: t.yellow + "0d", border: `1px solid ${t.yellow}28`, borderRadius: 4, color: t.yellow, fontSize: 12, fontFamily: "'Share Tech Mono', monospace", marginBottom: 8 }}>⚠ {w}</div>)}
    <Btn onClick={run} disabled={ld}>{ld ? "Checking..." : "Re-run Preflight"}</Btn>
  </div>);
}

function InterfacesPage() {
  const t = useTheme();
  const [ifaces, setIfaces] = useState([]); const [ld, setLd] = useState(false); const [log, setLog] = useState([]); const [mac, setMac] = useState("");
  const refresh = async () => { setLd(true); const d = await api("/interfaces/"); if (Array.isArray(d)) setIfaces(d); setLd(false); };
  useEffect(() => { refresh(); }, []);
  const addL = (m) => setLog(p => [...p, m]);
  return (<div>
    <GlitchText text="// NETWORK INTERFACES" />
    <Btn onClick={refresh} disabled={ld} style={{ marginBottom: 16 }}>{ld ? "Scanning..." : "Refresh"}</Btn>
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", marginBottom: 20 }}>
      {ifaces.map(iface => <Card key={iface.name} title={iface.name} color={iface.mode === "monitor" ? "green" : "accent"}>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: t.textMuted, lineHeight: 1.8 }}>
          <div>MAC: <span style={{ color: t.textBright }}>{iface.mac}</span></div>
          <div>Driver: <span style={{ color: t.textBright }}>{iface.driver || "?"}</span></div>
          <div>Chipset: <span style={{ color: t.textBright }}>{iface.chipset || "?"}</span></div>
          <div>Mode: <Badge color={iface.mode === "monitor" ? "green" : "blue"}>{iface.mode}</Badge></div>
          <div>Status: <Badge color={iface.is_up ? "green" : "red"}>{iface.is_up ? "UP" : "DOWN"}</Badge></div>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {iface.mode === "managed" ? <Btn small onClick={async () => { addL(`airmon-ng start ${iface.name}`); addL(JSON.stringify(await api(`/interfaces/${iface.name}/monitor`, { method: "POST" }), null, 2)); refresh(); }} color="green">Enable Monitor</Btn>
            : <Btn small onClick={async () => { addL(`airmon-ng stop ${iface.name}`); addL(JSON.stringify(await api(`/interfaces/${iface.name}/managed`, { method: "POST" }), null, 2)); refresh(); }} color="yellow">Restore Managed</Btn>}
          <Btn small onClick={async () => { addL(`macchanger ${mac || "-r"} ${iface.name}`); addL(JSON.stringify(await api(`/interfaces/${iface.name}/mac?new_mac=${mac || ""}`, { method: "POST" }), null, 2)); refresh(); }} color="pink">Change MAC</Btn>
        </div>
      </Card>)}
      {ifaces.length === 0 && !ld && <div style={{ color: t.textDim, fontFamily: "'Share Tech Mono', monospace" }}>No wireless interfaces detected.</div>}
    </div>
    <Input label="Custom MAC (empty = random)" value={mac} onChange={setMac} placeholder="AA:BB:CC:DD:EE:FF" />
    <Card title="Operation Log" color="green"><TerminalLog lines={log} maxH={180} /></Card>
  </div>);
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
    { key: "essid", label: "ESSID", render: v => <span style={{ color: t.textBright, fontWeight: 600 }}>{v || "<hidden>"}</span> },
    { key: "bssid", label: "BSSID" }, { key: "channel", label: "CH" },
    { key: "power", label: "PWR", render: v => <span style={{ color: v > -50 ? t.green : v > -70 ? t.yellow : t.red }}>{v} dBm</span> },
    { key: "security", label: "Sec", render: v => <Badge color={SEC_COLORS[v] || "textDim"} small>{v}</Badge> },
    { key: "cipher", label: "Cipher" },
    { key: "wps", label: "WPS", render: v => v ? <Badge color="orange" small>YES</Badge> : "—" },
    { key: "clients", label: "Cli", render: v => <span style={{ color: t.accent }}>{v?.length || 0}</span> },
    { key: "data_packets", label: "Data" },
  ];
  return (<div>
    <GlitchText text="// WIFI SCANNER" />
    <Card title="Scan Configuration">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
        <Input label="Interface" value={iface} onChange={setIface} /><Input label="Channel" value={ch} onChange={setCh} placeholder="all" />
        <Input label="Duration (s)" value={dur} onChange={setDur} /><Input label="BSSID (opt)" value={tb} onChange={setTb} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}><Btn onClick={doScan} disabled={scanning} color="green">{scanning ? "⟳ Scanning..." : "▶ Scan"}</Btn><Btn onClick={loadScans} small>Load Previous</Btn></div>
    </Card>
    {scanning && <div style={{ textAlign: "center", padding: 40 }}><div style={{ fontSize: 14, color: t.accent, fontFamily: "'Share Tech Mono', monospace", animation: "pulse 1.5s infinite" }}>◉ SCANNING — {dur}s</div></div>}
    {res && <><div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}><Stat label="Networks" value={aps.length} color="accent" icon="📡" /><Stat label="Clients" value={res.client_count || 0} color="pink" icon="📱" /><Stat label="Open" value={aps.filter(a => a.security === "open").length} color="red" icon="⚠" /><Stat label="WPA2" value={aps.filter(a => a.security === "wpa2").length} color="blue" icon="🔒" /></div>
      <Card title={`Access Points (${aps.length})`}><DataTable columns={cols} data={aps} onRowClick={setSel} /></Card></>}
    {sel && <Card title={`AP: ${sel.essid || sel.bssid}`} color="pink"><div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: t.text, lineHeight: 2 }}>{Object.entries(sel).map(([k, v]) => <div key={k}><span style={{ color: t.blue }}>{k}:</span> <span style={{ color: t.textBright }}>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span></div>)}</div><Btn small onClick={() => setSel(null)} style={{ marginTop: 10 }}>Close</Btn></Card>}
    {scans.length > 0 && <Card title="Previous Scans">{scans.map(s => <div key={s.id} onClick={async () => setRes(await api(`/wifi/scans/${s.id}`))} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: t.bgTableRow, borderRadius: 4, marginBottom: 6, fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: t.textMuted, cursor: "pointer" }}><span>#{s.id}</span><span>{s.access_points?.length || 0} APs</span><Badge color={s.status === "completed" ? "green" : "yellow"} small>{s.status}</Badge></div>)}</Card>}
  </div>);
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
  return (<div>
    <GlitchText text="// HANDSHAKE & CRACK" />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card title="1. Capture Handshake" color="green">
        <Input label="Interface" value={iface} onChange={setIface} /><Input label="Target BSSID" value={bssid} onChange={setBssid} placeholder="AA:BB:CC:DD:EE:FF" />
        <Input label="Channel" value={ch} onChange={setCh} /><Input label="Timeout (s)" value={to} onChange={setTo} />
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}><Chk label="Deauth first" checked={deauth} onChange={setDeauth} />{deauth && <Input label="Pkts" value={dpkts} onChange={setDpkts} style={{ marginBottom: 0, width: 80 }} />}</div>
        <Btn onClick={doCap} disabled={caping || !bssid} color="green">{caping ? "⟳ Capturing..." : "▶ Capture"}</Btn>
        {capR && <div style={{ marginTop: 12, fontFamily: "'Share Tech Mono', monospace", fontSize: 12 }}><div style={{ color: capR.handshake_captured ? t.green : t.red }}>{capR.handshake_captured ? "✓ HANDSHAKE CAPTURED!" : "✗ No handshake"}</div>{capR.capture_file && <div style={{ color: t.textDim, marginTop: 4 }}>File: {capR.capture_file}</div>}</div>}
      </Card>
      <Card title="2. Crack WPA Key" color="yellow">
        <Input label="Capture File" value={capFile} onChange={setCapFile} /><Input label="Target BSSID" value={crBssid} onChange={setCrBssid} />
        <Input label="Wordlist" value={wl} onChange={setWl} />
        <Btn onClick={doCrack} disabled={cracking || !capFile} color="yellow">{cracking ? "⟳ Cracking..." : "▶ Crack"}</Btn>
        {crR && <div style={{ marginTop: 12, fontFamily: "'Share Tech Mono', monospace", fontSize: 12 }}>{crR.success ? <><div style={{ color: t.green, fontSize: 16 }}>✓ KEY FOUND!</div><div style={{ color: t.yellow, fontSize: 20, marginTop: 8, padding: "8px 14px", background: t.yellow + "0d", borderRadius: 4, border: `1px solid ${t.yellow}28`, display: "inline-block" }}>{crR.key}</div></> : <div style={{ color: t.red }}>✗ Not found</div>}</div>}
      </Card>
    </div>
    <Card title="Deauth Tool" color="orange" style={{ marginTop: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}><Input label="Interface" value={dI} onChange={setDI} /><Input label="BSSID" value={dB} onChange={setDB} /><Input label="Client" value={dC} onChange={setDC} placeholder="broadcast" /><Input label="Packets" value={dN} onChange={setDN} /></div>
      <Btn onClick={doDeauth} disabled={!dB} color="orange" style={{ marginTop: 8 }}>Send Deauth</Btn>
      {dR && <div style={{ marginTop: 8 }}><TerminalLog lines={[JSON.stringify(dR, null, 2)]} maxH={100} /></div>}
    </Card>
  </div>);
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
    { key: "ip", label: "IP", render: v => <span style={{ color: t.textBright }}>{v}</span> }, { key: "mac", label: "MAC" },
    { key: "hostname", label: "Host", render: v => v || "—" }, { key: "os_guess", label: "OS", render: v => v ? <span style={{ color: t.pink }}>{v}</span> : "—" },
    { key: "ports", label: "Open", render: v => <span style={{ color: t.accent }}>{v?.filter(p => p.state === "open").length || 0}</span> },
    { key: "_a", label: "", render: (_, row) => <div style={{ display: "flex", gap: 4 }}><Btn small onClick={() => doDeep(row.ip)} color="blue">Deep</Btn><Btn small onClick={() => doVuln(row.ip)} color="orange">Vuln</Btn></div> },
  ];
  return (<div>
    <GlitchText text="// NETWORK RECON" />
    <Card title="Configuration">
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12 }}><Input label="Target" value={tgt} onChange={setTgt} /><Select label="Type" value={st} onChange={setSt} options={stOpts} /><Input label="Ports" value={ports} onChange={setPorts} placeholder="22,80" /><Input label="Timeout" value={to} onChange={setTo} /></div>
      {st === "custom" && <Input label="Custom Args" value={ca} onChange={setCa} />}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}><Btn onClick={doScan} disabled={scanning} color="blue">{scanning ? "⟳..." : "▶ Scan"}</Btn><Btn onClick={doDiscover} disabled={scanning} color="green">Discover</Btn></div>
    </Card>
    {res?.command && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: t.textDim, marginBottom: 12 }}>CMD: <span style={{ color: t.termPrompt }}>{res.command}</span></div>}
    {res && <><div style={{ display: "flex", gap: 12, marginBottom: 16 }}><Stat label="Hosts" value={hosts.length} color="accent" icon="🖥" /><Stat label="Type" value={res.scan_type?.toUpperCase()} color="pink" /><Stat label="Status" value={res.status?.toUpperCase()} color={res.status === "completed" ? "green" : "yellow"} /></div>
      <Card title={`Hosts (${hosts.length})`}><DataTable columns={hCols} data={hosts} onRowClick={setSel} /></Card></>}
    {sel && <Card title={`Host: ${sel.ip}`} color="pink">
      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, lineHeight: 1.6, color: t.text }}>
        <div>MAC: <span style={{ color: t.textBright }}>{sel.mac || "N/A"}</span></div><div>Host: <span style={{ color: t.textBright }}>{sel.hostname || "N/A"}</span></div><div>OS: <span style={{ color: t.pink }}>{sel.os_guess || "N/A"}</span></div>
        {sel.ports?.length > 0 && <div style={{ marginTop: 10 }}>{sel.ports.map((p, i) => <div key={i} style={{ display: "flex", gap: 12, padding: "3px 0", borderBottom: `1px solid ${t.border}08` }}><span style={{ color: t.yellow, minWidth: 50 }}>{p.port}/{p.protocol}</span><Badge color={p.state === "open" ? "green" : "red"} small>{p.state}</Badge><span style={{ color: t.textMuted }}>{p.service || ""}</span></div>)}</div>}
        {sel.services?.length > 0 && <div style={{ marginTop: 10 }}>{sel.services.map((s, i) => <div key={i} style={{ padding: "3px 0" }}><span style={{ color: t.yellow }}>{s.port}</span> <span style={{ color: t.textBright }}>{s.name}</span> <span style={{ color: t.green }}>{s.product} {s.version}</span></div>)}</div>}
      </div><Btn small onClick={() => setSel(null)} style={{ marginTop: 10 }}>Close</Btn>
    </Card>}
    <Card title="🏴 CTF — Router Probe" color="red" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "end" }}><Input label="Router IP" value={ri} onChange={setRi} style={{ flex: 1, marginBottom: 0 }} /><Btn onClick={async () => { setRr(null); setRr(await api("/recon/router", { method: "POST", body: JSON.stringify({ target_ip: ri, check_default_creds: true, check_known_vulns: true }) })); }} color="red">Probe</Btn></div>
      {rr && <div style={{ marginTop: 12, fontFamily: "'Share Tech Mono', monospace", fontSize: 12, lineHeight: 1.8 }}>
        <div>Reachable: <Badge color={rr.reachable ? "green" : "red"} small>{rr.reachable ? "YES" : "NO"}</Badge></div>
        {rr.reachable && <>
          {[["HTTP", rr.http_open], ["HTTPS", rr.https_open], ["SSH", rr.ssh_open], ["Telnet", rr.telnet_open]].map(([n, v]) => <div key={n}>{n}: <Badge color={v ? (n === "Telnet" ? "red" : "green") : "textDim"} small>{v ? "OPEN" : "CLOSED"}</Badge></div>)}
          {rr.services?.map((s, i) => <div key={i} style={{ color: t.textMuted }}>:{s.port} → <span style={{ color: t.green }}>{s.product} {s.version}</span></div>)}
        </>}
      </div>}
    </Card>
  </div>);
}

function AttacksPage() {
  const t = useTheme();
  const [etI, setEtI] = useState("wlan1"); const [etE, setEtE] = useState(""); const [etC, setEtC] = useState("6"); const [etN, setEtN] = useState("eth0"); const [etP, setEtP] = useState(false);
  const [etS, setEtS] = useState(null); const [etL, setEtL] = useState(false);
  const [mI, setMI] = useState("wlan0"); const [mT, setMT] = useState(""); const [mG, setMG] = useState("192.168.0.1"); const [mP, setMP] = useState("8080"); const [mH, setMH] = useState("");
  const [mS, setMS] = useState(null); const [mL, setML] = useState(false);
  const rSt = async () => { setEtS(await api("/attacks/evil-twin/status")); setMS(await api("/attacks/mitm/status")); };
  useEffect(() => { rSt(); }, []);
  return (<div>
    <GlitchText text="// ATTACK VECTORS" style={{ color: t.red }} />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card title="Evil Twin AP" color="orange">
        <div style={{ marginBottom: 12 }}><Badge color={etS?.active ? "green" : "textDim"}>{etS?.active ? "ACTIVE" : "INACTIVE"}</Badge></div>
        {!etS?.active ? <>
          <Input label="Interface" value={etI} onChange={setEtI} /><Input label="ESSID" value={etE} onChange={setEtE} placeholder="Company_WiFi" />
          <Input label="Channel" value={etC} onChange={setEtC} /><Input label="Internet iface" value={etN} onChange={setEtN} />
          <Chk label="Captive Portal" checked={etP} onChange={setEtP} />
          <Btn onClick={async () => { setEtL(true); await api("/attacks/evil-twin/start", { method: "POST", body: JSON.stringify({ interface: etI, target_essid: etE, channel: parseInt(etC), internet_interface: etN || null, captive_portal: etP }) }); await rSt(); setEtL(false); }} disabled={etL || !etE} color="orange" style={{ marginTop: 10 }}>{etL ? "Starting..." : "▶ Launch"}</Btn>
        </> : <>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: t.text, lineHeight: 1.8, marginBottom: 12 }}>{etS.twin && Object.entries(etS.twin).map(([k, v]) => <div key={k}>{k}: <span style={{ color: t.textBright }}>{String(v)}</span></div>)}</div>
          <Btn onClick={async () => { await api("/attacks/evil-twin/stop", { method: "POST" }); await rSt(); }} danger>◼ Stop</Btn>
        </>}
      </Card>
      <Card title="Man-in-the-Middle" color="pink">
        <div style={{ marginBottom: 12 }}><Badge color={mS?.active ? "green" : "textDim"}>{mS?.active ? "ACTIVE" : "INACTIVE"}</Badge></div>
        {!mS?.active ? <>
          <Input label="Interface" value={mI} onChange={setMI} /><Input label="Target IPs" value={mT} onChange={setMT} placeholder="192.168.0.50, .51" />
          <Input label="Gateway" value={mG} onChange={setMG} /><Input label="Proxy Port" value={mP} onChange={setMP} /><Input label="Filter Hosts" value={mH} onChange={setMH} />
          <Btn onClick={async () => { setML(true); await api("/attacks/mitm/start", { method: "POST", body: JSON.stringify({ interface: mI, target_ips: mT.split(",").map(s => s.trim()).filter(Boolean), gateway: mG, proxy_port: parseInt(mP), filter_hosts: mH ? mH.split(",").map(s => s.trim()) : [] }) }); await rSt(); setML(false); }} disabled={mL || !mT} color="pink" style={{ marginTop: 10 }}>{mL ? "Starting..." : "▶ Start"}</Btn>
        </> : <>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: t.text, lineHeight: 1.8, marginBottom: 12 }}>{mS.session && Object.entries(mS.session).map(([k, v]) => <div key={k}>{k}: <span style={{ color: t.textBright }}>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span></div>)}</div>
          <Btn onClick={async () => { await api("/attacks/mitm/stop", { method: "POST" }); await rSt(); }} danger>◼ Stop</Btn>
        </>}
      </Card>
    </div>
  </div>);
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
  const catOpts = [{ value: "wifi", label: "WiFi" }, { value: "network", label: "Network" }, { value: "router", label: "Router" }, { value: "credentials", label: "Creds" }, { value: "encryption", label: "Encryption" }, { value: "access_control", label: "ACL" }, { value: "other", label: "Other" }];
  return (<div>
    <GlitchText text="// AUDIT SESSIONS" />
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16 }}>
      <div>
        <Card title="New Session" color="green">
          <Input label="Name" value={name} onChange={setName} /><Input label="Company" value={company} onChange={setCompany} /><Input label="Auditor" value={auditor} onChange={setAuditor} /><Input label="Notes" value={notes} onChange={setNotes} />
          <Btn onClick={async () => { await api("/sessions/", { method: "POST", body: JSON.stringify({ name, company, auditor, notes: notes || null }) }); setName(""); setCompany(""); setAuditor(""); setNotes(""); refresh(); }} disabled={!name || !company || !auditor} color="green">Create</Btn>
        </Card>
        <Card title="Sessions">{sessions.map(s => <div key={s.id} onClick={() => select(s.id)} style={{ padding: "8px 10px", background: sel?.id === s.id ? t.accent + "0d" : t.bgTableRow, border: `1px solid ${sel?.id === s.id ? t.accent + "28" : t.border}`, borderRadius: 4, marginBottom: 6, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 11 }}>
          <div style={{ color: t.textBright, marginBottom: 3 }}>{s.name}</div>
          <div style={{ display: "flex", justifyContent: "space-between", color: t.textMuted }}><span>{s.company}</span><Badge color={s.status === "active" ? "green" : "textDim"} small>{s.status}</Badge></div>
        </div>)}{sessions.length === 0 && <div style={{ color: t.textDim, fontFamily: "'Share Tech Mono', monospace", fontSize: 11 }}>No sessions</div>}</Card>
      </div>
      <div>
        {sel ? <>
          <Card title={sel.name} color="accent">
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: t.textMuted, lineHeight: 1.8, marginBottom: 12 }}>
              <div>ID: <span style={{ color: t.textBright }}>{sel.id}</span></div><div>Company: <span style={{ color: t.textBright }}>{sel.company}</span></div>
              <div>Auditor: <span style={{ color: t.textBright }}>{sel.auditor}</span></div><div>Status: <Badge color={sel.status === "active" ? "green" : "textDim"}>{sel.status}</Badge></div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {sel.status === "active" && <Btn small onClick={async () => { await api(`/sessions/${sel.id}/close`, { method: "POST" }); refresh(); select(sel.id); }} color="yellow">Close</Btn>}
              <Btn small onClick={async () => setReport(await api(`/sessions/${sel.id}/report`))} color="blue">Report</Btn>
            </div>
          </Card>
          {sel.status === "active" && <Card title="Add Finding" color="yellow">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><Select label="Category" value={fCat} onChange={setFCat} options={catOpts} /><Select label="Severity" value={fSev} onChange={setFSev} options={sevOpts} /></div>
            <Input label="Title" value={fT} onChange={setFT} /><Input label="Description" value={fD} onChange={setFD} /><Input label="Evidence" value={fE} onChange={setFE} /><Input label="Recommendation" value={fR} onChange={setFR} />
            <Btn onClick={async () => { await api(`/sessions/${sel.id}/findings`, { method: "POST", body: JSON.stringify({ session_id: sel.id, category: fCat, severity: fSev, title: fT, description: fD, evidence: fE || null, recommendation: fR || null }) }); setFT(""); setFD(""); setFE(""); setFR(""); select(sel.id); }} disabled={!fT || !fD} color="yellow">Add</Btn>
          </Card>}
          {sel.findings?.length > 0 && <Card title={`Findings (${sel.findings.length})`}>{sel.findings.map((f, i) => <div key={i} style={{ padding: "10px 12px", background: t.bgTableRow, borderLeft: `3px solid ${tc(t, SEV[f.severity] || "textDim")}`, borderRadius: 4, marginBottom: 8, fontFamily: "'Share Tech Mono', monospace", fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ color: t.textBright }}>{f.title}</span><Badge color={SEV[f.severity] || "textDim"} small>{f.severity}</Badge></div>
            <div style={{ color: t.textMuted, marginBottom: 4 }}>{f.description}</div>
            {f.recommendation && <div style={{ color: t.green, fontSize: 11 }}>→ {f.recommendation}</div>}
            <div style={{ marginTop: 4 }}><Badge color="blue" small>{f.category}</Badge></div>
          </div>)}</Card>}
          {report && <Card title="Report" color="green"><div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{Object.entries(report.audit_report?.summary || {}).filter(([k]) => k !== "total").map(([s, c]) => <Stat key={s} label={s} value={c} color={SEV[s] || "textDim"} />)}</div></Card>}
        </> : <div style={{ color: t.textDim, fontFamily: "'Share Tech Mono', monospace", padding: 40, textAlign: "center" }}>← Select or create a session</div>}
      </div>
    </div>
  </div>);
}

function ProcessesPage() {
  const t = useTheme();
  const [procs, setProcs] = useState([]); const [ld, setLd] = useState(false);
  const refresh = async () => { setLd(true); const d = await api("/system/processes"); if (Array.isArray(d)) setProcs(d); setLd(false); };
  useEffect(() => { refresh(); const i = setInterval(refresh, 5000); return () => clearInterval(i); }, []);
  const cols = [
    { key: "id", label: "ID", render: v => <span style={{ color: t.accent }}>{v}</span> },
    { key: "command", label: "Command", render: v => <span style={{ color: t.textBright, maxWidth: 350, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span> },
    { key: "status", label: "Status", render: v => <Badge color={v === "running" ? "green" : v === "completed" ? "blue" : "red"} small>{v}</Badge> },
    { key: "return_code", label: "RC", render: v => v !== null ? v : "—" },
    { key: "started_at", label: "Started", render: v => v ? new Date(v).toLocaleTimeString() : "—" },
    { key: "_a", label: "", render: (_, r) => r.status === "running" ? <Btn small danger onClick={async () => { await api(`/system/processes/${r.id}/cancel`, { method: "POST" }); refresh(); }}>Kill</Btn> : null },
  ];
  return (<div>
    <GlitchText text="// PROCESSES" />
    <div style={{ display: "flex", gap: 12, marginBottom: 16 }}><Stat label="Total" value={procs.length} color="accent" icon="▣" /><Stat label="Running" value={procs.filter(p => p.status === "running").length} color="green" icon="◉" /><Stat label="Failed" value={procs.filter(p => p.status === "failed").length} color="red" icon="✗" /></div>
    <Card title="Managed Processes"><DataTable columns={cols} data={procs} /></Card>
    <Btn onClick={refresh} disabled={ld}>{ld ? "..." : "Refresh"}</Btn>
  </div>);
}

// ═══════ HELP PAGE ═══════

const HELP = [
  { id: "overview", title: "Visión General", icon: "📖", text: `**WFAudit** es una herramienta de auditoría WiFi profesional. Proporciona una interfaz gráfica sobre herramientas estándar (aircrack-ng, nmap, mitmproxy, hostapd) para ejecutar auditorías WiFi completas.\n\nLas 4 fases de auditoría:\n1. **Reconocimiento WiFi** — Escanear el espectro y descubrir redes\n2. **Análisis de red** — Mapear la red interna y sus servicios\n3. **Explotación** — Cracking WPA, Evil Twin, acceso al router\n4. **Interceptación** — Man-in-the-Middle para análisis de tráfico\n\nTodo bajo un marco de sesiones con sistema de hallazgos e informes.` },
  { id: "prereqs", title: "Requisitos Previos", icon: "⚙", text: `**Hardware necesario:**\n• Adaptador WiFi con soporte modo monitor (chipsets Atheros AR9271, Ralink RT3070, Realtek RTL8812AU)\n• Para Evil Twin: **dos** tarjetas WiFi\n• Conexión Ethernet recomendada\n\n**Software:**\n• Linux (Kali recomendado)\n• Python 3.11+\n• Herramientas: aircrack-ng, nmap, hostapd, dnsmasq, macchanger, mitmproxy\n• Ejecutar como **root**\n\n**Legal:**\n• Contrato de auditoría firmado\n• Alcance definido por escrito\n• Nunca auditar redes sin autorización` },
  { id: "system", title: "System (Panel de Control)", icon: "◉", text: `Tu punto de partida. El **Preflight Check** verifica:\n\n• Si estás ejecutando como root (obligatorio)\n• Qué herramientas están instaladas y cuáles faltan\n• Sistema operativo y arquitectura\n\n**READY** = todo listo. **NOT READY** = revisa las herramientas faltantes, te indica el comando de instalación.\n\nEjecuta el Preflight **siempre** antes de empezar una auditoría.` },
  { id: "interfaces", title: "Interfaces", icon: "⚡", text: `Gestiona adaptadores WiFi:\n\n**Listar** — Nombre, MAC, driver, chipset, modo y estado.\n\n**Modo monitor** — Obligatorio para escanear. Ejecuta \`airmon-ng start\`. La interfaz se renombra a wlan0mon. ⚠ Pierdes conexión WiFi en esa tarjeta.\n\n**Modo managed** — Restaura WiFi normal con \`airmon-ng stop\`.\n\n**Cambiar MAC** — Aleatorio o manual. Útil para evitar detección por IDS/IPS. Usa macchanger internamente.` },
  { id: "wifiscan", title: "WiFi Scanner", icon: "📡", text: `Descubre redes con airodump-ng:\n\n**Parámetros:** Interface (en monitor), Canal (vacío=todos), Duración, BSSID objetivo (opcional).\n\n**Resultados por red:**\n• **ESSID** — Nombre de la red\n• **BSSID** — MAC del AP\n• **Power** — Señal dBm (verde >-50, amarillo >-70, rojo <-70)\n• **Security** — Open(🔴), WEP(🟠), WPA(🟡), WPA2(🔵), WPA3(🟢)\n• **WPS** — Si activo, vector de ataque adicional\n• **Clients** — Dispositivos conectados\n\n**Tip:** escaneo general primero, luego focalizado en el objetivo.` },
  { id: "handshake", title: "Handshake & Crack", icon: "🔓", text: `Captura y crackea contraseñas WPA/WPA2:\n\n**Fase 1 — Capturar handshake:**\nEl handshake son 4 paquetes al conectarse un cliente. Contiene hash de la contraseña.\n• Configura interfaz, BSSID, canal\n• "Deauth first" desconecta clientes para forzar reconexión\n• Si hay ✓ HANDSHAKE CAPTURED, el .cap se guarda\n\n**Fase 2 — Crackear:**\nPrueba contraseñas de un diccionario contra el handshake.\n• \`rockyou.txt\` = 14 millones de passwords (en Kali: /usr/share/wordlists/)\n• ✓ KEY FOUND = contraseña encontrada\n\n**Deauth Tool:** envía desconexiones sin capturar. Para probar resiliencia DoS.\n\n**Importante:** WPA3 es resistente a esto. El cracking es offline y depende de CPU/GPU.` },
  { id: "recon", title: "Network Recon", icon: "🔍", text: `Mapea la red con nmap:\n\n**Tipos de escaneo:**\n• **Quick** — Ping sweep, descubre hosts vivos\n• **Full** — 65535 puertos + servicios + OS\n• **Vuln** — Scripts de vulnerabilidades\n• **OS Detect** — Fingerprinting de SO\n• **Service** — Versiones de servicios\n• **Stealth** — SYN scan sigiloso\n• **UDP** — Top 100 puertos UDP\n• **Custom** — Argumentos nmap propios\n\n**Router Probe (CTF):**\nSondea el router: HTTP, HTTPS, SSH, Telnet. Identifica modelo y firmware.\n• Telnet abierto = hallazgo crítico\n• SSH = vector potencial con credenciales débiles\n\n**Flujo:** Discover → Analizar → Deep Scan → Vuln Scan → Router Probe` },
  { id: "attacks", title: "Attack Vectors", icon: "⚔", text: `**Evil Twin:**\nAP falso con el mismo nombre que la red objetivo.\n• Necesita 2ª tarjeta WiFi\n• Configura ESSID, canal, interfaz de internet\n• Captive Portal redirige DNS a tu IP\n• Internamente: hostapd + dnsmasq + iptables NAT\n\n**MITM (Man-in-the-Middle):**\nIntercepta tráfico entre clientes y gateway.\n• ARP spoofing engaña dispositivos\n• mitmproxy captura flujos HTTP/S\n• Filtra por dominios específicos\n• HTTPS moderno muestra warnings de certificado\n\n⚠ Ambos dejan rastro en logs. El equipo IT puede detectarlo.` },
  { id: "sessions", title: "Audit Sessions", icon: "📋", text: `Gestión de la auditoría:\n\n**Crear sesión:** nombre, empresa, auditor, notas.\n\n**Registrar hallazgos** con:\n• **Category** — WiFi, Network, Router, Credentials, Encryption, ACL\n• **Severity** — Critical/High/Medium/Low/Info\n• **Title + Description** — Detalle técnico\n• **Evidence** — Ruta a capturas\n• **Recommendation** — Solución propuesta\n\n**Ejemplos:**\n• 🔴 Critical: Red sin cifrado → Implementar WPA3-Enterprise\n• 🟠 High: Password crackeada en 30s → Passphrase 16+ chars\n• 🟡 Medium: Router con credenciales default → Cambiar passwords\n• 🔵 Low: WPS activado → Desactivar WPS\n• 🟢 Info: Usa WPA3 → Configuración adecuada\n\n**Exportar:** informe ordenado por severidad.` },
  { id: "processes", title: "Processes", icon: "▣", text: `Monitoriza subprocesos (airodump, nmap, hostapd, etc.):\n\n• **Status:** running, completed, failed, cancelled\n• **Kill:** mata procesos colgados\n• Auto-refresh cada 5 segundos\n\nSi algo falla, revisa aquí. Un proceso "failed" da pistas del error.` },
  { id: "workflow", title: "Flujo Completo", icon: "🗺", text: `**ANTES del sitio:**\n1. ✅ Contrato y alcance firmados\n2. ✅ Hardware verificado\n3. ✅ Preflight OK\n4. ✅ Wordlists descargados\n\n**Fase 1 — Reconocimiento (30 min):**\n5. Ethernet conectado\n6. Interfaces → Monitor Mode\n7. WiFi Scanner → Scan 60s\n8. Identificar red objetivo\n\n**Fase 2 — Cracking (30-60 min):**\n9. Handshake → Capturar\n10. Crack con wordlist\n11. Si falla → Evil Twin\n\n**Fase 3 — Red interna (30 min):**\n12. Recon → Discover red\n13. Deep Scan hosts interesantes\n14. Router Probe → CTF\n\n**Fase 4 — Avanzado (si hay tiempo):**\n15. MITM en hosts seleccionados\n16. Capturar tráfico 15-30 min\n\n**Después:**\n17. Revisar findings\n18. Exportar informe\n19. Restaurar interfaz a managed` },
  { id: "trouble", title: "Solución de Problemas", icon: "🔧", text: `**No se detectan interfaces:**\n→ Adaptador sin soporte monitor o sin driver. Verifica con \`lsusb\`.\n\n**Monitor mode falla:**\n→ Procesos interfiriendo. Activa "kill conflicting" o ejecuta \`airmon-ng check kill\`.\n\n**No se captura handshake:**\n→ No hay clientes conectados. Aumenta deauth packets. Prueba en hora con más actividad.\n\n**Cracking lento:**\n→ Normal con CPU. Usa hashcat+GPU fuera de esta herramienta.\n\n**Nmap no detecta OS:**\n→ Necesita root + puerto abierto y cerrado. Firewalls pueden bloquearlo.\n\n**Evil Twin sin conexiones:**\n→ Señal débil. Acércate. Deauth al AP real para forzar migración.\n\n**MITM sin tráfico HTTPS:**\n→ Esperado. HSTS y certificate pinning protegen. Hallazgo positivo.\n\n**Backend no responde:**\n→ Verifica \`ps aux | grep uvicorn\`. URL por defecto: localhost:8000.\n\n**Permisos:**\n→ Ejecuta con \`sudo\`. Root es obligatorio.` },
  { id: "glossary", title: "Glosario", icon: "📚", text: `• **AP** — Access Point, dispositivo que emite WiFi\n• **BSSID** — MAC del AP\n• **ESSID** — Nombre de la red WiFi\n• **Handshake** — 4 paquetes de conexión WPA con hash de la contraseña\n• **Deauth** — Paquete que fuerza desconexión\n• **Modo Monitor** — Captura todos los paquetes del aire\n• **Modo Managed** — Modo WiFi normal\n• **WPA/WPA2/WPA3** — Protocolos de cifrado WiFi\n• **WPS** — WiFi Protected Setup, vulnerable a ataques\n• **Evil Twin** — AP falso que imita una red\n• **MITM** — Man-in-the-Middle, interceptar comunicación\n• **ARP Spoofing** — Engañar dispositivos para redirigir tráfico\n• **CTF** — Capture The Flag, demostrar acceso como prueba\n• **Wordlist** — Diccionario de contraseñas\n• **CIDR** — Notación de redes (192.168.0.0/24)\n• **NSE** — Nmap Scripting Engine\n• **Captive Portal** — Página web al conectarse (hotel/aeropuerto)\n• **NAT** — Network Address Translation` },
];

function HelpPage() {
  const t = useTheme();
  const [active, setActive] = useState("overview");
  const sec = HELP.find(s => s.id === active);
  const renderMd = (text) => text.split("\n").map((line, i) => {
    if (line.startsWith("**") && line.endsWith("**")) return <div key={i} style={{ color: t.accent, fontSize: 13, fontWeight: 600, marginTop: 14, marginBottom: 6, fontFamily: "'Share Tech Mono', monospace" }}>{line.replace(/\*\*/g, "")}</div>;
    if (line.startsWith("• **")) { const m = line.match(/• \*\*(.+?)\*\*\s*—?\s*(.*)/); if (m) return <div key={i} style={{ paddingLeft: 12, marginBottom: 4, fontSize: 12.5, lineHeight: 1.7 }}><span style={{ color: t.accent }}>• </span><span style={{ color: t.textBright, fontWeight: 600 }}>{m[1]}</span>{m[2] && <span style={{ color: t.text }}> — {m[2]}</span>}</div>; }
    if (line.startsWith("• ")) return <div key={i} style={{ paddingLeft: 12, marginBottom: 3, fontSize: 12.5, lineHeight: 1.7, color: t.text }}><span style={{ color: t.accent }}>• </span>{renderInline(line.slice(2))}</div>;
    const nm = line.match(/^(\d+)\.\s+(.*)/); if (nm) return <div key={i} style={{ paddingLeft: 12, marginBottom: 4, fontSize: 12.5, lineHeight: 1.7, color: t.text }}><span style={{ color: t.yellow, marginRight: 6 }}>{nm[1]}.</span>{renderInline(nm[2])}</div>;
    if (line.startsWith("→")) return <div key={i} style={{ paddingLeft: 20, marginBottom: 3, fontSize: 11, color: t.green, lineHeight: 1.7 }}>{line}</div>;
    if (line.trim() === "") return <div key={i} style={{ height: 8 }} />;
    return <div key={i} style={{ fontSize: 12.5, lineHeight: 1.8, color: t.text, marginBottom: 2 }}>{renderInline(line)}</div>;
  });
  const renderInline = (txt) => {
    const parts = []; let rem = txt; let k = 0;
    while (rem.length > 0) {
      const bm = rem.match(/\*\*(.+?)\*\*/); const cm = rem.match(/`(.+?)`/);
      let fm = null, mt = null;
      if (bm && (!cm || bm.index <= cm.index)) { fm = bm; mt = "b"; } else if (cm) { fm = cm; mt = "c"; }
      if (!fm) { parts.push(<span key={k++}>{rem}</span>); break; }
      if (fm.index > 0) parts.push(<span key={k++}>{rem.slice(0, fm.index)}</span>);
      if (mt === "b") parts.push(<span key={k++} style={{ color: t.textBright, fontWeight: 600 }}>{fm[1]}</span>);
      if (mt === "c") parts.push(<code key={k++} style={{ background: t.helpCodeBg, padding: "1px 5px", borderRadius: 3, fontSize: 11, color: t.green, fontFamily: "'Share Tech Mono', monospace" }}>{fm[1]}</code>);
      rem = rem.slice(fm.index + fm[0].length);
    }
    return parts;
  };
  return (<div>
    <GlitchText text="// HELP & DOCUMENTATION" />
    <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", gap: 20 }}>
      <Card title="Contenido">{HELP.map(s => <div key={s.id} onClick={() => setActive(s.id)} style={{ padding: "7px 10px", background: active === s.id ? t.accent + "0d" : "transparent", borderLeft: active === s.id ? `2px solid ${t.accent}` : "2px solid transparent", borderRadius: 2, cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: active === s.id ? t.accent : t.textMuted, marginBottom: 2, display: "flex", gap: 8, alignItems: "center", transition: "all 0.15s" }}
        onMouseEnter={e => { if (active !== s.id) e.currentTarget.style.color = t.blue; }} onMouseLeave={e => { if (active !== s.id) e.currentTarget.style.color = t.textMuted; }}
      ><span style={{ fontSize: 14 }}>{s.icon}</span>{s.title}</div>)}</Card>
      <div>{sec && <Card title={`${sec.icon} ${sec.title}`}><div style={{ fontFamily: "'Segoe UI', sans-serif" }}>{renderMd(sec.text)}</div></Card>}</div>
    </div>
  </div>);
}

// ═══════ MAIN ═══════

const NAV = [
  { id: "dashboard", label: "SYSTEM", icon: "◉" }, { id: "interfaces", label: "INTERFACES", icon: "⚡" },
  { id: "wifi", label: "WIFI SCAN", icon: "📡" }, { id: "handshake", label: "HANDSHAKE", icon: "🔓" },
  { id: "recon", label: "RECON", icon: "🔍" }, { id: "attacks", label: "ATTACKS", icon: "⚔" },
  { id: "sessions", label: "SESSIONS", icon: "📋" }, { id: "processes", label: "PROCESSES", icon: "▣" },
  { id: "help", label: "HELP", icon: "?" },
];
const PAGES = { dashboard: DashboardPage, interfaces: InterfacesPage, wifi: WifiScanPage, handshake: HandshakePage, recon: ReconPage, attacks: AttacksPage, sessions: SessionsPage, processes: ProcessesPage, help: HelpPage };

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [themeName, setThemeName] = useState("dark");
  const [time, setTime] = useState(new Date());
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { const i = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(i); }, []);
  const t = THEMES[themeName]; const Page = PAGES[page];
  return (
    <ThemeCtx.Provider value={t}>
      <div style={{ display: "flex", height: "100vh", background: t.bg, color: t.text, fontFamily: "'Share Tech Mono', monospace", overflow: "hidden" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
          * { box-sizing: border-box; scrollbar-width: thin; scrollbar-color: ${t.scrollThumb} ${t.scrollTrack}; }
          ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: ${t.scrollTrack}; } ::-webkit-scrollbar-thumb { background: ${t.scrollThumb}; border-radius: 3px; }
          @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
          @keyframes scanline { 0% { top:-100%; } 100% { top:100%; } }
          input:focus, select:focus { border-color: ${t.accent} !important; box-shadow: 0 0 0 1px ${t.accent}33; }
        `}</style>
        {/* Sidebar */}
        <div style={{ width: collapsed ? 50 : 180, background: t.bgSidebar, borderRight: `1px solid ${t.borderAccent}`, display: "flex", flexDirection: "column", transition: "width 0.2s", flexShrink: 0, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}><div style={{ position: "absolute", width: "100%", height: "200%", background: `linear-gradient(transparent 50%, ${t.scanlineColor} 50%)`, backgroundSize: "100% 4px", animation: "scanline 8s linear infinite" }} /></div>
          <div onClick={() => setCollapsed(!collapsed)} style={{ padding: "16px 12px", borderBottom: `1px solid ${t.borderAccent}`, cursor: "pointer", textAlign: "center" }}>
            <div style={{ fontSize: collapsed ? 18 : 16, color: t.sideText, textShadow: t.name === "dark" ? `0 0 10px ${t.accentGlow}` : "none" }}>{collapsed ? "W" : "WFAUDIT"}</div>
            {!collapsed && <div style={{ fontSize: 8, color: t.sideClockDim, letterSpacing: "0.2em", marginTop: 2 }}>v1.0.0</div>}
          </div>
          <nav style={{ flex: 1, padding: "8px 0" }}>{NAV.map(item => (
            <div key={item.id} onClick={() => setPage(item.id)} style={{ padding: collapsed ? "10px 0" : "8px 14px", cursor: "pointer", background: page === item.id ? t.sideActive : "transparent", borderLeft: page === item.id ? `2px solid ${t.sideActiveBorder}` : "2px solid transparent", color: page === item.id ? t.sideActiveBorder : t.sideTextDim, fontSize: 11, letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s", justifyContent: collapsed ? "center" : "flex-start" }}
              onMouseEnter={e => { if (page !== item.id) e.currentTarget.style.color = t.sideHover; }}
              onMouseLeave={e => { if (page !== item.id) e.currentTarget.style.color = t.sideTextDim; }}
            ><span style={{ fontSize: 14 }}>{item.icon}</span>{!collapsed && item.label}</div>
          ))}</nav>
          {!collapsed && <div style={{ padding: "10px 14px", borderTop: `1px solid ${t.borderAccent}` }}>
            <div onClick={() => setThemeName(themeName === "dark" ? "light" : "dark")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "6px 10px", borderRadius: 4, background: t.toggleBg, border: `1px solid ${t.toggleBorder}`, transition: "all 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.background = t.toggleHoverBg} onMouseLeave={e => e.currentTarget.style.background = t.toggleBg}>
              <span style={{ fontSize: 16 }}>{themeName === "dark" ? "☀" : "☾"}</span>
              <span style={{ fontSize: 10, color: t.toggleText, letterSpacing: "0.08em" }}>{themeName === "dark" ? "LIGHT" : "DARK"}</span>
            </div>
            <div style={{ fontSize: 10, color: t.sideClockDim }}>{time.toLocaleDateString()}</div>
            <div style={{ fontSize: 14, color: t.sideClock }}>{time.toLocaleTimeString()}</div>
          </div>}
        </div>
        {/* Main */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <div style={{ padding: "10px 24px", borderBottom: `1px solid ${t.border}20`, display: "flex", justifyContent: "space-between", alignItems: "center", background: t.bgTopbar, position: "sticky", top: 0, zIndex: 10, boxShadow: t.name === "light" ? "0 1px 3px rgba(0,0,0,0.05)" : "none" }}>
            <div style={{ fontSize: 12, color: t.textMuted }}><span style={{ color: t.accent }}>root@wfaudit</span><span style={{ color: t.textDim }}>:</span><span style={{ color: t.green }}>~/{page}</span><span style={{ color: t.accent, animation: "pulse 1s infinite" }}>_</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ fontSize: 10, color: t.textDim }}>Authorized Testing Only</div>
              {collapsed && <div onClick={() => setThemeName(themeName === "dark" ? "light" : "dark")} style={{ cursor: "pointer", fontSize: 18, lineHeight: 1 }}>{themeName === "dark" ? "☀" : "☾"}</div>}
            </div>
          </div>
          <div style={{ padding: 24 }}><Page /></div>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}

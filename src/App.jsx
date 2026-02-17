import { useState, useMemo, useCallback } from "react";
import {
  ComposedChart, Line, Area, Bar, BarChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, RadarChart,
  Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";

/* ─── DESIGN TOKENS ──────────────────────────────────────────────────────── */
const C = {
  bg: "#060811", surface: "#0b0d1c", panel: "#0e1020",
  border: "#181b2e", text: "#dde3fa", muted: "#3a3f5c", dim: "#1e2138",
  accent: "#00e5b0", gold: "#f5c842", rose: "#ff3d6e",
  violet: "#9b72ff", blue: "#2db8ff", orange: "#ff8c42", green: "#3ddc84",
  teal: "#00c4d4", pink: "#ff6eb4",
};

// Network colors
const NET = {
  Search:  { color: "#4285f4", icon: "🔍", bg: "#0a1228" },
  YouTube: { color: "#ff0033", icon: "▶", bg: "#1a0808" },
  Display: { color: "#34a853", icon: "◻", bg: "#081a10" },
};

// Metric definitions
const METRICS = {
  cpi:  { label: "CPI",  full: "Cost Per Install",          color: C.accent,  prefix: "₹", baseMultiplier: 1.00, postInstallRate: 1.00 },
  cpa:  { label: "CPA",  full: "Cost Per Action",           color: C.violet,  prefix: "₹", baseMultiplier: 3.20, postInstallRate: 0.31 },
  cprt: { label: "CPRT", full: "Cost Per Reactivation",     color: C.orange,  prefix: "₹", baseMultiplier: 2.10, postInstallRate: 0.47 },
  cpft: { label: "CPFT", full: "Cost Per First Transaction",color: C.gold,    prefix: "₹", baseMultiplier: 8.50, postInstallRate: 0.12 },
};

// Network bid elasticity — how each network responds to a +X% bid increase
// volume gain, cpc change, cpm change, conversion rate shift
const NETWORK_ELASTICITY = {
  Search: {
    volumeGain:   (bidPct) => Math.min(bidPct * 0.85, 60),    // impressions grow fast with bid
    cpcChange:    (bidPct) => bidPct * 0.70,                   // CPC rises but less than bid
    cpmChange:    (bidPct) => bidPct * 0.50,
    cvrBoost:     (bidPct) => bidPct * 0.12,                   // high-intent, CVR improves with placement
    cpiChange:    (bidPct) => bidPct * 0.55,                   // net CPI effect
    cpaChange:    (bidPct) => bidPct * 0.48,
    cprtChange:   (bidPct) => bidPct * 0.60,
    cpftChange:   (bidPct) => bidPct * 0.42,
    notes: "High-intent traffic. Bid increases yield strong volume gains with moderate CPC rise. CVR typically improves at top positions.",
  },
  YouTube: {
    volumeGain:   (bidPct) => Math.min(bidPct * 1.20, 80),    // massive reach unlock
    cpcChange:    (bidPct) => bidPct * 0.40,
    cpmChange:    (bidPct) => bidPct * 0.65,
    cvrBoost:     (bidPct) => bidPct * 0.05,                   // awareness-driven, CVR muted
    cpiChange:    (bidPct) => bidPct * 0.62,
    cpaChange:    (bidPct) => bidPct * 0.80,                   // action rates lower on YT
    cprtChange:   (bidPct) => bidPct * 0.75,
    cpftChange:   (bidPct) => bidPct * 0.95,
    notes: "Reach & awareness-first. Bid increases unlock broad audience segments quickly. CVR slower to respond; best for upper-funnel and re-engagement.",
  },
  Display: {
    volumeGain:   (bidPct) => Math.min(bidPct * 1.50, 90),    // near-infinite display inventory
    cpcChange:    (bidPct) => bidPct * 0.25,
    cpmChange:    (bidPct) => bidPct * 0.80,
    cvrBoost:     (bidPct) => -bidPct * 0.08,                  // display CVR can dip with broad reach
    cpiChange:    (bidPct) => bidPct * 0.70,
    cpaChange:    (bidPct) => bidPct * 0.90,
    cprtChange:   (bidPct) => bidPct * 0.55,                   // retargeting display is efficient for reactivation
    cpftChange:   (bidPct) => bidPct * 1.10,                   // transaction lift slowest
    notes: "Widest reach, lowest CPM. Great for retargeting (CPRT) but weakest for first-transaction. Bid increases scale volume most — watch for quality dilution.",
  },
};

const CAMPAIGN_SEEDS = [
  { id:"all",  name:"All Campaigns",      baseCPI:342,  baseCPA:1093, baseCPRT:717,  baseCPFT:2914, baseCVR:0.082, budget:200200, targetCPI:317, targetCPA:1002, targetCPRT:626, targetCPFT:2505, color:C.accent  },
  { id:"c1",   name:"iOS – Metro India",  baseCPI:434,  baseCPA:1385, baseCPRT:910,  baseCPFT:3691, baseCVR:0.091, budget:75150,  targetCPI:376, targetCPA:1169, targetCPRT:752, targetCPFT:3173, color:C.gold    },
  { id:"c2",   name:"Android – Tier 2",   baseCPI:234,  baseCPA:751,  baseCPRT:492,  baseCPFT:1987, baseCVR:0.071, budget:58450,  targetCPI:209, targetCPA:668,  targetCPRT:418, targetCPFT:1670, color:C.violet  },
  { id:"c3",   name:"iOS – Premium",      baseCPI:384,  baseCPA:1227, baseCPRT:810,  baseCPFT:3265, baseCVR:0.085, budget:41750,  targetCPI:334, targetCPA:1044, targetCPRT:668, targetCPFT:2756, color:C.blue    },
  { id:"c4",   name:"Android – Bharat",   baseCPI:159,  baseCPA:509,  baseCPRT:334,  baseCPFT:1353, baseCVR:0.068, budget:25050,  targetCPI:142, targetCPA:459,  targetCPRT:292, targetCPFT:1169, color:C.orange  },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const SEASONALITY = { Jan:0.82,Feb:0.85,Mar:0.93,Apr:0.96,May:1.00,Jun:1.05,Jul:1.02,Aug:1.08,Sep:1.12,Oct:1.18,Nov:1.35,Dec:1.45 };

/* ─── TIMELINE GENERATOR ─────────────────────────────────────────────────── */
function generateTimeline(seed, startMonth = 5) {
  const HIST = 12, FORE = 12;
  const rows = [];

  // Historical
  for (let w = 0; w < HIST; w++) {
    const mIdx   = (startMonth - HIST + w + 24) % 12;
    const season = SEASONALITY[MONTHS[mIdx]];
    const noise  = () => 0.88 + Math.random() * 0.24;

    const cpi  = parseFloat((seed.baseCPI  * season * noise()).toFixed(2));
    const cpa  = parseFloat((seed.baseCPA  * season * noise()).toFixed(2));
    const cprt = parseFloat((seed.baseCPRT * season * noise()).toFixed(2));
    const cpft = parseFloat((seed.baseCPFT * season * noise()).toFixed(2));
    const cvr  = parseFloat((seed.baseCVR  * (0.9 + Math.random() * 0.2)).toFixed(4));
    const wBudget = seed.budget * 7;
    const impr = Math.round((wBudget / 0.012) * (0.85 + Math.random() * 0.30));
    const clicks = Math.round(impr * 0.048 * (0.85 + Math.random() * 0.30));
    const inst = Math.max(1, Math.round(clicks * cvr));
    const actions = Math.round(inst * METRICS.cpa.postInstallRate  * (0.9 + Math.random() * 0.2));
    const reacts  = Math.round(inst * METRICS.cprt.postInstallRate * (0.9 + Math.random() * 0.2));
    const ftxns   = Math.round(inst * METRICS.cpft.postInstallRate * (0.9 + Math.random() * 0.2));
    const spend = parseFloat(Math.min(wBudget, inst * cpi).toFixed(0));

    rows.push({
      label: `W${w - HIST + 1}`, weekNum: w - HIST, phase: "historical", month: MONTHS[mIdx], season,
      cpi_actual: cpi, cpa_actual: cpa, cprt_actual: cprt, cpft_actual: cpft,
      installs_actual: inst, actions_actual: actions, reacts_actual: reacts, ftxns_actual: ftxns,
      spend_actual: spend, cvr_actual: parseFloat((cvr*100).toFixed(2)),
      impressions: impr, clicks,
      // forecast nulls
      cpi_opt:null,cpi_pes:null,cpi_base:null,
      cpa_opt:null,cpa_pes:null,cpa_base:null,
      cprt_opt:null,cprt_pes:null,cprt_base:null,
      cpft_opt:null,cpft_pes:null,cpft_base:null,
      inst_opt:null,inst_pes:null,
      spend_fore:null, recBid:null, recBudget:null, bidAction:null,
    });
  }

  // Forecast
  let trend = 1.0;
  for (let w = 0; w < FORE; w++) {
    const mIdx   = (startMonth + w) % 12;
    const season = SEASONALITY[MONTHS[mIdx]];
    trend = Math.max(trend * 0.97, 0.78);

    const mk = (base, mult) => {
      const opt = parseFloat((base * season * trend * mult).toFixed(2));
      const pes = parseFloat((opt * 1.18).toFixed(2));
      const base_ = parseFloat((base * season * (1 + w*0.006)).toFixed(2));
      return { opt, pes, base: base_ };
    };

    const cpi  = mk(seed.baseCPI,  0.92);
    const cpa  = mk(seed.baseCPA,  0.90);
    const cprt = mk(seed.baseCPRT, 0.94);
    const cpft = mk(seed.baseCPFT, 0.88);

    const baseInst = Math.round(seed.budget * 7 / cpi.base);
    const optInst  = Math.round(seed.budget * 7 / cpi.opt * 1.08);
    const pesInst  = Math.round(optInst * 0.83);

    const recBid    = parseFloat((seed.targetCPI * 0.94 * trend).toFixed(2));
    const recBudget = Math.round(seed.budget * (w < 4 ? 1.20 : w < 8 ? 1.35 : 1.50));
    const bidAction = cpi.opt < seed.targetCPI * 0.90 ? "Scale Up"
      : cpi.opt > seed.targetCPI * 1.10 ? "Scale Down" : "Hold";

    rows.push({
      label: `W${w+1}`, weekNum: w+1, phase:"forecast", month: MONTHS[mIdx], season,
      cpi_actual:null,cpa_actual:null,cprt_actual:null,cpft_actual:null,
      installs_actual:null,actions_actual:null,reacts_actual:null,ftxns_actual:null,
      spend_actual:null,cvr_actual:null,impressions:null,clicks:null,
      cpi_opt: cpi.opt,   cpi_pes: cpi.pes,   cpi_base: cpi.base,
      cpa_opt: cpa.opt,   cpa_pes: cpa.pes,   cpa_base: cpa.base,
      cprt_opt: cprt.opt, cprt_pes: cprt.pes, cprt_base: cprt.base,
      cpft_opt: cpft.opt, cpft_pes: cpft.pes, cpft_base: cpft.base,
      inst_opt: optInst, inst_pes: pesInst,
      spend_fore: parseFloat(Math.min(seed.budget*7*1.35, optInst*cpi.opt).toFixed(0)),
      recBid, recBudget, bidAction,
    });
  }
  return rows;
}

/* ─── NETWORK BID SIMULATOR ─────────────────────────────────────────────── */
function simulateNetworkResponse(seed, bidIncreasePct, metric) {
  return Object.entries(NETWORK_ELASTICITY).map(([netName, el]) => {
    const baseMetric = { cpi: seed.baseCPI, cpa: seed.baseCPA, cprt: seed.baseCPRT, cpft: seed.baseCPFT }[metric];
    const metricChangeKey = `${metric}Change`;
    const metricPctChange = el[metricChangeKey]?.(bidIncreasePct) ?? el.cpiChange(bidIncreasePct);

    const volumeGain     = parseFloat(el.volumeGain(bidIncreasePct).toFixed(1));
    const cvrBoost       = parseFloat(el.cvrBoost(bidIncreasePct).toFixed(1));
    const metricNew      = parseFloat((baseMetric * (1 + metricPctChange / 100)).toFixed(2));
    const metricDelta    = parseFloat((metricNew - baseMetric).toFixed(2));
    const metricDeltaPct = parseFloat(metricPctChange.toFixed(1));
    const cpmNew         = Math.round(234 * (1 + el.cpmChange(bidIncreasePct) / 100));
    const cpcNew         = Math.round(37.6 * (1 + el.cpcChange(bidIncreasePct) / 100));

    return {
      network: netName,
      color: NET[netName].color,
      icon: NET[netName].icon,
      volumeGainPct: volumeGain,
      cvrBoostPct: cvrBoost,
      metricBase: parseFloat(baseMetric.toFixed(2)),
      metricNew,
      metricDelta,
      metricDeltaPct,
      cpmNew,
      cpcNew,
      notes: el.notes,
      // For radar chart
      volumeScore:     Math.min(100, volumeGain * 1.2),
      efficiencyScore: Math.max(0, 100 - metricDeltaPct * 1.5),
      cvrScore:        Math.max(0, 50 + cvrBoost * 5),
      scaleScore:      Math.min(100, volumeGain * 1.1),
      qualityScore:    { Search: 80, YouTube: 60, Display: 45 }[netName],
    };
  });
}

/* ─── BID CURVE DATA (how metric changes across 0-100% bid increase) ─────── */
function buildBidCurves(seed, metric) {
  const points = [];
  for (let pct = 0; pct <= 100; pct += 5) {
    const row = { bidIncrease: pct };
    Object.entries(NETWORK_ELASTICITY).forEach(([net, el]) => {
      const base = { cpi: seed.baseCPI, cpa: seed.baseCPA, cprt: seed.baseCPRT, cpft: seed.baseCPFT }[metric];
      const changeKey = `${metric}Change`;
      const change = el[changeKey]?.(pct) ?? el.cpiChange(pct);
      row[`${net}_metric`]  = parseFloat((base * (1 + change / 100)).toFixed(2));
      row[`${net}_volume`]  = parseFloat(el.volumeGain(pct).toFixed(1));
    });
    points.push(row);
  }
  return points;
}

/* ─── PRE-GENERATE ───────────────────────────────────────────────────────── */
const ALL_TIMELINES = {};
CAMPAIGN_SEEDS.forEach(s => { ALL_TIMELINES[s.id] = generateTimeline(s, 5); });

/* ─── HELPERS (Indian Rupee / Indian number system) ──────────────────────── */
const fmtD  = (n) => n == null ? "—" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const fmtK  = (n) => {
  if (n == null) return "—";
  const v = Number(n);
  if (v >= 10000000) return `₹${(v/10000000).toFixed(2)}Cr`;
  if (v >= 100000)   return `₹${(v/100000).toFixed(2)}L`;
  if (v >= 1000)     return `₹${(v/1000).toFixed(1)}k`;
  return `₹${v}`;
};
const fmt   = (n) => n == null ? "—" : Number(n).toLocaleString("en-IN");
const pct   = (n) => n == null ? "—" : `${n > 0 ? "+" : ""}${Number(n).toFixed(1)}%`;

/* ─── TOOLTIP ────────────────────────────────────────────────────────────── */
function TT({ active, payload, label, extra }) {
  if (!active || !payload?.length) return null;
  const row = extra?.find?.(r => r.label === label || r.bidIncrease === label);
  const isHist = row?.phase === "historical";
  return (
    <div style={{ background:"#08091a", border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 16px", fontSize:11.5, minWidth:180, boxShadow:"0 8px 32px #000c" }}>
      {row?.phase && (
        <div style={{ marginBottom:7, paddingBottom:6, borderBottom:`1px solid ${C.border}`, display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ background:(isHist?C.blue:C.accent)+"25", color:isHist?C.blue:C.accent, borderRadius:4, padding:"1px 7px", fontSize:9.5, fontWeight:800 }}>{isHist?"HIST":"FORE"}</span>
          <span style={{ color:C.muted, fontWeight:700 }}>{label} · {row.month}</span>
        </div>
      )}
      {payload.map((p,i) => p.value != null && (
        <div key={i} style={{ display:"flex", justifyContent:"space-between", gap:16, marginBottom:3 }}>
          <span style={{ color:C.muted }}>{p.name}</span>
          <span style={{ color:p.color||C.text, fontWeight:800, fontFamily:"monospace" }}>
            {typeof p.value==="number" && p.value>1000 ? `₹${p.value.toLocaleString("en-IN", {maximumFractionDigits:0})}` : typeof p.value==="number" ? `₹${p.value.toLocaleString("en-IN", {maximumFractionDigits:0})}` : p.value}
          </span>
        </div>
      ))}
      {row?.bidAction && (
        <p style={{ color:row.bidAction==="Scale Up"?C.accent:row.bidAction==="Scale Down"?C.rose:C.gold, fontSize:10.5, fontWeight:800, margin:"6px 0 0" }}>
          {row.bidAction==="Scale Up"?"▲":"Scale Down"==="Scale Down"?"▼":"⏸"} {row.bidAction} · Bid: {fmtD(row.recBid)} · Budget: {fmtK(row.recBudget)}
        </p>
      )}
    </div>
  );
}

/* ─── BADGE ──────────────────────────────────────────────────────────────── */
const Badge = ({ type, sm }) => {
  const m = { "Scale Up":[C.accent,"#041a10"], "Hold":[C.gold,"#1a1400"], "Scale Down":[C.rose,"#1a0410"] }[type]||[C.muted,C.dim];
  return <span style={{ background:m[1], color:m[0], border:`1px solid ${m[0]}55`, borderRadius:5, padding:sm?"1px 7px":"3px 10px", fontSize:sm?9.5:11, fontWeight:800, letterSpacing:"0.05em", whiteSpace:"nowrap" }}>{type==="Scale Up"?"▲":type==="Scale Down"?"▼":"⏸"} {type}</span>;
};

/* ─── KPI CARD ───────────────────────────────────────────────────────────── */
const KPI = ({ label, val, sub, color, delta }) => (
  <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"13px 15px", flex:"1 1 120px" }}>
    <p style={{ color:C.muted, fontSize:9, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.1em", margin:"0 0 5px" }}>{label}</p>
    <p style={{ color:color||C.accent, fontSize:19, fontWeight:900, fontFamily:"monospace", margin:"0 0 2px" }}>{val}</p>
    {sub && <p style={{ color:C.dim, fontSize:10, margin:0 }}>{sub}</p>}
    {delta!=null && <p style={{ color:delta>=0?C.green:C.rose, fontSize:10, fontWeight:700, margin:"3px 0 0" }}>{delta>=0?"▲":"▼"} {Math.abs(delta)}% vs hist</p>}
  </div>
);

/* ─── PHASE LEGEND ───────────────────────────────────────────────────────── */
const PhaseLegend = ({ metricColor }) => (
  <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:10, fontSize:11, flexWrap:"wrap" }}>
    {[
      { line:"solid", color:C.blue,       label:"Historical (actual)" },
      { line:"dashed",color:C.muted,      label:"Baseline forecast" },
      { line:"solid", color:metricColor,  label:"Optimistic (recs applied)" },
      { line:"dashed",color:C.rose,       label:"Pessimistic deviation" },
    ].map((item,i) => (
      <div key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
        <svg width={28} height={8}><line x1={0} y1={4} x2={28} y2={4} stroke={item.color} strokeWidth={item.line==="dashed"?1.5:2.5} strokeDasharray={item.line==="dashed"?"5 3":"0"} /></svg>
        <span style={{ color:C.muted, fontWeight:600 }}>{item.label}</span>
      </div>
    ))}
    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
      <div style={{ width:10, height:10, background:C.gold, borderRadius:"50%" }} />
      <span style={{ color:C.muted, fontWeight:600 }}>Bid/budget change marker</span>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════════════ */
export default function SimulatorV4() {
  const [camp,       setCamp]       = useState("all");
  const [metric,     setMetric]     = useState("cpi");
  const [activeTab,  setActiveTab]  = useState("chart");
  const [bidInc,     setBidInc]     = useState(20);    // % bid increase for network sim
  const [netMetric,  setNetMetric]  = useState("cpi"); // metric for network tab
  const [showDev,    setShowDev]    = useState(true);
  const [showBase,   setShowBase]   = useState(true);

  const seed     = CAMPAIGN_SEEDS.find(c => c.id === camp) || CAMPAIGN_SEEDS[0];
  const timeline = ALL_TIMELINES[camp] || ALL_TIMELINES["all"];

  const histRows = timeline.filter(r => r.phase==="historical");
  const foreRows = timeline.filter(r => r.phase==="forecast");

  // Per-metric derived keys
  const MK = {
    cpi:  { actual:"cpi_actual",  opt:"cpi_opt",  pes:"cpi_pes",  base:"cpi_base",  target:seed.targetCPI,  instActual:"installs_actual", instOpt:"inst_opt" },
    cpa:  { actual:"cpa_actual",  opt:"cpa_opt",  pes:"cpa_pes",  base:"cpa_base",  target:seed.targetCPA,  instActual:"actions_actual",  instOpt:null },
    cprt: { actual:"cprt_actual", opt:"cprt_opt", pes:"cprt_pes", base:"cprt_base", target:seed.targetCPRT, instActual:"reacts_actual",   instOpt:null },
    cpft: { actual:"cpft_actual", opt:"cpft_opt", pes:"cpft_pes", base:"cpft_base", target:seed.targetCPFT, instActual:"ftxns_actual",    instOpt:null },
  };
  const mk = MK[metric];
  const mc = METRICS[metric];

  // KPI summaries
  const histAvg  = histRows.reduce((a,r) => a + (r[mk.actual]||0), 0) / histRows.length;
  const foreAvg  = foreRows.reduce((a,r) => a + (r[mk.opt]||0),    0) / foreRows.length;
  const delta    = parseFloat(((foreAvg/histAvg - 1)*100).toFixed(1));
  const histInst = histRows.reduce((a,r) => a + (r[mk.instActual]||0), 0);

  // Network response data
  const netData   = useMemo(() => simulateNetworkResponse(seed, bidInc, netMetric), [seed, bidInc, netMetric]);
  const bidCurves = useMemo(() => buildBidCurves(seed, netMetric),                  [seed, netMetric]);

  // Bid-change markers in forecast
  const bidChanges = foreRows.filter((r,i) => i===0 || r.bidAction !== foreRows[i-1]?.bidAction);

  // Tab & metric button styles
  const TAB = (t,lbl,ico) => (
    <button onClick={() => setActiveTab(t)} style={{
      padding:"7px 16px", borderRadius:8, border:"none", cursor:"pointer", fontSize:12, fontWeight:800, fontFamily:"inherit",
      background: activeTab===t ? seed.color : "transparent",
      color: activeTab===t ? "#040e08" : C.muted,
    }}>{ico} {lbl}</button>
  );

  const MBTN = (k) => (
    <button key={k} onClick={() => setMetric(k)} style={{
      padding:"5px 14px", borderRadius:7, border:`1.5px solid ${metric===k ? METRICS[k].color : C.border}`,
      background: metric===k ? METRICS[k].color+"1a" : "transparent",
      color: metric===k ? METRICS[k].color : C.muted,
      cursor:"pointer", fontSize:11.5, fontWeight:800, fontFamily:"inherit", transition:"all 0.15s",
    }}>
      {METRICS[k].label}
    </button>
  );

  const NMBTN = (k) => (
    <button key={k} onClick={() => setNetMetric(k)} style={{
      padding:"4px 12px", borderRadius:6, border:`1.5px solid ${netMetric===k ? METRICS[k].color : C.border}`,
      background: netMetric===k ? METRICS[k].color+"18" : "transparent",
      color: netMetric===k ? METRICS[k].color : C.muted,
      cursor:"pointer", fontSize:11, fontWeight:800, fontFamily:"inherit",
    }}>{METRICS[k].label}</button>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'Syne','DM Sans',system-ui,sans-serif" }}>

      {/* ── HEADER ── */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"15px 26px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:40, height:40, background:`linear-gradient(135deg,${C.accent},${C.violet})`, borderRadius:11, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, boxShadow:`0 0 18px ${C.accent}44` }}>⚡</div>
            <div>
              <h1 style={{ margin:0, fontSize:17, fontWeight:900, letterSpacing:"-0.03em" }}>
                <span style={{ color:seed.color }}>{seed.name}</span>
                <span style={{ color:C.muted, fontSize:12, fontWeight:400, marginLeft:10 }}>· Performance Simulator v4</span>
              </h1>
              <p style={{ margin:0, color:C.muted, fontSize:10.5 }}>CPI · CPA · CPRT · CPFT · Search · YouTube · Display · Bid Elasticity · <span style={{ color:C.gold, fontWeight:700 }}>₹ INR</span></p>
            </div>
          </div>

          {/* Campaign selector */}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ color:C.muted, fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.08em" }}>Campaign</span>
            {CAMPAIGN_SEEDS.map(c => (
              <button key={c.id} onClick={() => setCamp(c.id)} style={{
                padding:"4px 12px", borderRadius:7, border:`1.5px solid ${camp===c.id ? c.color : C.border}`,
                background: camp===c.id ? c.color+"18" : "transparent",
                color: camp===c.id ? c.color : C.muted,
                cursor:"pointer", fontSize:11, fontWeight:800, fontFamily:"inherit",
                boxShadow: camp===c.id ? `0 0 10px ${c.color}33` : "none",
              }}>{c.id==="all" ? "◉ All" : c.name}</button>
            ))}
          </div>
        </div>

        {/* Metric selector row */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:12, flexWrap:"wrap" }}>
          <span style={{ color:C.muted, fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.08em" }}>Metric</span>
          {Object.keys(METRICS).map(k => MBTN(k))}
          <div style={{ flex:1 }} />
          <span style={{ color:C.muted, fontSize:10.5 }}>{mc.full}</span>
          <span style={{ background:mc.color+"20", color:mc.color, borderRadius:6, padding:"2px 10px", fontSize:10.5, fontWeight:800 }}>
            Hist avg: {fmtD(histAvg)} · Fore avg (opt): {fmtD(foreAvg)}
            {delta !== 0 && <span style={{ color:delta<0?C.green:C.rose, marginLeft:8 }}>{pct(delta)}</span>}
          </span>
        </div>
      </div>

      <div style={{ padding:"18px 26px" }}>

        {/* ── KPI STRIP ── */}
        <div style={{ display:"flex", gap:10, marginBottom:18, flexWrap:"wrap" }}>
          <KPI label={`Hist Avg ${mc.label}`}  val={fmtD(histAvg)}      sub="Last 12 weeks"       color={C.blue}      />
          <KPI label={`Fore Avg ${mc.label}`}  val={fmtD(foreAvg)}      sub="Optimistic (recs)"   color={mc.color}    delta={delta} />
          <KPI label={`Target ${mc.label}`}    val={fmtD(mk.target)}    sub="Your goal"           color={C.gold}      />
          <KPI label="Hist Volume"             val={fmt(histInst)}       sub={`${mc.full} events`} color={C.blue}      />
          <KPI label="Rec. Bid W1"             val={fmtD(foreRows[0]?.recBid)}    sub="First forecast week" color={C.violet} />
          <KPI label="Rec. Budget W1"          val={fmtK(foreRows[0]?.recBudget)} sub="Daily"               color={C.teal}   />
        </div>

        {/* ── TAB BAR ── */}
        <div style={{ display:"flex", gap:3, marginBottom:18, background:C.surface, borderRadius:10, padding:4, border:`1px solid ${C.border}`, width:"fit-content", flexWrap:"wrap" }}>
          {TAB("chart",    "Performance Chart", "📈")}
          {TAB("networks", "Network Behavior",  "📡")}
          {TAB("bids",     "Bid & Budget Plan", "🎯")}
          {TAB("table",    "Data Table",        "📋")}
        </div>

        {/* ════ TAB: CHART ════ */}
        {activeTab==="chart" && (
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"20px 18px 14px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8, flexWrap:"wrap", gap:10 }}>
              <div>
                <h2 style={{ margin:"0 0 3px", fontSize:14.5, fontWeight:900 }}>
                  {mc.full} ({mc.label}) — Historical vs Forecast
                  <span style={{ color:C.muted, fontSize:11, fontWeight:400, marginLeft:10 }}>{seed.name}</span>
                </h2>
                <p style={{ margin:0, color:C.muted, fontSize:10.5 }}>Shaded zone = pessimistic deviation once recommendations applied · Gold marks = bid/budget changes</p>
              </div>
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                <label style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer", fontSize:11, color:C.muted }}>
                  <input type="checkbox" checked={showDev}  onChange={e=>setShowDev(e.target.checked)}  style={{ accentColor:C.rose }} /> Deviation
                </label>
                <label style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer", fontSize:11, color:C.muted }}>
                  <input type="checkbox" checked={showBase} onChange={e=>setShowBase(e.target.checked)} style={{ accentColor:C.muted }} /> Baseline
                </label>
              </div>
            </div>

            <PhaseLegend metricColor={mc.color} />

            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={timeline} margin={{ top:8, right:16, left:0, bottom:0 }}>
                <defs>
                  <linearGradient id="gHist" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={C.blue}    stopOpacity={0.20} />
                    <stop offset="100%" stopColor={C.blue}    stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gOpt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={mc.color}  stopOpacity={0.22} />
                    <stop offset="100%" stopColor={mc.color}  stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gPes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={C.rose}    stopOpacity={0.14} />
                    <stop offset="100%" stopColor={C.rose}    stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="label" tick={{ fill:C.muted, fontSize:9 }} axisLine={false} tickLine={false} interval={1} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill:C.muted, fontSize:9 }} width={48} />
                <Tooltip content={<TT extra={timeline} />} />

                {/* NOW marker */}
                <ReferenceLine x="W-1" stroke={C.gold} strokeWidth={1.5} label={{ value:"NOW", fill:C.gold, fontSize:9, fontWeight:800, position:"insideTopRight", dy:-4 }} />

                {/* Target line */}
                <ReferenceLine y={mk.target} stroke={C.rose} strokeWidth={1.5} strokeDasharray="5 3"
                  label={{ value:`Target ${fmtD(mk.target)}`, fill:C.rose, fontSize:9, position:"insideTopLeft", dy:-4 }} />

                {/* Historical */}
                <Area type="monotone" dataKey={mk.actual} name="Actual" stroke={C.blue} strokeWidth={2.5} fill="url(#gHist)" dot={false} connectNulls={false} activeDot={{ r:5, fill:C.blue }} />

                {/* Baseline */}
                {showBase && <Line type="monotone" dataKey={mk.base} name="Baseline" stroke={C.muted} strokeWidth={1.5} strokeDasharray="6 4" dot={false} connectNulls={false} activeDot={{ r:4 }} />}

                {/* Pessimistic deviation */}
                {showDev && <Area type="monotone" dataKey={mk.pes} name="Pessimistic" stroke={C.rose} strokeWidth={1.5} strokeDasharray="4 3" fill="url(#gPes)" dot={false} connectNulls={false} activeDot={{ r:4, fill:C.rose }} />}

                {/* Optimistic */}
                <Area type="monotone" dataKey={mk.opt} name="Optimistic (recs)" stroke={mc.color} strokeWidth={2.5} fill="url(#gOpt)" dot={false} connectNulls={false} activeDot={{ r:5, fill:mc.color }} />

                {/* Bid change markers */}
                {bidChanges.map((r,i) => {
                  const col = r.bidAction==="Scale Up" ? C.accent : r.bidAction==="Scale Down" ? C.rose : C.gold;
                  return <ReferenceLine key={i} x={r.label} stroke={col} strokeWidth={1} strokeDasharray="3 2" opacity={0.8}
                    label={{ value: r.bidAction==="Scale Up"?"▲":r.bidAction==="Scale Down"?"▼":"⏸", fill:col, fontSize:11, position:"insideTopRight" }} />;
                })}
              </ComposedChart>
            </ResponsiveContainer>

            {/* Phase labels */}
            <div style={{ display:"flex", marginTop:6, paddingLeft:48 }}>
              <div style={{ flex:12, textAlign:"center", fontSize:9.5, color:C.blue+"88", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", borderRight:`1px dashed ${C.gold}55`, paddingRight:8 }}>◀ Historical (12 wks)</div>
              <div style={{ flex:12, textAlign:"center", fontSize:9.5, color:mc.color+"88", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", paddingLeft:8 }}>Forecast (12 wks) ▶</div>
            </div>

            {/* Bid action strip */}
            <div style={{ marginTop:16, paddingTop:14, borderTop:`1px solid ${C.border}` }}>
              <p style={{ color:C.muted, fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.1em", margin:"0 0 10px" }}>
                📌 Bid & Budget Action Plan — <span style={{ color:mc.color }}>{mc.full}</span>
              </p>
              <div style={{ display:"flex", gap:7, overflowX:"auto", paddingBottom:4 }}>
                {foreRows.map((r,i) => {
                  const isChange = i===0 || r.bidAction !== foreRows[i-1]?.bidAction;
                  const col = r.bidAction==="Scale Up"?C.accent:r.bidAction==="Scale Down"?C.rose:C.gold;
                  return (
                    <div key={i} style={{ flex:"0 0 auto", background:isChange?col+"15":C.dim+"55", border:`1px solid ${isChange?col+"55":C.border}`, borderRadius:9, padding:"8px 12px", minWidth:82, textAlign:"center" }}>
                      <p style={{ color:C.muted, fontSize:9, fontWeight:700, margin:"0 0 4px" }}>{r.label}·{r.month}</p>
                      {isChange && <Badge type={r.bidAction} sm />}
                      <p style={{ color:col, fontFamily:"monospace", fontSize:10.5, fontWeight:800, margin:"5px 0 1px" }}>{fmtD(r.recBid)}</p>
                      <p style={{ color:C.muted, fontSize:9.5, margin:0 }}>{fmtK(r.recBudget)}/d</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ════ TAB: NETWORK BEHAVIOR ════ */}
        {activeTab==="networks" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

            {/* Controls */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"16px 20px", display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
              <div style={{ flex:1, minWidth:220 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ color:C.muted, fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.08em" }}>Bid Increase Simulation</span>
                  <span style={{ color:C.accent, fontWeight:900, fontFamily:"monospace", fontSize:15 }}>+{bidInc}%</span>
                </div>
                <input type="range" min={5} max={100} step={5} value={bidInc} onChange={e => setBidInc(+e.target.value)}
                  style={{ width:"100%", accentColor:C.accent, cursor:"pointer" }} />
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:9.5, color:C.dim, marginTop:3 }}>
                  <span>+5%</span><span>+100%</span>
                </div>
              </div>
              <div>
                <p style={{ color:C.muted, fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 7px" }}>Metric to Model</p>
                <div style={{ display:"flex", gap:6 }}>{Object.keys(METRICS).map(k => NMBTN(k))}</div>
              </div>
              <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", minWidth:220 }}>
                <p style={{ color:C.muted, fontSize:9.5, fontWeight:700, margin:"0 0 4px", textTransform:"uppercase" }}>Modeling: {METRICS[netMetric].full}</p>
                <p style={{ color:METRICS[netMetric].color, fontFamily:"monospace", fontWeight:800, fontSize:12, margin:0 }}>
                  Simulating +{bidInc}% bid · {seed.name}
                </p>
              </div>
            </div>

            {/* Network cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:14 }}>
              {netData.map((net, ni) => (
                <div key={ni} style={{ background:NET[net.network].bg, border:`1.5px solid ${net.color}44`, borderRadius:14, padding:20, position:"relative", overflow:"hidden" }}>
                  <div style={{ position:"absolute", top:0, right:0, width:80, height:80, background:net.color+"08", borderRadius:"0 14px 0 80px" }} />
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                    <div style={{ width:36, height:36, background:net.color+"22", border:`1.5px solid ${net.color}55`, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{net.icon}</div>
                    <div>
                      <p style={{ color:net.color, fontWeight:900, fontSize:15, margin:0 }}>{net.network}</p>
                      <p style={{ color:C.muted, fontSize:10, margin:0 }}>+{bidInc}% bid increase</p>
                    </div>
                  </div>

                  {/* Metric before/after */}
                  <div style={{ background:C.dim+"88", borderRadius:10, padding:"12px 14px", marginBottom:12 }}>
                    <p style={{ color:C.muted, fontSize:9.5, fontWeight:800, textTransform:"uppercase", margin:"0 0 8px" }}>{METRICS[netMetric].full}</p>
                    <div style={{ display:"flex", alignItems:"flex-end", gap:10 }}>
                      <div>
                        <p style={{ color:C.muted, fontSize:9, margin:"0 0 2px" }}>Before</p>
                        <p style={{ color:C.text, fontFamily:"monospace", fontWeight:700, fontSize:16, margin:0 }}>{fmtD(net.metricBase)}</p>
                      </div>
                      <div style={{ color:net.metricDelta>0?C.rose:C.green, fontSize:18, fontWeight:900, paddingBottom:2 }}>→</div>
                      <div>
                        <p style={{ color:C.muted, fontSize:9, margin:"0 0 2px" }}>After</p>
                        <p style={{ color:net.metricDelta>0?C.rose:C.green, fontFamily:"monospace", fontWeight:900, fontSize:22, margin:0 }}>{fmtD(net.metricNew)}</p>
                      </div>
                      <div style={{ marginLeft:"auto", textAlign:"right" }}>
                        <p style={{ color:C.muted, fontSize:9, margin:"0 0 2px" }}>Δ</p>
                        <p style={{ color:net.metricDelta>0?C.rose:C.green, fontFamily:"monospace", fontWeight:800, fontSize:13, margin:0 }}>
                          {net.metricDelta>0?"+":""}{fmtD(net.metricDelta)} ({pct(net.metricDeltaPct)})
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                    {[
                      { label:"Volume Gain",  val:`+${net.volumeGainPct}%`,  color:C.green },
                      { label:"CVR Shift",    val:pct(net.cvrBoostPct),       color:net.cvrBoostPct>=0?C.green:C.rose },
                      { label:"New CPM",      val:fmtD(net.cpmNew),          color:C.muted },
                      { label:"New CPC",      val:fmtD(net.cpcNew),          color:C.muted },
                    ].map((s,i) => (
                      <div key={i} style={{ background:C.dim+"88", borderRadius:7, padding:"8px 10px" }}>
                        <p style={{ color:C.muted, fontSize:9, margin:"0 0 3px", fontWeight:700 }}>{s.label}</p>
                        <p style={{ color:s.color, fontFamily:"monospace", fontWeight:800, fontSize:13, margin:0 }}>{s.val}</p>
                      </div>
                    ))}
                  </div>

                  {/* Bar: volume vs metric tradeoff */}
                  <div style={{ marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ color:C.muted, fontSize:9.5, fontWeight:700 }}>Volume Gain</span>
                      <span style={{ color:C.green, fontSize:9.5, fontWeight:700 }}>{net.volumeGainPct}%</span>
                    </div>
                    <div style={{ background:C.dim, borderRadius:4, height:6, overflow:"hidden" }}>
                      <div style={{ width:`${Math.min(net.volumeGainPct,100)}%`, background:net.color, height:"100%", borderRadius:4, transition:"width 0.4s" }} />
                    </div>
                  </div>
                  <div style={{ marginBottom:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ color:C.muted, fontSize:9.5, fontWeight:700 }}>Efficiency Cost</span>
                      <span style={{ color:C.rose, fontSize:9.5, fontWeight:700 }}>+{net.metricDeltaPct.toFixed(1)}%</span>
                    </div>
                    <div style={{ background:C.dim, borderRadius:4, height:6, overflow:"hidden" }}>
                      <div style={{ width:`${Math.min(net.metricDeltaPct, 100)}%`, background:C.rose, height:"100%", borderRadius:4, transition:"width 0.4s" }} />
                    </div>
                  </div>

                  <p style={{ color:C.muted, fontSize:10.5, lineHeight:1.6, margin:0, borderTop:`1px solid ${net.color}22`, paddingTop:10 }}>{net.notes}</p>
                </div>
              ))}
            </div>

            {/* Bid curve chart — metric across all networks */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"16px 14px" }}>
                <p style={{ color:C.text, fontWeight:900, fontSize:13, margin:"0 0 14px" }}>
                  {METRICS[netMetric].full} vs Bid Increase — All Networks
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={bidCurves} margin={{ top:4, right:4, left:-18, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                    <XAxis dataKey="bidIncrease" tick={{ fill:C.muted, fontSize:9 }} axisLine={false} tickLine={false}
                      tickFormatter={v => `+${v}%`} />
                    <YAxis tick={{ fill:C.muted, fontSize:9 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<TT extra={[]} />} />
                    <ReferenceLine x={bidInc} stroke={C.gold} strokeDasharray="4 3" strokeWidth={1.5}
                      label={{ value:`+${bidInc}%`, fill:C.gold, fontSize:9 }} />
                    {Object.keys(NET).map(n => (
                      <Line key={n} type="monotone" dataKey={`${n}_metric`} name={`${n} ${METRICS[netMetric].label}`}
                        stroke={NET[n].color} strokeWidth={2} dot={false} activeDot={{ r:4 }} />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"16px 14px" }}>
                <p style={{ color:C.text, fontWeight:900, fontSize:13, margin:"0 0 14px" }}>
                  Volume Gain vs Bid Increase — All Networks
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={bidCurves} margin={{ top:4, right:4, left:-18, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                    <XAxis dataKey="bidIncrease" tick={{ fill:C.muted, fontSize:9 }} axisLine={false} tickLine={false}
                      tickFormatter={v => `+${v}%`} />
                    <YAxis tick={{ fill:C.muted, fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={v => `+${v}%`} />
                    <Tooltip content={<TT extra={[]} />} />
                    <ReferenceLine x={bidInc} stroke={C.gold} strokeDasharray="4 3" strokeWidth={1.5} />
                    {Object.keys(NET).map(n => (
                      <Area key={n} type="monotone" dataKey={`${n}_volume`} name={`${n} Volume`}
                        stroke={NET[n].color} strokeWidth={2} fill={NET[n].color+"14"} dot={false} activeDot={{ r:4 }} />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Radar: network comparison at current bid increase */}
              <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"16px 14px" }}>
                <p style={{ color:C.text, fontWeight:900, fontSize:13, margin:"0 0 14px" }}>
                  Network Score Radar at +{bidInc}% Bid
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={[
                    { axis:"Volume",     ...Object.fromEntries(netData.map(n=>[n.network, n.volumeScore])) },
                    { axis:"Efficiency", ...Object.fromEntries(netData.map(n=>[n.network, n.efficiencyScore])) },
                    { axis:"CVR",        ...Object.fromEntries(netData.map(n=>[n.network, n.cvrScore])) },
                    { axis:"Scale",      ...Object.fromEntries(netData.map(n=>[n.network, n.scaleScore])) },
                    { axis:"Quality",    ...Object.fromEntries(netData.map(n=>[n.network, n.qualityScore])) },
                  ]}>
                    <PolarGrid stroke={C.border} />
                    <PolarAngleAxis dataKey="axis" tick={{ fill:C.muted, fontSize:9.5 }} />
                    <PolarRadiusAxis angle={90} domain={[0,100]} tick={false} axisLine={false} />
                    {Object.keys(NET).map(n => (
                      <Radar key={n} name={n} dataKey={n} stroke={NET[n].color} fill={NET[n].color} fillOpacity={0.12} />
                    ))}
                    <Legend iconType="circle" wrapperStyle={{ fontSize:10 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Side-by-side metric bar */}
              <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"16px 14px" }}>
                <p style={{ color:C.text, fontWeight:900, fontSize:13, margin:"0 0 14px" }}>
                  All Metrics at +{bidInc}% Bid — {netData.map(n=>n.network).join(", ")}
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={Object.keys(METRICS).map(k => {
                      const base = { cpi:seed.baseCPI, cpa:seed.baseCPA, cprt:seed.baseCPRT, cpft:seed.baseCPFT }[k];
                      const row = { metric: METRICS[k].label };
                      Object.entries(NETWORK_ELASTICITY).forEach(([net, el]) => {
                        const changeKey = `${k}Change`;
                        const change = el[changeKey]?.(bidInc) ?? el.cpiChange(bidInc);
                        row[net] = parseFloat((base * (1 + change/100)).toFixed(2));
                      });
                      return row;
                    })}
                    margin={{ top:4, right:4, left:-16, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                    <XAxis dataKey="metric" tick={{ fill:C.muted, fontSize:10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill:C.muted, fontSize:9 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<TT extra={[]} />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize:10 }} />
                    {Object.keys(NET).map(n => (
                      <Bar key={n} dataKey={n} name={n} fill={NET[n].color} radius={[4,4,0,0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ════ TAB: BID PLAN ════ */}
        {activeTab==="bids" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, overflow:"hidden", gridColumn:"1 / -1" }}>
              <div style={{ padding:"13px 18px", borderBottom:`1px solid ${C.border}` }}>
                <p style={{ color:C.text, fontWeight:900, fontSize:13, margin:0 }}>
                  Week-by-Week Bid & Budget Plan — {mc.full} · {seed.name}
                </p>
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11.5 }}>
                  <thead>
                    <tr style={{ background:C.panel }}>
                      {["Wk","Mo","Season","Action","Rec. Bid","Budget/d","CPI Opt","CPI Pes","CPA Opt","CPRT Opt","CPFT Opt","Installs","Note"].map(h => (
                        <th key={h} style={{ padding:"9px 12px", color:C.muted, fontWeight:700, fontSize:9.5, textTransform:"uppercase", textAlign:"right", whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {foreRows.map((r,i) => {
                      const isChange = i===0 || r.bidAction !== foreRows[i-1]?.bidAction;
                      return (
                        <tr key={i} style={{ borderTop:`1px solid ${C.border}`, background:isChange?seed.color+"0a":i%2===0?C.surface:C.panel }}>
                          <td style={{ padding:"7px 12px", color:isChange?seed.color:C.muted, fontWeight:800, textAlign:"right", fontFamily:"monospace" }}>{r.label}</td>
                          <td style={{ padding:"7px 12px", color:C.muted, textAlign:"right" }}>{r.month}</td>
                          <td style={{ padding:"7px 12px", color:r.season>1.2?C.gold:C.muted, textAlign:"right", fontWeight:r.season>1.2?700:400 }}>{r.season}x</td>
                          <td style={{ padding:"7px 12px", textAlign:"right" }}><Badge type={r.bidAction} sm /></td>
                          <td style={{ padding:"7px 12px", color:C.accent, fontWeight:800, textAlign:"right", fontFamily:"monospace" }}>{fmtD(r.recBid)}</td>
                          <td style={{ padding:"7px 12px", color:C.violet, fontWeight:800, textAlign:"right", fontFamily:"monospace" }}>{fmtK(r.recBudget)}</td>
                          <td style={{ padding:"7px 12px", color:r.cpi_opt<seed.targetCPI?C.green:C.rose, textAlign:"right", fontFamily:"monospace", fontWeight:700 }}>{fmtD(r.cpi_opt)}</td>
                          <td style={{ padding:"7px 12px", color:C.rose, textAlign:"right", fontFamily:"monospace", opacity:0.75 }}>{fmtD(r.cpi_pes)}</td>
                          <td style={{ padding:"7px 12px", color:C.violet, textAlign:"right", fontFamily:"monospace" }}>{fmtD(r.cpa_opt)}</td>
                          <td style={{ padding:"7px 12px", color:C.orange, textAlign:"right", fontFamily:"monospace" }}>{fmtD(r.cprt_opt)}</td>
                          <td style={{ padding:"7px 12px", color:C.gold, textAlign:"right", fontFamily:"monospace" }}>{fmtD(r.cpft_opt)}</td>
                          <td style={{ padding:"7px 12px", color:C.accent, textAlign:"right", fontFamily:"monospace" }}>{fmt(r.inst_opt)}</td>
                          <td style={{ padding:"7px 12px", color:C.muted, fontSize:10.5 }}>
                            {isChange ? (r.bidAction==="Scale Up"?"↑ CPI efficient — increase budget & bid":r.bidAction==="Scale Down"?"↓ CPI pressure — reduce bid 10-15%":"Maintain — on target") : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CPA / CPRT / CPFT forecast charts */}
            {[
              { key:"cpa",  label:"CPA",  opt:"cpa_opt",  pes:"cpa_pes",  target:seed.targetCPA,  color:C.violet },
              { key:"cprt", label:"CPRT", opt:"cprt_opt", pes:"cprt_pes", target:seed.targetCPRT, color:C.orange },
              { key:"cpft", label:"CPFT", opt:"cpft_opt", pes:"cpft_pes", target:seed.targetCPFT, color:C.gold   },
            ].map(m => (
              <div key={m.key} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"16px 14px" }}>
                <p style={{ color:C.text, fontWeight:900, fontSize:13, margin:"0 0 14px" }}>
                  <span style={{ color:m.color }}>{m.label}</span> Forecast — Opt vs Pes
                </p>
                <ResponsiveContainer width="100%" height={175}>
                  <ComposedChart data={foreRows} margin={{ top:4, right:4, left:-18, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill:C.muted, fontSize:9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill:C.muted, fontSize:9 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<TT extra={foreRows} />} />
                    <ReferenceLine y={m.target} stroke={C.rose} strokeDasharray="4 3"
                      label={{ value:`Target ${fmtD(m.target)}`, fill:C.rose, fontSize:9, position:"insideTopLeft" }} />
                    <Area type="monotone" dataKey={m.pes} name="Pessimistic" stroke={C.rose} strokeDasharray="4 3" strokeWidth={1.5} fill={C.rose+"12"} dot={false} connectNulls />
                    <Line type="monotone" dataKey={m.opt} name="Optimistic"  stroke={m.color} strokeWidth={2.5} dot={false} connectNulls activeDot={{ r:4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        )}

        {/* ════ TAB: TABLE ════ */}
        {activeTab==="table" && (
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, overflow:"hidden" }}>
            <div style={{ padding:"13px 18px", borderBottom:`1px solid ${C.border}` }}>
              <p style={{ color:C.text, fontWeight:900, fontSize:13, margin:0 }}>Full Timeline — {seed.name}</p>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead>
                  <tr style={{ background:C.panel }}>
                    {["Period","Phase","Mo","CPI Act","CPA Act","CPRT Act","CPFT Act","Installs","Actions","Reacts","1st Txn","Spend","CPI Opt","CPI Pes","CPA Opt","CPRT Opt","CPFT Opt","Rec Bid","Budget","Action"].map(h => (
                      <th key={h} style={{ padding:"8px 10px", color:C.muted, fontWeight:700, fontSize:9, textTransform:"uppercase", textAlign:"right", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((r,i) => {
                    const isH = r.phase==="historical";
                    return (
                      <tr key={i} style={{ borderTop:`1px solid ${C.border}`, background:isH?i%2===0?C.surface:C.panel:i%2===0?C.blue+"06":seed.color+"05" }}>
                        <td style={{ padding:"6px 10px", color:isH?C.blue:seed.color, fontWeight:800, textAlign:"right", fontFamily:"monospace" }}>{r.label}</td>
                        <td style={{ padding:"6px 10px", textAlign:"right" }}>
                          <span style={{ color:isH?C.blue:seed.color, fontSize:9, fontWeight:700, background:(isH?C.blue:seed.color)+"18", borderRadius:3, padding:"1px 5px" }}>{isH?"HIST":"FORE"}</span>
                        </td>
                        <td style={{ padding:"6px 10px", color:C.muted, textAlign:"right" }}>{r.month}</td>
                        {[r.cpi_actual,r.cpa_actual,r.cprt_actual,r.cpft_actual].map((v,vi) => (
                          <td key={vi} style={{ padding:"6px 10px", color:C.blue, textAlign:"right", fontFamily:"monospace" }}>{v ? `₹${Number(v).toLocaleString("en-IN",{maximumFractionDigits:0})}` : "—"}</td>
                        ))}
                        {[r.installs_actual,r.actions_actual,r.reacts_actual,r.ftxns_actual].map((v,vi) => (
                          <td key={vi} style={{ padding:"6px 10px", color:C.blue+"bb", textAlign:"right" }}>{v?.toLocaleString("en-IN")??"—"}</td>
                        ))}
                        <td style={{ padding:"6px 10px", color:C.violet+"bb", textAlign:"right", fontFamily:"monospace" }}>{r.spend_actual ? `₹${Number(r.spend_actual).toLocaleString("en-IN",{maximumFractionDigits:0})}` : "—"}</td>
                        {[{v:r.cpi_opt,c:seed.color},{v:r.cpi_pes,c:C.rose},{v:r.cpa_opt,c:C.violet},{v:r.cprt_opt,c:C.orange},{v:r.cpft_opt,c:C.gold}].map(({v,c},vi) => (
                          <td key={vi} style={{ padding:"6px 10px", color:c, textAlign:"right", fontFamily:"monospace" }}>{v ? `₹${Number(v).toLocaleString("en-IN",{maximumFractionDigits:0})}` : "—"}</td>
                        ))}
                        <td style={{ padding:"6px 10px", color:C.accent, textAlign:"right", fontFamily:"monospace", fontWeight:700 }}>{r.recBid ? `₹${Number(r.recBid).toLocaleString("en-IN",{maximumFractionDigits:0})}` : "—"}</td>
                        <td style={{ padding:"6px 10px", color:C.teal, textAlign:"right", fontFamily:"monospace" }}>{r.recBudget?fmtK(r.recBudget):"—"}</td>
                        <td style={{ padding:"6px 10px", textAlign:"right" }}>{r.bidAction?<Badge type={r.bidAction} sm />:<span style={{ color:C.muted }}>—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

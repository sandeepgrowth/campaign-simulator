import { useState, useMemo } from "react";
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

const NET = {
  Search:  { color: "#4285f4", icon: "🔍", bg: "#0a1228" },
  YouTube: { color: "#ff0033", icon: "▶", bg: "#1a0808" },
  Display: { color: "#34a853", icon: "◻", bg: "#081a10" },
};

const METRICS = {
  cpi:  { label: "CPI",  full: "Cost Per Install",          color: C.accent,  prefix: "₹" },
  cpa:  { label: "CPA",  full: "Cost Per Action",           color: C.violet,  prefix: "₹" },
  cprt: { label: "CPRT", full: "Cost Per Reactivation",     color: C.orange,  prefix: "₹" },
  cpft: { label: "CPFT", full: "Cost Per First Transaction",color: C.gold,    prefix: "₹" },
};

const NETWORK_ELASTICITY = {
  Search: {
    volumeGain: (bidPct) => Math.min(bidPct * 0.85, 60),
    cpcChange: (bidPct) => bidPct * 0.70,
    cpmChange: (bidPct) => bidPct * 0.50,
    cvrBoost: (bidPct) => bidPct * 0.12,
    cpiChange: (bidPct) => bidPct * 0.55,
    cpaChange: (bidPct) => bidPct * 0.48,
    cprtChange: (bidPct) => bidPct * 0.60,
    cpftChange: (bidPct) => bidPct * 0.42,
    notes: "High-intent traffic. Bid increases yield strong volume gains with moderate CPC rise.",
  },
  YouTube: {
    volumeGain: (bidPct) => Math.min(bidPct * 1.20, 80),
    cpcChange: (bidPct) => bidPct * 0.40,
    cpmChange: (bidPct) => bidPct * 0.65,
    cvrBoost: (bidPct) => bidPct * 0.05,
    cpiChange: (bidPct) => bidPct * 0.62,
    cpaChange: (bidPct) => bidPct * 0.80,
    cprtChange: (bidPct) => bidPct * 0.75,
    cpftChange: (bidPct) => bidPct * 0.95,
    notes: "Reach & awareness-first. Best for upper-funnel and re-engagement.",
  },
  Display: {
    volumeGain: (bidPct) => Math.min(bidPct * 1.50, 90),
    cpcChange: (bidPct) => bidPct * 0.25,
    cpmChange: (bidPct) => bidPct * 0.80,
    cvrBoost: (bidPct) => -bidPct * 0.08,
    cpiChange: (bidPct) => bidPct * 0.70,
    cpaChange: (bidPct) => bidPct * 0.90,
    cprtChange: (bidPct) => bidPct * 0.55,
    cpftChange: (bidPct) => bidPct * 1.10,
    notes: "Widest reach, lowest CPM. Great for retargeting but watch quality.",
  },
};

const DEMO_CAMPAIGNS = [
  { id:"all",  name:"All Campaigns",      baseCPI:342,  baseCPA:1093, baseCPRT:717,  baseCPFT:2914, budget:200200, targetCPI:317, targetCPA:1002, targetCPRT:626, targetCPFT:2505, color:C.accent  },
  { id:"c1",   name:"iOS – Metro India",  baseCPI:434,  baseCPA:1385, baseCPRT:910,  baseCPFT:3691, budget:75150,  targetCPI:376, targetCPA:1169, targetCPRT:752, targetCPFT:3173, color:C.gold    },
  { id:"c2",   name:"Android – Tier 2",   baseCPI:234,  baseCPA:751,  baseCPRT:492,  baseCPFT:1987, budget:58450,  targetCPI:209, targetCPA:668,  targetCPRT:418, targetCPFT:1670, color:C.violet  },
  { id:"c3",   name:"iOS – Premium",      baseCPI:384,  baseCPA:1227, baseCPRT:810,  baseCPFT:3265, budget:41750,  targetCPI:334, targetCPA:1044, targetCPRT:668, targetCPFT:2756, color:C.blue    },
  { id:"c4",   name:"Android – Bharat",   baseCPI:159,  baseCPA:509,  baseCPRT:334,  baseCPFT:1353, budget:25050,  targetCPI:142, targetCPA:459,  targetCPRT:292, targetCPFT:1169, color:C.orange  },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const SEASONALITY = { Jan:0.82,Feb:0.85,Mar:0.93,Apr:0.96,May:1.00,Jun:1.05,Jul:1.02,Aug:1.08,Sep:1.12,Oct:1.18,Nov:1.35,Dec:1.45 };

/* ─── HELPERS ────────────────────────────────────────────────────────────── */
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

/* ─── SMART CSV PARSER (basic + enhanced formats) ──────────────────────────── */
function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return null;
  
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    
    headers.forEach((h, idx) => {
      const val = values[idx];
      
      // Core metrics (basic format)
      if (h.includes('week') || h.includes('date')) row.week = val;
      else if (h.includes('campaign')) row.campaign = val;
      else if (h.includes('impression')) row.impressions = parseInt(val) || 0;
      else if (h.includes('click')) row.clicks = parseInt(val) || 0;
      else if (h.includes('install') && !h.includes('cost')) row.installs = parseInt(val) || 0;
      else if (h.includes('spend') || (h.includes('cost') && h.length < 6)) row.spend = parseFloat(val) || 0;
      else if (h === 'cpi' || h.includes('cost_per_install')) row.cpi = parseFloat(val) || 0;
      else if (h.includes('cvr') || h.includes('conversion_rate')) row.cvr = parseFloat(val) || 0;
      else if (h.includes('ctr')) row.ctr = parseFloat(val) || 0;
      
      // Enhanced columns (optional)
      else if (h.includes('budget')) row.budget = parseFloat(val) || null;
      else if (h.includes('network') || h.includes('channel')) row.network = val || null;
      else if (h.includes('action') && !h.includes('cost') && !h.includes('reactivat')) row.actions = parseInt(val) || null;
      else if (h.includes('reactivat')) row.reactivations = parseInt(val) || null;
      else if (h.includes('first_transaction') || h.includes('ftxn')) row.first_transactions = parseInt(val) || null;
      else if (h.includes('target_cpi')) row.target_cpi = parseFloat(val) || null;
      else if (h.includes('target_cpa')) row.target_cpa = parseFloat(val) || null;
      else if (h.includes('target_cprt')) row.target_cprt = parseFloat(val) || null;
      else if (h.includes('target_cpft')) row.target_cpft = parseFloat(val) || null;
      
      // Pre-calculated costs
      else if (h === 'cpa' || h.includes('cost_per_action')) row.cpa = parseFloat(val) || null;
      else if (h === 'cprt') row.cprt = parseFloat(val) || null;
      else if (h === 'cpft') row.cpft = parseFloat(val) || null;
    });
    
    // Calculate derived costs if events provided
    if (row.spend && row.actions && !row.cpa) {
      row.cpa = row.actions > 0 ? Math.round(row.spend / row.actions) : null;
    }
    if (row.spend && row.reactivations && !row.cprt) {
      row.cprt = row.reactivations > 0 ? Math.round(row.spend / row.reactivations) : null;
    }
    if (row.spend && row.first_transactions && !row.cpft) {
      row.cpft = row.first_transactions > 0 ? Math.round(row.spend / row.first_transactions) : null;
    }
    
    if (row.week && row.installs > 0) rows.push(row);
  }
  
  return rows.length > 0 ? rows : null;
}

/* ─── TREND CALCULATION (last 4 weeks linear regression) ───────────────────── */
function calculateTrend(data, field) {
  if (!data || data.length < 2) return 0;
  const recent = data.slice(-Math.min(4, data.length));
  const n = recent.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  recent.forEach((r, i) => {
    const x = i;
    const y = r[field] || 0;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  });
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return isFinite(slope) ? slope : 0;
}

/* ─── TIMELINE GENERATOR (from uploaded or demo data) ──────────────────────── */
function generateTimelineFromData(uploadedData, userSettings) {
  if (!uploadedData || uploadedData.length === 0) {
    return generateDemoTimeline(DEMO_CAMPAIGNS[0], 5);
  }
  
  // Use uploaded as historical
  const historical = uploadedData.map((row, i) => ({
    label: row.week || `W${i - uploadedData.length + 1}`,
    weekNum: i - uploadedData.length,
    phase: "historical",
    month: MONTHS[i % 12],
    season: 1.0,
    cpi_actual: row.cpi || 0,
    cpa_actual: row.cpa || null,
    cprt_actual: row.cprt || null,
    cpft_actual: row.cpft || null,
    installs_actual: row.installs || 0,
    actions_actual: row.actions || null,
    reacts_actual: row.reactivations || null,
    ftxns_actual: row.first_transactions || null,
    spend_actual: row.spend || 0,
    cvr_actual: row.cvr || 0,
    ctr_actual: row.ctr || 0,
    impressions: row.impressions || 0,
    clicks: row.clicks || 0,
    budget_actual: row.budget || null,
    network: row.network || null,
    cpi_opt:null, cpi_pes:null, cpi_base:null,
    cpa_opt:null, cpa_pes:null, cpa_base:null,
    cprt_opt:null, cprt_pes:null, cprt_base:null,
    cpft_opt:null, cpft_pes:null, cpft_base:null,
    inst_opt:null, inst_pes:null,
    spend_fore:null, recBid:null, recBudget:null, bidAction:null,
  }));
  
  // Calculate trends from last 4 weeks
  const cpiTrend = calculateTrend(uploadedData, 'cpi');
  const cpaTrend = uploadedData[0].cpa ? calculateTrend(uploadedData, 'cpa') : 0;
  const cprtTrend = uploadedData[0].cprt ? calculateTrend(uploadedData, 'cprt') : 0;
  const cpftTrend = uploadedData[0].cpft ? calculateTrend(uploadedData, 'cpft') : 0;
  
  const lastWeek = uploadedData[uploadedData.length - 1];
  const baseCPI = lastWeek.cpi || 342;
  const baseCPA = lastWeek.cpa || null;
  const baseCPRT = lastWeek.cprt || null;
  const baseCPFT = lastWeek.cpft || null;
  const avgBudget = uploadedData.reduce((a, r) => a + (r.budget || r.spend), 0) / uploadedData.length;
  
  // User targets or defaults
  const targetCPI = userSettings?.targetCPI || lastWeek.target_cpi || baseCPI * 0.92;
  const targetCPA = userSettings?.targetCPA || lastWeek.target_cpa || (baseCPA ? baseCPA * 0.90 : null);
  const targetCPRT = userSettings?.targetCPRT || lastWeek.target_cprt || (baseCPRT ? baseCPRT * 0.88 : null);
  const targetCPFT = userSettings?.targetCPFT || lastWeek.target_cpft || (baseCPFT ? baseCPFT * 0.85 : null);
  
  // Generate forecast
  const forecast = [];
  
  for (let w = 0; w < 12; w++) {
    const mIdx = (5 + w) % 12;
    const season = SEASONALITY[MONTHS[mIdx]];
    
    // Trend-based projection with seasonal adjustment
    const projCPI = Math.max(10, Math.round(baseCPI + cpiTrend * (w + 1)));
    const projCPA = baseCPA ? Math.max(10, Math.round(baseCPA + cpaTrend * (w + 1))) : null;
    const projCPRT = baseCPRT ? Math.max(10, Math.round(baseCPRT + cprtTrend * (w + 1))) : null;
    const projCPFT = baseCPFT ? Math.max(10, Math.round(baseCPFT + cpftTrend * (w + 1))) : null;
    
    // Optimistic = move toward target
    const optCPI = Math.round(projCPI * 0.92 + targetCPI * 0.08);
    const optCPA = projCPA ? Math.round(projCPA * 0.90 + (targetCPA || projCPA * 0.90) * 0.10) : null;
    const optCPRT = projCPRT ? Math.round(projCPRT * 0.88 + (targetCPRT || projCPRT * 0.88) * 0.12) : null;
    const optCPFT = projCPFT ? Math.round(projCPFT * 0.85 + (targetCPFT || projCPFT * 0.85) * 0.15) : null;
    
    // Pessimistic = worse case
    const pesCPI = Math.round(optCPI * 1.18);
    const pesCPA = optCPA ? Math.round(optCPA * 1.20) : null;
    const pesCPRT = optCPRT ? Math.round(optCPRT * 1.15) : null;
    const pesCPFT = optCPFT ? Math.round(optCPFT * 1.22) : null;
    
    const optInst = Math.round(avgBudget / optCPI * 1.05);
    const pesInst = Math.round(optInst * 0.82);
    
    const recBid = Math.round(targetCPI * 0.95);
    const recBudget = Math.round(avgBudget * (w < 4 ? 1.15 : w < 8 ? 1.25 : 1.35));
    const bidAction = optCPI < targetCPI * 0.90 ? "Scale Up" : optCPI > targetCPI * 1.10 ? "Scale Down" : "Hold";
    
    forecast.push({
      label: `W${w+1}`,
      weekNum: w+1,
      phase: "forecast",
      month: MONTHS[mIdx],
      season,
      cpi_actual:null, cpa_actual:null, cprt_actual:null, cpft_actual:null,
      installs_actual:null, actions_actual:null, reacts_actual:null, ftxns_actual:null,
      spend_actual:null, cvr_actual:null, ctr_actual:null, impressions:null, clicks:null,
      budget_actual:null, network:null,
      cpi_opt: optCPI, cpi_pes: pesCPI, cpi_base: projCPI,
      cpa_opt: optCPA, cpa_pes: pesCPA, cpa_base: projCPA,
      cprt_opt: optCPRT, cprt_pes: pesCPRT, cprt_base: projCPRT,
      cpft_opt: optCPFT, cpft_pes: pesCPFT, cpft_base: projCPFT,
      inst_opt: optInst, inst_pes: pesInst,
      spend_fore: Math.min(recBudget * 7, optInst * optCPI),
      recBid, recBudget, bidAction,
    });
  }
  
  return [...historical, ...forecast];
}

function generateDemoTimeline(seed, startMonth = 5) {
  const HIST = 12, FORE = 12;
  const rows = [];
  
  for (let w = 0; w < HIST; w++) {
    const mIdx = (startMonth - HIST + w + 24) % 12;
    const season = SEASONALITY[MONTHS[mIdx]];
    const noise = () => 0.88 + Math.random() * 0.24;
    
    const cpi = Math.round(seed.baseCPI * season * noise());
    const cpa = Math.round(seed.baseCPA * season * noise());
    const cprt = Math.round(seed.baseCPRT * season * noise());
    const cpft = Math.round(seed.baseCPFT * season * noise());
    const wBudget = seed.budget * 7;
    const impr = Math.round((wBudget / 1) * (0.85 + Math.random() * 0.30));
    const clicks = Math.round(impr * 0.048 * (0.85 + Math.random() * 0.30));
    const inst = Math.max(1, Math.round(clicks * 0.082));
    const spend = Math.min(wBudget, inst * cpi);
    
    rows.push({
      label: `W${w - HIST + 1}`, weekNum: w - HIST, phase: "historical", month: MONTHS[mIdx], season,
      cpi_actual: cpi, cpa_actual: cpa, cprt_actual: cprt, cpft_actual: cpft,
      installs_actual: inst,
      actions_actual: Math.round(inst * 0.31),
      reacts_actual: Math.round(inst * 0.47),
      ftxns_actual: Math.round(inst * 0.12),
      spend_actual: spend,
      cvr_actual: 8.2, ctr_actual: 4.8,
      impressions: impr, clicks,
      budget_actual: seed.budget, network: null,
      cpi_opt:null, cpi_pes:null, cpi_base:null,
      cpa_opt:null, cpa_pes:null, cpa_base:null,
      cprt_opt:null, cprt_pes:null, cprt_base:null,
      cpft_opt:null, cpft_pes:null, cpft_base:null,
      inst_opt:null, inst_pes:null,
      spend_fore:null, recBid:null, recBudget:null, bidAction:null,
    });
  }
  
  let trend = 1.0;
  for (let w = 0; w < FORE; w++) {
    const mIdx = (startMonth + w) % 12;
    const season = SEASONALITY[MONTHS[mIdx]];
    trend = Math.max(trend * 0.97, 0.78);
    
    const mk = (base, mult) => ({
      opt: Math.round(base * season * trend * mult),
      pes: Math.round(base * season * trend * mult * 1.18),
      base: Math.round(base * season * (1 + w*0.006)),
    });
    
    const cpi = mk(seed.baseCPI, 0.92);
    const cpa = mk(seed.baseCPA, 0.90);
    const cprt = mk(seed.baseCPRT, 0.94);
    const cpft = mk(seed.baseCPFT, 0.88);
    
    const optInst = Math.round(seed.budget * 7 / cpi.opt * 1.08);
    const pesInst = Math.round(optInst * 0.83);
    
    const recBid = Math.round(seed.targetCPI * 0.94 * trend);
    const recBudget = Math.round(seed.budget * (w < 4 ? 1.20 : w < 8 ? 1.35 : 1.50));
    const bidAction = cpi.opt < seed.targetCPI * 0.90 ? "Scale Up" : cpi.opt > seed.targetCPI * 1.10 ? "Scale Down" : "Hold";
    
    rows.push({
      label: `W${w+1}`, weekNum: w+1, phase:"forecast", month: MONTHS[mIdx], season,
      cpi_actual:null, cpa_actual:null, cprt_actual:null, cpft_actual:null,
      installs_actual:null, actions_actual:null, reacts_actual:null, ftxns_actual:null,
      spend_actual:null, cvr_actual:null, ctr_actual:null, impressions:null, clicks:null,
      budget_actual:null, network:null,
      cpi_opt: cpi.opt, cpi_pes: cpi.pes, cpi_base: cpi.base,
      cpa_opt: cpa.opt, cpa_pes: cpa.pes, cpa_base: cpa.base,
      cprt_opt: cprt.opt, cprt_pes: cprt.pes, cprt_base: cprt.base,
      cpft_opt: cpft.opt, cpft_pes: cpft.pes, cpft_base: cpft.base,
      inst_opt: optInst, inst_pes: pesInst,
      spend_fore: Math.min(seed.budget * 7 * 1.35, optInst * cpi.opt),
      recBid, recBudget, bidAction,
    });
  }
  
  return rows;
}

/* ─── NETWORK SIMULATION ──────────────────────────────────────────────────── */
function simulateNetworkResponse(baseCPI, baseCPA, baseCPRT, baseCPFT, bidIncreasePct, metric) {
  const baseMetric = { cpi: baseCPI, cpa: baseCPA || baseCPI * 3.2, cprt: baseCPRT || baseCPI * 2.1, cpft: baseCPFT || baseCPI * 8.5 }[metric];
  
  return Object.entries(NETWORK_ELASTICITY).map(([netName, el]) => {
    const metricChangeKey = `${metric}Change`;
    const metricPctChange = el[metricChangeKey]?.(bidIncreasePct) ?? el.cpiChange(bidIncreasePct);
    
    const volumeGain = parseFloat(el.volumeGain(bidIncreasePct).toFixed(1));
    const cvrBoost = parseFloat(el.cvrBoost(bidIncreasePct).toFixed(1));
    const metricNew = Math.round(baseMetric * (1 + metricPctChange / 100));
    const metricDelta = metricNew - baseMetric;
    const metricDeltaPct = parseFloat(metricPctChange.toFixed(1));
    const cpmNew = Math.round(234 * (1 + el.cpmChange(bidIncreasePct) / 100));
    const cpcNew = Math.round(37.6 * (1 + el.cpcChange(bidIncreasePct) / 100));
    
    return {
      network: netName, color: NET[netName].color, icon: NET[netName].icon,
      volumeGainPct: volumeGain, cvrBoostPct: cvrBoost,
      metricBase: Math.round(baseMetric), metricNew, metricDelta, metricDeltaPct,
      cpmNew, cpcNew, notes: el.notes,
      volumeScore: Math.min(100, volumeGain * 1.2),
      efficiencyScore: Math.max(0, 100 - metricDeltaPct * 1.5),
      cvrScore: Math.max(0, 50 + cvrBoost * 5),
      scaleScore: Math.min(100, volumeGain * 1.1),
      qualityScore: { Search: 80, YouTube: 60, Display: 45 }[netName],
    };
  });
}

function buildBidCurves(baseCPI, baseCPA, baseCPRT, baseCPFT, metric) {
  const points = [];
  const baseMetric = { cpi: baseCPI, cpa: baseCPA || baseCPI * 3.2, cprt: baseCPRT || baseCPI * 2.1, cpft: baseCPFT || baseCPI * 8.5 }[metric];
  
  for (let pct = 0; pct <= 100; pct += 5) {
    const row = { bidIncrease: pct };
    Object.entries(NETWORK_ELASTICITY).forEach(([net, el]) => {
      const changeKey = `${metric}Change`;
      const change = el[changeKey]?.(pct) ?? el.cpiChange(pct);
      row[`${net}_metric`] = Math.round(baseMetric * (1 + change / 100));
      row[`${net}_volume`] = parseFloat(el.volumeGain(pct).toFixed(1));
    });
    points.push(row);
  }
  return points;
}

/* ─── COMPONENTS ──────────────────────────────────────────────────────────── */
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
            {typeof p.value==="number" ? `₹${p.value.toLocaleString("en-IN", {maximumFractionDigits:0})}` : p.value}
          </span>
        </div>
      ))}
      {row?.bidAction && (
        <p style={{ color:row.bidAction==="Scale Up"?C.accent:row.bidAction==="Scale Down"?C.rose:C.gold, fontSize:10.5, fontWeight:800, margin:"6px 0 0" }}>
          {row.bidAction==="Scale Up"?"▲":row.bidAction==="Scale Down"?"▼":"⏸"} {row.bidAction} · Bid: {fmtD(row.recBid)} · Budget: {fmtK(row.recBudget)}
        </p>
      )}
    </div>
  );
}

const Badge = ({ type, sm }) => {
  const m = { "Scale Up":[C.accent,"#041a10"], "Hold":[C.gold,"#1a1400"], "Scale Down":[C.rose,"#1a0410"] }[type]||[C.muted,C.dim];
  return <span style={{ background:m[1], color:m[0], border:`1px solid ${m[0]}55`, borderRadius:5, padding:sm?"1px 7px":"3px 10px", fontSize:sm?9.5:11, fontWeight:800, letterSpacing:"0.05em", whiteSpace:"nowrap" }}>{type==="Scale Up"?"▲":type==="Scale Down"?"▼":"⏸"} {type}</span>;
};

const KPI = ({ label, val, sub, color, delta }) => (
  <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"13px 15px", flex:"1 1 120px" }}>
    <p style={{ color:C.muted, fontSize:9, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.1em", margin:"0 0 5px" }}>{label}</p>
    <p style={{ color:color||C.accent, fontSize:19, fontWeight:900, fontFamily:"monospace", margin:"0 0 2px" }}>{val}</p>
    {sub && <p style={{ color:C.dim, fontSize:10, margin:0 }}>{sub}</p>}
    {delta!=null && <p style={{ color:delta>=0?C.green:C.rose, fontSize:10, fontWeight:700, margin:"3px 0 0" }}>{delta>=0?"▲":"▼"} {Math.abs(delta)}% vs hist</p>}
  </div>
);

const PhaseLegend = ({ metricColor }) => (
  <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:10, fontSize:11, flexWrap:"wrap" }}>
    {[
      { line:"solid", color:C.blue, label:"Historical (actual)" },
      { line:"dashed", color:C.muted, label:"Baseline forecast" },
      { line:"solid", color:metricColor, label:"Optimistic (recs applied)" },
      { line:"dashed", color:C.rose, label:"Pessimistic deviation" },
    ].map((item,i) => (
      <div key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
        <svg width={28} height={8}><line x1={0} y1={4} x2={28} y2={4} stroke={item.color} strokeWidth={item.line==="dashed"?1.5:2.5} strokeDasharray={item.line==="dashed"?"5 3":"0"} /></svg>
        <span style={{ color:C.muted, fontWeight:600 }}>{item.label}</span>
      </div>
    ))}
    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
      <div style={{ width:10, height:10, background:C.gold, borderRadius:"50%" }} />
      <span style={{ color:C.muted, fontWeight:600 }}>Bid/budget change</span>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════════════ */
export default function CampaignSimulator() {
  const [uploadedData, setUploadedData] = useState(null);
  const [userSettings, setUserSettings] = useState(null);
  const [campaigns] = useState(DEMO_CAMPAIGNS);
  const [camp, setCamp] = useState("all");
  const [metric, setMetric] = useState("cpi");
  const [activeTab, setActiveTab] = useState("chart");
  const [bidInc, setBidInc] = useState(20);
  const [netMetric, setNetMetric] = useState("cpi");
  const [showDev, setShowDev] = useState(true);
  const [showBase, setShowBase] = useState(true);
  const [showDataPanel, setShowDataPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [mmps, setMmps] = useState({ appsflyer: "", adjust: "" });
  
  const seed = campaigns.find(c => c.id === camp) || campaigns[0];
  const timeline = useMemo(() => generateTimelineFromData(uploadedData, userSettings), [uploadedData, userSettings]);
  
  const histRows = timeline.filter(r => r.phase==="historical");
  const foreRows = timeline.filter(r => r.phase==="forecast");
  
  const MK = {
    cpi: { actual:"cpi_actual", opt:"cpi_opt", pes:"cpi_pes", base:"cpi_base", target:userSettings?.targetCPI || seed.targetCPI, instActual:"installs_actual", instOpt:"inst_opt" },
    cpa: { actual:"cpa_actual", opt:"cpa_opt", pes:"cpa_pes", base:"cpa_base", target:userSettings?.targetCPA || seed.targetCPA, instActual:"actions_actual", instOpt:null },
    cprt: { actual:"cprt_actual", opt:"cprt_opt", pes:"cprt_pes", base:"cprt_base", target:userSettings?.targetCPRT || seed.targetCPRT, instActual:"reacts_actual", instOpt:null },
    cpft: { actual:"cpft_actual", opt:"cpft_opt", pes:"cpft_pes", base:"cpft_base", target:userSettings?.targetCPFT || seed.targetCPFT, instActual:"ftxns_actual", instOpt:null },
  };
  const mk = MK[metric];
  const mc = METRICS[metric];
  
  const histAvg = histRows.reduce((a,r) => a + (r[mk.actual]||0), 0) / histRows.length;
  const foreAvg = foreRows.reduce((a,r) => a + (r[mk.opt]||0), 0) / foreRows.length;
  const delta = parseFloat(((foreAvg/histAvg - 1)*100).toFixed(1));
  const histInst = histRows.reduce((a,r) => a + (r[mk.instActual]||0), 0);
  
  // Use actual data for network sim if uploaded
  const lastHist = histRows[histRows.length - 1];
  const simBaseCPI = lastHist?.cpi_actual || seed.baseCPI;
  const simBaseCPA = lastHist?.cpa_actual || seed.baseCPA;
  const simBaseCPRT = lastHist?.cprt_actual || seed.baseCPRT;
  const simBaseCPFT = lastHist?.cpft_actual || seed.baseCPFT;
  
  const netData = useMemo(() => simulateNetworkResponse(simBaseCPI, simBaseCPA, simBaseCPRT, simBaseCPFT, bidInc, netMetric), [simBaseCPI, simBaseCPA, simBaseCPRT, simBaseCPFT, bidInc, netMetric]);
  const bidCurves = useMemo(() => buildBidCurves(simBaseCPI, simBaseCPA, simBaseCPRT, simBaseCPFT, netMetric), [simBaseCPI, simBaseCPA, simBaseCPRT, simBaseCPFT, netMetric]);
  
  const bidChanges = foreRows.filter((r,i) => i===0 || r.bidAction !== foreRows[i-1]?.bidAction);
  
  const handleCSVUpload = () => {
    const parsed = parseCSV(csvText);
    if (parsed) {
      setUploadedData(parsed);
      setShowDataPanel(false);
      setShowSettingsPanel(true);
    } else {
      alert("Invalid CSV. Expected columns: week,impressions,clicks,installs,spend,cpi,cvr (minimum)\n\nOptional: budget,network,actions,reactivations,first_transactions,target_cpi,target_cpa,target_cprt,target_cpft");
    }
  };
  
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
  
  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'Syne','DM Sans',system-ui,sans-serif" }}>
      
      {/* DATA CONNECTION PANEL */}
      {showDataPanel && (
        <div style={{ position:"fixed", inset:0, background:"#000000cc", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, maxWidth:700, width:"100%", maxHeight:"90vh", overflow:"auto", padding:24 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h2 style={{ margin:0, fontSize:18, fontWeight:900 }}>Connect Your Data</h2>
              <button onClick={() => setShowDataPanel(false)} style={{ background:"transparent", border:"none", color:C.muted, fontSize:24, cursor:"pointer" }}>×</button>
            </div>
            
            <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:16, marginBottom:16 }}>
              <h3 style={{ margin:"0 0 8px", fontSize:14, fontWeight:800, color:C.accent }}>📊 CSV Upload</h3>
              <p style={{ color:C.muted, fontSize:11, margin:"0 0 12px" }}>
                <strong>Basic format:</strong> <code style={{ background:C.dim, padding:"2px 6px", borderRadius:4, fontSize:10 }}>week,impressions,clicks,installs,spend,cpi,cvr</code><br/>
                <strong>Enhanced format (optional columns):</strong> <code style={{ background:C.dim, padding:"2px 6px", borderRadius:4, fontSize:10 }}>budget,network,actions,reactivations,first_transactions,target_cpi,target_cpa,target_cprt,target_cpft</code>
              </p>
              <textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder="week,impressions,clicks,installs,spend,cpi,cvr&#10;09/02/26,347458,34510,21577,54225.96,2.51,0.63&#10;16/02/26,75291,9304,5853,12444.90,2.13,0.62"
                style={{ width:"100%", minHeight:120, background:C.dim, border:`1px solid ${C.border}`, borderRadius:8, padding:12, color:C.text, fontFamily:"monospace", fontSize:10, resize:"vertical" }}
              />
              <button onClick={handleCSVUpload} style={{ marginTop:10, background:C.accent, color:"#000", border:"none", padding:"8px 18px", borderRadius:8, fontWeight:800, cursor:"pointer", fontSize:12 }}>
                Upload & Analyze
              </button>
            </div>
            
            <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:16, marginBottom:16 }}>
              <h3 style={{ margin:"0 0 8px", fontSize:14, fontWeight:800, color:C.blue }}>🔗 Google Ads API</h3>
              <p style={{ color:C.muted, fontSize:11, margin:"0 0 12px" }}>Live campaign data pull (Coming Soon)</p>
              <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="API Key..." style={{ width:"100%", background:C.dim, border:`1px solid ${C.border}`, borderRadius:8, padding:10, color:C.text, fontFamily:"monospace", fontSize:11 }} />
              <button disabled style={{ marginTop:10, background:C.dim, color:C.muted, border:"none", padding:"8px 18px", borderRadius:8, fontWeight:800, cursor:"not-allowed", fontSize:12 }}>Connect API</button>
            </div>
            
            <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:12, padding:16 }}>
              <h3 style={{ margin:"0 0 8px", fontSize:14, fontWeight:800, color:C.violet }}>📱 MMP Integration</h3>
              <p style={{ color:C.muted, fontSize:11, margin:"0 0 12px" }}>AppsFlyer / Adjust (Coming Soon)</p>
              <div style={{ display:"grid", gap:10 }}>
                <input type="text" value={mmps.appsflyer} onChange={e => setMmps({...mmps, appsflyer: e.target.value})} placeholder="AppsFlyer API Key" style={{ background:C.dim, border:`1px solid ${C.border}`, borderRadius:8, padding:10, color:C.text, fontFamily:"monospace", fontSize:11 }} />
                <input type="text" value={mmps.adjust} onChange={e => setMmps({...mmps, adjust: e.target.value})} placeholder="Adjust API Token" style={{ background:C.dim, border:`1px solid ${C.border}`, borderRadius:8, padding:10, color:C.text, fontFamily:"monospace", fontSize:11 }} />
              </div>
              <button disabled style={{ marginTop:10, background:C.dim, color:C.muted, border:"none", padding:"8px 18px", borderRadius:8, fontWeight:800, cursor:"not-allowed", fontSize:12 }}>Connect MMP</button>
            </div>
            
            {uploadedData && (
              <div style={{ marginTop:16, padding:12, background:C.accent+"15", border:`1px solid ${C.accent}55`, borderRadius:8 }}>
                <p style={{ color:C.accent, fontSize:12, fontWeight:700, margin:0 }}>
                  ✓ {uploadedData.length} weeks loaded
                  <button onClick={() => { setUploadedData(null); setUserSettings(null); }} style={{ marginLeft:12, background:C.rose, color:"#fff", border:"none", padding:"4px 10px", borderRadius:6, fontSize:10, fontWeight:800, cursor:"pointer" }}>Clear</button>
                  <button onClick={() => setShowSettingsPanel(true)} style={{ marginLeft:8, background:C.gold, color:"#000", border:"none", padding:"4px 10px", borderRadius:6, fontSize:10, fontWeight:800, cursor:"pointer" }}>⚙ Settings</button>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* SETTINGS PANEL (after upload) */}
      {showSettingsPanel && uploadedData && (
        <div style={{ position:"fixed", inset:0, background:"#000000cc", zIndex:1001, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, maxWidth:600, width:"100%", padding:24 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h2 style={{ margin:0, fontSize:18, fontWeight:900 }}>⚙ Adjust Targets & Goals</h2>
              <button onClick={() => setShowSettingsPanel(false)} style={{ background:"transparent", border:"none", color:C.muted, fontSize:24, cursor:"pointer" }}>×</button>
            </div>
            
            <p style={{ color:C.muted, fontSize:11.5, margin:"0 0 16px" }}>
              Fine-tune forecast targets. Defaults calculated from your last 4 weeks trend.
            </p>
            
            <div style={{ display:"grid", gap:12 }}>
              {[
                { key:"targetCPI",  label:"Target CPI",  color:C.accent, default:uploadedData[uploadedData.length-1]?.cpi * 0.92 },
                { key:"targetCPA",  label:"Target CPA",  color:C.violet, default:uploadedData[uploadedData.length-1]?.cpa * 0.90 },
                { key:"targetCPRT", label:"Target CPRT", color:C.orange, default:uploadedData[uploadedData.length-1]?.cprt * 0.88 },
                { key:"targetCPFT", label:"Target CPFT", color:C.gold,   default:uploadedData[uploadedData.length-1]?.cpft * 0.85 },
              ].map(t => (
                <div key={t.key} style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:14 }}>
                  <label style={{ color:t.color, fontSize:12, fontWeight:800, display:"block", marginBottom:6 }}>{t.label}</label>
                  <input
                    type="number"
                    value={userSettings?.[t.key] || Math.round(t.default) || ""}
                    onChange={e => setUserSettings({...userSettings, [t.key]: parseFloat(e.target.value) || null})}
                    placeholder={`Default: ₹${Math.round(t.default) || "—"}`}
                    style={{ width:"100%", background:C.dim, border:`1px solid ${C.border}`, borderRadius:8, padding:10, color:C.text, fontSize:14, fontWeight:700, fontFamily:"monospace" }}
                  />
                </div>
              ))}
            </div>
            
            <button onClick={() => setShowSettingsPanel(false)} style={{ marginTop:16, width:"100%", background:C.accent, color:"#000", border:"none", padding:"10px", borderRadius:8, fontWeight:800, cursor:"pointer", fontSize:13 }}>
              Apply Settings
            </button>
          </div>
        </div>
      )}
      
      {/* HEADER */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"15px 26px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:40, height:40, background:`linear-gradient(135deg,${C.accent},${C.violet})`, borderRadius:11, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, boxShadow:`0 0 18px ${C.accent}44` }}>⚡</div>
            <div>
              <h1 style={{ margin:0, fontSize:17, fontWeight:900, letterSpacing:"-0.03em" }}>
                <span style={{ color:seed.color }}>{seed.name}</span>
                <span style={{ color:C.muted, fontSize:12, fontWeight:400, marginLeft:10 }}>· Performance Simulator v6</span>
              </h1>
              <p style={{ margin:0, color:C.muted, fontSize:10.5 }}>
                Smart CSV Parser · Trend Forecasting · <span style={{ color:C.gold, fontWeight:700 }}>₹ INR</span>
                {uploadedData && <span style={{ color:C.accent, fontWeight:700, marginLeft:8 }}>· {uploadedData.length} weeks uploaded</span>}
              </p>
            </div>
          </div>
          
          <div style={{ display:"flex", gap:8 }}>
            {uploadedData && (
              <button onClick={() => setShowSettingsPanel(true)} style={{ background:C.gold, color:"#000", border:"none", padding:"8px 16px", borderRadius:8, fontWeight:800, cursor:"pointer", fontSize:12 }}>
                ⚙ Settings
              </button>
            )}
            <button onClick={() => setShowDataPanel(true)} style={{ background:C.accent, color:"#000", border:"none", padding:"8px 16px", borderRadius:8, fontWeight:800, cursor:"pointer", fontSize:12 }}>
              📊 {uploadedData ? "Manage Data" : "Connect Data"}
            </button>
          </div>
        </div>
        
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:12, flexWrap:"wrap" }}>
          <span style={{ color:C.muted, fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.08em" }}>Metric</span>
          {Object.keys(METRICS).map(k => MBTN(k))}
          <div style={{ flex:1 }} />
          <span style={{ background:mc.color+"20", color:mc.color, borderRadius:6, padding:"2px 10px", fontSize:10.5, fontWeight:800 }}>
            Hist avg: {fmtD(histAvg)} · Fore avg (opt): {fmtD(foreAvg)}
            {delta !== 0 && <span style={{ color:delta<0?C.green:C.rose, marginLeft:8 }}>{pct(delta)}</span>}
          </span>
        </div>
      </div>
      
      <div style={{ padding:"18px 26px" }}>
        
        <div style={{ display:"flex", gap:10, marginBottom:18, flexWrap:"wrap" }}>
          <KPI label={`Hist Avg ${mc.label}`} val={fmtD(histAvg)} sub="Last weeks" color={C.blue} />
          <KPI label={`Fore Avg ${mc.label}`} val={fmtD(foreAvg)} sub="Optimistic" color={mc.color} delta={delta} />
          <KPI label={`Target ${mc.label}`} val={fmtD(mk.target)} sub="Your goal" color={C.gold} />
          <KPI label="Hist Volume" val={fmt(histInst)} sub={`${mc.full} events`} color={C.blue} />
          <KPI label="Rec. Bid W1" val={fmtD(foreRows[0]?.recBid)} sub="First forecast" color={C.violet} />
          <KPI label="Rec. Budget W1" val={fmtK(foreRows[0]?.recBudget)} sub="Daily" color={C.teal} />
        </div>
        
        <div style={{ display:"flex", gap:3, marginBottom:18, background:C.surface, borderRadius:10, padding:4, border:`1px solid ${C.border}`, width:"fit-content", flexWrap:"wrap" }}>
          {TAB("chart", "Performance Chart", "📈")}
          {TAB("table", "Data Table", "📋")}
        </div>
        
        {activeTab==="chart" && (
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"20px 18px 14px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8, flexWrap:"wrap", gap:10 }}>
              <div>
                <h2 style={{ margin:"0 0 3px", fontSize:14.5, fontWeight:900 }}>
                  {mc.full} ({mc.label}) — {uploadedData ? "Your Data" : "Demo"}
                </h2>
                <p style={{ margin:0, color:C.muted, fontSize:10.5 }}>
                  {uploadedData ? `${histRows.length} weeks uploaded · Trend-based forecast` : "Simulation mode"}
                </p>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <label style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer", fontSize:11, color:C.muted }}>
                  <input type="checkbox" checked={showDev} onChange={e=>setShowDev(e.target.checked)} style={{ accentColor:C.rose }} /> Deviation
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
                    <stop offset="0%" stopColor={C.blue} stopOpacity={0.20} />
                    <stop offset="100%" stopColor={C.blue} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gOpt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={mc.color} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={mc.color} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gPes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.rose} stopOpacity={0.14} />
                    <stop offset="100%" stopColor={C.rose} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="label" tick={{ fill:C.muted, fontSize:9 }} axisLine={false} tickLine={false} interval={Math.floor(timeline.length/12)} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill:C.muted, fontSize:9 }} width={48} />
                <Tooltip content={<TT extra={timeline} />} />
                
                <ReferenceLine x={histRows[histRows.length-1]?.label} stroke={C.gold} strokeWidth={1.5} label={{ value:"NOW", fill:C.gold, fontSize:9, fontWeight:800, position:"insideTopRight", dy:-4 }} />
                <ReferenceLine y={mk.target} stroke={C.rose} strokeWidth={1.5} strokeDasharray="5 3" label={{ value:`Target ${fmtD(mk.target)}`, fill:C.rose, fontSize:9, position:"insideTopLeft", dy:-4 }} />
                
                <Area type="monotone" dataKey={mk.actual} name="Actual" stroke={C.blue} strokeWidth={2.5} fill="url(#gHist)" dot={false} connectNulls={false} activeDot={{ r:5, fill:C.blue }} />
                {showBase && <Line type="monotone" dataKey={mk.base} name="Baseline" stroke={C.muted} strokeWidth={1.5} strokeDasharray="6 4" dot={false} connectNulls={false} activeDot={{ r:4 }} />}
                {showDev && <Area type="monotone" dataKey={mk.pes} name="Pessimistic" stroke={C.rose} strokeWidth={1.5} strokeDasharray="4 3" fill="url(#gPes)" dot={false} connectNulls={false} activeDot={{ r:4, fill:C.rose }} />}
                <Area type="monotone" dataKey={mk.opt} name="Optimistic (recs)" stroke={mc.color} strokeWidth={2.5} fill="url(#gOpt)" dot={false} connectNulls={false} activeDot={{ r:5, fill:mc.color }} />
                
                {bidChanges.map((r,i) => {
                  const col = r.bidAction==="Scale Up" ? C.accent : r.bidAction==="Scale Down" ? C.rose : C.gold;
                  return <ReferenceLine key={i} x={r.label} stroke={col} strokeWidth={1} strokeDasharray="3 2" opacity={0.8} label={{ value: r.bidAction==="Scale Up"?"▲":r.bidAction==="Scale Down"?"▼":"⏸", fill:col, fontSize:11, position:"insideTopRight" }} />;
                })}
              </ComposedChart>
            </ResponsiveContainer>
            
            <div style={{ display:"flex", marginTop:6, paddingLeft:48 }}>
              <div style={{ flex:histRows.length, textAlign:"center", fontSize:9.5, color:C.blue+"88", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", borderRight:`1px dashed ${C.gold}55`, paddingRight:8 }}>
                ◀ {uploadedData ? "Your Data" : "Historical"} ({histRows.length} wks)
              </div>
              <div style={{ flex:foreRows.length, textAlign:"center", fontSize:9.5, color:mc.color+"88", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", paddingLeft:8 }}>
                Forecast ({foreRows.length} wks) ▶
              </div>
            </div>
            
            <div style={{ marginTop:16, paddingTop:14, borderTop:`1px solid ${C.border}` }}>
              <p style={{ color:C.muted, fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.1em", margin:"0 0 10px" }}>
                📌 Recommended Actions — <span style={{ color:mc.color }}>{mc.full}</span>
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
        
        {activeTab==="table" && (
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, overflow:"hidden" }}>
            <div style={{ padding:"13px 18px", borderBottom:`1px solid ${C.border}` }}>
              <p style={{ color:C.text, fontWeight:900, fontSize:13, margin:0 }}>Full Timeline Data</p>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead>
                  <tr style={{ background:C.panel }}>
                    {["Week","Phase","CPI Act","CPI Opt","CPI Pes","Installs","Spend","Rec Bid","Budget","Action"].map(h => (
                      <th key={h} style={{ padding:"8px 10px", color:C.muted, fontWeight:700, fontSize:9, textTransform:"uppercase", textAlign:"right", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((r,i) => {
                    const isH = r.phase==="historical";
                    return (
                      <tr key={i} style={{ borderTop:`1px solid ${C.border}`, background:isH?i%2===0?C.surface:C.panel:i%2===0?C.blue+"06":mc.color+"05" }}>
                        <td style={{ padding:"6px 10px", color:isH?C.blue:mc.color, fontWeight:800, textAlign:"right", fontFamily:"monospace" }}>{r.label}</td>
                        <td style={{ padding:"6px 10px", textAlign:"right" }}>
                          <span style={{ color:isH?C.blue:mc.color, fontSize:9, fontWeight:700, background:(isH?C.blue:mc.color)+"18", borderRadius:3, padding:"1px 5px" }}>{isH?"HIST":"FORE"}</span>
                        </td>
                        <td style={{ padding:"6px 10px", color:C.blue, textAlign:"right", fontFamily:"monospace" }}>{r.cpi_actual ? `₹${r.cpi_actual}` : "—"}</td>
                        <td style={{ padding:"6px 10px", color:mc.color, textAlign:"right", fontFamily:"monospace", fontWeight:700 }}>{r.cpi_opt ? `₹${r.cpi_opt}` : "—"}</td>
                        <td style={{ padding:"6px 10px", color:C.rose, textAlign:"right", fontFamily:"monospace", opacity:0.7 }}>{r.cpi_pes ? `₹${r.cpi_pes}` : "—"}</td>
                        <td style={{ padding:"6px 10px", color:C.text, textAlign:"right" }}>{r.installs_actual || r.inst_opt || "—"}</td>
                        <td style={{ padding:"6px 10px", color:C.violet, textAlign:"right", fontFamily:"monospace" }}>{r.spend_actual ? `₹${r.spend_actual}` : r.spend_fore ? `₹${r.spend_fore}` : "—"}</td>
                        <td style={{ padding:"6px 10px", color:C.accent, textAlign:"right", fontFamily:"monospace", fontWeight:700 }}>{r.recBid ? `₹${r.recBid}` : "—"}</td>
                        <td style={{ padding:"6px 10px", color:C.teal, textAlign:"right", fontFamily:"monospace" }}>{r.recBudget ? fmtK(r.recBudget) : "—"}</td>
                        <td style={{ padding:"6px 10px", textAlign:"right" }}>{r.bidAction ? <Badge type={r.bidAction} sm /> : <span style={{ color:C.muted }}>—</span>}</td>
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

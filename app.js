/* ==================================================================
   AHORRA+ v2 · Ahorro premium
   Dashboard · Metas · Calendario · Historial · Estadísticas
   Presupuesto · Logros & rachas · Conversor · IA financiera
   Exportación · Notificaciones personalizadas
   ================================================================== */
(() => {
"use strict";

/* ================== ESTADO Y MIGRACIÓN ================== */
const KEY = "ahorra_v3", KEY_V2 = "ahorra_v2", KEY_OLD = "ahorra_plus_v1";
const CATS = { comida:"🍔", transporte:"🚌", casa:"🏠", salud:"🏥", ocio:"🎮", otros:"📦" };
const GOAL_EMOJIS = ["🎯","🏝️","📱","💻","🚗","🏠","🎓","💍","🎮","🎸","⌚","🎁","🏥","📷","👕","🚢"];
const AVATARS = ["🙂","😎","🤓","🦸","🐯","🐼","🦊","🐸","🦁","🐨","🦄","🤖","🐷","💃","🧜","🚀"];
const LEVEL_TITLES = ["Ahorrador 🐷","Ahorrador Jr 💪","Meta-hunter 🎯","Visionario 🧠","Financiero 📈","Magnate 💼","Gurú 👑","Leyenda 🐉","BILLONARIO 🏆"];

const ACH_DEFS = [
  { id:"first-dep", e:"🥇", name:"Primer depósito",    check:()=>depCount()>=1 },
  { id:"10-deps",   e:"🐷",  name:"10 depósitos",      check:()=>depCount()>=10 },
  { id:"streak3",   e:"🔥",  name:"Racha 3 días",      check:()=>streakCalc()>=3 },
  { id:"streak7",   e:"🚀",  name:"Racha 7 días",      check:()=>streakCalc()>=7 },
  { id:"goal1",     e:"🏆",  name:"Primera meta",      check:()=>goalsDoneCount()>=1 },
  { id:"goal3",     e:"🌟",  name:"3 metas cumplidas", check:()=>goalsDoneCount()>=3 },
  { id:"saved1k",   e:"💰",  name:"$1,000 ahorrados",  check:()=>totalSaved()>=1000 },
  { id:"saved10k",  e:"👑",  name:"$10,000 ahorrados", check:()=>totalSaved()>=10000 },
  { id:"income1",   e:"💵",  name:"Primer ingreso",    check:()=>S.income.length>=1 },
  { id:"budgeted",  e:"📊",  name:"Presupuesto activo",check:()=>S.budget.total>0 },
  { id:"shared1",   e:"👥",  name:"Ahorro compartido", check:()=>S.goals.some(g=>g.shared) },
  { id:"export1",   e:"📄",  name:"Reporte exportado", check:()=>!!S.exportedOnce },
  { id:"conv",      e:"💱",  name:"Conversor usado",   check:()=>!!S.usedConv },
  { id:"photo",     e:"🎨",  name:"Meta con imagen",   check:()=>S.goals.some(g=>g.img) },
];
let S;

function load(){
  try{ S = JSON.parse(localStorage.getItem(KEY) || "null"); }catch{ S = null; }
  if(!S){ try{ S = JSON.parse(localStorage.getItem(KEY_V2) || "null"); }catch{ S = null; } }
  if(S){ migrate(); return; }
  const o = (()=>{ try{ return JSON.parse(localStorage.getItem(KEY_OLD) || "null") || {}; }catch{ return {}; } })();
  S = {
    owner:o.owner || null, since:today(), avatar:"🙂",
    theme:(o.theme==="light" ? "light" : "dark"), accent:"emerald",
    currency:"DOP", rates:{ USD:62.5, EUR:67.9 }, sound:o.sound !== false,
    goals:(o.goals||[]).map(g=>({ id:g.id || rnd(), name:String(g.name), emoji:g.emoji||"🎯", img:"",
      total:+g.total||0, saved:+g.saved||0, deadline:g.deadline||"", done:!!g.done,
      shared:false, members:[o.owner].filter(Boolean), contribs:{},
      history:(g.history||[]).filter(h=>h&&h.d&&isFinite(h.amt)).map(h=>({ d:h.d, amt:+h.amt, by:o.owner })) })),
    income:[], expenses:[], budget:{ total:0, cats:{} },
    notifs:{ daily:true, time:"20:00", weekly:true, milestones:true },
    reminders:[], ach:{}, streakBest:0,
    xp:(o.goals||[]).reduce((a,g)=>a+((g.history||[]).filter(h=>h.amt>0).length*15),0),
    lastDailyNotif:null, lastWeeklyNotif:null, lastRemSent:{},
    gb:{ roundUp:false, step:50, goal:"" },
    exportedOnce:false, usedConv:false,
  };
  migrate();
  save();
}
/* Migración idempotente v2 → v3: rellena campos nuevos, deduplica
   metas/movimientos por id y limpia restos del módulo de grupos.
   La llave ahorra_v2 se conserva intacta como respaldo. */
function migrate(){
  if(!S.gb || typeof S.gb !== "object") S.gb = { roundUp:false, step:50, goal:"" };
  delete S.gb.code; delete S.gb.anon; delete S.gb.log;
  if(!Array.isArray(S.goals)) S.goals = S.goals ? [S.goals] : [];
  if(!Array.isArray(S.income)) S.income = [];
  if(!Array.isArray(S.expenses)) S.expenses = [];
  if(!Array.isArray(S.reminders)) S.reminders = [];
  if(!S.budget || typeof S.budget !== "object") S.budget = { total:0, cats:{} };
  if(!S.budget.cats || typeof S.budget.cats !== "object") S.budget.cats = {};
  if(!S.notifs || typeof S.notifs !== "object") S.notifs = { daily:true, time:"20:00", weekly:true, milestones:true };
  if(!S.ach || typeof S.ach !== "object" || Array.isArray(S.ach)) S.ach = {};
  // dedup por id
  const seen = new Set(), uniq = [];
  S.goals.forEach(g=>{
    if(!g || typeof g !== "object" || !g.id || seen.has(g.id)) return;
    seen.add(g.id);
    if(g.done !== true) g.done = !!g.done;
    if(!Array.isArray(g.history)) g.history = (g.history||[]).filter(h=>h&&h.d&&isFinite(h.amt));
    if(!g.contribs || typeof g.contribs !== "object") g.contribs = {};
    if(!("shared" in g)) g.shared = false;
    if(!Array.isArray(g.members)) g.members = [S.owner].filter(Boolean);
    uniq.push(g);
  });
  S.goals = uniq;
  // v3 · finanzas reales
  if(!Array.isArray(S.debts)) S.debts = [];
  if(!Array.isArray(S.recurring)) S.recurring = [];
  if(!S.challenges || typeof S.challenges !== "object" || Array.isArray(S.challenges)) S.challenges = {};
  if(!S.chalLog || typeof S.chalLog !== "object" || Array.isArray(S.chalLog)) S.chalLog = {};
  // v3 · seguridad
  if(!S.security || typeof S.security !== "object" || Array.isArray(S.security)) S.security = {};
  if(typeof S.security.pinHash !== "string") S.security.pinHash = "";
  if(!("lock" in S.security)) S.security.lock = false;
  if(!("privacy" in S.security)) S.security.privacy = false;
  if(!("avatarImg" in S)) S.avatarImg = "";
  S.avatar = S.avatar || "🙂";
  save();
}
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch{} }

const $  = id => document.getElementById(id);
const fmt = n => { const v = Math.round(+n || 0); return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("es-MX"); };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const rnd = () => Math.random().toString(36).slice(2,10);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MONS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const monthKey = () => today().slice(0,7);
const inMonth = (d, mk) => String(d).slice(0,7) === mk;

/* ================== SONIDOS ================== */
let AC;
const ac = () => { if(!AC) AC = new (window.AudioContext||window.webkitAudioContext)(); if(AC.state==="suspended") AC.resume(); return AC; };
function tone({ f=600, f2, type="sine", d=.08, v=.12, delay=0 }){
  if(!S.sound) return;
  try{
    const a = ac(), o = a.createOscillator(), g = a.createGain(), t = a.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f, t);
    if(f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + .03);
  }catch{}
}
const SFX = {
  click(){ tone({ f:880, f2:640, type:"triangle", d:.06, v:.07 }); },
  tap(){ tone({ f:520, d:.05, v:.06 }); },
  pop(){ tone({ f:300, f2:720, d:.09, v:.09 }); },
  money(){ [660,830,1050].forEach((f,i)=>tone({ f, type:"triangle", d:.14, v:.09, delay:i*.08 })); },
  win(){ [523,659,784,1047].forEach((f,i)=>tone({ f, type:"triangle", d:.22, v:.11, delay:i*.11 })); },
  err(){ tone({ f:240, f2:140, type:"square", d:.16, v:.05 }); },
  swipe(){ tone({ f:300, f2:500, d:.07, v:.05 }); },
};
document.addEventListener("click", e => { if(e.target.closest("button, a, label.switch")) SFX.click(); }, true);

/* ================== TEMA Y ACENTO ================== */
const ACCENTS = { emerald:{a:"#10d9a0",b:"#05ae7c"}, gold:{a:"#f0b429",b:"#d99a12"}, sky:{a:"#38bdf8",b:"#0ea5e9"}, rose:{a:"#fb7185",b:"#f43f5e"} };
const mq = matchMedia("(prefers-color-scheme: dark)");
function applyTheme(){
  const dark = S.theme === "dark" || (S.theme === "auto" && mq.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]').content = dark ? "#050708" : "#eef2f0";
  const A = ACCENTS[S.accent] || ACCENTS.emerald;
  document.documentElement.dataset.accent = S.accent;
  const st = document.documentElement.style;
  st.setProperty("--ac", A.a); st.setProperty("--ac2", A.b);
  st.setProperty("--ac-glow", dark ? "rgba(16,217,160,.28)" : "rgba(16,217,160,.20)");
  document.querySelectorAll(".theme-opt").forEach(b => b.classList.toggle("selected", b.dataset.theme === S.theme));
  document.querySelectorAll("#accent-picker button").forEach(b => b.classList.toggle("selected", b.dataset.accent === S.accent));
  if($("hero-currency")) $("hero-currency").textContent = S.currency;
  // si la app está visible refresco gráficos sensitivos al color
  if(S.owner && !$("app").classList.contains("hidden")){
    renderDashboard();
    drawStatsCharts();
  }
}

/* ================== DATOS DERIVADOS ================== */
const totalSaved = () => S.goals.reduce((a,g)=>a+Math.max(0,+g.saved||0),0);
const depCount = () => S.goals.reduce((a,g)=>a+(g.history||[]).filter(h=>h.amt>0).length,0);
const goalsDoneCount = () => S.goals.filter(g=>g.done).length;
const balance = () => S.income.reduce((a,t)=>a+t.amt,0) - S.expenses.reduce((a,t)=>a+t.amt,0);
const mIncome = mk => S.income.filter(t=>inMonth(t.d,mk)).reduce((a,t)=>a+t.amt,0);
const mExpenses = mk => S.expenses.filter(t=>inMonth(t.d,mk)).reduce((a,t)=>a+t.amt,0);
const mSavings = mk => S.goals.reduce((a,g)=>a+(g.history||[]).filter(h=>h.amt>0 && inMonth(h.d,mk)).reduce((x,h)=>x+h.amt,0),0);
/* Fondo de emergencia: meta especial marcada g.ef — vive en su propia card */
const EF = () => S.goals.find(g=>g.ef) || null;
const visGoals = () => S.goals.filter(g=>!g.ef);

const daysOf = g => g.deadline ? Math.max(1, Math.ceil((new Date(g.deadline+"T12:00") - new Date(today()+"T12:00"))/86400000)) : 30;
function dailySuggest(){
  const act = visGoals().filter(g=>!g.done);
  if(!act.length) return { amt:0, goal:null };
  const g = act.sort((a,b)=>daysOf(a)-daysOf(b))[0];
  return { amt: Math.max(1, Math.ceil((g.total - g.saved)/Math.max(3, Math.min(daysOf(g), 30)))), goal:g };
}
const savedToday = () => S.goals.reduce((a,g)=>a+(g.history||[]).filter(h=>h.d===today() && h.amt>0).reduce((x,h)=>x+h.amt,0),0);
function streakCalc(){
  const days = new Set();
  S.goals.forEach(g=>(g.history||[]).forEach(h=>{ if(h.amt>0) days.add(h.d); }));
  let s = 0, d = new Date();
  if(!days.has(d.toISOString().slice(0,10))) d.setDate(d.getDate()-1);
  while(days.has(d.toISOString().slice(0,10))){ s++; d.setDate(d.getDate()-1); }
  if(s > S.streakBest){ S.streakBest = s; }
  return s;
}
function topCat(mk){
  const c = {}; S.expenses.filter(t=>inMonth(t.d,mk)).forEach(t=>c[t.cat]=(c[t.cat]||0)+t.amt);
  const e = Object.entries(c).sort((a,b)=>b[1]-a[1])[0];
  return e ? { cat:e[0], amt:e[1] } : null;
}

/* ================== LOGROS ================== */
function checkAch(){
  let nuevas = [];
  for(const a of ACH_DEFS){
    if(!S.ach[a.id]){
      try{ if(a.check()){ S.ach[a.id] = { d:today() }; nuevas.push(a); } }catch{}
    }
  }
  if(nuevas.length){
    save(); renderAch();
    setTimeout(()=>{ SFX.win(); confetti(80); toast(`🏅 ${nuevas.length} nuevo${nuevas.length>1?"s":""} logro${nuevas.length>1?"s":""}: ${nuevas[0].name}`, true); }, 400);
  }
}

/* ================== NAVEGACIÓN ================== */
let curView = "home";
function go(view){
  ["home","goals","stats","profile"].forEach(v => $("view-"+v).classList.toggle("hidden", v !== view));
  document.querySelectorAll(".tab[data-tab]").forEach(t => t.classList.toggle("active", t.dataset.tab === view));
  const active = document.querySelector(`.tab[data-tab="${view}"]`), pill = $("nav-pill");
  if(active && pill) pill.style.left = (active.offsetLeft + active.offsetWidth/2 - 18) + "px";
  curView = view; SFX.swipe();
  window.scrollTo({ top:0 });
  if(view === "stats"){ drawStatsCharts(); try{ drawMonthsChart(); drawNetChart(); }catch{} }
  if(view === "profile") renderProfile();
}

/* ================== CIERRE GLOBAL ================== */
function closeAll(){
  ["panel-activity","panel-chat","panel-settings"].forEach(p => $(p).classList.remove("open"));
  ["m-goal","m-money","m-withdraw","m-tx","m-calc","m-budget","m-rem","m-avatar","m-ef","m-debt","m-pay","m-recur"].forEach(m => $(m).classList.add("hidden"));
  $("sheet-quick").classList.add("hidden");
}
document.addEventListener("click", e => {
  const c = e.target.closest("[data-close]");
  if(c){ e.preventDefault(); closeAll(); }
}, true);

/* ================== TOAST + CONFETTI ================== */
let tT;
function toast(msg, glow){
  const t = $("toast");
  t.innerHTML = msg; t.classList.toggle("glow", !!glow);
  t.classList.remove("hidden"); clearTimeout(tT); tT = setTimeout(()=>t.classList.add("hidden"), 2800);
}
function confetti(n = 110){
  const r = $("confetti-root");
  const col = getComputedStyle(document.documentElement).getPropertyValue("--ac").trim() || "#10d9a0";
  const c = [col, "#ffffff", "#0f3d2e", "#85e0c0", "#f0b429"];
  for(let i=0;i<n;i++){
    const p = document.createElement("i");
    p.style.left = Math.random()*100 + "vw";
    p.style.background = c[i % c.length];
    p.style.setProperty("--t", (2 + Math.random()*1.6) + "s");
    p.style.setProperty("--r", (Math.random()*640 - 320) + "deg");
    p.style.animationDelay = Math.random()*.4 + "s";
    r.appendChild(p);
  }
  setTimeout(()=>r.innerHTML = "", 3800);
}

/* ================== HELPERS DE CANVAS ================== */
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function prep(cv){
  if(!cv) return null;
  const w = cv.clientWidth || cv.parentElement.clientWidth, h = +cv.getAttribute("height") || 150;
  if(w < 10 || h < 10) return null;   // canvas oculto: no dibujar aún
  const dpr = devicePixelRatio || 1;
  cv.width = w*dpr; cv.height = h*dpr; cv.style.height = h+"px";
  const c = cv.getContext("2d"); c.scale(dpr, dpr);
  return { c, w, h };
}
function rr(c,x,y,w,h,r){ r = Math.min(r, w/2, Math.max(1,h/2)); c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }
function hideTip(){ document.querySelector(".chart-tip")?.remove(); }
function showTip(x,y,html){
  let t = document.querySelector(".chart-tip");
  if(!t){ t = document.createElement("div"); t.className = "chart-tip"; document.body.appendChild(t); }
  t.innerHTML = html; t.style.left = x+"px"; t.style.top = y+"px";
}

/* Barras de 8 semanas (interactivas) */
function drawBars(cv, vals, labels, tipFor){
  const P = prep(cv); if(!P) return;
  const { c, w, h } = P;
  const max = Math.max(...vals.filter(isFinite), 1), pad = 10;
  let hover = -1;
  function draw(){
    c.clearRect(0,0,w,h);
    const step = (w - pad*2) / vals.length, bw = Math.min(30, step*0.55);
    vals.forEach((v,i)=>{
      const bh = Math.max(4, (v/max)*(h-42));
      const x = pad + i*step + (step-bw)/2;
      const y = h-22-bh;
      const act = i === hover;
      c.fillStyle = act ? cssVar("--ac") : cssVar("--ac2");
      c.globalAlpha = act ? 1 : .55;
      c.shadowColor = cssVar("--ac-glow"); c.shadowBlur = act ? 14 : 0;
      rr(c, x, y, bw, bh, 6); c.fill(); c.shadowBlur = 0;
      c.globalAlpha = 1;
      c.fillStyle = "rgba(140,160,150,.85)"; c.font = "10px -apple-system, sans-serif"; c.textAlign = "center";
      c.fillText(labels[i], x+bw/2, h-6);
    });
  }
  const idxAt = e => { const r = cv.getBoundingClientRect(); return Math.floor((e.clientX-r.left-pad)/((w-pad*2)/vals.length)); };
  cv.onpointermove = e => { const i = idxAt(e); if(i!==hover){ hover = i; draw(); if(vals[i]) showTip(e.clientX, e.clientY-14, tipFor(i)); } };
  cv.onpointerleave = () => { hover = -1; draw(); hideTip(); };
  draw();
}

/* Línea suave con relleno */
function drawLine(cv, vals){
  const P = prep(cv); if(!P) return;
  const { c, w, h } = P;
  if(!vals.length) return;
  const max = Math.max(...vals, 1), pad = 6, n = vals.length;
  if(!isFinite(max)){ return; }
  const X = i => pad + i*((w-pad*2)/Math.max(n-1,1)), Y = v => h-4-(v/max)*(h-10);
  c.clearRect(0,0,w,h);
  c.strokeStyle = cssVar("--ac"); c.lineWidth = 2.2; c.lineJoin="round"; c.lineCap="round";
  c.shadowColor = cssVar("--ac-glow"); c.shadowBlur = 8;
  c.beginPath();
  vals.forEach((v,i)=>{ const x=X(i), y=Y(v); i ? c.lineTo(x,y) : c.moveTo(x,y); });
  c.stroke();
  const g = c.createLinearGradient(0,0,0,h);
  g.addColorStop(0, cssVar("--ac-glow")); g.addColorStop(1, "transparent");
  c.lineTo(X(n-1), h); c.lineTo(X(0), h); c.closePath();
  c.fillStyle = g; c.fill(); c.shadowBlur = 0;
  c.fillStyle = cssVar("--ac");
  c.beginPath(); c.arc(X(n-1), Y(vals[n-1]), 3.5, 0, 7); c.fill();
}

/* Mini barras spárk */
function drawSpark(cv, vals){
  const P = prep(cv); if(!P) return;
  const { c, w, h } = P;
  const max = Math.max(...vals, 1), n = vals.length, bw = (w/n)*0.62;
  c.clearRect(0,0,w,h);
  vals.forEach((v,i)=>{
    const bh = Math.max(2, (v/max)*(h-4)), x = i*(w/n)+((w/n)-bw)/2, y = h-bh;
    c.fillStyle = v>0 ? cssVar("--ac") : "rgba(140,160,150,.3)";
    c.globalAlpha = v>0 ? .55+.45*(v/max) : 1;
    rr(c,x,y,bw,bh,3); c.fill();
  });
  c.globalAlpha = 1;
}

/* Donut interactivo */
let donutSel = -1;
function drawDonut(cv, segs){
  const P = prep(cv); if(!P) return;
  const { c, w, h } = P;
  const R = Math.min(w,h)/2-10, cx=w/2, cy=h/2, total = segs.reduce((a,s)=>a+s.value,0);
  const BW = 17;
  if(!isFinite(total)) segs.forEach((s,i)=>{ if(!isFinite(s.value)) s.value = 0; });
  if(!total || !isFinite(total)){
    c.clearRect(0,0,w,h);
    c.fillStyle = "rgba(140,160,150,.6)"; c.font = "12px -apple-system"; c.textAlign = "center";
    c.fillText("Sin gastos aún este mes", cx, cy);
    return;
  }
  c.clearRect(0,0,w,h);
  let a0 = -Math.PI/2;
  segs.forEach((s,i)=>{
    const a1 = a0 + (s.value/total)*Math.PI*2;
    c.strokeStyle = s.color; c.lineWidth = i===donutSel ? BW+5 : BW; c.lineCap = "round";
    c.beginPath(); c.arc(cx, cy, R, a0+.04, a1-.04); c.stroke();
    a0 = a1;
  });
  const sel = segs[donutSel] || { label:"Total", value:total };
  c.fillStyle = cssVar("--text");
  const big = Math.abs(sel.value) >= 1e5;
  c.font = big ? "800 13px -apple-system" : "800 15px -apple-system";
  c.textAlign = "center";
  c.fillText(fmtK(sel.value), cx, cy+1);
  c.fillStyle = "rgba(140,160,150,.9)"; c.font = "10.5px -apple-system";
  c.fillText(sel.label, cx, cy+16);
  cv.onpointerdown = e => {
    const r = cv.getBoundingClientRect(), x = e.clientX-r.left-cx, y = e.clientY-(r.top+cy);
    const ang = (Math.atan2(y,x) + Math.PI/2 + 6.31) % (Math.PI*2);
    if(Math.abs(Math.hypot(x,y)-R) > BW+14) return;
    let p = 0, i = -1;
    segs.forEach((s,j)=>{ if(ang >= p && ang <= p+(s.value/total)*Math.PI*2) i = j; p += (s.value/total)*Math.PI*2; });
    if(i >= 0){ donutSel = (donutSel===i) ? -1 : i; SFX.tap(); drawDonut(cv, segs); }
  };
  cv.onpointerleave = () => { donutSel = -1; drawDonut(cv, segs); };
}

/* ================== DASHBOARD ================== */
function last14(){
  return Array.from({ length:14 }, (_,i)=>{
    const d = new Date(); d.setDate(d.getDate()-(13-i));
    const k = d.toISOString().slice(0,10);
    return { d:k, amt:S.goals.reduce((a,g)=>a+(g.history||[]).filter(h=>h.d===k && h.amt>0).reduce((x,h)=>x+h.amt,0),0) };
  });
}
function renderDashboard(){
  const mk = monthKey();
  $("total-savings").textContent = fmt(totalSaved());
  $("m-income").textContent = fmt(mIncome(mk));
  $("m-expenses").textContent = fmt(mExpenses(mk));
  const bal = mIncome(mk) - mExpenses(mk) - mSavings(mk);
  $("m-balance").textContent = fmt(bal);
  $("balance-help").textContent = bal >= 0 ? "Disponible para ahorrar 💚" : "Ojo: gastas más de lo que ingresa ⚠️";
  $("g-count").textContent = visGoals().filter(g=>!g.done).length;
  $("g-done").textContent = goalsDoneCount() ? ` · ${goalsDoneCount()} hechas ✅` : "";
  $("streak-mini").textContent = `🔥 ${streakCalc()} días`;
  $("top-balance").textContent = `Patrimonio ${fmt(totalSaved()+Math.max(0,balance()))}`;

  // widget de ahorro diario
  const ds = dailySuggest(), st = savedToday();
  const pct = ds.amt ? Math.min(100, Math.round(st/ds.amt*100)) : 100;
  $("ring-fg").style.strokeDashoffset = 226*(1-pct/100);
  $("ring-pct").textContent = pct+"%";
  $("daily-suggest").innerHTML = `Hoy: ${fmt(st)} / ${fmt(ds.amt)}`;

  // sparklines
  const L14 = last14();
  drawLine($("hero-spark"), L14.map(d=>d.amt));
  drawSpark($("spark-income"), L14.map(d=>S.income.filter(t=>t.d<=d.d).reduce((a,t)=>a+t.amt,0)));
  drawSpark($("spark-expenses"), L14.map(d=>S.expenses.filter(t=>t.d<=d.d).reduce((a,t)=>a+t.amt,0)));

  // preview metas
  const pv = $("goals-preview"); pv.innerHTML = "";
  const act = visGoals().filter(g=>!g.done);
  if(!S.goals.length) pv.innerHTML = `<div class="empty"><b>🎯</b>Crea tu primera meta con el botón ＋</div>`;
  else if(!act.length) pv.innerHTML = `<div class="empty"><b>🏆</b>¡Todo al código — metas al día!<br>Facturamos una nueva 💚</div>`;
  else act.slice(0,2).forEach(g => pv.appendChild(goalCardHTML(g, true)));

  renderPreviewTx();
  aiDailyTip();
}
function renderPreviewTx(){
  const mk = monthKey();
  const tx = [
    ...S.income.filter(t=>inMonth(t.d,mk)).map(t=>({ cls:"in", ico:"🟢", name:t.name, d:dfmt(t.d), sign:"+", amt:t.amt })),
    ...S.expenses.filter(t=>inMonth(t.d,mk)).map(t=>({ cls:"out", ico:CATS[t.cat]||"📦", name:t.name, d:dfmt(t.d), sign:"-", amt:t.amt })),
    ...S.goals.flatMap(g=>(g.history||[]).filter(h=>h.amt>0 && inMonth(h.d,mk)).map(h=>({ cls:"save", ico:g.emoji||"🐷", name:g.name, d:dfmt(h.d), sign:"+", amt:h.amt }))),
  ].sort((a,b)=>b.d.localeCompare(a.d)).slice(0,4);
  $("recent-tx").innerHTML = tx.length ? tx.map(txItem).join("") : `<div class="empty"><b>🪙</b>Sin movimientos este mes. La actividad empieza con el ＋</div>`;
}
const dfmt = d => { const x = new Date(d+"T12:00"); return `${x.getDate()} ${MONS[x.getMonth()]}`; };
const txItem = i => `<div class="tx-item"><div class="tx-ico ${i.cls}">${i.ico}</div>
  <div class="tx-mid"><div class="tx-name">${esc(i.name)}</div><div class="tx-date">${i.d} · ${i.cls==="save"?"Meta":"Ingreso/Gasto"}</div></div>
  <div class="tx-amt ${i.cls}">${i.sign}${fmt(i.amt)}</div></div>`;

function aiDailyTip(){
  const A = ctx();
  let msg;
  if(!S.goals.length) msg = `¡Hola, ${S.owner}! Crea tu <b>primera meta</b> con el ＋ 🐷`;
  else if(!A.ds.goal) msg = `🎉 Completaste tus metas. Facturamos un nuevo objetivo, ${S.owner}?`;
  else if(savedToday() >= A.ds.amt) msg = `¡Ya ahorraste hoy! Racha de ${A.st} días 🔥 Mañana continuo contigo ✨`;
  else if(A.bal < 0) msg = `Gastaste <b>más</b> de lo que ingresas este mes (${fmt(-A.bal)}). Reviso dónde fuga en <b>Stats</b> 🕵️`;
  else msg = `Plan de hoy: <b>${fmt(A.ds.amt)}</b> hacia ${A.ds.goal.emoji} ${esc(A.ds.goal.name)}`;
  $("ai-message").innerHTML = msg;
}

/* ================== METAS ================== */
let editingGoal = null, pendingGoal = null;
function goalCardHTML(g, preview){
  const pct = Math.min(100, Math.round(g.saved/Math.max(g.total,1)*100));
  const dl = daysOf(g), perDay = !g.done ? fmt(Math.max(1, Math.ceil((g.total-g.saved)/Math.max(3,dl)))) : null;
  const card = document.createElement("div");
  card.className = "goal-card"; card.dataset.goal = g.id;
  const members = g.shared && g.members.length > 1 ? `<div class="mt8">${memberBars(g)}</div>` : "";
  card.innerHTML = `
    <div class="goal-head">
      <div class="goal-thumb">${g.img ? `<img src="${esc(g.img)}" onerror="this.parentElement.textContent='${g.emoji}'" alt="" loading="lazy">` : g.emoji}</div>
      <div style="flex:1;min-width:0">
        <div class="goal-name">${g.shared ? "👥 " : ""}${esc(g.name)} ${g.done ? "✅" : ""}</div>
        <div class="goal-sub">${g.deadline ? (new Date(g.deadline) < new Date() && !g.done ? "⚠️ venció el "+dfmt(g.deadline) : `${dl} días restantes`) : "Sin fecha límite"}${perDay ? " · "+perDay+"/día ideal" : ""}</div>
      </div>
      <button class="goal-menu" data-menu="1">⋯</button>
    </div>
    <div class="goal-amounts"><span class="goal-saved">${fmt(g.saved)}</span><span class="goal-total">de ${fmt(g.total)}</span></div>
    <div class="goal-bar"><div class="goal-fill" style="width:${pct}%"></div></div>
    <div class="goal-foot"><span class="goal-pct">${pct}%${g.done?" 🎉":""}</span>
      <span class="goal-date">${g.shared ? "meta grupal" : "meta personal"}</span></div>
    ${members}
    ${g.done ? `<div class="goal-done-badge">🏆 ¡Meta cumplida, ${esc(S.owner)}!</div>` : `
    <div class="goal-actions">
      <button class="btn btn-sm btn-primary" data-add="1">＋ Ahorrar</button>
      <button class="btn btn-sm btn-ghost" data-edit="1">✏️</button>
      <button class="btn btn-sm btn-ghost" data-calc="1">🧮</button>
    </div>`}`;
  card.addEventListener("click", e => {
    const q = sel => e.target.closest(sel);
    if(q("[data-menu]")){ e.stopPropagation(); goalMenu(g); }
    else if(q("[data-add]")){ pendingGoal = g.id; openMoney(); }
    else if(q("[data-edit]")) openGoalModal(g);
    else if(q("[data-calc]")) openCalc(g);
  });
  return card;
}
function memberBars(g){
  const ms = [...new Set([S.owner, ...(g.members||[])])].filter(Boolean);
  return ms.map(m=>{
    const c = (g.contribs||{})[m] || 0, pct = Math.min(100, Math.round(c/Math.max(g.total,1)*100));
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
      <span style="font-size:11px;font-weight:800;min-width:66px;color:var(--text2)">${esc(m)}</span>
      <div style="flex:1;height:6px;border-radius:99px;background:var(--line);overflow:hidden">
        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--ac2),var(--ac));border-radius:99px"></div>
      </div><span style="font-size:11px;font-weight:800;color:var(--ac)">${fmt(c)}</span></div>`;
  }).join("");
}
function renderGoals(){
  const list = $("goals-list"); list.innerHTML = "";
  const vgoals = visGoals();
  if(!vgoals.length) list.innerHTML = `<div class="empty"><b>🎯</b>Sin metas aún.<br> Usa el ＋ para crear la primera</div>`;
  vgoals.forEach(g => list.appendChild(goalCardHTML(g)));
  const gb = $("goal-bars"); gb.innerHTML = "";
  vgoals.forEach(g=>{
    const pct = Math.min(100, Math.round(g.saved/Math.max(g.total,1)*100));
    gb.innerHTML += `<div class="gbar" style="margin-bottom:10px">
      <div class="rowline" style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:700;margin-bottom:4px">
        <span>${g.emoji} ${esc(g.name)}</span><span style="color:var(--ac)">${pct}%</span></div>
      <div class="goal-bar"><div class="goal-fill" style="width:${pct}%"></div></div></div>`;
  });
}
function goalMenu(g){
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet-card glass">
    <div class="sheet-grip"></div><b class="sheet-title">${g.emoji} ${esc(g.name)}</b>
    ${!g.done ? `<button class="quick-btn" data-a="withdraw">🏧 Retirar dinero</button>
      <button class="quick-btn" data-a="done">✅ Marcar como cumplida</button>` : `
      <button class="quick-btn" data-a="reopen">↩️ Reactivar meta</button>`}
    <button class="quick-btn" data-a="calc">🧮 Cuánto ahorrar al día</button>
    <button class="quick-btn" data-a="del">🗑️ Eliminar meta</button>
    <button class="quick-btn" data-a="x">Cancelar</button></div>`;
  document.body.appendChild(sheet);
  sheet.addEventListener("click", e => {
    if(!e.target.closest("[data-a]")) { if(e.target.classList.contains("sheet-backdrop")) sheet.remove(); return; }
    const a = e.target.dataset.a; sheet.remove();
    if(a === "withdraw") openWithdraw(g);
    else if(a === "done"){ finishGoal(g); }
    else if(a === "reopen"){ g.done = false; save(); renderAll(); toast("Meta reactivada 💪"); }
    else if(a === "calc") openCalc(g);
    else if(a === "del" && confirm(`¿Eliminar "${g.name}"? No se puede recuperar`)){ S.goals = S.goals.filter(x=>x.id!==g.id); save(); renderAll(); checkAch(); }
  });
}
function finishGoal(g){
  const wasDone = g.done; g.done = true;
  save(); renderAll();
  if(!wasDone){ S.xp += 100; save();
    confetti(130); SFX.win(); toast(`🏆 ¡${esc(g.name)} completada! +100 XP`, true);
    notify("🏆 ¡Meta cumplida!", `${S.owner} lograste ${g.name}. Orgullo total 💚`);
  }
}

/* modal meta */
function openGoalModal(g){
  editingGoal = g?.id || null;
  $("m-goal-title").textContent = editingGoal ? "Editar meta" : "Nueva meta";
  $("goal-name").value = g?.name || "";
  $("goal-total").value = g?.total || "";
  $("goal-saved").value = g?.saved || 0;
  $("goal-img").value = g?.img || "";
  $("goal-date").value = g?.deadline || "";
  $("goal-shared").checked = !!g?.shared;
  $("goal-members").value = (g?.members||[]).filter(m=>m!==S.owner).join(", ");
  $("goal-shared-wrap").classList.toggle("hidden", !g?.shared);
  const chips = $("goal-emoji-chips");
  chips.innerHTML = ""; chips.dataset.val = g?.emoji || "🎯";
  GOAL_EMOJIS.forEach(em=>{
    const b = document.createElement("button"); b.type = "button"; b.textContent = em;
    if((g?.emoji||"🎯") === em) b.classList.add("selected");
    b.addEventListener("click", ()=>{ chips.querySelectorAll("button").forEach(x=>x.classList.remove("selected")); b.classList.add("selected"); chips.dataset.val = em; SFX.tap(); });
    chips.appendChild(b);
  });
  const pv = $("goal-photo-preview");
  if(pv){ if(g?.img){ pv.src = g.img; pv.classList.remove("hidden"); } else { pv.classList.add("hidden"); pv.src = ""; } }
  $("m-goal").classList.remove("hidden");
}
function submitGoal(e){
  e.preventDefault();
  const name = $("goal-name").value.trim(), total = parseFloat($("goal-total").value);
  if(!name || !total){ SFX.err(); toast("Completa nombre y cantidad 💛"); return; }
  const shared = $("goal-shared").checked;
  const members = [...new Set([S.owner, ...$("goal-members").value.split(",").map(s=>s.trim()).filter(Boolean)])];
  const data = { name, emoji: $("goal-emoji-chips").dataset.val || "🎯", img: $("goal-img").value.trim(),
    total, saved: parseFloat($("goal-saved").value) || 0, deadline: $("goal-date").value || "", shared, members };
  if(editingGoal){
    const g = S.goals.find(x=>x.id===editingGoal);
    Object.assign(g, data); toast("Meta actualizada ✏️");
  } else {
    const g = { id:rnd(), ...data, done:data.saved>=total, contribs:{}, history:[] };
    if(data.saved>0) g.history.push({ d:today(), amt:data.saved, by:S.owner });
    if(data.saved) { g.contribs[S.owner]=data.saved; S.xp += 15; }
    S.goals.push(g);
    if(g.done) finishGoal(g);
    toast(`🎯 Meta "${esc(name)}" creada`, true); SFX.money();
  }
  save(); closeAll(); renderAll(); checkAch();
}

/* agregar dinero */
function openMoney(){
  let g = S.goals.find(x=>x.id===pendingGoal && !x.done);
  if(!g){ g = S.goals.filter(x=>!x.done).sort((a,b)=>daysOf(a)-daysOf(b))[0]; pendingGoal = g?.id; }
  if(!g){ toast("¡Primero crea una meta 🎯!"); return; }
  $("money-title").innerHTML = `${g.emoji} ${esc(g.name)}`;
  const sel = $("money-member-sel"), wrap = $("money-member");
  const members = [...new Set([S.owner, ...(g.members||[])])];
  if(g.shared && members.length>1){ wrap.classList.remove("hidden"); sel.innerHTML = members.map(m=>`<option>${esc(m)}</option>`).join(""); }
  else wrap.classList.add("hidden");
  $("money-amount").value = "";
  // selector de meta (si abre genérico)
  const gs = $("money-goal-sel") || (() => {
    const s = document.createElement("select"); s.id = "money-goal-sel"; s.className = "mt8";
    s.addEventListener("change", ()=>{
      T = todo[s.selectedIndex];
      pendingGoal = T.id; $("money-title").innerHTML = `${T.emoji} ${esc(T.name)}`;
      const m2 = [...new Set([S.owner, ...(T.members||[])])];
      if(T.shared && m2.length>1){ $("money-member").classList.remove("hidden"); $("money-member-sel").innerHTML = m2.map(m=>`<option>${esc(m)}</option>`).join(""); }
      else $("money-member").classList.add("hidden");
    });
    return s;
  })();
  if(!gs.parentNode) $("money-title").after(gs);
  const todo = S.goals.filter(x=>!x.done && (!x.ef || x.id===pendingGoal));
  gs.innerHTML = todo.map(x=>`<option>${x.emoji} ${esc(x.name)}</option>`).join("");
  gs.selectedIndex = Math.max(0, todo.findIndex(x=>x.id===pendingGoal));
  $("m-money").classList.remove("hidden");
}
let T;
function addMoney(amt){
  const g = S.goals.find(x=>x.id===pendingGoal && !x.done);
  if(!g || !amt || amt<=0){ SFX.err(); toast("Cantidad inválida 💛"); return; }
  const by = $("money-member").classList.contains("hidden") ? S.owner : ($("money-member-sel").value || S.owner);
  const wasDone = g.done;
  g.saved = +g.saved + amt;
  g.history = g.history || [];
  g.history.push({ d:today(), amt:+amt, by });
  if(!g.contribs) g.contribs = {};
  g.contribs[by] = (g.contribs[by]||0) + amt;
  if(g.saved >= g.total) g.done = true;
  S.xp += 15; save(); closeAll();
  if(!wasDone && g.done){ finishGoal(g); }
  else {
    SFX.money(); confetti(26); toast(`+${fmt(amt)} hacia ${esc(g.name)} 💰`, true);
    if(S.notifs.milestones) notify(`💰 +${fmt(amt)} · racha ${streakCalc()} 🔥`,
      `En ${esc(g.name)} llevas ${fmt(g.saved)} de ${fmt(g.total)}`);
  }
  renderAll(); checkAch();
}
/* retirar */
function openWithdraw(g){
  pendingGoal = g.id;
  $("withdraw-info").innerHTML = `Puedes retirar hasta <b>${fmt(Math.max(0,g.saved))}</b> en <b>${esc(g.name)}</b>`;
  $("withdraw-amount").value = "";
  $("m-withdraw").classList.remove("hidden");
}
function doWithdraw(){
  const g = S.goals.find(x=>x.id===pendingGoal), amt = parseFloat($("withdraw-amount").value);
  if(!g || !amt || amt<=0){ SFX.err(); return; }
  if(amt > g.saved){ SFX.err(); toast(`Solo tienes ${fmt(Math.max(0,g.saved))} en esa meta`, true); return; }
  g.saved -= amt; g.done = false;
  g.history.push({ d:today(), amt:-amt, by:S.owner });
  S.xp = Math.max(0, S.xp-10);
  save(); closeAll(); renderAll();
  SFX.tap(); toast(`🏧 Retirado ${fmt(amt)}`);
}

/* ================== MOVIMIENTOS ================== */
let txKind = "income";
function openTx(kind){
  txKind = kind;
  document.querySelectorAll("#tx-kind .seg").forEach(s => s.classList.toggle("active", s.dataset.kind === txKind));
  $("tx-cat-wrap").classList.toggle("hidden", txKind !== "expense");
  const ch = $("tx-cat-chips");
  ch.innerHTML = ""; ch.dataset.val = "comida";
  Object.entries(CATS).forEach(([k, emo])=>{
    const b = document.createElement("button"); b.type = "button"; b.textContent = emo; b.dataset.cat = k;
    b.addEventListener("click", ()=>{ ch.querySelectorAll("button").forEach(x=>x.classList.remove("selected")); b.classList.add("selected"); ch.dataset.val = k; SFX.tap(); });
    ch.appendChild(b);
  });
  $("tx-name").value = ""; $("tx-amount").value = "";
  $("m-tx").classList.remove("hidden");
}
function saveTx(){
  const name = $("tx-name").value.trim(), amt = parseFloat($("tx-amount").value);
  if(!name || !amt || amt<=0){ SFX.err(); toast("Completa concepto y cantidad 💛"); return; }
  if(txKind === "income"){ S.income.push({ id:rnd(), name, amt:+amt, d:today() }); toast(`🟢 Ingreso +${fmt(amt)}`, true); }
  else {
    S.expenses.push({ id:rnd(), name, amt:+amt, cat:$("tx-cat-chips").dataset.val, d:today() });
    toast(`🔴 Gasto −${fmt(amt)} en ${$("tx-cat-chips").dataset.val}`);
    if(S.gb.roundUp){
      const step = S.gb.step || 50;
      const diff = (Math.ceil(amt/step)*step) - amt;
      if(diff > 0 && applyRoundUp(diff)) toast(`🪙 Redondeo: ${fmt(diff)} ahorrados automáticamente`, true);
    }
  }
  save(); closeAll(); renderAll(); checkAch(); SFX.money();
}

/* ================== GRAN BOLSA · modo sostenible ================== */
function gbCalc(){
  const start = new Date(Date.now() - 30*86400000).toISOString().slice(0,10);
  const inc = S.income.filter(t=>t.d>=start).reduce((a,t)=>a+t.amt,0)/30;
  const exp = S.expenses.filter(t=>t.d>=start).reduce((a,t)=>a+t.amt,0)/30;
  const commits = S.goals.filter(g=>!g.done)
    .reduce((a,g)=>a + Math.ceil(Math.max(0,(g.total-g.saved))/daysOf(g)), 0);
  const free = inc - exp - commits;
  const score = inc > 0
    ? Math.max(0, Math.min(100, Math.round((free/Math.max(1,inc))*100)))
    : (free >= 0 ? 60 : 0);
  return { inc, exp, commits, free, score };
}
function renderGB(){
  const wrap = $("gb-roundup"); if(!wrap) return;
  wrap.checked = !!S.gb.roundUp;
  $("gb-goal-wrap").classList.toggle("hidden", !S.gb.roundUp);
  const sel = $("gb-goal");
  const act = visGoals().filter(g=>!g.done);
  sel.innerHTML = act.map(g=>`<option value="${g.id}">${g.emoji} ${esc(g.name)}</option>`).join("") || "<option>Sin metas activas</option>";
  if(S.gb.goal && act.some(g=>g.id===S.gb.goal)) sel.value = S.gb.goal;
  const R = gbCalc();
  $("gb-ring").style.strokeDashoffset = 226*(1 - R.score/100);
  $("gb-score").textContent = R.score + "%";
  $("gb-daily").innerHTML = R.free >= 0
    ? `Libre sostenible: <span style="color:var(--ac)">${fmt(Math.floor(R.free))}</span>/día`
    : `<span style="color:var(--red)">Déficit de ${fmt(Math.ceil(-R.free))}/día</span>`;
  let note;
  if(R.free >= 0){
    note = `Últimos 30 días: ingresos ${fmt(R.inc)} · gastos ${fmt(R.exp)} · tus metas consumen ${fmt(R.commits)}/día.`;
    if(Math.floor(R.free) > 0) note += ` Te sobran ${fmt(Math.floor(R.free))} diarios: puedes sumarlos a una meta 💚`;
    else note = `Justo-justo 🐷 — verde significa que no estás en déficit con tus metas actuales.`;
  } else {
    note = `⚠️ Gastas más de lo que ingresas. Baja el ritmo de un gasto o revisa Stats 🕵️`;
  }
  $("gb-note").textContent = note;
  $("gb-status").textContent = S.gb.roundUp
    ? `🪙 Redondeo activo a múltiplos de ${S.gb.step}: cada gasto ofrece la diferencia y la meta elegida la recibe al instante.`
    : "";
}
function applyRoundUp(diff){
  const g = S.goals.find(x=>x.id===S.gb.goal) || visGoals().filter(x=>!x.done)[0];
  if(!g){ return false; }
  g.saved += diff;
  g.history = g.history || [];
  g.history.push({ d:today(), amt:diff, by:"Redondeo 🪙" });
  g.contribs = g.contribs || {};
  g.contribs["Redondeo 🪙"] = (g.contribs["Redondeo 🪙"]||0) + diff;
  if(g.saved >= g.total) g.done = true;
  renderGB();
  return true;
}

/* ================== CALENDARIO ================== */
let calMonth = monthKey();
function renderCalendar(){
  const [y, m] = calMonth.split("-").map(Number);
  const first = new Date(y, m-1, 1), dim = new Date(y, m, 0).getDate();
  $("cal-title").textContent = `${MESES[first.getMonth()]} ${y}`;
  const grid = $("cal-grid"); grid.innerHTML = "";
  ["D","L","M","M","J","V","S"].forEach(d => { const e = document.createElement("div"); e.className = "cal-dow"; e.textContent = d; grid.appendChild(e); });
  for(let i=0;i<first.getDay();i++) grid.appendChild(Object.assign(document.createElement("div"), { className:"cal-day" }));
  let dias = 0;
  for(let i=1;i<=dim;i++){
    const k = `${calMonth}-${String(i).padStart(2,"0")}`;
    const fin = dayFinancials(k);
    const saved = fin.sav;
    const due = calMonth === monthKey() ? dueForDay(i) : [];
    const e = document.createElement("div");
    e.className = "cal-day" + (saved ? " saved" : "") + (fin.inc.length ? " has-inc" : "") + (fin.exp.length ? " has-exp" : "") + (due.length ? " due" : "") + (k === today() ? " today" : k > today() ? " future" : " past");
    e.textContent = i;
    if(due.length){ const d = document.createElement("i"); d.className = "cal-due"; e.appendChild(d); }
    else if(saved){ const dot = document.createElement("i"); dot.style.cssText = "position:absolute;bottom:3px;width:4px;height:4px;border-radius:50%;background:#04120c"; e.appendChild(dot); }
    e.addEventListener("click", ()=>{
      const bits = [];
      if(fin.inc.length) bits.push(`ingresos 🟢 ${fmtK(fin.inc.reduce((a,t)=>a+t.amt,0))}`);
      if(fin.exp.length) bits.push(`gastos 🔴 ${fmtK(fin.exp.reduce((a,t)=>a+t.amt,0))}`);
      if(saved) bits.push(`ahorraste ${fmt(saved)} 🐷`);
      if(due.length) bits.push(`vencimientos 🔔 ${due.map(d=>`${d.name} ${fmtK(d.amt)}`).join(", ")}`);
      if(bits.length) toast(`${dfmt(k)}: ${bits.join(" · ")}`);
      else if(k === today()){ pendingGoal = (dailySuggest().goal||{}).id; openMoney(); }
      else toast("Día sin movimientos");
    });
    grid.appendChild(e);
    if(saved) dias++;
  }
  const tot = mSavings(calMonth);
  $("cal-summary").innerHTML = totalText(tot, dias);
}
const totalText = (t,d) => `${MESES[new Date(calMonth+"-15T12:00").getMonth()]}: ahorraste <b style="color:var(--ac)">${fmt(t)}</b> en ${d} días 📅`;

/* ================== RECORDATORIOS ================== */
function renderRems(){
  const l = $("rem-list"); l.innerHTML = "";
  S.reminders.forEach(r=>{
    const it = document.createElement("div"); it.className = "rem-item glass";
    it.innerHTML = `<div class="info"><b>${esc(r.text)}</b><span class="stat-help">⏰ ${r.time}</span></div>
      <label class="switch"><input type="checkbox" ${r.on?"checked":""}><span class="slider"></span></label>
      <button class="rem-del">🗑️</button>`;
    it.querySelector("input").addEventListener("change", e => { r.on = e.target.checked; save(); toast(e.target.checked ? "⏰ Activo" : "🔕 Desactivado"); });
    it.querySelector(".rem-del").addEventListener("click", ()=>{ S.reminders = S.reminders.filter(x=>x.id!==r.id); save(); renderRems(); });
    l.appendChild(it);
  });
  if(!S.reminders.length) l.innerHTML = `<div class="empty" style="margin-bottom:10px"><b>⏰</b>Tus recordatorios aparecen aquí</div>`;
}

/* ================== NOTIFICACIONES ================== */
function notify(t, b){
  if("Notification" in window && Notification.permission === "granted"){
    try{
      if(navigator.serviceWorker?.controller){
        navigator.serviceWorker.controller.postMessage({ type:"show-notification", title:t, body:b, tag:"ahorra-plus" });
        return;
      }
      new Notification(t, { body:b, icon:"./icons/icon-192.png", tag:"ahorra-plus" });
    }catch{}
  }
}
async function askNotif(){
  if(!("Notification" in window)){ toast("Tu navegador no soporta notificaciones 😅"); return false; }
  let p = Notification.permission;
  if(p === "prompt") p = await Notification.requestPermission();
  if(p !== "granted"){ toast(p === "denied" ? "Permisos bloqueados: actívalos en Ajustes del sistema 📱" : "Aún sin permiso 🔕"); return false; }
  return true;
}
setInterval(()=>{
  const now = new Date(), hh = String(now.getHours()).padStart(2,"0")+":"+String(now.getMinutes()).padStart(2,"0"), d = today();
  S.reminders.forEach(r=>{
    if(r.on && r.time === hh && S.lastRemSent[r.id] !== d){
      S.lastRemSent[r.id] = d; save();
      notify("⏰ Recordatorio · Ahorra+", r.text);
    }
  });
  if(S.notifs.daily && S.notifs.time === hh && S.lastDailyNotif !== d){
    S.lastDailyNotif = d; save();
    const ds = dailySuggest();
    notify("🐷 Ahorra+ · Tu IA", ds.goal ? `¿Sumamos ${fmt(ds.amt)} a ${ds.goal.name}? Racha ${streakCalc()} días 🔥` : `Buen rato, ${S.owner} 💚`);
  }
  if(S.notifs.weekly && now.getDay() === 0 && hh === "20:00" && S.lastWeeklyNotif !== d){
    S.lastWeeklyNotif = d; save();
    notify("📊 Resumen semanal", `Estos 7 días ahorraste ${fmt(weekSaved())}. ¡Sigue así!`);
  }
}, 30000);
const weekSaved = () => mSavings(weekMk());
function weekMk(){ return monthKey(); }

/* ================== ESTADÍSTICAS ================== */
function drawStatsCharts(){
  const A = ctx();
  // 8 semanas
  const vals = [], labels = [], now = new Date();
  let total = 0;
  for(let i=7;i>=0;i--){
    const start = new Date(now); start.setDate(now.getDate()-i*7); start.setDate(start.getDate()-start.getDay());
    const end = new Date(start.getTime() + 7*86400000);
    const s = S.goals.reduce((a,g)=>a+(g.history||[]).filter(h=>h.amt>0 && h.d >= start.toISOString().slice(0,10) && h.d < end.toISOString().slice(0,10)).reduce((x,h)=>x+h.amt,0),0);
    vals.push(s); labels.push("S"+(8-i)); total += s;
  }
  const cv = $("chart-weeks");
  if(cv){ $("bar-legend-total").textContent = "Total " + fmtK(total);
    drawBars(cv, vals, labels, i => `Semana ${labels[i]}: <span style="color:var(--ac)">${fmtK(vals[i])}</span>`); }
  renderCats(); renderBudget(); renderGoals();
}
function renderCats(){
  const mk = monthKey();
  const vals = {}; S.expenses.filter(t=>inMonth(t.d,mk)).forEach(t=>vals[t.cat]=(vals[t.cat]||0)+t.amt);
  const pal = ["#10d9a0","#22c1a4","#3aa0be","#67c24f","#d9b21a","#c2613a","#9a5cc2"];
  const sorted = Object.entries(vals).sort((a,b)=>b[1]-a[1]);
  const segs = sorted.map(([k,v],i)=>({ label:`${CATS[k]} ${k}`, value:v, color:pal[i%pal.length] }));
  donor($("chart-cats"), segs);
  const l = $("cat-legend");
  if(!sorted.length){ l.innerHTML = `<span class="doc">Aún sin gastos registrados este mes</span>`; return; }
  l.innerHTML = sorted.map(([k,v],i)=>`<span><i style="background:${pal[i%pal.length]}"></i>${CATS[k]} ${k} · ${fmt(v)}</span>`).join("");
}
function donor(cv, segs){ if(cv) drawDonut(cv, segs); }
function renderBudget(){
  const spent = mExpenses(monthKey());
  $("budget-amount").textContent = fmt(S.budget.total||0);
  $("budget-spent").textContent = fmt(spent);
  const pct = S.budget.total ? Math.min(100, Math.round(spent/S.budget.total*100)) : 0;
  const b = $("budget-fill");
  b.style.width = pct+"%";
  b.style.background = pct>90 ? "linear-gradient(90deg,#c23a3a,var(--red))" : pct>70 ? "linear-gradient(90deg,#b98d1e,var(--gold))" : "";
  const bc = $("budget-chips"); bc.innerHTML = "";
  Object.entries(CATS).forEach(([k,emo])=>{
    const lim = (S.budget.cats||{})[k] || 0;
    const sp = S.expenses.filter(t=>inMonth(t.d,monthKey()) && t.cat===k).reduce((a,t)=>a+t.amt,0);
    if(!lim && !sp) return;
    bc.innerHTML += `<span class="bchip ${lim && sp>=lim ? "over":""}">${emo} ${k}: ${fmt(sp)}${lim?"/"+fmt(lim):""}</span>`;
  });
  const dayN = new Date().getDate(), dim = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate();
  let help;
  if(!S.budget.total) help = "Toca <b style='color:var(--ac)'>Editar</b> y pon un plan de gastos 📊";
  else if(pct >= 100) help = `⚠️ Pasaste el presupuesto en ${fmt(spent - S.budget.total)}. Migrando ritmo 💪`;
  else if(spent > S.budget.total*(dayN/dim)*1.1) help = "Vas algo rápido este mes… con calma se arregla 🧘";
  else help = `Vas bien ✅ Quedan <b>${fmt(Math.max(0,S.budget.total-spent))}</b> por ${dim-dayN} días`;
  $("budget-help").innerHTML = help;
}

/* ================== CONVERSOR ================== */
function convCalc(){
  const a = parseFloat($("conv-amount").value) || 0, from = $("conv-from").value, to = $("conv-to").value;
  if(!S.usedConv && a>0){ S.usedConv = true; save(); checkAch(); }
  const dop = a * (from === "DOP" ? 1 : S.rates[from]);
  const out = to === "DOP" ? dop : dop / S.rates[to];
  $("conv-result").value = a>0 ? out.toFixed(2).replace(/\.00$/,"") : "";
  $("conv-rates").innerHTML = `<span class="doc">1 USD = ${S.rates.USD} DOP</span><span class="doc">1 EUR = ${S.rates.EUR} DOP</span><span class="doc">Al convert ≈ ${fmtC(out)}</span>`;
}
const fmtC = n => fmt(n) + (S.currency !== "DOP" ? " " + S.currency : "");
function convSwap(){
  const f = $("conv-from").value; $("conv-from").value = $("conv-to").value; $("conv-to").value = f;
  convCalc(); SFX.pop();
}

/* ================== PERFIL ================== */
const xpInfo = () => { const lvl = Math.floor(S.xp/200)+1, prev = (lvl-1)*200, next = lvl*200;
  return { lvl, pct:Math.min(100, Math.round((S.xp-prev)/2)), falt:next-S.xp, title:LEVEL_TITLES[Math.min(lvl-1, LEVEL_TITLES.length-1)] }; };
function renderProfile(){
  if(!S.owner) return;
  $("profile-name").textContent = S.owner;
  $("profile-since").textContent = `Miembro desde ${MESES[new Date(S.since+"T12:00").getMonth()]} ${new Date(S.since).getFullYear()}`;
  const x = xpInfo();
  $("level-num").textContent = `Nivel ${x.lvl} · ${x.title}`;
  $("level-xp").textContent = `${S.xp} XP`;
  $("xp-fill").style.width = (Math.round((S.xp % 200)/2)) + "%";
  $("xp-next").textContent = `${x.falt} XP para el nivel ${x.lvl+1}`;
  $("p-streak").textContent = streakCalc();
  $("p-streak-best").textContent = S.streakBest;
  $("p-deposits").textContent = depCount();
  $("p-goals-done").textContent = goalsDoneCount();
  $("avatar-edit").textContent = S.avatar;
  $("top-avatar").textContent = S.avatar;
  const grid = $("ach-grid");
  grid.innerHTML = ACH_DEFS.map(a=>{
    const un = !!S.ach[a.id];
    let bar = "";
    if(!un && typeof a.p === "function"){
      try{ const P = a.p() || []; if(P.length===2 && P[1]>0){
        const w = Math.min(100, Math.max(3, Math.round(P[0]/P[1]*100)));
        bar = `<div class="ach-progress"><i style="width:${w}%"></i></div>`;
      } }catch{}
    }
    return `<div class="ach ${un?"unlocked":""}"><b>${a.e}</b><span>${a.name}</span>${bar}</div>`;
  }).join("");
  $("ach-progress").textContent = `${Object.keys(S.ach).length}/${ACH_DEFS.length}`;
}
const renderAch = () => { if(curView === "profile") renderProfile(); };

/* ================== HISTORIAL ================== */
let txMonth = monthKey();
function renderActivity(){
  const [y, m] = txMonth.split("-").map(Number);
  $("tx-month-title").textContent = `${MESES[m-1]} ${y}`;
  $("tx-summary").innerHTML = `
    <div>🟢 Ingresos<b>${fmt(mIncome(txMonth))}</b></div>
    <div>🔴 Gastos<b>${fmt(mExpenses(txMonth))}</b></div>
    <div>🐷 Ahorrado<b>${fmt(mSavings(txMonth))}</b></div>`;
  const rows = [
    ...S.income.filter(t=>inMonth(t.d,txMonth)).map(t=>({ ico:"🟢", cls:"in",  sign:"+", name:t.name, d:dfmt(t.d), amo:t.amt })),
    ...S.expenses.filter(t=>inMonth(t.d,txMonth)).map(t=>({ ico:CATS[t.cat]||"📦", cls:"out", sign:"−", name:t.name, d:dfmt(t.d), amo:t.amt })),
    ...S.goals.flatMap(g=>(g.history||[]).filter(h=>inMonth(h.d,txMonth)).map(h=>({ ico:g.emoji||"🐷", cls:h.amt>0?"save":"out", sign:h.amt>0?"+":"−", name:g.name+(h.amt>0?" · depósito":" · retiro"), d:dfmt(h.d), amo:Math.abs(h.amt) }))),
  ].sort((a,b)=>{ const da = a.d.padStart(12,"0"), db = b.d.padStart(12,"0"); return db.localeCompare(da); });
  $("tx-list").innerHTML = rows.length ? rows.map(txItemMo).join("")
    : `<div class="empty"><b>🪙</b>No hay movimientos este mes.<br>Agrega dinero con el ＋</div>`;
}
const txItemMo = i => `<div class="tx-item"><div class="tx-ico ${i.cls}">${i.ico}</div>
  <div class="tx-mid"><div class="tx-name">${esc(i.name)}</div><div class="tx-date">${i.d}</div></div>
  <div class="tx-amt ${i.cls}">${i.sign}${fmt(i.amo)}</div></div>`;

/* ================== EXPORTAR ================== */
function dl(name, content, type){
  const b = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b); a.download = name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 3000);
  S.exportedOnce = true; save(); checkAch(); SFX.pop(); toast("⬇️ Descargado "+name, true);
}
function exportCSV(){
  let csv = "Fecha;Tipo;Concepto;Categoria;Cantidad;Nomina;Ahorra+\n";
  S.income.filter(t=>inMonth(t.d,txMonth)).forEach(t => csv += [t.d,"ingreso",t.name,"-",t.amt].join(";")+"\n");
  S.expenses.filter(t=>inMonth(t.d,txMonth)).forEach(t => csv += [t.d,"gasto",t.name,t.cat,t.amt].join(";")+"\n");
  S.goals.forEach(g => (g.history||[]).filter(h=>inMonth(h.d,txMonth)).forEach(h =>
    csv += [h.d, h.amt>0 ? "deposito" : "retiro", g.name, h.by&&g.shared?h.by:"-", h.amt].join(";")+"\n"));
  dl(`ahorra-report-${txMonth}.csv`, csv, "text/csv");
}
function exportReport(){
  const mk = monthKey();
  const r = [
    "REPORTE MENSUAL · AHORRA+",
    "=".repeat(45),
    `Autor: ${S.owner} · ${MESES[new Date().getMonth()]} ${new Date().getFullYear()}`,
    `Moneda: ${S.currency}`,
    "",
    "AHORRO",
    `- Total acumulado: ${fmt(totalSaved())}`,
    `- Ahorrado este mes: ${fmt(mSavings(mk))}`,
    `- Racha actual: ${streakCalc()} días (récord: ${S.streakBest})`,
    `- Depósitos totales: ${depCount()}`,
    "",
    "MOVIMIENTOS DEL MES",
    `- Ingresos: ${fmt(mIncome(mk))}`,
    `- Gastos: ${fmt(mExpenses(mk))}`,
    `- Balance libre: ${fmt(mIncome(mk)-mExpenses(mk))}`,
    "",
    "PRESUPUESTO",
    `- Asignado: ${fmt(S.budget.total||0)}`,
    `- Gastado: ${fmt(mExpenses(mk))}`,
    topCat(mk) ? `- Donde más gastas: ${topCat(mk).cat} (${fmt(topCat(mk).amt)})` : "- Aún sin gastos",
    "",
    "METAS",
    ...(S.goals.map(g=>`- ${g.emoji} ${g.name}: ${fmt(g.saved)}/${fmt(g.total)} (${Math.min(100,Math.round(g.saved/Math.max(g.total,1)*100))}%)${g.done?" ✅":""}`)),
    "",
    "Generado por tu IA financiera · Ahorra+ 💚",
  ].join("\n");
  dl(`ahorra-resumen-${mk}.txt`, r, "text/plain");
}

/* ================== CALCULADORA ================== */
function openCalc(g){
  const sel = $("calc-goal");
  const act = visGoals().filter(x=>!x.done);
  sel.innerHTML = act.map(x=>`<option value="${x.id}">${x.emoji} ${esc(x.name)}</option>`).join("") || "";
  if(g && g.id) sel.value = g.id;
  const manual = $("calc-manual");
  manual.checked = !g || !act.some(x=>x.id===(g?.id));
  $("calc-custom-wrap").classList.toggle("hidden", !manual.checked);
  manual.onchange = e => $("calc-custom-wrap").classList.toggle("hidden", !e.target.checked);
  $("calc-result").classList.add("hidden");
  $("m-calc").classList.remove("hidden");
}
function calcRun(){
  let target, days, note;
  if($("calc-manual").checked){
    const t = parseFloat($("calc-target").value) || 0, d = +($("calc-days").value) || 0;
    if(!t || !d){ SFX.err(); toast("Pon objetivo y días 💛"); return; }
    target = t; days = d;
    note = `Plan propio: ${fmt(t)} en ${d} días`;
  } else {
    const g = S.goals.find(x=>x.id === $("calc-goal").value);
    if(!g){ SFX.err(); return; }
    target = g.total - g.saved; days = daysOf(g);
    note = `${g.emoji} ${esc(g.name)}: faltan ${fmt(target)} en ${days} días`;
  }
  const di = Math.ceil(target/Math.max(1,days));
  const ws = Math.ceil(target/Math.max(1,Math.round(days/7)));
  const mo = Math.ceil(target/Math.max(1,Math.round(days/30)));
  $("calc-daily").textContent = fmt(di);
  $("calc-weekly").textContent = fmt(ws);
  $("calc-monthly").textContent = fmt(mo);
  $("calc-note").innerHTML = `${note}<br>💡 Al recibir tu pago, guarda ${fmt(mo)} primero 🐷`;
  $("calc-result").classList.remove("hidden"); SFX.pop();
}

/* ================== IA: CONTEXTO Y RESPUESTAS ================== */
function ctx(){
  const mk = monthKey();
  return { mk, st:streakCalc(), ds:dailySuggest(), bal:mIncome(mk)-mExpenses(mk), top:topCat(mk) };
}
function aiReplyCore(qRaw){
  const q = (qRaw||"").toLowerCase(), A = ctx();
  if(/hola|buenas|hey|qué tal/.test(q) && q.length < 26) return `¡Hola, ${S.owner}! 👋 Pregúntame por tu <b>balance</b>, <b>metas</b>, <b>racha</b>, <b>presupuesto</b> o pídeme un <b>consejo</b>.`;
  if(/balance|cu[aá]nto tengo|ingreso|gast[eé]|report/.test(q))
    return `Este mes entraron <b>${fmt(mIncome(A.mk))}</b> y salieron <b>${fmt(mExpenses(A.mk))}</b>.<br>Balance libre: <b>${fmt(A.bal)}</b> · Ahorro acumulado: <b>${fmt(totalSaved())}</b> 💰`;
  if(/presupuesto/.test(q))
    return !S.budget.total ? `Aún sin presupuesto 📊 Ve a <b>Stats → Presupuesto → Editar</b> y lo armamos juntos.` :
      mExpenses(A.mk) <= S.budget.total ? `Vas bien: ${fmt(mExpenses(A.mk))} de ${fmt(S.budget.total)}. Restan <b>${fmt(S.budget.total-mExpenses(A.mk))}</b> 🟢` :
      `⚠️ Pasaste el presupuesto por ${fmt(mExpenses(A.mk)-S.budget.total)}. Corta los ${A.top?.cat || "gastos extra"} esta semana 💪`;
  if(/racha|streak/.test(q))
    return `Racha de <b>${A.st} días</b> 🔥 ${A.st===0 ? "Un depósito hoy arranca el hábito 💪" : `Hoy toca ${fmt(A.ds.amt||0)} para no romperla 🐷`}`;
  if(/convier|moneda|d[oó]p|usd|eur|d[oó]lar/.test(q)) return `En <b>Stats</b> está el conversor 💱. 1 USD = ${S.rates.USD} DOP · 1 EUR = ${S.rates.EUR} DOP. Puedes cambiar la moneda de la app en Ajustes.`;
  if(/c[uú]anto (ahorrar|guardo)|al d[ií]a|calculator|calculadora/.test(q)){
    if(A.ds.goal || S.goals.length) setTimeout(()=>openCalc(A.ds.goal || null), 400);
    return `Abriendo la <b>calculadora 🧮</b>${A.ds.goal ? " con tu meta "+esc(A.ds.goal.name) : ""} ✨`;
  }
  if(/meta|progreso|falta/.test(q)){
    if(!S.goals.length) return "Crea una meta con el ＋ y la planificamos 🎯";
    const g = A.ds.goal;
    if(!g) return "🏆 Todas las metas están completadas. ¡Vamos una más!";
    const pct = Math.round(g.saved/Math.max(g.total,1)*100), days = daysOf(g);
    return `${g.emoji} ${esc(g.name)} va por el <b>${pct}%</b> (${fmt(g.saved)} de ${fmt(g.total)}). ${days<31 ? `Faltan ${days} días → ${fmt(Math.ceil((g.total-g.saved)/days))}/día.` : `Ritmo ideal: ${fmt(Math.ceil((g.total-g.saved)/Math.max(7,Math.min(days,30))))}/día 💪`}`;
  }
  if(/logro|insignia|medalla/.test(q)){
    const n = Object.keys(S.ach).length;
    return `Llevas <b>${n}/${ACH_DEFS.length}</b> logros 🏅 ${n<4 ? "Las rachas y metas desbloquean más 🚀" : "¡Vitrina lucida y en alto! ✨"}`;
  }
  if(/nivel|exp|xp\b/.test(q)){ const x = xpInfo(); return `Nivel <b>${x.lvl} · ${x.title}</b> (${S.xp} XP). ${x.falt} XP hasta el siguiente: cada depósito suma +15 XP 📈`; }
  if(/compart|amig|famili/.test(q)) return `Al crear/editar una meta marca <b>Ahorro compartido 👥</b>. Cada quien hace depósitos a nombre suyo — la barra del grupo y los aportes de cada uno se ven vivos 🤝`;
  if(/export|reporte|pdf|csv/.test(q)){ setTimeout(exportReport, 400); return "Generando tu <b>reporte del mes</b> 📄…" ; }
  if(/widget|diario|hoy/.test(q)){ const ds = A.ds; return `Widget diario: hoy ${fmt(savedToday())} de ${fmt(ds.amt||0)}. ${savedToday() >= (ds.amt||1) ? "¡Meta del día cumplida! ⭐" : `Falta ${fmt(Math.max(0,(ds.amt||0)-savedToday()))}. El "＋ Ahorrar" del widget lo agrega 💚`}`; }
  if(/gracias/.test(q)) return "¡Siempre! Sigamos llenando la alcancía 🐷💚";
  const tips = [
    `<b>50/30/20</b>: 50% esencial, 30% caprichos, 20% ahorro — recortado del ingreso ANTES de gastar 🐷`,
    `Dejo el ahorro "fuera de alcance" (meta separada). Lo que no ves, no lo gastas 🫥`,
    `Mira dónde se fugan los billetes por categoría en <b>Stats → Gastos por categoría</b> 🕵️`,
    `Técnica de 24h: antes de un capricho, espera un día. El 40% se cancela solo ⏳`,
    `Sobres digitales: límites pequeños por categoría funcionan mejor que uno grande 🍱`,
    `Cuando te paguen, <b>guarda primero</b> ${fmt(Math.max(100, Math.round(mIncome(A.mk)*0.2)))} (20% típico) 🪙`,
  ];
  return tips[Math.floor(Math.random()*tips.length)];
}
function bubble(html, me){
  const c = $("chat"), b = document.createElement("div");
  b.className = "bubble " + (me ? "me" : "ai");
  b.innerHTML = html;
  c.appendChild(b);
  requestAnimationFrame(()=>c.scrollTop = c.scrollHeight);
}
function chatSend(){
  const q = $("chat-input").value.trim(); if(!q) return;
  bubble(esc(q), true); $("chat-input").value = "";
  const ty = document.createElement("div");
  ty.className = "bubble ai typing-dots"; ty.innerHTML = "<span></span><span></span><span></span>";
  $("chat").appendChild(ty);
  setTimeout(()=>{ ty.remove(); bubble(aiReply(q)); SFX.tap(); }, 650 + Math.random()*500);
}

/* ================== FOTO DE META (cámara iPhone) ================== */
function wirePhoto(){
  const btn = $("goal-photo-btn"); if(!btn) return;
  btn.addEventListener("click", ()=>$("goal-photo").click());
  $("goal-photo-clear").addEventListener("click", ()=>{
    $("goal-photo").value = ""; $("goal-img").value = "";
    const p = $("goal-photo-preview"); p.classList.add("hidden"); p.src = "";
    toast("Foto de la meta eliminada");
  });
  $("goal-photo").addEventListener("change", e=>{
    const f = e.target.files?.[0]; if(!f) return;
    if(f.size > 12*1024*1024){ SFX.err(); toast("Foto muy grande 😅"); e.target.value=""; return; }
    const reader = new FileReader();
    reader.onload = ev=>{
      const img = new Image();
      img.onload = ()=>{
        const max = 640, r = Math.min(max/img.width, max/img.height, 1);
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width*r));
        c.height = Math.max(1, Math.round(img.height*r));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        const url = c.toDataURL("image/jpeg", .72);
        $("goal-img").value = url;
        const p = $("goal-photo-preview"); p.src = url; p.classList.remove("hidden");
        SFX.pop(); toast("📷 Foto agregada a la meta", true);
      };
      img.onerror = ()=>{ SFX.err(); toast("No pude leer esa imagen 😕"); };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(f);
  });
}

/* ==================================================================
   MÓDULO v3 · FINANZAS — deudas, tarjetas, recurrentes,
   fondo de emergencia, comparación mensual, patrimonio,
   simulador avanzado, desafíos, seguridad y respaldos
   ================================================================== */
const mExp = () => mExpenses(monthKey());
const fmtK = n => {
  const v = Math.round(+n || 0);
  const a = Math.abs(v);
  if(a >= 1e6) return (v<0?"-$":"$")+(a/1e6).toFixed(1).replace(".0","")+"M";
  if(a >= 1e4) return (v<0?"-$":"$")+(a/1e3).toFixed(1).replace(".0","")+"k";
  return fmt(v);
};

/* ---------- FONDO DE EMERGENCIA ---------- */
function renderEF(){
  const ef = EF();
  const home = $("ef-card"), block = $("ef-block");
  if(!home && !block) return;
  if(!ef){
    const html = `
      <div class="ef-top"><span class="ef-ico">🚑</span>
        <div style="flex:1;min-width:0"><b>Fondo de emergencia</b>
        <span class="stat-help">Tu colchón para imprevistos. Un buen objetivo: 3 meses de gastos ≈ <b style="color:var(--ac)">${esc(fmt(3*mExp()))}</b></span></div></div>
      <div class="ef-actions"><button class="btn btn-primary btn-sm" data-ef="new">Crear fondo</button></div>`;
    if(home){ home.innerHTML = html; home.style.display = "";
      home.onclick = e => { if(e.target.closest("[data-ef=new]")) openEFModal(); }; }
    if(block) block.innerHTML = `<div class="card glass">${html}<div style="height:6px"></div></div>`;
    return;
  }
  const pct = efSavedPct();
  const days = mExp()>0 ? Math.floor(ef.saved/mExp()*30) : 0;
  const mini = `
    <div style="display:flex;width:100%;align-items:center;gap:13px">
      <span class="ef-ico">🚑</span>
      <div style="flex:1;min-width:0">
        <b style="font-size:14px">Fondo de emergencia · ${pct}%</b>
        <div class="goal-bar" style="margin:6px 0 4px"><div class="goal-fill" style="width:${pct}%"></div></div>
        <span class="stat-help">${fmt(ef.saved)}${ef.total?` de ${fmt(ef.total)}`:""}${days>0?` · cubre ${days} días de gastos`:""}</span>
      </div>
      <button class="btn btn-primary btn-sm" data-ef="add" style="flex-shrink:0">＋</button>
    </div>`;
  if(home){
    home.innerHTML = mini;
    home.onclick = e => { if(e.target.closest("[data-ef=add]")){ pendingGoal = ef.id; openMoney(); } };
  }
  const full = `
    <div class="card glass">
      <div class="ef-top"><span class="ef-ico">🚑</span><div style="flex:1;min-width:0"><b>Fondo de emergencia · ${pct}%</b>
        <span class="stat-help">${fmt(ef.saved)} de ${fmt(ef.total||0)} · ${days>0?`protege ${days} días de gastos 🛡️`:"ponle una meta al fondo"}</span></div>
        <button class="goal-menu" data-ef="menu">⋯</button></div>
      <div class="goal-bar big"><div class="goal-fill" style="width:${pct}%"></div></div>
      <div class="ef-actions">
        <button class="btn btn-primary btn-sm" data-ef="add">＋ Aportar</button>
        <button class="btn btn-ghost btn-sm" data-ef="out">🏧 Retirar</button>
        <button class="btn btn-ghost btn-sm" data-ef="edit">✏️ Meta</button>
      </div>
    </div>`;
  if(block){
    block.innerHTML = full;
    block.onclick = e => {
      const a = e.target.closest("[data-ef]")?.dataset.ef; if(!a) return;
      if(a==="add"){ pendingGoal = ef.id; openMoney(); }
      else if(a==="out"){ pendingGoal = ef.id; openWithdraw(ef); }
      else if(a==="edit") openEFModal(ef);
      else if(a==="menu") efMenu(ef);
    };
  }
}
let editingEF = false;
function efMenu(ef){
  const sheet = document.createElement("div"); sheet.className = "sheet";
  sheet.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet-card glass">
    <div class="sheet-grip"></div><b class="sheet-title">🚑 Fondo de emergencia</b>
    <button class="quick-btn" data-a="withdraw">🏧 Retirar dinero</button>
    <button class="quick-btn" data-a="edit">✏️ Editar meta del fondo</button>
    <button class="quick-btn" data-a="del">🗑️ Eliminar fondo</button>
    <button class="quick-btn" data-a="x">Cancelar</button></div>`;
  document.body.appendChild(sheet);
  sheet.addEventListener("click", e => {
    if(!e.target.closest("[data-a]")){ if(e.target.classList.contains("sheet-backdrop")) sheet.remove(); return; }
    const a = e.target.dataset.a; sheet.remove();
    if(a==="withdraw"){ pendingGoal = ef.id; openWithdraw(ef); }
    else if(a==="edit") openEFModal(ef);
    else if(a==="del" && confirm("¿Eliminar el fondo de emergencia?")){
      S.goals = S.goals.filter(x=>x.id!==ef.id); save(); renderAll(); toast("Fondo de emergencia eliminado");
    }
  });
}
function openEFModal(ef){
  const cur = ef || {};
  $("ef-target").value = cur.total || "";
  $("ef-start").value = "";
  editingEF = !!ef;
  $("m-ef").classList.remove("hidden");
}
function submitEF(){
  const target = parseFloat($("ef-target").value)||0, start = parseFloat($("ef-start").value)||0;
  let ef = EF();
  if(ef){
    if(target>0) ef.total = target;
    toast("Meta del fondo actualizada ✏️");
  } else {
    ef = { id:rnd(), name:"Fondo de emergencia", emoji:"🚑", img:"", total:target, saved:start,
      deadline:"", done:false, ef:true, shared:false, members:[S.owner], contribs:{}, history:[] };
    if(start>0) ef.history.push({ d:today(), amt:start, by:S.owner });
    S.goals.push(ef); S.xp += 20;
    toast("🚑 Fondo de emergencia creado", true); SFX.money();
  }
  save(); closeAll(); renderAll(); checkAch();
}

/* ---------- DEUDAS Y TARJETAS ---------- */
const debtRemain = d => Math.max(0, (d.total||0) - (d.paid||0));
function renderDebts(){
  const l = $("debts-list"); if(!l) return;
  l.innerHTML = "";
  if(!S.debts.length) l.innerHTML = `<div class="empty" style="margin-bottom:10px"><b>💳</b>Sin deudas registradas.<br>Añade préstamos o tarjetas y controla su pago</div>`;
  S.debts.forEach(d=>{
    const pct = Math.min(100, Math.round((d.paid||0)/Math.max(d.total,1)*100));
    const remain = debtRemain(d), card = d.kind==="card";
    const months = d.payment>0 ? Math.ceil(remain/d.payment) : null;
    const item = document.createElement("div"); item.className = "card glass debt-card";
    item.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:9px">
        <span class="ef-ico">${card?"💳":"🏦"}</span>
        <div style="flex:1;min-width:0"><b>${esc(d.name)}${d.done?" ✅":""}</b>
          <span class="stat-help">${card&&d.limit?`Disponible ${fmt(Math.max(0,d.limit-(d.paid||0)))} de ${fmt(d.limit)} · `:""}${months&&!d.done?`a ${fmt(d.payment)}/mes → ${months} pagos`:""}</span></div>
        <button class="goal-menu" data-pay-menu="${d.id}">⋯</button>
      </div>
      <div class="goal-amounts"><span class="goal-saved" style="color:${card&&pct>=70?"var(--red)":"var(--ac)"}">${fmtK(remain)}</span>
        <span class="goal-total">${card?"deuda":"de"} ${fmtK(d.total)}</span></div>
      <div class="goal-bar"><div class="goal-fill" style="width:${pct}%;${card?"background:linear-gradient(90deg,#c2613a,var(--red));":""}"></div></div>
      ${d.done?`<div class="goal-done-badge">🎉 ¡Deuda liquidada por completo!</div>`:`
      <div class="ef-actions">
        <button class="btn btn-sm btn-primary" data-pay="${d.id}">💰 Registrar pago</button>
        <button class="btn btn-sm btn-ghost" data-pay-edit="${d.id}">✏️</button>
      </div>`}`;
    item.querySelector("[data-pay]")?.addEventListener("click", ()=>openPay(d));
    item.querySelector("[data-pay-edit]")?.addEventListener("click", ()=>openDebtModal(d));
    item.querySelector("[data-pay-menu]")?.addEventListener("click", ()=>debtMenu(d));
    l.appendChild(item);
  });
  try{ drawDebtChart(); }catch{}
  const sum = $("debts-sum");
  if(sum){
    const rem = S.debts.reduce((a,d)=>a+debtRemain(d),0);
    sum.innerHTML = S.debts.length ? `Deuda total pendiente: <b style="color:var(--red)">${fmtK(rem)}</b> · ${fmtK(S.debts.filter(d=>!d.done).reduce((a,d)=>a+(d.payment||0),0))}/mes en pagos` : "";
  }
}
function openDebtModal(d){
  editingDebt = d?.id || null;
  $("m-debt-title").textContent = d ? "✏️ Editar deuda" : d?.kind==="card" ? "💳 Nueva tarjeta" : "💳 Nueva deuda";
  $("debt-kind").value = d?.kind || "loan";
  document.querySelectorAll("#debt-kind-seg .seg").forEach(x => x.classList.toggle("active", x.dataset.kind === $("debt-kind").value));
  $("debt-name").value = d?.name || "";
  $("debt-total").value = d?.total || "";
  $("debt-paid").value = d?.paid || 0;
  $("debt-payment").value = d?.payment || "";
  $("debt-limit-wrap").classList.toggle("hidden", ($("debt-kind").value!=="card"));
  $("debt-limit").value = d?.limit || "";
  $("debt-day").value = d?.day || 5;
  $("m-debt").classList.remove("hidden");
}
let editingDebt = null;
function submitDebt(){
  const name = $("debt-name").value.trim(), total = parseFloat($("debt-total").value);
  if(!name || !(total>0)){ SFX.err(); toast("Nombre y monto de la deuda 💛"); return; }
  const data = {
    name, kind:$("debt-kind").value, emoji:$("debt-kind").value==="card"?"💳":"🏦",
    total, paid:parseFloat($("debt-paid").value)||0,
    payment:parseFloat($("debt-payment").value)||0,
    limit:parseFloat($("debt-limit").value)||0,
    day:Math.min(28, Math.max(1, +$("debt-day").value||5)),
  };
  if(editingDebt){ const d = S.debts.find(x=>x.id===editingDebt); if(d) Object.assign(d, data); toast("Deuda actualizada ✏️"); }
  else{
    const d0 = { id:rnd(), ...data, done:data.paid>=total, history:[] };
    if(data.paid > 0) d0.history.push({ d:today(), amt:data.paid, initial:true });
    S.debts.push(d0);
    toast(data.kind==="card"?"💳 Tarjeta añadida":"🏦 Deuda añadida", true);
  }
  save(); closeAll(); renderAll(); checkAch(); SFX.pop();
}
function openPay(debt){
  pendingDebt = debt.id;
  $("pay-info").innerHTML = `Saldo pendiente: <b>${fmt(debtRemain(debt))}</b>${debt.payment?` · pago sugerido ${fmt(Math.min(debt.payment, debtRemain(debt)))}`:""}`;
  $("pay-amount").value = debt.payment && debt.payment<=debtRemain(debt) ? debt.payment : "";
  $("pay-expense").checked = debt.kind==="card";
  $("m-pay").classList.remove("hidden");
}
let pendingDebt = null;
function submitPay(){
  const d = S.debts.find(x=>x.id===pendingDebt), amt = parseFloat($("pay-amount").value);
  if(!d || !amt || amt<=0){ SFX.err(); return; }
  if(amt > debtRemain(d)){ SFX.err(); toast(`Para liquidarla solo falta ${fmt(debtRemain(d))}`, true); return; }
  d.paid = (d.paid||0) + amt;
  d.history = d.history || []; d.history.push({ d:today(), amt:+amt });
  let cleared = false;
  if(d.paid >= d.total){ d.done = true; cleared = true; }
  if($("pay-expense").checked){
    S.expenses.push({ id:rnd(), name:`Pago ${d.name}`, amt:+amt, cat:"otros", d:today() });
  }
  S.xp += 15;
  save(); closeAll(); renderAll(); checkAch();
  if(cleared){ S.xp += 150; save(); confetti(120); SFX.win();
    toast(`🎉 ¡${esc(d.name)} liquidada por completo! +150 XP`, true);
    notify("🎉 Deuda liquidada", `${S.owner}, saldaste ${d.name} por completo. Eres libre de esa carga 💚`);
  } else { SFX.money(); toast(`💰 Pago de ${fmt(amt)} en ${d.name}`); }
}

/* ---------- GASTOS RECURRENTES ---------- */
function renderRecur(){
  const l = $("recur-list"); if(!l) return;
  l.innerHTML = "";
  if(!S.recurring.length) l.innerHTML = `<div class="empty" style="margin-bottom:10px"><b>🔁</b>Sin gastos recurrentes.<br>Luz, agua, suscripciones… se registran solos cada mes</div>`;
  S.recurring.forEach(r=>{
    const next = nextRecurDay(r.day);
    const it = document.createElement("div"); it.className = "card glass recur-item";
    it.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        <span class="tx-ico out">${CATS[r.cat]||"📦"}</span>
        <div style="flex:1;min-width:0"><b>${esc(r.name)}</b>
          <span class="stat-help">${r.lastPaid===monthKey() ? "✅ ya registrado este mes" : `Día ${r.day} · próximo ${next.getDate()} ${MONS[next.getMonth()]}`}</span></div>
        <b style="font-size:15px">${fmt(r.amt)}</b></div>
      <div style="display:flex;align-items:center;gap:10px">
        <label class="switch"><input type="checkbox" ${r.on?"checked":""}><span class="slider"></span></label>
        <span class="stat-help" style="flex:1">${r.on?"Auto-registro activo":"Pausado"}</span>
        <button class="btn btn-sm btn-ghost" data-rec-pay="${r.id}">✅ Pagué hoy</button>
        <button class="rem-del" data-rec-del="${r.id}">🗑️</button></div>`;
    it.querySelector(".switch input").addEventListener("change", e=>{ r.on = e.target.checked; save(); renderRecur(); });
    it.querySelector("[data-rec-del]").addEventListener("click", ()=>{ S.recurring = S.recurring.filter(x=>x.id!==r.id); save(); renderRecur(); renderCalendar(); });
    it.querySelector("[data-rec-pay]").addEventListener("click", ()=>recPay(r));
    l.appendChild(it);
  });
  const tot = S.recurring.filter(r=>r.on).reduce((a,r)=>a+r.amt,0);
  const sum = $("recur-sum");
  if(sum) sum.innerHTML = tot ? `Fijos mensuales: <b style="color:var(--ac)">${fmt(tot)}</b> · ${fmt(tot/30)}/día 🔄` : "";
}
function debtMenu(d){
  const sheet = document.createElement("div"); sheet.className = "sheet";
  sheet.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet-card glass">
    <div class="sheet-grip"></div><b class="sheet-title">${d.emoji} ${esc(d.name)}</b>
    <button class="quick-btn" data-a="pay">💰 Registrar pago</button>
    <button class="quick-btn" data-a="edit">✏️ Editar</button>
    <button class="quick-btn" data-a="del">🗑️ Eliminar deuda</button>
    <button class="quick-btn" data-a="x">Cancelar</button></div>`;
  document.body.appendChild(sheet);
  sheet.addEventListener("click", e=>{
    if(!e.target.closest("[data-a]")){ if(e.target.classList.contains("sheet-backdrop")) sheet.remove(); return; }
    const a = e.target.dataset.a; sheet.remove();
    if(a==="pay") openPay(d);
    else if(a==="edit") openDebtModal(d);
    else if(a==="del" && confirm(`¿Eliminar la deuda "${d.name}"?`)){ S.debts = S.debts.filter(x=>x.id!==d.id); save(); renderAll(); checkAch(); toast("Deuda eliminada"); }
  });
}
function nextRecurDay(day){
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth(), day);
  if(d < new Date(n.getFullYear(), n.getMonth(), n.getDate())) d.setMonth(d.getMonth()+1);
  return d;
}
function recPay(r){
  S.expenses.push({ id:rnd(), name:`${CATS[r.cat]||""} ${r.name}`, amt:r.amt, cat:r.cat, d:today() });
  r.lastPaid = monthKey();
  save(); SFX.money(); toast(`✅ ${r.name}: ${fmt(r.amt)} registrado`, true);
  renderAll(); checkAch();
}
function openRecurModal(){
  $("recur-name").value = ""; $("recur-amt").value = ""; $("recur-cat").value = "casa"; $("recur-day").value = "1";
  $("m-recur").classList.remove("hidden");
}
function submitRecur(){
  const name = $("recur-name").value.trim(), amt = parseFloat($("recur-amt").value);
  if(!name || !(amt>0)){ SFX.err(); toast("Pon nombre y monto 💛"); return; }
  S.recurring.push({ id:rnd(), name, amt, cat:$("recur-cat").value || "otros",
    day:Math.min(28, Math.max(1, +$("recur-day").value || 1)), on:true, lastPaid:"" });
  save(); closeAll(); renderAll(); checkAch(); SFX.pop();
  toast("🔁 Gasto recurrente añadido", true);
}
setInterval(()=>{
  if(!document.hasFocus()) return;
  checkRecur();
}, 30*60000);
function checkRecur(){
  if(!S.recurring) return;
  const dom = new Date().getDate(), mk = monthKey();
  S.recurring.forEach(r=>{
    if(r.on && dom === r.day && r.lastPaid !== mk){
      r.lastPaid = mk; save();
      S.expenses.push({ id:rnd(), name:`${CATS[r.cat]||""} ${r.name} (recurrente)`, amt:r.amt, cat:r.cat, d:today() });
      save(); renderAll(); checkAch();
      notify(`🔁 ${r.name} registrado`, `Tu gasto recurrente de ${fmt(r.amt)} entró automáticamente`);
    }
  });
}

/* ---------- CALENDARIO FINANCIERO v3 ---------- */
function dayFinancials(k){
  const inc = S.income.filter(t=>t.d===k);
  const exp = S.expenses.filter(t=>t.d===k);
  const sav = S.goals.reduce((a,g)=>a+(g.history||[]).filter(h=>h.d===k&&h.amt>0).reduce((x,h)=>x+h.amt,0),0);
  return { inc, exp, sav };
}
function dueForDay(i){
  const due = [];
  S.recurring.filter(r=>r.on && r.day===i && r.lastPaid!==monthKey()).forEach(r=>due.push({ ico:CATS[r.cat]||"📦", name:r.name, amt:r.amt }));
  S.debts.filter(d=>!d.done && d.day===i && d.payment).forEach(d=>due.push({ ico:d.emoji||"🏦", name:"Pago "+d.name, amt:d.payment }));
  return due;
}

/* ---------- COMPARACIÓN MENSUAL · PATRIMONIO · DEUDAS ---------- */
function lastMonths(n){
  const out = [], now = new Date();
  for(let i=n-1;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  }
  return out;
}
function drawBars2(cv, series, labels, tipFor){
  const P = prep(cv); if(!P) return;
  const { c, w, h } = P;
  const raw = series.flatMap(s=>s.vals).filter(isFinite);
  const max = Math.max(1, ...raw);
  const pad = 8;
  let hover = -1;
  function draw(){
    c.clearRect(0,0,w,h);
    const step = (w-pad*2)/labels.length;
    const bw = Math.max(6, Math.min(12, (step*0.62)/series.length));
    const group = bw*series.length + 3*(series.length-1);
    labels.forEach((_,i)=>{
      series.forEach((s,j)=>{
        const v = s.vals[i];
        const bh = Math.max(3, (v/max)*(h-42));
        const x = pad + i*step + (step-group)/2 + j*(bw+3);
        const y = h-22-bh;
        c.fillStyle = s.color;
        c.globalAlpha = i===hover ? 1 : .72;
        rr(c, x, y, bw, bh, 4); c.fill();
      });
      c.globalAlpha = 1;
      c.fillStyle = "rgba(140,160,150,.85)"; c.font = "10px -apple-system, sans-serif"; c.textAlign = "center";
      c.fillText(labels[i], pad+i*step+step/2, h-6);
    });
  }
  const idxAt = e => { const r = cv.getBoundingClientRect(); return Math.max(0, Math.min(labels.length-1, Math.floor((e.clientX-r.left-pad)/((w-pad*2)/labels.length)))); };
  cv.onpointermove = e => { const i = idxAt(e); if(i!==hover){ hover = i; draw(); showTip(e.clientX, e.clientY-14, tipFor(i)); } };
  cv.onpointerleave = () => { hover = -1; draw(); hideTip(); };
  draw();
}
function cmpPct(cur, prev){ return prev>0 ? Math.round((cur-prev)/prev*100) : (cur>0?100:0); }
function deltaChip(delta, pct){
  const up = delta >= 0;
  return `<span style="color:${up?"var(--ac)":"var(--red)"}">${up?"▲":"▼"}${pct===0?fmt(Math.abs(delta)):Math.abs(pct)+"%"}</span>`;
}
function drawMonthsChart(){
  const cv = $("chart-months"); if(!cv || !cv.clientWidth) return;
  const MK = lastMonths(6);
  const inc = MK.map(m=>mIncome(m)), exp = MK.map(m=>mExpenses(m)), sav = MK.map(m=>mSavings(m));
  const labels = MK.map(m=>MONS[+m.slice(5,7)-1]);
  drawBars2(cv, [
    { vals:inc, color:cssVar("--ac"), label:"Ingresos" },
    { vals:exp, color:"#ff6b6b", label:"Gastos" },
    { vals:sav, color:"#f0b429", label:"Ahorrado" },
  ], labels, i => `<b>${labels[i]}</b><br><span style="color:#7ee6c3">🟢 ${fmtK(inc[i])}</span><br><span style="color:#ff9d9d">🔴 ${fmtK(exp[i])}</span><br><span style="color:#ffd97a">🐷 ${fmtK(sav[i])}</span>`);
  const lg = $("cmp-legend");
  if(lg) lg.innerHTML = `<span><i style="background:${cssVar("--ac")}"></i>Ingresos</span><span><i style="background:#ff6b6b"></i>Gastos</span><span><i style="background:#f0b429"></i>Ahorrado</span>`;
  const hlp = $("cmp-help");
  if(hlp && MK.length>1){
    const cur = MK[MK.length-1], prev = MK[MK.length-2];
    hlp.innerHTML = `vs ${MONS[+prev.slice(5,7)-1]}: ingresos ${deltaChip(mIncome(cur)-mIncome(prev), cmpPct(mIncome(cur),mIncome(prev)))} · gastos ${deltaChip(mExpenses(cur)-mExpenses(prev), cmpPct(mExpenses(cur),mExpenses(prev)))}`;
  }
}
function drawNetChart(){
  const cv = $("chart-net"); if(!cv || !cv.clientWidth) return;
  const MK = lastMonths(12);
  let acc = 0;
  const pts = MK.map(m=>{ acc += mSavings(m); return acc; });
  drawLine(cv, pts);
}
function drawDebtChart(){
  const cv = $("chart-debt"); if(!cv || !cv.clientWidth) return;
  const MK = lastMonths(12);
  const vals = MK.map(m=>{
    const end = m+"-31";
    return S.debts.reduce((a,d)=>{
      const paid = (d.history||[]).filter(x=>x.d && x.d<=end).reduce((s,x)=>s+(+x.amt||0),0);
      return a + Math.max(0, (d.total||0) - paid);
    },0);
  });
  drawLine(cv, vals);
}

/* ---------- SIMULADOR v3 (cuánto ahorrar / cuándo llego) ---------- */
let calMode = "calc";
function calcRun(){
  if(calMode === "sim") return simRun();
  let target, days, note;
  if($("calc-manual").checked){
    const t = parseFloat($("calc-target").value) || 0, d = +($("calc-days").value) || 0;
    if(!t || !d){ SFX.err(); toast("Pon objetivo y días 💛"); return; }
    target = t; days = d;
    note = `Plan propio: ${fmt(t)} en ${d} días`;
  } else {
    const g = S.goals.find(x=>x.id === $("calc-goal").value);
    if(!g){ SFX.err(); return; }
    target = g.total - g.saved; days = daysOf(g);
    note = `${g.emoji} ${esc(g.name)}: faltan ${fmt(target)} en ${days} días`;
  }
  const di = Math.ceil(target/Math.max(1,days));
  const ws = Math.ceil(target/Math.max(1,Math.round(days/7)));
  const mo = Math.ceil(target/Math.max(1,Math.round(days/30)));
  $("calc-big-label").textContent = "al día";
  $("calc-daily").textContent = fmt(di);
  $("calc-weekly").textContent = fmt(ws);
  $("calc-monthly").textContent = fmt(mo);
  $("calc-note").innerHTML = `${note}<br>💡 Al recibir tu pago, guarda ${fmt(mo)} primero 🐷`;
  $("calc-result").classList.remove("hidden"); SFX.pop();
}
function simRun(){
  const target = parseFloat($("sim-target").value) || 0;
  const per = parseFloat($("sim-amt").value) || 0;
  const freq = $("sim-freq").value;
  if(!target || !per){ SFX.err(); toast("Pon cuánto quieres y cuánto ahorrarás 🐷"); return; }
  const perMonth = per * (freq==="d" ? 30 : freq==="w" ? 4.345 : 1);
  const months = Math.max(0, Math.ceil(target/perMonth) - (per>=target ? 1 : 0));
  const when = new Date(Date.now() + Math.max(1,months)*30.44*86400000);
  $("calc-big-label").textContent = months<=1 ? "1 mes" : `${months} meses`;
  $("calc-daily").textContent = dfmt(when.toISOString().slice(0,10));
  $("calc-weekly").textContent = fmt(per*(freq==="w"?1:freq==="d"?7:30/7));
  $("calc-monthly").textContent = fmt(perMonth);
  $("calc-note").innerHTML = `Con ${fmt(per)}/${freq==="d"?"día":freq==="w"?"semana":"mes"} llegas a ${fmt(target)} en <b>${months<=1?"1 mes":months+" meses"}</b> (~${Math.max(1,Math.round(months*30.44))} días) 🚀`;
  $("calc-result").classList.remove("hidden"); SFX.pop();
}

/* ---------- DESAFÍOS (diario, semanal, mensual) ---------- */
function weekStartKey(){
  const d = new Date(); d.setHours(0,0,0,0);
  d.setDate(d.getDate() - ((d.getDay()+6)%7));
  return d.toISOString().slice(0,10);
}
function depAvg7(){
  const a = new Date(Date.now()-7*86400000).toISOString().slice(0,10);
  const sum = S.goals.reduce((x,g)=>x+(g.history||[]).filter(h=>h.amt>0&&h.d>=a).reduce((s,h)=>s+h.amt,0),0);
  return sum/7;
}
function depsSince(k){ return S.goals.reduce((a,g)=>a+(g.history||[]).filter(h=>h.amt>0&&h.d>=k).length,0); }
function savSince(k){ return S.goals.reduce((a,g)=>a+(g.history||[]).filter(h=>h.amt>0&&h.d>=k).reduce((x,h)=>x+h.amt,0),0); }
function genChallenges(){
  const mk = monthKey(), ds = dailySuggest(), wK = weekStartKey();
  if(!S.challenges.daily || S.challenges.daily.k !== today()){
    S.challenges.daily = ds.amt>0 && ds.goal
      ? { k:today(), mode:"amt", target:ds.amt, label:`Aporta ${fmt(ds.amt)} a ${ds.goal.emoji} ${ds.goal.name} hoy`, xp:30, done:false }
      : { k:today(), mode:"count", target:1, label:"Registra tu primer depósito del día", xp:30, done:false };
  }
  if(!S.challenges.weekly || S.challenges.weekly.k !== wK){
    const base = depAvg7() >= 50 ? Math.round(depAvg7()*7) : (mIncome(mk)>0 ? Math.round(mIncome(mk)*0.05) : 400);
    S.challenges.weekly = base >= 100
      ? { k:wK, mode:"amt", target:base, label:`Ahorra ${fmt(base)} esta semana`, xp:100, done:false }
      : { k:wK, mode:"count", target:4, label:"Haz 4 depósitos esta semana", xp:100, done:false };
  }
  if(!S.challenges.monthly || S.challenges.monthly.k !== mk){
    const base = mIncome(mk)>0 ? Math.round(mIncome(mk)*0.15) : 1500;
    S.challenges.monthly = base >= 500
      ? { k:mk, mode:"amt", target:base, label:`Ahorra ${fmtK(base)} este mes (15% de tus ingresos)`, xp:300, done:false }
      : { k:mk, mode:"count", target:8, label:"Haz 8 depósitos este mes", xp:300, done:false };
  }
}
function chalCur(ch){
  if(!ch) return 0;
  if(ch.k === today()) return ch.mode==="amt" ? savedToday() : depsSince(today());
  if(ch.k === weekStartKey()) return ch.mode==="amt" ? savSince(weekStartKey()) : depsSince(weekStartKey());
  return ch.mode==="amt" ? mSavings(monthKey()) : depsSince(monthKey());
}
function checkChallenges(){
  genChallenges();
  ["daily","weekly","monthly"].forEach(t=>{
    const ch = S.challenges[t];
    if(ch && !ch.done && chalCur(ch) >= ch.target){
      ch.done = true; ch.doneD = today();
      S.xp += ch.xp;
      S.chalLog[t] = (S.chalLog[t]||0) + 1;
      S.chalLog.total = (S.chalLog.total||0) + 1;
      save(); SFX.win(); confetti(70);
      toast(`🎯 ¡Desafío ${t==="daily"?"diario":t==="weekly"?"semanal":"mensual"} cumplido! +${ch.xp} XP`, true);
      notify("🎯 Desafío cumplido", `${ch.label} — +${ch.xp} XP`);
    }
  });
}
function renderChallenges(){
  const card = $("ch-card"); if(!card) return;
  genChallenges();
  const items = [["daily","☀️ Diario"],["weekly","📅 Semanal"],["monthly","🌙 Mensual"]]
    .filter(([k])=>S.challenges[k])
    .map(([k,t])=>{
      const ch = S.challenges[k], cur = chalCur(ch);
      const pct = Math.min(100, Math.round(cur/Math.max(1,ch.target)*100));
      return `<div class="ch-item">
        <div class="rowline"><span>${t}</span><span style="color:${ch.done?"var(--ac)":"var(--text2)"}">${ch.done?"✅ +"+ch.xp+" XP":Math.min(cur,ch.target)+" / "+fmtK(ch.target)}</span></div>
        <div class="ch-label">${esc(ch.label)}</div>
        <div class="goal-bar sm"><div class="goal-fill" style="width:${ch.done?100:pct}%"></div></div>
      </div>`;
    }).join("");
  card.innerHTML = `<div class="ch-head"><b>🎯 Desafíos</b><span class="stat-help">${S.chalLog.total||0} cumplidos</span></div>${items}`;
}

/* ---------- INSIGHTS (análisis real) ---------- */
function insights(){
  const out = [], mk = monthKey();
  const inc = mIncome(mk), exp = mExpenses(mk), bal = inc - exp;
  if(inc > 0){
    const rate = Math.round(bal/inc*100);
    if(rate < 10) out.push(`Tu tasa de ahorro es <b>${rate}%</b> — lo ideal es 20%. Reducir un 10% los gastos libres ya lo cambia 🎯`);
    else if(rate >= 30) out.push(`¡Tasa de ahorro del <b>${rate}%</b>! Vas por encima de la mayoría 🏆`);
  }
  const overs = Object.entries(CATS)
    .map(([k])=>{
      const lim = (S.budget.cats||{})[k]||0;
      const sp = S.expenses.filter(t=>inMonth(t.d,mk)&&t.cat===k).reduce((a,t)=>a+t.amt,0);
      return { k, sp, lim };
    })
    .filter(x=>x.lim>0 && x.sp>x.lim)
    .sort((a,b)=>(b.sp-b.lim)-(a.sp-a.lim))[0];
  if(overs) out.push(`<b>${CATS[overs.k]} ${overs.k}</b> se pasó su presupuesto: ${fmt(overs.sp)} de ${fmt(overs.lim)}. Córtale un 15% la próxima semana 📛`);
  const hormiga = S.expenses.filter(t=>inMonth(t.d,mk) && t.amt<=150);
  if(hormiga.length >= 4){
    const s = hormiga.reduce((a,t)=>a+t.amt,0);
    out.push(`Tienes <b>${hormiga.length} gastos pequeños</b> (≤$150) que suman <b>${fmt(s)}</b> este mes — los "gastos hormiga" 🐜`);
  }
  const ef = EF();
  if(!ef && visGoals().length) out.push(`No tienes fondo de emergencia 🚑. Créalo en <b>Metas → Deudas</b>; empieza con ${fmt(Math.max(500, Math.round(mExp()*0.2)))}`);
  else if(ef && mExp()>0){
    const d = Math.floor(ef.saved/mExp()*30);
    if(d < 30) out.push(`Tu fondo cubre <b>${d} día${d===1?"":"s"}</b> de gastos. La meta sana: 90 días 🛡️`);
  }
  const pend = S.debts.filter(d=>!d.done).reduce((a,d)=>a+debtRemain(d),0);
  if(pend > 0){
    const mayor = S.debts.filter(d=>!d.done).sort((a,b)=>debtRemain(b)-debtRemain(a))[0];
    out.push(`Deudas pendientes: <b>${fmtK(pend)}</b>. Ataca primero <b>${mayor.emoji} ${mayor.name}</b> (${fmtK(debtRemain(mayor))}) con pagos extra 🎯`);
  }
  const doneD = S.debts.filter(d=>d.done).length;
  if(doneD>0) out.push(`Ya liquidaste <b>${doneD} deuda${doneD===1?"":"s"}</b> 💪 Cada mes sin cuota es ahorro directo`);
  const rec = S.recurring.filter(r=>r.on).reduce((a,r)=>a+r.amt,0);
  if(rec > 0 && inc > 0) out.push(`Tus fijos mensuales son <b>${fmt(rec)}</b> (${Math.round(rec/inc*100)}% de tus ingresos)${rec/inc>0.3?" — está alto, revisa suscripciones 🔍":""} 🔁`);
  const prevMk = lastMonths(2)[0];
  if(prevMk && prevMk !== mk && mExpenses(prevMk) > 0){
    const d = mExpenses(mk) - mExpenses(prevMk);
    if(d > 0) out.push(`Vas gastando <b>${fmt(d)} más</b> que todo ${MESES[+prevMk.slice(5,7)-1]} ⚠️`);
    else out.push(`Vas <b>${fmt(-d)} mejor</b> en gastos que el mes pasado ✅`);
  }
  if(!out.length) out.push(`Registra ingresos y gastos con el ＋ y aquí empieza el análisis real 📊`);
  return out;
}

/* ---------- IA v3 (nuevas habilidades sobre los datos reales) ---------- */
function aiReply(qRaw){
  const q = (qRaw||"").toLowerCase(), A = ctx();
  if(/deuda|pr[eé]stamo|tarjeta|cr[eé]dito/.test(q)){
    if(!S.debts.length) return "No tienes deudas registradas 🎉 Añádelas en <b>Metas → 💳 Deudas</b> y las planificamos juntos.";
    const pend = S.debts.filter(d=>!d.done);
    if(!pend.length) return "¡Todas tus deudas están <b>liquidadas</b>! 🎉 Nada pendiente ni tarjeta con saldo.<br>Este es el momento perfecto para mudar esa cuota a un depósito de ahorro 🐷";
    const total = pend.reduce((a,d)=>a+debtRemain(d),0);
    const pagos = pend.reduce((a,d)=>a+(d.payment||0),0);
    const p = pend.map(d=>`${d.emoji} ${d.name}: <b>${fmtK(debtRemain(d))}</b>${d.payment?` (a ${fmt(d.payment)}/mes)`:""}`).join("<br>");
    return `Deuda pendiente: <b>${fmtK(total)}</b> en ${pend.length} cuenta${pend.length>1?"s":""}.<br>${p}<br>${pagos>0?`A ${fmtK(pagos)}/mes la liquidas en ~${Math.ceil(total/pagos)} meses.`:"Pon pagos mensuales para el plan 🗓️"} Te conviene pagar extra a la <b>más pequeña</b> primero 🎯`;
  }
  if(/fondo|emergencia/.test(q)){
    const ef = EF();
    if(!ef) return `No tienes fondo de emergencia 🚑. Crea uno en <b>Metas → Deudas</b>. Recomendación estándar: 3 meses de gastos ≈ <b>${fmt(3*mExp())}</b>.`;
    const d = mExp()>0 ? Math.floor(ef.saved/mExp()*30) : 0;
    return `Fondo: <b>${fmt(ef.saved)}</b>${ef.total?` de ${fmt(ef.total)} (${efSavedPct()}%)`:""}. ${mExp()>0?`Cubre <b>${d} días</b> de gastos; meta sana: 90 días 🛡️`:"Registra gastos para medir tus días de cobertura."}`;
  }
  if(/recurrent|fijos|suscripci/.test(q)){
    if(!S.recurring.length) return "Sin gastos recurrentes aún 🔁 Añádelos en <b>Metas → Gastos recurrentes</b> y el mes se calcula solo.";
    const act = S.recurring.filter(r=>r.on);
    const tot = act.reduce((a,r)=>a+r.amt,0);
    return `Fijos activos: <b>${fmt(tot)}/mes</b> (${fmt(tot/30)}/día).<br>${act.slice().sort((a,b)=>b.amt-a.amt).slice(0,4).map(r=>`${CATS[r.cat]||"📦"} ${r.name}: ${fmt(r.amt)}`).join("<br>")}${tot>0?"<br>💡 Si algo no lo usas 3 veces al mes, cancela 📛":""}`;
  }
  if(/innecesari|desperdici|hormiga|caprich/.test(q)){
    const mk = monthKey();
    const h = S.expenses.filter(t=>inMonth(t.d,mk)&&t.amt<=150);
    const byCat = Object.entries(CATS).map(([k])=>({ k, v:S.expenses.filter(t=>inMonth(t.d,mk)&&t.cat===k).reduce((a,t)=>a+t.amt,0) })).sort((a,b)=>b.v-a.v)[0];
    let msg = "";
    if(h.length>=3) msg += `Gastos hormiga: <b>${h.length} pagos ≤$150</b> = <b>${fmt(h.reduce((a,t)=>a+t.amt,0))}</b> 🐜<br>`;
    if(byCat && byCat.v>0) msg += `Mayor categoría: <b>${CATS[byCat.k]} ${byCat.k}</b> con ${fmt(byCat.v)}.<br>`;
    return msg || "Aún no veo gastos que recortar — registra más movimientos y detecto lo innecesario 🕵️";
  }
  if(/compar|mes anterior|vs|antes/.test(q)){
    const MK = lastMonths(2), cur = MK[1], prev = MK[0];
    const di = mIncome(cur)-mIncome(prev), de = mExpenses(cur)-mExpenses(prev), ds = mSavings(cur)-mSavings(prev);
    return `Comparando con ${MESES[+prev.slice(5,7)-1]}:<br>🟢 Ingresos ${deltaChip(di, cmpPct(mIncome(cur),mIncome(prev)))}<br>🔴 Gastos ${deltaChip(de, cmpPct(mExpenses(cur),mExpenses(prev)))}<br>🐷 Ahorro ${deltaChip(ds, cmpPct(mSavings(cur),mSavings(prev)))}`;
  }
  if(/plan|estrategia|c[oó]mo salgo|organiz/.test(q)){
    const mk = monthKey();
    const libre = mIncome(mk) - mExpenses(mk);
    const pend = S.debts.filter(d=>!d.done).reduce((a,d)=>a+debtRemain(d),0);
    const ef = EF();
    const pasos = [];
    if(ef && efSavedPct() >= 100) pasos.push("tu fondo está al 100% ✅");
    else if(ef) pasos.push(`llena el fondo (${efSavedPct()}%) 🚑`);
    else pasos.push(`crea el fondo de emergencia (~desde ${fmt(Math.max(500, Math.round(mExp()*0.2)))})`);
    if(pend>0) pasos.push(`ataca ${fmtK(pend)} de deuda, de la más pequeña a la mayor 🏦`);
    if(A.ds.goal) pasos.push(`sigue ${A.ds.goal.emoji} ${A.ds.goal.name}: ${fmt(A.ds.amt)}/diario 🐷`);
    if(libre>0) pasos.push(`tienes ${fmt(libre)} libres: manda al menos ${fmt(Math.round(libre*0.3))} a ahorro ANTES de gastar 🪙`);
    return `Tu plan con tus números reales:<br>1️⃣ ${pasos.join("<br>2️⃣ ")}<br>💡 Regla 50/30/20 al recibir tu pago.`;
  }
  if(/informe|reporte|pdf/.test(q)){ setTimeout(aiMonthlyReport, 450); return "Generando tu <b>informe del mes</b> 📄 (se abre para guardar como PDF)…"; }
  if(/respaldo|backup|copia/.test(q)){ setTimeout(exportBackup, 400); return "Te preparo el <b>respaldo completo</b> (.json) 💾 — si lo guardas, nada se pierde aunque cambies de teléfono."; }
  if(/insignia|niveles|desaf[ií]/.test(q)){
    const n = Object.keys(S.ach).length, totalChal = S.chalLog.total||0;
    return `Vas con <b>${n}/${ACH_DEFS.length} insignias</b> 🏅 y <b>${totalChal} desafíos</b> cumplidos 🎯. El desafío de hoy: ${S.challenges.daily?.label||"🧘"} — vale +30 XP.`;
  }
  return aiReplyCore(qRaw);
}
function efSavedPct(){ const ef = EF(); return ef ? Math.min(100, Math.round(ef.saved/Math.max(ef.total,1)*100)) : 0; }
function aiDailyTip(){
  const ins = insights();
  const pick = ins[Math.floor(Date.now()/86400000) % ins.length];
  $("ai-message").innerHTML = pick;
}

/* ---------- INFORME PDF (imprimir → guardar como PDF) ---------- */
function aiMonthlyReport(){
  const mk = monthKey();
  const MK = lastMonths(4);
  const inc = mIncome(mk), exp = mExpenses(mk);
  const rows = [
    ...S.income.filter(t=>inMonth(t.d,mk)).map(t=>`<tr class="in"><td>${t.d}</td><td>Ingreso</td><td>${esc(t.name)}</td><td style="text-align:right">+${fmt(t.amt)}</td></tr>`),
    ...S.expenses.filter(t=>inMonth(t.d,mk)).map(t=>`<tr><td>${t.d}</td><td>${CATS[t.cat]||"📦"} ${t.cat||"-"}</td><td>${esc(t.name)}</td><td style="text-align:right">−${fmt(t.amt)}</td></tr>`),
    ...S.goals.flatMap(g=>(g.history||[]).filter(h=>inMonth(h.d,mk)).map(h=>`<tr class="in"><td>${h.d}</td><td>${g.ef?"🚑 Fondo":"🐷 Meta"}</td><td>${esc(g.name)}${h.by?` (${esc(h.by)})`:""}</td><td style="text-align:right">${h.amt>0?"+":""}${fmt(h.amt)}</td></tr>`)),
  ];
  const win = window.open("", "_blank");
  if(!win){ toast("Permite ventanas emergentes para el PDF 🙏"); return; }
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Informe ${mk} · Ahorra+</title><style>
    body{ font-family:-apple-system,'Segoe UI',sans-serif; color:#111827; margin:40px; }
    h1{ font-size:22px; margin:0 0 4px; } .sub{ color:#6b7280; font-size:12px; margin-bottom:22px; }
    .kpis{ display:flex; gap:14px; margin-bottom:22px; }
    .kpi{ flex:1; border:1.5px solid #e5e7eb; border-radius:14px; padding:12px 16px; }
    .kpi b{ font-size:20px; display:block; } .kpi span{ font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:.05em; }
    table{ width:100%; border-collapse:collapse; font-size:12.5px; }
    th{ text-align:left; color:#6b7280; font-size:10.5px; text-transform:uppercase; border-bottom:2px solid #e5e7eb; padding:6px 8px; }
    td{ padding:7px 8px; border-bottom:1px solid #f3f4f6; }
    tr.in td{ color:#047857; }
    .sect{ margin:26px 0 8px; font-size:14px; font-weight:700; }
    .cmp td{ padding:6px 12px; border-bottom:1px solid #f3f4f6; font-size:12.5px; }
    @media print{ body{ margin:16px; } }
  </style></head><body>
    <h1>Informe mensual — Ahorra+</h1>
    <div class="sub">${MESES[new Date().getMonth()]} ${new Date().getFullYear()} · ${esc(S.owner||"")} · generado el ${new Date().toLocaleDateString("es-DO")}</div>
    <div class="kpis">
      <div class="kpi"><span>Ahorrado del mes</span><b style="color:#047857">${fmt(mSavings(mk))}</b></div>
      <div class="kpi"><span>Ingresos</span><b>${fmt(inc)}</b></div>
      <div class="kpi"><span>Gastos</span><b>${fmt(exp)}</b></div>
      <div class="kpi"><span>Balance libre</span><b style="color:${inc-exp>=0?"#047857":"#b91c1c"}">${fmt(inc-exp)}</b></div>
    </div>
    <div class="sect">Comparación (últimos 4 meses)</div>
    <table class="cmp"><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Ahorrado</th></tr>
    ${MK.map(m=>`<tr><td>${MESES[+m.slice(5,7)-1]}</td><td>${fmt(mIncome(m))}</td><td>${fmt(mExpenses(m))}</td><td>${fmt(mSavings(m))}</td></tr>`).join("")}
    </table>
    ${S.debts.length?`<div class="sect">Deudas</div><table class="cmp"><tr><th>Tipo</th><th>Nombre</th><th>Pendiente</th><th>Estado</th></tr>
      ${S.debts.map(d=>`<tr><td>${d.kind==="card"?"💳":"🏦"}</td><td>${esc(d.name)}</td><td>${fmtK(debtRemain(d))}</td><td>${d.done?"✅ liquidada":`${Math.round((d.paid||0)/Math.max(d.total,1)*100)}% pagado`}</td></tr>`).join("")}</table>`:""}
    ${EF()?`<div class="sect">Fondo de emergencia</div><p style="font-size:12.5px">${fmt(EF().saved)} de ${fmt(EF().total||0)} (${efSavedPct()}%)${mExp()>0?` · cubre ${Math.floor(EF().saved/mExp()*30)} días de gastos`:""}</p>`:""}
    <div class="sect">Movimientos del mes</div>
    <table><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th style="text-align:right">Monto</th></tr>
    ${rows.join("")||"<tr><td colspan='4' style='color:#9ca3af'>Sin movimientos este mes</td></tr>"}
    </table>
    <p style="color:#9ca3af; font-size:10.5px; margin-top:26px">Ahorra+ · creado por jesuscroken · datos al ${new Date().toLocaleString("es-DO")}</p>
    <script>setTimeout(function(){ window.print(); },300);<\/script>
  </body></html>`);
  win.document.close();
  S.exportedOnce = true; save(); checkAch(); SFX.pop();
}

/* ---------- AVATAR CON FOTO DE GALERÍA ---------- */
function wireAvatarPhoto(){
  const inp = $("avatar-file"); if(!inp) return;
  $("avatar-photo-btn").addEventListener("click", ()=>inp.click());
  $("avatar-photo-clear").addEventListener("click", ()=>{
    S.avatarImg = ""; save(); inp.value = "";
    applyAvatar(); closeAll(); toast("Foto de perfil eliminada");
  });
  inp.addEventListener("change", e=>{
    const f = e.target.files?.[0]; if(!f) return;
    if(f.size > 12*1024*1024){ SFX.err(); toast("Imagen muy grande 😅"); return; }
    const reader = new FileReader();
    reader.onload = ev=>{
      const img = new Image();
      img.onload = ()=>{
        const s = Math.min(img.width, img.height), max = 256;
        const c = document.createElement("canvas"); c.width = max; c.height = max;
        const cx = c.getContext("2d");
        cx.drawImage(img, (img.width-s)/2, (img.height-s)/2, s, s, 0, 0, max, max);
        S.avatarImg = c.toDataURL("image/jpeg", .8);
        save(); applyAvatar(); closeAll();
        SFX.pop(); toast("📷 Foto de perfil actualizada", true);
        try{ notify("✨ Perfil listo", "Tu nueva foto se ve en toda la app 💚"); }catch{}
      };
      img.onerror = ()=>{ SFX.err(); toast("No pude leer esa imagen 😕"); };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(f);
  });
}
function applyAvatar(){
  const im = S.avatarImg;
  ["top-avatar","avatar-edit"].forEach(id=>{
    const el = $(id); if(!el) return;
    if(im){
      let i = el.querySelector("img");
      if(!i){ el.textContent = ""; i = document.createElement("img"); i.alt = ""; i.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:50%"; el.appendChild(i); }
      i.src = im;
    } else if(el.querySelector("img")){ el.innerHTML = ""; el.textContent = S.avatar; }
    else el.textContent = S.avatar;
  });
}

/* ---------- SEGURIDAD: PIN, bloqueo y privacidad ---------- */
const hashPin = p => { let h = 7; for(const ch of String(p)) h = (h*31 + ch.charCodeAt(0))>>>0; return h.toString(36); };
let pinEntry = "";
function pinIsSet(){ return !!S.security.pinHash; }
function unlockNow(){
  try{ sessionStorage.setItem("ahorra_unlocked","1"); }catch{}
  $("m-lock").classList.add("hidden");
  pinEntry = ""; renderPinDots();
  toast(`Bienvenido, ${esc(S.owner)} 💚`); SFX.pop();
}
function lockNow(){
  if(!pinIsSet()) return;
  try{ sessionStorage.removeItem("ahorra_unlocked"); }catch{}
  pinEntry = ""; renderPinDots();
  $("m-lock").classList.remove("hidden");
}
function renderPinDots(){
  const d = $("pin-dots"); if(!d) return;
  d.innerHTML = [0,1,2,3].map(i=>`<span class="pin-dot ${i<pinEntry.length?"on":""}"></span>`).join("");
}
function pinPress(k){
  SFX.tap();
  if(k === "back"){ pinEntry = pinEntry.slice(0,-1); renderPinDots(); return; }
  if(pinEntry.length >= 4) return;
  pinEntry += k; renderPinDots();
  if(pinEntry.length === 4){
    setTimeout(()=>{
      if(hashPin(pinEntry) === S.security.pinHash) unlockNow();
      else { SFX.err(); pinEntry = ""; renderPinDots(); $("pin-wrong").classList.remove("hidden"); setTimeout(()=>$("pin-wrong").classList.add("hidden"), 1600); }
    }, 140);
  }
}
function applyPrivacy(){
  document.body.classList.toggle("priv", !!S.security.privacy);
  const t = $("priv-toggle"); if(t) t.checked = !!S.security.privacy;
}

/* ---------- RESPALDOS ---------- */
function exportBackup(){
  const data = JSON.stringify({ app:"ahorra-plus", v:3, exportD:today(), data:S }, null, 1);
  dl(`ahorra-respaldo-${today()}.json`, data, "application/json");
}
function importBackup(file){
  const reader = new FileReader();
  reader.onload = e=>{
    try{
      const j = JSON.parse(e.target.result);
      const D = j.app === "ahorra-plus" ? j.data : j;
      if(!D || !Array.isArray(D.goals) || !Array.isArray(D.income) || !D.owner){
        SFX.err(); toast("Ese archivo no es un respaldo de Ahorra+ ⚠️"); return;
      }
      if(confirm(`Restaurar respaldo de ${D.owner}? Reemplaza los datos actuales (las ${S.goals.length} metas y ${S.income.length+S.expenses.length} movimientos actuales se sustituyen).`)){
        localStorage.setItem(KEY, JSON.stringify(D));
        try{ localStorage.setItem(KEY_V2, JSON.stringify(D)); }catch{}
        toast("✅ Respaldo restaurado");
        setTimeout(()=>location.reload(), 700);
      }
    }catch{ SFX.err(); toast("No pude leer ese archivo ⚠️"); }
  };
  reader.readAsText(file);
}

/* ---------- Rendimiento: re-dibujar al girar o cambiar tamaño ---------- */
let rszT;
window.addEventListener("resize", ()=>{
  clearTimeout(rszT);
  rszT = setTimeout(()=>{ if(curView === "stats") try{ refreshStats(); }catch{} if(curView === "home") try{ renderDashboard(); }catch{} }, 250);
});
ACH_DEFS.push(
  { id:"deps20",    e:"🏆",  name:"20 depósitos",       check:()=>depCount()>=20,  p:()=>[depCount(),20] },
  { id:"goals5",    e:"🌟",  name:"5 metas cumplidas",  check:()=>goalsDoneCount()>=5, p:()=>[goalsDoneCount(),5] },
  { id:"debt0",     e:"🎉",  name:"1ª deuda liquidada", check:()=>S.debts.some(d=>d.done) },
  { id:"ef100",     e:"🛡️",  name:"Fondo completo",     check:()=>{ const ef = EF(); return ef && ef.total>0 && ef.saved>=ef.total; }, p:()=>{ const ef = EF(); return ef&&ef.total>0 ? [ef.saved,ef.total] : [0,1]; } },
  { id:"chal10",    e:"🎯",  name:"10 desafíos",        check:()=>(S.chalLog.total||0)>=10, p:()=>[S.chalLog.total||0,10] },
  { id:"rec1",      e:"🔁",  name:"Automatización",     check:()=>S.recurring.some(r=>r.on) },
  { id:"income6",   e:"📈",  name:"6 ingresos",         check:()=>S.income.length>=6, p:()=>[S.income.length,6] },
  { id:"locked",    e:"🔒",  name:"App protegida",      check:()=>pinIsSet() && S.security.lock },
);
LEVEL_TITLES.push("Titan 💎","Dragón de oro 🐉","Imperio 🏰","Leyenda viva ⚡","MITO 🌟");

/* ================== RENDER TOTAL ================== */
function renderAll(){
  renderDashboard(); renderGoals(); renderCalendar(); renderRems();
  renderActivity(); renderBudget(); renderProfile(); renderGB();
  renderEF(); renderDebts(); renderRecur(); renderChallenges();
  applyAvatar(); applyPrivacy(); applySecUI();
  try{ drawStatsCharts(); }catch(err){ console.warn("charts:", err); }
  if(curView === "stats") try{ refreshStats(); }catch(err){ console.warn("stats v3:", err); }
  checkChallenges();
}
function refreshStats(){
  drawMonthsChart(); drawNetChart();
}

/* ================== WIRING ================== */
let WIRED = false;
function wire(){
  if(WIRED) return; WIRED = true;
  $("welcome-form").addEventListener("submit", e=>{
    e.preventDefault();
    const n = $("name-input").value.trim(); if(!n) return;
    S.owner = n; S.since = today(); save(); start(); confetti(70); SFX.win();
  });
  // vistas
  document.querySelectorAll(".tab[data-tab]").forEach(t => t.addEventListener("click", ()=>go(t.dataset.tab)));
  $("fab").addEventListener("click", ()=>{ $("sheet-quick").classList.remove("hidden"); SFX.pop(); });
  $("profile-btn").addEventListener("click", ()=>go("profile"));
  $("go-goals").addEventListener("click", ()=>go("goals"));
  $("go-activity").addEventListener("click", ()=>{ renderActivity(); openPanel("panel-activity"); });
  $("ai-banner").addEventListener("click", ()=>openPanel("panel-chat"));
  $("settings-btn").addEventListener("click", ()=>openPanel("panel-settings"));
  $("save-name").addEventListener("click", ()=>{ const n = $("settings-name").value.trim(); if(n){ S.owner = n; save(); updateGreeting(); renderProfile(); toast(`¡Listo, ${esc(n)}! 💚`); } });

  function openPanel(id){ $(id).classList.add("open"); SFX.swipe(); }

  // segmented de metas
  document.querySelectorAll("#view-goals .seg").forEach(s => s.addEventListener("click", ()=>{
    document.querySelectorAll("#view-goals .seg").forEach(x => x.classList.toggle("active", x === s));
    ["goals","fin","cal","rem"].forEach(k => $("seg-"+k).classList.toggle("hidden", k !== s.dataset.seg));
    if(s.dataset.seg === "cal") renderCalendar();
    SFX.tap();
  }));
  const monthStep = (key, dir) => {
    const [y, m] = key.split("-").map(Number);
    const nm = m + dir;
    return nm < 1 ? `${y-1}-12` : nm > 12 ? `${y+1}-01` : `${y}-${String(nm).padStart(2,"0")}`;
  };
  $("cal-prev").addEventListener("click", ()=>{ calMonth = monthStep(calMonth,-1); renderCalendar(); SFX.tap(); });
  $("cal-next").addEventListener("click", ()=>{ const next = monthStep(calMonth,1); if(next > monthKey()) return; calMonth = next; renderCalendar(); SFX.tap(); });
  $("rem-add").addEventListener("click", ()=>{ $("rem-text").value = ""; $("m-rem").classList.remove("hidden"); });
  $("rem-save").addEventListener("click", ()=>{
    const text = $("rem-text").value.trim(), time = $("rem-time").value;
    if(!text){ SFX.err(); return; }
    S.reminders.push({ id:rnd(), text, time, on:true });
    save(); closeAll(); renderRems(); SFX.pop(); toast("⏰ Recordatorio creado", true);
  });

  // actividad
  $("tx-prev").addEventListener("click", ()=>{ txMonth = monthStep(txMonth,-1); renderActivity(); SFX.tap(); });
  $("tx-next").addEventListener("click", ()=>{ const next = monthStep(txMonth,1); if(next > monthKey()) return; txMonth = next; renderActivity(); SFX.tap(); });
  $("export-btn").addEventListener("click", exportCSV);
  $("export-btn2").addEventListener("click", exportCSV);
  $("export-report").addEventListener("click", exportReport);

  // header
  $("notif-btn").addEventListener("click", async e => { e.stopPropagation();
    if(await askNotif()) notify("🔔 Notificaciones activadas", `Te aviso de rachas, metas y consejos, ${S.owner} 💚`); });
  $("sound-btn").addEventListener("click", ()=>{ S.sound = !S.sound; $("sound-toggle").checked = S.sound; save(); toast(S.sound ? "🔊 Sonidos on" : "🔇 Sonidos off"); if(S.sound) SFX.pop(); });
  $("sound-toggle").addEventListener("change", e => { S.sound = e.target.checked; save(); });

  document.querySelectorAll(".theme-opt").forEach(b => b.addEventListener("click", ()=>{ S.theme = b.dataset.theme; applyTheme(); save(); }));
  document.querySelectorAll("#accent-picker button").forEach(b => b.addEventListener("click", ()=>{ S.accent = b.dataset.accent; applyTheme(); save(); SFX.pop(); }));
  $("settings-currency").addEventListener("change", e=>{ S.currency = e.target.value; save(); applyTheme(); renderAll(); toast("Moneda: "+e.target.value); });

  // tasas editables
  function renderRates(){
    const r = $("rate-edit");
    r.innerHTML = Object.entries(S.rates).map(([k, v]) =>
      `<div>${k} → DOP<br><input type="number" data-rate="${k}" value="${v}" step="0.01" style="padding:9px 10px;margin-top:4px"></div>`).join("");
    r.onchange = e => { const k = e.target.dataset.rate; if(k){ S.rates[k] = parseFloat(e.target.value) || S.rates[k]; save(); convCalc(); toast("Tasa actualizada 💱"); } };
  }
  renderRates();

  // conversor
  ["input","change"].forEach(ev => $("conv-amount").addEventListener(ev, convCalc));
  $("conv-from").addEventListener("change", convCalc);
  $("conv-to").addEventListener("change", convCalc);
  $("conv-swap").addEventListener("click", convSwap);

  // presupuesto
  $("budget-edit").addEventListener("click", ()=>{
    $("budget-total").value = S.budget.total || "";
    const bc = $("budget-cats");
    bc.innerHTML = Object.entries(CATS).map(([k])=>
      `<div><span>${CATS[k]} ${k}</span><input type="number" data-bcat="${k}" value="${(S.budget.cats||{})[k]||""}" placeholder="0"></div>`).join("");
    $("m-budget").classList.remove("hidden");
  });
  $("budget-save").addEventListener("click", ()=>{
    S.budget.total = parseFloat($("budget-total").value) || 0;
    S.budget.cats = {};
    document.querySelectorAll("#budget-cats input").forEach(i => { if(i.value) S.budget.cats[i.dataset.bcat] = parseFloat(i.value)||0; });
    save(); closeAll(); renderBudget(); checkAch(); toast("💵 Presupuesto guardado", true); SFX.pop();
  });

  // notificaciones ajustes
  $("notif-daily").checked = S.notifs.daily; $("notif-daily").addEventListener("change", e => { S.notifs.daily = e.target.checked; save(); });
  $("notif-time").value = S.notifs.time; $("notif-time").addEventListener("change", e => { S.notifs.time = e.target.value; save(); toast("⏰ Diario a las "+e.target.value); });
  $("notif-week").checked = S.notifs.weekly; $("notif-week").addEventListener("change", e => { S.notifs.weekly = e.target.checked; save(); });
  $("notif-milestones").checked = S.notifs.milestones; $("notif-milestones").addEventListener("change", e => { S.notifs.milestones = e.target.checked; save(); });
  $("notif-test").addEventListener("click", async e => { e.stopPropagation();
    if(await askNotif()) notify("🔔 listNotif listo", "Así te avisaré: rachas 🔥, metas 🏆 y consejos 💚"); });

  let confirmR = 0;
  $("reset-btn").addEventListener("click", ()=>{
    if(confirmR++ === 0){ toast("Toca otra vez para borrar TODO ⚠️"); return; }
    localStorage.removeItem(KEY); localStorage.removeItem(KEY_OLD); location.reload();
  });

  // avatar
  const ag = $("avatar-grid");
  AVATARS.forEach(a=>{
    const b = document.createElement("button"); b.type = "button"; b.textContent = a;
    if(a === S.avatar) b.classList.add("selected");
    b.addEventListener("click", ()=>{
      S.avatar = a; save();
      $("avatar-edit").textContent = a; $("top-avatar").textContent = a;
      ag.querySelectorAll("button").forEach(x => x.classList.toggle("selected", x === b));
      closeAll(); SFX.pop(); toast("Avatar actualizado ✨");
    });
    ag.appendChild(b);
  });
  $("avatar-edit").addEventListener("click", ()=>$("m-avatar").classList.remove("hidden"));

  // FAB quick
  document.querySelectorAll("[data-quick]").forEach(b => b.addEventListener("click", ()=>{
    const q = b.dataset.quick; $("sheet-quick").classList.add("hidden");
    if(q === "goal") openGoalModal();
    else if(q === "money"){ pendingGoal = null; openMoney(); }
    else if(q === "income") openTx("income");
    else if(q === "expense") openTx("expense");
    else if(q === "calc"){ openCalc(dailySuggest().goal || null); }
    else if(q === "chat") openPanel("panel-chat");
  }));

  // modales
  $("goal-form").addEventListener("submit", submitGoal);
  $("goal-shared").addEventListener("change", e => $("goal-shared-wrap").classList.toggle("hidden", !e.target.checked));
  document.querySelectorAll("#m-money .money-quick button").forEach(b => b.addEventListener("click", ()=>{ $("money-amount").value = b.dataset.amt; SFX.tap(); }));
  $("money-confirm").addEventListener("click", ()=>addMoney(parseFloat($("money-amount").value)));
  $("withdraw-confirm").addEventListener("click", doWithdraw);
  document.querySelectorAll("#tx-kind .seg").forEach(s => s.addEventListener("click", ()=>openTx(s.dataset.kind)));
  $("tx-save").addEventListener("click", saveTx);
  $("calc-go").addEventListener("click", calcRun);
  $("chat-calc").addEventListener("click", ()=>{ closeAll(); openCalc(dailySuggest().goal || null); });
  $("widget-save").addEventListener("click", ()=>{
    const ds = dailySuggest();
    if(!ds.goal){ toast("Crea una meta primero 🎯"); return; }
    pendingGoal = ds.goal.id; openMoney();
  });
  $("chat-form").addEventListener("submit", e => { e.preventDefault(); chatSend(); });

  // v2.5: gran bolsa, cámara, grupo
  wirePhoto();
  $("gb-roundup").addEventListener("change", e=>{
    S.gb.roundUp = e.target.checked;
    if(e.target.checked) S.gb.goal = $("gb-goal").value || S.gb.goal;
    save(); renderGB();
    toast(e.target.checked ? "🪙 Redondeo automático activado" : "Redondeo desactivado");
  });
  $("gb-goal").addEventListener("change", e=>{ S.gb.goal = e.target.value; save(); });

  // v3 · fondo de emergencia / deudas / recurrentes
  $("ef-save").addEventListener("click", submitEF);
  $("debt-add").addEventListener("click", ()=>openDebtModal(null));
  $("recur-add").addEventListener("click", openRecurModal);
  $("recur-save").addEventListener("click", submitRecur);
  document.querySelectorAll("#debt-kind-seg .seg").forEach(s => s.addEventListener("click", ()=>{
    $("debt-kind").value = s.dataset.kind;
    document.querySelectorAll("#debt-kind-seg .seg").forEach(x => x.classList.toggle("active", x === s));
    $("debt-limit-wrap").classList.toggle("hidden", s.dataset.kind !== "card");
    SFX.tap();
  }));
  $("debt-form").addEventListener("submit", e=>{ e.preventDefault(); submitDebt(); });
  $("debt-kind").addEventListener("change", ()=>$("debt-limit-wrap").classList.toggle("hidden", $("debt-kind").value!=="card"));
  $("pay-save").addEventListener("click", submitPay);
  // v3 · simulador segmented
  document.querySelectorAll("#calc-seg .seg").forEach(s => s.addEventListener("click", ()=>{
    calMode = s.dataset.mode || "calc";
    document.querySelectorAll("#calc-seg .seg").forEach(x => x.classList.toggle("active", x === s));
    const sim = calMode === "sim";
    $("sim-wrap").classList.toggle("hidden", !sim);
    $("sim-target-wrap").classList.toggle("hidden", !sim);
    $("calc-goal-view").classList.toggle("hidden", sim);
    $("calc-big-label").textContent = sim ? "fecha de llegada" : "al día";
    SFX.tap();
  }));

  // v3 · informe PDF
  $("pdf-btn").addEventListener("click", aiMonthlyReport);

  // v3 · seguridad
  document.querySelectorAll("#keypad button").forEach(b => b.addEventListener("click", ()=>pinPress(b.dataset.key)));
  $("pin-save").addEventListener("click", ()=>{
    const np = $("pin-new").value;
    if(!/^\d{4}$/.test(np)){ SFX.err(); toast("El PIN debe tener exactamente 4 dígitos 💛"); return; }
    if(pinIsSet() && hashPin($("pin-old").value) !== S.security.pinHash){ SFX.err(); toast("El PIN actual no coincide ⚠️"); return; }
    S.security.pinHash = hashPin(np); save();
    $("pin-old").value = ""; $("pin-new").value = "";
    SFX.pop(); toast("🔒 PIN guardado — app protegida", true);
  });
  $("pin-del").addEventListener("click", ()=>{
    if(!pinIsSet()){ toast("No hay PIN puesto"); return; }
    if(confirm("¿Quitar el PIN? La app quedará sin bloqueo")){
      S.security.pinHash = ""; S.security.lock = false; save();
      applySecUI(); toast("PIN eliminado 🔓");
    }
  });
  $("lock-toggle").addEventListener("change", e=>{
    if(!pinIsSet()){ e.target.checked = false; SFX.err(); toast("Primero elige un PIN de 4 dígitos 🔒"); return; }
    S.security.lock = e.target.checked; save();
    if(S.security.lock){ lockNow(); toast("Bloqueo activo 🔐"); }
    else toast("Bloqueo desactivado");
  });
  $("priv-toggle").addEventListener("change", e=>{ S.security.privacy = e.target.checked; save(); applyPrivacy(); });
  $("lock-btn").addEventListener("click", ()=>{ if(pinIsSet()) lockNow(); else { toast("Configura un PIN en Ajustes 🔒"); openPanel("panel-settings"); } });

  // v3 · respaldos
  $("backup-export").addEventListener("click", exportBackup);
  $("backup-import").addEventListener("click", ()=>$("backup-file").click());
  $("backup-file").addEventListener("change", e=>{ const f = e.target.files?.[0]; if(f) importBackup(f); e.target.value = ""; });

  // v3 · avatar con foto
  wireAvatarPhoto();
}

/* ================== SALUDO ================== */
function updateGreeting(){
  const h = new Date().getHours();
  const p = h < 5 ? "¿Aún despierto?" : h < 12 ? "Buenos días" : h < 19 ? "Buenas noches".replace("noches","tardes") : "Buenas noches";
  $("greeting").textContent = `${p}, ${S.owner}`;
}

/* ================== START ================== */
function start(){
  document.body.classList.remove("hidden");
  $("welcome").classList.add("hidden");
  $("app").classList.remove("hidden");
  $("settings-name").value = S.owner;
  updateGreeting(); applyTheme(); wire();
  renderAll();
  go("home");
  convCalc();
  bubble(`¡Hola, ${S.owner}! 👩‍💻 Soy tu IA financiera: <b>${fmt(totalSaved())}</b> ahorrados y racha de <b>${streakCalc()}</b> días 🔥 Pregúntame por tus metas, presupuesto o cómo ahorrar.`);
  setTimeout(checkAch, 1200);
  lockCheck();
}
/* bloqueo por PIN al abrir la app */
function lockCheck(){
  if(!pinIsSet() || !S.security.lock) return;
  let u = null;
  try{ u = sessionStorage.getItem("ahorra_unlocked"); }catch{}
  if(u !== "1"){ pinEntry = ""; renderPinDots(); $("pin-wrong").classList.add("hidden"); $("m-lock").classList.remove("hidden"); }
}
/* refleja el estado de seguridad en Ajustes */
function applySecUI(){
  const li = $("lock-toggle"); if(li){ li.checked = !!S.security.lock; }
  const pt = $("priv-toggle"); if(pt){ pt.checked = !!S.security.privacy; }
  const ph = $("pin-help"); if(ph) ph.textContent = pinIsSet() ? "PIN configurado ✅" : "Sin PIN — configura uno para bloquear la app";
}

document.addEventListener("DOMContentLoaded", ()=>{
  load();
  document.body.classList.add("ready");
  if(S.owner){ start(); }
  else {
    document.getElementById("app").classList.add("hidden");
    document.getElementById("welcome").classList.remove("hidden");
    wire();
    setTimeout(()=>$("name-input")?.focus?.(), 900);
  }
  // refresco vivo del dashboard
  setInterval(()=>{ if(document.hasFocus() && curView==="home") renderDashboard(); }, 60000);
});
["pointerdown","touchstart"].forEach(ev => document.addEventListener(ev, ()=>ac(), { once:true, passive:true }));
if("serviceWorker" in navigator) window.addEventListener("load", ()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
})();

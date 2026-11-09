/* ==================================================================
   AHORRA+ v2 · Ahorro premium
   Dashboard · Metas · Calendario · Historial · Estadísticas
   Presupuesto · Logros & rachas · Conversor · IA financiera
   Exportación · Notificaciones personalizadas
   ================================================================== */
(() => {
"use strict";

/* ================== ESTADO Y MIGRACIÓN ================== */
const KEY = "ahorra_v2", KEY_OLD = "ahorra_plus_v1";
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
  if(S) return;
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
    exportedOnce:false, usedConv:false,
  };
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

const daysOf = g => g.deadline ? Math.max(1, Math.ceil((new Date(g.deadline+"T12:00") - new Date(today()+"T12:00"))/86400000)) : 30;
function dailySuggest(){
  const act = S.goals.filter(g=>!g.done);
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
  if(view === "stats") drawStatsCharts();
  if(view === "profile") renderProfile();
}

/* ================== CIERRE GLOBAL ================== */
function closeAll(){
  ["panel-activity","panel-chat","panel-settings"].forEach(p => $(p).classList.remove("open"));
  ["m-goal","m-money","m-withdraw","m-tx","m-calc","m-budget","m-rem","m-avatar"].forEach(m => $(m).classList.add("hidden"));
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
  const max = Math.max(...vals, 1), pad = 10;
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
  if(!total){
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
  c.fillStyle = cssVar("--text"); c.font = "800 15px -apple-system"; c.textAlign = "center";
  c.fillText(fmt(sel.value), cx, cy+1);
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
  $("g-count").textContent = S.goals.filter(g=>!g.done).length;
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
  const act = S.goals.filter(g=>!g.done);
  if(!S.goals.length) pv.innerHTML = `<div class="empty"><b>🎯</b>Crea tu primera meta con el botón ＋</div>`;
  else if(!act.length) pv.innerHTML = `<div class="empty"><b>🏆</b>¡Todas tus metas cumplidas!<br>Facturamos una nueva 💚</div>`;
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
  if(!S.goals.length) list.innerHTML = `<div class="empty"><b>🎯</b>Sin metas aún.<br> Usa el ＋ para crear la primera</div>`;
  S.goals.forEach(g => list.appendChild(goalCardHTML(g)));
  const gb = $("goal-bars"); gb.innerHTML = "";
  S.goals.forEach(g=>{
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
      T = S.goals.filter(x=>!x.done)[s.selectedIndex];
      pendingGoal = T.id; $("money-title").innerHTML = `${T.emoji} ${esc(T.name)}`;
      const m2 = [...new Set([S.owner, ...(T.members||[])])];
      if(T.shared && m2.length>1){ $("money-member").classList.remove("hidden"); $("money-member-sel").innerHTML = m2.map(m=>`<option>${esc(m)}</option>`).join(""); }
      else $("money-member").classList.add("hidden");
    });
    return s;
  })();
  if(!gs.parentNode) $("money-title").after(gs);
  const todo = S.goals.filter(x=>!x.done);
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
  else { S.expenses.push({ id:rnd(), name, amt:+amt, cat:$("tx-cat-chips").dataset.val, d:today() }); toast(`🔴 Gasto −${fmt(amt)} en ${$("tx-cat-chips").dataset.val}`); }
  save(); closeAll(); renderAll(); checkAch(); SFX.money();
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
    const saved = S.goals.reduce((a,g)=>a+(g.history||[]).filter(h=>h.d===k && h.amt>0).reduce((x,h)=>x+h.amt,0),0);
    const e = document.createElement("div");
    e.className = "cal-day" + (saved ? " saved" : "") + (k === today() ? " today" : k > today() ? " future" : " past");
    e.textContent = i;
    if(saved){ const dot = document.createElement("i"); dot.style.cssText = "position:absolute;bottom:3px;width:4px;height:4px;border-radius:50%;background:#04120c"; e.appendChild(dot); }
    e.addEventListener("click", ()=>{
      if(saved) toast(`${dfmt(k)}: ahorraste ${fmt(saved)} 🐷`);
      else if(k === today()){ pendingGoal = (dailySuggest().goal||{}).id; openMoney(); }
      else toast("Sin depósitos ese día");
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
  if(cv){ $("bar-legend-total").textContent = "Total " + fmt(total);
    drawBars(cv, vals, labels, i => `Semana ${labels[i]}: <span style="color:var(--ac)">${fmt(vals[i])}</span>`); }
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
    return `<div class="ach ${un?"unlocked":""}"><b>${a.e}</b><span>${a.name}</span></div>`;
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
  const act = S.goals.filter(x=>!x.done);
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
function aiReply(qRaw){
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

/* ================== RENDER TOTAL ================== */
function renderAll(){
  renderDashboard(); renderGoals(); renderCalendar(); renderRems();
  renderActivity(); renderBudget(); renderProfile();
  drawStatsCharts();
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
    ["goals","cal","rem"].forEach(k => $("seg-"+k).classList.toggle("hidden", k !== s.dataset.seg));
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

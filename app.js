/* ================================================================
   AHORRA+ · Ahorro y Metas — app.js
   Sonidos WebAudio · Asistente de IA · Notificaciones · Blanco/Negro
   ================================================================ */
(() => {
"use strict";

/* ---------------- Estado ---------------- */
const DEFAULTS = {
  owner: null,
  theme: "auto",            // light | dark | auto
  accent: "#e8b34b",
  sound: true,
  goals: [],                // {id, name, emoji, total, saved, deadline, done, history:[{d, amt}]}
  lastNotifDay: null,
  lastCheckDay: null,
};
let S = load();

function load() {
  try { return { ...structuredClone(DEFAULTS), ...(JSON.parse(localStorage.getItem("ahorra_plus_v1") || "{}")) }; }
  catch { return structuredClone(DEFAULTS); }
}
function save() { localStorage.setItem("ahorra_plus_v1", JSON.stringify(S)); }

const $ = (id) => document.getElementById(id);
const fmt = (n) => "$" + Number(n || 0).toLocaleString("es-MX", { maximumFractionDigits: 0 });
const today = () => new Date().toISOString().slice(0, 10);
const daysUntil = (d) => d ? Math.ceil((new Date(d + "T12:00") - new Date(today() + "T12:00")) / 86400000) : null;

/* ---------------- Sonidos (WebAudio: clic, ding, meta, error) ---------------- */
let AC = null;
function ac() {
  if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  if (AC.state === "suspended") AC.resume();
  return AC;
}
function tone({ f = 600, f2, t = "sine", d = 0.08, v = 0.12, delay = 0 }) {
  if (!S.sound) return;
  try {
    const a = ac(), o = a.createOscillator(), g = a.createGain();
    const now = a.currentTime + delay;
    o.type = t; o.frequency.setValueAtTime(f, now);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + d);
    g.gain.setValueAtTime(v, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + d);
    o.connect(g); g.connect(a.destination);
    o.start(now); o.stop(now + d + 0.02);
  } catch {}
}
const SFX = {
  click() { tone({ f: 880, f2: 620, t: "triangle", d: 0.06, v: 0.08 }); },
  tap()   { tone({ f: 520, d: 0.05, v: 0.07, t: "sine" }); },
  money() { [0, 0.08, 0.16].forEach((dl, i) => tone({ f: [660, 830, 1050][i], d: 0.14, v: 0.1, t: "triangle", delay: dl })); },
  victory() {
    [523, 659, 784, 1047].forEach((f, i) => tone({ f, d: 0.22, v: 0.12, t: "triangle", delay: i * 0.12 }));
    [523, 659, 784, 1047].forEach((f, i) => tone({ f: f / 2, d: 0.25, v: 0.05, t: "sine", delay: i * 0.12 }));
  },
  error()  { tone({ f: 240, f2: 140, t: "square", d: 0.16, v: 0.05 }); },
  pop()    { tone({ f: 300, f2: 700, t: "sine", d: 0.09, v: 0.09 }); },
};

// Sonido de clic global en botones/enlaces
function playClick() { S.sound ? SFX.click() : null; }
document.addEventListener("click", (e) => {
  const el = e.target.closest("button, a, .tab, .btn, select");
  if (el) playClick();
});

/* ---------------- Tema (blanco/negro) ---------------- */
const mq = matchMedia("(prefers-color-scheme: dark)");
function applyTheme() {
  const dark = S.theme === "dark" || (S.theme === "auto" && mq.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]').content = dark ? "#0a0a0c" : "#f5f5f7";
  document.querySelectorAll(".theme-opt").forEach(b => b.classList.toggle("selected", b.dataset.theme === S.theme));
}
mq.addEventListener("change", applyTheme);
function applyAccent() {
  document.documentElement.style.setProperty("--accent", S.accent);
  document.querySelectorAll("#accent-picker button").forEach(b =>
    b.classList.toggle("selected", b.dataset.accent === S.accent));
  const fav = document.createElement("canvas");
  // Nota: el <link> de iconos usa PNG fijo, el acento solo se ve en la UI.
}

/* ---------------- Saludo + nombre ---------------- */
function greet() {
  const h = new Date().getHours();
  const part = h < 6 ? "¿Aún despierto?" : h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  return `${part}, ${S.owner}`;
}
function updateGreeting() {
  const initial = (S.owner || "").trim().charAt(0).toUpperCase() || "🙂";
  $("greeting-avatar").textContent = /^\p{Extended_Pictographic}$/u.test(initial) ? initial : initial || "🙂";
  $("greeting").textContent = greet();
}

/* ---------------- Metas ---------------- */
const GOAL_EMOJIS = ["🎯", "📱", "💻", "🚗", "✈️", "🏠", "🎓", "💍", "🎮", " Guitarra".trim(), "🏋️", "📷", "🎸", "⌚", "🎁", "🏥", "🛒", "👔"];
let editingId = null, pendingGoalId = null;

function renderGoals() {
  const list = $("goals-list");
  const total = S.goals.reduce((a, g) => a + Number(g.saved || 0), 0);
  $("total-savings").textContent = fmt(total);
  $("goals-count").textContent = S.goals.filter(g => !g.done).length;

  // % ahorrado esta semana
  const weekAgo = Date.now() - 7 * 86400000;
  const wk = S.goals.flatMap(g => g.history || []).filter(h => new Date(h.d + "T12:00") >= weekAgo)
    .reduce((a, h) => a + h.amt, 0);
  const goalTotals = S.goals.reduce((a, g) => a + Number(g.total || 0), 0) || 1;
  $("week-progress").textContent = Math.min(100, Math.round(wk / goalTotals * 100));

  if (!S.goals.length) {
    list.innerHTML = `<div class="empty-goals"><span>🐷</span>Aún no tienes metas.<br>Crea tu primera con el botón ＋</div>`;
    return;
  }
  list.innerHTML = "";
  for (const g of [...S.goals].sort((a, b) => Number(a.done) - Number(b.done) || (a.id?.slice(-6) < b.id?.slice(-6) ? -1 : 1))) {
    const pct = Math.min(100, Math.round((g.saved / Math.max(g.total, 1)) * 100));
    const dl = daysUntil(g.deadline);
    const perDay = dl && dl > 1 ? fmt(Math.ceil((g.total - g.saved) / dl)) : null;
    const card = document.createElement("div");
    card.className = "goal-card";
    card.innerHTML = `
      <div class="goal-head">
        <div><span class="goal-emoji">${g.emoji || "🎯"}</span>
          <div class="goal-name">${esc(g.name)}</div></div>
        <button class="goal-menu" data-menu="${g.id}" title="Opciones">${g.done ? "✅" : "⋯"}</button>
      </div>
      <div class="goal-amounts">
        <span class="goal-saved">${fmt(g.saved)}</span>
        <span class="goal-total">de ${fmt(g.total)}</span>
      </div>
      <div class="goal-bar"><div class="goal-fill" style="width:${pct}%"></div></div>
      <div class="goal-foot">
        <span class="goal-pct">${pct}%${g.done ? " ¡Logrado! 🎉" : ""}</span>
        <span class="goal-date">${g.deadline ? (dl > 0 ? `${dl} días` : "¡Venció!") : ""}${perDay && !g.done && dl > 0 ? ` · ${perDay}/día para lograrlo` : ""}</span>
      </div>
      ${g.done ? `<div class="goal-done-badge">🏆 Meta cumplida — ¡lo lograste!</div>` : `
      <div class="goal-actions">
        <button class="btn btn-small btn-add-money" data-add="${g.id}">＋ Agregar dinero</button>
        <button class="btn btn-small btn-done" data-edit="${g.id}">✏️ Editar</button>
      </div>`}`;
    list.appendChild(card);
  }
}

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* ---------------- IA local (asistente) ---------------- */
function busiestInsight() {
  const total = S.goals.reduce((a, g) => a + Number(g.saved || 0), 0);
  const pending = S.goals.filter(g => !g.done);
  const nearest = pending[0] ? [...pending].sort((a, b) => (daysUntil(b.deadline) ?? Infinity) - (daysUntil(a.deadline) ?? Infinity))[0] : null;
  const lastDeposit = S.goals.flatMap(g => g.history || []).sort((a, b) => b.d.localeCompare(a.d))[0];
  const daysIdle = lastDeposit ? Math.round((Date.now() - new Date(lastDeposit.d + "T12:00")) / 86400000) : null;
  return { total, pending, nearest, lastDeposit, daysIdle };
}

function aiResponse(q) {
  q = (q || "").toLowerCase().normalize("NFC");
  const ins = busiestInsight();

  if (/hola|buenas|hey/.test(q) && q.length < 20)
    return `¡Hola, ${S.owner}! 👋 ¿En qué te ayudo a ahorrar hoy?`;
  if (/regla|50\/30\/20/.test(q))
    return `<b>La regla 50/30/20</b>: 50% para lo necesario, 30% para gustos y <b>20% directo a tus metas</b>. Cuando te pague, saca el ahorro primero 🐷`;
  if (/consejo|tip|idea|cómo|como/.test(q) || /^ahor/.test(q)) {
    const tips = [
      `Retira tu ahorro el <b>mismo día que te pagan</b>: lo que no ves, no lo gastas 🐷`,
      `Prueba la regla del <b>52</b>: cada semana guarda $50 más $1 que la anterior… en un año son ~$7,000 📈`,
      `Antes de un antojo de ${fmt(200)}, espera 24 horas. El 60% de las veces ya no lo querrás ⏳`,
      `Guarda tus billetes "feos" (rotos, usados) en la alcancía. Nunca los gastas 😄`,
      `Solo hoy: cada vez que digas "no" a un capricho, mueve ${fmt(20)} a tu meta. Duévelo 😎`,
    ];
    return tips[Math.floor(Math.random() * tips.length)];
  }
  if (/meta|progreso|avance/.test(q)) {
    if (!ins.pending.length) return `No tienes metas activas. ¡Crea una con el botón ＋ y la seguimos juntos! 🚀`;
    const g = ins.pending[0];
    const pct = Math.round(g.saved / Math.max(g.total, 1) * 100);
    return `Tu meta <b>${esc(g.emoji || "🎯")} ${esc(g.name)}</b> va por el <b>${pct}%</b> (${fmt(g.saved)} de ${fmt(g.total)}). ${pct >= 50 ? "Vas por excelente camino 💪" : "Un empujoncito y la arremetes 🚀"}`;
  }
  if (/cuánto|cuanto|total/.test(q))
    return `Tu ahorro total es <b>${fmt(ins.total)}</b> entre ${S.goals.length} metas. ${ins.daysIdle !== null ? `Tu último depósito fue hace ${ins.daysIdle} días.` : "¡Carga tus primeras pilas!"} 💰`;
  if (/hola de nuevo/.test(q)) return `¡Aquí seguiré! Tu banquillo de confianza 🐷`;
  if (/gracias/.test(q)) return `¡Para eso estoy! Sigamos llenando esa alcancía 🐷💛`;
  if (/adios|bye|nos vemos/.test(q)) return `¡Nos vemos, ${S.owner}! Yo me quedo contando tus moneditas 🪙`;
  return `No entendí del todo 🤔 — pero sí sé esto: <b>ahorra primero de tu pago</b>, no de lo que sobre. Pregúntame por tus metas, consejos o tu progreso.`;
}

/* ---------------- IA banner / chat ---------------- */
function setAI(html) { $("ai-message").innerHTML = html; }

function addBubble(html, me) {
  const c = $("chat");
  const b = document.createElement("div");
  b.className = "bubble " + (me ? "me" : "ai");
  b.innerHTML = html;
  c.appendChild(b);
  c.scrollTop = c.scrollHeight;
}

function pushAI(html, { speak = true, banner = true } = {}) {
  if (banner) setAI(html);
  if (!banner) addBubble(html, false);
  else if (!$("panel-ia").classList.contains("hidden")) addBubble(html, false);
  if (speak) SFX.tap();
}

/* ---------------- Notificaciones (PWA en iOS) ---------------- */
async function askNotifications() {
  if (!("Notification" in window)) { toast("Tu navegador no soporta notificaciones 😕"); return false; }
  let perm = Notification.permission;
  if (perm === "prompt") perm = await Notification.requestPermission();
  if (perm !== "granted") { toast(perm === "denied" ? "Permisos bloqueados: actívalos en Ajustes 📱" : "Sin permiso aún 🔕"); return false; }
  toast("¡Notificaciones activadas! 🔔");
  return true;
}

function notifyLocal(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "show-notification", title, body });
    return true;
  }
  try { new Notification(title, { body, icon: "./icons/icon-192.png" }); return true; } catch { return false; }
}

/* Chequeo diario de la IA (al abrir la app) */
function dailyCheck() {
  const d = today();
  if (S.lastCheckDay === d) return;
  S.lastCheckDay = d;
  const ins = busiestInsight();
  let msg = null;
  if (!S.goals.length) msg = `¡Buen${new Date().getHours() < 12 ? "os días" : "os"}, ${S.owner}! ¿Creamos una meta nueva hoy? 🎯`;
  else if (ins.daysIdle === null || ins.daysIdle >= 3) {
    const dias = ins.daysIdle ?? "algunos";
    msg = `${S.owner}, llevas ${dias} días sin ahorrar. Pequeño paso: ¿${fmt(50)} a ${ins.nearest ? esc(ins.nearest.name) : "tu meta"}? 🐷`;
    notifyLocal("Ahorra+ · Tu IA te extraña 🐷", msg);
  }
  const wkProgress = Math.round((ins.pending.reduce((a, g) => a + (g.history || []).filter(h => (Date.now() - new Date(h.d + "T12:00")) < 7 * 86400000).reduce((x, h) => x + h.amt, 0), 0)) / 500);
  if (wkProgress >= 5) notifyLocal("¡Buen ritmo! 🎉", `Esta semana moviste dinero varias veces. ¡Sigue así, ${S.owner}!`);
  save();
}

/* ---------------- Confeti ---------------- */
function confetti(count = 80) {
  const c = document.createElement("div");
  c.className = "confetti";
  const colors = [S.accent, "#ffffff", "#111111", "#f5d67b", "#888"];
  for (let i = 0; i < count; i++) {
    const p = document.createElement("i");
    p.style.left = Math.random() * 100 + "vw";
    p.style.background = colors[i % colors.length];
    p.style.setProperty("--t", (2.2 + Math.random() * 1.6) + "s");
    p.style.setProperty("--r", (Math.random() * 720 - 360) + "deg");
    p.style.animationDelay = Math.random() * 0.5 + "s";
    c.appendChild(p);
  }
  document.body.appendChild(c);
  setTimeout(() => c.remove(), 4000);
}

/* ---------------- Toast ---------------- */
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.innerHTML = msg;
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 2600);
}

/* ---------------- Modal: meta ---------------- */
function openGoalModal(goal) {
  editingId = goal?.id || null;
  $("modal-title").textContent = editingId ? "Editar meta" : "Nueva meta";
  $("goal-name").value = goal?.name || "";
  $("goal-total").value = goal?.total || "";
  $("goal-saved").value = goal?.saved || 0;
  $("goal-date").value = goal?.deadline || "";
  $("modal").classList.remove("hidden");
  setTimeout(() => $("goal-name").focus(), 100);
}
function closeModals() { $("modal").classList.add("hidden"); $("add-money-modal").classList.add("hidden"); }

/* ---------------- Eventos ---------------- */
function wire() {
  // Welcome
  $("welcome-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("name-input").value.trim();
    if (!name) { toast("Escribe tu nombre 💛"); return; }
    S.owner = name; save();
    startApp();
    SFX.victory();
  });

  // Header
  $("theme-btn").addEventListener("click", () => {
    const order = ["auto", "light", "dark"];
    S.theme = order[(order.indexOf(S.theme) + 1) % 3];
    applyTheme(); applyAccent(); save();
    toast(`Tema: ${{ light: "☀️ Blanco", dark: "🌙 Negro", auto: "✨ Automático" }[S.theme]}`);
  });
  $("sound-btn").addEventListener("click", () => {
    S.sound = !S.sound; $("sound-toggle").checked = S.sound; save();
    toast(S.sound ? "🔊 Sonidos activados" : "🔇 Sonidos apagados");
    if (S.sound) SFX.pop();
  });
  $("notif-btn").addEventListener("click", async (e) => {
    e.stopPropagation();
    const ok = await askNotifications();
    if (ok) notifyLocal("¡Hola! 👋", `Notificaciones de Ahorra+ listas. Te avisaré de tus metas, ${S.owner}.`);
  });
  $("toast-btn").addEventListener("click", () => {
    pushAI(aiResponse("consejo"));
  });

  // Tabs
  document.querySelectorAll(".tab").forEach(t => {
    t.addEventListener("click", () => {
      const tab = t.dataset.tab;
      if (!tab) return;
      document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x.dataset.tab === tab));
      closePanels();
      if (tab === "ia") $("panel-ia").classList.remove("hidden");
      if (tab === "ajustes") $("panel-ajustes").classList.remove("hidden");
      SFX.tap();
    });
  });
  $("fab-add").addEventListener("click", () => openGoalModal());
  $("add-goal-btn").addEventListener("click", () => openGoalModal());

  function closePanels() { ["ia", "ajustes"].forEach(p => $(`panel-${p}`).classList.add("hidden")); }

  // Goal list
  $("goals-list").addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    const edit = e.target.closest("[data-edit]");
    if (add) {
      pendingGoalId = add.dataset.add;
      const g = S.goals.find(x => x.id === pendingGoalId);
      $("money-title").textContent = `Agregar a ${g.emoji || ""} ${g.name}`;
      $("money-amount").value = "";
      $("add-money-modal").classList.remove("hidden");
    } else if (edit) {
      openGoalModal(S.goals.find(x => x.id === edit.dataset.edit));
    }
  });

  // Modal meta
  $("goal-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("goal-name").value.trim();
    const total = parseFloat($("goal-total").value);
    const saved = parseFloat($("goal-saved").value) || 0;
    const deadline = $("goal-date").value || null;
    if (!name || !total) { SFX.error(); toast("Ponle nombre y cantidad 💛"); return; }
    if (editingId) {
      const g = S.goals.find(x => x.id === editingId);
      Object.assign(g, { name, total, saved, deadline: deadline });
      toast("Meta actualizada ✏️");
    } else {
      S.goals.push({ id: crypto.randomUUID().slice(-9), name, emoji: emojiFor(name), total, saved, deadline, done: saved >= total, history: saved ? [{ d: today(), amt: saved }] : [] });
      toast(`¡Meta "${name}" creada! 🎯`);
      if (saved > 0) SFX.money();
    }
    save(); renderGoals(); closeModals();
  });
  $("modal-cancel").addEventListener("click", closeModals);
  $("money-cancel").addEventListener("click", closeModals);

  // Modal dinero
  document.querySelectorAll(".money-quick button").forEach(b =>
    b.addEventListener("click", () => { $("money-amount").value = b.dataset.amt; SFX.tap(); }));
  $("money-confirm").addEventListener("click", () => {
    const amt = parseFloat($("money-amount").value);
    const g = S.goals.find(x => x.id === pendingGoalId);
    if (!g || !amt || amt <= 0) { SFX.error(); toast("Escribe una cantidad válida 💰"); return; }
    g.saved = (Number(g.saved) || 0) + amt;
    g.history = g.history || [];
    g.history.push({ d: today(), amt });
    if (g.saved >= g.total && !g.done) {
      g.done = true;
      SFX.victory();
      confetti(120);
      toast(`🏆 ¡Completaste ${g.name}!`);
      notifyLocal("🏆 ¡Meta cumplida!", `${S.owner}, ¡lograste ${g.name}! Orgullo total 🎉`);
    } else {
      SFX.money();
      toast(`+${fmt(amt)} hacia ${g.name} 💰`);
      notifyLocal("💰 Buen paso", `Agregaste ${fmt(amt)} a ${g.name}. ¡Sigue así, ${S.owner}!`);
    }
    save(); renderGoals(); closeModals();
  });

  // Chat
$("panel-ia").addEventListener("click", (e) => {
  if (e.target.closest("#chat-mic")) {
    const resp = aiResponse("consejo");
    addBubble(resp, false);
    setAI(resp);
    toast("💡 Consejo de tu IA");
  }
});
  $("chat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("chat-input").value.trim();
    if (!q) return;
    addBubble(esc(q), true);
    $("chat-input").value = "";
    const typing = document.createElement("div");
    typing.className = "bubble ai typing-dots";
    typing.innerHTML = "<span></span><span></span><span></span>";
    $("chat").appendChild(typing);
    setTimeout(() => { typing.remove(); addBubble(aiResponse(q), false); SFX.tap(); }, 700 + Math.random() * 600);
  });

  // Ajustes
  $("save-name").addEventListener("click", () => {
    const n = $("settings-name").value.trim();
    if (n) { S.owner = n; save(); updateGreeting(); toast(`¡Listo, ${n}! 💛`); }
  });
  document.querySelectorAll(".theme-opt").forEach(b => b.addEventListener("click", () => {
    S.theme = b.dataset.theme; applyTheme(); save();
  }));
  document.querySelectorAll("#accent-picker button").forEach(b => b.addEventListener("click", () => {
    S.accent = b.dataset.accent; applyAccent(); save(); SFX.pop();
  }));
  $("sound-toggle").addEventListener("change", (e) => { S.sound = e.target.checked; save(); });
  $("enable-notifs").addEventListener("click", async () => { if (await askNotifications()) notifyLocal("Notificaciones activas 🔔", `Te cuidaré tus metas, ${S.owner}.`); });
  let confirmReset = 0;
  $("reset-btn").addEventListener("click", () => {
    if (confirmReset++ === 0) { toast("¿Seguro? Toca 2 veces para borrar TODO ⚠️"); return; }
    localStorage.removeItem("ahorra_plus_v1");
    location.reload();
  });
}

/* ---------------- Emoji automático para la meta ---------------- */
const EMOJI_MAP = { iphone: "📱", "celular": "📱", móvil: "📱", laptop: "💻", compu: "💻", pc: "💻", carro: "🚗", auto: "🚗", moto: "🏍️", viaje: "✈️", vaca: "🏖️", casa: "🏠", renta: "🏠", uni: "🎓", escuela: "🎓", boda: "💍", anillo: "💍", juego: "🎮", switch: "🎮", reloj: "⌚", regalo: "🎁", dentista: "🦷", doctor: "🏥", ropa: "👕", zapatos: "👟", guitarra: "🎸", bici: "🚲" };
function emojiFor(name) {
  const n = name.toLowerCase();
  for (const k in EMOJI_MAP) if (n.includes(k)) return EMOJI_MAP[k];
  return "🎯";
}

/* ---------------- Arranque ---------------- */
function startApp() {
  $("welcome").classList.add("hidden");
  $("app").classList.remove("hidden");
  $("settings-name").value = S.owner;
  $("sound-toggle").checked = S.sound;
  updateGreeting();
  applyTheme(); applyAccent();
  renderGoals();
  dailyCheck();
  setAI(aiResponse("hola"));
  addBubble(aiResponse("hola"), false);
  setTimeout(() => pushAI(aiNudge(), { banner: true, speak: false }), 1800);
}

function aiNudge() {
  const ins = busiestInsight();
  if (!S.goals.length) return `¿En qué te gusta gastar, ${S.owner}? Pongámosle <b>una meta</b> a eso 🎯`;
  const g = ins.pending[0];
  if (!g) return `¡Completaste todas tus metas! ¿Creamos una nueva? 🏆`;
  const pct = Math.round(g.saved / Math.max(g.total, 1) * 100);
  if (ins.daysIdle >= 3) return `${S.owner}, ${ins.daysIdle} días sin ahorrar… ¿movemos <b>${fmt(50)}</b> a ${esc(g.emoji || "")} ${esc(g.name)} hoy? 🐷`;
  return `${esc(g.name)} va por el <b>${pct}%</b>. ${pct > 40 ? "Vas muy bien 💪" : "Cada bit suma 🚀"} ¿Agregamos algo hoy?`;
}

/* ---------------- Init ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  // ocultar preloader (no hay) — aplicar tema ya
  applyTheme(); applyAccent();
  wire();
  if (S.owner) startApp();
  else setTimeout(() => $("name-input").focus(), 400);
});

// iOS: desbloquear audio en primer toque
["pointerdown", "touchstart"].forEach(ev =>
  document.addEventListener(ev, () => ac(), { once: true, passive: true }));

// Registrar SW PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
})();

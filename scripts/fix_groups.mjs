import { readFileSync, writeFileSync } from "fs";
let t = readFileSync("app_clean.tmp.js", "utf8");
const before = t.length;

// 1) quitar módulo de grupos (entre sus marcadores)
const s = t.indexOf("/* ================== GRUPO EN VIVO");
const e = t.indexOf("/* ================== RENDER TOTAL");
if (s < 0 || e < 0 || e <= s) { console.error("no se encontró el bloque de grupos"); process.exit(1); }
t = t.slice(0, s) + t.slice(e);

// 2) quitar los bindings de grupo en wire()
const wireBlock = `  $("group-open").addEventListener("click", ()=>{
    if((S.gb.code||"") && !$("gp-code").value.trim()) $("gp-code").value = S.gb.code;
    openPanel("panel-group");
  });
  $("gp-join").addEventListener("click", gpJoin);
  $("gp-leave").addEventListener("click", gpLeave);
  $("gp-code").addEventListener("keydown", e=>{ if(e.key === "Enter"){ e.preventDefault(); gpJoin(); } });
  $("gp-msgform").addEventListener("submit", e=>{
    e.preventDefault();
    const t = $("gp-input").value.trim(); if(!t) return;
    gpBubble(S.owner || "Yo", t, true);
    if(GP){ try{ GP.sendMsg({ n:S.owner || "Yo", t }); }catch{} }
    $("gp-input").value = "";
  });
`;
if (!t.includes(wireBlock)) { console.error("no se encontró el bloque de wire de grupo"); process.exit(1); }
t = t.replace(wireBlock, "");

// 3) renombrar la IA núcleo
const oldDecl = "function aiReply(qRaw){\n  const q = (qRaw||\"\").toLowerCase(), A = ctx();";
if (!t.includes(oldDecl)) { console.error("no se encontró la declaración de aiReply"); process.exit(1); }
t = t.replace(oldDecl, "function aiReplyCore(qRaw){\n  const q = (qRaw||\"\").toLowerCase(), A = ctx();");

writeFileSync("app_clean.tmp.js", t, "utf8");
console.log("OK. antes:", before, "después:", t.length);

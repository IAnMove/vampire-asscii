// Autojuego dentro de la pagina: mide la curva de dificultad de una partida real.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromePath } from "./chrome.mjs";
// Las capturas van junto a este fichero; el perfil de Chromium, al temporal del sistema.
const OUT = new URL("capturas/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const PERFIL = join(tmpdir(), "vampire-asscii-chrome-2");
const JUEGO = new URL("../index.html", import.meta.url).href;
const CHROME = chromePath();
const DURACION = Number(process.argv[2] || 180);   // segundos reales de partida
const PUERTO = 9336;

const proc = spawn(CHROME, ["--headless=new",`--remote-debugging-port=${PUERTO}`,"--no-sandbox","--disable-gpu",
  "--hide-scrollbars","--window-size=1400,860","--force-device-scale-factor=1",`--user-data-dir=${PERFIL}`,"about:blank"],
  { stdio:["ignore","pipe","pipe"] });
proc.stderr.on("data",()=>{});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl;
for (let i=0;i<60;i++){ try{ wsUrl=(await (await fetch(`http://127.0.0.1:${PUERTO}/json/version`)).json()).webSocketDebuggerUrl; break;}catch{await sleep(250);} }
const sock = new WebSocket(wsUrl); await new Promise(r=>sock.addEventListener("open",r));
let id=0; const pend=new Map(), eventos=[];
sock.addEventListener("message",ev=>{const m=JSON.parse(ev.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);} else if(m.method) eventos.push(m);});
const cmd=(method,params={},sessionId)=>new Promise(res=>{const i=++id;pend.set(i,res);sock.send(JSON.stringify({id:i,method,params,sessionId}));});
const {result:t}=await cmd("Target.createTarget",{url:"about:blank"});
const {result:s}=await cmd("Target.attachToTarget",{targetId:t.targetId,flatten:true}); const sid=s.sessionId;
await cmd("Runtime.enable",{},sid); await cmd("Log.enable",{},sid); await cmd("Page.enable",{},sid);
await cmd("Page.navigate",{url:JUEGO},sid);
await sleep(1200);
const ev = async e => (await cmd("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true},sid)).result?.result?.value;
const foto = async n => { const r = await cmd("Page.captureScreenshot",{format:"png"},sid); writeFileSync(`${OUT}/${n}.png`, Buffer.from(r.result.data,"base64")); };

await ev(`
manejarTecla(" ");
window.__log = [];
window.__bot = setInterval(() => {
  if (estado === "nivel") {
    // Prioriza armas nuevas; si no, lo primero de la lista.
    // Como un jugador normal: coge armas nuevas hasta 4, luego mezcla mejoras y pasivas.
    let i = opciones.findIndex(o => o.tipo === "arma" && o.nivel === 1);
    if (i < 0 || Object.keys(J.armas).length >= 4) i = Math.floor(Math.random() * opciones.length);
    const nombre = opciones[i].nombre;
    aplicarOpcion(opciones[i]);
    window.__log.push({ev:"nivel", n:J.nivel, t:Math.round(tiempo), pick:nombre});
    return;
  }
  if (estado !== "juego") return;
  let fx = 0, fy = 0;
  for (const e of enemigos) {
    const dx = J.x - e.x, dy = J.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (d < 30) { const w = (30 - d) / 30; fx += dx / d * w * w * 3; fy += dy / d * w * w * 3; }
  }
  let g = null, gd = 1e9;
  for (const q of gemas) { const d = Math.hypot(q.x - J.x, q.y - J.y); if (d < gd) { gd = d; g = q; } }
  if (g && gd < 45) { fx += (g.x - J.x) / gd * 1.1; fy += (g.y - J.y) / gd * 1.1; }
  const m = Math.hypot(fx, fy) || 1; fx /= m; fy /= m;
  teclas.d = fx > 0.35; teclas.a = fx < -0.35; teclas.s = fy > 0.35; teclas.w = fy < -0.35;
}, 90);
"bot en marcha"`);

const filas = [];
for (let i = 0; i < DURACION / 5; i++) {
  await sleep(5000);
  const v = await ev("({e:estado,t:Math.round(tiempo),n:J.nivel,v:Math.round(J.vida),vm:J.vidaMax,k:matados,en:enemigos.length,gem:gemas.length,arm:Object.keys(J.armas).length,pas:Object.keys(J.pasivas).length,oro:oroRun})");
  filas.push(v);
  if (v.t >= 55 && v.t < 62) await foto("b-1min");
  if (v.t >= 115 && v.t < 122) await foto("b-2min");
  if (v.t >= 175 && v.t < 182) await foto("b-3min");
  if (v.e === "fin") {
    const fin = await ev("({oro:oroRun, botin:botinRun, bolsa:guardado.oro, t:Math.round(tiempo), k:matados, n:J.nivel})");
    console.log(`FIN a los ${fin.t}s (nivel ${fin.n}, ${fin.k} bajas) -> monedas ${fin.oro} + botin ${fin.botin} = ${fin.oro + fin.botin} de oro`);
    break;
  }
}
const fps = await ev(`(async()=>{let n=0;const t0=performance.now();await new Promise(r=>{const f=()=>{n++;performance.now()-t0<1000?requestAnimationFrame(f):r()};requestAnimationFrame(f)});return n})()`);
const log = await ev("window.__log");
await foto("b-final");
console.log("t(s)  nivel vida    bajas enem gem armas pas   oro");
for (const f of filas) console.log(`${String(f.t).padStart(4)}  ${String(f.n).padStart(4)} ${String(f.v+"/"+f.vm).padStart(8)} ${String(f.k).padStart(5)} ${String(f.en).padStart(4)} ${String(f.gem).padStart(3)} ${String(f.arm).padStart(5)} ${String(f.pas).padStart(3)} ${String(f.oro).padStart(5)}  ${f.e}`);
console.log("subidas:", log.filter(l=>l.ev==="nivel").map(l=>`${l.t}s:${l.pick}`).join(" | "));
const errores = eventos.filter(e => e.method==="Runtime.exceptionThrown" || (e.method==="Log.entryAdded"&&e.params.entry.level==="error"));
console.log("errores:", errores.length, errores.slice(0,3).map(e=>JSON.stringify(e.params).slice(0,300)).join("\n"));
console.log("fps final:", fps);
proc.kill(); process.exit(0);

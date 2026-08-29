// Arranca Chromium headless via CDP (sin dependencias) y prueba el juego.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromePath } from "./chrome.mjs";
// Las capturas van junto a este fichero; el perfil de Chromium, al temporal del sistema.
const OUT = new URL("capturas/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const PERFIL = join(tmpdir(), "vampire-asscii-chrome-1");
const JUEGO = new URL("../index.html", import.meta.url).href;

const CHROME = chromePath();

const proc = spawn(CHROME, [
  "--headless=new", "--remote-debugging-port=9334", "--no-sandbox", "--disable-gpu",
  "--hide-scrollbars", "--window-size=1400,860", "--force-device-scale-factor=1",
  `--user-data-dir=${PERFIL}`, "about:blank"
], { stdio: ["ignore", "pipe", "pipe"] });
proc.stderr.on("data", () => {});
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function esperarWS() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch("http://127.0.0.1:9334/json/version"); return (await r.json()).webSocketDebuggerUrl; }
    catch { await sleep(250); }
  }
  throw new Error("no arranco chromium");
}
let id = 0;
function crearCliente(ws) {
  const pend = new Map(); const eventos = [];
  ws.addEventListener("message", ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method) eventos.push(m);
  });
  return {
    enviar: (method, params = {}, sessionId) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); }),
    eventos
  };
}

const ws = new WebSocket(await esperarWS());
await new Promise(r => ws.addEventListener("open", r));
const cli = crearCliente(ws);
const { result: t } = await cli.enviar("Target.createTarget", { url: "about:blank" });
const { result: s } = await cli.enviar("Target.attachToTarget", { targetId: t.targetId, flatten: true });
const sid = s.sessionId;

await cli.enviar("Runtime.enable", {}, sid);
await cli.enviar("Log.enable", {}, sid);
await cli.enviar("Page.enable", {}, sid);
await cli.enviar("Page.navigate", { url: JUEGO }, sid);
await sleep(1200);

const ev = async expr => (await cli.enviar("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, sid)).result?.result?.value;
const foto = async n => { const r = await cli.enviar("Page.captureScreenshot", { format: "png" }, sid); writeFileSync(`${OUT}/${n}.png`, Buffer.from(r.result.data, "base64")); };
async function tecla(key, code, kc) {
  await cli.enviar("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: kc, nativeVirtualKeyCode: kc, text: key.length === 1 ? key : undefined }, sid);
  await sleep(50);
  await cli.enviar("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: kc, nativeVirtualKeyCode: kc }, sid);
}

await foto("t0-titulo");
await tecla(" ", "Space", 32);
await sleep(400);

// 1) Quieto 8 s: la horda debe rodear al jugador y deben verse subidas de nivel.
const marcas = [];
for (let seg = 1; seg <= 8; seg++) {
  await sleep(1000);
  const v = await ev("({estado,nivel:J.nivel,vida:Math.round(J.vida),enem:enemigos.length,mata:matados,t:Math.round(tiempo),xp:J.xp+'/'+J.xpProx})");
  marcas.push(v);
  if (v.estado === "nivel") { await foto("t1-menu-nivel"); await tecla("1", "Digit1", 49); await sleep(200); }
}
await foto("t2-quieto8s");

// Espera atendiendo los menus de subida de nivel (elige siempre la opcion 1).
async function esperar(ms) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    await sleep(350);
    if (await ev("estado") === "nivel") { await tecla("1", "Digit1", 49); }
  }
}

// 2) Salto temporal: comprobar densidad y rendimiento en minuto 4 con muchas armas.
await ev(`tiempo=235; jefeProx=240; oleada=Math.floor(tiempo/30);
  for(const id of ['daga','latigo','ajo','orbitas','rayo','biblia']) { J.armas[id]=5; J.temporiz[id]=0; }
  for(const p of ['botas','corazon','furia','reloj','esfera','iman']) { J.pasivas[p]=3; for(let i=0;i<3;i++) PASIVAS[p].aplicar(J); }
  J.vida=J.vidaMax; 'ok'`);
await esperar(6000);
const tarde = await ev("({estado,enem:enemigos.length,proy:proyectiles.length,gem:gemas.length,vida:Math.round(J.vida),t:Math.round(tiempo)})");
await foto("t3-minuto4");
await esperar(5000);
const conJefe = await ev("({jefes:enemigos.filter(e=>e.jefe).length,enem:enemigos.length,vida:Math.round(J.vida),estado,t:Math.round(tiempo)})");
await foto("t4-jefe");

const perf = await ev(`(async()=>{let n=0;const t0=performance.now();await new Promise(r=>{const f=()=>{n++;performance.now()-t0<1000?requestAnimationFrame(f):r()};requestAnimationFrame(f)});return {fps:n,enem:enemigos.length}})()`);

// 4) Pausa
await tecla("p", "KeyP", 80); await sleep(300);
const pausa = await ev("estado");
await foto("t6-pausa");
await tecla("p", "KeyP", 80); await sleep(300);
const trasPausa = await ev("estado");

// 3) Pantalla de muerte y reinicio: partida cruda en minuto 3, sin mejoras.
await ev(`reiniciar(); estado='juego'; tiempo=180; jefeProx=1e9; oleada=6; J.vida=25; 'ok'`);
let muerte = "juego";
for (let i = 0; i < 25 && muerte !== "fin"; i++) { await sleep(400); muerte = await ev("estado"); }
const tMuerte = await ev("({t:Math.round(tiempo),vida:Math.round(J.vida),mata:matados})");
console.log("=== MUERE EN ===", JSON.stringify(tMuerte));
if (muerte === "fin") await foto("t5-muerte");
await tecla(" ", "Space", 32); await sleep(800);
const tras = await ev("({estado,nivel:J.nivel,t:Math.round(tiempo),mata:matados,enem:enemigos.length})");

const errores = cli.eventos.filter(e => e.method === "Runtime.exceptionThrown" ||
  (e.method === "Log.entryAdded" && e.params.entry.level === "error") ||
  (e.method === "Runtime.consoleAPICalled" && e.params.type === "error"));
console.log("=== ERRORES ===", errores.length);
for (const e of errores.slice(0, 6)) console.log(JSON.stringify(e.params).slice(0, 500));
console.log("=== QUIETO ==="); marcas.forEach(m => console.log(JSON.stringify(m)));
console.log("=== MIN 4 ===", JSON.stringify(tarde));
console.log("=== JEFE ===", JSON.stringify(conJefe));
console.log("=== PERF ===", JSON.stringify(perf));
console.log("=== MUERTE ===", muerte, "-> tras reinicio:", JSON.stringify(tras));
console.log("=== PAUSA ===", pausa, "-> al despausar:", trasPausa);
proc.kill(); process.exit(0);

// Mide FPS con carga alta, con y sin la capa CRT, en una unica instancia de Chromium.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromePath } from "./chrome.mjs";
// Las capturas van junto a este fichero; el perfil de Chromium, al temporal del sistema.
const OUT = new URL("capturas/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const PERFIL = join(tmpdir(), "vampire-asscii-chrome-3");
const JUEGO = new URL("../index.html", import.meta.url).href;
const CHROME = chromePath();
const proc = spawn(CHROME, ["--headless=new","--remote-debugging-port=9337","--no-sandbox","--disable-gpu",
  "--hide-scrollbars","--window-size=1400,860","--force-device-scale-factor=1",`--user-data-dir=${PERFIL}`,"about:blank"],
  { stdio:["ignore","pipe","pipe"] });
proc.stderr.on("data",()=>{});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl;
for (let i=0;i<60;i++){ try{ wsUrl=(await (await fetch("http://127.0.0.1:9337/json/version")).json()).webSocketDebuggerUrl; break;}catch{await sleep(250);} }
const sock = new WebSocket(wsUrl); await new Promise(r=>sock.addEventListener("open",r));
let id=0; const pend=new Map(), eventos=[];
sock.addEventListener("message",e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);} else if(m.method) eventos.push(m);});
const cmd=(method,params={},sessionId)=>new Promise(res=>{const i=++id;pend.set(i,res);sock.send(JSON.stringify({id:i,method,params,sessionId}));});
const {result:t}=await cmd("Target.createTarget",{url:"about:blank"});
const {result:s}=await cmd("Target.attachToTarget",{targetId:t.targetId,flatten:true}); const sid=s.sessionId;
await cmd("Runtime.enable",{},sid); await cmd("Log.enable",{},sid); await cmd("Page.enable",{},sid);
await cmd("Page.navigate",{url:JUEGO},sid);
await sleep(1200);
const ev = async e => (await cmd("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true},sid)).result?.result?.value;
const foto = async n => { const r = await cmd("Page.captureScreenshot",{format:"png"},sid); writeFileSync(`${OUT}/${n}.png`, Buffer.from(r.result.data,"base64")); };
const medir = `(async()=>{let n=0;const t0=performance.now();await new Promise(r=>{const f=()=>{n++;performance.now()-t0<2000?requestAnimationFrame(f):r()};requestAnimationFrame(f)});return Math.round(n/2)})()`;

// Carga bruta: minuto 6, todas las armas al maximo, horda llena.
await ev(`manejarTecla(" "); tiempo=340;
  for(const k in ARMAS){J.armas[k]=8;J.temporiz[k]=0;}
  for(const p in PASIVAS){J.pasivas[p]=1;PASIVAS[p].aplicar(J);}
  for(let i=0;i<320;i++) enemigos.push(aparecerEnemigo(TIPOS[i%TIPOS.length]));
  J.vidaMax=99999; J.vida=99999; 'ok'`);
await sleep(2500);
console.log("con CRT   :", await ev(medir), "fps  |", await ev("enemigos.length"), "enemigos,", await ev("proyectiles.length"), "proyectiles");
await foto("p-carga");
await ev("document.getElementById('crt').style.display='none'; 'ok'"); await sleep(500);
console.log("sin CRT   :", await ev(medir), "fps  |", await ev("enemigos.length"), "enemigos");
await ev("document.getElementById('crt').style.display=''; 'ok'");

// Ventana pequena (movil apaisado) para comprobar el redimensionado.
await cmd("Emulation.setDeviceMetricsOverride",{width:640,height:400,deviceScaleFactor:1,mobile:false},sid);
await sleep(800);
await ev("dispatchEvent(new Event('resize')); 'ok'"); await sleep(500);
console.log("640x400   :", await ev("({cols:COLS,filas:FILAS,fps:0})"), await ev(medir), "fps");
await foto("p-pequena");
await cmd("Emulation.clearDeviceMetricsOverride",{},sid); await sleep(500);
await ev("dispatchEvent(new Event('resize')); 'ok'"); await sleep(500);
await foto("p-grande");
// --- Comprobaciones puntuales de lo que la partida normal no llega a ejercitar ---

// A) Cola de niveles: una sola gema debe encadenar varios menus.
await ev(`while(estado==='nivel') aplicarOpcion(opciones[0]);
  J.xp=0; J.xpProx=2; J.pendientes=0; gemas.length=0;
  gemas.push({x:J.x,y:J.y,xp:60,vx:0,vy:0,t:0}); 'ok'`);
await sleep(400);
const colaA = await ev("({estado, pendientes:J.pendientes, nivel:J.nivel})");
await ev("manejarTecla('1'); 'ok'"); await sleep(200);
const colaB = await ev("({estado, pendientes:J.pendientes, nivel:J.nivel})");
console.log("cola de niveles: tras la gema", JSON.stringify(colaA), "-> tras elegir", JSON.stringify(colaB),
            colaA.pendientes >= 2 && colaB.estado === "nivel" ? "OK" : "FALLA");
// Partida limpia y en silencio para las dos comprobaciones siguientes.
await ev(`reiniciar(); estado='juego'; enemigos.length=0; gemas.length=0; proxSpawn=1e9; jefeProx=1e9; oleada=1e9; 'ok'`);
await sleep(300);
console.log("estado en partida limpia:", await ev("estado"));

// B) Corazon: debe atraerse, curar y desaparecer.
await ev("J.vida=50; curas.length=0; curas.push({x:J.x+6,y:J.y,t:0}); 'ok'");
await sleep(1200);
const cor = await ev("({vida:Math.round(J.vida), curas:curas.length})");
console.log("corazon:", JSON.stringify(cor), cor.vida >= 80 && cor.curas === 0 ? "OK" : "FALLA");

// C) Movimiento por raton/tactil mantenido.
const antes = await ev("Math.round(J.x)");
await cmd("Input.dispatchMouseEvent",{type:"mousePressed",x:1200,y:430,button:"left",buttons:1,clickCount:1},sid);
await sleep(1200);
const despues = await ev("Math.round(J.x)");
await cmd("Input.dispatchMouseEvent",{type:"mouseReleased",x:1200,y:430,button:"left",buttons:0,clickCount:1},sid);
console.log("arrastre:", antes, "->", despues, despues > antes + 4 ? "OK (se mueve hacia el puntero)" : "FALLA");

const errores = eventos.filter(e => e.method==="Runtime.exceptionThrown" || (e.method==="Log.entryAdded"&&e.params.entry.level==="error"));
console.log("errores:", errores.length, errores.slice(0,3).map(e=>JSON.stringify(e.params).slice(0,400)).join("\n"));
proc.kill(); process.exit(0);

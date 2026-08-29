// Tienda, personajes, monedas y guardado: comprueba el meta-juego completo.
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromePath } from "./chrome.mjs";
const OUT = new URL("capturas/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const PERFIL = join(tmpdir(), "vampire-asscii-chrome-4");
const JUEGO = new URL("../index.html", import.meta.url).href;
const CHROME = chromePath();
const PUERTO = 9339;

const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PUERTO}`, "--no-sandbox", "--disable-gpu",
  "--hide-scrollbars", "--window-size=1400,860", "--force-device-scale-factor=1", `--user-data-dir=${PERFIL}`, "about:blank"],
  { stdio: ["ignore", "pipe", "pipe"] });
proc.stderr.on("data", () => {});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let wsUrl;
for (let i = 0; i < 60; i++) { try { wsUrl = (await (await fetch(`http://127.0.0.1:${PUERTO}/json/version`)).json()).webSocketDebuggerUrl; break; } catch { await sleep(250); } }
const sock = new WebSocket(wsUrl); await new Promise(r => sock.addEventListener("open", r));
let id = 0; const pend = new Map(), eventos = [];
sock.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method) eventos.push(m); });
const cmd = (method, params = {}, sessionId) => new Promise(res => { const i = ++id; pend.set(i, res); sock.send(JSON.stringify({ id: i, method, params, sessionId })); });
const { result: t } = await cmd("Target.createTarget", { url: "about:blank" });
const { result: s } = await cmd("Target.attachToTarget", { targetId: t.targetId, flatten: true }); const sid = s.sessionId;
await cmd("Runtime.enable", {}, sid); await cmd("Log.enable", {}, sid); await cmd("Page.enable", {}, sid);
await cmd("Page.navigate", { url: JUEGO }, sid);
await sleep(1200);
const ev = async e => (await cmd("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }, sid)).result?.result?.value;
const foto = async n => { const r = await cmd("Page.captureScreenshot", { format: "png" }, sid); writeFileSync(`${OUT}/${n}.png`, Buffer.from(r.result.data, "base64")); };
async function tecla(key, code, kc) {
  await cmd("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: kc, nativeVirtualKeyCode: kc, text: key.length === 1 ? key : undefined }, sid);
  await sleep(60);
  await cmd("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: kc, nativeVirtualKeyCode: kc }, sid);
  await sleep(90);
}
const ABAJO = ["ArrowDown", "ArrowDown", 40], ENTER = ["Enter", "Enter", 13], ESC = ["Escape", "Escape", 27];
const ok = (c, txt) => console.log((c ? "OK   " : "FALLA") + "  " + txt);

// Partir siempre de cero: el perfil de Chromium conserva el guardado entre pasadas.
await ev("try { localStorage.clear(); } catch (e) {} 'ok'");
await cmd("Page.reload", {}, sid); await sleep(1300);

console.log("estado inicial:", await ev("estado"), "| menu:", await ev("MENU_TITULO[menuSel]"),
            "| guardado limpio:", await ev("JSON.stringify(guardado)"));
await foto("s0-titulo");

// 1) Navegar del titulo a la tienda con el teclado.
await tecla(...ABAJO); await tecla(...ENTER);
ok(await ev("estado") === "tienda", "el titulo abre la tienda");

// 2) Comprar sin oro debe rechazarse.
await ev("guardado.oro = 0; guardarProgreso(); 'ok'");
await tecla(...ENTER);
ok((await ev("guardado.mejoras.vigor || 0")) === 0 && (await ev("avisoT")) > 0, "sin oro no se compra y avisa");

// 3) Con oro, la compra sube el nivel y descuenta.
await ev("guardado.oro = 500; 'ok'");
const antes = await ev("guardado.oro");
await tecla(...ENTER);
const tras = await ev("({oro:guardado.oro, vigor:guardado.mejoras.vigor||0})");
ok(tras.vigor === 1 && tras.oro === antes - 60, `compra: vigor ${tras.vigor}, oro ${antes} -> ${tras.oro}`);
await tecla(...ABAJO); await tecla(...ENTER);       // segunda mejora distinta
console.log("mejoras:", JSON.stringify(await ev("guardado.mejoras")));
await foto("s1-tienda");

// 4) Persistencia: recargar la pagina debe conservar el progreso.
const guardadoAntes = await ev("JSON.stringify(guardado)");
await cmd("Page.reload", {}, sid); await sleep(1300);
const guardadoTras = await ev("JSON.stringify(guardado)");
ok(guardadoAntes === guardadoTras, "el progreso sobrevive a recargar (localStorage)");
if (guardadoAntes !== guardadoTras) console.log("   antes:", guardadoAntes, "\n   tras :", guardadoTras);

// 5) Personajes: se llega navegando desde el titulo, no por asignacion.
// Tras recargar volvemos al titulo con el cursor en JUGAR.
ok(await ev("estado") === "titulo" && await ev("menuSel") === 0, "recargar deja el titulo en JUGAR");
await tecla(...ABAJO); await tecla(...ENTER);         // -> tienda
await tecla(...ESC);                                  // -> titulo
ok(await ev("estado") === "titulo" && await ev("menuSel") === 1, "ESC vuelve al titulo desde la tienda");
await tecla(...ABAJO); await tecla(...ENTER);         // -> personajes
ok(await ev("estado") === "personajes", "el titulo abre personajes");
await ev("menuSel=1; guardado.oro=1000; 'ok'"); await sleep(200);
await tecla(...ENTER);
const per = await ev("({elegido:guardado.elegido, tiene:guardado.personajes, oro:guardado.oro})");
ok(per.elegido === "cazadora" && per.tiene.includes("cazadora"), "se compra y equipa la Cazadora: " + JSON.stringify(per));
await foto("s2-personajes");

// 5b) El raton tambien maneja las listas: primer toque selecciona, segundo activa.
await ev("estado='tienda'; menuSel=0; guardado.oro=1000; 'ok'"); await sleep(250);
const filaY = await ev("(ultimaBaseMenu + 4) * celdaH + celdaH/2");
for (const tipo of ["mousePressed", "mouseReleased"])
  await cmd("Input.dispatchMouseEvent", { type: tipo, x: 700, y: Math.round(filaY), button: "left", buttons: tipo === "mousePressed" ? 1 : 0, clickCount: 1 }, sid);
await sleep(200);
const selRaton = await ev("menuSel");
for (const tipo of ["mousePressed", "mouseReleased"])
  await cmd("Input.dispatchMouseEvent", { type: tipo, x: 700, y: Math.round(filaY), button: "left", buttons: tipo === "mousePressed" ? 1 : 0, clickCount: 1 }, sid);
await sleep(200);
const compradoRaton = await ev("Object.keys(guardado.mejoras).length");
ok(selRaton === 2 && compradoRaton >= 3, `el raton selecciona (fila ${selRaton}) y compra al segundo toque`);

// 6) La partida arranca con el glifo y el arma del personaje.
await ev("estado='personajes'; menuSel=1; 'ok'"); await sleep(150);
await tecla(...ESC); await sleep(150);
await ev("menuSel=0; manejarTecla('enter'); 'ok'"); await sleep(600);
const run = await ev("({estado, glifo:J.glifo, armas:Object.keys(J.armas), vida:J.vidaMax, vel:Math.round(J.velBase*10)/10})");
ok(run.glifo === "Y" && run.armas[0] === "latigo", "la Cazadora entra con latigo: " + JSON.stringify(run));

// 7) Monedas: se recogen durante la partida y se ingresan al morir.
await ev(`for(let i=0;i<40;i++) monedas.push({x:J.x+Math.cos(i)*2,y:J.y+Math.sin(i)*2,oro:2,t:0}); 'ok'`);
await sleep(900);
const oroRun = await ev("oroRun");
ok(oroRun >= 60, "las monedas se recogen (oro de la partida: " + oroRun + ")");
const bolsaAntes = await ev("guardado.oro");
await ev("J.revivir=0; terminarPartida(); 'ok'"); await sleep(300);
const fin = await ev("({estado, oro:guardado.oro, botin:botinRun, record:Math.round(guardado.record)})");
ok(fin.estado === "fin" && fin.oro === bolsaAntes + oroRun + fin.botin,
   "al morir el oro (monedas + botin) entra en la bolsa: " + JSON.stringify(fin));
await foto("s3-fin");

// 8) Suavidad: con el jugador en marcha, la camara debe avanzar en subpixeles.
await ev("manejarTecla(' '); 'ok'"); await sleep(400);
await cmd("Input.dispatchKeyEvent", { type: "keyDown", key: "d", code: "KeyD", windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68, text: "d" }, sid);
await sleep(500);
const muestras = await ev(`(async()=>{const v=[];for(let i=0;i<30;i++){await new Promise(r=>requestAnimationFrame(r));v.push(Math.round(desplX*100)/100);}return v})()`);
await cmd("Input.dispatchKeyEvent", { type: "keyUp", key: "d", code: "KeyD", windowsVirtualKeyCode: 68, nativeVirtualKeyCode: 68 }, sid);
const distintos = new Set(muestras).size;
ok(distintos > 8, `el scroll avanza en subcelda (${distintos} desplazamientos distintos en 30 fotogramas)`);
await foto("s4-juego");

const errores = eventos.filter(e => e.method === "Runtime.exceptionThrown" || (e.method === "Log.entryAdded" && e.params.entry.level === "error"));
console.log("errores de consola:", errores.length);
for (const e of errores.slice(0, 4)) console.log("  ", JSON.stringify(e.params).slice(0, 400));
proc.kill(); process.exit(0);

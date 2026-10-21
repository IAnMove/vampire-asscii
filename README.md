# VAMPIRE ASSCII

Un clon de *Vampire Survivors* dibujado enteramente con caracteres, en una sola página web.
Sin dependencias, sin build, sin conexión: abre `index.html` en el navegador y a jugar.

```
z          v            @  ← eres tú
    S   o o o o             z v S w O Ω  ← son ellos
  w   o    @    o
    S   o o o o          *  ← gemas de experiencia
       O        v
```

## Cómo se juega

| Tecla | Acción |
|---|---|
| `W A S D` o flechas | mover |
| `↑ ↓` + `Enter` | moverte por los menús (título, tienda, personajes) |
| `1` `2` `3` | elegir mejora al subir de nivel |
| `P` o `Esc` | pausa |
| `M` | silenciar |
| `Espacio` | empezar / reintentar |
| `T` | ir a la tienda desde la pantalla de muerte |

También se juega con el ratón o el dedo: mantén pulsado y tu personaje va hacia donde tocas;
en los menús, un toque selecciona la fila y el segundo la activa.

Tú solo te mueves: **las armas disparan solas**. Recoge las gemas que sueltan los enemigos,
sube de nivel, elige mejora y aguanta todo lo que puedas.

## Qué hay dentro

- **6 armas**, cada una con geometría propia y 8 niveles: daga arrojadiza, látigo en abanico,
  aura de ajo, cruces orbitales, rayo y biblia maldita.
- **8 objetos pasivos**: velocidad, vida máxima, daño, enfriamiento, área, imán, armadura y regeneración.
- **6 tipos de enemigo** que se desbloquean con el tiempo, oleadas cerradas cada 30 s
  y un **jefe** (`Ω`) cada minuto, con su barra de vida.
- Los enemigos grandes y los jefes sueltan **corazones** (`♥`) que curan 30.
- Curva de dificultad continua: la horda crece, se acelera y engorda con el reloj.
- Si recoges varias gemas de golpe y subes dos niveles, se te ofrecen los dos menús: los
  niveles se encolan en vez de perderse.

### Entre partidas

Los enemigos sueltan monedas (`$`) y al morir cobras además un botín por lo que hayas aguantado.
Ese oro no se pierde: se guarda en el navegador (`localStorage`) y se gasta en el menú principal.

- **Tienda**: ocho mejoras permanentes que valen para todas las partidas — vida, daño, velocidad,
  enfriamiento, radio de recogida, oro extra, coraza y una **Reliquia** que te revive una vez,
  arrasando lo que tengas alrededor. Cada nivel sube el precio del siguiente.
- **Personajes**: seis, con arma inicial y estadísticas propias — desde el `@` Aldeano
  equilibrado hasta el `%` Alquimista, que pega como un tren y aguanta como un vaso. Se
  desbloquean con oro y cambian bastante cómo se juega la partida.

## Cómo está hecho

Todo el juego cabe en `index.html` (HTML + CSS + JS, sin dependencias). La versión publicada como
página es este mismo fichero sin el envoltorio `<!doctype>`/`<html>`/`<head>`/`<body>`, que pone
el publicador.

- **Render**: rejilla de caracteres sobre `<canvas>`. Cada fotograma se rellena un búfer de
  caracteres/color/profundidad y se pinta agrupando tramos contiguos del mismo color en una sola
  llamada a `fillText`, así que solo cuestan las celdas ocupadas.
- **Aspecto**: el mundo se guarda en unidades cuadradas y la relación alto/ancho de la celda
  (medida con `measureText`, no supuesta) se aplica únicamente al dibujar. Sin esto, los círculos
  se ven ovalados y los enemigos llegan describiendo arcos raros.
- **Simulación**: paso fijo a 60 Hz con acumulador, para que la dificultad no dependa de los FPS
  del equipo. Las posiciones son flotantes; solo se redondean al dibujar.
- **Scroll continuo**: el mundo se pinta en una capa aparte de la interfaz y se desplaza en
  píxeles, no en celdas enteras, con la posición del jugador interpolada por lo que queda en el
  acumulador. Sin eso el mapa avanzaba a saltos de celda y, encima, el fondo saltaba media celda
  antes que los enemigos.
- **Colisiones**: rejilla espacial (hash de celdas de 6 unidades) para impactos, aura, separación
  entre enemigos y búsqueda de objetivo.
- **Legibilidad de la horda**: los enemigos se separan entre sí y, cuando aún así se apilan tres
  o más en la misma celda, esta pasa a dibujarse como bloque `▒`/`▓`; si no, cuarenta enemigos
  encima del mismo punto se verían como un único glifo.
- **Sonido**: bips sintetizados con WebAudio, sin ficheros externos.

## Probado

En `pruebas/` hay arneses que conducen Chromium headless por CDP, sin dependencias
(`node pruebas/bot.mjs 150`). Buscan Chromium en la caché de Playwright o en `/usr/bin`;
si no, `CHROME=/ruta node pruebas/bot.mjs`. Las capturas se guardan en `pruebas/capturas/`.

- `probar.mjs` — arranque, menú de nivel, pausa, muerte y reinicio, aparición del jefe.
- `bot.mjs` — autojuego dentro de la página (esquiva y recoge gemas) para medir la curva.
- `perf.mjs` — carga máxima, y comprobaciones de cola de niveles, corazones y arrastre.
- `tienda.mjs` — navegación de menús con teclado y ratón, compras, desbloqueo de personajes,
  monedas, botín y persistencia del guardado al recargar.

Resultados de la última pasada: **0 errores de consola**, **61 fps con 586 enemigos vivos**
y las 13 comprobaciones de meta-juego en verde. La partida autojugada llega a nivel 9 en tres
minutos y deja unos 117 de oro, con la mejora más barata a 60.

Tres fallos que sacaron estas pruebas y que no se ven leyendo el código: las gemas lejanas
salían despedidas del jugador en vez de acercarse (velocidad negativa al pasar del radio del imán);
el búfer de profundidad se inicializaba a 0, así que el fondo, dibujado en `z = -1`, no llegaba a
pintarse nunca; y la cámara interpolada leía una posición previa inexistente en el primer
fotograma de cada partida.

## Licencia

Publicado bajo la [licencia MIT](LICENSE). © 2026 IAnMove.

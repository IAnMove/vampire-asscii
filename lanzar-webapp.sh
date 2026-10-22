#!/usr/bin/env bash
# ==============================================================================
# Lanzador de Vampire ASSCII en modo WebApp independiente
# Abre el juego en una ventana limpia de navegador sin barras, URL ni menús.
# ==============================================================================

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="file://${DIR}/index.html"

# 1. Intentar con navegadores basados en Chromium (soportan --app=... de forma nativa)
for browser in chromium google-chrome google-chrome-stable brave-browser microsoft-edge-stable; do
  if command -v "$browser" >/dev/null 2>&1; then
    echo "Lanzando Vampire ASSCII con $browser en modo WebApp..."
    exec "$browser" --app="$TARGET" --window-size=1024,768 --class="VampireAsscii" "$@"
  fi
done

# 2. Fallback a Firefox en modo kiosk o ventana nueva si no hay Chromium
if command -v firefox >/dev/null 2>&1; then
  echo "Lanzando con Firefox..."
  exec firefox --new-window "$TARGET" "$@"
fi

# 3. Fallback genérico de escritorio
if command -v xdg-open >/dev/null 2>&1; then
  exec xdg-open "${DIR}/index.html"
fi

echo "Error: No se encontró ningún navegador disponible en el sistema."
exit 1

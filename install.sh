#!/usr/bin/env bash
# ==============================================================================
# Script de instalación de Vampire ASSCII para Omarchy / Arch Linux
# Añade el juego al lanzador de aplicaciones (SUPER + Espacio) y a la terminal
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ICON_SRC="${DIR}/screenshots/menu.png"
ICON_DIR="${HOME}/.local/share/icons/hicolor/256x256/apps"
APP_DIR="${HOME}/.local/share/applications"
BIN_DIR="${HOME}/.local/bin"

mkdir -p "$ICON_DIR" "$APP_DIR" "$BIN_DIR"

# 1. Copiar icono
cp "$ICON_SRC" "${ICON_DIR}/vampire-asscii.png"
gtk-update-icon-cache "${HOME}/.local/share/icons/hicolor" &>/dev/null || true

# 2. Crear enlace para ejecutar desde terminal en cualquier sitio
ln -sf "${DIR}/vampire-cli.mjs" "${BIN_DIR}/vampire-asscii"
chmod +x "${DIR}/vampire-cli.mjs" "${DIR}/lanzar-webapp.sh"

# 3. Crear entrada .desktop para el lanzador de Omarchy (SUPER + Espacio)
cat > "${APP_DIR}/vampire-asscii.desktop" <<EOF
[Desktop Entry]
Version=1.0
Name=Vampire ASSCII
Comment=Survival roguelite rendered in text characters
Exec=${DIR}/lanzar-webapp.sh
Terminal=false
Type=Application
Icon=vampire-asscii
Categories=Game;ActionGame;
StartupNotify=true
EOF

# 4. Crear entrada .desktop para la versión TUI/Terminal (Ventana flotante)
cat > "${APP_DIR}/vampire-asscii-tui.desktop" <<EOF
[Desktop Entry]
Version=1.0
Name=Vampire ASSCII (Terminal)
Comment=Survival roguelite played directly in terminal
Exec=xdg-terminal-exec --app-id=TUI.float -e ${DIR}/vampire-cli.mjs
Terminal=false
Type=Application
Icon=vampire-asscii
Categories=Game;ActionGame;ConsoleOnly;
StartupNotify=true
EOF

chmod +x "${APP_DIR}/vampire-asscii.desktop" "${APP_DIR}/vampire-asscii-tui.desktop"

echo ""
echo "======================================================="
echo " ¡Vampire ASSCII instalado correctamente en Omarchy! "
echo "======================================================="
echo "1. En el lanzador de apps (SUPER + Espacio):"
echo "   - 'Vampire ASSCII' (Modo WebApp con gráficos y música)"
echo "   - 'Vampire ASSCII (Terminal)' (Modo TUI flotante)"
echo ""
echo "2. Desde cualquier terminal:"
echo "   - Ejecuta: vampire-asscii"
echo "======================================================="

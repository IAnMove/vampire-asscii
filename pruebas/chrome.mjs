// Resuelve el binario de Chromium sin hardcodear un home de máquina.
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function chromePath() {
  if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME;

  const home = homedir();
  const fijos = [
    join(home, ".cache/ms-playwright/chromium-1223/chrome-linux64/chrome"),
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
  ];
  for (const p of fijos) if (existsSync(p)) return p;

  const pw = join(home, ".cache/ms-playwright");
  if (existsSync(pw)) {
    for (const name of readdirSync(pw)) {
      if (!name.startsWith("chromium-")) continue;
      const bin = join(pw, name, "chrome-linux64/chrome");
      if (existsSync(bin)) return bin;
    }
  }

  throw new Error("No encontré Chromium. Exporta CHROME=/ruta/al/binario");
}

#!/usr/bin/env bash
# Actualiza Sokyo en la Raspberry: descarga los cambios, instala dependencias,
# compila el panel web y reinicia el bot.
#
# Uso (en la Raspberry, dentro de la carpeta del repositorio):
#   bash scripts/actualizar-raspberry.sh            → actualiza la rama actual
#   bash scripts/actualizar-raspberry.sh main       → cambia a "main" y la actualiza
set -euo pipefail
cd "$(dirname "$0")/.."

RAMA="${1:-$(git rev-parse --abbrev-ref HEAD)}"

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "⚠️  Tienes cambios sin guardar en esta carpeta:"
  git status --short --untracked-files=no
  echo "Guárdalos (git stash) o descártalos antes de actualizar."
  exit 1
fi

echo "📥 Descargando la rama $RAMA..."
git fetch origin "$RAMA"
git checkout "$RAMA"
git pull --ff-only origin "$RAMA"

echo "📦 Instalando dependencias del bot..."
npm install --omit=dev

echo "🖥️  Compilando el panel web..."
(cd sokyo-panelFRONTEND && npm install && npm run build)

if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe sokyo-bot >/dev/null 2>&1; then
    pm2 restart sokyo-bot --update-env
  else
    pm2 start index.js --name sokyo-bot
  fi
  pm2 save
  echo "✅ Sokyo actualizado y reiniciado. Registro en directo: pm2 logs sokyo-bot"
else
  echo "✅ Código actualizado. Reinicia el bot (Ctrl+C y npm start)."
  echo "   Consejo: con pm2 se reinicia solo y arranca con la Raspberry → sudo npm install -g pm2"
fi

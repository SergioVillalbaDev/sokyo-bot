#!/usr/bin/env bash
# Activa el despliegue automático en la Raspberry Pi: cada 5 minutos se mira si
# hay commits nuevos en GitHub y, si los hay, se ejecuta deploy/deploy.sh.
#
#   bash deploy/instalar-autodeploy.sh            -> lo activa (y hace un primer despliegue)
#   bash deploy/instalar-autodeploy.sh --quitar   -> lo desactiva
#
# El registro queda en ~/sokyo-deploy.log  (tail -f ~/sokyo-deploy.log)
set -euo pipefail

DIR=$(cd "$(dirname "$0")/.." && pwd)
MARCA='# sokyo-bot autodeploy'
LOG="$HOME/sokyo-deploy.log"
resto=$(crontab -l 2>/dev/null | grep -vF "$MARCA" || true)

if [ "${1:-}" = "--quitar" ]; then
    printf '%s\n' "$resto" | crontab -
    echo "✓ Despliegue automático desactivado."
    exit 0
fi

for cmd in git node npm pm2 curl flock taskset timeout; do
    command -v "$cmd" >/dev/null || { echo "✗ Falta el comando '$cmd' en la Pi."; exit 1; }
done
pm2 describe "${PM2_APP:-bot}" >/dev/null 2>&1 || { echo "✗ No hay ningún proceso '${PM2_APP:-bot}' en pm2."; exit 1; }

# cron no lee la configuración del terminal: se ejecutará sin pedir contraseñas,
# así que se comprueba ahora que GitHub responde sin ellas.
cd "$DIR"
if ! GIT_TERMINAL_PROMPT=0 GIT_SSH_COMMAND='ssh -o BatchMode=yes' git fetch --quiet origin; then
    echo "✗ git fetch necesita contraseña o clave: el despliegue automático no podría descargar los cambios."
    exit 1
fi

# Se guarda el PATH actual para que cron encuentre node, npm y pm2 (p. ej. con nvm).
linea="*/5 * * * * PATH=\"$PATH\" bash \"$DIR/deploy/deploy.sh\" >> \"$LOG\" 2>&1 $MARCA"
{ if [ -n "$resto" ]; then printf '%s\n' "$resto"; fi; printf '%s\n' "$linea"; } | crontab -
echo "✓ Despliegue automático activado: cada 5 minutos comprueba la rama $(git rev-parse --abbrev-ref HEAD)."

echo "Primer despliegue para comprobar que todo funciona (tarda un par de minutos)…"
bash "$DIR/deploy/deploy.sh" --forzar 2>&1 | tee -a "$LOG"

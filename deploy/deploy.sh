#!/usr/bin/env bash
# Actualiza el bot y el panel (dashboard.sokyo.studio) en la Raspberry Pi con lo
# último de GitHub. Lo ejecuta solo, cada 5 minutos, el cron que instala
# deploy/instalar-autodeploy.sh; también se puede lanzar a mano:
#
#   bash deploy/deploy.sh            -> despliega si hay commits nuevos
#   bash deploy/deploy.sh --forzar   -> reinstala, recompila y reinicia aunque no los haya
#
# Si el bot no arranca con la versión nueva, vuelve solo a la anterior y no
# reintenta ese commit hasta que llegue otro. Todo queda en ~/sokyo-deploy.log.
set -uo pipefail

APP=${PM2_APP:-bot}                  # proceso de pm2 del bot (sirve también la API y el panel)
LAVALINK=${PM2_LAVALINK:-lavalink}   # proceso de pm2 del servidor de música
PANEL=sokyo-panelFRONTEND

CAMBIOS=''          # archivos que cambian en este despliegue
PANEL_NUEVO=0       # 1 si se ha cambiado el panel compilado (para poder deshacerlo)
LAVALINK_PARADO=0   # 1 si se ha parado Lavalink y hay que volver a arrancarlo

log() { echo "[$(date '+%F %T')] $*"; }
cambio() { grep -qE "$1" <<<"$CAMBIOS"; }
corto() { git rev-parse --short "${1:-HEAD}"; }

# ¿Responde el bot en /api/estado con el commit esperado? (espera hasta 90 s)
arrancado() {
    local puerto
    puerto=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d '"\r ')
    for _ in $(seq 1 30); do
        if curl -fsS "http://127.0.0.1:${puerto:-3000}/api/estado" 2>/dev/null | grep -q "\"commit\":\"$1\""; then
            return 0
        fi
        sleep 3
    done
    return 1
}

# pm2 se llama siempre con el descriptor 9 cerrado: si tuviera que arrancar su
# demonio, este heredaría el candado y bloquearía todos los despliegues siguientes.
reiniciar() {
    if [ $LAVALINK_PARADO -eq 1 ] || cambio '^(lavalink/|scripts/lavalink\.js$)'; then
        pm2 restart "$LAVALINK" >/dev/null 2>&1 9>&-
    fi
    pm2 restart "$APP" >/dev/null 9>&-
}

# Instala dependencias y compila el panel según lo que haya cambiado.
# Solo devuelve error si fallan las dependencias del bot (imprescindibles).
preparar() {
    if cambio '^package\.json$'; then
        log "Instalando dependencias del bot"
        npm install --no-audit --no-fund || return 1
    fi
    cambio "^$PANEL/" || return 0

    if cambio "^$PANEL/package\.json$"; then
        log "Instalando dependencias del panel"
        if ! (cd "$PANEL" && npm install --include=dev --no-audit --no-fund); then
            log "✗ Fallaron las dependencias del panel: se mantiene el panel anterior"
            return 0
        fi
    fi

    # La build necesita ~700 MB y todos los núcleos: con todo encendido la Pi se
    # llegó a colgar. Se paran el bot y Lavalink mientras compila (se reinician
    # igual) y se limita a 2 núcleos. Se compila aparte y solo se cambia si sale bien.
    log "Compilando el panel"
    pm2 stop "$APP" "$LAVALINK" >/dev/null 2>&1 9>&-
    LAVALINK_PARADO=1
    rm -rf "$PANEL/dist-nuevo"
    if (cd "$PANEL" && timeout 900 nice -n 10 taskset -c 0,1 npm run build -- --outDir dist-nuevo --emptyOutDir); then
        rm -rf "$PANEL/dist-anterior"
        if [ -d "$PANEL/dist" ]; then mv "$PANEL/dist" "$PANEL/dist-anterior"; fi
        mv "$PANEL/dist-nuevo" "$PANEL/dist"
        PANEL_NUEVO=1
    else
        log "✗ Falló la compilación del panel: se mantiene el panel anterior"
        rm -rf "$PANEL/dist-nuevo"
    fi
    return 0
}

main() {
    cd "$(dirname "$0")/.." || exit 1
    local forzar=0
    [ "${1:-}" = "--forzar" ] && forzar=1

    # Un solo despliegue a la vez (el cron no debe pisar a uno lanzado a mano).
    exec 9>/tmp/sokyo-deploy.lock
    flock -n 9 || { log "Ya hay un despliegue en curso."; exit 0; }

    local rama antes despues
    rama=${DEPLOY_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}
    if ! GIT_TERMINAL_PROMPT=0 git fetch --quiet origin "$rama"; then
        log "✗ No se pudo descargar de GitHub (¿sin conexión?)"
        exit 1
    fi
    despues=$(git rev-parse "origin/$rama")
    # Se compara con el último despliegue que salió bien, no con HEAD: si uno se
    # cortó a medias (p. ej. por un apagón), así se termina en la siguiente pasada.
    antes=$(cat .deploy-ok 2>/dev/null || git rev-parse HEAD)
    git cat-file -e "${antes}^{commit}" 2>/dev/null || { antes=$(git rev-parse HEAD); forzar=1; }

    if [ $forzar -eq 0 ]; then
        [ "$antes" = "$despues" ] && exit 0
        # Un commit que ya falló no se reintenta: se espera al siguiente.
        [ "$(cat .deploy-fallido 2>/dev/null)" = "$despues" ] && exit 0
    fi

    log "Desplegando $rama: $(corto "$antes") -> $(corto "$despues")"
    if ! git merge --ff-only --quiet "origin/$rama"; then
        log "✗ No se puede avanzar sin perder algo: hay cambios locales en la Pi (git status) o se reescribió la rama en GitHub. No se ha tocado nada."
        echo "$despues" > .deploy-fallido
        exit 1
    fi
    if [ $forzar -eq 1 ]; then CAMBIOS=$(git ls-files); else CAMBIOS=$(git diff --name-only "$antes" "$despues"); fi

    local ok=1
    preparar || ok=0
    reiniciar
    if [ $ok -eq 1 ] && arrancado "$(corto)"; then
        git rev-parse HEAD > .deploy-ok
        rm -f .deploy-fallido
        log "✓ Desplegado $(corto) (v$(node -p "require('./package.json').version"))"
        exit 0
    fi

    # El bot no arranca con el código nuevo: se vuelve a la versión anterior.
    log "✗ El bot no arranca con $(corto): vuelvo a $(corto "$antes"). Revisa: pm2 logs $APP"
    echo "$despues" > .deploy-fallido
    git reset --quiet --keep "$antes" || log "✗ git no pudo volver a $(corto "$antes")"
    if cambio '^package\.json$'; then npm install --no-audit --no-fund; fi
    if [ $PANEL_NUEVO -eq 1 ] && [ -d "$PANEL/dist-anterior" ]; then
        rm -rf "$PANEL/dist"
        mv "$PANEL/dist-anterior" "$PANEL/dist"
    fi
    reiniciar
    if arrancado "$(corto)"; then
        log "↩️  Restaurada la versión anterior ($(corto))"
    else
        log "✗ Tampoco arranca la versión anterior: revisa pm2 logs $APP"
    fi
    exit 1
}

# Todo va dentro de main: así bash lee el script entero antes de ejecutarlo y no
# le afecta que el propio git pull lo cambie a mitad.
main "$@"

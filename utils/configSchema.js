// Saneado de las secciones de configuración que se editan desde el panel.
// Cada sección tiene el permiso que hace falta para editarla y un "limpiador" que solo deja pasar
// campos conocidos con el tipo correcto (nunca se guarda tal cual lo que llega del cliente).

const num = (v, min, max, def) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def; };
const bool = (v) => v === true || v === 'true';
const idDiscord = (v) => (typeof v === 'string' && /^\d{15,25}$/.test(v) ? v : null);
const listaTexto = (v, max = 50, len = 100) => (Array.isArray(v) ? v : []).map(x => String(x).trim().toLowerCase()).filter(Boolean).map(x => x.slice(0, len)).slice(0, max);

const SECCIONES = {
    tickets: {
        permiso: 'config.tickets',
        limpiar: (b) => ({
            'tickets.maxAbiertosPorUsuario': num(b.maxAbiertosPorUsuario, 1, 20, 3),
            'tickets.cooldownSegundos': num(b.cooldownSegundos, 0, 3600, 60),
            'tickets.faqActiva': bool(b.faqActiva),
            'tickets.canalTranscriptsId': idDiscord(b.canalTranscriptsId),
            'tickets.rolStaffId': idDiscord(b.rolStaffId)
        })
    },
    automatizacion: {
        permiso: 'config.automatizacion',
        limpiar: (b) => ({
            'automatizacion.inactividadActiva': bool(b.inactividadActiva),
            'automatizacion.avisoHoras': num(b.avisoHoras, 1, 720, 24),
            'automatizacion.cierreHoras': num(b.cierreHoras, 1, 720, 24),
            'automatizacion.slaActivo': bool(b.slaActivo),
            'automatizacion.slaHoras': num(b.slaHoras, 1, 168, 4)
        })
    },
    automod: {
        permiso: 'config.automod',
        limpiar: (b) => ({
            'automod.activo': bool(b.activo),
            'automod.antiSpam.activo': bool(b.antiSpam?.activo),
            'automod.antiSpam.mensajes': num(b.antiSpam?.mensajes, 3, 30, 5),
            'automod.antiSpam.segundos': num(b.antiSpam?.segundos, 2, 60, 6),
            'automod.antiSpam.minutosMute': num(b.antiSpam?.minutosMute, 1, 1440, 10),
            'automod.antiEnlaces.activo': bool(b.antiEnlaces?.activo),
            'automod.antiEnlaces.dominiosPermitidos': listaTexto(b.antiEnlaces?.dominiosPermitidos)
        })
    },
    comunidad: {
        permiso: 'config.comunidad',
        limpiar: (b) => ({
            'bienvenida.autoRolId': idDiscord(b.bienvenida?.autoRolId),
            'bienvenida.verificacionActiva': bool(b.bienvenida?.verificacionActiva),
            'bienvenida.verificacionRolId': idDiscord(b.bienvenida?.verificacionRolId),
            'niveles.activo': bool(b.niveles?.activo),
            'niveles.canalId': idDiscord(b.niveles?.canalId),
            'niveles.recompensas': (Array.isArray(b.niveles?.recompensas) ? b.niveles.recompensas : [])
                .map(r => ({ nivel: num(r?.nivel, 1, 500, 0), rolId: idDiscord(r?.rolId) }))
                .filter(r => r.nivel > 0 && r.rolId).slice(0, 25),
            'sugerenciasCanalId': idDiscord(b.sugerenciasCanalId)
        })
    }
};

module.exports = { SECCIONES, num, bool, idDiscord, listaTexto };

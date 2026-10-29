// Historial de cambios del panel (models/CambioPanel.js).
//
// Un middleware de la API mira la configuración del servidor antes y después de
// cada petición que guarda algo (POST/PUT/PATCH/DELETE) y, si ha cambiado, lo
// apunta: qué campos, cómo estaban y cómo quedaron, y quién lo hizo. La respuesta
// lleva el id del cambio en la cabecera X-Sokyo-Cambio, para que el panel pueda
// ofrecer «Deshacer» justo después de guardar.
const ServidorConfig = require('../models/ServidorConfig.js');
const CambioPanel = require('../models/CambioPanel.js');
const { invalidateConfig } = require('./config.js');

const { esInterno, aplanar, leerRuta } = require('./camposInternos.js');

// Sección del panel (tab de navConfig.js) donde se cambia cada campo.
const SECCION = {
    motivos: 'tickets-config', urgencias: 'tickets-config', mensajeSoporteTitulo: 'tickets-config',
    mensajeSoporteDescripcion: 'tickets-config', textoBoton: 'tickets-config', mensajeBienvenida: 'tickets-config',
    categoriaArchivados: 'tickets-config', rolStaffId: 'tickets-config', categoriaTicketsId: 'tickets-config',
    maxTicketsAbiertos: 'tickets-config', autoCierreDias: 'tickets-config', autoAsignar: 'tickets-config',
    respuestasRapidas: 'tickets-config', ratingActivo: 'tickets-config', enviarTranscript: 'tickets-config',
    avisoCierreCanal: 'tickets-config', pingSoporte: 'tickets-config', rolSoporteId: 'tickets-config',
    avisoSinRespuestaHoras: 'tickets-config',
    footerPersonalizado: 'config-textos', colorEmbed: 'config-textos', prefijo: 'config-textos', idioma: 'config-textos',
    autoRespuestas: 'prod-autorespuestas',
    logsActivos: 'logs-todos', canalLogsId: 'logs-todos', webhooksSalientes: 'logs-todos',
    autoRoles: 'roles-autorol', autoRolesBots: 'roles-autorol',
    canalModLogId: 'mod-registro', dmSancion: 'mod-registro',
    musica: 'musica', automod: 'mod-automod',
    nivelesActivo: 'config-niveles', xpMin: 'config-niveles', xpMax: 'config-niveles', xpCooldownSeg: 'config-niveles',
    xpVozActivo: 'config-niveles', xpVozPorMin: 'config-niveles', dificultad: 'config-niveles', anuncioTipo: 'config-niveles',
    canalNivelesId: 'config-niveles', mensajeSubida: 'config-niveles', recompensasNivel: 'config-niveles',
    recompensaAcumulativa: 'config-niveles', canalesSinXp: 'config-niveles', rolesSinXp: 'config-niveles',
    multiplicadoresRol: 'config-niveles', tarjetaActiva: 'config-niveles',
    verificacion: 'seg-verificacion', embudoAB: 'seg-verificacion',
    bienvenida: 'prod-bienvenidas', despedida: 'prod-bienvenidas',
    reportes: 'mod-reportes',
    canalSugerencias: 'com-sugerencias', sugerenciasModo: 'com-sugerencias', sugerenciasPlantilla: 'com-sugerencias', sugerenciasMinLong: 'com-sugerencias',
    presentaciones: 'com-presentaciones', dinamicas: 'com-dinamicas', vozTemporal: 'voz-temporal',
    rolesPanelAcceso: 'config-acceso', rolesModeracion: 'config-acceso', accesoAreas: 'config-acceso',
    resumenDiario: 'datos-resumen', crecimiento: 'crec-invitaciones',
};
// La sección se mira por la raíz de la ruta ('bienvenida.canalId' -> bienvenida).
const raiz = (ruta) => String(ruta).split('.')[0];
const seccionDe = (ruta) => SECCION[raiz(ruta)] || 'inicio';

// Ajustes que no se pueden deshacer desde aquí (dar o quitar acceso al panel lo
// decide solo un administrador, en su sección).
const NO_DESHACER = new Set(['rolesPanelAcceso', 'rolesModeracion', 'accesoAreas']);

const firma = (v) => JSON.stringify(v === undefined ? null : v);
const valor = (obj, ruta) => { const v = leerRuta(obj, ruta); return v === undefined ? null : v; };
// Lo guardado en el cambio para cada ruta (antes era un objeto por clave; ahora, una lista).
const guardado = (lista, claves, k) => (Array.isArray(lista) ? lista[claves.indexOf(k)] : lista?.[k]) ?? null;

// Ajustes que cambian entre dos versiones de la configuración, uno a uno
// ('bienvenida.canalId', 'autoRoles'…): así deshacer uno no toca lo demás de
// su bloque (ni lo que el bot va apuntando por su cuenta, que no se mira).
function diferencias(antes = {}, despues = {}) {
    const a = aplanar(antes || {});
    const d = aplanar(despues || {});
    const rutas = new Set([...Object.keys(a), ...Object.keys(d)]);
    return [...rutas].filter((r) => !esInterno(r) && firma(a[r]) !== firma(d[r]));
}

// Servidor al que apunta una petición del panel (la misma regla que el acceso).
function guildDeLaPeticion(req) {
    // «Copiar a otro servidor»: lo que cambia es el de destino.
    if (/^\/config\/\d{15,22}\/copiar$/.test(req.path) && typeof req.body?.destino === 'string') return req.body.destino;
    return req.query?.guildId
        || (req.path.match(/^\/[a-z-]+\/(\d{15,22})(?:\/|$)/) || [])[1]
        || (req.body && typeof req.body.guildId === 'string' ? req.body.guildId : null);
}

const METODOS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// Rutas que nunca cambian ajustes (o que se apuntan aparte): no se mira nada.
const SIN_HISTORIAL = /^\/(auth|portal|spotify|billing|cambios|mensajes|tickets|stats|sanciones|servidor\/miembro)/;

// Middleware para app.use('/api', …), después de la autenticación.
function middlewareHistorial() {
    return async (req, res, next) => {
        if (!METODOS.has(req.method) || SIN_HISTORIAL.test(req.path)) return next();
        const guildId = guildDeLaPeticion(req);
        if (!guildId) return next();
        let antes = null;
        try { antes = await ServidorConfig.findOne({ guildId }).lean(); } catch { return next(); }
        if (!antes) return next(); // aún no hay config: nada que comparar

        let registro = null; // la promesa del apunte (una sola vez por petición)
        const apuntar = () => {
            registro ??= (async () => {
                if (res.statusCode >= 400) return null;
                const despues = await ServidorConfig.findOne({ guildId }).lean();
                const claves = diferencias(antes, despues);
                if (!claves.length) return null;
                const doc = await CambioPanel.create({
                    guildId,
                    usuarioId: req.staff?.id || null,
                    usuarioNombre: req.staff?.username || (req.staff ? '' : 'API'),
                    secciones: [...new Set(claves.map(seccionDe))],
                    claves,
                    antes: claves.map((k) => valor(antes, k)),
                    despues: claves.map((k) => valor(despues, k)),
                });
                return String(doc._id);
            })().catch((e) => { console.warn('Historial de cambios:', e.message); return null; });
            return registro;
        };

        // La mayoría de rutas responden con res.json: se apunta antes de enviar,
        // para que la respuesta lleve el id del cambio.
        const json = res.json.bind(res);
        res.json = (cuerpo) => {
            apuntar().then((id) => {
                if (id && !res.headersSent) res.set('X-Sokyo-Cambio', id);
                json(cuerpo);
            });
            return res;
        };
        // Las que responden de otra forma se apuntan al terminar.
        res.on('finish', () => { apuntar(); });
        next();
    };
}

// Lista para la sección «Historial de cambios».
async function listarCambios(guildId, { limite = 50, antesDe = null } = {}) {
    const filtro = { guildId };
    if (antesDe) filtro.fecha = { $lt: new Date(antesDe) };
    return CambioPanel.find(filtro).sort({ fecha: -1 }).limit(Math.min(100, Math.max(1, limite))).lean();
}

// Vuelve a dejar los campos de un cambio como estaban. Si alguno ha vuelto a
// cambiar después, no se toca nada salvo que se pida `forzar` (se avisa antes).
async function deshacerCambio(id, quien, { forzar = false, comprobar = null } = {}) {
    const c = await CambioPanel.findById(id);
    if (!c) return { ok: false, codigo: 'no_existe' };
    if (c.deshechoEn) return { ok: false, codigo: 'ya_deshecho' };
    const claves = c.claves.filter((k) => !NO_DESHACER.has(raiz(k)) && !esInterno(k));
    if (!claves.length) return { ok: false, codigo: 'no_se_puede' };
    const actual = await ServidorConfig.findOne({ guildId: c.guildId }).lean();
    if (!actual) return { ok: false, codigo: 'no_existe' };
    const cambiadosDespues = claves.filter((k) => firma(valor(actual, k)) !== firma(guardado(c.despues, c.claves, k)));
    if (cambiadosDespues.length && !forzar) return { ok: false, codigo: 'cambiado_despues', claves: cambiadosDespues };

    const set = {};
    const unset = {};
    for (const k of claves) {
        const v = guardado(c.antes, c.claves, k);
        if (v === null || v === undefined) unset[k] = '';
        else set[k] = v;
    }
    // Quien llama puede negarse antes de escribir (p. ej. roles que no puede dar).
    if (comprobar) {
        const motivo = await comprobar({ actual, set, unset });
        if (motivo) return { ok: false, codigo: 'sin_permiso', error: motivo };
    }
    const op = {};
    if (Object.keys(set).length) op.$set = set;
    if (Object.keys(unset).length) op.$unset = unset;
    await ServidorConfig.updateOne({ guildId: c.guildId }, op, { strict: false });
    invalidateConfig(c.guildId);

    const nuevo = await CambioPanel.create({
        guildId: c.guildId,
        usuarioId: quien?.id || null,
        usuarioNombre: quien?.username || '',
        secciones: [...new Set(claves.map(seccionDe))],
        claves,
        antes: claves.map((k) => valor(actual, k)),
        despues: claves.map((k) => guardado(c.antes, c.claves, k)),
        deshaceA: c._id,
    });
    c.deshechoPor = quien?.username || quien?.id || '';
    c.deshechoEn = new Date();
    await c.save();
    return { ok: true, id: String(nuevo._id), guildId: c.guildId, claves, omitidas: c.claves.filter((k) => NO_DESHACER.has(raiz(k))) };
}

// Para enseñar un cambio: { ruta: valor } de antes y de después.
const comoMapa = (c, lista) => Object.fromEntries(c.claves.map((k) => [k, guardado(lista, c.claves, k)]));

module.exports = { middlewareHistorial, listarCambios, deshacerCambio, diferencias, guildDeLaPeticion, seccionDe, comoMapa, NO_DESHACER };

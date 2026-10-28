// Preferencias de cada persona (models/PreferenciasMiembro.js): idioma y qué
// mensajes privados quiere. Con una caché corta, porque se miran a menudo (cada
// vez que el bot va a mandar un privado o a responder a alguien).
const PreferenciasMiembro = require('../models/PreferenciasMiembro.js');
const { resolverIdioma } = require('./i18n.js');

const TIPOS_DM = ['anuncios', 'tickets', 'niveles', 'sorteos'];
const POR_DEFECTO = { idioma: 'auto', dms: { anuncios: true, tickets: true, niveles: true, sorteos: true } };
const cache = new Map(); // userId -> { t, v }
const TTL = 60 * 1000;

async function preferenciasDe(userId) {
    if (!userId) return POR_DEFECTO;
    const c = cache.get(userId);
    if (c && Date.now() - c.t < TTL) return c.v;
    let v = POR_DEFECTO;
    try {
        const doc = await PreferenciasMiembro.findOne({ userId }).lean();
        if (doc) v = { idioma: doc.idioma || 'auto', dms: { ...POR_DEFECTO.dms, ...(doc.dms || {}) } };
    } catch { /* sin BD: por defecto */ }
    if (cache.size > 5000) cache.clear();
    cache.set(userId, { t: Date.now(), v });
    return v;
}

async function guardarPreferencias(userId, cambios = {}) {
    const set = {};
    if (['auto', 'es', 'en'].includes(cambios.idioma)) set.idioma = cambios.idioma;
    for (const k of TIPOS_DM) if (cambios.dms && typeof cambios.dms[k] === 'boolean') set[`dms.${k}`] = cambios.dms[k];
    await PreferenciasMiembro.updateOne({ userId }, { $set: set, $setOnInsert: { userId } }, { upsert: true });
    cache.delete(userId);
    return preferenciasDe(userId);
}

// ¿Quiere este privado? (si no se sabe, sí: es lo que pasaba antes)
async function quiereDM(userId, tipo) {
    const p = await preferenciasDe(userId);
    return p.dms[tipo] !== false;
}

// Idioma en el que hablarle a una persona: el que eligió, si no el de su Discord
// (interaction.locale) y si no el del servidor.
async function idiomaMiembro(userId, { locale = null, cfg = null } = {}) {
    const p = await preferenciasDe(userId);
    if (p.idioma === 'es' || p.idioma === 'en') return p.idioma;
    const loc = String(locale || '');
    if (loc.startsWith('es')) return 'es';
    if (loc.startsWith('en')) return 'en';
    return resolverIdioma(cfg);
}

// Atajo para comandos y botones: idioma de quien ha interactuado.
const idiomaInteraccion = (interaction, cfg) => idiomaMiembro(interaction.user?.id, { locale: interaction.locale, cfg });

module.exports = { preferenciasDe, guardarPreferencias, quiereDM, idiomaMiembro, idiomaInteraccion, TIPOS_DM, POR_DEFECTO, _cache: cache };

// 📋 Comandos de cada servidor (1.34.0). Al escribir «/» cada servidor ve SOLO lo que tiene encendido: el bot registra
// en cada servidor sus comandos (los de los módulos activos de utils/catalogo.js y las puertas con sus partes activas).
// Globales (también por privado) solo los de catalogo.GLOBALES y el botón de la Actividad (lo crea Discord: se respeta).
// Se resincroniza al arrancar, al entrar en un servidor y cuando cambia su configuración (`programar`, con espera
// para juntar cambios). Solo se llama a Discord si lo que tocaría registrar ha cambiado (`hash`).
const crypto = require('crypto');
const C = require('./catalogo.js');
const P = require('./puertas.js');

const ESPERA_MS = 8000;
const hashes = new Map();      // guildId → hash de lo último registrado bien
const pendientes = new Map();  // guildId → temporizador
let clienteActual = null;

// Lista de comandos (JSON) para un servidor con esta config.
function comandosPara(cfg) {
    const out = [];
    for (const [nombre, m] of P.comandos()) {
        if (C.GLOBALES.has(nombre) || C.EN_PUERTA.has(nombre)) continue;
        if (!C.comandoActivo(nombre, cfg)) continue;
        out.push(m.data.toJSON());
    }
    for (const puerta of Object.keys(P.PUERTAS)) {
        const j = P.jsonPuerta(puerta, cfg);
        if (j) out.push(j);
    }
    // Comandos de servidor: sin «contexts» de privado ni instalación de usuario.
    return out.map((j) => { const { contexts, integration_types, dm_permission, ...resto } = j; return resto; })
        .sort((a, b) => a.name.localeCompare(b.name));
}
// Globales: los de catalogo.GLOBALES.
function comandosGlobales() {
    return [...P.comandos()].filter(([n]) => C.GLOBALES.has(n)).map(([, m]) => m.data.toJSON());
}
const hashDe = (lista) => crypto.createHash('sha1').update(JSON.stringify(lista)).digest('hex');

async function sincronizar(guild, { forzar = false } = {}) {
    const { getConfigCached } = require('./config.js');
    const ServidorConfig = require('../models/ServidorConfig.js');
    const cfg = await ServidorConfig.findOne({ guildId: guild.id }).lean().catch(() => null) || await getConfigCached(guild.id).catch(() => ({}));
    const lista = comandosPara(cfg || {});
    const h = hashDe(lista);
    if (!forzar && (hashes.get(guild.id) === h || cfg?.comandosServidor?.hash === h)) { hashes.set(guild.id, h); return { ok: true, igual: true, n: lista.length }; }
    // Ya falló con esta misma lista: no se insiste hasta el reintento de cada hora (`reintentar`, con forzar).
    if (!forzar && cfg?.comandosServidor?.error && cfg.comandosServidor.intento === h) return { ok: false, error: cfg.comandosServidor.error, igual: true };
    try {
        await guild.commands.set(lista);
        hashes.set(guild.id, h);
        await ServidorConfig.updateOne({ guildId: guild.id }, { $set: { comandosServidor: { hash: h, fecha: new Date(), n: lista.length, error: null } } }).catch(() => {});
        return { ok: true, n: lista.length };
    } catch (e) {
        // 50001 = el bot entró sin permiso para comandos (invitación antigua): el Diagnóstico lo avisa con el enlace.
        const error = e.code === 50001 ? 'sin-permiso' : String(e.message || e).slice(0, 200);
        await ServidorConfig.updateOne({ guildId: guild.id }, { $set: { 'comandosServidor.error': error, 'comandosServidor.intento': h, 'comandosServidor.fecha': new Date() } }).catch(() => {});
        console.warn(`Comandos de ${guild.id}:`, error);
        return { ok: false, error };
    }
}

// Tras un cambio de config: espera unos segundos (por si cambian más cosas) y resincroniza.
function programar(guildId) {
    if (!clienteActual || !guildId) return;
    clearTimeout(pendientes.get(guildId));
    const tmp = setTimeout(() => {
        pendientes.delete(guildId);
        const g = clienteActual.guilds.cache.get(guildId);
        if (g) sincronizar(g).catch((e) => console.warn('Comandos:', e.message));
    }, ESPERA_MS);
    tmp.unref?.();
    pendientes.set(guildId, tmp);
}

// Al arrancar: todos los servidores, de uno en uno y sin prisa (solo llama a Discord si algo cambió).
async function sincronizarTodos(client) {
    clienteActual = client;
    for (const g of client.guilds.cache.values()) {
        const r = await sincronizar(g).catch(() => ({ ok: false }));
        if (!r.igual) await new Promise((res) => setTimeout(res, 1500));
    }
}
const iniciar = (client) => { clienteActual = client; };
// Los que fallaron (p. ej. invitación antigua) se reintentan de vez en cuando: si el admin lo vuelve a invitar con
// permiso para comandos, no hay ningún aviso de Discord, así que se mira cada hora.
let ultimoReintento = 0;
async function reintentar(client, ahora = Date.now()) {
    if (ahora - ultimoReintento < 60 * 60 * 1000) return;
    ultimoReintento = ahora;
    const ServidorConfig = require('../models/ServidorConfig.js');
    const fallidos = await ServidorConfig.find({ 'comandosServidor.error': { $ne: null } }).select('guildId').limit(50).lean();
    for (const c of fallidos) { const g = client.guilds.cache.get(c.guildId); if (g) await sincronizar(g, { forzar: true }).catch(() => {}); }
}

module.exports = { comandosPara, comandosGlobales, sincronizar, sincronizarTodos, programar, iniciar, reintentar, hashDe };

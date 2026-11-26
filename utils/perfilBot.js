// 🎨 El bot con tu marca (2.4.0): el apodo, la foto, el banner y la descripción de Sokyo SOLO en este servidor
// (Discord deja que cada servidor tenga su perfil del bot). El apodo es gratis; foto, banner y descripción son
// de Pro (marca blanca de verdad). Si el servidor deja de ser Pro, se vuelven solos a los de Sokyo
// (`quitarSinPro`, en el programador). Discord limita los cambios de perfil: uno cada 2 min por servidor.
const ServidorConfig = require('../models/ServidorConfig.js');
const { esPro } = require('./billing.js');
const { imagenDeDataUrl, ERROR_NO_IMAGEN } = require('./imagenes.js');

const BIO_MAX = 190;
const APODO_MAX = 32;
const MAX_BYTES = 8 * 1024 * 1024;
const ESPERA_MS = 2 * 60000;
const ultimo = new Map(); // guildId → cuándo se cambió

// Lo que se ve ahora (para el panel).
function estado(guild, cfg) {
    const me = guild?.members?.me;
    const p = cfg?.perfilBot || {};
    return {
        apodo: me?.nickname || null,
        avatarUrl: me?.avatar ? me.displayAvatarURL({ size: 256 }) : null,
        avatarSokyo: guild?.client?.user?.displayAvatarURL({ size: 256 }) || null,
        bannerUrl: me?.banner ? (me.bannerURL?.({ size: 600 }) || null) : null,
        bio: p.bio || null,
        nombreBot: guild?.client?.user?.username || 'Sokyo',
        pro: esPro(cfg),
        esperaSeg: Math.max(0, Math.ceil(((ultimo.get(guild?.id) || 0) + ESPERA_MS - Date.now()) / 1000)),
        limites: { bio: BIO_MAX, apodo: APODO_MAX, mb: MAX_BYTES / 1048576 },
    };
}

// cambios: { apodo?: string|null, avatar?: dataURL|null, banner?: dataURL|null, bio?: string|null }
// (undefined = no tocar; null = volver al de Sokyo). Devuelve { ok } o { error, codigo }.
async function aplicar(guild, cfg, cambios = {}) {
    if (!guild?.members?.me) return { error: 'El bot no está en ese servidor.', codigo: 'sinServidor' };
    const pro = esPro(cfg);
    const quiere = (k) => cambios[k] !== undefined;
    if (!pro && ['avatar', 'banner', 'bio'].some((k) => quiere(k) && cambios[k] !== null)) return { error: 'La foto, el banner y la descripción del bot son de Sokyo Pro.', codigo: 'pro' };
    const desde = ultimo.get(guild.id) || 0;
    if (Date.now() - desde < ESPERA_MS) return { error: 'Discord solo deja cambiar el perfil del bot cada poco: espera un par de minutos.', codigo: 'espera', esperaSeg: Math.ceil((desde + ESPERA_MS - Date.now()) / 1000) };
    const cuerpo = {};
    if (quiere('apodo')) {
        const a = cambios.apodo === null ? null : String(cambios.apodo).trim().slice(0, APODO_MAX);
        cuerpo.nick = a || null;
    }
    if (quiere('bio')) cuerpo.bio = cambios.bio === null ? null : String(cambios.bio).trim().slice(0, BIO_MAX) || null;
    for (const k of ['avatar', 'banner']) {
        if (!quiere(k)) continue;
        if (cambios[k] === null) { cuerpo[k] = null; continue; }
        const img = imagenDeDataUrl(cambios[k]);
        if (!img) return { error: ERROR_NO_IMAGEN, codigo: 'noImagen' };
        if (img.buffer.length > MAX_BYTES) return { error: 'La imagen pesa más de 8 MB.', codigo: 'grande' };
        cuerpo[k] = `data:${img.mime};base64,${img.buffer.toString('base64')}`;
    }
    if (!Object.keys(cuerpo).length) return { ok: true, sinCambios: true };
    if (cuerpo.nick !== undefined && !guild.members.me.permissions.has('ChangeNickname')) return { error: 'Al bot le falta el permiso «Cambiar apodo» en este servidor.', codigo: 'permiso' };
    ultimo.set(guild.id, Date.now());
    try {
        await guild.client.rest.patch(`/guilds/${guild.id}/members/@me`, { body: cuerpo, reason: 'Perfil del bot desde el panel de Sokyo' });
    } catch (e) {
        ultimo.delete(guild.id);
        const msg = String(e?.message || e);
        if (/rate|too many|429/i.test(msg)) return { error: 'Discord pide esperar un poco antes de volver a cambiar el perfil.', codigo: 'espera' };
        return { error: `Discord no ha aceptado el cambio: ${msg.slice(0, 140)}`, codigo: 'discord' };
    }
    await guild.members.fetchMe?.().catch(() => null);
    const set = { 'perfilBot.actualizado': new Date() };
    if (cuerpo.nick !== undefined) set['perfilBot.apodo'] = cuerpo.nick;
    if (cuerpo.bio !== undefined) set['perfilBot.bio'] = cuerpo.bio;
    if (cuerpo.avatar !== undefined) set['perfilBot.avatar'] = !!cuerpo.avatar;
    if (cuerpo.banner !== undefined) set['perfilBot.banner'] = !!cuerpo.banner;
    await ServidorConfig.updateOne({ guildId: guild.id }, { $set: set }).catch(() => {});
    return { ok: true };
}

// Si un servidor ya no es Pro, su foto, banner y descripción vuelven a ser los de Sokyo (el apodo se queda).
async function quitarSinPro(client) {
    const lista = await ServidorConfig.find({ $or: [{ 'perfilBot.avatar': true }, { 'perfilBot.banner': true }, { 'perfilBot.bio': { $nin: [null, ''] } }] }).lean().catch(() => []);
    let n = 0;
    for (const cfg of lista) {
        if (esPro(cfg)) continue;
        const guild = client.guilds.cache.get(cfg.guildId);
        // Si el bot ya no está en ese servidor, no hay nada que quitar: se limpia la marca para no mirarlo más.
        if (!guild) { await ServidorConfig.updateOne({ guildId: cfg.guildId }, { $set: { 'perfilBot.avatar': false, 'perfilBot.banner': false, 'perfilBot.bio': null } }).catch(() => {}); continue; }
        if (Date.now() - (ultimo.get(guild.id) || 0) < ESPERA_MS) continue; // se acaba de cambiar: en la próxima vuelta
        try {
            ultimo.set(guild.id, Date.now());
            await client.rest.patch(`/guilds/${guild.id}/members/@me`, { body: { avatar: null, banner: null, bio: null }, reason: 'El servidor ya no es Pro' });
            await ServidorConfig.updateOne({ guildId: cfg.guildId }, { $set: { 'perfilBot.avatar': false, 'perfilBot.banner': false, 'perfilBot.bio': null } });
            n++;
        } catch (e) { console.warn('Perfil del bot (quitar):', e.message); }
    }
    return n;
}

const _reiniciar = () => ultimo.clear();
module.exports = { estado, aplicar, quitarSinPro, BIO_MAX, APODO_MAX, ESPERA_MS, _reiniciar };

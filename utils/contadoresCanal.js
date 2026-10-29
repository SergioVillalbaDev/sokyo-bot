// Canales con contadores en el nombre («👥 Miembros: 1.234»): canales de voz
// cerrados (nadie puede entrar) arriba del todo, que el bot renombra con la cifra
// al día. Discord solo deja renombrar un canal 2 veces cada 10 minutos, así que se
// actualizan cada 10 minutos y solo si la cifra ha cambiado.
const { ChannelType, PermissionsBitField, OverwriteType } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const Ticket = require('../models/Ticket.js');
const { t } = require('./i18n.js');

const ENTRE_CAMBIOS = 10.5 * 60 * 1000;
const ultimoCambio = new Map(); // canalId -> momento del último cambio de nombre

// Tipos de contador: [clave, plantilla es, plantilla en].
const TIPOS = [
    ['miembros', '👥 Miembros: {n}', '👥 Members: {n}'],
    ['personas', '🙋 Personas: {n}', '🙋 Humans: {n}'],
    ['bots', '🤖 Bots: {n}', '🤖 Bots: {n}'],
    ['enVoz', '🔊 En voz: {n}', '🔊 In voice: {n}'],
    ['boosts', '💎 Mejoras: {n}', '💎 Boosts: {n}'],
    ['canales', '💬 Canales: {n}', '💬 Channels: {n}'],
    ['roles', '🎭 Roles: {n}', '🎭 Roles: {n}'],
    ['tickets', '🎫 Tickets abiertos: {n}', '🎫 Open tickets: {n}'],
];
const CLAVES = TIPOS.map(([k]) => k);
const plantillaPorDefecto = (tipo, idioma) => {
    const fila = TIPOS.find(([k]) => k === tipo) || TIPOS[0];
    return t(idioma, fila[1], fila[2]);
};

// Valor de un contador. `personas`/`bots` necesitan la lista de miembros entera.
async function valor(guild, tipo) {
    switch (tipo) {
        case 'personas': return guild.members.cache.filter((m) => !m.user.bot).size;
        case 'bots': return guild.members.cache.filter((m) => m.user.bot).size;
        case 'enVoz': return guild.voiceStates.cache.filter((v) => v.channelId && v.member && !v.member.user.bot).size;
        case 'boosts': return guild.premiumSubscriptionCount || 0;
        case 'canales': return guild.channels.cache.filter((c) => c.type !== ChannelType.GuildCategory && !c.isThread()).size;
        case 'roles': return Math.max(0, guild.roles.cache.size - 1);
        case 'tickets': return Ticket.countDocuments({ guildId: guild.id, estado: { $ne: 'Cerrado' } });
        default: return guild.memberCount || 0;
    }
}

const formatear = (n, idioma) => Number(n || 0).toLocaleString(t(idioma, 'es-ES', 'en-US'));
const nombreCanal = (plantilla, n, idioma) => String(plantilla || '{n}').replace(/\{n\}/g, formatear(n, idioma)).slice(0, 100);

// La lista de miembros completa (para personas/bots), como mucho una vez cada pasada.
async function asegurarMiembros(guild) {
    if (guild.members.cache.size >= guild.memberCount) return;
    if (guild.memberCount > 20000) return; // servidores enormes: se cuenta con lo que haya
    await guild.members.fetch().catch(() => {});
}

// Renombra los contadores de un servidor (los que hayan cambiado y se puedan tocar ya).
async function actualizarServidor(guild, cfg, { forzar = false } = {}) {
    const lista = cfg.contadoresCanal || [];
    if (lista.some((c) => ['personas', 'bots'].includes(c.tipo))) await asegurarMiembros(guild);
    let cambiados = 0;
    for (const c of lista) {
        const canal = guild.channels.cache.get(c.canalId);
        if (!canal) continue;
        const nuevo = nombreCanal(c.plantilla || plantillaPorDefecto(c.tipo, cfg), await valor(guild, c.tipo), cfg);
        if (canal.name === nuevo) continue;
        if (!forzar && Date.now() - (ultimoCambio.get(canal.id) || 0) < ENTRE_CAMBIOS) continue;
        ultimoCambio.set(canal.id, Date.now());
        // Sin esperar: si Discord lo retiene por el límite, no bloquea lo demás.
        canal.setName(nuevo, t(cfg, 'Contador del servidor', 'Server counter')).catch(() => {});
        cambiados++;
    }
    return cambiados;
}

async function barrerContadores(client) {
    const cfgs = await ServidorConfig.find({ 'contadoresCanal.0': { $exists: true } }).select('guildId contadoresCanal idioma').lean();
    for (const cfg of cfgs) {
        const guild = client.guilds.cache.get(cfg.guildId);
        if (!guild) continue;
        try { await actualizarServidor(guild, cfg); } catch (e) { console.error(`Contadores ${cfg.guildId}:`, e.message); }
    }
}

// Crea el canal de un contador: de voz, cerrado (se ve pero no se entra), arriba del todo.
async function crearCanal(guild, { tipo, plantilla, categoriaId = null }, idioma) {
    const me = guild.members.me;
    const n = await valor(guild, tipo);
    return guild.channels.create({
        name: nombreCanal(plantilla || plantillaPorDefecto(tipo, idioma), n, idioma),
        type: ChannelType.GuildVoice,
        ...(categoriaId && guild.channels.cache.has(categoriaId) ? { parent: categoriaId } : {}),
        position: 0,
        permissionOverwrites: [
            { id: guild.id, type: OverwriteType.Role, allow: [PermissionsBitField.Flags.ViewChannel], deny: [PermissionsBitField.Flags.Connect] },
            ...(me ? [{ id: me.id, type: OverwriteType.Member, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.ManageChannels] }] : []),
        ],
        reason: t(idioma, 'Contador del servidor', 'Server counter'),
    });
}

module.exports = { TIPOS, CLAVES, valor, nombreCanal, plantillaPorDefecto, actualizarServidor, barrerContadores, crearCanal };

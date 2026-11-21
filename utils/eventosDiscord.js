// Eventos nativos de Discord (1.10.0): un evento del panel (models/Evento.js) puede
// salir también en la pestaña «Eventos» del servidor, donde la gente pulsa
// «Me interesa» y Discord les avisa al empezar. Y un premio por asistir: a los 15 min
// de empezar, quien esté en el canal de voz del evento se lleva oro y/o XP (una vez).
const { GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel, ChannelType } = require('discord.js');
const Evento = require('../models/Evento.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { t } = require('./i18n.js');

const MIN_PARA_PREMIO = 15;

// Datos del evento para Discord (pura, la prueban los tests). { opciones } o { error }.
function opcionesDiscord(ev, guild) {
    const base = {
        name: String(ev.titulo || '').slice(0, 100),
        description: String(ev.descripcion || '').slice(0, 1000) || undefined,
        scheduledStartTime: new Date(ev.fechaInicio),
        privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
    };
    if (ev.tipo === 'externo') {
        const fin = new Date(new Date(ev.fechaInicio).getTime() + Math.max(15, Math.min(24 * 60, ev.duracionMin || 60)) * 60000);
        return { opciones: { ...base, entityType: GuildScheduledEventEntityType.External, scheduledEndTime: fin, entityMetadata: { location: String(ev.lugar || '').slice(0, 100) || 'Discord' } } };
    }
    const canal = ev.canalVozId ? guild.channels.cache.get(ev.canalVozId) : null;
    if (ev.tipo === 'escenario') {
        if (!canal || canal.type !== ChannelType.GuildStageVoice) return { error: 'Elige un canal de escenario para el evento de Discord' };
        return { opciones: { ...base, entityType: GuildScheduledEventEntityType.StageInstance, channel: canal.id } };
    }
    if (!canal || canal.type !== ChannelType.GuildVoice) return { error: 'Elige un canal de voz para el evento de Discord' };
    return { opciones: { ...base, entityType: GuildScheduledEventEntityType.Voice, channel: canal.id } };
}

// Explica los fallos típicos de Discord con palabras normales.
function errorDiscord(e) {
    if (e?.code === 50013) return 'El bot necesita el permiso «Gestionar eventos» en el servidor';
    return `Discord no ha aceptado el evento (${e?.message || 'error desconocido'})`;
}

// Crea o actualiza el evento en Discord. Devuelve null si todo fue bien, o el error.
async function sincronizar(client, ev) {
    const guild = client.guilds.cache.get(ev.guildId);
    if (!guild) return 'Servidor no encontrado';
    if (!ev.enDiscord) return borrar(client, ev).then(() => null);
    const { opciones, error } = opcionesDiscord(ev, guild);
    if (error) return error;
    try {
        const existente = ev.discordEventId ? await guild.scheduledEvents.fetch(ev.discordEventId).catch(() => null) : null;
        if (existente) await existente.edit(opciones);
        else {
            const creado = await guild.scheduledEvents.create(opciones);
            await Evento.updateOne({ _id: ev._id }, { $set: { discordEventId: creado.id } });
            ev.discordEventId = creado.id;
        }
        return null;
    } catch (e) { return errorDiscord(e); }
}

async function borrar(client, ev) {
    if (!ev.discordEventId) return;
    const guild = client.guilds.cache.get(ev.guildId);
    if (guild) await guild.scheduledEvents.delete(ev.discordEventId).catch(() => {});
    await Evento.updateOne({ _id: ev._id }, { $set: { discordEventId: null } }).catch(() => {});
    ev.discordEventId = null;
}

// Programador: premio a quien está en el canal de voz a los 15 min de empezar.
async function premiarAsistencia(client) {
    const ahora = Date.now();
    const eventos = await Evento.find({
        premioDado: { $ne: true },
        tipo: { $in: ['voz', 'escenario'] },
        canalVozId: { $ne: null },
        $or: [{ premioOro: { $gt: 0 } }, { premioXp: { $gt: 0 } }],
        fechaInicio: { $lte: new Date(ahora - MIN_PARA_PREMIO * 60000), $gte: new Date(ahora - 6 * 3600 * 1000) },
    }).limit(50);
    for (const ev of eventos) {
        const reservado = await Evento.findOneAndUpdate({ _id: ev._id, premioDado: { $ne: true } }, { $set: { premioDado: true } });
        if (!reservado) continue;
        try {
            const guild = client.guilds.cache.get(ev.guildId);
            const voz = guild?.channels.cache.get(ev.canalVozId);
            if (!voz) continue;
            const cfg = await ServidorConfig.findOne({ guildId: ev.guildId });
            const presentes = [...voz.members.values()].filter((m) => !m.user.bot);
            const canalTexto = guild.channels.cache.get(ev.canalId);
            const { darRecompensa } = require('./dinamicas.js');
            const xp = cfg?.nivelesActivo ? ev.premioXp : 0;
            for (const m of presentes) await darRecompensa(guild, m, { oro: ev.premioOro, xp }, cfg || {}, canalTexto);
            if (presentes.length && canalTexto?.isTextBased()) {
                const premio = [ev.premioOro > 0 ? `${ev.premioOro} 🪙` : '', xp > 0 ? `${xp} XP` : ''].filter(Boolean).join(' + ');
                await canalTexto.send({
                    content: t(cfg, `🎁 **${ev.titulo}**: ${presentes.length} ${presentes.length === 1 ? 'persona se lleva' : 'personas se llevan'} ${premio} por asistir. ¡Gracias por venir!`,
                        `🎁 **${ev.titulo}**: ${presentes.length} ${presentes.length === 1 ? 'person gets' : 'people get'} ${premio} for attending. Thanks for coming!`),
                    allowedMentions: { parse: [] },
                }).catch(() => {});
            }
        } catch (e) { console.error('Eventos · premio por asistir:', e.message); }
    }
}

module.exports = { opcionesDiscord, errorDiscord, sincronizar, borrar, premiarAsistencia, MIN_PARA_PREMIO };

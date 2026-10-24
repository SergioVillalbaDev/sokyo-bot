// ============================================================================
// bump — Crecimiento: recordatorio de bump de DISBOARD.
//
// En DISBOARD (el directorio de servidores más usado) un servidor sube a la parte
// alta de la lista cada vez que alguien usa su comando /bump, y se puede repetir
// cada 2 horas. Un bot no puede usar comandos de otro bot, así que Sokyo no lo
// hace por su cuenta: lee la respuesta de DISBOARD para saber cuándo se hizo,
// premia con oro a quien lo hizo y avisa (mencionando a un rol) cuando ya se
// puede volver a hacer.
// ============================================================================
const ServidorConfig = require('../models/ServidorConfig.js');
const Bump = require('../models/Bump.js');
const { getConfigCached } = require('./config.js');
const { t } = require('./i18n.js');

const DISBOARD_ID = '302050872383242240';
const ESPERA_MIN = 120; // DISBOARD deja hacer bump cada 2 horas

// DISBOARD responde con un mensaje de "pensando…" y luego lo edita con el
// resultado, así que un mismo mensaje llega por messageCreate y messageUpdate.
const vistos = new Set();
function yaVisto(id) {
    if (vistos.has(id)) return true;
    vistos.add(id);
    if (vistos.size > 500) vistos.delete(vistos.values().next().value);
    return false;
}

// ¿Qué dice este mensaje de DISBOARD? Devuelve { tipo: 'exito' | 'espera', minutos, usuarioId } o null.
// - Éxito: "Bump done! :thumbsup:" (o su traducción) con la imagen de bump.
// - Espera: "Please wait another 87 minutes until the server can be bumped" (o traducido).
function analizarMensaje(message) {
    const embed = message.embeds && message.embeds[0];
    if (!embed) return null;
    const texto = `${embed.title || ''} ${embed.description || ''}`;
    const imagen = (embed.image && embed.image.url) || '';
    const usuarioId = (message.interactionMetadata && message.interactionMetadata.user && message.interactionMetadata.user.id)
        || (message.interaction && message.interaction.user && message.interaction.user.id)
        || ((texto.match(/<@!?(\d{15,25})>/) || [])[1])
        || null;

    const exito = /bump done|bump effectu|bump erfolgreich|bump realizado|bump hecho|bump fatto|bump concluído|bump concluido/i.test(texto)
        || /:thumbsup:|👍/.test(texto)
        || /bump/i.test(imagen);
    if (exito) return { tipo: 'exito', minutos: ESPERA_MIN, usuarioId };

    const espera = texto.match(/(\d{1,3})\s*(?:minutes?|minutos?|minuten|minuti|min\b)/i);
    if (espera) return { tipo: 'espera', minutos: Math.min(ESPERA_MIN, parseInt(espera[1], 10)), usuarioId };
    return null;
}

// Rellena los marcadores de los textos del bump.
function rellenar(texto, datos) {
    return String(texto || '')
        .replace(/{mention}/g, datos.mention || '')
        .replace(/{user}/g, datos.user || '')
        .replace(/{next}/g, datos.next || '')
        .replace(/{server}/g, datos.server || '');
}

// Mensaje de DISBOARD visto (messageCreate / messageUpdate).
async function procesarMensaje(message) {
    if (!message.guild || !message.author || message.author.id !== DISBOARD_ID) return;
    const cfg = await getConfigCached(message.guild.id);
    const conf = cfg && cfg.crecimiento && cfg.crecimiento.bump;
    if (!conf || !conf.activo) return;
    const r = analizarMensaje(message);
    if (!r || yaVisto(message.id)) return;

    const proximo = new Date(Date.now() + r.minutos * 60 * 1000);
    if (r.tipo === 'espera') {
        // Alguien lo intentó antes de tiempo: ajustamos la hora del aviso.
        const actual = conf.proximoBump ? new Date(conf.proximoBump).getTime() : 0;
        if (Math.abs(actual - proximo.getTime()) > 2 * 60 * 1000) {
            await ServidorConfig.updateOne({ guildId: message.guild.id }, { $set: {
                'crecimiento.bump.proximoBump': proximo,
                'crecimiento.bump.recordado': false,
                'crecimiento.bump.ultimoCanalId': message.channelId,
            } });
        }
        return;
    }

    // Bump hecho: se apunta, se borra el aviso anterior, se premia y se da las gracias.
    await ServidorConfig.updateOne({ guildId: message.guild.id }, { $set: {
        'crecimiento.bump.proximoBump': proximo,
        'crecimiento.bump.recordado': false,
        'crecimiento.bump.ultimoCanalId': message.channelId,
        'crecimiento.bump.ultimoBumpPor': r.usuarioId,
        'crecimiento.bump.ultimoBumpFecha': new Date(),
        'crecimiento.bump.ultimoAvisoId': null,
    } });
    await Bump.create({ guildId: message.guild.id, userId: r.usuarioId, canalId: message.channelId });

    if (conf.ultimoAvisoId) {
        const canalAviso = message.guild.channels.cache.get(conf.canalId || conf.ultimoCanalId);
        if (canalAviso && canalAviso.isTextBased()) {
            const viejo = await canalAviso.messages.fetch(conf.ultimoAvisoId).catch(() => null);
            if (viejo && viejo.author.id === message.client.user.id) await viejo.delete().catch(() => {});
        }
    }

    const oro = Math.max(0, conf.oroPorBump || 0);
    if (oro > 0 && r.usuarioId) await require('./economia.js').darOro(r.usuarioId, oro).catch((e) => console.error('Oro por bump:', e.message));

    let texto = rellenar(conf.mensajeGracias || t(cfg, '🙌 ¡Gracias por el bump, {mention}! Próximo bump {next}.', '🙌 Thanks for the bump, {mention}! Next bump {next}.'), {
        mention: r.usuarioId ? `<@${r.usuarioId}>` : t(cfg, 'equipo', 'team'),
        user: r.usuarioId ? ((await message.client.users.fetch(r.usuarioId).catch(() => null))?.username || '') : '',
        next: `<t:${Math.floor(proximo.getTime() / 1000)}:R>`,
        server: message.guild.name,
    });
    if (oro > 0 && r.usuarioId) texto += ` · +${oro} 🪙`;
    await message.channel.send({ content: texto.slice(0, 2000), allowedMentions: { parse: [] } }).catch(() => {});
}

// Barrido periódico: avisa en los servidores a los que ya les toca bump.
async function barrerBumps(client) {
    const pendientes = await ServidorConfig.find({
        'crecimiento.bump.activo': true,
        'crecimiento.bump.recordado': false,
        'crecimiento.bump.proximoBump': { $lte: new Date() },
    }).select('guildId idioma crecimiento.bump').limit(100);
    for (const cfg of pendientes) {
        const conf = cfg.crecimiento.bump;
        try {
            const guild = client.guilds.cache.get(cfg.guildId);
            const canal = guild && guild.channels.cache.get(conf.canalId || conf.ultimoCanalId);
            let avisoId = null;
            if (canal && canal.isTextBased()) {
                const rol = conf.rolId && guild.roles.cache.get(conf.rolId);
                const texto = `${rol ? `<@&${rol.id}> ` : ''}${conf.mensajeRecordatorio || t(cfg, '⏰ ¡Ya se puede volver a hacer bump! Usa `/bump` de DISBOARD y gana oro 🪙', '⏰ The server can be bumped again! Use `/bump` from DISBOARD and earn gold 🪙')}`;
                const msg = await canal.send({ content: texto.slice(0, 2000), allowedMentions: { roles: rol ? [rol.id] : [] } }).catch(() => null);
                avisoId = msg ? msg.id : null;
            }
            // Avisado (o sin canal donde avisar): no se repite hasta el próximo bump.
            await ServidorConfig.updateOne({ guildId: cfg.guildId }, { $set: {
                'crecimiento.bump.recordado': true,
                'crecimiento.bump.ultimoAvisoId': avisoId,
            } });
        } catch (e) { console.error('Aviso de bump:', e.message); }
    }
}

// Ranking de quien más bumps ha hecho (desde `desde`, o de siempre).
async function rankingBumps(guildId, { desde = null, limite = 10 } = {}) {
    const match = { guildId, userId: { $ne: null } };
    if (desde) match.fecha = { $gte: new Date(desde) };
    const filas = await Bump.aggregate([
        { $match: match },
        { $group: { _id: '$userId', n: { $sum: 1 }, ultimo: { $max: '$fecha' } } },
        { $sort: { n: -1, ultimo: -1 } },
        { $limit: limite },
    ]);
    return filas.map((f) => ({ userId: f._id, bumps: f.n, ultimo: f.ultimo }));
}

module.exports = { DISBOARD_ID, ESPERA_MIN, analizarMensaje, procesarMensaje, barrerBumps, rankingBumps };

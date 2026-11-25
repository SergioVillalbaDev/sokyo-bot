// Temporadas (1.10.0): un ranking de XP que vuelve a empezar cada mes (o cada semana)
// sin tocar los niveles de nadie. La XP de temporada se suma en niveles.aplicarXp
// (ActividadUsuario.xpTemporada). Al cerrar: podio en el canal, oro para el 1.º, 2.º y
// 3.º y el rol de campeón para el ganador (se le quita al de la temporada anterior).
// Lo llama el programador (utils/scheduler.js) y el panel (api/routes/modulos.js).
const { EmbedBuilder } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const ActividadUsuario = require('../models/ActividadUsuario.js');
const { t } = require('./i18n.js');

const MEDALLAS = ['🥇', '🥈', '🥉'];

// Cuándo acaba una temporada que empieza en `desde` (UTC): el día 1 del mes siguiente
// a las 00:00, o el lunes siguiente a las 00:00.
function finDeTemporada(desde, duracion = 'mensual') {
    const d = new Date(desde);
    if (duracion === 'semanal') {
        const dia = d.getUTCDay(); // 0 domingo … 1 lunes
        const hastaLunes = ((8 - dia) % 7) || 7;
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + hastaLunes));
    }
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

// Los premios de oro siempre son 3 números enteros >= 0.
function oroPodio(oro) {
    const lista = Array.isArray(oro) ? oro : [];
    return [0, 1, 2].map((i) => require('./limites.js').topeOro('temporadas.oro', lista[i]));
}

// Ranking de la temporada. Con `guild`, solo cuenta quien sigue en el servidor y no tiene
// ninguno de los roles excluidos (p. ej. el staff): esos no compiten ni cobran premios.
async function ranking(guildId, limite = 10, { guild = null, excluir = [] } = {}) {
    const filas = await ActividadUsuario.find({ guildId, xpTemporada: { $gt: 0 } })
        .sort({ xpTemporada: -1 }).limit(guild ? Math.min(60, limite * 3) : limite).select('userId usuarioTag xpTemporada').lean();
    if (!guild) return filas;
    const fuera = new Set(excluir || []);
    const validos = [];
    for (const f of filas) {
        if (validos.length >= limite) break;
        const m = guild.members.cache.get(f.userId) || await guild.members.fetch(f.userId).catch(() => null);
        if (!m || m.user?.bot) continue;
        if (fuera.size && m.roles?.cache?.some((r) => fuera.has(r.id))) continue;
        validos.push(f);
    }
    return validos;
}

// Posición (1, 2…) de un usuario en la temporada; null si aún no tiene XP de temporada.
async function posicion(guildId, userId) {
    const yo = await ActividadUsuario.findOne({ guildId, userId }).select('xpTemporada').lean();
    if (!yo || !(yo.xpTemporada > 0)) return null;
    const delante = await ActividadUsuario.countDocuments({ guildId, xpTemporada: { $gt: yo.xpTemporada } });
    return { puesto: delante + 1, xp: yo.xpTemporada };
}

// Empieza una temporada nueva (la XP de temporada vuelve a 0). Con `guild`, la anuncia
// en el canal si está activado «Avisar cuando empieza».
async function iniciarTemporada(guildId, duracion, numero, { guild = null } = {}) {
    const ahora = new Date();
    await ActividadUsuario.updateMany({ guildId, xpTemporada: { $ne: 0 } }, { $set: { xpTemporada: 0 } });
    const cfg = await ServidorConfig.findOneAndUpdate(
        { guildId },
        { $set: { 'temporadas.inicio': ahora, 'temporadas.fin': finDeTemporada(ahora, duracion), 'temporadas.numero': numero } },
        { returnDocument: 'after' },
    );
    const tp = cfg?.temporadas;
    const canal = guild && tp?.anunciarInicio !== false && tp.canalId ? guild.channels.cache.get(tp.canalId) : null;
    if (canal?.isTextBased()) {
        const fin = Math.floor(tp.fin.getTime() / 1000);
        await canal.send({
            content: t(cfg, `🏁 ¡Empieza la **temporada ${numero}**! Todos empezáis de cero: el que más XP gane hasta <t:${fin}:D> se lleva el premio. Mira el ranking con \`/comunidad temporada\`.`,
                `🏁 **Season ${numero}** starts now! Everyone starts from zero: whoever earns the most XP until <t:${fin}:D> wins. Check the ranking with \`/community season\`.`),
            allowedMentions: { parse: [] },
        }).catch(() => {});
    }
    return cfg;
}

function embedPodio(cfg, guild, lista, numero) {
    const lineas = lista.map((r, i) => `${MEDALLAS[i] || `**${i + 1}.**`} <@${r.userId}> · ${r.xpTemporada.toLocaleString('es-ES')} XP`);
    const oro = oroPodio(cfg.temporadas?.oro);
    const premios = oro.map((o, i) => (o > 0 ? `${MEDALLAS[i]} ${o.toLocaleString('es-ES')} 🪙` : null)).filter(Boolean).join(' · ');
    const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle(t(cfg, `🏆 Fin de la temporada ${numero}`, `🏆 Season ${numero} is over`))
        .setDescription([
            lineas.length ? lineas.join('\n') : t(cfg, 'Nadie ha ganado XP esta temporada.', 'Nobody earned XP this season.'),
            premios ? `\n${t(cfg, 'Premios', 'Prizes')}: ${premios}` : '',
            `\n${t(cfg, '¡Empieza la temporada', 'Season')} ${numero + 1}${t(cfg, '! Todos empezáis de cero.', ' starts now! Everyone starts from zero.')}`,
        ].join('\n'))
        .setFooter({ text: guild.name });
    if (guild.iconURL()) embed.setThumbnail(guild.iconURL({ size: 128 }));
    return embed;
}

// Cierra la temporada: reparte premios, anuncia el podio y empieza la siguiente.
// Primero «reserva» el cierre en la BD (cambia `fin`): si dos procesos llegan a la vez,
// solo uno lo consigue y nadie cobra dos veces.
async function cerrarTemporada(client, guild, cfg) {
    const tp = cfg.temporadas || {};
    const numero = tp.numero || 1;
    const ahora = new Date();
    const reservado = await ServidorConfig.findOneAndUpdate(
        { guildId: guild.id, 'temporadas.fin': tp.fin || null },
        { $set: { 'temporadas.fin': finDeTemporada(ahora, tp.duracion), 'temporadas.inicio': ahora, 'temporadas.numero': numero + 1 } },
        { returnDocument: 'after' },
    );
    if (!reservado) return null;

    const lista = await ranking(guild.id, 10, { guild, excluir: tp.excluirRoles });
    const oro = oroPodio(tp.oro);
    const eco = require('./economia.js').en(guild.id);
    for (let i = 0; i < Math.min(3, lista.length); i++) {
        if (oro[i] > 0) await eco.darOro(lista[i].userId, oro[i]).catch((e) => console.error('Temporadas · oro:', e.message));
    }

    // Rol de campeón: se le quita al anterior y se le da al nuevo.
    let campeonId = tp.campeonId || null;
    const rolCampeon = tp.rolCampeonId ? guild.roles.cache.get(tp.rolCampeonId) : null;
    if (rolCampeon && !require('./permisos.js').errorRolPeligroso(rolCampeon)) {
        if (campeonId && campeonId !== lista[0]?.userId) {
            const anterior = await guild.members.fetch(campeonId).catch(() => null);
            if (anterior) await anterior.roles.remove(tp.rolCampeonId, 'Fin de temporada').catch(() => {});
        }
        if (lista[0]) {
            const nuevo = await guild.members.fetch(lista[0].userId).catch(() => null);
            if (nuevo) await nuevo.roles.add(tp.rolCampeonId, `Campeón de la temporada ${numero}`).catch(() => {});
        }
    }
    campeonId = lista[0]?.userId || null;

    const canal = tp.canalId ? guild.channels.cache.get(tp.canalId) : null;
    if (canal?.isTextBased()) {
        const menciones = tp.mencionar === false ? [] : lista.slice(0, 3).map((r) => r.userId);
        await canal.send({ embeds: [embedPodio(cfg, guild, lista, numero)], allowedMentions: { users: menciones } })
            .catch((e) => console.error('Temporadas · anuncio:', e.message));
    }

    await ActividadUsuario.updateMany({ guildId: guild.id, xpTemporada: { $ne: 0 } }, { $set: { xpTemporada: 0 } });
    await ServidorConfig.updateOne({ guildId: guild.id }, { $set: { 'temporadas.campeonId': campeonId } });
    return { numero, ganadores: lista.slice(0, 3) };
}

// Programador: empieza las temporadas recién activadas y cierra las que han acabado.
async function barrerTemporadas(client) {
    const ahora = new Date();
    const cfgs = await ServidorConfig.find({ 'temporadas.activo': true }).select('guildId idioma temporadas');
    for (const cfg of cfgs) {
        const guild = client.guilds.cache.get(cfg.guildId);
        if (!guild) continue;
        try {
            const tp = cfg.temporadas;
            if (!tp.fin) await iniciarTemporada(guild.id, tp.duracion, Math.max(1, tp.numero || 1), { guild });
            else if (tp.fin <= ahora) await cerrarTemporada(client, guild, cfg);
        } catch (e) { console.error('Temporadas:', guild.id, e.message); }
    }
}

module.exports = { finDeTemporada, oroPodio, ranking, posicion, iniciarTemporada, cerrarTemporada, barrerTemporadas, embedPodio };

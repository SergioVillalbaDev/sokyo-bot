// Clanes: equipos de miembros que compiten cada semana. Cada punto de XP que gana un
// miembro (niveles.aplicarXp) suma para su clan. El lunes se cierra la semana: el
// clan con más puntos gana, sus miembros reciben el premio (oro y/o XP) y se anuncia
// en el canal elegido. Se gestionan con /clan (crear, unirme, salir, info, ranking,
// expulsar) y desde el panel.
const { EmbedBuilder } = require('discord.js');
const Clan = require('../models/Clan.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const economia = require('./economia.js');
const { semanaISO } = require('./dinamicas.js');
const { t } = require('./i18n.js');

const clave = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const MEDALLAS = ['🥇', '🥈', '🥉'];

const clanDe = (guildId, userId) => Clan.findOne({ guildId, miembros: userId });
const buscar = (guildId, nombre) => Clan.findOne({ guildId, nombreClave: clave(nombre) });

// Un nombre válido: 3-32 letras, sin menciones, enlaces ni formato de Discord.
function nombreValido(nombre) {
    const n = String(nombre || '').trim();
    return n.length >= 3 && n.length <= 32 && !/[<>@#`*_~|]|https?:/i.test(n);
}
// Un emoji normal (no de servidor): uno o dos caracteres «de dibujo».
const emojiValido = (e) => !e || (/^\p{Extended_Pictographic}/u.test(e) && [...e].length <= 4);

async function crear(guildId, userId, cfg, nombre, emoji, idioma) {
    const c = cfg?.clanes;
    if (!c?.activo) return { error: t(idioma, '🛡️ Los clanes no están activados en este servidor.', '🛡️ Clans aren’t turned on on this server.') };
    if (!nombreValido(nombre)) return { error: t(idioma, 'El nombre debe tener entre 3 y 32 letras, sin menciones ni enlaces.', 'The name must be 3 to 32 characters, with no mentions or links.') };
    if (!emojiValido(emoji)) return { error: t(idioma, 'El emoji debe ser uno normal (por ejemplo 🐺).', 'The emoji must be a regular one (e.g. 🐺).') };
    if (await clanDe(guildId, userId)) return { error: t(idioma, 'Ya estás en un clan. Sal de él antes de fundar otro.', 'You’re already in a clan. Leave it before founding another.') };
    if (await buscar(guildId, nombre)) return { error: t(idioma, 'Ya hay un clan con ese nombre.', 'There’s already a clan with that name.') };
    const coste = Math.max(0, c.costeCrear || 0);
    if (coste > 0) {
        const u = await economia.obtenerUsuario(userId);
        if ((u.balance || 0) < coste) return { error: t(idioma, `Fundar un clan cuesta 🪙 ${coste} y tienes 🪙 ${u.balance || 0}.`, `Founding a clan costs 🪙 ${coste} and you have 🪙 ${u.balance || 0}.`) };
        await economia.darOro(userId, -coste);
    }
    try {
        const clan = await Clan.create({ guildId, nombre: nombre.trim(), nombreClave: clave(nombre), emoji: emoji || '🛡️', liderId: userId, miembros: [userId] });
        return { ok: true, clan, coste };
    } catch {
        if (coste > 0) await economia.darOro(userId, coste); // otro lo fundó a la vez: se devuelve el oro
        return { error: t(idioma, 'Ya hay un clan con ese nombre.', 'There’s already a clan with that name.') };
    }
}

async function unirse(guildId, userId, cfg, nombre, idioma) {
    if (!cfg?.clanes?.activo) return { error: t(idioma, '🛡️ Los clanes no están activados en este servidor.', '🛡️ Clans aren’t turned on on this server.') };
    if (await clanDe(guildId, userId)) return { error: t(idioma, 'Ya estás en un clan. Sal de él primero con /clan salir.', 'You’re already in a clan. Leave it first with /clan leave.') };
    const objetivo = await buscar(guildId, nombre);
    if (!objetivo) return { error: t(idioma, 'No hay ningún clan con ese nombre. Mira la lista con /clan ranking.', 'There’s no clan with that name. See the list with /clan ranking.') };
    const max = Math.max(2, cfg.clanes.maxMiembros || 10);
    const clan = await Clan.findOneAndUpdate(
        { _id: objetivo._id, miembros: { $ne: userId }, $expr: { $lt: [{ $size: '$miembros' }, max] } },
        { $push: { miembros: userId } }, { returnDocument: 'after' },
    );
    if (!clan) return { error: t(idioma, `**${objetivo.nombre}** está lleno (${max} miembros como mucho).`, `**${objetivo.nombre}** is full (${max} members max).`) };
    return { ok: true, clan };
}

// Salir del clan. Si se va el líder, lo pasa a quien más tiempo lleve; si no queda nadie, el clan desaparece.
async function salir(guildId, userId, idioma) {
    const clan = await clanDe(guildId, userId);
    if (!clan) return { error: t(idioma, 'No estás en ningún clan.', 'You’re not in any clan.') };
    clan.miembros = clan.miembros.filter((m) => m !== userId);
    if (!clan.miembros.length) { await clan.deleteOne(); return { ok: true, clan, disuelto: true }; }
    let nuevoLider = null;
    if (clan.liderId === userId) { clan.liderId = clan.miembros[0]; nuevoLider = clan.liderId; }
    await clan.save();
    return { ok: true, clan, nuevoLider };
}

async function expulsar(guildId, liderId, objetivoId, idioma) {
    const clan = await clanDe(guildId, liderId);
    if (!clan || clan.liderId !== liderId) return { error: t(idioma, 'Solo el líder del clan puede echar a alguien.', 'Only the clan leader can remove someone.') };
    if (objetivoId === liderId) return { error: t(idioma, 'No puedes echarte a ti. Usa /clan salir.', 'You can’t remove yourself. Use /clan leave.') };
    if (!clan.miembros.includes(objetivoId)) return { error: t(idioma, 'Esa persona no está en tu clan.', 'That person isn’t in your clan.') };
    clan.miembros = clan.miembros.filter((m) => m !== objetivoId);
    await clan.save();
    return { ok: true, clan };
}

// Cada XP que gana alguien suma para su clan (lo llama niveles.aplicarXp).
async function sumarPuntos(guildId, userId, puntos) {
    const n = Math.max(0, Math.round(puntos || 0));
    if (!n) return;
    await Clan.updateOne({ guildId, miembros: userId }, { $inc: { puntosSemana: n, puntosTotal: n } });
}

const ranking = (guildId, limite = 10) => Clan.find({ guildId }).sort({ puntosSemana: -1, puntosTotal: -1 }).limit(limite).lean();

function embedRanking(clanes, idioma, titulo) {
    const lineas = clanes.map((c, i) => `${MEDALLAS[i] || `**${i + 1}.**`} ${c.emoji} **${c.nombre}** — ${c.puntosSemana.toLocaleString(t(idioma, 'es-ES', 'en-US'))} ${t(idioma, 'pts', 'pts')} · ${c.miembros.length} 👥${c.victorias ? ` · 🏆 ${c.victorias}` : ''}`);
    return new EmbedBuilder()
        .setColor('#f59e0b')
        .setTitle(titulo || t(idioma, '🛡️ Clanes · esta semana', '🛡️ Clans · this week'))
        .setDescription(lineas.join('\n') || t(idioma, 'Todavía no hay clanes. ¡Funda el primero con `/clan crear`!', 'No clans yet. Found the first one with `/clan create`!'))
        .setFooter({ text: t(idioma, 'Cada XP que ganáis suma un punto · la semana se cierra el lunes', 'Every XP you earn adds a point · the week ends on Monday') });
}

function embedClan(clan, idioma) {
    return new EmbedBuilder()
        .setColor('#f59e0b')
        .setTitle(`${clan.emoji} ${clan.nombre}`)
        .addFields(
            { name: t(idioma, '👑 Líder', '👑 Leader'), value: `<@${clan.liderId}>`, inline: true },
            { name: t(idioma, '📈 Esta semana', '📈 This week'), value: `${clan.puntosSemana.toLocaleString(t(idioma, 'es-ES', 'en-US'))} pts`, inline: true },
            { name: t(idioma, '🏆 Semanas ganadas', '🏆 Weeks won'), value: String(clan.victorias || 0), inline: true },
            { name: t(idioma, `👥 Miembros (${clan.miembros.length})`, `👥 Members (${clan.miembros.length})`), value: clan.miembros.map((m) => `<@${m}>`).join(' ').slice(0, 1024) },
        );
}

// Cierre de la semana (lo llama el programador): premia al ganador y pone los puntos a cero.
async function cerrarSemana(client, cfg, semanaCerrada) {
    const c = cfg.clanes;
    const [ganador] = await Clan.find({ guildId: cfg.guildId, puntosSemana: { $gt: 0 } }).sort({ puntosSemana: -1 }).limit(1);
    const top = await ranking(cfg.guildId, 5);
    if (ganador) {
        await Clan.updateOne({ _id: ganador._id }, { $inc: { victorias: 1 } });
        const guild = client.guilds.cache.get(cfg.guildId);
        const { darRecompensa } = require('./dinamicas.js');
        for (const uid of ganador.miembros) {
            const member = guild ? await guild.members.fetch(uid).catch(() => null) : null;
            if (c.premioOro > 0) await economia.darOro(uid, c.premioOro).catch(() => {});
            if (member && c.premioXp > 0 && cfg.nivelesActivo) await darRecompensa(guild, member, { xp: c.premioXp }, cfg, null).catch(() => {});
        }
        const canal = guild && c.canalId ? guild.channels.cache.get(c.canalId) : null;
        if (canal?.isTextBased()) {
            const premio = [c.premioOro > 0 ? `🪙 ${c.premioOro}` : '', c.premioXp > 0 && cfg.nivelesActivo ? `✨ ${c.premioXp} XP` : ''].filter(Boolean).join(' + ');
            await canal.send({
                content: t(cfg,
                    `🏆 **${ganador.emoji} ${ganador.nombre}** gana la semana con **${ganador.puntosSemana.toLocaleString('es-ES')}** puntos.${premio ? ` Cada miembro se lleva ${premio}.` : ''} ¡Enhorabuena! ${ganador.miembros.map((m) => `<@${m}>`).join(' ')}`,
                    `🏆 **${ganador.emoji} ${ganador.nombre}** wins the week with **${ganador.puntosSemana.toLocaleString('en-US')}** points.${premio ? ` Each member gets ${premio}.` : ''} Congrats! ${ganador.miembros.map((m) => `<@${m}>`).join(' ')}`).slice(0, 2000),
                embeds: [embedRanking(top, cfg, t(cfg, `🛡️ Clasificación final · ${semanaCerrada}`, `🛡️ Final standings · ${semanaCerrada}`))],
                allowedMentions: { users: ganador.miembros.slice(0, 50) },
            }).catch(() => {});
        }
    }
    await Clan.updateMany({ guildId: cfg.guildId }, { $set: { puntosSemana: 0 } });
}

async function barrerClanes(client) {
    const semana = semanaISO();
    const cfgs = await ServidorConfig.find({ 'clanes.activo': true, 'clanes.lastSemana': { $ne: semana } }).lean();
    for (const cfg of cfgs) {
        const antes = cfg.clanes.lastSemana;
        const r = await ServidorConfig.updateOne({ guildId: cfg.guildId, 'clanes.lastSemana': antes }, { $set: { 'clanes.lastSemana': semana } });
        if (!r.modifiedCount || !antes) continue; // la primera vez solo se apunta la semana
        try { await cerrarSemana(client, cfg, antes); } catch (e) { console.error(`Clanes ${cfg.guildId}:`, e.message); }
    }
}

module.exports = { crear, unirse, salir, expulsar, sumarPuntos, ranking, embedRanking, embedClan, clanDe, buscar, barrerClanes, cerrarSemana, nombreValido, clave };

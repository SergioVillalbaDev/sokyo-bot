// Red Sokyo (1.10.0): los servidores que la activan se promocionan entre sí.
// Cada `cadaHoras`, el bot publica en el canal de la red de cada servidor otro servidor
// de la red. Es justo: solo SALE en los demás quien también PUBLICA a los demás (red
// activa con canal) y tiene su página pública en el directorio (/servidores); y cada
// vez se elige al que menos veces ha salido, sin repetir los últimos. Lo llama el
// programador (utils/scheduler.js).
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { t } = require('./i18n.js');

const MAX_VISTOS = 20;
// El bot está en el servidor y Discord no lo marca para adultos (nsfwLevel 1 explícito, 3 con edad).
const apto = (client, id) => { const g = client.guilds.cache.get(id); return !!g && ![1, 3].includes(g.nsfwLevel); };
const horasEntre = (n) => Math.max(6, Math.min(168, parseInt(n, 10) || 24));

// ¿Puede salir en los demás? Red activa con canal + página pública listada en el directorio.
function esVisible(cfg) {
    const r = cfg?.crecimiento?.red;
    const p = cfg?.crecimiento?.pagina;
    return !!(r?.activo && r.canalId && p?.activo && p.listado && typeof p.slug === 'string' && p.slug);
}

// Elige qué servidor publicar en `receptor`. `candidatos`: [{ guildId, idioma, mostrado }].
// Función pura (la prueban los tests): primero los que no salieron hace poco aquí, del
// mismo idioma si se pide, y de ellos el que menos veces ha salido en la red.
// Filtros del receptor (1.11.0): servidores bloqueados (en los dos sentidos: si uno bloquea
// al otro, ninguno sale en el otro), mínimo de miembros y temas (etiquetas de la página).
function elegirCandidato(receptor, candidatos, azar = Math.random) {
    const r = receptor.crecimiento?.red || {};
    const bloqueados = new Set(r.bloqueados || []);
    const minimo = Math.max(0, r.minMiembros || 0);
    const temas = (r.etiquetas || []).map((e) => String(e).toLowerCase());
    let lista = candidatos.filter((c) => c.guildId !== receptor.guildId
        && !bloqueados.has(c.guildId)
        && !(c.bloqueados || []).includes(receptor.guildId)
        && (c.miembros ?? Infinity) >= minimo
        && (!temas.length || (c.etiquetas || []).some((e) => temas.includes(String(e).toLowerCase()))));
    if (r.mismoIdioma !== false) lista = lista.filter((c) => (c.idioma === 'es' ? 'es' : 'en') === (receptor.idioma === 'es' ? 'es' : 'en'));
    if (!lista.length) return null;
    const vistos = r.vistos || [];
    let frescos = lista.filter((c) => !vistos.includes(c.guildId));
    // Si ya salieron todos, vale cualquiera menos el último publicado.
    if (!frescos.length) frescos = lista.length > 1 ? lista.filter((c) => c.guildId !== vistos[vistos.length - 1]) : lista;
    // Podio de la Liga Sokyo del mes pasado (1.14.0): sale más a menudo (la mitad de las veces, si está entre los posibles).
    const podio = frescos.filter((c) => c.destacado);
    if (podio.length && podio.length < frescos.length && azar() < 0.5) frescos = podio;
    const menos = Math.min(...frescos.map((c) => c.mostrado || 0));
    const empatados = frescos.filter((c) => (c.mostrado || 0) === menos);
    return empatados[Math.floor(azar() * empatados.length) % empatados.length];
}

function mensajeRed(receptorCfg, guild, cfg) {
    const p = cfg.crecimiento.pagina;
    const base = require('./paginaPublica.js').urlBase();
    const desc = (p.descripcion || guild.description || '').slice(0, 300)
        || t(receptorCfg, 'Un servidor de la Red Sokyo.', 'A server from the Sokyo Network.');
    const embed = new EmbedBuilder()
        .setColor(0x7c5cff)
        .setAuthor({ name: t(receptorCfg, '🤝 Red Sokyo · te recomendamos', '🤝 Sokyo Network · we recommend') })
        .setTitle(guild.name.slice(0, 256))
        .setDescription(desc)
        .addFields({ name: t(receptorCfg, 'Miembros', 'Members'), value: (guild.memberCount || 0).toLocaleString('es-ES'), inline: true })
        .setFooter({ text: t(receptorCfg, 'Servidores que se apoyan entre sí · actívalo en el panel de Sokyo', 'Servers that support each other · turn it on in the Sokyo panel') });
    if ((p.etiquetas || []).length) embed.addFields({ name: t(receptorCfg, 'Temas', 'Topics'), value: p.etiquetas.slice(0, 6).map((e) => `\`${e}\``).join(' '), inline: true });
    if (guild.iconURL()) embed.setThumbnail(guild.iconURL({ size: 256 }));
    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(`${base}/s/${encodeURIComponent(p.slug)}`)
            .setLabel(t(receptorCfg, 'Ver el servidor', 'See the server')).setEmoji('🔗'),
    );
    return { embeds: [embed], components: [fila], allowedMentions: { parse: [] } };
}

async function barrerRed(client) {
    const cfgs = await ServidorConfig.find({ 'crecimiento.red.activo': true })
        .select('guildId idioma crecimiento.red crecimiento.pagina').lean();
    const podio = await require('./liga.js').destacados().catch(() => new Map());
    const visibles = cfgs.filter((c) => esVisible(c) && apto(client, c.guildId))
        .map((c) => ({
            destacado: podio.has(c.guildId),
            guildId: c.guildId, idioma: c.idioma, mostrado: c.crecimiento.red.mostrado || 0, cfg: c,
            miembros: client.guilds.cache.get(c.guildId).memberCount || 0,
            etiquetas: c.crecimiento.pagina.etiquetas || [], bloqueados: c.crecimiento.red.bloqueados || [],
        }));
    const ahora = Date.now();
    for (const receptor of cfgs) {
        const r = receptor.crecimiento.red;
        const guild = client.guilds.cache.get(receptor.guildId);
        if (!guild || !r.canalId) continue;
        const ultima = r.ultimaPublicacion ? new Date(r.ultimaPublicacion).getTime() : 0;
        if (ahora - ultima < horasEntre(r.cadaHoras) * 3600 * 1000) continue;
        const canal = guild.channels.cache.get(r.canalId);
        if (!canal?.isTextBased()) continue;
        const elegido = elegirCandidato(receptor, visibles);
        if (!elegido) continue;
        const otro = client.guilds.cache.get(elegido.guildId);
        if (!otro) continue;
        // Reserva la publicación (si otra pasada llega a la vez, solo publica una).
        const reservado = await ServidorConfig.findOneAndUpdate(
            { guildId: receptor.guildId, 'crecimiento.red.ultimaPublicacion': r.ultimaPublicacion || null },
            { $set: { 'crecimiento.red.ultimaPublicacion': new Date(), 'crecimiento.red.vistos': [...(r.vistos || []), elegido.guildId].slice(-MAX_VISTOS) } },
        );
        if (!reservado) continue;
        const ok = await canal.send(mensajeRed(receptor, otro, elegido.cfg)).then(() => true)
            .catch((e) => { console.error('Red Sokyo · publicar:', e.message); return false; });
        if (ok) {
            await ServidorConfig.updateOne({ guildId: elegido.guildId }, { $inc: { 'crecimiento.red.mostrado': 1 } });
            elegido.mostrado += 1; // para el resto de esta pasada
        }
    }
}

const datosServidor = (client, id) => {
    const g = client.guilds.cache.get(id);
    return { id, nombre: g ? g.name : id, icono: g ? g.iconURL({ size: 64 }) : null, miembros: g ? g.memberCount : null };
};

// Para el panel: cuántos hay en la red y si este servidor sale en los demás.
async function estadoRed(client, cfg) {
    const cfgs = await ServidorConfig.find({ 'crecimiento.red.activo': true }).select('guildId idioma crecimiento.red crecimiento.pagina').lean();
    const visibles = cfgs.filter((c) => esVisible(c) && apto(client, c.guildId));
    const p = cfg.crecimiento?.pagina || {};
    return {
        enLaRed: visibles.length,
        mismoIdioma: visibles.filter((c) => (c.idioma === 'es' ? 'es' : 'en') === (cfg.idioma === 'es' ? 'es' : 'en')).length,
        visible: esVisible(cfg),
        paginaLista: !!(p.activo && p.listado && p.slug),
        mostrado: cfg.crecimiento?.red?.mostrado || 0,
        // Últimos publicados aquí y los bloqueados, con nombre (para «Bloquear» / «Desbloquear»).
        recientes: [...(cfg.crecimiento?.red?.vistos || [])].reverse().slice(0, 10).map((id) => datosServidor(client, id)),
        bloqueados: (cfg.crecimiento?.red?.bloqueados || []).map((id) => datosServidor(client, id)),
        proxima: cfg.crecimiento?.red?.ultimaPublicacion
            ? new Date(new Date(cfg.crecimiento.red.ultimaPublicacion).getTime() + horasEntre(cfg.crecimiento.red.cadaHoras) * 3600 * 1000)
            : null,
    };
}

module.exports = { esVisible, elegirCandidato, mensajeRed, barrerRed, estadoRed, horasEntre, MAX_VISTOS };

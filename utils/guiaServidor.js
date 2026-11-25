// 📖 Canal «Cómo funciona» (1.34.0): el bot escribe en un canal la guía de TODO lo que hay encendido en el servidor
// (por zonas, con qué es y cómo se usa, sacado de utils/catalogo.js) y la reescribe sola cuando cambia algo (se
// enciende o apaga una función, cambia el idioma). Solo edita sus mensajes (guardados en guiaCanal.mensajeIds) y solo si
// el contenido cambió (hash). Se enciende con /configurar → 📖 o desde el panel; se apaga quitando el canal.
const crypto = require('crypto');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const C = require('./catalogo.js');
const { t } = require('./i18n.js');

const ZONAS_GUIA = ['jugar', 'mascotas', 'comunidad', 'musica', 'crecimiento'];
const pendientes = new Map();
let cliente = null;

// Los mensajes de la guía (sin imágenes: el mapa va aparte en el primero).
function mensajes(cfg) {
    const idioma = cfg?.idioma === 'es' ? 'es' : cfg?.idioma === 'en' ? 'en' : 'en';
    const out = [];
    const cab = new EmbedBuilder().setColor('#a855f7').setTitle(t(idioma, '📖 Cómo funciona todo', '📖 How everything works'))
        .setDescription(t(idioma,
            '¡Hola! Aquí está **todo lo que puedes hacer** en este servidor con Sokyo.\n\n👉 Lo más fácil: escribe **/menu** (o pulsa el botón). Te enseña lo tuyo y lo que tienes listo.\n👋 ¿Primera vez? **/empezar** te guía paso a paso.\n❔ En los mensajes del bot, el botón **❔** explica esa pantalla.',
            'Hi! Here’s **everything you can do** on this server with Sokyo.\n\n👉 The easiest way: type **/menu** (or press the button). It shows your stuff and what’s ready.\n👋 First time? **/start** guides you step by step.\n❔ On the bot’s messages, the **❔** button explains that screen.'))
        .setImage('attachment://mapa.png');
    out.push({ clave: 'cab', embeds: [cab], mapa: true, botones: true });
    for (const z of ZONAS_GUIA) {
        const ms = C.MODULOS.filter((m) => m.zona === z && m.activo(cfg || {}));
        if (!ms.length) continue;
        const e = new EmbedBuilder().setColor(C.ZONAS[z].color).setTitle(`${C.ZONAS[z].emoji} ${t(idioma, C.ZONAS[z].es, C.ZONAS[z].en)}`)
            .setDescription(ms.map((m) => `**${m.emoji} ${t(idioma, m.es, m.en)}** — ${t(idioma, m.frase.es, m.frase.en)}\n${t(idioma, m.pasos.es, m.pasos.en).slice(0, 2).map((l) => `> ${l}`).join('\n')}`).join('\n\n').slice(0, 4000));
        out.push({ clave: z, embeds: [e] });
    }
    return { idioma, out };
}
const hashDe = (cfg) => { const { idioma, out } = mensajes(cfg); return crypto.createHash('sha1').update(JSON.stringify([idioma, out.map((m) => m.embeds.map((e) => e.toJSON()))])).digest('hex'); };

function fila(idioma) {
    const b = [new ButtonBuilder().setCustomId('menu:abrir:').setEmoji('🏠').setLabel(t(idioma, 'Abrir mi menú', 'Open my menu')).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('menu:ayuda:').setEmoji('❔').setLabel(t(idioma, 'Cómo funciona cada cosa', 'How each thing works')).setStyle(ButtonStyle.Secondary)];
    const web = require('./ayudaWeb.js').enlace(null, idioma);
    if (web) b.push(new ButtonBuilder().setURL(web).setEmoji('🌐').setLabel(t(idioma, 'Guía en la web', 'Web guide')).setStyle(ButtonStyle.Link));
    return new ActionRowBuilder().addComponents(b);
}

// Publica o reescribe la guía. `forzar` = aunque el contenido sea el mismo.
async function ponerAlDia(guild, { forzar = false } = {}) {
    const ServidorConfig = require('../models/ServidorConfig.js');
    const cfg = await ServidorConfig.findOne({ guildId: guild.id }).lean();
    const g = cfg?.guiaCanal;
    if (!g?.activo || !g.canalId) return { ok: false, motivo: 'apagada' };
    const canal = guild.channels.cache.get(g.canalId);
    if (!canal?.isTextBased()) { await ServidorConfig.updateOne({ guildId: guild.id }, { $set: { 'guiaCanal.activo': false } }); return { ok: false, motivo: 'sin-canal' }; }
    const h = hashDe(cfg);
    if (!forzar && g.hash === h && (g.mensajeIds || []).length) return { ok: true, igual: true };
    const { idioma, out } = mensajes(cfg);
    const ids = [...(g.mensajeIds || [])];
    const nuevos = [];
    for (let i = 0; i < out.length; i++) {
        const m = out[i];
        const png = m.mapa ? require('./mapaJuego.js').dibujar(cfg, idioma) : null;
        const payload = { embeds: m.embeds, components: m.botones ? [fila(idioma)] : [], files: png ? [new AttachmentBuilder(png, { name: 'mapa.png' })] : [], attachments: [], allowedMentions: { parse: [] } };
        if (!png) m.embeds.forEach((e) => { if (e.data.image) delete e.data.image; });
        const previo = ids[i] ? await canal.messages.fetch(ids[i]).catch(() => null) : null;
        const msg = previo ? await previo.edit(payload).catch(() => null) : await canal.send(payload).catch(() => null);
        if (!msg) {
            // Se guardan ya los que salieron (y los viejos que quedan): así el siguiente intento los edita en vez de
            // mandarlos otra vez. El hash no cambia, para que se vuelva a intentar.
            const guardar = [...nuevos, ...ids.slice(nuevos.length)];
            await ServidorConfig.updateOne({ guildId: guild.id }, { $set: { 'guiaCanal.mensajeIds': guardar } }).catch(() => {});
            return { ok: false, motivo: 'permisos' };
        }
        nuevos.push(msg.id);
    }
    // Lo que sobra (se apagó una zona entera) se borra.
    for (const id of ids.slice(out.length)) { const m = await canal.messages.fetch(id).catch(() => null); if (m) await m.delete().catch(() => {}); }
    await ServidorConfig.updateOne({ guildId: guild.id }, { $set: { 'guiaCanal.mensajeIds': nuevos, 'guiaCanal.hash': h } });
    return { ok: true, n: nuevos.length };
}

async function activar(guild, canalId, user = null) {
    const ServidorConfig = require('../models/ServidorConfig.js');
    const canal = guild.channels.cache.get(canalId);
    if (!canal?.isTextBased()) return { error: 'Ese canal no vale.' };
    const antes = await ServidorConfig.findOne({ guildId: guild.id }).lean() || {};
    const mismo = antes.guiaCanal?.canalId === canalId;
    await ServidorConfig.updateOne({ guildId: guild.id }, { $set: { 'guiaCanal.activo': true, 'guiaCanal.canalId': canalId, ...(mismo ? {} : { 'guiaCanal.mensajeIds': [], 'guiaCanal.hash': null }) } }, { upsert: true });
    if (user) { const despues = await ServidorConfig.findOne({ guildId: guild.id }).lean(); await require('./configurar.js').apuntarCambio?.(guild.id, user, antes, despues); }
    const r = await ponerAlDia(guild, { forzar: true });
    if (!r.ok) return { error: r.motivo === 'permisos' ? 'El bot no puede escribir en ese canal.' : 'No se ha podido publicar.' };
    return { ok: true };
}

function programar(guildId) {
    if (!cliente) return;
    clearTimeout(pendientes.get(guildId));
    const tmp = setTimeout(() => { pendientes.delete(guildId); const g = cliente.guilds.cache.get(guildId); if (g) ponerAlDia(g).catch((e) => console.warn('Guía:', e.message)); }, 10000);
    tmp.unref?.();
    pendientes.set(guildId, tmp);
}
async function ponerAlDiaTodas(client) {
    cliente = client;
    const ServidorConfig = require('../models/ServidorConfig.js');
    const cfgs = await ServidorConfig.find({ 'guiaCanal.activo': true }).select('guildId').lean();
    for (const c of cfgs) { const g = client.guilds.cache.get(c.guildId); if (g) await ponerAlDia(g).catch(() => {}); }
}

module.exports = { mensajes, hashDe, ponerAlDia, activar, programar, ponerAlDiaTodas };

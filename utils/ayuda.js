// Ayuda interactiva (/ayuda y !help). Desde 1.34.0 sale del catálogo de funciones (utils/catalogo.js), igual que
// /menu, el botón ❔, la guía automática y la web /ayuda: un menú con las zonas; al elegir una, sus funciones con qué
// son, sus comandos de verdad (en el idioma de quien lo lee) y si están encendidas en este servidor.
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { botonPanel } = require('./enlacesPanel.js');
const { botonAbrirCuenta } = require('./cuenta.js');
const C = require('./catalogo.js');
const { t } = require('./i18n.js');

const ZONAS_AYUDA = ['basico', 'jugar', 'mascotas', 'comunidad', 'musica', 'crecimiento', 'staff'];

// Cómo se escribe un comando del catálogo en el idioma de quien lo lee.
function nombreComando(nombre, idioma) {
    const P = require('./puertas.js');
    const ruta = P.rutaDe(nombre, idioma);
    if (ruta) return `\`${ruta}\``;
    const m = P.comandos().get(nombre);
    if (!m) return null;
    const j = m.data.toJSON();
    if (j.type === 2 || j.type === 3) return `🖱️ ${t(idioma, j.name_localizations?.['es-ES'] || j.name, j.name)}`;
    return `\`/${t(idioma, j.name_localizations?.['es-ES'] || j.name, j.name)}\``;
}
function comandosDe(m, idioma) {
    const lista = [...(m.comandos || []), ...(m.partes || []).map(([, c]) => c).filter((c) => !(m.comandos || []).includes(c))];
    return [...new Set(lista.map((c) => nombreComando(c, idioma)).filter(Boolean))];
}

// Portada o una zona. `cfg` dice qué está encendido aquí (sin cfg, todo como encendido).
function mensajeAyuda(idioma, prefijo = '!', { categoria = null, cfg = null } = {}) {
    const zona = ZONAS_AYUDA.includes(categoria) ? categoria : null;
    const on = (m) => !cfg || m.activo(cfg);
    const embed = new EmbedBuilder().setColor(zona ? C.ZONAS[zona].color : '#a855f7');
    if (!zona) {
        embed.setTitle(t(idioma, '📖 ¿Qué puedo hacer?', '📖 What can I do?'))
            .setDescription(t(idioma,
                `👉 **/menu** — tu menú: lo tuyo, lo que tienes listo y botones para todo. Es lo más fácil.\n👋 **/empezar** — si es tu primera vez, te guía paso a paso.\n🎮 **/jugar** · 🐾 **/mascotas** · 🏘️ **/comunidad** — escribe una y Discord te enseña todo lo de dentro.\n\nElige una zona en el menú de abajo. También funcionan con **${prefijo}** delante, como siempre.`,
                `👉 **/menu** — your menu: your stuff, what’s ready and buttons for everything. The easiest way.\n👋 **/start** — first time? It guides you step by step.\n🎮 **/games** · 🐾 **/pets** · 🏘️ **/community** — type one and Discord shows everything inside.\n\nPick a zone in the menu below. They also work with **${prefijo}** in front, as always.`))
            .addFields(ZONAS_AYUDA.map((z) => {
                const ms = C.MODULOS.filter((m) => m.zona === z);
                return { name: `${C.ZONAS[z].emoji} ${t(idioma, C.ZONAS[z].es, C.ZONAS[z].en)}`, value: ms.map((m) => `${on(m) ? '' : '⚪ '}${t(idioma, m.es, m.en)}`).join(' · ').slice(0, 1024), inline: false };
            }));
        if (cfg) embed.setFooter({ text: t(idioma, '⚪ = apagado en este servidor (un admin puede encenderlo con /configurar)', '⚪ = off on this server (an admin can turn it on with /configure)') });
    } else {
        const ms = C.MODULOS.filter((m) => m.zona === zona);
        embed.setTitle(`${C.ZONAS[zona].emoji} ${t(idioma, C.ZONAS[zona].es, C.ZONAS[zona].en)}`)
            .setDescription(ms.map((m) => [
                `**${m.emoji} ${t(idioma, m.es, m.en)}**${on(m) ? '' : t(idioma, ' · ⚪ apagado aquí', ' · ⚪ off here')} — ${t(idioma, m.frase.es, m.frase.en)}`,
                comandosDe(m, idioma).join(' · '),
            ].filter(Boolean).join('\n')).join('\n\n').slice(0, 4000));
    }
    const menu = new StringSelectMenuBuilder()
        .setCustomId('ayuda:cat')
        .setPlaceholder(t(idioma, 'Elige una zona…', 'Pick a zone…'))
        .addOptions([
            { label: t(idioma, 'Portada', 'Overview'), value: 'inicio', emoji: '📖', default: !zona },
            ...ZONAS_AYUDA.map((z) => ({ label: t(idioma, C.ZONAS[z].es, C.ZONAS[z].en), value: z, emoji: C.ZONAS[z].emoji, default: zona === z })),
        ]);
    const filas = [new ActionRowBuilder().addComponents(menu)];
    const tab = zona ? C.MODULOS.find((m) => m.zona === zona && m.tab)?.tab : null;
    const botones = [new ButtonBuilder().setCustomId('menu:abrir:').setEmoji('🏠').setLabel(t(idioma, 'Mi menú', 'My menu')).setStyle(ButtonStyle.Success), botonAbrirCuenta(idioma),
        botonPanel(idioma, tab || null, tab ? t(idioma, 'Configurarlo en el panel', 'Set it up in the panel') : t(idioma, 'Panel de control', 'Control panel'))];
    const web = require('./ayudaWeb.js').enlace(null, idioma);
    if (web) botones.push(new ButtonBuilder().setURL(web).setEmoji('🌐').setLabel(t(idioma, 'Guía en la web', 'Web guide')).setStyle(ButtonStyle.Link));
    filas.push(new ActionRowBuilder().addComponents(botones));
    return { embeds: [embed], components: filas };
}

module.exports = { mensajeAyuda, comandosDe, nombreComando, ZONAS_AYUDA };

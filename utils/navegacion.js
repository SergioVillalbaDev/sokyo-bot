// 🧭 Navegación común (1.34.0). Todos los mensajes de juegos, mascotas y comunidad llevan la misma fila al final:
// «🏠 Menú» (tu /menu) y «❔» (cómo funciona ESO, utils/catalogo.js), así nunca te quedas sin saber qué hacer ni
// dónde volver. Se pone sola: `envolver` adapta reply/editReply/update/followUp de la interacción antes de que la
// maneje nadie (events/interactionCreate.js), sin tocar cada mensaje. Solo si hay sitio (máx. 5 filas), si el
// mensaje tiene imagen o embed y si no lleva ya botones del menú. A los errores privados (❌/⚠️) se les añade «❔».
// También cuenta qué se usa (utils/uso.js) y el botón «🤔 No lo entiendo» (ayu_no:<módulo>) de las ayudas.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const C = require('./catalogo.js');
const { t } = require('./i18n.js');

// Prefijo de botón → módulo del catálogo.
const PREFIJOS = [
    ['pkr_', 'casino'], ['cas_', 'casino'], ['cof_', 'cofres'], ['crt_', 'cartas'], ['mkt_', 'cartas'], ['cbt_', 'combates'], ['pse:', 'pase'],
    ['cmp', 'mascotas'], ['grj:', 'mascotas'], ['grd_', 'mascotas'], ['casa_', 'mascotas'], ['expg_', 'mascotas'],
    ['mas_', 'mascotaServidor'], ['liga_', 'liga'], ['brm_', 'bromas'], ['grp_', 'grupos'],
];
function moduloDe(interaction) {
    if (interaction.isChatInputCommand?.()) {
        const n = interaction.commandName;
        const P = require('./puertas.js');
        const zona = Object.entries(P.PUERTAS).find(([, x]) => x.en === n)?.[0];
        if (zona) {
            const elegido = interaction.options.getSubcommandGroup(false) || interaction.options.getSubcommand(false);
            const parte = P.partesDe(zona).find((p) => p.nombre === elegido);
            return parte?.modulo || null;
        }
        const m = C.moduloDeComando(n);
        return m && ['jugar', 'mascotas', 'comunidad'].includes(m.zona) ? m : null;
    }
    const id = interaction.customId || '';
    const p = PREFIJOS.find(([pre]) => id.startsWith(pre));
    return p ? C.modulo(p[1]) : null;
}

const tieneMenu = (comps = []) => comps.some((f) => (f.components || f.data?.components || []).some((c) => String(c.data?.custom_id || c.custom_id || '').startsWith('menu:')));
function filaNav(mod, userId, idioma) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`menu:abrir:${userId}`).setEmoji('🏠').setLabel(t(idioma, 'Menú', 'Menu')).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`menu:ayuda:${mod.id}:${userId}`).setEmoji('❔').setStyle(ButtonStyle.Secondary),
    );
}
// Añade la fila al mensaje si toca. Devuelve el mismo mensaje (o uno nuevo con la fila).
function decorar(payload, mod, userId, idioma, nuevo = true) {
    if (!payload || !mod) return payload;
    const p = typeof payload === 'string' ? { content: payload } : payload;
    if (p.sinNav) { const { sinNav, ...resto } = p; return resto; }
    const comps = p.components || [];
    if (comps.length >= 5 || tieneMenu(comps)) return p;
    const visual = (p.embeds && p.embeds.length) || (p.files && p.files.length);
    const error = !visual && typeof p.content === 'string' && /^(❌|⚠️)/.test(p.content);
    if (!visual && !error) return p;
    // Al editar un mensaje sin decir sus botones, se quedan los que tenía: no se toca.
    if (p.components === undefined && !nuevo) return p;
    const fila = error
        ? new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`menu:ayuda:${mod.id}:${userId}`).setEmoji('❔').setLabel(t(idioma, '¿Cómo funciona?', 'How does it work?')).setStyle(ButtonStyle.Secondary))
        : filaNav(mod, userId, idioma);
    return { ...p, components: [...comps, fila] };
}

// Adapta la interacción: lo que se mande por ella lleva la fila de navegación.
async function envolver(interaction) {
    try { require('./uso.js').apuntar(interaction); } catch (_) { /* contar no puede romper nada */ }
    const mod = moduloDe(interaction);
    if (!mod || !interaction.guildId) return;
    await envolverCon(interaction, mod);
}
// Lo mismo, diciendo de qué módulo es (lo usa /menu al lanzar un comando desde sus botones).
async function envolverCon(interaction, mod) {
    if (!mod || interaction.__nav) return;
    interaction.__nav = true;
    const { getConfigCached } = require('./config.js');
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const idioma = await require('./preferencias.js').idiomaInteraccion(interaction, cfg).catch(() => 'es');
    const userId = interaction.user.id;
    for (const metodo of ['reply', 'editReply', 'update', 'followUp']) {
        const original = interaction[metodo];
        if (typeof original !== 'function') continue;
        interaction[metodo] = function (payload, ...resto) {
            // Los mensajes que se editan en directo (crash, póker…) ya se mandaron con la fila: se mantiene.
            return original.call(this, decorar(payload, mod, userId, idioma, metodo === 'reply' || metodo === 'followUp'), ...resto);
        };
    }
}

// «🤔 No lo entiendo»: una ventana opcional y se guarda (sin quién) para mejorar esa ayuda.
async function manejarNoEntiendo(interaction) {
    const { idiomaInteraccion } = require('./preferencias.js');
    const idioma = await idiomaInteraccion(interaction, null).catch(() => 'es');
    const tema = (interaction.customId.split(':')[1] || 'general').slice(0, 40);
    if (interaction.isButton()) {
        return interaction.showModal(new ModalBuilder().setCustomId(`ayu_no_m:${tema}`).setTitle(t(idioma, '¿Qué no se entiende?', 'What’s unclear?'))
            .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('texto').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)
                .setLabel(t(idioma, 'Cuéntanoslo (opcional)', 'Tell us (optional)')).setPlaceholder(t(idioma, 'Por ejemplo: no sé cómo conseguir mi primera mascota', 'For example: I don’t know how to get my first pet')))));
    }
    const texto = String(interaction.fields.getTextInputValue('texto') || '').trim().slice(0, 500);
    await require('../models/ComentarioAyuda.js').create({ guildId: interaction.guildId || null, tema, texto }).catch(() => {});
    return interaction.reply({ content: t(idioma, '🙏 ¡Gracias! Con esto mejoramos las explicaciones. Mientras, prueba `/empezar`: te dice paso a paso qué hacer.', '🙏 Thanks! This helps us improve the explanations. Meanwhile, try `/start`: it tells you step by step what to do.'), flags: 64 });
}

module.exports = { PREFIJOS, moduloDe, decorar, filaNav, envolver, envolverCon, manejarNoEntiendo };

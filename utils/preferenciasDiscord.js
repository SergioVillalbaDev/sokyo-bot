// /preferencias: cada miembro elige su idioma y qué mensajes privados quiere
// del bot. Un menú para el idioma y un botón por tipo de aviso (verde = sí).
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { preferenciasDe, guardarPreferencias, idiomaMiembro, TIPOS_DM } = require('./preferencias.js');
const { getConfigCached } = require('./config.js');
const { t } = require('./i18n.js');

const TIPOS = {
    anuncios: ['📣', 'Anuncios del bot', 'Bot announcements', 'Novedades del bot y avisos de los servidores.', 'Bot news and server notices.'],
    tickets: ['🎫', 'Mis tickets', 'My tickets', 'Cuando el staff responde o cierra tu ticket.', 'When the staff replies to or closes your ticket.'],
    niveles: ['📈', 'Subidas de nivel', 'Level ups', 'Cuando subes de nivel (si el servidor lo avisa por privado).', 'When you level up (if the server sends it by DM).'],
    sorteos: ['🎉', 'Sorteos', 'Giveaways', 'Si ganas un sorteo.', 'If you win a giveaway.'],
};

async function mensajePreferencias(userId, idioma) {
    const p = await preferenciasDe(userId);
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(t(idioma, '⚙️ Tus preferencias', '⚙️ Your preferences'))
        .setDescription(t(idioma,
            'Valen en todos los servidores donde está Sokyo. Los cambios se guardan al momento.',
            'They apply on every server with Sokyo. Changes are saved right away.'))
        .addFields(
            { name: t(idioma, '🌐 Idioma', '🌐 Language'), value: p.idioma === 'es' ? 'Español' : p.idioma === 'en' ? 'English' : t(idioma, 'Automático (el de tu Discord)', 'Automatic (your Discord’s)') },
            { name: t(idioma, '✉️ Mensajes privados', '✉️ Direct messages'), value: TIPOS_DM.map((k) => `${p.dms[k] ? '✅' : '🚫'} **${t(idioma, TIPOS[k][1], TIPOS[k][2])}** — ${t(idioma, TIPOS[k][3], TIPOS[k][4])}`).join('\n') },
        )
        .setFooter({ text: t(idioma, 'Pulsa un aviso para encenderlo o apagarlo.', 'Press a notice to turn it on or off.') });
    const menu = new StringSelectMenuBuilder()
        .setCustomId('pref:idioma')
        .setPlaceholder(t(idioma, 'Elige tu idioma', 'Choose your language'))
        .addOptions(
            { label: t(idioma, 'Automático (el de tu Discord)', 'Automatic (your Discord’s)'), value: 'auto', emoji: '🌐', default: p.idioma === 'auto' },
            { label: 'Español', value: 'es', emoji: '🇪🇸', default: p.idioma === 'es' },
            { label: 'English', value: 'en', emoji: '🇬🇧', default: p.idioma === 'en' },
        );
    const botones = new ActionRowBuilder().addComponents(TIPOS_DM.map((k) => new ButtonBuilder()
        .setCustomId(`pref:dm:${k}`)
        .setStyle(p.dms[k] ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setEmoji(TIPOS[k][0])
        .setLabel(t(idioma, TIPOS[k][1], TIPOS[k][2]))));
    return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu), botones] };
}

async function manejarPreferencias(interaction) {
    const cfg = interaction.guildId ? await getConfigCached(interaction.guildId).catch(() => null) : null;
    const uid = interaction.user.id;
    const id = interaction.customId;
    if (interaction.isStringSelectMenu() && id === 'pref:idioma') {
        await guardarPreferencias(uid, { idioma: interaction.values[0] });
    } else if (interaction.isButton() && id.startsWith('pref:dm:')) {
        const k = id.split(':')[2];
        if (TIPOS_DM.includes(k)) {
            const p = await preferenciasDe(uid);
            await guardarPreferencias(uid, { dms: { [k]: !p.dms[k] } });
        }
    } else if (interaction.isButton() && id === 'pref:abrir') {
        const idioma = await idiomaMiembro(uid, { locale: interaction.locale, cfg });
        return interaction.reply({ ...(await mensajePreferencias(uid, idioma)), flags: 64 });
    }
    const idioma = await idiomaMiembro(uid, { locale: interaction.locale, cfg });
    // El mensaje con las preferencias es solo suyo (efímero o por privado): se actualiza en el sitio.
    return interaction.update(await mensajePreferencias(uid, idioma));
}

// Botón «Mis preferencias» para poner debajo de los privados del bot.
const botonPreferencias = (idioma) => new ButtonBuilder()
    .setCustomId('pref:abrir').setStyle(ButtonStyle.Secondary).setEmoji('⚙️')
    .setLabel(t(idioma, 'Elegir qué avisos recibo', 'Choose which notices I get'));

module.exports = { mensajePreferencias, manejarPreferencias, botonPreferencias };

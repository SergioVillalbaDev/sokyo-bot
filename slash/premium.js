const { SlashCommandBuilder, InteractionContextType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');
const { t } = require('../utils/i18n.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /premium (2.4.0): qué plan tiene este servidor, qué es gratis, qué da Pro y la promesa de que pagar
// NUNCA da ventaja en los juegos. Los admins tienen el botón a «Mi plan» del panel.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('premium')
        .setNameLocalizations(ES('premium'))
        .setDescription('⭐ Sokyo Pro: what this server has, what’s free and what Pro adds')
        .setDescriptionLocalizations(ES('⭐ Sokyo Pro: qué tiene este servidor, qué es gratis y qué añade Pro'))
        .setContexts(InteractionContextType.Guild),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        return interaction.reply({ ...mensajePremium(idioma, cfg || {}, interaction.memberPermissions?.has?.(PermissionFlagsBits.ManageGuild)), flags: 64 });
    },
};

function mensajePremium(idioma, cfg, admin) {
    const billing = require('../utils/billing.js');
    const nivel = billing.nivel(cfg);
    const hasta = cfg.premiumHasta ? Math.floor(new Date(cfg.premiumHasta).getTime() / 1000) : null;
    const plan = nivel === 'free'
        ? t(idioma, '🆓 Este servidor usa **Free**.', '🆓 This server is on **Free**.')
        : `${nivel === 'agency' ? '🏢' : '⭐'} ${t(idioma, `Este servidor tiene **${nivel === 'agency' ? 'Sokyo Agencia' : 'Sokyo Pro'}**`, `This server has **${nivel === 'agency' ? 'Sokyo Agency' : 'Sokyo Pro'}**`)}${hasta ? t(idioma, ` hasta <t:${hasta}:D>`, ` until <t:${hasta}:D>`) : t(idioma, ' para siempre', ' forever')}. ${t(idioma, '¡Gracias por apoyar Sokyo! 💜', 'Thanks for supporting Sokyo! 💜')}`;
    const e = new EmbedBuilder().setColor(nivel === 'free' ? '#a855f7' : '#f59e0b').setTitle('⭐ Sokyo Pro')
        .setDescription(plan)
        .addFields(
            { name: t(idioma, '🆓 Gratis para siempre', '🆓 Free forever'), value: t(idioma,
                'Tickets, moderación, bienvenidas, verificación y roles · niveles, música y panel web · **todos los juegos enteros**: mascotas, cartas, combates, casino, pase y tienda (3 productos).',
                'Tickets, moderation, welcomes, verification and roles · levels, music and web panel · **every game in full**: pets, cards, battles, casino, pass and shop (3 products).') },
            { name: t(idioma, '⭐ Con Pro (7 €/mes o 70 €/año)', '⭐ With Pro (€7/month or €70/year)'), value: t(idioma, [
                '🎨 **El bot con tu marca**: su foto, banner y descripción solo en tu servidor',
                '🏷️ Sin «Powered by Sokyo» en los mensajes',
                '🧠 Moderación con IA y seguridad al completo',
                '🛒 Tienda con 25 productos y 100 mascotas con vuestras fotos',
                '🎵 Música 24/7 y filtros de sonido',
                '📊 Estadísticas, parte diario y transcripciones de tickets',
                '♾️ Paneles de roles, FAQs y anuncios sin límite',
                '✨ Tarjetas de nivel animadas, temas premium y soporte prioritario',
            ].join('\n'), [
                '🎨 **The bot with your brand**: its picture, banner and description only on your server',
                '🏷️ No “Powered by Sokyo” on messages',
                '🧠 AI moderation and full security',
                '🛒 Shop with 25 products and 100 pets with your own pictures',
                '🎵 24/7 music and sound filters',
                '📊 Stats, daily report and ticket transcripts',
                '♾️ Unlimited role panels, FAQs and announcements',
                '✨ Animated level cards, premium themes and priority support',
            ].join('\n')) },
            { name: t(idioma, '🤝 Nuestra promesa: nada de pagar para ganar', '🤝 Our promise: no pay-to-win'), value: t(idioma,
                'Pro es **del servidor**, no de cada jugador. Nadie puede comprar oro, cofres, cartas ni ventajas: en los juegos todos juegan con las mismas reglas, se pague o no.',
                'Pro belongs to **the server**, not to each player. Nobody can buy gold, chests, cards or advantages: in the games everyone plays by the same rules, paying or not.') },
        )
        .setFooter({ text: t(idioma, 'Cancela cuando quieras, sin permanencia.', 'Cancel anytime, no commitment.') });
    const fila = new ActionRowBuilder();
    if (admin) fila.addComponents(require('../utils/enlacesPanel.js').botonPanel(idioma, 'cuenta-plan', nivel === 'free' ? t(idioma, 'Ver planes y probar Pro', 'See plans and try Pro') : t(idioma, 'Mi plan', 'My plan')));
    else fila.addComponents(new ButtonBuilder().setCustomId('menu:abrir:').setEmoji('🏠').setStyle(ButtonStyle.Secondary).setLabel(t(idioma, 'Mi menú', 'My menu')));
    const web = (process.env.FRONTEND_URL || 'https://dashboard.sokyo.studio').replace(/\/+$/, '');
    fila.addComponents(new ButtonBuilder().setURL(`${web}/#pricing`).setEmoji('💜').setStyle(ButtonStyle.Link).setLabel(t(idioma, 'Comparar planes', 'Compare plans')));
    return { embeds: [e], components: [fila] };
}
module.exports.mensajePremium = mensajePremium;

const { SlashCommandBuilder, InteractionContextType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');
const { t } = require('../utils/i18n.js');
const { urlInvitar } = require('../utils/invitar.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /invitar (2.3.1): el enlace para añadir Sokyo a otro servidor, con los pasos. Funciona en todas partes.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setNameLocalizations(ES('invitar'))
        .setDescription('➕ Add Sokyo to another server')
        .setDescriptionLocalizations(ES('➕ Añade Sokyo a otro servidor'))
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        return interaction.reply({ ...mensajeInvitar(idioma, client), flags: 64 });
    },
};

function mensajeInvitar(idioma, client) {
    const url = urlInvitar({ clientId: client?.user?.id });
    const e = new EmbedBuilder().setColor('#5865F2').setTitle(t(idioma, '➕ Añade Sokyo a tu servidor', '➕ Add Sokyo to your server'))
        .setDescription(t(idioma,
            '1. Pulsa **«Añadir a un servidor»**.\n2. Elige el servidor (tienes que poder **gestionarlo**).\n3. Acepta: en cuanto entre, te mando por privado un botón para **dejarlo listo en 1 minuto**.\n\n-# También desde el perfil del bot: botón **«Añadir app»**.',
            '1. Press **“Add to a server”**.\n2. Pick the server (you must be able to **manage it**).\n3. Accept: as soon as it joins, I’ll DM you a button to **set it up in 1 minute**.\n\n-# Also from the bot’s profile: **“Add App”** button.'));
    const fila = new ActionRowBuilder();
    if (url) fila.addComponents(new ButtonBuilder().setURL(url).setEmoji('➕').setStyle(ButtonStyle.Link).setLabel(t(idioma, 'Añadir a un servidor', 'Add to a server')));
    const web = process.env.FRONTEND_URL || 'https://dashboard.sokyo.studio';
    fila.addComponents(new ButtonBuilder().setURL(web).setEmoji('🌐').setStyle(ButtonStyle.Link).setLabel(t(idioma, 'Ver la web', 'See the website')));
    return { embeds: [e], components: [fila] };
}
module.exports.mensajeInvitar = mensajeInvitar;

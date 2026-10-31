// Marca "Sokyo" en el plan gratis: pie de página + botón para añadir el bot a otro servidor.
// El plan Premium quita la marca y permite un pie de página propio (marca blanca).
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, OAuth2Scopes } = require('discord.js');
const { esPremium } = require('./config.js');

const PIE_GRATIS = '⚡ Sokyo · Tickets con IA para Discord';

// Permisos mínimos que necesita el bot para funcionar.
const PERMISOS_BOT = new PermissionsBitField([
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.EmbedLinks,
    PermissionsBitField.Flags.AttachFiles,
    PermissionsBitField.Flags.ReadMessageHistory,
    PermissionsBitField.Flags.ManageChannels,
    PermissionsBitField.Flags.ManageRoles
]);

function urlInvitacion(clientId, guildId) {
    const id = clientId || process.env.DISCORD_CLIENT_ID;
    if (!id) return null;
    const params = new URLSearchParams({
        client_id: id,
        permissions: PERMISOS_BOT.bitfield.toString(),
        scope: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands].join(' ')
    });
    if (guildId) {
        params.set('guild_id', guildId);
        params.set('disable_guild_select', 'true');
    }
    return `https://discord.com/oauth2/authorize?${params.toString().replace(/\+/g, '%20')}`;
}

function pieDePagina(config) {
    if (esPremium(config) && config.footerPersonalizado) return config.footerPersonalizado;
    return PIE_GRATIS;
}

// Fila con el botón "Añadir Sokyo" (solo plan gratis). Devuelve null en Premium.
function filaMarca(config, client) {
    if (esPremium(config)) return null;
    const url = urlInvitacion(client?.application?.id || client?.user?.id);
    if (!url) return null;
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url).setLabel('Añadir Sokyo a tu servidor').setEmoji('⚡')
    );
}

module.exports = { PIE_GRATIS, PERMISOS_BOT, urlInvitacion, pieDePagina, filaMarca };

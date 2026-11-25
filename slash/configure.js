const { SlashCommandBuilder, InteractionContextType, PermissionFlagsBits } = require('discord.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /configurar (1.34.0): encender y apagar funciones desde Discord (admins). Todo en utils/configurar.js.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('configure')
        .setNameLocalizations(ES('configurar'))
        .setDescription('⚙️ (Admins) Turn the bot’s features on or off')
        .setDescriptionLocalizations(ES('⚙️ (Admins) Encender o apagar las funciones del bot'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setContexts(InteractionContextType.Guild),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        return interaction.reply({ ...require('../utils/configurar.js').vista(cfg || {}, idioma, interaction.user.id), flags: 64 });
    },
};

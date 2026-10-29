const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { enviar } = require('../utils/confesiones.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /confesar texto: una confesión anónima en el canal de confesiones del servidor.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('confess')
        .setNameLocalizations(ES('confesar'))
        .setDescription('Send an anonymous confession')
        .setDescriptionLocalizations(ES('Envía una confesión anónima'))
        .setContexts(InteractionContextType.Guild)
        .addStringOption((o) => o.setName('text').setNameLocalizations(ES('texto'))
            .setDescription('Your confession (nobody will see it’s yours)')
            .setDescriptionLocalizations(ES('Tu confesión (nadie verá que es tuya)'))
            .setRequired(true).setMinLength(10).setMaxLength(1500)),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        await interaction.deferReply({ flags: 64 });
        await interaction.editReply(await enviar(interaction, cfg, interaction.options.getString('text'), idioma));
    },
};

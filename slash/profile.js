const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /perfil [miembro] (1.32.0): tarjeta de jugador para presumir. Lógica en utils/perfilJugador.js.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setNameLocalizations(ES('perfil'))
        .setDescription('Your player card: companion, collection, battle rank and more')
        .setDescriptionLocalizations(ES('Tu tarjeta de jugador: compañero, colección, rango de combate y más'))
        .setContexts(InteractionContextType.Guild)
        .addUserOption((o) => o.setName('member').setNameLocalizations(ES('miembro')).setDescription('Whose').setDescriptionLocalizations(ES('De quién'))),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        const u = interaction.options.getUser('member');
        await interaction.deferReply();
        return interaction.editReply(await require('../utils/perfilJugador.js').vista(interaction, idioma, u && u.id !== interaction.user.id ? u : null));
    },
};

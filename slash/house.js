const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /casa [miembro] (1.33.0): la casa de tu compañero (o visitar la de otra persona). Todo en utils/casa.js.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('house')
        .setNameLocalizations(ES('casa'))
        .setDescription('🏠 Your companion’s house: buy furniture, decorate and visit others')
        .setDescriptionLocalizations(ES('🏠 La casa de tu compañero: compra muebles, decora y visita otras'))
        .setContexts(InteractionContextType.Guild)
        .addUserOption((o) => o.setName('member').setNameLocalizations(ES('miembro')).setDescription('Visit someone’s house').setDescriptionLocalizations(ES('Visitar la casa de alguien'))),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        const otro = interaction.options.getUser('member');
        const dueno = otro || interaction.user;
        const miembro = otro ? interaction.options.getMember('member') : interaction.member;
        await interaction.deferReply();
        return interaction.editReply(await require('../utils/casa.js').vista(interaction.guildId, dueno.id, interaction.user.id, idioma, { nombre: miembro?.displayName || dueno.globalName || dueno.username }));
    },
};

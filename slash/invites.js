const { SlashCommandBuilder } = require('discord.js');
const { embedInvitaciones } = require('../utils/invitaciones.js');
const { t } = require('../utils/i18n.js');

// Crecimiento · invitaciones de alguien y top del servidor (utils/invitaciones.js).
module.exports = {
    data: new SlashCommandBuilder()
        .setName('invites')
        .setNameLocalizations({ 'es-ES': 'invitaciones', 'es-419': 'invitaciones' })
        .setDescription('See how many people you (or someone) have invited, and the server top')
        .setDescriptionLocalizations({ 'es-ES': 'Mira a cuánta gente has invitado tú (o alguien) y el top del servidor', 'es-419': 'Mira a cuánta gente has invitado tú (o alguien) y el top del servidor' })
        .addUserOption((o) => o.setName('user').setNameLocalizations({ 'es-ES': 'usuario', 'es-419': 'usuario' }).setDescription('Whose invites to show (you by default)')
            .setDescriptionLocalizations({ 'es-ES': 'De quién ver las invitaciones (tú por defecto)', 'es-419': 'De quién ver las invitaciones (tú por defecto)' })),

    async execute(interaction, client, cfg) {
        if (!interaction.guild) return interaction.reply({ content: t(cfg, '❌ Este comando solo funciona en un servidor.', '❌ This command only works in a server.'), flags: 64 });
        if (!cfg?.crecimiento?.invitaciones?.activo) {
            return interaction.reply({ content: t(cfg, 'ℹ️ El seguimiento de invitaciones no está activado en este servidor (panel → Crecimiento → Invitaciones).', 'ℹ️ Invite tracking isn’t enabled on this server (panel → Growth → Invites).'), flags: 64 });
        }
        const usuario = interaction.options.getUser('user') || interaction.user;
        const embed = await embedInvitaciones(interaction.guild, usuario, cfg);
        await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
    },
};

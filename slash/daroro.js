const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const economia = require('../utils/economia.js');
const { t } = require('../utils/i18n.js');
const ES = (v) => ({ 'es-ES': v, 'es-419': v }); // nombres y textos en español

module.exports = {
    data: new SlashCommandBuilder()
        .setName('givegold')
        .setNameLocalizations(ES('daroro'))
        .setDescription('(Admin) Give or take gold from a user')
        .setDescriptionLocalizations(ES('(Admin) Dar o quitar oro a alguien'))
        .addUserOption(o => o.setName('user').setNameLocalizations(ES('usuario')).setDescription('Who to give it to').setDescriptionLocalizations(ES('A quién')).setRequired(true))
        .addIntegerOption(o => o.setName('amount').setNameLocalizations(ES('cantidad')).setDescription('Amount (negative to take away)').setDescriptionLocalizations(ES('Cuánto (en negativo, para quitar)')).setRequired(true))
        // Solo lo ven/usan quienes tengan permiso de Administrador en el servidor.
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client, cfg) {
        const usuario = interaction.options.getUser('user');
        const cantidad = interaction.options.getInteger('amount');
        const balance = await economia.darOro(usuario.id, cantidad);

        const embed = new EmbedBuilder()
            .setColor('#c9a227')
            .setDescription(t(cfg,
                `🪙 ${cantidad >= 0 ? 'Se han añadido' : 'Se han quitado'} **${Math.abs(cantidad)}** de oro ${cantidad >= 0 ? 'a' : 'a'} ${usuario}.\nSaldo actual: **${balance}**.`,
                `🪙 ${cantidad >= 0 ? 'Added' : 'Removed'} **${Math.abs(cantidad)}** gold ${cantidad >= 0 ? 'to' : 'from'} ${usuario}.\nCurrent balance: **${balance}**.`));

        await interaction.reply({ embeds: [embed], flags: 64 });
    },
};

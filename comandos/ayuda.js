const { SlashCommandBuilder, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { urlInvitacion } = require('../utils/marca.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ayuda')
        .setDescription('Qué puede hacer Sokyo y cómo empezar'),

    async execute(interaction, client) {
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🤖 Sokyo · Tickets con IA')
            .setDescription('Sistema de tickets con formularios, panel web e IA que responde las dudas repetidas.')
            .addFields(
                { name: '⚙️ Administración', value: '`/setup` configura todo en 1 minuto\n`/panel` publica un panel para abrir tickets' },
                { name: '🎫 Dentro de un ticket', value: '`/ticket agregar` · `/ticket quitar` · `/ticket renombrar`\n`/ticket cerrar` · `/ticket resumen` (IA)' },
                { name: '📊 Otros', value: '`/usuario` historial de tickets\n`/dado` · `/moneda`' }
            );

        const botones = [];
        if (process.env.FRONTEND_URL) botones.push(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(process.env.FRONTEND_URL).setLabel('Panel web'));
        const invitar = urlInvitacion(client.application?.id);
        if (invitar) botones.push(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(invitar).setLabel('Añadir a otro servidor'));

        return interaction.reply({
            embeds: [embed],
            components: botones.length ? [new ActionRowBuilder().addComponents(botones)] : [],
            flags: MessageFlags.Ephemeral
        });
    }
};

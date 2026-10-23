// /buscoempleo — Lanza una búsqueda de empleo manual (solo OWNER_IDS). Responde
// de inmediato (el scraping + IA puede tardar minutos y el token de la
// interacción expira a los 15 min) y avisa del resultado en JOB_SEARCH_CHANNEL_ID.
const { SlashCommandBuilder } = require('discord.js');
const { ejecutarBusquedaEmpleo } = require('../utils/busquedaEmpleo.js');

const OWNER_IDS = new Set((process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buscoempleo')
        .setDescription('🔎 Search InfoJobs/JobToday for offers matching your CV (owners only)')
        .addStringOption((opt) => opt.setName('puesto').setDescription('Job title / keywords').setRequired(true))
        .addStringOption((opt) => opt.setName('ubicacion').setDescription('Location (optional)'))
        .addIntegerOption((opt) => opt.setName('umbral').setDescription('Minimum match score to adapt the CV (0-100, default 70)').setMinValue(0).setMaxValue(100)),

    async execute(interaction, client) {
        if (!OWNER_IDS.has(interaction.user.id)) {
            return interaction.reply({ content: '⛔ This command is only for the bot owners.', ephemeral: true });
        }

        const puesto = interaction.options.getString('puesto');
        const ubicacion = interaction.options.getString('ubicacion') || '';
        const umbral = interaction.options.getInteger('umbral') ?? 70;
        const canalId = process.env.JOB_SEARCH_CHANNEL_ID;

        await interaction.reply({
            content: `🔎 Job search started for "${puesto}"${ubicacion ? ` in ${ubicacion}` : ''}. ${canalId ? `I'll post the results in <#${canalId}> — this can take a few minutes.` : 'Set JOB_SEARCH_CHANNEL_ID to get notified when it finishes.'}`,
            ephemeral: true,
        });

        // Fire-and-forget: el resultado se anuncia por el canal fijo, no por editReply.
        ejecutarBusquedaEmpleo(client, { discordId: interaction.user.id, puesto, ubicacion, umbral })
            .then((r) => { if (r && r.error) console.error('🔴 /buscoempleo:', r.error); })
            .catch((e) => console.error('🔴 /buscoempleo:', e.message));
    },
};

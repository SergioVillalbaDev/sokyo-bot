// /rank y /top — sistema de niveles por mensajes.
const { SlashCommandBuilder, EmbedBuilder, InteractionContextType } = require('discord.js');
const Nivel = require('../models/Nivel.js');
const { obtenerConfig, EPH } = require('../utils/accesos.js');
const { nivelDesdeXp } = require('../utils/helpers.js');

const barra = (a, b) => { const l = Math.round((a / b) * 14); return '█'.repeat(l) + '░'.repeat(14 - l); };

const rank = {
    data: new SlashCommandBuilder().setName('rank').setDescription('Mira tu nivel (o el de otro usuario)')
        .setContexts(InteractionContextType.Guild)
        .addUserOption(o => o.setName('usuario').setDescription('Usuario a consultar')),
    async execute(interaction) {
        const config = await obtenerConfig(interaction.guildId);
        if (!config.niveles?.activo) return interaction.reply({ content: '😴 El sistema de niveles no está activado en este servidor.', flags: EPH });
        const objetivo = interaction.options.getUser('usuario') || interaction.user;
        const reg = await Nivel.findOne({ guildId: interaction.guildId, usuarioId: objetivo.id });
        if (!reg) return interaction.reply({ content: `**${objetivo.username}** todavía no tiene XP.`, flags: EPH });
        const { nivel, xpEnNivel, xpSiguiente } = nivelDesdeXp(reg.xp);
        const puesto = (await Nivel.countDocuments({ guildId: interaction.guildId, xp: { $gt: reg.xp } })) + 1;
        const embed = new EmbedBuilder().setColor('#faa61a').setAuthor({ name: objetivo.username, iconURL: objetivo.displayAvatarURL() })
            .setTitle(`Nivel ${nivel} · Puesto #${puesto}`)
            .setDescription(`${barra(xpEnNivel, xpSiguiente)}\n**${xpEnNivel}** / ${xpSiguiente} XP para el nivel ${nivel + 1}`)
            .addFields({ name: 'XP total', value: `${reg.xp}`, inline: true }, { name: 'Mensajes', value: `${reg.mensajes}`, inline: true });
        await interaction.reply({ embeds: [embed] });
    }
};

const top = {
    data: new SlashCommandBuilder().setName('top').setDescription('Ranking de niveles del servidor').setContexts(InteractionContextType.Guild),
    async execute(interaction) {
        const config = await obtenerConfig(interaction.guildId);
        if (!config.niveles?.activo) return interaction.reply({ content: '😴 El sistema de niveles no está activado en este servidor.', flags: EPH });
        const lista = await Nivel.find({ guildId: interaction.guildId }).sort({ xp: -1 }).limit(10);
        if (lista.length === 0) return interaction.reply({ content: 'Aún no hay nadie en el ranking.', flags: EPH });
        const medallas = ['🥇', '🥈', '🥉'];
        const texto = lista.map((r, i) => `${medallas[i] || `**${i + 1}.**`} <@${r.usuarioId}> — nivel **${r.nivel}** · ${r.xp} XP`).join('\n');
        await interaction.reply({ embeds: [new EmbedBuilder().setColor('#faa61a').setTitle('🏆 Ranking de la comunidad').setDescription(texto)], allowedMentions: { parse: [] } });
    }
};

module.exports = { comandos: [rank, top] };

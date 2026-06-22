const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const Usuario = require('../models/Usuario.js');

// Texto que describe qué hace un efecto (para el menú).
function descEfecto(ef) {
    if (!ef) return '';
    if (ef.tipo === 'xpBoost') return `XP x${ef.multiplicador} durante ${ef.duracionMin} min`;
    if (ef.tipo === 'rol') return `Rol temporal durante ${ef.duracionMin} min`;
    if (ef.tipo === 'caja') return 'Caja de botín — ábrela para un premio aleatorio';
    return '';
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('usar')
        .setDescription('Usa un objeto de tu mochila para activar su efecto'),

    async execute(interaction) {
        const usuario = await Usuario.findOne({ discordId: interaction.user.id }).populate('inventory.item');
        const usables = (usuario?.inventory || [])
            .filter(e => e.item && e.item.efecto && e.item.efecto.tipo && e.item.efecto.tipo !== 'ninguno');

        if (!usables.length) {
            return interaction.reply({ content: '🎒 No tienes objetos con efecto para usar. Consíguelos en `/tienda`.', ephemeral: true });
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId('usar_objeto')
            .setPlaceholder('Elige un objeto para usar...')
            .addOptions(usables.map(e => ({
                label: `${e.item.nombre} (x${e.cantidad})`.slice(0, 100),
                description: descEfecto(e.item.efecto).slice(0, 100),
                value: e.item._id.toString(),
            })));

        await interaction.reply({
            content: '✨ ¿Qué objeto quieres usar?',
            components: [new ActionRowBuilder().addComponents(menu)],
            ephemeral: true,
        });
    },
};

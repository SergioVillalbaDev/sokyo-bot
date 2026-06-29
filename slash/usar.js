const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const Usuario = require('../models/Usuario.js');

// Texto que describe qué hace un efecto (para el menú).
function descEfecto(ef) {
    if (!ef) return '';
    if (ef.tipo === 'xpBoost') return `XP x${ef.multiplicador} for ${ef.duracionMin} min`;
    if (ef.tipo === 'rol') return `Temporary role for ${ef.duracionMin} min`;
    if (ef.tipo === 'caja') return 'Loot box — open it for a random prize';
    return '';
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('use')
        .setDescription('Use an item from your bag to trigger its effect'),

    async execute(interaction) {
        const usuario = await Usuario.findOne({ discordId: interaction.user.id }).populate('inventory.item');
        const usables = (usuario?.inventory || [])
            .filter(e => e.item && e.item.efecto && e.item.efecto.tipo && e.item.efecto.tipo !== 'ninguno');

        if (!usables.length) {
            return interaction.reply({ content: '🎒 You have no usable items with an effect. Get some in `/shop`.', ephemeral: true });
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId('usar_objeto')
            .setPlaceholder('Choose an item to use...')
            .addOptions(usables.map(e => ({
                label: `${e.item.nombre} (x${e.cantidad})`.slice(0, 100),
                description: descEfecto(e.item.efecto).slice(0, 100),
                value: e.item._id.toString(),
            })));

        await interaction.reply({
            content: '✨ Which item do you want to use?',
            components: [new ActionRowBuilder().addComponents(menu)],
            ephemeral: true,
        });
    },
};

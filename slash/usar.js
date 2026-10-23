const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const Usuario = require('../models/Usuario.js');
const { t } = require('../utils/i18n.js');

// Texto que describe qué hace un efecto (para el menú).
function descEfecto(ef, cfg) {
    if (!ef) return '';
    if (ef.tipo === 'xpBoost') return t(cfg, `XP x${ef.multiplicador} durante ${ef.duracionMin} min`, `XP x${ef.multiplicador} for ${ef.duracionMin} min`);
    if (ef.tipo === 'rol') return t(cfg, `Rol temporal durante ${ef.duracionMin} min`, `Temporary role for ${ef.duracionMin} min`);
    if (ef.tipo === 'caja') return t(cfg, 'Caja sorpresa — ábrela para un premio aleatorio', 'Loot box — open it for a random prize');
    return '';
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('use')
        .setDescription('Use an item from your bag to trigger its effect'),

    async execute(interaction, client, cfg) {
        const usuario = await Usuario.findOne({ discordId: interaction.user.id }).populate('inventory.item');
        const usables = (usuario?.inventory || [])
            .filter(e => e.item && e.item.efecto && e.item.efecto.tipo && e.item.efecto.tipo !== 'ninguno');

        if (!usables.length) {
            return interaction.reply({ content: t(cfg, '🎒 No tienes objetos usables con efecto. Consigue alguno en `/shop`.', '🎒 You have no usable items with an effect. Get some in `/shop`.'), ephemeral: true });
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId('usar_objeto')
            .setPlaceholder(t(cfg, 'Elige un objeto para usar...', 'Choose an item to use...'))
            .addOptions(usables.map(e => ({
                label: `${e.item.nombre} (x${e.cantidad})`.slice(0, 100),
                description: descEfecto(e.item.efecto, cfg).slice(0, 100),
                value: e.item._id.toString(),
            })));

        await interaction.reply({
            content: t(cfg, '✨ ¿Qué objeto quieres usar?', '✨ Which item do you want to use?'),
            components: [new ActionRowBuilder().addComponents(menu)],
            ephemeral: true,
        });
    },
};

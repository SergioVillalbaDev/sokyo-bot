const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Usuario = require('../models/Usuario.js');
const economia = require('../utils/economia.js');
const { t } = require('../utils/i18n.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('Show your gold and the items you own'),

    async execute(interaction, client, cfg) {
        await economia.obtenerUsuario(interaction.user.id); // lo crea si es nuevo
        // populate('inventory.item') sustituye cada referencia por el documento completo del ítem.
        const usuario = await Usuario.findOne({ discordId: interaction.user.id }).populate('inventory.item');

        const lineas = (usuario.inventory || [])
            .filter(e => e.item) // por si un ítem fue borrado de la BD
            .map(e => `• **${e.item.nombre}** ×${e.cantidad} — *${e.item.tipo}*`);

        const embed = new EmbedBuilder()
            .setColor('#c9a227')
            .setAuthor({ name: t(cfg, `Inventario de ${interaction.user.username}`, `${interaction.user.username}'s inventory`), iconURL: interaction.user.displayAvatarURL() })
            .addFields({ name: t(cfg, '🪙 Oro', '🪙 Gold'), value: `**${usuario.balance}**`, inline: true })
            .setDescription(lineas.length ? lineas.join('\n') : t(cfg, '_Tu mochila está vacía. Visita `/shop`._', '_Your bag is empty. Visit `/shop`._'));

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};

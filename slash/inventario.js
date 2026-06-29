const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Usuario = require('../models/Usuario.js');
const economia = require('../utils/economia.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('Show your gold and the items you own'),

    async execute(interaction) {
        await economia.obtenerUsuario(interaction.user.id); // lo crea si es nuevo
        // populate('inventory.item') sustituye cada referencia por el documento completo del ítem.
        const usuario = await Usuario.findOne({ discordId: interaction.user.id }).populate('inventory.item');

        const lineas = (usuario.inventory || [])
            .filter(e => e.item) // por si un ítem fue borrado de la BD
            .map(e => `• **${e.item.nombre}** ×${e.cantidad} — *${e.item.tipo}*`);

        const embed = new EmbedBuilder()
            .setColor('#c9a227')
            .setAuthor({ name: `${interaction.user.username}'s inventory`, iconURL: interaction.user.displayAvatarURL() })
            .addFields({ name: '🪙 Gold', value: `**${usuario.balance}**`, inline: true })
            .setDescription(lineas.length ? lineas.join('\n') : '_Your bag is empty. Visit `/shop`._');

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};

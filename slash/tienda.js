const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const Item = require('../models/Item.js');
const economia = require('../utils/economia.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Open the Sokyo shop and buy items with your gold'),

    async execute(interaction) {
        const items = await Item.find({ activo: true }).sort({ precio: 1 }).limit(25); // Discord: máx 25 opciones
        if (!items.length) return interaction.reply({ content: '🛒 The shop is empty for now.', ephemeral: true });

        const embed = new EmbedBuilder()
            .setColor('#c9a227')
            .setTitle('🏪 Sokyo Shop')
            .setDescription('Pick an item from the menu below to buy it instantly.')
            .addFields(items.map(i => {
                const pe = economia.precioEfectivo(i);
                const precioTxt = pe.oferta ? `~~🪙 ${i.precio}~~ → 🪙 ${pe.precio} **(-${pe.porcentaje}%)**` : `🪙 ${pe.precio}`;
                return {
                    name: `${i.nombre} — ${precioTxt}`,
                    value: `${i.descripcion || 'No description'} · *(${i.tipo})*`,
                };
            }));

        const menu = new StringSelectMenuBuilder()
            .setCustomId('tienda_comprar')
            .setPlaceholder('Select an item to buy...')
            .addOptions(items.map(i => ({
                label: `${i.nombre} (${economia.precioEfectivo(i).precio} gold)`.slice(0, 100),
                description: (i.descripcion || i.tipo).slice(0, 100),
                value: i._id.toString(), // el MISMO _id que usa la web
            })));

        await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
    },
};

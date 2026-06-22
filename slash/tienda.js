const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const Item = require('../models/Item.js');
const economia = require('../utils/economia.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tienda')
        .setDescription('Abre la tienda de Sokyo y compra objetos con tu oro'),

    async execute(interaction) {
        const items = await Item.find({ activo: true }).sort({ precio: 1 }).limit(25); // Discord: máx 25 opciones
        if (!items.length) return interaction.reply({ content: '🛒 La tienda está vacía por ahora.', ephemeral: true });

        const embed = new EmbedBuilder()
            .setColor('#c9a227')
            .setTitle('🏪 Tienda de Sokyo')
            .setDescription('Elige un objeto en el menú de abajo para comprarlo al instante.')
            .addFields(items.map(i => {
                const pe = economia.precioEfectivo(i);
                const precioTxt = pe.oferta ? `~~🪙 ${i.precio}~~ → 🪙 ${pe.precio} **(-${pe.porcentaje}%)**` : `🪙 ${pe.precio}`;
                return {
                    name: `${i.nombre} — ${precioTxt}`,
                    value: `${i.descripcion || 'Sin descripción'} · *(${i.tipo})*`,
                };
            }));

        const menu = new StringSelectMenuBuilder()
            .setCustomId('tienda_comprar')
            .setPlaceholder('Selecciona un objeto para comprar...')
            .addOptions(items.map(i => ({
                label: `${i.nombre} (${economia.precioEfectivo(i).precio} oro)`.slice(0, 100),
                description: (i.descripcion || i.tipo).slice(0, 100),
                value: i._id.toString(), // el MISMO _id que usa la web
            })));

        await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
    },
};

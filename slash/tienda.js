const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const tienda = require('../utils/tiendaServidor.js');
const ES = (v) => ({ 'es-ES': v, 'es-419': v }); // nombres y textos en español

// /tienda (2.0.0): la tienda de ESTE servidor. Los admins ponen roles cosméticos a la venta
// desde el panel (Diversión → Tienda del servidor) y aquí se compran con el oro de este servidor.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setNameLocalizations(ES('tienda'))
        .setDescription('This server’s shop: special roles you can buy with your gold')
        .setDescriptionLocalizations(ES('La tienda del servidor: roles especiales que compras con tu oro'))
        .setContexts(InteractionContextType.Guild),

    async execute(interaction, client, cfg) {
        const idioma = cfg?.idioma || 'en';
        const v = await tienda.vista(interaction.guild, cfg, interaction.member, idioma);
        await interaction.reply({ ...v, flags: 64, allowedMentions: { parse: [] } });
    },
};

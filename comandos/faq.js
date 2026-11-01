// /faq <consulta> — busca en la base de conocimiento del servidor.
const { SlashCommandBuilder, EmbedBuilder, InteractionContextType } = require('discord.js');
const Articulo = require('../models/Articulo.js');
const { buscarArticulos } = require('../utils/helpers.js');
const { EPH } = require('../utils/accesos.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('faq')
        .setDescription('Busca una respuesta en la base de conocimiento')
        .setContexts(InteractionContextType.Guild)
        .addStringOption(o => o.setName('consulta').setDescription('¿Qué necesitas saber?')),
    async execute(interaction) {
        const consulta = interaction.options.getString('consulta');
        const articulos = await Articulo.find({ guildId: interaction.guildId });
        if (articulos.length === 0) return interaction.reply({ content: '📚 Este servidor aún no tiene artículos de ayuda.', flags: EPH });

        const coincidencias = consulta ? buscarArticulos(articulos, consulta, 3) : [];
        if (!consulta || coincidencias.length === 0) {
            const lista = articulos.slice(0, 20).map(a => `• **${a.titulo}**`).join('\n');
            return interaction.reply({ content: `${consulta ? '🔎 No encontré nada para esa búsqueda. ' : ''}Artículos disponibles:\n${lista}`, flags: EPH });
        }
        const embeds = coincidencias.map(a => new EmbedBuilder().setColor('#5865F2').setTitle(`📖 ${a.titulo}`).setDescription(a.contenido.slice(0, 3500)));
        await Articulo.updateMany({ _id: { $in: coincidencias.map(a => a._id) } }, { $inc: { visitas: 1 } });
        await interaction.reply({ embeds, flags: EPH });
    }
};

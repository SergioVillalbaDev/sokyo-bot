// /empleo — Estado de la búsqueda de empleo (solo OWNER_IDS).
//   /empleo estado — resumen de ofertas evaluadas/adaptadas/aplicadas y
//                    botones para marcar como aplicada las que faltan.
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const OfertaEmpleo = require('../models/OfertaEmpleo.js');
const { construirBotonesAplicada } = require('../utils/busquedaEmpleo.js');

const OWNER_IDS = new Set((process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean));
const LIMITE_PENDIENTES = 10; // tope de botones a la vez (2 filas de 5)

async function estado(interaction) {
    const discordId = interaction.user.id;
    const [conteos, pendientes] = await Promise.all([
        OfertaEmpleo.aggregate([
            { $match: { discordId } },
            { $group: { _id: '$estado', n: { $sum: 1 } } },
        ]),
        OfertaEmpleo.find({ discordId, estado: 'adaptada' }).sort({ puntuacion: -1 }).limit(LIMITE_PENDIENTES).lean(),
    ]);

    const porEstado = Object.fromEntries(conteos.map((c) => [c._id, c.n]));
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📋 Job search status')
        .addFields(
            { name: 'Evaluated', value: `${porEstado.evaluada || 0}`, inline: true },
            { name: 'Discarded', value: `${porEstado.descartada || 0}`, inline: true },
            { name: 'Adapted (pending)', value: `${porEstado.adaptada || 0}`, inline: true },
            { name: 'Applied', value: `${porEstado.aplicada || 0}`, inline: true },
        );

    if (pendientes.length) {
        const lineas = pendientes.map((o) => `**${o.puntuacion}** · [${o.titulo}](${o.urlOferta}) — ${o.empresa || ''}`).join('\n');
        embed.addFields({ name: `Pending applications (top ${pendientes.length})`, value: lineas.slice(0, 1024) });
    }

    const componentes = construirBotonesAplicada(pendientes.map((o) => ({ ofertaId: o._id.toString(), empresa: o.empresa, titulo: o.titulo })));

    return interaction.editReply({ embeds: [embed], components: componentes });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('empleo')
        .setDescription('📋 Job search status (owners only)')
        .addSubcommand((sub) => sub
            .setName('estado')
            .setDescription('Show pending/applied offers, with buttons to mark them applied')),

    async execute(interaction) {
        if (!OWNER_IDS.has(interaction.user.id)) {
            return interaction.reply({ content: '⛔ This command is only for the bot owners.', ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });
        const sub = interaction.options.getSubcommand();
        if (sub === 'estado') return estado(interaction);
    },
};

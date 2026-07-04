// ============================================================================
// Interacciones de la búsqueda de empleo (solo OWNER_IDS): el botón "marcar
// como aplicada" que acompaña a cada oferta adaptada (ver utils/busquedaEmpleo.js
// y slash/empleo.js). Lo dispara events/interactionCreate.js.
// ============================================================================
const { ActionRowBuilder, ButtonStyle } = require('discord.js');
const OfertaEmpleo = require('../models/OfertaEmpleo.js');

const OWNER_IDS = new Set((process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean));

// customId: empleo:aplicada:<ofertaEmpleoId>
async function manejarBotonEmpleo(interaction) {
    if (!OWNER_IDS.has(interaction.user.id)) {
        return interaction.reply({ content: '⛔ This button is only for the bot owners.', ephemeral: true });
    }

    const [, accion, ofertaId] = interaction.customId.split(':');
    if (accion !== 'aplicada') return;

    const oferta = await OfertaEmpleo.findOneAndUpdate(
        { _id: ofertaId, discordId: interaction.user.id },
        { $set: { estado: 'aplicada', fechaAplicada: new Date() } },
        { new: true },
    ).catch(() => null);

    if (!oferta) return interaction.reply({ content: '⛔ Couldn\'t find that offer.', ephemeral: true });

    // Deshabilita solo el botón pulsado, dejando el resto de la fila intacto
    // (mismo patrón que el botón "reclamar ticket" en interactionCreate.js).
    const nuevosComponentes = interaction.message.components.map((fila) => {
        const filaBuilder = ActionRowBuilder.from(fila);
        const idx = fila.components.findIndex((b) => b.customId === interaction.customId);
        if (idx !== -1) filaBuilder.components[idx].setDisabled(true).setLabel('✅ Applied').setStyle(ButtonStyle.Secondary);
        return filaBuilder;
    });

    await interaction.update({ components: nuevosComponentes }).catch(() => {});
    await interaction.followUp({ content: `✅ Marked as applied: **${oferta.titulo}**`, ephemeral: true }).catch(() => {});
}

module.exports = { manejarBotonEmpleo };

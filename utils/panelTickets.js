// ============================================================================
// Panel de tickets («🎫 El soporte está abierto» con «Abrir un ticket» y «Ver mis
// tickets»). Antes solo se publicaba con !sokyo en Discord; desde 1.9.13 también
// desde el panel (Tickets → Ajustes → «Publicar el panel de tickets»). Si ya está
// publicado en ese canal, se actualiza en vez de repetirse. Los textos y el color
// salen de la configuración (mensajeSoporteTitulo, mensajeSoporteDescripcion,
// colorEmbed, textoBoton), que se editan en el panel.
// ============================================================================
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const { aplicarPieMarca } = require('./marca.js');
const { t } = require('./i18n.js');

function contenidoPanelTickets(config) {
    const { botonAbrirCuenta } = require('./cuenta.js');
    const embed = new EmbedBuilder()
        .setTitle((config && config.mensajeSoporteTitulo) || t(config, '🎫 El soporte está abierto', '🎫 Support is open'))
        .setDescription((config && config.mensajeSoporteDescripcion) || t(config, 'Pulsa el botón de abajo para abrir un ticket de soporte.', 'Click the button below to open a support ticket.'))
        .setColor((config && config.colorEmbed) || '#5865F2')
        .setTimestamp();
    aplicarPieMarca(embed, config); // marca blanca: Sokyo en Free, su marca en Pro
    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('create_ticket').setLabel((config && config.textoBoton) || t(config, '📩 Abrir un ticket', '📩 Open a ticket')).setStyle(ButtonStyle.Primary),
        botonAbrirCuenta(config, { vista: 'tickets', emoji: '🗂️', estilo: ButtonStyle.Secondary, etiqueta: t(config, 'Ver mis tickets', 'See my tickets') }),
    );
    return { embeds: [embed], components: [fila] };
}

// ¿Puede el bot publicarlo ahí? (ver, escribir y poner embeds)
function puedePublicar(canal) {
    const yo = canal?.guild?.members?.me;
    if (!canal || typeof canal.send !== 'function' || !yo) return false;
    const F = PermissionsBitField.Flags;
    return !!canal.permissionsFor(yo)?.has([F.ViewChannel, F.SendMessages, F.EmbedLinks]);
}

// Publica el panel en `canal` (o lo actualiza si ya estaba ahí) y apunta dónde está.
async function publicarPanelTickets(canal, config) {
    const ServidorConfig = require('../models/ServidorConfig.js');
    const contenido = contenidoPanelTickets(config);
    const previo = config && config.panelTickets;
    let mensaje = null;
    let actualizado = false;
    if (previo && previo.mensajeId && previo.canalId === canal.id) {
        mensaje = await canal.messages.fetch(previo.mensajeId).catch(() => null);
        if (mensaje) { await mensaje.edit(contenido); actualizado = true; }
    }
    if (!mensaje) mensaje = await canal.send(contenido);
    await ServidorConfig.updateOne(
        { guildId: canal.guild.id },
        { $set: { 'panelTickets.canalId': canal.id, 'panelTickets.mensajeId': mensaje.id, 'panelTickets.fecha': new Date() } },
        { upsert: true },
    );
    require('./config.js').invalidateConfig(canal.guild.id);
    return { mensaje, actualizado };
}

module.exports = { contenidoPanelTickets, publicarPanelTickets, puedePublicar };

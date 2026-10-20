// Mensaje público con el botón "Abrir Ticket" (marca blanca configurable desde el panel web).
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { actualizarConfig } = require('./config.js');
const { truncar } = require('./texto.js');

function construirPanelSoporte(config) {
    const embed = new EmbedBuilder()
        .setTitle(truncar(config.mensajeSoporteTitulo || '🎫 Soporte Técnico Activo', 256))
        .setDescription(truncar(config.mensajeSoporteDescripcion || 'Haz clic en el botón de abajo para abrir un ticket de soporte.', 4096))
        .setColor(config.colorPanel || '#5865F2')
        .setFooter({ text: truncar(config.footerPersonalizado || 'Sistema de Gestión Sokyo', 2048) });

    const boton = new ButtonBuilder()
        .setCustomId('create_ticket')
        .setEmoji('📩')
        .setLabel(truncar(config.textoBoton || 'Abrir Ticket', 80))
        .setStyle(ButtonStyle.Primary);

    return { embeds: [embed], components: [new ActionRowBuilder().addComponents(boton)] };
}

// Publica el panel en un canal y recuerda dónde está para poder actualizarlo después.
async function publicarPanel(canal, config) {
    const mensaje = await canal.send(construirPanelSoporte(config));
    await actualizarConfig(canal.guild.id, { panelCanalId: canal.id, panelMensajeId: mensaje.id });
    return mensaje;
}

// Edita el panel ya publicado con los textos actuales. Devuelve true si se actualizó,
// false si ya no existe (se borró) y null si nunca se publicó.
async function actualizarPanelPublicado(client, config) {
    if (!config.panelCanalId || !config.panelMensajeId) return null;
    try {
        const canal = await client.channels.fetch(config.panelCanalId);
        const mensaje = await canal.messages.fetch(config.panelMensajeId);
        await mensaje.edit(construirPanelSoporte(config));
        return true;
    } catch {
        return false;
    }
}

module.exports = { construirPanelSoporte, publicarPanel, actualizarPanelPublicado };

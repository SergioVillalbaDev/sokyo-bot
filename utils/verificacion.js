// ============================================================================
// verificacion — Gate de entrada al servidor. Publica un panel con un botón;
// al pulsarlo el usuario obtiene el rol verificado (modo 'boton') o debe
// resolver un captcha de imagen (modo 'captcha'). Lo orquesta interactionCreate.
// ============================================================================
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { generarCaptcha } = require('./captcha.js');

// Captchas pendientes: `${guildId}:${userId}` -> { codigo, expira }
const pendientes = new Map();
setInterval(() => {
    const ahora = Date.now();
    for (const [k, v] of pendientes) if (v.expira <= ahora) pendientes.delete(k);
}, 60000).unref();

// Concede el rol verificado al miembro. Devuelve un texto de error o null si OK.
async function conceder(interaction, v) {
    const rid = v.rolVerificadoId;
    if (!rid) return '❌ La verificación no tiene rol configurado. Avisa a un administrador.';
    const rol = interaction.guild.roles.cache.get(rid);
    if (!rol) return '❌ El rol de verificación ya no existe.';
    if (!rol.editable) return '❌ No puedo asignar ese rol (mi rol debe estar por encima). Avisa a un administrador.';
    await interaction.member.roles.add(rid).catch(() => {});
    return null;
}

// Construye el contenido del panel (embed + botón).
function contenidoPanel(v) {
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(v.titulo || '🔒 Verificación')
        .setDescription(v.descripcion || 'Pulsa el botón para verificarte y acceder al servidor.');
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('verif_inicio').setLabel(v.textoBoton || '✅ Verificarme').setStyle(ButtonStyle.Success),
    );
    return { embeds: [embed], components: [row] };
}

// Publica (o reedita) el panel de verificación en el canal configurado.
async function publicarPanel(client, guildId) {
    const cfg = await ServidorConfig.findOne({ guildId });
    const v = cfg && cfg.verificacion;
    if (!v || !v.canalId) throw new Error('Configura primero el canal de verificación.');
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new Error('Servidor no encontrado.');
    const canal = guild.channels.cache.get(v.canalId);
    if (!canal) throw new Error('El canal de verificación no existe.');

    const contenido = contenidoPanel(v);
    let mensaje = null;
    if (v.mensajeId) mensaje = await canal.messages.fetch(v.mensajeId).catch(() => null);
    if (mensaje) await mensaje.edit(contenido);
    else mensaje = await canal.send(contenido);

    await ServidorConfig.updateOne({ guildId }, { $set: { 'verificacion.mensajeId': mensaje.id } });
    return mensaje.id;
}

// Botón "Verificarme".
async function manejarInicio(interaction) {
    const cfg = await ServidorConfig.findOne({ guildId: interaction.guildId });
    const v = cfg && cfg.verificacion;
    if (!v || !v.activo) return interaction.reply({ content: '❌ La verificación no está activa.', ephemeral: true });

    if (v.rolVerificadoId && interaction.member.roles.cache.has(v.rolVerificadoId)) {
        return interaction.reply({ content: '✅ Ya estás verificado.', ephemeral: true });
    }

    // Modo botón: conceder directamente.
    if (v.modo !== 'captcha') {
        const err = await conceder(interaction, v);
        return interaction.reply({ content: err || '✅ ¡Verificado! Ya tienes acceso al servidor.', ephemeral: true });
    }

    // Modo captcha: generar y mostrar imagen.
    const { codigo, buffer } = generarCaptcha();
    pendientes.set(`${interaction.guildId}:${interaction.user.id}`, { codigo, expira: Date.now() + 5 * 60000 });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('verif_introducir').setLabel('⌨️ Introducir código').setStyle(ButtonStyle.Primary),
    );
    const payload = { content: '🧩 Resuelve el captcha y pulsa **Introducir código** (caduca en 5 min).', components: [row], ephemeral: true };
    if (buffer) {
        payload.files = [new AttachmentBuilder(buffer, { name: 'captcha.png' })];
    } else {
        // Sin canvas: mostramos el código en texto (fallback).
        payload.content += `\n\nCódigo: \`${codigo}\``;
    }
    return interaction.reply(payload);
}

// Botón "Introducir código" -> abre el modal.
async function manejarIntroducir(interaction) {
    const modal = new ModalBuilder().setCustomId('verif_modal').setTitle('Verificación');
    const input = new TextInputBuilder()
        .setCustomId('codigo')
        .setLabel('Escribe el código de la imagen')
        .setStyle(TextInputStyle.Short)
        .setMinLength(5).setMaxLength(5).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
}

// Envío del modal con el código.
async function manejarModal(interaction) {
    const cfg = await ServidorConfig.findOne({ guildId: interaction.guildId });
    const v = cfg && cfg.verificacion;
    if (!v || !v.activo) return interaction.reply({ content: '❌ La verificación no está activa.', ephemeral: true });

    const clave = `${interaction.guildId}:${interaction.user.id}`;
    const reto = pendientes.get(clave);
    if (!reto || reto.expira <= Date.now()) {
        pendientes.delete(clave);
        return interaction.reply({ content: '⏰ El captcha ha caducado. Pulsa **Verificarme** otra vez.', ephemeral: true });
    }

    const respuesta = (interaction.fields.getTextInputValue('codigo') || '').trim().toUpperCase();
    if (respuesta !== reto.codigo) {
        return interaction.reply({ content: '❌ Código incorrecto. Pulsa **Verificarme** para intentarlo de nuevo.', ephemeral: true });
    }

    pendientes.delete(clave);
    const err = await conceder(interaction, v);
    return interaction.reply({ content: err || '✅ ¡Verificado! Ya tienes acceso al servidor.', ephemeral: true });
}

module.exports = { publicarPanel, manejarInicio, manejarIntroducir, manejarModal };

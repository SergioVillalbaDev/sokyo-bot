// ============================================================================
// verificacion — Gate de entrada al servidor. Publica un panel con un botón;
// al pulsarlo el usuario obtiene el rol verificado (modo 'boton') o debe
// resolver un captcha de imagen (modo 'captcha'). Lo orquesta interactionCreate.
// ============================================================================
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { generarCaptcha } = require('./captcha.js');
const { construirMensaje, embedTieneContenido } = require('./embeds.js');
const { t } = require('./i18n.js');

// Carpeta de imágenes subidas (para los embeds personalizados con imagen/GIF).
const UPLOADS_DIR = path.join(__dirname, '..', 'api', 'uploads');

// Captchas pendientes: `${guildId}:${userId}` -> { codigo, expira }
const pendientes = new Map();
setInterval(() => {
    const ahora = Date.now();
    for (const [k, v] of pendientes) if (v.expira <= ahora) pendientes.delete(k);
}, 60000).unref();

// Concede el rol verificado al miembro. Devuelve un texto de error o null si OK.
async function conceder(interaction, v, cfg) {
    const rid = v.rolVerificadoId;
    if (!rid) return t(cfg, '❌ La verificación no tiene un rol configurado. Avisa a un administrador.', '❌ Verification has no role set up. Let an administrator know.');
    const rol = interaction.guild.roles.cache.get(rid);
    if (!rol) return t(cfg, '❌ El rol de verificación ya no existe.', '❌ The verification role no longer exists.');
    if (!rol.editable) return t(cfg, '❌ No puedo asignar ese rol (mi rol debe estar por encima). Avisa a un administrador.', '❌ I can’t assign that role (my role must be higher). Let an administrator know.');
    await interaction.member.roles.add(rid).catch(() => {});
    return null;
}

// Construye el contenido del panel (embed + botón). Si hay un embed personalizado
// con contenido, se usa ese (color, imagen, GIF, campos…); si no, se cae al
// título/descripción básicos. El botón siempre se añade al final.
function contenidoPanel(v, cfg) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('verif_inicio').setLabel(v.textoBoton || t(cfg, '✅ Verificarme', '✅ Verify me')).setStyle(ButtonStyle.Success),
    );

    if (v.embed && embedTieneContenido(v.embed)) {
        const payload = construirMensaje('', v.embed, UPLOADS_DIR);
        payload.components = [row];
        return payload;
    }

    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(v.titulo || t(cfg, '🔒 Verificación', '🔒 Verification'))
        .setDescription(v.descripcion || t(cfg, 'Pulsa el botón para verificarte y acceder al servidor.', 'Click the button to verify and access the server.'));
    return { embeds: [embed], components: [row] };
}

// Publica (o reedita) el panel de verificación en el canal configurado.
async function publicarPanel(client, guildId) {
    const cfg = await ServidorConfig.findOne({ guildId });
    const v = cfg && cfg.verificacion;
    if (!v || !v.canalId) throw new Error('Set up the verification channel first.');
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new Error('Server not found.');
    const canal = guild.channels.cache.get(v.canalId);
    if (!canal) throw new Error('The verification channel doesn’t exist.');

    const contenido = contenidoPanel(v, cfg);
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
    if (!v || !v.activo) return interaction.reply({ content: t(cfg, '❌ La verificación no está activa.', '❌ Verification is not active.'), ephemeral: true });

    if (v.rolVerificadoId && interaction.member.roles.cache.has(v.rolVerificadoId)) {
        return interaction.reply({ content: t(cfg, '✅ Ya estás verificado.', '✅ You’re already verified.'), ephemeral: true });
    }

    // Modo botón: conceder directamente.
    if (v.modo !== 'captcha') {
        const err = await conceder(interaction, v, cfg);
        return interaction.reply({ content: err || t(cfg, '✅ ¡Verificado! Ya tienes acceso al servidor.', '✅ Verified! You now have access to the server.'), ephemeral: true });
    }

    // Modo captcha: generar y mostrar imagen.
    const { codigo, buffer } = generarCaptcha();
    pendientes.set(`${interaction.guildId}:${interaction.user.id}`, { codigo, expira: Date.now() + 5 * 60000 });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('verif_introducir').setLabel(t(cfg, '⌨️ Introducir código', '⌨️ Enter code')).setStyle(ButtonStyle.Primary),
    );
    const payload = { content: t(cfg, '🧩 Resuelve el captcha y pulsa **Introducir código** (caduca en 5 min).', '🧩 Solve the captcha and click **Enter code** (expires in 5 min).'), components: [row], ephemeral: true };
    if (buffer) {
        payload.files = [new AttachmentBuilder(buffer, { name: 'captcha.png' })];
    } else {
        // Sin canvas: mostramos el código en texto (fallback).
        payload.content += t(cfg, `\n\nCódigo: \`${codigo}\``, `\n\nCode: \`${codigo}\``);
    }
    return interaction.reply(payload);
}

// Botón "Introducir código" -> abre el modal.
async function manejarIntroducir(interaction) {
    const cfg = await ServidorConfig.findOne({ guildId: interaction.guildId });
    const modal = new ModalBuilder().setCustomId('verif_modal').setTitle(t(cfg, 'Verificación', 'Verification'));
    const input = new TextInputBuilder()
        .setCustomId('codigo')
        .setLabel(t(cfg, 'Escribe el código de la imagen', 'Type the code from the image'))
        .setStyle(TextInputStyle.Short)
        .setMinLength(5).setMaxLength(5).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
}

// Envío del modal con el código.
async function manejarModal(interaction) {
    const cfg = await ServidorConfig.findOne({ guildId: interaction.guildId });
    const v = cfg && cfg.verificacion;
    if (!v || !v.activo) return interaction.reply({ content: t(cfg, '❌ La verificación no está activa.', '❌ Verification is not active.'), ephemeral: true });

    const clave = `${interaction.guildId}:${interaction.user.id}`;
    const reto = pendientes.get(clave);
    if (!reto || reto.expira <= Date.now()) {
        pendientes.delete(clave);
        return interaction.reply({ content: t(cfg, '⏰ El captcha ha caducado. Pulsa **Verificarme** de nuevo.', '⏰ The captcha expired. Click **Verify me** again.'), ephemeral: true });
    }

    const respuesta = (interaction.fields.getTextInputValue('codigo') || '').trim().toUpperCase();
    if (respuesta !== reto.codigo) {
        return interaction.reply({ content: t(cfg, '❌ Código incorrecto. Pulsa **Verificarme** para volver a intentarlo.', '❌ Wrong code. Click **Verify me** to try again.'), ephemeral: true });
    }

    pendientes.delete(clave);
    const err = await conceder(interaction, v, cfg);
    return interaction.reply({ content: err || t(cfg, '✅ ¡Verificado! Ya tienes acceso al servidor.', '✅ Verified! You now have access to the server.'), ephemeral: true });
}

module.exports = { publicarPanel, manejarInicio, manejarIntroducir, manejarModal };

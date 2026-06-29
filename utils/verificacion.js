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
    if (!rid) return '❌ Verification has no role set up. Let an administrator know.';
    const rol = interaction.guild.roles.cache.get(rid);
    if (!rol) return '❌ The verification role no longer exists.';
    if (!rol.editable) return '❌ I can’t assign that role (my role must be higher). Let an administrator know.';
    await interaction.member.roles.add(rid).catch(() => {});
    return null;
}

// Construye el contenido del panel (embed + botón).
function contenidoPanel(v) {
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(v.titulo || '🔒 Verification')
        .setDescription(v.descripcion || 'Click the button to verify and access the server.');
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('verif_inicio').setLabel(v.textoBoton || '✅ Verify me').setStyle(ButtonStyle.Success),
    );
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
    if (!v || !v.activo) return interaction.reply({ content: '❌ Verification is not active.', ephemeral: true });

    if (v.rolVerificadoId && interaction.member.roles.cache.has(v.rolVerificadoId)) {
        return interaction.reply({ content: '✅ You’re already verified.', ephemeral: true });
    }

    // Modo botón: conceder directamente.
    if (v.modo !== 'captcha') {
        const err = await conceder(interaction, v);
        return interaction.reply({ content: err || '✅ Verified! You now have access to the server.', ephemeral: true });
    }

    // Modo captcha: generar y mostrar imagen.
    const { codigo, buffer } = generarCaptcha();
    pendientes.set(`${interaction.guildId}:${interaction.user.id}`, { codigo, expira: Date.now() + 5 * 60000 });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('verif_introducir').setLabel('⌨️ Enter code').setStyle(ButtonStyle.Primary),
    );
    const payload = { content: '🧩 Solve the captcha and click **Enter code** (expires in 5 min).', components: [row], ephemeral: true };
    if (buffer) {
        payload.files = [new AttachmentBuilder(buffer, { name: 'captcha.png' })];
    } else {
        // Sin canvas: mostramos el código en texto (fallback).
        payload.content += `\n\nCode: \`${codigo}\``;
    }
    return interaction.reply(payload);
}

// Botón "Introducir código" -> abre el modal.
async function manejarIntroducir(interaction) {
    const modal = new ModalBuilder().setCustomId('verif_modal').setTitle('Verification');
    const input = new TextInputBuilder()
        .setCustomId('codigo')
        .setLabel('Type the code from the image')
        .setStyle(TextInputStyle.Short)
        .setMinLength(5).setMaxLength(5).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
}

// Envío del modal con el código.
async function manejarModal(interaction) {
    const cfg = await ServidorConfig.findOne({ guildId: interaction.guildId });
    const v = cfg && cfg.verificacion;
    if (!v || !v.activo) return interaction.reply({ content: '❌ Verification is not active.', ephemeral: true });

    const clave = `${interaction.guildId}:${interaction.user.id}`;
    const reto = pendientes.get(clave);
    if (!reto || reto.expira <= Date.now()) {
        pendientes.delete(clave);
        return interaction.reply({ content: '⏰ The captcha expired. Click **Verify me** again.', ephemeral: true });
    }

    const respuesta = (interaction.fields.getTextInputValue('codigo') || '').trim().toUpperCase();
    if (respuesta !== reto.codigo) {
        return interaction.reply({ content: '❌ Wrong code. Click **Verify me** to try again.', ephemeral: true });
    }

    pendientes.delete(clave);
    const err = await conceder(interaction, v);
    return interaction.reply({ content: err || '✅ Verified! You now have access to the server.', ephemeral: true });
}

module.exports = { publicarPanel, manejarInicio, manejarIntroducir, manejarModal };

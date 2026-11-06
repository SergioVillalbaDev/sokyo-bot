// ============================================================================
// verificacion — Gate de entrada al servidor. Publica un panel con un botón;
// al pulsarlo el usuario obtiene el rol verificado (modo 'boton') o debe
// resolver un captcha de imagen (modo 'captcha'). Lo orquesta interactionCreate.
// ============================================================================
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { generarCaptcha } = require('./captcha.js');
const { construirMensaje, embedTieneContenido, estiloBoton } = require('./embeds.js');
const { mencionarEnMensaje } = require('./mencionesCanal.js');
const { t } = require('./i18n.js');
const puerta = require('./puertaEntrada.js');

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
    // Si Discord no deja dar el rol, no se da por verificado (ni se quita «Sin verificar»).
    if (!(await interaction.member.roles.add(rid).then(() => true, () => false))) {
        return t(cfg, '❌ No he podido darte el rol ahora mismo. Inténtalo otra vez en un momento o avisa a un administrador.', '❌ I couldn’t give you the role right now. Try again in a moment or let an administrator know.');
    }
    // Al verificarse (1.9.15): roles de más, quitar «Sin verificar», privado y registro.
    const tras = await puerta.trasVerificarse(interaction.member, cfg);
    return tras.fallo ? t(cfg, '✅ ¡Verificado! ⚠️ Algún rol de más no se ha podido dar (el rol del bot tiene que estar por encima). Avisa al staff.', '✅ Verified! ⚠️ Some extra role couldn’t be given (the bot’s role must be higher). Let the staff know.') : null;
}

// Construye el contenido del panel (embed + botón). Si hay un embed personalizado
// con contenido, se usa ese (color, imagen, GIF, campos…); si no, se cae al
// título/descripción básicos. El botón siempre se añade al final.
function contenidoPanel(v, cfg, guild) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('verif_inicio').setLabel(v.textoBoton || t(cfg, '✅ Verificarme', '✅ Verify me')).setStyle(estiloBoton(v.estiloBoton)),
    );

    if (v.embed && embedTieneContenido(v.embed)) {
        // «#reglas» → enlace al canal (descripción y campos).
        const { embed } = mencionarEnMensaje('', v.embed, guild);
        const payload = construirMensaje('', embed, UPLOADS_DIR);
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
    if (!v || !v.canalId) throw new Error(t(cfg, 'Configura primero el canal de verificación.', 'Set up the verification channel first.'));
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new Error(t(cfg, 'Servidor no encontrado.', 'Server not found.'));
    const canal = guild.channels.cache.get(v.canalId);
    if (!canal) throw new Error(t(cfg, 'El canal de verificación no existe.', 'The verification channel doesn’t exist.'));

    const contenido = contenidoPanel(v, cfg, guild);
    let mensaje = null;
    if (v.mensajeId) mensaje = await canal.messages.fetch(v.mensajeId).catch(() => null);
    // attachments: [] quita la imagen subida de antes (si no, se quedaba debajo al cambiarla).
    if (mensaje) await mensaje.edit({ ...contenido, attachments: [] });
    else mensaje = await canal.send(contenido);

    await ServidorConfig.updateOne({ guildId }, { $set: { 'verificacion.mensajeId': mensaje.id } });
    return mensaje.id;
}

// Responde a la interacción tanto si es la primera respuesta como si ya se respondió
// (tras aceptar las normas, el resto va en mensajes nuevos, solo para él).
const responder = (interaction, payload) => ((interaction.deferred || interaction.replied)
    ? interaction.followUp({ ...payload, flags: 64 })
    : interaction.reply({ ...payload, flags: 64 }));

// Botón "Verificarme": requisitos (1.9.15), normas, y luego el botón o el captcha.
async function manejarInicio(interaction) {
    const cfg = await ServidorConfig.findOne({ guildId: interaction.guildId });
    const v = cfg && cfg.verificacion;
    if (!v || !v.activo) return interaction.reply({ content: t(cfg, '❌ La verificación no está activa.', '❌ Verification is not active.'), flags: 64 });

    if (v.rolVerificadoId && interaction.member.roles.cache.has(v.rolVerificadoId)) {
        return interaction.reply({ content: t(cfg, '✅ Ya estás verificado.', '✅ You’re already verified.'), flags: 64 });
    }
    // Requisitos: cuenta con X días, foto de perfil, un rato dentro antes de verificarse.
    const falla = puerta.requisitoQueFalla(interaction.member, cfg);
    if (falla) {
        await puerta.registrarBloqueo(interaction.guild, cfg, interaction.user, falla.tipo);
        return interaction.reply({ content: falla.texto, flags: 64 });
    }
    // Normas que hay que aceptar antes (se piden una vez cada 15 min).
    if (puerta.hayNormas(cfg) && !puerta.yaAceptoNormas(interaction.guildId, interaction.user.id)) {
        return interaction.reply(puerta.pantallaNormas(cfg, interaction.guild));
    }
    return seguir(interaction, cfg, v);
}

// «He leído y acepto» de las normas → sigue la verificación.
async function manejarNormas(interaction) {
    const cfg = await ServidorConfig.findOne({ guildId: interaction.guildId });
    const v = cfg && cfg.verificacion;
    if (!v || !v.activo) return interaction.update({ content: t(cfg, '❌ La verificación no está activa.', '❌ Verification is not active.'), embeds: [], components: [] });
    puerta.aceptarNormas(interaction.guildId, interaction.user.id);
    await interaction.update({ content: t(cfg, '✅ Normas aceptadas.', '✅ Rules accepted.'), embeds: [], components: [] });
    return seguir(interaction, cfg, v);
}

// El paso de verdad: un clic (o las preguntas) o el captcha.
async function seguir(interaction, cfg, v) {
    // Modo botón: conceder directamente (o, si hay preguntas o aprobación, eso antes).
    if (v.modo !== 'captcha') {
        if (await require('./preguntasEntrada.js').siHayPreguntas(interaction, { gid: interaction.guildId, cfg, origen: 'verif' })) return;
        const err = await conceder(interaction, v, cfg);
        return responder(interaction, { content: err || mensajeVerificado(cfg, interaction) });
    }

    // Modo captcha: tras fallar todos los intentos, hay que esperar un rato.
    const hasta = puerta.captchaEsperaHasta(interaction.guildId, interaction.user.id);
    if (hasta) {
        return responder(interaction, { content: t(cfg, `⏳ Has fallado el captcha demasiadas veces. Podrás volver a intentarlo <t:${Math.floor(hasta / 1000)}:R>.`, `⏳ You failed the captcha too many times. You can try again <t:${Math.floor(hasta / 1000)}:R>.`) });
    }
    const o = puerta.opciones(cfg);
    const { codigo, buffer } = generarCaptcha(o.captchaLongitud);
    pendientes.set(`${interaction.guildId}:${interaction.user.id}`, { codigo, expira: Date.now() + o.captchaMinutos * 60000 });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('verif_introducir').setLabel(t(cfg, '⌨️ Introducir código', '⌨️ Enter code')).setStyle(ButtonStyle.Primary),
    );
    const payload = { content: t(cfg, `🧩 Resuelve el captcha y pulsa **Introducir código** (caduca en ${o.captchaMinutos} min).`, `🧩 Solve the captcha and click **Enter code** (expires in ${o.captchaMinutos} min).`), components: [row] };
    if (buffer) {
        payload.files = [new AttachmentBuilder(buffer, { name: 'captcha.png' })];
    } else {
        // Sin canvas: mostramos el código en texto (fallback).
        payload.content += t(cfg, `\n\nCódigo: \`${codigo}\``, `\n\nCode: \`${codigo}\``);
    }
    return responder(interaction, payload);
}

// El «¡Verificado!» (o el personalizado del panel → Al verificarse).
function mensajeVerificado(cfg, interaction) {
    return puerta.textoExito(cfg, interaction.guild, interaction.user) || t(cfg, '✅ ¡Verificado! Ya tienes acceso al servidor.', '✅ Verified! You now have access to the server.');
}

// Botón "Introducir código" -> abre el modal (con el largo del código de este captcha).
async function manejarIntroducir(interaction) {
    const cfg = await ServidorConfig.findOne({ guildId: interaction.guildId });
    const reto = pendientes.get(`${interaction.guildId}:${interaction.user.id}`);
    const largo = reto ? reto.codigo.length : puerta.opciones(cfg).captchaLongitud;
    const modal = new ModalBuilder().setCustomId('verif_modal').setTitle(t(cfg, 'Verificación', 'Verification'));
    const input = new TextInputBuilder()
        .setCustomId('codigo')
        .setLabel(t(cfg, 'Escribe el código de la imagen', 'Type the code from the image'))
        .setStyle(TextInputStyle.Short)
        .setMinLength(largo).setMaxLength(largo).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
}

// Envío del modal con el código.
async function manejarModal(interaction) {
    const cfg = await ServidorConfig.findOne({ guildId: interaction.guildId });
    const v = cfg && cfg.verificacion;
    if (!v || !v.activo) return interaction.reply({ content: t(cfg, '❌ La verificación no está activa.', '❌ Verification is not active.'), flags: 64 });

    const clave = `${interaction.guildId}:${interaction.user.id}`;
    const reto = pendientes.get(clave);
    if (!reto || reto.expira <= Date.now()) {
        pendientes.delete(clave);
        return interaction.reply({ content: t(cfg, '⏰ El captcha ha caducado. Pulsa **Verificarme** de nuevo.', '⏰ The captcha expired. Click **Verify me** again.'), flags: 64 });
    }

    const respuesta = (interaction.fields.getTextInputValue('codigo') || '').trim().toUpperCase();
    if (respuesta !== reto.codigo) {
        // Intentos (1.9.15): al gastarlos todos, esperar, aislar o expulsar (lo que se elija).
        pendientes.delete(clave);
        const hasta = Math.floor((Date.now() + 10 * 60000) / 1000);
        const textos = {
            esperar: t(cfg, `❌ Código incorrecto y sin más intentos. Podrás volver a probar <t:${hasta}:R>.`, `❌ Wrong code and no attempts left. You can try again <t:${hasta}:R>.`),
            aislar: t(cfg, '❌ Código incorrecto y sin más intentos: te he aislado 10 minutos. Después podrás volver a probar.', '❌ Wrong code and no attempts left: you’ve been timed out for 10 minutes. You can try again afterwards.'),
            expulsar: t(cfg, '❌ Código incorrecto y sin más intentos.', '❌ Wrong code and no attempts left.'),
        };
        const { quedan } = puerta.contarFalloCaptcha(interaction.guildId, interaction.user.id, cfg);
        if (quedan > 0) {
            return interaction.reply({ content: t(cfg, `❌ Código incorrecto. Te quedan **${quedan}** intento${quedan === 1 ? '' : 's'}: pulsa **Verificarme** para otro código.`, `❌ Wrong code. You have **${quedan}** attempt${quedan === 1 ? '' : 's'} left: click **Verify me** for a new code.`), flags: 64 });
        }
        // La respuesta va antes de aislar o expulsar (después ya no se podría).
        await interaction.reply({ content: textos[puerta.accionCaptcha(interaction.member, cfg)], flags: 64 }).catch(() => {});
        return puerta.castigarCaptcha(interaction.member, cfg);
    }

    pendientes.delete(clave);
    if (await require('./preguntasEntrada.js').siHayPreguntas(interaction, { gid: interaction.guildId, cfg, origen: 'verif' })) return;
    const err = await conceder(interaction, v, cfg);
    return interaction.reply({ content: err || mensajeVerificado(cfg, interaction), flags: 64 });
}

module.exports = { publicarPanel, contenidoPanel, manejarInicio, manejarNormas, manejarIntroducir, manejarModal, _pendientes: pendientes };

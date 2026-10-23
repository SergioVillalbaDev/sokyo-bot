// ============================================================================
// Embudo de Bienvenida · Test A/B de retención.
//
// Dos responsabilidades:
//  1) CAPTURA DE DATOS: asignar variante al entrar y anotar los hitos
//     (verificación, participación, salida). Lo usan los eventos.
//  2) FLUJO EN DISCORD: mostrar la variante (panel o MD), captcha, conceder el
//     rol. Lo orquesta interactionCreate.
//
// Variante A = reglas en texto plano + captcha. Variante B = embed visual con
// botones interactivos. Para que el flujo funcione igual por panel y por MD, los
// customId llevan el guildId incrustado (`embudo_x:<guildId>`): así los handlers
// resuelven el servidor y el miembro aunque la interacción venga de un MD.
// ============================================================================
const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder,
} = require('discord.js');
const EmbudoCohorte = require('../models/EmbudoCohorte.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { generarCaptcha } = require('./captcha.js');
const { esPro } = require('./billing.js');
const { t } = require('./i18n.js');

// ----------------------------------------------------------------------------
// 1) CAPTURA DE DATOS
// ----------------------------------------------------------------------------

// Asigna una variante (A/B) a un usuario que entra y crea/recupera su ficha.
// Reparto equilibrado: se asigna a la variante con menos miembros (empate = azar),
// para que en servidores pequeños el test no quede sesgado. Devuelve la ficha o
// null si el embudo no está activo. No vuelve a crear la ficha si ya existe.
async function asignarCohorte(member, cfg) {
    const e = cfg && cfg.embudoAB;
    if (!e || !e.activo) return null;
    if (!esPro(cfg)) return null; // función Pro: si el servidor ya no es Pro, no reparte

    const guildId = member.guild.id;
    const userId = member.id;

    // ¿Ya tiene ficha? (p. ej. salió y volvió a entrar) — la reutilizamos.
    const existente = await EmbudoCohorte.findOne({ guildId, userId });
    if (existente) {
        if (!existente.sigueEnServidor) {
            existente.sigueEnServidor = true;
            existente.fechaSalida = null;
            await existente.save();
        }
        return existente;
    }

    // Reparto equilibrado entre A y B.
    const [nA, nB] = await Promise.all([
        EmbudoCohorte.countDocuments({ guildId, variante: 'A' }),
        EmbudoCohorte.countDocuments({ guildId, variante: 'B' }),
    ]);
    let variante;
    if (nA < nB) variante = 'A';
    else if (nB < nA) variante = 'B';
    else variante = Math.random() < 0.5 ? 'A' : 'B';

    try {
        return await EmbudoCohorte.create({
            guildId, userId,
            usuarioTag: member.user.username,
            variante,
            entrega: e.entrega === 'md' ? 'md' : 'panel', // 'ambos' se registra como panel; el MD es un extra
        });
    } catch (err) {
        // Carrera: otra ejecución la creó a la vez. Recuperamos la existente.
        if (err && err.code === 11000) return EmbudoCohorte.findOne({ guildId, userId });
        throw err;
    }
}

// Marca que el usuario participó (su primer mensaje). Solo escribe la primera vez.
async function marcarParticipacion(guildId, userId) {
    await EmbudoCohorte.updateOne(
        { guildId, userId, participo: false },
        { $set: { participo: true, fechaPrimerMensaje: new Date() } },
    );
}

// Marca que el usuario completó el onboarding (consiguió el rol verificado).
async function marcarVerificado(guildId, userId) {
    await EmbudoCohorte.updateOne(
        { guildId, userId, verificado: false },
        { $set: { verificado: true, fechaVerificado: new Date() } },
    );
}

// Marca que el usuario salió del servidor (para la retención).
async function marcarSalida(guildId, userId) {
    await EmbudoCohorte.updateOne(
        { guildId, userId },
        { $set: { sigueEnServidor: false, fechaSalida: new Date() } },
    );
}

// ----------------------------------------------------------------------------
// 2) FLUJO EN DISCORD
// ----------------------------------------------------------------------------

// Captchas pendientes del embudo: `${guildId}:${userId}` -> { codigo, expira }
const captchasPendientes = new Map();
setInterval(() => {
    const ahora = Date.now();
    for (const [k, v] of captchasPendientes) if (v.expira <= ahora) captchasPendientes.delete(k);
}, 60000).unref();

// Concede el rol del embudo al miembro. Devuelve un texto de error o null si OK.
async function conceder(member, e, cfg) {
    const rid = e && e.rolVerificadoId;
    if (!rid) return t(cfg, '❌ El embudo no tiene rol configurado. Avisa a un administrador.', '❌ The funnel has no role set up. Let an administrator know.');
    const rol = member.guild.roles.cache.get(rid);
    if (!rol) return t(cfg, '❌ El rol del embudo ya no existe.', '❌ The funnel role no longer exists.');
    if (!rol.editable) return t(cfg, '❌ No puedo asignar ese rol (mi rol debe estar por encima). Avisa a un administrador.', '❌ I can’t assign that role (my role must be higher). Let an administrator know.');
    await member.roles.add(rid).catch(() => {});
    return null;
}

// Resuelve el contexto de una interacción del embudo: guildId (del customId, con
// respaldo en interaction.guildId), la config y el miembro. Funciona por panel
// (hay guild) y por MD (no hay guild; lo sacamos del customId y lo buscamos).
async function resolverContexto(interaction, client) {
    const gid = (interaction.customId.split(':')[1]) || interaction.guildId;
    if (!gid) return { error: t(null, '❌ No se pudo identificar el servidor.', '❌ Couldn’t identify the server.') };
    const cfg = await ServidorConfig.findOne({ guildId: gid });
    const e = cfg && cfg.embudoAB;
    if (!e || !e.activo) return { error: t(cfg, '❌ El embudo de bienvenida no está activo.', '❌ The welcome funnel is not active.') };
    if (!esPro(cfg)) return { error: t(cfg, '❌ El embudo de bienvenida no está disponible ahora mismo.', '❌ The welcome funnel isn’t available right now.') };
    const guild = client.guilds.cache.get(gid);
    if (!guild) return { error: t(cfg, '❌ Servidor no encontrado.', '❌ Server not found.') };
    const member = await guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member) return { error: t(cfg, '❌ Ya no estás en ese servidor.', '❌ You’re no longer in that server.') };
    return { gid, cfg, e, guild, member };
}

// ¿El miembro ya completó el onboarding (tiene el rol)?
function yaTieneAcceso(member, e) {
    return !!(e.rolVerificadoId && member.roles.cache.has(e.rolVerificadoId));
}

// Construye los botones de captcha (variante A) embebiendo el guildId.
function filaCaptcha(gid, cfg) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`embudo_captcha:${gid}`).setLabel(t(cfg, '⌨️ Introducir código', '⌨️ Enter code')).setStyle(ButtonStyle.Primary),
    );
}

// Genera y guarda un reto de captcha; devuelve el payload (imagen + botón).
function retoCaptcha(gid, userId, varA, cfg) {
    const { codigo, buffer } = generarCaptcha();
    captchasPendientes.set(`${gid}:${userId}`, { codigo, expira: Date.now() + 5 * 60000 });
    const payload = {
        content: `🧩 **${varA.titulo || t(cfg, 'Verificación', 'Verification')}**\n\n${varA.reglas || ''}\n\n${t(cfg, 'Resuelve el captcha y pulsa **Introducir código** (caduca en 5 min).', 'Solve the captcha and click **Enter code** (expires in 5 min).')}`,
        components: [filaCaptcha(gid, cfg)],
    };
    if (buffer) payload.files = [new AttachmentBuilder(buffer, { name: 'captcha.png' })];
    else payload.content += t(cfg, `\n\nCódigo: \`${codigo}\``, `\n\nCode: \`${codigo}\``); // fallback sin canvas
    return payload;
}

// Construye el contenido de la variante asignada para mostrar al usuario.
// `cohorte.variante` decide A o B. Devuelve un payload listo para enviar (MD) o
// responder (ephemeral en panel).
function contenidoVariante(gid, userId, e, variante, cfg) {
    if (variante === 'A') {
        const a = e.varianteA || {};
        if (a.captcha !== false) return retoCaptcha(gid, userId, a, cfg);
        // Variante A sin captcha: reglas + botón de aceptar.
        return {
            content: `📋 **${a.titulo || t(cfg, 'Normas', 'Rules')}**\n\n${a.reglas || ''}`,
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`embudo_aceptar:${gid}`).setLabel(a.textoBoton || t(cfg, '✅ Aceptar y acceder', '✅ Accept and enter')).setStyle(ButtonStyle.Success),
            )],
        };
    }
    // Variante B: embed visual con botones.
    const b = e.varianteB || {};
    const embed = new EmbedBuilder()
        .setColor(b.color || '#5865F2')
        .setTitle(b.titulo || t(cfg, '👋 ¡Bienvenido!', '👋 Welcome!'))
        .setDescription(b.descripcion || t(cfg, 'Pulsa **Unirme** para acceder al servidor.', 'Click **Join** to access the server.'));
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`embudo_reglas:${gid}`).setLabel(t(cfg, '📜 Ver normas', '📜 View rules')).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`embudo_aceptar:${gid}`).setLabel(b.textoBoton || t(cfg, '🎉 Unirme', '🎉 Join')).setStyle(ButtonStyle.Success),
    );
    return { embeds: [embed], components: [row] };
}

// Construye el panel público (entrega = panel): un único botón "Empezar".
function contenidoPanel(gid, e, cfg) {
    const embed = new EmbedBuilder()
        .setColor((e.varianteB && e.varianteB.color) || '#5865F2')
        .setTitle(t(cfg, '👋 ¡Bienvenido al servidor!', '👋 Welcome to the server!'))
        .setDescription(t(cfg, 'Pulsa el botón para empezar y acceder a todos los canales.', 'Click the button to get started and access all channels.'));
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`embudo_inicio:${gid}`).setLabel(t(cfg, '🚀 Empezar', '🚀 Get started')).setStyle(ButtonStyle.Success),
    );
    return { embeds: [embed], components: [row] };
}

// Publica (o reedita) el panel del embudo en el canal configurado.
async function publicarPanel(client, guildId) {
    const cfg = await ServidorConfig.findOne({ guildId });
    const e = cfg && cfg.embudoAB;
    if (!e || !e.canalId) throw new Error('Configura primero el canal del embudo.');
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new Error('Servidor no encontrado.');
    const canal = guild.channels.cache.get(e.canalId);
    if (!canal) throw new Error('El canal del embudo no existe.');

    const contenido = contenidoPanel(guildId, e, cfg);
    let mensaje = null;
    if (e.mensajeId) mensaje = await canal.messages.fetch(e.mensajeId).catch(() => null);
    if (mensaje) await mensaje.edit(contenido);
    else mensaje = await canal.send(contenido);

    await ServidorConfig.updateOne({ guildId }, { $set: { 'embudoAB.mensajeId': mensaje.id } });
    return mensaje.id;
}

// Envía el onboarding por MD al miembro que acaba de entrar (entrega = md/ambos).
// Marca `mostrado` según haya funcionado el MD. Devuelve true si se envió.
async function enviarMD(member, e, cohorte) {
    if (!cohorte) return false;
    const cfg = await ServidorConfig.findOne({ guildId: member.guild.id });
    const payload = contenidoVariante(member.guild.id, member.id, e, cohorte.variante, cfg);
    try {
        await member.send(payload);
        cohorte.mostrado = true;
        await cohorte.save();
        return true;
    } catch {
        return false; // MDs cerrados: el panel (si lo hay) sigue disponible
    }
}

// --- Handlers de interacción (los enruta interactionCreate por prefijo) ---

// Botón "Empezar" del panel: muestra la variante asignada de forma efímera.
async function manejarInicio(interaction, client) {
    const ctx = await resolverContexto(interaction, client);
    if (ctx.error) return interaction.reply({ content: ctx.error, ephemeral: true });
    const { gid, e, member, cfg } = ctx;

    if (yaTieneAcceso(member, e)) return interaction.reply({ content: t(cfg, '✅ Ya tienes acceso al servidor.', '✅ You already have access to the server.'), ephemeral: true });

    // Recupera la ficha (o la crea si entró antes de activar el embudo).
    let cohorte = await EmbudoCohorte.findOne({ guildId: gid, userId: member.id });
    if (!cohorte) cohorte = await asignarCohorte(member, ctx.cfg);
    if (cohorte && !cohorte.mostrado) { cohorte.mostrado = true; await cohorte.save(); }

    const payload = contenidoVariante(gid, member.id, e, cohorte ? cohorte.variante : 'B', cfg);
    payload.ephemeral = true;
    return interaction.reply(payload);
}

// Variante B — botón "Ver normas": muestra las reglas de forma efímera.
async function manejarReglas(interaction, client) {
    const ctx = await resolverContexto(interaction, client);
    if (ctx.error) return interaction.reply({ content: ctx.error, ephemeral: true });
    const reglas = (ctx.e.varianteB && ctx.e.varianteB.reglas) || t(ctx.cfg, 'No hay normas configuradas.', 'No rules configured.');
    return interaction.reply({ content: `📜 **${t(ctx.cfg, 'Normas del servidor', 'Server rules')}**\n\n${reglas}`, ephemeral: true });
}

// Botón "Aceptar/Unirme" (variante B y variante A sin captcha): concede el rol.
async function manejarAceptar(interaction, client) {
    const ctx = await resolverContexto(interaction, client);
    if (ctx.error) return interaction.reply({ content: ctx.error, ephemeral: true });
    const { gid, e, member, cfg } = ctx;
    if (yaTieneAcceso(member, e)) return interaction.reply({ content: t(cfg, '✅ Ya tienes acceso al servidor.', '✅ You already have access to the server.'), ephemeral: true });

    const err = await conceder(member, e, cfg);
    if (!err) await marcarVerificado(gid, member.id);
    return interaction.reply({ content: err || t(cfg, '✅ ¡Listo! Ya tienes acceso al servidor. 🎉', '✅ Done! You now have access to the server. 🎉'), ephemeral: true });
}

// Variante A — botón "Introducir código": abre el modal del captcha.
async function manejarCaptcha(interaction, client) {
    const ctx = await resolverContexto(interaction, client);
    if (ctx.error) return interaction.reply({ content: ctx.error, ephemeral: true });
    const modal = new ModalBuilder().setCustomId(`embudo_modal:${ctx.gid}`).setTitle(t(ctx.cfg, 'Verificación', 'Verification'));
    const input = new TextInputBuilder()
        .setCustomId('codigo').setLabel(t(ctx.cfg, 'Escribe el código de la imagen', 'Type the code from the image'))
        .setStyle(TextInputStyle.Short).setMinLength(5).setMaxLength(5).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
}

// Variante A — envío del modal con el código del captcha.
async function manejarModal(interaction, client) {
    const ctx = await resolverContexto(interaction, client);
    if (ctx.error) return interaction.reply({ content: ctx.error, ephemeral: true });
    const { gid, e, member, cfg } = ctx;

    const clave = `${gid}:${member.id}`;
    const reto = captchasPendientes.get(clave);
    if (!reto || reto.expira <= Date.now()) {
        captchasPendientes.delete(clave);
        return interaction.reply({ content: t(cfg, '⏰ El captcha ha caducado. Pulsa **Empezar** de nuevo.', '⏰ The captcha expired. Click **Get started** again.'), ephemeral: true });
    }
    const respuesta = (interaction.fields.getTextInputValue('codigo') || '').trim().toUpperCase();
    if (respuesta !== reto.codigo) {
        return interaction.reply({ content: t(cfg, '❌ Código incorrecto. Inténtalo de nuevo.', '❌ Wrong code. Try again.'), ephemeral: true });
    }
    captchasPendientes.delete(clave);

    const err = await conceder(member, e, cfg);
    if (!err) await marcarVerificado(gid, member.id);
    return interaction.reply({ content: err || t(cfg, '✅ ¡Listo! Ya tienes acceso al servidor. 🎉', '✅ Done! You now have access to the server. 🎉'), ephemeral: true });
}

module.exports = {
    // Captura de datos
    asignarCohorte, marcarParticipacion, marcarVerificado, marcarSalida,
    // Flujo en Discord
    publicarPanel, enviarMD,
    manejarInicio, manejarReglas, manejarAceptar, manejarCaptcha, manejarModal,
};

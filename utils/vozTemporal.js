// ============================================================================
// CANALES DE VOZ TEMPORALES (Join-to-Create)
//   • Al entrar a un canal "generador" se crea un canal de voz propio.
//   • Al quedarse vacío, se borra solo.
//   • Un panel de botones en un chat de texto deja al dueño gestionar su sala.
// Config en ServidorConfig.vozTemporal · estado vivo en modelo CanalVozTemporal.
// ============================================================================
const {
    ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
    UserSelectMenuBuilder,
} = require('discord.js');
const { getConfigCached } = require('./config.js');
const CanalVozTemporal = require('../models/CanalVozTemporal.js');

const Flags = PermissionsBitField.Flags;

// Config de voz temporal del servidor (con defaults seguros).
async function getVozCfg(guildId) {
    const cfg = await getConfigCached(guildId);
    return cfg?.vozTemporal || null;
}

// Rellena la plantilla del nombre. {user} = nombre · {count} = nº de su canal.
function nombreCanal(plantilla, member, count) {
    return String(plantilla || '🔊 {user}')
        .replace(/{user}/g, member.displayName || member.user.username)
        .replace(/{count}/g, String(count))
        .slice(0, 100);
}

// ---------------------------------------------------------------------------
// CREACIÓN / BORRADO (lo llama voiceStateUpdate)
// ---------------------------------------------------------------------------

// Punto de entrada desde el evento voiceStateUpdate.
async function manejarVoz(oldState, newState, client) {
    const guild = newState.guild || oldState.guild;
    const vcfg = await getVozCfg(guild.id);
    if (!vcfg || !vcfg.activo) {
        // Aun apagado, si dejó vacío un canal temporal conocido, lo limpiamos.
        if (oldState.channelId && oldState.channelId !== newState.channelId) {
            await borrarSiVacio(oldState.guild, oldState.channelId).catch(() => {});
        }
        return;
    }

    // ¿Entró a un canal generador? → crear su sala.
    if (newState.channelId && newState.channelId !== oldState.channelId) {
        const gen = (vcfg.generadores || []).find((g) => g.canalId === newState.channelId);
        if (gen && newState.member && !newState.member.user.bot) {
            await crearCanalTemporal(newState.member, gen, vcfg).catch((e) =>
                console.error('voz-temporal crear:', e.message));
        }
    }

    // ¿Salió de un canal (o cambió)? → si era temporal y quedó vacío, borrarlo.
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
        await borrarSiVacio(oldState.guild, oldState.channelId).catch(() => {});
    }
}

// Crea el canal de voz para `member` a partir del generador `gen`.
async function crearCanalTemporal(member, gen, vcfg) {
    const guild = member.guild;

    // Anti-abuso: máximo de canales simultáneos por persona.
    const max = Math.max(1, vcfg.maxPorUsuario || 1);
    const suyos = await CanalVozTemporal.find({ guildId: guild.id, ownerId: member.id });
    const vivos = suyos.filter((d) => guild.channels.cache.has(d.canalId));
    if (vivos.length >= max) {
        // Ya tiene su cupo: lo movemos a su canal existente en vez de crear otro.
        const existente = guild.channels.cache.get(vivos[0].canalId);
        if (existente) await member.voice.setChannel(existente).catch(() => {});
        return;
    }

    const categoriaId = gen.categoriaId || guild.channels.cache.get(gen.canalId)?.parentId || null;
    const count = (await CanalVozTemporal.countDocuments({ guildId: guild.id })) + 1;
    const nombre = nombreCanal(gen.nombre || '🔊 {user}', member, count);

    const me = guild.members.me;
    const maxBitrate = guild.maximumBitrate || 96000;
    const bitrate = Math.min(maxBitrate, Math.max(8000, (gen.bitrate || 64) * 1000));

    // Permisos: el dueño manda en su canal; @everyone según los ajustes del generador.
    const overwrites = [
        {
            id: member.id,
            allow: [Flags.Connect, Flags.ViewChannel, Flags.Speak, Flags.Stream, Flags.MoveMembers],
        },
        { id: me.id, allow: [Flags.Connect, Flags.ViewChannel, Flags.ManageChannels, Flags.MoveMembers] },
    ];
    const denyEveryone = [];
    if (gen.bloqueadoPorDefecto) denyEveryone.push(Flags.Connect);
    if (gen.ocultoPorDefecto) denyEveryone.push(Flags.ViewChannel);
    if (denyEveryone.length) overwrites.push({ id: guild.id, deny: denyEveryone });

    const canal = await guild.channels.create({
        name: nombre,
        type: ChannelType.GuildVoice,
        parent: categoriaId || undefined,
        userLimit: Math.max(0, Math.min(99, gen.limite || 0)),
        bitrate,
        permissionOverwrites: overwrites,
        reason: `Canal de voz temporal de ${member.user.tag}`,
    });

    await CanalVozTemporal.create({
        guildId: guild.id,
        canalId: canal.id,
        ownerId: member.id,
        generadorId: gen.canalId,
        nombre,
        bloqueado: !!gen.bloqueadoPorDefecto,
        oculto: !!gen.ocultoPorDefecto,
        limite: Math.max(0, gen.limite || 0),
    });

    // Mover a la persona a su nuevo canal (si sigue conectada).
    await member.voice.setChannel(canal).catch(() => {});
    return canal;
}

// Si el canal es temporal y se quedó sin humanos, lo borra (y limpia el registro).
async function borrarSiVacio(guild, canalId) {
    const doc = await CanalVozTemporal.findOne({ canalId });
    if (!doc) return;
    const canal = guild.channels.cache.get(canalId);
    if (!canal) { await CanalVozTemporal.deleteOne({ canalId }); return; }
    const humanos = canal.members.filter((m) => !m.user.bot).size;
    if (humanos > 0) return;
    await canal.delete('Canal de voz temporal vacío').catch(() => {});
    await CanalVozTemporal.deleteOne({ canalId });
}

// Barrido al arrancar: borra canales temporales que quedaron vacíos o que ya no
// existen (por un reinicio). Lo llama ready.js.
async function barrerCanales(client) {
    const docs = await CanalVozTemporal.find({});
    for (const doc of docs) {
        const guild = client.guilds.cache.get(doc.guildId);
        if (!guild) { await CanalVozTemporal.deleteOne({ _id: doc._id }); continue; }
        const canal = guild.channels.cache.get(doc.canalId);
        if (!canal) { await CanalVozTemporal.deleteOne({ _id: doc._id }); continue; }
        const humanos = canal.members.filter((m) => !m.user.bot).size;
        if (humanos === 0) {
            await canal.delete('Limpieza de canales temporales al arrancar').catch(() => {});
            await CanalVozTemporal.deleteOne({ _id: doc._id });
        }
    }
}

// ---------------------------------------------------------------------------
// PANEL DE CONTROL (botones en un chat de texto)
// ---------------------------------------------------------------------------

// Catálogo de botones: clave de control → definición del botón.
const BOTONES = {
    renombrar: { id: 'vt:renombrar', label: 'Renombrar', emoji: '✏️', style: ButtonStyle.Secondary },
    limite: { id: 'vt:limite', label: 'Límite', emoji: '👥', style: ButtonStyle.Secondary },
    bloquear: { id: 'vt:bloquear', label: 'Bloquear/Abrir', emoji: '🔒', style: ButtonStyle.Secondary },
    ocultar: { id: 'vt:ocultar', label: 'Ocultar/Mostrar', emoji: '👁️', style: ButtonStyle.Secondary },
    bitrate: { id: 'vt:bitrate', label: 'Calidad', emoji: '🎚️', style: ButtonStyle.Secondary },
    invitar: { id: 'vt:invitar', label: 'Invitar', emoji: '➕', style: ButtonStyle.Success },
    expulsar: { id: 'vt:expulsar', label: 'Expulsar', emoji: '🚫', style: ButtonStyle.Danger },
    reclamar: { id: 'vt:reclamar', label: 'Reclamar', emoji: '👑', style: ButtonStyle.Primary },
    transferir: { id: 'vt:transferir', label: 'Transferir', emoji: '🔄', style: ButtonStyle.Primary },
    eliminar: { id: 'vt:eliminar', label: 'Eliminar', emoji: '🗑️', style: ButtonStyle.Danger },
};

// Orden en que se muestran los botones en el panel.
const ORDEN = ['renombrar', 'limite', 'bloquear', 'ocultar', 'bitrate',
    'invitar', 'expulsar', 'reclamar', 'transferir', 'eliminar'];

// Construye {embeds, components} del panel según los controles activos.
function construirPanel(vcfg) {
    const ctrl = vcfg.controles || {};
    const activos = ORDEN.filter((k) => ctrl[k] !== false);

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(vcfg.panelTitulo || '🔊 Tu canal de voz')
        .setDescription(vcfg.panelDescripcion || 'Usa estos botones para gestionar tu sala.')
        .setFooter({ text: 'Debes estar dentro de tu canal de voz para usar los botones.' });

    const rows = [];
    for (let i = 0; i < activos.length; i += 5) {
        const fila = new ActionRowBuilder();
        for (const k of activos.slice(i, i + 5)) {
            const b = BOTONES[k];
            fila.addComponents(new ButtonBuilder()
                .setCustomId(b.id).setLabel(b.label).setEmoji(b.emoji).setStyle(b.style));
        }
        rows.push(fila);
    }
    return { embeds: [embed], components: rows };
}

// Publica (o reedita) el panel en el canal configurado. Devuelve el id del mensaje.
async function publicarPanel(client, guildId) {
    const ServidorConfig = require('../models/ServidorConfig.js');
    const cfg = await ServidorConfig.findOne({ guildId });
    const vcfg = cfg?.vozTemporal;
    if (!vcfg?.panelCanalId) throw new Error('sin-canal');
    const guild = client.guilds.cache.get(guildId);
    const canal = guild?.channels.cache.get(vcfg.panelCanalId);
    if (!canal?.isTextBased()) throw new Error('canal-invalido');

    const payload = construirPanel(vcfg);

    // Dejar el canal del panel en solo-lectura (o restaurarlo) según el ajuste.
    await aplicarBloqueoCanalPanel(canal, guild, !!vcfg.panelBloquearCanal).catch(() => {});

    // Intentar reeditar el panel anterior; si no existe, publicar uno nuevo.
    if (vcfg.panelMensajeId) {
        const antiguo = await canal.messages.fetch(vcfg.panelMensajeId).catch(() => null);
        if (antiguo) { await antiguo.edit(payload); return antiguo.id; }
    }
    const msg = await canal.send(payload);
    cfg.vozTemporal.panelMensajeId = msg.id;
    await cfg.save();
    return msg.id;
}

// Bloquea (solo-lectura) o restaura el canal de texto del panel para @everyone.
// El bot conserva permiso de escritura para poder publicar/editar el panel.
async function aplicarBloqueoCanalPanel(canal, guild, bloquear) {
    const restriccion = {
        SendMessages: bloquear ? false : null,
        AddReactions: bloquear ? false : null,
        CreatePublicThreads: bloquear ? false : null,
        CreatePrivateThreads: bloquear ? false : null,
        SendMessagesInThreads: bloquear ? false : null,
    };
    await canal.permissionOverwrites.edit(guild.id, restriccion, { reason: 'Canal del panel de voz temporal' });
    if (bloquear) {
        // Asegurar que el bot sí puede escribir aunque @everyone esté bloqueado.
        await canal.permissionOverwrites.edit(guild.members.me.id, {
            SendMessages: true, ViewChannel: true,
        }, { reason: 'El bot debe poder publicar el panel' });
    }
}

// ---------------------------------------------------------------------------
// MANEJO DE INTERACCIONES (botones / modales / selección de usuario)
// ---------------------------------------------------------------------------

// Localiza el canal temporal en el que está el miembro y comprueba que pueda
// gestionarlo (es el dueño o es admin). Devuelve { canal, doc } o un mensaje de error.
async function contextoMiembro(interaction, { permitirReclamar = false } = {}) {
    const member = interaction.member;
    const canalId = member.voice?.channelId;
    if (!canalId) return { error: '⚠️ Tienes que estar conectado a tu canal de voz para usar esto.' };
    const doc = await CanalVozTemporal.findOne({ canalId });
    if (!doc) return { error: '⚠️ Tu canal de voz actual no es una sala temporal.' };
    const canal = interaction.guild.channels.cache.get(canalId);
    if (!canal) return { error: '⚠️ No encuentro tu canal de voz.' };

    const esAdmin = member.permissions.has(Flags.ManageChannels);
    const esDueno = doc.ownerId === member.id;
    if (!esDueno && !esAdmin && !permitirReclamar) {
        return { error: '⛔ Solo el dueño del canal puede usar este control.' };
    }
    return { canal, doc, esDueno, esAdmin };
}

const reply = (interaction, content) =>
    interaction.reply({ content, ephemeral: true }).catch(() => {});

// Despacha los botones del panel (customId que empieza por `vt:`).
async function manejarBoton(interaction) {
    const accion = interaction.customId.split(':')[1];

    // Reclamar tiene su propia comprobación (el dueño debe estar ausente).
    if (accion === 'reclamar') return reclamar(interaction);

    // Botones que abren un modal.
    if (accion === 'renombrar') return abrirModal(interaction, 'renombrar', 'Nuevo nombre', 'Nombre del canal', TextInputStyle.Short);
    if (accion === 'limite') return abrirModal(interaction, 'limite', 'Límite de usuarios', 'Número (0 = sin límite)', TextInputStyle.Short);
    if (accion === 'bitrate') return abrirModal(interaction, 'bitrate', 'Calidad (kbps)', 'Ej: 64, 96, 128', TextInputStyle.Short);

    // Botones que abren un selector de usuario.
    if (accion === 'invitar') return abrirSelectorUsuario(interaction, 'invitar', '➕ Elige a quién dar acceso');
    if (accion === 'expulsar') return abrirSelectorUsuario(interaction, 'expulsar', '🚫 Elige a quién expulsar y vetar');
    if (accion === 'transferir') return abrirSelectorUsuario(interaction, 'transferir', '🔄 Elige el nuevo dueño');

    // Botones de acción directa.
    const ctx = await contextoMiembro(interaction);
    if (ctx.error) return reply(interaction, ctx.error);

    if (accion === 'bloquear') return alternarBloqueo(interaction, ctx);
    if (accion === 'ocultar') return alternarOculto(interaction, ctx);
    if (accion === 'eliminar') {
        await ctx.canal.delete('Eliminado por su dueño desde el panel').catch(() => {});
        await CanalVozTemporal.deleteOne({ canalId: ctx.canal.id });
        return reply(interaction, '🗑️ Canal eliminado.');
    }
    return reply(interaction, '❔ Acción desconocida.');
}

async function alternarBloqueo(interaction, ctx) {
    const nuevo = !ctx.doc.bloqueado;
    await ctx.canal.permissionOverwrites.edit(interaction.guild.id, { Connect: nuevo ? false : null }).catch(() => {});
    ctx.doc.bloqueado = nuevo; await ctx.doc.save();
    return reply(interaction, nuevo ? '🔒 Canal bloqueado: nadie nuevo puede entrar.' : '🔓 Canal abierto: ya puede entrar cualquiera.');
}

async function alternarOculto(interaction, ctx) {
    const nuevo = !ctx.doc.oculto;
    await ctx.canal.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: nuevo ? false : null }).catch(() => {});
    ctx.doc.oculto = nuevo; await ctx.doc.save();
    return reply(interaction, nuevo ? '👁️ Canal oculto: solo lo ven los invitados.' : '👁️ Canal visible para todos.');
}

async function reclamar(interaction) {
    const ctx = await contextoMiembro(interaction, { permitirReclamar: true });
    if (ctx.error) return reply(interaction, ctx.error);
    if (ctx.esDueno) return reply(interaction, 'ℹ️ Ya eres el dueño de este canal.');
    // Solo se puede reclamar si el dueño actual NO está en el canal.
    const duenoPresente = ctx.canal.members.has(ctx.doc.ownerId);
    if (duenoPresente && !ctx.esAdmin) return reply(interaction, '⛔ No puedes reclamarlo: el dueño sigue dentro.');

    await ctx.canal.permissionOverwrites.edit(interaction.member.id, {
        Connect: true, ViewChannel: true, Speak: true, MoveMembers: true,
    }).catch(() => {});
    ctx.doc.ownerId = interaction.member.id; await ctx.doc.save();
    return reply(interaction, '👑 ¡Ahora eres el dueño de este canal!');
}

// Abre un modal para renombrar / límite / bitrate.
function abrirModal(interaction, accion, titulo, placeholder, estilo) {
    const modal = new ModalBuilder().setCustomId(`vt_modal:${accion}`).setTitle(titulo);
    const input = new TextInputBuilder()
        .setCustomId('valor').setLabel(titulo).setStyle(estilo)
        .setPlaceholder(placeholder).setRequired(true).setMaxLength(100);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal).catch(() => {});
}

// Procesa el envío de un modal (customId `vt_modal:<accion>`).
async function manejarModal(interaction) {
    const accion = interaction.customId.split(':')[1];
    const ctx = await contextoMiembro(interaction);
    if (ctx.error) return reply(interaction, ctx.error);
    const valor = interaction.fields.getTextInputValue('valor').trim();

    if (accion === 'renombrar') {
        const nombre = valor.slice(0, 100);
        if (!nombre) return reply(interaction, '⚠️ El nombre no puede estar vacío.');
        await ctx.canal.setName(nombre).catch(() => {});
        ctx.doc.nombre = nombre; await ctx.doc.save();
        return reply(interaction, `✏️ Canal renombrado a **${nombre}**.`);
    }
    if (accion === 'limite') {
        const n = Math.max(0, Math.min(99, parseInt(valor, 10) || 0));
        await ctx.canal.setUserLimit(n).catch(() => {});
        ctx.doc.limite = n; await ctx.doc.save();
        return reply(interaction, n === 0 ? '👥 Límite quitado (sin tope).' : `👥 Límite fijado en **${n}** personas.`);
    }
    if (accion === 'bitrate') {
        const max = (interaction.guild.maximumBitrate || 96000) / 1000;
        const kbps = Math.max(8, Math.min(max, parseInt(valor, 10) || 64));
        await ctx.canal.setBitrate(kbps * 1000).catch(() => {});
        return reply(interaction, `🎚️ Calidad fijada en **${kbps} kbps**.`);
    }
    return reply(interaction, '❔ Acción desconocida.');
}

// Abre un selector de usuario efímero (customId `vt_user:<accion>`).
function abrirSelectorUsuario(interaction, accion, titulo) {
    const row = new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder().setCustomId(`vt_user:${accion}`).setPlaceholder(titulo).setMinValues(1).setMaxValues(1));
    return interaction.reply({ content: titulo, components: [row], ephemeral: true }).catch(() => {});
}

// Procesa la selección de usuario (customId `vt_user:<accion>`).
async function manejarSelectUsuario(interaction) {
    const accion = interaction.customId.split(':')[1];
    const ctx = await contextoMiembro(interaction);
    if (ctx.error) return interaction.update({ content: ctx.error, components: [] }).catch(() => {});
    const objetivoId = interaction.values[0];

    if (accion === 'invitar') {
        await ctx.canal.permissionOverwrites.edit(objetivoId, { Connect: true, ViewChannel: true }).catch(() => {});
        if (!ctx.doc.permitidos.includes(objetivoId)) ctx.doc.permitidos.push(objetivoId);
        ctx.doc.bloqueados = ctx.doc.bloqueados.filter((id) => id !== objetivoId);
        await ctx.doc.save();
        return interaction.update({ content: `➕ <@${objetivoId}> ya tiene acceso a tu canal.`, components: [] }).catch(() => {});
    }
    if (accion === 'expulsar') {
        if (objetivoId === ctx.doc.ownerId) return interaction.update({ content: '⚠️ No puedes expulsarte a ti mismo.', components: [] }).catch(() => {});
        await ctx.canal.permissionOverwrites.edit(objetivoId, { Connect: false }).catch(() => {});
        // Si está dentro, desconectarlo.
        const miembro = interaction.guild.members.cache.get(objetivoId);
        if (miembro?.voice?.channelId === ctx.canal.id) await miembro.voice.disconnect().catch(() => {});
        if (!ctx.doc.bloqueados.includes(objetivoId)) ctx.doc.bloqueados.push(objetivoId);
        ctx.doc.permitidos = ctx.doc.permitidos.filter((id) => id !== objetivoId);
        await ctx.doc.save();
        return interaction.update({ content: `🚫 <@${objetivoId}> ha sido expulsado y vetado.`, components: [] }).catch(() => {});
    }
    if (accion === 'transferir') {
        if (objetivoId === ctx.doc.ownerId) return interaction.update({ content: 'ℹ️ Ya es el dueño.', components: [] }).catch(() => {});
        await ctx.canal.permissionOverwrites.edit(objetivoId, {
            Connect: true, ViewChannel: true, Speak: true, MoveMembers: true,
        }).catch(() => {});
        ctx.doc.ownerId = objetivoId; await ctx.doc.save();
        return interaction.update({ content: `🔄 Has cedido el canal a <@${objetivoId}>.`, components: [] }).catch(() => {});
    }
    return interaction.update({ content: '❔ Acción desconocida.', components: [] }).catch(() => {});
}

module.exports = {
    manejarVoz, crearCanalTemporal, borrarSiVacio, barrerCanales,
    construirPanel, publicarPanel,
    manejarBoton, manejarModal, manejarSelectUsuario,
};

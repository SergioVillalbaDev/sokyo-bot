// Lógica compartida del ciclo de vida de los tickets.
// La usan los botones y comandos de Discord y la API web, de modo que cualquier acción
// se comporta igual se haga desde donde se haga.
const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType,
    PermissionFlagsBits, OverwriteType, escapeMarkdown
} = require('discord.js');
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { obtenerConfig } = require('./config.js');
const { registrarLog } = require('./logger.js');
const { registrarCanalTicket, olvidarCanalTicket } = require('./ticketCache.js');
const { truncar, slug, citar } = require('./texto.js');
const { adjuntoTxt, adjuntoHtml } = require('./transcript.js');
const { formatoDuracion } = require('./estadisticas.js');

const CATEGORIA_ARCHIVO = '🗄️ Tickets Archivados';
const MAX_CANALES_POR_CATEGORIA = 50;
const MOTIVO_POR_DEFECTO = { nombre: 'Soporte General', urgencia: 'Normal' };

const COLORES = {
    abierto: '#2ecc71', cerrado: '#e74c3c', reabierto: '#2ecc71', reclamado: '#3498db',
    liberado: '#95a5a6', valorado: '#f1c40f', usuarios: '#9b59b6', eliminado: '#c0392b', cerradoEmbed: '#80848e',
    inactivo: '#e67e22'
};

const PERMISOS_PARTICIPANTE = [
    PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks
];
const PERMISOS_BOT = [...PERMISOS_PARTICIPANTE, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages];

// Error "esperado" con un mensaje apto para enseñar al usuario y un código HTTP para la API.
class TicketError extends Error {
    constructor(mensaje, status = 400, extra = {}) {
        super(mensaje);
        this.name = 'TicketError';
        this.status = status;
        Object.assign(this, extra);
    }
}

// ----------------------------------------------------------------- utilidades

const formatoNumero = (numero) => `#${String(numero).padStart(4, '0')}`;
const etiquetaTicket = (ticket) => ticket.numero ? formatoNumero(ticket.numero) : 'Ticket';
const motivosDe = (config) => (config.motivos?.length ? config.motivos : [MOTIVO_POR_DEFECTO]);
const colorPrioridad = (config, prioridad) => (config.urgencias || []).find(u => u.nombre === prioridad)?.color || '#5865F2';
const md = (texto) => escapeMarkdown(String(texto ?? ''));

function nombreCanal(ticket, prefijo) {
    const numero = ticket.numero ? `${String(ticket.numero).padStart(4, '0')}-` : '';
    return `${prefijo}-${numero}${slug(ticket.creadorNombre)}`;
}

// Datos básicos de un usuario de Discord en el formato que guardamos.
function datosUsuario(user) {
    return { id: user.id, username: user.username, avatar: user.displayAvatarURL({ extension: 'png', size: 128 }) };
}

// URL pública del portal (si es localhost no tiene sentido enseñársela a los usuarios).
function urlPortal() {
    const url = process.env.FRONTEND_URL;
    if (!url || /localhost|127\.0\.0\.1/.test(url)) return null;
    return url.replace(/\/$/, '');
}

// Solo podemos conceder en un canal los permisos que el propio bot tiene en el servidor.
function permisosConcedibles(guild, lista) {
    const permisosBot = guild.members.me?.permissions;
    if (!permisosBot || permisosBot.has(PermissionFlagsBits.Administrator)) return lista;
    return lista.filter(p => permisosBot.has(p));
}

// Creador e invitados (los que pierden el permiso de escribir al cerrar).
function idsNoStaff(ticket) {
    const ids = new Set([ticket.creadorId]);
    (ticket.participantes || []).filter(p => p.rol !== 'Staff').forEach(p => ids.add(p.id));
    return [...ids];
}

// Renombrar canales está muy limitado por Discord (2 veces cada 10 min). No esperamos a que
// termine para no bloquear la respuesta: discord.js lo aplicará en cuanto se pueda.
function renombrar(canal, nombre) {
    if (canal.name !== nombre) canal.setName(nombre).catch(() => {});
}

function categoriaDeTickets(guild, config) {
    const categoria = config.categoriaTicketsId && guild.channels.cache.get(config.categoriaTicketsId);
    if (!categoria || categoria.type !== ChannelType.GuildCategory) return null;
    return categoria.children.cache.size < MAX_CANALES_POR_CATEGORIA ? categoria : null;
}

// Categoría de archivo con hueco (Discord admite 50 canales por categoría). Si están llenas, crea otra.
const archivoEnCurso = new Map();
function categoriaArchivo(guild) {
    if (archivoEnCurso.has(guild.id)) return archivoEnCurso.get(guild.id);
    const promesa = (async () => {
        const archivos = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory && c.name.startsWith(CATEGORIA_ARCHIVO));
        const libre = archivos.find(c => c.children.cache.size < MAX_CANALES_POR_CATEGORIA);
        if (libre) return libre;
        const nombre = archivos.size === 0 ? CATEGORIA_ARCHIVO : `${CATEGORIA_ARCHIVO} ${archivos.size + 1}`;
        return guild.channels.create({ name: nombre, type: ChannelType.GuildCategory });
    })().finally(() => archivoEnCurso.delete(guild.id));
    archivoEnCurso.set(guild.id, promesa);
    return promesa;
}

async function registrarLogTicket(client, ticket, accion, color, autor, autorId = null) {
    return registrarLog(client, {
        guildId: ticket.guildId,
        categoria: 'Tickets',
        accion,
        usuario: autor || 'Sistema',
        usuarioId: autorId,
        detalles: `Ticket ${etiquetaTicket(ticket)}: **${md(ticket.titulo || ticket.motivo)}** de ${md(ticket.creadorNombre)}`,
        color
    });
}

// ------------------------------------------------------- mensaje de control

// Embed + botones que encabezan el canal del ticket. Se regenera entero a partir de los datos,
// así siempre refleja el estado real (asignado, prioridad, cerrado...).
function construirMensajeTicket(ticket, config) {
    const cerrado = ticket.estado === 'Cerrado';
    const pie = cerrado
        ? '🔒 *Este ticket está cerrado y en modo solo lectura.*'
        : (config.mensajeBienvenida ? `*${config.mensajeBienvenida}*` : '');

    const embed = new EmbedBuilder()
        .setColor(cerrado ? COLORES.cerradoEmbed : colorPrioridad(config, ticket.prioridad))
        .setAuthor({ name: truncar(ticket.creadorNombre, 256), iconURL: ticket.creadorAvatar || undefined })
        .setTitle(truncar(`🎫 ${etiquetaTicket(ticket)} · ${ticket.titulo || ticket.motivo}`, 256))
        .setDescription(truncar(`${citar(ticket.descripcion || 'Sin descripción')}${pie ? `\n\n${pie}` : ''}`, 4096))
        .addFields(
            { name: '🏷️ Categoría', value: truncar(ticket.motivo || '—', 1024), inline: true },
            { name: '🚨 Prioridad', value: truncar(ticket.prioridad || 'Normal', 1024), inline: true },
            { name: '🙋 Atendido por', value: ticket.asignadoA ? `<@${ticket.asignadoA}>` : '*Sin asignar*', inline: true }
        )
        .setFooter({ text: truncar(config.footerPersonalizado || 'Sokyo', 2048) })
        .setTimestamp(ticket.fechaCreacion || new Date());

    if (cerrado) {
        const motivo = ticket.motivoCierre ? `\n${citar(ticket.motivoCierre)}` : '';
        embed.addFields({ name: '🔒 Cerrado por', value: truncar(`${md(ticket.cerradoPor || 'Desconocido')}${motivo}`, 1024) });
    }

    const fila = new ActionRowBuilder();
    if (!cerrado) {
        fila.addComponents(
            new ButtonBuilder().setCustomId('reclamar_ticket').setEmoji('🙋').setStyle(ButtonStyle.Primary)
                .setLabel(ticket.asignadoA ? 'Reclamado' : 'Reclamar').setDisabled(Boolean(ticket.asignadoA)),
            new ButtonBuilder().setCustomId('add_user_prompt').setEmoji('➕').setLabel('Añadir usuario').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('close_ticket').setEmoji('🔒').setLabel('Cerrar').setStyle(ButtonStyle.Danger)
        );
    } else {
        fila.addComponents(
            new ButtonBuilder().setCustomId('reopen_ticket').setEmoji('🔓').setLabel('Reabrir').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('transcript_ticket').setEmoji('📄').setLabel('Transcript').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('delete_ticket').setEmoji('🗑️').setLabel('Eliminar canal').setStyle(ButtonStyle.Danger)
        );
    }
    return { embeds: [embed], components: [fila] };
}

async function actualizarMensajeControl(client, ticket, config) {
    if (!ticket.mensajeControlId) return;
    const canal = client.channels.cache.get(ticket.canalId);
    if (!canal) return;
    try {
        const cfg = config || await obtenerConfig(ticket.guildId);
        const mensaje = await canal.messages.fetch(ticket.mensajeControlId);
        await mensaje.edit(construirMensajeTicket(ticket, cfg));
    } catch {
        // El mensaje se borró a mano: no es grave, el ticket sigue funcionando.
    }
}

// ------------------------------------------------------------ crear ticket

// Marca un ticket como cerrado porque su canal ya no existe (se borró a mano o con el bot apagado).
async function marcarCanalEliminado(client, canalId, autor = 'Canal eliminado') {
    olvidarCanalTicket(canalId);
    const ticket = await Ticket.findOne({ canalId });
    if (!ticket || ticket.canalEliminado) return ticket;
    ticket.canalEliminado = true;
    if (ticket.estado === 'Abierto') {
        ticket.estado = 'Cerrado';
        ticket.fechaCierre = new Date();
        ticket.cerradoPor = autor;
        ticket.esperando = null;
    }
    await ticket.save();
    await registrarLogTicket(client, ticket, '🗑️ Canal de Ticket Eliminado', COLORES.eliminado, autor);
    return ticket;
}

// Tickets abiertos de un usuario cuyo canal sigue existiendo.
async function ticketsAbiertosDe(client, guild, usuarioId) {
    const abiertos = await Ticket.find({ guildId: guild.id, creadorId: usuarioId, estado: 'Abierto' }).sort({ fechaCreacion: -1 });
    const vigentes = [];
    for (const ticket of abiertos) {
        if (guild.channels.cache.has(ticket.canalId)) vigentes.push(ticket);
        else await marcarCanalEliminado(client, ticket.canalId);
    }
    return vigentes;
}

// usuario: { id, username, avatar }
async function crearTicket(client, { guild, usuario, motivo, asunto, descripcion, origen = 'discord' }) {
    const config = await obtenerConfig(guild.id);

    const limite = config.maxTicketsPorUsuario || 1;
    const vigentes = await ticketsAbiertosDe(client, guild, usuario.id);
    if (vigentes.length >= limite) {
        const mensaje = limite === 1 ? 'Ya tienes un ticket abierto.' : `Ya tienes ${vigentes.length} tickets abiertos (máximo ${limite}).`;
        throw new TicketError(mensaje, 409, { codigo: 'limite', ticket: vigentes[0] });
    }

    const motivoCfg = motivosDe(config).find(m => m.nombre === motivo);
    if (!motivoCfg) throw new TicketError('Esa categoría ya no existe. Vuelve a intentarlo.', 400);
    const asuntoLimpio = truncar(String(asunto || '').trim() || motivoCfg.nombre, 100);
    const descripcionLimpia = truncar(String(descripcion || '').trim() || 'Sin descripción', 2000);

    const { contadorTickets: numero } = await ServidorConfig.findOneAndUpdate(
        { guildId: guild.id }, { $inc: { contadorTickets: 1 } }, { returnDocument: 'after' }
    );

    const rolesStaff = (config.rolesStaff || []).filter(id => guild.roles.cache.has(id));
    const permisosParticipante = permisosConcedibles(guild, PERMISOS_PARTICIPANTE);
    const canal = await guild.channels.create({
        name: nombreCanal({ numero, creadorNombre: usuario.username }, 'ticket'),
        type: ChannelType.GuildText,
        parent: categoriaDeTickets(guild, config)?.id ?? null,
        topic: truncar(`Ticket ${formatoNumero(numero)} · ${motivoCfg.nombre} · ${usuario.username}`, 1024),
        permissionOverwrites: [
            { id: guild.roles.everyone.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
            { id: guild.members.me.id, type: OverwriteType.Member, allow: permisosConcedibles(guild, PERMISOS_BOT) },
            { id: usuario.id, type: OverwriteType.Member, allow: permisosParticipante },
            ...rolesStaff.map(id => ({ id, type: OverwriteType.Role, allow: permisosParticipante }))
        ]
    });

    let ticket = null;
    try {
        ticket = await Ticket.create({
            guildId: guild.id,
            canalId: canal.id,
            numero,
            creadorId: usuario.id,
            creadorNombre: usuario.username,
            creadorAvatar: usuario.avatar,
            motivo: motivoCfg.nombre,
            titulo: asuntoLimpio,
            descripcion: descripcionLimpia,
            prioridad: motivoCfg.urgencia || 'Normal',
            estado: 'Abierto',
            participantes: [{ ...usuario, rol: 'Creador' }],
            ultimaActividad: new Date(),
            esperando: 'staff',
            visibleWeb: true
        });
        registrarCanalTicket(canal.id);

        const menciones = config.modulos?.mencionarStaff !== false ? rolesStaff : [];
        const lineas = [`👋 ¡Hola <@${usuario.id}>! Gracias por contactar con soporte. Cuéntanos aquí todo lo que necesites.`];
        if (origen === 'portal') lineas.push('🌐 *Ticket creado desde el portal web.*');
        if (menciones.length) lineas.push(`🔔 ${menciones.map(id => `<@&${id}>`).join(' ')}`);

        const mensaje = await canal.send({
            content: lineas.join('\n'),
            ...construirMensajeTicket(ticket, config),
            allowedMentions: { users: [usuario.id], roles: menciones }
        });
        ticket.mensajeControlId = mensaje.id;
        await ticket.save();
    } catch (error) {
        // Sin dejar canales huérfanos: deshacemos lo creado.
        olvidarCanalTicket(canal.id);
        if (ticket) await Ticket.deleteOne({ _id: ticket._id }).catch(() => {});
        await canal.delete('Error al crear el ticket').catch(() => {});
        throw error;
    }

    await registrarLogTicket(client, ticket, '🎫 Ticket Abierto', COLORES.abierto, usuario.username, usuario.id);
    return { ticket, canal };
}

// ------------------------------------------------------- cerrar / reabrir

function filaEstrellas(canalId) {
    return new ActionRowBuilder().addComponents(
        [1, 2, 3, 4, 5].map(n => new ButtonBuilder()
            .setCustomId(`csat_${n}_${canalId}`)
            .setLabel('⭐'.repeat(n))
            .setStyle(ButtonStyle.Secondary))
    );
}

async function enviarTranscriptStaff(client, ticket, config, mensajes) {
    const canal = config.canalTranscriptsId && client.channels.cache.get(config.canalTranscriptsId);
    if (!canal?.isTextBased()) return;
    const guild = client.guilds.cache.get(ticket.guildId);
    const duracion = ticket.fechaCierre && ticket.fechaCreacion ? formatoDuracion(ticket.fechaCierre - ticket.fechaCreacion) : '—';
    const embed = new EmbedBuilder()
        .setColor(colorPrioridad(config, ticket.prioridad))
        .setTitle(truncar(`📄 Transcript ${etiquetaTicket(ticket)} · ${ticket.titulo || ticket.motivo}`, 256))
        .addFields(
            { name: 'Usuario', value: `<@${ticket.creadorId}>`, inline: true },
            { name: 'Categoría', value: truncar(ticket.motivo, 1024), inline: true },
            { name: 'Prioridad', value: truncar(ticket.prioridad, 1024), inline: true },
            { name: 'Atendido por', value: ticket.asignadoA ? `<@${ticket.asignadoA}>` : '*Sin asignar*', inline: true },
            { name: 'Cerrado por', value: truncar(md(ticket.cerradoPor || '—'), 1024), inline: true },
            { name: 'Duración', value: duracion, inline: true },
            { name: 'Mensajes', value: String(mensajes.length), inline: true }
        )
        .setTimestamp(ticket.fechaCierre || new Date());
    if (ticket.motivoCierre) embed.setDescription(truncar(`**Motivo del cierre:**\n${citar(ticket.motivoCierre)}`, 4096));
    await canal.send({ embeds: [embed], files: [adjuntoHtml(ticket, mensajes, { nombreServidor: guild?.name })], allowedMentions: { parse: [] } });
}

async function enviarResumenAlCreador(client, ticket, config, mensajes) {
    const valorar = config.modulos?.valoraciones !== false;
    const transcript = config.modulos?.transcriptDM !== false;
    if (!valorar && !transcript) return;

    const guild = client.guilds.cache.get(ticket.guildId);
    const portal = urlPortal();
    const lineas = [
        `Hola **${md(ticket.creadorNombre)}**, tu ticket **${md(ticket.titulo || ticket.motivo)}**${guild ? ` en **${md(guild.name)}**` : ''} se ha cerrado.`
    ];
    if (ticket.motivoCierre) lineas.push('', '**Motivo del cierre:**', citar(ticket.motivoCierre));
    if (transcript) lineas.push('', '📎 Te adjuntamos una copia de la conversación.');
    if (valorar) lineas.push('', '⭐ **¿Qué tal te hemos atendido?** Valóralo con los botones de abajo: ¡nos ayuda a mejorar!');
    if (portal) lineas.push('', `🌐 Puedes consultar tu historial en el [portal de soporte](${portal}).`);

    const embed = new EmbedBuilder()
        .setColor(COLORES.valorado)
        .setTitle(`📊 Tu ticket ${etiquetaTicket(ticket)} ha sido cerrado`)
        .setDescription(truncar(lineas.join('\n'), 4096))
        .setFooter({ text: truncar(config.footerPersonalizado || 'Sokyo', 2048) });

    const usuario = await client.users.fetch(ticket.creadorId);
    await usuario.send({
        embeds: [embed],
        components: valorar ? [filaEstrellas(ticket.canalId)] : [],
        files: transcript ? [adjuntoTxt(ticket, mensajes)] : []
    });
}

async function cerrarTicket(client, canalId, { autor = 'Sistema', autorId = null, motivo = null } = {}) {
    const motivoCierre = motivo && String(motivo).trim() ? truncar(String(motivo).trim(), 500) : null;
    const ticket = await Ticket.findOneAndUpdate(
        { canalId, estado: 'Abierto' },
        { $set: { estado: 'Cerrado', fechaCierre: new Date(), cerradoPor: autor, motivoCierre, esperando: null } },
        { returnDocument: 'after' }
    );
    if (!ticket) {
        const existe = await Ticket.exists({ canalId });
        throw new TicketError(existe ? 'Este ticket ya está cerrado.' : 'No se encontró el ticket.', existe ? 409 : 404);
    }

    const config = await obtenerConfig(ticket.guildId);
    const canal = client.channels.cache.get(canalId);
    if (canal) {
        const aviso = new EmbedBuilder()
            .setColor(COLORES.cerrado)
            .setTitle('🔒 Ticket cerrado')
            .setDescription(truncar(`Cerrado por **${md(autor)}**.${motivoCierre ? `\n${citar(motivoCierre)}` : ''}\n\nEl canal queda archivado en modo solo lectura.`, 4096))
            .setTimestamp();
        await canal.send({ embeds: [aviso] }).catch(() => {});
        await actualizarMensajeControl(client, ticket, config);
        await archivarCanal(canal, ticket);
    }

    // Transcript al canal del staff y resumen + encuesta al usuario, en segundo plano:
    // si el usuario tiene los DMs cerrados no debe bloquear ni romper el cierre.
    Mensaje.find({ ticketId: canalId }).sort({ fecha: 1 }).then(mensajes => Promise.allSettled([
        enviarTranscriptStaff(client, ticket, config, mensajes).catch(e => console.warn('Transcript al staff:', e.message)),
        enviarResumenAlCreador(client, ticket, config, mensajes).catch(() => {})
    ])).catch(() => {});

    await registrarLogTicket(client, ticket, '🔒 Ticket Cerrado', COLORES.cerrado, autor, autorId);
    return ticket;
}

// Mueve el canal al archivo y lo deja en solo lectura para el creador y los invitados.
async function archivarCanal(canal, ticket) {
    try {
        const categoria = await categoriaArchivo(canal.guild);
        if (canal.parentId !== categoria.id) await canal.setParent(categoria.id, { lockPermissions: false });
    } catch (error) {
        console.warn('No se pudo mover el ticket al archivo:', error.message);
    }
    for (const id of idsNoStaff(ticket)) {
        await canal.permissionOverwrites.edit(id, { SendMessages: false }, { type: OverwriteType.Member }).catch(() => {});
    }
    renombrar(canal, nombreCanal(ticket, 'cerrado'));
}

async function reabrirTicket(client, canalId, { autor = 'Sistema', autorId = null } = {}) {
    const actual = await Ticket.findOne({ canalId });
    if (!actual) throw new TicketError('No se encontró el ticket.', 404);
    if (actual.estado !== 'Cerrado') throw new TicketError('Este ticket ya está abierto.', 409);
    const canal = client.channels.cache.get(canalId);
    if (!canal || actual.canalEliminado) {
        throw new TicketError('El canal de este ticket se eliminó de Discord, así que no se puede reabrir.', 410);
    }

    const ticket = await Ticket.findOneAndUpdate(
        { canalId, estado: 'Cerrado' },
        { $set: { estado: 'Abierto', fechaCierre: null, cerradoPor: null, motivoCierre: null, esperando: 'staff', ultimaActividad: new Date(), avisoInactividad: null } },
        { returnDocument: 'after' }
    );
    if (!ticket) throw new TicketError('Este ticket ya está abierto.', 409);

    const config = await obtenerConfig(ticket.guildId);
    for (const id of idsNoStaff(ticket)) {
        await canal.permissionOverwrites.edit(id, { ViewChannel: true, SendMessages: true }, { type: OverwriteType.Member }).catch(() => {});
    }
    await canal.setParent(categoriaDeTickets(canal.guild, config)?.id ?? null, { lockPermissions: false }).catch(() => {});
    renombrar(canal, nombreCanal(ticket, 'ticket'));

    const aviso = new EmbedBuilder()
        .setColor(COLORES.reabierto)
        .setTitle('🔓 Ticket reabierto')
        .setDescription(`Reabierto por **${md(autor)}**. Ya podéis volver a escribir.`)
        .setTimestamp();
    await canal.send({ content: `<@${ticket.creadorId}>`, embeds: [aviso], allowedMentions: { users: [ticket.creadorId] } }).catch(() => {});
    await actualizarMensajeControl(client, ticket, config);
    await registrarLogTicket(client, ticket, '🔓 Ticket Reabierto', COLORES.reabierto, autor, autorId);
    return ticket;
}

// Borra el canal de un ticket cerrado. Los datos y la conversación se conservan en el panel.
async function eliminarCanalTicket(client, canalId, { autor = 'Sistema', autorId = null } = {}) {
    const ticket = await Ticket.findOne({ canalId });
    if (!ticket) throw new TicketError('No se encontró el ticket.', 404);
    if (ticket.estado !== 'Cerrado') throw new TicketError('Cierra el ticket antes de eliminar su canal.', 409);

    ticket.canalEliminado = true;
    await ticket.save();
    olvidarCanalTicket(canalId);
    await registrarLogTicket(client, ticket, '🗑️ Canal de Ticket Eliminado', COLORES.eliminado, autor, autorId);

    const canal = client.channels.cache.get(canalId);
    if (canal) await canal.delete(`Ticket eliminado por ${autor}`);
    return ticket;
}

// ------------------------------------------------------ asignación y datos

// staff = { id, username, avatar } para asignar, o null para liberar el ticket.
async function asignarTicket(client, canalId, { staff, autor, autorId = null, soloSiLibre = false }) {
    const filtro = { canalId, estado: 'Abierto' };
    if (soloSiLibre) filtro.asignadoA = null;
    const cambios = staff
        ? { asignadoA: staff.id, asignadoNombre: staff.username, ultimaInteractStaff: new Date() }
        : { asignadoA: null, asignadoNombre: null };

    let ticket = await Ticket.findOneAndUpdate(filtro, { $set: cambios }, { returnDocument: 'after' });
    if (!ticket) {
        const actual = await Ticket.findOne({ canalId });
        if (!actual) throw new TicketError('No se encontró el ticket.', 404);
        if (actual.estado === 'Cerrado') throw new TicketError('El ticket está cerrado.', 409);
        throw new TicketError(`Este ticket ya lo atiende ${actual.asignadoNombre}.`, 409);
    }
    if (staff) {
        ticket = await Ticket.findOneAndUpdate(
            { canalId, 'participantes.id': { $ne: staff.id } },
            { $push: { participantes: { ...staff, rol: 'Staff' } } },
            { returnDocument: 'after' }
        ) || ticket;
    }

    const canal = client.channels.cache.get(canalId);
    if (canal) {
        const texto = staff
            ? `📢 **${md(staff.username)}** se ha hecho cargo de este ticket.`
            : '📢 El ticket vuelve a estar **sin asignar**.';
        await canal.send({ content: texto, allowedMentions: { parse: [] } }).catch(() => {});
        await actualizarMensajeControl(client, ticket);
    }
    await registrarLogTicket(client, ticket, staff ? '🙋 Ticket Reclamado' : '↩️ Ticket Liberado', staff ? COLORES.reclamado : COLORES.liberado, autor, autorId);
    return ticket;
}

async function cambiarPrioridad(client, canalId, prioridad, { autor, autorId = null }) {
    const actual = await Ticket.findOne({ canalId });
    if (!actual) throw new TicketError('No se encontró el ticket.', 404);
    const config = await obtenerConfig(actual.guildId);
    if (!(config.urgencias || []).some(u => u.nombre === prioridad)) throw new TicketError('Esa prioridad no existe.', 400);
    if (actual.prioridad === prioridad) return actual;

    const ticket = await Ticket.findOneAndUpdate({ canalId }, { $set: { prioridad } }, { returnDocument: 'after' });
    await actualizarMensajeControl(client, ticket, config);
    await registrarLogTicket(client, ticket, `🚨 Prioridad cambiada a ${prioridad}`, colorPrioridad(config, prioridad), autor, autorId);
    return ticket;
}

async function añadirParticipante(client, canal, usuario, { autor, autorId = null }) {
    const ticket = await Ticket.findOne({ canalId: canal.id });
    if (!ticket) throw new TicketError('Este canal no es un ticket.', 404);
    if (ticket.estado === 'Cerrado') throw new TicketError('No puedes añadir usuarios a un ticket cerrado.', 409);
    if (ticket.creadorId === usuario.id || (ticket.participantes || []).some(p => p.id === usuario.id)) {
        throw new TicketError(`${usuario.username} ya participa en este ticket.`, 409);
    }

    await canal.permissionOverwrites.edit(usuario.id, {
        ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true
    }, { type: OverwriteType.Member });
    await Ticket.updateOne({ canalId: canal.id, 'participantes.id': { $ne: usuario.id } }, { $push: { participantes: { ...usuario, rol: 'Invitado' } } });
    await canal.send({ content: `👋 <@${usuario.id}> se ha unido al ticket (añadido por **${md(autor)}**).`, allowedMentions: { users: [usuario.id] } });
    await registrarLog(client, {
        guildId: ticket.guildId, categoria: 'Tickets', accion: '➕ Usuario Añadido al Ticket', usuario: autor, usuarioId: autorId,
        detalles: `**${md(usuario.username)}** añadido al ticket ${etiquetaTicket(ticket)}: **${md(ticket.titulo || ticket.motivo)}**`, color: COLORES.usuarios
    });
}

async function quitarParticipante(client, canal, usuarioId, { autor, autorId = null }) {
    const ticket = await Ticket.findOne({ canalId: canal.id });
    if (!ticket) throw new TicketError('Este canal no es un ticket.', 404);
    if (usuarioId === ticket.creadorId) throw new TicketError('No puedes quitar al creador del ticket.', 400);
    const participante = (ticket.participantes || []).find(p => p.id === usuarioId);
    if (!participante) throw new TicketError('Ese usuario no participa en este ticket.', 404);

    await canal.permissionOverwrites.delete(usuarioId).catch(() => {});
    const cambios = { $pull: { participantes: { id: usuarioId } } };
    if (ticket.asignadoA === usuarioId) cambios.$set = { asignadoA: null, asignadoNombre: null };
    const actualizado = await Ticket.findOneAndUpdate({ canalId: canal.id }, cambios, { returnDocument: 'after' });
    if (cambios.$set) await actualizarMensajeControl(client, actualizado);

    await canal.send({ content: `👋 **${md(participante.username)}** ya no participa en el ticket (quitado por **${md(autor)}**).`, allowedMentions: { parse: [] } });
    await registrarLog(client, {
        guildId: ticket.guildId, categoria: 'Tickets', accion: '➖ Usuario Quitado del Ticket', usuario: autor, usuarioId: autorId,
        detalles: `**${md(participante.username)}** quitado del ticket ${etiquetaTicket(ticket)}: **${md(ticket.titulo || ticket.motivo)}**`, color: COLORES.usuarios
    });
}

// Envía al canal un mensaje escrito desde la web (panel del staff o portal del usuario)
// y lo guarda en la conversación. autor = { id, username, avatar }.
async function enviarMensajeWeb(client, ticket, { autor, contenido, origen, esStaff }) {
    const texto = String(contenido || '').trim();
    if (!texto) throw new TicketError('El mensaje está vacío.', 400);
    if (texto.length > 2000) throw new TicketError('El mensaje no puede superar los 2000 caracteres.', 400);
    if (ticket.estado === 'Cerrado') throw new TicketError('Este ticket está cerrado.', 409);
    const canal = client.channels.cache.get(ticket.canalId);
    if (!canal) throw new TicketError('El canal del ticket ya no existe en Discord.', 410);

    const embed = new EmbedBuilder()
        .setColor(esStaff ? '#5865F2' : '#4e5058')
        .setAuthor({ name: truncar(`${autor.username}${esStaff ? ' · Staff' : ''}`, 256), iconURL: autor.avatar || undefined })
        .setDescription(texto)
        .setFooter({ text: origen === 'panel' ? 'Respondido desde el panel web' : 'Enviado desde el portal web' })
        .setTimestamp();
    const enviado = await canal.send({ embeds: [embed], allowedMentions: { parse: [] } });

    const mensaje = await Mensaje.create({
        ticketId: ticket.canalId,
        mensajeId: enviado.id,
        usuario: autor.username,
        usuarioId: autor.id,
        avatar: autor.avatar || null,
        esStaff,
        origen,
        contenido: texto
    });
    await registrarActividad(ticket.canalId, esStaff);
    return mensaje;
}

// Actualiza "quién debe responder" y las métricas de respuesta del staff.
// Cualquier mensaje reinicia la cuenta del cierre automático por inactividad.
async function registrarActividad(canalId, esStaff) {
    const ahora = new Date();
    const cambios = { ultimaActividad: ahora, esperando: esStaff ? 'usuario' : 'staff', avisoInactividad: null };
    if (esStaff) cambios.ultimaInteractStaff = ahora;
    await Ticket.updateOne({ canalId, estado: 'Abierto' }, { $set: cambios });
    if (esStaff) await Ticket.updateOne({ canalId, primeraRespuestaStaff: null }, { $set: { primeraRespuestaStaff: ahora } });
}

// Al añadir o quitar un rol de staff, aplica el cambio también a los tickets que ya existen.
async function sincronizarRolStaff(client, guildId, rolId, conceder) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const tickets = await Ticket.find({ guildId, canalEliminado: { $ne: true } }).select('canalId').lean();
    for (const { canalId } of tickets) {
        const canal = guild.channels.cache.get(canalId);
        if (!canal) continue;
        if (conceder) {
            await canal.permissionOverwrites.edit(rolId, {
                ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true
            }, { type: OverwriteType.Role }).catch(() => {});
        } else {
            await canal.permissionOverwrites.delete(rolId).catch(() => {});
        }
    }
}

module.exports = {
    TicketError,
    COLORES,
    etiquetaTicket,
    motivosDe,
    datosUsuario,
    construirMensajeTicket,
    actualizarMensajeControl,
    crearTicket,
    ticketsAbiertosDe,
    cerrarTicket,
    reabrirTicket,
    eliminarCanalTicket,
    marcarCanalEliminado,
    asignarTicket,
    cambiarPrioridad,
    añadirParticipante,
    quitarParticipante,
    enviarMensajeWeb,
    registrarActividad,
    registrarLogTicket,
    sincronizarRolStaff
};

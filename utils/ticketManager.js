// Lógica compartida del ciclo de vida de los tickets.
// La usan los botones/comandos de Discord y la API web, así que crear, cerrar y
// reabrir se comportan igual desde cualquier sitio.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, ChannelType, PermissionsBitField } = require('discord.js');
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { registrarLog } = require('./logs.js');
const ticketCache = require('./ticketCache.js');
const { obtenerConfig, buscarMotivo, nivelUrgencia, colorUrgencia, esPremium } = require('./config.js');
const { rolesDeMotivo } = require('./permisos.js');
const { pieDePagina, filaMarca } = require('./marca.js');
const ia = require('./ia.js');

const NOMBRE_CATEGORIA_ARCHIVO = '🗄️ Tickets Archivados';
const P = PermissionsBitField.Flags;

const slug = (texto) => (texto || 'usuario').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'usuario';

function nombreCanal(ticket, prefijo = 'ticket') {
    const num = ticket.numero ? `${String(ticket.numero).padStart(4, '0')}-` : '';
    return `${prefijo}-${num}${slug(ticket.creadorNombre)}`.slice(0, 95);
}

async function registrarLogTicket(client, ticket, accion, color, autor) {
    await registrarLog(client, {
        guildId: ticket.guildId,
        categoria: 'Tickets',
        accion,
        usuario: autor || 'Sistema',
        detalles: `Ticket${ticket.numero ? ` #${ticket.numero}` : ''}: **${ticket.titulo || ticket.motivo}** de ${ticket.creadorNombre}`,
        color
    });
}

// Categoría válida de este servidor (o null si no existe / no es categoría).
function categoriaValida(guild, id) {
    if (!id) return null;
    const c = guild.channels.cache.get(id);
    return c && c.type === ChannelType.GuildCategory ? c : null;
}

// --- CREAR ---

// Comprueba si el usuario puede abrir otro ticket. Devuelve { ok } o { ok:false, abiertos }.
async function comprobarLimite(guildId, userId, config) {
    const max = Math.max(1, config.maxTicketsPorUsuario || 1);
    const abiertos = await Ticket.find({ guildId, creadorId: userId, estado: 'Abierto', canalBorrado: { $ne: true } }).select('canalId').lean();
    return abiertos.length >= max ? { ok: false, abiertos, max } : { ok: true };
}

async function crearTicket(client, { guild, user, motivoId, respuestas }) {
    const config = await obtenerConfig(guild.id);
    const motivo = buscarMotivo(config, motivoId);
    if (!motivo) return { ok: false, error: 'Ese tipo de ticket ya no existe. Vuelve a pulsar el botón del panel.' };

    const limite = await comprobarLimite(guild.id, user.id, config);
    if (!limite.ok) {
        const enlaces = limite.abiertos.map(t => `<#${t.canalId}>`).join(', ');
        return { ok: false, error: `Ya tienes ${limite.abiertos.length} ticket(s) abierto(s): ${enlaces}. Ciérralos antes de abrir otro (máximo ${limite.max}).` };
    }

    const { contadorTickets: numero } = await ServidorConfig.findOneAndUpdate(
        { guildId: guild.id }, { $inc: { contadorTickets: 1 } }, { returnDocument: 'after' }
    );

    const urgencia = motivo.urgencia || 'Normal';
    const roles = rolesDeMotivo(config, motivo).filter(id => guild.roles.cache.has(id));
    const categoria = categoriaValida(guild, motivo.categoriaId) || categoriaValida(guild, config.categoriaTicketsId);

    const permisosUsuario = [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks];
    const permissionOverwrites = [
        { id: guild.id, deny: [P.ViewChannel] },
        { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.ManageChannels, P.EmbedLinks, P.AttachFiles] },
        { id: user.id, allow: permisosUsuario },
        ...roles.map(id => ({ id, allow: [...permisosUsuario, P.ManageMessages] }))
    ];

    const borrador = { numero, creadorNombre: user.username };
    const canal = await guild.channels.create({
        name: nombreCanal(borrador),
        type: ChannelType.GuildText,
        parent: categoria ? categoria.id : null,
        topic: `Ticket #${numero} · ${motivo.nombre} · ${user.username}`,
        permissionOverwrites
    });

    const avatar = user.displayAvatarURL({ extension: 'png', size: 128 });
    const titulo = (respuestas[0]?.respuesta || motivo.nombre).slice(0, 100);
    const descripcion = respuestas.length > 1
        ? respuestas.slice(1).map(r => respuestas.length > 2 ? `${r.pregunta}: ${r.respuesta}` : r.respuesta).join('\n')
        : (respuestas[0]?.respuesta || 'Sin descripción');

    const ticket = await Ticket.create({
        guildId: guild.id,
        canalId: canal.id,
        numero,
        creadorId: user.id,
        creadorNombre: user.username,
        creadorAvatar: avatar,
        motivo: motivo.nombre,
        motivoId: String(motivo._id),
        titulo,
        descripcion,
        respuestas,
        prioridad: urgencia,
        estado: 'Abierto',
        participantes: [{ id: user.id, username: user.username, avatar, rol: 'Creador' }],
        visibleWeb: true
    });
    ticketCache.agregar(canal.id);

    await registrarLogTicket(client, ticket, '🎫 Ticket Abierto', '#2ecc71', user.username);

    const embed = new EmbedBuilder()
        .setTitle(`${motivo.emoji ? motivo.emoji + ' ' : '🎫 '}${titulo}`.slice(0, 256))
        .setColor(colorUrgencia(config, urgencia))
        .setDescription(`**Tipo:** ${motivo.nombre}\n\n*Un miembro del equipo lo revisará en breve.*`)
        .addFields(
            ...respuestas.map(r => ({ name: r.pregunta.slice(0, 256), value: (r.respuesta || '—').slice(0, 1024) })),
            { name: '🚨 Urgencia', value: `**${urgencia}**`, inline: true },
            { name: '🔢 Ticket', value: `#${numero}`, inline: true }
        )
        .setFooter({ text: pieDePagina(config) });

    const botones = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('reclamar_ticket').setLabel('🙋‍♂️ Reclamar Ticket').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('add_user_prompt').setLabel('➕ Añadir Usuario').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Cerrar Ticket').setStyle(ButtonStyle.Danger)
    );

    const menciones = config.mencionarStaff && roles.length > 0 ? ' ' + roles.map(id => `<@&${id}>`).join(' ') : '';
    await canal.send({
        content: `¡Hola <@${user.id}>! Aquí tienes tu ticket. 👇${menciones}`,
        embeds: [embed],
        components: [botones],
        allowedMentions: { users: [user.id], roles }
    });

    // Triaje con IA en segundo plano: no retrasa la creación del ticket.
    triarEnSegundoPlano(client, config, ticket, canal).catch(() => {});

    return { ok: true, ticket, canal };
}

async function triarEnSegundoPlano(client, config, ticket, canal) {
    if (!ia.iaConfigurada() || config.ia?.activada === false || config.ia?.triaje === false) return;
    try {
        await ia.prepararIA(config);
        const r = await ia.triarTicket({ motivo: ticket.motivo, respuestas: ticket.respuestas, urgencias: config.urgencias });
        const cambios = {
            'ia.idioma': r.idioma, 'ia.sentimiento': r.sentimiento, 'ia.resumen': r.resumen,
            'ia.urgenciaSugerida': r.urgencia_sugerida, 'ia.motivoUrgencia': r.motivo_urgencia
        };
        const sube = nivelUrgencia(config, r.urgencia_sugerida) > nivelUrgencia(config, ticket.prioridad);
        if (sube) cambios.prioridad = r.urgencia_sugerida;
        await Ticket.updateOne({ _id: ticket._id }, { $set: cambios });

        if (sube) {
            const aviso = new EmbedBuilder()
                .setColor(colorUrgencia(config, r.urgencia_sugerida))
                .setDescription(`🤖 **Prioridad actualizada a ${r.urgencia_sugerida}.**\n${r.motivo_urgencia}`);
            await canal.send({ embeds: [aviso] }).catch(() => {});
            await registrarLogTicket(client, ticket, `🤖 IA subió la prioridad a ${r.urgencia_sugerida}`, '#9b59b6', 'IA');
        }
    } catch (e) {
        if (!(e instanceof ia.IAError)) console.error('Error en el triaje IA:', e);
    }
}

// --- CERRAR ---

async function generarTranscript(canalId, ticket) {
    const historial = await Mensaje.find({ ticketId: canalId }).sort({ fecha: 1 });
    let txt = `=== TRANSCRIPCIÓN DEL TICKET${ticket.numero ? ` #${ticket.numero}` : ''} ===\n` +
        `Usuario: ${ticket.creadorNombre}\n` +
        `Tipo: ${ticket.motivo}\n` +
        `Asunto: ${ticket.titulo || '-'}\n` +
        `Fecha de cierre: ${new Date().toLocaleString('es-ES')}\n` +
        `=================================\n\n`;

    (ticket.respuestas || []).forEach(r => { txt += `> ${r.pregunta}\n${r.respuesta}\n\n`; });
    if (historial.length === 0) txt += '(No se registraron mensajes)\n';
    else historial.forEach(m => {
        const fecha = m.fecha ? new Date(m.fecha).toLocaleString('es-ES') : '';
        const adjuntos = m.imagenes && m.imagenes.length ? ` [${m.imagenes.length} adjunto(s)]` : '';
        txt += `[${fecha}] ${m.usuario}: ${m.contenido}${adjuntos}\n`;
    });

    return new AttachmentBuilder(Buffer.from(txt, 'utf-8'), { name: `transcript-${ticket.numero || ''}-${slug(ticket.creadorNombre)}.txt` });
}

async function archivarCanal(canal, ticket, config) {
    try {
        const guild = canal.guild;
        let categoria = categoriaValida(guild, config.categoriaArchivoId) ||
            guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === NOMBRE_CATEGORIA_ARCHIVO);
        if (!categoria) {
            categoria = await guild.channels.create({ name: NOMBRE_CATEGORIA_ARCHIVO, type: ChannelType.GuildCategory });
        }
        if (config.categoriaArchivoId !== categoria.id) {
            await ServidorConfig.updateOne({ guildId: guild.id }, { categoriaArchivoId: categoria.id });
        }
        await canal.setParent(categoria.id, { lockPermissions: false }).catch(() => {});
        await canal.permissionOverwrites.edit(ticket.creadorId, { SendMessages: false }).catch(() => {});
        await canal.setName(nombreCanal(ticket, 'cerrado')).catch(() => {});
    } catch (e) { console.error('Error archivando el canal:', e); }
}

// Cierra un ticket: transcript + valoración por MD + log + archivado del canal.
async function cerrarTicket(client, canalId, { autor = 'Sistema', avisarCanal = false } = {}) {
    const ticket = await Ticket.findOneAndUpdate(
        { canalId },
        { estado: 'Cerrado', fechaCierre: new Date() },
        { returnDocument: 'after' }
    );
    if (!ticket) return { ok: false, error: 'Ticket no encontrado' };
    const config = await obtenerConfig(ticket.guildId);

    try {
        const attachment = await generarTranscript(canalId, ticket);
        const embedCSAT = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle('📊 ¡Tu ticket ha sido cerrado!')
            .setDescription(`Hola **${ticket.creadorNombre}**, adjunto tienes una copia de la conversación de tu ticket.\n\nPor favor, **valora la atención recibida** pulsando en las estrellas de abajo. ¡Nos ayuda a mejorar!`)
            .setFooter({ text: pieDePagina(config) });
        const filaEstrellas = new ActionRowBuilder().addComponents(
            [1, 2, 3, 4, 5].map(n => new ButtonBuilder().setCustomId(`csat_${n}_${canalId}`).setLabel('⭐'.repeat(n)).setStyle(ButtonStyle.Secondary))
        );
        const componentes = [filaEstrellas];
        const marca = filaMarca(config, client);
        if (marca) componentes.push(marca);
        const usuario = await client.users.fetch(ticket.creadorId);
        await usuario.send({ embeds: [embedCSAT], components: componentes, files: [attachment] });
    } catch (e) { /* MD cerrados u otro fallo: no debe bloquear el cierre */ }

    await registrarLogTicket(client, ticket, '🔒 Ticket Cerrado', '#e74c3c', autor);

    const canal = client.channels.cache.get(canalId);
    if (canal) {
        if (avisarCanal) {
            await canal.send('🔒 **Este ticket ha sido cerrado.** Queda archivado en modo solo lectura.').catch(() => {});
        }
        await archivarCanal(canal, ticket, config);
    }

    resumirAlCerrar(config, ticket).catch(() => {});
    return { ok: true, ticket };
}

// Guarda un resumen del ticket cerrado: sirve de conocimiento para que la IA
// resuelva consultas parecidas en el futuro. Solo en Premium (gasta cupo).
async function resumirAlCerrar(config, ticket) {
    if (!esPremium(config) || !ia.iaConfigurada() || config.ia?.activada === false) return;
    const mensajes = await Mensaje.find({ ticketId: ticket.canalId }).sort({ fecha: 1 }).lean();
    if (mensajes.length < 2) return;
    try {
        await ia.prepararIA(config);
        const r = await ia.resumirTicket({ ticket, mensajes });
        await Ticket.updateOne({ _id: ticket._id }, { $set: { 'ia.resumenCierre': `${r.resumen} ${r.estado}`.trim() } });
    } catch (e) {
        if (!(e instanceof ia.IAError)) console.error('Error resumiendo ticket cerrado:', e);
    }
}

// --- REABRIR ---

async function reabrirTicket(client, canalId, { autor = 'Sistema' } = {}) {
    const ticket = await Ticket.findOneAndUpdate(
        { canalId },
        { estado: 'Abierto', fechaCierre: null },
        { returnDocument: 'after' }
    );
    if (!ticket) return { ok: false, error: 'Ticket no encontrado' };
    const config = await obtenerConfig(ticket.guildId);

    const canal = client.channels.cache.get(canalId);
    if (canal) {
        const motivo = buscarMotivo(config, ticket.motivoId || ticket.motivo);
        const categoria = categoriaValida(canal.guild, motivo?.categoriaId) || categoriaValida(canal.guild, config.categoriaTicketsId);
        await canal.permissionOverwrites.edit(ticket.creadorId, { ViewChannel: true, SendMessages: true }).catch(() => {});
        await canal.setParent(categoria ? categoria.id : null, { lockPermissions: false }).catch(() => {});
        await canal.setName(nombreCanal(ticket)).catch(() => {});
        await canal.send('🔓 **Este ticket ha sido reabierto.** Ya puedes volver a escribir.').catch(() => {});
    }
    await registrarLogTicket(client, ticket, '🔓 Ticket Reabierto', '#2ecc71', autor);
    return { ok: true, ticket };
}

module.exports = { crearTicket, cerrarTicket, reabrirTicket, generarTranscript, registrarLogTicket, comprobarLimite, nombreCanal };

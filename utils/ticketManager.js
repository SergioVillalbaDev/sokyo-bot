// Lógica compartida de ciclo de vida de los tickets.
// La usan tanto los botones de Discord (events/interactionCreate.js) como la API web
// (api/server.js), de modo que cerrar/reabrir se comporta igual desde ambos sitios.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, ChannelType, PermissionsBitField, OverwriteType } = require('discord.js');
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js');
const Log = require('../models/Log.js');
const ServidorConfig = require('../models/ServidorConfig.js');

const CATEGORIA_ARCHIVO = '🗄️ Tickets Archivados';

// Permisos que tienen dentro de un ticket abierto su creador y el equipo de staff.
const PERMISOS_TICKET = [
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.ReadMessageHistory,
    PermissionsBitField.Flags.AttachFiles
];

// Roles de staff configurados que siguen existiendo en el servidor
// (un rol borrado en Discord haría fallar la creación del canal).
function rolesStaffValidos(guild, config) {
    return (config?.rolesStaff || []).filter(id => guild.roles.cache.has(id));
}

// Categoría configurada para los tickets, solo si existe y es realmente una categoría.
function obtenerCategoriaTickets(guild, config) {
    const id = config?.categoriaTicketsId;
    if (!id) return null;
    const canal = guild.channels.cache.get(id);
    return canal?.type === ChannelType.GuildCategory ? canal : null;
}

// Es staff quien tiene alguno de los roles de staff configurados O el permiso Gestionar Canales.
function esStaff(member, config) {
    if (!member) return false;
    if (member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return true;
    const roles = config?.rolesStaff || [];
    return roles.length > 0 && member.roles.cache.hasAny(...roles);
}

// permissionOverwrites de un canal de ticket nuevo: oculto para @everyone,
// visible para el creador y para cada rol de staff.
function permisosCanalTicket(guild, config, creadorId) {
    return [
        { id: guild.id, type: OverwriteType.Role, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: creadorId, type: OverwriteType.Member, allow: PERMISOS_TICKET },
        ...rolesStaffValidos(guild, config).map(id => ({ id, type: OverwriteType.Role, allow: PERMISOS_TICKET }))
    ];
}

// Registra un evento del ciclo de vida del ticket en la auditoría (pestaña "Tickets").
async function registrarLogTicket(ticket, accion, color, autor) {
    try {
        await Log.create({
            guildId: ticket.guildId,
            categoria: 'Tickets',
            accion,
            usuario: autor || 'Sistema',
            detalles: `Ticket: **${ticket.titulo || ticket.motivo}** de ${ticket.creadorNombre}`,
            color
        });
    } catch (e) { console.error('Error guardando log de ticket:', e); }
}

// Genera el archivo .txt con la conversación completa del ticket.
async function generarTranscript(canalId, ticket) {
    const historial = await Mensaje.find({ ticketId: canalId }).sort({ fecha: 1 });
    let txt = `=== TRANSCRIPCIÓN DEL TICKET ===\n` +
        `Usuario: ${ticket.creadorNombre}\n` +
        `Motivo: ${ticket.motivo}\n` +
        `Asunto: ${ticket.titulo || '-'}\n` +
        `Fecha de cierre: ${new Date().toLocaleString('es-ES')}\n` +
        `=================================\n\n`;

    if (historial.length === 0) txt += '(No se registraron mensajes)\n';
    else historial.forEach(m => {
        const fecha = m.fecha ? new Date(m.fecha).toLocaleTimeString('es-ES') : '';
        txt += `[${fecha}] ${m.usuario}: ${m.contenido}\n`;
    });

    return new AttachmentBuilder(Buffer.from(txt, 'utf-8'), { name: `transcript-${ticket.creadorNombre}.txt` });
}

// Mueve el canal a la categoría de archivados y lo deja en modo solo lectura.
async function archivarCanal(canal, ticket) {
    try {
        const guild = canal.guild;
        let categoria = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === CATEGORIA_ARCHIVO);
        if (!categoria) {
            categoria = await guild.channels.create({ name: CATEGORIA_ARCHIVO, type: ChannelType.GuildCategory });
        }
        await canal.setParent(categoria.id, { lockPermissions: false }).catch(() => {});
        await canal.permissionOverwrites.edit(ticket.creadorId, { SendMessages: false }, { type: OverwriteType.Member }).catch(() => {});
        if (!canal.name.startsWith('cerrado-')) {
            await canal.setName(`cerrado-${ticket.creadorNombre}`).catch(() => {});
        }
    } catch (e) { console.error('Error archivando el canal:', e); }
}

// Cierra un ticket: transcript + encuesta CSAT por DM + log + archivado del canal.
// Devuelve { ok, ticket } o { ok: false, error }.
async function cerrarTicket(client, canalId, { autor = 'Sistema', avisarCanal = false } = {}) {
    const ticket = await Ticket.findOneAndUpdate(
        { canalId },
        { estado: 'Cerrado', fechaCierre: new Date() },
        { new: true }
    );
    if (!ticket) return { ok: false, error: 'Ticket no encontrado' };

    // Transcript + encuesta de satisfacción por DM al creador.
    try {
        const attachment = await generarTranscript(canalId, ticket);
        const embedCSAT = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle('📊 ¡Tu ticket ha sido cerrado!')
            .setDescription(`Hola **${ticket.creadorNombre}**, adjunto tienes una copia de la conversación de tu ticket.\n\nPor favor, **valora la atención recibida** pulsando en las estrellas de abajo. ¡Nos ayuda a mejorar!`);
        const filaEstrellas = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`csat_1_${canalId}`).setLabel('⭐').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`csat_2_${canalId}`).setLabel('⭐⭐').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`csat_3_${canalId}`).setLabel('⭐⭐⭐').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`csat_4_${canalId}`).setLabel('⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`csat_5_${canalId}`).setLabel('⭐⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary)
        );
        const usuario = await client.users.fetch(ticket.creadorId);
        await usuario.send({ embeds: [embedCSAT], components: [filaEstrellas], files: [attachment] });
    } catch (e) { /* DMs cerrados u otro fallo: no debe bloquear el cierre */ }

    await registrarLogTicket(ticket, '🔒 Ticket Cerrado', '#e74c3c', autor);

    const canal = client.channels.cache.get(canalId);
    if (canal) {
        if (avisarCanal) {
            await canal.send('🔒 **Este ticket ha sido cerrado.** Queda archivado en modo solo lectura.').catch(() => {});
        }
        await archivarCanal(canal, ticket);
    }
    return { ok: true, ticket };
}

// Reabre un ticket archivado: restaura permisos y lo devuelve a la categoría de tickets
// configurada (o a la raíz del servidor si no hay ninguna).
async function reabrirTicket(client, canalId, { autor = 'Sistema' } = {}) {
    const ticket = await Ticket.findOneAndUpdate(
        { canalId },
        { estado: 'Abierto', fechaCierre: null },
        { new: true }
    );
    if (!ticket) return { ok: false, error: 'Ticket no encontrado' };

    const canal = client.channels.cache.get(canalId);
    if (canal) {
        const config = await ServidorConfig.findOne({ guildId: ticket.guildId }).catch(() => null);
        const categoria = obtenerCategoriaTickets(canal.guild, config);

        const permisosAbierto = { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true };
        await canal.permissionOverwrites.edit(ticket.creadorId, permisosAbierto, { type: OverwriteType.Member }).catch(() => {});
        // Por si el ticket se creó antes de configurar el staff (o con otros roles).
        for (const rolId of rolesStaffValidos(canal.guild, config)) {
            await canal.permissionOverwrites.edit(rolId, permisosAbierto, { type: OverwriteType.Role }).catch(() => {});
        }
        // lockPermissions: false para no sustituir los permisos del ticket por los de la categoría.
        await canal.setParent(categoria ? categoria.id : null, { lockPermissions: false }).catch(() => {});
        await canal.setName(`ticket-${ticket.creadorNombre}`).catch(() => {});
        await canal.send('🔓 **Este ticket ha sido reabierto.** Ya puedes volver a escribir.').catch(() => {});
    }
    await registrarLogTicket(ticket, '🔓 Ticket Reabierto', '#2ecc71', autor);
    return { ok: true, ticket };
}

module.exports = {
    cerrarTicket, reabrirTicket, generarTranscript, registrarLogTicket,
    esStaff, obtenerCategoriaTickets, permisosCanalTicket
};

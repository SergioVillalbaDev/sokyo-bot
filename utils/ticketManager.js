// Lógica compartida de ciclo de vida de los tickets.
// La usan tanto los botones de Discord (events/interactionCreate.js) como la API web
// (api/server.js), de modo que cerrar/reabrir se comporta igual desde ambos sitios.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, ChannelType } = require('discord.js');
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js');
const Log = require('../models/Log.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { escaparHtml, formatDuracion } = require('./helpers.js');
const { emitir } = require('./eventos.js');

const CATEGORIA_ARCHIVO = '🗄️ Tickets Archivados';

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

// Construye la transcripción como página HTML autocontenida (se ve bien en cualquier navegador
// y se puede imprimir / guardar como PDF desde ahí).
function construirTranscriptHtml(ticket, historial) {
    const urlSegura = (u) => /^https?:\/\//i.test(u) ? escaparHtml(u) : '';
    const filas = historial.length === 0
        ? '<p class="vacio">(No se registraron mensajes)</p>'
        : historial.map(m => {
            const esCreador = m.usuarioId === ticket.creadorId;
            const fecha = m.fecha ? new Date(m.fecha).toLocaleString('es-ES') : '';
            const imgs = (m.imagenes || []).map(urlSegura).filter(Boolean)
                .map(u => `<a href="${u}" target="_blank" rel="noopener"><img src="${u}" alt="adjunto"></a>`).join('');
            return `<div class="msg ${esCreador ? 'user' : 'staff'}"><div class="meta"><b>${escaparHtml(m.usuario)}</b><span>${escaparHtml(fecha)}</span></div>` +
                `<div class="txt">${escaparHtml(m.contenido).replace(/\n/g, '<br>')}</div>${imgs}</div>`;
        }).join('\n');

    const duracion = ticket.fechaCierre && ticket.fechaCreacion ? formatDuracion(new Date(ticket.fechaCierre) - new Date(ticket.fechaCreacion)) : '—';
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Transcripción — ${escaparHtml(ticket.titulo || ticket.motivo)}</title>
<style>
body{font-family:system-ui,Segoe UI,sans-serif;background:#1e1f22;color:#f2f3f5;margin:0;padding:24px}
.wrap{max-width:820px;margin:auto}
header{background:#2b2d31;border-radius:12px;padding:20px 24px;border-left:5px solid #5865F2;margin-bottom:20px}
h1{margin:0 0 8px;font-size:1.3rem}.info{display:flex;flex-wrap:wrap;gap:6px 20px;color:#b5bac1;font-size:.88rem}
.msg{background:#313338;border-radius:10px;padding:12px 16px;margin-bottom:10px;border-left:4px solid #3ba55d}
.msg.user{border-left-color:#5865F2}.meta{display:flex;justify-content:space-between;gap:12px;font-size:.82rem;color:#b5bac1;margin-bottom:4px}
.meta b{color:#fff}.txt{line-height:1.5;word-break:break-word}.msg img{max-width:100%;max-height:320px;border-radius:8px;margin-top:8px}
.vacio{color:#b5bac1;text-align:center}footer{text-align:center;color:#6d6f78;font-size:.78rem;margin-top:24px}
@media print{body{background:#fff;color:#000}header,.msg{background:#f4f4f5}.meta,.info{color:#444}.meta b{color:#000}}
</style></head><body><div class="wrap">
<header><h1>🎫 ${escaparHtml(ticket.titulo || 'Ticket de soporte')}</h1><div class="info">
<span>👤 ${escaparHtml(ticket.creadorNombre)}</span><span>🏷️ ${escaparHtml(ticket.motivo)}</span><span>🚨 ${escaparHtml(ticket.prioridad)}</span>
<span>🛡️ ${escaparHtml(ticket.asignadoNombre || 'Sin reclamar')}</span><span>⏱️ Duración: ${escaparHtml(duracion)}</span>
<span>📅 ${escaparHtml(new Date(ticket.fechaCreacion).toLocaleString('es-ES'))}</span></div></header>
${filas}
<footer>Generado por Sokyo Bot · ${escaparHtml(new Date().toLocaleString('es-ES'))}</footer></div></body></html>`;
}

async function generarTranscriptHtml(canalId, ticket) {
    const historial = await Mensaje.find({ ticketId: canalId }).sort({ fecha: 1 });
    return construirTranscriptHtml(ticket, historial);
}

// Adjunto de Discord con la transcripción.
async function generarTranscript(canalId, ticket) {
    const html = await generarTranscriptHtml(canalId, ticket);
    const nombre = String(ticket.creadorNombre).replace(/[^a-z0-9_-]/gi, '_');
    return new AttachmentBuilder(Buffer.from(html, 'utf-8'), { name: `transcript-${nombre}.html` });
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
        await canal.permissionOverwrites.edit(ticket.creadorId, { SendMessages: false }).catch(() => {});
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
        { returnDocument: 'after' }
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

    // Copia de la transcripción en el canal de archivo del servidor (si está configurado).
    try {
        const config = await ServidorConfig.findOne({ guildId: ticket.guildId });
        const canalArchivo = config?.tickets?.canalTranscriptsId && client.channels.cache.get(config.tickets.canalTranscriptsId);
        if (canalArchivo) {
            const archivo = await generarTranscript(canalId, ticket);
            const resumen = new EmbedBuilder().setColor('#e74c3c').setTitle(`🗄️ Ticket cerrado: ${ticket.titulo || ticket.motivo}`)
                .addFields(
                    { name: 'Usuario', value: ticket.creadorNombre, inline: true },
                    { name: 'Atendido por', value: ticket.asignadoNombre || 'Sin reclamar', inline: true },
                    { name: 'Cerrado por', value: autor, inline: true }
                );
            await canalArchivo.send({ embeds: [resumen], files: [archivo] });
        }
    } catch (e) { console.error('Error enviando transcripción al canal de archivo:', e); }

    await registrarLogTicket(ticket, '🔒 Ticket Cerrado', '#e74c3c', autor);

    const canal = client.channels.cache.get(canalId);
    if (canal) {
        if (avisarCanal) {
            await canal.send('🔒 **Este ticket ha sido cerrado.** Queda archivado en modo solo lectura.').catch(() => {});
        }
        await archivarCanal(canal, ticket);
    }
    emitir(ticket.guildId, 'ticket:actualizado', { canalId });
    return { ok: true, ticket };
}

// Reabre un ticket archivado: restaura permisos y lo saca de la categoría de archivo.
async function reabrirTicket(client, canalId, { autor = 'Sistema' } = {}) {
    const ticket = await Ticket.findOneAndUpdate(
        { canalId },
        { estado: 'Abierto', fechaCierre: null, slaAvisado: false, inactividadAvisadaEn: null, ultimoMensajeFecha: new Date() },
        { returnDocument: 'after' }
    );
    if (!ticket) return { ok: false, error: 'Ticket no encontrado' };

    const canal = client.channels.cache.get(canalId);
    if (canal) {
        await canal.permissionOverwrites.edit(ticket.creadorId, { ViewChannel: true, SendMessages: true }).catch(() => {});
        await canal.setParent(null).catch(() => {});
        await canal.setName(`ticket-${ticket.creadorNombre}`).catch(() => {});
        await canal.send('🔓 **Este ticket ha sido reabierto.** Ya puedes volver a escribir.').catch(() => {});
    }
    await registrarLogTicket(ticket, '🔓 Ticket Reabierto', '#2ecc71', autor);
    emitir(ticket.guildId, 'ticket:actualizado', { canalId });
    return { ok: true, ticket };
}

// Anota actividad en el ticket: alimenta las métricas (1ª respuesta del staff), el SLA y el
// cierre por inactividad. `autorId` es quien escribe el mensaje.
async function registrarActividad(canalId, autorId) {
    const ticket = await Ticket.findOne({ canalId });
    if (!ticket || ticket.estado === 'Cerrado') return null;
    const invitado = (ticket.participantes || []).some(p => p.id === autorId && p.rol === 'Invitado');
    const esStaff = autorId !== ticket.creadorId && !invitado;
    const ahora = new Date();
    const set = { ultimoMensajeFecha: ahora, ultimoMensajePor: esStaff ? 'staff' : 'usuario', slaAvisado: false, inactividadAvisadaEn: null };
    if (esStaff) {
        set.ultimaInteractStaff = ahora;
        if (!ticket.primeraRespuestaStaff) set.primeraRespuestaStaff = ahora;
    }
    const actualizado = await Ticket.findOneAndUpdate({ canalId }, { $set: set }, { returnDocument: 'after' });
    emitir(ticket.guildId, 'mensaje:nuevo', { canalId });
    return actualizado;
}

// Reclamar un ticket (atómico: si dos staff pulsan a la vez, solo uno gana).
// `staff` = { id, username, avatar }
async function reclamarTicket(client, canalId, staff) {
    const ticket = await Ticket.findOneAndUpdate(
        { canalId, estado: 'Abierto', asignadoA: null },
        { $set: { asignadoA: staff.id, asignadoNombre: staff.username, ultimaInteractStaff: new Date() } },
        { returnDocument: 'after' }
    );
    if (!ticket) {
        const existente = await Ticket.findOne({ canalId });
        if (!existente) return { ok: false, error: 'Ticket no encontrado' };
        if (existente.estado === 'Cerrado') return { ok: false, error: 'El ticket está cerrado' };
        return { ok: false, error: `Este ticket ya está siendo atendido por ${existente.asignadoNombre}.` };
    }
    if (!(ticket.participantes || []).some(p => p.id === staff.id)) {
        await Ticket.updateOne({ canalId }, { $push: { participantes: { id: staff.id, username: staff.username, avatar: staff.avatar, rol: 'Staff' } } });
    }
    await registrarLogTicket(ticket, '🙋 Ticket Reclamado', '#3498db', staff.username);
    emitir(ticket.guildId, 'ticket:actualizado', { canalId });
    return { ok: true, ticket };
}

// Soltar un ticket para que otro staff pueda reclamarlo. Deja un botón para reclamarlo de nuevo en el canal.
async function soltarTicket(client, canalId, { autor = 'Sistema' } = {}) {
    const ticket = await Ticket.findOneAndUpdate(
        { canalId, estado: 'Abierto', asignadoA: { $ne: null } },
        { $set: { asignadoA: null, asignadoNombre: null } },
        { returnDocument: 'after' }
    );
    if (!ticket) return { ok: false, error: 'El ticket no está asignado o está cerrado' };
    await registrarLogTicket(ticket, '🆓 Ticket Liberado', '#95a5a6', autor);
    const canal = client.channels.cache.get(canalId);
    if (canal) {
        const fila = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('reclamar_ticket').setLabel('🙋‍♂️ Reclamar Ticket').setStyle(ButtonStyle.Primary)
        );
        await canal.send({ content: `🆓 **${autor}** ha liberado este ticket. Cualquier agente puede reclamarlo.`, components: [fila] }).catch(() => {});
    }
    emitir(ticket.guildId, 'ticket:actualizado', { canalId });
    return { ok: true, ticket };
}

module.exports = {
    cerrarTicket, reabrirTicket, reclamarTicket, soltarTicket, registrarActividad,
    generarTranscript, generarTranscriptHtml, construirTranscriptHtml, registrarLogTicket
};

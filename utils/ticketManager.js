// Lógica compartida de ciclo de vida de los tickets.
// La usan tanto los botones de Discord (events/interactionCreate.js) como la API web
// (api/server.js), de modo que cerrar/reabrir se comporta igual desde ambos sitios.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, ChannelType } = require('discord.js');
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js');
const Log = require('../models/Log.js');
const { getConfig, logActivo } = require('./config.js');

const CATEGORIA_ARCHIVO = '🗄️ Tickets Archivados';

// Registra un evento del ciclo de vida del ticket en la auditoría (pestaña "Tickets").
async function registrarLogTicket(ticket, accion, color, autor) {
    try {
        const cfg = await getConfig(ticket.guildId);
        if (!logActivo(cfg, 'tickets')) return; // logs de tickets desactivados en el panel
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
async function archivarCanal(canal, ticket, categoriaNombre = CATEGORIA_ARCHIVO) {
    try {
        const guild = canal.guild;
        const nombreCat = categoriaNombre || CATEGORIA_ARCHIVO;
        let categoria = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === nombreCat);
        if (!categoria) {
            categoria = await guild.channels.create({ name: nombreCat, type: ChannelType.GuildCategory });
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
        { new: true }
    );
    if (!ticket) return { ok: false, error: 'Ticket no encontrado' };

    // Ajustes configurables (por defecto = comportamiento de siempre).
    const cfg = await getConfig(ticket.guildId);
    const ratingActivo = !(cfg && cfg.ratingActivo === false);
    const enviarTranscript = !(cfg && cfg.enviarTranscript === false);
    const avisoCierreCanal = !(cfg && cfg.avisoCierreCanal === false);

    // DM al creador con transcript y/o encuesta de satisfacción, según configuración.
    if (ratingActivo || enviarTranscript) {
        try {
            const files = [];
            let descripcion = `Hola **${ticket.creadorNombre}**, tu ticket de soporte ha sido cerrado.`;
            if (enviarTranscript) {
                files.push(await generarTranscript(canalId, ticket));
                descripcion += ` Adjunto tienes una copia de la conversación.`;
            }
            if (ratingActivo) {
                descripcion += `\n\nPor favor, **valora la atención recibida** pulsando en las estrellas de abajo. ¡Nos ayuda a mejorar!`;
            }
            const embedCSAT = new EmbedBuilder()
                .setColor('#f1c40f')
                .setTitle('📊 ¡Tu ticket ha sido cerrado!')
                .setDescription(descripcion);

            const componentes = [];
            if (ratingActivo) {
                componentes.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`csat_1_${canalId}`).setLabel('⭐').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`csat_2_${canalId}`).setLabel('⭐⭐').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`csat_3_${canalId}`).setLabel('⭐⭐⭐').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`csat_4_${canalId}`).setLabel('⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId(`csat_5_${canalId}`).setLabel('⭐⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary)
                ));
            }

            const usuario = await client.users.fetch(ticket.creadorId);
            await usuario.send({ embeds: [embedCSAT], components: componentes, files });
        } catch (e) { /* DMs cerrados u otro fallo: no debe bloquear el cierre */ }
    }

    await registrarLogTicket(ticket, '🔒 Ticket Cerrado', '#e74c3c', autor);

    const canal = client.channels.cache.get(canalId);
    if (canal) {
        if (avisarCanal && avisoCierreCanal) {
            await canal.send('🔒 **Este ticket ha sido cerrado.** Queda archivado en modo solo lectura.').catch(() => {});
        }
        await archivarCanal(canal, ticket, cfg && cfg.categoriaArchivados);
    }
    return { ok: true, ticket };
}

// Reabre un ticket archivado: restaura permisos y lo saca de la categoría de archivo.
async function reabrirTicket(client, canalId, { autor = 'Sistema' } = {}) {
    const ticket = await Ticket.findOneAndUpdate(
        { canalId },
        { estado: 'Abierto', fechaCierre: null },
        { new: true }
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
    return { ok: true, ticket };
}

module.exports = { cerrarTicket, reabrirTicket, generarTranscript, registrarLogTicket };

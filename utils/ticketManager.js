// Lógica compartida de ciclo de vida de los tickets.
// La usan tanto los botones de Discord (events/interactionCreate.js) como la API web
// (api/server.js), de modo que cerrar/reabrir se comporta igual desde ambos sitios.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, ChannelType, PermissionsBitField } = require('discord.js');
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js');
const Log = require('../models/Log.js');
const { getConfig, logActivo } = require('./config.js');
const { aplicarPieMarca, lineaMarcaTexto } = require('./marca.js');
const { esPro } = require('./billing.js');
const { enviarWebhook } = require('./webhooks.js');

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
async function generarTranscript(canalId, ticket, cfg) {
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

    txt += lineaMarcaTexto(cfg); // marca blanca: firma Sokyo solo en Free

    return new AttachmentBuilder(Buffer.from(txt, 'utf-8'), { name: `transcript-${ticket.creadorNombre}.txt` });
}

// Transcript en HTML con estilo (función Pro). Devuelve el HTML como string.
async function construirTranscriptHTML(canalId, ticket) {
    const historial = await Mensaje.find({ ticketId: canalId }).sort({ fecha: 1 });
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const filas = historial.length
        ? historial.map((m) => {
            const fecha = m.fecha ? new Date(m.fecha).toLocaleString('es-ES') : '';
            const cuerpo = m.contenido ? esc(m.contenido).replace(/\n/g, '<br>') : '<i>(sin texto)</i>';
            return `<div class="msg"><div class="meta"><span class="user">${esc(m.usuario)}</span><span class="time">${esc(fecha)}</span></div><div class="body">${cuerpo}</div></div>`;
        }).join('\n')
        : '<p class="empty">No se registraron mensajes.</p>';

    return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Transcript · ${esc(ticket.titulo || ticket.creadorNombre)}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0f1117; color: #e6e8ee; font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
  .wrap { max-width: 820px; margin: 0 auto; padding: 32px 20px 60px; }
  header { border-bottom: 1px solid #262a36; padding-bottom: 18px; margin-bottom: 24px; }
  h1 { font-size: 22px; margin: 0 0 6px; }
  .sub { color: #9aa0ad; font-size: 13px; line-height: 1.7; }
  .sub b { color: #c7ccd6; font-weight: 600; }
  .msg { background: #171a23; border: 1px solid #232734; border-radius: 14px; padding: 12px 14px; margin-bottom: 10px; }
  .meta { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
  .user { font-weight: 700; color: #8ab4ff; font-size: 13px; }
  .time { color: #6b7280; font-size: 12px; }
  .body { font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
  .empty { color: #6b7280; font-style: italic; }
  footer { margin-top: 28px; color: #6b7280; font-size: 12px; text-align: center; }
</style></head>
<body><div class="wrap">
<header>
  <h1>🎫 ${esc(ticket.titulo || 'Ticket de soporte')}</h1>
  <div class="sub">
    <div><b>Cliente:</b> ${esc(ticket.creadorNombre)}</div>
    <div><b>Motivo:</b> ${esc(ticket.motivo || '-')} &nbsp;·&nbsp; <b>Prioridad:</b> ${esc(ticket.prioridad || '-')}</div>
    <div><b>Cierre:</b> ${esc(new Date().toLocaleString('es-ES'))}</div>
  </div>
</header>
${filas}
<footer>Transcript generado el ${esc(new Date().toLocaleString('es-ES'))}</footer>
</div></body></html>`;
}

// Envoltura del HTML como adjunto de Discord (.html).
async function generarTranscriptHTML(canalId, ticket) {
    const html = await construirTranscriptHTML(canalId, ticket);
    return new AttachmentBuilder(Buffer.from(html, 'utf-8'), { name: `transcript-${ticket.creadorNombre}.html` });
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

// Crea un ticket (canal de Discord + documento + mensaje de bienvenida con los
// botones estándar). Reutilizable desde el flujo normal y desde otros sistemas
// (p. ej. los reportes). Devuelve { ok, ticket, canal } o { ok: false, error }.
async function crearTicket(client, { guildId, creador, motivo = 'Soporte', titulo = 'Ticket de Soporte', descripcion = '', prioridad = 'Normal', darAccesoCreador = true } = {}) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return { ok: false, error: 'Servidor no encontrado' };

    const cfg = await getConfig(guildId);
    const parentId = (cfg && cfg.categoriaTicketsId && guild.channels.cache.get(cfg.categoriaTicketsId)) ? cfg.categoriaTicketsId : null;
    const F = PermissionsBitField.Flags;

    const overwrites = [{ id: guild.id, deny: [F.ViewChannel] }];
    if (darAccesoCreador && creador && creador.id) {
        overwrites.push({ id: creador.id, allow: [F.ViewChannel, F.SendMessages, F.ReadMessageHistory] });
    }
    // Que el rol de staff configurado vea siempre el ticket.
    if (cfg && cfg.rolStaffId && guild.roles.cache.get(cfg.rolStaffId)) {
        overwrites.push({ id: cfg.rolStaffId, allow: [F.ViewChannel, F.SendMessages, F.ReadMessageHistory] });
    }

    const nombreBase = (creador && creador.username) ? creador.username : 'ticket';
    const canal = await guild.channels.create({
        name: `ticket-${nombreBase}`.slice(0, 90),
        type: ChannelType.GuildText,
        ...(parentId ? { parent: parentId } : {}),
        permissionOverwrites: overwrites,
    });

    const ticket = await Ticket.create({
        guildId,
        canalId: canal.id,
        creadorId: (creador && creador.id) || client.user.id,
        creadorNombre: (creador && creador.username) || 'Sistema',
        creadorAvatar: (creador && creador.avatar) || null,
        motivo, titulo, descripcion, prioridad, estado: 'Abierto',
        participantes: (creador && creador.id) ? [{ id: creador.id, username: creador.username, avatar: creador.avatar, rol: 'Creador' }] : [],
        visibleWeb: true,
    });

    await registrarLogTicket(ticket, '🎫 Ticket Abierto', '#2ecc71', (creador && creador.username) || 'Sistema');

    // Webhook saliente (Pro): avisa de un ticket nuevo (útil para los urgentes).
    enviarWebhook(cfg, 'ticketNuevo', {
        text: `🎫 Nuevo ticket [${prioridad}]: "${titulo}" de ${(creador && creador.username) || 'Sistema'} — ${motivo}`,
        data: { canalId: canal.id, titulo, motivo, prioridad, creadorId: (creador && creador.id) || null },
    }).catch(() => {});

    const embed = new EmbedBuilder()
        .setTitle(`🎫 ${titulo}`)
        .setColor('#3498db')
        .setDescription(`**Motivo:** ${motivo}${descripcion ? `\n\n${descripcion}` : ''}`)
        .addFields({ name: '🚨 Urgencia', value: `**${prioridad}**`, inline: true });
    aplicarPieMarca(embed, cfg); // marca blanca
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('reclamar_ticket').setLabel('🙋‍♂️ Reclamar Ticket').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('add_user_prompt').setLabel('➕ Añadir Usuario').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Cerrar Ticket').setStyle(ButtonStyle.Danger),
    );
    const saludo = (darAccesoCreador && creador && creador.id) ? `¡Hola <@${creador.id}>! Aquí tienes tu ticket. 👇` : 'Nuevo ticket 👇';
    await canal.send({ content: saludo, embeds: [embed], components: [row] });

    return { ok: true, ticket, canal };
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
                // Pro: transcript en HTML con estilo. Free: texto plano.
                files.push(esPro(cfg) ? await generarTranscriptHTML(canalId, ticket) : await generarTranscript(canalId, ticket, cfg));
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

module.exports = { crearTicket, cerrarTicket, reabrirTicket, generarTranscript, construirTranscriptHTML, generarTranscriptHTML, registrarLogTicket };

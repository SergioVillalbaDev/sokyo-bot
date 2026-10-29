// Lógica compartida de ciclo de vida de los tickets.
// La usan tanto los botones de Discord (events/interactionCreate.js) como la API web
// (api/server.js), de modo que cerrar/reabrir se comporta igual desde ambos sitios.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, ChannelType, PermissionsBitField, OverwriteType } = require('discord.js');
const https = require('https');
const PDFDocument = require('pdfkit');
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js');
const Log = require('../models/Log.js');
const { getConfig, logActivo } = require('./config.js');
const { aplicarPieMarca, lineaMarcaTexto } = require('./marca.js');
const { esPro } = require('./billing.js');
const { enviarWebhook } = require('./webhooks.js');
const { enviarLogADiscord } = require('./logsManager.js');
const { t } = require('./i18n.js');
const { nombreUrgencia } = require('./textosPorDefecto.js');

const CATEGORIA_ARCHIVO = '🗄️ Archived Tickets';

// Acciones del ciclo de vida del ticket en español (los llamadores las pasan en inglés).
const ACCIONES_ES = {
    '🎫 Ticket opened': '🎫 Ticket abierto',
    '🔒 Ticket closed': '🔒 Ticket cerrado',
    '🔓 Ticket reopened': '🔓 Ticket reabierto',
    '🙋 Ticket claimed': '🙋 Ticket reclamado',
    '🤖 Auto-assigned': '🤖 Asignado automáticamente',
};
function accionEnIdioma(cfg, accion) {
    if (t(cfg, 'es', 'en') !== 'es') return accion;
    const valorado = /^⭐ Ticket rated \((\d)\/5\)$/.exec(accion);
    if (valorado) return `⭐ Ticket valorado (${valorado[1]}/5)`;
    return ACCIONES_ES[accion] || accion;
}

// Registra un evento del ciclo de vida del ticket en la auditoría (pestaña "Tickets"),
// en el idioma del servidor.
async function registrarLogTicket(client, ticket, accion, color, autor) {
    try {
        const cfg = await getConfig(ticket.guildId);
        if (!logActivo(cfg, 'tickets')) return; // logs de tickets desactivados en el panel
        const titulo = ticket.titulo || ticket.motivo;
        const log = await Log.create({
            guildId: ticket.guildId,
            categoria: 'Tickets',
            accion: accionEnIdioma(cfg, accion),
            usuario: autor || t(cfg, 'Sistema', 'System'),
            detalles: t(cfg, `Ticket: **${titulo}** de ${ticket.creadorNombre}`, `Ticket: **${titulo}** from ${ticket.creadorNombre}`),
            color
        });
        if (client) await enviarLogADiscord(client, log);
    } catch (e) { console.error('Error guardando log de ticket:', e); }
}

// Descarga una imagen a memoria (Buffer) para poder incrustarla en el PDF.
// pdfkit necesita los bytes de la imagen, no puede pedir una URL directamente.
function descargarImagen(url) {
    return new Promise((resolve) => {
        try {
            https.get(url, (res) => {
                if (res.statusCode !== 200) { res.resume(); return resolve(null); }
                const trozos = [];
                res.on('data', (c) => trozos.push(c));
                res.on('end', () => resolve(Buffer.concat(trozos)));
                res.on('error', () => resolve(null));
            }).on('error', () => resolve(null));
        } catch { resolve(null); }
    });
}

// Genera el archivo .txt con la conversación completa del ticket.
async function generarTranscript(canalId, ticket, cfg) {
    const historial = await Mensaje.find({ ticketId: canalId }).sort({ fecha: 1 });
    let txt = t(cfg,
        `=== TRANSCRIPCIÓN DEL TICKET ===\n` +
        `Usuario: ${ticket.creadorNombre}\n` +
        `Motivo: ${ticket.motivo}\n` +
        `Asunto: ${ticket.titulo || '-'}\n` +
        `Cerrado el: ${new Date().toLocaleString('es-ES')}\n` +
        `=================================\n\n`,
        `=== TICKET TRANSCRIPT ===\n` +
        `User: ${ticket.creadorNombre}\n` +
        `Reason: ${ticket.motivo}\n` +
        `Subject: ${ticket.titulo || '-'}\n` +
        `Closed on: ${new Date().toLocaleString('en-US')}\n` +
        `=========================\n\n`);

    if (historial.length === 0) txt += t(cfg, '(No se registraron mensajes)\n', '(No messages were recorded)\n');
    else historial.forEach(m => {
        const fecha = m.fecha ? new Date(m.fecha).toLocaleTimeString(t(cfg, 'es-ES', 'en-US')) : '';
        txt += `[${fecha}] ${m.usuario}: ${m.contenido}\n`;
    });

    txt += lineaMarcaTexto(cfg); // marca blanca: firma Sokyo solo en Free

    return new AttachmentBuilder(Buffer.from(txt, 'utf-8'), { name: `transcript-${ticket.creadorNombre}.txt` });
}

// Transcript en HTML con estilo (función Pro). Devuelve el HTML como string.
async function construirTranscriptHTML(canalId, ticket, cfg) {
    const historial = await Mensaje.find({ ticketId: canalId }).sort({ fecha: 1 });
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const localeFechas = t(cfg, 'es-ES', 'en-US');
    const filas = historial.length
        ? historial.map((m) => {
            const fecha = m.fecha ? new Date(m.fecha).toLocaleString(localeFechas) : '';
            const cuerpo = m.contenido ? esc(m.contenido).replace(/\n/g, '<br>') : (m.imagenes?.length ? '' : `<i>${t(cfg, '(sin texto)', '(no text)')}</i>`);
            const imagenes = m.imagenes?.length
                ? `<div class="images">${m.imagenes.map((url) => `<a href="${esc(url)}" target="_blank"><img src="${esc(url)}" loading="lazy"></a>`).join('')}</div>`
                : '';
            return `<div class="msg"><div class="meta"><span class="user">${esc(m.usuario)}</span><span class="time">${esc(fecha)}</span></div><div class="body">${cuerpo}</div>${imagenes}</div>`;
        }).join('\n')
        : `<p class="empty">${t(cfg, 'No se registraron mensajes.', 'No messages were recorded.')}</p>`;

    return `<!doctype html>
<html lang="${t(cfg, 'es', 'en')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t(cfg, 'Transcripción', 'Transcript')} · ${esc(ticket.titulo || ticket.creadorNombre)}</title>
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
  .images { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
  .images img { max-width: 220px; max-height: 220px; border-radius: 8px; border: 1px solid #232734; object-fit: cover; }
  .empty { color: #6b7280; font-style: italic; }
  footer { margin-top: 28px; color: #6b7280; font-size: 12px; text-align: center; }
</style></head>
<body><div class="wrap">
<header>
  <h1>🎫 ${esc(ticket.titulo || t(cfg, 'Ticket de soporte', 'Support ticket'))}</h1>
  <div class="sub">
    <div><b>${t(cfg, 'Usuario:', 'User:')}</b> ${esc(ticket.creadorNombre)}</div>
    <div><b>${t(cfg, 'Motivo:', 'Reason:')}</b> ${esc(ticket.motivo || '-')} &nbsp;·&nbsp; <b>${t(cfg, 'Prioridad:', 'Priority:')}</b> ${esc(nombreUrgencia(t(cfg, 'es', 'en'), ticket.prioridad) || '-')}</div>
    <div><b>${t(cfg, 'Cerrado:', 'Closed:')}</b> ${esc(new Date().toLocaleString(localeFechas))}</div>
  </div>
</header>
${filas}
<footer>${t(cfg, 'Transcripción generada el', 'Transcript generated on')} ${esc(new Date().toLocaleString(localeFechas))}</footer>
</div></body></html>`;
}

// Envoltura del HTML como adjunto de Discord (.html).
async function generarTranscriptHTML(canalId, ticket, cfg) {
    const html = await construirTranscriptHTML(canalId, ticket, cfg);
    return new AttachmentBuilder(Buffer.from(html, 'utf-8'), { name: `transcript-${ticket.creadorNombre}.html` });
}

// Transcript en PDF (función Pro, como el HTML). Descarga las imágenes
// adjuntas a memoria e incrústalas bajo cada mensaje. Devuelve un Buffer.
async function generarTranscriptPDF(canalId, ticket, cfg) {
    const historial = await Mensaje.find({ ticketId: canalId }).sort({ fecha: 1 });
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const trozos = [];
    doc.on('data', (c) => trozos.push(c));
    const listo = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(trozos))));
    const localeFechas = t(cfg, 'es-ES', 'en-US');

    doc.fontSize(18).fillColor('#111').text(`${t(cfg, 'Transcripción', 'Transcript')} · ${ticket.titulo || ticket.creadorNombre}`, { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor('#555')
        .text(`${t(cfg, 'Usuario:', 'User:')} ${ticket.creadorNombre}`)
        .text(`${t(cfg, 'Motivo:', 'Reason:')} ${ticket.motivo || '-'}    ${t(cfg, 'Prioridad:', 'Priority:')} ${nombreUrgencia(t(cfg, 'es', 'en'), ticket.prioridad) || '-'}`)
        .text(`${t(cfg, 'Cerrado:', 'Closed:')} ${new Date().toLocaleString(localeFechas)}`);
    doc.moveDown();

    const asegurarEspacio = (alto = 60) => {
        if (doc.y + alto > doc.page.height - doc.page.margins.bottom) doc.addPage();
    };

    if (!historial.length) {
        doc.fontSize(11).fillColor('#888').text(t(cfg, 'No se registraron mensajes.', 'No messages were recorded.'));
    }

    for (const m of historial) {
        asegurarEspacio(40);
        const fecha = m.fecha ? new Date(m.fecha).toLocaleString(localeFechas) : '';
        doc.fontSize(10).fillColor('#3355aa').text(m.usuario, { continued: true })
            .fillColor('#888').text(`   ${fecha}`);
        if (m.contenido) {
            doc.fontSize(11).fillColor('#111').text(m.contenido, { width: 500 });
        }
        if (m.imagenes?.length) {
            for (const url of m.imagenes) {
                const buffer = await descargarImagen(url);
                if (!buffer) continue; // URL caída/expirada: se omite en vez de romper el PDF
                try {
                    asegurarEspacio(180);
                    doc.image(buffer, { fit: [200, 200] });
                } catch { /* formato no soportado por pdfkit (ej. GIF animado): se omite */ }
            }
        }
        doc.moveDown(0.6);
    }

    doc.end();
    return listo;
}

// Permisos de un canal de ticket: oculto para @everyone y visible para el bot
// (si no, un bot sin Administrador pierde el acceso a su propio canal), el
// creador y los roles de staff/soporte configurados. Solo se conceden permisos
// que el bot tiene: Discord rechaza la creación del canal en caso contrario.
function permisosCanalTicket(guild, cfg, creadorId) {
    const F = PermissionsBitField.Flags;
    const yo = guild.members.me;
    const puede = (flags) => flags.filter((f) => !yo || yo.permissions.has(f));
    const basicos = [F.ViewChannel, F.SendMessages, F.ReadMessageHistory, F.AttachFiles, F.EmbedLinks];

    const overwrites = [{ id: guild.id, type: OverwriteType.Role, deny: [F.ViewChannel] }];
    if (yo) overwrites.push({ id: yo.id, type: OverwriteType.Member, allow: puede([...basicos, F.ManageChannels]) });
    if (creadorId && creadorId !== yo?.id) overwrites.push({ id: creadorId, type: OverwriteType.Member, allow: puede(basicos) });
    const roles = new Set([cfg && cfg.rolStaffId, cfg && cfg.rolSoporteId].filter((id) => id && guild.roles.cache.has(id)));
    for (const id of roles) overwrites.push({ id, type: OverwriteType.Role, allow: puede(basicos) });
    return overwrites;
}

// Una categoría de Discord admite como mucho 50 canales: si la de archivo está
// llena se usa (o se crea) "<nombre> 2", "<nombre> 3"…
async function categoriaArchivoLibre(guild, nombreCat, canalId) {
    for (let n = 1; n <= 20; n++) {
        const nombre = n === 1 ? nombreCat : `${nombreCat.slice(0, 95)} ${n}`;
        const cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === nombre);
        if (!cat) return guild.channels.create({ name: nombre, type: ChannelType.GuildCategory });
        if (cat.children.cache.has(canalId) || cat.children.cache.size < 50) return cat;
    }
    return null;
}

// Cambia el nombre sin esperar: Discord solo deja renombrar un canal 2 veces
// cada 10 minutos y discord.js esperaría en cola, bloqueando el cierre/reapertura.
function renombrarSinEsperar(canal, nombre) {
    if (canal.name === nombre) return;
    canal.setName(nombre.slice(0, 100)).catch(() => {});
}

// Mueve el canal a la categoría de archivados y lo deja en modo solo lectura.
async function archivarCanal(canal, ticket, categoriaNombre = CATEGORIA_ARCHIVO) {
    try {
        const guild = canal.guild;
        const nombreCat = categoriaNombre || CATEGORIA_ARCHIVO;
        const categoria = await categoriaArchivoLibre(guild, nombreCat, canal.id);
        if (categoria && canal.parentId !== categoria.id) {
            await canal.setParent(categoria.id, { lockPermissions: false }).catch(() => {});
        }
        // Con el tipo explícito funciona aunque el creador no esté en la caché.
        await canal.permissionOverwrites.edit(ticket.creadorId, { SendMessages: false }, { type: OverwriteType.Member }).catch(() => {});
        if (!canal.name.startsWith('closed-')) renombrarSinEsperar(canal, `closed-${ticket.creadorNombre}`);
    } catch (e) { console.error('Error archivando el canal:', e); }
}

// Crea un ticket (canal de Discord + documento + mensaje de bienvenida con los
// botones estándar). Reutilizable desde el flujo normal y desde otros sistemas
// (p. ej. los reportes). Devuelve { ok, ticket, canal } o { ok: false, error }.
async function crearTicket(client, { guildId, creador, motivo = 'Support', titulo = 'Support Ticket', descripcion = '', prioridad = 'Normal', darAccesoCreador = true, porPrivado = false } = {}) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return { ok: false, error: 'Server not found' };

    const cfg = await getConfig(guildId);
    const parentId = (cfg && cfg.categoriaTicketsId && guild.channels.cache.get(cfg.categoriaTicketsId)) ? cfg.categoriaTicketsId : null;
    const overwrites = permisosCanalTicket(guild, cfg, darAccesoCreador && creador ? creador.id : null);

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
        esperaRespuesta: !!(creador && creador.id), ultimoMensajeUsuario: new Date(),
        porPrivado: !!porPrivado,
    });

    await registrarLogTicket(client, ticket, '🎫 Ticket opened', '#2ecc71', (creador && creador.username) || 'System');

    // Webhook saliente (Pro): avisa de un ticket nuevo (útil para los urgentes).
    enviarWebhook(cfg, 'ticketNuevo', {
        text: `🎫 New ticket [${prioridad}]: "${titulo}" from ${(creador && creador.username) || 'System'} — ${motivo}`,
        data: { canalId: canal.id, titulo, motivo, prioridad, creadorId: (creador && creador.id) || null },
    }).catch(() => {});

    const embed = new EmbedBuilder()
        .setTitle(`🎫 ${titulo}`)
        .setColor('#3498db')
        .setDescription(`**${t(cfg, 'Motivo:', 'Reason:')}** ${motivo}${descripcion ? `\n\n${descripcion}` : ''}`)
        .addFields({ name: t(cfg, '🚨 Prioridad', '🚨 Priority'), value: `**${nombreUrgencia(t(cfg, 'es', 'en'), prioridad)}**`, inline: true });
    aplicarPieMarca(embed, cfg); // marca blanca
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('reclamar_ticket').setLabel(t(cfg, '🙋‍♂️ Reclamar ticket', '🙋‍♂️ Claim ticket')).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('add_user_prompt').setLabel(t(cfg, '➕ Añadir usuario', '➕ Add user')).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('close_ticket').setLabel(t(cfg, '🔒 Cerrar ticket', '🔒 Close ticket')).setStyle(ButtonStyle.Danger),
    );
    // Quien lo abre puede seguirlo también desde su cuenta en la web.
    if (darAccesoCreador && creador && creador.id) {
        row.addComponents(require('./cuenta.js').botonWeb(cfg, 'tickets', t(cfg, 'Seguir en la web', 'Follow on the web'), canal.id));
    }
    let saludo = (darAccesoCreador && creador && creador.id) ? t(cfg, `¡Hola <@${creador.id}>! Aquí tienes tu ticket. 👇`, `Hi <@${creador.id}>! Here’s your ticket. 👇`) : t(cfg, 'Nuevo ticket 👇', 'New ticket 👇');
    if (porPrivado) saludo += t(cfg, '\n✉️ Abierto por privado: lo que escribáis aquí le llega por privado, y lo que escriba al bot aparece aquí.', '\n✉️ Opened via DM: whatever you write here reaches them by DM, and what they write to the bot shows up here.');
    await canal.send({ content: saludo, embeds: [embed], components: [row] });

    return { ok: true, ticket, canal };
}

// Cierra un ticket: transcript + encuesta CSAT por DM + log + archivado del canal.
// Devuelve { ok, ticket } o { ok: false, error } (con yaCerrado si ya lo estaba:
// así dos cierres a la vez no mandan dos encuestas ni duplican el log).
async function cerrarTicket(client, canalId, { autor = 'Sistema', avisarCanal = false } = {}) {
    const ticket = await Ticket.findOneAndUpdate(
        { canalId, estado: { $ne: 'Cerrado' } },
        { estado: 'Cerrado', fechaCierre: new Date() },
        { returnDocument: 'after' }
    );
    if (!ticket) {
        if (await Ticket.exists({ canalId })) return { ok: false, yaCerrado: true, error: 'Ticket already closed' };
        return { ok: false, error: 'Ticket not found' };
    }

    // Ajustes configurables (por defecto = comportamiento de siempre).
    const cfg = await getConfig(ticket.guildId);
    const ratingActivo = !(cfg && cfg.ratingActivo === false);
    const enviarTranscript = !(cfg && cfg.enviarTranscript === false);
    const avisoCierreCanal = !(cfg && cfg.avisoCierreCanal === false);

    // DM al creador con transcript y/o encuesta de satisfacción, según configuración.
    if (ratingActivo || enviarTranscript) {
        try {
            const files = [];
            let descripcion = t(cfg, `Hola **${ticket.creadorNombre}**, tu ticket de soporte ha sido cerrado.`, `Hi **${ticket.creadorNombre}**, your support ticket has been closed.`);
            if (enviarTranscript) {
                // Pro: transcript en HTML con estilo. Free: texto plano.
                files.push(esPro(cfg) ? await generarTranscriptHTML(canalId, ticket, cfg) : await generarTranscript(canalId, ticket, cfg));
                descripcion += t(cfg, ' Se adjunta una copia de la conversación.', ' Attached is a copy of the conversation.');
            }
            if (ratingActivo) {
                descripcion += t(cfg, '\n\nPor favor, **valora el soporte recibido** pulsando las estrellas de abajo. ¡Nos ayuda a mejorar!', '\n\nPlease **rate the support you received** by clicking the stars below. It helps us improve!');
            }
            const embedCSAT = new EmbedBuilder()
                .setColor('#f1c40f')
                .setTitle(t(cfg, '📊 ¡Tu ticket ha sido cerrado!', '📊 Your ticket has been closed!'))
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

    await registrarLogTicket(client, ticket, '🔒 Ticket closed', '#e74c3c', autor);

    const canal = client.channels.cache.get(canalId);
    if (canal) {
        if (avisarCanal && avisoCierreCanal) {
            await canal.send(t(cfg, '🔒 **Este ticket ha sido cerrado.** Queda archivado en modo solo lectura.', '🔒 **This ticket has been closed.** It’s archived in read-only mode.')).catch(() => {});
        }
        await archivarCanal(canal, ticket, cfg && cfg.categoriaArchivados);
    }
    return { ok: true, ticket };
}

// Reabre un ticket archivado: restaura permisos y lo devuelve a la categoría de
// tickets (o lo saca de la de archivo si no hay ninguna configurada).
async function reabrirTicket(client, canalId, { autor = 'Sistema' } = {}) {
    const ticket = await Ticket.findOneAndUpdate(
        { canalId, estado: 'Cerrado' },
        { estado: 'Abierto', fechaCierre: null },
        { returnDocument: 'after' }
    );
    if (!ticket) {
        if (await Ticket.exists({ canalId })) return { ok: false, yaAbierto: true, error: 'Ticket is not closed' };
        return { ok: false, error: 'Ticket not found' };
    }

    const cfg = await getConfig(ticket.guildId);
    const canal = client.channels.cache.get(canalId);
    if (canal) {
        await canal.permissionOverwrites.edit(ticket.creadorId, { ViewChannel: true, SendMessages: true }, { type: OverwriteType.Member }).catch(() => {});
        const destino = cfg && cfg.categoriaTicketsId && canal.guild.channels.cache.get(cfg.categoriaTicketsId);
        // Si la categoría de tickets está llena (50 canales), al menos sale del archivo.
        await canal.setParent(destino ? destino.id : null, { lockPermissions: false })
            .catch(() => canal.setParent(null, { lockPermissions: false }).catch(() => {}));
        renombrarSinEsperar(canal, `ticket-${ticket.creadorNombre}`);
        await canal.send(t(cfg, '🔓 **Este ticket ha sido reabierto.** Puedes volver a escribir.', '🔓 **This ticket has been reopened.** You can write again.')).catch(() => {});
    }
    await registrarLogTicket(client, ticket, '🔓 Ticket reopened', '#2ecc71', autor);
    return { ok: true, ticket };
}

module.exports = { crearTicket, cerrarTicket, reabrirTicket, permisosCanalTicket, generarTranscript, construirTranscriptHTML, generarTranscriptHTML, generarTranscriptPDF, registrarLogTicket };

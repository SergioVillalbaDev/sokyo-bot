// ============================================================================
// reportes — Sistema de reportes de usuarios. Un miembro reporta a otro (o a un
// mensaje) y el reporte llega a un canal de staff con botones de gestión, además
// de quedar registrado para el panel web.
// ============================================================================
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const Reporte = require('../models/Reporte.js');
const { miembroPuedeModerar } = require('./permisos.js');
const { crearTicket } = require('./ticketManager.js');
const { t } = require('./i18n.js');

// Crea un reporte y lo publica en el canal de staff. Devuelve el documento.
async function crearReporte(client, { guildId, reportante, reportado, canalId, mensaje, motivo }) {
    const cfg = await ServidorConfig.findOne({ guildId });
    if (!cfg || !cfg.reportes || !cfg.reportes.activo) throw new Error('The report system is not active.');

    const doc = await Reporte.create({
        guildId,
        reportanteId: reportante.id,
        reportanteTag: reportante.username,
        reportadoId: reportado ? reportado.id : null,
        reportadoTag: reportado ? reportado.username : '',
        reportadoAvatar: reportado && reportado.displayAvatarURL ? reportado.displayAvatarURL({ size: 64 }) : null,
        canalId: canalId || null,
        mensajeId: mensaje ? mensaje.id : null,
        mensajeContenido: mensaje && mensaje.content ? mensaje.content.slice(0, 1000) : '',
        motivo: (motivo || '').slice(0, 1000),
    });

    await publicarEnStaff(client, cfg, doc).catch((e) => console.error('Reporte (publicar):', e.message));
    return doc;
}

async function publicarEnStaff(client, cfg, doc) {
    const canalId = cfg.reportes.canalId;
    if (!canalId) return;
    const guild = client.guilds.cache.get(doc.guildId);
    const canal = guild && guild.channels.cache.get(canalId);
    if (!canal) return;

    const embed = new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle(t(cfg, '🚩 Nuevo reporte', '🚩 New report'))
        .setThumbnail(doc.reportadoAvatar || null)
        .addFields(
            { name: t(cfg, 'Reportado', 'Reported'), value: doc.reportadoId ? `<@${doc.reportadoId}> (\`${doc.reportadoId}\`)` : '—', inline: true },
            { name: t(cfg, 'Reportado por', 'Reported by'), value: `<@${doc.reportanteId}>`, inline: true },
            ...(doc.canalId ? [{ name: t(cfg, 'Canal', 'Channel'), value: `<#${doc.canalId}>`, inline: true }] : []),
            { name: t(cfg, 'Motivo', 'Reason'), value: doc.motivo || t(cfg, '_Sin motivo_', '_No reason_') },
            ...(doc.mensajeContenido ? [{ name: t(cfg, 'Mensaje reportado', 'Reported message'), value: doc.mensajeContenido.slice(0, 1000) }] : []),
        )
        .setFooter({ text: `ID: ${doc._id}` })
        .setTimestamp(doc.fecha);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rep_resolver:${doc._id}`).setLabel(t(cfg, '✅ Resolver', '✅ Resolve')).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`rep_ticket:${doc._id}`).setLabel(t(cfg, '🎫 Abrir ticket', '🎫 Open ticket')).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`rep_descartar:${doc._id}`).setLabel(t(cfg, '🗑️ Descartar', '🗑️ Dismiss')).setStyle(ButtonStyle.Secondary),
    );
    await canal.send({ embeds: [embed], components: [row] });
}

// Abre un ticket a raíz de un reporte. Marca el reporte como resuelto y lo enlaza.
// Devuelve { canalId, reporte } o lanza error.
async function abrirTicketDesdeReporte(client, reporteId, autorTag) {
    const doc = await Reporte.findById(reporteId);
    if (!doc) throw new Error('Report not found');
    if (doc.canalTicketId) return { canalId: doc.canalTicketId, reporte: doc, yaExistia: true };

    const { getConfigCached } = require('./config.js');
    const cfg = await getConfigCached(doc.guildId);

    const reportado = doc.reportadoId ? await client.users.fetch(doc.reportadoId).catch(() => null) : null;
    const creador = reportado
        ? { id: reportado.id, username: reportado.username, avatar: reportado.displayAvatarURL ? reportado.displayAvatarURL({ size: 128 }) : null }
        : null;

    // El contexto del reporte va en la descripción (sin revelar quién reportó).
    let descripcion = t(cfg, 'Ticket abierto a partir de un reporte.', 'Ticket opened from a report.');
    if (doc.motivo) descripcion += t(cfg, `\n**Motivo del reporte:** ${doc.motivo}`, `\n**Report reason:** ${doc.motivo}`);
    if (doc.mensajeContenido) descripcion += t(cfg, `\n**Mensaje reportado:** ${doc.mensajeContenido}`, `\n**Reported message:** ${doc.mensajeContenido}`);

    const res = await crearTicket(client, {
        guildId: doc.guildId,
        creador,
        motivo: t(cfg, 'Reporte de usuario', 'User report'),
        titulo: t(cfg, `Reporte: ${doc.reportadoTag || 'usuario'}`, `Report: ${doc.reportadoTag || 'user'}`),
        descripcion,
        prioridad: 'High',
    });
    if (!res.ok) throw new Error(res.error || 'Could not create the ticket');

    doc.canalTicketId = res.canal.id;
    doc.estado = 'resuelto';
    doc.resueltoPor = autorTag || 'System';
    doc.resueltoFecha = new Date();
    await doc.save();
    return { canalId: res.canal.id, reporte: doc };
}

// Botones resolver / descartar / abrir ticket (solo staff).
async function manejarBoton(interaction, client) {
    const [accion, id] = interaction.customId.split(':');
    const cfg = await ServidorConfig.findOne({ guildId: interaction.guildId });
    if (!miembroPuedeModerar(interaction.member, cfg, PermissionsBitField.Flags.ModerateMembers)) {
        return interaction.reply({ content: t(cfg, '❌ Solo el staff puede gestionar reportes.', '❌ Only staff can manage reports.'), ephemeral: true });
    }
    const doc = await Reporte.findById(id).catch(() => null);
    if (!doc) return interaction.reply({ content: t(cfg, '❌ Reporte no encontrado.', '❌ Report not found.'), ephemeral: true });
    if (doc.estado !== 'pendiente') return interaction.reply({ content: t(cfg, 'ℹ️ Este reporte ya ha sido gestionado.', 'ℹ️ This report has already been handled.'), ephemeral: true });

    const original = interaction.message.embeds[0];

    // Abrir ticket: crea el canal y enlaza el reporte.
    if (accion === 'rep_ticket') {
        await interaction.deferReply({ ephemeral: true });
        try {
            const r = await abrirTicketDesdeReporte(client, id, interaction.user.username);
            const editado = EmbedBuilder.from(original)
                .setColor(0x3498db)
                .addFields({ name: t(cfg, '🎫 Ticket abierto', '🎫 Ticket opened'), value: `<#${r.canalId}> · ${t(cfg, 'por', 'by')} ${interaction.user.username}` });
            await interaction.message.edit({ embeds: [editado], components: [] }).catch(() => {});
            return interaction.editReply({ content: t(cfg, `✅ Ticket abierto: <#${r.canalId}>`, `✅ Ticket opened: <#${r.canalId}>`) });
        } catch (e) {
            return interaction.editReply({ content: `❌ ${e.message}` });
        }
    }

    // Resolver / descartar.
    doc.estado = accion === 'rep_resolver' ? 'resuelto' : 'descartado';
    doc.resueltoPor = interaction.user.username;
    doc.resueltoFecha = new Date();
    await doc.save();

    const editado = EmbedBuilder.from(original)
        .setColor(doc.estado === 'resuelto' ? 0x2ecc71 : 0x95a5a6)
        .addFields({ name: doc.estado === 'resuelto' ? t(cfg, '✅ Resuelto por', '✅ Resolved by') : t(cfg, '🗑️ Descartado por', '🗑️ Dismissed by'), value: interaction.user.username });
    await interaction.update({ embeds: [editado], components: [] });
}

module.exports = { crearReporte, manejarBoton, abrirTicketDesdeReporte };

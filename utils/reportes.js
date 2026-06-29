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
        .setTitle('🚩 New report')
        .setThumbnail(doc.reportadoAvatar || null)
        .addFields(
            { name: 'Reported', value: doc.reportadoId ? `<@${doc.reportadoId}> (\`${doc.reportadoId}\`)` : '—', inline: true },
            { name: 'Reported by', value: `<@${doc.reportanteId}>`, inline: true },
            ...(doc.canalId ? [{ name: 'Channel', value: `<#${doc.canalId}>`, inline: true }] : []),
            { name: 'Reason', value: doc.motivo || '_No reason_' },
            ...(doc.mensajeContenido ? [{ name: 'Reported message', value: doc.mensajeContenido.slice(0, 1000) }] : []),
        )
        .setFooter({ text: `ID: ${doc._id}` })
        .setTimestamp(doc.fecha);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rep_resolver:${doc._id}`).setLabel('✅ Resolve').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`rep_ticket:${doc._id}`).setLabel('🎫 Open ticket').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`rep_descartar:${doc._id}`).setLabel('🗑️ Dismiss').setStyle(ButtonStyle.Secondary),
    );
    await canal.send({ embeds: [embed], components: [row] });
}

// Abre un ticket a raíz de un reporte. Marca el reporte como resuelto y lo enlaza.
// Devuelve { canalId, reporte } o lanza error.
async function abrirTicketDesdeReporte(client, reporteId, autorTag) {
    const doc = await Reporte.findById(reporteId);
    if (!doc) throw new Error('Report not found');
    if (doc.canalTicketId) return { canalId: doc.canalTicketId, reporte: doc, yaExistia: true };

    const reportado = doc.reportadoId ? await client.users.fetch(doc.reportadoId).catch(() => null) : null;
    const creador = reportado
        ? { id: reportado.id, username: reportado.username, avatar: reportado.displayAvatarURL ? reportado.displayAvatarURL({ size: 128 }) : null }
        : null;

    // El contexto del reporte va en la descripción (sin revelar quién reportó).
    let descripcion = 'Ticket opened from a report.';
    if (doc.motivo) descripcion += `\n**Report reason:** ${doc.motivo}`;
    if (doc.mensajeContenido) descripcion += `\n**Reported message:** ${doc.mensajeContenido}`;

    const res = await crearTicket(client, {
        guildId: doc.guildId,
        creador,
        motivo: 'User report',
        titulo: `Report: ${doc.reportadoTag || 'user'}`,
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
        return interaction.reply({ content: '❌ Only staff can manage reports.', ephemeral: true });
    }
    const doc = await Reporte.findById(id).catch(() => null);
    if (!doc) return interaction.reply({ content: '❌ Report not found.', ephemeral: true });
    if (doc.estado !== 'pendiente') return interaction.reply({ content: 'ℹ️ This report has already been handled.', ephemeral: true });

    const original = interaction.message.embeds[0];

    // Abrir ticket: crea el canal y enlaza el reporte.
    if (accion === 'rep_ticket') {
        await interaction.deferReply({ ephemeral: true });
        try {
            const r = await abrirTicketDesdeReporte(client, id, interaction.user.username);
            const editado = EmbedBuilder.from(original)
                .setColor(0x3498db)
                .addFields({ name: '🎫 Ticket opened', value: `<#${r.canalId}> · by ${interaction.user.username}` });
            await interaction.message.edit({ embeds: [editado], components: [] }).catch(() => {});
            return interaction.editReply({ content: `✅ Ticket opened: <#${r.canalId}>` });
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
        .addFields({ name: doc.estado === 'resuelto' ? '✅ Resolved by' : '🗑️ Dismissed by', value: interaction.user.username });
    await interaction.update({ embeds: [editado], components: [] });
}

module.exports = { crearReporte, manejarBoton, abrirTicketDesdeReporte };

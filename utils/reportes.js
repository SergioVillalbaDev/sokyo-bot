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
    if (!cfg || !cfg.reportes || !cfg.reportes.activo) throw new Error('El sistema de reportes no está activo.');

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
        .setTitle('🚩 Nuevo reporte')
        .setThumbnail(doc.reportadoAvatar || null)
        .addFields(
            { name: 'Reportado', value: doc.reportadoId ? `<@${doc.reportadoId}> (\`${doc.reportadoId}\`)` : '—', inline: true },
            { name: 'Reporta', value: `<@${doc.reportanteId}>`, inline: true },
            ...(doc.canalId ? [{ name: 'Canal', value: `<#${doc.canalId}>`, inline: true }] : []),
            { name: 'Motivo', value: doc.motivo || '_Sin motivo_' },
            ...(doc.mensajeContenido ? [{ name: 'Mensaje reportado', value: doc.mensajeContenido.slice(0, 1000) }] : []),
        )
        .setFooter({ text: `ID: ${doc._id}` })
        .setTimestamp(doc.fecha);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rep_resolver:${doc._id}`).setLabel('✅ Resolver').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`rep_ticket:${doc._id}`).setLabel('🎫 Abrir ticket').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`rep_descartar:${doc._id}`).setLabel('🗑️ Descartar').setStyle(ButtonStyle.Secondary),
    );
    await canal.send({ embeds: [embed], components: [row] });
}

// Abre un ticket a raíz de un reporte. Marca el reporte como resuelto y lo enlaza.
// Devuelve { canalId, reporte } o lanza error.
async function abrirTicketDesdeReporte(client, reporteId, autorTag) {
    const doc = await Reporte.findById(reporteId);
    if (!doc) throw new Error('Reporte no encontrado');
    if (doc.canalTicketId) return { canalId: doc.canalTicketId, reporte: doc, yaExistia: true };

    const reportado = doc.reportadoId ? await client.users.fetch(doc.reportadoId).catch(() => null) : null;
    const creador = reportado
        ? { id: reportado.id, username: reportado.username, avatar: reportado.displayAvatarURL ? reportado.displayAvatarURL({ size: 128 }) : null }
        : null;

    // El contexto del reporte va en la descripción (sin revelar quién reportó).
    let descripcion = 'Ticket abierto a raíz de un reporte.';
    if (doc.motivo) descripcion += `\n**Motivo del reporte:** ${doc.motivo}`;
    if (doc.mensajeContenido) descripcion += `\n**Mensaje reportado:** ${doc.mensajeContenido}`;

    const res = await crearTicket(client, {
        guildId: doc.guildId,
        creador,
        motivo: 'Reporte de usuario',
        titulo: `Reporte: ${doc.reportadoTag || 'usuario'}`,
        descripcion,
        prioridad: 'Alta',
    });
    if (!res.ok) throw new Error(res.error || 'No se pudo crear el ticket');

    doc.canalTicketId = res.canal.id;
    doc.estado = 'resuelto';
    doc.resueltoPor = autorTag || 'Sistema';
    doc.resueltoFecha = new Date();
    await doc.save();
    return { canalId: res.canal.id, reporte: doc };
}

// Botones resolver / descartar / abrir ticket (solo staff).
async function manejarBoton(interaction, client) {
    const [accion, id] = interaction.customId.split(':');
    const cfg = await ServidorConfig.findOne({ guildId: interaction.guildId });
    if (!miembroPuedeModerar(interaction.member, cfg, PermissionsBitField.Flags.ModerateMembers)) {
        return interaction.reply({ content: '❌ Solo el staff puede gestionar reportes.', ephemeral: true });
    }
    const doc = await Reporte.findById(id).catch(() => null);
    if (!doc) return interaction.reply({ content: '❌ Reporte no encontrado.', ephemeral: true });
    if (doc.estado !== 'pendiente') return interaction.reply({ content: 'ℹ️ Este reporte ya fue gestionado.', ephemeral: true });

    const original = interaction.message.embeds[0];

    // Abrir ticket: crea el canal y enlaza el reporte.
    if (accion === 'rep_ticket') {
        await interaction.deferReply({ ephemeral: true });
        try {
            const r = await abrirTicketDesdeReporte(client, id, interaction.user.username);
            const editado = EmbedBuilder.from(original)
                .setColor(0x3498db)
                .addFields({ name: '🎫 Ticket abierto', value: `<#${r.canalId}> · por ${interaction.user.username}` });
            await interaction.message.edit({ embeds: [editado], components: [] }).catch(() => {});
            return interaction.editReply({ content: `✅ Ticket abierto: <#${r.canalId}>` });
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
        .addFields({ name: doc.estado === 'resuelto' ? '✅ Resuelto por' : '🗑️ Descartado por', value: interaction.user.username });
    await interaction.update({ embeds: [editado], components: [] });
}

module.exports = { crearReporte, manejarBoton, abrirTicketDesdeReporte };

const { SlashCommandBuilder, InteractionContextType, MessageFlags, EmbedBuilder } = require('discord.js');
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js');
const { cerrarTicket, registrarLogTicket } = require('../utils/ticketManager.js');
const { obtenerConfig, buscarMotivo } = require('../utils/config.js');
const { puedeAtender } = require('../utils/permisos.js');
const ia = require('../utils/ia.js');

const EFIMERO = { flags: MessageFlags.Ephemeral };
const COLORES_SENTIMIENTO = { tranquilo: '#2ecc71', preocupado: '#f1c40f', enfadado: '#e74c3c' };

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Acciones sobre el ticket de este canal')
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(s => s.setName('agregar').setDescription('Añade a alguien a este ticket')
            .addUserOption(o => o.setName('usuario').setDescription('Usuario a añadir').setRequired(true)))
        .addSubcommand(s => s.setName('quitar').setDescription('Quita a alguien de este ticket')
            .addUserOption(o => o.setName('usuario').setDescription('Usuario a quitar').setRequired(true)))
        .addSubcommand(s => s.setName('renombrar').setDescription('Cambia el nombre del canal del ticket')
            .addStringOption(o => o.setName('nombre').setDescription('Nuevo nombre').setRequired(true).setMaxLength(90)))
        .addSubcommand(s => s.setName('cerrar').setDescription('Cierra y archiva este ticket'))
        .addSubcommand(s => s.setName('resumen').setDescription('🤖 Resumen del ticket con IA (solo lo ves tú)')),

    async execute(interaction, client) {
        const ticket = await Ticket.findOne({ canalId: interaction.channelId });
        if (!ticket) return interaction.reply({ content: '❌ Este comando solo funciona dentro de un canal de ticket.', ...EFIMERO });

        const sub = interaction.options.getSubcommand();
        const config = await obtenerConfig(interaction.guildId);
        const esStaff = puedeAtender(interaction.member, config, buscarMotivo(config, ticket.motivoId || ticket.motivo));
        const esCreador = ticket.creadorId === interaction.user.id;

        if (sub === 'cerrar') {
            if (!esStaff && !esCreador) return interaction.reply({ content: '❌ Solo quien abrió el ticket o el equipo de soporte pueden cerrarlo.', ...EFIMERO });
            if (ticket.estado === 'Cerrado') return interaction.reply({ content: 'ℹ️ Este ticket ya está cerrado.', ...EFIMERO });
            await interaction.reply({ content: '🔒 Cerrando el ticket...', ...EFIMERO });
            const res = await cerrarTicket(client, interaction.channelId, { autor: interaction.user.username });
            return interaction.editReply(res.ok ? '✅ Ticket cerrado y archivado.' : '❌ No se pudo cerrar el ticket.');
        }

        if (!esStaff) return interaction.reply({ content: '❌ Solo el equipo de soporte puede usar este comando.', ...EFIMERO });

        if (sub === 'agregar') {
            const usuario = interaction.options.getUser('usuario');
            await interaction.channel.permissionOverwrites.edit(usuario.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true });
            if (!ticket.participantes.some(p => p.id === usuario.id)) {
                ticket.participantes.push({ id: usuario.id, username: usuario.username, avatar: usuario.displayAvatarURL({ extension: 'png', size: 128 }), rol: 'Invitado' });
                await ticket.save();
            }
            return interaction.reply({ content: `👋 ${usuario} ha sido añadido al ticket por ${interaction.user}.` });
        }

        if (sub === 'quitar') {
            const usuario = interaction.options.getUser('usuario');
            if (usuario.id === ticket.creadorId) return interaction.reply({ content: '❌ No puedes quitar a quien abrió el ticket.', ...EFIMERO });
            await interaction.channel.permissionOverwrites.delete(usuario.id).catch(() => {});
            ticket.participantes = ticket.participantes.filter(p => p.id !== usuario.id);
            await ticket.save();
            return interaction.reply({ content: `🚪 ${usuario} ya no tiene acceso a este ticket.` });
        }

        if (sub === 'renombrar') {
            await interaction.deferReply(EFIMERO);
            const nombre = interaction.options.getString('nombre');
            await interaction.channel.setName(nombre);
            await registrarLogTicket(client, ticket, `✏️ Ticket renombrado a ${nombre}`, '#95a5a6', interaction.user.username);
            return interaction.editReply('✅ Canal renombrado.');
        }

        if (sub === 'resumen') {
            await interaction.deferReply(EFIMERO);
            try {
                await ia.prepararIA(config);
                const mensajes = await Mensaje.find({ ticketId: ticket.canalId }).sort({ fecha: 1 }).lean();
                const r = await ia.resumirTicket({ ticket, mensajes });
                const embed = new EmbedBuilder()
                    .setColor(COLORES_SENTIMIENTO[r.sentimiento] || '#9b59b6')
                    .setTitle(`🤖 Resumen del ticket${ticket.numero ? ` #${ticket.numero}` : ''}`)
                    .setDescription(r.resumen)
                    .addFields(
                        { name: '📍 Estado', value: r.estado || '—' },
                        { name: '👉 Siguiente paso', value: r.siguiente_paso || '—' },
                        { name: '🌐 Idioma', value: r.idioma || '—', inline: true },
                        { name: '🙂 Ánimo del usuario', value: r.sentimiento || '—', inline: true }
                    );
                return interaction.editReply({ embeds: [embed] });
            } catch (e) {
                if (e instanceof ia.IAError) return interaction.editReply(`⚠️ ${e.message}`);
                throw e;
            }
        }
    }
};

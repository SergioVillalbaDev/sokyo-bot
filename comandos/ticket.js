const { SlashCommandBuilder, InteractionContextType, MessageFlags } = require('discord.js');
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js');
const { obtenerConfig } = require('../utils/config.js');
const { esStaff } = require('../utils/permisos.js');
const { adjuntoHtml } = require('../utils/transcript.js');
const {
    TicketError, etiquetaTicket, datosUsuario, cerrarTicket, reabrirTicket, asignarTicket,
    añadirParticipante, quitarParticipante, cambiarPrioridad
} = require('../utils/ticketManager.js');

const EFIMERO = { flags: MessageFlags.Ephemeral };

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Gestiona el ticket de este canal')
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(sub => sub.setName('cerrar').setDescription('Cierra este ticket')
            .addStringOption(o => o.setName('motivo').setDescription('Motivo del cierre (opcional)').setMaxLength(500)))
        .addSubcommand(sub => sub.setName('reabrir').setDescription('Reabre este ticket'))
        .addSubcommand(sub => sub.setName('reclamar').setDescription('Te asigna este ticket'))
        .addSubcommand(sub => sub.setName('liberar').setDescription('Deja este ticket sin asignar'))
        .addSubcommand(sub => sub.setName('agregar').setDescription('Añade a alguien a este ticket')
            .addUserOption(o => o.setName('usuario').setDescription('Usuario a añadir').setRequired(true)))
        .addSubcommand(sub => sub.setName('quitar').setDescription('Quita a alguien de este ticket')
            .addUserOption(o => o.setName('usuario').setDescription('Usuario a quitar').setRequired(true)))
        .addSubcommand(sub => sub.setName('prioridad').setDescription('Cambia la prioridad de este ticket')
            .addStringOption(o => o.setName('nivel').setDescription('Nueva prioridad').setRequired(true).setAutocomplete(true)))
        .addSubcommand(sub => sub.setName('transcript').setDescription('Descarga la conversación completa en HTML')),

    async autocomplete(interaction) {
        const config = await obtenerConfig(interaction.guildId);
        const texto = interaction.options.getFocused().toLowerCase();
        const opciones = [...(config.urgencias || [])]
            .sort((a, b) => b.nivel - a.nivel)
            .filter(u => u.nombre.toLowerCase().includes(texto))
            .slice(0, 25)
            .map(u => ({ name: u.nombre, value: u.nombre }));
        await interaction.respond(opciones);
    },

    async execute(interaction, client) {
        const ticket = await Ticket.findOne({ canalId: interaction.channelId });
        if (!ticket) throw new TicketError('Este comando solo funciona dentro de un canal de ticket.', 404);

        const config = await obtenerConfig(interaction.guildId);
        const staff = esStaff(interaction.member, config);
        const esCreador = interaction.user.id === ticket.creadorId;
        const autor = { autor: interaction.user.username, autorId: interaction.user.id };
        const soloStaff = (accion) => { if (!staff) throw new TicketError(`Solo el equipo de soporte puede ${accion}.`, 403); };

        const sub = interaction.options.getSubcommand();
        switch (sub) {
            case 'cerrar': {
                if (!staff && !esCreador) throw new TicketError('Solo quien abrió el ticket o el equipo de soporte pueden cerrarlo.', 403);
                await interaction.deferReply(EFIMERO);
                await cerrarTicket(client, ticket.canalId, { ...autor, motivo: interaction.options.getString('motivo') });
                return interaction.editReply('✅ Ticket cerrado y archivado.');
            }
            case 'reabrir': {
                soloStaff('reabrir tickets');
                await interaction.deferReply(EFIMERO);
                await reabrirTicket(client, ticket.canalId, autor);
                return interaction.editReply('✅ Ticket reabierto.');
            }
            case 'reclamar': {
                soloStaff('reclamar tickets');
                await interaction.deferReply(EFIMERO);
                await asignarTicket(client, ticket.canalId, { staff: datosUsuario(interaction.user), ...autor, soloSiLibre: true });
                return interaction.editReply('✅ Ahora este ticket es tuyo.');
            }
            case 'liberar': {
                soloStaff('liberar tickets');
                await interaction.deferReply(EFIMERO);
                await asignarTicket(client, ticket.canalId, { staff: null, ...autor });
                return interaction.editReply('✅ El ticket vuelve a estar sin asignar.');
            }
            case 'agregar': {
                soloStaff('añadir personas al ticket');
                const usuario = interaction.options.getUser('usuario');
                if (usuario.bot) throw new TicketError('Los bots no se pueden añadir a un ticket.', 400);
                await interaction.deferReply(EFIMERO);
                await añadirParticipante(client, interaction.channel, datosUsuario(usuario), autor);
                return interaction.editReply(`✅ ${usuario.username} añadido al ticket.`);
            }
            case 'quitar': {
                soloStaff('quitar personas del ticket');
                const usuario = interaction.options.getUser('usuario');
                await interaction.deferReply(EFIMERO);
                await quitarParticipante(client, interaction.channel, usuario.id, autor);
                return interaction.editReply(`✅ ${usuario.username} ya no participa en el ticket.`);
            }
            case 'prioridad': {
                soloStaff('cambiar la prioridad');
                await interaction.deferReply(EFIMERO);
                const nivel = interaction.options.getString('nivel');
                await cambiarPrioridad(client, ticket.canalId, nivel, autor);
                return interaction.editReply(`✅ Prioridad cambiada a **${nivel}**.`);
            }
            case 'transcript': {
                if (!staff && !esCreador) throw new TicketError('No puedes descargar este transcript.', 403);
                await interaction.deferReply(EFIMERO);
                const mensajes = await Mensaje.find({ ticketId: ticket.canalId }).sort({ fecha: 1 });
                return interaction.editReply({
                    content: `📄 Transcript del ticket ${etiquetaTicket(ticket)} (${mensajes.length} mensajes). Ábrelo con tu navegador.`,
                    files: [adjuntoHtml(ticket, mensajes, { nombreServidor: interaction.guild.name })]
                });
            }
        }
    }
};

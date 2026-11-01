// /ticket reclamar | soltar | cerrar | nota  — equivalentes a los botones del canal y a las acciones del panel.
const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const Ticket = require('../models/Ticket.js');
const { cerrarTicket, reclamarTicket, soltarTicket } = require('../utils/ticketManager.js');
const { exigir, permisosDe, EPH } = require('../utils/accesos.js');
const { emitir } = require('../utils/eventos.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Gestiona el ticket de este canal')
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(s => s.setName('reclamar').setDescription('Hazte cargo de este ticket'))
        .addSubcommand(s => s.setName('soltar').setDescription('Libera este ticket para que lo reclame otra persona'))
        .addSubcommand(s => s.setName('cerrar').setDescription('Cierra y archiva este ticket'))
        .addSubcommand(s => s.setName('nota').setDescription('Añade una nota interna (solo visible para el staff)')
            .addStringOption(o => o.setName('texto').setDescription('Contenido de la nota').setRequired(true).setMaxLength(1000))),

    async execute(interaction, client) {
        const ticket = await Ticket.findOne({ canalId: interaction.channelId });
        if (!ticket) return interaction.reply({ content: '❌ Este canal no es un ticket.', flags: EPH });
        const sub = interaction.options.getSubcommand();
        const yo = { id: interaction.user.id, username: interaction.user.username, avatar: interaction.user.displayAvatarURL({ extension: 'png', size: 128 }) };

        if (sub === 'reclamar') {
            if (!(await exigir(interaction, 'tickets.reclamar'))) return;
            const r = await reclamarTicket(client, ticket.canalId, yo);
            if (!r.ok) return interaction.reply({ content: `⚠️ ${r.error}`, flags: EPH });
            return interaction.reply(`📢 El agente de soporte **${yo.username}** se ha hecho cargo de este ticket.`);
        }

        if (sub === 'soltar') {
            const calculo = await exigir(interaction, 'tickets.reclamar');
            if (!calculo) return;
            if (ticket.asignadoA !== yo.id && !calculo.permisos.has('tickets.reasignar')) {
                return interaction.reply({ content: '🔒 Solo quien atiende el ticket (o alguien con permiso de reasignar) puede soltarlo.', flags: EPH });
            }
            await interaction.deferReply({ flags: EPH });
            const r = await soltarTicket(client, ticket.canalId, { autor: yo.username });
            return interaction.editReply(r.ok ? '🆓 Ticket liberado.' : `⚠️ ${r.error}`);
        }

        if (sub === 'cerrar') {
            const calculo = await permisosDe(interaction.member);
            if (ticket.creadorId !== yo.id && !calculo.permisos.has('tickets.cerrar')) {
                return interaction.reply({ content: '🔒 Solo el creador del ticket o el staff con permiso de cerrar pueden hacerlo.', flags: EPH });
            }
            await interaction.reply({ content: '🔒 Cerrando ticket...', flags: EPH });
            const r = await cerrarTicket(client, ticket.canalId, { autor: yo.username });
            return interaction.editReply(r.ok ? '✅ Ticket cerrado y archivado.' : `❌ ${r.error}`);
        }

        if (sub === 'nota') {
            if (!(await exigir(interaction, 'tickets.notas'))) return;
            await Ticket.updateOne({ canalId: ticket.canalId }, { $push: { notasInternas: { contenido: interaction.options.getString('texto'), autor: yo.username, fecha: new Date() } } });
            emitir(ticket.guildId, 'ticket:actualizado', { canalId: ticket.canalId });
            return interaction.reply({ content: '🕵️ Nota interna guardada (solo la ve el staff en el panel).', flags: EPH });
        }
    }
};

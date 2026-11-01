// /macro <nombre> — envía una respuesta rápida al ticket actual (con autocompletado).
const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const Macro = require('../models/Macro.js');
const Ticket = require('../models/Ticket.js');
const { exigir, EPH } = require('../utils/accesos.js');
const { renderPlantilla, escaparRegex } = require('../utils/helpers.js');
const { registrarActividad } = require('../utils/ticketManager.js');
const Mensaje = require('../models/Mensaje.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('macro')
        .setDescription('Envía una respuesta rápida en este ticket')
        .setContexts(InteractionContextType.Guild)
        .addStringOption(o => o.setName('nombre').setDescription('Respuesta rápida').setRequired(true).setAutocomplete(true)),

    async autocomplete(interaction) {
        const q = interaction.options.getFocused().toLowerCase();
        const macros = await Macro.find({ guildId: interaction.guildId, nombre: new RegExp('^' + escaparRegex(q)) }).sort({ usos: -1 }).limit(25);
        await interaction.respond(macros.map(m => ({ name: `${m.nombre} — ${m.contenido.slice(0, 60)}`.slice(0, 100), value: m.nombre })));
    },

    async execute(interaction) {
        if (!(await exigir(interaction, 'tickets.macros'))) return;
        const ticket = await Ticket.findOne({ canalId: interaction.channelId });
        if (!ticket) return interaction.reply({ content: '❌ Las respuestas rápidas solo se pueden usar dentro de un ticket.', flags: EPH });
        if (ticket.estado === 'Cerrado') return interaction.reply({ content: '❌ Este ticket está cerrado.', flags: EPH });

        const macro = await Macro.findOneAndUpdate({ guildId: interaction.guildId, nombre: interaction.options.getString('nombre').toLowerCase() }, { $inc: { usos: 1 } });
        if (!macro) return interaction.reply({ content: '❌ No existe esa respuesta rápida.', flags: EPH });

        const texto = renderPlantilla(macro.contenido, { usuario: `<@${ticket.creadorId}>`, staff: interaction.user.username, ticket: ticket.titulo || ticket.motivo, servidor: interaction.guild.name });
        await interaction.reply({ content: texto });
        // Se guarda en el historial igual que cualquier mensaje del ticket y cuenta como respuesta del staff.
        await Mensaje.create({ ticketId: ticket.canalId, usuario: interaction.user.username, usuarioId: interaction.user.id, contenido: texto }).catch(() => {});
        await registrarActividad(ticket.canalId, interaction.user.id);
    }
};

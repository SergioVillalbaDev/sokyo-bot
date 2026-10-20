// Botones, menús y formularios (modales) del sistema de tickets en Discord.
// Se mantienen los customId antiguos (create_ticket, reclamar_ticket, close_ticket, csat_...)
// para que los paneles y tickets publicados antes de esta versión sigan funcionando.
const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, LabelBuilder, MessageFlags, ModalBuilder,
    StringSelectMenuBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder, escapeMarkdown
} = require('discord.js');
const Ticket = require('../models/Ticket.js');
const Mensaje = require('../models/Mensaje.js');
const { obtenerConfig } = require('../utils/config.js');
const { esStaff } = require('../utils/permisos.js');
const { registrarLog } = require('../utils/logger.js');
const { truncar } = require('../utils/texto.js');
const { adjuntoHtml } = require('../utils/transcript.js');
const {
    TicketError, COLORES, etiquetaTicket, motivosDe, datosUsuario, crearTicket, ticketsAbiertosDe, cerrarTicket,
    reabrirTicket, eliminarCanalTicket, asignarTicket, añadirParticipante
} = require('../utils/ticketManager.js');

const EFIMERO = { flags: MessageFlags.Ephemeral };
const BOTONES_CONTROL = ['reclamar_ticket', 'add_user_prompt', 'close_ticket', 'reopen_ticket', 'transcript_ticket', 'delete_ticket'];

const urlCanal = (guildId, canalId) => `https://discord.com/channels/${guildId}/${canalId}`;
const botonIrAlTicket = (guildId, canalId) => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Ir al ticket').setEmoji('🎫').setURL(urlCanal(guildId, canalId))
);

// Ticket del canal actual + configuración + si quien pulsa es staff.
async function contextoTicket(interaction) {
    const ticket = await Ticket.findOne({ canalId: interaction.channelId });
    if (!ticket) throw new TicketError('Este canal no es un ticket.', 404);
    const config = await obtenerConfig(interaction.guildId);

    // Tickets antiguos: no guardaban qué mensaje tiene los botones. Lo aprendemos al vuelo.
    if (!ticket.mensajeControlId && interaction.isButton() && BOTONES_CONTROL.includes(interaction.customId)
        && interaction.message?.author?.id === interaction.client.user.id) {
        ticket.mensajeControlId = interaction.message.id;
        await Ticket.updateOne({ _id: ticket._id }, { $set: { mensajeControlId: ticket.mensajeControlId } });
    }

    return { ticket, config, staff: esStaff(interaction.member, config) };
}

function exigirStaff(staff, accion) {
    if (!staff) throw new TicketError(`Solo el equipo de soporte puede ${accion}.`, 403);
}

// ------------------------------------------------------------- abrir ticket

function construirFormularioTicket(config, preseleccionado = null) {
    const motivos = motivosDe(config).slice(0, 25);
    const selector = new StringSelectMenuBuilder()
        .setCustomId('motivo')
        .setPlaceholder('Elige una categoría…')
        .setRequired(true)
        .addOptions(motivos.map(m => ({
            label: truncar(m.nombre, 100),
            value: m.nombre.slice(0, 100),
            description: truncar(`Prioridad: ${m.urgencia || 'Normal'}`, 100),
            default: motivos.length === 1 || m.nombre === preseleccionado
        })));

    return new ModalBuilder()
        .setCustomId('modal_abrir_ticket')
        .setTitle('📩 Abrir un ticket de soporte')
        .addLabelComponents(
            new LabelBuilder().setLabel('Categoría').setDescription('¿Sobre qué es tu consulta?').setStringSelectMenuComponent(selector),
            new LabelBuilder().setLabel('Asunto').setTextInputComponent(
                new TextInputBuilder().setCustomId('asuntoInput').setStyle(TextInputStyle.Short)
                    .setPlaceholder('Ej: No puedo acceder a mi cuenta').setMinLength(3).setMaxLength(100).setRequired(true)
            ),
            new LabelBuilder().setLabel('Describe tu problema').setDescription('Cuanto más detalle nos des, antes podremos ayudarte.').setTextInputComponent(
                new TextInputBuilder().setCustomId('descripcionInput').setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Qué ha pasado, cuándo, qué has probado ya…').setMaxLength(1500).setRequired(true)
            )
        );
}

async function avisoLimite(interaction, config, vigentes) {
    const limite = config.maxTicketsPorUsuario || 1;
    const texto = limite === 1
        ? `⚠️ Ya tienes un ticket abierto: <#${vigentes[0].canalId}>. Escríbenos por allí.`
        : `⚠️ Ya tienes ${vigentes.length} tickets abiertos (máximo ${limite}). El más reciente: <#${vigentes[0].canalId}>`;
    const respuesta = { content: texto, components: [botonIrAlTicket(interaction.guildId, vigentes[0].canalId)], ...EFIMERO };
    return interaction.deferred || interaction.replied ? interaction.editReply(respuesta) : interaction.reply(respuesta);
}

// Botón "Abrir Ticket" del panel público (y el menú antiguo de categorías).
async function abrirFormulario(interaction, client) {
    if (!interaction.inGuild()) return;
    const config = await obtenerConfig(interaction.guildId);

    // Comprobamos el límite ANTES de que el usuario rellene el formulario.
    const vigentes = await ticketsAbiertosDe(client, interaction.guild, interaction.user.id);
    if (vigentes.length >= (config.maxTicketsPorUsuario || 1)) return avisoLimite(interaction, config, vigentes);

    const preseleccionado = interaction.isStringSelectMenu() ? interaction.values[0] : null;
    await interaction.showModal(construirFormularioTicket(config, preseleccionado));
}

async function crearDesdeFormulario(interaction, client) {
    // Formulario nuevo: la categoría viene en el desplegable. Formulario antiguo: en el customId.
    const motivo = interaction.customId === 'modal_abrir_ticket'
        ? interaction.fields.getStringSelectValues('motivo')[0]
        : interaction.customId.slice('modal_abrir_ticket_'.length);
    const asunto = interaction.fields.getTextInputValue('asuntoInput');
    const descripcion = interaction.fields.getTextInputValue('descripcionInput');

    await interaction.deferReply(EFIMERO);
    const config = await obtenerConfig(interaction.guildId);
    const motivoReal = motivosDe(config).find(m => m.nombre.slice(0, 100) === motivo)?.nombre ?? motivo;

    try {
        const { canal } = await crearTicket(client, {
            guild: interaction.guild,
            usuario: datosUsuario(interaction.user),
            motivo: motivoReal,
            asunto,
            descripcion
        });
        await interaction.editReply({
            content: `✅ ¡Listo! Tu ticket está aquí: <#${canal.id}>`,
            components: [botonIrAlTicket(interaction.guildId, canal.id)]
        });
    } catch (error) {
        if (error.codigo === 'limite' && error.ticket) return avisoLimite(interaction, config, [error.ticket]);
        throw error;
    }
}

// ----------------------------------------------------------- dentro del ticket

async function reclamar(interaction, client) {
    await interaction.deferReply(EFIMERO);
    const { ticket, staff } = await contextoTicket(interaction);
    exigirStaff(staff, 'reclamar tickets');
    await asignarTicket(client, ticket.canalId, {
        staff: datosUsuario(interaction.user), autor: interaction.user.username, autorId: interaction.user.id, soloSiLibre: true
    });
    await interaction.editReply('✅ Ahora este ticket es tuyo.');
}

async function pedirUsuario(interaction) {
    const { ticket, staff } = await contextoTicket(interaction);
    exigirStaff(staff, 'añadir personas al ticket');
    if (ticket.estado === 'Cerrado') throw new TicketError('No puedes añadir usuarios a un ticket cerrado.', 409);

    const selector = new UserSelectMenuBuilder()
        .setCustomId('add_user_select')
        .setPlaceholder('🔍 Busca a quién quieres añadir…')
        .setMinValues(1)
        .setMaxValues(5);
    await interaction.reply({ content: '¿A quién quieres invitar a este ticket?', components: [new ActionRowBuilder().addComponents(selector)], ...EFIMERO });
}

async function añadirUsuarios(interaction, client) {
    const { staff } = await contextoTicket(interaction);
    exigirStaff(staff, 'añadir personas al ticket');
    await interaction.deferUpdate();

    const resultados = [];
    for (const user of interaction.users.values()) {
        if (user.bot) { resultados.push(`⚠️ ${user.username}: los bots no se pueden añadir.`); continue; }
        try {
            await añadirParticipante(client, interaction.channel, datosUsuario(user), { autor: interaction.user.username, autorId: interaction.user.id });
            resultados.push(`✅ ${user.username} añadido.`);
        } catch (error) {
            resultados.push(`⚠️ ${error instanceof TicketError ? error.message : `${user.username}: no se pudo añadir.`}`);
        }
    }
    await interaction.editReply({ content: resultados.join('\n'), components: [] });
}

async function pedirCierre(interaction) {
    const { ticket, staff } = await contextoTicket(interaction);
    if (!staff && interaction.user.id !== ticket.creadorId) {
        throw new TicketError('Solo quien abrió el ticket o el equipo de soporte pueden cerrarlo.', 403);
    }
    if (ticket.estado === 'Cerrado') throw new TicketError('Este ticket ya está cerrado.', 409);

    const modal = new ModalBuilder()
        .setCustomId('modal_cerrar_ticket')
        .setTitle(truncar(`🔒 Cerrar ticket ${etiquetaTicket(ticket)}`, 45))
        .addLabelComponents(
            new LabelBuilder()
                .setLabel('Motivo del cierre (opcional)')
                .setDescription('Se incluirá en el resumen que recibe el usuario.')
                .setTextInputComponent(
                    new TextInputBuilder().setCustomId('motivoCierre').setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Ej: Problema resuelto, ¡gracias por tu paciencia!').setMaxLength(500).setRequired(false)
                )
        );
    await interaction.showModal(modal);
}

async function cerrarDesdeFormulario(interaction, client) {
    await interaction.deferReply(EFIMERO);
    const { ticket, staff } = await contextoTicket(interaction);
    if (!staff && interaction.user.id !== ticket.creadorId) {
        throw new TicketError('Solo quien abrió el ticket o el equipo de soporte pueden cerrarlo.', 403);
    }
    await cerrarTicket(client, ticket.canalId, {
        autor: interaction.user.username,
        autorId: interaction.user.id,
        motivo: interaction.fields.getTextInputValue('motivoCierre')
    });
    await interaction.editReply('✅ Ticket cerrado y archivado.');
}

async function reabrir(interaction, client) {
    await interaction.deferReply(EFIMERO);
    const { ticket, staff } = await contextoTicket(interaction);
    exigirStaff(staff, 'reabrir tickets');
    await reabrirTicket(client, ticket.canalId, { autor: interaction.user.username, autorId: interaction.user.id });
    await interaction.editReply('✅ Ticket reabierto.');
}

async function transcript(interaction) {
    await interaction.deferReply(EFIMERO);
    const { ticket, staff } = await contextoTicket(interaction);
    if (!staff && interaction.user.id !== ticket.creadorId) throw new TicketError('No puedes descargar este transcript.', 403);
    const mensajes = await Mensaje.find({ ticketId: ticket.canalId }).sort({ fecha: 1 });
    await interaction.editReply({
        content: `📄 Transcript del ticket ${etiquetaTicket(ticket)} (${mensajes.length} mensajes). Ábrelo con tu navegador.`,
        files: [adjuntoHtml(ticket, mensajes, { nombreServidor: interaction.guild.name })]
    });
}

async function confirmarEliminar(interaction) {
    const { ticket, staff } = await contextoTicket(interaction);
    exigirStaff(staff, 'eliminar tickets');
    if (ticket.estado !== 'Cerrado') throw new TicketError('Cierra el ticket antes de eliminar su canal.', 409);

    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('delete_ticket_confirm').setEmoji('🗑️').setLabel('Sí, eliminar canal').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('delete_ticket_cancel').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
    );
    await interaction.reply({
        content: '⚠️ **¿Eliminar el canal de este ticket?** No se puede deshacer en Discord, aunque la conversación seguirá disponible en el panel web.',
        components: [fila],
        ...EFIMERO
    });
}

async function eliminar(interaction, client) {
    const { ticket, staff } = await contextoTicket(interaction);
    exigirStaff(staff, 'eliminar tickets');
    await interaction.update({ content: '🗑️ Eliminando el canal…', components: [] });
    await eliminarCanalTicket(client, ticket.canalId, { autor: interaction.user.username, autorId: interaction.user.id });
}

async function cancelarEliminar(interaction) {
    await interaction.update({ content: 'Operación cancelada. El canal sigue en su sitio.', components: [] });
}

// ------------------------------------------------- valoración (DM al usuario)

async function valorar(interaction, client) {
    const [, nota, canalId] = interaction.customId.split('_');
    const valoracion = Math.min(5, Math.max(1, parseInt(nota, 10) || 0));
    const ticket = await Ticket.findOneAndUpdate(
        { canalId, creadorId: interaction.user.id },
        { $set: { valoracionCSAT: valoracion } },
        { returnDocument: 'after' }
    );
    if (!ticket) throw new TicketError('No se encontró el ticket que intentas valorar.', 404);

    await registrarLog(client, {
        guildId: ticket.guildId, categoria: 'Tickets', accion: `⭐ Ticket Valorado (${valoracion}/5)`,
        usuario: ticket.creadorNombre, usuarioId: ticket.creadorId, color: COLORES.valorado,
        detalles: `Ticket ${etiquetaTicket(ticket)}: **${escapeMarkdown(ticket.titulo || ticket.motivo)}**`
    });

    const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('💖 ¡Gracias por tu valoración!')
        .setDescription(`Has valorado la atención del ticket ${etiquetaTicket(ticket)} con **${'⭐'.repeat(valoracion)} (${valoracion}/5)**.\n\n¿Quieres contarnos algo más? Puedes dejarnos un comentario.`);
    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`csatcom_${canalId}`).setEmoji('💬').setLabel('Añadir un comentario').setStyle(ButtonStyle.Primary)
    );
    await interaction.update({ embeds: [embed], components: [fila] });
}

async function pedirComentario(interaction) {
    const canalId = interaction.customId.slice('csatcom_'.length);
    const modal = new ModalBuilder()
        .setCustomId(`modal_csat_${canalId}`)
        .setTitle('💬 Tu opinión nos importa')
        .addLabelComponents(
            new LabelBuilder().setLabel('Comentario').setTextInputComponent(
                new TextInputBuilder().setCustomId('comentario').setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('¿Qué hicimos bien? ¿Qué podemos mejorar?').setMaxLength(500).setRequired(true)
            )
        );
    await interaction.showModal(modal);
}

async function guardarComentario(interaction) {
    const canalId = interaction.customId.slice('modal_csat_'.length);
    const comentario = interaction.fields.getTextInputValue('comentario').trim();
    const ticket = await Ticket.findOneAndUpdate(
        { canalId, creadorId: interaction.user.id },
        { $set: { comentarioCSAT: comentario } },
        { returnDocument: 'after' }
    );
    if (!ticket) throw new TicketError('No se encontró el ticket.', 404);

    const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('💖 ¡Gracias por tu valoración!')
        .setDescription(`Valoración: **${'⭐'.repeat(ticket.valoracionCSAT || 0)} (${ticket.valoracionCSAT || '-'}/5)**\n\n**Tu comentario:**\n> ${escapeMarkdown(truncar(comentario, 1000)).replace(/\n/g, '\n> ')}`);
    if (interaction.isFromMessage()) await interaction.update({ embeds: [embed], components: [] });
    else await interaction.reply({ embeds: [embed] });
}

// ---------------------------------------------------------------- registro

// [coincidencia, handler]: string = customId exacto, RegExp = patrón.
const manejadores = [
    ['create_ticket', abrirFormulario],
    ['seleccionar_motivo_ticket', abrirFormulario], // menú de categorías de versiones anteriores
    [/^modal_abrir_ticket/, crearDesdeFormulario],
    ['reclamar_ticket', reclamar],
    ['add_user_prompt', pedirUsuario],
    ['add_user_select', añadirUsuarios],
    ['close_ticket', pedirCierre],
    ['modal_cerrar_ticket', cerrarDesdeFormulario],
    ['reopen_ticket', reabrir],
    ['transcript_ticket', transcript],
    ['delete_ticket', confirmarEliminar],
    ['delete_ticket_confirm', eliminar],
    ['delete_ticket_cancel', cancelarEliminar],
    [/^csat_[1-5]_/, valorar],
    [/^csatcom_/, pedirComentario],
    [/^modal_csat_/, guardarComentario]
];

function buscarManejador(customId) {
    const entrada = manejadores.find(([clave]) => typeof clave === 'string' ? clave === customId : clave.test(customId));
    return entrada ? entrada[1] : null;
}

module.exports = { buscarManejador, construirFormularioTicket };

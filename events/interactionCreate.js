const { Events, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder } = require('discord.js');
const crypto = require('crypto');
const ServidorConfig = require('../models/ServidorConfig.js');
const Ticket = require('../models/Ticket.js');
const Articulo = require('../models/Articulo.js');
const Votacion = require('../models/Votacion.js');
const { cerrarTicket, reclamarTicket, registrarLogTicket } = require('../utils/ticketManager.js');
const { permisosDe, exigir, obtenerConfig, EPH } = require('../utils/accesos.js');
const { buscarArticulos } = require('../utils/helpers.js');
const { embedVotacion, filaVotacion } = require('../utils/votaciones.js');
const { emitir } = require('../utils/eventos.js');

// Datos de tickets pendientes de confirmar tras ver las sugerencias de la FAQ (caducan a los 10 min).
const pendientesFaq = new Map();
const guardarPendiente = (datos) => {
    const token = crypto.randomBytes(6).toString('hex');
    pendientesFaq.set(token, { ...datos, caduca: Date.now() + 10 * 60_000 });
    for (const [k, v] of pendientesFaq) if (v.caduca < Date.now()) pendientesFaq.delete(k);
    return token;
};

// Límites anti-abuso: nº máximo de tickets abiertos y tiempo mínimo entre dos tickets.
async function comprobarLimites(guildId, userId, config) {
    const max = config?.tickets?.maxAbiertosPorUsuario ?? 3;
    const abiertos = await Ticket.find({ guildId, creadorId: userId, estado: 'Abierto' });
    if (abiertos.length >= max) {
        return `⛔ Ya tienes **${abiertos.length}** ticket(s) abierto(s) (máximo ${max}). Resuélvelos o ciérralos antes de abrir otro:\n${abiertos.map(t => `• <#${t.canalId}>`).join('\n')}`;
    }
    const espera = (config?.tickets?.cooldownSegundos ?? 60) * 1000;
    if (espera > 0) {
        const ultimo = await Ticket.findOne({ guildId, creadorId: userId }).sort({ fechaCreacion: -1 });
        const restante = ultimo ? espera - (Date.now() - ultimo.fechaCreacion.getTime()) : 0;
        if (restante > 0) return `⏳ Espera **${Math.ceil(restante / 1000)} s** antes de abrir otro ticket.`;
    }
    return null;
}

async function crearTicket(interaction, { motivo, asunto, descripcion }) {
    const config = await obtenerConfig(interaction.guildId);
    const limite = await comprobarLimites(interaction.guildId, interaction.user.id, config);
    if (limite) return interaction.editReply({ content: limite, embeds: [], components: [] });

    const listaMotivos = config.motivos || [];
    const listaUrgencias = config.urgencias || [];
    const urgencia = listaMotivos.find(m => m.nombre === motivo)?.urgencia || 'Normal';
    const colorHex = listaUrgencias.find(u => u.nombre === urgencia)?.color || '#3498db';

    const permisos = [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles] }
    ];
    // Si hay un rol de staff configurado, puede ver y atender los tickets.
    const rolStaff = config.tickets?.rolStaffId;
    if (rolStaff && interaction.guild.roles.cache.has(rolStaff)) {
        permisos.push({ id: rolStaff, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles] });
    }

    const canalTicket = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: permisos
    });

    const creadorAvatar = interaction.user.displayAvatarURL({ extension: 'png', size: 128 });
    const ahora = new Date();
    const nuevoTicket = await Ticket.create({
        guildId: interaction.guild.id,
        canalId: canalTicket.id,
        creadorId: interaction.user.id,
        creadorNombre: interaction.user.username,
        creadorAvatar,
        motivo, titulo: asunto, descripcion,
        prioridad: urgencia,
        estado: 'Abierto',
        participantes: [{ id: interaction.user.id, username: interaction.user.username, avatar: creadorAvatar, rol: 'Creador' }],
        visibleWeb: true,
        ultimoMensajeFecha: ahora,
        ultimoMensajePor: 'usuario'
    });

    await registrarLogTicket(nuevoTicket, '🎫 Ticket Abierto', '#2ecc71', interaction.user.username);

    const embedBienvenida = new EmbedBuilder().setTitle(`🎫 ${asunto}`)
        .setDescription(`**Motivo:** ${motivo}\n\n**Descripción del usuario:**\n${descripcion}\n\n*Un miembro del equipo lo revisará en breve.*`)
        .setColor(colorHex).addFields({ name: '🚨 Urgencia', value: `**${urgencia}**`, inline: true });
    const rowBotones = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('reclamar_ticket').setLabel('🙋‍♂️ Reclamar Ticket').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('add_user_prompt').setLabel('➕ Añadir Usuario').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Cerrar Ticket').setStyle(ButtonStyle.Danger)
    );

    await canalTicket.send({ content: `¡Hola <@${interaction.user.id}>! Aquí tienes tu ticket. 👇`, embeds: [embedBienvenida], components: [rowBotones] });
    await interaction.editReply({ content: `✅ Tu ticket ha sido creado exitosamente: <#${canalTicket.id}>`, embeds: [], components: [] });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
    emitir(interaction.guild.id, 'ticket:nuevo', { canalId: canalTicket.id, titulo: asunto, usuario: interaction.user.username });
}

async function manejarComando(interaction, client) {
    const comando = client.commands.get(interaction.commandName);
    if (!comando) return;
    try {
        await comando.execute(interaction, client);
    } catch (error) {
        console.error(`Error en /${interaction.commandName}:`, error);
        const msg = { content: '❌ Hubo un error al ejecutar ese comando.', flags: EPH };
        if (interaction.deferred || interaction.replied) await interaction.followUp(msg).catch(() => {});
        else await interaction.reply(msg).catch(() => {});
    }
}

async function manejarBoton(interaction, client) {
    const id = interaction.customId;

    // ABRIR TICKET (comprueba límites y muestra el menú de motivos)
    if (id === 'create_ticket') {
        const config = await obtenerConfig(interaction.guildId);
        const limite = await comprobarLimites(interaction.guildId, interaction.user.id, config);
        if (limite) return interaction.reply({ content: limite, flags: EPH });

        const listaMotivos = config.motivos?.length ? config.motivos : [{ nombre: 'Soporte General', urgencia: 'Normal' }];
        const menu = new StringSelectMenuBuilder().setCustomId('seleccionar_motivo_ticket').setPlaceholder('👉 Selecciona el motivo de tu consulta...')
            .addOptions(listaMotivos.slice(0, 25).map(m => ({ label: m.nombre, description: `Prioridad asignada: ${m.urgencia}`, value: m.nombre })));
        return interaction.reply({ content: 'Por favor, selecciona una categoría para poder ayudarte mejor:', components: [new ActionRowBuilder().addComponents(menu)], flags: EPH });
    }

    // RECLAMAR TICKET
    if (id === 'reclamar_ticket') {
        if (!(await exigir(interaction, 'tickets.reclamar'))) return;
        const yo = { id: interaction.user.id, username: interaction.user.username, avatar: interaction.user.displayAvatarURL({ extension: 'png', size: 128 }) };
        const r = await reclamarTicket(client, interaction.channel.id, yo);
        if (!r.ok) return interaction.reply({ content: `⚠️ ${r.error}`, flags: EPH });

        const embedOriginal = interaction.message.embeds[0];
        if (embedOriginal && interaction.message.components[0]) {
            const embedNuevo = EmbedBuilder.from(embedOriginal).addFields({ name: '👀 Atendido por', value: `🙋‍♂️ ${yo.username}`, inline: true });
            const fila = ActionRowBuilder.from(interaction.message.components[0]);
            const botonReclamar = fila.components.find(c => c.data.custom_id === 'reclamar_ticket');
            if (botonReclamar) botonReclamar.setDisabled(true);
            await interaction.update({ embeds: [embedNuevo], components: [fila] });
        } else {
            await interaction.update({ components: [] }); // mensaje de "ticket liberado": retiramos el botón
        }
        return interaction.followUp({ content: `📢 El agente de soporte **${yo.username}** se ha hecho cargo de este ticket.` });
    }

    // AÑADIR USUARIO AL TICKET
    if (id === 'add_user_prompt') {
        if (!(await exigir(interaction, 'tickets.reclamar'))) return;
        const userSelect = new UserSelectMenuBuilder().setCustomId('add_user_select').setPlaceholder('🔍 Busca y selecciona a un usuario...').setMinValues(1).setMaxValues(1);
        return interaction.reply({ content: 'Elige al usuario que quieres invitar a participar en este ticket:', components: [new ActionRowBuilder().addComponents(userSelect)], flags: EPH });
    }

    // CERRAR TICKET: solo su creador o el staff con permiso de cerrar
    if (id === 'close_ticket') {
        const ticket = await Ticket.findOne({ canalId: interaction.channelId });
        if (!ticket) return interaction.reply({ content: '❌ No se encontró este ticket en la base de datos.', flags: EPH });
        if (ticket.creadorId !== interaction.user.id) {
            const calculo = await permisosDe(interaction.member);
            if (!calculo.permisos.has('tickets.cerrar')) {
                return interaction.reply({ content: '🔒 Solo el creador del ticket o el staff con permiso de cerrar pueden cerrarlo.', flags: EPH });
            }
        }
        await interaction.reply({ content: '🔒 Generando copia de seguridad y cerrando el ticket...', flags: EPH });
        try {
            const res = await cerrarTicket(client, interaction.channelId, { autor: interaction.user.username });
            await interaction.editReply({ content: res.ok ? '✅ Ticket cerrado y archivado correctamente.' : '❌ No se encontró este ticket en la base de datos.' });
        } catch (error) {
            console.error('Error al cerrar:', error);
            await interaction.editReply({ content: '❌ Hubo un error al cerrar el ticket.' }).catch(() => {});
        }
        return;
    }

    // VALORACIÓN (solo puede valorar el creador del ticket)
    if (id.startsWith('csat_')) {
        const [, estrellas, canalId] = id.split('_');
        const valoracion = parseInt(estrellas);
        try {
            const ticket = await Ticket.findOne({ canalId });
            if (!ticket || ticket.creadorId !== interaction.user.id || !(valoracion >= 1 && valoracion <= 5)) {
                return interaction.reply({ content: 'No puedes valorar este ticket.', flags: EPH });
            }
            ticket.valoracionCSAT = valoracion;
            await ticket.save();
            await registrarLogTicket(ticket, `⭐ Ticket Valorado (${valoracion}/5)`, '#f1c40f', ticket.creadorNombre);
            emitir(ticket.guildId, 'ticket:actualizado', { canalId });
            const gracias = new EmbedBuilder().setColor('#2ecc71').setTitle('💖 ¡Gracias por tu valoración!').setDescription(`Has valorado la atención recibida con **${valoracion} estrellas**.`);
            return interaction.update({ embeds: [gracias], components: [] });
        } catch (e) { return interaction.reply({ content: 'Error al guardar.', flags: EPH }); }
    }

    // VOTAR en sugerencias y encuestas (1 voto por persona; pulsar de nuevo retira el voto)
    if (id.startsWith('vot_')) {
        const idx = parseInt(id.split('_')[1]);
        const v = await Votacion.findOne({ mensajeId: interaction.message.id });
        if (!v || v.estado !== 'abierta' || !v.opciones[idx]) return interaction.reply({ content: 'Esta votación ya no está abierta.', flags: EPH });
        const yaVotada = v.opciones[idx].votos.includes(interaction.user.id);
        v.opciones.forEach(o => { o.votos = o.votos.filter(u => u !== interaction.user.id); });
        if (!yaVotada) v.opciones[idx].votos.push(interaction.user.id);
        v.markModified('opciones');
        await v.save();
        return interaction.update({ embeds: [embedVotacion(v)], components: [filaVotacion(v)] });
    }

    // VERIFICACIÓN: da el rol configurado
    if (id === 'verificar') {
        const config = await obtenerConfig(interaction.guildId);
        const rolId = config.bienvenida?.verificacionRolId;
        if (!config.bienvenida?.verificacionActiva || !rolId) return interaction.reply({ content: '⚠️ La verificación no está activa.', flags: EPH });
        if (interaction.member.roles.cache.has(rolId)) return interaction.reply({ content: '✅ Ya estás verificado.', flags: EPH });
        try {
            await interaction.member.roles.add(rolId, 'Verificación por botón');
            return interaction.reply({ content: '🎉 ¡Verificado! Ya puedes acceder al servidor.', flags: EPH });
        } catch { return interaction.reply({ content: '❌ No pude darte el rol (revisa que mi rol esté por encima del de verificación).', flags: EPH }); }
    }

    // FAQ: "esto me resuelve" / "seguir con el ticket"
    if (id === 'faq_ok') {
        return interaction.update({ content: '🎉 ¡Me alegro de haberte ayudado! Si necesitas algo más, abre un ticket cuando quieras.', embeds: [], components: [] });
    }
    if (id.startsWith('faq_seguir_')) {
        const datos = pendientesFaq.get(id.replace('faq_seguir_', ''));
        if (!datos || datos.userId !== interaction.user.id) return interaction.update({ content: '⌛ Esta solicitud caducó. Vuelve a pulsar «Abrir Ticket».', embeds: [], components: [] });
        pendientesFaq.delete(id.replace('faq_seguir_', ''));
        await interaction.update({ content: '⏳ Procesando tu solicitud y creando el canal...', embeds: [], components: [] });
        try { await crearTicket(interaction, datos); } catch (e) { console.error(e); await interaction.editReply({ content: '❌ Hubo un error.' }); }
    }
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        try {
            if (interaction.isChatInputCommand()) return await manejarComando(interaction, client);

            if (interaction.isAutocomplete()) {
                const comando = client.commands.get(interaction.commandName);
                if (comando?.autocomplete) await comando.autocomplete(interaction, client);
                return;
            }

            if (interaction.isButton()) return await manejarBoton(interaction, client);

            // SELECCIÓN DE USUARIO para invitarlo al ticket
            if (interaction.isUserSelectMenu() && interaction.customId === 'add_user_select') {
                if (!(await exigir(interaction, 'tickets.reclamar'))) return;
                const userIdToAdd = interaction.values[0];
                const canal = interaction.channel;
                await canal.permissionOverwrites.edit(userIdToAdd, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
                await interaction.update({ content: `✅ Permisos concedidos.`, components: [] });
                await canal.send({ content: `👋 El usuario <@${userIdToAdd}> ha sido añadido a la conversación por <@${interaction.user.id}>.` });

                const addedUser = await client.users.fetch(userIdToAdd);
                const addedAvatar = addedUser.displayAvatarURL({ extension: 'png', size: 128 });
                await Ticket.updateOne(
                    { canalId: canal.id, 'participantes.id': { $ne: userIdToAdd } },
                    { $push: { participantes: { id: userIdToAdd, username: addedUser.username, avatar: addedAvatar, rol: 'Invitado' } } }
                );
                emitir(interaction.guildId, 'ticket:actualizado', { canalId: canal.id });
                return;
            }

            // MENÚ DESPLEGABLE DE MOTIVOS -> MODAL
            if (interaction.isStringSelectMenu() && interaction.customId === 'seleccionar_motivo_ticket') {
                const modal = new ModalBuilder().setCustomId(`modal_abrir_ticket_${interaction.values[0]}`).setTitle(`Ticket: ${interaction.values[0]}`.slice(0, 45));
                const asuntoInput = new TextInputBuilder().setCustomId('asuntoInput').setLabel('Asunto del Ticket').setPlaceholder('Ej: Problema con la base de datos').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100);
                const descripcionInput = new TextInputBuilder().setCustomId('descripcionInput').setLabel('Describe tu problema detalladamente').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000);
                modal.addComponents(new ActionRowBuilder().addComponents(asuntoInput), new ActionRowBuilder().addComponents(descripcionInput));
                return await interaction.showModal(modal);
            }

            // MODAL ENVIADO: sugiere artículos de la FAQ o crea el ticket directamente
            if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_abrir_ticket_')) {
                const datos = {
                    userId: interaction.user.id,
                    motivo: interaction.customId.replace('modal_abrir_ticket_', ''),
                    asunto: interaction.fields.getTextInputValue('asuntoInput'),
                    descripcion: interaction.fields.getTextInputValue('descripcionInput')
                };

                const config = await obtenerConfig(interaction.guildId);
                if (config.tickets?.faqActiva !== false) {
                    const sugeridos = buscarArticulos(await Articulo.find({ guildId: interaction.guildId }), `${datos.asunto} ${datos.descripcion}`, 3);
                    if (sugeridos.length > 0) {
                        const token = guardarPendiente(datos);
                        const embeds = sugeridos.map(a => new EmbedBuilder().setColor('#5865F2').setTitle(`📖 ${a.titulo}`).setDescription(a.contenido.slice(0, 1500)));
                        Articulo.updateMany({ _id: { $in: sugeridos.map(a => a._id) } }, { $inc: { visitas: 1 } }).catch(() => {});
                        const fila = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('faq_ok').setLabel('Esto me resuelve').setEmoji('✅').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId(`faq_seguir_${token}`).setLabel('Seguir abriendo el ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary)
                        );
                        const respuesta = { content: '💡 **Antes de abrir el ticket**, quizá esto te ayude:', embeds, components: [fila] };
                        return interaction.isFromMessage() ? await interaction.update(respuesta) : await interaction.reply({ ...respuesta, flags: EPH });
                    }
                }

                const procesando = { content: '⏳ Procesando tu solicitud y creando el canal...', components: [], embeds: [] };
                if (interaction.isFromMessage()) await interaction.update(procesando);
                else await interaction.reply({ ...procesando, flags: EPH });
                try { await crearTicket(interaction, datos); }
                catch (error) { console.error(error); await interaction.editReply({ content: '❌ Hubo un error.' }); }
            }
        } catch (error) {
            console.error('Error en interactionCreate:', error);
        }
    }
};

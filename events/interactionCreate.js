const { Events, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const Ticket = require('../models/Ticket.js');
const RolePanel = require('../models/RolePanel.js');
const { cerrarTicket, registrarLogTicket } = require('../utils/ticketManager.js');
const { toggleRol, aplicarSeleccionMenu } = require('../utils/rolePanelManager.js');
const verificacion = require('../utils/verificacion.js');
const reportes = require('../utils/reportes.js');
const embudo = require('../utils/embudo.js');

// --- Paneles de roles: botón de rol o de verificación ---
async function manejarBotonRol(interaction) {
    try {
        const [tipo, panelId, roleId] = interaction.customId.split(':');
        const panel = await RolePanel.findById(panelId);
        if (!panel) return interaction.reply({ content: '❌ Este panel ya no existe.', ephemeral: true });

        // Verificación: simplemente concede el rol (no se quita).
        if (tipo === 'rp_verify') {
            const rid = panel.items[0]?.roleId;
            if (!rid) return interaction.reply({ content: '❌ Este panel no tiene rol configurado.', ephemeral: true });
            if (interaction.member.roles.cache.has(rid)) return interaction.reply({ content: '✅ Ya estás verificado.', ephemeral: true });
            await interaction.member.roles.add(rid).catch(() => {});
            return interaction.reply({ content: '✅ ¡Verificado! Ya tienes acceso al servidor.', ephemeral: true });
        }

        const estado = await toggleRol(interaction.member, panel, roleId);
        const rol = interaction.guild.roles.cache.get(roleId);
        const nombre = rol ? rol.name : 'rol';
        const msg = estado === 'añadido' ? `✅ Te has asignado **${nombre}**.`
            : estado === 'quitado' ? `➖ Se te ha quitado **${nombre}**.`
            : estado === 'limite' ? '⚠️ Has alcanzado el máximo de roles de este panel.'
            : `Ya tienes **${nombre}**.`;
        return interaction.reply({ content: msg, ephemeral: true });
    } catch (e) {
        console.error('Error en botón de rol:', e);
        if (!interaction.replied) interaction.reply({ content: '❌ Ha ocurrido un error.', ephemeral: true }).catch(() => {});
    }
}

// --- Paneles de roles: menú desplegable ---
async function manejarMenuRol(interaction) {
    try {
        const panelId = interaction.customId.split(':')[1];
        const panel = await RolePanel.findById(panelId);
        if (!panel) return interaction.reply({ content: '❌ Este panel ya no existe.', ephemeral: true });
        const { puestos, quitados } = await aplicarSeleccionMenu(interaction.member, panel, interaction.values);
        return interaction.reply({ content: `✅ Roles actualizados — ${puestos} añadido(s), ${quitados} quitado(s).`, ephemeral: true });
    } catch (e) {
        console.error('Error en menú de rol:', e);
        if (!interaction.replied) interaction.reply({ content: '❌ Ha ocurrido un error.', ephemeral: true }).catch(() => {});
    }
}

// ¿El miembro puede gestionar tickets? (rol de staff configurado O permiso de
// gestionar canales / administrador). Si no hay rol configurado, se mantiene el
// comportamiento anterior (solo el permiso ManageChannels).
function esStaff(interaction, config) {
    const tienePerm = interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels);
    const tieneRol = config && config.rolStaffId ? interaction.member.roles.cache.has(config.rolStaffId) : false;
    return tienePerm || tieneRol;
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {

        // --- SLASH COMMANDS ---
        if (interaction.isChatInputCommand()) {
            const comando = client.slashCommands.get(interaction.commandName);
            if (!comando) return;
            try {
                await comando.execute(interaction, client);
            } catch (e) {
                console.error('Error en slash command:', e);
                const msg = { content: '❌ Error al ejecutar el comando.', ephemeral: true };
                interaction.replied || interaction.deferred ? interaction.followUp(msg) : interaction.reply(msg);
            }
            return;
        }

        // --- TIENDA: compra al elegir en el menú (reutiliza la MISMA lógica que la web) ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'tienda_comprar') {
            const economia = require('../utils/economia.js');
            const r = await economia.comprarItem(interaction.user.id, interaction.values[0]);
            if (!r.ok) return interaction.reply({ content: `❌ ${r.error}`, ephemeral: true });
            return interaction.reply({
                content: `✅ Has comprado **${r.item.nombre}** por 🪙 ${r.coste}. Te quedan **${r.balance}** de oro.`,
                ephemeral: true,
            });
        }

        // --- SISTEMA DE ROLES: paneles de autoasignación (se gestionan aparte) ---
        if (interaction.isButton() && (interaction.customId.startsWith('rp_btn:') || interaction.customId.startsWith('rp_verify:'))) {
            return manejarBotonRol(interaction);
        }
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('rp_menu:')) {
            return manejarMenuRol(interaction);
        }

        // --- SEGURIDAD: verificación de entrada (botón + captcha) ---
        if (interaction.isButton() && interaction.customId === 'verif_inicio') return verificacion.manejarInicio(interaction);
        if (interaction.isButton() && interaction.customId === 'verif_introducir') return verificacion.manejarIntroducir(interaction);
        if (interaction.isModalSubmit() && interaction.customId === 'verif_modal') return verificacion.manejarModal(interaction);

        // --- EMBUDO DE BIENVENIDA A/B (botones por panel y por MD) ---
        // Los customId llevan el guildId (`embudo_x:<gid>`), por eso funcionan en MD.
        if (interaction.isButton() && interaction.customId.startsWith('embudo_inicio:')) return embudo.manejarInicio(interaction, client);
        if (interaction.isButton() && interaction.customId.startsWith('embudo_reglas:')) return embudo.manejarReglas(interaction, client);
        if (interaction.isButton() && interaction.customId.startsWith('embudo_aceptar:')) return embudo.manejarAceptar(interaction, client);
        if (interaction.isButton() && interaction.customId.startsWith('embudo_captcha:')) return embudo.manejarCaptcha(interaction, client);
        if (interaction.isModalSubmit() && interaction.customId.startsWith('embudo_modal:')) return embudo.manejarModal(interaction, client);

        // --- SEGURIDAD: gestión de reportes (resolver / descartar / abrir ticket) ---
        if (interaction.isButton() && (interaction.customId.startsWith('rep_resolver:') || interaction.customId.startsWith('rep_descartar:') || interaction.customId.startsWith('rep_ticket:'))) {
            return reportes.manejarBoton(interaction, client);
        }

        // --- LÓGICA DE BOTONES ---
        if (interaction.isButton()) {
            
            // ABRIR TICKET (Muestra el menú de motivos)
            if (interaction.customId === 'create_ticket') {
                try {
                    let config = await ServidorConfig.findOne({ guildId: interaction.guildId });
                    
                    const listaMotivos = (config && config.motivos && config.motivos.length > 0) 
                        ? config.motivos 
                        : [
                            { nombre: 'Fallo Técnico', urgencia: 'Normal' },
                            { nombre: 'Reportar Usuario', urgencia: 'Alta' },
                            { nombre: 'Duda de Pago', urgencia: 'Baja' }
                          ];

                    const menuMotivos = new StringSelectMenuBuilder()
                        .setCustomId('seleccionar_motivo_ticket')
                        .setPlaceholder('👉 Selecciona el motivo de tu consulta...')
                        .addOptions(
                            listaMotivos.map((motivo) => ({
                                label: motivo.nombre, 
                                description: `Prioridad asignada: ${motivo.urgencia}`,
                                value: motivo.nombre,
                            }))
                        );

                    const filaComponentes = new ActionRowBuilder().addComponents(menuMotivos);

                    await interaction.reply({
                        content: 'Por favor, selecciona una categoría para poder ayudarte mejor:',
                        components: [filaComponentes],
                        ephemeral: true 
                    });

                } catch (error) {
                    console.error('Error al mostrar menú de motivos:', error);
                    await interaction.reply({ content: '❌ Hubo un error al procesar tu solicitud.', ephemeral: true });
                }
            }

            // RECLAMAR TICKET (Guarda al staff en los implicados)
            if (interaction.customId === 'reclamar_ticket') {
                const configStaff = await ServidorConfig.findOne({ guildId: interaction.guildId });
                if (!esStaff(interaction, configStaff)) {
                    return await interaction.reply({ content: '❌ Solo el equipo de soporte puede reclamar este ticket.', ephemeral: true });
                }

                const canalId = interaction.channel.id;
                const ticket = await Ticket.findOne({ canalId: canalId });

                if (!ticket) return await interaction.reply({ content: '❌ No se encontró este ticket en la base de datos.', ephemeral: true });
                if (ticket.asignadoA) return await interaction.reply({ content: `⚠️ Este ticket ya está siendo atendido por **${ticket.asignadoNombre}**.`, ephemeral: true });

                const staffAvatar = interaction.user.displayAvatarURL({ extension: 'png', size: 128 });
                
                if (!ticket.participantes) ticket.participantes = [];
                if (!ticket.participantes.some(p => p.id === interaction.user.id)) {
                    ticket.participantes.push({ id: interaction.user.id, username: interaction.user.username, avatar: staffAvatar, rol: 'Staff' });
                }

                ticket.asignadoA = interaction.user.id;
                ticket.asignadoNombre = interaction.user.username;
                ticket.ultimaInteractStaff = new Date();
                await ticket.save();

                await registrarLogTicket(ticket, '🙋 Ticket Reclamado', '#3498db', interaction.user.username);

                const embedOriginal = interaction.message.embeds[0];
                const embedModificado = EmbedBuilder.from(embedOriginal).addFields({ name: '👀 Atendido por', value: `🙋‍♂️ ${interaction.user.username}`, inline: true });

                const filaOriginal = interaction.message.components[0];
                const filaModificada = ActionRowBuilder.from(filaOriginal);
                filaModificada.components[0].setDisabled(true); 

                await interaction.update({ embeds: [embedModificado], components: [filaModificada] });
                await interaction.followUp({ content: `📢 El agente de soporte **${interaction.user.username}** se ha hecho cargo de este ticket.` });
            }

            // AÑADIR USUARIO AL TICKET
            if (interaction.customId === 'add_user_prompt') {
                const configAdd = await ServidorConfig.findOne({ guildId: interaction.guildId });
                if (!esStaff(interaction, configAdd)) {
                    return await interaction.reply({ content: '❌ Solo el equipo de soporte puede invitar a otras personas.', ephemeral: true });
                }

                const userSelect = new UserSelectMenuBuilder().setCustomId('add_user_select').setPlaceholder('🔍 Busca y selecciona a un usuario...').setMinValues(1).setMaxValues(1);
                const row = new ActionRowBuilder().addComponents(userSelect);
                await interaction.reply({ content: 'Elige al usuario que quieres invitar a participar en este ticket:', components: [row], ephemeral: true });
            }

            // CERRAR TICKET (transcript + CSAT + archivado, vía módulo compartido)
            if (interaction.customId === 'close_ticket') {
                const canal = interaction.channel;
                if (!canal) return await interaction.reply({ content: '❌ No se ha podido encontrar el canal.', ephemeral: true });

                // Puede cerrar: el staff (rol/permiso) o el propio creador del ticket.
                const configClose = await ServidorConfig.findOne({ guildId: interaction.guildId });
                const ticketClose = await Ticket.findOne({ canalId: canal.id });
                const esCreador = ticketClose && ticketClose.creadorId === interaction.user.id;
                if (!esStaff(interaction, configClose) && !esCreador) {
                    return await interaction.reply({ content: '❌ No tienes permiso para cerrar este ticket.', ephemeral: true });
                }

                await interaction.reply({ content: '🔒 Generando copia de seguridad y cerrando el ticket...', ephemeral: true });

                try {
                    const res = await cerrarTicket(client, canal.id, { autor: interaction.user.username });
                    if (!res.ok) return await interaction.editReply({ content: '❌ No se encontró este ticket en la base de datos.' });
                    await interaction.editReply({ content: '✅ Ticket cerrado y archivado correctamente.' });
                } catch (error) {
                    console.error('Error al cerrar:', error);
                    await interaction.editReply({ content: '❌ Hubo un error al cerrar el ticket.' }).catch(() => {});
                }
            }

            if (interaction.customId.startsWith('csat_')) {
                const partes = interaction.customId.split('_');
                const valoracion = parseInt(partes[1]);
                try {
                    const ticket = await Ticket.findOneAndUpdate({ canalId: partes[2] }, { valoracionCSAT: valoracion }, { new: true });
                    if (ticket) await registrarLogTicket(ticket, `⭐ Ticket Valorado (${valoracion}/5)`, '#f1c40f', ticket.creadorNombre);
                    const embedGracias = new EmbedBuilder().setColor('#2ecc71').setTitle('💖 ¡Gracias por tu valoración!').setDescription(`Has valorado la atención recibida con **${valoracion} estrellas**.`);
                    await interaction.update({ embeds: [embedGracias], components: [] });
                } catch (e) { await interaction.reply({ content: 'Error al guardar.', ephemeral: true }); }
            }
        }

        // --- LÓGICA DE SELECCIÓN DE USUARIO (Guardar en DB) ---
        if (interaction.isUserSelectMenu() && interaction.customId === 'add_user_select') {
            const userIdToAdd = interaction.values[0];
            const canal = interaction.channel;

            try {
                await canal.permissionOverwrites.edit(userIdToAdd, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
                await interaction.update({ content: `✅ Permisos concedidos.`, components: [] });
                await canal.send({ content: `👋 El usuario <@${userIdToAdd}> ha sido añadido a la conversación por <@${interaction.user.id}>.` });

                const addedUser = await client.users.fetch(userIdToAdd);
                const addedAvatar = addedUser.displayAvatarURL({ extension: 'png', size: 128 });
                const ticket = await Ticket.findOne({ canalId: canal.id });
                
                if (ticket) {
                    if (!ticket.participantes) ticket.participantes = [];
                    if (!ticket.participantes.some(p => p.id === userIdToAdd)) {
                        ticket.participantes.push({ id: userIdToAdd, username: addedUser.username, avatar: addedAvatar, rol: 'Invitado' });
                        await ticket.save();
                    }
                }
            } catch (error) { console.error(error); }
        }

        // --- MENÚ DESPLEGABLE A MODAL ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'seleccionar_motivo_ticket') {
            const modal = new ModalBuilder().setCustomId(`modal_abrir_ticket_${interaction.values[0]}`).setTitle(`Ticket: ${interaction.values[0]}`);
            const asuntoInput = new TextInputBuilder().setCustomId('asuntoInput').setLabel("Asunto del Ticket").setPlaceholder("Ej: Problema con la base de datos").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100);
            const descripcionInput = new TextInputBuilder().setCustomId('descripcionInput').setLabel("Describe tu problema detalladamente").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000);
            modal.addComponents(new ActionRowBuilder().addComponents(asuntoInput), new ActionRowBuilder().addComponents(descripcionInput));
            await interaction.showModal(modal);
            // El menú efímero se limpia al enviar el modal (interaction.update en el handler del modal).
        }

        // --- CREACIÓN DEL TICKET DESDE EL MODAL ---
        if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_abrir_ticket_')) {
            const motivo = interaction.customId.replace('modal_abrir_ticket_', '');
            const asunto = interaction.fields.getTextInputValue('asuntoInput');
            const descripcion = interaction.fields.getTextInputValue('descripcionInput');

            // El modal proviene del menú efímero de categorías; update() edita ese mensaje
            // y elimina el desplegable de "selecciona una categoría".
            if (interaction.isFromMessage()) {
                await interaction.update({ content: '⏳ Procesando tu solicitud y creando el canal...', components: [], embeds: [] });
            } else {
                await interaction.reply({ content: '⏳ Procesando tu solicitud y creando el canal...', ephemeral: true });
            }

            try {
                let config = await ServidorConfig.findOne({ guildId: interaction.guildId });
                const listaMotivos = (config && config.motivos && config.motivos.length > 0) ? config.motivos : [];
                const listaUrgencias = (config && config.urgencias && config.urgencias.length > 0) ? config.urgencias : [];
                const urgencia = listaMotivos.find(m => m.nombre === motivo)?.urgencia || 'Normal';
                const colorHex = listaUrgencias.find(u => u.nombre === urgencia)?.color || '#3498db';

                // Límite de tickets abiertos por usuario (0 = sin límite).
                const maxAbiertos = (config && config.maxTicketsAbiertos) || 0;
                if (maxAbiertos > 0) {
                    const abiertos = await Ticket.countDocuments({ guildId: interaction.guild.id, creadorId: interaction.user.id, estado: 'Abierto' });
                    if (abiertos >= maxAbiertos) {
                        return await interaction.editReply({ content: `❌ Has alcanzado el límite de **${maxAbiertos}** ticket(s) abierto(s) a la vez. Cierra alguno antes de abrir otro.` });
                    }
                }

                // Categoría de Discord donde se crea el ticket (si está configurada y existe).
                const parentId = (config && config.categoriaTicketsId && interaction.guild.channels.cache.get(config.categoriaTicketsId))
                    ? config.categoriaTicketsId : null;

                const canalTicket = await interaction.guild.channels.create({
                    name: `ticket-${interaction.user.username}`,
                    type: ChannelType.GuildText,
                    ...(parentId ? { parent: parentId } : {}),
                    permissionOverwrites: [
                        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                    ]
                });

                // AQUÍ ES DONDE DEBE IR LA FOTO:
                const creadorAvatar = interaction.user.displayAvatarURL({ extension: 'png', size: 128 });

                const nuevoTicket = await Ticket.create({
                    guildId: interaction.guild.id,
                    canalId: canalTicket.id,
                    creadorId: interaction.user.id,
                    creadorNombre: interaction.user.username,
                    creadorAvatar: creadorAvatar, // FOTO GUARDADA CORRECTAMENTE EN LA BASE DE DATOS
                    motivo: motivo,
                    titulo: asunto,
                    descripcion: descripcion,
                    prioridad: urgencia,
                    estado: 'Abierto',
                    participantes: [{ id: interaction.user.id, username: interaction.user.username, avatar: creadorAvatar, rol: 'Creador' }],
                    visibleWeb: true
                });

                await registrarLogTicket(nuevoTicket, '🎫 Ticket Abierto', '#2ecc71', interaction.user.username);

                const notaBienvenida = (config && config.mensajeBienvenida) || 'Un miembro del equipo lo revisará en breve.';
                const embedBienvenida = new EmbedBuilder().setTitle(`🎫 ${asunto}`).setDescription(`**Motivo:** ${motivo}\n\n**Descripción del usuario:**\n${descripcion}\n\n*${notaBienvenida}*`).setColor(colorHex).addFields({ name: '🚨 Urgencia', value: `**${urgencia}**`, inline: true });
                const rowBotones = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('reclamar_ticket').setLabel('🙋‍♂️ Reclamar Ticket').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('add_user_prompt').setLabel('➕ Añadir Usuario').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Cerrar Ticket').setStyle(ButtonStyle.Danger)
                );
                
                await canalTicket.send({ content: `¡Hola <@${interaction.user.id}>! Aquí tienes tu ticket. 👇`, embeds: [embedBienvenida], components: [rowBotones] });

                // Aviso opcional al rol de soporte (configurable desde el panel).
                if (config && config.pingSoporte && config.rolSoporteId) {
                    await canalTicket.send({
                        content: `🔔 <@&${config.rolSoporteId}> nuevo ticket de **${interaction.user.username}** (${motivo}).`,
                        allowedMentions: { roles: [config.rolSoporteId] }
                    }).catch(() => {});
                }

                // Asignación automática (round-robin) entre los miembros del rol de soporte.
                if (config && config.autoAsignar && config.rolStaffId) {
                    try {
                        const miembros = await interaction.guild.members.fetch();
                        const agentes = [...miembros.values()].filter(m => !m.user.bot && m.roles.cache.has(config.rolStaffId));
                        if (agentes.length > 0) {
                            const idx = (config.autoAsignarIndex || 0) % agentes.length;
                            const agente = agentes[idx];
                            await ServidorConfig.updateOne({ guildId: interaction.guildId }, { $set: { autoAsignarIndex: idx + 1 } });

                            const avatarAgente = agente.user.displayAvatarURL({ extension: 'png', size: 128 });
                            nuevoTicket.asignadoA = agente.id;
                            nuevoTicket.asignadoNombre = agente.user.username;
                            nuevoTicket.ultimaInteractStaff = new Date();
                            if (!nuevoTicket.participantes.some(p => p.id === agente.id)) {
                                nuevoTicket.participantes.push({ id: agente.id, username: agente.user.username, avatar: avatarAgente, rol: 'Staff' });
                            }
                            await nuevoTicket.save();
                            await registrarLogTicket(nuevoTicket, '🤖 Asignado automáticamente', '#3498db', agente.user.username);
                            await canalTicket.send({ content: `🙋 Asignado automáticamente a <@${agente.id}>.`, allowedMentions: { users: [agente.id] } }).catch(() => {});
                        }
                    } catch (e) { console.error('Error en auto-asignación:', e); }
                }

                await interaction.editReply({ content: `✅ Tu ticket ha sido creado exitosamente: <#${canalTicket.id}>` });
                setTimeout(() => interaction.deleteReply().catch(console.error), 5000);

            } catch (error) { console.error(error); await interaction.editReply({ content: '❌ Hubo un error.' }); }
        }
    }
};
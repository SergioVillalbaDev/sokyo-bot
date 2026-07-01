const { Events, ActionRowBuilder, StringSelectMenuBuilder, ChannelSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder } = require('discord.js');
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
        if (!panel) return interaction.reply({ content: '❌ This panel no longer exists.', ephemeral: true });

        // Verificación: simplemente concede el rol (no se quita).
        if (tipo === 'rp_verify') {
            const rid = panel.items[0]?.roleId;
            if (!rid) return interaction.reply({ content: '❌ This panel has no role set up.', ephemeral: true });
            if (interaction.member.roles.cache.has(rid)) return interaction.reply({ content: '✅ You’re already verified.', ephemeral: true });
            await interaction.member.roles.add(rid).catch(() => {});
            return interaction.reply({ content: '✅ Verified! You now have access to the server.', ephemeral: true });
        }

        const estado = await toggleRol(interaction.member, panel, roleId);
        const rol = interaction.guild.roles.cache.get(roleId);
        const nombre = rol ? rol.name : 'role';
        const msg = estado === 'añadido' ? `✅ You got the **${nombre}** role.`
            : estado === 'quitado' ? `➖ The **${nombre}** role was removed.`
            : estado === 'limite' ? '⚠️ You’ve reached the maximum number of roles for this panel.'
            : `You already have **${nombre}**.`;
        return interaction.reply({ content: msg, ephemeral: true });
    } catch (e) {
        console.error('Error en botón de rol:', e);
        if (!interaction.replied) interaction.reply({ content: '❌ Something went wrong.', ephemeral: true }).catch(() => {});
    }
}

// --- Paneles de roles: menú desplegable ---
async function manejarMenuRol(interaction) {
    try {
        const panelId = interaction.customId.split(':')[1];
        const panel = await RolePanel.findById(panelId);
        if (!panel) return interaction.reply({ content: '❌ This panel no longer exists.', ephemeral: true });
        const { puestos, quitados } = await aplicarSeleccionMenu(interaction.member, panel, interaction.values);
        return interaction.reply({ content: `✅ Roles updated — ${puestos} added, ${quitados} removed.`, ephemeral: true });
    } catch (e) {
        console.error('Error en menú de rol:', e);
        if (!interaction.replied) interaction.reply({ content: '❌ Something went wrong.', ephemeral: true }).catch(() => {});
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
                const msg = { content: '❌ Error running the command.', ephemeral: true };
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
                content: `✅ You bought **${r.item.nombre}** for 🪙 ${r.coste}. You have **${r.balance}** gold left.`,
                ephemeral: true,
            });
        }

        // --- USAR: aplica el efecto del objeto elegido en /usar ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'usar_objeto') {
            const economia = require('../utils/economia.js');
            const RolTemporal = require('../models/RolTemporal.js');
            // El efecto de ROL se aplica aquí porque tenemos servidor + miembro.
            const ctx = {
                aplicarRol: async (rolId, durMin) => {
                    if (!rolId || !interaction.guild) return false;
                    const rol = interaction.guild.roles.cache.get(rolId);
                    if (!rol) return false;
                    try {
                        await interaction.member.roles.add(rolId);
                        if (durMin > 0) {
                            await RolTemporal.create({
                                guildId: interaction.guild.id, userId: interaction.user.id,
                                roleId: rolId, expiraEn: new Date(Date.now() + durMin * 60000),
                            });
                        }
                        return true;
                    } catch { return false; }
                },
            };
            const r = await economia.usarItem(interaction.user.id, interaction.values[0], ctx);
            if (!r.ok) return interaction.reply({ content: `❌ ${r.error}`, ephemeral: true });

            const ef = r.efecto;
            if (ef.tipo === 'caja') {
                const COLOR = { comun: '#2dd4bf', raro: '#38bdf8', epico: '#c084fc', legendario: '#f5b942' };
                const p = r.premio;
                const embed = new EmbedBuilder()
                    .setColor(COLOR[p.rareza] || '#f5b942')
                    .setTitle('🎁 Box opened!')
                    .setDescription(`You opened **${r.item.nombre}** and got…\n\n✨ **${p.nombre}** *(${p.rareza})*`)
                    .setThumbnail(p.imageUrl || null);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
            const msg = ef.tipo === 'xpBoost'
                ? `✨ You used **${r.item.nombre}**: XP **x${ef.multiplicador}** for **${ef.duracionMin} min**! 📈`
                : `✨ You used **${r.item.nombre}**: role activated for **${ef.duracionMin} min**. 🎭`;
            return interaction.reply({ content: msg, ephemeral: true });
        }

        // --- SISTEMA DE ROLES: paneles de autoasignación (se gestionan aparte) ---
        if (interaction.isButton() && (interaction.customId.startsWith('rp_btn:') || interaction.customId.startsWith('rp_verify:'))) {
            return manejarBotonRol(interaction);
        }
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('rp_menu:')) {
            return manejarMenuRol(interaction);
        }

        // --- MÚSICA: botones del panel (⏯️ ⏭️ ⏹️ 🔀 🔉 🔊) ---
        if (interaction.isButton() && interaction.customId.startsWith('music_')) {
            return require('../utils/musica.js').manejarBotonMusica(interaction, client);
        }

        // --- VOZ TEMPORAL: panel de control (botones / modales / selección de usuario) ---
        if (interaction.isButton() && interaction.customId.startsWith('vt:')) {
            return require('../utils/vozTemporal.js').manejarBoton(interaction);
        }
        if (interaction.isModalSubmit() && interaction.customId.startsWith('vt_modal:')) {
            return require('../utils/vozTemporal.js').manejarModal(interaction);
        }
        if (interaction.isUserSelectMenu() && interaction.customId.startsWith('vt_user:')) {
            return require('../utils/vozTemporal.js').manejarSelectUsuario(interaction);
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

        // --- COMUNIDAD: votos, participaciones y presentaciones ---
        if (interaction.isButton() && interaction.customId.startsWith('enc_vote:')) {
            return require('../utils/comunidad.js').manejarVotoEncuesta(interaction);
        }
        if (interaction.isButton() && interaction.customId.startsWith('sorteo_join:')) {
            return require('../utils/comunidad.js').manejarEntradaSorteo(interaction);
        }
        if (interaction.isButton() && (interaction.customId.startsWith('sug_up:') || interaction.customId.startsWith('sug_down:'))) {
            return require('../utils/comunidad.js').manejarVotoSugerencia(interaction);
        }
        if (interaction.isButton() && interaction.customId.startsWith('sug_nueva:')) {
            return require('../utils/comunidad.js').abrirModalSugerencia(interaction);
        }
        if (interaction.isModalSubmit() && interaction.customId.startsWith('sug_modal:')) {
            return require('../utils/comunidad.js').procesarModalSugerencia(interaction);
        }
        if (interaction.isButton() && interaction.customId.startsWith('intro_start:')) {
            return require('../utils/comunidad.js').abrirModalPresentacion(interaction);
        }
        if (interaction.isModalSubmit() && interaction.customId.startsWith('intro_modal:')) {
            return require('../utils/comunidad.js').procesarPresentacion(interaction);
        }

        // --- ONBOARDING: botones del mensaje de bienvenida y !setup ---
        if (interaction.isButton() && interaction.customId.startsWith('setup_estado:')) {
            const guildId = interaction.customId.split(':')[1];
            try {
                const { construirEmbedEstado } = require('../utils/onboarding.js');
                const config = await ServidorConfig.findOne({ guildId });
                const guild = interaction.guild || client.guilds.cache.get(guildId);
                return interaction.reply(construirEmbedEstado(guild, config));
            } catch (e) {
                console.error('Error en setup_estado:', e);
                return interaction.reply({ content: '❌ I couldn’t fetch the status.', flags: 64 });
            }
        }

        if (interaction.isButton() && interaction.customId.startsWith('setup_publicar:')) {
            const guildId = interaction.customId.split(':')[1];
            const menu = new ChannelSelectMenuBuilder()
                .setCustomId(`setup_canal:${guildId}`)
                .setPlaceholder('📢 Pick the channel to post the ticket panel in...')
                .addChannelTypes(ChannelType.GuildText);
            const fila = new ActionRowBuilder().addComponents(menu);
            return interaction.reply({
                content: 'Which channel do you want to post the ticket panel in?\n> Users will click here to open tickets.',
                components: [fila],
                flags: 64,
            });
        }

        if (interaction.isChannelSelectMenu() && interaction.customId.startsWith('setup_canal:')) {
            const guildId = interaction.customId.split(':')[1];
            try {
                await interaction.deferUpdate();
                const config = await ServidorConfig.findOne({ guildId });
                const canal = interaction.channels?.first() || interaction.guild?.channels.cache.get(interaction.values[0]);
                if (!canal) return interaction.editReply({ content: '❌ Channel not found.', components: [] });

                const puedeEscribir = canal.permissionsFor(interaction.guild?.members?.me)?.has(PermissionsBitField.Flags.SendMessages);
                if (!puedeEscribir) {
                    return interaction.editReply({ content: `❌ I don’t have permission to post in <#${canal.id}>.`, components: [] });
                }

                const embedPanel = new EmbedBuilder()
                    .setTitle(config?.mensajeSoporteTitulo || '🎫 Support')
                    .setDescription(config?.mensajeSoporteDescripcion || 'Click the button below to open a ticket.')
                    .setColor(config?.colorEmbed || '#5865F2')
                    .setTimestamp();
                const { aplicarPieMarca } = require('../utils/marca.js');
                aplicarPieMarca(embedPanel, config);

                const boton = new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel(config?.textoBoton || '📩 Open a ticket')
                    .setStyle(ButtonStyle.Primary);
                const filaTicket = new ActionRowBuilder().addComponents(boton);

                await canal.send({ embeds: [embedPanel], components: [filaTicket] });
                return interaction.editReply({
                    content: `✅ Panel posted in <#${canal.id}>! Users can now open tickets.`,
                    components: [],
                });
            } catch (e) {
                console.error('Error en setup_canal:', e);
                return interaction.editReply({ content: '❌ Error posting the panel.', components: [] });
            }
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
                            { nombre: 'Technical issue', urgencia: 'Normal' },
                            { nombre: 'Report a user', urgencia: 'High' },
                            { nombre: 'Billing question', urgencia: 'Low' }
                          ];

                    const menuMotivos = new StringSelectMenuBuilder()
                        .setCustomId('seleccionar_motivo_ticket')
                        .setPlaceholder('👉 Select what your request is about...')
                        .addOptions(
                            listaMotivos.map((motivo) => ({
                                label: motivo.nombre,
                                description: `Assigned priority: ${motivo.urgencia}`,
                                value: motivo.nombre,
                            }))
                        );

                    const filaComponentes = new ActionRowBuilder().addComponents(menuMotivos);

                    await interaction.reply({
                        content: 'Please pick a category so we can help you better:',
                        components: [filaComponentes],
                        ephemeral: true
                    });

                } catch (error) {
                    console.error('Error al mostrar menú de motivos:', error);
                    await interaction.reply({ content: '❌ There was an error processing your request.', ephemeral: true });
                }
            }

            // RECLAMAR TICKET (Guarda al staff en los implicados)
            if (interaction.customId === 'reclamar_ticket') {
                const configStaff = await ServidorConfig.findOne({ guildId: interaction.guildId });
                if (!esStaff(interaction, configStaff)) {
                    return await interaction.reply({ content: '❌ Only the support team can claim this ticket.', ephemeral: true });
                }

                const canalId = interaction.channel.id;
                const ticket = await Ticket.findOne({ canalId: canalId });

                if (!ticket) return await interaction.reply({ content: '❌ This ticket wasn’t found in the database.', ephemeral: true });
                if (ticket.asignadoA) return await interaction.reply({ content: `⚠️ This ticket is already being handled by **${ticket.asignadoNombre}**.`, ephemeral: true });

                const staffAvatar = interaction.user.displayAvatarURL({ extension: 'png', size: 128 });
                
                if (!ticket.participantes) ticket.participantes = [];
                if (!ticket.participantes.some(p => p.id === interaction.user.id)) {
                    ticket.participantes.push({ id: interaction.user.id, username: interaction.user.username, avatar: staffAvatar, rol: 'Staff' });
                }

                ticket.asignadoA = interaction.user.id;
                ticket.asignadoNombre = interaction.user.username;
                ticket.ultimaInteractStaff = new Date();
                await ticket.save();

                await registrarLogTicket(client, ticket, '🙋 Ticket claimed', '#3498db', interaction.user.username);

                const embedOriginal = interaction.message.embeds[0];
                const embedModificado = EmbedBuilder.from(embedOriginal).addFields({ name: '👀 Handled by', value: `🙋‍♂️ ${interaction.user.username}`, inline: true });

                const filaOriginal = interaction.message.components[0];
                const filaModificada = ActionRowBuilder.from(filaOriginal);
                filaModificada.components[0].setDisabled(true); 

                await interaction.update({ embeds: [embedModificado], components: [filaModificada] });
                await interaction.followUp({ content: `📢 Support agent **${interaction.user.username}** has taken over this ticket.` });
            }

            // AÑADIR USUARIO AL TICKET
            if (interaction.customId === 'add_user_prompt') {
                const configAdd = await ServidorConfig.findOne({ guildId: interaction.guildId });
                if (!esStaff(interaction, configAdd)) {
                    return await interaction.reply({ content: '❌ Only the support team can invite other people.', ephemeral: true });
                }

                const userSelect = new UserSelectMenuBuilder().setCustomId('add_user_select').setPlaceholder('🔍 Search and select a user...').setMinValues(1).setMaxValues(1);
                const row = new ActionRowBuilder().addComponents(userSelect);
                await interaction.reply({ content: 'Choose the user you want to invite to this ticket:', components: [row], ephemeral: true });
            }

            // CERRAR TICKET (transcript + CSAT + archivado, vía módulo compartido)
            if (interaction.customId === 'close_ticket') {
                const canal = interaction.channel;
                if (!canal) return await interaction.reply({ content: '❌ The channel couldn’t be found.', ephemeral: true });

                // Puede cerrar: el staff (rol/permiso) o el propio creador del ticket.
                const configClose = await ServidorConfig.findOne({ guildId: interaction.guildId });
                const ticketClose = await Ticket.findOne({ canalId: canal.id });
                const esCreador = ticketClose && ticketClose.creadorId === interaction.user.id;
                if (!esStaff(interaction, configClose) && !esCreador) {
                    return await interaction.reply({ content: '❌ You don’t have permission to close this ticket.', ephemeral: true });
                }

                await interaction.reply({ content: '🔒 Saving a backup and closing the ticket...', ephemeral: true });

                try {
                    const res = await cerrarTicket(client, canal.id, { autor: interaction.user.username });
                    if (!res.ok) return await interaction.editReply({ content: '❌ This ticket wasn’t found in the database.' });
                    await interaction.editReply({ content: '✅ Ticket closed and archived successfully.' });
                } catch (error) {
                    console.error('Error al cerrar:', error);
                    await interaction.editReply({ content: '❌ There was an error closing the ticket.' }).catch(() => {});
                }
            }

            if (interaction.customId.startsWith('csat_')) {
                const partes = interaction.customId.split('_');
                const valoracion = parseInt(partes[1]);
                try {
                    const ticket = await Ticket.findOneAndUpdate({ canalId: partes[2] }, { valoracionCSAT: valoracion }, { new: true });
                    if (ticket) await registrarLogTicket(client, ticket, `⭐ Ticket rated (${valoracion}/5)`, '#f1c40f', ticket.creadorNombre);
                    const embedGracias = new EmbedBuilder().setColor('#2ecc71').setTitle('💖 Thanks for your feedback!').setDescription(`You rated the support you received with **${valoracion} stars**.`);
                    await interaction.update({ embeds: [embedGracias], components: [] });
                } catch (e) { await interaction.reply({ content: 'Error saving.', ephemeral: true }); }
            }
        }

        // --- LÓGICA DE SELECCIÓN DE USUARIO (Guardar en DB) ---
        if (interaction.isUserSelectMenu() && interaction.customId === 'add_user_select') {
            const userIdToAdd = interaction.values[0];
            const canal = interaction.channel;

            try {
                await canal.permissionOverwrites.edit(userIdToAdd, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
                await interaction.update({ content: `✅ Permissions granted.`, components: [] });
                await canal.send({ content: `👋 <@${userIdToAdd}> was added to the conversation by <@${interaction.user.id}>.` });

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
            const asuntoInput = new TextInputBuilder().setCustomId('asuntoInput').setLabel("Ticket subject").setPlaceholder("e.g. Problem with the database").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100);
            const descripcionInput = new TextInputBuilder().setCustomId('descripcionInput').setLabel("Describe your problem in detail").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000);
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
                await interaction.update({ content: '⏳ Processing your request and creating the channel...', components: [], embeds: [] });
            } else {
                await interaction.reply({ content: '⏳ Processing your request and creating the channel...', ephemeral: true });
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
                        return await interaction.editReply({ content: `❌ You’ve reached the limit of **${maxAbiertos}** open ticket(s) at once. Close one before opening another.` });
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

                await registrarLogTicket(client, nuevoTicket, '🎫 Ticket opened', '#2ecc71', interaction.user.username);

                const notaBienvenida = (config && config.mensajeBienvenida) || 'A team member will review it shortly.';
                const embedBienvenida = new EmbedBuilder().setTitle(`🎫 ${asunto}`).setDescription(`**Reason:** ${motivo}\n\n**User’s description:**\n${descripcion}\n\n*${notaBienvenida}*`).setColor(colorHex).addFields({ name: '🚨 Priority', value: `**${urgencia}**`, inline: true });
                const rowBotones = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('reclamar_ticket').setLabel('🙋‍♂️ Claim ticket').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('add_user_prompt').setLabel('➕ Add user').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close ticket').setStyle(ButtonStyle.Danger)
                );

                await canalTicket.send({ content: `Hi <@${interaction.user.id}>! Here’s your ticket. 👇`, embeds: [embedBienvenida], components: [rowBotones] });

                // Aviso opcional al rol de soporte (configurable desde el panel).
                if (config && config.pingSoporte && config.rolSoporteId) {
                    await canalTicket.send({
                        content: `🔔 <@&${config.rolSoporteId}> new ticket from **${interaction.user.username}** (${motivo}).`,
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
                            await registrarLogTicket(client, nuevoTicket, '🤖 Auto-assigned', '#3498db', agente.user.username);
                            await canalTicket.send({ content: `🙋 Automatically assigned to <@${agente.id}>.`, allowedMentions: { users: [agente.id] } }).catch(() => {});
                        }
                    } catch (e) { console.error('Error en auto-asignación:', e); }
                }

                await interaction.editReply({ content: `✅ Your ticket was created successfully: <#${canalTicket.id}>` });
                setTimeout(() => interaction.deleteReply().catch(console.error), 5000);

            } catch (error) { console.error(error); await interaction.editReply({ content: '❌ Something went wrong.' }); }
        }
    }
};
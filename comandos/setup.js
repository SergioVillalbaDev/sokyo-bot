const {
    SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, InteractionContextType,
    MessageFlags, EmbedBuilder
} = require('discord.js');
const { obtenerConfig } = require('../utils/config.js');
const { mensajePanel } = require('../utils/aperturaTickets.js');
const { urlInvitacion } = require('../utils/marca.js');
const { registrarLog } = require('../utils/logs.js');

const P = PermissionsBitField.Flags;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Configura Sokyo en 1 minuto: equipo, categoría de tickets, logs y panel')
        .addRoleOption(o => o.setName('rol_staff').setDescription('Rol del equipo que atenderá los tickets').setRequired(true))
        .addChannelOption(o => o.setName('canal_panel').setDescription('Canal donde publicar el botón para abrir tickets (por defecto, este)').addChannelTypes(ChannelType.GuildText))
        .addChannelOption(o => o.setName('categoria').setDescription('Categoría donde crear los tickets (si no eliges, se crea una)').addChannelTypes(ChannelType.GuildCategory))
        .addChannelOption(o => o.setName('canal_logs').setDescription('Canal de logs (si no eliges, se crea uno privado para el staff)').addChannelTypes(ChannelType.GuildText))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setContexts(InteractionContextType.Guild),

    async execute(interaction, client) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const guild = interaction.guild;
        const yo = guild.members.me;

        const faltan = [['Gestionar canales', P.ManageChannels], ['Gestionar roles', P.ManageRoles]]
            .filter(([, flag]) => !yo.permissions.has(flag)).map(([nombre]) => nombre);
        if (faltan.length > 0) {
            const url = urlInvitacion(client.application?.id, guild.id);
            return interaction.editReply(`❌ Al bot le faltan permisos: **${faltan.join(', ')}**.\nDáselos a su rol${url ? ` o vuelve a invitarlo con este enlace: ${url}` : ''}.`);
        }

        const rol = interaction.options.getRole('rol_staff');
        if (rol.id === guild.id || rol.managed) {
            return interaction.editReply('❌ Elige un rol normal del equipo (no @everyone ni el rol de un bot).');
        }

        const config = await obtenerConfig(guild.id);
        config.rolesStaff = [rol.id, ...config.rolesStaff.filter(id => id !== rol.id && guild.roles.cache.has(id))];
        const pasos = [`👥 **Equipo:** ${rol} atenderá los tickets.`];

        // 1. Categoría de tickets
        let categoria = interaction.options.getChannel('categoria');
        if (!categoria) {
            const actual = guild.channels.cache.get(config.categoriaTicketsId);
            categoria = actual && actual.type === ChannelType.GuildCategory ? actual : await guild.channels.create({
                name: '🎫 Tickets',
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    { id: guild.id, deny: [P.ViewChannel] },
                    { id: yo.id, allow: [P.ViewChannel, P.ManageChannels, P.SendMessages] },
                    { id: rol.id, allow: [P.ViewChannel] }
                ]
            });
        }
        config.categoriaTicketsId = categoria.id;
        pasos.push(`📁 **Categoría de tickets:** ${categoria.name}`);

        // 2. Canal de logs
        let logs = interaction.options.getChannel('canal_logs');
        if (!logs) {
            const actual = guild.channels.cache.get(config.canalLogsId);
            logs = actual && actual.isTextBased() ? actual : await guild.channels.create({
                name: 'sokyo-logs',
                type: ChannelType.GuildText,
                topic: 'Registro de actividad de Sokyo (tickets, mensajes borrados/editados, entradas y salidas).',
                permissionOverwrites: [
                    { id: guild.id, deny: [P.ViewChannel] },
                    { id: yo.id, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks] },
                    { id: rol.id, allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages] }
                ]
            });
        }
        config.canalLogsId = logs.id;
        pasos.push(`📜 **Logs:** ${logs}`);
        await config.save();

        // 3. Publicar el panel
        const canalPanel = interaction.options.getChannel('canal_panel') || interaction.channel;
        const puedePublicar = canalPanel.permissionsFor(yo)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks]);
        if (puedePublicar) {
            const mensaje = await canalPanel.send(mensajePanel(config, config.paneles[0], client));
            pasos.push(`📩 **Panel publicado:** ${mensaje.url}`);
        } else {
            pasos.push(`⚠️ **Panel:** no tengo permiso para escribir en ${canalPanel}. Usa \`/panel\` en otro canal.`);
        }

        await registrarLog(client, {
            guildId: guild.id, categoria: 'Configuración', accion: '⚙️ Sokyo configurado con /setup',
            usuario: interaction.user.username, detalles: `Rol de staff: @${rol.name}`, color: '#5865F2'
        });

        const web = process.env.FRONTEND_URL;
        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('✅ ¡Sokyo está listo!')
            .setDescription(pasos.join('\n'))
            .addFields({
                name: 'Siguientes pasos',
                value: [
                    web ? `• Personaliza formularios, paneles e IA en el **panel web**: ${web}` : '• Personaliza formularios, paneles e IA en el panel web.',
                    '• Añade preguntas frecuentes en el panel para que la IA responda sola las dudas repetidas.',
                    '• Publica más paneles en otros canales con `/panel`.'
                ].join('\n')
            });
        return interaction.editReply({ content: '', embeds: [embed] });
    }
};

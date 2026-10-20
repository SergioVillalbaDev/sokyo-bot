const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, InteractionContextType, MessageFlags, EmbedBuilder } = require('discord.js');
const { obtenerConfig, actualizarConfig } = require('../utils/config.js');
const { sincronizarRolStaff } = require('../utils/ticketManager.js');

const EFIMERO = { flags: MessageFlags.Ephemeral };
const MAX_ROLES_STAFF = 10;
const NOMBRES_MODULOS = {
    valoraciones: 'Encuesta de satisfacción',
    transcriptDM: 'Transcript por DM',
    mencionarStaff: 'Mencionar al staff',
    logsMensajes: 'Auditoría de mensajes',
    logsMiembros: 'Auditoría de miembros'
};

const mencionCanal = (id) => id ? `<#${id}>` : '*Sin configurar*';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Configura el sistema de tickets de este servidor')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(sub => sub.setName('ver').setDescription('Muestra la configuración actual'))
        .addSubcommand(sub => sub.setName('rol-staff').setDescription('Añade o quita un rol del equipo de soporte')
            .addRoleOption(o => o.setName('rol').setDescription('Rol del staff (si ya lo es, se quita)').setRequired(true)))
        .addSubcommand(sub => sub.setName('categoria').setDescription('Categoría donde se crean los tickets nuevos')
            .addChannelOption(o => o.setName('categoria').setDescription('Déjalo vacío para crearlos fuera de cualquier categoría').addChannelTypes(ChannelType.GuildCategory)))
        .addSubcommand(sub => sub.setName('transcripts').setDescription('Canal donde se guarda el transcript de cada ticket cerrado')
            .addChannelOption(o => o.setName('canal').setDescription('Déjalo vacío para desactivarlo').addChannelTypes(ChannelType.GuildText)))
        .addSubcommand(sub => sub.setName('logs').setDescription('Canal donde se publica la auditoría del servidor')
            .addChannelOption(o => o.setName('canal').setDescription('Déjalo vacío para desactivarlo').addChannelTypes(ChannelType.GuildText)))
        .addSubcommand(sub => sub.setName('limite').setDescription('Tickets que puede tener abiertos a la vez cada usuario')
            .addIntegerOption(o => o.setName('cantidad').setDescription('Entre 1 y 10').setMinValue(1).setMaxValue(10).setRequired(true))),

    async execute(interaction, client) {
        const guildId = interaction.guildId;
        const sub = interaction.options.getSubcommand();

        if (sub === 'ver') {
            const config = await obtenerConfig(guildId);
            const roles = (config.rolesStaff || []).map(id => `<@&${id}>`).join(' ') || '*Solo administradores*';
            const modulos = Object.entries(NOMBRES_MODULOS)
                .map(([clave, nombre]) => `${config.modulos?.[clave] !== false ? '✅' : '❌'} ${nombre}`).join('\n');
            const panel = config.panelCanalId && config.panelMensajeId
                ? `[Ver mensaje](https://discord.com/channels/${guildId}/${config.panelCanalId}/${config.panelMensajeId})`
                : '*No publicado — usa /panel*';

            const embed = new EmbedBuilder()
                .setColor(config.colorPanel || '#5865F2')
                .setTitle(`⚙️ Configuración de ${interaction.guild.name}`)
                .addFields(
                    { name: '🛡️ Roles de staff', value: roles },
                    { name: '📁 Categoría de tickets', value: mencionCanal(config.categoriaTicketsId), inline: true },
                    { name: '📄 Canal de transcripts', value: mencionCanal(config.canalTranscriptsId), inline: true },
                    { name: '📜 Canal de auditoría', value: mencionCanal(config.canalLogsId), inline: true },
                    { name: '🎫 Tickets por usuario', value: String(config.maxTicketsPorUsuario || 1), inline: true },
                    { name: '🏷️ Categorías', value: String(config.motivos?.length || 0), inline: true },
                    { name: '📌 Panel de soporte', value: panel, inline: true },
                    { name: '🔌 Módulos', value: modulos },
                    { name: '💎 Plan', value: config.premiumActivo() ? '⭐ Premium' : 'Gratuito', inline: true }
                )
                .setFooter({ text: 'Los textos, categorías y módulos se editan desde el panel web.' });
            return interaction.reply({ embeds: [embed], ...EFIMERO });
        }

        if (sub === 'rol-staff') {
            const rol = interaction.options.getRole('rol');
            if (rol.id === guildId) return interaction.reply({ content: '❌ @everyone no puede ser un rol de staff.', ...EFIMERO });
            const config = await obtenerConfig(guildId);
            const actuales = config.rolesStaff || [];
            const quitar = actuales.includes(rol.id);
            if (!quitar && actuales.length >= MAX_ROLES_STAFF) {
                return interaction.reply({ content: `❌ Máximo ${MAX_ROLES_STAFF} roles de staff.`, ...EFIMERO });
            }
            await actualizarConfig(guildId, { rolesStaff: quitar ? actuales.filter(id => id !== rol.id) : [...actuales, rol.id] });
            sincronizarRolStaff(client, guildId, rol.id, !quitar).catch(e => console.warn('Sincronizando rol de staff:', e.message));
            return interaction.reply({
                content: quitar
                    ? `✅ ${rol} ya no forma parte del staff.`
                    : `✅ ${rol} ahora es staff: verá los tickets y podrá gestionarlos.`,
                allowedMentions: { parse: [] },
                ...EFIMERO
            });
        }

        if (sub === 'categoria') {
            const categoria = interaction.options.getChannel('categoria');
            await actualizarConfig(guildId, { categoriaTicketsId: categoria?.id ?? null });
            return interaction.reply({ content: categoria ? `✅ Los tickets nuevos se crearán en **${categoria.name}**.` : '✅ Los tickets nuevos se crearán sin categoría.', ...EFIMERO });
        }

        if (sub === 'transcripts' || sub === 'logs') {
            const canal = interaction.options.getChannel('canal');
            if (canal && !canal.permissionsFor(interaction.guild.members.me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles])) {
                return interaction.reply({ content: `❌ No puedo escribir ni adjuntar archivos en ${canal}.`, ...EFIMERO });
            }
            const campo = sub === 'transcripts' ? 'canalTranscriptsId' : 'canalLogsId';
            await actualizarConfig(guildId, { [campo]: canal?.id ?? null });
            const que = sub === 'transcripts' ? 'Los transcripts' : 'La auditoría';
            return interaction.reply({ content: canal ? `✅ ${que} se publicarán en ${canal}.` : `✅ ${que} ya no se publicarán en ningún canal.`, ...EFIMERO });
        }

        if (sub === 'limite') {
            const cantidad = interaction.options.getInteger('cantidad');
            await actualizarConfig(guildId, { maxTicketsPorUsuario: cantidad });
            return interaction.reply({ content: `✅ Cada usuario podrá tener hasta **${cantidad}** ticket(s) abierto(s) a la vez.`, ...EFIMERO });
        }
    }
};

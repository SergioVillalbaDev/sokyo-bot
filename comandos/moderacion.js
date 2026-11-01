// /warn /mute /unmute /kick /ban /unban /sanciones
// Toda la lógica (permisos, jerarquía, auditoría) vive en utils/moderacion.js y es la misma que usa el panel web.
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { ejecutarSancion, listarSanciones, META } = require('../utils/moderacion.js');
const { exigir, EPH } = require('../utils/accesos.js');
const { parseDuracion, formatDuracion } = require('../utils/helpers.js');

const base = (nombre, desc, flag) => new SlashCommandBuilder()
    .setName(nombre).setDescription(desc)
    .setDefaultMemberPermissions(flag)
    .setContexts(InteractionContextType.Guild);

const opcionUsuario = (o) => o.setName('usuario').setDescription('Usuario objetivo').setRequired(true);
const opcionRazon = (o) => o.setName('razon').setDescription('Motivo de la acción').setMaxLength(400);

function comandoSancion(tipo, data, extra) {
    return {
        data,
        async execute(interaction, client) {
            await interaction.deferReply({ flags: EPH });
            const duracionTxt = interaction.options.getString('duracion');
            const duracionMs = duracionTxt ? parseDuracion(duracionTxt) : null;
            if (duracionTxt && !duracionMs) return interaction.editReply('❌ Duración no válida. Ejemplos: `10m`, `2h`, `1d`, `1h30m`.');

            const objetivo = interaction.options.getUser('usuario');
            const resultado = await ejecutarSancion(client, {
                guildId: interaction.guildId,
                tipo,
                actorMember: interaction.member,
                objetivoId: objetivo.id,
                razon: interaction.options.getString('razon'),
                duracionMs,
                diasBorrar: interaction.options.getInteger('dias') || 0,
                origen: 'discord'
            });
            if (!resultado.ok) return interaction.editReply(`❌ ${resultado.error}`);

            const m = META[tipo];
            const embed = new EmbedBuilder().setColor(m.color)
                .setDescription(`${m.emoji} **${m.texto}:** ${objetivo} (\`${objetivo.username}\`)${duracionMs ? `\n⏱️ Duración: **${formatDuracion(duracionMs)}**` : ''}\n📝 ${interaction.options.getString('razon') || 'Sin razón especificada'}`);
            await interaction.editReply({ embeds: [embed] });
        },
        ...extra
    };
}

const warn = comandoSancion('warn', base('warn', 'Avisa a un usuario (queda en su historial)', PermissionFlagsBits.ModerateMembers).addUserOption(opcionUsuario).addStringOption(opcionRazon));
const mute = comandoSancion('mute', base('mute', 'Silencia temporalmente a un usuario', PermissionFlagsBits.ModerateMembers).addUserOption(opcionUsuario)
    .addStringOption(o => o.setName('duracion').setDescription('Ej: 10m, 2h, 1d (máx. 28d)').setRequired(true)).addStringOption(opcionRazon));
const unmute = comandoSancion('unmute', base('unmute', 'Quita el silencio a un usuario', PermissionFlagsBits.ModerateMembers).addUserOption(opcionUsuario).addStringOption(opcionRazon));
const kick = comandoSancion('kick', base('kick', 'Expulsa a un usuario del servidor', PermissionFlagsBits.KickMembers).addUserOption(opcionUsuario).addStringOption(opcionRazon));
const ban = comandoSancion('ban', base('ban', 'Banea a un usuario', PermissionFlagsBits.BanMembers).addUserOption(opcionUsuario).addStringOption(opcionRazon)
    .addIntegerOption(o => o.setName('dias').setDescription('Días de mensajes a borrar (0-7)').setMinValue(0).setMaxValue(7)));
const unban = comandoSancion('unban', base('unban', 'Quita el ban a un usuario', PermissionFlagsBits.BanMembers).addUserOption(opcionUsuario).addStringOption(opcionRazon));

const sanciones = {
    data: base('sanciones', 'Historial de sanciones de un usuario', PermissionFlagsBits.ModerateMembers).addUserOption(opcionUsuario),
    async execute(interaction) {
        if (!(await exigir(interaction, 'mod.historial'))) return;
        const objetivo = interaction.options.getUser('usuario');
        const lista = await listarSanciones(interaction.guildId, objetivo.id, 10);
        if (lista.length === 0) return interaction.reply({ content: `✅ **${objetivo.username}** tiene el historial limpio.`, flags: EPH });
        const lineas = lista.map(s => `${META[s.tipo].emoji} **${META[s.tipo].texto}** · <t:${Math.floor(s.fecha.getTime() / 1000)}:d> · por ${s.moderadorNombre}\n└ ${s.razon.slice(0, 120)}`);
        const embed = new EmbedBuilder().setColor('#e67e22').setTitle(`📜 Sanciones de ${objetivo.username}`).setDescription(lineas.join('\n').slice(0, 4000));
        await interaction.reply({ embeds: [embed], flags: EPH });
    }
};

module.exports = { comandos: [warn, mute, unmute, kick, ban, unban, sanciones] };

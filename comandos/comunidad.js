// /sugerir, /encuesta, /sugerencia resolver, /setup-verificacion
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, InteractionContextType } = require('discord.js');
const Votacion = require('../models/Votacion.js');
const { obtenerConfig, exigir, EPH } = require('../utils/accesos.js');
const { embedVotacion, filaVotacion } = require('../utils/votaciones.js');

const sugerir = {
    data: new SlashCommandBuilder().setName('sugerir').setDescription('Envía una sugerencia para el servidor').setContexts(InteractionContextType.Guild)
        .addStringOption(o => o.setName('idea').setDescription('Tu sugerencia').setRequired(true).setMaxLength(1500)),
    async execute(interaction) {
        const config = await obtenerConfig(interaction.guildId);
        const canal = config.sugerenciasCanalId && interaction.guild.channels.cache.get(config.sugerenciasCanalId);
        if (!canal) return interaction.reply({ content: '❌ Este servidor no tiene configurado un canal de sugerencias.', flags: EPH });

        const datos = { guildId: interaction.guildId, tipo: 'sugerencia', canalId: canal.id, autorId: interaction.user.id, autorNombre: interaction.user.username,
            texto: interaction.options.getString('idea'), opciones: [{ texto: 'A favor', votos: [] }, { texto: 'En contra', votos: [] }] };
        const v = new Votacion({ ...datos, mensajeId: 'pendiente' });
        const msg = await canal.send({ embeds: [embedVotacion(v)], components: [filaVotacion(v)] });
        v.mensajeId = msg.id;
        await v.save();
        await interaction.reply({ content: `✅ ¡Sugerencia enviada a ${canal}!`, flags: EPH });
    }
};

const encuesta = {
    data: (() => {
        const b = new SlashCommandBuilder().setName('encuesta').setDescription('Crea una encuesta con botones').setContexts(InteractionContextType.Guild)
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .addStringOption(o => o.setName('pregunta').setDescription('La pregunta').setRequired(true).setMaxLength(300))
            .addStringOption(o => o.setName('opcion1').setDescription('Opción 1').setRequired(true).setMaxLength(60))
            .addStringOption(o => o.setName('opcion2').setDescription('Opción 2').setRequired(true).setMaxLength(60));
        for (let i = 3; i <= 5; i++) b.addStringOption(o => o.setName(`opcion${i}`).setDescription(`Opción ${i}`).setMaxLength(60));
        return b;
    })(),
    async execute(interaction) {
        if (!(await exigir(interaction, 'comunidad.sugerencias'))) return;
        const opciones = [1, 2, 3, 4, 5].map(i => interaction.options.getString(`opcion${i}`)).filter(Boolean).map(texto => ({ texto, votos: [] }));
        const v = new Votacion({ guildId: interaction.guildId, tipo: 'encuesta', canalId: interaction.channelId, mensajeId: 'pendiente',
            autorId: interaction.user.id, autorNombre: interaction.user.username, texto: interaction.options.getString('pregunta'), opciones });
        const msg = await interaction.channel.send({ embeds: [embedVotacion(v)], components: [filaVotacion(v)] });
        v.mensajeId = msg.id;
        await v.save();
        await interaction.reply({ content: '✅ Encuesta publicada.', flags: EPH });
    }
};

const sugerencia = {
    data: new SlashCommandBuilder().setName('sugerencia').setDescription('Gestión de sugerencias (staff)').setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(s => s.setName('resolver').setDescription('Aprueba o rechaza una sugerencia')
            .addStringOption(o => o.setName('mensaje_id').setDescription('ID del mensaje de la sugerencia').setRequired(true))
            .addStringOption(o => o.setName('estado').setDescription('Resultado').setRequired(true).addChoices({ name: 'Aprobada', value: 'aprobada' }, { name: 'Rechazada', value: 'rechazada' }))
            .addStringOption(o => o.setName('motivo').setDescription('Comentario del equipo').setMaxLength(500))),
    async execute(interaction) {
        if (!(await exigir(interaction, 'comunidad.sugerencias'))) return;
        const v = await Votacion.findOne({ guildId: interaction.guildId, mensajeId: interaction.options.getString('mensaje_id'), tipo: 'sugerencia' });
        if (!v) return interaction.reply({ content: '❌ No encuentro esa sugerencia.', flags: EPH });
        v.estado = interaction.options.getString('estado');
        v.resolucion = `${interaction.options.getString('motivo') || 'Sin comentarios'} — ${interaction.user.username}`;
        await v.save();
        const canal = interaction.guild.channels.cache.get(v.canalId);
        const msg = await canal?.messages.fetch(v.mensajeId).catch(() => null);
        if (msg) await msg.edit({ embeds: [embedVotacion(v)], components: [filaVotacion(v)] });
        await interaction.reply({ content: `✅ Sugerencia marcada como **${v.estado}**.`, flags: EPH });
    }
};

const setupVerificacion = {
    data: new SlashCommandBuilder().setName('setup-verificacion').setDescription('Publica el botón de verificación en este canal').setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
        if (!(await exigir(interaction, 'config.comunidad'))) return;
        const config = await obtenerConfig(interaction.guildId);
        if (!config.bienvenida?.verificacionActiva || !config.bienvenida?.verificacionRolId) {
            return interaction.reply({ content: '⚠️ Primero activa la verificación y elige el rol en el panel (Comunidad).', flags: EPH });
        }
        const embed = new EmbedBuilder().setColor('#3ba55d').setTitle('✅ Verificación').setDescription('Pulsa el botón de abajo para verificarte y acceder al resto del servidor.');
        const fila = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('verificar').setLabel('Verificarme').setEmoji('✅').setStyle(ButtonStyle.Success));
        await interaction.channel.send({ embeds: [embed], components: [fila] });
        await interaction.reply({ content: '✅ Mensaje de verificación publicado.', flags: EPH });
    }
};

module.exports = { comandos: [sugerir, encuesta, sugerencia, setupVerificacion] };

const { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, InteractionContextType, ActionRowBuilder } = require('discord.js');
const setup = require('../utils/setupRapido.js');
const { botonPanel } = require('../utils/enlacesPanel.js');
const { t } = require('../utils/i18n.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });
const PERMISO_ES = { ManageChannels: 'Gestionar canales', ManageMessages: 'Gestionar mensajes', ModerateMembers: 'Aislar temporalmente a miembros' };

// /setup-rapido — las preguntas son las opciones del comando; con eso Sokyo queda
// funcionando (utils/setupRapido.js). Solo administradores.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('quicksetup')
        .setNameLocalizations(ES('setup-rapido'))
        .setDescription('Get Sokyo working on this server in one go')
        .setDescriptionLocalizations(ES('Deja Sokyo funcionando en este servidor de una vez'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setContexts(InteractionContextType.Guild)
        .addStringOption((o) => o.setName('language').setNameLocalizations(ES('idioma')).setRequired(true)
            .setDescription('Language the bot will speak on this server').setDescriptionLocalizations(ES('Idioma en el que hablará el bot en este servidor'))
            .addChoices({ name: 'Español', value: 'es' }, { name: 'English', value: 'en' }))
        .addStringOption((o) => o.setName('type').setNameLocalizations(ES('tipo')).setRequired(true)
            .setDescription('What kind of server is it?').setDescriptionLocalizations(ES('¿Qué tipo de servidor es?'))
            .addChoices(
                { name: '🎮 Gaming', name_localizations: ES('🎮 Gaming / juegos'), value: 'gaming' },
                { name: '💬 Community', name_localizations: ES('💬 Comunidad / amigos'), value: 'comunidad' },
                { name: '📺 Content creator', name_localizations: ES('📺 Creador de contenido'), value: 'creador' },
                { name: '📚 Study / work', name_localizations: ES('📚 Estudio / trabajo'), value: 'estudio' },
                { name: '🛟 Support / business', name_localizations: ES('🛟 Soporte / empresa'), value: 'soporte' },
            ))
        .addRoleOption((o) => o.setName('staff_role').setNameLocalizations(ES('rol_staff'))
            .setDescription('Your staff role (sees tickets and the log)').setDescriptionLocalizations(ES('El rol de tu staff (ve los tickets y el registro)')))
        .addBooleanOption((o) => o.setName('tickets').setDescription('Support tickets (yes/no; by default depends on the type)')
            .setDescriptionLocalizations(ES('Tickets de soporte (sí/no; por defecto según el tipo)')))
        .addBooleanOption((o) => o.setName('levels').setNameLocalizations(ES('niveles')).setDescription('Levels, XP and monthly seasons (yes/no)')
            .setDescriptionLocalizations(ES('Niveles, XP y temporadas mensuales (sí/no)')))
        .addBooleanOption((o) => o.setName('automod').setDescription('Basic automod: spam, invites, mass mentions, scams (yes/no)')
            .setDescriptionLocalizations(ES('Automod básico: spam, invitaciones, menciones masivas, estafas (sí/no)')))
        .addBooleanOption((o) => o.setName('fun').setNameLocalizations(ES('diversion')).setDescription('Pet, casino, pranks, League and clans (yes/no)')
            .setDescriptionLocalizations(ES('Mascota, casino, bromas, Liga y clanes (sí/no)'))),

    async execute(interaction, client) {
        const idioma = interaction.options.getString('language') === 'es' ? 'es' : 'en';
        if (!interaction.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: t(idioma, '❌ Solo un administrador puede hacer el setup rápido.', '❌ Only an administrator can run the quick setup.'), flags: 64 });
        }
        const tipo = interaction.options.getString('type');
        const modulos = new Set(setup.recomendados(tipo));
        const elegir = (opcion, mods) => {
            const v = interaction.options.getBoolean(opcion);
            if (v === true) mods.forEach((m) => modulos.add(m));
            if (v === false) mods.forEach((m) => modulos.delete(m));
        };
        elegir('tickets', ['tickets']);
        elegir('levels', ['niveles', 'temporadas']);
        elegir('automod', ['automod']);
        elegir('fun', ['mascota', 'casino', 'bromas', 'liga', 'clanes']);
        const rol = interaction.options.getRole('staff_role');
        const { respuestas, error } = setup.validar({ idioma, tipo, modulos: [...modulos], rolStaffId: rol ? rol.id : null }, interaction.guild);
        if (error) return interaction.reply({ content: `❌ ${error}`, flags: 64 });

        const faltan = setup.permisosQueFaltan(interaction.guild, respuestas);
        if (faltan.length) {
            const lista = faltan.map((p) => `«${idioma === 'es' ? PERMISO_ES[p] || p : p}»`).join(', ');
            return interaction.reply({ content: t(idioma, `❌ Al bot le faltan permisos: ${lista}. Dáselos en Ajustes del servidor → Roles y vuelve a probar.`, `❌ The bot is missing permissions: ${lista}. Grant them in Server Settings → Roles and try again.`), flags: 64 });
        }
        if (!setup.puedePasar(interaction.guild.id)) {
            return interaction.reply({ content: t(idioma, '⏳ Espera un minuto antes de volver a pasar el setup rápido.', '⏳ Wait a minute before running the quick setup again.'), flags: 64 });
        }

        await interaction.deferReply({ flags: 64 });
        const resultado = await setup.aplicar(client, interaction.guild, respuestas);
        const creados = resultado.creados.length
            ? `\n\n${t(idioma, '🆕 Canales creados', '🆕 Channels created')}: ${resultado.creados.map((c) => `<#${c.id}>`).join(' ')}`
            : '';
        const fila = new ActionRowBuilder().addComponents(botonPanel(idioma, null, t(idioma, 'Afinarlo en el panel', 'Fine-tune it in the panel')));
        return interaction.editReply({
            content: `${t(idioma, '⚡ **¡Sokyo ya está funcionando!**', '⚡ **Sokyo is up and running!**')}\n\n${setup.resumenTexto(idioma, resultado)}${creados}`.slice(0, 2000),
            components: [fila],
        });
    },
};

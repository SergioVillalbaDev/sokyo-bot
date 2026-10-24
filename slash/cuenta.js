const { SlashCommandBuilder } = require('discord.js');
const { mensajeAcceso } = require('../utils/cuenta.js');
const { resolverIdioma } = require('../utils/i18n.js');

// "Mi cuenta" en un clic: un botón privado que abre la web con la sesión ya
// iniciada (utils/cuenta.js). Funciona en cualquier servidor y por MD.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('account')
        .setNameLocalizations({ 'es-ES': 'cuenta', 'es-419': 'cuenta' })
        .setDescription('Open your Sokyo account on the web in one click (tickets, shop, music, card)')
        .setDescriptionLocalizations({ 'es-ES': 'Abre tu cuenta de Sokyo en la web con un clic (tickets, tienda, música, tarjeta)', 'es-419': 'Abre tu cuenta de Sokyo en la web con un clic (tickets, tienda, música, tarjeta)' })
        .addStringOption((o) => o.setName('section').setNameLocalizations({ 'es-ES': 'seccion', 'es-419': 'seccion' })
            .setDescription('Which screen to open (overview by default)')
            .setDescriptionLocalizations({ 'es-ES': 'Qué pantalla abrir (tu resumen por defecto)', 'es-419': 'Qué pantalla abrir (tu resumen por defecto)' })
            .addChoices(
                { name: 'Overview', name_localizations: { 'es-ES': 'Resumen', 'es-419': 'Resumen' }, value: 'inicio' },
                { name: 'My tickets', name_localizations: { 'es-ES': 'Mis tickets', 'es-419': 'Mis tickets' }, value: 'tickets' },
                { name: 'Shop and bag', name_localizations: { 'es-ES': 'Tienda y mochila', 'es-419': 'Tienda y mochila' }, value: 'tienda' },
                { name: 'Music', name_localizations: { 'es-ES': 'Música', 'es-419': 'Música' }, value: 'musica' },
                { name: 'Level card', name_localizations: { 'es-ES': 'Tarjeta de nivel', 'es-419': 'Tarjeta de nivel' }, value: 'tarjeta' },
            )),

    async execute(interaction, client, cfg) {
        // Es un mensaje solo para quien lo pide: mejor en SU idioma de Discord.
        const loc = String(interaction.locale || '');
        const idioma = loc.startsWith('es') ? 'es' : loc.startsWith('en') ? 'en' : resolverIdioma(cfg);
        const vista = interaction.options.getString('section') || 'inicio';
        await interaction.reply({ ...mensajeAcceso(interaction.user, idioma, vista), flags: 64 });
    },
};

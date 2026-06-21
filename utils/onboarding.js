// Construye la "guía de bienvenida / configuración" de un servidor.
// La usan tanto el evento guildCreate (al entrar el bot) como el comando !setup,
// para que el contenido sea siempre el mismo (un solo sitio que mantener).
const { EmbedBuilder } = require('discord.js');
const { aplicarPieMarca } = require('./marca.js');

function construirGuia(guild, config) {
    const url = process.env.FRONTEND_URL || 'http://localhost:5173';
    const prefijo = (config && config.prefijo) || '!';
    const check = (ok) => (ok ? '✅' : '⬜');

    // Estado de los ajustes clave (para el checklist).
    const rol = config?.rolStaffId ? `<@&${config.rolStaffId}>` : '_sin definir_';
    const cat = config?.categoriaTicketsId
        ? (guild.channels.cache.get(config.categoriaTicketsId)?.name || 'definida')
        : '_sin definir_';

    const embed = new EmbedBuilder()
        .setColor(config?.colorEmbed || '#5865F2')
        .setTitle('👋 ¡Gracias por añadir a Sokyo!')
        .setDescription(`Soy tu bot de soporte y gestión de roles. Estos son los pasos para dejarlo todo listo en **${guild.name}**.`)
        .addFields(
            {
                name: '📋 Pasos iniciales',
                value: [
                    `**1.** Abre el panel web: ${url}`,
                    '**2.** Pulsa **"Soy staff"** e inicia sesión con tu Discord.',
                    '**3.** En *Ajustes*, define el **rol de staff** y la **categoría de tickets**.',
                    `**4.** Escribe \`${prefijo}sokyo\` en tu canal de soporte para publicar el botón de tickets.`,
                ].join('\n'),
            },
            {
                name: '✅ Estado actual de la configuración',
                value: [
                    `${check(!!config?.rolStaffId)} Rol de staff: ${rol}`,
                    `${check(!!config?.categoriaTicketsId)} Categoría de tickets: ${cat}`,
                ].join('\n'),
            },
            {
                name: '💡 Comandos útiles',
                value: `\`${prefijo}setup\` — ver esta guía · \`${prefijo}sokyo\` — publicar panel de tickets · \`${prefijo}rol\` — gestionar roles`,
            },
        );
    aplicarPieMarca(embed, config); // marca blanca

    if (guild.iconURL()) embed.setThumbnail(guild.iconURL({ size: 128 }));
    return { embeds: [embed] };
}

module.exports = { construirGuia };

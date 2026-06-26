// Construye los mensajes de bienvenida / configuración.
// guildCreate y !setup usan construirBienvenida (con botones).
// construirGuia se mantiene por compatibilidad si algo la llama directamente.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { aplicarPieMarca } = require('./marca.js');

// Mensaje interactivo enviado al unirse el bot y en !setup.
function construirBienvenida(guild, config) {
    const url = process.env.FRONTEND_URL || 'http://localhost:5173';
    const guildId = guild.id;

    const tieneRol = !!config?.rolStaffId;
    const tieneCategoria = !!config?.categoriaTicketsId;

    const paso1 = tieneRol ? '✅' : '1️⃣';
    const paso2 = tieneCategoria ? '✅' : '2️⃣';
    const paso3 = (tieneRol && tieneCategoria) ? '3️⃣ (¡ya puedes!)' : '3️⃣';

    // Plan / trial
    let planLinea = '';
    if (config?.esPremium && config?.premiumHasta) {
        const diasRestantes = Math.ceil((new Date(config.premiumHasta) - Date.now()) / 86400000);
        planLinea = diasRestantes > 0
            ? `\n> 🎁 **Prueba Pro activa** — ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''} restante${diasRestantes !== 1 ? 's' : ''}`
            : '';
    }

    const embed = new EmbedBuilder()
        .setColor(config?.colorEmbed || '#5865F2')
        .setTitle('👋 ¡Hola! Soy Sokyo')
        .setDescription(
            `Acabo de unirme a **${guild.name}**. Solo necesitas **3 pasos rápidos** para empezar.${planLinea}`
        )
        .addFields(
            {
                name: '⚡ Pasos de configuración',
                value: [
                    `${paso1} **Rol de staff** — quién puede gestionar tickets`,
                    `${paso2} **Categoría de tickets** — dónde se crean los canales`,
                    `${paso3} **Publicar el panel** — el botón que verán tus usuarios`,
                ].join('\n'),
            },
            {
                name: '🌐 Panel de control',
                value: `Configura los pasos 1 y 2 en el panel web:\n${url}`,
                inline: true,
            },
            {
                name: '💡 Consejo',
                value: 'Usa el botón **Ver Estado** para comprobar tu progreso en cualquier momento.',
                inline: true,
            },
        );

    if (guild.iconURL()) embed.setThumbnail(guild.iconURL({ size: 128 }));
    aplicarPieMarca(embed, config);

    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('🌐 Abrir Panel Web')
            .setStyle(ButtonStyle.Link)
            .setURL(url),
        new ButtonBuilder()
            .setCustomId(`setup_estado:${guildId}`)
            .setLabel('📊 Ver Estado')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`setup_publicar:${guildId}`)
            .setLabel('📩 Publicar Panel de Tickets')
            .setStyle(ButtonStyle.Primary),
    );

    return { embeds: [embed], components: [fila] };
}

// Alias para retrocompatibilidad (setupSoporte, etc. que no usen botones).
function construirGuia(guild, config) {
    return construirBienvenida(guild, config);
}

// Embed de estado en vivo (respuesta efímera al botón "Ver Estado").
function construirEmbedEstado(guild, config) {
    const url = process.env.FRONTEND_URL || 'http://localhost:5173';
    const check = (ok) => (ok ? '✅' : '❌');

    const rol = config?.rolStaffId
        ? `<@&${config.rolStaffId}>`
        : '_Sin configurar_';
    const cat = config?.categoriaTicketsId
        ? (guild?.channels?.cache?.get(config.categoriaTicketsId)?.name || '_(definida, no en caché)_')
        : '_Sin configurar_';

    let planTexto = 'Free';
    if (config?.esPremium && config?.premiumHasta) {
        const dias = Math.ceil((new Date(config.premiumHasta) - Date.now()) / 86400000);
        planTexto = dias > 0 ? `Pro (trial, ${dias}d restantes)` : 'Pro';
    } else if (config?.esPremium) {
        planTexto = 'Pro';
    }

    const embed = new EmbedBuilder()
        .setColor(config?.colorEmbed || '#5865F2')
        .setTitle(`📊 Estado de configuración`)
        .setDescription(`Servidor: **${guild?.name || 'desconocido'}**`)
        .addFields(
            {
                name: 'Configuración',
                value: [
                    `${check(!!config?.rolStaffId)} Rol de staff: ${rol}`,
                    `${check(!!config?.categoriaTicketsId)} Categoría de tickets: ${cat}`,
                ].join('\n'),
            },
            {
                name: 'Plan actual',
                value: planTexto,
                inline: true,
            },
        )
        .setFooter({ text: 'Configura los ajustes en el panel web' });

    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('🌐 Ir al Panel')
            .setStyle(ButtonStyle.Link)
            .setURL(url),
        new ButtonBuilder()
            .setCustomId(`setup_estado:${config?.guildId || guild?.id}`)
            .setLabel('🔄 Actualizar')
            .setStyle(ButtonStyle.Secondary),
    );

    return { embeds: [embed], components: [fila], flags: 64 }; // 64 = ephemeral
}

module.exports = { construirGuia, construirBienvenida, construirEmbedEstado };

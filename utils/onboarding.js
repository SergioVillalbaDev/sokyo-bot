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
    const paso3 = (tieneRol && tieneCategoria) ? '3️⃣ (you’re ready!)' : '3️⃣';

    // Plan / trial
    let planLinea = '';
    if (config?.esPremium && config?.premiumHasta) {
        const diasRestantes = Math.ceil((new Date(config.premiumHasta) - Date.now()) / 86400000);
        planLinea = diasRestantes > 0
            ? `\n> 🎁 **Pro trial active** — ${diasRestantes} day${diasRestantes !== 1 ? 's' : ''} left`
            : '';
    }

    const embed = new EmbedBuilder()
        .setColor(config?.colorEmbed || '#5865F2')
        .setTitle('👋 Hi! I’m Sokyo')
        .setDescription(
            `I just joined **${guild.name}**. You only need **3 quick steps** to get started.${planLinea}`
        )
        .addFields(
            {
                name: '⚡ Setup steps',
                value: [
                    `${paso1} **Staff role** — who can manage tickets`,
                    `${paso2} **Ticket category** — where the channels are created`,
                    `${paso3} **Publish the panel** — the button your users will see`,
                ].join('\n'),
            },
            {
                name: '🌐 Control panel',
                value: `Set up steps 1 and 2 in the web panel:\n${url}`,
                inline: true,
            },
            {
                name: '💡 Tip',
                value: 'Use the **View status** button to check your progress anytime.',
                inline: true,
            },
        );

    if (guild.iconURL()) embed.setThumbnail(guild.iconURL({ size: 128 }));
    aplicarPieMarca(embed, config);

    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('🌐 Open web panel')
            .setStyle(ButtonStyle.Link)
            .setURL(url),
        new ButtonBuilder()
            .setCustomId(`setup_estado:${guildId}`)
            .setLabel('📊 View status')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`setup_publicar:${guildId}`)
            .setLabel('📩 Publish ticket panel')
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
        : '_Not set_';
    const cat = config?.categoriaTicketsId
        ? (guild?.channels?.cache?.get(config.categoriaTicketsId)?.name || '_(set, not in cache)_')
        : '_Not set_';

    let planTexto = 'Free';
    if (config?.esPremium && config?.premiumHasta) {
        const dias = Math.ceil((new Date(config.premiumHasta) - Date.now()) / 86400000);
        planTexto = dias > 0 ? `Pro (trial, ${dias}d left)` : 'Pro';
    } else if (config?.esPremium) {
        planTexto = 'Pro';
    }

    const embed = new EmbedBuilder()
        .setColor(config?.colorEmbed || '#5865F2')
        .setTitle(`📊 Setup status`)
        .setDescription(`Server: **${guild?.name || 'unknown'}**`)
        .addFields(
            {
                name: 'Configuration',
                value: [
                    `${check(!!config?.rolStaffId)} Staff role: ${rol}`,
                    `${check(!!config?.categoriaTicketsId)} Ticket category: ${cat}`,
                ].join('\n'),
            },
            {
                name: 'Current plan',
                value: planTexto,
                inline: true,
            },
        )
        .setFooter({ text: 'Configure the settings in the web panel' });

    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('🌐 Go to panel')
            .setStyle(ButtonStyle.Link)
            .setURL(url),
        new ButtonBuilder()
            .setCustomId(`setup_estado:${config?.guildId || guild?.id}`)
            .setLabel('🔄 Refresh')
            .setStyle(ButtonStyle.Secondary),
    );

    return { embeds: [embed], components: [fila], flags: 64 }; // 64 = ephemeral
}

module.exports = { construirGuia, construirBienvenida, construirEmbedEstado };

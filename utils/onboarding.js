// Construye los mensajes de bienvenida / configuración.
// guildCreate y !setup usan construirBienvenida (con botones).
// construirGuia se mantiene por compatibilidad si algo la llama directamente.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { aplicarPieMarca } = require('./marca.js');

// Textos del mensaje de bienvenida. Apostamos por mercado global -> inglés por
// defecto, con un botón en el propio mensaje para cambiar a español al vuelo
// (ver setup_lang: en interactionCreate.js).
const TEXTOS_BIENVENIDA = {
    en: {
        title: '👋 Hi! I’m Sokyo',
        desc: (name) => `I just joined **${name}**. You only need **3 quick steps** to get started.`,
        trial: (d) => `\n> 🎁 **Pro trial active** — ${d} day${d !== 1 ? 's' : ''} left`,
        stepsTitle: '⚡ Setup steps',
        step1: '**Staff role** — who can manage tickets',
        step2: '**Ticket category** — where the channels are created',
        step3: '**Publish the panel** — the button your users will see',
        step3Ready: '3️⃣ (you’re ready!)',
        panelTitle: '🌐 Control panel',
        panelValue: (url) => `Set up steps 1 and 2 in the web panel:\n${url}`,
        tipTitle: '💡 Tip',
        tipValue: 'Use the **View status** button to check your progress anytime.',
        btnOpenPanel: '🌐 Open web panel',
        btnStatus: '📊 View status',
        btnPublish: '📩 Publish ticket panel',
        btnLang: '🌐 Español',
    },
    es: {
        title: '👋 ¡Hola! Soy Sokyo',
        desc: (name) => `Me acabo de unir a **${name}**. Solo necesitas **3 pasos rápidos** para empezar.`,
        trial: (d) => `\n> 🎁 **Prueba Pro activa** — quedan ${d} día${d !== 1 ? 's' : ''}`,
        stepsTitle: '⚡ Pasos de configuración',
        step1: '**Rol de staff** — quién puede gestionar los tickets',
        step2: '**Categoría de tickets** — dónde se crean los canales',
        step3: '**Publica el panel** — el botón que verán tus usuarios',
        step3Ready: '3️⃣ (¡todo listo!)',
        panelTitle: '🌐 Panel de control',
        panelValue: (url) => `Configura los pasos 1 y 2 en el panel web:\n${url}`,
        tipTitle: '💡 Consejo',
        tipValue: 'Usa el botón **Ver estado** para consultar tu progreso cuando quieras.',
        btnOpenPanel: '🌐 Abrir panel web',
        btnStatus: '📊 Ver estado',
        btnPublish: '📩 Publicar panel de tickets',
        btnLang: '🌐 English',
    },
};

// Mensaje interactivo enviado al unirse el bot y en !setup.
// lang: 'en' (por defecto, mercado global) o 'es' — se cambia con el botón del propio mensaje.
function construirBienvenida(guild, config, lang = 'en') {
    const t = TEXTOS_BIENVENIDA[lang] || TEXTOS_BIENVENIDA.en;
    const url = process.env.FRONTEND_URL || 'http://localhost:5173';
    const guildId = guild.id;

    const tieneRol = !!config?.rolStaffId;
    const tieneCategoria = !!config?.categoriaTicketsId;

    const paso1 = tieneRol ? '✅' : '1️⃣';
    const paso2 = tieneCategoria ? '✅' : '2️⃣';
    const paso3 = (tieneRol && tieneCategoria) ? t.step3Ready : '3️⃣';

    // Plan / trial
    let planLinea = '';
    if (config?.esPremium && config?.premiumHasta) {
        const diasRestantes = Math.ceil((new Date(config.premiumHasta) - Date.now()) / 86400000);
        planLinea = diasRestantes > 0 ? t.trial(diasRestantes) : '';
    }

    const embed = new EmbedBuilder()
        .setColor(config?.colorEmbed || '#5865F2')
        .setTitle(t.title)
        .setDescription(`${t.desc(guild.name)}${planLinea}`)
        .addFields(
            {
                name: t.stepsTitle,
                value: [
                    `${paso1} ${t.step1}`,
                    `${paso2} ${t.step2}`,
                    `${paso3} ${t.step3}`,
                ].join('\n'),
            },
            {
                name: t.panelTitle,
                value: t.panelValue(url),
                inline: true,
            },
            {
                name: t.tipTitle,
                value: t.tipValue,
                inline: true,
            },
        );

    if (guild.iconURL()) embed.setThumbnail(guild.iconURL({ size: 128 }));
    aplicarPieMarca(embed, config);

    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel(t.btnOpenPanel)
            .setStyle(ButtonStyle.Link)
            .setURL(url),
        new ButtonBuilder()
            .setCustomId(`setup_estado:${guildId}`)
            .setLabel(t.btnStatus)
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`setup_publicar:${guildId}`)
            .setLabel(t.btnPublish)
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`setup_lang:${lang === 'en' ? 'es' : 'en'}:${guildId}`)
            .setLabel(t.btnLang)
            .setStyle(ButtonStyle.Secondary),
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

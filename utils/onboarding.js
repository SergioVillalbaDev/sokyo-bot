// Construye los mensajes de bienvenida / configuración.
// guildCreate y !setup usan construirBienvenida (con botones).
// construirGuia se mantiene por compatibilidad si algo la llama directamente.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { aplicarPieMarca } = require('./marca.js');
const { t } = require('./i18n.js');
const MensajeEntrada = require('../models/MensajeEntrada.js');

// Textos del mensaje de bienvenida. Apostamos por mercado global -> inglés por
// defecto, con un botón en el propio mensaje para cambiar a español al vuelo
// (ver setup_lang: en interactionCreate.js).
const TEXTOS_BIENVENIDA = {
    en: {
        title: '👋 Hi! I’m Sokyo',
        descPlantilla: 'I just joined **{server}**. You only need **3 quick steps** to get started.',
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
        descPlantilla: 'Me acabo de unir a **{server}**. Solo necesitas **3 pasos rápidos** para empezar.',
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

// «Todo lo que puedo hacer»: la guía completa que se añade al mensaje de entrada
// (si los propietarios la dejan activada en el panel).
const GUIA_COMPLETA = {
    es: [
        { name: '🧭 Todo lo que puedo hacer', value: [
            '🎫 **Tickets** de soporte con formulario, transcripción y valoración.',
            '🛡️ **Moderación**: avisos, aislamientos, baneos con deshacer, automod y anti-raid.',
            '👋 **Bienvenidas**, verificación y roles automáticos.',
            '📈 **Niveles** con tarjetas, 🎉 sorteos, encuestas, cumpleaños y clanes.',
            '🎵 **Música** de YouTube y Spotify, 🪙 oro y tienda.',
            '🚀 **Crecimiento**: invitaciones, avisos de directos y página pública.',
        ].join('\n') },
        { name: '⌨️ Comandos', value: 'Escribe **/** en el chat y Discord te enseña todos mis comandos. `/ayuda` los explica por categorías.' },
    ],
    en: [
        { name: '🧭 Everything I can do', value: [
            '🎫 Support **tickets** with forms, transcripts and ratings.',
            '🛡️ **Moderation**: warnings, timeouts, undoable bans, automod and anti-raid.',
            '👋 **Welcomes**, verification and auto roles.',
            '📈 **Levels** with cards, 🎉 giveaways, polls, birthdays and clans.',
            '🎵 **Music** from YouTube and Spotify, 🪙 gold and shop.',
            '🚀 **Growth**: invites, live stream alerts and a public page.',
        ].join('\n') },
        { name: '⌨️ Commands', value: 'Type **/** in the chat and Discord shows all my commands. `/help` explains them by category.' },
    ],
};

// Ajustes del mensaje de entrada (panel → Propietario). Se guardan en memoria un
// minuto: el mensaje se construye a menudo (al entrar, en /setup, al cambiar de idioma).
const ENTRADA_DEFECTO = { activo: true, alDueno: true, alCanal: 'respaldo', guiaCompleta: true, es: { titulo: '', descripcion: '' }, en: { titulo: '', descripcion: '' } };
let entradaCache = null;
let entradaHasta = 0;
async function cargarMensajeEntrada({ forzar = false } = {}) {
    if (!forzar && entradaCache && Date.now() < entradaHasta) return entradaCache;
    try {
        const doc = await MensajeEntrada.findOne({ clave: 'global' }).lean();
        entradaCache = { ...ENTRADA_DEFECTO, ...(doc || {}), es: { ...ENTRADA_DEFECTO.es, ...(doc?.es || {}) }, en: { ...ENTRADA_DEFECTO.en, ...(doc?.en || {}) } };
    } catch {
        entradaCache = entradaCache || { ...ENTRADA_DEFECTO };
    }
    entradaHasta = Date.now() + 60_000;
    return entradaCache;
}
const olvidarMensajeEntrada = () => { entradaHasta = 0; };

// Textos de fábrica y partes fijas del mensaje, para la vista previa del panel.
function piezasMensajeEntrada(lang) {
    const tx = TEXTOS_BIENVENIDA[lang] || TEXTOS_BIENVENIDA.en;
    return {
        porDefecto: { titulo: tx.title, descripcion: tx.descPlantilla },
        pasos: { nombre: tx.stepsTitle, valor: [`1️⃣ ${tx.step1}`, `2️⃣ ${tx.step2}`, `3️⃣ ${tx.step3}`].join('\n') },
        panel: { nombre: tx.panelTitle, valor: tx.panelValue(process.env.FRONTEND_URL || 'http://localhost:5173') },
        consejo: { nombre: tx.tipTitle, valor: tx.tipValue },
        guia: (GUIA_COMPLETA[lang] || GUIA_COMPLETA.en).map((c) => ({ nombre: c.name, valor: c.value })),
        botones: [tx.btnOpenPanel, tx.btnStatus, tx.btnPublish, tx.btnLang],
    };
}

// Mensaje interactivo enviado al unirse el bot y en !setup.
// lang: 'en' (por defecto, mercado global) o 'es' — se cambia con el botón del propio mensaje.
// Sin `lang` explícito usa el idioma guardado del servidor (antes salía siempre en inglés).
// `entrada`: ajustes del panel (Propietario → Mensaje de entrada); sin ellos, los de
// la última carga (cargarMensajeEntrada) o los de fábrica.
function construirBienvenida(guild, config, lang = (config && config.idioma) || 'en', entrada = entradaCache || ENTRADA_DEFECTO) {
    const t = TEXTOS_BIENVENIDA[lang] || TEXTOS_BIENVENIDA.en;
    const propios = (entrada && entrada[lang === 'es' ? 'es' : 'en']) || {};
    const titulo = (propios.titulo || '').trim() || t.title;
    const descripcion = ((propios.descripcion || '').trim() || t.descPlantilla).replace(/\{(server|servidor)\}/gi, () => guild.name); // función: un «$» del nombre no es un patrón
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
        .setTitle(titulo.slice(0, 256))
        .setDescription(`${descripcion}${planLinea}`.slice(0, 4000))
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
    if (entrada?.guiaCompleta !== false) embed.addFields(...(GUIA_COMPLETA[lang] || GUIA_COMPLETA.en));

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
        : t(config, '_Sin definir_', '_Not set_');
    const cat = config?.categoriaTicketsId
        ? (guild?.channels?.cache?.get(config.categoriaTicketsId)?.name || t(config, '_(definido, no está en caché)_', '_(set, not in cache)_'))
        : t(config, '_Sin definir_', '_Not set_');

    let planTexto = t(config, 'Gratis', 'Free');
    if (config?.esPremium && config?.premiumHasta) {
        const dias = Math.ceil((new Date(config.premiumHasta) - Date.now()) / 86400000);
        planTexto = dias > 0 ? t(config, `Pro (prueba, quedan ${dias}d)`, `Pro (trial, ${dias}d left)`) : 'Pro';
    } else if (config?.esPremium) {
        planTexto = 'Pro';
    }

    const embed = new EmbedBuilder()
        .setColor(config?.colorEmbed || '#5865F2')
        .setTitle(t(config, '📊 Estado de la configuración', '📊 Setup status'))
        .setDescription(t(config, `Servidor: **${guild?.name || 'desconocido'}**`, `Server: **${guild?.name || 'unknown'}**`))
        .addFields(
            {
                name: t(config, 'Configuración', 'Configuration'),
                value: [
                    `${check(!!config?.rolStaffId)} ${t(config, 'Rol de staff:', 'Staff role:')} ${rol}`,
                    `${check(!!config?.categoriaTicketsId)} ${t(config, 'Categoría de tickets:', 'Ticket category:')} ${cat}`,
                ].join('\n'),
            },
            {
                name: t(config, 'Plan actual', 'Current plan'),
                value: planTexto,
                inline: true,
            },
        )
        .setFooter({ text: t(config, 'Configura los ajustes en el panel web', 'Configure the settings in the web panel') });

    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel(t(config, '🌐 Ir al panel', '🌐 Go to panel'))
            .setStyle(ButtonStyle.Link)
            .setURL(url),
        new ButtonBuilder()
            .setCustomId(`setup_estado:${config?.guildId || guild?.id}`)
            .setLabel(t(config, '🔄 Actualizar', '🔄 Refresh'))
            .setStyle(ButtonStyle.Secondary),
    );

    return { embeds: [embed], components: [fila], flags: 64 }; // 64 = ephemeral
}

module.exports = {
    construirGuia, construirBienvenida, construirEmbedEstado,
    cargarMensajeEntrada, olvidarMensajeEntrada, piezasMensajeEntrada, ENTRADA_DEFECTO,
};

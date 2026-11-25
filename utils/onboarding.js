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
        descPlantilla: 'Thanks for adding me to **{server}**! I do two things: I **run your server** (tickets, moderation, welcomes, roles…) and I **keep it alive** (pets, casino, cards, battles, levels…). Everything is set up from a web panel, with no commands to learn.',
        trial: (d) => `\n> 🎁 **You have Pro free for ${d} day${d !== 1 ? 's' : ''}** — try everything, no card needed.`,
        stepsTitle: '⚡ Ready in 1 minute',
        step1: 'Press **⚡ Set up in 1 minute**: you say what kind of server it is and I create the channels, roles and settings for you.',
        step2: 'Change anything whenever you want: in the **web panel** or with **`/configure`** right here in Discord.',
        step3: 'Your members type **`/menu`** to play and **`/help`** to see everything. I’ve already greeted them in the server.',
        step3Ready: '3️⃣ (you’re ready!)',
        panelTitle: '🔒 Who can do what',
        panelValue: () => 'Admins and whoever you choose get into the **panel**. Everyone else has **“My account”**: their gold, tickets and music.',
        tipTitle: '❔ Stuck?',
        tipValue: '**`/help`** answers everything, and every message has a **❔** button.',
        btnOpenPanel: '⚡ Set up in 1 minute',
        btnStatus: '📊 What’s on',
        btnLang: '🌐 Español',
    },
    es: {
        title: '👋 ¡Hola! Soy Sokyo',
        descPlantilla: '¡Gracias por añadirme a **{server}**! Hago dos cosas: **gestiono tu servidor** (tickets, moderación, bienvenidas, roles…) y **le doy vida** (mascotas, casino, cartas, combates, niveles…). Todo se configura desde un panel web, sin aprender comandos.',
        trial: (d) => `\n> 🎁 **Tienes Pro gratis ${d} día${d !== 1 ? 's' : ''}**: pruébalo todo, sin tarjeta.`,
        stepsTitle: '⚡ Listo en 1 minuto',
        step1: 'Pulsa **⚡ Configurar en 1 minuto**: me dices qué tipo de servidor es y creo yo los canales, los roles y los ajustes.',
        step2: 'Cambia lo que quieras cuando quieras: en el **panel web** o con **`/configurar`** aquí en Discord.',
        step3: 'Tus miembros escriben **`/menu`** para jugar y **`/ayuda`** para verlo todo. Ya les he saludado en el servidor.',
        step3Ready: '3️⃣ (¡todo listo!)',
        panelTitle: '🔒 Quién puede qué',
        panelValue: () => 'Al **panel** entran los admins y quien tú elijas. Los demás tienen **«Mi cuenta»**: su oro, sus tickets y su música.',
        tipTitle: '❔ ¿Dudas?',
        tipValue: '**`/ayuda`** lo explica todo y cada mensaje tiene un botón **❔**.',
        btnOpenPanel: '⚡ Configurar en 1 minuto',
        btnStatus: '📊 Qué está activo',
        btnLang: '🌐 English',
    },
};

// Lo que se pone en el canal del servidor al entrar (2.0.0): para TODOS, corto y amable.
const TEXTOS_SALUDO = {
    es: {
        titulo: '👋 ¡Hola a todos! Soy Sokyo',
        desc: 'Acabo de llegar a **{server}** para ayudar al staff y para que aquí siempre haya algo que hacer.',
        jugar: '🎮 **Para todos**: `/menu` es tu inicio (mascotas, casino, cartas, combates, oro…) y `/ayuda` lo explica todo.',
        staff: '🛠️ **Para los admins**: pulsad **⚡ Configurar** y en 1 minuto lo dejo todo listo.',
        cuenta: '🌐 Cada uno tiene su web, **«Mi cuenta»**: entra con `/cuenta`, sin contraseñas.',
        btnMenu: 'Abrir mi menú', btnAyuda: 'Cómo funciona', btnConfig: 'Configurar (admins)',
    },
    en: {
        titulo: '👋 Hi everyone! I’m Sokyo',
        desc: 'I just arrived at **{server}** to help the staff and to make sure there’s always something to do here.',
        jugar: '🎮 **For everyone**: `/menu` is your home (pets, casino, cards, battles, gold…) and `/help` explains everything.',
        staff: '🛠️ **For admins**: press **⚡ Set up** and I’ll get everything ready in 1 minute.',
        cuenta: '🌐 Everyone has their own page, **“My account”**: open it with `/account`, no passwords.',
        btnMenu: 'Open my menu', btnAyuda: 'How it works', btnConfig: 'Set up (admins)',
    },
};

const urlWeb = () => process.env.FRONTEND_URL || 'https://dashboard.sokyo.studio';
const urlPanel = (guildId) => `${urlWeb().replace(/\/$/, '')}/panel?servidor=${guildId}`;

// «Todo lo que puedo hacer»: la guía completa que se añade al mensaje de entrada
// (si los propietarios la dejan activada en el panel).
const GUIA_COMPLETA = {
    es: [
        { name: '🛠️ Para gestionar el servidor', value: [
            '🎫 **Tickets** con formulario, transcripción y valoración · 🛡️ **Moderación** con automod y anti-raid',
            '👋 **Bienvenidas**, verificación y roles automáticos · 📣 anuncios, encuestas y sorteos',
            '🚀 **Crecimiento**: invitaciones, avisos de directos y página pública · 📊 estadísticas',
        ].join('\n') },
        { name: '🎮 Para divertirse (todo con el oro de este servidor)', value: [
            '🐾 **Mascotas** que cuidas, con granja, casa y expediciones · 🃏 **cartas** y ⚔️ **combates**',
            '🎰 **Casino** con 20 juegos · 🎟️ **pase de temporada** gratis · 🛒 **tienda** de roles del servidor',
            '📈 **Niveles**, 🛡️ clanes con guerra semanal y 🏅 la Liga contra otros servidores',
        ].join('\n') },
    ],
    en: [
        { name: '🛠️ To run the server', value: [
            '🎫 **Tickets** with forms, transcripts and ratings · 🛡️ **Moderation** with automod and anti-raid',
            '👋 **Welcomes**, verification and auto roles · 📣 announcements, polls and giveaways',
            '🚀 **Growth**: invites, live stream alerts and a public page · 📊 stats',
        ].join('\n') },
        { name: '🎮 To have fun (all with this server’s gold)', value: [
            '🐾 **Pets** you look after, with a farm, house and expeditions · 🃏 **cards** and ⚔️ **battles**',
            '🎰 **Casino** with 20 games · 🎟️ free **season pass** · 🛒 server role **shop**',
            '📈 **Levels**, 🛡️ clans with a weekly war and 🏅 the League against other servers',
        ].join('\n') },
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
        panel: { nombre: tx.panelTitle, valor: tx.panelValue() },
        consejo: { nombre: tx.tipTitle, valor: tx.tipValue },
        guia: (GUIA_COMPLETA[lang] || GUIA_COMPLETA.en).map((c) => ({ nombre: c.name, valor: c.value })),
        botones: [tx.btnOpenPanel, tx.btnStatus, tx.btnLang],
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
    const guildId = guild.id;
    const url = urlPanel(guildId);

    // 1.17.0: los pasos llevan al setup en 1 minuto (antes eran solo los de tickets).
    const paso1 = '1️⃣';
    const paso2 = '2️⃣';
    const paso3 = '3️⃣';

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
                value: t.panelValue(),
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

// «Qué está activo» (botón del mensaje de entrada, efímero): cada zona del catálogo con lo que
// está encendido y lo que falta, el plan y el siguiente paso. 2.0.0: antes solo miraba los tickets.
function construirEmbedEstado(guild, config) {
    const C = require('./catalogo.js');
    const idioma = config?.idioma === 'es' ? 'es' : 'en';
    const cfg = config?.toObject ? config.toObject() : (config || {});
    const porZona = {};
    for (const m of C.MODULOS) {
        if (m.zona === 'basico' || !m.tab) continue;
        (porZona[m.zona] ||= []).push(m);
    }
    const campos = Object.entries(porZona).map(([z, mods]) => {
        const zona = C.ZONAS[z];
        const on = mods.filter((m) => m.activo(cfg));
        const off = mods.filter((m) => !m.activo(cfg));
        const lista = [...on.map((m) => `✅ ${m[idioma]}`), ...off.slice(0, 4).map((m) => `▫️ ${m[idioma]}`)];
        if (off.length > 4) lista.push(t(idioma, `▫️ y ${off.length - 4} más`, `▫️ and ${off.length - 4} more`));
        return { name: `${zona.emoji} ${zona[idioma]} · ${on.length}/${mods.length}`, value: lista.join('\n').slice(0, 1024) || '—', inline: true };
    });
    const activos = C.MODULOS.filter((m) => m.tab && m.zona !== 'basico' && m.activo(cfg)).length;
    let plan = t(idioma, 'Gratis', 'Free');
    if (config?.esPremium && config?.premiumHasta) {
        const dias = Math.ceil((new Date(config.premiumHasta) - Date.now()) / 86400000);
        plan = dias > 0 ? t(idioma, `Pro (prueba, quedan ${dias} días)`, `Pro (trial, ${dias} days left)`) : 'Pro';
    } else if (config?.esPremium) plan = config.plan === 'agency' ? 'Agencia' : 'Pro';
    const embed = new EmbedBuilder()
        .setColor(config?.colorEmbed || '#5865F2')
        .setTitle(t(idioma, `📊 Qué está activo en ${guild?.name || 'el servidor'}`, `📊 What’s on in ${guild?.name || 'the server'}`))
        .setDescription(activos === 0
            ? t(idioma, '**Aún no hay nada encendido.** Pulsa **⚡ Configurar en 1 minuto** y lo dejo listo según tu tipo de servidor.', '**Nothing is on yet.** Press **⚡ Set up in 1 minute** and I’ll get it ready for your kind of server.')
            : t(idioma, `Tienes **${activos}** funciones encendidas · Plan: **${plan}**. Enciende o apaga cualquiera con \`/configurar\` o en el panel.`, `You have **${activos}** features on · Plan: **${plan}**. Turn any on or off with \`/configure\` or in the panel.`))
        .addFields(campos.slice(0, 24));
    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel(t(idioma, '⚡ Abrir el panel', '⚡ Open the panel')).setStyle(ButtonStyle.Link).setURL(urlPanel(config?.guildId || guild?.id)),
        new ButtonBuilder().setCustomId(`setup_estado:${config?.guildId || guild?.id}`).setLabel(t(idioma, '🔄 Actualizar', '🔄 Refresh')).setStyle(ButtonStyle.Secondary),
    );
    return { embeds: [embed], components: [fila], flags: 64 }; // 64 = ephemeral
}

// Saludo público al entrar (2.0.0): lo ve todo el servidor. El privado al dueño lleva la configuración.
function construirSaludoPublico(guild, config, lang = (config && config.idioma) || 'en') {
    const tx = TEXTOS_SALUDO[lang] || TEXTOS_SALUDO.en;
    const embed = new EmbedBuilder()
        .setColor(config?.colorEmbed || '#5865F2')
        .setTitle(tx.titulo)
        .setDescription([tx.desc.replace('{server}', () => guild.name), '', tx.jugar, tx.cuenta, tx.staff].join('\n'));
    if (guild.client?.user?.displayAvatarURL) embed.setThumbnail(guild.client.user.displayAvatarURL({ size: 128 }));
    aplicarPieMarca(embed, config);
    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('menu:abrir').setEmoji('🏠').setLabel(tx.btnMenu).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setURL(`${urlWeb().replace(/\/$/, '')}/ayuda`).setEmoji('📖').setLabel(tx.btnAyuda).setStyle(ButtonStyle.Link),
        new ButtonBuilder().setURL(urlPanel(guild.id)).setEmoji('⚡').setLabel(tx.btnConfig).setStyle(ButtonStyle.Link),
    );
    return { embeds: [embed], components: [fila] };
}

module.exports = {
    construirGuia, construirBienvenida, construirEmbedEstado, construirSaludoPublico, urlPanel,
    cargarMensajeEntrada, olvidarMensajeEntrada, piezasMensajeEntrada, ENTRADA_DEFECTO,
};

// ============================================================================
// cuenta — acceso a "Mi cuenta" (la web de cada usuario) desde Discord.
//
// /cuenta da un enlace de UN SOLO USO que abre la web con la sesión ya iniciada,
// sin pasar por la pantalla de autorización de Discord. El código es aleatorio,
// vive solo en memoria (el bot y la API comparten proceso) y caduca a los 15
// minutos: si se reinicia el bot, basta con pedir otro.
// ============================================================================
const crypto = require('crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { t, resolverIdioma } = require('./i18n.js');

const DURACION_MS = 15 * 60 * 1000;
const MAX_CODIGOS = 5000;
// Pantallas de la web a las que puede llevar el enlace (#hash del portal).
const VISTAS = ['inicio', 'tickets', 'tienda', 'musica', 'tarjeta', 'ajustes'];
const codigos = new Map(); // codigo -> { id, username, avatar, vista, expira }

// Origen público de la API (donde vive /api/auth/magic). En producción es el
// mismo dominio que la web; en desarrollo la API va en otro puerto, así que se
// saca de la URL de vuelta del login de Discord, que siempre apunta a la API.
function origenApi() {
    try { if (process.env.OAUTH_REDIRECT_URI) return new URL(process.env.OAUTH_REDIRECT_URI).origin; } catch { /* mal escrita */ }
    return (process.env.FRONTEND_URL || 'http://localhost:3001').replace(/\/+$/, '');
}

// Dirección corta y fácil de recordar de la web de cada usuario. Con `extra`
// lleva a algo concreto: urlCuenta('tickets', canalId), urlCuenta('tienda', 'mochila').
function urlCuenta(vista = null, extra = null) {
    const base = (process.env.FRONTEND_URL || origenApi()).replace(/\/+$/, '');
    if (!vista || !VISTAS.includes(vista) || (vista === 'inicio' && !extra)) return `${base}/cuenta`;
    return `${base}/cuenta#${vista}${extra ? `/${encodeURIComponent(extra)}` : ''}`;
}

function limpiar(ahora = Date.now()) {
    for (const [c, d] of codigos) if (d.expira <= ahora) codigos.delete(c);
    // Tope de memoria: si alguien pidiera miles de enlaces, caen los más viejos.
    while (codigos.size > MAX_CODIGOS) codigos.delete(codigos.keys().next().value);
}

// Crea un enlace de acceso para este usuario de Discord.
function crearEnlace(user, vista = 'inicio') {
    const codigo = crypto.randomBytes(24).toString('base64url');
    codigos.set(codigo, {
        id: user.id,
        username: user.username,
        avatar: typeof user.displayAvatarURL === 'function' ? user.displayAvatarURL({ extension: 'png', size: 128 }) : (user.avatar || null),
        vista: VISTAS.includes(vista) ? vista : 'inicio',
        expira: Date.now() + DURACION_MS,
    });
    limpiar();
    return `${origenApi()}/api/auth/magic?c=${codigo}`;
}

// Canjea un código: devuelve los datos del usuario (y lo invalida) o null.
function canjear(codigo) {
    if (typeof codigo !== 'string' || codigo.length < 20 || codigo.length > 64) return null;
    const d = codigos.get(codigo);
    if (!d) return null;
    codigos.delete(codigo);
    if (d.expira <= Date.now()) return null;
    return d;
}

// Mensaje privado (efímero o por MD) con el botón de entrada directa.
// `idioma` es la config del servidor o 'es' / 'en' (el idioma de quien lo pide).
function mensajeAcceso(user, idioma, vista = 'inicio') {
    const enlace = crearEnlace(user, vista);
    const web = urlCuenta().replace(/^https?:\/\//, '');
    const embed = new EmbedBuilder()
        .setColor('#a855f7')
        .setAuthor({ name: t(idioma, 'Tu cuenta Sokyo', 'Your Sokyo account'), iconURL: typeof user.displayAvatarURL === 'function' ? user.displayAvatarURL() : undefined })
        .setDescription(t(idioma,
            'Pulsa el botón y entrarás **directamente**, sin contraseñas.\n\n🏠 Tu resumen · 🎫 Tickets · 🛒 Tienda y mochila · 🎵 Música · 🎨 Tarjeta de nivel',
            'Press the button and you’ll go in **straight away**, no passwords.\n\n🏠 Your overview · 🎫 Tickets · 🛒 Shop and bag · 🎵 Music · 🎨 Level card'))
        .setFooter({ text: t(idioma,
            `Solo tú ves este botón y caduca en 15 minutos · Cuando quieras: ${web}`,
            `Only you can see this button and it expires in 15 minutes · Any time: ${web}`) });
    const fila = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(enlace).setLabel(t(idioma, 'Abrir mi cuenta', 'Open my account')).setEmoji('✨'),
    );
    return { embeds: [embed], components: [fila] };
}

// Botón de enlace normal (sin sesión) a una pantalla de la web, para añadirlo
// debajo de otros mensajes del bot (tienda, mochila, tickets…).
function botonWeb(cfg, vista, etiqueta = null, extra = null) {
    return new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setURL(urlCuenta(vista, extra))
        .setLabel(etiqueta || t(cfg, 'Abrir en la web', 'Open on the web'))
        .setEmoji('🌐');
}

// Idioma para un mensaje que solo ve quien pulsa: el de SU Discord y, si no es
// ni español ni inglés, el del servidor.
function idiomaDe(interaction, cfg) {
    const loc = String(interaction.locale || '');
    return loc.startsWith('es') ? 'es' : loc.startsWith('en') ? 'en' : resolverIdioma(cfg);
}

// Botón para mensajes PÚBLICOS: quien lo pulsa recibe (solo él) su propio
// enlace de entrada directa. Con `vista` abre esa pantalla de su cuenta.
function botonAbrirCuenta(idioma, { vista = 'inicio', etiqueta = null, emoji = '✨', estilo = ButtonStyle.Success } = {}) {
    return new ButtonBuilder()
        .setCustomId(`cuenta:abrir:${VISTAS.includes(vista) ? vista : 'inicio'}`)
        .setLabel(etiqueta || t(idioma, 'Abrir mi cuenta', 'Open my account'))
        .setEmoji(emoji)
        .setStyle(estilo);
}

// Al pulsar un botón `cuenta:abrir[:vista]`: el botón de entrada, solo para él.
function responderBotonCuenta(interaction, cfg) {
    const vista = interaction.customId.split(':')[2] || 'inicio';
    return interaction.reply({ ...mensajeAcceso(interaction.user, idiomaDe(interaction, cfg), vista), flags: 64 });
}

// El embed de fábrica del mensaje fijo, en el formato del Creador de embeds del
// panel (así se puede empezar a editar desde él). `panelCuenta` lo usa si el
// servidor no ha hecho el suyo.
function embedCuentaDefecto(cfg) {
    const web = urlCuenta().replace(/^https?:\/\//, '');
    return {
        color: '#a855f7',
        titulo: t(cfg, '✨ Tu cuenta Sokyo: todo lo tuyo en un sitio', '✨ Your Sokyo account: all your stuff in one place'),
        descripcion: t(cfg,
            'Cada miembro tiene **su propia web** con lo suyo de este servidor:\n\n'
            + '🎫 **Tus tickets** · habla con el staff también desde el móvil\n'
            + '🛒 **Tienda y mochila** · gasta tu oro y usa tus objetos\n'
            + '🎵 **Música** · pon canciones en tu canal de voz\n'
            + '🎨 **Tu tarjeta de nivel** · cámbiale el estilo a tu gusto',
            'Every member gets **their own web page** with everything of theirs on this server:\n\n'
            + '🎫 **Your tickets** · talk to the staff, from your phone too\n'
            + '🛒 **Shop and bag** · spend your gold and use your items\n'
            + '🎵 **Music** · play songs in your voice channel\n'
            + '🎨 **Your level card** · style it the way you like'),
        campos: [
            {
                nombre: t(cfg, '👇 Cómo entrar (1 clic)', '👇 How to get in (1 click)'),
                valor: t(cfg,
                    '**1.** Pulsa **Abrir mi cuenta**.\n**2.** Pulsa el botón que te aparece (solo lo ves tú).\n**3.** ¡Dentro! Sin contraseñas ni formularios.',
                    '**1.** Press **Open my account**.\n**2.** Press the button you get (only you can see it).\n**3.** You’re in! No passwords, no forms.'),
                inline: false,
            },
            {
                nombre: t(cfg, 'También puedes', 'You can also'),
                valor: t(cfg,
                    `Escribir \`/cuenta\` en cualquier canal · Entrar en **${web}** con tu Discord`,
                    `Type \`/account\` in any channel · Go to **${web}** and log in with Discord`),
                inline: false,
            },
        ],
    };
}

// Textos de fábrica de los botones (los cambia el servidor en el panel).
function etiquetasCuentaDefecto(cfg) {
    return {
        abrir: t(cfg, 'Abrir mi cuenta', 'Open my account'),
        tickets: t(cfg, 'Mis tickets', 'My tickets'),
        tienda: t(cfg, 'Tienda', 'Shop'),
        musica: t(cfg, 'Música', 'Music'),
        tarjeta: t(cfg, 'Mi tarjeta', 'My card'),
    };
}

// Mensaje fijo para un canal (#información, #bienvenida…): explica qué es "Mi
// cuenta" y cómo entrar, con un botón para cada uno. Lo publican /panel-cuenta,
// !panelcuenta y el panel web («Mi cuenta de los miembros»). Todo se puede cambiar
// en el panel (`panelCuenta`: texto, embed, botones y sus textos); `guild` sirve
// para enlazar «#canal».
function panelCuenta(cfg, guild = null) {
    const { construirMensaje, embedTieneContenido, estiloBoton } = require('./embeds.js');
    const { mencionarEnMensaje } = require('./mencionesCanal.js');
    const pc = (cfg && cfg.panelCuenta) || {};
    const { contenido, embed: propio } = mencionarEnMensaje(pc.contenido, pc.embed, guild);
    let payload;
    if (propio && embedTieneContenido(propio)) {
        payload = construirMensaje(contenido, propio, require('path').join(__dirname, '..', 'api', 'uploads'), cfg);
    } else {
        const d = embedCuentaDefecto(cfg);
        const embed = new EmbedBuilder().setColor(d.color).setTitle(d.titulo).setDescription(d.descripcion)
            .addFields(d.campos.map((c) => ({ name: c.nombre, value: c.valor })));
        require('./marca.js').aplicarPieMarca(embed, cfg);
        payload = { embeds: [embed] };
        if (contenido) payload.content = String(contenido).slice(0, 2000);
    }
    const fab = etiquetasCuentaDefecto(cfg);
    const et = { ...fab, ...Object.fromEntries(Object.entries(pc.etiquetas || {}).filter(([, v]) => String(v || '').trim()).map(([k, v]) => [k, String(v).trim().slice(0, 80)])) };
    const web = urlCuenta().replace(/^https?:\/\//, '');
    const filaPrincipal = new ActionRowBuilder().addComponents(
        botonAbrirCuenta(cfg, { etiqueta: String(pc.textoBoton || '').trim().slice(0, 80) || fab.abrir, estilo: estiloBoton(pc.estiloBoton) }),
        ...(pc.botonWeb !== false ? [new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(urlCuenta()).setLabel(web.slice(0, 80)).setEmoji('🌐')] : []),
    );
    payload.components = [filaPrincipal];
    if (pc.secciones !== false) {
        const secundario = { estilo: ButtonStyle.Secondary };
        payload.components.push(new ActionRowBuilder().addComponents(
            botonAbrirCuenta(cfg, { ...secundario, vista: 'tickets', emoji: '🎫', etiqueta: et.tickets }),
            botonAbrirCuenta(cfg, { ...secundario, vista: 'tienda', emoji: '🛒', etiqueta: et.tienda }),
            botonAbrirCuenta(cfg, { ...secundario, vista: 'musica', emoji: '🎵', etiqueta: et.musica }),
            botonAbrirCuenta(cfg, { ...secundario, vista: 'tarjeta', emoji: '🎨', etiqueta: et.tarjeta }),
        ));
    }
    // Un mensaje fijo no debe avisar a nadie aunque lleve @menciones.
    payload.allowedMentions = { parse: [] };
    return payload;
}

// ¿Puede el bot publicar el mensaje en ese canal? (ver, escribir y poner embeds)
function puedePublicar(canal) {
    const yo = canal?.guild?.members?.me;
    if (!canal || typeof canal.send !== 'function' || !yo) return false;
    const F = PermissionsBitField.Flags;
    return !!canal.permissionsFor(yo)?.has([F.ViewChannel, F.SendMessages, F.EmbedLinks]);
}

// Publica el mensaje fijo en `canal`. Si ya estaba publicado en ese mismo canal,
// lo actualiza en vez de repetirlo. Guarda dónde está en la config del servidor.
async function publicarPanelCuenta(canal, cfg) {
    const ServidorConfig = require('../models/ServidorConfig.js'); // perezoso: la API lo carga antes que Mongo
    const { invalidateConfig } = require('./config.js');
    const contenido = panelCuenta(cfg, canal.guild);
    const previo = cfg && cfg.panelCuenta;
    let mensaje = null;
    let actualizado = false;
    if (previo && previo.mensajeId && previo.canalId === canal.id) {
        mensaje = await canal.messages.fetch(previo.mensajeId).catch(() => null);
        // attachments: [] quita la imagen subida de antes (si no, se quedaba debajo al cambiarla).
        if (mensaje) { await mensaje.edit({ content: null, ...contenido, attachments: [] }); actualizado = true; }
    }
    if (!mensaje) mensaje = await canal.send(contenido);
    // Solo dónde está publicado: lo personalizado (texto, embed, botones) se queda.
    await ServidorConfig.updateOne(
        { guildId: canal.guild.id },
        { $set: { 'panelCuenta.canalId': canal.id, 'panelCuenta.mensajeId': mensaje.id, 'panelCuenta.fecha': new Date() } },
        { upsert: true },
    );
    invalidateConfig(canal.guild.id);
    return { mensaje, actualizado };
}

module.exports = {
    VISTAS, DURACION_MS, crearEnlace, canjear, mensajeAcceso, botonWeb, urlCuenta, origenApi,
    idiomaDe, botonAbrirCuenta, responderBotonCuenta, panelCuenta, puedePublicar, publicarPanelCuenta,
    embedCuentaDefecto, etiquetasCuentaDefecto,
    _codigos: codigos,
};

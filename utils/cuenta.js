// ============================================================================
// cuenta — acceso a "Mi cuenta" (la web de cada usuario) desde Discord.
//
// /cuenta da un enlace de UN SOLO USO que abre la web con la sesión ya iniciada,
// sin pasar por la pantalla de autorización de Discord. El código es aleatorio,
// vive solo en memoria (el bot y la API comparten proceso) y caduca a los 15
// minutos: si se reinicia el bot, basta con pedir otro.
// ============================================================================
const crypto = require('crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { t } = require('./i18n.js');

const DURACION_MS = 15 * 60 * 1000;
const MAX_CODIGOS = 5000;
// Pantallas de la web a las que puede llevar el enlace (#hash del portal).
const VISTAS = ['inicio', 'tickets', 'tienda', 'musica', 'tarjeta'];
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

module.exports = { VISTAS, DURACION_MS, crearEnlace, canjear, mensajeAcceso, botonWeb, urlCuenta, origenApi, _codigos: codigos };

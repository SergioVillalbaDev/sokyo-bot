// ============================================================================
// Paneles fijos con un botón que el bot deja en un canal («Preséntate», «Nueva
// sugerencia»…). Todo se personaliza desde el panel web (1.9.14), igual que el de
// «Mi cuenta» o el de la Doble bienvenida: texto de encima, embed (imágenes/GIF,
// campos…) y el botón (texto y color). Lo que se deja vacío sale de fábrica, en el
// idioma del bot en el servidor. Aquí está lo común: guardar, armar y publicar.
// ============================================================================
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const { construirMensaje, sanearEmbed, embedTieneContenido, embedTieneAlgo, estiloBoton } = require('./embeds.js');
const { mencionarEnMensaje } = require('./mencionesCanal.js');
const { aplicarPieMarca } = require('./marca.js');

const UPLOADS_DIR = path.join(__dirname, '..', 'api', 'uploads');
const ESTILOS = ['verde', 'azul', 'gris', 'rojo'];

// Lo que llega del panel → lo que se guarda. Sin embed propio = null (el de fábrica).
function sanearPanel(b) {
    b = b && typeof b === 'object' ? b : {};
    const embed = b.embed && typeof b.embed === 'object' ? sanearEmbed(b.embed) : null;
    return {
        contenido: String(b.contenido || '').slice(0, 2000),
        embed: embed && embedTieneAlgo(embed) ? embed : null,
        textoBoton: String(b.textoBoton || '').trim().slice(0, 80) || null,
        estiloBoton: ESTILOS.includes(b.estiloBoton) ? b.estiloBoton : null,
    };
}

// ¿Cambia algo de lo que se ve? (para no reeditar el mensaje de Discord en cada
// autoguardado si solo se han tocado otros ajustes de la sección).
function mismoPanel(a, b) {
    return JSON.stringify(sanearPanel(a)) === JSON.stringify(sanearPanel(b));
}

// El embed de fábrica con la forma del editor de embeds del panel, para empezar a
// editar desde ahí. El pie es solo el del servidor: «Powered by Sokyo» no va aquí
// (si se guardara en su embed, seguiría saliendo al pasar a Pro); en Free lo añade
// el bot al publicar (construirMensaje con cfg).
function embedDeFabrica(defecto, cfg) {
    return {
        titulo: defecto.titulo, descripcion: defecto.descripcion, color: defecto.color,
        footer: String((cfg && cfg.footerPersonalizado) || '').slice(0, 2048), campos: [],
    };
}

// Arma el mensaje. `p` = lo guardado ({ contenido, embed, textoBoton, estiloBoton });
// `defecto` = { titulo, descripcion, color, textoBoton, estilo } en el idioma del bot.
// «#canal» se convierte en enlace si se pasa `guild`.
function armarPanel(p, { cfg, guild = null, defecto, customId }) {
    p = p || {};
    const { contenido, embed: propio } = mencionarEnMensaje(p.contenido, p.embed, guild);
    let payload;
    if (propio && embedTieneContenido(propio)) {
        // Con `cfg`: en Free se garantiza «Powered by Sokyo», como en todos los embeds del bot.
        payload = construirMensaje(contenido, propio, UPLOADS_DIR, cfg);
    } else {
        const embed = new EmbedBuilder().setColor(defecto.color || '#5865F2')
            .setTitle(String(defecto.titulo).slice(0, 256))
            .setDescription(String(defecto.descripcion).slice(0, 4096));
        aplicarPieMarca(embed, cfg);
        payload = { embeds: [embed] };
        if (contenido) payload.content = String(contenido).slice(0, 2000);
    }
    const etiqueta = String(p.textoBoton || '').trim().slice(0, 80) || defecto.textoBoton;
    const estilo = ESTILOS.includes(p.estiloBoton) ? p.estiloBoton : (defecto.estilo || 'azul');
    payload.components = [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(customId).setLabel(etiqueta).setStyle(estiloBoton(estilo)),
    )];
    // Un mensaje fijo no debe avisar a nadie aunque lleve @menciones.
    payload.allowedMentions = { parse: [] };
    return payload;
}

// Reedita el mensaje `mensajeId` de `canal` o, si ya no está, publica uno nuevo
// (salvo con `soloEditar`). Devuelve { mensaje, nuevo } (mensaje null si no hay).
async function editarOPublicar(canal, mensajeId, payload, { soloEditar = false } = {}) {
    const previo = mensajeId ? await canal.messages.fetch(mensajeId).catch(() => null) : null;
    if (previo) {
        // content: null quita el texto de antes si ya no hay; attachments: [] quita la
        // imagen subida de antes (si no, se quedaba debajo al cambiarla).
        await previo.edit({ content: null, ...payload, attachments: [] });
        return { mensaje: previo, nuevo: false };
    }
    if (soloEditar) return { mensaje: null, nuevo: false };
    return { mensaje: await canal.send(payload), nuevo: true };
}

module.exports = { sanearPanel, mismoPanel, embedDeFabrica, armarPanel, editarOPublicar, ESTILOS, UPLOADS_DIR };

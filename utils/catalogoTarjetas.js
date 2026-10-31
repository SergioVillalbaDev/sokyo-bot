// ============================================================================
// Catálogo GLOBAL de diseños de tarjeta de nivel (models/CatalogoPresets.js): lo
// que crean los propietarios del bot en el panel (Niveles → Diseños de tarjeta) y
// eligen los miembros en «Mi cuenta».
// - disenoDe(id): el diseño tal y como está ahora (caché de 1 min). Así, si se
//   cambia en el panel, cambia para todos los que lo tienen elegido.
// - sanearDiseno(p): lo que llega del panel, limpio (colores, imagen/GIF y su
//   encuadre: cómo se movió, amplió y giró, ver utils/rankCard.js).
// ============================================================================
const CatalogoPresets = require('../models/CatalogoPresets.js');

const TTL = 60 * 1000;
let cache = null; // { t, cat }

async function catalogo() {
    if (cache && Date.now() - cache.t < TTL) return cache.cat;
    const cat = await CatalogoPresets.findOne({ clave: 'global' }).lean().catch(() => null);
    cache = { t: Date.now(), cat: cat || { ocultos: [], personalizados: [] } };
    return cache.cat;
}
const invalidarCatalogo = () => { cache = null; };

async function disenoDe(id) {
    if (!id) return null;
    const cat = await catalogo();
    return (cat.personalizados || []).find((p) => p && p.id === id) || null;
}

const COLOR = /^#[0-9a-fA-F]{6}$/;
const color = (v, defecto) => (COLOR.test(String(v || '')) ? String(v) : defecto);
// Imagen del fondo: subida al panel (/uploads/…) o una dirección https.
const rutaImagen = (v) => (typeof v === 'string' && (/^\/uploads\/[\w.-]+$/.test(v) || /^https:\/\/\S+$/i.test(v)) ? v.slice(0, 500) : null);
const numero = (v, min, max) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null; };

function sanearEncuadre(e) {
    if (!e || typeof e !== 'object') return null;
    const escala = numero(e.escala, 0.00001, 10);
    if (!escala) return null;
    return {
        escala,
        x: numero(e.x, -5, 5) ?? 0,
        y: numero(e.y, -5, 5) ?? 0,
        giro: [0, 90, 180, 270].includes(Number(e.giro)) ? Number(e.giro) : 0,
        // Tamaño de la imagen: para pintar la vista previa en la web sin abrirla antes.
        ancho: Math.round(numero(e.ancho, 1, 20000) || 0) || null,
        alto: Math.round(numero(e.alto, 1, 20000) || 0) || null,
    };
}

function sanearDiseno(p, i = 0) {
    p = p && typeof p === 'object' ? p : {};
    const tipos = ['color', 'degradado', 'imagen'];
    let fondoTipo = tipos.includes(p.fondoTipo) ? p.fondoTipo : 'degradado';
    const fondoImagen = fondoTipo === 'imagen' ? rutaImagen(p.fondoImagen) : null;
    if (fondoTipo === 'imagen' && !fondoImagen) fondoTipo = 'degradado'; // sin imagen todavía: sus colores
    return {
        id: (String(p.id || '').trim() || `custom-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`).slice(0, 40),
        nombre: String(p.nombre || 'Diseño').slice(0, 40),
        colorAcento: color(p.colorAcento, '#5865F2'),
        fondoColor: color(p.fondoColor, '#1e2030'),
        colorSecundario: color(p.colorSecundario, '#9b59b6'),
        fondoTipo,
        fondoImagen,
        encuadre: fondoImagen ? sanearEncuadre(p.encuadre) : null,
        premium: !!p.premium,
        animado: !!p.animado,
    };
}

// Opciones de render (utils/rankCard.js) de un diseño del catálogo.
function opcionesDeDiseno(d) {
    const opc = {
        color: d.colorAcento || '#5865F2',
        fondoTipo: d.fondoTipo || 'degradado',
        fondoColor: d.fondoColor,
        colorSecundario: d.colorSecundario,
        preset: d.id,
        animado: !!d.animado,
    };
    if (d.fondoTipo === 'imagen' && d.fondoImagen) {
        opc.fondoImagen = d.fondoImagen;
        opc.encuadre = d.encuadre || null;
    }
    return opc;
}

module.exports = { disenoDe, invalidarCatalogo, sanearDiseno, sanearEncuadre, opcionesDeDiseno };

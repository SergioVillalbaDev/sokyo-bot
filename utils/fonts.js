// Registra fuentes Noto en el canvas para que nombres con emojis, acentos,
// cirílico, etc. se dibujen bien (y no como rectángulos "tofu").
// Si @napi-rs/canvas o los .ttf no están, no pasa nada: se usa la fuente por
// defecto del sistema.
const fs = require('fs');
const path = require('path');

let GlobalFonts = null;
try { ({ GlobalFonts } = require('@napi-rs/canvas')); } catch { GlobalFonts = null; }

// Familia a usar en ctx.font. Skia hace fallback de glifos entre las fuentes
// registradas, así que los emojis de un nombre caen a "Noto Color Emoji".
const FUENTE = '"Noto Sans", "Noto Sans JP", "Noto Sans SC", "Noto Sans KR", "Noto Color Emoji", sans-serif';

function registrar(archivo, familia) {
    const ruta = path.join(__dirname, '..', 'assets', 'fonts', archivo);
    if (!fs.existsSync(ruta)) return;
    try { GlobalFonts.registerFromPath(ruta, familia); }
    catch (e) { console.warn(`No se pudo registrar la fuente ${archivo}:`, e.message); }
}

if (GlobalFonts) {
    registrar('NotoSans-Regular.ttf', 'Noto Sans');
    registrar('NotoSans-Bold.ttf', 'Noto Sans');
    // Escrituras CJK (japonés, chino simplificado, coreano). Skia hace fallback
    // de glifos a estas fuentes cuando "Noto Sans" no tiene el carácter.
    registrar('NotoSansJP-Regular.ttf', 'Noto Sans JP');
    registrar('NotoSansSC-Regular.ttf', 'Noto Sans SC');
    registrar('NotoSansKR-Regular.ttf', 'Noto Sans KR');
    // Emoji al final: solo se usa para los pictogramas.
    registrar('NotoColorEmoji.ttf', 'Noto Color Emoji');
}

module.exports = { FUENTE };

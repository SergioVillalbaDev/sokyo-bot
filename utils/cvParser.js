// ============================================================================
// Extrae texto plano de un CV subido (PDF o DOCX) para la búsqueda de empleo
// (ver slash/cv.js). Solo PDF/DOCX: cualquier otra extensión se rechaza antes
// de llegar aquí. También gestiona la foto de perfil opcional (/cv foto),
// necesaria solo para las ofertas que la piden explícitamente.
// ============================================================================
const path = require('path');
const fs = require('fs');

const EXTENSIONES_PERMITIDAS = ['.pdf', '.docx'];
const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5MB

// pdfkit (usado para incrustar la foto en el PDF adaptado) solo soporta JPEG/PNG.
const EXTENSIONES_FOTO_PERMITIDAS = ['.jpg', '.jpeg', '.png'];
const TAMANO_MAXIMO_FOTO_BYTES = 5 * 1024 * 1024; // 5MB
const FOTOS_DIR = path.join(__dirname, '..', 'data', 'perfiles-empleo');

function extensionValida(nombreArchivo) {
    const ext = (nombreArchivo.match(/\.[^.]+$/) || [''])[0].toLowerCase();
    return EXTENSIONES_PERMITIDAS.includes(ext) ? ext : null;
}

function extensionFotoValida(nombreArchivo) {
    const ext = (nombreArchivo.match(/\.[^.]+$/) || [''])[0].toLowerCase();
    return EXTENSIONES_FOTO_PERMITIDAS.includes(ext) ? ext : null;
}

// Guarda la foto en disco con un nombre generado a partir del discordId (nunca
// el nombre original del adjunto, para evitar path traversal). Devuelve la
// ruta absoluta guardada.
function guardarFoto(buffer, discordId, extension) {
    if (buffer.length > TAMANO_MAXIMO_FOTO_BYTES) throw new Error('The photo is too large (max 5MB).');
    fs.mkdirSync(FOTOS_DIR, { recursive: true });
    const ruta = path.join(FOTOS_DIR, `${discordId}${extension}`);
    fs.writeFileSync(ruta, buffer);
    return ruta;
}

async function extraerTextoCV(buffer, nombreArchivo) {
    if (buffer.length > TAMANO_MAXIMO_BYTES) {
        throw new Error('The file is too large (max 5MB).');
    }
    const ext = extensionValida(nombreArchivo);
    if (!ext) throw new Error('Only .pdf and .docx files are accepted.');

    if (ext === '.pdf') {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        return (data.text || '').trim();
    }

    const mammoth = require('mammoth');
    const { value } = await mammoth.extractRawText({ buffer });
    return (value || '').trim();
}

module.exports = {
    extraerTextoCV, extensionValida, EXTENSIONES_PERMITIDAS, TAMANO_MAXIMO_BYTES,
    extensionFotoValida, guardarFoto, EXTENSIONES_FOTO_PERMITIDAS, TAMANO_MAXIMO_FOTO_BYTES,
};

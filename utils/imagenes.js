// Imágenes que llegan desde el panel o «Mi cuenta» como dataURL (base64). Se mira qué
// son de verdad por sus primeros bytes y no por el tipo que dicen: algunas galerías del
// móvil no lo dicen o lo dicen mal («application/octet-stream»), y antes se rechazaban.

// 'png' | 'jpg' | 'gif' | 'webp' | null.
function extensionImagen(b) {
    if (!b || b.length < 12) return null;
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'gif';
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
    if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
    return null;
}

// dataURL → { buffer, ext, mime } si es una imagen que Discord enseña; si no, null.
function imagenDeDataUrl(datos) {
    const m = /^data:[^;,]*;base64,(.+)$/i.exec(String(datos || ''));
    if (!m) return null;
    const buffer = Buffer.from(m[1], 'base64');
    const ext = extensionImagen(buffer);
    return ext ? { buffer, ext, mime: `image/${ext === 'jpg' ? 'jpeg' : ext}` } : null;
}

const ERROR_NO_IMAGEN = 'Ese archivo no es una imagen que Discord enseñe (PNG, JPG, GIF o WebP).';

module.exports = { extensionImagen, imagenDeDataUrl, ERROR_NO_IMAGEN };

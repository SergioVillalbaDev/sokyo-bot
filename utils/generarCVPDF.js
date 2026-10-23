// ============================================================================
// Genera el PDF de un CV adaptado (salida de ia.adaptarCVParaOferta) usando
// pdfkit, ya instalado para las transcripciones de tickets (ver
// utils/ticketManager.js). Devuelve el Buffer del PDF, listo para guardar en
// disco o adjuntar a un mensaje de Discord.
//
// fotoBuffer es opcional (JPEG/PNG únicamente, límite de pdfkit): solo se
// incrusta cuando cv.requierePhoto es true Y el propietario tiene una foto
// guardada (ver slash/cv.js -> /cv foto).
// ============================================================================
const PDFDocument = require('pdfkit');

function generarPDFAdaptado(cv, fotoBuffer = null) {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const trozos = [];
    doc.on('data', (c) => trozos.push(c));
    const listo = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(trozos))));

    if (fotoBuffer) {
        try {
            const anchoFoto = 80;
            doc.image(fotoBuffer, doc.page.width - doc.page.margins.right - anchoFoto, doc.page.margins.top, { width: anchoFoto });
        } catch { /* formato de imagen no soportado por pdfkit: se omite sin romper el PDF */ }
    }

    if (cv.contacto) doc.fontSize(10).fillColor('#555').text(cv.contacto, { width: fotoBuffer ? doc.page.width - doc.page.margins.left - doc.page.margins.right - 100 : undefined });
    doc.moveDown(0.5);

    if (cv.resumen) {
        doc.fontSize(11).fillColor('#111').text(cv.resumen, { align: 'left' });
        doc.moveDown();
    }

    const asegurarEspacio = (alto = 60) => {
        if (doc.y + alto > doc.page.height - doc.page.margins.bottom) doc.addPage();
    };

    if ((cv.experiencia || []).length) {
        doc.fontSize(13).fillColor('#111').text('Experiencia', { underline: true });
        doc.moveDown(0.3);
        for (const e of cv.experiencia) {
            asegurarEspacio(70);
            doc.fontSize(11).fillColor('#111').text(`${e.puesto || ''} · ${e.empresa || ''}`);
            if (e.periodo) doc.fontSize(9).fillColor('#777').text(e.periodo);
            if (e.descripcion) doc.fontSize(10).fillColor('#333').text(e.descripcion);
            doc.moveDown(0.5);
        }
    }

    if ((cv.educacion || []).length) {
        asegurarEspacio(60);
        doc.fontSize(13).fillColor('#111').text('Educación', { underline: true });
        doc.moveDown(0.3);
        for (const ed of cv.educacion) {
            asegurarEspacio(40);
            doc.fontSize(11).fillColor('#111').text(`${ed.titulo || ''} · ${ed.centro || ''}`);
            if (ed.periodo) doc.fontSize(9).fillColor('#777').text(ed.periodo);
            doc.moveDown(0.4);
        }
    }

    if ((cv.habilidades || []).length) {
        asegurarEspacio(50);
        doc.fontSize(13).fillColor('#111').text('Habilidades', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(10).fillColor('#333').text(cv.habilidades.join(' · '));
    }

    doc.end();
    return listo;
}

// PDF sencillo de una carta de presentación (texto plano de ia.generarCartaPresentacion).
function generarPDFCarta(texto, contacto) {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const trozos = [];
    doc.on('data', (c) => trozos.push(c));
    const listo = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(trozos))));

    if (contacto) doc.fontSize(10).fillColor('#555').text(contacto);
    doc.moveDown(1.5);
    doc.fontSize(11).fillColor('#111').text(texto || '', { align: 'left', lineGap: 3 });

    doc.end();
    return listo;
}

module.exports = { generarPDFAdaptado, generarPDFCarta };

// ============================================================================
// Orquestador de la búsqueda de empleo (solo OWNER_IDS): scrapea InfoJobs y
// JobToday, descarta ofertas ya vistas, las puntúa contra el CV guardado con
// la IA, adapta el CV para las mejores (+ carta de presentación + respuestas
// a las preguntas de selección) y avisa por Discord con botones para marcar
// "aplicada". Lo usan tanto el comando manual (/buscoempleo) como el barrido
// automático diario (utils/scheduler.js).
// ============================================================================
const fs = require('fs');
const path = require('path');
const { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const PerfilEmpleo = require('../models/PerfilEmpleo.js');
const OfertaEmpleo = require('../models/OfertaEmpleo.js');
const { buscarOfertas, obtenerDetallesOfertas } = require('./scrapingEmpleo.js');
const { evaluarOfertasEmpleo, adaptarCVParaOferta, generarCartaPresentacion, responderPreguntasOferta } = require('./ia.js');
const { generarPDFAdaptado, generarPDFCarta } = require('./generarCVPDF.js');

const TIMEOUT_MS = 4 * 60 * 1000; // 4 min: un Puppeteer colgado no debe dejar el proceso corriendo indefinidamente
const LIMITE_ADJUNTOS_BYTES = 8 * 1024 * 1024; // tope propio para los archivos que se adjuntan al mensaje
const BOTONES_POR_FILA = 5; // límite de Discord por ActionRow

const carpetaSalida = () => process.env.JOB_SEARCH_OUTPUT_DIR || path.join(__dirname, '..', 'output', 'job-search');

// Quita query string/hash para que la misma oferta no se cuente dos veces por
// parámetros de tracking distintos entre ejecuciones.
function normalizarUrl(url) {
    try {
        const u = new URL(url);
        return `${u.origin}${u.pathname}`;
    } catch {
        return url;
    }
}

function conTimeout(promesa, ms) {
    let temporizador;
    const timeout = new Promise((_, reject) => {
        temporizador = setTimeout(() => reject(new Error('Job search timed out')), ms);
    });
    return Promise.race([promesa, timeout]).finally(() => clearTimeout(temporizador));
}

function construirBotonesAplicada(adaptadas) {
    const botones = adaptadas
        .filter((o) => o.ofertaId)
        .map((o) => new ButtonBuilder()
            .setCustomId(`empleo:aplicada:${o.ofertaId}`)
            .setLabel(`✅ Applied: ${(o.empresa || o.titulo || 'offer').slice(0, 60)}`)
            .setStyle(ButtonStyle.Success));
    const filas = [];
    for (let i = 0; i < botones.length; i += BOTONES_POR_FILA) {
        filas.push(new ActionRowBuilder().addComponents(botones.slice(i, i + BOTONES_POR_FILA)));
    }
    return filas;
}

async function obtenerCanalEmpleo(client) {
    const canalId = process.env.JOB_SEARCH_CHANNEL_ID;
    if (!canalId) { console.warn('⚠️ JOB_SEARCH_CHANNEL_ID no definido: no se puede avisar de la búsqueda de empleo.'); return null; }
    const canal = await client.channels.fetch(canalId).catch(() => null);
    if (!canal || !canal.isTextBased()) { console.warn('⚠️ Canal de búsqueda de empleo no encontrado o no es de texto.'); return null; }
    return canal;
}

async function postearAvisoDiscord(client, resumen) {
    const canal = await obtenerCanalEmpleo(client);
    if (!canal) return;

    const embed = new EmbedBuilder()
        .setColor(resumen.adaptadas.length ? 0x2ecc71 : 0xf1c40f)
        .setTitle('🔎 Job search results')
        .setDescription(`**${resumen.puesto}**${resumen.ubicacion ? ` · ${resumen.ubicacion}` : ''}`)
        .addFields(
            { name: 'Found', value: `${resumen.totalEncontradas}`, inline: true },
            { name: 'New', value: `${resumen.totalNuevas}`, inline: true },
            { name: 'CVs adapted', value: `${resumen.adaptadas.length}`, inline: true },
        )
        .setTimestamp();

    const avisos = [];
    if (resumen.errorInfojobs) avisos.push(`⚠️ InfoJobs: ${resumen.errorInfojobs}`);
    if (resumen.errorJobtoday) avisos.push(`⚠️ JobToday: ${resumen.errorJobtoday}`);
    if (resumen.ofertasSinFoto && resumen.ofertasSinFoto.length) {
        avisos.push(`📷 These offers likely want a photo attached but you don't have one saved yet (use \`/cv foto\`): ${resumen.ofertasSinFoto.join(', ')}`);
    }
    if (avisos.length) embed.addFields({ name: 'Warnings', value: avisos.join('\n').slice(0, 1024) });

    if (resumen.adaptadas.length) {
        const lineas = resumen.adaptadas
            .map((o) => `**${o.puntuacion}** · [${o.titulo}](${o.urlOferta}) — ${o.motivo || ''}`)
            .join('\n');
        embed.addFields({ name: 'Top matches', value: lineas.slice(0, 1024) });
        embed.addFields({ name: 'Included per offer', value: 'Adapted CV (PDF) · Cover letter (PDF) · Suggested Q&A answers (.txt) · Screenshot of the questions (.png, when detected) — click the button below once you\'ve applied.' });
    }

    embed.addFields({ name: 'Folder on the Pi', value: `\`${resumen.carpeta}\`` });

    // Adjunta el paquete (CV + carta + preguntas) de cada oferta hasta un tope de
    // bytes total; una oferta que no quepa entera se salta y se prueba con la
    // siguiente (el resto siempre queda disponible en la carpeta local).
    const adjuntos = [];
    let bytesAcumulados = 0;
    for (const o of resumen.adaptadas) {
        const partes = [];
        if (o.pdfBuffer) partes.push({ buffer: o.pdfBuffer, name: o.nombrePDF });
        if (o.pdfCartaBuffer) partes.push({ buffer: o.pdfCartaBuffer, name: o.nombreCarta });
        if (o.preguntasTexto) partes.push({ buffer: Buffer.from(o.preguntasTexto, 'utf8'), name: o.nombrePreguntas });
        if (o.capturaPreguntasBuffer) partes.push({ buffer: o.capturaPreguntasBuffer, name: o.nombreCaptura });
        const tamano = partes.reduce((acc, p) => acc + p.buffer.length, 0);
        if (bytesAcumulados + tamano > LIMITE_ADJUNTOS_BYTES) continue;
        bytesAcumulados += tamano;
        for (const p of partes) adjuntos.push(new AttachmentBuilder(p.buffer, { name: p.name }));
    }

    const componentes = construirBotonesAplicada(resumen.adaptadas);

    await canal.send({ embeds: [embed], files: adjuntos, components: componentes.length ? componentes : [] })
        .catch((e) => console.error('Aviso de búsqueda de empleo:', e.message));
}

async function ejecutarBusquedaEmpleoInterno(client, { discordId, puesto, ubicacion, umbral = 70, maxAdaptar = 5 }) {
    const perfil = await PerfilEmpleo.findOne({ discordId });
    if (!perfil || !perfil.cvEstructurado || !perfil.cvEstructurado.resumen) {
        throw new Error('No CV on file yet — upload one first with /cv subir.');
    }

    const { infojobs, jobtoday } = await buscarOfertas(puesto, ubicacion, 20);
    const todas = [...infojobs.ofertas, ...jobtoday.ofertas].map((o) => ({ ...o, urlOferta: normalizarUrl(o.url) }));

    // Dedupe: solo evaluamos las que no se han visto antes para este owner.
    const yaVistas = new Set(
        (await OfertaEmpleo.find({ discordId, urlOferta: { $in: todas.map((o) => o.urlOferta) } }).select('urlOferta').lean())
            .map((o) => o.urlOferta),
    );
    const nuevas = todas.filter((o) => !yaVistas.has(o.urlOferta));

    let puntuaciones = [];
    if (nuevas.length) {
        const evaluadas = await evaluarOfertasEmpleo(perfil.cvEstructurado, nuevas, 'en');
        const porUrl = new Map(evaluadas.map((e) => [normalizarUrl(e.url), e]));
        puntuaciones = nuevas.map((o) => ({ ...o, puntuacion: (porUrl.get(o.urlOferta) || {}).puntuacion ?? 0, motivo: (porUrl.get(o.urlOferta) || {}).motivo || '' }));

        // Persistimos TODAS las evaluadas (para no volver a evaluarlas mañana), aunque no lleguen al umbral.
        for (const o of puntuaciones) {
            await OfertaEmpleo.updateOne(
                { discordId, urlOferta: o.urlOferta },
                { $setOnInsert: { discordId, urlOferta: o.urlOferta, portal: o.portal, titulo: o.titulo, empresa: o.empresa, ubicacion: o.ubicacion, fechaVista: new Date() }, $set: { puntuacion: o.puntuacion, motivo: o.motivo, estado: o.puntuacion >= umbral ? 'evaluada' : 'descartada' } },
                { upsert: true },
            );
        }
    }

    const buenMatch = puntuaciones.filter((o) => o.puntuacion >= umbral).sort((a, b) => b.puntuacion - a.puntuacion).slice(0, maxAdaptar);

    const carpeta = path.join(carpetaSalida(), new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
    fs.mkdirSync(carpeta, { recursive: true });

    // Se lee una sola vez y se reutiliza; solo se incrusta en el PDF si la IA
    // decide que la oferta concreta la pide (ver adaptarCVParaOferta en ia.js).
    const fotoBuffer = perfil.fotoRuta && fs.existsSync(perfil.fotoRuta) ? fs.readFileSync(perfil.fotoRuta) : null;

    // Descripción completa + preguntas de selección (si el portal las expone),
    // solo para las pocas ofertas que van a adaptarse (no para todo el listado).
    const detalles = await obtenerDetallesOfertas(buenMatch);

    const adaptadas = [];
    const ofertasSinFoto = [];
    for (const oferta of buenMatch) {
        try {
            const detalle = detalles.get(oferta.urlOferta) || {};
            const ofertaConDetalle = { ...oferta, descripcion: detalle.descripcionCompleta || oferta.descripcion };

            const cvAdaptado = await adaptarCVParaOferta(perfil.cvEstructurado, ofertaConDetalle, 'en');
            const necesitaFoto = !!cvAdaptado.requierePhoto;
            const pdfBuffer = await generarPDFAdaptado(cvAdaptado, necesitaFoto ? fotoBuffer : null);
            if (necesitaFoto && !fotoBuffer) ofertasSinFoto.push(oferta.titulo);

            const slug = `${(oferta.empresa || oferta.portal).replace(/[^a-z0-9]+/gi, '_')}_${(oferta.titulo || '').replace(/[^a-z0-9]+/gi, '_').slice(0, 40)}`;
            const nombrePDF = `CV_${slug}.pdf`;
            fs.writeFileSync(path.join(carpeta, nombrePDF), pdfBuffer);

            // Carta de presentación: no crítica, si falla no se pierde el CV ya generado.
            let pdfCartaBuffer = null;
            let nombreCarta = null;
            try {
                const cartaTexto = await generarCartaPresentacion(perfil.cvEstructurado, ofertaConDetalle, 'en');
                pdfCartaBuffer = await generarPDFCarta(cartaTexto, cvAdaptado.contacto);
                nombreCarta = `Carta_${slug}.pdf`;
                fs.writeFileSync(path.join(carpeta, nombreCarta), pdfCartaBuffer);
            } catch (e) {
                console.error(`Búsqueda de empleo: fallo generando la carta para "${oferta.titulo}":`, e.message);
            }

            // Preguntas de selección: idem, no crítico.
            let preguntasTexto = null;
            let nombrePreguntas = null;
            try {
                const respuestas = await responderPreguntasOferta(perfil.cvEstructurado, ofertaConDetalle, detalle.preguntas || [], 'en');
                if (respuestas.length) {
                    preguntasTexto = respuestas.map((r) => `P: ${r.pregunta}\nR: ${r.respuesta}`).join('\n\n');
                    nombrePreguntas = `Preguntas_${slug}.txt`;
                    fs.writeFileSync(path.join(carpeta, nombrePreguntas), preguntasTexto);
                }
            } catch (e) {
                console.error(`Búsqueda de empleo: fallo preparando preguntas para "${oferta.titulo}":`, e.message);
            }

            // Captura de pantalla de la sección de preguntas, si se detectó y pudo
            // capturarse (ver utils/scrapingEmpleo.js -> obtenerDetalleOferta). Sirve
            // como referencia visual además de las respuestas en texto.
            const capturaPreguntasBuffer = detalle.capturaPreguntas || null;
            const nombreCaptura = capturaPreguntasBuffer ? `Captura_preguntas_${slug}.png` : null;
            if (capturaPreguntasBuffer) fs.writeFileSync(path.join(carpeta, nombreCaptura), capturaPreguntasBuffer);

            const ofertaDoc = await OfertaEmpleo.findOneAndUpdate(
                { discordId, urlOferta: oferta.urlOferta },
                {
                    $set: {
                        estado: 'adaptada',
                        rutaPDF: path.join(carpeta, nombrePDF),
                        rutaCarta: nombreCarta ? path.join(carpeta, nombreCarta) : null,
                        rutaPreguntas: nombrePreguntas ? path.join(carpeta, nombrePreguntas) : null,
                        rutaCapturaPreguntas: nombreCaptura ? path.join(carpeta, nombreCaptura) : null,
                    },
                },
                { new: true },
            );

            adaptadas.push({
                ...oferta, pdfBuffer, nombrePDF, pdfCartaBuffer, nombreCarta, preguntasTexto, nombrePreguntas,
                capturaPreguntasBuffer, nombreCaptura, ofertaId: ofertaDoc ? ofertaDoc._id.toString() : null,
            });
        } catch (e) {
            console.error(`Búsqueda de empleo: fallo adaptando CV para "${oferta.titulo}":`, e.message);
        }
    }

    fs.writeFileSync(
        path.join(carpeta, 'resumen.json'),
        JSON.stringify({ puesto, ubicacion, fecha: new Date().toISOString(), evaluadas: puntuaciones, errores: { infojobs: infojobs.error, jobtoday: jobtoday.error } }, null, 2),
    );

    const resumen = {
        puesto, ubicacion, carpeta,
        totalEncontradas: todas.length,
        totalNuevas: nuevas.length,
        adaptadas,
        ofertasSinFoto,
        errorInfojobs: infojobs.error,
        errorJobtoday: jobtoday.error,
    };

    await postearAvisoDiscord(client, resumen);
    return resumen;
}

// Envoltorio público: aplica el lock (evita 2 Puppeteer a la vez en la Pi) y el
// timeout duro, y siempre libera el lock aunque falle o expire.
async function ejecutarBusquedaEmpleo(client, opciones) {
    const { discordId } = opciones;
    const perfil = await PerfilEmpleo.findOne({ discordId });
    if (perfil && perfil.enEjecucion) {
        return { error: 'A job search is already running for you — wait for it to finish.' };
    }
    await PerfilEmpleo.updateOne({ discordId }, { $set: { enEjecucion: true, ultimaEjecucionEn: new Date() } });

    try {
        console.log(`🔎 Job search started for ${discordId}: "${opciones.puesto}"${opciones.ubicacion ? ` (${opciones.ubicacion})` : ''}`);
        const resultado = await conTimeout(ejecutarBusquedaEmpleoInterno(client, opciones), TIMEOUT_MS);
        console.log(`✅ Job search finished for ${discordId}: ${resultado.totalNuevas} new, ${resultado.adaptadas.length} adapted.`);
        return resultado;
    } catch (e) {
        console.error(`🔴 Job search failed for ${discordId}:`, e.message);
        return { error: e.message };
    } finally {
        await PerfilEmpleo.updateOne({ discordId }, { $set: { enEjecucion: false } });
    }
}

// Resumen semanal (ver utils/scheduler.js): siempre se envía, aunque esa
// semana no haya salido ninguna oferta nueva, para no depender solo del
// aviso diario de cada ejecución individual.
async function enviarResumenSemanalEmpleo(client, discordId) {
    const canal = await obtenerCanalEmpleo(client);
    if (!canal) return;

    const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const conteos = await OfertaEmpleo.aggregate([
        { $match: { discordId, fechaVista: { $gte: desde } } },
        { $group: { _id: '$estado', n: { $sum: 1 } } },
    ]);
    const porEstado = Object.fromEntries(conteos.map((c) => [c._id, c.n]));
    const pendientes = await OfertaEmpleo.countDocuments({ discordId, estado: 'adaptada' });

    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🗓️ Weekly job search digest')
        .setDescription('Last 7 days')
        .addFields(
            { name: 'New offers seen', value: `${(porEstado.evaluada || 0) + (porEstado.descartada || 0) + (porEstado.adaptada || 0)}`, inline: true },
            { name: 'Adapted', value: `${porEstado.adaptada || 0}`, inline: true },
            { name: 'Applied', value: `${porEstado.aplicada || 0}`, inline: true },
            { name: 'Pending applications (all time)', value: `${pendientes}`, inline: true },
        )
        .setFooter({ text: 'Use /empleo estado to see and mark them.' })
        .setTimestamp();

    await canal.send({ embeds: [embed] }).catch((e) => console.error('Resumen semanal de empleo:', e.message));
}

module.exports = { ejecutarBusquedaEmpleo, construirBotonesAplicada, enviarResumenSemanalEmpleo };

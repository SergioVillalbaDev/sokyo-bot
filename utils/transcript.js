// Generación de transcripts de un ticket:
//  - TXT: ligero, se previsualiza dentro de Discord (se envía por DM al usuario).
//  - HTML: con estilo tipo Discord, avatares e imágenes (canal de transcripts y panel web).
const { AttachmentBuilder } = require('discord.js');
const { escaparHtml, slug } = require('./texto.js');

const fechaLarga = (fecha) => fecha ? new Date(fecha).toLocaleString('es-ES') : '—';
const etiqueta = (ticket) => ticket.numero ? `#${String(ticket.numero).padStart(4, '0')}` : '';
const esImagen = (url) => /\.(png|jpe?g|gif|webp|avif)$/i.test((() => { try { return new URL(url).pathname; } catch { return url; } })());
const nombreArchivo = (url) => { try { return decodeURIComponent(new URL(url).pathname.split('/').pop()); } catch { return 'archivo'; } };

function generarTranscriptTxt(ticket, mensajes) {
    const lineas = [
        `=== TRANSCRIPCIÓN DEL TICKET ${etiqueta(ticket)} ===`,
        `Asunto: ${ticket.titulo || '-'}`,
        `Usuario: ${ticket.creadorNombre}`,
        `Categoría: ${ticket.motivo}`,
        `Prioridad: ${ticket.prioridad}`,
        `Atendido por: ${ticket.asignadoNombre || 'Sin asignar'}`,
        `Abierto: ${fechaLarga(ticket.fechaCreacion)}`,
        `Cerrado: ${fechaLarga(ticket.fechaCierre)}`,
        '='.repeat(40),
        '',
        `[Descripción inicial] ${ticket.descripcion || '-'}`,
        ''
    ];

    if (mensajes.length === 0) lineas.push('(No se registraron mensajes)');
    for (const m of mensajes) {
        const marcas = [m.esStaff && 'STAFF', m.editado && 'editado', m.borrado && 'borrado'].filter(Boolean);
        const sufijo = marcas.length ? ` (${marcas.join(', ')})` : '';
        lineas.push(`[${fechaLarga(m.fecha)}] ${m.usuario}${sufijo}: ${m.contenido || ''}`.trimEnd());
        (m.imagenes || []).forEach(url => lineas.push(`    📎 ${url}`));
    }
    return lineas.join('\n');
}

function generarTranscriptHtml(ticket, mensajes, { nombreServidor = '' } = {}) {
    const filasInfo = [
        ['Usuario', ticket.creadorNombre],
        ['Categoría', ticket.motivo],
        ['Prioridad', ticket.prioridad],
        ['Atendido por', ticket.asignadoNombre || 'Sin asignar'],
        ['Abierto', fechaLarga(ticket.fechaCreacion)],
        ['Cerrado', ticket.fechaCierre ? `${fechaLarga(ticket.fechaCierre)} por ${ticket.cerradoPor || '—'}` : 'Sigue abierto'],
        ['Valoración', ticket.valoracionCSAT ? `${'★'.repeat(ticket.valoracionCSAT)}${'☆'.repeat(5 - ticket.valoracionCSAT)}` : 'Sin valorar']
    ].map(([k, v]) => `<div class="dato"><span>${escaparHtml(k)}</span><strong>${escaparHtml(v)}</strong></div>`).join('');

    const htmlMensajes = mensajes.length === 0
        ? '<p class="vacio">No se registraron mensajes en este ticket.</p>'
        : mensajes.map(m => {
            const avatar = m.avatar
                ? `<img class="avatar" src="${escaparHtml(m.avatar)}" alt="">`
                : `<div class="avatar inicial">${escaparHtml((m.usuario || '?').charAt(0).toUpperCase())}</div>`;
            const adjuntos = (m.imagenes || []).map(url => esImagen(url)
                ? `<a href="${escaparHtml(url)}" target="_blank" rel="noopener"><img class="adjunto" src="${escaparHtml(url)}" alt="adjunto"></a>`
                : `<a class="archivo" href="${escaparHtml(url)}" target="_blank" rel="noopener">📎 ${escaparHtml(nombreArchivo(url))}</a>`).join('');
            return `<div class="msg${m.borrado ? ' borrado' : ''}">${avatar}<div class="cuerpo">
                <div class="cabecera"><span class="autor${m.esStaff ? ' staff' : ''}">${escaparHtml(m.usuario)}</span>${m.esStaff ? '<span class="tag">STAFF</span>' : ''}<span class="hora">${escaparHtml(fechaLarga(m.fecha))}</span>${m.editado ? '<span class="marca">(editado)</span>' : ''}${m.borrado ? '<span class="marca">(borrado)</span>' : ''}</div>
                ${m.contenido ? `<div class="texto">${escaparHtml(m.contenido).replace(/\n/g, '<br>')}</div>` : ''}${adjuntos}
            </div></div>`;
        }).join('\n');

    return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Transcript ${escaparHtml(etiqueta(ticket))} · ${escaparHtml(ticket.titulo || ticket.motivo)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #313338; color: #dbdee1; font: 15px/1.45 "gg sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  header { background: #2b2d31; padding: 24px 28px; border-bottom: 1px solid #1e1f22; }
  header small { color: #949ba4; text-transform: uppercase; letter-spacing: .06em; font-size: 12px; }
  h1 { margin: 6px 0 16px; color: #f2f3f5; font-size: 22px; }
  .datos { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }
  .dato { background: #1e1f22; border-radius: 8px; padding: 8px 12px; display: flex; flex-direction: column; }
  .dato span { color: #949ba4; font-size: 12px; } .dato strong { color: #f2f3f5; font-weight: 600; }
  .descripcion { margin-top: 16px; padding: 12px 14px; border-left: 4px solid #5865f2; background: #1e1f22; border-radius: 4px; white-space: pre-wrap; }
  main { padding: 12px 28px 40px; }
  .msg { display: flex; gap: 14px; padding: 8px 0; }
  .msg.borrado { opacity: .55; }
  .avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; object-fit: cover; }
  .avatar.inicial { background: #5865f2; color: #fff; display: grid; place-items: center; font-weight: 700; }
  .cabecera { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .autor { color: #f2f3f5; font-weight: 600; } .autor.staff { color: #8ea1ff; }
  .tag { background: #5865f2; color: #fff; font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 4px; }
  .hora, .marca { color: #949ba4; font-size: 12px; }
  .texto { white-space: pre-wrap; word-wrap: break-word; }
  .adjunto { display: block; max-width: min(420px, 100%); max-height: 320px; border-radius: 8px; margin-top: 6px; }
  .archivo { display: inline-block; margin-top: 6px; color: #00a8fc; }
  .vacio { color: #949ba4; text-align: center; padding: 40px 0; }
  footer { color: #949ba4; font-size: 12px; text-align: center; padding: 20px; }
</style></head>
<body>
<header>
  <small>${escaparHtml(nombreServidor || 'Sokyo')} · Transcript ${escaparHtml(etiqueta(ticket))}</small>
  <h1>${escaparHtml(ticket.titulo || ticket.motivo)}</h1>
  <div class="datos">${filasInfo}</div>
  <div class="descripcion">${escaparHtml(ticket.descripcion || 'Sin descripción')}</div>
</header>
<main>
${htmlMensajes}
</main>
<footer>Generado por Sokyo el ${escaparHtml(fechaLarga(new Date()))} · ${mensajes.length} mensajes</footer>
</body></html>`;
}

function nombreTranscript(ticket, extension) {
    const num = ticket.numero ? `${String(ticket.numero).padStart(4, '0')}-` : '';
    return `transcript-${num}${slug(ticket.creadorNombre)}.${extension}`;
}

const adjuntoTxt = (ticket, mensajes) =>
    new AttachmentBuilder(Buffer.from(generarTranscriptTxt(ticket, mensajes), 'utf-8'), { name: nombreTranscript(ticket, 'txt') });

const adjuntoHtml = (ticket, mensajes, opciones) =>
    new AttachmentBuilder(Buffer.from(generarTranscriptHtml(ticket, mensajes, opciones), 'utf-8'), { name: nombreTranscript(ticket, 'html') });

module.exports = { generarTranscriptTxt, generarTranscriptHtml, nombreTranscript, adjuntoTxt, adjuntoHtml };

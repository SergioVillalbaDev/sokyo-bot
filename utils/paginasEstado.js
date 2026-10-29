// Páginas públicas /estado (¿funciona Sokyo ahora mismo?) y /novedades (lo nuevo
// de cada versión). Mismo aspecto que la página de cada servidor y el directorio
// (utils/paginaPublica.js), sin sesión y en español o inglés.
const mongoose = require('mongoose');
const { documento, cabecera, pie, TEXTO, esc } = require('./paginaPublica.js');
const { NOVEDADES, novedadesDe } = require('./novedades.js');
const { version } = require('../package.json');

const T = {
    es: {
        estadoTitulo: 'Estado de Sokyo', estadoDesc: 'Si el bot, el panel y la música funcionan ahora mismo.',
        todoBien: 'Todo funciona', casiTodo: 'Todo funciona salvo la música', algoFalla: 'Hay algo que no va bien', comprobado: 'Comprobado', actualiza: 'Se actualiza sola cada minuto.',
        bot: 'Bot de Discord', panel: 'Panel de control y Mi cuenta', datos: 'Base de datos', musica: 'Música',
        ok: 'Funciona', caido: 'No responde', lento: 'Lento', sinMusica: 'No conectado',
        latencia: (ms) => `${ms} ms de respuesta`, servidores: (n) => `En ${n.toLocaleString('es-ES')} servidores`,
        encendido: (h) => `Encendido desde hace ${h}`, version: (v) => `Versión ${v}`,
        verNovedades: 'Ver las novedades', siFalla: '¿Algo no te funciona en tu servidor? En el panel, «¿Algo no funciona?» lo revisa y te dice cómo arreglarlo.',
        novTitulo: 'Novedades de Sokyo', novDesc: 'Lo nuevo de cada versión del bot, el panel y Mi cuenta.', vActual: 'Versión actual', vNum: (v) => `Versión ${v}`,
        horas: (s) => (s < 3600 ? `${Math.max(1, Math.round(s / 60))} min` : s < 86400 ? `${Math.round(s / 3600)} h` : `${Math.round(s / 86400)} días`),
    },
    en: {
        estadoTitulo: 'Sokyo status', estadoDesc: 'Whether the bot, the panel and music are working right now.',
        todoBien: 'All systems working', casiTodo: 'Everything works except music', algoFalla: 'Something isn’t working', comprobado: 'Checked', actualiza: 'Refreshes by itself every minute.',
        bot: 'Discord bot', panel: 'Control panel & My account', datos: 'Database', musica: 'Music',
        ok: 'Working', caido: 'Not responding', lento: 'Slow', sinMusica: 'Not connected',
        latencia: (ms) => `${ms} ms response time`, servidores: (n) => `On ${n.toLocaleString('en-US')} servers`,
        encendido: (h) => `Up for ${h}`, version: (v) => `Version ${v}`,
        verNovedades: 'See what’s new', siFalla: 'Something not working on your server? In the panel, “Something not working?” checks it and tells you how to fix it.',
        novTitulo: 'What’s new in Sokyo', novDesc: 'What’s new in each version of the bot, the panel and My account.', vActual: 'Current version', vNum: (v) => `Version ${v}`,
        horas: (s) => (s < 3600 ? `${Math.max(1, Math.round(s / 60))} min` : s < 86400 ? `${Math.round(s / 3600)} h` : `${Math.round(s / 86400)} days`),
    },
};

const CSS_EXTRA = `<style>
.estado{display:flex;align-items:center;gap:14px;padding:22px;margin-top:22px}
.estado .luz{width:16px;height:16px;border-radius:50%;flex-shrink:0;box-shadow:0 0 18px currentColor}
.verde{color:#4ade80;background:#4ade80}.ambar{color:#fbbf24;background:#fbbf24}.rojo{color:#f87171;background:#f87171}
.estado h1{margin:0;font-size:clamp(22px,4vw,30px)}
.servicio{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.servicio .izq{display:flex;align-items:center;gap:12px;min-width:0}
.servicio .luz{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.marcador{font-size:13px;font-weight:700;border-radius:999px;padding:4px 10px;background:var(--el);border:1px solid var(--line)}
.nov{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.nov li{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;color:#d6d9ef}
.version{margin-top:28px}.version h2{display:flex;align-items:center;gap:10px}
.pill{font-size:12px;font-weight:800;color:var(--on);background:var(--accent);border-radius:999px;padding:3px 9px}
</style>`;

function servicioHtml(nombre, color, estado, detalle) {
    return `<div class="fila servicio"><span class="izq"><span class="luz ${color}"></span><span><b>${esc(nombre)}</b>${detalle ? `<span class="tenue">${esc(detalle)}</span>` : ''}</span></span><span class="marcador">${esc(estado)}</span></div>`;
}

function paginaEstado(client, { lang, base }) {
    const L = { ...TEXTO[lang], ...T[lang] };
    const discordOk = !!(client && typeof client.isReady === 'function' && client.isReady());
    const mongoOk = mongoose.connection.readyState === 1;
    const ping = discordOk ? Math.round(client.ws.ping) : null;
    let musica = null;
    try { musica = require('./musica.js').estadoServidorMusica(); } catch { musica = null; }
    const musicaOk = !!musica?.conectado && !musica?.desactualizado && !musica?.vozRechazada;
    const todo = discordOk && mongoOk;
    const servidores = discordOk ? client.guilds.cache.size : 0;
    const cuerpo = `${cabecera(L)}
<main>
<div class="tarjeta estado"><span class="luz ${todo ? (musicaOk ? 'verde' : 'ambar') : 'rojo'}"></span><div><h1>${esc(!todo ? L.algoFalla : musicaOk ? L.todoBien : L.casiTodo)}</h1>
<span class="tenue">${esc(L.comprobado)} ${esc(new Date().toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-US', { hour: '2-digit', minute: '2-digit' }))} · ${esc(L.actualiza)}</span></div></div>
<div class="lista seccion">
${servicioHtml(L.bot, discordOk ? (ping > 400 ? 'ambar' : 'verde') : 'rojo', discordOk ? (ping > 400 ? L.lento : L.ok) : L.caido, discordOk ? `${L.latencia(ping)} · ${L.servidores(servidores)}` : '')}
${servicioHtml(L.panel, 'verde', L.ok, `${L.version(version)} · ${L.encendido(L.horas(process.uptime()))}`)}
${servicioHtml(L.datos, mongoOk ? 'verde' : 'rojo', mongoOk ? L.ok : L.caido, '')}
${servicioHtml(L.musica, musicaOk ? 'verde' : 'ambar', musicaOk ? L.ok : L.sinMusica, musica?.version ? `Lavalink ${musica.version}` : '')}
</div>
<p class="aviso">${esc(L.siFalla)}</p>
<div class="acciones"><a class="btn btn-sec" href="/novedades${lang === 'es' ? '' : '?lang=en'}">${esc(L.verNovedades)}</a></div>
</main>
${pie(L)}`;
    const html = documento({ lang, titulo: `${L.estadoTitulo} · Sokyo`, descripcion: L.estadoDesc, url: `${base}/estado`, cuerpo, indexar: true });
    // Se recarga sola cada minuto.
    return html.replace('</head>', `<meta http-equiv="refresh" content="60">${CSS_EXTRA}</head>`);
}

function paginaNovedades({ lang, base }) {
    const L = { ...TEXTO[lang], ...T[lang] };
    const versiones = Object.keys(NOVEDADES).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    const bloques = versiones.map((v) => `<section class="version"><h2>${esc(L.vNum(v))}${v === version ? ` <span class="pill">${esc(L.vActual)}</span>` : ''}</h2>
<ul class="nov">${novedadesDe(v, lang).map((n) => `<li>${esc(n.texto)}</li>`).join('')}</ul></section>`).join('\n');
    const cuerpo = `${cabecera(L)}
<main><h1 class="titulo"><span class="grad">${esc(L.novTitulo)}</span></h1><p class="tenue" style="font-size:16px">${esc(L.novDesc)}</p>
${bloques}
</main>
${pie(L)}`;
    return documento({ lang, titulo: `${L.novTitulo} · Sokyo`, descripcion: L.novDesc, url: `${base}/novedades`, cuerpo, indexar: true })
        .replace('</head>', `${CSS_EXTRA}</head>`);
}

module.exports = { paginaEstado, paginaNovedades };

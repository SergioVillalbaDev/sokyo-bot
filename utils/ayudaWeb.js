// 📖 Web pública de ayuda (1.34.0): /ayuda (todo, por zonas, con el mapa del juego) y /ayuda/<función> (cómo se
// usa, con los comandos de verdad y a qué se conecta). Sale del mismo catálogo (utils/catalogo.js) que /menu, ❔ y el
// panel: lo que se explica aquí es lo que hace el bot. El botón «📖 Guía en la web» de las ayudas lleva aquí.
const C = require('./catalogo.js');
const { documento, cabecera, pie, TEXTO, esc } = require('./paginaPublica.js');

const base = () => String(process.env.FRONTEND_URL || '').replace(/\/+$/, '');
// Enlace a la guía (null si no hay dirección pública configurada: entonces no se pone el botón).
function enlace(modId = null, idioma = 'es') {
    const b = base();
    if (!/^https:\/\//.test(b)) return null;
    return `${b}/ayuda${modId ? `/${encodeURIComponent(modId)}` : ''}${idioma === 'en' ? '?lang=en' : ''}`;
}
const T = {
    es: { titulo: 'Cómo funciona Sokyo', desc: 'Todo lo que puedes hacer con el bot, explicado en sencillo: juegos, mascotas, comunidad y más.', mapa: 'El mapa del juego', volver: '← Toda la ayuda', comandos: 'Cómo se usa', conecta: 'Va junto con', panel: 'Para el staff: se configura en el panel', empieza: '¿No sabes por dónde empezar? Escribe /empezar en Discord o /menu para ver lo tuyo.' },
    en: { titulo: 'How Sokyo works', desc: 'Everything you can do with the bot, explained simply: games, pets, community and more.', mapa: 'The game map', volver: '← All help', comandos: 'How to use it', conecta: 'Goes with', panel: 'For staff: set it up in the panel', empieza: 'Not sure where to start? Type /start in Discord, or /menu to see your stuff.' },
};
const CSS = `<style>
.zona{margin-top:26px}.zona h2{font-size:20px;margin:0 0 12px}
.mods{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
.mod{display:block;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px;text-decoration:none;color:var(--fg)}
.mod:hover{border-color:var(--accent)}.mod b{display:block;font-size:16px;margin-bottom:4px}.mod span{color:var(--muted);font-size:14px}
.mapa{width:100%;height:auto;border-radius:18px;border:1px solid var(--line);margin-top:14px}
.pasos{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px 20px;line-height:1.7}
.pasos code{background:var(--el);padding:2px 6px;border-radius:6px}
.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{font-size:14px;font-weight:600;border:1px solid var(--line);border-radius:999px;padding:6px 12px;text-decoration:none;color:var(--fg);background:var(--card)}
</style>`;
// `code` sin HTML: el texto viene del catálogo (nuestro), pero se escapa igual.
const conCodigo = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
// A qué se conecta cada función (para «Va junto con»), según el mapa del juego.
const CONECTA = {
    oro: ['casino', 'cofres', 'mascotas', 'pase'], casino: ['oro', 'pase'], cofres: ['mascotas', 'oro'], cartas: ['mascotas', 'combates'], combates: ['mascotas', 'clanes', 'cartas'],
    pase: ['oro', 'mascotas', 'casino'], mascotas: ['cofres', 'oro', 'combates', 'cartas'], mascotaServidor: ['liga'], liga: ['mascotaServidor'], clanes: ['combates', 'niveles'],
    niveles: ['clanes', 'temporadas'], temporadas: ['niveles'], bromas: ['oro'],
};

function paginaIndice({ lang, url }) {
    const L = { ...TEXTO[lang], ...T[lang] };
    const t = (es, en) => (lang === 'en' ? en : es);
    const zonas = ['basico', 'jugar', 'mascotas', 'comunidad', 'musica', 'crecimiento', 'staff'].map((z) => {
        const ms = C.MODULOS.filter((m) => m.zona === z);
        return `<section class="zona"><h2>${esc(C.ZONAS[z].emoji)} ${esc(t(C.ZONAS[z].es, C.ZONAS[z].en))}</h2><div class="mods">${ms.map((m) => `<a class="mod" href="/ayuda/${esc(m.id)}${lang === 'en' ? '?lang=en' : ''}"><b>${esc(m.emoji)} ${esc(t(m.es, m.en))}</b><span>${esc(t(m.frase.es, m.frase.en))}</span></a>`).join('')}</div></section>`;
    }).join('\n');
    const cuerpo = `${cabecera(L)}
<main><h1 class="titulo"><span class="grad">${esc(L.titulo)}</span></h1><p class="tenue" style="font-size:16px">${esc(L.desc)}</p>
<p>${esc(L.empieza)}</p>
<section class="zona"><h2>🗺️ ${esc(L.mapa)}</h2><img class="mapa" src="/ayuda/mapa.png${lang === 'en' ? '?lang=en' : ''}" alt="${esc(L.mapa)}" width="900" height="620" loading="lazy"></section>
${zonas}
</main>
${pie(L)}`;
    return documento({ lang, titulo: `${L.titulo} · Sokyo`, descripcion: L.desc, url, cuerpo, indexar: true }).replace('</head>', `${CSS}</head>`);
}

function paginaModulo({ lang, url, id }) {
    const m = C.modulo(id);
    if (!m) return null;
    const L = { ...TEXTO[lang], ...T[lang] };
    const t = (es, en) => (lang === 'en' ? en : es);
    const relacion = (CONECTA[m.id] || []).map((x) => C.modulo(x)).filter(Boolean);
    const cuerpo = `${cabecera(L)}
<main><p><a class="chip" href="/ayuda${lang === 'en' ? '?lang=en' : ''}">${esc(L.volver)}</a></p>
<h1 class="titulo">${esc(m.emoji)} <span class="grad">${esc(t(m.es, m.en))}</span></h1>
<p class="tenue" style="font-size:17px">${esc(t(m.frase.es, m.frase.en))}</p>
<section class="zona"><h2>🎮 ${esc(L.comandos)}</h2><div class="pasos">${t(m.pasos.es, m.pasos.en).map((l) => `<div>• ${conCodigo(l)}</div>`).join('')}</div></section>
${relacion.length ? `<section class="zona"><h2>🔗 ${esc(L.conecta)}</h2><div class="chips">${relacion.map((r) => `<a class="chip" href="/ayuda/${esc(r.id)}${lang === 'en' ? '?lang=en' : ''}">${esc(r.emoji)} ${esc(t(r.es, r.en))}</a>`).join('')}</div></section>` : ''}
${m.tab ? `<p class="tenue" style="margin-top:22px">🛠️ ${esc(L.panel)} → <a href="/panel#dashboard/${esc(m.tab)}">${esc(t(m.es, m.en))}</a></p>` : ''}
</main>
${pie(L)}`;
    return documento({ lang, titulo: `${t(m.es, m.en)} · ${L.titulo}`, descripcion: t(m.frase.es, m.frase.en), url, cuerpo, indexar: true }).replace('</head>', `${CSS}</head>`);
}

// Todo encendido para el mapa de la web (es la guía general, no la de un servidor).
const TODO = new Proxy({}, { get: (o, k) => (k === 'casino' ? { activo: true, cofres: true } : k === 'compis' ? { anime: true } : k === 'nivelesActivo' ? true : { activo: true }) });

function montar(app) {
    const rateLimit = require('express-rate-limit');
    const lim = rateLimit({ keyGenerator: require('./ipCliente.js').claveLimite, windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
    const lang = (req) => (['es', 'en'].includes(req.query.lang) ? req.query.lang : (req.acceptsLanguages('es', 'en') || 'es'));
    const base2 = (req) => require('./paginaPublica.js').urlBase(req);
    app.get('/ayuda', lim, (req, res) => res.set('Content-Type', 'text/html; charset=utf-8').set('Cache-Control', 'public, max-age=300').send(paginaIndice({ lang: lang(req), url: `${base2(req)}/ayuda` })));
    app.get('/ayuda/mapa.png', lim, (req, res) => {
        const png = require('./mapaJuego.js').dibujar(TODO, lang(req));
        if (!png) return res.status(404).end();
        res.set('Content-Type', 'image/png').set('Cache-Control', 'public, max-age=3600').send(png);
    });
    app.get('/ayuda/:id', lim, (req, res) => {
        const html = paginaModulo({ lang: lang(req), url: `${base2(req)}/ayuda/${req.params.id}`, id: String(req.params.id) });
        if (!html) return res.redirect(302, '/ayuda');
        res.set('Content-Type', 'text/html; charset=utf-8').set('Cache-Control', 'public, max-age=300').send(html);
    });
}

module.exports = { enlace, paginaIndice, paginaModulo, montar, CONECTA };

// Rutas PÚBLICAS de Crecimiento (sin sesión): la página de cada servidor
// (/s/<dirección>), el directorio (/servidores) y el sitemap con todas ellas.
// Se montan desde api/server.js ANTES del panel compilado: así /sitemap.xml
// sustituye al estático del panel (que solo lleva la portada).
const rateLimit = require('express-rate-limit');
const pagina = require('../utils/paginaPublica.js');

module.exports = function montarPaginaPublica(app, client) {
    const limitador = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });

    // Idioma del directorio: ?lang=es|en, o el del navegador.
    const idiomaDe = (req) => (['es', 'en'].includes(req.query.lang) ? req.query.lang : (req.acceptsLanguages('es', 'en') || 'en'));

    const enviar = (res, estado, html, cacheSeg = 60) => {
        res.status(estado)
            .set('Content-Type', 'text/html; charset=utf-8')
            .set('Cache-Control', estado === 200 ? `public, max-age=${cacheSeg}` : 'no-store')
            .send(html);
    };

    app.get('/servidores', limitador, async (req, res) => {
        try {
            const lista = await pagina.datosDirectorio(client);
            const q = String(req.query.q || '').slice(0, 80);
            const etiqueta = String(req.query.etiqueta || '').slice(0, 24);
            enviar(res, 200, pagina.paginaDirectorio(lista, { lang: idiomaDe(req), base: pagina.urlBase(req), q, etiqueta }));
        } catch (e) {
            console.error('Directorio de servidores:', e.message);
            enviar(res, 500, pagina.paginaNoEncontrada(idiomaDe(req)));
        }
    });

    app.get('/s/:slug', limitador, async (req, res) => {
        try {
            const slug = String(req.params.slug || '').toLowerCase();
            const d = await pagina.datosServidor(client, slug);
            if (!d) return enviar(res, 404, pagina.paginaNoEncontrada(idiomaDe(req)));
            if (req.params.slug !== slug) return res.redirect(301, `/s/${slug}`); // una sola dirección (minúsculas)
            pagina.contarVisita(d.guildId, req.ip, req.get('user-agent')).catch(() => {});
            enviar(res, 200, pagina.paginaServidor(d, pagina.urlBase(req)));
        } catch (e) {
            console.error('Página pública:', e.message);
            enviar(res, 500, pagina.paginaNoEncontrada(idiomaDe(req)));
        }
    });

    // ¿Funciona Sokyo ahora mismo? y las novedades de cada versión.
    app.get('/estado', limitador, (req, res) => {
        try {
            res.status(200).set('Content-Type', 'text/html; charset=utf-8').set('Cache-Control', 'no-store')
                .send(require('../utils/paginasEstado.js').paginaEstado(client, { lang: idiomaDe(req), base: pagina.urlBase(req) }));
        } catch (e) {
            console.error('Página de estado:', e.message);
            enviar(res, 500, pagina.paginaNoEncontrada(idiomaDe(req)));
        }
    });
    app.get('/novedades', limitador, (req, res) => {
        try {
            enviar(res, 200, require('../utils/paginasEstado.js').paginaNovedades({ lang: idiomaDe(req), base: pagina.urlBase(req) }), 300);
        } catch (e) {
            console.error('Página de novedades:', e.message);
            enviar(res, 500, pagina.paginaNoEncontrada(idiomaDe(req)));
        }
    });

    app.get('/sitemap.xml', limitador, async (req, res) => {
        try {
            const base = pagina.urlBase(req);
            const lista = await pagina.datosDirectorio(client);
            const urls = [`${base}/`, `${base}/servidores`, `${base}/novedades`, `${base}/estado`, ...lista.map((s) => `${base}/s/${s.slug}`)];
            const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
                .map((u) => `  <url><loc>${pagina.esc(u)}</loc></url>`).join('\n')}\n</urlset>\n`;
            res.set('Content-Type', 'application/xml; charset=utf-8').set('Cache-Control', 'public, max-age=3600').send(xml);
        } catch (e) {
            console.error('Sitemap:', e.message);
            res.status(500).end();
        }
    });
};

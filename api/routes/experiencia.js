// Rutas de «que se entienda todo» (1.34.0), todas sacadas del catálogo de funciones (utils/catalogo.js):
//   GET  /api/catalogo?guildId=          → las funciones con su zona, si están encendidas aquí, sus comandos en el idioma
//                                           del panel, su sección y su guía. Lo usa la cabecera de cada sección.
//   GET  /api/config/:guildId/economia   → resumen de juegos y economía (sin área, como las secciones de juegos).
//   GET  /api/config/:guildId/uso        → qué se usa, qué no, errores y dónde se para la gente (área datos).
//   GET/POST /api/config/:guildId/guia   → el canal «📖 Cómo funciona» (área config).
const express = require('express');
const C = require('../../utils/catalogo.js');

module.exports = function rutasExperiencia({ client, exigeArea, idiomaPanel }) {
    const router = express.Router();
    const cfgDe = (guildId) => require('../../models/ServidorConfig.js').findOne({ guildId }).lean();
    const dias = (n) => [...Array(n)].map((_, i) => new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));

    router.get('/catalogo', async (req, res) => {
        try {
            const guildId = String(req.query.guildId || '');
            if (guildId && req.staff && !req.staff.owner && !(req.staff.guilds || []).includes(guildId)) return res.status(403).json({ error: 'Sin acceso a ese servidor' });
            const cfg = guildId ? await cfgDe(guildId) || {} : null;
            const idioma = idiomaPanel(req, cfg);
            const A = require('../../utils/ayuda.js');
            const ayudaWeb = require('../../utils/ayudaWeb.js');
            res.json({
                zonas: Object.fromEntries(Object.entries(C.ZONAS).map(([id, z]) => [id, { emoji: z.emoji, nombre: idioma === 'es' ? z.es : z.en, color: z.color }])),
                modulos: C.MODULOS.map((m) => ({
                    id: m.id, emoji: m.emoji, zona: m.zona, tab: m.tab, nombre: idioma === 'es' ? m.es : m.en,
                    frase: idioma === 'es' ? m.frase.es : m.frase.en, pasos: idioma === 'es' ? m.pasos.es : m.pasos.en,
                    comandos: A.comandosDe(m, idioma).map((x) => x.replace(/`/g, '')),
                    activo: cfg ? m.activo(cfg) : null, guia: ayudaWeb.enlace(m.id, idioma) || `/ayuda/${m.id}${idioma === 'en' ? '?lang=en' : ''}`,
                })),
            });
        } catch (e) { console.error('Catálogo:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    // Sin área (como las secciones de juegos): basta con tener acceso al servidor (lo comprueba el middleware de /api).
    router.get('/config/:guildId/economia', async (req, res) => {
        try {
            const guildId = req.params.guildId;
            const Monedero = require('../../models/Monedero.js');
            const JugadaCasino = require('../../models/JugadaCasino.js');
            const AperturaCofre = require('../../models/AperturaCofre.js');
            const desde = new Date(Date.now() - 7 * 86400000);
            const [total, top, casino, cofres, porJuego] = await Promise.all([
                Monedero.aggregate([{ $match: { guildId } }, { $group: { _id: null, oro: { $sum: '$balance' }, personas: { $sum: { $cond: [{ $gt: ['$balance', 0] }, 1, 0] } } } }]),
                Monedero.find({ guildId, balance: { $gt: 0 } }).sort({ balance: -1 }).limit(5).select('discordId balance').lean(),
                JugadaCasino.aggregate([{ $match: { guildId, fecha: { $gte: desde }, estado: 'hecha' } }, { $group: { _id: null, apostado: { $sum: '$apuesta' }, pagado: { $sum: '$premio' }, jugadas: { $sum: 1 }, jugadores: { $addToSet: '$userId' } } }]),
                AperturaCofre.countDocuments({ guildId, fecha: { $gte: desde } }).catch(() => 0),
                JugadaCasino.aggregate([{ $match: { guildId, fecha: { $gte: desde }, estado: 'hecha' } }, { $group: { _id: '$juego', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 6 }]),
            ]);
            const guild = client.guilds.cache.get(guildId);
            const nombre = async (id) => (guild ? (await guild.members.fetch(id).catch(() => null))?.displayName : null) || '…';
            const c = casino[0] || {};
            res.json({
                oro: total[0]?.oro || 0, conOro: total[0]?.personas || 0,
                top: await Promise.all(top.map(async (x) => ({ nombre: await nombre(x.discordId), oro: x.balance }))),
                casino: { apostado: c.apostado || 0, pagado: c.pagado || 0, casa: (c.apostado || 0) - (c.pagado || 0), jugadas: c.jugadas || 0, jugadores: (c.jugadores || []).length },
                cofres7d: cofres, juegos: porJuego.map((j) => ({ juego: j._id, n: j.n })),
            });
        } catch (e) { console.error('Economía:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    router.get('/config/:guildId/uso', exigeArea('datos'), async (req, res) => {
        try {
            const guildId = req.params.guildId;
            const UsoFuncion = require('../../models/UsoFuncion.js');
            const ultimos = dias(30);
            const filas = await UsoFuncion.aggregate([{ $match: { guildId, dia: { $in: ultimos } } }, { $group: { _id: '$clave', n: { $sum: '$n' } } }]);
            const de = (pre) => filas.filter((f) => f._id.startsWith(pre)).map((f) => ({ clave: f._id.slice(pre.length), n: f.n })).sort((a, b) => b.n - a.n);
            const cfg = await cfgDe(guildId) || {};
            const usados = new Map(de('mod:').map((x) => [x.clave, x.n]));
            for (const x of de('cmd:')) { const m = C.moduloDeComando(x.clave.split(' ')[0]) || null; if (m) usados.set(m.id, (usados.get(m.id) || 0) + x.n); }
            const ComentarioAyuda = require('../../models/ComentarioAyuda.js');
            res.json({
                comandos: de('cmd:').slice(0, 15),
                modulos: C.activos(cfg).filter((m) => m.zona !== 'staff' && m.zona !== 'basico').map((m) => ({ id: m.id, emoji: m.emoji, nombre: req.get('x-sokyo-lang') === 'en' ? m.en : m.es, n: usados.get(m.id) || 0 })).sort((a, b) => a.n - b.n),
                menu: de('menu:'), pasos: de('paso:'),
                comentarios: (await ComentarioAyuda.find({ guildId }).sort({ fecha: -1 }).limit(20).lean()).map((c) => ({ tema: c.tema, texto: c.texto, fecha: c.fecha })),
            });
        } catch (e) { console.error('Uso:', e.message); res.status(500).json({ error: 'Fallo interno' }); }
    });

    router.get('/config/:guildId/guia', exigeArea('config'), async (req, res) => {
        const cfg = await cfgDe(req.params.guildId) || {};
        res.json({ activo: !!cfg.guiaCanal?.activo, canalId: cfg.guiaCanal?.canalId || null, mensajes: (cfg.guiaCanal?.mensajeIds || []).length });
    });
    router.post('/config/:guildId/guia', exigeArea('config'), async (req, res) => {
        try {
            const guild = client.guilds.cache.get(req.params.guildId);
            if (!guild) return res.status(404).json({ error: 'El bot no está en ese servidor' });
            const canalId = req.body?.canalId || null;
            if (!canalId) {
                await require('../../models/ServidorConfig.js').updateOne({ guildId: guild.id }, { $set: { 'guiaCanal.activo': false } });
                return res.json({ success: true, activo: false });
            }
            const r = await require('../../utils/guiaServidor.js').activar(guild, String(canalId));
            if (r.error) return res.status(400).json({ error: r.error });
            res.json({ success: true, activo: true });
        } catch (e) { console.error('Guía:', e.message); res.status(500).json({ error: 'No se pudo guardar' }); }
    });

    return router;
};

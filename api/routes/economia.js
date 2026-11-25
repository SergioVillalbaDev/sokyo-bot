const express = require('express');
const SP = require('../../utils/servidorPortal.js');
const economia = require('../../utils/economia.js');
const ServidorConfig = require('../../models/ServidorConfig.js');
const tienda = require('../../utils/tiendaServidor.js');

// «Mi cuenta» (portal de cada miembro): su oro y la tienda del servidor elegido (2.0.0).
// Ya NO se pueden crear objetos, cajas ni ofertas desde la web (la vieja tienda global era una
// puerta a trampas): los productos los ponen los admins del servidor en el panel.
// Recibe portalAuth desde server.js (donde está definido, con acceso a JWT_SECRET).
module.exports = ({ portalAuth, client }) => {
    // El oro es de un servidor: ?guildId= (o en el cuerpo). Si no, el primero suyo.
    const servidor = async (req, res) => {
        const gid = await SP.elegir(client, req.usuario.id, req.query.guildId || req.body?.guildId);
        if (!gid) { res.status(400).json({ error: 'Elige un servidor donde estés con Sokyo.', code: 'sin_servidor' }); return null; }
        return gid;
    };
    const router = express.Router();

    // SALDO del usuario logueado en ese servidor (la barra de arriba de «Mi cuenta»).
    router.get('/portal/economia', portalAuth, async (req, res) => {
        const gid = await servidor(req, res); if (!gid) return;
        const u = await economia.en(gid).obtenerUsuario(req.usuario.id);
        res.json({ balance: u.balance, guildId: gid, servidores: await SP.servidoresDe(client, req.usuario.id) });
    });

    // TIENDA del servidor: productos (roles) con lo que queda y si ya los tiene.
    router.get('/portal/tienda', portalAuth, async (req, res) => {
        const gid = await servidor(req, res); if (!gid) return;
        const guild = client.guilds.cache.get(gid);
        const cfg = await ServidorConfig.findOne({ guildId: gid }).lean();
        const member = guild ? await guild.members.fetch(req.usuario.id).catch(() => null) : null;
        const lista = cfg?.tienda?.activo ? await tienda.catalogo(gid, cfg) : [];
        const u = await economia.en(gid).obtenerUsuario(req.usuario.id);
        res.json({
            activa: !!cfg?.tienda?.activo, balance: u.balance, guildId: gid, servidor: guild?.name || '',
            productos: lista.map((p) => {
                const rol = guild?.roles.cache.get(p.rolId);
                return {
                    id: p.id, nombre: p.nombre, descripcion: p.descripcion, emoji: p.emoji, precio: p.precio, horas: p.horas,
                    quedan: p.quedan, rol: rol ? { nombre: rol.name, color: rol.hexColor } : null, loTienes: !!member?.roles.cache.has(p.rolId),
                };
            }),
        });
    });

    // COMPRAR en la tienda del servidor. El comprador es req.usuario (lo pone portalAuth):
    // NUNCA nos fiamos de un id que venga del cuerpo.
    router.post('/portal/tienda/comprar', portalAuth, async (req, res) => {
        const gid = await servidor(req, res); if (!gid) return;
        const guild = client.guilds.cache.get(gid);
        const member = guild ? await guild.members.fetch(req.usuario.id).catch(() => null) : null;
        if (!member) return res.status(404).json({ error: 'No estás en ese servidor.' });
        const idioma = String(req.get('x-sokyo-lang') || 'es').slice(0, 2) === 'en' ? 'en' : 'es';
        const r = await tienda.comprar(guild, member, String(req.body?.productoId || ''), idioma);
        if (!r.ok) return res.status(400).json({ error: r.error.replace(/\*\*|`/g, '') });
        res.json({ success: true, nombre: r.producto.nombre, balance: r.saldo, hasta: r.hasta });
    });

    return router;
};

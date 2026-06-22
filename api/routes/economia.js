const express = require('express');
const Item = require('../../models/Item.js');
const economia = require('../../utils/economia.js');

// Recibe portalAuth desde server.js (donde está definido, con acceso a JWT_SECRET).
module.exports = ({ portalAuth }) => {
    const router = express.Router();

    // CREAR ÍTEM (ADMIN). Cuelga de /api, así que ya pasa por tu middleware de
    // staff/owner. No hace falta proteger nada más aquí.
    router.post('/admin/items', async (req, res) => {
        try {
            const { itemId, nombre, descripcion, precio, imageUrl, tipo, activo } = req.body;
            if (!itemId || !nombre || precio == null) {
                return res.status(400).json({ error: 'Faltan campos: itemId, nombre y precio son obligatorios.' });
            }
            const item = await Item.create({ itemId, nombre, descripcion, precio, imageUrl, tipo, activo });
            res.status(201).json({ success: true, item });
        } catch (e) {
            if (e.code === 11000) return res.status(409).json({ error: 'Ya existe un ítem con ese itemId.' });
            console.error('Error al crear ítem:', e);
            res.status(500).json({ error: 'No se pudo crear el ítem.' });
        }
    });

    // LISTAR ÍTEMS ACTIVOS. Lo cuelgo de /portal porque tu middleware global deja
    // pasar /portal/* y así lo ve cualquier usuario logueado (no solo staff).
    router.get('/portal/items', portalAuth, async (req, res) => {
        const items = await Item.find({ activo: true }).sort({ createdAt: -1 });
        res.json(items);
    });

    // SALDO del usuario logueado (para mostrar su oro en la tienda).
    router.get('/portal/economia', portalAuth, async (req, res) => {
        const u = await economia.obtenerUsuario(req.usuario.id);
        res.json({ balance: u.balance });
    });

    // COMPRAR (usuario logueado). El comprador es req.usuario (lo pone portalAuth):
    // NUNCA confiamos en un discordId que venga del body, se podría falsear.
    router.post('/portal/shop/buy', portalAuth, async (req, res) => {
        const { itemId, cantidad } = req.body;
        const r = await economia.comprarItem(req.usuario.id, itemId, cantidad);
        if (!r.ok) return res.status(400).json({ error: r.error });
        res.json({ success: true, comprado: r.item.nombre, coste: r.coste, balance: r.balance });
    });

    return router;
};

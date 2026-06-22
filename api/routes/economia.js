const express = require('express');
const fs = require('fs');
const path = require('path');
const Item = require('../../models/Item.js');
const Usuario = require('../../models/Usuario.js');
const economia = require('../../utils/economia.js');

// Recibe portalAuth desde server.js (donde está definido, con acceso a JWT_SECRET).
module.exports = ({ portalAuth }) => {
    const router = express.Router();

    // CREAR ÍTEM (ADMIN). Cuelga de /api, así que ya pasa por tu middleware de
    // staff/owner. No hace falta proteger nada más aquí.
    router.post('/admin/items', async (req, res) => {
        try {
            const { itemId, nombre, descripcion, precio, imageUrl, tipo, rareza, stock, activo } = req.body;
            if (!itemId || !nombre || precio == null) {
                return res.status(400).json({ error: 'Faltan campos: itemId, nombre y precio son obligatorios.' });
            }
            // Stock vacío = ilimitado (null). Si llega un número, lo usamos.
            const stockNum = (stock === '' || stock == null) ? null : Math.max(0, parseInt(stock, 10) || 0);
            // Efecto al usar (campos planos desde el formulario web).
            const efecto = {
                tipo: ['xpBoost', 'rol'].includes(req.body.efectoTipo) ? req.body.efectoTipo : 'ninguno',
                multiplicador: Math.max(1, parseInt(req.body.efectoMultiplicador, 10) || 2),
                duracionMin: Math.max(1, parseInt(req.body.efectoDuracionMin, 10) || 60),
                rolId: req.body.efectoRolId ? String(req.body.efectoRolId).trim() : null,
            };
            const item = await Item.create({ itemId, nombre, descripcion, precio, imageUrl, tipo, rareza, stock: stockNum, efecto, activo });
            res.status(201).json({ success: true, item });
        } catch (e) {
            if (e.code === 11000) return res.status(409).json({ error: 'Ya existe un ítem con ese itemId.' });
            console.error('Error al crear ítem:', e);
            res.status(500).json({ error: 'No se pudo crear el ítem.' });
        }
    });

    // SUBIR IMAGEN de un objeto desde el PC (ADMIN). Recibe un dataURL base64 y la
    // guarda en api/uploads, devolviendo su URL pública (/uploads/...).
    router.post('/admin/upload', (req, res) => {
        const m = /^data:(image\/(png|jpe?g|gif|webp));base64,(.+)$/i.exec(req.body?.datos || '');
        if (!m) return res.status(400).json({ error: 'Formato no válido (png, jpg, gif o webp).' });
        const ext = m[2].toLowerCase() === 'jpeg' ? 'jpg' : m[2].toLowerCase();
        const buffer = Buffer.from(m[3], 'base64');
        if (buffer.length > 8 * 1024 * 1024) return res.status(400).json({ error: 'La imagen supera 8 MB.' });
        const uploadsDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        const archivo = `item-${Date.now()}.${ext}`;
        fs.writeFileSync(path.join(uploadsDir, archivo), buffer);
        res.json({ success: true, url: `/uploads/${archivo}` });
    });

    // LISTAR TODOS los ítems (ADMIN): para el selector de ofertas relámpago.
    router.get('/admin/items', async (req, res) => {
        const items = await Item.find().sort({ createdAt: -1 });
        res.json(items);
    });

    // LANZAR OFERTA RELÁMPAGO sobre un ítem (ADMIN).
    router.post('/admin/items/:id/oferta', async (req, res) => {
        const r = await economia.ponerOferta(req.params.id, req.body.porcentaje, req.body.duracionMin);
        if (!r.ok) return res.status(400).json({ error: r.error });
        res.json({ success: true, porcentaje: r.porcentaje, expiraEn: r.expiraEn });
    });

    // LISTAR ÍTEMS ACTIVOS. Lo cuelgo de /portal porque tu middleware global deja
    // pasar /portal/* y así lo ve cualquier usuario logueado (no solo staff).
    router.get('/portal/items', portalAuth, async (req, res) => {
        const items = await Item.find({ activo: true }).sort({ createdAt: -1 });
        res.json(items);
    });

    // SALDO + INVENTARIO del usuario logueado (oro para la barra, inventario para "Mi mochila").
    router.get('/portal/economia', portalAuth, async (req, res) => {
        const u = await economia.obtenerUsuario(req.usuario.id);
        // populate() cambia cada referencia por el documento completo del ítem.
        const doc = await Usuario.findOne({ discordId: req.usuario.id }).populate('inventory.item');
        const inventory = (doc?.inventory || [])
            .filter(e => e.item) // descarta objetos que ya no existan en la BD
            .map(e => ({
                _id: e.item._id, nombre: e.item.nombre, descripcion: e.item.descripcion,
                tipo: e.item.tipo, rareza: e.item.rareza, imageUrl: e.item.imageUrl,
                efecto: e.item.efecto, cantidad: e.cantidad,
            }));
        res.json({ balance: u.balance, inventory });
    });

    // COMPRAR (usuario logueado). El comprador es req.usuario (lo pone portalAuth):
    // NUNCA confiamos en un discordId que venga del body, se podría falsear.
    router.post('/portal/shop/buy', portalAuth, async (req, res) => {
        const { itemId, cantidad } = req.body;
        const r = await economia.comprarItem(req.usuario.id, itemId, cantidad);
        if (!r.ok) return res.status(400).json({ error: r.error });
        res.json({ success: true, comprado: r.item.nombre, coste: r.coste, balance: r.balance });
    });

    // USAR un objeto desde la web. Sin contexto de servidor, así que solo aplica
    // efectos globales (xpBoost); los de rol piden usar /usar en Discord.
    router.post('/portal/shop/use', portalAuth, async (req, res) => {
        const r = await economia.usarItem(req.usuario.id, req.body.itemId);
        if (!r.ok) return res.status(400).json({ error: r.error });
        // Si era una caja, devolvemos el premio (slim) para la animación de apertura.
        const premio = r.premio
            ? { nombre: r.premio.nombre, rareza: r.premio.rareza, tipo: r.premio.tipo, imageUrl: r.premio.imageUrl }
            : null;
        res.json({ success: true, item: r.item.nombre, efecto: r.efecto, premio });
    });

    return router;
};

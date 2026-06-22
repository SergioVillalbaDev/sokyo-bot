const Usuario = require('../models/Usuario.js');
const Item = require('../models/Item.js');

// Devuelve el usuario, creándolo si es la primera vez que aparece (upsert).
async function obtenerUsuario(discordId) {
    return Usuario.findOneAndUpdate(
        { discordId },
        { $setOnInsert: { discordId } },
        { upsert: true, returnDocument: 'after' }
    );
}

// Compra atómica y segura contra "doble gasto". `itemDocId` es el _id de Mongo del ítem.
async function comprarItem(discordId, itemDocId, cantidad = 1) {
    cantidad = Math.max(1, parseInt(cantidad, 10) || 1);

    // 1) El ítem debe existir y estar activo en la tienda.
    let item;
    try {
        item = await Item.findOne({ _id: itemDocId, activo: true });
    } catch {
        return { ok: false, error: 'Objeto no válido.' }; // _id mal formado
    }
    if (!item) return { ok: false, error: 'Ese objeto no existe o no está disponible.' };

    const coste = item.precio * cantidad;
    await obtenerUsuario(discordId);

    // 2) STOCK: si el ítem lleva unidades limitadas, las reservamos de forma atómica
    //    (solo resta si quedan suficientes). Si no, evitamos vender lo que no hay.
    const llevaStock = typeof item.stock === 'number';
    if (llevaStock) {
        const reserva = await Item.findOneAndUpdate(
            { _id: item._id, stock: { $gte: cantidad } },
            { $inc: { stock: -cantidad } },
            { returnDocument: 'after' }
        );
        if (!reserva) return { ok: false, error: '¡Agotado! No queda stock de este objeto.' };
    }

    // 3) PUERTA ATÓMICA del oro: solo descuenta si en ESE mismo instante hay saldo
    //    suficiente. Si dos compras llegan a la vez, MongoDB serializa este update:
    //    una pasa y la otra falla la condición `balance >= coste`.
    const usuario = await Usuario.findOneAndUpdate(
        { discordId, balance: { $gte: coste } },
        { $inc: { balance: -coste } },
        { returnDocument: 'after' }
    );
    if (!usuario) {
        // El oro falló: devolvemos el stock que habíamos reservado para no perderlo.
        if (llevaStock) await Item.updateOne({ _id: item._id }, { $inc: { stock: cantidad } });
        return { ok: false, error: 'No tienes suficiente oro para comprar esto.' };
    }

    // 4) Añadir al inventario: si ya lo tiene, suma cantidad; si no, crea la entrada.
    const yaLoTiene = await Usuario.findOneAndUpdate(
        { discordId, 'inventory.item': item._id },
        { $inc: { 'inventory.$.cantidad': cantidad } }, // $ = el elemento que coincidió
        { returnDocument: 'after' }
    );
    if (!yaLoTiene) {
        await Usuario.updateOne(
            { discordId },
            { $push: { inventory: { item: item._id, cantidad } } }
        );
    }

    const final = await Usuario.findOne({ discordId });
    return { ok: true, item, coste, balance: final.balance };
}

// Da (o quita, si es negativo) oro a un usuario. Nunca deja el saldo por debajo de 0.
// Usa una pipeline de actualización para clampear el resultado en la propia BD.
async function darOro(discordId, cantidad) {
    cantidad = parseInt(cantidad, 10) || 0;
    await obtenerUsuario(discordId);
    const u = await Usuario.findOneAndUpdate(
        { discordId },
        [{ $set: { balance: { $max: [0, { $add: ['$balance', cantidad] }] } } }],
        { returnDocument: 'after' }
    );
    return u.balance;
}

// Recompensa diaria con racha. Se puede reclamar cada ~20h; si pasan más de 48h
// sin reclamar, la racha se reinicia. Cada 7 días seguidos hay premio gordo.
async function reclamarDaily(discordId) {
    const u = await obtenerUsuario(discordId);
    const ahora = new Date();
    let racha;
    if (u.ultimoDaily) {
        const horas = (ahora - new Date(u.ultimoDaily)) / 3600000;
        if (horas < 20) return { ok: false, esperaHoras: 20 - horas };
        racha = horas <= 48 ? (u.rachaDaily || 0) + 1 : 1; // dentro de 48h continúa; si no, reinicia
    } else {
        racha = 1;
    }
    const base = 100;
    const bonus = Math.min(racha, 7) * 25;          // hasta +175 según racha
    const jackpot = (racha % 7 === 0) ? 500 : 0;    // premio gordo cada 7 días
    const total = base + bonus + jackpot;

    await Usuario.updateOne(
        { discordId },
        { $set: { ultimoDaily: ahora, rachaDaily: racha }, $inc: { balance: total } }
    );
    const final = await Usuario.findOne({ discordId });
    return { ok: true, total, racha, jackpot, balance: final.balance };
}

// Ranking de los usuarios con más oro.
async function topRicos(limite = 10) {
    return Usuario.find().sort({ balance: -1 }).limit(limite).select('discordId balance');
}

// Quita 1 unidad de un objeto del inventario; si llega a 0, elimina la entrada.
async function consumirUnidad(discordId, itemId) {
    await Usuario.updateOne(
        { discordId, 'inventory.item': itemId },
        { $inc: { 'inventory.$.cantidad': -1 } }
    );
    await Usuario.updateOne(
        { discordId },
        { $pull: { inventory: { cantidad: { $lte: 0 } } } }
    );
}

// USAR un objeto: aplica su efecto y consume 1 unidad.
//  ctx.aplicarRol(rolId, duracionMin) -> Promise<bool>: lo aporta /usar (tiene
//  contexto de servidor). Sin él, los efectos de rol no se pueden aplicar (web).
async function usarItem(discordId, itemDocId, ctx = {}) {
    let item;
    try { item = await Item.findOne({ _id: itemDocId }); }
    catch { return { ok: false, error: 'Objeto no válido.' }; }
    if (!item) return { ok: false, error: 'Ese objeto no existe.' };

    const efecto = item.efecto || {};
    if (!efecto.tipo || efecto.tipo === 'ninguno') {
        return { ok: false, error: 'Este objeto no tiene ningún efecto que usar.' };
    }

    // ¿Lo tiene en la mochila?
    const tiene = await Usuario.findOne({ discordId, 'inventory.item': item._id }).select('_id');
    if (!tiene) return { ok: false, error: 'No tienes ese objeto en tu mochila.' };

    // Efecto de ROL: solo desde un servidor (lo aplica el comando /usar).
    if (efecto.tipo === 'rol') {
        if (typeof ctx.aplicarRol !== 'function') {
            return { ok: false, error: 'Este objeto otorga un rol: úsalo en un servidor con `/usar`.' };
        }
        const aplicado = await ctx.aplicarRol(efecto.rolId, efecto.duracionMin);
        if (!aplicado) return { ok: false, error: 'No se pudo dar el rol (¿existe en este servidor y el bot tiene permisos?).' };
    }

    // Consumir 1 unidad (después de validar el efecto, para no perder el objeto si falla).
    await consumirUnidad(discordId, item._id);

    // Efecto de XP BOOST (global por usuario): lo lee aplicarXp en niveles.js.
    if (efecto.tipo === 'xpBoost') {
        const expiraEn = new Date(Date.now() + (efecto.duracionMin || 60) * 60000);
        await Usuario.updateOne(
            { discordId },
            { $set: { boostXp: { multiplicador: efecto.multiplicador || 2, expiraEn } } }
        );
    }

    return { ok: true, item, efecto };
}

// Multiplicador de XP activo del usuario (1 si no tiene boost o ya caducó).
async function multiplicadorBoost(discordId) {
    const u = await Usuario.findOne({ discordId }).select('boostXp');
    if (u?.boostXp?.expiraEn && new Date(u.boostXp.expiraEn) > new Date()) {
        return u.boostXp.multiplicador || 1;
    }
    return 1;
}

module.exports = { obtenerUsuario, comprarItem, darOro, reclamarDaily, topRicos, usarItem, multiplicadorBoost };

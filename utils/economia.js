const mongoose = require('mongoose');
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
// Todo el descuento de stock + cobro de oro + inventario va en UNA transacción de
// Mongo: si el proceso se cae a medias (o falla cualquier paso), se deshace entero
// en vez de dejar stock descontado sin cobrar el oro (o viceversa).
async function comprarItem(discordId, itemDocId, cantidad = 1) {
    cantidad = Math.max(1, parseInt(cantidad, 10) || 1);

    // 1) El ítem debe existir y estar activo en la tienda.
    let item;
    try {
        item = await Item.findOne({ _id: itemDocId, activo: true });
    } catch {
        return { ok: false, error: 'Invalid item.' }; // _id mal formado
    }
    if (!item) return { ok: false, error: 'That item doesn’t exist or isn’t available.' };

    const coste = precioEfectivo(item).precio * cantidad; // respeta la oferta relámpago si la hay
    await obtenerUsuario(discordId);

    const session = await mongoose.startSession();
    try {
        let balanceFinal;
        await session.withTransaction(async () => {
            // 2) STOCK: si el ítem lleva unidades limitadas, las reservamos de forma atómica
            //    (solo resta si quedan suficientes). Si no, evitamos vender lo que no hay.
            const llevaStock = typeof item.stock === 'number';
            if (llevaStock) {
                const reserva = await Item.findOneAndUpdate(
                    { _id: item._id, stock: { $gte: cantidad } },
                    { $inc: { stock: -cantidad } },
                    { returnDocument: 'after', session }
                );
                if (!reserva) throw new Error('SIN_STOCK');
            }

            // 3) PUERTA ATÓMICA del oro: solo descuenta si en ESE mismo instante hay saldo
            //    suficiente. Si dos compras llegan a la vez, MongoDB serializa este update:
            //    una pasa y la otra falla la condición `balance >= coste`.
            const usuario = await Usuario.findOneAndUpdate(
                { discordId, balance: { $gte: coste } },
                { $inc: { balance: -coste } },
                { returnDocument: 'after', session }
            );
            if (!usuario) throw new Error('SIN_ORO');

            // 4) Añadir al inventario (misma transacción: si esto fallara, deshace todo).
            await anadirAlInventario(discordId, item._id, cantidad, session);
            balanceFinal = usuario.balance;
        });
        return { ok: true, item, coste, balance: balanceFinal };
    } catch (e) {
        if (e.message === 'SIN_STOCK') return { ok: false, error: 'Sold out! No stock left for this item.' };
        if (e.message === 'SIN_ORO') return { ok: false, error: 'No tienes suficiente oro para comprar esto.' };
        console.error('comprarItem: transacción abortada:', e.message);
        return { ok: false, error: 'No se pudo completar la compra, inténtalo de nuevo.' };
    } finally {
        await session.endSession();
    }
}

// Añade un objeto al inventario: suma cantidad si ya lo tiene, o crea la entrada.
// `session` opcional: si viene de una transacción (p. ej. comprarItem), la reutiliza
// para que el find-then-push sea parte del mismo todo-o-nada.
async function anadirAlInventario(discordId, itemId, cantidad = 1, session = null) {
    const opts = session ? { session } : {};
    const yaLoTiene = await Usuario.findOneAndUpdate(
        { discordId, 'inventory.item': itemId },
        { $inc: { 'inventory.$.cantidad': cantidad } }, // $ = el elemento que coincidió
        { returnDocument: 'after', ...opts }
    );
    if (!yaLoTiene) {
        await Usuario.updateOne({ discordId }, { $push: { inventory: { item: itemId, cantidad } } }, opts);
    }
}

// Precio efectivo de un objeto teniendo en cuenta una oferta relámpago activa.
function precioEfectivo(item) {
    const o = item.oferta;
    const activa = o && o.porcentaje > 0 && o.expiraEn && new Date(o.expiraEn) > new Date();
    const precio = activa ? Math.max(0, Math.round(item.precio * (1 - o.porcentaje / 100))) : item.precio;
    return { precio, original: item.precio, oferta: !!activa, porcentaje: activa ? o.porcentaje : 0 };
}

// Lanza una oferta relámpago sobre un objeto (descuento % durante X minutos).
async function ponerOferta(itemDocId, porcentaje, duracionMin) {
    porcentaje = Math.min(100, Math.max(1, parseInt(porcentaje, 10) || 0));
    duracionMin = Math.max(1, parseInt(duracionMin, 10) || 60);
    const expiraEn = new Date(Date.now() + duracionMin * 60000);
    let item;
    try { item = await Item.findByIdAndUpdate(itemDocId, { $set: { oferta: { porcentaje, expiraEn } } }, { returnDocument: 'after' }); }
    catch { return { ok: false, error: 'Invalid item.' }; }
    if (!item) return { ok: false, error: 'Objeto no encontrado.' };
    return { ok: true, item, porcentaje, expiraEn };
}

// Da (o quita, si es negativo) oro a un usuario. Nunca deja el saldo por debajo de 0.
// Usa una pipeline de actualización para clampear el resultado en la propia BD.
async function darOro(discordId, cantidad) {
    cantidad = parseInt(cantidad, 10) || 0;
    await obtenerUsuario(discordId);
    const u = await Usuario.findOneAndUpdate(
        { discordId },
        [{ $set: { balance: { $max: [0, { $add: ['$balance', cantidad] }] } } }],
        { returnDocument: 'after' } // el array ya se detecta como pipeline de agregación automáticamente
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

    // Puerta atómica: solo se aplica si `ultimoDaily` sigue siendo el mismo que
    // acabamos de leer. Si dos /daily llegan a la vez (doble clic, reintento de
    // Discord), la segunda encuentra el documento ya cambiado y esta condición
    // falla, así que no duplica el premio.
    const actualizado = await Usuario.findOneAndUpdate(
        { discordId, ultimoDaily: u.ultimoDaily ?? null },
        { $set: { ultimoDaily: ahora, rachaDaily: racha }, $inc: { balance: total } },
        { returnDocument: 'after' }
    );
    if (!actualizado) return { ok: false, esperaHoras: 20 }; // otra petición ganó la carrera justo antes
    return { ok: true, total, racha, jackpot, balance: actualizado.balance };
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

// Sortea un premio del CONTENIDO definido de una caja, ponderando por su peso.
async function elegirPremioDeCaja(caja) {
    const contenido = (caja.contenido || []).filter(c => c.item);
    if (!contenido.length) return null;

    // Cargamos los objetos referenciados (descartando los que ya no existan).
    const items = await Item.find({ _id: { $in: contenido.map(c => c.item) } });
    const mapa = new Map(items.map(it => [it._id.toString(), it]));
    const candidatos = contenido
        .map(c => ({ item: mapa.get(c.item.toString()), peso: Math.max(1, c.peso || 1) }))
        .filter(c => c.item);
    if (!candidatos.length) return null;

    const total = candidatos.reduce((s, c) => s + c.peso, 0);
    let x = Math.random() * total;
    for (const c of candidatos) { x -= c.peso; if (x <= 0) return c.item; }
    return candidatos[candidatos.length - 1].item;
}

// USAR un objeto: aplica su efecto y consume 1 unidad.
//  ctx.aplicarRol(rolId, duracionMin) -> Promise<bool>: lo aporta /usar (tiene
//  contexto de servidor). Sin él, los efectos de rol no se pueden aplicar (web).
async function usarItem(discordId, itemDocId, ctx = {}) {
    let item;
    try { item = await Item.findOne({ _id: itemDocId }); }
    catch { return { ok: false, error: 'Invalid item.' }; }
    if (!item) return { ok: false, error: 'That item doesn’t exist.' };

    const efecto = item.efecto || {};
    if (!efecto.tipo || efecto.tipo === 'ninguno') {
        return { ok: false, error: 'This item has no effect to use.' };
    }

    // ¿Lo tiene en la mochila?
    const tiene = await Usuario.findOne({ discordId, 'inventory.item': item._id }).select('_id');
    if (!tiene) return { ok: false, error: 'You don’t have that item in your bag.' };

    // Efecto CAJA: sortea un premio, lo añade al inventario y consume la caja.
    if (efecto.tipo === 'caja') {
        const premio = await elegirPremioDeCaja(item);
        if (!premio) return { ok: false, error: 'This box has no contents configured.' };
        await consumirUnidad(discordId, item._id);
        await anadirAlInventario(discordId, premio._id, 1);
        return { ok: true, item, efecto, premio };
    }

    // Efecto de ROL: solo desde un servidor (lo aplica el comando /usar).
    if (efecto.tipo === 'rol') {
        if (typeof ctx.aplicarRol !== 'function') {
            return { ok: false, error: 'This item grants a role: use it in a server with `/use`.' };
        }
        const aplicado = await ctx.aplicarRol(efecto.rolId, efecto.duracionMin);
        if (!aplicado) return { ok: false, error: 'Couldn’t grant the role (does it exist here and does the bot have permission?).' };
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

module.exports = { obtenerUsuario, comprarItem, darOro, reclamarDaily, topRicos, usarItem, multiplicadorBoost, precioEfectivo, ponerOferta };

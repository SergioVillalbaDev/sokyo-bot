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

    // 2) PUERTA ATÓMICA: solo descuenta si en ESE mismo instante hay saldo suficiente.
    //    Si dos compras llegan a la vez, MongoDB serializa este update: una pasa y la
    //    otra falla la condición `balance >= coste`. Imposible quedar en negativo.
    const usuario = await Usuario.findOneAndUpdate(
        { discordId, balance: { $gte: coste } },
        { $inc: { balance: -coste } },
        { returnDocument: 'after' }
    );
    if (!usuario) return { ok: false, error: 'No tienes suficiente oro para comprar esto.' };

    // 3) Añadir al inventario: si ya lo tiene, suma cantidad; si no, crea la entrada.
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

module.exports = { obtenerUsuario, comprarItem, darOro };

// 1.30.0: mascotas, cartas, pase… pasan a ser POR SERVIDOR. Antes cada persona tenía UNA colección
// (índice único `userId_1`); ahora una por servidor (`guildId + userId`). Al arrancar se quita el
// índice viejo (si sigue ahí impediría crear la segunda colección de alguien). Los documentos viejos
// (sin guildId) NO se borran: se quedan guardados sin usarse, por si algún día se quieren recuperar.
const ColeccionMascotas = require('../models/ColeccionMascotas.js');

async function migrar() {
    const indices = await ColeccionMascotas.collection.indexes().catch(() => []);
    let quitado = false;
    if (indices.some((i) => i.name === 'userId_1')) {
        await ColeccionMascotas.collection.dropIndex('userId_1');
        quitado = true;
    }
    await ColeccionMascotas.createIndexes();
    await require('../models/Monedero.js').createIndexes();
    return quitado;
}

module.exports = { migrar };

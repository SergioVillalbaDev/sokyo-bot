// 1.24.0: los personajes del Pack anime dejan de ser mascotas y pasan a ser cartas. Al arrancar,
// los que alguien tenía en `mascotas` (id «a:…») se mueven a `cartas` con sus estrellas; si llevaba
// uno equipado, se equipa su mejor mascota de verdad. Se puede llamar las veces que haga falta.
const ColeccionMascotas = require('../models/ColeccionMascotas.js');
const K = require('./cofresNucleo.js');

async function migrar() {
    const docs = await ColeccionMascotas.find({ 'mascotas.id': /^a:/ }).lean();
    for (const d of docs) {
        const anime = d.mascotas.filter((m) => K.esAnime(m.id));
        const quedan = d.mascotas.filter((m) => !K.esAnime(m.id));
        const cartas = [...(d.cartas || [])];
        for (const a of anime) {
            const ya = cartas.find((c) => c.id === a.id);
            if (ya) ya.estrellas = Math.min(5, Math.max(ya.estrellas || 1, a.estrellas || 1));
            else cartas.push({ id: a.id, estrellas: a.estrellas || 1, primera: a.primera || new Date() });
        }
        let equipada = d.equipada;
        if (equipada && K.esAnime(equipada)) {
            const mejor = [...quedan].sort((x, y) => K.RAREZAS[K.def(y.id).rareza].orden - K.RAREZAS[K.def(x.id).rareza].orden)[0];
            equipada = mejor ? mejor.id : null;
        }
        await ColeccionMascotas.updateOne({ _id: d._id }, { $set: { mascotas: quedan, cartas, equipada } });
    }
    return docs.length;
}

module.exports = { migrar };

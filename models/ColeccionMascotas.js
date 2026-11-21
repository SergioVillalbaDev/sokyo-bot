const mongoose = require('mongoose');

// Colección de compañeros de cada persona (global, como el oro): los que ha sacado de
// los cofres, con sus estrellas, y el que lleva equipado. Lógica en utils/cofres.js.
const ColeccionMascotasSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    mascotas: { type: [{ id: String, estrellas: { type: Number, default: 1 }, primera: { type: Date, default: Date.now }, _id: false }], default: [] },
    equipada: { type: String, default: null },
    abiertos: { type: Number, default: 0 },
    sinEpica: { type: Number, default: 0 },   // cofres seguidos sin épica o mejor (piedad)
    gastado: { type: Number, default: 0 },
    divinas: { type: Number, default: 0 },
});

module.exports = mongoose.model('ColeccionMascotas', ColeccionMascotasSchema);

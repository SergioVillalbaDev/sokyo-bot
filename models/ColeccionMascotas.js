const mongoose = require('mongoose');

// Colección de compañeros de cada persona (global, como el oro): los que ha sacado de
// los cofres, con sus estrellas, y el que lleva equipado. Lógica en utils/cofres.js.
const ColeccionMascotasSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    // 1.20.0: cada compañero tiene también sus necesidades (tamagotchi), afinidad, apodo,
    // expedición en curso y recuerdos. Lógica en utils/compisNucleo.js y utils/compis.js.
    mascotas: { type: [{
        id: String, estrellas: { type: Number, default: 1 }, primera: { type: Date, default: Date.now },
        hambre: Number, alegria: Number, energia: Number, actualizado: Date,
        afinidad: { type: Number, default: 0 }, apodo: String, ultMimo: Date,
        exp: { tipo: String, desde: Date, hasta: Date },
        recuerdos: { type: [Number], default: [] },
        cuidados: { type: Number, default: 0 },
        _id: false,
    }], default: [] },
    equipada: { type: String, default: null },
    abiertos: { type: Number, default: 0 },
    sinEpica: { type: Number, default: 0 },   // cofres seguidos sin épica o mejor (piedad)
    gastado: { type: Number, default: 0 },
    divinas: { type: Number, default: 0 },
    // Racha de días cuidando, misiones del día y expediciones de hoy (1.20.0).
    racha: { type: Number, default: 0 },
    mejorRacha: { type: Number, default: 0 },
    ultimoDiaCuidado: { type: String, default: null },
    misiones: { dia: String, prog: { type: Object, default: {} }, hechas: { type: [String], default: [] }, todas: Boolean },
    expHoy: { dia: String, n: Number },
    oroCompis: { type: Number, default: 0 },
}, { minimize: false });

module.exports = mongoose.model('ColeccionMascotas', ColeccionMascotasSchema);

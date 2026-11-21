const mongoose = require('mongoose');

// Marca que un mes de la Liga Sokyo ya se cerró (solo se cierra una vez aunque haya
// varias pasadas a la vez) y guarda su podio. También apunta el oro que cada persona
// gasta al día en impulsar (tope diario). Lógica en utils/liga.js.
const LigaMesSchema = new mongoose.Schema({
    mes: { type: String, required: true, unique: true },
    podio: { type: [String], default: [] },
    fecha: { type: Date, default: Date.now },
});

module.exports = mongoose.model('LigaMes', LigaMesSchema);

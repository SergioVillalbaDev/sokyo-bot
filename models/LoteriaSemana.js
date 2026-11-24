const mongoose = require('mongoose');

// Lotería semanal de cada servidor (1.32.0, utils/casinoExtra.js). Boletos por persona (userId → n),
// el sorteo del domingo a las 20:00 UTC y sus ganadores. Se borra a los 60 días.
const LoteriaSemanaSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    semana: { type: String, required: true },          // lunes UTC (YYYY-MM-DD)
    boletos: { type: Object, default: {} },
    total: { type: Number, default: 0 },
    sorteado: { type: Boolean, default: false },
    bote: { type: Number, default: 0 },
    ganadores: { type: [{ userId: String, puesto: Number, premio: Number, _id: false }], default: [] },
    creado: { type: Date, default: Date.now, expires: 60 * 86400 },
}, { minimize: false });
LoteriaSemanaSchema.index({ guildId: 1, semana: 1 }, { unique: true });
LoteriaSemanaSchema.index({ sorteado: 1, semana: 1 });

module.exports = mongoose.model('LoteriaSemana', LoteriaSemanaSchema);

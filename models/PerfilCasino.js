const mongoose = require('mongoose');

// Lo de cada persona en el casino de un servidor (1.16.0): el tope de pérdidas del
// día, la pausa voluntaria y sus números. Lógica en utils/casino.js.
const PerfilCasinoSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    dia: { type: String, default: '' },          // 'YYYY-MM-DD' de perdidoHoy
    perdidoHoy: { type: Number, default: 0 },    // pérdida neta del día (para el tope)
    pausaHasta: { type: Date, default: null },   // se ha tomado un descanso del casino
    jugadas: { type: Number, default: 0 },
    apostado: { type: Number, default: 0 },
    ganado: { type: Number, default: 0 },        // lo cobrado en premios
    mayorPremio: { type: Number, default: 0 },
    mayorJuego: { type: String, default: null },
    ultimaDiaria: { type: Date, default: null },
    rachaPerdidas: { type: Number, default: 0 }, // 1.32.0: partidas seguidas sin ganar (juego responsable)
    avisoRacha: { type: Number, default: 0 },    // 1.32.0: hasta qué racha ya se avisó
});
PerfilCasinoSchema.index({ guildId: 1, userId: 1 }, { unique: true });
PerfilCasinoSchema.index({ guildId: 1, ganado: -1 });

module.exports = mongoose.model('PerfilCasino', PerfilCasinoSchema);

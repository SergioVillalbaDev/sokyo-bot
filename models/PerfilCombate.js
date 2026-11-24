const mongoose = require('mongoose');

// Perfil de combate de cada persona en cada servidor (1.32.0, utils/combate.js): clasificación
// (ELO y rango), victorias y derrotas, racha, lo de hoy (victorias premiadas y combates contra cada
// rival, para que no se pueda farmear la clasificación con un amigo) y la torre del mes.
const PerfilCombateSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    elo: { type: Number, default: 1000 },
    mejorElo: { type: Number, default: 1000 },
    victorias: { type: Number, default: 0 },
    derrotas: { type: Number, default: 0 },
    racha: { type: Number, default: 0 },
    mejorRacha: { type: Number, default: 0 },
    hoy: { dia: String, victorias: { type: Number, default: 0 }, parejas: { type: Object, default: {} } },
    torre: { temp: String, piso: { type: Number, default: 0 }, mejor: { type: Number, default: 0 }, intentos: { dia: String, n: Number } },
}, { minimize: false, timestamps: true });
PerfilCombateSchema.index({ guildId: 1, userId: 1 }, { unique: true });
PerfilCombateSchema.index({ guildId: 1, elo: -1 });

module.exports = mongoose.model('PerfilCombate', PerfilCombateSchema);

const mongoose = require('mongoose');

// Cada jugada del casino. Las que se quedan «en_curso» si el bot se reinicia a mitad
// (blackjack, crash, minas, carrera, duelo) se devuelven al arrancar.
const JugadaCasinoSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    juego: { type: String, required: true },
    apuesta: { type: Number, required: true },
    premio: { type: Number, default: 0 },
    mult: { type: Number, default: 0 },
    detalle: { type: mongoose.Schema.Types.Mixed, default: null },
    estado: { type: String, enum: ['en_curso', 'hecha', 'devuelta'], default: 'en_curso' },
    fecha: { type: Date, default: Date.now },
});
JugadaCasinoSchema.index({ estado: 1 });
JugadaCasinoSchema.index({ guildId: 1, fecha: -1 });
JugadaCasinoSchema.index({ guildId: 1, mult: -1, fecha: -1 });
JugadaCasinoSchema.index({ fecha: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

module.exports = mongoose.model('JugadaCasino', JugadaCasinoSchema);

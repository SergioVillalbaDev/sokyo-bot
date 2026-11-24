const mongoose = require('mongoose');

// Un combate entre dos personas (1.32.0). Sirve sobre todo para las APUESTAS: el oro de los dos se
// cobra al aceptar y queda aquí «en_curso» hasta que acaba. Si el bot se reinicia a mitad, al
// arrancar se devuelve (utils/combate.js → devolverPendientes). Se borran solos a los 30 días.
const CombatePvPSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    a: { type: String, required: true },
    b: { type: String, required: true },
    apuesta: { type: Number, default: 0 },
    estado: { type: String, enum: ['en_curso', 'terminado', 'devuelto'], default: 'en_curso' },
    ganador: { type: String, default: null },
    rondas: { type: Number, default: 0 },
    creado: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
});
CombatePvPSchema.index({ estado: 1 });

module.exports = mongoose.model('CombatePvP', CombatePvPSchema);

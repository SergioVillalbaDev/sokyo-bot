const mongoose = require('mongoose');

// Combate diario de mascotas entre dos servidores de la Liga (o contra una criatura
// salvaje si no hay rival). Se anuncia antes para que la gente anime; al llegar la
// hora se resuelve. Lógica en utils/liga.js.
const LadoSchema = new mongoose.Schema({
    guildId: { type: String, default: null },  // null = criatura salvaje
    nombre: String,
    especie: String,
    nivel: Number,
    poder: Number,
    stats: { fuerza: Number, defensa: Number, agilidad: Number },
    accesorio: String,
    animos: { type: [String], default: [] },   // quién ha animado
    votos: { type: Object, default: undefined }, // 1.33.0: táctica votada por cada miembro ({ userId: 'ataque' })
    tactica: { type: String, default: null },    // 1.33.0: la que ganó la votación (al resolverse)
    canalId: { type: String, default: null },
    mensajeId: { type: String, default: null },
}, { _id: false });

const CombateMascotaSchema = new mongoose.Schema({
    dia: { type: String, required: true },     // 'YYYY-MM-DD'
    hora: { type: Date, required: true },      // cuándo se resuelve
    a: { type: LadoSchema, required: true },
    b: { type: LadoSchema, required: true },
    estado: { type: String, enum: ['pendiente', 'hecho'], default: 'pendiente' },
    ganador: { type: String, default: null },  // 'a' | 'b'
    rondas: { type: [{ a: Number, b: Number, ataqueA: String, ataqueB: String, eventoA: String, eventoB: String, _id: false }], default: [] },
});

CombateMascotaSchema.index({ dia: 1, 'a.guildId': 1 });
CombateMascotaSchema.index({ dia: 1, 'b.guildId': 1 });
CombateMascotaSchema.index({ estado: 1, hora: 1 });

module.exports = mongoose.model('CombateMascota', CombateMascotaSchema);

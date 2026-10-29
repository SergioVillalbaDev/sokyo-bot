const mongoose = require('mongoose');

// Buscar grupo (/grupo): alguien busca gente para jugar a algo. Los demás se
// apuntan con un botón; al llenarse, el bot puede crear una sala de voz para el
// grupo, que se borra sola cuando se vacía. Lógica en utils/grupos.js.
const GrupoSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    canalId: { type: String, required: true },
    mensajeId: { type: String, default: null },
    creadorId: { type: String, required: true },
    juego: { type: String, required: true },
    plazas: { type: Number, required: true, min: 2, max: 25 },
    descripcion: { type: String, default: '' },
    cuando: { type: String, default: '' },           // texto libre: «a las 22:00», «ahora»…
    miembros: { type: [String], default: [] },       // el creador va el primero
    estado: { type: String, enum: ['abierto', 'lleno', 'cerrado'], default: 'abierto' },
    salaVozId: { type: String, default: null },
    salaVaciaDesde: { type: Date, default: null },
    expira: { type: Date, required: true },
    creadoFecha: { type: Date, default: Date.now },
});

GrupoSchema.index({ guildId: 1, estado: 1, creadoFecha: -1 });
GrupoSchema.index({ estado: 1, expira: 1 });
GrupoSchema.index({ salaVozId: 1 }, { partialFilterExpression: { salaVozId: { $type: 'string' } } });

module.exports = mongoose.model('Grupo', GrupoSchema);

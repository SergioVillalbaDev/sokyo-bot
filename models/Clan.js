const mongoose = require('mongoose');

// Clanes: equipos de miembros que compiten cada semana. Cada XP que gana un
// miembro suma un punto para su clan; el lunes gana el que más tiene y sus
// miembros reciben el premio. Lógica en utils/clanes.js.
const ClanSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    nombre: { type: String, required: true },
    nombreClave: { type: String, required: true },   // en minúsculas y sin tildes, para no repetir nombres
    emoji: { type: String, default: '🛡️' },
    liderId: { type: String, required: true },
    miembros: { type: [String], default: [] },       // el líder también está aquí
    puntosSemana: { type: Number, default: 0 },
    puntosTotal: { type: Number, default: 0 },
    victorias: { type: Number, default: 0 },
    creadoFecha: { type: Date, default: Date.now },
});

ClanSchema.index({ guildId: 1, nombreClave: 1 }, { unique: true });
ClanSchema.index({ guildId: 1, miembros: 1 });
ClanSchema.index({ guildId: 1, puntosSemana: -1 });

module.exports = mongoose.model('Clan', ClanSchema);

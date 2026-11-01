const mongoose = require('mongoose');

const nivelSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    usuarioId: { type: String, required: true },
    usuarioNombre: { type: String, default: '' },
    xp: { type: Number, default: 0 },
    nivel: { type: Number, default: 0 },
    mensajes: { type: Number, default: 0 },
    ultimoXp: { type: Date, default: null }
});
nivelSchema.index({ guildId: 1, usuarioId: 1 }, { unique: true });
nivelSchema.index({ guildId: 1, xp: -1 });

module.exports = mongoose.model('Nivel', nivelSchema);

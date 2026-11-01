const mongoose = require('mongoose');

// Historial de moderación (warn, mute, kick, ban...). Lo escriben tanto los comandos / como el panel web.
const sancionSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    usuarioId: { type: String, required: true, index: true },
    usuarioNombre: { type: String, default: 'Desconocido' },
    tipo: { type: String, enum: ['warn', 'mute', 'unmute', 'kick', 'ban', 'unban'], required: true },
    razon: { type: String, default: 'Sin razón especificada' },
    moderadorId: { type: String, required: true },
    moderadorNombre: { type: String, default: 'Desconocido' },
    origen: { type: String, default: 'discord' }, // 'discord' | 'panel' | 'automod'
    duracionMs: { type: Number, default: null },
    fecha: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Sancion', sancionSchema);

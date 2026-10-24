const mongoose = require('mongoose');

// Crecimiento · Canal de Twitch o YouTube que un servidor sigue para avisar de sus
// directos y vídeos. Lógica en utils/directos.js.
//  - externoId: login de Twitch (en minúsculas) o ID del canal de YouTube (UC…).
//  - ultimoId:  último directo (Twitch) o vídeo (YouTube) avisado, para no repetir.
//  - pendientes: directos programados de YouTube a la espera de empezar.
const FuenteDirectoSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    tipo: { type: String, enum: ['twitch', 'youtube'], required: true },
    externoId: { type: String, required: true },
    nombre: { type: String, default: '' },
    url: { type: String, default: '' },
    avatar: { type: String, default: null },
    ultimoId: { type: String, default: null },
    ultimaFecha: { type: Date, default: null },       // YouTube: publicación del último vídeo visto
    pendientes: { type: [String], default: [] },
    enDirecto: { type: Boolean, default: false },
    ultimoAviso: { type: Date, default: null },
    ultimoError: { type: String, default: '' },
    creadoPor: { type: String, default: '' },
    creadoFecha: { type: Date, default: Date.now },
});

FuenteDirectoSchema.index({ guildId: 1, tipo: 1, externoId: 1 }, { unique: true });

module.exports = mongoose.model('FuenteDirecto', FuenteDirectoSchema);

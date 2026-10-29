const mongoose = require('mongoose');

// Crecimiento · Canal de Twitch, YouTube o Kick, comunidad de Reddit o web con RSS
// que un servidor sigue para avisar de sus directos y publicaciones. Lógica en
// utils/directos.js.
//  - externoId: login de Twitch o de Kick (en minúsculas), ID del canal de YouTube
//    (UC…), nombre de la comunidad de Reddit o dirección del RSS.
//  - ultimoId:  último directo o publicación avisada, para no repetir.
//  - pendientes: directos programados de YouTube a la espera de empezar.
const FuenteDirectoSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    tipo: { type: String, enum: ['twitch', 'youtube', 'kick', 'reddit', 'rss'], required: true },
    externoId: { type: String, required: true },
    nombre: { type: String, default: '' },
    url: { type: String, default: '' },
    avatar: { type: String, default: null },
    ultimoId: { type: String, default: null },
    ultimaFecha: { type: Date, default: null },       // YouTube, Reddit y RSS: la última publicación vista
    vistos: { type: [String], default: [] },          // Reddit y RSS: las últimas publicaciones vistas (por si no traen fecha)
    pendientes: { type: [String], default: [] },
    enDirecto: { type: Boolean, default: false },
    ultimoAviso: { type: Date, default: null },
    ultimoError: { type: String, default: '' },
    creadoPor: { type: String, default: '' },
    creadoFecha: { type: Date, default: Date.now },
});

FuenteDirectoSchema.index({ guildId: 1, tipo: 1, externoId: 1 }, { unique: true });

module.exports = mongoose.model('FuenteDirecto', FuenteDirectoSchema);

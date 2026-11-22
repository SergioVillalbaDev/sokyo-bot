const mongoose = require('mongoose');

// Compañeros propios de un servidor (1.20.0): los crea el admin desde el panel con su
// foto, nombre, rareza y frases. Salen en los cofres que se abren en ese servidor y,
// una vez conseguidos, son de esa persona en todos los servidores.
// En la colección su id es «s:<guildId>:<cid>» (utils/cofresNucleo.js → def).
const CompaneroServidorSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    cid: { type: String, required: true },
    nombre: { type: String, required: true },
    rareza: { type: String, default: 'rara' },
    imagen: { type: String, default: null },   // /uploads/compi-…
    emoji: { type: String, default: '⭐' },
    desc: { type: String, default: '' },
    voz: { type: String, default: 'tierno' },
    frases: { type: [String], default: [] },
    activo: { type: Boolean, default: true }, // si sale en los cofres
    creado: { type: Date, default: Date.now },
});
CompaneroServidorSchema.index({ guildId: 1, cid: 1 }, { unique: true });

module.exports = mongoose.model('CompaneroServidor', CompaneroServidorSchema);

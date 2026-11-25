const mongoose = require('mongoose');

// «🤔 No lo entiendo» (1.34.0, utils/navegacion.js): qué ayuda no se entendió y, si quiso, por qué. Sin quién lo dijo.
// Lo leen los propietarios en el panel para mejorar las explicaciones. Se borra a los 180 días.
const ComentarioAyudaSchema = new mongoose.Schema({
    guildId: { type: String, default: null },
    tema: { type: String, required: true },
    texto: { type: String, default: '' },
    fecha: { type: Date, default: Date.now },
});
ComentarioAyudaSchema.index({ fecha: 1 }, { expireAfterSeconds: 180 * 24 * 3600 });
ComentarioAyudaSchema.index({ tema: 1, fecha: -1 });

module.exports = mongoose.model('ComentarioAyuda', ComentarioAyudaSchema);

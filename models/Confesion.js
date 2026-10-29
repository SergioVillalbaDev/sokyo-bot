const mongoose = require('mongoose');

// Confesiones anónimas (/confesar). En el servidor nadie ve quién la ha escrito;
// se guarda solo para que el staff pueda actuar si alguien la usa para acosar
// (verlo desde el panel queda apuntado en el registro). Lógica en utils/confesiones.js.
const ConfesionSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    numero: { type: Number, default: null },            // se le da al publicarla (las rechazadas no gastan número)
    autorId: { type: String, required: true },
    texto: { type: String, required: true },
    estado: { type: String, enum: ['pendiente', 'publicada', 'rechazada'], default: 'pendiente' },
    mensajeId: { type: String, default: null },          // la confesión publicada
    revisionCanalId: { type: String, default: null },
    revisionMensajeId: { type: String, default: null },  // el aviso al staff con Aprobar / Rechazar
    revisadoPor: { type: String, default: null },
    fecha: { type: Date, default: Date.now },
});

ConfesionSchema.index({ guildId: 1, fecha: -1 });
ConfesionSchema.index({ guildId: 1, numero: 1 }, { unique: true, partialFilterExpression: { numero: { $type: 'number' } } });

module.exports = mongoose.model('Confesion', ConfesionSchema);

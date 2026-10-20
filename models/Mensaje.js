const mongoose = require('mongoose');

const mensajeSchema = new mongoose.Schema({
    ticketId: { type: String, required: true }, // id del canal del ticket
    mensajeId: { type: String, default: null }, // id del mensaje en Discord (para sincronizar ediciones/borrados)
    usuario: { type: String, required: true },
    usuarioId: { type: String, required: true },
    avatar: { type: String, default: null },
    esStaff: { type: Boolean, default: false },
    origen: { type: String, enum: ['discord', 'panel', 'portal'], default: 'discord' },
    contenido: { type: String, default: '' },
    imagenes: { type: [String], default: [] }, // URLs de todos los adjuntos (imágenes u otros archivos)
    editado: { type: Boolean, default: false },
    borrado: { type: Boolean, default: false },
    fecha: { type: Date, default: Date.now }
});

mensajeSchema.index({ ticketId: 1, fecha: 1 });
mensajeSchema.index({ mensajeId: 1 }, { sparse: true });

module.exports = mongoose.model('Mensaje', mensajeSchema);

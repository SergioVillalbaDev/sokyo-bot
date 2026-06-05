const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    canalId: { type: String, required: true }, // La ID del canal privado que se crea
    creadorId: { type: String, required: true }, // La ID del usuario que pulsó el botón
    creadorNombre: { type: String, required: true }, // El nombre del usuario (para la web)
    estado: { type: String, default: 'Abierto' }, // Por defecto, al crearlo estará 'Abierto'
    fechaCreacion: { type: Date, default: Date.now } // Guarda el momento exacto
});

module.exports = mongoose.model('Ticket', ticketSchema);
const mongoose = require('mongoose');

// Sugerencias y encuestas comparten modelo: ambas son un mensaje con botones de voto.
const votacionSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    tipo: { type: String, enum: ['sugerencia', 'encuesta'], required: true },
    canalId: { type: String, required: true },
    mensajeId: { type: String, required: true, unique: true },
    autorId: { type: String, required: true },
    autorNombre: { type: String, default: '' },
    texto: { type: String, required: true },
    // Cada opción guarda los ids de quienes la votaron (1 voto por persona).
    opciones: { type: [{ texto: String, votos: [String] }], default: [] },
    estado: { type: String, default: 'abierta' },        // abierta | aprobada | rechazada | cerrada
    resolucion: { type: String, default: '' },
    fecha: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Votacion', votacionSchema);

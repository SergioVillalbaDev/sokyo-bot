const mongoose = require('mongoose');

// Reporte de un usuario hecho por otro (sistema de reportes de seguridad).
const ReporteSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    // Quién reporta
    reportanteId: { type: String, required: true },
    reportanteTag: { type: String, default: '' },
    // A quién se reporta
    reportadoId: { type: String, default: null },
    reportadoTag: { type: String, default: '' },
    reportadoAvatar: { type: String, default: null },
    // Contexto
    canalId: { type: String, default: null },        // canal donde ocurrió
    mensajeId: { type: String, default: null },       // mensaje reportado (si aplica)
    mensajeContenido: { type: String, default: '' },  // copia del contenido reportado
    motivo: { type: String, default: '' },
    // Estado: pendiente | resuelto | descartado
    estado: { type: String, enum: ['pendiente', 'resuelto', 'descartado'], default: 'pendiente' },
    resueltoPor: { type: String, default: null },
    resueltoFecha: { type: Date, default: null },
    canalTicketId: { type: String, default: null },  // ticket abierto a raíz de este reporte (si existe)
    fecha: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Reporte', ReporteSchema);

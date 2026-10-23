const mongoose = require('mongoose');

// Comunidad · Evento. Se crea desde el panel; el bot publica un anuncio del
// evento y (si se configuró recordatorio) el scheduler manda un aviso X minutos
// antes de que empiece. `recordatorioEnviado` evita duplicar el aviso.
const EventoSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    canalId: { type: String, required: true },
    mensajeId: { type: String, default: null },
    titulo: { type: String, required: true },
    descripcion: { type: String, default: '' },
    tipo: { type: String, enum: ['voz', 'escenario', 'externo'], default: 'voz' },
    portada: { type: String, default: null },          // URL de imagen de portada
    fechaInicio: { type: Date, required: true, index: true },
    recordatorio: { type: Number, default: 0 },        // minutos antes para avisar (0 = sin recordatorio)
    recordatorioEnviado: { type: Boolean, default: false },
    asistentes: { type: Number, default: 0 },
    creadoPor: { type: String, default: 'Panel Web' },
    creadoFecha: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Evento', EventoSchema);

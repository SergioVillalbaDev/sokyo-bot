const mongoose = require('mongoose');

// Pregunta de un formulario de ticket (se muestra en el modal de Discord, máx. 5 por tipo).
const preguntaSchema = new mongoose.Schema({
    etiqueta: { type: String, required: true },          // Discord: máx. 45 caracteres
    placeholder: { type: String, default: '' },          // Discord: máx. 100 caracteres
    estilo: { type: String, enum: ['corto', 'largo'], default: 'largo' },
    requerida: { type: Boolean, default: true },
    max: { type: Number, default: 1000 }                 // Discord: máx. 4000
}, { _id: false });

// Tipo de ticket (lo que el usuario elige en el menú). Cada uno puede tener su formulario,
// su propio equipo (roles) y su propia categoría de Discord.
const motivoSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    emoji: { type: String, default: '' },
    descripcion: { type: String, default: '' },
    urgencia: { type: String, default: 'Normal' },
    preguntas: { type: [preguntaSchema], default: [] },  // vacío = preguntas por defecto (asunto + descripción)
    rolesStaff: { type: [String], default: [] },         // vacío = roles de staff generales
    categoriaId: { type: String, default: null }         // vacío = categoría general de tickets
});

// Panel publicado en un canal (mensaje con el botón "Abrir ticket").
const panelSchema = new mongoose.Schema({
    nombre: { type: String, default: 'Panel principal' },
    titulo: { type: String, default: '🎫 Soporte Técnico Activo' },
    descripcion: { type: String, default: 'Haz clic en el botón de abajo para abrir un ticket de soporte.' },
    color: { type: String, default: '#5865F2' },
    textoBoton: { type: String, default: '📩 Abrir Ticket' },
    motivos: { type: [String], default: [] }             // IDs de motivos; vacío = todos
});

const ServidorConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },

    motivos: {
        type: [motivoSchema],
        default: [
            { nombre: 'Soporte General', urgencia: 'Normal', emoji: '🛠️' },
            { nombre: 'Reportar Usuario', urgencia: 'Alta', emoji: '🚨' },
            { nombre: 'Donaciones', urgencia: 'Baja', emoji: '💸' }
        ]
    },

    urgencias: {
        type: [{ nombre: String, color: String, nivel: Number }],
        default: [
            { nombre: 'Urgente', color: '#e74c3c', nivel: 4 },
            { nombre: 'Alta', color: '#e67e22', nivel: 3 },
            { nombre: 'Normal', color: '#3498db', nivel: 2 },
            { nombre: 'Baja', color: '#95a5a6', nivel: 1 }
        ]
    },

    paneles: { type: [panelSchema], default: [] },

    // --- Equipo y canales ---
    rolesStaff: { type: [String], default: [] },
    categoriaTicketsId: { type: String, default: null },
    categoriaArchivoId: { type: String, default: null },
    canalLogsId: { type: String, default: null },
    mencionarStaff: { type: Boolean, default: true },
    maxTicketsPorUsuario: { type: Number, default: 2 },
    contadorTickets: { type: Number, default: 0 },

    // --- IA ---
    ia: {
        activada: { type: Boolean, default: true },
        deflexion: { type: Boolean, default: true },     // responder con la FAQ antes de abrir ticket
        triaje: { type: Boolean, default: true },        // detectar urgencia/idioma al abrir
        mes: { type: String, default: '' },              // 'AAAA-MM' del contador de uso
        usos: { type: Number, default: 0 },
        ticketsEvitados: { type: Number, default: 0 }
    },

    // --- Campos antiguos del panel único (se migran a `paneles` al cargar) ---
    mensajeSoporteTitulo: { type: String, default: '🎫 Soporte Técnico Activo' },
    mensajeSoporteDescripcion: { type: String, default: 'Haz clic en el botón de abajo para abrir un ticket de soporte.' },
    footerPersonalizado: { type: String, default: 'Sistema de Gestión Sokyo' },

    esPremium: { type: Boolean, default: false },
    premiumHasta: { type: Date, default: null }
});

module.exports = mongoose.model('ServidorConfig', ServidorConfigSchema);

const mongoose = require('mongoose');

const ServidorConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    motivos: { 
        type: [{ nombre: String, urgencia: String }], 
        default: [
            { nombre: 'Soporte General', urgencia: 'Normal' },
            { nombre: 'Reportar Usuario', urgencia: 'Alta' },
            { nombre: 'Donaciones', urgencia: 'Baja' }
        ] 
    },
    
    // --- NUEVO SISTEMA DE URGENCIAS PERSONALIZADAS ---
    urgencias: {
        type: [{ nombre: String, color: String, nivel: Number }],
        default: [
            { nombre: 'Urgente', color: '#e74c3c', nivel: 4 },
            { nombre: 'Alta', color: '#e67e22', nivel: 3 },
            { nombre: 'Normal', color: '#3498db', nivel: 2 },
            { nombre: 'Baja', color: '#95a5a6', nivel: 1 }
        ]
    },

    mensajeSoporteTitulo: { type: String, default: '🎫 Soporte Técnico Activo' },
    mensajeSoporteDescripcion: { type: String, default: 'Haz clic en el botón de abajo para abrir un ticket de soporte.' },
    footerPersonalizado: { type: String, default: 'Sistema de Gestión Sokyo' },
    
    esPremium: { type: Boolean, default: false },
    premiumHasta: { type: Date, default: null }
});

module.exports = mongoose.model('ServidorConfig', ServidorConfigSchema);
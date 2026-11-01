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
    
    // --- PERMISOS DEL PANEL: qué permisos del panel concede cada rol de Discord ---
    // (los permisos de moderación NUNCA se guardan aquí: salen de los permisos nativos de Discord)
    rolesPermisos: { type: [{ rolId: String, permisos: [String] }], default: [] },

    // --- TICKETS: límites anti-abuso y FAQ ---
    tickets: {
        maxAbiertosPorUsuario: { type: Number, default: 3 },
        cooldownSegundos: { type: Number, default: 60 },
        faqActiva: { type: Boolean, default: true },
        canalTranscriptsId: { type: String, default: null },
        rolStaffId: { type: String, default: null }          // rol a mencionar en avisos de SLA
    },

    // --- AUTOMATIZACIÓN de tickets ---
    automatizacion: {
        inactividadActiva: { type: Boolean, default: false },
        avisoHoras: { type: Number, default: 24 },           // sin respuesta del usuario => se le avisa
        cierreHoras: { type: Number, default: 24 },          // tras el aviso, se cierra solo
        slaActivo: { type: Boolean, default: false },
        slaHoras: { type: Number, default: 4 }               // usuario esperando al staff => recordatorio
    },

    // --- AUTOMOD ---
    automod: {
        activo: { type: Boolean, default: false },
        antiSpam: {
            activo: { type: Boolean, default: true },
            mensajes: { type: Number, default: 5 },
            segundos: { type: Number, default: 6 },
            minutosMute: { type: Number, default: 10 }
        },
        antiEnlaces: {
            activo: { type: Boolean, default: false },
            dominiosPermitidos: { type: [String], default: [] }
        }
    },

    // --- COMUNIDAD ---
    bienvenida: {
        autoRolId: { type: String, default: null },
        verificacionActiva: { type: Boolean, default: false },
        verificacionRolId: { type: String, default: null }
    },
    niveles: {
        activo: { type: Boolean, default: false },
        canalId: { type: String, default: null },
        recompensas: { type: [{ nivel: Number, rolId: String }], default: [] }
    },
    sugerenciasCanalId: { type: String, default: null },

    esPremium: { type: Boolean, default: false },
    premiumHasta: { type: Date, default: null }
});

module.exports = mongoose.model('ServidorConfig', ServidorConfigSchema);
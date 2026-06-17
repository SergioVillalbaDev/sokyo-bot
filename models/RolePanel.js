const mongoose = require('mongoose');

// Un "panel de autoasignación de roles": un mensaje que el bot publica en un
// canal y desde el cual los usuarios se ponen/quitan roles ellos solos.
// Soporta los tres mecanismos (botón, menú, reacción) y el tipo "verificación".
const RolePanelSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, default: null },  // canal donde se publicó
    messageId: { type: String, default: null },   // mensaje publicado (para editarlo / escuchar reacciones)

    tipo: { type: String, enum: ['boton', 'menu', 'reaccion', 'verificacion'], default: 'boton' },

    // Apariencia del embed publicado.
    titulo: { type: String, default: '🎭 Elige tus roles' },
    descripcion: { type: String, default: 'Pulsa para asignarte o quitarte un rol.' },
    color: { type: String, default: '#5865F2' },
    imagen: { type: String, default: null },         // URL externa de imagen o gif del embed
    imagenArchivo: { type: String, default: null },  // archivo subido (en /uploads); se adjunta al mensaje

    // Grupo exclusivo: solo se puede tener UN rol del panel a la vez.
    exclusivo: { type: Boolean, default: false },
    // Máximo de roles de este panel por usuario (0 = sin límite). Ignorado si es exclusivo.
    maxRoles: { type: Number, default: 0 },
    // Si false, al pulsar/reaccionar de nuevo NO se quita el rol (solo se puede añadir).
    permitirQuitar: { type: Boolean, default: true },

    // Roles del panel. emoji/label/descripcion son opcionales según el mecanismo.
    // duracionMin > 0 convierte el rol en temporal (expira solo).
    // estilo: color del botón (primary/secondary/success/danger).
    items: {
        type: [{
            roleId: { type: String, required: true },
            emoji: { type: String, default: null },
            label: { type: String, default: null },
            descripcion: { type: String, default: null },
            duracionMin: { type: Number, default: 0 },
            estilo: { type: String, enum: ['primary', 'secondary', 'success', 'danger'], default: 'secondary' },
        }],
        default: [],
    },
}, { timestamps: true });

module.exports = mongoose.model('RolePanel', RolePanelSchema);

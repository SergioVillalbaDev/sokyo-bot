const mongoose = require('mongoose');

// Preferencias de cada persona (valen en todos los servidores con Sokyo): en qué
// idioma le habla el bot y qué mensajes privados quiere recibir. Se cambian con
// /preferencias en Discord o en «Mi cuenta». Sin documento = todo por defecto.
const PreferenciasMiembroSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    // 'auto' = el idioma de su Discord (o el del servidor si no se sabe).
    idioma: { type: String, enum: ['auto', 'es', 'en'], default: 'auto' },
    dms: {
        anuncios: { type: Boolean, default: true },   // «Bot actualizado»
        tickets: { type: Boolean, default: true },    // el staff responde a su ticket
        niveles: { type: Boolean, default: true },    // subidas de nivel por privado
        sorteos: { type: Boolean, default: true },    // ha ganado un sorteo
    },
}, { timestamps: true });

module.exports = mongoose.model('PreferenciasMiembro', PreferenciasMiembroSchema);

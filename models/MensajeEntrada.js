const mongoose = require('mongoose');

// Mensaje que manda el bot al ENTRAR en un servidor (utils/onboarding.js). Es GLOBAL
// (vale para todos los servidores): un único documento, clave 'global', que solo
// cambian los propietarios del bot desde el panel (Propietario → Mensaje de entrada).
// Los textos vacíos usan los de fábrica.
const TextosSchema = new mongoose.Schema({
    titulo: { type: String, default: '' },
    descripcion: { type: String, default: '' },
}, { _id: false });

const MensajeEntradaSchema = new mongoose.Schema({
    clave: { type: String, default: 'global', unique: true },
    activo: { type: Boolean, default: true },        // mandar el mensaje al entrar
    alDueno: { type: Boolean, default: true },       // por privado al dueño del servidor
    // En un canal del servidor (el del sistema o el primero donde pueda escribir):
    //   'siempre' · 'respaldo' (solo si no le llega por privado) · 'nunca'.
    alCanal: { type: String, enum: ['siempre', 'respaldo', 'nunca'], default: 'respaldo' },
    guiaCompleta: { type: Boolean, default: true },  // añadir «Qué puedo hacer» (todas las funciones)
    es: { type: TextosSchema, default: () => ({}) },
    en: { type: TextosSchema, default: () => ({}) },
    actualizadoPor: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('MensajeEntrada', MensajeEntradaSchema);

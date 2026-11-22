const mongoose = require('mongoose');

// Clave de soporte (la usa Claude, el asistente que programa Sokyo) para ver, comprobar
// y, si se le deja, cambiar la configuración de los servidores por la API (/api/soporte/…).
// La crea un propietario del bot en el panel (Propietario → Acceso de soporte); aquí
// solo se guarda su huella (sha256), nunca la clave. Lógica en utils/accesoSoporte.js.
const AccesoSoporteSchema = new mongoose.Schema({
    hash: { type: String, required: true, unique: true },
    pista: { type: String, default: '' },              // últimos 4 caracteres, para reconocerla
    modo: { type: String, enum: ['lectura', 'completo'], default: 'lectura' },
    creadoPor: { type: String, default: null },
    creado: { type: Date, default: Date.now },
    caduca: { type: Date, default: null },             // null = no caduca
    ultimoUso: { type: Date, default: null },
    usos: { type: Number, default: 0 },
});

module.exports = mongoose.model('AccesoSoporte', AccesoSoporteSchema);

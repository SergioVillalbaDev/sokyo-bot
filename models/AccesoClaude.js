const mongoose = require('mongoose');

// Clave para que Claude (el asistente que programa Sokyo) pueda ver, comprobar y, si
// se le deja, cambiar la configuración de los servidores por la API (/api/claude/…).
// La crea un propietario del bot en el panel (Propietario → Acceso de Claude); aquí
// solo se guarda su huella (sha256), nunca la clave. Lógica en utils/accesoClaude.js.
const AccesoClaudeSchema = new mongoose.Schema({
    hash: { type: String, required: true, unique: true },
    pista: { type: String, default: '' },              // últimos 4 caracteres, para reconocerla
    modo: { type: String, enum: ['lectura', 'completo'], default: 'lectura' },
    creadoPor: { type: String, default: null },
    creado: { type: Date, default: Date.now },
    caduca: { type: Date, default: null },             // null = no caduca
    ultimoUso: { type: Date, default: null },
    usos: { type: Number, default: 0 },
});

module.exports = mongoose.model('AccesoClaude', AccesoClaudeSchema);

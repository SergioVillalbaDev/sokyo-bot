const mongoose = require('mongoose');

// Un canal de voz temporal vivo: se crea cuando alguien entra a un "generador"
// y se borra cuando se queda vacío. Guardamos su estado para poder limpiarlo al
// reiniciar el bot y para que el panel web pueda listarlos/gestionarlos.
const CanalVozTemporalSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    canalId: { type: String, required: true, unique: true }, // canal de voz creado
    ownerId: { type: String, required: true },               // dueño actual (puede cambiar al reclamar/transferir)
    generadorId: { type: String, default: null },            // canal generador que lo originó
    nombre: { type: String, default: '' },                   // nombre actual del canal

    // Estado persistido (para reconstruir permisos tras un reinicio si hiciera falta).
    bloqueado: { type: Boolean, default: false },            // @everyone no puede conectarse
    oculto: { type: Boolean, default: false },               // @everyone no puede ver
    limite: { type: Number, default: 0 },                    // límite de usuarios (0 = sin límite)
    permitidos: { type: [String], default: [] },             // usuarios invitados explícitamente
    bloqueados: { type: [String], default: [] },             // usuarios expulsados/vetados

    creadoEn: { type: Date, default: Date.now },
});

module.exports = mongoose.model('CanalVozTemporal', CanalVozTemporalSchema);

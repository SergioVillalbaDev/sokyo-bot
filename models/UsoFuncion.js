const mongoose = require('mongoose');

// Qué se usa (1.34.0, utils/uso.js): contadores por día, servidor y cosa (comando, botón de un módulo, error, paso de
// /empezar). Sin quién: solo cuántas veces. Sirve para ver qué no usa nadie y dónde se pierde la gente. 120 días.
const UsoFuncionSchema = new mongoose.Schema({
    dia: { type: String, required: true },      // YYYY-MM-DD (UTC)
    guildId: { type: String, default: null },
    clave: { type: String, required: true },    // 'cmd:menu', 'mod:casino', 'error:casino', 'paso:diario'…
    n: { type: Number, default: 0 },
    fecha: { type: Date, default: Date.now },
});
UsoFuncionSchema.index({ dia: 1, guildId: 1, clave: 1 }, { unique: true });
UsoFuncionSchema.index({ fecha: 1 }, { expireAfterSeconds: 120 * 24 * 3600 });

module.exports = mongoose.model('UsoFuncion', UsoFuncionSchema);

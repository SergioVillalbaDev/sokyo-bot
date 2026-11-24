const mongoose = require('mongoose');

// Jefe semanal de cada servidor (1.32.0, utils/jefe.js): aparece el lunes, todos le pegan durante la
// semana (3 ataques al día por persona) y el domingo por la noche se reparten los premios (más si cae).
// El daño de cada persona va en `danios` (userId → daño) y sus ataques de hoy en `ataques` (userId → { dia, n }).
const JefeServidorSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    semana: { type: String, required: true },     // lunes UTC (YYYY-MM-DD)
    clave: { type: String, required: true },      // combateNucleo.JEFES
    max: { type: Number, required: true },
    vida: { type: Number, required: true },
    def: { type: Number, default: 20 },
    canalId: { type: String, default: null },
    mensajeId: { type: String, default: null },
    danios: { type: Object, default: {} },
    ataques: { type: Object, default: {} },
    muerto: { type: Date, default: null },
    matador: { type: String, default: null },
    repartido: { type: Boolean, default: false },
}, { minimize: false, timestamps: true });
JefeServidorSchema.index({ guildId: 1, semana: 1 }, { unique: true });
JefeServidorSchema.index({ repartido: 1, semana: 1 });

module.exports = mongoose.model('JefeServidor', JefeServidorSchema);

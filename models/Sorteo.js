const mongoose = require('mongoose');

// Comunidad · Sorteo. Se crea desde el panel, el bot publica un embed con un
// botón 🎉 para participar. El scheduler lo cierra al llegar fechaFin, elige
// ganador(es) al azar entre los participantes que cumplan los requisitos y los
// anuncia. Se puede terminar antes o hacer reroll desde el panel.
const GanadorSchema = new mongoose.Schema({
    id: { type: String, required: true },
    tag: { type: String, default: '' },
}, { _id: false });

const SorteoSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    canalId: { type: String, required: true },
    mensajeId: { type: String, default: null },
    nombre: { type: String, required: true },
    premio: { type: String, required: true },
    ganadores: { type: Number, default: 1 },          // cuántos ganadores elegir
    nivelMin: { type: Number, default: 0 },           // nivel mínimo para participar (0 = sin requisito)
    rolRequerido: { type: String, default: null },    // rol obligatorio para participar
    participantes: { type: [String], default: [] },   // userIds que se han apuntado
    ganadoresSeleccionados: { type: [GanadorSchema], default: [] },
    activo: { type: Boolean, default: true },
    fechaFin: { type: Date, required: true, index: true },
    creadoPor: { type: String, default: 'Panel Web' },
    creadoFecha: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Sorteo', SorteoSchema);

const mongoose = require('mongoose');

// Una broma de oro (1.14.0): alguien paga oro para gastarle una broma a otro miembro
// durante un rato (apodo, rol de payaso, reacción a sus mensajes o loro). Al acabar,
// el bot lo deja todo como estaba. Lógica en utils/bromas.js.
const BromaSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    autorId: { type: String, required: true },
    objetivoId: { type: String, required: true },
    tipo: { type: String, enum: ['apodo', 'payaso', 'reaccion', 'loro'], required: true },
    texto: { type: String, default: '' },            // el apodo o el emoji
    apodoAnterior: { type: String, default: null },  // para devolverlo al acabar (null = sin apodo)
    rolId: { type: String, default: null },          // el rol de payaso que se dio
    restantes: { type: Number, default: 0 },         // loro: mensajes que quedan por repetir
    precio: { type: Number, default: 0 },
    devolucionDe: { type: mongoose.Schema.Types.ObjectId, default: null }, // si es la venganza de otra
    devuelta: { type: Boolean, default: false },     // ya se la han devuelto (solo una vez)
    inicio: { type: Date, default: Date.now },
    fin: { type: Date, required: true },
    activa: { type: Boolean, default: true },
    canalId: { type: String, default: null },        // dónde se anunció (para los botones)
    mensajeId: { type: String, default: null },
});

BromaSchema.index({ activa: 1, fin: 1 });
BromaSchema.index({ guildId: 1, objetivoId: 1, activa: 1 });
BromaSchema.index({ guildId: 1, inicio: -1 });

module.exports = mongoose.model('Broma', BromaSchema);

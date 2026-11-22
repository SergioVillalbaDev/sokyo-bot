const mongoose = require('mongoose');

// Economía POR SERVIDOR (1.30.0): el oro, la mochila, el diario y el boost de XP de cada persona
// en cada servidor. Todos empiezan de 0 en cada servidor. (El antiguo models/Usuario.js, global,
// se queda sin tocar como archivo: ya no se usa para el oro.) Lógica en utils/economia.js.
const InventarioItemSchema = new mongoose.Schema({
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    cantidad: { type: Number, default: 1, min: 1 },
}, { _id: false });

const MonederoSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    discordId: { type: String, required: true },
    balance: { type: Number, default: 0, min: 0 },
    inventory: { type: [InventarioItemSchema], default: [] },
    ultimoDaily: { type: Date, default: null },
    rachaDaily: { type: Number, default: 0 },
    boostXp: { multiplicador: { type: Number, default: 1 }, expiraEn: { type: Date, default: null } },
}, { timestamps: true });
MonederoSchema.index({ guildId: 1, discordId: 1 }, { unique: true });
MonederoSchema.index({ guildId: 1, balance: -1 });

module.exports = mongoose.model('Monedero', MonederoSchema);

const mongoose = require('mongoose');

// El bote de la tragaperras de cada servidor: crece con un 2 % de cada tirada y se
// lo lleva quien saca 💎💎💎.
const CasinoBoteSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    bote: { type: Number, default: 1000 },
    ultimoGanadorId: { type: String, default: null },
    ultimoPremio: { type: Number, default: 0 },
    ultimaFecha: { type: Date, default: null },
});

module.exports = mongoose.model('CasinoBote', CasinoBoteSchema);

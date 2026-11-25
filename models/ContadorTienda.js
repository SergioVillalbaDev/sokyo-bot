const mongoose = require('mongoose');

// Unidades vendidas de cada producto de la tienda del servidor (2.1.0). Aparte de CompraTienda (que se
// borra a los 180 días) para que el stock limitado no se rellene solo con el tiempo.
const ContadorTiendaSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    productoId: { type: String, required: true },
    vendidos: { type: Number, default: 0 },
});
ContadorTiendaSchema.index({ guildId: 1, productoId: 1 }, { unique: true });

module.exports = mongoose.model('ContadorTienda', ContadorTiendaSchema);

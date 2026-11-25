const mongoose = require('mongoose');

// Una compra en la tienda del servidor (2.0.0, utils/tiendaServidor.js). Sirve para el
// historial del panel y para llevar las unidades vendidas de los productos con stock.
const CompraTiendaSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    productoId: { type: String, required: true },
    nombre: { type: String, default: '' },
    rolId: { type: String, default: null },
    precio: { type: Number, default: 0 },
    hasta: { type: Date, default: null },            // cuándo caduca el rol (null = para siempre)
    devuelta: { type: Boolean, default: false },     // no se pudo dar el rol: se devolvió el oro
}, { timestamps: true });

CompraTiendaSchema.index({ guildId: 1, createdAt: -1 });
CompraTiendaSchema.index({ guildId: 1, productoId: 1, devuelta: 1 });
CompraTiendaSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 3600 });

module.exports = mongoose.model('CompraTienda', CompraTiendaSchema);

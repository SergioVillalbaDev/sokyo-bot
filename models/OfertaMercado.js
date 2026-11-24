const mongoose = require('mongoose');

// Mercado de cartas entre miembros de un servidor (1.32.0, utils/mercado.js). Al poner una carta a la
// venta, su copia sale del álbum del vendedor (queda aquí guardada); al venderse va al comprador, al
// quitarla o caducar (7 días) vuelve al vendedor. `estado`: activa → vendida | retirada | caducada.
const OfertaMercadoSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    vendedor: { type: String, required: true },
    carta: { type: String, required: true },
    holo: { type: Boolean, default: false },
    precio: { type: Number, required: true, min: 1 },
    estado: { type: String, enum: ['activa', 'vendida', 'retirada', 'caducada'], default: 'activa' },
    comprador: { type: String, default: null },
    creada: { type: Date, default: Date.now },
    cerrada: { type: Date, default: null },
});
OfertaMercadoSchema.index({ guildId: 1, estado: 1, creada: -1 });
OfertaMercadoSchema.index({ vendedor: 1, guildId: 1, estado: 1 });
OfertaMercadoSchema.index({ cerrada: 1 }, { expireAfterSeconds: 30 * 86400, partialFilterExpression: { cerrada: { $type: 'date' } } });

module.exports = mongoose.model('OfertaMercado', OfertaMercadoSchema);

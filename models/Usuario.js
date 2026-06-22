const mongoose = require('mongoose');

// Subdocumento: una entrada del inventario = una referencia a un Item + cuántos tiene.
// { _id: false } porque no necesitamos un id propio para cada línea del inventario.
const InventarioItemSchema = new mongoose.Schema({
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    cantidad: { type: Number, default: 1, min: 1 },
}, { _id: false });

// Economía GLOBAL del usuario (su oro es suyo en todos los servidores donde esté Sokyo).
const UsuarioSchema = new mongoose.Schema({
    discordId: { type: String, required: true, unique: true, index: true },
    balance: { type: Number, default: 0, min: 0 }, // oro
    inventory: { type: [InventarioItemSchema], default: [] },
    // Recompensa diaria (/daily): cuándo la reclamó por última vez y su racha actual.
    ultimoDaily: { type: Date, default: null },
    rachaDaily: { type: Number, default: 0 },
    // Boost de XP activo (objeto con efecto xpBoost). Global por usuario.
    boostXp: {
        multiplicador: { type: Number, default: 1 },
        expiraEn: { type: Date, default: null },
    },
}, { timestamps: true });

module.exports = mongoose.model('Usuario', UsuarioSchema);

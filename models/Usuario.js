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
    // --- COSMÉTICOS (se compran con oro; lógica en utils/cosmeticos.js) ---
    // DORMIDO: la base está lista pero aún no se expone en comandos ni panel,
    // a la espera de cerrar la economía. Por defecto vacío: no afecta a nada.
    cosmeticos: { type: [String], default: [] }, // ids de cosméticos en propiedad
    cosmeticosEquipados: {
        tarjeta: { type: String, default: null },     // estilo de tarjeta de rango equipado
        colorNombre: { type: String, default: null }, // color de nombre (hex) equipado
        insignia: { type: String, default: null },    // insignia/emoji equipado
    },
}, { timestamps: true });

module.exports = mongoose.model('Usuario', UsuarioSchema);

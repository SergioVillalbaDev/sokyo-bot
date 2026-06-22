const mongoose = require('mongoose');

// Un objeto del catálogo de la tienda.
const ItemSchema = new mongoose.Schema({
    // Identificador "legible" y único (ej: "pocion_vida"). Útil para referenciarlo
    // a mano o desde comandos. NO es el _id de Mongo (ese sigue existiendo aparte).
    itemId: { type: String, required: true, unique: true, lowercase: true, trim: true },
    nombre: { type: String, required: true, trim: true },
    descripcion: { type: String, default: '' },
    precio: { type: Number, required: true, min: 0 }, // en "oro"
    imageUrl: { type: String, default: null },
    // Limitamos el tipo con enum: la BD rechaza valores no válidos por nosotros.
    tipo: { type: String, enum: ['consumible', 'equipo', 'material'], default: 'material' },
    // "Activo en tienda": el borrado lógico. Nunca borramos un ítem que alguien
    // ya tiene en su inventario; lo desactivamos (activo: false) y deja de venderse.
    activo: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Item', ItemSchema);

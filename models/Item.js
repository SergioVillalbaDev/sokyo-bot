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
    // Rareza (para el filtrado y el color de la carta en la tienda).
    rareza: { type: String, enum: ['comun', 'raro', 'epico', 'legendario'], default: 'comun' },
    // Unidades disponibles. null = ilimitado (STOCK ∞). Si llega a 0, se agota.
    stock: { type: Number, default: null, min: 0 },
    // Efecto al USAR el objeto (Fase 2). 'ninguno' = objeto decorativo/coleccionable.
    //  · xpBoost → multiplica tu XP durante `duracionMin` (efecto global).
    //  · rol     → te da el rol `rolId` durante `duracionMin` (se usa en un servidor).
    efecto: {
        tipo: { type: String, enum: ['ninguno', 'xpBoost', 'rol'], default: 'ninguno' },
        multiplicador: { type: Number, default: 2 }, // para xpBoost (x2, x3…)
        duracionMin: { type: Number, default: 60 },  // para xpBoost y rol
        rolId: { type: String, default: null },       // para rol (id del rol de Discord)
    },
    // "Activo en tienda": el borrado lógico. Nunca borramos un ítem que alguien
    // ya tiene en su inventario; lo desactivamos (activo: false) y deja de venderse.
    activo: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Item', ItemSchema);

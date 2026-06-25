// ============================================================================
// COSMÉTICOS — segundo flujo de "gasto" de la economía: el miembro usa su ORO
// para desbloquear cosméticos (estilos de tarjeta de rango, colores de nombre,
// insignias) que luego equipa. Monetiza la PARTICIPACIÓN (retención), no al
// administrador; la monetización en € la cubren los planes Pro/Agencia.
//
// ⚠️ ESTADO: BASE LISTA, AÚN NO ACTIVADA. Toda la lógica (catálogo, compra
// atómica, equipar, listar) está aquí y probada, pero NO se llama todavía desde
// ningún comando ni endpoint, a la espera de cerrar la economía. Para activarlo
// luego: exponer `catalogo()`/`comprarCosmetico()`/`equiparCosmetico()` en un
// comando (p. ej. /cosmeticos) o en una vista del panel, y leer el equipado en
// la generación de la tarjeta de rango (utils/rankCard.js) y donde aplique.
//
// Compra ATÓMICA y a prueba de "doble gasto": el oro solo se descuenta si en ese
// mismo instante hay saldo suficiente y el usuario NO posee ya el cosmético
// (mismo patrón que utils/economia.js -> comprarItem).
// ============================================================================
const Usuario = require('../models/Usuario.js');

// Tipos de cosmético. Cada uno mapea a un campo de cosmeticosEquipados.
const TIPOS = ['tarjeta', 'colorNombre', 'insignia'];

// Catálogo curado. `valor` es lo que se guarda como equipado:
//  - tarjeta      -> clave de ESTILOS en utils/cardStyles.js
//  - colorNombre  -> color hex
//  - insignia     -> emoji
// Los estilos de tarjeta "básicos" (atardecer, oceano...) siguen siendo gratis;
// aquí van solo los que se desbloquean pagando oro.
const CATALOGO = [
    // Estilos de tarjeta premium (reutilizan estilos ya existentes).
    { id: 'tarjeta_galaxia', tipo: 'tarjeta', nombre: 'Tarjeta Galaxia', precio: 5000, valor: 'galaxia' },
    { id: 'tarjeta_aurora', tipo: 'tarjeta', nombre: 'Tarjeta Aurora', precio: 5000, valor: 'aurora' },
    { id: 'tarjeta_neon', tipo: 'tarjeta', nombre: 'Tarjeta Neón', precio: 7500, valor: 'neon' },
    { id: 'tarjeta_cosmos', tipo: 'tarjeta', nombre: 'Tarjeta Cosmos', precio: 7500, valor: 'cosmos' },
    { id: 'tarjeta_destello', tipo: 'tarjeta', nombre: 'Tarjeta Destello', precio: 10000, valor: 'destello' },
    // Colores de nombre (hex) para la tarjeta de rango.
    { id: 'color_oro', tipo: 'colorNombre', nombre: 'Nombre Dorado', precio: 3000, valor: '#FFD700' },
    { id: 'color_esmeralda', tipo: 'colorNombre', nombre: 'Nombre Esmeralda', precio: 3000, valor: '#2ECC71' },
    { id: 'color_rubi', tipo: 'colorNombre', nombre: 'Nombre Rubí', precio: 3000, valor: '#E74C3C' },
    // Insignias (emoji) para lucir en el perfil/tarjeta.
    { id: 'insignia_corona', tipo: 'insignia', nombre: 'Insignia Corona', precio: 4000, valor: '👑' },
    { id: 'insignia_estrella', tipo: 'insignia', nombre: 'Insignia Estrella', precio: 2000, valor: '⭐' },
    { id: 'insignia_rayo', tipo: 'insignia', nombre: 'Insignia Rayo', precio: 2000, valor: '⚡' },
];

const porId = (id) => CATALOGO.find((c) => c.id === id) || null;

// Catálogo completo (para pintar la tienda de cosméticos).
function catalogo() {
    return CATALOGO.map((c) => ({ ...c }));
}

// Asegura que el usuario existe (upsert) antes de operar con su oro.
async function asegurarUsuario(discordId) {
    await Usuario.updateOne({ discordId }, { $setOnInsert: { discordId } }, { upsert: true });
}

// Compra un cosmético con oro. Devuelve { ok, error?, cosmetico?, balance? }.
async function comprarCosmetico(discordId, cosmeticoId) {
    const cos = porId(cosmeticoId);
    if (!cos) return { ok: false, error: 'Ese cosmético no existe.' };
    await asegurarUsuario(discordId);

    // PUERTA ATÓMICA: descuenta el oro solo si hay saldo suficiente y el usuario
    // no posee ya el cosmético. Si dos compras llegan a la vez, MongoDB serializa
    // este update: una pasa y la otra falla la condición.
    const actualizado = await Usuario.findOneAndUpdate(
        { discordId, balance: { $gte: cos.precio }, cosmeticos: { $ne: cos.id } },
        { $inc: { balance: -cos.precio }, $addToSet: { cosmeticos: cos.id } },
        { returnDocument: 'after' },
    );
    if (!actualizado) {
        // O no llega el oro, o ya lo tenía: distinguimos para dar buen mensaje.
        const u = await Usuario.findOne({ discordId });
        if (u && (u.cosmeticos || []).includes(cos.id)) return { ok: false, error: 'Ya tienes este cosmético.' };
        return { ok: false, error: 'No tienes oro suficiente.' };
    }
    return { ok: true, cosmetico: cos, balance: actualizado.balance };
}

// Equipa un cosmético que el usuario ya posee. Devuelve { ok, error?, cosmetico? }.
async function equiparCosmetico(discordId, cosmeticoId) {
    const cos = porId(cosmeticoId);
    if (!cos) return { ok: false, error: 'Ese cosmético no existe.' };
    const u = await Usuario.findOne({ discordId });
    if (!u || !(u.cosmeticos || []).includes(cos.id)) return { ok: false, error: 'No tienes ese cosmético.' };
    await Usuario.updateOne({ discordId }, { $set: { [`cosmeticosEquipados.${cos.tipo}`]: cos.valor } });
    return { ok: true, cosmetico: cos };
}

// Quita el cosmético equipado de un tipo (vuelve al de por defecto).
async function desequiparTipo(discordId, tipo) {
    if (!TIPOS.includes(tipo)) return { ok: false, error: 'Tipo de cosmético no válido.' };
    await Usuario.updateOne({ discordId }, { $set: { [`cosmeticosEquipados.${tipo}`]: null } });
    return { ok: true };
}

// Cosméticos que posee el usuario (con su info de catálogo) + lo que lleva equipado.
async function cosmeticosDe(discordId) {
    const u = await Usuario.findOne({ discordId });
    const propios = (u && u.cosmeticos) || [];
    return {
        propios: propios.map(porId).filter(Boolean),
        equipados: (u && u.cosmeticosEquipados) || { tarjeta: null, colorNombre: null, insignia: null },
    };
}

module.exports = { TIPOS, CATALOGO, catalogo, comprarCosmetico, equiparCosmetico, desequiparTipo, cosmeticosDe };

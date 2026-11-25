// 📊 Qué se usa (1.34.0): cada interacción suma 1 a su contador del día (models/UsoFuncion.js), sin guardar quién.
// Se juntan en memoria y se guardan cada minuto (una escritura por contador, no por clic). El panel lo enseña en
// «Uso de las funciones» (lo que nadie usa, lo que más, los errores y dónde se para la gente en /empezar).
const pendiente = new Map(); // `${dia}|${guildId}|${clave}` → n
let temporizador = null;

function sumar(guildId, clave, n = 1) {
    if (!clave) return;
    const k = `${new Date().toISOString().slice(0, 10)}|${guildId || ''}|${String(clave).slice(0, 60)}`;
    pendiente.set(k, (pendiente.get(k) || 0) + n);
    if (!temporizador) { temporizador = setTimeout(guardar, 60000); temporizador.unref?.(); }
}
async function guardar() {
    temporizador = null;
    const lote = [...pendiente]; pendiente.clear();
    if (!lote.length) return;
    const UsoFuncion = require('../models/UsoFuncion.js');
    await UsoFuncion.bulkWrite(lote.map(([k, n]) => { const [dia, guildId, clave] = k.split('|'); return { updateOne: { filter: { dia, guildId: guildId || null, clave }, update: { $inc: { n }, $setOnInsert: { fecha: new Date() } }, upsert: true } }; }), { ordered: false }).catch(() => {});
}
// Qué cuenta una interacción: el comando (o la parte de la puerta) o el módulo del botón.
function apuntar(interaction) {
    if (!interaction.guildId) return;
    if (interaction.isChatInputCommand?.()) {
        const extra = interaction.options.getSubcommandGroup(false) || interaction.options.getSubcommand(false);
        sumar(interaction.guildId, `cmd:${interaction.commandName}${extra ? ` ${extra}` : ''}`);
        return;
    }
    const mod = require('./navegacion.js').moduloDe(interaction);
    if (mod) sumar(interaction.guildId, `mod:${mod.id}`);
    const id = interaction.customId || '';
    if (id.startsWith('menu:')) sumar(interaction.guildId, `menu:${id.split(':')[1]}`);
    if (id.startsWith('emp:')) sumar(interaction.guildId, `paso:${id.split(':')[1]}`);
}

module.exports = { sumar, guardar, apuntar };

// Gestiona el plan Premium de los servidores (solo para quien aloja el bot).
//
//   node scripts/premium.js <guildId> <días>   → activa Premium durante N días (0 = sin caducidad)
//   node scripts/premium.js <guildId> quitar   → vuelve al plan gratis
//   node scripts/premium.js lista              → muestra los servidores con Premium
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const ServidorConfig = require('../models/ServidorConfig.js');

async function main() {
    const [objetivo, valor] = process.argv.slice(2);
    if (!objetivo) {
        console.log('Uso:\n  node scripts/premium.js <guildId> <días>\n  node scripts/premium.js <guildId> quitar\n  node scripts/premium.js lista');
        return;
    }
    await mongoose.connect(process.env.MONGO_URI);

    if (objetivo === 'lista') {
        const lista = await ServidorConfig.find({ esPremium: true }).select('guildId premiumHasta').lean();
        if (lista.length === 0) console.log('Ningún servidor tiene Premium.');
        lista.forEach(s => console.log(`⭐ ${s.guildId} · ${s.premiumHasta ? `hasta ${new Date(s.premiumHasta).toLocaleDateString('es-ES')}` : 'sin caducidad'}`));
        return;
    }

    if (!/^\d{15,22}$/.test(objetivo)) throw new Error('El primer argumento debe ser el ID del servidor (botón derecho en el servidor → Copiar ID).');

    if (valor === 'quitar') {
        await ServidorConfig.updateOne({ guildId: objetivo }, { esPremium: false, premiumHasta: null });
        console.log(`✅ ${objetivo} vuelve al plan gratis.`);
        return;
    }

    const dias = Number(valor);
    if (!Number.isFinite(dias) || dias < 0) throw new Error('Indica los días de Premium (0 = sin caducidad) o "quitar".');
    const premiumHasta = dias === 0 ? null : new Date(Date.now() + dias * 86400000);
    await ServidorConfig.updateOne({ guildId: objetivo }, { $set: { esPremium: true, premiumHasta } }, { upsert: true });
    console.log(`⭐ Premium activado en ${objetivo} ${premiumHasta ? `hasta el ${premiumHasta.toLocaleDateString('es-ES')}` : 'sin caducidad'}.`);
}

main()
    .catch(e => { console.error('❌', e.message); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());

// ============================================================================
// Activa / desactiva el plan Premium de un servidor (campo esPremium).
//
// Uso (desde la raíz del proyecto):
//   node scripts/premium.js on              -> activa Premium en TODOS los servidores
//   node scripts/premium.js off             -> desactiva Premium en todos
//   node scripts/premium.js on <guildId>    -> activa Premium solo en ese servidor
//   node scripts/premium.js off <guildId>   -> desactiva Premium solo en ese servidor
//   node scripts/premium.js status          -> muestra el estado actual
//
// Lee MONGO_URI del archivo .env (el mismo que usa el bot).
// ============================================================================
require('dotenv').config();
const mongoose = require('mongoose');
const ServidorConfig = require('../models/ServidorConfig.js');

const accion = (process.argv[2] || 'status').toLowerCase();
const guildId = process.argv[3] || null;

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('🔴 Falta MONGO_URI en el .env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log('🟢 Conectado a MongoDB');

  const filtro = guildId ? { guildId } : {};

  if (accion === 'status') {
    const servidores = await ServidorConfig.find(filtro);
    if (servidores.length === 0) console.log('ℹ️  No hay servidores configurados todavía.');
    servidores.forEach((s) =>
      console.log(`• ${s.guildId} -> ${s.esPremium ? '⭐ Premium' : 'Free'}${s.premiumHasta ? ` (hasta ${s.premiumHasta.toLocaleDateString('es-ES')})` : ''}`)
    );
  } else if (accion === 'on' || accion === 'off') {
    const esPremium = accion === 'on';
    // Mantiene `plan` coherente con el nuevo sistema de tramos. Para activar el
    // tramo Agencia a mano: edita el documento o pasa por la pasarela de pago.
    const cambios = esPremium ? { esPremium: true, plan: 'pro' } : { esPremium: false, plan: 'free' };
    const res = await ServidorConfig.updateMany(filtro, cambios);
    console.log(`✅ Premium ${esPremium ? 'ACTIVADO' : 'desactivado'} en ${res.modifiedCount} servidor(es).`);
  } else {
    console.log('Uso: node scripts/premium.js on|off|status [guildId]');
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error('🔴 Error:', err.message);
  process.exit(1);
});

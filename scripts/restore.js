// ============================================================================
// Restaura una copia de seguridad creada por scripts/backup.js.
//
// ⚠️  DESTRUCTIVO: reemplaza el contenido de cada colección por el de la copia.
// Por seguridad, sin la palabra CONFIRMAR solo te ENSEÑA lo que haría (simula).
//
// Uso (desde la raíz del proyecto):
//   node scripts/restore.js backups/sokyo-2026-06-27_041500.json.gz
//        -> SIMULACRO: muestra qué colecciones y cuántos documentos restauraría.
//
//   node scripts/restore.js backups/sokyo-2026-06-27_041500.json.gz CONFIRMAR
//        -> RESTAURA DE VERDAD (borra cada colección y reinserta la copia).
//
// Lee MONGO_URI del .env.
// ============================================================================
require('dotenv').config();
const mongoose = require('mongoose');
const { EJSON } = require('bson');
const zlib = require('zlib');
const fs = require('fs');

const archivo = process.argv[2];
const confirmar = (process.argv[3] || '').toUpperCase() === 'CONFIRMAR';

(async () => {
  if (!archivo) {
    console.error('Uso: node scripts/restore.js <archivo.json.gz> [CONFIRMAR]');
    process.exit(1);
  }
  if (!process.env.MONGO_URI) {
    console.error('🔴 Falta MONGO_URI en el .env');
    process.exit(1);
  }
  if (!fs.existsSync(archivo)) {
    console.error(`🔴 No existe el archivo: ${archivo}`);
    process.exit(1);
  }

  const texto = zlib.gunzipSync(fs.readFileSync(archivo)).toString('utf8');
  const copia = EJSON.parse(texto);
  const colecciones = Object.keys(copia.datos || {});

  console.log(`📦 Copia del ${copia.meta?.fecha || '¿?'} · ${colecciones.length} colecciones · ${copia.meta?.documentos ?? '?'} documentos`);

  if (!confirmar) {
    console.log('\n🟡 SIMULACRO (no se ha tocado nada). Restauraría:');
    for (const nombre of colecciones) {
      console.log(`   • ${nombre}: ${copia.datos[nombre].length} documentos`);
    }
    console.log('\nPara restaurar DE VERDAD, repite el comando añadiendo CONFIRMAR al final.');
    process.exit(0);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('🟢 Conectado a MongoDB');
  const db = mongoose.connection.db;

  for (const nombre of colecciones) {
    const docs = copia.datos[nombre];
    await db.collection(nombre).deleteMany({});
    if (docs.length) await db.collection(nombre).insertMany(docs);
    console.log(`   ↻ ${nombre}: ${docs.length} documentos restaurados`);
  }

  await mongoose.disconnect();
  console.log('✅ Restauración completada.');
  process.exit(0);
})().catch((err) => {
  console.error('🔴 Error en la restauración:', err.message);
  process.exit(1);
});

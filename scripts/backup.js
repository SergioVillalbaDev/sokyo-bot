// ============================================================================
// Copia de seguridad de TODA la base de datos a un único archivo comprimido.
//
// Pensado para el plan gratuito (M0) de MongoDB Atlas, que NO ofrece backups
// automáticos. Este script los suple: vuelca todas las colecciones a un
// archivo .json.gz con fecha, borra las copias más viejas (rotación) y, si
// configuras un webhook de Discord, te avisa de cómo ha ido.
//
// Uso (desde la raíz del proyecto):
//   node scripts/backup.js
//
// Lee del .env:
//   MONGO_URI                 (obligatorio) la misma cadena que usa el bot.
//   BACKUP_DIR                 (opcional) carpeta destino. Por defecto ./backups
//   BACKUP_RETENCION_DIAS      (opcional) días que se conservan. Por defecto 14.
//   BACKUP_WEBHOOK_URL         (opcional) webhook de Discord para el aviso.
//
// Para restaurar una copia usa scripts/restore.js.
// ============================================================================
require('dotenv').config();
const mongoose = require('mongoose');
const { EJSON } = require('bson');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const RETENCION_DIAS = Number(process.env.BACKUP_RETENCION_DIAS) || 14;
const WEBHOOK = process.env.BACKUP_WEBHOOK_URL || null;

// Construye una marca de tiempo legible para el nombre del archivo:
// 2026-06-27_041500  (año-mes-día_horaminutosegundo, hora local de la Pi).
function sello() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// Avisa por Discord (si hay webhook). Nunca tumba el backup si el aviso falla.
async function avisar(texto) {
  if (!WEBHOOK) return;
  try {
    await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: texto }),
    });
  } catch {
    /* el aviso es secundario: si falla, no pasa nada */
  }
}

// Borra las copias .json.gz cuya antigüedad supere RETENCION_DIAS.
function rotar() {
  const limite = Date.now() - RETENCION_DIAS * 24 * 60 * 60 * 1000;
  let borradas = 0;
  for (const f of fs.readdirSync(DIR)) {
    if (!f.startsWith('sokyo-') || !f.endsWith('.json.gz')) continue;
    const ruta = path.join(DIR, f);
    if (fs.statSync(ruta).mtimeMs < limite) {
      fs.unlinkSync(ruta);
      borradas++;
    }
  }
  return borradas;
}

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('🔴 Falta MONGO_URI en el .env');
    process.exit(1);
  }

  fs.mkdirSync(DIR, { recursive: true });

  await mongoose.connect(process.env.MONGO_URI);
  console.log('🟢 Conectado a MongoDB');

  const db = mongoose.connection.db;
  const colecciones = (await db.listCollections().toArray())
    .map((c) => c.name)
    .filter((n) => !n.startsWith('system.'));

  const datos = {};
  let totalDocs = 0;
  for (const nombre of colecciones) {
    const docs = await db.collection(nombre).find({}).toArray();
    datos[nombre] = docs;
    totalDocs += docs.length;
    console.log(`   • ${nombre}: ${docs.length} documentos`);
  }

  // EJSON conserva los tipos de Mongo (ObjectId, Date, etc.) para que la
  // restauración sea fiel. JSON normal los convertiría en texto.
  const contenido = EJSON.stringify(
    { meta: { fecha: new Date().toISOString(), colecciones: colecciones.length, documentos: totalDocs }, datos },
    { relaxed: false }
  );

  const archivo = path.join(DIR, `sokyo-${sello()}.json.gz`);
  fs.writeFileSync(archivo, zlib.gzipSync(Buffer.from(contenido, 'utf8')));

  const mb = (fs.statSync(archivo).size / 1024 / 1024).toFixed(2);
  const borradas = rotar();

  await mongoose.disconnect();

  const resumen = `✅ Backup OK · ${totalDocs} docs en ${colecciones.length} colecciones · ${mb} MB · ${path.basename(archivo)}${borradas ? ` · ${borradas} copia(s) vieja(s) borrada(s)` : ''}`;
  console.log(resumen);
  await avisar(`🟢 **Sokyo** ${resumen}`);
  process.exit(0);
})().catch(async (err) => {
  console.error('🔴 Error en el backup:', err.message);
  await avisar(`🔴 **Sokyo** Fallo el backup: ${err.message}`);
  process.exit(1);
});

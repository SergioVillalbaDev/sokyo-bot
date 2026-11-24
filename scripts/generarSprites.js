// Genera los dibujos de las mascotas (utils/sprites.js) en WebP para el panel web:
// sokyo-panelFRONTEND/public/sprites/<id>.webp (compañeros, de adultos), srv-<especie>-<etapa>.webp
// (mascota del servidor), jefe-<id>.webp y huevo.png. Ejecutar al cambiar un dibujo:
//   node scripts/generarSprites.js
const fs = require('fs');
const path = require('path');
const SPR = require('../utils/sprites.js');
const K = require('../utils/cofresNucleo.js');

const DIR = path.join(__dirname, '..', 'sokyo-panelFRONTEND', 'public', 'sprites');
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
const guardar = (nombre, buf) => fs.writeFileSync(path.join(DIR, `${nombre}.webp`), buf);
let n = 0;
for (const id of Object.keys(K.COMPANEROS)) {
    guardar(id, SPR.png(id, { etapa: 2, humor: 'feliz' }, 192, 'webp')); n++;
    guardar(`${id}-brillante`, SPR.png(id, { etapa: 2, humor: 'feliz', variante: 'brillante' }, 192, 'webp')); n++;
}
for (const esp of Object.keys(SPR.ESPECIES_SERVIDOR)) for (const etapa of [0, 1, 2]) { guardar(`srv-${esp}-${etapa}`, SPR.png(`srv:${esp}`, { etapa, humor: 'normal' }, 256, 'webp')); n++; }
for (const j of Object.keys(SPR.JEFES)) { guardar(`jefe-${j}`, SPR.png(`jefe:${j}`, { etapa: 2, humor: 'enfadado' }, 256, 'webp')); n++; }
const { createCanvas } = require('@napi-rs/canvas');
const c = createCanvas(SPR.TAM, SPR.TAM);
SPR.huevo(c.getContext('2d'), { manchas: '#c4b5fd' });
guardar('huevo', c.toBuffer('image/webp', 90)); n++;
console.log(`${n} dibujos en ${DIR}`);

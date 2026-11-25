// 1.34.0: los textos del bot y del panel nombran comandos («/jugar cofre abrir», «/menu»…). Esta prueba comprueba que
// cada uno existe de verdad con ese nombre (en español o en inglés), y que ya no se nombra ninguno de los que se
// metieron dentro de las puertas (/cofre, /granja…). Así no queda ningún «escribe /x» que no funciona.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const P = require('../utils/puertas.js');
const C = require('../utils/catalogo.js');

const raiz = path.join(__dirname, '..');
function rutas() {
    const ok = new Set(); const grupos = new Set();
    const lista = [...[...P.comandos()].map(([, m]) => m.data.toJSON()), ...Object.keys(P.PUERTAS).map((p) => P.jsonPuerta(p))];
    for (const j of lista) {
        const nombres = [j.name, j.name_localizations?.['es-ES']].filter(Boolean);
        for (const n of nombres) ok.add(`/${n}`);
        for (const o of j.options || []) {
            if (o.type !== 1 && o.type !== 2) continue;
            const subs = [o.name, o.name_localizations?.['es-ES']].filter(Boolean);
            for (const n of nombres) for (const s of subs) {
                ok.add(`/${n} ${s}`);
                if (o.type === 2) { grupos.add(`/${n} ${s}`); for (const x of o.options || []) for (const y of [x.name, x.name_localizations?.['es-ES']].filter(Boolean)) ok.add(`/${n} ${s} ${y}`); }
            }
        }
    }
    return { ok, grupos };
}
const archivos = () => [
    ...['utils', 'slash', 'comandos', 'events', 'api'].flatMap((d) => fs.readdirSync(path.join(raiz, d), { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => path.join(d, f))),
    'sokyo-panelFRONTEND/src/i18n/locales/es.panel.js', 'sokyo-panelFRONTEND/src/i18n/locales/en.panel.js', 'sokyo-panelFRONTEND/src/i18n/locales/es.js', 'sokyo-panelFRONTEND/src/i18n/locales/en.js',
].filter((f) => !['utils/novedades.js'].includes(f));

test('lo que nombran los textos dentro de las puertas existe', () => {
    const { ok, grupos } = rutas();
    const puertas = Object.values(P.PUERTAS).flatMap((p) => [p.es, p.en]).join('|');
    const re = new RegExp(`(?<=[\`\\s(«"*'>])/(${puertas})((?: [a-z0-9ñáéíóú-]+){0,2})`, 'g');
    const malos = [];
    for (const f of archivos()) {
        const src = fs.readFileSync(path.join(raiz, f), 'utf8');
        for (const m of src.matchAll(re)) {
            const palabras = m[2].trim().split(' ').filter(Boolean);
            const dos = `/${m[1]}${palabras[0] ? ` ${palabras[0]}` : ''}`;
            if (!palabras.length) continue;
            if (!ok.has(dos)) { malos.push(`${f}: ${dos}`); continue; }
            if (grupos.has(dos) && !ok.has(`${dos} ${palabras[1] || ''}`.trim())) malos.push(`${f}: ${dos} ${palabras[1] || '(falta el subcomando)'}`);
        }
    }
    assert.deepStrictEqual([...new Set(malos)], []);
});

test('ya no se nombra ningún comando que ahora va dentro de una puerta', () => {
    const viejos = [...C.EN_PUERTA].flatMap((n) => { const j = P.comandos().get(n).data.toJSON(); return [j.name, j.name_localizations?.['es-ES']].filter(Boolean); });
    const re = new RegExp(`(?<=[\`\\s(«"*'>])/(${viejos.join('|')})\\b(?![-/.])`, 'g');
    const malos = [];
    for (const f of archivos()) {
        if (['utils/catalogo.js', 'utils/puertas.js'].includes(f)) continue;
        const src = fs.readFileSync(path.join(raiz, f), 'utf8');
        for (const m of src.matchAll(re)) malos.push(`${f}: /${m[1]}`);
    }
    assert.deepStrictEqual([...new Set(malos)], []);
});

test('los pasos del catálogo nombran comandos que existen', () => {
    const { ok } = rutas();
    const malos = [];
    for (const m of C.MODULOS) for (const l of [...m.pasos.es, ...m.pasos.en]) {
        for (const x of l.matchAll(/`(\/[^`]+)`/g)) {
            const pal = x[1].split(' ').filter((w) => !w.includes(':') && !w.startsWith('@'));
            let hasta = '';
            for (const w of pal) { const c = hasta ? `${hasta} ${w}` : w; if (ok.has(c)) hasta = c; else break; }
            if (!hasta || hasta.split(' ').length < Math.min(pal.length, 3) && !ok.has(pal.join(' '))) {
                if (!ok.has(pal.slice(0, hasta.split(' ').length + 1).join(' ')) && hasta.split(' ').length < pal.length) malos.push(`${m.id}: ${x[1]}`);
            }
        }
    }
    assert.deepStrictEqual(malos, []);
});

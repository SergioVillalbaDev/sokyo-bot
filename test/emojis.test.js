// 1.34.1: Discord rechaza el mensaje ENTERO si un botón o una opción de un menú lleva un emoji que no
// reconoce (pasó con 🂠 en el Baccarat: la guía del casino daba «Algo ha fallado» siempre). Este test
// revisa todos los emojis escritos en el código y los de los datos que acaban en botones y menús.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
// Vale un emoji de la lista oficial (RGI) o uno propio del servidor <:nombre:id>.
const valido = (e) => /^\p{RGI_Emoji}$/v.test(e) || /^<a?:\w+:\d+>$/.test(e);

test('los emojis escritos en botones y menús son emojis de verdad', () => {
    const malos = [];
    const re = /(?:setEmoji\(\s*|emoji:\s*)(['`])([^'`$\\]{1,16})\1/g;
    for (const dir of ['utils', 'slash', 'comandos', 'events', 'api', 'api/routes']) {
        const carpeta = path.join(RAIZ, dir);
        if (!fs.existsSync(carpeta)) continue;
        for (const f of fs.readdirSync(carpeta).filter((x) => x.endsWith('.js'))) {
            const s = fs.readFileSync(path.join(carpeta, f), 'utf8');
            let m;
            // Las palabras normales (p. ej. «emoji: 'str'», un tipo de dato) no son emojis: se saltan.
            while ((m = re.exec(s))) if (/[^\x00-\x7F]/.test(m[2]) && !valido(m[2])) malos.push(`${dir}/${f}:${s.slice(0, m.index).split('\n').length} ${m[2]}`);
        }
    }
    assert.deepEqual(malos, [], `Emojis que Discord no acepta:\n${malos.join('\n')}`);
});

test('los emojis de los datos (juegos, compañeros, logros, misiones…) son emojis de verdad', () => {
    const malos = [];
    const visto = new Set();
    const recorrer = (v, donde, prof = 0) => {
        if (!v || typeof v !== 'object' || visto.has(v) || prof > 4) return;
        visto.add(v);
        for (const [k, x] of Object.entries(v)) {
            if (k === 'emoji' && typeof x === 'string' && x && !valido(x)) malos.push(`${donde}.${k} = ${x}`);
            else if (x && typeof x === 'object') recorrer(x, `${donde}.${k}`, prof + 1);
        }
    };
    for (const m of ['casino', 'casinoAyuda', 'casinoNucleo', 'cofresNucleo', 'compisNucleo', 'granjaNucleo', 'paseNucleo', 'cartasNucleo', 'casinoExtra']) {
        const ruta = path.join(RAIZ, 'utils', `${m}.js`);
        if (fs.existsSync(ruta)) recorrer(require(ruta), m);
    }
    assert.deepEqual(malos, [], `Emojis que Discord no acepta:\n${malos.join('\n')}`);
});

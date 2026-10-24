// ============================================================================
// Tests de la adaptación de los textos de fábrica al idioma del servidor
// (utils/textosPorDefecto.js): solo se cambian los que siguen tal cual venían.
// ============================================================================
const { describe, it } = require('node:test');
const assert = require('node:assert');

const { cambiosParaIdioma, nombreUrgencia, TEXTOS, MOTIVOS } = require('../utils/textosPorDefecto.js');

const deFabrica = () => ({
    mensajeSoporteTitulo: '🎫 Support is open',
    textoBoton: '📩 Open a ticket',
    verificacion: { titulo: '🔒 Verification', textoBoton: '✅ Verify me' },
    bienvenida: { contenido: 'Welcome {mention} to **{server}**! 🎉 We are now {members} members.' },
    motivos: MOTIVOS.map(([en], i) => ({ nombre: en, urgencia: ['Normal', 'High', 'Low'][i] })),
});

describe('cambiosParaIdioma', () => {
    it('pasa al español los textos de fábrica, también los anidados', () => {
        const c = cambiosParaIdioma(deFabrica(), 'es');
        assert.strictEqual(c.mensajeSoporteTitulo, '🎫 El soporte está abierto');
        assert.strictEqual(c.textoBoton, '📩 Abrir un ticket');
        assert.strictEqual(c['verificacion.textoBoton'], '✅ Verificarme');
        assert.match(c['bienvenida.contenido'], /Te damos la bienvenida/);
    });
    it('traduce los motivos de fábrica conservando su urgencia', () => {
        const c = cambiosParaIdioma(deFabrica(), 'es');
        assert.deepStrictEqual(c.motivos, [
            { nombre: 'Soporte general', urgencia: 'Normal' },
            { nombre: 'Reportar a un usuario', urgencia: 'High' },
            { nombre: 'Donaciones', urgencia: 'Low' },
        ]);
    });
    it('no toca lo que el dueño ha personalizado', () => {
        const cfg = deFabrica();
        cfg.textoBoton = '🛟 Pide ayuda aquí';
        cfg.motivos[0].nombre = 'Bugs del juego';
        const c = cambiosParaIdioma(cfg, 'es');
        assert.ok(!('textoBoton' in c));
        assert.ok(!('motivos' in c));
    });
    it('vuelve al inglés si se cambia de idioma otra vez', () => {
        const es = deFabrica();
        Object.entries(cambiosParaIdioma(es, 'es')).forEach(([ruta, v]) => {
            const partes = ruta.split('.');
            let o = es;
            for (const k of partes.slice(0, -1)) o = o[k];
            o[partes.at(-1)] = v;
        });
        const c = cambiosParaIdioma(es, 'en');
        assert.strictEqual(c.textoBoton, '📩 Open a ticket');
        assert.strictEqual(c.motivos[0].nombre, 'General support');
    });
    it('no propone nada si ya está en el idioma pedido', () => {
        assert.deepStrictEqual(cambiosParaIdioma(deFabrica(), 'en'), {});
    });
    it('cada texto tiene sus dos versiones distintas', () => {
        for (const [ruta, en, es] of TEXTOS) assert.ok(en && es && en !== es, ruta);
    });
});

describe('nombreUrgencia', () => {
    it('traduce las urgencias de fábrica solo en español', () => {
        assert.strictEqual(nombreUrgencia('es', 'High'), 'Alta');
        assert.strictEqual(nombreUrgencia('en', 'High'), 'High');
        assert.strictEqual(nombreUrgencia('es', 'Crítica VIP'), 'Crítica VIP');
    });
});

describe('textoDeFabrica', () => {
    const { textoDeFabrica } = require('../utils/textosPorDefecto.js');
    it('da el texto de fábrica del idioma pedido (inglés por defecto)', () => {
        assert.strictEqual(textoDeFabrica('verificacion.textoBoton', 'es'), '✅ Verificarme');
        assert.strictEqual(textoDeFabrica('verificacion.textoBoton', 'en'), '✅ Verify me');
        assert.strictEqual(textoDeFabrica('embudoAB.varianteB.textoBoton', undefined), '🎉 Join');
    });
    it('lo que rellena se reconoce después como texto de fábrica', () => {
        const cfg = { embudoAB: { varianteA: { titulo: textoDeFabrica('embudoAB.varianteA.titulo', 'es') } } };
        assert.strictEqual(cambiosParaIdioma(cfg, 'en')['embudoAB.varianteA.titulo'], '📋 Welcome — Read the rules');
    });
});

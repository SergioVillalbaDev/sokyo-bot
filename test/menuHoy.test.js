// 2.3.0: «📅 Hoy» en /menu (utils/menu.js): qué se ve, qué botones salen y qué se recoge de golpe.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const M = require('../utils/menu.js');

const HORA = 3600000;
const base = (extra = {}) => ({
    abiertas: new Set(['base', 'primerDiario', 'dosDias', 'conMascota']),
    equipada: { id: 'gato', nombre: 'Mimi', nombreEn: 'Mimi', emoji: '🐱' },
    granja: { oro: 120, lleno: false, porHora: 20 },
    jefe: null,
    hoy: {
        diario: { listo: true, cuando: Date.now() },
        carta: { listo: true, cuando: Date.now() + HORA },
        casino: { listo: true, cuando: Date.now(), canalId: 'CAS', guildId: 'G' },
        voto: { listo: true, cuando: Date.now() },
        cuidar: { listo: true },
    },
    ...extra,
});
const ids = (b) => b.map((x) => x.data.custom_id || x.data.url);

describe('menú: Hoy', () => {
    it('lista lo de hoy con ✅/⬜ y cuenta lo hecho', () => {
        const e = base(); e.hoy.diario.listo = false;
        const h = M.lineasHoy(e, 'es');
        assert.ok(h.lineas.some((l) => l.startsWith('✅') && l.includes('Oro diario')));
        assert.ok(h.lineas.some((l) => l.startsWith('⬜') && l.includes('Carta gratis')));
        assert.match(h.titulo, /1\/\d/);
    });
    it('«Recoger todo» junta oro, carta y granja; la tirada y el voto van aparte', () => {
        const b = M.botonesHoy(base(), 'U', 'es', { clientId: 'BOT', canalId: 'CAS' });
        const l = ids(b);
        assert.ok(l.includes('menu:hoy:todo:U'));
        assert.ok(!l.includes('menu:hoy:diario:U'), 'no se repite lo que ya hace «Recoger todo»');
        assert.ok(l.includes('menu:a:casino:diaria:U'));
        assert.ok(l.some((x) => String(x).startsWith('https://')), 'votar es un enlace');
        assert.ok(b.length <= 5);
        assert.deepStrictEqual(M.recogibles(base()), ['diario', 'carta', 'granja']);
    });
    it('con una sola cosa, su botón directo', () => {
        const e = base({ granja: { oro: 0 } }); e.hoy.carta.listo = false;
        assert.ok(ids(M.botonesHoy(e, 'U', 'es')).includes('menu:hoy:diario:U'));
    });
    it('fuera del canal del casino, la tirada lleva al casino', () => {
        const b = M.botonesHoy(base(), 'U', 'es', { canalId: 'OTRO' });
        assert.ok(ids(b).includes('https://discord.com/channels/G/CAS'));
    });
    it('no enseña lo que aún no tiene desbloqueado', () => {
        const e = base({ abiertas: new Set(['base']) });
        const h = M.lineasHoy(e, 'es').lineas.join('\n');
        assert.ok(!h.includes('Carta gratis') && !h.includes('casino'));
        assert.deepStrictEqual(M.recogibles(e), ['diario', 'granja']);
        assert.ok(!ids(M.botonesHoy(e, 'U', 'es')).includes('menu:a:casino:diaria:U'));
    });
    it('lo ya hecho en /diario no sale', () => {
        const l = ids(M.botonesHoy(base(), 'U', 'es', { excluir: ['diario', 'voto'] }));
        assert.ok(!l.some((x) => String(x).includes('diario:U')) && !l.some((x) => String(x).startsWith('https://')));
    });
});

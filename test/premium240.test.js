// 2.4.0: perfil del bot por servidor (Pro), /premium y la copia de seguridad automática.
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
console.log = () => {}; // los tests no escriben por stdout
const ServidorConfig = require('../models/ServidorConfig.js');
const P = require('../utils/perfilBot.js');

const PNG = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48]).toString('base64')}`;
function servidor() {
    const llamadas = [];
    const guild = {
        id: 'G', client: { rest: { patch: async (ruta, { body }) => { llamadas.push({ ruta, body }); return {}; } }, user: { username: 'Sokyo', displayAvatarURL: () => 'sokyo.png' } },
        members: { me: { nickname: null, avatar: null, permissions: { has: () => true } }, fetchMe: async () => null },
    };
    return { guild, llamadas };
}
const PRO = { plan: 'pro', esPremium: true, premiumHasta: new Date(Date.now() + 86400000) };

describe('perfil del bot', () => {
    beforeEach(() => { P._reiniciar(); ServidorConfig.updateOne = async () => ({}); });
    it('el apodo es gratis; la foto, el banner y la descripción, de Pro', async () => {
        const { guild, llamadas } = servidor();
        assert.ok((await P.aplicar(guild, {}, { apodo: 'Nébula' })).ok);
        assert.deepStrictEqual(llamadas[0].body, { nick: 'Nébula' });
        P._reiniciar();
        const r = await P.aplicar(guild, {}, { avatar: PNG });
        assert.strictEqual(r.codigo, 'pro');
        assert.strictEqual(llamadas.length, 1);
    });
    it('con Pro manda la imagen y la descripción (recortada)', async () => {
        const { guild, llamadas } = servidor();
        const r = await P.aplicar(guild, PRO, { avatar: PNG, bio: 'x'.repeat(500) });
        assert.ok(r.ok, r.error);
        assert.match(llamadas[0].body.avatar, /^data:image\/png;base64,/);
        assert.strictEqual(llamadas[0].body.bio.length, P.BIO_MAX);
    });
    it('rechaza lo que no es una imagen y frena los cambios seguidos', async () => {
        const { guild } = servidor();
        assert.strictEqual((await P.aplicar(guild, PRO, { avatar: 'data:text/plain;base64,aG9sYQ==' })).codigo, 'noImagen');
        assert.ok((await P.aplicar(guild, PRO, { bio: 'hola' })).ok);
        assert.strictEqual((await P.aplicar(guild, PRO, { bio: 'otra' })).codigo, 'espera');
    });
    it('sin Pro, vuelve al perfil de Sokyo (y el apodo se queda)', async () => {
        const { guild, llamadas } = servidor();
        const orig = ServidorConfig.find;
        ServidorConfig.find = () => ({ lean: async () => [{ guildId: 'G', perfilBot: { avatar: true } }, { guildId: 'H', ...PRO, perfilBot: { avatar: true } }] });
        const n = await P.quitarSinPro({ guilds: { cache: new Map([['G', guild]]) }, rest: guild.client.rest });
        ServidorConfig.find = orig;
        assert.strictEqual(n, 1);
        assert.deepStrictEqual(llamadas[0].body, { avatar: null, banner: null, bio: null });
    });
});

describe('/premium', () => {
    const { mensajePremium } = require('../slash/premium.js');
    it('dice el plan del servidor y promete que no es pagar para ganar', () => {
        const free = mensajePremium('es', {}, true);
        const txt = JSON.stringify(free.embeds[0].toJSON());
        assert.match(txt, /Free/);
        assert.match(txt, /pagar para ganar/);
        const pro = JSON.stringify(mensajePremium('en', PRO, false).embeds[0].toJSON());
        assert.match(pro, /Sokyo Pro/);
        assert.match(pro, /pay-to-win/);
    });
});

describe('copia de seguridad automática', () => {
    const CA = require('../utils/copiaAuto.js');
    it('solo toca si la última tiene más de 20 h (o no hay)', () => {
        const ahora = Date.now();
        assert.ok(CA.toca(null, ahora));
        assert.ok(!CA.toca(new Date(ahora - 3600000), ahora));
        assert.ok(CA.toca(new Date(ahora - 21 * 3600000), ahora));
    });
    it('encuentra la última copia de la carpeta', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'copias-'));
        fs.writeFileSync(path.join(dir, 'sokyo-a.json.gz'), 'x');
        fs.writeFileSync(path.join(dir, 'otra-cosa.txt'), 'x');
        assert.ok(CA.ultimaCopia(dir) instanceof Date);
        assert.strictEqual(CA.ultimaCopia(path.join(dir, 'no-existe')), null);
    });
});

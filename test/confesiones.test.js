// ============================================================================
// Tests de la 1.9.10: «Confesar escribiendo en el canal» (opcional). Lo que alguien
// escribe en el canal de confesar se borra y sale como confesión anónima; /confesar
// sigue igual. Sin Discord ni base de datos: solo la parte que decide qué es una
// confesión y los casos en los que no se llega a guardar nada.
// ============================================================================
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { MessageType } = require('discord.js');

const conf = require('../utils/confesiones.js');

const CANAL = '200000000000000003';
const OTRO = '200000000000000009';
const cfg = (c = {}) => ({ idioma: 'es', confesiones: { activo: true, canalId: CANAL, canalRevisionId: null, escribirEnCanal: true, canalEscrituraId: null, ...c } });

// Un mensaje de Discord de mentira: apunta si se borra y qué se le manda por privado.
function mensaje({ canal = CANAL, texto = 'Me da vergüenza decir que lloré con Toy Story 3', borrable = true, ...extra } = {}) {
    const m = {
        id: String(Math.random()).slice(2), guildId: 'G1', guild: { id: 'G1', channels: { cache: new Map() } }, channelId: canal,
        content: texto, type: MessageType.Default, system: false, webhookId: null,
        author: { id: 'U1', bot: false, privados: [], async send(p) { this.privados.push(p.content); } },
        borrado: false,
        async delete() { if (!borrable) throw new Error('Missing Permissions'); this.borrado = true; },
        ...extra,
    };
    return m;
}

describe('¿qué cuenta como confesión escrita? (esMensajeDeConfesion)', () => {
    it('un mensaje normal en el canal de las confesiones', () => {
        assert.strictEqual(conf.esMensajeDeConfesion(mensaje(), cfg()), true);
        assert.strictEqual(conf.esMensajeDeConfesion(mensaje({ type: MessageType.Reply }), cfg()), true);
    });
    it('con la opción apagada (o las confesiones apagadas) no: solo vale /confesar', () => {
        assert.strictEqual(conf.esMensajeDeConfesion(mensaje(), cfg({ escribirEnCanal: false })), false);
        assert.strictEqual(conf.esMensajeDeConfesion(mensaje(), cfg({ activo: false })), false);
        assert.strictEqual(conf.esMensajeDeConfesion(mensaje(), cfg({ canalId: null })), false);
        assert.strictEqual(conf.esMensajeDeConfesion(mensaje(), null), false);
    });
    it('con un canal aparte para escribir, solo ese', () => {
        assert.strictEqual(conf.esMensajeDeConfesion(mensaje({ canal: OTRO }), cfg({ canalEscrituraId: OTRO })), true);
        assert.strictEqual(conf.esMensajeDeConfesion(mensaje({ canal: CANAL }), cfg({ canalEscrituraId: OTRO })), false);
    });
    it('ni bots, ni webhooks, ni avisos de Discord (fijados, entradas…), ni otros canales', () => {
        assert.strictEqual(conf.esMensajeDeConfesion(mensaje({ author: { id: 'B', bot: true } }), cfg()), false);
        assert.strictEqual(conf.esMensajeDeConfesion(mensaje({ webhookId: 'W1' }), cfg()), false);
        assert.strictEqual(conf.esMensajeDeConfesion(mensaje({ system: true, type: MessageType.ChannelPinnedMessage }), cfg()), false);
        assert.strictEqual(conf.esMensajeDeConfesion(mensaje({ canal: OTRO }), cfg()), false);
    });
});

describe('pie de la confesión publicada (pieConfesion)', () => {
    it('dice cómo enviar la tuya según la opción', () => {
        assert.strictEqual(conf.pieConfesion(cfg()), 'Anónima · escribe /confesar para enviar la tuya');
        assert.strictEqual(conf.pieConfesion(cfg(), { aqui: true }), 'Anónima · escribe aquí o usa /confesar para enviar la tuya');
        assert.strictEqual(conf.pieConfesion(cfg(), { nombreCanal: 'confiesa-aqui' }), 'Anónima · escribe en #confiesa-aqui o usa /confesar para enviar la tuya');
        assert.strictEqual(conf.pieConfesion({ idioma: 'en' }, { aqui: true }), 'Anonymous · write here or use /confess to send yours');
    });
    it('canalEscrituraDe: el aparte, o el de las confesiones, o nada si está apagado', () => {
        assert.strictEqual(conf.canalEscrituraDe(cfg()), CANAL);
        assert.strictEqual(conf.canalEscrituraDe(cfg({ canalEscrituraId: OTRO })), OTRO);
        assert.strictEqual(conf.canalEscrituraDe(cfg({ escribirEnCanal: false })), null);
    });
});

describe('cuando no se publica (desdeMensaje)', () => {
    it('si el bot no puede borrar el mensaje, NO lo publica (se vería quién es) y se lo explica por privado', async () => {
        const m = mensaje({ borrable: false });
        await conf.desdeMensaje(m, cfg(), 'es');
        assert.strictEqual(m.borrado, false);
        assert.match(m.author.privados[0], /no lo he publicado/);
        assert.match(m.author.privados[0], /Gestionar mensajes/);
        // Y como no se ha borrado por confesión, el registro de borrados no lo ignora.
        assert.strictEqual(conf.esBorradoPorConfesion(m.id), false);
    });
    it('el borrado de una confesión no va al registro de mensajes borrados', async () => {
        const m = mensaje({ texto: '' });
        await conf.desdeMensaje(m, cfg(), 'es');
        assert.strictEqual(m.borrado, true);
        assert.strictEqual(conf.esBorradoPorConfesion(m.id), true);
    });
    it('solo una imagen o un sticker: se borra y se explica que es solo texto', async () => {
        const m = mensaje({ texto: '   ' });
        await conf.desdeMensaje(m, cfg(), 'es');
        assert.match(m.author.privados[0], /solo de texto/);
    });
    it('si no se ha podido borrar, no hay aviso en el canal (su mensaje ya se ve ahí)', async () => {
        const enCanal = [];
        const m = mensaje({ borrable: false, channel: { send: async (p) => { enCanal.push(p.content); } } });
        m.author.send = async () => { throw new Error('closed'); };
        await conf.desdeMensaje(m, cfg(), 'es');
        assert.strictEqual(enCanal.length, 0);
    });
    it('solo imagen y privados cerrados: aviso en el canal que no dice quién ni repite nada', async () => {
        const enCanal = [];
        const m = mensaje({ texto: '', channel: { send: async (p) => { enCanal.push(p.content); return { delete: async () => {} }; } } });
        m.author.send = async () => { throw new Error('closed'); };
        await conf.desdeMensaje(m, cfg(), 'en');
        assert.strictEqual(enCanal.length, 1);
        assert.match(enCanal[0], /^⚠️ Una confesión no se ha podido publicar/);
        assert.ok(!enCanal[0].includes('U1'));
    });
    it('demasiado larga: se le devuelve su texto por privado para que no lo pierda', async () => {
        const largo = 'a'.repeat(1600);
        const m = mensaje({ texto: largo });
        await conf.desdeMensaje(m, cfg(), 'en');
        assert.match(m.author.privados[0], /too long/);
        assert.ok(m.author.privados[0].includes('> aaaa'));
    });
});

// ============================================================================
// Tests del puente «!comando» → «/comando» (utils/puenteSlash.js, 1.9.11): todos
// los comandos de prefijo tienen su versión con barra y la ejecutan igual.
// Sin Discord: una interacción simulada con lo justo (options, reply, followUp…).
// ============================================================================
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');
const { crearSlashDesdePrefijo, argumentosDe, mensajeDesdeInteraccion } = require('../utils/puenteSlash.js');

// Interacción simulada: `datos` = lo que Discord manda en options.data.
function interaccion(datos = [], { sub = null } = {}) {
    const llamadas = [];
    const i = {
        id: 'i1', commandName: 'prueba', guildId: 'g1', channelId: 'c1', createdTimestamp: 1,
        user: { id: 'u1', username: 'pepe' }, member: { id: 'u1' }, guild: { id: 'g1' }, channel: { id: 'c1' },
        client: {}, replied: false, deferred: false, llamadas,
        options: {
            data: sub ? [{ name: sub, type: 1, options: datos }] : datos,
            get: (n) => (sub ? datos : datos).find((o) => o.name === n) || null,
            getSubcommand: () => sub,
        },
        async reply(p) { llamadas.push(['reply', p]); this.replied = true; },
        async editReply(p) { llamadas.push(['editReply', p]); },
        async followUp(p) { llamadas.push(['followUp', p]); return { id: 'f' }; },
        async fetchReply() { return { id: 'respuesta' }; },
        async deferReply() { llamadas.push(['deferReply']); this.deferred = true; },
        async deleteReply() { llamadas.push(['deleteReply']); },
    };
    return i;
}
const opUsuario = (name, id) => ({ name, type: 6, value: id, user: { id, username: `u${id}` }, member: { id } });

describe('opciones de Discord → argumentos de siempre', () => {
    it('usuario, rol, número y texto (el texto se parte en palabras)', () => {
        const i = interaccion([opUsuario('user', '42'), { name: 'role', type: 8, value: '7', role: { id: '7' } }, { name: 'amount', type: 4, value: 500 }, { name: 'reason', type: 3, value: 'spam  en el canal' }]);
        const args = argumentosDe(i, [{ tipo: 'usuario', nombre: 'user' }, { tipo: 'rol', nombre: 'role' }, { tipo: 'entero', nombre: 'amount' }, { tipo: 'texto', nombre: 'reason' }]);
        assert.deepStrictEqual(args, ['<@42>', '<@&7>', '500', 'spam', 'en', 'el', 'canal']);
    });
    it('con `junto` el texto va entero (p. ej. el nombre de un rol con espacios)', () => {
        const i = interaccion([{ name: 'name', type: 3, value: ' Equipo Rojo ' }, { name: 'color', type: 3, value: '#ff0000' }]);
        assert.deepStrictEqual(argumentosDe(i, [{ tipo: 'texto', nombre: 'name', junto: true }, { tipo: 'texto', nombre: 'color' }]), ['Equipo Rojo', '#ff0000']);
    });
    it('las opciones vacías no dejan huecos', () => {
        const i = interaccion([opUsuario('user', '42')]);
        assert.deepStrictEqual(argumentosDe(i, [{ tipo: 'usuario', nombre: 'user' }, { tipo: 'texto', nombre: 'duration' }, { tipo: 'texto', nombre: 'reason' }]), ['<@42>']);
    });
});

describe('el «mensaje» que recibe el comando', () => {
    it('trae las menciones y los adjuntos de las opciones', () => {
        const i = interaccion([opUsuario('user', '42'), { name: 'role', type: 8, value: '7', role: { id: '7' } }, { name: 'image', type: 11, value: 'a1', attachment: { id: 'a1', url: 'https://cdn/x.png' } }]);
        const m = mensajeDesdeInteraccion(i, ['<@42>']);
        assert.strictEqual(m.mentions.users.first().id, '42');
        assert.strictEqual(m.mentions.members.first().id, '42');
        assert.strictEqual(m.mentions.roles.first().id, '7');
        assert.strictEqual(m.attachments.first().url, 'https://cdn/x.png');
        assert.ok(m.mentions.users instanceof Collection);
        assert.strictEqual(m.author.id, 'u1');
        assert.strictEqual(m.content, '/prueba <@42>');
    });
    it('la primera respuesta contesta a la interacción y las siguientes son de seguimiento', async () => {
        const i = interaccion();
        const m = mensajeDesdeInteraccion(i, []);
        const r1 = await m.reply('hola');
        await m.reply({ content: 'otra' });
        assert.deepStrictEqual(i.llamadas.map((x) => x[0]), ['reply', 'followUp']);
        assert.deepStrictEqual(i.llamadas[0][1], { content: 'hola' });
        assert.strictEqual(r1.id, 'respuesta', 'devuelve el mensaje, por si el comando lo edita');
    });
    it('si ya se avisó «pensando…», la respuesta lo sustituye', async () => {
        const i = interaccion(); i.deferred = true;
        await mensajeDesdeInteraccion(i, []).reply('listo');
        assert.deepStrictEqual(i.llamadas.map((x) => x[0]), ['editReply']);
    });
    it('borrar o reaccionar no hace nada (no hay mensaje del usuario)', async () => {
        const m = mensajeDesdeInteraccion(interaccion(), []);
        await m.delete(); await m.react('👍');
    });
});

describe('crearSlashDesdePrefijo', () => {
    it('ejecuta el comando de prefijo con sus argumentos y la configuración', async () => {
        let visto;
        const prefijo = { name: 'test', async execute(msg, args, client, cfg) { visto = { args, cfg, autor: msg.author.id }; await msg.reply('ok'); } };
        const cmd = crearSlashDesdePrefijo({ prefijo, nombre: 'test', desc: 'x', opciones: [{ tipo: 'usuario', nombre: 'user', desc: 'y' }] });
        const i = interaccion([opUsuario('user', '9')]);
        await cmd.execute(i, {}, { idioma: 'es' });
        assert.deepStrictEqual(visto, { args: ['<@9>'], cfg: { idioma: 'es' }, autor: 'u1' });
        assert.strictEqual(i.llamadas[0][0], 'reply');
        assert.strictEqual(cmd.prefijo, 'test');
    });
    it('los subcomandos llegan como primer argumento (p. ej. «xp add»)', async () => {
        let visto;
        const prefijo = { name: 'xp', async execute(msg, args) { visto = args; await msg.reply('ok'); } };
        const cmd = crearSlashDesdePrefijo({ prefijo, nombre: 'xp', desc: 'x', subcomandos: [{ nombre: 'add', desc: 'a', opciones: [{ tipo: 'usuario', nombre: 'user', desc: 'u' }, { tipo: 'entero', nombre: 'amount', desc: 'n' }] }] });
        await cmd.execute(interaccion([opUsuario('user', '5'), { name: 'amount', type: 4, value: 50 }], { sub: 'add' }), {});
        assert.deepStrictEqual(visto, ['add', '<@5>', '50']);
    });
    it('si el comando solo publica en el canal, la interacción se cierra igual', async () => {
        const prefijo = { name: 'mudo', async execute() {} };
        const i = interaccion();
        await crearSlashDesdePrefijo({ prefijo, nombre: 'mudo', desc: 'x' }).execute(i, {});
        assert.strictEqual(i.llamadas[0][0], 'reply');
        assert.strictEqual(i.llamadas[0][1].flags, 64);
    });
    it('con `efimero` las respuestas solo las ve quien usa el comando (al editar no se toca)', async () => {
        const prefijo = { name: 'rep', async execute(msg) { await msg.reply('enviado'); await msg.reply({ content: 'otra' }); } };
        const i = interaccion();
        await crearSlashDesdePrefijo({ prefijo, nombre: 'rep', desc: 'x', efimero: true }).execute(i, {});
        assert.deepStrictEqual(i.llamadas.map((x) => [x[0], x[1].flags]), [['reply', 64], ['followUp', 64]]);
        const j = interaccion(); j.deferred = true;
        await mensajeDesdeInteraccion(j, [], { efimero: true }).reply('listo');
        assert.deepStrictEqual(j.llamadas, [['editReply', { content: 'listo' }]]);
    });
    it('/rol crear pasa el nombre entero aunque lleve espacios', async () => {
        const rol = require('../comandos/rol.js');
        const original = rol.execute;
        let visto;
        rol.execute = async (msg, args) => { visto = args; await msg.reply('ok'); };
        try {
            await require('../slash/rol.js').execute(interaccion([{ name: 'name', type: 3, value: 'Equipo Rojo' }], { sub: 'create' }), {}, null);
        } finally { rol.execute = original; }
        assert.deepStrictEqual(visto, ['create', 'Equipo Rojo']);
    });
    it('un comando real (dado) responde por la interacción', async () => {
        const cmd = require('../slash/dado.js');
        const i = interaccion();
        await cmd.execute(i, {}, null);
        assert.strictEqual(i.llamadas[0][0], 'reply');
        assert.match(JSON.stringify(i.llamadas[0][1]), /🎲/);
    });
});

describe('todos los comandos «!» tienen su versión con barra', () => {
    // Los que ya tenían un slash propio (no van por el puente).
    const NATIVOS = { help: 'help', account: 'account', invites: 'invites', accountpanel: 'account-panel', remind: 'remind' };
    const slash = fs.readdirSync(path.join(__dirname, '..', 'slash')).filter((f) => f.endsWith('.js')).map((f) => require(`../slash/${f}`));
    const nombresSlash = new Set(slash.map((c) => c.data.toJSON().name));
    const porPuente = new Set(slash.map((c) => c.prefijo).filter(Boolean));
    for (const f of fs.readdirSync(path.join(__dirname, '..', 'comandos')).filter((x) => x.endsWith('.js'))) {
        const { name } = require(`../comandos/${f}`);
        it(`!${name}`, () => {
            if (NATIVOS[name]) assert.ok(nombresSlash.has(NATIVOS[name]), `falta /${NATIVOS[name]}`);
            else assert.ok(porPuente.has(name), `!${name} no tiene versión con barra (crea slash/… con crearSlashDesdePrefijo)`);
        });
    }
    it('ningún nombre de slash (ni su nombre en español) se repite', () => {
        const vistos = new Set(); const vistosEs = new Set();
        for (const c of slash) {
            const j = c.data.toJSON(); const tipo = j.type || 1;
            assert.ok(!vistos.has(`${tipo}:${j.name}`), `/${j.name} repetido`); vistos.add(`${tipo}:${j.name}`);
            const es = j.name_localizations?.['es-ES'];
            if (es) { assert.ok(!vistosEs.has(`${tipo}:${es}`), `/${es} repetido`); vistosEs.add(`${tipo}:${es}`); }
        }
    });
});

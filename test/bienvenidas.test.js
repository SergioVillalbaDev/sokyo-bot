// ============================================================================
// Tests de la 1.9.1: «Enviar prueba» de bienvenidas (funciona aunque el mensaje
// esté desactivado, dice qué permiso falta y los errores salen en el idioma del
// panel), los campos de los embeds a medias (no se borran al autoguardar, pero no
// se mandan a Discord) y la geometría del recorte de imágenes del panel.
// Solo la parte pura, con objetos falsos con la forma mínima de discord.js.
// ============================================================================
const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { pathToFileURL } = require('url');
const { Collection, PermissionsBitField } = require('discord.js');

const { enviarBienvenida, enviarDespedida } = require('../utils/bienvenida.js');
const { sanearEmbed, embedTieneContenido, embedTieneAlgo, construirMensaje } = require('../utils/embeds.js');

const P = PermissionsBitField.Flags;

// Miembro de ejemplo en un servidor con un canal de texto. `permisos` = los del bot en el canal.
function miembroFalso({ permisos = PermissionsBitField.All, enviar } = {}) {
    const enviados = [];
    const canal = {
        id: 'C1', name: 'bienvenidas',
        send: async (m) => { if (enviar) return enviar(m); enviados.push(m); return m; },
        permissionsFor: () => new PermissionsBitField(permisos),
    };
    const guild = { id: 'G1', name: 'Servidor', memberCount: 10, channels: { cache: new Collection([['C1', canal]]) }, members: { me: { id: 'BOT' } } };
    canal.guild = guild;
    const member = { id: 'U1', guild, user: { username: 'alex' }, displayAvatarURL: () => 'https://cdn.discordapp.com/avatars/U1/a.png' };
    return { member, enviados };
}

const cfgCon = (bienvenida, idioma = 'en') => ({ idioma, bienvenida, despedida: bienvenida });

describe('«Enviar prueba» de bienvenidas', () => {
    const conf = { activo: false, canalId: 'C1', contenido: 'Hola {mention}', mencionar: true, embed: null };

    it('la prueba se manda aunque el mensaje esté desactivado', async () => {
        const { member, enviados } = miembroFalso();
        const r = await enviarBienvenida(member, cfgCon(conf), { prueba: true, idioma: 'es' });
        assert.strictEqual(r, true);
        assert.strictEqual(enviados.length, 1);
        assert.strictEqual(enviados[0].content, 'Hola <@U1>');
    });

    it('sin prueba (alguien entra de verdad) sigue sin mandarse si está desactivado', async () => {
        const { member, enviados } = miembroFalso();
        const r = await enviarBienvenida(member, cfgCon(conf));
        assert.deepStrictEqual(r, { error: 'Disabled.' });
        assert.strictEqual(enviados.length, 0);
    });

    it('los errores salen en el idioma del panel, no en el del bot', async () => {
        const { member } = miembroFalso();
        const r = await enviarDespedida(member, cfgCon({ ...conf, canalId: null }, 'en'), { prueba: true, idioma: 'es' });
        assert.deepStrictEqual(r, { error: 'No hay ningún canal configurado.' });
    });

    it('dice qué permiso le falta al bot en el canal', async () => {
        const { member, enviados } = miembroFalso({ permisos: [P.ViewChannel] });
        const r = await enviarBienvenida(member, cfgCon(conf), { prueba: true, idioma: 'es' });
        assert.match(r.error, /#bienvenidas: Enviar mensajes/);
        assert.strictEqual(enviados.length, 0);
    });

    it('con embed también pide «Insertar enlaces»', async () => {
        const { member } = miembroFalso({ permisos: [P.ViewChannel, P.SendMessages] });
        const conEmbed = { ...conf, contenido: '', embed: sanearEmbed({ titulo: '¡Bienvenido!' }) };
        const r = await enviarBienvenida(member, cfgCon(conEmbed), { prueba: true, idioma: 'es' });
        assert.match(r.error, /Insertar enlaces/);
    });

    it('si Discord rechaza una imagen (50035) lo explica en palabras normales', async () => {
        const { member } = miembroFalso({ enviar: async () => { const e = new Error('Invalid Form Body'); e.code = 50035; throw e; } });
        const r = await enviarBienvenida(member, cfgCon(conf), { prueba: true, idioma: 'es' });
        assert.match(r.error, /https:\/\//);
        assert.doesNotMatch(r.error, /Invalid Form Body/);
    });
});

describe('campos de los embeds a medias', () => {
    it('se guardan aunque estén vacíos (el autoguardado ya no los borra)', () => {
        const e = sanearEmbed({ campos: [{ nombre: '', valor: '' }, { nombre: 'Reglas', valor: '' }] });
        assert.strictEqual(e.campos.length, 2);
        assert.strictEqual(embedTieneAlgo(e), true);
    });

    it('pero no cuentan como contenido ni se mandan a Discord', () => {
        const soloVacios = sanearEmbed({ campos: [{ nombre: 'Reglas', valor: '' }] });
        assert.strictEqual(embedTieneContenido(soloVacios), false);
        assert.deepStrictEqual(construirMensaje('', soloVacios), {});

        const mezcla = sanearEmbed({ titulo: 'Hola', campos: [{ nombre: 'A', valor: '1' }, { nombre: 'B', valor: '' }] });
        const payload = construirMensaje('', mezcla);
        assert.deepStrictEqual(payload.embeds[0].data.fields, [{ name: 'A', value: '1', inline: false }]);
    });
});

describe('recorte de imágenes (lib/recorte.js del panel)', () => {
    let r;
    before(async () => {
        r = await import(pathToFileURL(path.join(__dirname, '..', 'sokyo-panelFRONTEND', 'src', 'lib', 'recorte.js')).href);
    });

    it('girar 90° cambia ancho por alto', () => {
        assert.deepStrictEqual(r.tamanoGirado(400, 100, 90), { w: 100, h: 400 });
        assert.deepStrictEqual(r.tamanoGirado(400, 100, 180), { w: 400, h: 100 });
    });

    it('«Que se vea entera» mete un logo ancho completo dentro del círculo', () => {
        const tam = { w: 400, h: 100 };
        const escala = r.escalaBase(tam, 1, 'entera', true);
        // La diagonal del logo cabe en el diámetro del círculo (1 unidad).
        assert.ok(Math.hypot(tam.w * escala, tam.h * escala) <= 1 + 1e-9);
        // Rellenando, en cambio, el alto ocupa todo el marco y se corta por los lados.
        const rellena = r.escalaBase(tam, 1, 'rellenar', true);
        assert.ok(Math.abs(tam.h * rellena - 1) < 1e-9);
        assert.ok(tam.w * rellena > 1);
    });

    it('al rellenar no se puede mover tanto como para dejar huecos', () => {
        const tam = { w: 200, h: 100 };
        const escala = r.escalaBase(tam, 1, 'rellenar', false); // 1 / 100
        const d = r.limitarDesplazamiento({ x: 5, y: 5 }, tam, escala, 1);
        assert.ok(Math.abs(d.x - 0.5) < 1e-9); // el sobrante horizontal (2 - 1) / 2
        assert.strictEqual(d.y, 0);            // en vertical no sobra nada
    });

    it('la imagen recortada no se agranda de más y va en PNG si puede tener transparencia', () => {
        assert.strictEqual(r.anchoSalida(1 / 50, 512), 128);
        assert.strictEqual(r.anchoSalida(1 / 3000, 512), 512);
        assert.strictEqual(r.tipoSalida('image/jpeg', '#ffffff'), 'image/jpeg');
        assert.strictEqual(r.tipoSalida('image/jpeg', null), 'image/png');
        assert.strictEqual(r.tipoSalida('image/png', '#000000'), 'image/png');
    });
});

describe('estado de la bienvenida en el panel (lib/estadoBienvenida.js)', () => {
    let e;
    before(async () => {
        e = await import(pathToFileURL(path.join(__dirname, '..', 'sokyo-panelFRONTEND', 'src', 'lib', 'estadoBienvenida.js')).href);
    });
    const canales = [{ id: 'C1', nombre: '#bienvenidas' }];
    const base = { activo: true, canalId: 'C1', contenido: 'Hola {mention}', mencionar: true, embed: null };

    it('avisa de que NO se manda si «Mensaje activo» está apagado', () => {
        assert.deepStrictEqual(e.estadoMensaje({ ...base, activo: false }, { canales }), { tipo: 'error', clave: 'apagado' });
    });
    it('sin canal, con el canal borrado o vacío tampoco se manda', () => {
        assert.strictEqual(e.estadoMensaje({ ...base, canalId: null }, { canales }).clave, 'sinCanal');
        assert.strictEqual(e.estadoMensaje({ ...base, canalId: 'BORRADO' }, { canales }).clave, 'canalBorrado');
        assert.strictEqual(e.estadoMensaje({ ...base, contenido: ' ', embed: { campos: [{ nombre: 'A', valor: '' }] } }, { canales }).clave, 'vacio');
    });
    it('dice cuándo sale sin notificación', () => {
        assert.strictEqual(e.estadoMensaje({ ...base, mencionar: false }, { canales }).clave, 'sinPing');
        assert.strictEqual(e.estadoMensaje({ ...base, contenido: 'Hola' }, { canales }).clave, 'sinMencion');
        assert.strictEqual(e.estadoMensaje({ ...base, contenido: '', embed: { descripcion: 'Hola {mention}' } }, { canales }).clave, 'mencionEnEmbed');
    });
    it('bien configurada: se manda con notificación; la despedida no necesita mención', () => {
        assert.deepStrictEqual(e.estadoMensaje(base, { canales }), { tipo: 'ok', clave: 'okConAviso' });
        assert.deepStrictEqual(e.estadoMensaje({ ...base, contenido: 'Adiós' }, { tipo: 'despedida', canales }), { tipo: 'ok', clave: 'ok' });
    });
});

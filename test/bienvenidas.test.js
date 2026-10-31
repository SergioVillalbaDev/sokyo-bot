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

describe('mencionar canales con #nombre (utils/mencionesCanal.js)', () => {
    const { ChannelType } = require('discord.js');
    const { mencionarCanales } = require('../utils/mencionesCanal.js');
    const canal = (id, name, type = ChannelType.GuildText, rawPosition = 0) => ({ id, name, type, rawPosition });
    const guild = { channels: { cache: new Collection([
        ['R1', canal('R1', '📜・reglas')],
        ['R2', canal('R2', 'roles-y-colores', ChannelType.GuildText, 3)],
        ['V1', canal('V1', 'Charla', ChannelType.GuildVoice, 5)],
        ['K1', canal('K1', 'info', ChannelType.GuildCategory)],
        ['I1', canal('I1', 'info', ChannelType.GuildText, 1)],
    ]) } };

    it('«#reglas» enlaza el canal aunque su nombre lleve adornos', () => {
        assert.strictEqual(mencionarCanales('Lee #reglas antes de nada.', guild), 'Lee <#R1> antes de nada.');
        assert.strictEqual(mencionarCanales('Mira #Reglas, #roles-y-colores y #charla!', guild), 'Mira <#R1>, <#R2> y <#V1>!');
    });
    it('vale con el nombre tal cual (como lo inserta el panel)', () => {
        assert.strictEqual(mencionarCanales('#📜・reglas', guild), '<#R1>');
    });
    it('respeta la cursiva de Discord: _#reglas_', () => {
        assert.strictEqual(mencionarCanales('Lee _#reglas_ y **#reglas**', guild), 'Lee _<#R1>_ y **<#R1>**');
    });
    it('nunca enlaza una categoría', () => {
        assert.strictEqual(mencionarCanales('#info', guild), '<#I1>');
    });
    it('no toca lo que no es un canal, ni títulos, ni enlaces, ni menciones ya hechas', () => {
        const texto = '# Bienvenido\n#noexiste C#reglas https://web.com/#reglas <#R2> {mention}';
        assert.strictEqual(mencionarCanales(texto, guild), texto);
    });
    it('la bienvenida sale con el canal enlazado en el texto y en el embed', async () => {
        const enviados = [];
        const canalB = { id: 'C1', name: 'bienvenidas', send: async (m) => { enviados.push(m); }, permissionsFor: () => new PermissionsBitField(PermissionsBitField.All) };
        const g = { id: 'G1', name: 'Servidor', memberCount: 5, members: { me: { id: 'BOT' } }, channels: { cache: new Collection([['C1', canalB], ...guild.channels.cache]) } };
        canalB.guild = g;
        const member = { id: 'U1', guild: g, user: { username: 'alex' }, displayAvatarURL: () => 'https://cdn.discordapp.com/a.png' };
        const conf = { activo: true, canalId: 'C1', contenido: 'Hola {mention}, lee #reglas', mencionar: true,
            embed: sanearEmbed({ descripcion: 'Elige color en #roles-y-colores', campos: [{ nombre: 'Normas', valor: 'En #reglas' }] }) };
        assert.strictEqual(await enviarBienvenida(member, { bienvenida: conf }), true);
        assert.strictEqual(enviados[0].content, 'Hola <@U1>, lee <#R1>');
        const e = enviados[0].embeds[0].data;
        assert.strictEqual(e.description, 'Elige color en <#R2>');
        assert.strictEqual(e.fields[0].value, 'En <#R1>');
    });
});

describe('autocompletar canales al escribir # (lib/canalesTexto.js del panel)', () => {
    let c;
    before(async () => {
        c = await import(pathToFileURL(path.join(__dirname, '..', 'sokyo-panelFRONTEND', 'src', 'lib', 'canalesTexto.js')).href);
    });
    const canales = [{ id: '1', nombre: 'general' }, { id: '2', nombre: '📜・reglas' }, { id: '3', nombre: 'roles-y-reglas' }, { id: '4', nombre: 'anuncios' }];

    it('detecta «#» al escribir (al principio, tras un espacio o un formato) y no en medio de una palabra', () => {
        assert.deepStrictEqual(c.buscarConsultaCanal('Lee #reg', 8), { inicio: 4, consulta: 'reg' });
        assert.deepStrictEqual(c.buscarConsultaCanal('#', 1), { inicio: 0, consulta: '' });
        assert.deepStrictEqual(c.buscarConsultaCanal('**#re', 5), { inicio: 2, consulta: 're' });
        assert.strictEqual(c.buscarConsultaCanal('C#', 2), null);
        assert.strictEqual(c.buscarConsultaCanal('Lee #reglas ya', 14), null); // ya se cerró con un espacio
    });
    it('filtra: primero los que empiezan así, luego los que lo contienen; sin texto, todos', () => {
        assert.deepStrictEqual(c.filtrarCanales(canales, 'reg').map((x) => x.id), ['2', '3']);
        assert.deepStrictEqual(c.filtrarCanales(canales, 'rol').map((x) => x.id), ['3']);
        assert.strictEqual(c.filtrarCanales(canales, '').length, 4);
        assert.deepStrictEqual(c.filtrarCanales(canales, 'zzz'), []);
    });
    it('al elegir, deja «#nombre » y el cursor detrás', () => {
        assert.deepStrictEqual(c.insertarCanal('Lee #reg', 8, 4, '📜・reglas'), { texto: 'Lee #📜・reglas ', cursor: 4 + 1 + '📜・reglas'.length + 1 });
        assert.strictEqual(c.insertarCanal('Lee #re y ya', 7, 4, 'reglas').texto, 'Lee #reglas y ya');
    });
});

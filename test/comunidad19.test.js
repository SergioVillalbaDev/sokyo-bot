// ============================================================================
// Tests de la 1.9.0: cumpleaños, traducir, salón de la fama, ayuda antes del
// ticket, avisos de Kick/Reddit/RSS (y que nadie use el bot para mirar la red de
// casa), clanes, contadores, solicitudes, mensajes fijos, grupos, y que los
// ajustes nuevos encajen con el historial, el diagnóstico y los roles que da el bot.
// Solo la parte pura, con objetos falsos con la forma mínima de discord.js.
// ============================================================================
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { Collection, PermissionsBitField } = require('discord.js');

const cumple = require('../utils/cumpleanos.js');
const traducir = require('../utils/traducir.js');
const { esEmojiDelSalon } = require('../utils/salonFama.js');
const ayudaPrevia = require('../utils/ayudaPrevia.js');
const directos = require('../utils/directos.js');
const { ipEnRangoPrivado, urlEsSegura } = require('../utils/redSegura.js');
const clanes = require('../utils/clanes.js');
const contadores = require('../utils/contadoresCanal.js');
const { mensajePanel } = require('../utils/solicitudes.js');
const { contenido: contenidoFijo } = require('../utils/mensajesFijos.js');
const { embedGrupo } = require('../utils/grupos.js');
const { rolesQueDaElBot } = require('../utils/permisos.js');
const { esInterno } = require('../utils/camposInternos.js');
const { diagnosticar } = require('../utils/diagnostico.js');
const { palabraProhibida } = require('../utils/confesiones.js');

describe('cumpleaños', () => {
    const dia = (s) => new Date(`${s}T10:00:00Z`);
    it('cuenta los días que faltan (0 = hoy) y salta al año siguiente', () => {
        assert.strictEqual(cumple.diasHasta(29, 10, dia('2026-10-29')), 0);
        assert.strictEqual(cumple.diasHasta(30, 10, dia('2026-10-29')), 1);
        assert.strictEqual(cumple.diasHasta(28, 10, dia('2026-10-29')), 364);
        assert.strictEqual(cumple.diasHasta(1, 1, dia('2026-12-31')), 1);
    });
    it('el 29 de febrero se celebra el 28 en los años normales', () => {
        assert.strictEqual(cumple.diasHasta(29, 2, dia('2027-02-28')), 0);
        assert.strictEqual(cumple.diasHasta(29, 2, dia('2028-02-28')), 1);
    });
    it('solo acepta fechas que existen', () => {
        assert.ok(cumple.fechaValida(29, 2));
        assert.ok(!cumple.fechaValida(31, 4));
        assert.ok(!cumple.fechaValida(0, 5));
        assert.ok(!cumple.fechaValida(10, 13));
    });
    it('dice la fecha como se dice en cada idioma', () => {
        assert.strictEqual(cumple.textoFecha(14, 3, 'es'), '14 de marzo');
        assert.strictEqual(cumple.textoFecha(14, 3, 'en'), 'March 14');
    });
});

describe('traducir', () => {
    it('traduce al idioma elegido en /preferencias o, si no, al de su Discord', () => {
        assert.strictEqual(traducir.idiomaDestino('fr', 'es'), 'es');
        assert.strictEqual(traducir.idiomaDestino('es-ES', 'auto'), 'es');
        assert.strictEqual(traducir.idiomaDestino('pt-BR', 'auto'), 'pt-BR');
        assert.strictEqual(traducir.idiomaDestino('en-GB', 'auto'), 'en');
    });
    it('parte los textos largos en trozos que acepta el traductor, sin perder nada', () => {
        const texto = 'Una frase corta. '.repeat(80);
        const trozos = traducir.trocear(texto);
        assert.ok(trozos.every((x) => x.length <= 450));
        assert.strictEqual(trozos.join(' ').replace(/\s+/g, ' ').trim(), texto.replace(/\s+/g, ' ').trim());
    });
});

describe('salón de la fama', () => {
    it('reconoce la estrella con o sin variación y los emojis del servidor', () => {
        assert.ok(esEmojiDelSalon({ name: '⭐' }, '⭐'));
        assert.ok(esEmojiDelSalon({ name: '⭐️' }, '⭐'));
        assert.ok(esEmojiDelSalon({ id: '123', name: 'estrella' }, '<:estrella:123>'));
        assert.ok(!esEmojiDelSalon({ name: '🔥' }, '⭐'));
        assert.ok(!esEmojiDelSalon({ id: '999', name: 'estrella' }, '<:estrella:123>'));
    });
});

describe('ayuda antes de abrir un ticket', () => {
    const cfg = { autoRespuestas: [
        { activo: true, patron: 'contraseña', respuesta: 'Ve a Ajustes → Seguridad.' },
        { activo: false, patron: 'pago', respuesta: 'Escríbenos a pagos@…' },
        { activo: true, patron: 'id', respuesta: 'demasiado corto para buscarlo' },
    ] };
    it('encuentra la respuesta aunque se escriba sin tilde o en mayúsculas', () => {
        assert.strictEqual(ayudaPrevia.buscarEnFAQ(cfg, 'No me acuerdo de mi CONTRASENA')?.respuesta, 'Ve a Ajustes → Seguridad.');
    });
    it('no usa las apagadas ni las de menos de 3 letras', () => {
        assert.strictEqual(ayudaPrevia.buscarEnFAQ(cfg, 'Problema con el pago'), null);
        assert.strictEqual(ayudaPrevia.buscarEnFAQ(cfg, 'mi id de usuario'), null);
    });
    it('los botones solo sirven a quien rellenó el formulario, y una vez', () => {
        const clave = ayudaPrevia.guardarPendiente({ userId: 'u1', guildId: 'g1', motivo: 'm', asunto: 'a', descripcion: 'd' });
        assert.strictEqual(ayudaPrevia.tomarPendiente(clave, 'otro'), null);
        assert.strictEqual(ayudaPrevia.tomarPendiente(clave, 'u1').asunto, 'a');
        assert.strictEqual(ayudaPrevia.tomarPendiente(clave, 'u1'), null);
    });
});

describe('avisos de Kick, Reddit y RSS', () => {
    it('entiende el canal de Kick y la comunidad de Reddit escritos de varias formas', () => {
        assert.strictEqual(directos.slugKick('https://kick.com/xQc'), 'xqc');
        assert.strictEqual(directos.slugKick('@streamer_1'), 'streamer_1');
        assert.strictEqual(directos.slugKick('kick.com/'), null);
        assert.strictEqual(directos.subReddit('r/Spain'), 'Spain');
        assert.strictEqual(directos.subReddit('https://www.reddit.com/r/gaming/new/'), 'gaming');
        assert.strictEqual(directos.subReddit('dos palabras'), null);
    });
    it('lee los feeds Atom (Reddit) y RSS (webs y blogs)', () => {
        const atom = '<feed xmlns="http://www.w3.org/2005/Atom"><title>r/spain</title><entry><id>t3_abc</id><title>Hola &amp; adiós</title><link href="https://www.reddit.com/r/spain/comments/abc/"/><updated>2026-10-29T14:00:00+00:00</updated><media:thumbnail url="https://i.redd.it/x.jpg"/></entry></feed>';
        const a = directos.analizarFeed(atom);
        assert.strictEqual(a.titulo, 'r/spain');
        assert.deepStrictEqual([a.entradas[0].id, a.entradas[0].titulo, a.entradas[0].imagen], ['t3_abc', 'Hola & adiós', 'https://i.redd.it/x.jpg']);
        const rss = '<rss version="2.0"><channel><title><![CDATA[Mi blog]]></title><item><title><![CDATA[Post 1]]></title><link>https://blog.example/p1</link><guid>p1</guid><pubDate>Wed, 28 Oct 2026 10:00:00 GMT</pubDate><description>&lt;img src="https://blog.example/i.png"&gt; Resumen</description></item></channel></rss>';
        const r = directos.analizarFeed(rss);
        assert.strictEqual(r.titulo, 'Mi blog');
        assert.strictEqual(r.entradas[0].url, 'https://blog.example/p1');
        assert.strictEqual(r.entradas[0].imagen, 'https://blog.example/i.png');
        assert.strictEqual(r.entradas[0].resumen, 'Resumen');
        assert.strictEqual(directos.analizarFeed('<html>no es un feed</html>'), null);
    });
    it('no deja que una dirección apunte a la red de casa (donde está la Raspberry)', async () => {
        for (const ip of ['127.0.0.1', '10.0.0.5', '192.168.1.20', '172.16.3.4', '169.254.169.254', '100.64.0.1', '::1', 'fd00::1']) assert.ok(ipEnRangoPrivado(ip), ip);
        assert.ok(!ipEnRangoPrivado('151.101.1.140'));
        assert.strictEqual(await urlEsSegura('http://127.0.0.1:3000/api'), false);
        assert.strictEqual(await urlEsSegura('file:///etc/passwd'), false);
        assert.strictEqual(await urlEsSegura('no es una url'), false);
    });
});

describe('clanes', () => {
    it('los nombres no se repiten aunque cambien tildes, mayúsculas o espacios', () => {
        assert.strictEqual(clanes.clave('  Los  LOBOS de Ñandú '), clanes.clave('los lobos de nandu'));
    });
    it('el nombre no puede llevar menciones, enlaces ni ser muy corto', () => {
        assert.ok(clanes.nombreValido('Los Lobos'));
        assert.ok(!clanes.nombreValido('ab'));
        assert.ok(!clanes.nombreValido('<@123> clan'));
        assert.ok(!clanes.nombreValido('mira https://x.y'));
    });
});

describe('contadores en canales', () => {
    it('pone la cifra con el formato de cada idioma y no pasa de 100 letras', () => {
        assert.strictEqual(contadores.nombreCanal('👥 Miembros: {n}', 12345, 'es'), '👥 Miembros: 12.345');
        assert.strictEqual(contadores.nombreCanal('{n} members', 1234567, 'en'), '1,234,567 members');
        assert.ok(contadores.nombreCanal('x'.repeat(200) + '{n}', 1, 'en').length <= 100);
    });
    it('cuenta a la gente en voz sin contar bots', async () => {
        const guild = { voiceStates: { cache: new Collection([
            ['a', { channelId: 'v1', member: { user: { bot: false } } }],
            ['b', { channelId: 'v1', member: { user: { bot: true } } }],
            ['c', { channelId: null, member: { user: { bot: false } } }],
        ]) } };
        assert.strictEqual(await contadores.valor(guild, 'enVoz'), 1);
    });
});

describe('solicitudes', () => {
    it('solo salen los formularios abiertos y con preguntas, cada uno con su botón', () => {
        const m = mensajePanel({ idioma: 'es', solicitudes: { titulo: 'Únete', descripcion: 'Hola', formularios: [
            { id: 'mod', nombre: 'Moderador', emoji: '🛡️', preguntas: ['¿Edad?'], abierto: true },
            { id: 'cerrado', nombre: 'Cerrado', preguntas: ['x'], abierto: false },
            { id: 'vacio', nombre: 'Sin preguntas', preguntas: [' '], abierto: true },
        ] } });
        const botones = m.components.flatMap((f) => f.components.map((b) => b.data.custom_id));
        assert.deepStrictEqual(botones, ['sol_abrir:mod']);
        assert.match(m.embeds[0].data.description, /Moderador/);
    });
});

describe('mensajes fijos y grupos', () => {
    it('el mensaje fijo nunca menciona a nadie', () => {
        assert.deepStrictEqual(contenidoFijo({ comoEmbed: false, titulo: 'Normas', texto: '@everyone leed' }).allowedMentions, { parse: [] });
        assert.deepStrictEqual(contenidoFijo({ comoEmbed: true, titulo: 'Normas', texto: 'x', color: 'no-color' }).embeds[0].data.color, 0xa855f7);
    });
    it('el grupo enseña las plazas y quién se ha apuntado', () => {
        const e = embedGrupo({ juego: 'Valorant', plazas: 5, miembros: ['1', '2'], estado: 'abierto', cuando: 'a las 22:00', descripcion: '', creadoFecha: new Date() }, 'es').toJSON();
        const plazas = e.fields.find((f) => /Plazas/.test(f.name));
        assert.strictEqual(plazas.value, '**2/5**');
        assert.match(e.fields.find((f) => f.name === 'Apuntados').value, /<@1>[\s\S]*<@2>/);
    });
});

describe('confesiones', () => {
    it('las palabras prohibidas del automoderador también valen para las confesiones', () => {
        const cfg = { automod: { activo: true, palabras: { activo: true, lista: ['tonto'] } } };
        assert.strictEqual(palabraProhibida('Eres un TONTO', cfg), 'tonto');
        assert.strictEqual(palabraProhibida('Hola', cfg), null);
        assert.strictEqual(palabraProhibida('Eres un tonto', { automod: { activo: false } }), null);
    });
});

describe('los ajustes nuevos encajan con el resto del panel', () => {
    it('los roles que da el bot (cumpleaños y solicitudes) pasan por la regla de jerarquía', () => {
        const roles = rolesQueDaElBot({ cumpleanos: { rolId: 'r1' }, solicitudes: { formularios: [{ rolId: 'r2' }, { rolId: null }] } });
        assert.ok(roles.includes('r1') && roles.includes('r2'));
    });
    it('lo que lleva el bot por su cuenta no se apunta en el historial ni se copia', () => {
        for (const ruta of ['cumpleanos.lastDia', 'clanes.lastSemana', 'confesiones.ultimoNumero', 'solicitudes.panelMensajeId', 'ayudaPrevia.resueltas']) assert.ok(esInterno(ruta), ruta);
        for (const ruta of ['cumpleanos.canalId', 'clanes.premioOro', 'confesiones.canalRevisionId']) assert.ok(!esInterno(ruta), ruta);
    });
    it('el diagnóstico avisa de los clanes sin niveles y de un rol de formulario borrado (sin borrar el formulario)', async () => {
        const P = PermissionsBitField.Flags;
        const guild = {
            id: 'g1', members: { me: { permissions: new PermissionsBitField([P.Administrator]), roles: { highest: { position: 5 } } } },
            channels: { cache: new Collection() }, roles: { cache: new Collection() },
        };
        const cfg = { rolStaffId: null, clanes: { activo: true }, nivelesActivo: false, solicitudes: { activo: true, formularios: [{ id: 'f', rolId: 'borrado' }] } };
        const r = await diagnosticar({ guilds: { cache: new Map([['g1', guild]]) } }, 'g1', cfg, 'es');
        assert.ok(r.problemas.some((p) => p.id === 'medio:clanes'));
        const rol = r.problemas.find((p) => p.id === 'falta:solicitudes.formularios:borrado');
        assert.deepStrictEqual(rol.arreglo, { accion: 'quitarDeLista', ruta: 'solicitudes.formularios', campo: 'rolId', valor: 'borrado' });
    });
});

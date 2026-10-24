// ============================================================================
// Tests de Crecimiento: detección del bump de DISBOARD, atribución de
// invitaciones, lectura de Twitch/YouTube y página pública.
// ============================================================================
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { Collection, PermissionsBitField } = require('discord.js');

const bump = require('../utils/bump.js');
const invitaciones = require('../utils/invitaciones.js');
const directos = require('../utils/directos.js');
const pagina = require('../utils/paginaPublica.js');

describe('bump: mensajes de DISBOARD', () => {
    const msg = (embed, extra = {}) => ({ embeds: embed ? [embed] : [], ...extra });
    it('reconoce el bump hecho (inglés, con la imagen) y quién lo hizo', () => {
        const r = bump.analizarMensaje(msg(
            { description: 'Bump done! :thumbsup:\nCheck it out [on DISBOARD](https://disboard.org/server/1).', image: { url: 'https://disboard.org/images/bot-command-image-bump.png' } },
            { interactionMetadata: { user: { id: '111' } } },
        ));
        assert.deepStrictEqual(r, { tipo: 'exito', minutos: 120, usuarioId: '111' });
    });
    it('reconoce el bump traducido aunque no venga la imagen', () => {
        assert.strictEqual(bump.analizarMensaje(msg({ description: '¡Bump realizado! 👍' })).tipo, 'exito');
    });
    it('lee los minutos que faltan cuando aún no se puede', () => {
        const r = bump.analizarMensaje(msg({ description: '<@222222222222222222>, Please wait another 87 minutes until the server can be bumped' }));
        assert.strictEqual(r.tipo, 'espera');
        assert.strictEqual(r.minutos, 87);
        assert.strictEqual(r.usuarioId, '222222222222222222');
    });
    it('ignora el "pensando…" (sin embed) y otros mensajes', () => {
        assert.strictEqual(bump.analizarMensaje(msg(null)), null);
        assert.strictEqual(bump.analizarMensaje(msg({ description: 'Server listing updated.' })), null);
    });
});

// Servidor falso con invitaciones que se pueden ir cambiando entre llamadas.
function servidorFalso(id = 'G1') {
    let lista = [];
    const guild = {
        id,
        vanityURLCode: null,
        members: { me: { permissions: new PermissionsBitField([PermissionsBitField.Flags.ManageGuild]) } },
        invites: { fetch: async () => new Collection(lista.map((i) => [i.code, i])) },
        poner(nuevas) { lista = nuevas; },
    };
    return guild;
}
const inv = (code, uses, inviterId, maxUses = 0) => ({ code, uses, maxUses, inviterId, inviter: { id: inviterId, username: `u${inviterId}` } });
const client = { user: { id: 'BOT' } };

describe('invitaciones: con qué invitación entra cada uno', () => {
    it('elige la invitación cuyo uso ha subido', async () => {
        const g = servidorFalso('G1');
        g.poner([inv('aaa', 3, 'A'), inv('bbb', 0, 'B')]);
        assert.strictEqual(await invitaciones.cargarInvitaciones(g), true);
        g.poner([inv('aaa', 3, 'A'), inv('bbb', 1, 'B')]);
        const r = await invitaciones.detectarOrigen({ guild: g }, client);
        assert.deepStrictEqual(r, { fuente: 'invitacion', codigo: 'bbb', invitadorId: 'B', invitadorTag: 'uB' });
    });
    it('dos entradas a la vez con invitaciones distintas: cada una se atribuye a la suya', async () => {
        const g = servidorFalso('G2');
        g.poner([inv('aaa', 0, 'A'), inv('bbb', 0, 'B')]);
        await invitaciones.cargarInvitaciones(g);
        g.poner([inv('aaa', 1, 'A'), inv('bbb', 1, 'B')]);
        const r1 = await invitaciones.detectarOrigen({ guild: g }, client);
        const r2 = await invitaciones.detectarOrigen({ guild: g }, client);
        assert.deepStrictEqual([r1.invitadorId, r2.invitadorId].sort(), ['A', 'B']);
        const r3 = await invitaciones.detectarOrigen({ guild: g }, client);
        assert.strictEqual(r3.fuente, 'desconocida'); // ya no queda ningún uso sin atribuir
    });
    it('invitación de un solo uso que Discord borra al gastarse', async () => {
        const g = servidorFalso('G3');
        g.poner([inv('uno', 0, 'C', 1)]);
        await invitaciones.cargarInvitaciones(g);
        g.poner([]);
        const r = await invitaciones.detectarOrigen({ guild: g }, client);
        assert.strictEqual(r.invitadorId, 'C');
    });
    it('la invitación creada por el bot es la de la página pública', async () => {
        const g = servidorFalso('G4');
        g.poner([inv('web', 0, 'BOT')]);
        await invitaciones.cargarInvitaciones(g);
        g.poner([inv('web', 1, 'BOT')]);
        const r = await invitaciones.detectarOrigen({ guild: g }, client);
        assert.strictEqual(r.fuente, 'web');
        assert.strictEqual(r.invitadorId, null);
    });
    it('sin permiso para ver invitaciones no inventa nada', async () => {
        const g = servidorFalso('G5');
        g.members.me.permissions = new PermissionsBitField([]);
        assert.strictEqual(await invitaciones.cargarInvitaciones(g), false);
        assert.strictEqual((await invitaciones.detectarOrigen({ guild: g }, client)).fuente, 'desconocida');
    });
    it('siguiente recompensa y marcadores del aviso', () => {
        const rec = [{ invitaciones: 10, rolId: 'r10' }, { invitaciones: 3, rolId: 'r3' }];
        assert.strictEqual(invitaciones.siguienteRecompensa(2, rec).rolId, 'r3');
        assert.strictEqual(invitaciones.siguienteRecompensa(5, rec).rolId, 'r10');
        assert.strictEqual(invitaciones.siguienteRecompensa(10, rec), null);
        assert.strictEqual(
            invitaciones.rellenar('{mention} gracias a {inviter} ({invites}) en {server}', { mention: '<@1>', inviter: '<@2>', invites: 4, server: 'Tokyto' }),
            '<@1> gracias a <@2> (4) en Tokyto');
    });
});

describe('directos: Twitch y YouTube', () => {
    const ld = (grafo) => `<html><script type="application/ld+json">${JSON.stringify({ '@context': 'http://schema.org', '@graph': grafo })}</script></html>`;
    const perfil = { '@type': 'ProfilePage', mainEntity: { '@type': 'Person', name: 'Ibai', image: 'https://x/avatar.png' } };
    it('Twitch: canal en directo', () => {
        const r = directos.analizarPaginaTwitch(ld([perfil, {
            '@type': 'VideoObject', description: 'La Velada', thumbnailUrl: ['a-80x45.jpg', 'a-640x360.jpg'],
            publication: { '@type': 'BroadcastEvent', startDate: '2026-10-23T21:07:06Z', isLiveBroadcast: true },
        }]), 'ibai');
        assert.strictEqual(r.nombre, 'Ibai');
        assert.strictEqual(r.directo.titulo, 'La Velada');
        assert.strictEqual(r.directo.id, '2026-10-23T21:07:06Z');
        assert.strictEqual(r.directo.miniatura, 'a-640x360.jpg');
    });
    it('Twitch: canal desconectado y canal que no existe', () => {
        assert.strictEqual(directos.analizarPaginaTwitch(ld([perfil]), 'ibai').directo, null);
        assert.strictEqual(directos.analizarPaginaTwitch('<html>sin datos</html>', 'x'), null);
    });
    it('Twitch y YouTube: lo que se puede escribir en el panel', () => {
        assert.strictEqual(directos.loginTwitch('https://www.twitch.tv/IbaiLlanos'), 'ibaillanos');
        assert.strictEqual(directos.loginTwitch('@ibai'), 'ibai');
        assert.strictEqual(directos.loginTwitch('twitch.tv/videos/123'), null);
        assert.deepStrictEqual(directos.entradaYoutube('https://youtube.com/@IbaiLlanos?si=x'), { url: 'https://www.youtube.com/@IbaiLlanos' });
        assert.deepStrictEqual(directos.entradaYoutube('https://www.youtube.com/channel/UCaY_-ksFSQtTGk0y1HA_3YQ'), { id: 'UCaY_-ksFSQtTGk0y1HA_3YQ' });
        assert.strictEqual(directos.entradaYoutube('hola'), null);
    });
    it('YouTube: feed RSS, del más nuevo al más antiguo, con Shorts marcados', () => {
        const entrada = (id, fecha, short = false, titulo = 'Vídeo &amp; más') => `<entry><yt:videoId>${id}</yt:videoId><title>${titulo}</title>
<link rel="alternate" href="https://www.youtube.com/${short ? 'shorts/' : 'watch?v='}${id}"/><published>${fecha}</published>
<media:thumbnail url="https://i.ytimg.com/vi/${id}/hqdefault.jpg" width="480" height="360"/></entry>`;
        const xml = `<?xml version="1.0"?><feed><author><name>Ibai</name></author>
${entrada('viejo', '2026-10-01T10:00:00+00:00')}${entrada('short', '2026-10-03T10:00:00+00:00', true)}${entrada('nuevo', '2026-10-05T10:00:00+00:00')}</feed>`;
        const f = directos.analizarFeedYoutube(xml);
        assert.strictEqual(f.autor, 'Ibai');
        assert.deepStrictEqual(f.entradas.map((e) => e.id), ['nuevo', 'short', 'viejo']);
        assert.strictEqual(f.entradas[1].esShort, true);
        assert.strictEqual(f.entradas[0].titulo, 'Vídeo & más');
        assert.strictEqual(directos.analizarFeedYoutube('<html>404</html>'), null);
    });
});

describe('página pública', () => {
    it('direcciones', () => {
        assert.strictEqual(pagina.slugDe('Los Tokyto 🍣 Ñandú'), 'los-tokyto-nandu');
        assert.strictEqual(pagina.slugValido('tokyto'), true);
        assert.strictEqual(pagina.slugValido('ab'), false);
        assert.strictEqual(pagina.slugValido('-tokyto'), false);
        assert.strictEqual(pagina.slugValido('Tokyto'), false);
        assert.strictEqual(pagina.slugValido('a'.repeat(33)), false);
    });
    it('etiquetas: sin repetidas, sin HTML y como mucho 5', () => {
        assert.deepStrictEqual(pagina.limpiarEtiquetas(['Gaming', 'gaming', '<b>anime</b>', '', 'a', 'b', 'c', 'd']), ['Gaming', 'banime/b', 'a', 'b', 'c']);
    });
    const datos = (extra = {}) => ({
        slug: 'tokyto', nombre: 'Tokyto', icono: null, banner: null, descripcion: 'Hola', etiquetas: ['gaming'],
        miembros: 12345, enLinea: 56, nivelBoost: 2, idioma: 'es', invitacion: 'https://discord.gg/abc', eventos: [], ranking: [], ...extra,
    });
    it('la página del servidor lleva la vista previa para compartir y el botón de unirse', () => {
        const html = pagina.paginaServidor(datos(), 'https://dashboard.sokyo.studio');
        assert.match(html, /<meta property="og:title" content="Tokyto · Discord">/);
        assert.match(html, /<link rel="canonical" href="https:\/\/dashboard\.sokyo\.studio\/s\/tokyto">/);
        assert.match(html, /href="https:\/\/discord\.gg\/abc"/);
        assert.match(html, /12\.345 miembros/);
        assert.match(html, /Unirse al servidor/);
    });
    it('no se puede colar HTML ni scripts por el nombre o la descripción', () => {
        const html = pagina.paginaServidor(datos({ nombre: '<script>alert(1)</script>', descripcion: '"><img src=x onerror=alert(1)>' }), 'https://x');
        assert.ok(!html.includes('<script>alert(1)'));
        assert.ok(!html.includes('<img src=x'));
        assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    });
    it('sin invitación avisa en vez de poner un botón roto', () => {
        assert.match(pagina.paginaServidor(datos({ invitacion: null }), 'https://x'), /La invitación no está disponible/);
    });
    it('directorio: búsqueda sin acentos y filtro por etiqueta', () => {
        const lista = [
            { slug: 'a', nombre: 'Cocina Fácil', descripcion: '', etiquetas: ['recetas'], miembros: 10 },
            { slug: 'b', nombre: 'Gamers', descripcion: 'Partidas y torneos', etiquetas: ['gaming'], miembros: 20 },
        ];
        assert.deepStrictEqual(pagina.filtrarDirectorio(lista, { q: 'facil' }).map((s) => s.slug), ['a']);
        assert.deepStrictEqual(pagina.filtrarDirectorio(lista, { etiqueta: 'Gaming' }).map((s) => s.slug), ['b']);
        const html = pagina.paginaDirectorio(lista, { lang: 'en', base: 'https://x', q: '' });
        assert.match(html, /Discord servers with Sokyo/);
        assert.match(html, /href="\/s\/b"/);
        // Con búsqueda no se indexa (evita páginas duplicadas en Google).
        assert.match(pagina.paginaDirectorio(lista, { lang: 'es', base: 'https://x', q: 'cocina' }), /noindex/);
    });
});

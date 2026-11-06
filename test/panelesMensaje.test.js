// ============================================================================
// Tests de la 1.9.14: los mensajes con botón que el bot deja fijos en un canal
// («Preséntate» y «Nueva sugerencia») se personalizan enteros (texto, embed con
// imágenes/GIF, «#canal» como enlace y el botón), se guardan saneados, se reeditan
// en vez de repetirse y, al cambiar el idioma del bot, se reescriben los que ya
// están publicados (sin publicar nada nuevo). Sin Discord ni base de datos.
// ============================================================================
const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const { ButtonStyle, ChannelType } = require('discord.js');

const comunidad = require('../utils/comunidad.js');
const { sanearPanel, mismoPanel, embedDeFabrica, editarOPublicar } = require('../utils/panelMensaje.js');
const panelesPublicados = require('../utils/panelesPublicados.js');
const ServidorConfig = require('../models/ServidorConfig.js');

const guild = { id: 'G1', channels: { cache: new Map([['R1', { id: 'R1', name: '📜・reglas', type: ChannelType.GuildText }]]) } };
const boton = (payload) => payload.components[0].components[0].data;
const pro = { plan: 'pro', esPremium: true };

describe('panel «Preséntate» (utils/comunidad.js)', () => {
    it('sin personalizar sale el de siempre, en el idioma del bot, con el botón azul', () => {
        const es = comunidad.contenidoPanelPresentacion({ guildId: 'G1', idioma: 'es', colorEmbed: '#112233' }, guild);
        assert.strictEqual(es.embeds[0].data.title, '👋 ¡Preséntate a la comunidad!');
        assert.strictEqual(es.embeds[0].data.color, 0x112233);
        assert.strictEqual(boton(es).label, '📝 Presentarme');
        assert.strictEqual(boton(es).style, ButtonStyle.Primary);
        assert.strictEqual(boton(es).custom_id, 'intro_start:G1');
        assert.strictEqual(es.content, undefined);
        // Free: la marca de Sokyo en el pie, como siempre.
        assert.strictEqual(es.embeds[0].data.footer.text, 'Powered by Sokyo');

        const en = comunidad.contenidoPanelPresentacion({ guildId: 'G1', idioma: 'en', ...pro, footerPersonalizado: 'SokyoBOT management system' });
        assert.strictEqual(en.embeds[0].data.title, '👋 Introduce yourself to the community!');
        assert.strictEqual(boton(en).label, '📝 Introduce myself');
        assert.strictEqual(en.embeds[0].data.footer.text, 'SokyoBOT management system');
    });

    it('personalizado: texto, embed con GIF, canal enlazado y botón con su texto y color', () => {
        const panel = {
            contenido: 'Lee #reglas y preséntate',
            embed: { titulo: '¡Hola, nuevo!', descripcion: 'Antes, mira #reglas', color: '#ff0000', imagenUrl: 'https://media.tenor.com/x/hola.gif', campos: [] },
            textoBoton: '✍️ Contar algo de mí',
            estiloBoton: 'verde',
        };
        const p = comunidad.contenidoPanelPresentacion({ guildId: 'G1', idioma: 'es', ...pro, presentaciones: { panel } }, guild);
        assert.strictEqual(p.content, 'Lee <#R1> y preséntate');
        assert.strictEqual(p.embeds[0].data.title, '¡Hola, nuevo!');
        assert.strictEqual(p.embeds[0].data.description, 'Antes, mira <#R1>');
        assert.strictEqual(p.embeds[0].data.image.url, 'https://media.tenor.com/x/hola.gif');
        assert.strictEqual(boton(p).label, '✍️ Contar algo de mí');
        assert.strictEqual(boton(p).style, ButtonStyle.Success);
        assert.strictEqual(boton(p).custom_id, 'intro_start:G1'); // el botón sigue funcionando igual
        assert.deepStrictEqual(p.allowedMentions, { parse: [] }); // un mensaje fijo no avisa a nadie
        assert.strictEqual(panel.contenido, 'Lee #reglas y preséntate'); // no cambia lo guardado
    });

    it('un embed propio en un servidor Free lleva la marca de Sokyo', () => {
        const p = comunidad.contenidoPanelPresentacion({ guildId: 'G1', idioma: 'es', presentaciones: { panel: { embed: { titulo: 'Hola', campos: [] } } } });
        assert.strictEqual(p.embeds[0].data.footer.text, 'Powered by Sokyo');
    });

    it('botón vacío o color raro: los de fábrica', () => {
        const p = comunidad.contenidoPanelPresentacion({ guildId: 'G1', idioma: 'es', presentaciones: { panel: { contenido: 'Hola', textoBoton: '   ', estiloBoton: 'morado' } } });
        assert.strictEqual(p.content, 'Hola');
        assert.strictEqual(p.embeds[0].data.title, '👋 ¡Preséntate a la comunidad!');
        assert.strictEqual(boton(p).label, '📝 Presentarme');
        assert.strictEqual(boton(p).style, ButtonStyle.Primary);
    });
});

describe('panel «Nueva sugerencia» (utils/comunidad.js)', () => {
    it('de fábrica y personalizado', () => {
        const d = comunidad.contenidoPanelSugerencias({ guildId: 'G1', idioma: 'es' });
        assert.strictEqual(d.embeds[0].data.title, '💡 Sugerencias');
        assert.strictEqual(boton(d).label, '💡 Nueva sugerencia');
        assert.strictEqual(boton(d).custom_id, 'sug_nueva:G1');
        assert.strictEqual(boton(d).style, ButtonStyle.Primary);
        const p = comunidad.contenidoPanelSugerencias({ guildId: 'G1', idioma: 'en', sugerenciasPanel: { embed: { titulo: 'Ideas', descripcion: 'Tell us', campos: [] }, textoBoton: '🧠 Idea', estiloBoton: 'gris' } });
        assert.strictEqual(p.embeds[0].data.title, 'Ideas');
        assert.strictEqual(boton(p).label, '🧠 Idea');
        assert.strictEqual(boton(p).style, ButtonStyle.Secondary);
    });

    it('lo de fábrica para el editor lleva el pie del servidor, nunca «Powered by Sokyo»', () => {
        const cfg = { idioma: 'es', ...pro, footerPersonalizado: 'Mi marca' };
        const e = embedDeFabrica(comunidad.defectoPanelSugerencias(cfg), cfg);
        assert.strictEqual(e.titulo, '💡 Sugerencias');
        assert.strictEqual(e.footer, 'Mi marca');
        assert.deepStrictEqual(e.campos, []);
        // Free sin pie propio: vacío (si se guardara la marca en su embed, seguiría al pasar a Pro)…
        const free = { idioma: 'es', footerPersonalizado: '' };
        assert.strictEqual(embedDeFabrica(comunidad.defectoPanelSugerencias(free), free).footer, '');
        // …y al publicarlo el bot la pone igual.
        const p = comunidad.contenidoPanelSugerencias({ ...free, guildId: 'G1', sugerenciasPanel: { embed: embedDeFabrica(comunidad.defectoPanelSugerencias(free), free) } });
        assert.strictEqual(p.embeds[0].data.footer.text, 'Powered by Sokyo');
    });
});

describe('canal de sugerencias: abrir solo lo que cerró el bot (utils/comunidad.js)', () => {
    const { PermissionsBitField } = require('discord.js');
    const updateOriginal = ServidorConfig.updateOne;
    afterEach(() => { ServidorConfig.updateOne = updateOriginal; });
    function canalCon(denegado) {
        const reg = { permisos: [], sets: [], borrados: 0 };
        const everyone = { id: 'G1' };
        const canal = {
            isTextBased: () => true, guild: { roles: { everyone } },
            permissionOverwrites: {
                cache: new Map(denegado ? [['G1', { deny: new PermissionsBitField(PermissionsBitField.Flags.SendMessages) }]] : []),
                edit: async (_t, p) => { reg.permisos.push(p); },
            },
            messages: { fetch: async (id) => ({ id, delete: async () => { reg.borrados++; }, edit: async () => {} }) },
            send: async () => ({ id: 'M1' }),
        };
        ServidorConfig.updateOne = async (_f, u) => { reg.sets.push(u.$set); return {}; };
        return { client: { channels: { fetch: async () => canal } }, reg };
    }
    it('si el canal ya estaba cerrado por el staff, no se toca ni al entrar ni al salir', async () => {
        const { client, reg } = canalCon(true);
        await comunidad.publicarPanelSugerencias(client, 'G1', { guildId: 'G1', sugerenciasModo: 'formulario', canalSugerencias: 'C', sugerenciasPanel: {} });
        assert.deepStrictEqual(reg.permisos, []);
        assert.ok(reg.sets.some((x) => x['sugerenciasPanel.bloqueado'] === false));
        await comunidad.quitarPanelSugerencias(client, 'G1', { canalSugerencias: 'C', sugerenciasPanel: { bloqueado: false, mensajeId: 'M1' } });
        assert.deepStrictEqual(reg.permisos, []);
        assert.strictEqual(reg.borrados, 1); // el botón sí se quita
    });
    it('si lo cerró el bot (o es de antes de 1.9.14), se vuelve a abrir al salir', async () => {
        const { client, reg } = canalCon(false);
        await comunidad.publicarPanelSugerencias(client, 'G1', { guildId: 'G1', sugerenciasModo: 'formulario', canalSugerencias: 'C', sugerenciasPanel: {} });
        assert.deepStrictEqual(reg.permisos, [{ SendMessages: false }]);
        assert.ok(reg.sets.some((x) => x['sugerenciasPanel.bloqueado'] === true));
        await comunidad.quitarPanelSugerencias(client, 'G1', { canalSugerencias: 'C', sugerenciasPanel: { mensajeId: 'M1' } });
        assert.deepStrictEqual(reg.permisos.at(-1), { SendMessages: null });
    });
});

describe('guardar el mensaje (utils/panelMensaje.js: sanearPanel / mismoPanel)', () => {
    it('recorta, deja solo colores válidos y quita los embeds vacíos', () => {
        const p = sanearPanel({ contenido: 'x'.repeat(3000), textoBoton: `  ${'b'.repeat(100)}  `, estiloBoton: 'constructor', embed: { titulo: '', campos: [] }, otro: 1 });
        assert.strictEqual(p.contenido.length, 2000);
        assert.strictEqual(p.textoBoton.length, 80);
        assert.strictEqual(p.estiloBoton, null);
        assert.strictEqual(p.embed, null);
        assert.deepStrictEqual(Object.keys(p).sort(), ['contenido', 'embed', 'estiloBoton', 'textoBoton']);
        assert.deepStrictEqual(sanearPanel(null), { contenido: '', embed: null, textoBoton: null, estiloBoton: null });
    });
    it('guarda los campos a medias (para que el autoguardado no los borre)', () => {
        const p = sanearPanel({ embed: { campos: [{ nombre: 'Edad', valor: '' }] } });
        assert.strictEqual(p.embed.campos.length, 1);
    });
    it('sabe si cambia lo que se ve', () => {
        const a = { contenido: 'Hola', embed: null, textoBoton: '', estiloBoton: 'azul' };
        assert.ok(mismoPanel(a, { ...a, textoBoton: '   ' }));
        assert.ok(mismoPanel(undefined, { contenido: '', embed: { campos: [] } }));
        assert.ok(!mismoPanel(a, { ...a, estiloBoton: 'rojo' }));
        assert.ok(!mismoPanel(a, { ...a, embed: { titulo: 'Otro', campos: [] } }));
    });
});

// Canal de mentira: guarda qué se ha editado y qué se ha publicado.
function canalFalso(existentes = []) {
    const registro = { editados: [], enviados: [] };
    const canal = {
        isTextBased: () => true,
        messages: { fetch: async (id) => (existentes.includes(id) ? { id, edit: async (p) => { registro.editados.push({ id, p }); } } : Promise.reject(new Error('Unknown Message'))) },
        send: async (p) => { registro.enviados.push(p); return { id: `nuevo${registro.enviados.length}` }; },
    };
    return { canal, registro };
}

describe('publicar sin repetir (utils/panelMensaje.js: editarOPublicar)', () => {
    it('si ya está, lo reedita (quitando el texto y la imagen de antes)', async () => {
        const { canal, registro } = canalFalso(['M1']);
        const r = await editarOPublicar(canal, 'M1', { embeds: [] });
        assert.strictEqual(r.nuevo, false);
        assert.strictEqual(registro.enviados.length, 0);
        assert.deepStrictEqual(registro.editados[0].p, { content: null, embeds: [], attachments: [] });
    });
    it('si no está (o lo han borrado), publica uno nuevo; con soloEditar, nada', async () => {
        const { canal, registro } = canalFalso([]);
        const r = await editarOPublicar(canal, 'BORRADO', { content: 'hola' });
        assert.strictEqual(r.nuevo, true);
        assert.strictEqual(r.mensaje.id, 'nuevo1');
        const r2 = await editarOPublicar(canal, 'BORRADO', { content: 'hola' }, { soloEditar: true });
        assert.strictEqual(r2.mensaje, null);
        assert.strictEqual(registro.enviados.length, 1);
    });
});

describe('al cambiar el idioma, los paneles publicados se reescriben (utils/panelesPublicados.js)', () => {
    const findOneOriginal = ServidorConfig.findOne;
    afterEach(() => { ServidorConfig.findOne = findOneOriginal; });

    it('cada panel conocido se puede armar con una config de verdad', () => {
        const cfg = new ServidorConfig({ guildId: 'G1', idioma: 'es' }).toObject();
        for (const [nombre, , armar] of panelesPublicados._paneles()) {
            const p = armar(cfg, guild);
            assert.ok(p && (p.embeds || p.content), `${nombre}: sin mensaje`);
            assert.ok(Array.isArray(p.components), `${nombre}: sin botones`);
        }
    });

    it('solo edita lo que ya está publicado, en el idioma nuevo, y no publica nada', async () => {
        const { canal: canalIntro, registro: regIntro } = canalFalso(['P1']);
        const { canal: canalTickets, registro: regTickets } = canalFalso([]); // el de tickets lo han borrado
        const g = { id: 'G1', channels: { cache: new Map([['C1', canalIntro], ['C2', canalTickets]]) } };
        const client = { guilds: { cache: new Map([['G1', g]]) } };
        const doc = new ServidorConfig({
            guildId: 'G1', idioma: 'es',
            presentaciones: { activo: true, canalIntro: 'C1', panelMensajeId: 'P1' },
            panelTickets: { canalId: 'C2', mensajeId: 'T1' },
            sugerenciasModo: 'mensaje', canalSugerencias: 'C1', sugerenciasPanel: { mensajeId: 'S1' }, // no está en modo formulario
        });
        ServidorConfig.findOne = async () => doc;
        const hechos = await panelesPublicados.refrescarPanelesPublicados(client, 'G1');
        assert.deepStrictEqual(hechos, ['presentaciones']);
        assert.strictEqual(regIntro.editados.length, 1);
        assert.strictEqual(regIntro.editados[0].p.embeds[0].data.title, '👋 ¡Preséntate a la comunidad!');
        assert.strictEqual(regIntro.enviados.length + regTickets.enviados.length, 0);
    });

    it('«Deshacer» reescribe los paneles solo si toca cómo son', () => {
        assert.ok(panelesPublicados.afectaPaneles(['presentaciones.panel.textoBoton']));
        assert.ok(panelesPublicados.afectaPaneles(['sugerenciasPanel.embed.titulo', 'canalSugerencias']));
        assert.ok(panelesPublicados.afectaPaneles(['idioma']));
        assert.ok(!panelesPublicados.afectaPaneles(['presentaciones.preguntas', 'bienvenida.contenido', 'panelesX']));
        assert.ok(!panelesPublicados.afectaPaneles([]));
    });

    it('sin config o sin el servidor en el bot, no hace nada', async () => {
        ServidorConfig.findOne = async () => null;
        assert.deepStrictEqual(await panelesPublicados.refrescarPanelesPublicados({ guilds: { cache: new Map() } }, 'G1'), []);
    });
});

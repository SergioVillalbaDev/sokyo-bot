// ============================================================================
// Tests de la 1.9.6: el panel público de la Doble bienvenida («¡Bienvenido al
// servidor!» + «🚀 Empezar») y el de verificación se personalizan enteros: texto,
// embed con imágenes/GIF, «#canal» como enlace y el botón (texto y color).
// Solo la parte que arma el mensaje, sin Discord ni base de datos.
// ============================================================================
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { ButtonStyle, ChannelType } = require('discord.js');

const embudo = require('../utils/embudo.js');
const verificacion = require('../utils/verificacion.js');
const { sanearEstiloBoton, estiloBoton } = require('../utils/embeds.js');

const cfg = { idioma: 'es' };
const guild = { id: 'G1', channels: { cache: new Map([['R1', { id: 'R1', name: '📜・reglas', type: ChannelType.GuildText }]]) } };
const boton = (payload) => payload.components[0].components[0].data;

describe('panel de la Doble bienvenida (utils/embudo.js)', () => {
    it('sin personalizar, sale el de siempre con «🚀 Empezar» en verde', () => {
        const p = embudo.contenidoPanel('G1', { varianteB: { color: '#5865F2' } }, cfg, guild);
        assert.strictEqual(p.embeds[0].data.title, '👋 ¡Bienvenido al servidor!');
        assert.strictEqual(boton(p).label, '🚀 Empezar');
        assert.strictEqual(boton(p).style, ButtonStyle.Success);
        assert.strictEqual(boton(p).custom_id, 'embudo_inicio:G1');
        assert.strictEqual(p.content, undefined);
    });

    it('personalizado: texto, embed con GIF, canal enlazado y botón con su texto y color', () => {
        const panel = {
            contenido: 'Hola, lee #reglas antes de entrar',
            embed: { titulo: 'Bienvenido a Nébula', descripcion: 'Mira #reglas', color: '#ff0000', imagenUrl: 'https://media.tenor.com/x/bienvenida.gif', campos: [] },
            textoBoton: '🎮 Quiero jugar',
            estiloBoton: 'azul',
        };
        const p = embudo.contenidoPanel('G1', { panel, varianteB: {} }, cfg, guild);
        assert.strictEqual(p.content, 'Hola, lee <#R1> antes de entrar');
        assert.strictEqual(p.embeds[0].data.title, 'Bienvenido a Nébula');
        assert.strictEqual(p.embeds[0].data.description, 'Mira <#R1>');
        assert.strictEqual(p.embeds[0].data.image.url, 'https://media.tenor.com/x/bienvenida.gif');
        assert.strictEqual(boton(p).label, '🎮 Quiero jugar');
        assert.strictEqual(boton(p).style, ButtonStyle.Primary);
        // Un panel fijo no avisa a nadie.
        assert.deepStrictEqual(p.allowedMentions, { parse: [] });
        // No cambia lo guardado.
        assert.strictEqual(panel.contenido, 'Hola, lee #reglas antes de entrar');
    });

    it('solo con texto propio (sin embed), el texto va encima del embed de siempre', () => {
        const p = embudo.contenidoPanel('G1', { panel: { contenido: '¡Hola!', embed: null, textoBoton: '   ', estiloBoton: 'rojo' }, varianteB: {} }, cfg, guild);
        assert.strictEqual(p.content, '¡Hola!');
        assert.strictEqual(p.embeds[0].data.title, '👋 ¡Bienvenido al servidor!');
        assert.strictEqual(boton(p).label, '🚀 Empezar');
        assert.strictEqual(boton(p).style, ButtonStyle.Danger);
    });
});

describe('panel de verificación (utils/verificacion.js)', () => {
    it('el botón usa el color elegido y el embed enlaza los canales', () => {
        const p = verificacion.contenidoPanel({ textoBoton: '✅ Entrar', estiloBoton: 'gris', embed: { titulo: 'Verificación', descripcion: 'Lee #reglas', campos: [] } }, cfg, guild);
        assert.strictEqual(boton(p).label, '✅ Entrar');
        assert.strictEqual(boton(p).style, ButtonStyle.Secondary);
        assert.strictEqual(p.embeds[0].data.description, 'Lee <#R1>');
    });
    it('sin color guardado (paneles de antes), verde', () => {
        const p = verificacion.contenidoPanel({ textoBoton: '✅ Verificarme' }, cfg, guild);
        assert.strictEqual(boton(p).style, ButtonStyle.Success);
    });
});

describe('colores de botón', () => {
    it('solo verde, azul, gris o rojo; cualquier otra cosa es verde', () => {
        assert.deepStrictEqual(['verde', 'azul', 'gris', 'rojo'].map(sanearEstiloBoton), ['verde', 'azul', 'gris', 'rojo']);
        assert.strictEqual(sanearEstiloBoton('morado'), 'verde');
        assert.strictEqual(sanearEstiloBoton('constructor'), 'verde');
        assert.strictEqual(sanearEstiloBoton(undefined), 'verde');
        assert.strictEqual(estiloBoton('__proto__'), ButtonStyle.Success);
    });
});

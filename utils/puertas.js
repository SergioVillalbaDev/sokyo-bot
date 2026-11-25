// 🚪 Puertas (1.34.0): /jugar, /mascotas, /comunidad. En vez de 13 comandos sueltos, tres «puertas»: al escribir
// /jugar, Discord enseña lo que hay dentro (cofre, carta, combate…). Se construyen SOLAS con los comandos de siempre
// (slash/chest.js, card.js…) según las `partes` de utils/catalogo.js: un comando con subcomandos pasa a ser un grupo
// (/jugar cofre abrir) y uno sin ellos, un subcomando (/jugar pase). Al usarlas se llama al comando de siempre con
// una interacción adaptada (`adaptar`), así todo funciona igual que antes y nada se duplica.
const fs = require('fs');
const path = require('path');
const C = require('./catalogo.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });
// Nombre dentro de la puerta cuando no vale el del comando (companion → «ver»).
const RENOMBRE = { companion: { en: 'view', es: 'ver' } };
const PUERTAS = {
    jugar: { en: 'games', es: 'jugar', desc: { en: '🎮 Play: chests, cards, battles, market, pass and profile', es: '🎮 Jugar: cofres, cartas, combates, mercado, pase y perfil' } },
    mascotas: { en: 'pets', es: 'mascotas', desc: { en: '🐾 My pets: see them, farm, house, nursery and group expeditions', es: '🐾 Mis mascotas: verlas, granja, casa, guardería y expediciones en grupo' } },
    comunidad: { en: 'community', es: 'comunidad', desc: { en: '🏘️ Community: server pet, League, pranks and seasons', es: '🏘️ Comunidad: mascota del servidor, Liga, bromas y temporadas' } },
};

let cache = null;
function comandos() {
    if (cache) return cache;
    cache = new Map();
    const dir = path.join(__dirname, '..', 'slash');
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
        const m = require(path.join(dir, f));
        if (m.data && m.execute && !m.esPuerta) cache.set(m.data.name, m);
    }
    return cache;
}
// Las partes de una puerta: [{ cmd, nombre (en), es, modulo }].
function partesDe(puerta) {
    const out = [];
    for (const m of C.MODULOS) for (const [p, cmd] of m.partes || []) if (p === puerta) {
        const j = comandos().get(cmd)?.data.toJSON();
        if (!j) continue;
        const r = RENOMBRE[cmd];
        out.push({ cmd, nombre: r?.en || j.name, es: r?.es || j.name_localizations?.['es-ES'] || j.name, modulo: m });
    }
    return out;
}
// JSON de la puerta para registrar (solo las partes activas si se pasa cfg; todas si no).
function jsonPuerta(puerta, cfg = null) {
    const P = PUERTAS[puerta];
    const options = [];
    for (const parte of partesDe(puerta)) {
        if (cfg && !parte.modulo.activo(cfg)) continue;
        const j = comandos().get(parte.cmd).data.toJSON();
        const subs = (j.options || []).filter((o) => o.type === 1);
        options.push({
            type: subs.length ? 2 : 1, name: parte.nombre, name_localizations: ES(parte.es),
            description: j.description, description_localizations: j.description_localizations,
            options: subs.length ? subs : (j.options || []),
        });
    }
    if (!options.length) return null;
    return { type: 1, name: P.en, name_localizations: ES(P.es), description: P.desc.en, description_localizations: ES(P.desc.es), contexts: [0], integration_types: [0], options };
}

// La interacción tal cual, pero como si fuera el comando de siempre (su nombre y su subcomando).
function adaptar(interaction, nombre, sub) {
    const o = interaction.options;
    const opciones = new Proxy(o, {
        get(obj, prop) {
            if (prop === 'getSubcommand') return () => sub;
            if (prop === 'getSubcommandGroup') return () => null;
            const v = obj[prop];
            return typeof v === 'function' ? v.bind(obj) : v;
        },
    });
    return new Proxy(interaction, {
        get(obj, prop) {
            if (prop === 'options') return opciones;
            if (prop === 'commandName') return nombre;
            const v = obj[prop];
            return typeof v === 'function' ? v.bind(obj) : v;
        },
    });
}
// Qué comando de siempre y qué subcomando corresponden a lo que se ha escrito.
function destino(puerta, interaction) {
    const grupo = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand(false);
    const parte = partesDe(puerta).find((p) => p.nombre === (grupo || sub));
    if (!parte) return null;
    return { parte, comando: comandos().get(parte.cmd), sub: grupo ? sub : null };
}

function crearPuerta(puerta) {
    const P = PUERTAS[puerta];
    return {
        esPuerta: true,
        puerta,
        data: { name: P.en, toJSON: () => jsonPuerta(puerta) },
        async execute(interaction, client, cfg) {
            const d = destino(puerta, interaction);
            const { t } = require('./i18n.js');
            const idioma = await require('./preferencias.js').idiomaInteraccion(interaction, cfg).catch(() => 'es');
            if (!d) return interaction.reply({ content: t(idioma, 'Eso ya no está aquí: mira `/menu`.', 'That’s no longer here: see `/menu`.'), flags: 64 });
            if (!d.parte.modulo.activo(cfg)) {
                return interaction.reply({ content: t(idioma, `${d.parte.modulo.emoji} **${d.parte.modulo.es}** está apagado en este servidor. Un admin puede encenderlo con \`/configurar\`.`, `${d.parte.modulo.emoji} **${d.parte.modulo.en}** is turned off on this server. An admin can turn it on with \`/configure\`.`), flags: 64 });
            }
            return d.comando.execute(adaptar(interaction, d.parte.cmd, d.sub), client, cfg);
        },
        async autocomplete(interaction, client, cfg) {
            const d = destino(puerta, interaction);
            if (!d || typeof d.comando.autocomplete !== 'function') return interaction.respond([]).catch(() => {});
            return d.comando.autocomplete(adaptar(interaction, d.parte.cmd, d.sub), client, cfg);
        },
    };
}

// Cómo se escribe una parte en cada idioma: «/jugar cofre» · «/games chest».
function rutaDe(cmd, idioma = 'es') {
    for (const puerta of Object.keys(PUERTAS)) {
        const p = partesDe(puerta).find((x) => x.cmd === cmd);
        if (p) return idioma === 'en' ? `/${PUERTAS[puerta].en} ${p.nombre}` : `/${PUERTAS[puerta].es} ${p.es}`;
    }
    return null;
}

module.exports = { PUERTAS, partesDe, jsonPuerta, crearPuerta, adaptar, rutaDe, comandos };

// 🪟 Una sola ventana (2.5.0). Lo que solo ves tú se queda en UN mensaje que cambia en su sitio, en vez de ir
// dejando mensajes «Solo tú puedes ver esto» uno debajo de otro (y tener que bajar a buscar qué ha puesto).
// Se pone solo, como la fila de navegación (utils/navegacion.js): `preparar` adapta reply/deferReply/editReply/
// followUp/deleteReply de la interacción antes de que la maneje nadie (events/interactionCreate.js).
//
// 1) En tu ventana (botón, menú o formulario de un mensaje privado):
//    - Lo que el código contestaría en privado con una vista (embed, imagen o botones) CAMBIA ese mismo mensaje
//      (reply → update, deferReply → deferUpdate; lo que no dice, se vacía: era un mensaje nuevo).
//    - Un texto suelto (un aviso: «No tienes oro», «✅ Hecho») sale ENCIMA de la vista, sin borrarla, y se quita
//      solo al pulsar otra cosa. Lo mismo un followUp privado de texto.
//    - `deleteReply()` tras un deferReply convertido no borra tu ventana.
// 2) Desde cualquier otro sitio (un comando, el lobby público…): al abrirte una ventana nueva de una función se
//    borra la anterior DE ESA MISMA FUNCIÓN que tenías en ese canal (casino con casino, menú con menú…; si Discord
//    aún deja: 15 min desde que la tocaste), y tu último aviso suelto. Nunca si tienes una partida a medias en ese
//    servidor (`registrarEnMarcha`). Así no se amontonan, y lo que tengas a medias de otra función no se pierde.
// Solo en lo de jugar (juegos, mascotas, comunidad, tu menú, la tienda, tus preferencias y recordatorios): las
// ventanas del staff (confirmar un cierre, asistentes de configuración…) siguen como siempre.
// Para que algo salga aparte a propósito: `{ aparte: true }` en lo que se manda.
const VIDA_MS = 14 * 60000; // Discord deja editar/borrar con la interacción 15 min
// La entrada al servidor (pasos con su propio orden) y «Abrir mi cuenta» (un enlace de un solo uso: mejor aparte, que
// no se lleve por delante el menú en el que estabas).
const EXCLUIDOS = /^(verif_|embudo_|entq_|entv_|intro_|cuenta:abrir)/;

const registro = new Map(); // `${userId}:${canalId}:${función}` → { interaction, quitar, en }  (tu ventana de esa función)
const avisos = new Map();   // `${userId}:${canalId}` → { interaction, quitar, mensaje, en }  (tu último aviso suelto)
const notas = new Map();    // id del mensaje → id de la interacción que puso el aviso encima
const comprobadores = [];   // (userId, guildId) => true si tiene algo en marcha en una ventana

function esEfimero(o) {
    if (!o || typeof o !== 'object') return false;
    if (o.ephemeral === true) return true;
    const f = o.flags;
    if (typeof f === 'number' || typeof f === 'bigint') return (Number(f) & 64) === 64;
    if (Array.isArray(f)) return f.some((x) => x === 64 || x === 'Ephemeral');
    if (f && typeof f.has === 'function') { try { return f.has(64); } catch (_) { return false; } }
    return false;
}
const comoObjeto = (p) => (typeof p === 'string' ? { content: p } : (p || {}));
const longitud = (x) => (Array.isArray(x) ? x.length : 0);
function esVista(p) {
    const o = comoObjeto(p);
    if (longitud(o.embeds) || longitud(o.files)) return true;
    // Un error con su botón «❔» sigue siendo un aviso.
    return longitud(o.components) > 0 && !/^(❌|⚠️)/.test(String(o.content || ''));
}
// Lo que se manda al mensaje que ya existe: como era un mensaje nuevo, lo que no dice va vacío.
function llenar(p) {
    const o = { ...comoObjeto(p) };
    delete o.flags; delete o.ephemeral; delete o.aparte;
    return {
        ...o,
        content: o.content ?? '',
        embeds: o.embeds ?? [],
        components: o.components ?? [],
        attachments: o.attachments ?? [],
        ...(o.files ? { files: o.files } : {}),
    };
}
const sinAparte = (p) => { if (!p || typeof p !== 'object' || !('aparte' in p)) return p; const { aparte, ...r } = p; return r; };
const tieneEnMarcha = (userId, guildId) => comprobadores.some((f) => { try { return !!f(userId, guildId); } catch (_) { return false; } });
const vigente = (x) => x && Date.now() - x.en < VIDA_MS;
// Lo que ya no se puede borrar (más de 15 min) no sirve: fuera. Y un tope por si acaso (la Pi tiene poca memoria).
function recortar(m, max = 2000) {
    if (m.size > 200) for (const [k, x] of m) if (x && typeof x === 'object' && !vigente(x)) m.delete(k);
    while (m.size > max) m.delete(m.keys().next().value);
}

// ¿De qué función de jugar es? (null = staff u otra cosa: no se toca). Las ventanas se sustituyen por función.
const PROPIOS = [[/^(menu:|emp:)/, 'menu'], [/^tnd_/, 'oro'], [/^ayu_/, 'ayuda'], [/^pref:/, 'preferencias'], [/^rec_/, 'recordatorios']];
const COMANDOS = { menu: 'menu', start: 'menu', help: 'ayuda', preferences: 'preferencias', reminders: 'recordatorios' };
function familiaDe(interaction) {
    const id = interaction.customId || '';
    const propio = PROPIOS.find(([re]) => re.test(id));
    if (propio) return propio[1];
    if (interaction.isChatInputCommand?.() && COMANDOS[interaction.commandName]) return COMANDOS[interaction.commandName];
    try { return require('./navegacion.js').moduloDe(interaction)?.id || null; } catch (_) { return null; }
}
const esDeJuego = (interaction) => !!familiaDe(interaction);

// Borra la ventana (o el aviso) anterior de esa persona en ese canal, si aún se puede.
// `quitar` es el deleteReply de discord.js de esa interacción (el adaptado no borraría una ventana convertida).
function borrar(x) {
    if (!vigente(x)) return;
    Promise.resolve().then(() => (x.mensaje ? x.quitar(x.mensaje) : x.quitar())).catch(() => {});
}
function abrirVentana(interaction, quitar, clave, familia) {
    const antes = registro.get(`${clave}:${familia}`);
    registro.set(`${clave}:${familia}`, { interaction, quitar, en: Date.now() });
    recortar(registro);
    const aviso = avisos.get(clave);
    if (aviso && aviso.interaction !== interaction) { avisos.delete(clave); borrar(aviso); }
    if (!antes || antes.interaction === interaction) return;
    if (tieneEnMarcha(interaction.user.id, interaction.guildId)) return;
    borrar(antes);
}
function nuevoAviso(interaction, quitar, clave, mensaje = null) {
    const antes = avisos.get(clave);
    avisos.set(clave, { interaction, quitar, mensaje, en: Date.now() });
    recortar(avisos);
    if (antes && !(antes.interaction === interaction && antes.mensaje === mensaje)) borrar(antes);
}

function preparar(interaction) {
    if (!interaction || interaction.__ventana || !interaction.guildId || !interaction.user) return;
    interaction.__ventana = true;
    const componente = interaction.isMessageComponent?.() || (interaction.isModalSubmit?.() && interaction.isFromMessage?.());
    const msg = componente ? interaction.message : null;
    const familia = familiaDe(interaction);
    const deJuego = !!familia;
    if (!deJuego) return;
    const enVentana = !!msg?.flags?.has?.(64) && !EXCLUIDOS.test(interaction.customId || '');
    const clave = `${interaction.user.id}:${interaction.channelId}`;
    const o = {};
    for (const k of ['reply', 'deferReply', 'editReply', 'followUp', 'deleteReply', 'update', 'deferUpdate']) {
        if (typeof interaction[k] === 'function') o[k] = interaction[k].bind(interaction);
    }
    let enSitio = false;    // reply/deferReply se han convertido: la respuesta es tu ventana
    let primera = true;     // solo el primer contenido tras un deferReply convertido sustituye la vista entera
    let alMensaje = false;  // esta interacción contesta en el mismo mensaje (update/deferUpdate)
    let pendiente = false;  // deferReply privado de una ventana nueva: se decide al llegar el contenido
    // Al cambiar tu ventana por otra cosa, el aviso que puso otra pulsación se quita.
    const limpiar = (p) => {
        if (!msg || !alMensaje || !notas.has(msg.id) || notas.get(msg.id) === interaction.id) return p;
        const x = comoObjeto(p);
        notas.delete(msg.id);
        return x.content === undefined ? { ...x, content: '' } : p;
    };
    const ponerNota = (texto, via) => {
        notas.set(msg.id, interaction.id); recortar(notas);
        return via === 'update' ? o.update({ content: texto }) : o.editReply({ content: texto });
    };
    const texto = (p) => String(comoObjeto(p).content || '').slice(0, 2000) || '✅';
    const quitar = (m) => (o.deleteReply ? o.deleteReply(m) : undefined);
    const enMiVentana = () => { if (enVentana) { registro.set(`${clave}:${familia}`, { interaction, quitar, en: Date.now() }); recortar(registro); } };

    if (o.update) interaction.update = async (p, ...r) => { alMensaje = true; enMiVentana(); return o.update(limpiar(sinAparte(p)), ...r); };
    if (o.deferUpdate) interaction.deferUpdate = async (...r) => { alMensaje = true; enMiVentana(); return o.deferUpdate(...r); };

    interaction.reply = async (p, ...r) => {
        const aparte = !!(p && typeof p === 'object' && p.aparte);
        if (enVentana && o.update && esEfimero(p) && !aparte && !interaction.replied && !interaction.deferred) {
            enSitio = true; alMensaje = true; enMiVentana();
            // Lo que edite después ya parte de esta vista: no se vuelve a vaciar (ver editReply).
            if (esVista(p)) { notas.delete(msg.id); primera = false; return o.update(llenar(p)); }
            return ponerNota(texto(p), 'update');
        }
        const res = await o.reply(sinAparte(p), ...r);
        if (deJuego && esEfimero(p) && !aparte) {
            if (esVista(p)) abrirVentana(interaction, quitar, clave, familia); else nuevoAviso(interaction, quitar, clave);
        }
        return res;
    };
    interaction.deferReply = async (opts, ...r) => {
        if (enVentana && o.deferUpdate && esEfimero(opts) && !interaction.replied && !interaction.deferred) {
            enSitio = true; alMensaje = true; enMiVentana();
            return o.deferUpdate();
        }
        const res = await o.deferReply(opts, ...r);
        if (deJuego && esEfimero(opts)) pendiente = true;
        return res;
    };
    interaction.editReply = async (p, ...r) => {
        if (enSitio) {
            if (!esVista(p) && comoObjeto(p).content !== undefined) return ponerNota(texto(p), 'editReply');
            notas.delete(msg.id);
            // Lo siguiente (p. ej., el crash subiendo cada segundo) edita lo suyo: no se vacía la imagen.
            if (!primera) return o.editReply(p, ...r);
            primera = false;
            return o.editReply(llenar(p), ...r);
        }
        const res = await o.editReply(limpiar(sinAparte(p)), ...r);
        if (pendiente) { pendiente = false; if (esVista(p)) abrirVentana(interaction, quitar, clave, familia); else nuevoAviso(interaction, quitar, clave); }
        return res;
    };
    interaction.followUp = async (p, ...r) => {
        const aparte = !!(p && typeof p === 'object' && p.aparte);
        if (enVentana && alMensaje && esEfimero(p) && !esVista(p) && !aparte) return ponerNota(texto(p), 'editReply');
        const res = await o.followUp(sinAparte(p), ...r);
        if (deJuego && esEfimero(p) && !aparte && !esVista(p) && res?.id) nuevoAviso(interaction, quitar, clave, res.id);
        return res;
    };
    interaction.deleteReply = async (m, ...r) => {
        if (enSitio && (m === undefined || m === '@original')) return undefined; // no se borra tu ventana
        return o.deleteReply(m, ...r);
    };
}

// Tras un deferUpdate, el primer contenido que pinta un juego está hecho para un mensaje nuevo: se vacía lo de antes
// (texto, imagen) solo esa vez; lo que venga después (el crash subiendo) edita lo suyo.
function primerContenidoLimpio(interaction) {
    const editar = interaction.editReply.bind(interaction);
    let primera = true;
    interaction.editReply = (p, ...r) => {
        if (!primera || !p || typeof p !== 'object') return editar(p, ...r);
        primera = false;
        return editar({ content: '', attachments: [], ...p, ...(p.files || p.attachments ? {} : { files: [] }) }, ...r);
    };
}
// Para lo que «abre otro» o «juega otra vez» (casino, cofres, sobres): en tu ventana o en tu propio mensaje
// público, sale en ESE mensaje; si no, como siempre (un mensaje nuevo; en privado con `privado: true`).
// En tu ventana, lo que se mande luego con followUp también es solo para ti (y sale como aviso encima).
// Devuelve { enSitio, privado }; con enSitio no hay que borrar la respuesta si algo falla (sería tu mensaje).
async function responderJuego(interaction, { privado = false } = {}) {
    const msg = interaction.message;
    const enVentana = !!msg?.flags?.has?.(64);
    const autor = msg?.interactionMetadata?.user?.id || msg?.interaction?.user?.id || null;
    const mia = !!msg && !enVentana && !!autor && autor === interaction.user.id && interaction.isButton?.();
    if (enVentana || mia) {
        await interaction.deferUpdate();
        primerContenidoLimpio(interaction);
        if (enVentana) {
            interaction.__casinoPrivado = true;
            const seguir = interaction.followUp.bind(interaction);
            interaction.followUp = (p, ...r) => seguir(typeof p === 'string' ? { content: p, flags: 64 } : { ...p, flags: 64 }, ...r);
        }
        return { enSitio: true, privado: enVentana };
    }
    await interaction.deferReply(privado ? { flags: 64 } : undefined);
    if (privado) interaction.__casinoPrivado = true;
    return { enSitio: false, privado };
}
// El error solo para quien juega; si se jugaba en el mismo mensaje, ese se queda como estaba.
async function falloJuego(interaction, modo, texto) {
    if (!modo?.enSitio) await interaction.deleteReply().catch(() => {});
    await interaction.followUp({ content: texto, flags: 64 }).catch(() => {});
}

// Lo usa quien tiene partidas en una ventana (casino…): mientras devuelva true, esa ventana no se borra.
const registrarEnMarcha = (f) => { if (typeof f === 'function' && !comprobadores.includes(f)) comprobadores.push(f); };

module.exports = { preparar, registrarEnMarcha, responderJuego, falloJuego, primerContenidoLimpio, esEfimero, esVista, llenar, _registro: registro, _avisos: avisos, _notas: notas };

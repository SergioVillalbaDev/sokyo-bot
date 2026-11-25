// 🤖 Simulador de Discord (2.0.1): prueba el bot entero sin Discord.
//   docker run -d --name mongo7 -p 27017:27017 mirror.gcr.io/library/mongo:7 --replSet rs0
//   docker exec mongo7 mongosh --quiet --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
//   node scripts/simulador/simular.js            (informe en scripts/simulador/informe.txt, fuera de git)
// 1) Monta un servidor con la configuración rápida del propio bot (todos los módulos) y la tienda.
// 2) Lanza CADA comando que vería ese servidor (utils/comandosServidor.comandosPara) con sus opciones,
//    pasando por events/interactionCreate.js como en Discord.
// 3) Cada respuesta se valida con los límites de Discord (scripts/simulador/validar.js) y se pulsan, en
//    cadena, los botones, menús y ventanas que salen.
// Las interacciones siguen las reglas de discord.js: responder dos veces, editar sin responder o tardar
// más de 3 s en contestar se apuntan como fallos. También los console.error y los «Algo ha ido mal».
const path = require('path');
const fs = require('fs');
const RAIZ = path.join(__dirname, '..', '..');
process.chdir(RAIZ);
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'https://dashboard.sokyo.studio';
process.env.TOPGG_WEBHOOK_AUTH = process.env.TOPGG_WEBHOOK_AUTH || 'x';
const mongoose = require('mongoose');
const { PermissionsBitField } = require('discord.js');
const { crearCliente, normalizar, crearMensaje, nuevoId } = require('./discordFalso.js');
const { validarMensaje, validarModal } = require('./validar.js');

const MAX = Number(process.env.SIM_MAX || 4000);
const PROFUNDIDAD = Number(process.env.SIM_PROF || 6);
const LENTO_MS = 3000;
const fallos = [];
let actual = '';
const fallo = (tipo, txt) => fallos.push({ tipo, donde: actual, txt: String(txt).slice(0, 400) });

// console.error/warn del bot → fallos (con la interacción en curso)
const errorOriginal = console.error;
const avisoOriginal = console.warn;
console.error = (...a) => fallo('console.error', a.map((x) => (x?.stack || x?.message || String(x))).join(' ').split('\n').slice(0, 3).join(' | '));
console.warn = (...a) => { const s = a.map(String).join(' '); if (!/Navegación|deprecat/i.test(s)) fallo('console.warn', s); };
console.log = () => {};
process.on('unhandledRejection', (e) => fallo('promesa sin capturar', e?.stack?.split('\n').slice(0, 3).join(' | ') || e));

const MALOS = /Algo ha ido mal|Algo ha fallado|Something went wrong|Ha ocurrido un error|An error occurred/i;

function revisarSalida(payload, donde, { editar = false } = {}) {
    const n = normalizar(payload);
    if (editar) n.__editar = true;
    if (editar && n.content === undefined && !n.embeds && !n.components && !n.files) return n;
    if (editar) n.__permitirVacio = true;
    for (const m of validarMensaje(n, { donde: `${donde}: ` })) fallo('Discord lo rechazaría', m);
    const texto = [n.content, ...(n.embeds || []).map((e) => `${e?.title || ''} ${e?.description || ''}`)].join(' ');
    if (MALOS.test(texto)) fallo('mensaje de error', texto.slice(0, 200));
    return n;
}

// ------------------------------------------------------------------ interacciones
function interaccionBase(sim, { usuario, canal, tipo }) {
    const { client, GA } = sim;
    const guild = canal.guild || GA;
    const member = guild.members.cache.get(usuario.id);
    const i = {
        id: nuevoId(), type: tipo, client, user: usuario, member, guild, guildId: guild.id, channel: canal, channelId: canal.id,
        locale: 'es-ES', guildLocale: 'es-ES', createdTimestamp: Date.now(), replied: false, deferred: false, ephemeral: null,
        memberPermissions: member?.permissions || new PermissionsBitField(0n), appPermissions: new PermissionsBitField(PermissionsBitField.All),
        _inicio: Date.now(), _primera: null, _salidas: [], _mensaje: null,
        inGuild: () => true, inCachedGuild: () => true, isRepliable: () => true,
        isChatInputCommand: () => false, isCommand: () => false, isButton: () => false, isStringSelectMenu: () => false, isSelectMenu: () => false,
        isAnySelectMenu: () => false, isUserSelectMenu: () => false, isRoleSelectMenu: () => false, isChannelSelectMenu: () => false,
        isMentionableSelectMenu: () => false, isModalSubmit: () => false, isAutocomplete: () => false, isContextMenuCommand: () => false,
        isUserContextMenuCommand: () => false, isMessageContextMenuCommand: () => false, isMessageComponent: () => false, isFromMessage: () => false,
    };
    const marcar = () => { if (i._primera == null) { i._primera = Date.now() - i._inicio; if (i._primera > LENTO_MS) fallo('lento', `primera respuesta a los ${i._primera} ms (Discord da 3000)`); } };
    const nuevo = (p) => { const m = crearMensaje(canal, p, client.user); canal.messages.cache.set(m.id, m); i._salidas.push(m); return m; };
    i.reply = async (p) => {
        if (i.replied || i.deferred) { fallo('responde dos veces', 'reply() después de responder'); throw Object.assign(new Error('The reply to this interaction has already been sent or deferred.'), { code: 'InteractionAlreadyReplied' }); }
        marcar(); revisarSalida(p, 'reply'); i.replied = true; i.ephemeral = !!(p?.flags & 64 || p?.ephemeral);
        const m = nuevo(p); i._mensaje = m; return m;
    };
    i.deferReply = async (o) => {
        if (i.replied || i.deferred) { fallo('responde dos veces', 'deferReply() después de responder'); throw new Error('InteractionAlreadyReplied'); }
        marcar(); i.deferred = true; i.ephemeral = !!(o?.flags & 64 || o?.ephemeral); i._mensaje = nuevo({ content: '…', __permitirVacio: true }); return i._mensaje;
    };
    i.editReply = async (p) => {
        if (!i.replied && !i.deferred) { fallo('edita sin responder', 'editReply() sin reply/defer'); throw Object.assign(new Error('The reply to this interaction has not been sent or deferred.'), { code: 'InteractionNotReplied' }); }
        revisarSalida(p, 'editReply', { editar: i._mensaje?.content !== '…' || i.replied }); i.replied = true;
        if (i._mensaje) { await i._mensaje.edit(p); if (i._mensaje.content === '…' && !normalizar(p).content) i._mensaje.content = ''; }
        else i._mensaje = nuevo(p);
        if (!i._salidas.includes(i._mensaje)) i._salidas.push(i._mensaje);
        else { i._salidas = i._salidas.filter((x) => x !== i._mensaje); i._salidas.push(i._mensaje); }
        return i._mensaje;
    };
    i.fetchReply = async () => i._mensaje;
    i.deleteReply = async () => { if (!i.replied && !i.deferred) fallo('borra sin responder', 'deleteReply()'); };
    i.followUp = async (p) => {
        if (!i.replied && !i.deferred) { fallo('followUp sin responder', 'followUp() antes de reply'); throw new Error('InteractionNotReplied'); }
        revisarSalida(p, 'followUp'); return nuevo(p);
    };
    i.showModal = async (m) => {
        if (i.replied || i.deferred) { fallo('responde dos veces', 'showModal() después de responder'); throw new Error('InteractionAlreadyReplied'); }
        marcar(); const j = m?.toJSON ? m.toJSON() : m;
        for (const x of validarModal(j)) fallo('Discord lo rechazaría', x);
        i.replied = true; i._modal = j;
    };
    i.respond = async () => { marcar(); };
    i.awaitModalSubmit = async () => { throw new Error('Collector received no interactions before ending with reason: time'); };
    return i;
}

function opcionesDe(lista) {
    const porNombre = new Map(lista.map((o) => [o.name, o]));
    const v = (n) => porNombre.get(n)?.value ?? null;
    const req = (n, r) => { if (r && !porNombre.has(n)) throw Object.assign(new Error(`Falta la opción obligatoria ${n}`), { code: 'CommandInteractionOptionNotFound' }); };
    return {
        data: lista,
        get: (n, r) => { req(n, r); return porNombre.get(n) || null; },
        getString: (n, r) => { req(n, r); return v(n); }, getInteger: (n, r) => { req(n, r); return v(n); }, getNumber: (n, r) => { req(n, r); return v(n); },
        getBoolean: (n, r) => { req(n, r); return v(n); }, getUser: (n, r) => { req(n, r); return porNombre.get(n)?.user ?? null; },
        getMember: (n) => porNombre.get(n)?.member ?? null, getChannel: (n, r) => { req(n, r); return porNombre.get(n)?.channel ?? null; },
        getRole: (n, r) => { req(n, r); return porNombre.get(n)?.role ?? null; }, getMentionable: (n) => porNombre.get(n)?.user ?? null,
        getAttachment: () => null, getFocused: () => '', resolved: {},
        _sub: null, _grupo: null,
        getSubcommand(r = true) { if (!this._sub && r) throw new Error('Falta subcomando'); return this._sub; },
        getSubcommandGroup(r = false) { if (!this._grupo && r) throw new Error('Falta grupo'); return this._grupo; },
    };
}

// Valor de ejemplo para una opción de comando.
function valorPara(o, sim) {
    const { GA, personas } = sim;
    const casino = GA.channels.cache.find((c) => c.name === 'casino');
    switch (o.type) {
        case 3: {
            if (o.choices?.length) return { value: o.choices[0].value };
            const n = o.name.toLowerCase();
            if (/time|tiempo|duration|duracion|when|cuando/.test(n)) return { value: '10m' };
            if (/color/.test(n)) return { value: '#ff8800' };
            if (/query|song|cancion|search|busca|url/.test(n)) return { value: 'lofi' };
            if (/amount|cantidad|bet|apuesta/.test(n)) return { value: '100' };
            if (/code|codigo/.test(n)) return { value: 'ABC123' };
            if (/emoji/.test(n)) return { value: '🐉' };
            if (/side|lado/.test(n)) return { value: 'cara' };
            return { value: 'prueba' };
        }
        case 4: case 10: { const min = o.min_value ?? 1; const max = o.max_value ?? 1e9; return { value: Math.min(max, Math.max(min, /bet|amount|apuesta|cantidad|entry|entrada/.test(o.name) ? 100 : (min > 1 ? min : 2))) }; }
        case 5: return { value: false };
        case 6: return { user: personas.eva, member: GA.members.cache.get(personas.eva.id), value: personas.eva.id };
        case 7: { const voz = (o.channel_types || []).includes(2); const c = voz ? GA.channels.cache.find((x) => x.type === 2) : casino; return { channel: c, value: c.id }; }
        case 8: { const r = GA.roles.cache.find((x) => x.name === 'VIP'); return { role: r, value: r.id }; }
        case 9: return { user: personas.eva, value: personas.eva.id };
        default: return null;
    }
}

// Todas las formas de llamar a un comando (una por subcomando), con sus opciones obligatorias.
function llamadas(json, sim) {
    const out = [];
    const rellenar = (ops) => (ops || []).filter((o) => o.required).map((o) => ({ name: o.name, type: o.type, ...valorPara(o, sim) }));
    const subs = (json.options || []).filter((o) => o.type === 1);
    const grupos = (json.options || []).filter((o) => o.type === 2);
    if (!subs.length && !grupos.length) out.push({ sub: null, grupo: null, ops: rellenar(json.options) });
    for (const s of subs) out.push({ sub: s.name, grupo: null, ops: rellenar(s.options) });
    for (const g of grupos) for (const s of g.options || []) out.push({ sub: s.name, grupo: g.name, ops: rellenar(s.options) });
    return out;
}

// ------------------------------------------------------------------ recorrido
async function main() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sokyo_sim?replicaSet=rs0&directConnection=true');
    await mongoose.connection.db.dropDatabase();
    const sim = crearCliente();
    const { client, GA, personas } = sim;
    for (const f of fs.readdirSync(path.join(RAIZ, 'slash')).filter((x) => x.endsWith('.js'))) {
        const c = require(path.join(RAIZ, 'slash', f));
        if (c.data) client.slashCommands.set(c.data.name, c);
    }
    const interactionCreate = require(path.join(RAIZ, 'events', 'interactionCreate.js'));
    const ServidorConfig = require(path.join(RAIZ, 'models', 'ServidorConfig.js'));
    await ServidorConfig.create({ guildId: GA.id, idioma: 'es' });
    await ServidorConfig.create({ guildId: sim.GB.id, idioma: 'en' });
    await require(path.join(RAIZ, 'utils', 'textosPorDefecto.js')).adaptarTextosAlIdioma(GA.id, 'es').catch(() => {});

    // 1) Configuración rápida con TODO (como un dueño que lo quiere todo).
    actual = 'setup rápido';
    const setup = require(path.join(RAIZ, 'utils', 'setupRapido.js'));
    const { respuestas, error } = setup.validar({ idioma: 'es', tipo: 'gaming', modulos: [...setup.MODULOS || []], rolStaffId: `${GA.id}1` }, GA);
    if (error) fallo('setup', error);
    else {
        const r = await setup.aplicar(client, GA, respuestas).catch((e) => { fallo('setup', e.stack); return null; });
        for (const d of r?.detalles || r?.resultado || []) if (d?.estado === 'error') fallo('setup', JSON.stringify(d));
    }
    // Lo que el setup no toca: pack anime, tienda, combates, dinámicas.
    const casino = GA.channels.cache.find((c) => c.name === 'casino');
    await ServidorConfig.updateOne({ guildId: GA.id }, { $set: {
        'compis.anime': true, 'tienda.activo': true,
        'tienda.productos': [{ id: 'p1', nombre: 'Color dorado', rolId: `${GA.id}2`, precio: 500, horas: 0, stock: null, activo: true, emoji: '🌈', descripcion: '' },
            { id: 'p2', nombre: 'VIP 7 días', rolId: `${GA.id}4`, precio: 800, horas: 168, stock: 5, activo: true, emoji: '👑', descripcion: '' }],
        'grupos.activo': true, 'confesiones.activo': true, 'confesiones.canalId': casino.id, 'casino.canalId': casino.id,
    } });
    require(path.join(RAIZ, 'utils', 'config.js')).invalidateConfig?.(GA.id);
    const eco = require(path.join(RAIZ, 'utils', 'economia.js')).en(GA.id);
    // leo es NUEVO (sin oro ni mascotas): así se prueba lo que ve alguien el primer día. Los demás, con oro de sobra.
    for (const p of [personas.ana, personas.dueno, personas.mod]) await eco.darOro(p.id, 200000);

    const cfg = await ServidorConfig.findOne({ guildId: GA.id }).lean();
    const CS = require(path.join(RAIZ, 'utils', 'comandosServidor.js'));
    const lista = [...CS.comandosPara(cfg), ...CS.comandosGlobales()];
    const vistos = new Set();
    const porPrefijo = new Map();
    const cola = [];
    let hechas = 0;

    const ejecutar = async (i, nombre) => {
        actual = nombre;
        const t0 = Date.now();
        try { await interactionCreate.execute(i, client); } catch (e) { fallo('excepción', e?.stack?.split('\n').slice(0, 3).join(' | ') || e); }
        await new Promise((r) => setTimeout(r, 30));
        if (process.env.SIM_TRANSCRIPCION && / \(leo\)$/.test(nombre)) {
            const resumen = (m) => [m.content, ...(m.embeds || []).map((e) => `[${e.title || ''}] ${e.description || ''} ${(e.fields || []).map((f) => `{${f.name}: ${f.value}}`).join(' ')}`), ...(m.components || []).map((f) => (f.components || []).map((c) => `(${c.label || c.placeholder || c.emoji?.name || c.custom_id})`).join(''))].filter(Boolean).join(' ').replace(/\s+/g, ' ');
            fs.appendFileSync(path.join(__dirname, 'transcripcion.txt'), `\n### ${nombre}\n${i._modal ? `VENTANA ${i._modal.title}` : i._salidas.map(resumen).join('\n---\n').slice(0, 1500)}\n`);
        }
        if (i._primera == null && !i._modal && i._salidas.length === 0) fallo('sin respuesta', `no contestó (${Date.now() - t0} ms): Discord diría «La aplicación no ha respondido»`);
        hechas++;
    };

    const encolar = (i, nivel, actor) => {
        if (nivel >= PROFUNDIDAD) return;
        for (const m of i._salidas) {
            for (const fila of m.components || []) {
                for (const c of fila.components || []) {
                    if (c.disabled || !c.custom_id || c.style === 5) continue;
                    const pref = c.custom_id.split(':')[0];
                    const n = porPrefijo.get(pref) || 0;
                    const firma = `${actor.id}|${c.custom_id.replace(/\d{15,}/g, '#').replace(/:[0-9a-f]{10}(?=:|$)/g, ':*')}`;
                    if (vistos.has(firma) || n >= 20) continue;
                    vistos.add(firma); porPrefijo.set(pref, n + 1);
                    cola.push({ c, mensaje: m, nivel: nivel + 1, actor, canal: i.channel });
                }
            }
        }
        if (i._modal) cola.push({ modal: i._modal, nivel: nivel + 1, actor, canal: i.channel, mensaje: i._mensaje });
    };

    // 2) Cada comando del servidor.
    for (const json of lista) {
        const admin = json.default_member_permissions != null && json.default_member_permissions !== '0';
        for (const actor of admin ? [personas.dueno] : [personas.leo, personas.ana]) for (const ll of llamadas(json, sim)) {
            const i = interaccionBase(sim, { usuario: actor, canal: casino, tipo: 2 });
            i.commandName = json.name; i.commandType = json.type || 1;
            i.isCommand = () => true;
            if ((json.type || 1) === 1) i.isChatInputCommand = () => true;
            else {
                i.isContextMenuCommand = () => true;
                if (json.type === 2) { i.isUserContextMenuCommand = () => true; i.targetUser = personas.leo; i.targetMember = GA.members.cache.get(personas.leo.id); i.targetId = personas.leo.id; }
                if (json.type === 3) {
                    const msj = await casino.send({ content: 'hola, esto es un mensaje de prueba para traducir y reportar' });
                    msj.author = personas.leo; msj.member = GA.members.cache.get(personas.leo.id);
                    i.isMessageContextMenuCommand = () => true; i.targetMessage = msj; i.targetId = msj.id;
                }
            }
            i.options = opcionesDe(ll.ops); i.options._sub = ll.sub; i.options._grupo = ll.grupo;
            await ejecutar(i, `/${json.name}${ll.grupo ? ` ${ll.grupo}` : ''}${ll.sub ? ` ${ll.sub}` : ''} (${actor.username})`);
            encolar(i, 0, actor);
        }
    }
    // 3) Botones, menús y ventanas en cadena.
    while (cola.length && hechas < MAX) {
        const t = cola.shift();
        const canal = t.canal || casino;
        if (t.modal) {
            const i = interaccionBase(sim, { usuario: t.actor, canal, tipo: 5 });
            i.isModalSubmit = () => true; i.customId = t.modal.custom_id; i.message = t.mensaje || null; i.isFromMessage = () => !!t.mensaje;
            const campos = new Map();
            for (const f of t.modal.components || []) for (const c of f.components || []) campos.set(c.custom_id, /cantidad|amount|apuesta|bet|numero|number|plazas|horas|precio/i.test(`${c.custom_id} ${c.label}`) ? '100' : (c.value || 'Texto de prueba'));
            i.fields = { getTextInputValue: (k) => campos.get(k) ?? '', fields: campos, getField: (k) => ({ value: campos.get(k) }) };
            i.update = async (p) => { if (i.replied || i.deferred) throw new Error('InteractionAlreadyReplied'); revisarSalida(p, 'update', { editar: true }); i.replied = true; if (t.mensaje) await t.mensaje.edit(p); i._salidas.push(t.mensaje); };
            i.deferUpdate = async () => { i.deferred = true; i._mensaje = t.mensaje; };
            await ejecutar(i, `ventana ${t.modal.custom_id}`);
            encolar(i, t.nivel, t.actor);
            continue;
        }
        const c = t.c;
        const i = interaccionBase(sim, { usuario: t.actor, canal, tipo: 3 });
        i.customId = c.custom_id; i.message = t.mensaje; i.componentType = c.type; i.isMessageComponent = () => true;
        i._mensaje = t.mensaje;
        if (c.type === 2) i.isButton = () => true;
        else {
            i.isAnySelectMenu = () => true; i.isSelectMenu = () => true;
            if (c.type === 3) { i.isStringSelectMenu = () => true; i.values = [c.options?.[0]?.value].filter(Boolean); }
            if (c.type === 5) { i.isUserSelectMenu = () => true; i.values = [personas.leo.id]; i.users = new (require('discord.js').Collection)([[personas.leo.id, personas.leo]]); i.members = new (require('discord.js').Collection)([[personas.leo.id, GA.members.cache.get(personas.leo.id)]]); }
            if (c.type === 6) { i.isRoleSelectMenu = () => true; i.values = [`${GA.id}4`]; i.roles = new (require('discord.js').Collection)([[`${GA.id}4`, GA.roles.cache.get(`${GA.id}4`)]]); }
            if (c.type === 8) { i.isChannelSelectMenu = () => true; i.values = [casino.id]; i.channels = new (require('discord.js').Collection)([[casino.id, casino]]); }
        }
        i.update = async (p) => {
            if (i.replied || i.deferred) { fallo('responde dos veces', 'update() después de responder'); throw new Error('InteractionAlreadyReplied'); }
            const tt = Date.now() - i._inicio; if (i._primera == null) { i._primera = tt; if (tt > LENTO_MS) fallo('lento', `primera respuesta a los ${tt} ms`); }
            revisarSalida(p, 'update', { editar: true }); i.replied = true; await t.mensaje.edit(p);
            if (!i._salidas.includes(t.mensaje)) i._salidas.push(t.mensaje);
        };
        i.deferUpdate = async () => {
            if (i.replied || i.deferred) { fallo('responde dos veces', 'deferUpdate() después de responder'); throw new Error('InteractionAlreadyReplied'); }
            const tt = Date.now() - i._inicio; if (i._primera == null) { i._primera = tt; if (tt > LENTO_MS) fallo('lento', `primera respuesta a los ${tt} ms`); }
            i.deferred = true;
        };
        await ejecutar(i, `${c.type === 2 ? 'botón' : 'menú'} ${c.custom_id}${c.label ? ` («${c.label}»)` : ''}`);
        encolar(i, t.nivel, t.actor);
    }
    // Ediciones en directo que llegaron después (crash, carrera…)
    await new Promise((r) => setTimeout(r, 2500));
    actual = 'ediciones y envíos en segundo plano';
    for (const e of client.eventos) if (e.payload) for (const m of validarMensaje({ ...e.payload, __permitirVacio: true, __editar: e.tipo === 'edit' }, { donde: `${e.tipo} ${e.canal || e.a}: ` })) fallo('Discord lo rechazaría', m);

    // Informe
    const grupos = new Map();
    for (const f of fallos) { const k = `${f.tipo} · ${f.txt.replace(/\d{15,}/g, '#').replace(/\d+ ms/, 'N ms').slice(0, 160)}`; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(f.donde); }
    const lineas = [`Interacciones: ${hechas} · comandos: ${lista.length} · fallos: ${fallos.length} (${grupos.size} distintos)`, '',
        `Comandos: ${lista.map((j) => j.name).join(', ')}`, `Botones/menús por prefijo: ${[...porPrefijo.entries()].map(([k, n]) => `${k}×${n}`).join(' ')}`, ''];
    for (const [k, donde] of [...grupos.entries()].sort((a, b) => b[1].length - a[1].length)) lineas.push(`■ ${k}\n   en ${[...new Set(donde)].slice(0, 6).join(' · ')}${donde.length > 6 ? ` … (${donde.length})` : ''}`);
    fs.writeFileSync(path.join(__dirname, 'informe.txt'), lineas.join('\n'));
    process.stdout.write(`${lineas.slice(0, 1).join('')}\n`);
    await mongoose.disconnect().catch(() => {});
    process.exit(0);
}
main().catch((e) => { errorOriginal(e); process.exit(1); });
setTimeout(() => { avisoOriginal('Tiempo agotado'); process.exit(2); }, Number(process.env.SIM_TIEMPO || 900000)).unref();

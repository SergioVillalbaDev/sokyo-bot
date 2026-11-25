// 🏠 /menu (1.34.0): la «pantalla de inicio» del bot para cada persona. Arriba, lo tuyo de un vistazo con avisos que
// se pulsan (diario listo, granja llena, huevo listo, mascota que volvió, ataques al jefe, tickets del pase) y el
// siguiente paso; abajo, las zonas (🎮 Jugar · 🐾 Mis mascotas · 🏘️ Comunidad), el mapa del juego y la ayuda.
// Cada zona enseña lo que hay ACTIVO en el servidor (utils/catalogo.js), ordenado por lo que ya has desbloqueado
// (utils/progreso.js), y un desplegable «¿Qué quieres hacer?» que lanza el comando de siempre con botones
// (`simular`): nadie tiene que saberse los comandos. Botones: menu:abrir · menu:z:<zona> · menu:a:<mod>:<acción>
// · menu:p:<mod>:<acción> (lo que pide: a quién, a dónde) · menu:mapa · menu:ayuda[:<mod>]. El último trozo es el
// dueño (si otra persona pulsa, se le abre el suyo).
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, UserSelectMenuBuilder, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const ColeccionMascotas = require('../models/ColeccionMascotas.js');
const C = require('./catalogo.js');
const PR = require('./progreso.js');
const { t } = require('./i18n.js');

const fmt = (n, idioma) => Math.floor(n || 0).toLocaleString(t(idioma, 'es-ES', 'en-US'));
const HORA = 3600000;

// Lo que se puede hacer desde los menús, por módulo: [clave, emoji, es, en, comando, subcomando, opciones, pide, etapa].
// `pide`: 'miembro' (a quién) o { opcion, valores: [[valor, es, en]] } (a elegir).
const DESTINOS = () => Object.entries(require('./compisNucleo.js').EXPEDICIONES).filter(([, x]) => x.grupo).map(([id, x]) => [id, `${x.emoji} ${x.es} (${x.horas} h)`, `${x.emoji} ${x.en} (${x.horas} h)`]);
const ACCIONES = {
    casino: [['lobby', '🎰', 'Abrir el casino', 'Open the casino', 'casino', 'menu', {}, null, 'primerDiario'], ['diaria', '🎁', 'Tirada gratis de hoy', 'Today’s free spin', 'casino', 'daily', {}, null, 'primerDiario'],
        ['numeros', '📈', 'Mis números', 'My numbers', 'casino', 'stats', {}, null, 'primerDiario']],
    cofres: [['abrir', '📦', 'Abrir un cofre básico', 'Open a basic chest', 'chest', 'open', { type: 'basico' }, null, 'primerDiario'], ['coleccion', '📚', 'Mi colección', 'My collection', 'chest', 'collection', {}, null, 'primerDiario'],
        ['prob', '🎲', 'Probabilidades', 'Odds', 'chest', 'odds', {}, null, 'primerDiario']],
    cartas: [['sobre', '🃏', 'Abrir un sobre', 'Open a pack', 'card', 'open', { pack: 'normal' }, null, 'dosDias'], ['album', '📖', 'Mi álbum', 'My album', 'card', 'album', {}, null, 'dosDias'],
        ['mercado', '🛒', 'Ver el mercado', 'Browse the market', 'market', 'browse', {}, null, 'dosDias']],
    combates: [['retar', '⚔️', 'Retar a alguien', 'Challenge someone', 'fight', 'challenge', {}, 'miembro', 'nivel5'], ['torre', '🗼', 'Subir la torre', 'Climb the tower', 'fight', 'tower', {}, null, 'nivel5'],
        ['jefe', '🐉', 'Jefe de la semana', 'Weekly boss', 'fight', 'boss', {}, null, 'conMascota'], ['mazo', '🃏', 'Mi mazo', 'My deck', 'fight', 'deck', {}, null, 'nivel5'], ['perfil', '🏅', 'Mi rango', 'My rank', 'fight', 'profile', {}, null, 'nivel5']],
    pase: [['pase', '🎟️', 'Mi pase', 'My pass', 'pass', null, {}, null, 'base'], ['perfil', '🪪', 'Mi perfil', 'My profile', 'profile', null, {}, null, 'base']],
    oro: [['diario', '🪙', 'Oro diario', 'Daily gold', 'daily', null, {}, null, 'base'], ['tienda', '🛒', 'Tienda del servidor', 'Server shop', 'shop', null, {}, null, 'base'], ['ricos', '💰', 'Los más ricos', 'Richest', 'rich', null, {}, null, 'base']],
    mascotas: [['ver', '🐾', 'Ver mi mascota', 'See my pet', 'companion', null, {}, null, 'conMascota'], ['granja', '🧺', 'Mi granja', 'My farm', 'farm', null, {}, null, 'conMascota'],
        ['expedicion', '🧭', 'Expedición en grupo', 'Group expedition', 'expedition', null, {}, { opcion: 'destination', valores: DESTINOS }, 'conMascota'],
        ['casa', '🏠', 'Mi casa', 'My house', 'house', null, {}, null, 'tresMascotas'], ['guarderia', '🥚', 'Guardería', 'Nursery', 'nursery', null, {}, null, 'nivel10']],
    mascotaServidor: [['ver', '🐉', 'Ver la mascota del servidor', 'See the server pet', 'pet', 'view', {}, null, 'base'], ['tienda', '🛍️', 'Su tienda', 'Its shop', 'pet', 'shop', {}, null, 'base'], ['diario', '📔', 'Su diario', 'Its diary', 'pet', 'diary', {}, null, 'base']],
    liga: [['ver', '🏅', 'La Liga de este mes', 'This month’s League', 'league', 'view', {}, null, 'base']],
    clanes: [['guerra', '⚔️', 'Guerra de esta semana', 'This week’s war', 'clan', 'war', {}, null, 'base'], ['info', '🛡️', 'Mi clan', 'My clan', 'clan', 'info', {}, null, 'base'], ['ranking', '🏆', 'Clasificación', 'Standings', 'clan', 'ranking', {}, null, 'base']],
    bromas: [['precios', '😜', 'Bromas y precios', 'Pranks and prices', 'prank', 'prices', {}, null, 'base'], ['payaso', '🤡', 'Payaso del día a…', 'Clown of the day on…', 'prank', 'clown', {}, 'miembro', 'base'], ['escudo', '🛡️', 'Comprar escudo', 'Buy a shield', 'prank', 'shield', {}, null, 'base']],
    temporadas: [['ver', '🏆', 'Clasificación de la temporada', 'Season standings', 'season', null, {}, null, 'base']],
    niveles: [['nivel', '📈', 'Mi nivel', 'My level', 'level', null, {}, null, 'base'], ['ranking', '🏆', 'Top de niveles', 'Level top', 'ranking', null, {}, null, 'base']],
    grupos: [['crear', '👥', 'Buscar grupo', 'Find a group', 'group', null, {}, null, 'base']],
};
const accion = (mod, clave) => (ACCIONES[mod] || []).find((a) => a[0] === clave) || null;

// ---------------------------------------------------------------------------
// Estado de la persona (lo usan /menu, el resumen diario y la Actividad).
// ---------------------------------------------------------------------------
async function estadoJugador(guildId, userId, cfg, ahora = Date.now()) {
    const economia = require('./economia.js');
    const P = require('./compisNucleo.js');
    const G = require('./granjaNucleo.js');
    const K = require('./cofresNucleo.js');
    const u = await economia.en(guildId).obtenerUsuario(userId).catch(() => ({}));
    const col = await ColeccionMascotas.findOne({ guildId, userId }).lean();
    const ms = col?.mascotas || [];
    const eq = ms.find((m) => m.id === col?.equipada) || ms[0] || null;
    const diarioListo = !u.ultimoDaily || (ahora - new Date(u.ultimoDaily).getTime()) / HORA >= (economia.HORAS_DAILY || 20);
    const granja = ms.length ? G.acumulado(col, ahora) : null;
    const huevos = (col?.huevos || []).map((h) => ({ rareza: h.rareza, listo: new Date(h.listo).getTime() <= ahora, cuando: new Date(h.listo) }));
    const vuelta = ms.filter((m) => P.expedicionLista(m, ahora));
    const fuera = ms.filter((m) => P.expedicionActiva(m, ahora));
    const pn = require('./paseNucleo.js');
    const pase = pn.actual(col?.pase, pn.temporadaDe(ahora));
    const tickets = Object.values(col?.tickets || {}).reduce((a, n) => a + (n > 0 ? n : 0), 0);
    let jefe = null;
    if (C.modulo('combates').activo(cfg) && eq) {
        const CN = require('./combateNucleo.js');
        const j = await require('../models/JefeServidor.js').findOne({ guildId, semana: CN.semanaDe(ahora) }).lean().catch(() => null);
        if (j && !j.muerto) { const hoy = new Date(ahora).toISOString().slice(0, 10); const a = j.ataques?.[userId]; jefe = { semana: j.semana, quedan: CN.ATAQUES_JEFE_DIA - (a?.dia === hoy ? a.n : 0), vida: j.vida, max: j.max }; }
    }
    let guerra = null;
    if (C.modulo('clanes').activo(cfg)) {
        const Clan = require('../models/Clan.js');
        const clan = await Clan.findOne({ guildId, miembros: userId }).lean().catch(() => null);
        if (clan?.rivalId) { const r = await Clan.findById(clan.rivalId).lean().catch(() => null); if (r) guerra = { yo: { nombre: clan.nombre, emoji: clan.emoji, puntos: clan.puntosSemana }, rival: { nombre: r.nombre, emoji: r.emoji, puntos: r.puntosSemana } }; }
    }
    const datos = PR.datosDe(u, col);
    return {
        oro: u.balance || 0, racha: u.rachaDaily || 0, diarioListo, mascotas: ms.length,
        equipada: eq ? { id: eq.id, nombre: eq.apodo || K.def(eq.id)?.es, nombreEn: eq.apodo || K.def(eq.id)?.en, emoji: K.def(eq.id)?.emoji, nivel: P.nivel(eq.afinidad || 0), humor: P.expedicionActiva(eq, ahora) ? 'fuera' : P.humor(P.estado(eq, ahora)), estado: P.estado(eq, ahora) } : null,
        granja: granja && !granja.nueva ? { oro: granja.oro, lleno: granja.lleno, porHora: granja.porHora } : granja ? { nueva: true } : null,
        huevos, vuelta: vuelta.map((m) => m.id), fuera: fuera.map((m) => ({ id: m.id, hasta: m.exp.hasta })),
        pase: { nivel: pn.nivelDe(pase.xp), xp: pase.xp, tickets }, jefe, guerra,
        progreso: datos, abiertas: PR.abiertas(datos), nuevas: PR.nuevas(datos, col?.etapasVistas || []),
        siguiente: require('./empezar.js').siguientePaso({ usuario: u, col, cfg, ahora }),
    };
}

// Avisos que se pulsan, por importancia.
function avisos(e, userId, idioma) {
    const K = require('./cofresNucleo.js');
    const l = [];
    const b = (id, emoji, es, en, estilo = ButtonStyle.Success) => new ButtonBuilder().setCustomId(id).setEmoji(emoji).setStyle(estilo).setLabel(t(idioma, es, en).slice(0, 80));
    if (e.diarioListo) l.push({ texto: t(idioma, '🪙 Tu **oro diario** está listo.', '🪙 Your **daily gold** is ready.'), boton: b(`emp:diario:${userId}`, '🪙', 'Reclamar diario', 'Claim daily') });
    if (e.granja && !e.granja.nueva && (e.granja.lleno || e.granja.oro >= Math.max(30, e.granja.porHora * 4))) l.push({ texto: t(idioma, `🧺 Tu granja tiene **🪙 ${fmt(e.granja.oro, idioma)}**${e.granja.lleno ? ' (¡llena!)' : ''}.`, `🧺 Your farm has **🪙 ${fmt(e.granja.oro, idioma)}**${e.granja.lleno ? ' (full!)' : ''}.`), boton: b(`grj:rec:${userId}`, '🧺', 'Recoger granja', 'Collect farm') });
    const huevo = e.huevos.find((h) => h.listo);
    if (huevo) l.push({ texto: t(idioma, '🥚 ¡Tienes un **huevo listo** para abrir!', '🥚 You have an **egg ready** to hatch!'), boton: b(`menu:a:mascotas:guarderia:${userId}`, '🐣', 'Abrir huevo', 'Hatch egg') });
    if (e.vuelta.length) { const d = K.def(e.vuelta[0]); l.push({ texto: t(idioma, `🧭 **${d.es}** ha vuelto de su expedición.`, `🧭 **${d.en}** is back from its expedition.`), boton: b(`cmp:ver:${userId}:${e.vuelta[0]}`, '🧭', 'Recoger lo que trae', 'Collect its loot') }); }
    if (e.equipada && e.equipada.humor !== 'fuera' && ((e.equipada.estado.hambre ?? 80) < 30 || e.equipada.humor === 'enfermo')) l.push({ texto: t(idioma, `🍖 **${e.equipada.nombre}** tiene hambre.`, `🍖 **${e.equipada.nombreEn}** is hungry.`), boton: b(`cmp:ver:${userId}:${e.equipada.id}`, '🍖', 'Cuidarla', 'Care for it', ButtonStyle.Primary) });
    if (e.jefe && e.jefe.quedan > 0 && e.abiertas.has('conMascota')) l.push({ texto: t(idioma, `🐉 Te quedan **${e.jefe.quedan} ataques** al jefe de la semana.`, `🐉 You have **${e.jefe.quedan} attacks** left on the weekly boss.`), boton: b(`cbt_jefe:${e.jefe.semana}`, '⚔️', 'Atacar al jefe', 'Attack the boss', ButtonStyle.Danger) });
    if (e.pase.tickets > 0) l.push({ texto: t(idioma, `🎟️ Tienes **${e.pase.tickets} ${e.pase.tickets === 1 ? 'ticket gratis' : 'tickets gratis'}**.`, `🎟️ You have **${e.pase.tickets} free ticket${e.pase.tickets === 1 ? '' : 's'}**.`), boton: b(`pse:ver:${userId}`, '🎟️', 'Usar tickets', 'Use tickets', ButtonStyle.Primary) });
    return l;
}

const ZONAS_MENU = ['jugar', 'mascotas', 'comunidad'];
function filaZonas(userId, idioma, actual = null) {
    return new ActionRowBuilder().addComponents(
        ...ZONAS_MENU.map((z) => new ButtonBuilder().setCustomId(`menu:z:${z}:${userId}`).setEmoji(C.ZONAS[z].emoji).setLabel(t(idioma, C.ZONAS[z].es, C.ZONAS[z].en)).setStyle(actual === z ? ButtonStyle.Primary : ButtonStyle.Secondary)),
        new ButtonBuilder().setCustomId(`menu:mapa:${userId}`).setEmoji('🗺️').setLabel(t(idioma, 'Mapa', 'Map')).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(actual ? `menu:abrir:${userId}` : `menu:ayuda:${userId}`).setEmoji(actual ? '🏠' : '❔').setLabel(actual ? t(idioma, 'Menú', 'Menu') : t(idioma, 'Ayuda', 'Help')).setStyle(ButtonStyle.Secondary),
    );
}

async function vistaMenu(interaction, cfg, idioma) {
    const userId = interaction.user.id; const guildId = interaction.guildId;
    const e = await estadoJugador(guildId, userId, cfg);
    const nombre = interaction.member?.displayName || interaction.user.globalName || interaction.user.username;
    const lista = avisos(e, userId, idioma);
    const lineas = [];
    // 🔓 Lo que se acaba de abrir (una vez).
    if (e.nuevas.length) {
        lineas.push(...e.nuevas.map((x) => `🔓 ${t(idioma, 'Nuevo para ti:', 'New for you:')} ${t(idioma, x.es, x.en)}`), '');
        await ColeccionMascotas.updateOne({ guildId, userId }, { $addToSet: { etapasVistas: { $each: e.nuevas.map((x) => x.id) } } }).catch(() => {});
    }
    lineas.push(t(idioma, `🪙 **${fmt(e.oro, idioma)}** · 🔥 racha ${e.racha} · 🐾 ${e.mascotas} ${e.mascotas === 1 ? 'mascota' : 'mascotas'} · 🎟️ pase nivel ${e.pase.nivel}`, `🪙 **${fmt(e.oro, idioma)}** · 🔥 streak ${e.racha} · 🐾 ${e.mascotas} pet${e.mascotas === 1 ? '' : 's'} · 🎟️ pass level ${e.pase.nivel}`));
    if (e.equipada) lineas.push(t(idioma, `${e.equipada.emoji} **${e.equipada.nombre}** (nivel ${e.equipada.nivel}) te acompaña.`, `${e.equipada.emoji} **${e.equipada.nombreEn}** (level ${e.equipada.nivel}) is with you.`));
    if (e.guerra) lineas.push(t(idioma, `⚔️ Guerra: ${e.guerra.yo.emoji} ${e.guerra.yo.nombre} **${fmt(e.guerra.yo.puntos, idioma)}** — **${fmt(e.guerra.rival.puntos, idioma)}** ${e.guerra.rival.emoji} ${e.guerra.rival.nombre}`, `⚔️ War: ${e.guerra.yo.emoji} ${e.guerra.yo.nombre} **${fmt(e.guerra.yo.puntos, idioma)}** — **${fmt(e.guerra.rival.puntos, idioma)}** ${e.guerra.rival.emoji} ${e.guerra.rival.nombre}`));
    if (lista.length) lineas.push('', ...lista.map((a) => a.texto));
    const paso = require('./empezar.js').pasoUI(e.siguiente, userId, idioma);
    if (!lista.length && paso?.texto) lineas.push('', `👉 ${paso.texto}`);
    const emb = new EmbedBuilder().setColor('#a855f7').setTitle(t(idioma, `🏠 Hola, ${nombre}`, `🏠 Hi, ${nombre}`)).setDescription(lineas.join('\n').slice(0, 4000))
        .setFooter({ text: t(idioma, 'Todo lo del bot está aquí: elige una zona. Escribe /menu cuando quieras volver.', 'Everything in the bot is here: pick a zone. Type /menu whenever you want to come back.') });
    const filas = [];
    const botones = lista.slice(0, 5).map((a) => a.boton);
    if (!botones.length && paso?.boton) botones.push(paso.boton);
    if (botones.length) filas.push(new ActionRowBuilder().addComponents(botones));
    filas.push(filaZonas(userId, idioma));
    // Resumen diario por privado (opcional) y, para admins, configurar.
    const resumen = await require('./resumenJugador.js').estado(guildId, userId).catch(() => false);
    const extra = [new ButtonBuilder().setCustomId(`menu:res:${userId}`).setEmoji(resumen ? '🔔' : '🔕').setLabel(resumen ? t(idioma, 'Resumen diario: sí', 'Daily summary: on') : t(idioma, 'Resumen diario por privado', 'Daily summary by DM')).setStyle(ButtonStyle.Secondary)];
    if (interaction.memberPermissions?.has?.(PermissionFlagsBits.ManageGuild)) extra.push(new ButtonBuilder().setCustomId(`cfg:ver:${userId}`).setEmoji('⚙️').setLabel(t(idioma, 'Configurar el bot', 'Set up the bot')).setStyle(ButtonStyle.Secondary));
    filas.push(new ActionRowBuilder().addComponents(extra));
    return { embeds: [emb], components: filas, files: [], attachments: [] };
}

// Una zona: sus módulos activos (lo desbloqueado primero) y «¿Qué quieres hacer?».
async function vistaZona(interaction, cfg, idioma, zona) {
    const userId = interaction.user.id;
    const e = await estadoJugador(interaction.guildId, userId, cfg);
    const mods = C.MODULOS.filter((m) => m.zona === zona && m.activo(cfg));
    const z = C.ZONAS[zona];
    const lineas = []; const ops = []; const cerrados = [];
    for (const m of mods) {
        const acc = (ACCIONES[m.id] || []).filter((a) => e.abiertas.has(a[8] || 'base'));
        const todas = ACCIONES[m.id] || [];
        if (todas.length && !acc.length) { cerrados.push(m); continue; }
        lineas.push(`${m.emoji} **${t(idioma, m.es, m.en)}** — ${t(idioma, m.frase.es, m.frase.en)}`);
        for (const a of acc) ops.push({ value: `${m.id}:${a[0]}`, emoji: a[1], label: t(idioma, a[2], a[3]).slice(0, 100), description: t(idioma, m.es, m.en).slice(0, 100) });
    }
    if (cerrados.length) {
        lineas.push('', t(idioma, '**Se abrirá pronto para ti:**', '**Opening soon for you:**'));
        for (const m of cerrados) {
            const et = PR.etapa((ACCIONES[m.id] || [])[0]?.[8]);
            lineas.push(`🔒 ${m.emoji} ${t(idioma, m.es, m.en)} — ${t(idioma, `cuando ${et.pista?.es || '…'}`, `when you ${et.pista?.en || '…'}`)}`);
        }
    }
    if (!mods.length) lineas.push(t(idioma, 'Aquí no hay nada encendido en este servidor todavía. Un admin puede activarlo con `/configurar`.', 'Nothing is turned on here on this server yet. An admin can turn it on with `/configure`.'));
    const emb = new EmbedBuilder().setColor(z.color).setTitle(`${z.emoji} ${t(idioma, z.es, z.en)}`).setDescription(lineas.join('\n').slice(0, 4000));
    if (z.puerta) emb.setFooter({ text: t(idioma, `Atajo: escribe /${require('./puertas.js').PUERTAS[zona]?.es || zona} y Discord te enseña todo lo de aquí.`, `Shortcut: type /${z.puerta} and Discord shows you everything here.`) });
    const filas = [];
    if (ops.length) filas.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`menu:sel:${userId}`).setPlaceholder(t(idioma, '¿Qué quieres hacer?', 'What do you want to do?')).addOptions(ops.slice(0, 25))));
    filas.push(filaZonas(userId, idioma, zona));
    return { embeds: [emb], components: filas, files: [], attachments: [] };
}

// Explicación corta de un módulo (o de todo, por zonas). La usa también el botón ❔ de los mensajes.
function vistaAyuda(idioma, cfg, modId = null, userId = '') {
    const m = modId ? C.modulo(modId) : null;
    const emb = new EmbedBuilder().setColor(m ? C.ZONAS[m.zona].color : '#a855f7');
    if (m) {
        emb.setTitle(`❔ ${m.emoji} ${t(idioma, m.es, m.en)}`).setDescription([t(idioma, m.frase.es, m.frase.en), '', ...t(idioma, m.pasos.es, m.pasos.en).map((l) => `• ${l}`)].join('\n'));
    } else {
        emb.setTitle(t(idioma, '❔ ¿Cómo funciona todo?', '❔ How does it all work?'))
            .setDescription(['jugar', 'mascotas', 'comunidad', 'musica', 'crecimiento'].map((z) => {
                const ms = C.MODULOS.filter((x) => x.zona === z && x.activo(cfg || {}));
                return ms.length ? `${C.ZONAS[z].emoji} **${t(idioma, C.ZONAS[z].es, C.ZONAS[z].en)}**: ${ms.map((x) => t(idioma, x.es, x.en)).join(' · ')}` : null;
            }).filter(Boolean).join('\n') + t(idioma, '\n\nElige una función abajo para ver cómo se usa, o mira el 🗺️ mapa.', '\n\nPick a feature below to see how to use it, or check the 🗺️ map.'));
    }
    const filas = [];
    const mods = C.activos(cfg || {}).filter((x) => x.zona !== 'staff');
    filas.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`menu:ay:${userId}`).setPlaceholder(t(idioma, 'Ver cómo funciona…', 'See how it works…'))
        .addOptions(mods.slice(0, 25).map((x) => ({ value: x.id, emoji: x.emoji, label: t(idioma, x.es, x.en), default: x.id === m?.id })))));
    const botones = [new ButtonBuilder().setCustomId(`menu:abrir:${userId}`).setEmoji('🏠').setLabel(t(idioma, 'Mi menú', 'My menu')).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`menu:mapa:${userId}`).setEmoji('🗺️').setLabel(t(idioma, 'Mapa del juego', 'Game map')).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`ayu_no:${m?.id || 'general'}`).setEmoji('🤔').setLabel(t(idioma, 'No lo entiendo', 'I don’t get it')).setStyle(ButtonStyle.Secondary)];
    const web = require('./ayudaWeb.js').enlace(m?.id || null, idioma);
    if (web) botones.push(new ButtonBuilder().setURL(web).setEmoji('📖').setLabel(t(idioma, 'Guía en la web', 'Web guide')).setStyle(ButtonStyle.Link));
    filas.push(new ActionRowBuilder().addComponents(botones));
    return { embeds: [emb], components: filas, files: [], attachments: [] };
}

// ---------------------------------------------------------------------------
// Lanzar un comando de siempre desde un botón o un menú (lo usan las acciones de las zonas).
// ---------------------------------------------------------------------------
function simular(interaction, nombre, sub, ops = {}) {
    const val = (k) => (ops[k] === undefined ? null : ops[k]);
    const opciones = {
        getSubcommand: () => sub, getSubcommandGroup: () => null,
        getString: (k) => (val(k) === null ? null : String(val(k))), getInteger: (k) => (val(k) === null ? null : parseInt(val(k), 10)), getNumber: (k) => (val(k) === null ? null : Number(val(k))),
        getBoolean: (k) => (val(k) === null ? null : !!val(k)), getUser: (k) => (ops[k]?.user || ops[k] || null), getMember: (k) => (ops[`${k}_m`] || null),
        getChannel: () => null, getRole: () => null, getAttachment: () => null, getMentionable: () => null, getFocused: () => '', get: (k) => (val(k) === null ? null : { name: k, value: val(k) }), data: [],
    };
    return new Proxy(interaction, {
        get(obj, prop) {
            if (prop === 'options') return opciones;
            if (prop === 'commandName') return nombre;
            if (prop === 'isChatInputCommand') return () => true;
            if (prop === 'isButton' || prop === 'isStringSelectMenu' || prop === 'isUserSelectMenu' || prop === 'isMessageComponent' || prop === 'isAnySelectMenu') return () => false;
            const v = obj[prop];
            return typeof v === 'function' ? v.bind(obj) : v;
        },
    });
}
async function lanzar(interaction, client, cfg, idioma, mod, clave, extra = {}) {
    const a = accion(mod, clave);
    const m = C.modulo(mod);
    if (!a || !m) return interaction.reply({ content: '❌', flags: 64 });
    if (!m.activo(cfg)) return interaction.reply({ content: t(idioma, `${m.emoji} **${m.es}** está apagado en este servidor.`, `${m.emoji} **${m.en}** is turned off on this server.`), flags: 64 });
    const [, , , , cmd, sub, ops, pide] = a;
    // Lo que falta (a quién, a dónde): se pregunta con un desplegable y se vuelve aquí.
    if (pide && !Object.keys(extra).length) {
        const fila = pide === 'miembro'
            ? new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`menu:p:${mod}:${clave}:${interaction.user.id}`).setPlaceholder(t(idioma, '¿A quién?', 'Who?')))
            : new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`menu:p:${mod}:${clave}:${interaction.user.id}`).setPlaceholder(t(idioma, '¿Cuál?', 'Which one?'))
                .addOptions(pide.valores().map(([v, es, en]) => ({ value: v, label: t(idioma, es, en).slice(0, 100) }))));
        return interaction.reply({ content: `${a[1]} **${t(idioma, a[2], a[3])}**`, components: [fila], flags: 64 });
    }
    const comando = require('./puertas.js').comandos().get(cmd);
    if (!comando) return interaction.reply({ content: '❌', flags: 64 });
    await require('./navegacion.js').envolverCon(interaction, m);
    return comando.execute(simular(interaction, cmd, sub, { ...ops, ...extra }), client, cfg);
}

// ---------------------------------------------------------------------------
// Botones y menús
// ---------------------------------------------------------------------------
async function manejar(interaction, client) {
    const id = interaction.customId || '';
    if (!id.startsWith('menu:')) return false;
    const { getConfigCached } = require('./config.js');
    const { idiomaInteraccion } = require('./preferencias.js');
    const cfg = await getConfigCached(interaction.guildId).catch(() => null) || {};
    const idioma = await idiomaInteraccion(interaction, cfg);
    // Por privado no hay oro ni mascotas: el menú es de cada servidor.
    if (!interaction.guildId) {
        await interaction.reply({ content: t(idioma, '🏠 Tu menú es de cada servidor: escribe **/menu** dentro de un servidor donde esté Sokyo.', '🏠 Your menu belongs to each server: type **/menu** inside a server that has Sokyo.'), flags: 64 }).catch(() => {});
        return true;
    }
    const partes = id.split(':');
    const tipo = partes[1]; const dueno = partes[partes.length - 1];
    const mio = !dueno || dueno === interaction.user.id;
    // En un mensaje ajeno (o sin dueño): se le abre lo suyo en privado.
    const responder = async (v) => (mio && interaction.message?.flags?.has?.(64) ? interaction.update(v) : interaction.reply({ ...v, flags: 64 }));
    if (tipo === 'abrir') { await interaction.deferReply({ flags: 64 }).catch(() => {}); await interaction.editReply(await vistaMenu(interaction, cfg, idioma)); return true; }
    if (tipo === 'z') { const v = await vistaZona(interaction, cfg, idioma, partes[2]); await responder(v); return true; }
    if (tipo === 'mapa') { await interaction.deferReply({ flags: 64 }).catch(() => {}); await interaction.editReply(await require('./mapaJuego.js').vista(cfg, idioma, interaction.user.id)); return true; }
    if (tipo === 'ayuda') { await responder(vistaAyuda(idioma, cfg, partes.length > 3 ? partes[2] : null, interaction.user.id)); return true; }
    if (tipo === 'ay') { await responder(vistaAyuda(idioma, cfg, interaction.values[0], interaction.user.id)); return true; }
    if (!mio) { await interaction.reply({ ...(await vistaMenu(interaction, cfg, idioma)), flags: 64 }); return true; }
    if (tipo === 'res') {
        const on = await require('./resumenJugador.js').alternar(interaction.guildId, interaction.user.id);
        await interaction.update(await vistaMenu(interaction, cfg, idioma)).catch(() => {});
        await interaction.followUp({ content: on ? t(idioma, '🔔 Hecho: cada día (si tienes algo listo) te llegará un resumen por privado. Lo apagas aquí mismo.', '🔔 Done: every day (if you have something ready) you’ll get a summary by DM. Turn it off right here.') : t(idioma, '🔕 Resumen diario apagado.', '🔕 Daily summary turned off.'), flags: 64 }).catch(() => {});
        return true;
    }
    if (tipo === 'sel') { const [mod, clave] = interaction.values[0].split(':'); await lanzar(interaction, client, cfg, idioma, mod, clave); return true; }
    if (tipo === 'a') { await lanzar(interaction, client, cfg, idioma, partes[2], partes[3]); return true; }
    if (tipo === 'p') {
        const a = accion(partes[2], partes[3]);
        const pide = a?.[7];
        if (pide === 'miembro') {
            const u = interaction.users?.first(); const mm = interaction.members?.first() || await interaction.guild?.members.fetch(u?.id).catch(() => null);
            if (!u) { await interaction.reply({ content: '❌', flags: 64 }); return true; }
            await lanzar(interaction, client, cfg, idioma, partes[2], partes[3], { member: u, member_m: mm, rival: u, rival_m: mm });
        } else await lanzar(interaction, client, cfg, idioma, partes[2], partes[3], { [pide.opcion]: interaction.values[0] });
        return true;
    }
    return false;
}

module.exports = { ACCIONES, estadoJugador, avisos, vistaMenu, vistaZona, vistaAyuda, simular, lanzar, manejar };

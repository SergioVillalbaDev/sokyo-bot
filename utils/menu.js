// 🏠 /menu (1.34.0): la «pantalla de inicio» del bot para cada persona. Arriba, lo tuyo de un vistazo con avisos que
// se pulsan (diario listo, granja llena, huevo listo, mascota que volvió, ataques al jefe, tickets del pase) y el
// siguiente paso; abajo, las zonas (🎮 Jugar · 🐾 Mis mascotas · 🏘️ Comunidad), el mapa del juego y la ayuda.
// Cada zona enseña lo que hay ACTIVO en el servidor (utils/catalogo.js), ordenado por lo que ya has desbloqueado
// (utils/progreso.js), y un desplegable «¿Qué quieres hacer?» que lanza el comando de siempre con botones
// (`simular`): nadie tiene que saberse los comandos. Botones: menu:abrir · menu:z:<zona> · menu:a:<mod>:<acción>
// · menu:p:<mod>:<acción> (lo que pide: a quién, a dónde) · menu:mapa · menu:ayuda[:<mod>]. El último trozo es el
// dueño (si otra persona pulsa, se le abre el suyo).
// 2.3.0: sección «📅 Hoy» (todo lo que se puede coger cada día, con ✅/⬜) y botones menu:hoy:<diario|carta|granja|todo>
// que lo hacen AL MOMENTO y vuelven a pintar el menú en su sitio con lo que ha pasado arriba (antes «Reclamar diario»
// te sacaba a la guía de /empezar y para la tirada gratis había que ir a Jugar → desplegable). En las zonas, la acción
// principal de cada función también es un botón (un clic).
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
    cartas: [['gratis', '🎁', 'Carta gratis de hoy', 'Today’s free card', 'card', 'daily', {}, null, 'dosDias'], ['sobre', '🃏', 'Abrir un sobre', 'Open a pack', 'card', 'open', { pack: 'normal' }, null, 'dosDias'], ['album', '📖', 'Mi álbum', 'My album', 'card', 'album', {}, null, 'dosDias'],
        ['mercado', '🛒', 'Ver el mercado', 'Browse the market', 'market', 'browse', {}, null, 'dosDias']],
    combates: [['retar', '⚔️', 'Retar a alguien', 'Challenge someone', 'fight', 'challenge', {}, 'miembro', 'nivel5'], ['torre', '🗼', 'Subir la torre', 'Climb the tower', 'fight', 'tower', {}, null, 'nivel5'],
        ['jefe', '🐉', 'Jefe de la semana', 'Weekly boss', 'fight', 'boss', {}, null, 'conMascota'], ['mazo', '🃏', 'Mi mazo', 'My deck', 'fight', 'deck', {}, null, 'nivel5'], ['perfil', '🏅', 'Mi rango', 'My rank', 'fight', 'profile', {}, null, 'nivel5']],
    pase: [['pase', '🎟️', 'Mi pase', 'My pass', 'pass', null, {}, null, 'base'], ['perfil', '🪪', 'Mi perfil', 'My profile', 'profile', null, {}, null, 'base']],
    oro: [['diario', '🪙', 'Oro diario', 'Daily gold', 'daily', null, {}, null, 'base'], ['votar', '🗳️', 'Votar: oro y cofre gratis', 'Vote: gold and free chest', 'vote', null, {}, null, 'base'], ['tienda', '🛒', 'Tienda del servidor', 'Server shop', 'shop', null, {}, null, 'base'], ['ricos', '💰', 'Los más ricos', 'Richest', 'rich', null, {}, null, 'base']],
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
    // 2.3.0: lo de cada día (para «📅 Hoy»).
    const dia = new Date(ahora).toISOString().slice(0, 10);
    const ultDiario = u.ultimoDaily ? new Date(u.ultimoDaily).getTime() : 0;
    const conCasino = !!C.modulo('casino')?.activo(cfg);
    const conVotos = !!process.env.TOPGG_WEBHOOK_AUTH; // sin top.gg configurado, el voto no se apunta: no se enseña
    const [pc, ultVoto] = await Promise.all([
        conCasino ? require('../models/PerfilCasino.js').findOne({ guildId, userId }).select('ultimaDiaria').lean().catch(() => null) : null,
        conVotos ? require('../models/Voto.js').findOne({ userId }).sort({ fecha: -1 }).select('fecha').lean().catch(() => null) : null,
    ]);
    let casino = null;
    if (conCasino) {
        const ult = pc?.ultimaDiaria ? new Date(pc.ultimaDiaria).getTime() : 0;
        casino = { listo: ahora - ult >= 20 * HORA, cuando: ult + 20 * HORA, canalId: cfg.casino?.canalId || null, guildId };
    }
    const tVoto = ultVoto ? new Date(ultVoto.fecha).getTime() : 0;
    const hoy = {
        diario: { listo: diarioListo, cuando: ultDiario + (economia.HORAS_DAILY || 20) * HORA },
        carta: C.modulo('cartas')?.activo(cfg) ? { listo: col?.cartaGratis !== dia, cuando: Date.parse(`${dia}T00:00:00Z`) + 24 * HORA } : null,
        casino,
        voto: conVotos ? { listo: ahora - tVoto >= 12 * HORA, cuando: tVoto + 12 * HORA } : null,
        cuidar: ms.length ? { listo: col?.ultimoDiaCuidado !== dia } : null,
    };
    const datos = PR.datosDe(u, col);
    return {
        hoy,
        oro: u.balance || 0, racha: u.rachaDaily || 0, diarioListo, mascotas: ms.length,
        cartaGratis: C.modulo('cartas').activo(cfg) && col?.cartaGratis !== new Date(ahora).toISOString().slice(0, 10), // 2.2.0
        // el ¿hecho? de cada cosa del día está en `hoy`
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
    if (e.diarioListo) l.push({ texto: t(idioma, '🪙 Tu **oro diario** está listo.', '🪙 Your **daily gold** is ready.'), boton: b(`menu:hoy:diario:${userId}`, '🪙', 'Reclamar diario', 'Claim daily'), tipo: 'diario' });
    if (e.granja && !e.granja.nueva && (e.granja.lleno || e.granja.oro >= Math.max(30, e.granja.porHora * 4))) l.push({ texto: t(idioma, `🧺 Tu granja tiene **🪙 ${fmt(e.granja.oro, idioma)}**${e.granja.lleno ? ' (¡llena!)' : ''}.`, `🧺 Your farm has **🪙 ${fmt(e.granja.oro, idioma)}**${e.granja.lleno ? ' (full!)' : ''}.`), tipo: 'granja', boton: b(`grj:rec:${userId}`, '🧺', 'Recoger granja', 'Collect farm') });
    const huevo = e.huevos.find((h) => h.listo);
    if (huevo) l.push({ texto: t(idioma, '🥚 ¡Tienes un **huevo listo** para abrir!', '🥚 You have an **egg ready** to hatch!'), boton: b(`menu:a:mascotas:guarderia:${userId}`, '🐣', 'Abrir huevo', 'Hatch egg') });
    if (e.vuelta.length) { const d = K.def(e.vuelta[0]); l.push({ texto: t(idioma, `🧭 **${d.es}** ha vuelto de su expedición.`, `🧭 **${d.en}** is back from its expedition.`), boton: b(`cmp:ver:${userId}:${e.vuelta[0]}`, '🧭', 'Recoger lo que trae', 'Collect its loot') }); }
    if (e.equipada && e.equipada.humor !== 'fuera' && ((e.equipada.estado.hambre ?? 80) < 30 || e.equipada.humor === 'enfermo')) l.push({ texto: t(idioma, `🍖 **${e.equipada.nombre}** tiene hambre.`, `🍖 **${e.equipada.nombreEn}** is hungry.`), boton: b(`cmp:ver:${userId}:${e.equipada.id}`, '🍖', 'Cuidarla', 'Care for it', ButtonStyle.Primary) });
    if (e.jefe && e.jefe.quedan > 0 && e.abiertas.has('conMascota')) l.push({ texto: t(idioma, `🐉 Te quedan **${e.jefe.quedan} ataques** al jefe de la semana.`, `🐉 You have **${e.jefe.quedan} attacks** left on the weekly boss.`), boton: b(`cbt_jefe:${e.jefe.semana}`, '⚔️', 'Atacar al jefe', 'Attack the boss', ButtonStyle.Danger), tipo: 'jefe' });
    if (e.cartaGratis && e.abiertas.has('dosDias')) l.push({ texto: t(idioma, '🎁 Tu **carta gratis** de hoy te espera.', '🎁 Your **free card** for today is waiting.'), boton: b(`menu:hoy:carta:${userId}`, '🎁', 'Carta gratis', 'Free card'), tipo: 'carta' });
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

// ---------------------------------------------------------------------------
// 📅 Hoy (2.3.0): lo que se puede coger cada día, hecho o no, y botones que lo hacen al momento.
// ---------------------------------------------------------------------------
const cuandoTxt = (ms) => `<t:${Math.floor(ms / 1000)}:R>`;
function lineasHoy(e, idioma) {
    const h = e.hoy || {};
    const l = [];
    const fila = (hecho, texto, extra = '') => l.push(`${hecho ? '✅' : '⬜'} ${texto}${extra}`);
    fila(!h.diario?.listo, t(idioma, '🪙 Oro diario', '🪙 Daily gold'), !h.diario?.listo && h.diario?.cuando ? t(idioma, ` · otra vez ${cuandoTxt(h.diario.cuando)}`, ` · again ${cuandoTxt(h.diario.cuando)}`) : '');
    if (h.carta && e.abiertas?.has('dosDias')) fila(!h.carta.listo, t(idioma, '🎁 Carta gratis', '🎁 Free card'), !h.carta.listo ? t(idioma, ` · otra ${cuandoTxt(h.carta.cuando)}`, ` · next ${cuandoTxt(h.carta.cuando)}`) : '');
    if (h.casino && e.abiertas?.has('primerDiario')) fila(!h.casino.listo, t(idioma, '🎰 Tirada gratis del casino', '🎰 Free casino spin'), !h.casino.listo ? t(idioma, ` · otra ${cuandoTxt(h.casino.cuando)}`, ` · next ${cuandoTxt(h.casino.cuando)}`) : '');
    if (e.granja && !e.granja.nueva) {
        if (e.granja.oro < 1) fila(true, t(idioma, '🧺 Granja recogida (se va llenando sola)', '🧺 Farm collected (it refills on its own)'));
        else fila(false, t(idioma, `🧺 Granja: **🪙 ${fmt(e.granja.oro, idioma)}** para recoger${e.granja.lleno ? ' (¡llena!)' : ''}`, `🧺 Farm: **🪙 ${fmt(e.granja.oro, idioma)}** to collect${e.granja.lleno ? ' (full!)' : ''}`));
    }
    if (h.cuidar) fila(!h.cuidar.listo, t(idioma, '🐾 Cuidar a tu mascota (racha)', '🐾 Care for your pet (streak)'), h.cuidar.listo && e.equipada?.humor === 'fuera' ? t(idioma, ' · está de expedición', ' · it’s on an expedition') : '');
    if (e.jefe && e.abiertas.has('conMascota')) fila(e.jefe.quedan <= 0, t(idioma, `🐉 Jefe de la semana: ${e.jefe.quedan} ${e.jefe.quedan === 1 ? 'ataque' : 'ataques'}`, `🐉 Weekly boss: ${e.jefe.quedan} attack${e.jefe.quedan === 1 ? '' : 's'}`));
    if (h.voto) fila(!h.voto.listo, t(idioma, '🗳️ Votar (oro y cofre gratis)', '🗳️ Vote (gold and free chest)'), !h.voto.listo ? t(idioma, ` · otra vez ${cuandoTxt(h.voto.cuando)}`, ` · again ${cuandoTxt(h.voto.cuando)}`) : '');
    const hechas = l.filter((x) => x.startsWith('✅')).length;
    return { titulo: t(idioma, `📅 **Hoy** · ${hechas}/${l.length}${hechas === l.length ? ' ¡todo hecho! 🎉' : ''}`, `📅 **Today** · ${hechas}/${l.length}${hechas === l.length ? ' all done! 🎉' : ''}`), lineas: l };
}
// Qué se puede recoger de golpe (sin animación ni sitio concreto): oro diario, carta gratis y granja.
const recogibles = (e) => [e.hoy?.diario?.listo && 'diario', e.hoy?.carta?.listo && e.abiertas?.has('dosDias') && 'carta', e.granja && !e.granja.nueva && e.granja.oro >= 1 && 'granja'].filter(Boolean);
// Botones de «Hoy» (máx. 5). `excluir`: lo que ya se ha hecho en ese mensaje (p. ej. /diario).
function botonesHoy(e, userId, idioma, { excluir = [], clientId = null, canalId = null } = {}) {
    const h = e.hoy || {};
    const b = (id, emoji, es, en, estilo = ButtonStyle.Success) => new ButtonBuilder().setCustomId(id).setEmoji(emoji).setStyle(estilo).setLabel(t(idioma, es, en).slice(0, 80));
    const l = [];
    const rec = recogibles(e).filter((x) => !excluir.includes(x));
    if (rec.length >= 2 && !excluir.includes('todo')) l.push(b(`menu:hoy:todo:${userId}`, '⚡', `Recoger todo (${rec.length})`, `Collect all (${rec.length})`));
    else {
        if (rec.includes('diario')) l.push(b(`menu:hoy:diario:${userId}`, '🪙', 'Oro diario', 'Daily gold'));
        if (rec.includes('carta')) l.push(b(`menu:hoy:carta:${userId}`, '🎁', 'Carta gratis', 'Free card'));
        if (rec.includes('granja')) l.push(b(`menu:hoy:granja:${userId}`, '🧺', `Granja (🪙 ${fmt(e.granja.oro, idioma)})`, `Farm (🪙 ${fmt(e.granja.oro, idioma)})`));
    }
    if (h.casino?.listo && e.abiertas?.has('primerDiario') && !excluir.includes('casino')) {
        // La tirada solo se juega en el canal del casino: desde otro canal, el botón te lleva allí.
        if (h.casino.canalId && canalId && h.casino.canalId !== canalId) l.push(new ButtonBuilder().setURL(`https://discord.com/channels/${h.casino.guildId}/${h.casino.canalId}`).setEmoji('🎰').setStyle(ButtonStyle.Link).setLabel(t(idioma, 'Tirada gratis (ir al casino)', 'Free spin (go to casino)')));
        else l.push(b(`menu:a:casino:diaria:${userId}`, '🎰', 'Tirada gratis', 'Free spin', ButtonStyle.Primary));
    }
    if (h.cuidar?.listo && e.equipada && e.equipada.humor !== 'fuera' && !excluir.includes('cuidar')) l.push(b(`cmp:ver:${userId}:${e.equipada.id}`, e.equipada.emoji || '🐾', `Cuidar a ${String(e.equipada.nombre).slice(0, 20)}`, `Care for ${String(e.equipada.nombreEn).slice(0, 20)}`, ButtonStyle.Primary));
    if (h.voto?.listo && clientId && !excluir.includes('voto')) l.push(new ButtonBuilder().setURL(require('./votos.js').urlVoto(clientId)).setEmoji('🗳️').setStyle(ButtonStyle.Link).setLabel(t(idioma, 'Votar', 'Vote')));
    return l.slice(0, 5);
}
// Hace lo del día pedido (o todo lo que se puede de golpe). Devuelve líneas para enseñar arriba del menú
// y, para la carta suelta, su mensaje con la animación.
async function hacerHoy(interaction, cfg, idioma, que) {
    const g = interaction.guildId; const u = interaction.user.id;
    const res = []; let carta = null;
    const todo = que === 'todo';
    // «Recoger todo» hace solo lo que se ve en el menú (lo desbloqueado y listo).
    const lista = todo ? recogibles(await estadoJugador(g, u, cfg)) : [que];
    const toca = (x) => lista.includes(x);
    const paso = async (nombre, f) => {
        try { await f(); } catch (err) {
            console.warn(`menu hoy (${nombre}):`, err.message);
            res.push(t(idioma, '⚠️ Algo no ha ido bien con una de las cosas: prueba otra vez en un momento.', '⚠️ Something went wrong with one of them: try again in a moment.'));
        }
    };
    if (toca('diario')) await paso('diario', async () => {
        const r = await require('./economia.js').en(g).reclamarDaily(u);
        if (r.ok) {
            res.push(t(idioma, `🪙 **+${fmt(r.total, idioma)}** de oro diario · 🔥 racha de ${r.racha} ${r.racha === 1 ? 'día' : 'días'}`, `🪙 **+${fmt(r.total, idioma)}** daily gold · 🔥 ${r.racha}-day streak`));
            if (r.jackpot) res.push(t(idioma, `🎉 Bonus de racha: +🪙 ${fmt(r.jackpot, idioma)}`, `🎉 Streak bonus: +🪙 ${fmt(r.jackpot, idioma)}`));
            if (r.extraCompa) res.push(t(idioma, `🐾 Tu compañero te trae +🪙 ${fmt(r.extraCompa, idioma)}`, `🐾 Your companion brings +🪙 ${fmt(r.extraCompa, idioma)}`));
            if (r.extraClan) res.push(t(idioma, `🛡️ Tu clan ganó la semana: +🪙 ${fmt(r.extraClan, idioma)}`, `🛡️ Your clan won the week: +🪙 ${fmt(r.extraClan, idioma)}`));
            if (r.extraEvento && r.evento) res.push(`${r.evento.emoji} ${t(idioma, r.evento.es, r.evento.en)}: +🪙 ${fmt(r.extraEvento, idioma)}`);
            if (r.bienvenida) res.push(t(idioma, '📦 **¡Cofre de bienvenida!** Lo tienes en 🎟️ «Usar tickets».', '📦 **Welcome chest!** It’s in 🎟️ “Use tickets”.'));
            else if (r.regalo) res.push(t(idioma, `🎁 ¡Regalo por ${r.racha} días seguidos! Lo tienes en 🎟️ «Usar tickets».`, `🎁 Gift for a ${r.racha}-day streak! It’s in 🎟️ “Use tickets”.`));
            res.push(...(r.delPase || []));
        } else if (!todo) res.push(t(idioma, `⏳ El oro diario ya lo cogiste: otra vez en ${Math.ceil(r.esperaHoras)} h.`, `⏳ You already took your daily gold: again in ${Math.ceil(r.esperaHoras)}h.`));
    });
    if (toca('carta') && C.modulo('cartas')?.activo(cfg)) await paso('carta', async () => {
        const r = await require('./cartas.js').cartaDiaria({ interaction, cfg, idioma, sinGif: todo });
        if (r.ok) { res.push(r.linea); if (!todo) carta = r.msg; } else if (!todo) res.push(r.error);
    });
    if (toca('granja')) await paso('granja', async () => {
        const G = require('./granja.js');
        const r = await G.recoger(g, u, idioma);
        if (!r.fallo) res.push(...(r.mensajes || []));
        else if (!todo) { const x = G.FALLOS[r.fallo] || G.FALLOS.vacia; res.push(`🧺 ${t(idioma, x[0], x[1])}`); }
    });
    if (todo && !res.length) res.push(t(idioma, '😌 Ahora mismo no hay nada que recoger. ¡Vuelve luego!', '😌 Nothing to collect right now. Come back later!'));
    return { res, carta };
}

async function vistaMenu(interaction, cfg, idioma, { resultado = [] } = {}) {
    const userId = interaction.user.id; const guildId = interaction.guildId;
    const e = await estadoJugador(guildId, userId, cfg);
    const nombre = interaction.member?.displayName || interaction.user.globalName || interaction.user.username;
    // Lo que ya sale en «Hoy» no se repite en los avisos.
    const todos = avisos(e, userId, idioma);
    const lista = todos.filter((a) => !['diario', 'granja', 'carta', 'jefe'].includes(a.tipo));
    const jefe = todos.find((a) => a.tipo === 'jefe');
    const lineas = [];
    if (resultado.length) lineas.push(...resultado, '');
    // 🔓 Lo que se acaba de abrir (una vez).
    if (e.nuevas.length) {
        lineas.push(...e.nuevas.map((x) => `🔓 ${t(idioma, 'Nuevo para ti:', 'New for you:')} ${t(idioma, x.es, x.en)}`), '');
        await ColeccionMascotas.updateOne({ guildId, userId }, { $addToSet: { etapasVistas: { $each: e.nuevas.map((x) => x.id) } } }).catch(() => {});
    }
    lineas.push(t(idioma, `🪙 **${fmt(e.oro, idioma)}** · 🔥 racha ${e.racha} · 🐾 ${e.mascotas} ${e.mascotas === 1 ? 'mascota' : 'mascotas'} · 🎟️ pase nivel ${e.pase.nivel}`, `🪙 **${fmt(e.oro, idioma)}** · 🔥 streak ${e.racha} · 🐾 ${e.mascotas} pet${e.mascotas === 1 ? '' : 's'} · 🎟️ pass level ${e.pase.nivel}`));
    if (e.equipada) lineas.push(t(idioma, `${e.equipada.emoji} **${e.equipada.nombre}** (nivel ${e.equipada.nivel}) te acompaña.`, `${e.equipada.emoji} **${e.equipada.nombreEn}** (level ${e.equipada.nivel}) is with you.`));
    if (e.guerra) lineas.push(t(idioma, `⚔️ Guerra: ${e.guerra.yo.emoji} ${e.guerra.yo.nombre} **${fmt(e.guerra.yo.puntos, idioma)}** — **${fmt(e.guerra.rival.puntos, idioma)}** ${e.guerra.rival.emoji} ${e.guerra.rival.nombre}`, `⚔️ War: ${e.guerra.yo.emoji} ${e.guerra.yo.nombre} **${fmt(e.guerra.yo.puntos, idioma)}** — **${fmt(e.guerra.rival.puntos, idioma)}** ${e.guerra.rival.emoji} ${e.guerra.rival.nombre}`));
    const hoy = lineasHoy(e, idioma);
    lineas.push('', hoy.titulo, ...hoy.lineas);
    if (lista.length) lineas.push('', t(idioma, '🔔 **Para ti**', '🔔 **For you**'), ...lista.map((a) => a.texto));
    const paso = require('./empezar.js').pasoUI(e.siguiente, userId, idioma);
    // Ningún botón puede repetir id (Discord rechazaría el mensaje entero): lo de «Para ti» manda.
    const idsAvisos = new Set(lista.slice(0, 5).map((a) => a.boton.data.custom_id).filter(Boolean));
    const bHoy = botonesHoy(e, userId, idioma, { clientId: interaction.client?.user?.id, canalId: interaction.channelId }).filter((x) => !idsAvisos.has(x.data.custom_id));
    if (jefe && bHoy.length < 5) bHoy.push(jefe.boton);
    if (!lista.length && !bHoy.length && paso?.texto) lineas.push('', `👉 ${paso.texto}`);
    const emb = new EmbedBuilder().setColor('#a855f7').setTitle(t(idioma, `🏠 Hola, ${nombre}`, `🏠 Hi, ${nombre}`)).setDescription(lineas.join('\n').slice(0, 4000))
        .setFooter({ text: t(idioma, 'Todo se hace desde aquí: pulsa un botón o elige una zona. /menu para volver cuando quieras.', 'Everything works from here: press a button or pick a zone. /menu to come back anytime.') });
    const filas = [];
    if (bHoy.length) filas.push(new ActionRowBuilder().addComponents(bHoy));
    const botones = lista.slice(0, 5).map((a) => a.boton);
    if (!botones.length && !bHoy.length && paso?.boton) botones.push(paso.boton);
    if (botones.length) filas.push(new ActionRowBuilder().addComponents(botones));
    filas.push(filaZonas(userId, idioma));
    // Resumen diario por privado (opcional) y, para admins, configurar.
    const resumen = await require('./resumenJugador.js').estado(guildId, userId).catch(() => false);
    const extra = [new ButtonBuilder().setCustomId(`menu:res:${userId}`).setEmoji(resumen ? '🔔' : '🔕').setLabel(resumen ? t(idioma, 'Resumen diario: sí', 'Daily summary: on') : t(idioma, 'Resumen diario por privado', 'Daily summary by DM')).setStyle(ButtonStyle.Secondary)];
    if (interaction.memberPermissions?.has?.(PermissionFlagsBits.ManageGuild)) extra.push(new ButtonBuilder().setCustomId(`cfg:ver:${userId}`).setEmoji('⚙️').setLabel(t(idioma, 'Configurar el bot', 'Set up the bot')).setStyle(ButtonStyle.Secondary));
    filas.push(new ActionRowBuilder().addComponents(extra));
    return { embeds: [emb], components: filas.slice(0, 5), files: [], attachments: [] };
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
            lineas.push(`🔒 ${m.emoji} ${t(idioma, m.es, m.en)} — 👉 ${t(idioma, et.pista?.es || '…', et.pista?.en || '…')}`);
        }
    }
    if (!mods.length) lineas.push(t(idioma, 'Aquí no hay nada encendido en este servidor todavía. Un admin puede activarlo con `/configurar`.', 'Nothing is turned on here on this server yet. An admin can turn it on with `/configure`.'));
    while (lineas[0] === '') lineas.shift();
    const emb = new EmbedBuilder().setColor(z.color).setTitle(`${z.emoji} ${t(idioma, z.es, z.en)}`).setDescription(lineas.join('\n').slice(0, 4000));
    if (z.puerta) emb.setFooter({ text: t(idioma, `Atajo: escribe /${require('./puertas.js').PUERTAS[zona]?.es || zona} y Discord te enseña todo lo de aquí.`, `Shortcut: type /${z.puerta} and Discord shows you everything here.`) });
    const filas = [];
    // 2.3.0: la acción principal de cada función, a un clic (el desplegable sigue teniendo todas).
    const rapidas = [];
    for (const m of mods) {
        const a = (ACCIONES[m.id] || []).find((x) => e.abiertas.has(x[8] || 'base') && !x[7]);
        if (a) rapidas.push(new ButtonBuilder().setCustomId(`menu:a:${m.id}:${a[0]}:${userId}`).setEmoji(a[1]).setLabel(t(idioma, a[2], a[3]).slice(0, 80)).setStyle(ButtonStyle.Primary));
    }
    for (let i = 0; i < Math.min(10, rapidas.length); i += 5) filas.push(new ActionRowBuilder().addComponents(rapidas.slice(i, i + 5)));
    if (ops.length) filas.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`menu:sel:${userId}`).setPlaceholder(t(idioma, '¿Qué quieres hacer?', 'What do you want to do?')).addOptions(ops.slice(0, 25))));
    filas.push(filaZonas(userId, idioma, zona));
    return { embeds: [emb], components: filas.slice(-5), files: [], attachments: [] };
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
    // En tu propio menú (privado) todo se queda en el mismo mensaje; desde cualquier otro sitio, se abre uno privado.
    const enMiMenu = mio && interaction.message?.flags?.has?.(64);
    if (tipo === 'abrir') {
        if (enMiMenu) await interaction.deferUpdate().catch(() => {}); else await interaction.deferReply({ flags: 64 }).catch(() => {});
        await interaction.editReply(await vistaMenu(interaction, cfg, idioma));
        return true;
    }
    if (tipo === 'hoy' && mio) {
        if (enMiMenu) await interaction.deferUpdate().catch(() => {}); else await interaction.deferReply({ flags: 64 }).catch(() => {});
        const r = await hacerHoy(interaction, cfg, idioma, partes[2]);
        await interaction.editReply(await vistaMenu(interaction, cfg, idioma, { resultado: r.res }));
        if (r.carta) await interaction.followUp({ ...r.carta, flags: 64 }).catch(() => {});
        return true;
    }
    if (tipo === 'z') {
        if (enMiMenu) await interaction.deferUpdate().catch(() => {}); else await interaction.deferReply({ flags: 64 }).catch(() => {});
        await interaction.editReply(await vistaZona(interaction, cfg, idioma, partes[2]));
        return true;
    }
    if (tipo === 'mapa') { if (enMiMenu) await interaction.deferUpdate().catch(() => {}); else await interaction.deferReply({ flags: 64 }).catch(() => {}); await interaction.editReply(await require('./mapaJuego.js').vista(cfg, idioma, interaction.user.id)); return true; }
    if (tipo === 'ayuda') { await responder(vistaAyuda(idioma, cfg, partes.length > 3 ? partes[2] : null, interaction.user.id)); return true; }
    if (tipo === 'ay') { await responder(vistaAyuda(idioma, cfg, interaction.values[0], interaction.user.id)); return true; }
    if (!mio) { await interaction.deferReply({ flags: 64 }).catch(() => {}); await interaction.editReply(await vistaMenu(interaction, cfg, idioma)); return true; }
    if (tipo === 'res') {
        await interaction.deferUpdate().catch(() => {});
        const on = await require('./resumenJugador.js').alternar(interaction.guildId, interaction.user.id);
        await interaction.editReply(await vistaMenu(interaction, cfg, idioma)).catch(() => {});
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

module.exports = { ACCIONES, estadoJugador, avisos, lineasHoy, botonesHoy, hacerHoy, recogibles, vistaMenu, vistaZona, vistaAyuda, simular, lanzar, manejar };

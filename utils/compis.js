// Compañeros tipo tamagotchi (1.20.0): /compi enseña tu compañero con su tarjeta
// (animada al cuidarlo) y botones para darle de comer, jugar, mimarlo, hablar con él,
// mandarlo de expedición, cambiar de compañero, equiparlo y ponerle apodo. Hay misiones
// del día y racha. Las reglas, en utils/compisNucleo.js; los compañeros, en utils/cofresNucleo.js.
// También carga los compañeros propios de cada servidor (models/CompaneroServidor.js).
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const ColeccionMascotas = require('../models/ColeccionMascotas.js');
const CompaneroServidor = require('../models/CompaneroServidor.js');
const K = require('./cofresNucleo.js');
const P = require('./compisNucleo.js');
const { t } = require('./i18n.js');

const fmt = (n, idioma) => Math.round(n || 0).toLocaleString(t(idioma, 'es-ES', 'en-US'));
const nombreDe = (m, idioma) => m.apodo || t(idioma, K.def(m.id).es, K.def(m.id).en);
const corto = (m, idioma) => (m.apodo || t(idioma, K.def(m.id).es, K.def(m.id).en).split(',')[0]);
const rzTexto = (id, idioma) => { const r = K.RAREZAS[K.def(id).rareza]; return `${r.emoji} ${t(idioma, r.es, r.en)}`; };

// ---------- Compañeros de los servidores ----------
const idServidor = (c) => `s:${c.guildId}:${c.cid}`;
async function cargarPersonalizados() {
    const lista = await CompaneroServidor.find().lean();
    for (const c of lista) K.registrarPersonalizado({ ...c, id: idServidor(c) });
    return lista.length;
}

// Una acción a la vez por persona (botones pulsados muy rápido no se pisan).
const colas = new Map();
function enCola(userId, fn) {
    const antes = colas.get(userId) || Promise.resolve();
    const ahora = antes.catch(() => {}).then(fn);
    colas.set(userId, ahora);
    ahora.finally(() => { if (colas.get(userId) === ahora) colas.delete(userId); }).catch(() => {});
    return ahora;
}

const elegir = (col, compId) => {
    const l = col?.mascotas || [];
    return l.find((m) => m.id === compId) || l.find((m) => m.id === col.equipada) || l[0] || null;
};

// Hace una acción (ver, comer, jugar, mimar, hablar, exp:<tipo>) y lo guarda todo.
// Devuelve { col, m, mensajes, efecto, frase, fallo }.
async function accion(userId, compId, que, { idioma = 'es', dueno = '', ahora = Date.now(), guildId = null, bromas = false } = {}) {
    return enCola(userId, async () => {
        const col = await ColeccionMascotas.findOne({ userId }).lean();
        const m0 = elegir(col, compId);
        if (!m0) return { fallo: 'sin' };
        let m = { ...m0 };
        const set = {}; const mensajes = []; let efecto = null; let oro = 0;
        const nivelAntes = P.nivel(m.afinidad || 0);
        const dia = P.diaDe(ahora);
        let mis = col.misiones; let colSet = {};
        const sumarMision = (a) => {
            const r = P.avanzarMision(mis, a, dia);
            mis = r.mis;
            if (r.cumplida) {
                const def = P.MISIONES[r.cumplida];
                oro += P.PREMIO_MISION.oro; m.afinidad = (m.afinidad || 0) + P.PREMIO_MISION.afinidad;
                mensajes.push(t(idioma, `✅ Misión cumplida: ${def.emoji} ${def.es} → 🪙 ${P.PREMIO_MISION.oro}`, `✅ Mission done: ${def.emoji} ${def.en} → 🪙 ${P.PREMIO_MISION.oro}`));
            }
            if (r.todas) { oro += P.PREMIO_TODAS; mensajes.push(t(idioma, `🏆 ¡Todas las misiones de hoy! +🪙 ${P.PREMIO_TODAS}`, `🏆 All of today’s missions! +🪙 ${P.PREMIO_TODAS}`)); }
        };
        // Si volvió de una expedición, recoge lo que trae.
        const recoger = () => {
            if (!P.expedicionLista(m, ahora)) return;
            const b = P.botin(m);
            if (m.botinX) m.botinX = null; // el ×N de una carta solo vale una vez
            const x = P.EXPEDICIONES[m.exp.tipo];
            oro += b.oro; m.afinidad = (m.afinidad || 0) + b.afinidad;
            // Mientras está fuera no gasta: se cuenta desde que volvió.
            const e = P.estado({ ...m, exp: null, actualizado: m.exp.hasta }, ahora);
            Object.assign(m, e, { actualizado: new Date(ahora), exp: null });
            if (b.recuerdo !== null && !(m.recuerdos || []).includes(b.recuerdo)) m.recuerdos = [...(m.recuerdos || []), b.recuerdo];
            const rec = b.recuerdo !== null ? P.RECUERDOS[b.recuerdo] : null;
            mensajes.push(t(idioma, `${x.emoji} **¡Ha vuelto de «${x.es}»!** Trae 🪙 ${b.oro}${rec ? ` y un recuerdo: ${rec[0]} ${rec[1]}` : ''}.`, `${x.emoji} **Back from “${x.en}”!** Brought 🪙 ${b.oro}${rec ? ` and a souvenir: ${rec[0]} ${rec[2]}` : ''}.`));
            efecto = 'vuelta';
        };
        recoger();
        let frase = null; let fallo = null; let falloMin = 0; let falloRareza = 0;
        let semAcc = null; // misión semanal que cuenta (1.28.0)
        if (que === 'comer' || que === 'jugar' || que === 'mimar') {
            const r = P.cuidar(m, que, ahora);
            if (r.fallo) fallo = r.fallo;
            else {
                Object.assign(m, { hambre: r.hambre, alegria: r.alegria, energia: r.energia, actualizado: new Date(ahora) });
                m.afinidad = (m.afinidad || 0) + r.afinidad;
                m.cuidados = (m.cuidados || 0) + 1;
                if (que === 'mimar' && r.afinidad) m.ultMimo = new Date(ahora);
                frase = P.frase(m, que, { idioma, dueno, ahora });
                efecto = que;
                semAcc = 'cuidar';
                sumarMision(que);
                if (r.humor === 'feliz') sumarMision('feliz');
            }
        } else if (que === 'hablar') {
            if (P.expedicionActiva(m, ahora)) fallo = 'fuera';
            else { frase = P.frase(m, 'hablar', { idioma, dueno, ahora }); efecto = 'hablar'; sumarMision('hablar'); }
        } else if (que.startsWith('int:')) {
            // Interacciones que da la rareza (baño, foto, entrenar, regalo, meditar, milagro…).
            const id = que.slice(4);
            const r = P.interactuar(m, id, ahora);
            if (r.fallo) { fallo = r.fallo; if (r.fallo === 'espera') falloMin = r.min; if (r.fallo === 'rareza') falloRareza = r.rareza; }
            else {
                Object.assign(m, { hambre: r.hambre, alegria: r.alegria, energia: r.energia, actualizado: new Date(ahora), cds: r.cds });
                m.afinidad = (m.afinidad || 0) + r.afinidad;
                m.cuidados = (m.cuidados || 0) + 1;
                semAcc = 'cuidar';
                frase = P.frase(m, id, { idioma, dueno, ahora });
                efecto = id === 'regalo' || id === 'milagro' ? 'vuelta' : 'mimar';
                const x = P.INTERACCIONES[id];
                if (r.oro) { oro += r.oro; mensajes.push(t(idioma, `${x.emoji} Te regala 🪙 ${r.oro}.`, `${x.emoji} It gives you 🪙 ${r.oro}.`)); }
                if (r.recuerdo !== null && r.recuerdo !== undefined && !(m.recuerdos || []).includes(r.recuerdo)) {
                    m.recuerdos = [...(m.recuerdos || []), r.recuerdo];
                    const rec = P.RECUERDOS[r.recuerdo];
                    mensajes.push(t(idioma, `🎒 Y un recuerdo: ${rec[0]} ${rec[1]}`, `🎒 And a souvenir: ${rec[0]} ${rec[2]}`));
                }
                if (r.humor === 'feliz') sumarMision('feliz');
            }
        } else if (que === 'poder' || que.startsWith('carta:')) {
            // Poder del día de la mascota o una carta de anime usada en ella (1.24.0).
            const esCarta = que.startsWith('carta:');
            const r = esCarta
                ? require('./cartasNucleo.js').usarCarta(col, que.slice(6), m, { ahora, dia, bromas: bromas && !!guildId, equipada: col.equipada })
                : P.usarPoder(m, col, { ahora, bromas: bromas && !!guildId });
            if (r.fallo) { fallo = r.fallo; falloMin = r.min || 0; if (r.limite) falloRareza = r.limite; }
            else {
                const def = P.poderDe(m);
                if (esCarta) {
                    const carta = K.def(r.carta);
                    colSet.cartas = (col.cartas || []).map((c) => (c.id === r.carta ? { ...c, usada: new Date(ahora) } : c));
                    colSet.cartasHoy = { dia, n: r.usadas };
                    semAcc = 'carta';
                    mensajes.push(t(idioma, `🃏 **${carta.es}** usa ${r.emoji} **${r.nombre.es}** sobre ${corto(m, idioma)}`, `🃏 **${carta.en}** uses ${r.emoji} **${r.nombre.en}** on ${corto(m, idioma)}`));
                    efecto = 'vuelta';
                    frase = P.frase(m, 'mimar', { idioma, dueno, ahora });
                } else {
                    colSet.poderUsado = new Date(ahora);
                    efecto = 'nivel';
                    frase = P.frase(m, 'poder', { idioma, dueno, ahora });
                    if (r.nombre) mensajes.push(`${r.emoji} **${t(idioma, r.nombre.es, r.nombre.en)}**`);
                }
                if (r.oro) { oro += r.oro; mensajes.push(r.nombre ? t(idioma, `🪙 Consigue ${r.oro} de oro.`, `🪙 Gets ${r.oro} gold.`) : t(idioma, `${r.emoji} **Olfato:** ha encontrado 🪙 ${r.oro}.`, `${r.emoji} **Sniff:** found 🪙 ${r.oro}.`)); }
                if (r.buff) {
                    // No se acumulan: se queda el más fuerte.
                    const actual = P.buffXp(col, ahora);
                    if (r.buff.xp >= actual) {
                        colSet.buff = r.buff;
                        mensajes.push(t(idioma, `${r.emoji} **+${Math.round(r.buff.xp * 100)} % de XP** hasta <t:${Math.floor(r.buff.hasta.getTime() / 1000)}:t>.`, `${r.emoji} **+${Math.round(r.buff.xp * 100)}% XP** until <t:${Math.floor(r.buff.hasta.getTime() / 1000)}:t>.`));
                    } else mensajes.push(t(idioma, `✨ Ya tienes un +${Math.round(actual * 100)} % de XP más fuerte activo: se queda ese.`, `✨ You already have a stronger +${Math.round(actual * 100)}% XP active: that one stays.`));
                }
                if (r.potencia) {
                    const act = col.potencia && new Date(col.potencia.hasta) > new Date(ahora) && col.potencia.mascota === m.id ? col.potencia.valor || 0 : 0;
                    if (r.potencia.valor < act) mensajes.push(t(idioma, `💥 Ya está potenciada un +${Math.round(act * 100)} %: se queda ese.`, `💥 Already boosted +${Math.round(act * 100)}%: that one stays.`));
                    else colSet.potencia = r.potencia;
                    if (r.potencia.valor >= act) mensajes.push(t(idioma, `💥 **${corto(m, idioma)} +${Math.round(r.potencia.valor * 100)} %**: sus ventajas suben hasta <t:${Math.floor(r.potencia.hasta.getTime() / 1000)}:t>${col.equipada === m.id ? '' : ' (si la llevas equipada)'}.`, `💥 **${corto(m, idioma)} +${Math.round(r.potencia.valor * 100)}%**: its perks go up until <t:${Math.floor(r.potencia.hasta.getTime() / 1000)}:t>${col.equipada === m.id ? '' : ' (while equipped)'}.`));
                }
                if (r.botinX) { m.botinX = Math.max(m.botinX || 1, r.botinX); mensajes.push(t(idioma, `🍀 Su próxima expedición traerá **×${String(m.botinX).replace('.', ',')}** de oro.`, `🍀 Its next expedition will bring **×${m.botinX}** gold.`)); }
                if (r.escudoHasta) {
                    const PerfilBroma = require('../models/PerfilBroma.js');
                    const p0 = await PerfilBroma.findOne({ guildId, userId }).lean();
                    const desde = p0?.escudoHasta && new Date(p0.escudoHasta) > new Date(ahora) ? new Date(p0.escudoHasta) : new Date(ahora);
                    const hasta = new Date(Math.max(desde.getTime(), r.escudoHasta.getTime()));
                    await PerfilBroma.updateOne({ guildId, userId }, { $set: { escudoHasta: hasta } }, { upsert: true });
                    mensajes.push(t(idioma, `🛡️ **Escudo:** nadie te puede gastar bromas aquí hasta <t:${Math.floor(hasta.getTime() / 1000)}:t>.`, `🛡️ **Shield:** nobody can prank you here until <t:${Math.floor(hasta.getTime() / 1000)}:t>.`));
                }
                if (r.volver) {
                    m.exp = { ...m.exp, hasta: new Date(ahora - 1) };
                    mensajes.push(t(idioma, `⚡ Vuelve corriendo de la expedición.`, `⚡ It rushes back from the expedition.`));
                    recoger();
                }
                if (r.lleno) { Object.assign(m, { hambre: 100, alegria: 100, energia: 100, actualizado: new Date(ahora) }); mensajes.push(t(idioma, '✨ Barriga, alegría y energía al 100.', '✨ Tummy, joy and energy at 100.')); }
                else if (r.energia || r.alegria) {
                    const e = P.estado(m, ahora);
                    Object.assign(m, e, r.energia ? { energia: 100 } : {}, r.alegria ? { alegria: 100 } : {}, { actualizado: new Date(ahora) });
                    mensajes.push(r.energia && r.alegria ? t(idioma, '⚡💖 Energía y alegría al 100.', '⚡💖 Energy and joy at 100.') : r.energia ? t(idioma, '⚡ Energía al 100.', '⚡ Energy at 100.') : t(idioma, '💖 Alegría al 100.', '💖 Joy at 100.'));
                }
                if (r.afinidad) { const a = P.conAfinidad(m, r.afinidad); m.afinidad = (m.afinidad || 0) + a; mensajes.push(t(idioma, `💞 +${a} de afinidad.`, `💞 +${a} affinity.`)); }
                if (r.recuerdo !== undefined && r.recuerdo !== null) {
                    const rec = P.RECUERDOS[r.recuerdo];
                    if (!(m.recuerdos || []).includes(r.recuerdo)) m.recuerdos = [...(m.recuerdos || []), r.recuerdo];
                    mensajes.push(t(idioma, `🎒 Encuentra un recuerdo: ${rec[0]} ${rec[1]}`, `🎒 Finds a souvenir: ${rec[0]} ${rec[2]}`));
                }
                if (!esCarta && mensajes.length === 0) mensajes.push(`${def.emoji} ${t(idioma, def.es, def.en)}`);
            }
        } else if (que.startsWith('exp:')) {
            const r = P.salir(m, que.slice(4), col.expHoy, dia, ahora);
            if (r.fallo) fallo = r.fallo;
            else {
                Object.assign(m, { hambre: r.hambre, alegria: r.alegria, energia: r.energia, actualizado: new Date(ahora), exp: r.exp });
                colSet.expHoy = { dia, n: r.usadas };
                semAcc = 'expedicion';
                const x = P.EXPEDICIONES[r.exp.tipo];
                mensajes.push(t(idioma, `${x.emoji} Se va de «${x.es}». Vuelve en ${x.horas} h: entra a verlo luego para recoger lo que traiga.`, `${x.emoji} Off on “${x.en}”. Back in ${x.horas} h: come back later to collect what it brings.`));
                sumarMision('expedicion');
            }
        }
        if (!frase && !fallo && !P.expedicionActiva(m, ahora)) frase = P.frase(m, que === 'ver' ? 'hablar' : 'saludo', { idioma, dueno, ahora });
        // Racha: cualquier cuidado cuenta (ver no).
        const cuida = !fallo && que !== 'ver';
        if (cuida) {
            const r = P.avanzarRacha(col, dia);
            if (r.nueva) {
                colSet.racha = r.racha; colSet.ultimoDiaCuidado = dia; colSet.mejorRacha = Math.max(col.mejorRacha || 0, r.racha);
                if (r.premio) { oro += r.premio; mensajes.push(t(idioma, `🔥 ¡${r.racha} días seguidos cuidándolo! +🪙 ${r.premio}`, `🔥 ${r.racha} days in a row! +🪙 ${r.premio}`)); }
            }
        }
        if (semAcc) {
            const s = require('./granja.js').semanal(col, semAcc, 1, idioma, ahora);
            colSet.semana = s.sem; oro += s.oro; mensajes.push(...s.mensajes);
        }
        const nivelDespues = P.nivel(m.afinidad || 0);
        if (nivelDespues > nivelAntes) { mensajes.push(t(idioma, `⭐ **¡Sube a nivel ${nivelDespues} de afinidad!** Sus ventajas mejoran un poco.`, `⭐ **Affinity level ${nivelDespues}!** Its perks get a little better.`)); efecto = 'nivel'; }
        // Guardar (solo lo que cambia).
        for (const k of ['hambre', 'alegria', 'energia', 'actualizado', 'afinidad', 'ultMimo', 'exp', 'recuerdos', 'cuidados', 'cds', 'botinX']) {
            if (m[k] !== m0[k]) set[`mascotas.$[m].${k}`] = m[k];
        }
        if (mis !== col.misiones) colSet.misiones = mis;
        if (oro) colSet.oroCompis = (col.oroCompis || 0) + oro;
        if (Object.keys(set).length || Object.keys(colSet).length) {
            await ColeccionMascotas.updateOne({ userId }, { $set: { ...set, ...colSet } }, Object.keys(set).length ? { arrayFilters: [{ 'm.id': m.id }] } : {});
        }
        if (oro) await require('./economia.js').darOro(userId, oro);
        if (cuida) require('./cofres.js').olvidar(userId);
        return { col: { ...col, ...colSet }, m, mensajes, efecto, frase, fallo, falloMin, falloRareza, oro };
    });
}

const FALLOS = {
    sin: ['Aún no tienes compañeros. Consigue el primero abriendo un cofre con `/cofre abrir`.', 'You don’t have companions yet. Get your first one by opening a chest with `/chest open`.'],
    fuera: ['Está de expedición. Vuelve cuando termine.', 'It’s on an expedition. Come back when it’s done.'],
    energia: ['Está muy cansado para eso. Deja que descanse un rato (la energía se recupera sola).', 'Too tired for that. Let it rest a while (energy comes back on its own).'],
    lleno: ['¡Está llenísimo! Prueba a jugar con él.', 'It’s completely full! Try playing with it.'],
    tope: [`Ya ha hecho ${P.EXPEDICIONES_DIA} expediciones hoy. Mañana más.`, `It already went on ${P.EXPEDICIONES_DIA} expeditions today. More tomorrow.`],
    recoger: ['Ya ha vuelto: entra a verlo para recoger lo que trae.', 'It’s back: open it to collect what it brought.'],
    tipo: ['Esa expedición no existe.', 'That expedition doesn’t exist.'],
    espera: ['Aún no: podrás repetirlo en {min}.', 'Not yet: you can do it again in {min}.'],
    rareza: ['Eso solo lo hacen las mascotas más raras.', 'Only rarer pets can do that.'],
    sinCarta: ['No tienes esa carta. Consigue cartas con `/carta abrir`.', 'You don’t have that card. Get cards with `/card open`.'],
    sinMascota: ['Necesitas una mascota para usar cartas. Consíguela con `/cofre abrir`.', 'You need a pet to use cards. Get one with `/chest open`.'],
    recargando: ['Esa carta se está recargando: lista en {min}.', 'That card is recharging: ready in {min}.'],
    topeCartas: ['Ya has usado tus {n} cartas de hoy. Mañana más.', 'You’ve used your {n} cards for today. More tomorrow.'],
    accion: ['No sé hacer eso.', 'I can’t do that.'],
};
const textoFallo = (f, idioma, min = 0, n = 0) => { const x = FALLOS[f] || FALLOS.accion; return t(idioma, x[0], x[1]).replace('{min}', tiempo(min * 60000, idioma)).replace('{n}', n); };

function tiempo(ms, idioma) {
    const min = Math.max(1, Math.ceil(ms / 60000));
    const h = Math.floor(min / 60);
    return h ? t(idioma, `${h} h ${min % 60} min`, `${h} h ${min % 60} min`) : `${min} min`;
}

// Mensaje completo de /compi (tarjeta + botones). `ajeno`: se mira el de otra persona (sin botones).
// Ventajas que se notan en ESTE servidor (según lo que tenga activado).
function ventajasAqui(v, cfg, idioma) {
    const pct = (x) => `+${Math.round(x * 1000) / 10} %`;
    const l = [];
    if (v.xp && cfg?.niveles?.activo !== false) l.push(t(idioma, `✨ ${pct(v.xp)} de XP al hablar`, `✨ ${pct(v.xp)} XP when chatting`));
    if (v.diario) l.push(t(idioma, `🪙 ${pct(v.diario)} de oro en /diario`, `🪙 ${pct(v.diario)} gold on /daily`));
    if (v.vuelta && cfg?.casino?.activo) l.push(t(idioma, `🎰 ${pct(v.vuelta)} de lo perdido en el casino vuelve`, `🎰 ${pct(v.vuelta)} of casino losses back`));
    if (v.bromas && cfg?.bromas?.activo) l.push(t(idioma, `🃏 Bromas un ${Math.round(v.bromas * 100)} % más baratas`, `🃏 Pranks ${Math.round(v.bromas * 100)}% cheaper`));
    if (v.liga && cfg?.liga?.activo) l.push(t(idioma, `🏆 ${pct(v.liga)} de puntos al impulsar la Liga`, `🏆 ${pct(v.liga)} points when boosting the League`));
    if (v.expedicion) l.push(t(idioma, `🧭 ${pct(v.expedicion)} de oro en expediciones`, `🧭 ${pct(v.expedicion)} expedition gold`));
    return l;
}

async function vista({ ownerId, duenoNombre, idioma, res, ajeno = false, cfg = null }) {
    const { col, m } = res;
    const ahora = Date.now();
    const def = K.def(m.id);
    const rz = K.RAREZAS[def.rareza];
    const e = P.estado(m, ahora);
    const fuera = P.expedicionActiva(m, ahora);
    const h = fuera ? 'fuera' : P.humor(e);
    const pr = P.progresoNivel(m.afinidad || 0);
    const x = fuera ? P.EXPEDICIONES[m.exp.tipo] : null;
    const equipado = col.equipada === m.id;
    const datos = {
        id: m.id, nombre: nombreDe(m, idioma), rarezaTexto: t(idioma, rz.es, rz.en).toUpperCase(), estrellas: m.estrellas,
        nivel: pr.nivel, progreso: pr.max ? 1 : pr.actual / pr.total, estado: e,
        humor: { emoji: P.HUMOR[h].emoji, texto: t(idioma, P.HUMOR[h].es, P.HUMOR[h].en) },
        frase: res.frase || '…',
        fuera: fuera ? t(idioma, `${x.emoji} De «${x.es}». Vuelve en ${tiempo(new Date(m.exp.hasta).getTime() - ahora, idioma)}.`, `${x.emoji} On “${x.en}”. Back in ${tiempo(new Date(m.exp.hasta).getTime() - ahora, idioma)}.`) : null,
        etiquetas: {
            hambre: t(idioma, '🍖 Barriga', '🍖 Tummy'), alegria: t(idioma, '💖 Alegría', '💖 Joy'), energia: t(idioma, '⚡ Energía', '⚡ Energy'),
            nivel: pr.max ? t(idioma, `Afinidad · nivel ${pr.nivel} (máximo)`, `Affinity · level ${pr.nivel} (max)`) : t(idioma, `Afinidad · nivel ${pr.nivel} (${pr.actual}/${pr.total})`, `Affinity · level ${pr.nivel} (${pr.actual}/${pr.total})`),
        },
        pie: t(idioma, `De ${duenoNombre}${equipado ? ' · equipado' : ''} · ${(m.cuidados || 0)} cuidados`, `${duenoNombre}’s${equipado ? ' · equipped' : ''} · ${(m.cuidados || 0)} cares`),
    };
    const img = await require('./compisArte.js').tarjeta(datos, res.efecto).catch((err) => { console.error('Tarjeta compi:', err.message); return null; });
    const dia = P.diaDe(ahora);
    const mis = col.misiones && col.misiones.dia === dia ? col.misiones : { prog: {}, hechas: [] };
    const misiones = P.misionesDelDia(dia).map((id) => {
        const d = P.MISIONES[id]; const hecha = (mis.hechas || []).includes(id);
        return `${hecha ? '✅' : '⬜'} ${d.emoji} ${t(idioma, d.es, d.en)}${hecha ? '' : ` (${Math.min(d.n, (mis.prog || {})[id] || 0)}/${d.n})`}`;
    }).join('\n');
    const potActiva = col.potencia && col.potencia.mascota === m.id && new Date(col.potencia.hasta) > new Date(ahora) ? col.potencia.valor || 0 : 0;
    const v = K.ventajas(m.id, m.estrellas, P.extraCuidado(m, ahora) + potActiva);
    const poder = P.poderDe(m);
    const faltaP = P.faltaPoder(col, ahora);
    const recs = (m.recuerdos || []).map((i) => P.RECUERDOS[i]?.[0]).filter(Boolean);
    const racha = col.ultimoDiaCuidado === dia || col.ultimoDiaCuidado === new Date(Date.parse(`${dia}T00:00:00Z`) - 86400000).toISOString().slice(0, 10) ? (col.racha || 0) : 0;
    const emb = new EmbedBuilder().setColor(rz.color)
        .setTitle(`${def.emoji} ${nombreDe(m, idioma)}`)
        .setDescription([
            ...(res.mensajes || []),
            res.fallo ? `⚠️ ${textoFallo(res.fallo, idioma, res.falloMin, res.falloRareza)}` : '',
            def.desc ? `*${def.desc}*` : '',
            def.serie ? `📺 ${def.serie}` : '',
            K.habilidad(m.id) ? t(idioma, `🌟 **Habilidad exclusiva:** ${K.habilidad(m.id).es}`, `🌟 **Exclusive ability:** ${K.habilidad(m.id).en}`) : '',
            col.potencia && col.potencia.mascota === m.id && new Date(col.potencia.hasta) > new Date(ahora) ? t(idioma, `💥 **Potenciada +${Math.round(col.potencia.valor * 100)} %** por una carta hasta <t:${Math.floor(new Date(col.potencia.hasta).getTime() / 1000)}:t>`, `💥 **Boosted +${Math.round(col.potencia.valor * 100)}%** by a card until <t:${Math.floor(new Date(col.potencia.hasta).getTime() / 1000)}:t>`) : '',
            m.botinX ? t(idioma, `🍀 Su próxima expedición trae ×${String(m.botinX).replace('.', ',')} de oro`, `🍀 Its next expedition brings ×${m.botinX} gold`) : '',
            poder.nombre && !(res.mensajes || []).some((x) => x.includes(t(idioma, poder.nombre.es, poder.nombre.en))) ? t(idioma, `${poder.emoji} **${poder.nombre.es}** — ${P.textoEfecto(poder.efecto, 'es')}`, `${poder.emoji} **${poder.nombre.en}** — ${P.textoEfecto(poder.efecto, 'en')}`) : '',
        ].filter(Boolean).join('\n') || null)
        .addFields(
            { name: t(idioma, '📋 Misiones de hoy', '📋 Today’s missions'), value: misiones, inline: true },
            { name: t(idioma, '🔥 Racha', '🔥 Streak'), value: t(idioma, `${racha} día${racha === 1 ? '' : 's'}\n🧭 Expediciones: ${col.expHoy?.dia === dia ? col.expHoy.n : 0}/${P.EXPEDICIONES_DIA}`, `${racha} day${racha === 1 ? '' : 's'}\n🧭 Expeditions: ${col.expHoy?.dia === dia ? col.expHoy.n : 0}/${P.EXPEDICIONES_DIA}`), inline: true },
            { name: t(idioma, `🎒 Recuerdos (${recs.length}/${P.RECUERDOS.length})`, `🎒 Souvenirs (${recs.length}/${P.RECUERDOS.length})`), value: recs.join(' ') || t(idioma, 'Tráelos de las expediciones.', 'Bring them back from expeditions.'), inline: false },
        )
        .setFooter({ text: t(idioma, `✨ Poder: ${poder.es}${faltaP ? ` · listo en ${tiempo(faltaP * 60000, idioma)}` : ' · ¡listo!'}`, `✨ Power: ${poder.en}${faltaP ? ` · ready in ${tiempo(faltaP * 60000, idioma)}` : ' · ready!'}`).slice(0, 2000) });
    // Ventajas aquí y lo que sabe hacer (y lo que harían los más raros).
    const aqui = ventajasAqui(v, cfg, idioma);
    emb.addFields({ name: equipado ? t(idioma, '💎 Te da en este servidor', '💎 What it gives you here') : t(idioma, '💎 Si lo equipas, aquí te daría', '💎 If equipped, here it would give'), value: aqui.join('\n') || '—', inline: false });
    const sabe = P.interaccionesDe(m);
    const siguiente = Object.entries(P.INTERACCIONES).filter(([, x]) => x.rareza > P.ordenDe(m));
    const proxR = siguiente.length ? Math.min(...siguiente.map(([, x]) => x.rareza)) : null;
    const RZ = Object.values(K.RAREZAS).find((r) => r.orden === proxR);
    emb.addFields({ name: t(idioma, `🎀 Sabe hacer (${4 + sabe.length})`, `🎀 Can do (${4 + sabe.length})`), value: [
        `🍖 🎾 🤗 💬${sabe.length ? ` · ${sabe.map((id) => P.INTERACCIONES[id].emoji).join(' ')}` : ''}`,
        RZ ? t(idioma, `🔒 Uno ${RZ.es.toLowerCase()} además: ${siguiente.filter(([, x]) => x.rareza === proxR).map(([, x]) => `${x.emoji} ${x.es}`).join(', ')}`, `🔒 A ${RZ.en.toLowerCase()} one also: ${siguiente.filter(([, x]) => x.rareza === proxR).map(([, x]) => `${x.emoji} ${x.en}`).join(', ')}`) : '',
    ].filter(Boolean).join('\n'), inline: false });
    if (img) emb.setImage(`attachment://${img.nombre}`);
    const files = img ? [new AttachmentBuilder(img.buffer, { name: img.nombre })] : [];
    if (ajeno) return { embeds: [emb], files, components: [], attachments: [], allowedMentions: { parse: [] } };
    const cid = (a) => `cmp:${a}:${ownerId}:${m.id}`;
    const filas = [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(cid('comer')).setEmoji('🍖').setLabel(t(idioma, 'Dar de comer', 'Feed')).setStyle(ButtonStyle.Success).setDisabled(fuera),
        new ButtonBuilder().setCustomId(cid('jugar')).setEmoji('🎾').setLabel(t(idioma, 'Jugar', 'Play')).setStyle(ButtonStyle.Primary).setDisabled(fuera),
        new ButtonBuilder().setCustomId(cid('mimar')).setEmoji('🤗').setLabel(t(idioma, 'Mimar', 'Cuddle')).setStyle(ButtonStyle.Primary).setDisabled(fuera),
        new ButtonBuilder().setCustomId(cid('hablar')).setEmoji('💬').setLabel(t(idioma, 'Hablar', 'Talk')).setStyle(ButtonStyle.Secondary).setDisabled(fuera),
        new ButtonBuilder().setCustomId(cid('poder')).setEmoji(poder.emoji).setStyle(faltaP ? ButtonStyle.Secondary : ButtonStyle.Danger).setDisabled(!!faltaP)
            .setLabel(faltaP ? t(idioma, `Poder en ${tiempo(faltaP * 60000, idioma)}`, `Power in ${tiempo(faltaP * 60000, idioma)}`)
                : poder.nombre ? t(idioma, poder.nombre.es, poder.nombre.en).split(':')[0].slice(0, 40) : t(idioma, '¡Poder!', 'Power!')),
    )];
    if (!fuera) {
        filas.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`cmp_exp:${ownerId}:${m.id}`)
            .setPlaceholder(t(idioma, '🧭 Mandarlo de expedición…', '🧭 Send it on an expedition…'))
            .addOptions(Object.entries(P.EXPEDICIONES).map(([id, ex]) => ({
                value: id, emoji: ex.emoji, label: `${t(idioma, ex.es, ex.en)} · ${ex.horas} h`.slice(0, 100),
                description: t(idioma, `Gasta ⚡${ex.energia} · trae 🪙 ${ex.oro[0]}-${ex.oro[1]}+ y quizá un recuerdo`, `Uses ⚡${ex.energia} · brings 🪙 ${ex.oro[0]}-${ex.oro[1]}+ and maybe a souvenir`).slice(0, 100),
            })))));
    }
    const extras = P.interaccionesDe(m);
    if (!fuera && extras.length) {
        filas.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`cmp_int:${ownerId}:${m.id}`)
            .setPlaceholder(t(idioma, `🎀 Más cosas que hacer (${extras.length})…`, `🎀 More things to do (${extras.length})…`))
            .addOptions(extras.map((id) => {
                const x = P.INTERACCIONES[id]; const f = P.falta(m, id, ahora);
                return { value: id, emoji: x.emoji, label: t(idioma, x.es, x.en).slice(0, 100),
                    description: (f ? t(idioma, `⏳ Podrás en ${tiempo(f * 60000, idioma)}`, `⏳ Available in ${tiempo(f * 60000, idioma)}`) : t(idioma, `Listo · +${x.afinidad} de afinidad${x.oro ? ' · trae oro' : ''}`, `Ready · +${x.afinidad} affinity${x.oro ? ' · brings gold' : ''}`)).slice(0, 100) };
            }))));
    }
    const lista = [...(col.mascotas || [])].sort((a, b) => (b.id === col.equipada) - (a.id === col.equipada) || K.RAREZAS[K.def(b.id).rareza].orden - K.RAREZAS[K.def(a.id).rareza].orden).slice(0, 25);
    if (lista.length > 1) {
        filas.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`cmp_sel:${ownerId}`)
            .setPlaceholder(t(idioma, '🔄 Ver otro compañero…', '🔄 See another companion…'))
            .addOptions(lista.map((c) => {
                const hc = P.expedicionActiva(c, ahora) ? 'fuera' : P.humor(P.estado(c, ahora));
                return { value: c.id, emoji: K.def(c.id).emoji, label: `${corto(c, idioma)} ${'★'.repeat(c.estrellas || 1)}`.slice(0, 100), default: c.id === m.id, description: `${P.HUMOR[hc].emoji} ${t(idioma, P.HUMOR[hc].es, P.HUMOR[hc].en)} · ${t(idioma, 'nivel', 'level')} ${P.nivel(c.afinidad || 0)} · ${rzTexto(c.id, idioma)}`.slice(0, 100) };
            }))));
    }
    filas.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(cid('equipar')).setEmoji('✅').setLabel(equipado ? t(idioma, 'Equipado', 'Equipped') : t(idioma, 'Equipar', 'Equip')).setStyle(ButtonStyle.Secondary).setDisabled(equipado),
        new ButtonBuilder().setCustomId(cid('apodo')).setEmoji('✏️').setLabel(t(idioma, 'Ponerle apodo', 'Nickname')).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(cid('ver')).setEmoji('🔄').setLabel(t(idioma, 'Actualizar', 'Refresh')).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`grj:abrir:${ownerId}`).setEmoji('🧺').setLabel(t(idioma, 'Granja', 'Farm')).setStyle(ButtonStyle.Success),
        ...(cfg?.compis?.anime ? [new ButtonBuilder().setCustomId(cid('cartas')).setEmoji('🃏').setLabel(t(idioma, `Cartas (${(col.cartas || []).length})`, `Cards (${(col.cartas || []).length})`)).setStyle(ButtonStyle.Primary)] : []),
    ));
    return { embeds: [emb], files, components: filas, attachments: [], allowedMentions: { parse: [] } };
}

// Elegir qué carta usar en la mascota (1.24.0). Lo ve solo su dueño.
function selectorCartas(col, m, ownerId, msgId, idioma) {
    const S = require('./cartasNucleo.js');
    const ahora = Date.now();
    const dia = P.diaDe(ahora);
    const usadas = col.cartasHoy && col.cartasHoy.dia === dia ? col.cartasHoy.n || 0 : 0;
    const limite = S.limiteDia(col.equipada || m.id);
    const lista = (col.cartas || []).map((c) => ({ c, d: K.def(c.id), f: S.faltaCarta(c, ahora) }))
        .sort((a, b) => (a.f > 0) - (b.f > 0) || K.RAREZAS[b.d.rareza].orden - K.RAREZAS[a.d.rareza].orden || (b.c.estrellas || 1) - (a.c.estrellas || 1));
    const listas = lista.filter((x) => !x.f).length;
    const e = new EmbedBuilder().setColor('#8b5cf6').setTitle(t(idioma, `🃏 Usar una carta en ${corto(m, idioma)}`, `🃏 Use a card on ${corto(m, idioma)}`))
        .setDescription([
            t(idioma, `Hoy: **${usadas}/${limite}** cartas usadas · ${listas} listas · cada carta se recarga en ${S.ESPERA_CARTA_H} h.`, `Today: **${usadas}/${limite}** cards used · ${listas} ready · each card recharges in ${S.ESPERA_CARTA_H} h.`),
            K.habilidad(m.id) && ['cartas', 'divino'].includes(K.habilidad(m.id).tipo) ? t(idioma, `🌟 ${corto(m, idioma)} hace las cartas más fuertes: ${K.habilidad(m.id).es}`, `🌟 ${corto(m, idioma)} makes cards stronger: ${K.habilidad(m.id).en}`) : '',
            lista.length ? '' : t(idioma, 'No tienes cartas. Consíguelas con `/carta abrir`.', 'You have no cards. Get them with `/card open`.'),
        ].filter(Boolean).join('\n'));
    const comps = [];
    if (lista.length) {
        comps.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`cmp_crt:${ownerId}:${msgId || '0'}:${m.id}`)
            .setPlaceholder(t(idioma, '🃏 Elige una carta…', '🃏 Pick a card…')).setDisabled(usadas >= limite || !listas)
            .addOptions(lista.slice(0, 25).map(({ c, d, f }) => {
                const ef = P.efectoCarta(c.id, c.estrellas || 1, m.id);
                return { value: c.id, emoji: f ? '⏳' : (P.ARQUETIPOS[d.poder.tipo]?.emoji || '🃏'), label: `${d.es} ${'★'.repeat(c.estrellas || 1)} · ${t(idioma, d.poder.es, d.poder.en)}`.slice(0, 100),
                    description: (f ? t(idioma, `Se recarga en ${tiempo(f * 60000, idioma)}`, `Recharges in ${tiempo(f * 60000, idioma)}`) : P.textoEfecto(ef, idioma)).slice(0, 100) };
            }))));
    }
    return { embeds: [e], components: comps, flags: 64 };
}

// Botones y menús (cmp:…, cmp_exp:…, cmp_sel:…, cmp_apodo:…, cmp_crt:…).
async function manejar(interaction) {
    const id = interaction.customId || '';
    if (!id.startsWith('cmp')) return false;
    const { getConfigCached } = require('./config.js');
    const { idiomaInteraccion } = require('./preferencias.js');
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const idioma = await idiomaInteraccion(interaction, cfg);
    const partes = id.split(':');
    let que; let owner; let comp;
    if (partes[0] === 'cmp') { que = partes[1]; owner = partes[2]; comp = partes.slice(3).join(':'); }
    else if (partes[0] === 'cmp_exp') { owner = partes[1]; comp = partes.slice(2).join(':'); que = `exp:${interaction.values[0]}`; }
    else if (partes[0] === 'cmp_sel') { owner = partes[1]; comp = interaction.values[0]; que = 'ver'; }
    else if (partes[0] === 'cmp_crt') { owner = partes[1]; comp = partes.slice(3).join(':'); que = `carta:${interaction.values[0]}`; }
    else if (partes[0] === 'cmp_int') { owner = partes[1]; comp = partes.slice(2).join(':'); que = `int:${interaction.values[0]}`; }
    else if (partes[0] === 'cmp_apodo') { owner = partes[1]; comp = partes.slice(2).join(':'); que = 'apodo_guardar'; }
    else return false;
    if (interaction.user.id !== owner) {
        await interaction.reply({ content: t(idioma, '🐾 Este compañero no es tuyo. Mira el tuyo con `/compi`.', '🐾 This companion isn’t yours. See yours with `/companion`.'), flags: 64 });
        return true;
    }
    if (que === 'cartas') {
        const col = await ColeccionMascotas.findOne({ userId: owner }).lean();
        const m = elegir(col, comp);
        if (!m) { await interaction.reply({ content: textoFallo('sin', idioma), flags: 64 }); return true; }
        await interaction.reply(selectorCartas(col, m, owner, interaction.message?.id, idioma));
        return true;
    }
    if (partes[0] === 'cmp_crt') {
        // Se usa la carta, se pone al día la tarjeta pública de /compi y aquí se ve qué ha pasado.
        await interaction.deferUpdate();
        const nombre = interaction.user.displayName || interaction.user.username;
        const res = await accion(owner, comp, que, { idioma, dueno: nombre, guildId: interaction.guildId, bromas: !!cfg?.bromas?.activo });
        const msgId = partes[2];
        let editado = false;
        if (!res.fallo && msgId && msgId !== '0') {
            const original = await interaction.channel?.messages.fetch(msgId).catch(() => null);
            if (original) editado = !!(await original.edit(await vista({ ownerId: owner, duenoNombre: nombre, idioma, res, cfg })).catch(() => null));
        }
        const col = await ColeccionMascotas.findOne({ userId: owner }).lean();
        const sel = selectorCartas(col, elegir(col, comp) || res.m, owner, msgId, idioma);
        const resumen = res.fallo ? `⚠️ ${textoFallo(res.fallo, idioma, res.falloMin, res.falloRareza)}` : (res.mensajes || []).join('\n');
        if (!res.fallo && !editado) {
            await interaction.editReply({ ...(await vista({ ownerId: owner, duenoNombre: nombre, idioma, res, cfg })), flags: undefined });
            return true;
        }
        sel.embeds[0].setDescription(`${resumen}\n\n${sel.embeds[0].data.description || ''}`.slice(0, 4000));
        await interaction.editReply({ embeds: sel.embeds, components: sel.components });
        return true;
    }
    if (que === 'apodo') {
        const modal = new ModalBuilder().setCustomId(`cmp_apodo:${owner}:${comp}`).setTitle(t(idioma, 'Apodo de tu compañero', 'Your companion’s nickname'))
            .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('apodo').setLabel(t(idioma, 'Apodo (vacío para quitarlo)', 'Nickname (empty to remove)')).setStyle(TextInputStyle.Short).setMaxLength(24).setRequired(false)));
        await interaction.showModal(modal);
        return true;
    }
    await interaction.deferUpdate();
    let res;
    if (que === 'equipar') {
        await require('./cofres.js').equipar(owner, comp);
        res = await accion(owner, comp, 'ver', { idioma, dueno: interaction.user.displayName || interaction.user.username, guildId: interaction.guildId, bromas: !!cfg?.bromas?.activo });
        if (!res.fallo) res.mensajes.unshift(t(idioma, `✅ Ahora te acompaña ${K.def(comp).emoji} **${corto(res.m, idioma)}**: sus ventajas ya cuentan.`, `✅ ${K.def(comp).emoji} **${corto(res.m, idioma)}** is now with you: its perks are active.`));
    } else if (que === 'apodo_guardar') {
        const apodo = String(interaction.fields.getTextInputValue('apodo') || '').replace(/[\n\r@#<>`*_~|]/g, '').trim().slice(0, 24);
        await ColeccionMascotas.updateOne({ userId: owner }, apodo ? { $set: { 'mascotas.$[m].apodo': apodo } } : { $unset: { 'mascotas.$[m].apodo': 1 } }, { arrayFilters: [{ 'm.id': comp }] });
        res = await accion(owner, comp, 'ver', { idioma, dueno: interaction.user.displayName || interaction.user.username, guildId: interaction.guildId, bromas: !!cfg?.bromas?.activo });
        if (!res.fallo) res.mensajes.unshift(apodo ? t(idioma, `✏️ Ahora se llama **${apodo}**.`, `✏️ It’s now called **${apodo}**.`) : t(idioma, '✏️ Apodo quitado.', '✏️ Nickname removed.'));
    } else {
        res = await accion(owner, comp, que, { idioma, dueno: interaction.user.displayName || interaction.user.username, guildId: interaction.guildId, bromas: !!cfg?.bromas?.activo });
    }
    if (res.fallo === 'sin') { await interaction.followUp({ content: textoFallo('sin', idioma), flags: 64 }); return true; }
    await interaction.editReply(await vista({ ownerId: owner, duenoNombre: interaction.user.displayName || interaction.user.username, idioma, res, cfg }));
    return true;
}

// Para el panel: cómo van los compañeros de la gente del servidor.
async function resumenServidor(client, guildId) {
    const guild = client.guilds.cache.get(guildId);
    const ids = guild ? [...guild.members.cache.keys()] : [];
    const cols = ids.length ? await ColeccionMascotas.find({ userId: { $in: ids }, 'mascotas.0': { $exists: true } }).select('userId mascotas equipada racha').lean() : [];
    const top = cols.map((c) => {
        const eq = elegir(c, c.equipada);
        return { id: c.userId, nombre: guild.members.cache.get(c.userId)?.displayName || c.userId, avatar: guild.members.cache.get(c.userId)?.user.displayAvatarURL({ size: 64 }) || null, companero: eq?.id, apodo: eq?.apodo || null, nivel: P.nivel(eq?.afinidad || 0), racha: c.racha || 0, total: c.mascotas.length };
    }).sort((a, b) => b.nivel - a.nivel || b.total - a.total).slice(0, 10);
    return { personas: cols.length, top };
}

module.exports = { cargarPersonalizados, idServidor, accion, vista, manejar, resumenServidor, textoFallo };

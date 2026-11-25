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
// 1.30.0: todo es de la persona EN ESTE SERVIDOR (guildId obligatorio).
async function accion(guildId, userId, compId, que, { idioma = 'es', dueno = '', ahora = Date.now(), bromas = false, expGrupo = null } = {}) {
    if (!guildId) throw new Error('mascotas sin servidor');
    return enCola(`${guildId}:${userId}`, async () => {
        const col = await ColeccionMascotas.findOne({ guildId, userId }).lean();
        const m0 = elegir(col, compId);
        if (!m0) return { fallo: 'sin' };
        let m = { ...m0 };
        const set = {}; const mensajes = []; let efecto = null; let oro = 0;
        const nivelAntes = P.nivel(m.afinidad || 0);
        const dia = P.diaDe(ahora);
        let mis = col.misiones; let colSet = {};
        let misCumplidas = 0; let semCumplidas = 0; // para el pase (1.29.0)
        const sumarMision = (a) => {
            const r = P.avanzarMision(mis, a, dia);
            mis = r.mis;
            if (r.cumplida) {
                misCumplidas++;
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
            const bonusGrupo = m.exp.bonus || 1;
            oro += b.oro; m.afinidad = (m.afinidad || 0) + b.afinidad;
            // Mientras está fuera no gasta: se cuenta desde que volvió.
            const e = P.estado({ ...m, exp: null, actualizado: m.exp.hasta }, ahora);
            Object.assign(m, e, { actualizado: new Date(ahora), exp: null });
            // 1.32.0: a veces vuelve con una historia (más oro, un amigo, un atajo…).
            const ev = P.eventoExpedicion();
            if (ev) {
                if (ev.oroX) { const antes = b.oro; b.oro = Math.round(b.oro * ev.oroX); oro += b.oro - antes; }
                if (ev.afinidad) m.afinidad = (m.afinidad || 0) + ev.afinidad;
                for (const k of ['alegria', 'energia', 'hambre']) if (ev[k]) m[k] = Math.max(0, Math.min(100, (m[k] ?? 80) + ev[k]));
                if (ev.recuerdo && b.recuerdo === null) b.recuerdo = Math.floor(Math.random() * P.RECUERDOS.length);
            }
            if (b.recuerdo !== null && !(m.recuerdos || []).includes(b.recuerdo)) m.recuerdos = [...(m.recuerdos || []), b.recuerdo];
            const rec = b.recuerdo !== null ? P.RECUERDOS[b.recuerdo] : null;
            const conGrupo = bonusGrupo > 1 ? t(idioma, ` (con el grupo: ×${String(bonusGrupo).replace('.', ',')})`, ` (with the group: ×${bonusGrupo})`) : '';
            mensajes.push(t(idioma, `${x.emoji} **¡Ha vuelto de «${x.es}»!** Trae 🪙 ${b.oro}${conGrupo}${rec ? ` y un recuerdo: ${rec[0]} ${rec[1]}` : ''}.`, `${x.emoji} **Back from “${x.en}”!** Brought 🪙 ${b.oro}${conGrupo}${rec ? ` and a souvenir: ${rec[0]} ${rec[2]}` : ''}.`));
            if (ev) mensajes.push(`${ev.emoji} *${t(idioma, ev.es, ev.en)}*${ev.afinidad ? ` · 💞 +${ev.afinidad}` : ''}`);
            efecto = 'vuelta';
        };
        recoger();
        let frase = null; let fallo = null; let falloMin = 0; let falloRareza = 0;
        let semAcc = null; // misión semanal que cuenta (1.28.0)
        let misJuego = 0; // 1.32.0: minijuegos (XP del pase)
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
        } else if (que.startsWith('comida:')) {
            // 1.32.0: darle una comida concreta. La favorita le encanta; la odiada, no tanto.
            const r = P.comer(m, que.slice(7), ahora);
            if (r.fallo) fallo = r.fallo;
            else {
                Object.assign(m, { hambre: r.hambre, alegria: r.alegria, energia: r.energia, actualizado: new Date(ahora) });
                m.afinidad = (m.afinidad || 0) + r.afinidad;
                m.cuidados = (m.cuidados || 0) + 1;
                const cm = P.COMIDAS[r.comida];
                if (r.reaccion === 'encanta') {
                    const nueva = !m.gustos?.favorita;
                    m.gustos = { ...(m.gustos || {}), favorita: true };
                    mensajes.push(t(idioma, `${cm.emoji} **¡Le ENCANTA ${cm.art}!** 💖 +${r.afinidad} de afinidad${nueva ? ' · ¡Has descubierto su comida favorita!' : ''}`, `${cm.emoji} **It LOVES ${cm.en.toLowerCase()}!** 💖 +${r.afinidad} affinity${nueva ? ' · You found its favourite food!' : ''}`));
                    efecto = 'mimar';
                } else if (r.reaccion === 'odia') {
                    const nueva = !m.gustos?.odiada;
                    m.gustos = { ...(m.gustos || {}), odiada: true };
                    mensajes.push(t(idioma, `${cm.emoji} Pone cara rara… **no le gusta nada ${cm.art}**${nueva ? ' (ya lo sabes para otra vez)' : ''}.`, `${cm.emoji} Makes a face… **it really doesn’t like ${cm.en.toLowerCase()}**${nueva ? ' (now you know)' : ''}.`));
                    efecto = 'comer';
                } else { mensajes.push(t(idioma, `${cm.emoji} Se come ${cm.art} tan a gusto.`, `${cm.emoji} Happily eats the ${cm.en.toLowerCase()}.`)); efecto = 'comer'; }
                frase = P.frase(m, 'comer', { idioma, dueno, ahora });
                semAcc = 'cuidar';
                sumarMision('comer');
                if (r.humor === 'feliz') sumarMision('feliz');
            }
        } else if (que.startsWith('mj:')) {
            // 1.32.0: minijuego ya jugado (la respuesta correcta la guarda el bot, no el botón).
            const [, juego, eleccion, correcta] = que.split(':');
            const hoy = col.mjHoy?.dia === dia ? col.mjHoy.n || 0 : 0;
            const premiado = hoy < P.MINIJUEGOS_PREMIADOS_DIA;
            const r = P.jugarMinijuego(m, juego, eleccion, correcta, { ahora, premiado });
            if (r.fallo) fallo = r.fallo;
            else {
                Object.assign(m, { hambre: r.hambre, alegria: r.alegria, energia: r.energia, actualizado: new Date(ahora) });
                m.afinidad = (m.afinidad || 0) + r.afinidad;
                oro += r.oro;
                colSet.mjHoy = { dia, n: hoy + 1 };
                const j = P.MINIJUEGOS[juego];
                mensajes.push(r.gana
                    ? t(idioma, `${j.emoji} **¡Bien!** Lo habéis pasado genial. 💞 +${r.afinidad}${r.oro ? ` · 🪙 +${r.oro}` : ''}`, `${j.emoji} **Nice!** You had a great time. 💞 +${r.afinidad}${r.oro ? ` · 🪙 +${r.oro}` : ''}`)
                    : t(idioma, `${j.emoji} ¡Casi! Aun así se lo ha pasado bien. 💞 +${r.afinidad}`, `${j.emoji} So close! It still had fun. 💞 +${r.afinidad}`));
                if (!premiado) mensajes.push(t(idioma, `*Hoy ya has jugado ${P.MINIJUEGOS_PREMIADOS_DIA} veces con premio: ahora es solo por diversión.*`, `*You’ve played ${P.MINIJUEGOS_PREMIADOS_DIA} rewarded games today: now it’s just for fun.*`));
                efecto = r.gana ? 'juego' : 'jugar';
                frase = P.frase(m, 'jugar', { idioma, dueno, ahora });
                sumarMision('jugar');
                misJuego = 1;
            }
        } else if (que.startsWith('acc:')) {
            // 1.32.0: ponerle (o quitarle) un accesorio del armario.
            const acc = que.slice(4) || null;
            if (acc && !(col.armario || []).includes(acc)) fallo = 'sinAccesorio';
            else { m.acc = acc || null; mensajes.push(acc ? t(idioma, `🎀 Estrena accesorio: ${require('./sprites.js').ACCESORIOS[acc].emoji} **${require('./sprites.js').ACCESORIOS[acc].es}**. ¡Qué bien le queda!`, `🎀 New look: ${require('./sprites.js').ACCESORIOS[acc].emoji} **${require('./sprites.js').ACCESORIOS[acc].en}**. Looking sharp!`) : t(idioma, '🎀 Accesorio quitado.', '🎀 Accessory removed.')); efecto = acc ? 'mimar' : null; }
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
                ? require('./cartasNucleo.js').usarCarta(col, que.slice(6), m, { ahora, dia, bromas, equipada: col.equipada })
                : P.usarPoder(m, col, { ahora, bromas });
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
            // Las de grupo solo salen desde /expedicion (con su bonus); aquí no.
            const r = !!P.EXPEDICIONES[que.slice(4)]?.grupo !== !!expGrupo ? { fallo: 'tipo' } : P.salir(m, que.slice(4), col.expHoy, dia, ahora);
            if (r.fallo) fallo = r.fallo;
            else {
                Object.assign(m, { hambre: r.hambre, alegria: r.alegria, energia: r.energia, actualizado: new Date(ahora), exp: { ...r.exp, ...(expGrupo || {}) } });
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
            if (s.oro) semCumplidas = 1;
        }
        const nivelDespues = P.nivel(m.afinidad || 0);
        if (nivelDespues > nivelAntes) { mensajes.push(t(idioma, `⭐ **¡Sube a nivel ${nivelDespues} de afinidad!** Sus ventajas mejoran un poco.`, `⭐ **Affinity level ${nivelDespues}!** Its perks get a little better.`)); efecto = 'nivel'; }
        // 1.32.0: al llegar a los niveles 10 y 20 evoluciona (bebé → joven → adulto) y cambia su dibujo.
        const SPR = require('./sprites.js');
        if (SPR.etapaDe(nivelDespues) > SPR.etapaDe(nivelAntes) && SPR.tiene(m.id)) {
            const et = SPR.ETAPAS[SPR.etapaDe(nivelDespues)];
            mensajes.push(t(idioma, `🌟 **¡${nombreDe(m, idioma)} ha evolucionado!** Ahora es **${et.es}**: más grande y con su forma nueva.`, `🌟 **${nombreDe(m, idioma)} evolved!** It’s now **${et.en}**: bigger and in its new form.`));
            efecto = 'evolucion';
        }
        // Guardar (solo lo que cambia).
        for (const k of ['hambre', 'alegria', 'energia', 'actualizado', 'afinidad', 'ultMimo', 'exp', 'recuerdos', 'cuidados', 'cds', 'botinX', 'acc', 'gustos']) {
            if (m[k] !== m0[k]) set[`mascotas.$[m].${k}`] = m[k];
        }
        if (mis !== col.misiones) colSet.misiones = mis;
        if (oro) colSet.oroCompis = (col.oroCompis || 0) + oro;
        if (Object.keys(set).length || Object.keys(colSet).length) {
            await ColeccionMascotas.updateOne({ guildId, userId }, { $set: { ...set, ...colSet } }, Object.keys(set).length ? { arrayFilters: [{ 'm.id': m.id }] } : {});
        }
        if (oro) await require('./economia.js').en(guildId).darOro(userId, oro);
        if (cuida) require('./cofres.js').olvidar(guildId, userId);
        if (semAcc || misCumplidas || misJuego) mensajes.push(...await require('./pase.js').registrar(guildId, userId, [[semAcc, semAcc ? 1 : 0], ['mision', misCumplidas], ['misionSemanal', semCumplidas], ['minijuego', misJuego]], { idioma, ahora }).catch(() => []));
        return { col: { ...col, ...colSet }, m, mensajes, efecto, frase, fallo, falloMin, falloRareza, oro };
    });
}

const FALLOS = {
    sin: ['Aún no tienes compañeros. Consigue el primero abriendo un cofre con `/cofre abrir`. ¿Perdido? `/empezar` te guía paso a paso.', 'You don’t have companions yet. Get your first one by opening a chest with `/chest open`. Lost? `/start` guides you step by step.'],
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
    enfermo: ['Está malito 🤒: así no puede salir. Dale de comer y mímalo un poco para que se cure.', 'It’s feeling sick 🤒: it can’t go out like this. Feed it and cuddle it a bit so it gets better.'],
    sinAccesorio: ['Aún no tienes ese accesorio: cómpralo en 🎀 Armario.', 'You don’t own that accessory yet: buy it in 🎀 Wardrobe.'],
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
        humorClave: h, variante: m.variante || null, acc: m.acc || null,
        etapaTexto: require('./sprites.js').tiene(m.id) ? (() => { const et = require('./sprites.js').ETAPAS[require('./sprites.js').etapaDe(pr.nivel)]; return t(idioma, et.es, et.en).toUpperCase(); })() : null,
        frase: res.frase || '…',
        fuera: fuera ? t(idioma, `${x.emoji} De «${x.es}». Vuelve en ${tiempo(new Date(m.exp.hasta).getTime() - ahora, idioma)}.`, `${x.emoji} On “${x.en}”. Back in ${tiempo(new Date(m.exp.hasta).getTime() - ahora, idioma)}.`) : null,
        etiquetas: {
            hambre: t(idioma, '🍖 Barriga', '🍖 Tummy'), alegria: t(idioma, '💖 Alegría', '💖 Joy'), energia: t(idioma, '⚡ Energía', '⚡ Energy'),
            nivel: pr.max ? t(idioma, `Afinidad · nivel ${pr.nivel} (máximo)`, `Affinity · level ${pr.nivel} (max)`) : t(idioma, `Afinidad · nivel ${pr.nivel} (${pr.actual}/${pr.total})`, `Affinity · level ${pr.nivel} (${pr.actual}/${pr.total})`),
        },
        pie: t(idioma, `De ${duenoNombre}${equipado ? ' · equipado' : ''} · ${(m.cuidados || 0)} cuidados`, `${duenoNombre}’s${equipado ? ' · equipped' : ''} · ${(m.cuidados || 0)} cares`),
    };
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
            h === 'enfermo' ? t(idioma, '🤒 **Está malito** porque lleva mucho sin que lo cuiden. Dale de comer y mímalo: se cura enseguida.', '🤒 **It’s feeling sick** after a long time without care. Feed it and cuddle it: it’ll be fine in no time.') : '',
            (() => { const pe = P.PERSONALIDADES[P.persDe(m)]; return `${pe.emoji} **${t(idioma, pe.es, pe.en)}** · ${t(idioma, pe.desc.es, pe.desc.en)}`; })(),
            (() => {
                const g = P.gustosDe(m); const sabe = m.gustos || {};
                const fav = sabe.favorita ? `${P.COMIDAS[g.favorita].emoji} ${t(idioma, P.COMIDAS[g.favorita].es, P.COMIDAS[g.favorita].en)}` : '❔';
                const odi = sabe.odiada ? `${P.COMIDAS[g.odiada].emoji} ${t(idioma, P.COMIDAS[g.odiada].es, P.COMIDAS[g.odiada].en)}` : '❔';
                return t(idioma, `🍽️ Le encanta: ${fav} · No le gusta: ${odi}${sabe.favorita && sabe.odiada ? '' : ' *(pruébalo en «Más cosas que hacer»)*'}`, `🍽️ Loves: ${fav} · Dislikes: ${odi}${sabe.favorita && sabe.odiada ? '' : ' *(try it in “More things to do”)*'}`);
            })(),
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
    // 1.31.0: misiones, racha, expediciones, recuerdos y poder van dibujados en la franja de abajo de la
    // tarjeta; si la imagen sale, esos campos de texto sobran (y «Sabe hacer» ya está en botones y menús).
    datos.extra = {
        misiones: P.misionesDelDia(dia).map((mid) => ({ emoji: P.MISIONES[mid].emoji, n: P.MISIONES[mid].n, prog: (mis.prog || {})[mid] || 0, hecha: (mis.hechas || []).includes(mid) })),
        racha, exp: { n: col.expHoy?.dia === dia ? col.expHoy.n : 0, max: P.EXPEDICIONES_DIA }, recuerdos: recs, recTotal: P.RECUERDOS.length,
        poder: { emoji: poder.emoji, listo: !faltaP },
    };
    const img = await require('./compisArte.js').tarjeta(datos, res.efecto).catch((err) => { console.error('Tarjeta compi:', err.message); return null; });
    if (img) {
        emb.setImage(`attachment://${img.nombre}`).setFooter(faltaP ? { text: t(idioma, `${poder.emoji} Poder listo en ${tiempo(faltaP * 60000, idioma)}`, `${poder.emoji} Power ready in ${tiempo(faltaP * 60000, idioma)}`) } : null)
            .setFields(emb.data.fields.filter((f) => f.name.startsWith('💎')));
    }
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
            .addOptions(Object.entries(P.EXPEDICIONES).filter(([, ex]) => !ex.grupo).map(([id, ex]) => ({
                value: id, emoji: ex.emoji, label: `${t(idioma, ex.es, ex.en)} · ${ex.horas} h`.slice(0, 100),
                description: t(idioma, `Gasta ⚡${ex.energia} · trae 🪙 ${ex.oro[0]}-${ex.oro[1]}+ y quizá un recuerdo`, `Uses ⚡${ex.energia} · brings 🪙 ${ex.oro[0]}-${ex.oro[1]}+ and maybe a souvenir`).slice(0, 100),
            })))));
    }
    const extras = P.interaccionesDe(m);
    if (!fuera) {
        // 1.32.0: también comidas (para descubrir su favorita) y minijuegos.
        const g = P.gustosDe(m); const sabe = m.gustos || {};
        const ops = [
            { value: 'guarderia', emoji: '🥚', label: t(idioma, 'Guardería: tener un huevo', 'Nursery: have an egg'), description: t(idioma, `Dos compañeros de nivel ${P.CRIA.nivel}+ tienen un huevo`, `Two level ${P.CRIA.nivel}+ companions have an egg`) },
            ...Object.entries(P.MINIJUEGOS).map(([id, j]) => ({ value: `mj:${id}`, emoji: j.emoji, label: t(idioma, `Minijuego: ${j.es}`, `Minigame: ${j.en}`).slice(0, 100), description: t(idioma, `${j.desc.es} · ⚡${j.energia}`, `${j.desc.en} · ⚡${j.energia}`).slice(0, 100) })),
            ...Object.entries(P.COMIDAS).map(([id, cm]) => ({ value: `comida:${id}`, emoji: cm.emoji, label: t(idioma, `Darle ${cm.art}`, `Give it ${cm.en.toLowerCase()}`),
                description: (sabe.favorita && g.favorita === id ? t(idioma, '💖 ¡Su favorita!', '💖 Its favourite!') : sabe.odiada && g.odiada === id ? t(idioma, '🙅 No le gusta', '🙅 It dislikes it') : t(idioma, '¿Le gustará?', 'Will it like it?')) })),
            ...extras.map((id) => {
                const x = P.INTERACCIONES[id]; const f = P.falta(m, id, ahora);
                return { value: id, emoji: x.emoji, label: t(idioma, x.es, x.en).slice(0, 100),
                    description: (f ? t(idioma, `⏳ Podrás en ${tiempo(f * 60000, idioma)}`, `⏳ Available in ${tiempo(f * 60000, idioma)}`) : t(idioma, `Listo · +${x.afinidad} de afinidad${x.oro ? ' · trae oro' : ''}`, `Ready · +${x.afinidad} affinity${x.oro ? ' · brings gold' : ''}`)).slice(0, 100) };
            }),
        ].slice(0, 25);
        filas.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`cmp_int:${ownerId}:${m.id}`)
            .setPlaceholder(t(idioma, '🎀 Más cosas que hacer: comidas, minijuegos…', '🎀 More things to do: food, minigames…'))
            .addOptions(ops)));
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
        new ButtonBuilder().setCustomId(cid('armario')).setEmoji('🎀').setLabel(t(idioma, 'Armario', 'Wardrobe')).setStyle(ButtonStyle.Secondary),
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
    else if (partes[0] === 'cmp_int') {
        owner = partes[1]; comp = partes.slice(2).join(':');
        const v = interaction.values[0];
        que = v === 'guarderia' ? 'guarderia' : v.startsWith('comida:') ? v : v.startsWith('mj:') ? `jugar_mj:${v.slice(3)}` : `int:${v}`;
    }
    else if (partes[0] === 'cmp_mj') { owner = partes[1]; que = 'mj_elegir'; }
    else if (partes[0] === 'cmp_arm') { owner = partes[1]; comp = partes.slice(3).join(':'); que = 'armario_elegir'; }
    else if (partes[0] === 'cmp_apodo') { owner = partes[1]; comp = partes.slice(2).join(':'); que = 'apodo_guardar'; }
    else return false;
    if (interaction.user.id !== owner) {
        await interaction.reply({ content: t(idioma, '🐾 Este compañero no es tuyo. Mira el tuyo con `/compi`.', '🐾 This companion isn’t yours. See yours with `/companion`.'), flags: 64 });
        return true;
    }
    if (que.startsWith('jugar_mj:')) { await empezarMinijuego(interaction, owner, comp, que.slice(9), idioma); return true; }
    if (que === 'mj_elegir') { await terminarMinijuego(interaction, partes[2], Number(partes[3]), idioma, cfg); return true; }
    if (que === 'armario') {
        const col = await ColeccionMascotas.findOne({ guildId: interaction.guildId, userId: owner }).lean();
        const m = elegir(col, comp);
        if (!m) { await interaction.reply({ content: textoFallo('sin', idioma), flags: 64 }); return true; }
        await interaction.reply(await armario(interaction, col, m, owner, interaction.message?.id, idioma));
        return true;
    }
    if (que === 'guarderia') { await interaction.reply({ ...(await require('./guarderia.js').vista(interaction.guildId, owner, idioma)), flags: 64 }); return true; }
    if (que === 'armario_elegir') { await elegirArmario(interaction, owner, partes[2], comp, interaction.values[0], idioma, cfg); return true; }
    if (que === 'cartas') {
        const col = await ColeccionMascotas.findOne({ guildId: interaction.guildId, userId: owner }).lean();
        const m = elegir(col, comp);
        if (!m) { await interaction.reply({ content: textoFallo('sin', idioma), flags: 64 }); return true; }
        await interaction.reply(selectorCartas(col, m, owner, interaction.message?.id, idioma));
        return true;
    }
    if (partes[0] === 'cmp_crt') {
        // Se usa la carta, se pone al día la tarjeta pública de /compi y aquí se ve qué ha pasado.
        await interaction.deferUpdate();
        const nombre = interaction.user.displayName || interaction.user.username;
        const res = await accion(interaction.guildId, owner, comp, que, { idioma, dueno: nombre, bromas: !!cfg?.bromas?.activo });
        const msgId = partes[2];
        let editado = false;
        if (!res.fallo && msgId && msgId !== '0') {
            const original = await interaction.channel?.messages.fetch(msgId).catch(() => null);
            if (original) editado = !!(await original.edit(await vista({ ownerId: owner, duenoNombre: nombre, idioma, res, cfg })).catch(() => null));
        }
        const col = await ColeccionMascotas.findOne({ guildId: interaction.guildId, userId: owner }).lean();
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
        await require('./cofres.js').equipar(interaction.guildId, owner, comp);
        res = await accion(interaction.guildId, owner, comp, 'ver', { idioma, dueno: interaction.user.displayName || interaction.user.username, bromas: !!cfg?.bromas?.activo });
        if (!res.fallo) res.mensajes.unshift(t(idioma, `✅ Ahora te acompaña ${K.def(comp).emoji} **${corto(res.m, idioma)}**: sus ventajas ya cuentan.`, `✅ ${K.def(comp).emoji} **${corto(res.m, idioma)}** is now with you: its perks are active.`));
    } else if (que === 'apodo_guardar') {
        const apodo = String(interaction.fields.getTextInputValue('apodo') || '').replace(/[\n\r@#<>`*_~|]/g, '').trim().slice(0, 24);
        await ColeccionMascotas.updateOne({ guildId: interaction.guildId, userId: owner }, apodo ? { $set: { 'mascotas.$[m].apodo': apodo } } : { $unset: { 'mascotas.$[m].apodo': 1 } }, { arrayFilters: [{ 'm.id': comp }] });
        res = await accion(interaction.guildId, owner, comp, 'ver', { idioma, dueno: interaction.user.displayName || interaction.user.username, bromas: !!cfg?.bromas?.activo });
        if (!res.fallo) res.mensajes.unshift(apodo ? t(idioma, `✏️ Ahora se llama **${apodo}**.`, `✏️ It’s now called **${apodo}**.`) : t(idioma, '✏️ Apodo quitado.', '✏️ Nickname removed.'));
    } else {
        res = await accion(interaction.guildId, owner, comp, que, { idioma, dueno: interaction.user.displayName || interaction.user.username, bromas: !!cfg?.bromas?.activo });
    }
    if (res.fallo === 'sin') { await interaction.followUp({ content: textoFallo('sin', idioma), flags: 64 }); return true; }
    await interaction.editReply(await vista({ ownerId: owner, duenoNombre: interaction.user.displayName || interaction.user.username, idioma, res, cfg }));
    return true;
}

// ---------------------------------------------------------------------------
// 1.32.0: minijuegos. La respuesta buena se queda aquí (en memoria, 3 min); el botón solo dice qué eliges.
// ---------------------------------------------------------------------------
const partidasMj = new Map();
async function empezarMinijuego(interaction, owner, comp, juego, idioma) {
    const col = await ColeccionMascotas.findOne({ guildId: interaction.guildId, userId: owner }).lean();
    const m = elegir(col, comp);
    if (!m) return interaction.reply({ content: textoFallo('sin', idioma), flags: 64 });
    const j = P.MINIJUEGOS[juego];
    if (!j) return interaction.reply({ content: textoFallo('accion', idioma), flags: 64 });
    if (P.expedicionActiva(m)) return interaction.reply({ content: textoFallo('fuera', idioma), flags: 64 });
    if (P.estado(m).energia < j.energia) return interaction.reply({ content: textoFallo('energia', idioma), flags: 64 });
    await interaction.deferReply({ flags: 64 });
    const pa = P.prepararMinijuego(juego);
    const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    for (const [k, v] of partidasMj) if (v.hasta < Date.now()) partidasMj.delete(k);
    partidasMj.set(token, { ...pa, owner, comp: m.id, guildId: interaction.guildId, msgId: interaction.message?.id || null, hasta: Date.now() + 3 * 60000 });
    const d = { id: m.id, nivel: P.nivel(m.afinidad || 0), variante: m.variante, acc: m.acc };
    const A = require('./compisArte.js');
    const img = juego === 'vasos' ? await A.gifVasos(d, pa).catch(() => null) : A.inicioPelota(d);
    const nombre = juego === 'vasos' ? 'vasos.gif' : 'pelota.png';
    const etiquetas = juego === 'vasos' ? ['1', '2', '3'] : [t(idioma, 'Izquierda', 'Left'), t(idioma, 'Arriba', 'Up'), t(idioma, 'Derecha', 'Right')];
    const emojis = juego === 'vasos' ? ['🥤', '🥤', '🥤'] : ['⬅️', '⬆️', '➡️'];
    const e = new EmbedBuilder().setColor('#ec4899').setTitle(`${j.emoji} ${t(idioma, j.es, j.en)}`)
        .setDescription(juego === 'vasos' ? t(idioma, '👀 Mira bien dónde esconde la golosina y sigue el vaso… ¿Dónde está?', '👀 Watch where it hides the treat and follow the cup… Where is it?') : t(idioma, '🎾 ¿Hacia dónde lanzas la pelota? Si saltáis al mismo lado, ¡la atrapa!', '🎾 Where do you throw the ball? If you both go the same way, it catches it!'));
    if (img) e.setImage(`attachment://${nombre}`);
    const fila = new ActionRowBuilder().addComponents(etiquetas.map((l, i) => new ButtonBuilder().setCustomId(`cmp_mj:${owner}:${token}:${i}`).setLabel(l).setEmoji(emojis[i]).setStyle(ButtonStyle.Primary)));
    return interaction.editReply({ embeds: [e], files: img ? [new AttachmentBuilder(img, { name: nombre })] : [], components: [fila] });
}
async function terminarMinijuego(interaction, token, eleccion, idioma, cfg) {
    const pa = partidasMj.get(token);
    if (!pa || pa.hasta < Date.now()) { partidasMj.delete(token); return interaction.update({ content: t(idioma, '⌛ Esta partida ha caducado. Empieza otra desde /compi.', '⌛ This game expired. Start another one from /companion.'), embeds: [], components: [], attachments: [] }); }
    partidasMj.delete(token);
    await interaction.deferUpdate();
    const nombre = interaction.member?.displayName || interaction.user.username;
    const res = await accion(pa.guildId, pa.owner, pa.comp, `mj:${pa.id}:${eleccion}:${pa.correcta}`, { idioma, dueno: nombre, bromas: !!cfg?.bromas?.activo });
    if (res.fallo) return interaction.editReply({ content: `⚠️ ${textoFallo(res.fallo, idioma)}`, embeds: [], components: [], attachments: [] });
    const d = { id: res.m.id, nivel: P.nivel(res.m.afinidad || 0), variante: res.m.variante, acc: res.m.acc };
    const A = require('./compisArte.js');
    const img = pa.id === 'vasos' ? A.resultadoVasos(d, eleccion, pa.correcta) : await A.gifPelota(d, eleccion, pa.correcta).catch(() => null);
    const archivo = pa.id === 'vasos' ? 'resultado.png' : 'pelota.gif';
    const e = new EmbedBuilder().setColor(eleccion === pa.correcta ? '#22c55e' : '#f97316').setTitle(eleccion === pa.correcta ? t(idioma, '🎉 ¡Acertaste!', '🎉 You got it!') : t(idioma, '😅 ¡Uy, por poco!', '😅 Oops, so close!'))
        .setDescription((res.mensajes || []).join('\n') || '—');
    if (img) e.setImage(`attachment://${archivo}`);
    const otra = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`cmp_int:${pa.owner}:${pa.comp}`).setPlaceholder(t(idioma, '🎮 Otra partida…', '🎮 Play again…'))
        .addOptions(Object.entries(P.MINIJUEGOS).map(([id, j]) => ({ value: `mj:${id}`, emoji: j.emoji, label: t(idioma, j.es, j.en) }))));
    await interaction.editReply({ content: '', embeds: [e], files: img ? [new AttachmentBuilder(img, { name: archivo })] : [], attachments: [], components: [otra] });
    // Pone al día la tarjeta pública de /compi (si se empezó desde ahí).
    if (pa.msgId) {
        const original = await interaction.channel?.messages.fetch(pa.msgId).catch(() => null);
        if (original && !original.flags?.has?.(64)) await original.edit(await vista({ ownerId: pa.owner, duenoNombre: nombre, idioma, res: { ...res, efecto: null, mensajes: [] }, cfg })).catch(() => {});
    }
    return null;
}

// ---------------------------------------------------------------------------
// 1.32.0: armario (accesorios que se ven en el dibujo) y apodo
// ---------------------------------------------------------------------------
async function armario(interaction, col, m, owner, msgId, idioma) {
    const SPR = require('./sprites.js');
    const tengo = new Set(col.armario || []);
    const saldo = (await require('./economia.js').en(interaction.guildId).obtenerUsuario(owner)).balance;
    const ev = require('./eventos.js').eventoActivo();
    // Los de evento: solo si es su evento (o si ya lo tienes).
    const visibles = Object.entries(SPR.ACCESORIOS).filter(([id, a]) => !a.evento || tengo.has(id) || ev?.id === a.evento)
        .sort(([ia, a], [ib, b]) => (!!b.evento && !tengo.has(ib)) - (!!a.evento && !tengo.has(ia)));
    const ops = [
        ...(m.acc ? [{ value: '-', emoji: '✖️', label: t(idioma, 'Quitarle el accesorio', 'Remove the accessory') }] : []),
        ...visibles.map(([id, a]) => ({ value: id, emoji: a.emoji, default: m.acc === id,
            label: `${t(idioma, a.es, a.en)}${m.acc === id ? t(idioma, ' (puesto)', ' (wearing)') : ''}`.slice(0, 100),
            description: (tengo.has(id) ? t(idioma, '✅ Tuyo · ponérselo', '✅ Yours · put it on') : `${a.evento ? t(idioma, `${ev.emoji} Solo durante ${ev.es} · `, `${ev.emoji} ${ev.en} only · `) : ''}${t(idioma, `🪙 ${fmt(a.precio, idioma)} · comprar y ponérselo`, `🪙 ${fmt(a.precio, idioma)} · buy and put it on`)}`).slice(0, 100) })),
    ].slice(0, 25);
    const e = new EmbedBuilder().setColor('#ec4899').setTitle(t(idioma, `🎀 Armario de ${corto(m, idioma)}`, `🎀 ${corto(m, idioma)}’s wardrobe`))
        .setDescription(t(idioma, `Los accesorios se ven en su dibujo (y en los combates). Lo que compras es tuyo para **todos** tus compañeros. Tienes 🪙 ${fmt(saldo, idioma)}.${P.persDe(m) === 'presumido' ? '\n💅 Es presumido: con un accesorio puesto gana un 25 % más de afinidad.' : ''}`, `Accessories show on its drawing (and in battles). What you buy is yours for **all** your companions. You have 🪙 ${fmt(saldo, idioma)}.${P.persDe(m) === 'presumido' ? '\n💅 It’s vain: wearing an accessory gives 25% more affinity.' : ''}`));
    return { embeds: [e], flags: 64, components: [
        new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`cmp_arm:${owner}:${msgId || '0'}:${m.id}`).setPlaceholder(t(idioma, '🎀 Elige un accesorio…', '🎀 Pick an accessory…')).addOptions(ops)),
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`cmp:apodo:${owner}:${m.id}`).setEmoji('✏️').setLabel(t(idioma, 'Ponerle apodo', 'Nickname')).setStyle(ButtonStyle.Secondary)),
    ] };
}
async function elegirArmario(interaction, owner, msgId, comp, valor, idioma, cfg) {
    const SPR = require('./sprites.js');
    await interaction.deferUpdate();
    const guildId = interaction.guildId;
    const acc = valor === '-' ? '' : valor;
    let aviso = '';
    if (acc) {
        const a = SPR.ACCESORIOS[acc];
        if (!a) return null;
        const col = await ColeccionMascotas.findOne({ guildId, userId: owner }).select('armario').lean();
        const ev = require('./eventos.js').eventoActivo();
        if (a.evento && ev?.id !== a.evento && !(col?.armario || []).includes(acc)) return interaction.followUp({ content: t(idioma, '⌛ Ese accesorio era de un evento que ya ha acabado.', '⌛ That accessory belonged to an event that has ended.'), flags: 64 });
        if (!(col?.armario || []).includes(acc)) {
            // Se compra: primero el oro; si no se puede guardar, se devuelve.
            const eco = require('./economia.js').en(guildId);
            const saldo = await eco.cobrar(owner, a.precio);
            if (saldo === null) return interaction.followUp({ content: t(idioma, `❌ No tienes 🪙 ${fmt(a.precio, idioma)} para ${a.es.toLowerCase()}.`, `❌ You don’t have 🪙 ${fmt(a.precio, idioma)} for the ${a.en.toLowerCase()}.`), flags: 64 });
            const r = await ColeccionMascotas.updateOne({ guildId, userId: owner, armario: { $ne: acc } }, { $addToSet: { armario: acc } });
            if (!r.modifiedCount) await eco.darOro(owner, a.precio);
            else aviso = t(idioma, `🛍️ Comprado: ${a.emoji} **${a.es}** por 🪙 ${fmt(a.precio, idioma)}.`, `🛍️ Bought: ${a.emoji} **${a.en}** for 🪙 ${fmt(a.precio, idioma)}.`);
        }
    }
    const nombre = interaction.member?.displayName || interaction.user.username;
    const res = await accion(guildId, owner, comp, `acc:${acc}`, { idioma, dueno: nombre, bromas: !!cfg?.bromas?.activo });
    if (res.fallo) return interaction.followUp({ content: `⚠️ ${textoFallo(res.fallo, idioma)}`, flags: 64 });
    if (aviso) res.mensajes.unshift(aviso);
    let editado = false;
    if (msgId && msgId !== '0') {
        const original = await interaction.channel?.messages.fetch(msgId).catch(() => null);
        if (original) editado = !!(await original.edit(await vista({ ownerId: owner, duenoNombre: nombre, idioma, res, cfg })).catch(() => null));
    }
    const col = await ColeccionMascotas.findOne({ guildId, userId: owner }).lean();
    const nuevo = await armario(interaction, col, elegir(col, comp) || res.m, owner, msgId, idioma);
    nuevo.embeds[0].setDescription(`${(res.mensajes || []).join('\n')}${editado ? '' : t(idioma, '\n*(Mira cómo le queda con /compi)*', '\n*(See how it looks with /companion)*')}\n\n${nuevo.embeds[0].data.description}`.slice(0, 4000));
    return interaction.editReply({ embeds: nuevo.embeds, components: nuevo.components });
}

// Para el panel: cómo van los compañeros de la gente del servidor.
async function resumenServidor(client, guildId) {
    const guild = client.guilds.cache.get(guildId);
    const ids = guild ? [...guild.members.cache.keys()] : [];
    const cols = ids.length ? await ColeccionMascotas.find({ guildId, userId: { $in: ids }, 'mascotas.0': { $exists: true } }).select('userId mascotas equipada racha').lean() : [];
    const top = cols.map((c) => {
        const eq = elegir(c, c.equipada);
        return { id: c.userId, nombre: guild.members.cache.get(c.userId)?.displayName || c.userId, avatar: guild.members.cache.get(c.userId)?.user.displayAvatarURL({ size: 64 }) || null, companero: eq?.id, apodo: eq?.apodo || null, nivel: P.nivel(eq?.afinidad || 0), racha: c.racha || 0, total: c.mascotas.length };
    }).sort((a, b) => b.nivel - a.nivel || b.total - a.total).slice(0, 10);
    return { personas: cols.length, top };
}

module.exports = { cargarPersonalizados, idServidor, accion, vista, manejar, resumenServidor, textoFallo };

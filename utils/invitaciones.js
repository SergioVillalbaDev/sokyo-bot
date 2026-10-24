// ============================================================================
// invitaciones — Crecimiento: quién invita a quién, con recompensas.
//
// Discord no dice con qué invitación entra alguien: el bot guarda los usos de cada
// invitación del servidor y, cuando entra un miembro, mira cuál ha subido. Para
// que no se pueda hacer trampa:
//  - Una invitación cuenta cuando el invitado sigue dentro pasadas X horas
//    (`horasConfirmacion`); si se va antes, no cuenta.
//  - Las cuentas de Discord más nuevas que `diasCuentaMin` días no cuentan nunca.
//  - Cada persona cuenta una sola vez por servidor, aunque salga y vuelva.
// Al confirmarse, quien invitó recibe oro, XP y los roles por número de
// invitaciones que estén configurados.
// ============================================================================
const { PermissionsBitField } = require('discord.js');
const Invitacion = require('../models/Invitacion.js');
const { getConfigCached } = require('./config.js');
const { t } = require('./i18n.js');

const HORA = 3600 * 1000;
const DIA = 24 * HORA;
const ESTADOS = ['valida', 'pendiente', 'salio', 'falsa'];

// Usos de cada invitación por servidor: guildId -> Map(código -> datos).
const cache = new Map();
// Usos de la URL personalizada (vanity) por servidor.
const usosVanity = new Map();
// Entradas en cola por servidor: se atienden de una en una para no confundir
// dos entradas simultáneas con invitaciones distintas.
const colas = new Map();

function enCola(guildId, fn) {
    const anterior = colas.get(guildId) || Promise.resolve();
    const actual = anterior.then(fn, fn);
    colas.set(guildId, actual.catch(() => {}));
    return actual;
}

const puedeVerInvitaciones = (guild) => !!guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageGuild);

const datosInvitacion = (inv) => ({
    usos: inv.uses || 0,
    maxUsos: inv.maxUses || 0,
    invitadorId: inv.inviterId || (inv.inviter && inv.inviter.id) || null,
    invitadorTag: (inv.inviter && inv.inviter.username) || '',
    borrado: 0,
});

// Lee (o vuelve a leer) las invitaciones de un servidor. Devuelve false si el bot
// no tiene permiso para verlas ("Gestionar servidor").
async function cargarInvitaciones(guild) {
    if (!guild || !puedeVerInvitaciones(guild)) { if (guild) cache.delete(guild.id); return false; }
    const lista = await guild.invites.fetch({ cache: false }).catch(() => null);
    if (!lista) return false;
    cache.set(guild.id, new Map(lista.map((inv) => [inv.code, datosInvitacion(inv)])));
    if (guild.vanityURLCode) {
        const v = await guild.fetchVanityData().catch(() => null);
        if (v) usosVanity.set(guild.id, v.uses || 0);
    }
    return true;
}

// Al arrancar: carga las invitaciones de los servidores con el sistema activo.
async function cargarTodas(client) {
    for (const guild of client.guilds.cache.values()) {
        const cfg = await getConfigCached(guild.id).catch(() => null);
        if (cfg?.crecimiento?.invitaciones?.activo) await cargarInvitaciones(guild).catch(() => {});
    }
}

// Eventos inviteCreate / inviteDelete: mantienen la caché al día. Las borradas se
// guardan un rato: una invitación de un solo uso desaparece justo cuando alguien
// entra con ella, y hay que poder atribuírsela.
function alCrearInvitacion(invite) {
    const mapa = invite.guild && cache.get(invite.guild.id);
    if (mapa) mapa.set(invite.code, datosInvitacion(invite));
}
function alBorrarInvitacion(invite) {
    const mapa = invite.guild && cache.get(invite.guild.id);
    const d = mapa && mapa.get(invite.code);
    if (d && !d.borrado) d.borrado = Date.now();
}

// ¿Con qué invitación ha entrado? Compara los usos actuales con los guardados.
// Devuelve { fuente, codigo, invitadorId, invitadorTag }.
async function detectarOrigen(member, client) {
    const guild = member.guild;
    const desconocida = { fuente: 'desconocida', codigo: null, invitadorId: null, invitadorTag: '' };
    const previas = cache.get(guild.id);
    if (!previas) { await cargarInvitaciones(guild); return desconocida; }
    const actuales = await guild.invites.fetch({ cache: false }).catch(() => null);
    if (!actuales) return desconocida;

    let usada = null;
    for (const inv of actuales.values()) {
        const antes = previas.get(inv.code);
        if ((inv.uses || 0) > (antes ? antes.usos : 0)) { usada = { codigo: inv.code, ...datosInvitacion(inv) }; break; }
    }
    if (!usada) {
        // Invitación con tope de usos que Discord ha borrado al gastarse.
        for (const [codigo, d] of previas) {
            if (!actuales.has(codigo) && d.maxUsos && d.usos + 1 >= d.maxUsos) { usada = { codigo, ...d }; break; }
        }
    }

    // Caché nueva. Los códigos que han subido y no son el elegido conservan sus
    // usos anteriores: los reclamará la siguiente entrada de la cola.
    const nueva = new Map();
    for (const inv of actuales.values()) {
        const antes = previas.get(inv.code);
        const d = datosInvitacion(inv);
        if (usada && inv.code === usada.codigo) nueva.set(inv.code, { ...d, usos: (antes ? antes.usos : 0) + 1 });
        else if (antes && d.usos > antes.usos) nueva.set(inv.code, { ...d, usos: antes.usos });
        else nueva.set(inv.code, d);
    }
    for (const [codigo, d] of previas) {
        if (actuales.has(codigo) || (usada && codigo === usada.codigo)) continue;
        const borrado = d.borrado || Date.now();
        if (Date.now() - borrado < 5 * 60 * 1000) nueva.set(codigo, { ...d, borrado });
    }
    cache.set(guild.id, nueva);

    if (usada) {
        // Invitaciones creadas por el propio bot: la de la página pública.
        if (usada.invitadorId === client.user.id) return { fuente: 'web', codigo: usada.codigo, invitadorId: null, invitadorTag: '' };
        return { fuente: 'invitacion', codigo: usada.codigo, invitadorId: usada.invitadorId, invitadorTag: usada.invitadorTag };
    }

    if (guild.vanityURLCode) {
        const v = await guild.fetchVanityData().catch(() => null);
        const antes = usosVanity.get(guild.id);
        if (v) usosVanity.set(guild.id, v.uses || 0);
        if (v && antes !== undefined && (v.uses || 0) > antes) return { ...desconocida, fuente: 'vanity', codigo: guild.vanityURLCode };
    }
    return desconocida;
}

// Cuenta las invitaciones de alguien por estado.
async function estadisticasDe(guildId, userId) {
    const filas = await Invitacion.aggregate([
        { $match: { guildId, invitadorId: userId } },
        { $group: { _id: '$estado', n: { $sum: 1 } } },
    ]);
    const r = { valida: 0, pendiente: 0, salio: 0, falsa: 0 };
    for (const f of filas) if (ESTADOS.includes(f._id)) r[f._id] = f.n;
    return r;
}

// Invitaciones que siguen en el servidor (confirmadas o a la espera). Con `desde`
// y `hasta`, solo las de gente que entró en ese intervalo (sorteos).
async function contarActivas(guildId, userId, { desde = null, hasta = null } = {}) {
    const filtro = { guildId, invitadorId: userId, estado: { $in: ['valida', 'pendiente'] }, seFue: null };
    if (desde || hasta) {
        filtro.fechaEntrada = {};
        if (desde) filtro.fechaEntrada.$gte = new Date(desde);
        if (hasta) filtro.fechaEntrada.$lte = new Date(hasta);
    }
    return Invitacion.countDocuments(filtro);
}

// Lo mismo para muchas personas a la vez (sorteos): Map(userId -> nº).
async function contarActivasDe(guildId, userIds, { desde = null, hasta = null } = {}) {
    const match = { guildId, invitadorId: { $in: userIds }, estado: { $in: ['valida', 'pendiente'] }, seFue: null };
    if (desde || hasta) {
        match.fechaEntrada = {};
        if (desde) match.fechaEntrada.$gte = new Date(desde);
        if (hasta) match.fechaEntrada.$lte = new Date(hasta);
    }
    const filas = userIds.length ? await Invitacion.aggregate([{ $match: match }, { $group: { _id: '$invitadorId', n: { $sum: 1 } } }]) : [];
    return new Map(filas.map((f) => [f._id, f.n]));
}

// Ranking de quien más invita (por invitaciones confirmadas).
async function ranking(guildId, limite = 10) {
    const filas = await Invitacion.aggregate([
        { $match: { guildId, invitadorId: { $ne: null } } },
        { $sort: { fechaEntrada: 1 } },
        { $group: {
            _id: '$invitadorId',
            tag: { $last: '$invitadorTag' },
            validas: { $sum: { $cond: [{ $eq: ['$estado', 'valida'] }, 1, 0] } },
            pendientes: { $sum: { $cond: [{ $eq: ['$estado', 'pendiente'] }, 1, 0] } },
            salidas: { $sum: { $cond: [{ $eq: ['$estado', 'salio'] }, 1, 0] } },
            falsas: { $sum: { $cond: [{ $eq: ['$estado', 'falsa'] }, 1, 0] } },
        } },
        { $sort: { validas: -1, pendientes: -1, _id: 1 } },
        { $limit: limite },
    ]);
    return filas.map((f) => ({ userId: f._id, tag: f.tag || '', validas: f.validas, pendientes: f.pendientes, salidas: f.salidas, falsas: f.falsas }));
}

// Puesto de alguien en el ranking (1 = el que más invita). null si no ha invitado.
async function puestoDe(guildId, userId) {
    const propias = await Invitacion.countDocuments({ guildId, invitadorId: userId, estado: 'valida' });
    const total = await Invitacion.countDocuments({ guildId, invitadorId: userId });
    if (!total) return null;
    const porDelante = await Invitacion.aggregate([
        { $match: { guildId, invitadorId: { $ne: null }, estado: 'valida' } },
        { $group: { _id: '$invitadorId', n: { $sum: 1 } } },
        { $match: { n: { $gt: propias } } },
        { $count: 'n' },
    ]);
    return ((porDelante[0] && porDelante[0].n) || 0) + 1;
}

// Resumen para el panel: entradas de los últimos `dias` por estado y por origen.
async function resumen(guildId, dias = 30) {
    const desde = new Date(Date.now() - dias * DIA);
    const [porEstado, porFuente] = await Promise.all([
        Invitacion.aggregate([{ $match: { guildId, fechaEntrada: { $gte: desde } } }, { $group: { _id: '$estado', n: { $sum: 1 } } }]),
        Invitacion.aggregate([{ $match: { guildId, fechaEntrada: { $gte: desde } } }, { $group: { _id: '$fuente', n: { $sum: 1 } } }]),
    ]);
    const estados = { valida: 0, pendiente: 0, salio: 0, falsa: 0 };
    for (const f of porEstado) if (ESTADOS.includes(f._id)) estados[f._id] = f.n;
    const fuentes = { invitacion: 0, web: 0, vanity: 0, desconocida: 0 };
    for (const f of porFuente) if (f._id in fuentes) fuentes[f._id] = f.n;
    return { dias, total: Object.values(estados).reduce((a, b) => a + b, 0), estados, fuentes };
}

const recientes = (guildId, limite = 20) => Invitacion.find({ guildId }).sort({ fechaEntrada: -1 }).limit(limite).lean();

// Siguiente rol por invitaciones que le queda por conseguir (o null).
function siguienteRecompensa(validas, recompensas = []) {
    return [...recompensas]
        .filter((r) => r && r.rolId && r.invitaciones > validas)
        .sort((a, b) => a.invitaciones - b.invitaciones)[0] || null;
}

// Rellena los marcadores de un texto de aviso de invitaciones.
function rellenar(texto, datos) {
    return String(texto || '')
        .replace(/{mention}/g, datos.mention || '')
        .replace(/{user}/g, datos.user || '')
        .replace(/{inviter}/g, datos.inviter || '')
        .replace(/{inviterName}/g, datos.inviterName || '')
        .replace(/{invitesText}/g, datos.invitesText || String(datos.invites ?? 0))
        .replace(/{invites}/g, String(datos.invites ?? 0))
        .replace(/{server}/g, datos.server || '');
}

// Aviso en el canal configurado cuando alguien entra.
async function anunciarEntrada(member, doc, cfg) {
    const conf = cfg.crecimiento.invitaciones;
    const canal = conf.canalAvisosId ? member.guild.channels.cache.get(conf.canalAvisosId) : null;
    if (!canal || !canal.isTextBased() || doc.estado === 'falsa') return;
    let texto;
    if (doc.fuente === 'invitacion' && doc.invitadorId) {
        const r = await estadisticasDe(member.guild.id, doc.invitadorId);
        const n = r.valida + r.pendiente;
        texto = rellenar(conf.mensaje || t(cfg, '📨 {mention} ha entrado gracias a {inviter}, que ya lleva **{invitesText}**.', '📨 {mention} joined thanks to {inviter}, who now has **{invitesText}**.'), {
            mention: `<@${member.id}>`, user: member.user.username,
            inviter: `<@${doc.invitadorId}>`, inviterName: doc.invitadorTag,
            invites: n, invitesText: t(cfg, `${n} ${n === 1 ? 'invitación' : 'invitaciones'}`, `${n} invite${n === 1 ? '' : 's'}`),
            server: member.guild.name,
        });
    } else if (doc.fuente === 'web') {
        texto = t(cfg, `🌐 <@${member.id}> ha entrado desde la página pública del servidor.`, `🌐 <@${member.id}> joined from the server’s public page.`);
    } else if (doc.fuente === 'vanity') {
        texto = t(cfg, `🔗 <@${member.id}> ha entrado con el enlace personalizado del servidor.`, `🔗 <@${member.id}> joined with the server’s custom link.`);
    } else {
        return; // sin saber con qué invitación: no se dice nada
    }
    await canal.send({ content: texto.slice(0, 2000), allowedMentions: { users: [member.id, doc.invitadorId].filter(Boolean) } });
}

// Entrada de un miembro (guildMemberAdd). Devuelve el registro o null.
async function registrarEntrada(member, client, cfg) {
    const conf = cfg && cfg.crecimiento && cfg.crecimiento.invitaciones;
    if (!conf || !conf.activo || member.user.bot) return null;
    return enCola(member.guild.id, async () => {
        const origen = await detectarOrigen(member, client);
        // Nadie se cuenta a sí mismo (p. ej. sale y vuelve con su propia invitación).
        if (origen.invitadorId === member.id) { origen.invitadorId = null; origen.invitadorTag = ''; origen.fuente = 'desconocida'; }

        const guildId = member.guild.id;
        const previa = await Invitacion.findOne({ guildId, invitadoId: member.id });
        if (previa && previa.estado === 'valida') {
            // Ya contó en su día: vuelve, pero no suma otra vez.
            previa.seFue = null;
            await previa.save();
            return previa;
        }

        const ahora = new Date();
        const diasMin = Math.max(0, conf.diasCuentaMin ?? 7);
        const falsa = diasMin > 0 && ahora - member.user.createdAt < diasMin * DIA;
        const horas = Math.max(0, conf.horasConfirmacion ?? 24);
        const doc = await Invitacion.findOneAndUpdate(
            { guildId, invitadoId: member.id },
            { $set: {
                invitadoTag: member.user.username,
                invitadorId: origen.invitadorId,
                invitadorTag: origen.invitadorTag,
                codigo: origen.codigo,
                fuente: origen.fuente,
                estado: falsa ? 'falsa' : 'pendiente',
                fechaEntrada: ahora,
                confirmarEn: falsa ? null : new Date(ahora.getTime() + horas * HORA),
                fechaConfirmada: null,
                seFue: null,
                cuentaCreada: member.user.createdAt,
            } },
            { upsert: true, returnDocument: 'after' },
        );
        await anunciarEntrada(member, doc, cfg).catch((e) => console.error('Aviso de invitación:', e.message));
        if (!falsa && horas === 0) await confirmar(doc, client).catch((e) => console.error('Confirmar invitación:', e.message));
        return doc;
    });
}

// Salida de un miembro (guildMemberRemove): si aún no contaba, ya no contará.
async function registrarSalida(guildId, userId) {
    await Invitacion.updateOne(
        { guildId, invitadoId: userId },
        [{ $set: { seFue: '$$NOW', estado: { $cond: [{ $eq: ['$estado', 'pendiente'] }, 'salio', '$estado'] } } }],
        { updatePipeline: true }, // Mongoose 9 exige permitir el pipeline
    );
}

// Recompensas para quien invita, al confirmarse una invitación.
async function recompensar(guild, invitadorId, cfg) {
    const conf = cfg.crecimiento.invitaciones;
    const oro = Math.max(0, conf.oroPorInvitacion || 0);
    if (oro > 0) await require('./economia.js').darOro(invitadorId, oro).catch((e) => console.error('Oro por invitación:', e.message));

    const miembro = await guild.members.fetch(invitadorId).catch(() => null);
    if (!miembro) return;
    const xp = Math.max(0, conf.xpPorInvitacion || 0);
    if (xp > 0 && cfg.nivelesActivo) {
        await require('./niveles.js').aplicarXp(guild, miembro, xp, cfg, null).catch((e) => console.error('XP por invitación:', e.message));
    }
    const recompensas = (conf.recompensas || []).filter((r) => r && r.rolId);
    if (!recompensas.length) return;
    const validas = await Invitacion.countDocuments({ guildId: guild.id, invitadorId, estado: 'valida' });
    const roles = recompensas
        .filter((r) => r.invitaciones <= validas)
        .map((r) => guild.roles.cache.get(r.rolId))
        .filter((rol) => rol && rol.editable && !miembro.roles.cache.has(rol.id));
    if (roles.length) {
        await miembro.roles.add(roles, t(cfg, `Recompensa por ${validas} invitaciones`, `Reward for ${validas} invites`))
            .catch((e) => console.error('Rol por invitaciones:', e.message));
    }
}

// Confirma una invitación pendiente si el invitado sigue en el servidor.
async function confirmar(doc, client) {
    const guild = client.guilds.cache.get(doc.guildId);
    if (!guild) return false;
    let sigue = true;
    try { await guild.members.fetch(doc.invitadoId); } catch (e) {
        if (e.code !== 10007) {
            // Fallo puntual de Discord: se reintenta en 5 min (sin bloquear al resto).
            await Invitacion.updateOne({ _id: doc._id, estado: 'pendiente' }, { $set: { confirmarEn: new Date(Date.now() + 5 * 60 * 1000) } });
            return false;
        }
        sigue = false;
    }
    if (!sigue) {
        await Invitacion.updateOne({ _id: doc._id, estado: 'pendiente' }, { $set: { estado: 'salio', seFue: doc.seFue || new Date() } });
        return false;
    }
    // Solo una pasada puede confirmarla (y dar las recompensas).
    const r = await Invitacion.updateOne({ _id: doc._id, estado: 'pendiente' }, { $set: { estado: 'valida', fechaConfirmada: new Date() } });
    if (!r.modifiedCount) return false;
    if (doc.invitadorId) {
        const cfg = await getConfigCached(doc.guildId);
        if (cfg?.crecimiento?.invitaciones) await recompensar(guild, doc.invitadorId, cfg);
    }
    return true;
}

// Barrido periódico (programador): confirma las invitaciones que ya han cumplido
// su espera en los servidores con el sistema activo.
async function barrerInvitaciones(client) {
    // Solo los servidores donde está el bot y el sistema está activo: los pausados
    // (se confirmarán al reactivarlo) no ocupan la cola de los demás.
    const ServidorConfig = require('../models/ServidorConfig.js');
    const activos = (await ServidorConfig.find({ 'crecimiento.invitaciones.activo': true }).distinct('guildId'))
        .filter((id) => client.guilds.cache.has(id));
    if (!activos.length) return;
    const vencidas = await Invitacion.find({ estado: 'pendiente', guildId: { $in: activos }, confirmarEn: { $lte: new Date() } })
        .sort({ confirmarEn: 1 }).limit(200);
    for (const doc of vencidas) {
        try { await confirmar(doc, client); } catch (e) { console.error('Barrido de invitaciones:', e.message); }
    }
}

// Embed de /invites y !invites: las invitaciones de alguien, su próxima
// recompensa y el top del servidor.
async function embedInvitaciones(guild, usuario, cfg) {
    const { EmbedBuilder } = require('discord.js');
    const conf = cfg.crecimiento.invitaciones;
    const [r, puesto, top] = await Promise.all([
        estadisticasDe(guild.id, usuario.id),
        puestoDe(guild.id, usuario.id),
        ranking(guild.id, 5),
    ]);
    const embed = new EmbedBuilder()
        .setColor('#9db4fa')
        .setAuthor({ name: t(cfg, `Invitaciones de ${usuario.username}`, `${usuario.username}’s invites`), iconURL: usuario.displayAvatarURL() })
        .addFields(
            { name: t(cfg, '✅ Confirmadas', '✅ Confirmed'), value: `**${r.valida}**`, inline: true },
            { name: t(cfg, '⏳ Pendientes', '⏳ Pending'), value: `**${r.pendiente}**`, inline: true },
            { name: t(cfg, '🚪 Se fueron', '🚪 Left'), value: `**${r.salio}**`, inline: true },
        );
    const lineas = [];
    if (r.falsa) {
        lineas.push(r.falsa === 1
            ? t(cfg, '🚫 1 cuenta demasiado nueva: no cuenta.', '🚫 1 account too new: it doesn’t count.')
            : t(cfg, `🚫 ${r.falsa} cuentas demasiado nuevas: no cuentan.`, `🚫 ${r.falsa} accounts too new: they don’t count.`));
    }
    if (puesto) lineas.push(t(cfg, `🏅 Puesto **#${puesto}** del servidor.`, `🏅 Rank **#${puesto}** in the server.`));
    const siguiente = siguienteRecompensa(r.valida, conf.recompensas);
    if (siguiente) {
        const faltan = siguiente.invitaciones - r.valida;
        lineas.push(t(cfg, `🎁 Te faltan **${faltan}** para <@&${siguiente.rolId}>.`, `🎁 **${faltan}** more to get <@&${siguiente.rolId}>.`));
    }
    const horas = conf.horasConfirmacion ?? 24;
    if (horas > 0) lineas.push(t(cfg, `ℹ️ Una invitación cuenta cuando la persona sigue en el servidor ${horas} h después de entrar.`, `ℹ️ An invite counts once the person is still in the server ${horas} h after joining.`));
    if (lineas.length) embed.setDescription(lineas.join('\n'));
    if (top.length) {
        const medallas = ['🥇', '🥈', '🥉'];
        embed.addFields({
            name: t(cfg, '🏆 Top del servidor', '🏆 Server top'),
            value: top.map((f, i) => `${medallas[i] || `\`${i + 1}.\``} <@${f.userId}> — **${f.validas}**${f.pendientes ? ` (+${f.pendientes} ⏳)` : ''}`).join('\n'),
        });
    }
    return embed;
}

module.exports = {
    embedInvitaciones,
    cargarInvitaciones, cargarTodas, alCrearInvitacion, alBorrarInvitacion, puedeVerInvitaciones,
    detectarOrigen, registrarEntrada, registrarSalida, confirmar, barrerInvitaciones,
    estadisticasDe, contarActivas, contarActivasDe, ranking, puestoDe, resumen, recientes, siguienteRecompensa, rellenar,
};

// Programa de referidos (1.10.0). Cada persona tiene un código (/referidos). Quien
// añade Sokyo a su servidor puede canjearlo (/referidos canjear) en sus primeros días;
// si a los 7 días el bot sigue allí y el servidor tiene gente, quien lo recomendó gana
// 7 días de Premium para el servidor que eligió (o oro, si ese servidor ya paga una
// suscripción o tiene Premium de por vida). Lo comprueba el programador cada hora.
const crypto = require('crypto');
const { PermissionsBitField } = require('discord.js');
const Referido = require('../models/Referido.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { t } = require('./i18n.js');

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I
const DIAS_ESPERA = 7;          // días que tiene que quedarse el bot
const DIAS_CANJE = 14;          // días desde que entra el bot para poder canjear
const MIEMBROS_MIN = 10;        // gente mínima en el servidor nuevo
const DIAS_PARA_CUMPLIR = 30;   // si en 30 días no llega a la gente mínima, se anula
const DIAS_PREMIUM = 7;
const ORO_EN_VEZ = 2000;        // si el servidor elegido ya tiene Premium que no caduca
const MAX_PREMIOS_30D = 10;

const DIA = 24 * 3600 * 1000;
const normalizarCodigo = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

function generarCodigo(bytes = crypto.randomBytes(6)) {
    return [...bytes].map((b) => ALFABETO[b % ALFABETO.length]).join('');
}

// El código de una persona (lo crea la primera vez).
async function miCodigo(userId) {
    const hay = await Referido.findOne({ tipo: 'codigo', referidorId: userId });
    if (hay) return hay;
    for (let i = 0; i < 5; i++) {
        try { return await Referido.create({ tipo: 'codigo', codigo: generarCodigo(), referidorId: userId }); }
        catch (e) { if (e.code !== 11000) throw e; } // código repetido: otro
    }
    throw new Error('No se pudo crear el código');
}

async function fijarDestino(userId, guildId) {
    const doc = await miCodigo(userId);
    doc.destinoGuildId = guildId;
    await doc.save();
    return doc;
}

// Reglas del canje (pura, la prueban los tests). Devuelve el motivo del rechazo o null.
function errorCanje({ codigoDoc, guild, member, yaCanjeado, ahora = Date.now() }) {
    if (!codigoDoc) return 'no_existe';
    if (!member?.permissions?.has(PermissionsBitField.Flags.ManageGuild)) return 'sin_permiso';
    if (codigoDoc.referidorId === member.id || codigoDoc.referidorId === guild.ownerId) return 'propio';
    if (codigoDoc.destinoGuildId && codigoDoc.destinoGuildId === guild.id) return 'mismo_servidor';
    if (yaCanjeado) return 'ya_canjeado';
    const entro = guild.joinedTimestamp || (guild.joinedAt ? guild.joinedAt.getTime() : 0);
    if (!entro || ahora - entro > DIAS_CANJE * DIA) return 'tarde';
    return null;
}

const TEXTOS_ERROR = {
    no_existe: ['Ese código no existe. Revisa que esté bien escrito.', 'That code doesn’t exist. Check it’s typed correctly.'],
    sin_permiso: ['Solo quien puede «Gestionar servidor» puede canjear un código aquí.', 'Only someone with “Manage Server” can redeem a code here.'],
    propio: ['No puedes canjear tu propio código (ni el del dueño del servidor).', 'You can’t redeem your own code (or the server owner’s).'],
    mismo_servidor: ['Ese código ya da sus premios a este mismo servidor.', 'That code already gives its rewards to this same server.'],
    ya_canjeado: ['Este servidor ya canjeó un código.', 'This server has already redeemed a code.'],
    tarde: [`Solo se puede canjear en los ${DIAS_CANJE} primeros días desde que entra el bot.`, `You can only redeem within the first ${DIAS_CANJE} days after the bot joins.`],
};
const textoError = (cfg, clave) => t(cfg, ...(TEXTOS_ERROR[clave] || ['No se pudo canjear.', 'Couldn’t redeem it.']));

async function canjear(guild, member, codigo) {
    const codigoDoc = await Referido.findOne({ tipo: 'codigo', codigo: normalizarCodigo(codigo) }).lean();
    const yaCanjeado = !!(await Referido.exists({ tipo: 'canje', guildId: guild.id }));
    const err = errorCanje({ codigoDoc, guild, member, yaCanjeado });
    if (err) return { error: err };
    try {
        await Referido.create({ tipo: 'canje', codigo: codigoDoc.codigo, referidorId: codigoDoc.referidorId, guildId: guild.id, canjeadoPor: member.id, estado: 'pendiente' });
    } catch (e) {
        if (e.code === 11000) return { error: 'ya_canjeado' };
        throw e;
    }
    return { ok: true, referidorId: codigoDoc.referidorId };
}

// Suma días de Premium a un servidor. No toca suscripciones de Stripe ni Premium de por
// vida (devuelve false: entonces se da oro). Si ya tiene Premium con fecha, la alarga.
async function sumarDiasPremium(guildId, dias) {
    const billing = require('./billing.js');
    const cfg = await ServidorConfig.findOne({ guildId });
    const activo = billing.premiumActivo(cfg);
    if (activo && (cfg.stripeSubscriptionId || !cfg.premiumHasta)) return false;
    const desde = activo && cfg.premiumHasta ? cfg.premiumHasta.getTime() : Date.now();
    await billing.activarPlan(guildId, { plan: activo && cfg.plan !== 'free' ? cfg.plan : 'pro', premiumHasta: new Date(desde + dias * DIA) });
    return true;
}

async function avisar(client, userId, es, en) {
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return;
    const { idiomaMiembro } = require('./preferencias.js');
    const idioma = await idiomaMiembro(userId, {}).catch(() => 'en');
    await user.send(t(idioma, es, en)).catch(() => {});
}

// Programador: resuelve los canjes que ya han esperado sus 7 días.
let ultimaPasada = 0;
async function barrerReferidos(client, { forzar = false } = {}) {
    if (!forzar && Date.now() - ultimaPasada < 55 * 60 * 1000) return;
    ultimaPasada = Date.now();
    const ahora = Date.now();
    const pendientes = await Referido.find({ tipo: 'canje', estado: 'pendiente', fecha: { $lte: new Date(ahora - DIAS_ESPERA * DIA) } }).limit(200);
    for (const c of pendientes) {
        try {
            const anular = (motivo) => Referido.updateOne({ _id: c._id, estado: 'pendiente' }, { $set: { estado: 'anulado', motivo, resueltoEn: new Date() } });
            const guild = client.guilds.cache.get(c.guildId);
            if (!guild) { await anular('El bot ya no está en el servidor'); continue; }
            if ((guild.memberCount || 0) < MIEMBROS_MIN) {
                if (ahora - c.fecha.getTime() > DIAS_PARA_CUMPLIR * DIA) await anular(`No llegó a ${MIEMBROS_MIN} miembros`);
                continue;
            }
            const premiados = await Referido.countDocuments({ tipo: 'canje', referidorId: c.referidorId, estado: 'premiado', resueltoEn: { $gt: new Date(ahora - 30 * DIA) } });
            if (premiados >= MAX_PREMIOS_30D) { await anular('Límite de premios del mes'); continue; }

            // Se reserva antes de premiar: así nunca se premia dos veces.
            const reservado = await Referido.findOneAndUpdate({ _id: c._id, estado: 'pendiente' }, { $set: { estado: 'premiado', resueltoEn: new Date() } });
            if (!reservado) continue;
            const codigo = await Referido.findOne({ tipo: 'codigo', codigo: c.codigo }).lean();
            const destino = codigo?.destinoGuildId && client.guilds.cache.get(codigo.destinoGuildId);
            let premio;
            if (destino && await sumarDiasPremium(destino.id, DIAS_PREMIUM)) {
                premio = `${DIAS_PREMIUM} días Premium en ${destino.name}`;
                await avisar(client, c.referidorId,
                    `🎉 **${guild.name}** sigue con Sokyo gracias a tu recomendación: **${destino.name}** tiene ${DIAS_PREMIUM} días más de Premium.`,
                    `🎉 **${guild.name}** is still using Sokyo thanks to your referral: **${destino.name}** got ${DIAS_PREMIUM} more days of Premium.`);
            } else {
                // 1.30.0: el oro es de cada servidor: se da en el servidor recomendado.
                await require('./economia.js').en(guild.id).darOro(c.referidorId, ORO_EN_VEZ);
                premio = `${ORO_EN_VEZ} oro en ${guild.name}`;
                await avisar(client, c.referidorId,
                    `🎉 **${guild.name}** sigue con Sokyo gracias a tu recomendación: te llevas **${ORO_EN_VEZ} de oro** para usar allí. (Elige con \`/referidos destino\` un servidor tuyo para ganar días de Premium.)`,
                    `🎉 **${guild.name}** is still using Sokyo thanks to your referral: you get **${ORO_EN_VEZ} gold** to spend there. (Pick one of your servers with \`/referrals destination\` to earn Premium days.)`);
            }
            await Referido.updateOne({ _id: c._id }, { $set: { premio } });
        } catch (e) { console.error('Referidos:', e.message); }
    }
}

async function resumen(userId) {
    const codigo = await miCodigo(userId);
    const canjes = await Referido.find({ tipo: 'canje', referidorId: userId }).lean();
    const cuenta = (e) => canjes.filter((c) => c.estado === e).length;
    return { codigo: codigo.codigo, destinoGuildId: codigo.destinoGuildId, pendientes: cuenta('pendiente'), premiados: cuenta('premiado'), anulados: cuenta('anulado') };
}

module.exports = {
    DIAS_ESPERA, DIAS_CANJE, MIEMBROS_MIN, DIAS_PREMIUM, ORO_EN_VEZ, MAX_PREMIOS_30D,
    generarCodigo, normalizarCodigo, miCodigo, fijarDestino, errorCanje, textoError, canjear, sumarDiasPremium, barrerReferidos, resumen,
};

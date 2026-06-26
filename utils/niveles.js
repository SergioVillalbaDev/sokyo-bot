// Sistema de niveles / XP — completo y configurable.
// XP por mensaje y por voz, cooldown, exclusiones (canales/roles), dificultad,
// anuncios (canal/DM/off) con mensaje personalizable y recompensas por nivel
// (acumulativas o sustitutivas).
const { AttachmentBuilder } = require('discord.js');
const ActividadUsuario = require('../models/ActividadUsuario.js');
const TarjetaPersonal = require('../models/TarjetaPersonal.js');
const { generarTarjeta, generarTarjetaAnimada, ESTILOS } = require('./rankCard.js');
const economia = require('./economia.js'); // para el boost de XP comprado en la tienda

// Opciones de tarjeta personalizada del usuario.
// Los COLORES (acento, fondo, secundario/degradado) se aplican siempre.
// La IMAGEN propia solo se aplica en servidores PREMIUM.
async function opcionesTarjeta(userId, cfg) {
    const tp = await TarjetaPersonal.findOne({ userId });
    if (!tp) return {};
    const opc = {
        color: tp.colorAcento || '#5865F2',
        fondoTipo: tp.fondoTipo || 'color',
        fondoColor: tp.fondoColor,
        colorSecundario: tp.colorSecundario,
        preset: tp.preset || null,
    };
    if (tp.fondoTipo === 'imagen') {
        if (cfg?.esPremium) {
            opc.fondoImagen = tp.fondoImagen;
        } else {
            // Sin premium no se usa la imagen: caemos a degradado (o color sólido).
            opc.fondoTipo = tp.colorSecundario ? 'degradado' : 'color';
        }
    }
    return opc;
}

// Núcleo del render: dado un `opc` ya resuelto + si es premium, devuelve
// { buffer, ext } (PNG o GIF) o null. El estilo premium (arte) solo se aplica
// si esPremium; el GIF (estilo animado) cae a PNG si falla.
// `render` = { avatarURL, nombre, nivel, rank, xpActual, xpNecesaria }.
async function construirBuffer(opc, esPremium, render) {
    const estiloId = (esPremium && opc.preset && ESTILOS[opc.preset]) ? opc.preset : null;
    const animado = estiloId ? ESTILOS[estiloId].animado : false;
    let buffer = null;
    let ext = 'png';
    if (animado) {
        buffer = await generarTarjetaAnimada({ ...render, ...opc, estilo: estiloId }).catch(() => null);
        if (buffer) ext = 'gif';
    }
    if (!buffer) buffer = await generarTarjeta({ ...render, ...opc, estilo: estiloId }).catch(() => null);
    return buffer ? { buffer, ext } : null;
}

// Construye el adjunto de la tarjeta (PNG o GIF) ya listo para enviar a Discord.
async function adjuntoTarjeta(userId, cfg, render) {
    const opc = await opcionesTarjeta(userId, cfg);
    const r = await construirBuffer(opc, !!cfg?.esPremium, render);
    return r ? new AttachmentBuilder(r.buffer, { name: `rank.${r.ext}` }) : null;
}

// XP necesaria para pasar del nivel n al n+1, escalada por la dificultad.
const xpDeNivel = (n, dif = 1) => Math.round((5 * n * n + 50 * n + 100) * (dif || 1));

// Dado el XP total, devuelve { nivel, actual (xp dentro del nivel), necesaria }.
function progreso(xpTotal, dif = 1) {
    let nivel = 0;
    let acum = 0;
    while (nivel < 1000) {
        const need = xpDeNivel(nivel, dif);
        if (xpTotal < acum + need) return { nivel, actual: xpTotal - acum, necesaria: need };
        acum += need;
        nivel++;
    }
    return { nivel, actual: 0, necesaria: xpDeNivel(nivel, dif) };
}

const nivelDeXp = (xpTotal, dif = 1) => progreso(xpTotal, dif).nivel;

// XP total acumulada para alcanzar un nivel (para !setnivel).
function xpTotalParaNivel(nivelObjetivo, dif = 1) {
    let total = 0;
    for (let n = 0; n < nivelObjetivo; n++) total += xpDeNivel(n, dif);
    return total;
}

const tieneRolSinXp = (member, cfg) => (cfg.rolesSinXp || []).some((id) => member.roles.cache.has(id));

// Multiplicador de XP del miembro: el MAYOR entre los roles que tenga (1 si ninguno).
function multiplicadorDe(member, cfg) {
    let mult = 1;
    for (const m of cfg.multiplicadoresRol || []) {
        if (m.rolId && member.roles.cache.has(m.rolId)) mult = Math.max(mult, m.multiplicador || 1);
    }
    return mult;
}

// Núcleo: suma `ganada` XP a un miembro, detecta subida de nivel y actúa.
async function aplicarXp(guild, member, ganada, cfg, canalFallback) {
    const dif = cfg.dificultad || 1;
    // Boost de XP comprado en la tienda (objeto con efecto xpBoost). Global por usuario.
    const boost = await economia.multiplicadorBoost(member.id);
    if (boost > 1) ganada = Math.round(ganada * boost);
    const doc = await ActividadUsuario.findOne({ guildId: guild.id, userId: member.id }).select('xp');
    const xpVieja = doc?.xp || 0;
    const xpNueva = xpVieja + ganada;
    const nivelViejo = progreso(xpVieja, dif).nivel;
    const nivelNuevo = progreso(xpNueva, dif).nivel;

    await ActividadUsuario.updateOne(
        { guildId: guild.id, userId: member.id },
        { $set: { xp: xpNueva, nivel: nivelNuevo, usuarioTag: member.user.username } },
        { upsert: true },
    );

    if (nivelNuevo > nivelViejo) {
        // Tarjeta de rango (imagen) si está activada.
        let tarjeta = null;
        if (cfg.tarjetaActiva !== false) {
            const prog = progreso(xpNueva, dif);
            const rank = (await ActividadUsuario.countDocuments({ guildId: guild.id, xp: { $gt: xpNueva } })) + 1;
            tarjeta = await adjuntoTarjeta(member.id, cfg, {
                avatarURL: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
                nombre: member.displayName, nivel: nivelNuevo, rank, xpActual: prog.actual, xpNecesaria: prog.necesaria,
            });
        }
        await anunciar(guild, member, cfg, nivelNuevo, canalFallback, tarjeta).catch(() => {});
        await darRecompensas(guild, member, cfg, nivelNuevo).catch(() => {});
        // Dinámicas · tablón de logros: celebra al primero que alcanza un nivel-hito.
        // Require perezoso para evitar el ciclo niveles <-> dinamicas.
        try { require('./dinamicas.js').comprobarLogroNivel(guild, member, nivelNuevo, cfg, canalFallback).catch(() => {}); } catch (_) { /* opcional */ }
    }
}

// XP por mensaje (respeta cooldown, exclusiones y rango configurable).
async function otorgarXp(message, cfg) {
    if (!cfg?.nivelesActivo) return;
    const member = message.member;
    if (!member) return;
    if (tieneRolSinXp(member, cfg)) return;
    if ((cfg.canalesSinXp || []).includes(message.channel.id)) return;

    const cd = (cfg.xpCooldownSeg ?? 60) * 1000;
    const doc = await ActividadUsuario.findOne({ guildId: message.guild.id, userId: member.id }).select('ultimoXp');
    if (doc?.ultimoXp && Date.now() - new Date(doc.ultimoXp).getTime() < cd) return;

    const min = cfg.xpMin ?? 15;
    const max = Math.max(min, cfg.xpMax ?? 25);
    const base = min + Math.floor(Math.random() * (max - min + 1));
    const ganada = Math.round(base * multiplicadorDe(member, cfg));

    await ActividadUsuario.updateOne({ guildId: message.guild.id, userId: member.id }, { $set: { ultimoXp: new Date() } }, { upsert: true });
    await aplicarXp(message.guild, member, ganada, cfg, message.channel);
}

// XP por estar en voz (la llama un intervalo cada minuto desde ready.js).
async function otorgarXpVoz(member, cfg) {
    if (!cfg?.nivelesActivo || !cfg.xpVozActivo) return;
    if (tieneRolSinXp(member, cfg)) return;
    const canalId = member.voice?.channelId;
    if (!canalId) return;
    if ((cfg.canalesSinXp || []).includes(canalId)) return;
    if (member.guild.afkChannelId && canalId === member.guild.afkChannelId) return; // nada en el canal AFK

    const ganada = Math.round((cfg.xpVozPorMin ?? 5) * multiplicadorDe(member, cfg));
    await aplicarXp(member.guild, member, ganada, cfg, null);
}

async function anunciar(guild, member, cfg, nivel, canalFallback, tarjeta) {
    const tipo = cfg.anuncioTipo || 'canal';
    if (tipo === 'off') return;
    const texto = (cfg.mensajeSubida || '🎉 ¡{mention} ha subido a **nivel {level}**!')
        .replace(/{mention}/g, `<@${member.id}>`)
        .replace(/{user}/g, member.user.username)
        .replace(/{level}/g, nivel);

    const payload = { content: texto };
    if (tarjeta) payload.files = [tarjeta];

    if (tipo === 'dm') { await member.send(payload).catch(() => {}); return; }
    const canal = cfg.canalNivelesId ? guild.channels.cache.get(cfg.canalNivelesId) : canalFallback;
    if (canal) await canal.send(payload).catch(() => {});
}

async function darRecompensas(guild, member, cfg, nivel) {
    const recompensas = cfg.recompensasNivel || [];
    const ganables = recompensas.filter((r) => r.rolId && r.nivel <= nivel);

    if (cfg.recompensaAcumulativa !== false) {
        // Acumulativo: añade todos los roles cuyo nivel ya alcanzó.
        for (const r of ganables) {
            const rol = guild.roles.cache.get(r.rolId);
            if (rol && rol.editable && !member.roles.cache.has(r.rolId)) await member.roles.add(rol).catch(() => {});
        }
    } else {
        // Sustitutivo: deja solo el rol del nivel más alto y quita los demás de recompensa.
        const objetivo = [...ganables].sort((a, b) => b.nivel - a.nivel)[0];
        for (const r of recompensas) {
            const rol = guild.roles.cache.get(r.rolId);
            if (!rol || !rol.editable) continue;
            if (objetivo && r.rolId === objetivo.rolId) {
                if (!member.roles.cache.has(r.rolId)) await member.roles.add(rol).catch(() => {});
            } else if (member.roles.cache.has(r.rolId)) {
                await member.roles.remove(rol).catch(() => {});
            }
        }
    }
}

module.exports = { otorgarXp, otorgarXpVoz, aplicarXp, progreso, nivelDeXp, xpDeNivel, xpTotalParaNivel, opcionesTarjeta, adjuntoTarjeta, construirBuffer };

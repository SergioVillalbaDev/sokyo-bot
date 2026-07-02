// ============================================================================
// soporte — Acceso al servidor de Discord de SOPORTE PRIORITARIO (Premium).
// Es un servidor privado: el invite NUNCA se publica en ningún sitio, solo lo
// recibe por MD quien paga Premium. Se le da el rol al entrar (o al momento,
// si ya estaba dentro) y se le QUITA en cuanto cancela o caduca.
//
// Configuración en el .env:
//   SUPPORT_GUILD_ID        el servidor de soporte (el bot debe estar dentro)
//   SUPPORT_ROL_PREMIUM_ID  el rol que desbloquea los canales privados ahí
// ============================================================================
const { PermissionsBitField, ChannelType } = require('discord.js');

const Flags = PermissionsBitField.Flags;

function servidorSoporte(client) {
    const guildId = process.env.SUPPORT_GUILD_ID;
    if (!guildId || !client) return null;
    return client.guilds.cache.get(guildId) || null;
}

// Da acceso al comprador tras el pago: si ya está en el servidor de soporte le
// da el rol directamente; si no, le manda un invite privado por MD (de un solo
// uso y caduca en 7 días, para que no quede un enlace suelto circulando).
async function otorgarAcceso(client, compradorId) {
    const guild = servidorSoporte(client);
    const rolId = process.env.SUPPORT_ROL_PREMIUM_ID;
    if (!guild || !rolId || !compradorId) return;

    const miembro = await guild.members.fetch(compradorId).catch(() => null);
    if (miembro) {
        await miembro.roles.add(rolId).catch((e) => console.error('Soporte: no se pudo dar el rol:', e.message));
        return;
    }

    try {
        const canal = guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.viewable) || guild.systemChannel;
        if (!canal) return console.error('Soporte: no hay ningún canal de texto disponible para crear el invite.');
        const invite = await canal.createInvite({ maxUses: 1, maxAge: 7 * 24 * 3600, unique: true });
        const usuario = await client.users.fetch(compradorId).catch(() => null);
        if (usuario) {
            await usuario.send(
                `🎫 ¡Gracias por hacerte Premium! Aquí tienes tu acceso al servidor de **soporte prioritario**: ${invite.url}\n` +
                `Este enlace es personal y de un solo uso — no lo compartas.`
            ).catch(() => {}); // MDs cerrados: no bloquea la activación del plan
        }
    } catch (e) { console.error('Soporte: no se pudo crear/enviar el invite:', e.message); }
}

// Quita el rol de soporte prioritario. No expulsa del servidor: si vuelve a
// pagar más adelante no hace falta re-invitarlo, solo se le devuelve el rol.
async function revocarAcceso(client, compradorId) {
    const guild = servidorSoporte(client);
    const rolId = process.env.SUPPORT_ROL_PREMIUM_ID;
    if (!guild || !rolId || !compradorId) return;
    const miembro = await guild.members.fetch(compradorId).catch(() => null);
    if (miembro) await miembro.roles.remove(rolId).catch((e) => console.error('Soporte: no se pudo quitar el rol:', e.message));
}

// Se llama desde guildMemberAdd cuando alguien entra AL SERVIDOR DE SOPORTE:
// cubre el caso de "le mandé el invite pero tardó en entrar" — si su ID es un
// comprador con Premium activo en algún servidor, le da el rol al momento.
async function manejarEntradaServidorSoporte(member) {
    const rolId = process.env.SUPPORT_ROL_PREMIUM_ID;
    if (!rolId) return;
    const ServidorConfig = require('../models/ServidorConfig.js');
    const { premiumActivo } = require('./billing.js'); // require perezoso: evita el ciclo con billing.js
    const cfg = await ServidorConfig.findOne({ soporteCompradorId: member.id }).sort({ updatedAt: -1 });
    if (cfg && premiumActivo(cfg)) {
        await member.roles.add(rolId).catch((e) => console.error('Soporte: no se pudo dar el rol al entrar:', e.message));
    }
}

// --- Aprovisionamiento (una sola vez) ---
// Crea el rol y los canales privados en un servidor VACÍO que hayas creado tú
// a mano e invitado al bot. Devuelve los IDs para pegar en el .env.
// Lo ejecuta scripts/provisionar-soporte.js — no se llama en producción.
async function provisionarServidor(client, guildId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new Error('El bot no está en ese servidor (¿lo invitaste ya?).');

    const rol = await guild.roles.create({
        name: '⭐ Soporte Prioritario',
        color: 0xf5b942,
        hoist: true,
        mentionable: false,
        reason: 'Aprovisionamiento del servidor de soporte Premium',
    });

    const categoria = await guild.channels.create({
        name: '⭐ SOPORTE PRIORITARIO',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
            { id: guild.id, deny: [Flags.ViewChannel] },
            { id: rol.id, allow: [Flags.ViewChannel, Flags.SendMessages, Flags.ReadMessageHistory] },
        ],
    });

    const canales = {};
    for (const nombre of ['bienvenida', 'soporte', 'reportar-bug', 'sugerencias']) {
        const canal = await guild.channels.create({ name: nombre, type: ChannelType.GuildText, parent: categoria.id });
        canales[nombre] = canal.id;
    }

    return { rolId: rol.id, categoriaId: categoria.id, canales };
}

module.exports = { otorgarAcceso, revocarAcceso, manejarEntradaServidorSoporte, provisionarServidor };

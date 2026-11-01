const { Events, PermissionsBitField } = require('discord.js');
const Mensaje = require('../models/Mensaje.js');
const Ticket = require('../models/Ticket.js');
const Log = require('../models/Log.js');
const configCache = require('../utils/configCache.js');
const { registrarActividad } = require('../utils/ticketManager.js');
const { sancionAutomatica } = require('../utils/moderacion.js');
const { darXp, entregarRecompensas } = require('../utils/niveles.js');
const { extraerDominios, dominioPermitido } = require('../utils/helpers.js');

// Ventanas de mensajes recientes por usuario para el antispam.
const ventanas = new Map();

const avisoTemporal = async (canal, texto) => {
    const m = await canal.send(texto).catch(() => null);
    if (m) setTimeout(() => m.delete().catch(() => {}), 8000);
};

// Devuelve true si el mensaje fue moderado (y no debe seguir procesándose).
async function aplicarAutoMod(message, config) {
    const am = config?.automod;
    if (!am?.activo) return false;
    // El staff con "Gestionar mensajes" queda exento.
    if (message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) return false;

    // --- Antienlaces ---
    if (am.antiEnlaces?.activo) {
        const prohibidos = extraerDominios(message.content).filter(d => !dominioPermitido(d, am.antiEnlaces.dominiosPermitidos));
        if (prohibidos.length > 0) {
            await message.delete().catch(() => {});
            await avisoTemporal(message.channel, `🔗 ${message.author}, no se permiten enlaces externos aquí.`);
            await Log.create({ guildId: message.guild.id, categoria: 'AutoMod', accion: '🔗 Enlace bloqueado', usuario: message.author.username, detalles: `Dominio(s): ${prohibidos.join(', ')}`, color: '#e67e22' }).catch(() => {});
            return true;
        }
    }

    // --- Antispam: demasiados mensajes en pocos segundos ---
    if (am.antiSpam?.activo) {
        const clave = `${message.guild.id}:${message.author.id}`;
        const ahora = Date.now();
        const limite = (am.antiSpam.segundos || 6) * 1000;
        const recientes = (ventanas.get(clave) || []).filter(t => ahora - t < limite);
        recientes.push(ahora);
        ventanas.set(clave, recientes);
        if (recientes.length >= (am.antiSpam.mensajes || 5)) {
            ventanas.delete(clave);
            const minutos = am.antiSpam.minutosMute || 10;
            const ok = await sancionAutomatica(message.guild, message.member, { tipo: 'mute', razon: 'Spam de mensajes', duracionMs: minutos * 60_000 });
            if (ok) await avisoTemporal(message.channel, `🛡️ ${message.author} ha sido silenciado **${minutos} min** por spam.`);
            return true;
        }
    }
    return false;
}

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || !message.guild) return;

        // 1. Mensajes dentro de un ticket: se guardan en la BD y alimentan métricas/SLA
        if (message.channel.name && message.channel.name.startsWith('ticket-')) {
            try {
                const ticket = await Ticket.exists({ canalId: message.channel.id });
                if (ticket) {
                    await Mensaje.create({
                        ticketId: message.channel.id,
                        usuario: message.author.username,
                        usuarioId: message.author.id,
                        contenido: message.content,
                        imagenes: [...message.attachments.values()].map(a => a.url)
                    });
                    await registrarActividad(message.channel.id, message.author.id);
                }
            } catch (error) {
                console.error('❌ Error al guardar mensaje en la BD:', error);
            }
            return; // los tickets no pasan por automod ni dan XP
        }

        // 2. AutoMod y niveles (solo fuera de tickets)
        try {
            const config = await configCache.obtener(message.guild.id);
            if (await aplicarAutoMod(message, config)) return;

            if (config?.niveles?.activo && message.member) {
                const sube = await darXp(message, config);
                if (sube) {
                    const canal = (config.niveles.canalId && message.guild.channels.cache.get(config.niveles.canalId)) || message.channel;
                    await canal.send({ content: `🎉 ${message.author} ha subido al **nivel ${sube.subioA}**.`, allowedMentions: { users: [message.author.id] } }).catch(() => {});
                    await entregarRecompensas(message.member, config, sube.subioA);
                }
            }
        } catch (error) { console.error('Error en automod/niveles:', error); }
    },
};

const { Events } = require('discord.js');
const Mensaje = require('../models/Mensaje.js');
const { getConfigCached } = require('../utils/config.js');
const { registrarMensaje } = require('../utils/actividad.js');
const { otorgarXp } = require('../utils/niveles.js');
const { revisarMensaje, revisarConIA } = require('../utils/automod.js');
const { revisarAutoRespuestas } = require('../utils/autoRespuestas.js');
const { marcarParticipacion } = require('../utils/embudo.js');
const { t, resolverIdioma } = require('../utils/i18n.js');
const bump = require('../utils/bump.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        // Crecimiento: respuesta de DISBOARD a un /bump (es un bot, va antes del filtro).
        if (message.author.id === bump.DISBOARD_ID) {
            await bump.procesarMensaje(message).catch((e) => console.error('Bump (DISBOARD):', e.message));
            return;
        }
        if (message.author.bot) return;

        // 0. Registro de actividad del usuario (mensajes), solo en servidores.
        if (message.guild) {
            try {
                const cfgAct = await getConfigCached(message.guildId);
                // Los comandos del propio bot (mensaje empieza por el prefijo) no son
                // contenido a moderar: se excluyen del automod y de la IA de moderación.
                const prefijoAct = (cfgAct && cfgAct.prefijo) || '!';
                const esComando = message.content.startsWith(prefijoAct);
                // Automod primero: si actúa (borra el mensaje), no seguimos con XP ni comandos.
                if (!esComando && await revisarMensaje(message, cfgAct, client)) return;
                // Moderación por IA (Pro): no bloquea el flujo; actúa por su cuenta si toca.
                if (!esComando) revisarConIA(message, cfgAct, client).catch(() => {});
                await registrarMensaje(message, !!(cfgAct && cfgAct.esPremium));
                await otorgarXp(message, cfgAct);
                // Embudo A/B: anota el primer mensaje del usuario (participación).
                if (cfgAct && cfgAct.embudoAB && cfgAct.embudoAB.activo) {
                    await marcarParticipacion(message.guildId, message.author.id).catch(() => {});
                }
            } catch (e) { console.error('Error registrando actividad de mensaje:', e.message); }

            // 0.5. Comunidad · Sugerencias: si el mensaje cae en el canal de
            // sugerencias, lo convertimos en un embed con votos y no seguimos.
            try {
                const cfgSug = await getConfigCached(message.guildId);
                if (cfgSug?.canalSugerencias && message.channelId === cfgSug.canalSugerencias) {
                    await require('../utils/comunidad.js').manejarMensajeSugerencia(message, cfgSug);
                    return;
                }
            } catch (e) { console.error('Sugerencia:', e.message); }

            // 0.7. Comunidad · Dinámicas de chat (contador, palabra secreta, reto,
            // QOTD). El contador "consume" el mensaje (su canal es de uso exclusivo).
            try {
                const cfgDin = await getConfigCached(message.guildId);
                if (cfgDin?.dinamicas) {
                    const consumido = await require('../utils/dinamicas.js').procesarMensaje(message, cfgDin, client);
                    if (consumido) return;
                }
            } catch (e) { console.error('Dinámicas (mensaje):', e.message); }
        }

        // 1. Guardar mensajes de los tickets en la BD
        // (Sin volcar el contenido a la consola: son conversaciones privadas.)
        if (message.channel.name && message.channel.name.startsWith('ticket-')) {
            try {
                let imagenesAdjuntas = [];
                
                if (message.attachments.size > 0) {
                    // Extraemos las URLs de forma segura
                    message.attachments.forEach(adjunto => {
                        imagenesAdjuntas.push(adjunto.url);
                    });
                }

                // Guardamos en MongoDB
                await Mensaje.create({
                    ticketId: message.channel.id,
                    usuario: message.author.username,
                    usuarioId: message.author.id,
                    contenido: message.content,
                    imagenes: imagenesAdjuntas
                });

            } catch (error) {
                console.error('❌ Error al guardar mensaje en la BD:', error);
            } 
        }

        // 2. Ejecutar comandos (según el prefijo configurado, por defecto "!")
        const cfg = await getConfigCached(message.guildId);
        const prefijo = (cfg && cfg.prefijo) || '!';
        if (!message.content.startsWith(prefijo)) {
            // No es un comando: comprobamos si coincide con una auto-respuesta.
            if (message.guild) await revisarAutoRespuestas(message, cfg).catch((e) => console.error('Auto-respuesta:', e.message));
            return;
        }

        const args = message.content.slice(prefijo.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = client.commands.get(commandName)
            || [...client.commands.values()].find((c) => Array.isArray(c.aliases) && c.aliases.includes(commandName));
        if (!command) return;

        try {
            await command.execute(message, args, client, cfg);
        } catch (error) {
            console.error(`Error en el comando ${commandName}:`, error);
            message.reply(t(cfg, '❌ Hubo un error al ejecutar ese comando.', '❌ There was an error trying to run that command.')).catch(() => {});
        }
    },
};
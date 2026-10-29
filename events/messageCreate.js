const { Events } = require('discord.js');
const Mensaje = require('../models/Mensaje.js');
const Ticket = require('../models/Ticket.js');
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
        // Mensaje fijo abajo: cualquier mensaje (también de otros bots, no del nuestro)
        // hace que el bot lo vuelva a publicar al final del canal.
        if (message.guild) require('../utils/mensajesFijos.js').alMensaje(message, client);

        // Crecimiento: respuesta de DISBOARD a un /bump (es un bot, va antes del filtro).
        if (message.author.id === bump.DISBOARD_ID) {
            await bump.procesarMensaje(message).catch((e) => console.error('Bump (DISBOARD):', e.message));
            return;
        }
        if (message.author.bot) return;

        // Por privado: lo que no es un comando va a los tickets por privado.
        if (!message.guild && !message.content.startsWith('!')) {
            await require('../utils/ticketsPrivado.js').alMensajePrivado(message, client).catch((e) => console.error('Tickets por privado:', e.message));
            return;
        }

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
                // Modo ausente: quien vuelve a escribir deja de estar ausente, y se avisa
                // de quién está ausente entre los mencionados.
                await require('../utils/ausente.js').alMensaje(message, cfgAct).catch((e) => console.error('Ausente:', e.message));
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

                // ¿A quién le toca? Si escribe quien abrió el ticket, al staff (y se
                // empieza a contar el tiempo sin respuesta); si escribe otra persona, ya
                // está atendido. Lo que manda el propio bot (avisos, el panel) no cuenta.
                // Los invitados al ticket (rol «Invitado») son del lado de quien lo abrió.
                if (!message.author.bot) {
                    const ahora = new Date();
                    const tk = await Ticket.findOne({ canalId: message.channel.id }).select('guildId canalId creadorId participantes porPrivado estado').lean();
                    if (tk) {
                        const delUsuario = tk.creadorId === message.author.id
                            || (tk.participantes || []).some((p) => p && p.id === message.author.id && p.rol === 'Invitado');
                        await Ticket.updateOne({ canalId: message.channel.id }, delUsuario
                            ? { $set: { esperaRespuesta: true, ultimoMensajeUsuario: ahora, avisoSinRespuesta: null } }
                            : { $set: { esperaRespuesta: false, ultimaInteractStaff: ahora } });
                        // Ticket abierto por privado: lo que escribe el staff le llega por privado.
                        if (tk.porPrivado && !delUsuario && tk.estado !== 'Cerrado') {
                            await require('../utils/ticketsPrivado.js').alUsuario(client, tk, {
                                autor: message.member?.displayName || message.author.username, texto: message.content, adjuntos: imagenesAdjuntas,
                            }).catch(() => {});
                        }
                    }
                }

            } catch (error) {
                console.error('❌ Error al guardar mensaje en la BD:', error);
            } 
        }

        // 2. Ejecutar comandos (según el prefijo configurado, por defecto "!")
        const cfg = await getConfigCached(message.guildId);
        const prefijo = (cfg && cfg.prefijo) || '!';

        // Solo una mención al bot (@Sokyo): saludo con lo más útil, entrar a «Mi
        // cuenta» con un clic, y cómo ver los comandos.
        if (client.user && new RegExp(`^<@!?${client.user.id}>$`).test(message.content.trim())) {
            const { EmbedBuilder, ActionRowBuilder } = require('discord.js');
            const { botonAbrirCuenta } = require('../utils/cuenta.js');
            const embed = new EmbedBuilder()
                .setColor('#a855f7')
                .setDescription(t(cfg,
                    `👋 ¡Hola, **${message.author.displayName || message.author.username}**! Soy Sokyo.\n\n✨ **Tu cuenta** (tickets, tienda, música y tu tarjeta): pulsa el botón y entras con un clic.\n📖 **Comandos**: escribe \`${prefijo}help\`.`,
                    `👋 Hi, **${message.author.displayName || message.author.username}**! I’m Sokyo.\n\n✨ **Your account** (tickets, shop, music and your card): press the button and you’re in with one click.\n📖 **Commands**: type \`${prefijo}help\`.`));
            await message.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(botonAbrirCuenta(cfg))], allowedMentions: { repliedUser: false } }).catch(() => {});
            return;
        }
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
            // Qué ha pasado en palabras normales y, si se arregla en el panel, el botón.
            const { respuestaError } = require('../utils/erroresDiscord.js');
            message.reply(respuestaError(error, cfg, { privado: false })).catch(() => {});
        }
    },
};
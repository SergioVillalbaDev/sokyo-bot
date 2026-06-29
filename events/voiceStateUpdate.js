const { Events } = require('discord.js');
const { registrarVoz } = require('../utils/actividad.js');
const { es247 } = require('../utils/musica.js');
const { manejarVoz } = require('../utils/vozTemporal.js');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState, client) {
        try {
            // CANALES DE VOZ TEMPORALES: crear al entrar a un generador / borrar al vaciarse.
            await manejarVoz(oldState, newState, client).catch((e) => console.error('voz-temporal:', e.message));

            // Solo cuando ENTRA a un canal de voz (o cambia de uno a otro).
            if (newState.channelId && newState.channelId !== oldState.channelId) {
                const member = newState.member;
                if (member && !member.user.bot) {
                    await registrarVoz(newState.guild.id, member, newState.channelId);
                }
            }

            // MÚSICA: si el bot se queda solo en su canal de voz, salir y parar.
            const player = client?.lavalink?.getPlayer(oldState.guild.id);
            if (player && oldState.channelId && oldState.channelId === player.voiceChannelId) {
                const canal = oldState.guild.channels.cache.get(player.voiceChannelId);
                const humanos = canal?.members.filter((m) => !m.user.bot).size ?? 0;
                // En modo 24/7 (Pro) el bot se queda aunque el canal se vacíe.
                if (humanos === 0 && !(await es247(oldState.guild.id))) {
                    const texto = client.channels.cache.get(player.textChannelId);
                    if (texto?.isTextBased()) texto.send('👋 I’m alone now, leaving the voice channel.').catch(() => {});
                    await player.destroy();
                }
            }
        } catch (e) { console.error('Error en voiceStateUpdate:', e.message); }
    },
};

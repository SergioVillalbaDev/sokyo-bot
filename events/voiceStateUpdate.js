const { Events } = require('discord.js');
const { registrarVoz } = require('../utils/actividad.js');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        try {
            // Solo cuando ENTRA a un canal de voz (o cambia de uno a otro).
            if (newState.channelId && newState.channelId !== oldState.channelId) {
                const member = newState.member;
                if (member && !member.user.bot) {
                    await registrarVoz(newState.guild.id, member, newState.channelId);
                }
            }
        } catch (e) { console.error('Error en voiceStateUpdate:', e.message); }
    },
};

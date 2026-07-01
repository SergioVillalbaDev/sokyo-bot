const { Events } = require('discord.js');
const Log = require('../models/Log.js');
const { getConfig, logActivo } = require('../utils/config.js');
const { marcarSalida } = require('../utils/embudo.js');
const { enviarDespedida } = require('../utils/bienvenida.js');
const { enviarLogADiscord } = require('../utils/logsManager.js');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member, client) {
        // --- Embudo de bienvenida A/B: anotar la salida para la retención ---
        try {
            await marcarSalida(member.guild.id, member.id);
        } catch (error) { console.error('Error marcando salida de embudo:', error.message); }

        let cfg;
        try {
            cfg = await getConfig(member.guild.id);
        } catch (error) { console.error('Error obteniendo config en guildMemberRemove:', error.message); return; }

        // --- Mensaje de despedida en el canal (editable, con embed/GIFs) ---
        if (!member.user.bot) {
            try { await enviarDespedida(member, cfg); }
            catch (error) { console.error('Error en mensaje de despedida:', error.message); }
        }

        try {
            if (!logActivo(cfg, 'salidas')) return;
            const log = await Log.create({
                guildId: member.guild.id,
                categoria: 'Salidas',
                accion: '🚶‍♂️ User left',
                usuario: member.user.username,
                detalles: `Roles they had: ${member.roles.cache.size - 1}`,
                color: '#95a5a6'
            });
            await enviarLogADiscord(client, log);
        } catch (error) { console.error('Error guardando log Leave:', error); }
    }
};

const { Events } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { registrarComandos } = require('../utils/registrarComandos.js');

// Cuando el bot entra en un servidor nuevo: crea su configuración y registra los comandos.
module.exports = {
    name: Events.GuildCreate,
    async execute(guild, client) {
        await ServidorConfig.updateOne({ guildId: guild.id }, { $setOnInsert: { guildId: guild.id } }, { upsert: true }).catch(() => {});
        await registrarComandos(client, guild);
    }
};

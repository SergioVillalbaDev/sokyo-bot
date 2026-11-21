const { Events } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const MiembroStats = require('../models/MiembroStats.js');

const COOLDOWN_MS = 60 * 1000;
const ultimoXp = new Map(); // "guild:user" -> timestamp
const nivelPara = xp => Math.floor(0.1 * Math.sqrt(xp));

// Da XP por mensaje (con cooldown anti-spam) y avisa al subir de nivel
module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || !message.guild) return;
        if (message.channel.name?.startsWith('ticket-')) return; // los tickets no dan XP
        if (message.content.startsWith('!')) return;

        const key = `${message.guild.id}:${message.author.id}`;
        const ahora = Date.now();
        if (ahora - (ultimoXp.get(key) ?? 0) < COOLDOWN_MS) return;
        ultimoXp.set(key, ahora);

        try {
            const config = await ServidorConfig.findOne({ guildId: message.guild.id });
            if (config && config.xpActivo === false) return;

            const ganado = 15 + Math.floor(Math.random() * 11); // 15-25
            const stats = await MiembroStats.findOneAndUpdate(
                { guildId: message.guild.id, userId: message.author.id },
                { $inc: { xp: ganado, mensajes: 1 } },
                { upsert: true, returnDocument: 'after' });

            const nuevoNivel = nivelPara(stats.xp);
            if (nuevoNivel > stats.nivel) {
                await MiembroStats.updateOne({ _id: stats._id }, { $set: { nivel: nuevoNivel } });
                await message.channel.send(`🎉 ¡${message.author} ha subido al **nivel ${nuevoNivel}**!`);
            }
        } catch (error) { console.error('Error en XP:', error); }
    }
};

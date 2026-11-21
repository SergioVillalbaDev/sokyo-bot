const { Events } = require('discord.js');
const MiembroStats = require('../models/MiembroStats.js');

// Si alguien invitado se va, se anota como salida del invitador (invitaciones "reales" = total - salidas)
module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        try {
            const stats = await MiembroStats.findOne({ guildId: member.guild.id, userId: member.id });
            if (!stats?.invitadoPor) return;
            await MiembroStats.updateOne(
                { guildId: member.guild.id, userId: stats.invitadoPor },
                { $inc: { invitacionesSalidas: 1 } });
            await MiembroStats.updateOne({ _id: stats._id }, { $set: { invitadoPor: null } });
        } catch (error) { console.error('Error registrando salida:', error); }
    }
};

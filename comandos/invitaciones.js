const MiembroStats = require('../models/MiembroStats.js');

module.exports = {
    name: 'invitaciones',
    description: 'Cuántas personas ha traído un usuario al servidor',
    async execute(message) {
        const objetivo = message.mentions.users.first() || message.author;
        const s = await MiembroStats.findOne({ guildId: message.guild.id, userId: objetivo.id });
        const total = s?.invitaciones ?? 0;
        const salidas = s?.invitacionesSalidas ?? 0;
        await message.reply(`📨 **${objetivo.username}** ha invitado a **${total - salidas}** personas (${total} totales, ${salidas} se fueron).`);
    }
};

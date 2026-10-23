const { PermissionsBitField } = require('discord.js');
const ActividadUsuario = require('../models/ActividadUsuario.js');
const { getConfigCached } = require('../utils/config.js');
const { xpTotalParaNivel, nivelDeXp } = require('../utils/niveles.js');

module.exports = {
    name: 'xp',
    description: 'Manage users’ XP. !xp add/set/reset @user [value]',

    async execute(message, args) {
        const p = message.member.permissions;
        if (!p.has(PermissionsBitField.Flags.Administrator) && !p.has(PermissionsBitField.Flags.ManageGuild)) {
            return message.reply('❌ You need the **Manage Server** permission.');
        }

        const sub = args[0]?.toLowerCase();
        const target = message.mentions.users.first();
        if (!['add', 'set', 'reset'].includes(sub) || !target) {
            return message.reply('Usage: `!xp add @user <xp>` · `!xp set @user <level>` · `!xp reset @user`');
        }

        const cfg = await getConfigCached(message.guild.id);
        const dif = cfg?.dificultad || 1;
        const guildId = message.guild.id;
        const userId = target.id;
        const doc = await ActividadUsuario.findOne({ guildId, userId });
        let xp = doc?.xp || 0;

        if (sub === 'add') {
            const n = parseInt(args[2], 10);
            if (Number.isNaN(n)) return message.reply('❌ Provide an XP amount. e.g. `!xp add @user 500`');
            xp = Math.max(0, xp + n);
        } else if (sub === 'set') {
            const nivel = parseInt(args[2], 10);
            if (Number.isNaN(nivel)) return message.reply('❌ Provide a level. e.g. `!xp set @user 10`');
            xp = xpTotalParaNivel(Math.max(0, nivel), dif);
        } else {
            xp = 0;
        }

        await ActividadUsuario.updateOne({ guildId, userId }, { $set: { xp, nivel: nivelDeXp(xp, dif), usuarioTag: target.username } }, { upsert: true });
        return message.reply(`✅ **${target.username}** now has **${xp} XP** (level ${nivelDeXp(xp, dif)}).`);
    },
};

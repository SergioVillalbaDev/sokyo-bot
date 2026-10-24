const { PermissionsBitField } = require('discord.js');
const { t } = require('../utils/i18n.js');

module.exports = {
    name: 'sticker',
    description: 'Manage stickers. !sticker add <name> (attach a PNG) · !sticker remove <name>',

    async execute(message, args, client, cfg) {
        const p = message.member.permissions;
        if (!p.has(PermissionsBitField.Flags.Administrator) && !p.has(PermissionsBitField.Flags.ManageGuildExpressions)) {
            return message.reply(t(cfg, '❌ Necesitas el permiso **Gestionar expresiones**.', '❌ You need the **Manage Expressions** permission.'));
        }

        const sub = args[0]?.toLowerCase();

        if (sub === 'add') {
            const nombre = String(args[1] || '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32);
            if (!nombre || nombre.length < 2) return message.reply(t(cfg, '❌ Indica un nombre. Ej.: `!sticker add nombre` con un PNG adjunto.', '❌ Provide a name. e.g. `!sticker add name` with a PNG attached.'));
            const att = message.attachments.first();
            if (!att) return message.reply(t(cfg, '❌ Adjunta una imagen PNG (máx. 512 KB, ideal 320×320).', '❌ Attach a PNG image (≤512 KB, ideally 320×320).'));

            try {
                const sticker = await message.guild.stickers.create({ file: att.url, name: nombre, tags: nombre });
                return message.reply(t(cfg, `✅ Sticker **${sticker.name}** creado.`, `✅ Sticker **${sticker.name}** created.`));
            } catch (e) { return message.reply(t(cfg, `❌ No se ha podido crear (¿sin huecos libres, formato o tamaño?). ${e.message}`, `❌ Couldn’t create it (slots full, format or size?). ${e.message}`)); }
        }

        if (sub === 'remove') {
            await message.guild.stickers.fetch().catch(() => {});
            const sticker = message.guild.stickers.cache.find((s) => s.name === args[1]);
            if (!sticker) return message.reply(t(cfg, '❌ No encuentro ese sticker.', '❌ Sticker not found.'));
            try { await sticker.delete(); return message.reply(t(cfg, `✅ Sticker **${sticker.name}** eliminado.`, `✅ Sticker **${sticker.name}** removed.`)); }
            catch (e) { return message.reply(`❌ ${e.message}`); }
        }

        return message.reply(t(cfg, 'Uso: `!sticker add <nombre>` (adjunta un PNG) · `!sticker remove <nombre>`', 'Usage: `!sticker add <name>` (attach a PNG) · `!sticker remove <name>`'));
    },
};

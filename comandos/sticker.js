const { PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'sticker',
    description: 'Gestiona stickers. !sticker add <nombre> (adjunta PNG) · !sticker remove <nombre>',

    async execute(message, args) {
        const p = message.member.permissions;
        if (!p.has(PermissionsBitField.Flags.Administrator) && !p.has(PermissionsBitField.Flags.ManageGuildExpressions)) {
            return message.reply('❌ Necesitas permiso de **Gestionar expresiones**.');
        }

        const sub = args[0]?.toLowerCase();

        if (sub === 'add') {
            const nombre = String(args[1] || '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32);
            if (!nombre || nombre.length < 2) return message.reply('❌ Indica un nombre. Ej: `!sticker add nombre` con un PNG adjunto.');
            const att = message.attachments.first();
            if (!att) return message.reply('❌ Adjunta una imagen PNG (≤512 KB, ideal 320×320).');

            try {
                const sticker = await message.guild.stickers.create({ file: att.url, name: nombre, tags: nombre });
                return message.reply(`✅ Sticker **${sticker.name}** creado.`);
            } catch (e) { return message.reply(`❌ No se pudo crear (¿slots llenos, formato o tamaño?). ${e.message}`); }
        }

        if (sub === 'remove') {
            await message.guild.stickers.fetch().catch(() => {});
            const sticker = message.guild.stickers.cache.find((s) => s.name === args[1]);
            if (!sticker) return message.reply('❌ Sticker no encontrado.');
            try { await sticker.delete(); return message.reply(`✅ Sticker **${sticker.name}** eliminado.`); }
            catch (e) { return message.reply(`❌ ${e.message}`); }
        }

        return message.reply('Uso: `!sticker add <nombre>` (adjunta PNG) · `!sticker remove <nombre>`');
    },
};

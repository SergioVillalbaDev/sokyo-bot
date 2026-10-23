const { PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'emoji',
    description: 'Manage emojis. !emoji add <name> (attach an image or paste an emoji) · !emoji remove <name>',

    async execute(message, args) {
        const p = message.member.permissions;
        if (!p.has(PermissionsBitField.Flags.Administrator) && !p.has(PermissionsBitField.Flags.ManageGuildExpressions)) {
            return message.reply('❌ You need the **Manage Expressions** permission.');
        }

        const sub = args[0]?.toLowerCase();

        // --- Añadir / robar ---
        if (sub === 'add') {
            let nombre = String(args[1] || '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32);

            // Origen: un emoji personalizado pegado en el mensaje (robar), o una imagen adjunta.
            const emojiMatch = /<(a?):(\w+):(\d+)>/.exec(message.content);
            let url;
            if (emojiMatch) {
                const [, anim, nom, id] = emojiMatch;
                url = `https://cdn.discordapp.com/emojis/${id}.${anim ? 'gif' : 'png'}`;
                if (!nombre) nombre = nom;
            } else if (message.attachments.size > 0) {
                url = message.attachments.first().url;
            } else {
                return message.reply('❌ Attach an image or paste an emoji. e.g. `!emoji add name` (with image) or `!emoji add :otherEmoji:`.');
            }
            if (!nombre || nombre.length < 2) return message.reply('❌ Provide a name (at least 2 characters).');

            try {
                const emoji = await message.guild.emojis.create({ attachment: url, name: nombre });
                return message.reply(`✅ Emoji created: ${emoji} \`:${emoji.name}:\``);
            } catch (e) { return message.reply(`❌ Couldn’t create it (slots full or image >256 KB?). ${e.message}`); }
        }

        // --- Eliminar ---
        if (sub === 'remove') {
            const m = /<a?:(\w+):(\d+)>/.exec(message.content);
            const emoji = m ? message.guild.emojis.cache.get(m[2]) : message.guild.emojis.cache.find((e) => e.name === args[1]);
            if (!emoji) return message.reply('❌ Emoji not found.');
            try { await emoji.delete(); return message.reply(`✅ Emoji \`:${emoji.name}:\` removed.`); }
            catch (e) { return message.reply(`❌ ${e.message}`); }
        }

        return message.reply('Usage: `!emoji add <name>` (attach an image or paste an emoji) · `!emoji remove <name or emoji>`');
    },
};

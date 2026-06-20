const { PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'emoji',
    description: 'Gestiona emojis. !emoji add <nombre> (adjunta imagen o pega un emoji) · !emoji remove <nombre>',

    async execute(message, args) {
        const p = message.member.permissions;
        if (!p.has(PermissionsBitField.Flags.Administrator) && !p.has(PermissionsBitField.Flags.ManageGuildExpressions)) {
            return message.reply('❌ Necesitas permiso de **Gestionar expresiones**.');
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
                return message.reply('❌ Adjunta una imagen o pega un emoji. Ej: `!emoji add nombre` (con imagen) o `!emoji add :otroEmoji:`.');
            }
            if (!nombre || nombre.length < 2) return message.reply('❌ Indica un nombre (mínimo 2 caracteres).');

            try {
                const emoji = await message.guild.emojis.create({ attachment: url, name: nombre });
                return message.reply(`✅ Emoji creado: ${emoji} \`:${emoji.name}:\``);
            } catch (e) { return message.reply(`❌ No se pudo crear (¿slots llenos o imagen >256 KB?). ${e.message}`); }
        }

        // --- Eliminar ---
        if (sub === 'remove') {
            const m = /<a?:(\w+):(\d+)>/.exec(message.content);
            const emoji = m ? message.guild.emojis.cache.get(m[2]) : message.guild.emojis.cache.find((e) => e.name === args[1]);
            if (!emoji) return message.reply('❌ Emoji no encontrado.');
            try { await emoji.delete(); return message.reply(`✅ Emoji \`:${emoji.name}:\` eliminado.`); }
            catch (e) { return message.reply(`❌ ${e.message}`); }
        }

        return message.reply('Uso: `!emoji add <nombre>` (adjunta imagen o pega un emoji) · `!emoji remove <nombre o emoji>`');
    },
};

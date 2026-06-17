module.exports = {
    name: 'rol',
    description: 'Gestiona roles del servidor (crear, asignar, quitar)',

    async execute(message, args, client) {
        // Solo quien pueda gestionar roles en Discord puede usar este comando.
        if (!message.member.permissions.has('ManageRoles')) {
            return message.reply('❌ No tienes permiso para gestionar roles.');
        }

        const subcomando = args[0]?.toLowerCase();

        // --- Crear un rol nuevo ---
        if (subcomando === 'crear') {
            const nombre = args[1];
            if (!nombre) return message.reply('❌ Uso: `!rol crear <nombre> [#color]`');

            const color = args[2] || '#99AAB5'; // gris Discord por defecto

            const rol = await message.guild.roles.create({ name: nombre, color });
            return message.reply(`✅ Rol **${rol.name}** creado con color \`${color}\``);
        }

        // --- Asignar un rol a un usuario ---
        if (subcomando === 'asignar') {
            const usuario = message.mentions.members.first();
            const rol = message.mentions.roles.first();
            if (!usuario || !rol) return message.reply('❌ Uso: `!rol asignar <@usuario> <@rol>`');

            await usuario.roles.add(rol);
            return message.reply(`✅ Rol **${rol.name}** asignado a **${usuario.user.username}**`);
        }

        // --- Quitar un rol a un usuario ---
        if (subcomando === 'quitar') {
            const usuario = message.mentions.members.first();
            const rol = message.mentions.roles.first();
            if (!usuario || !rol) return message.reply('❌ Uso: `!rol quitar <@usuario> <@rol>`');

            await usuario.roles.remove(rol);
            return message.reply(`✅ Rol **${rol.name}** quitado a **${usuario.user.username}**`);
        }

        return message.reply('❌ Subcomando desconocido. Usa: `crear`, `asignar` o `quitar`');
    }
};

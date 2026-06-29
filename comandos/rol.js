module.exports = {
    name: 'role',
    description: 'Manage server roles (create, assign, remove)',

    async execute(message, args, client) {
        // Solo quien pueda gestionar roles en Discord puede usar este comando.
        if (!message.member.permissions.has('ManageRoles')) {
            return message.reply('❌ You don’t have permission to manage roles.');
        }

        const subcomando = args[0]?.toLowerCase();

        // --- Crear un rol nuevo ---
        if (subcomando === 'create') {
            const nombre = args[1];
            if (!nombre) return message.reply('❌ Usage: `!role create <name> [#color]`');

            const color = args[2] || '#99AAB5'; // gris Discord por defecto

            const rol = await message.guild.roles.create({ name: nombre, color });
            return message.reply(`✅ Role **${rol.name}** created with color \`${color}\``);
        }

        // --- Asignar un rol a un usuario ---
        if (subcomando === 'assign') {
            const usuario = message.mentions.members.first();
            const rol = message.mentions.roles.first();
            if (!usuario || !rol) return message.reply('❌ Usage: `!role assign <@user> <@role>`');

            await usuario.roles.add(rol);
            return message.reply(`✅ Role **${rol.name}** assigned to **${usuario.user.username}**`);
        }

        // --- Quitar un rol a un usuario ---
        if (subcomando === 'remove') {
            const usuario = message.mentions.members.first();
            const rol = message.mentions.roles.first();
            if (!usuario || !rol) return message.reply('❌ Usage: `!role remove <@user> <@role>`');

            await usuario.roles.remove(rol);
            return message.reply(`✅ Role **${rol.name}** removed from **${usuario.user.username}**`);
        }

        return message.reply('❌ Unknown subcommand. Use: `create`, `assign` or `remove`');
    }
};

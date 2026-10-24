const { t } = require('../utils/i18n.js');

// ¿Puede `miembro` gestionar `rol`? Igual que en Discord: solo roles por debajo
// del suyo más alto (salvo el dueño del servidor) y por debajo del del bot. Sin
// esto, cualquiera con "Gestionar roles" podía darse un rol superior a través del
// bot, que es administrador.
function puedeGestionar(miembro, rol) {
    const guild = miembro.guild;
    if (rol.managed || rol.id === guild.id) return false;
    const porDebajoDelBot = guild.members.me && rol.position < guild.members.me.roles.highest.position;
    const porDebajoDelMiembro = guild.ownerId === miembro.id || rol.position < miembro.roles.highest.position;
    return porDebajoDelBot && porDebajoDelMiembro;
}

module.exports = {
    name: 'role',
    description: 'Manage server roles (create, assign, remove)',

    async execute(message, args, client, cfg) {
        // Solo quien pueda gestionar roles en Discord puede usar este comando.
        if (!message.member.permissions.has('ManageRoles')) {
            return message.reply(t(cfg, '❌ No tienes permiso para gestionar roles.', '❌ You don’t have permission to manage roles.'));
        }

        const subcomando = args[0]?.toLowerCase();

        try {
            // --- Crear un rol nuevo ---
            if (subcomando === 'create') {
                const nombre = args[1];
                if (!nombre) return message.reply(t(cfg, '❌ Uso: `!role create <nombre> [#color]`', '❌ Usage: `!role create <name> [#color]`'));

                const color = args[2] || '#99AAB5'; // gris Discord por defecto
                if (!/^#?[0-9a-f]{6}$/i.test(color)) {
                    return message.reply(t(cfg, '❌ El color tiene que ser hexadecimal, p. ej. `#3498db`.', '❌ The color must be hexadecimal, e.g. `#3498db`.'));
                }
                const hex = color.startsWith('#') ? color : `#${color}`;
                const rol = await message.guild.roles.create({ name: nombre.slice(0, 100), colors: { primaryColor: hex } });
                return message.reply(t(cfg, `✅ Rol **${rol.name}** creado con el color \`${hex}\``, `✅ Role **${rol.name}** created with color \`${hex}\``));
            }

            // --- Asignar o quitar un rol a un usuario ---
            if (subcomando === 'assign' || subcomando === 'remove') {
                const usuario = message.mentions.members.first();
                const rol = message.mentions.roles.first();
                if (!usuario || !rol) {
                    return message.reply(subcomando === 'assign'
                        ? t(cfg, '❌ Uso: `!role assign <@usuario> <@rol>`', '❌ Usage: `!role assign <@user> <@role>`')
                        : t(cfg, '❌ Uso: `!role remove <@usuario> <@rol>`', '❌ Usage: `!role remove <@user> <@role>`'));
                }
                if (!puedeGestionar(message.member, rol)) {
                    return message.reply(t(cfg,
                        `❌ No puedes gestionar **${rol.name}**: tiene que estar por debajo de tu rol más alto y del rol del bot.`,
                        `❌ You can’t manage **${rol.name}**: it must be below your highest role and the bot’s role.`));
                }
                if (subcomando === 'assign') {
                    await usuario.roles.add(rol);
                    return message.reply(t(cfg, `✅ Rol **${rol.name}** asignado a **${usuario.user.username}**`, `✅ Role **${rol.name}** assigned to **${usuario.user.username}**`));
                }
                await usuario.roles.remove(rol);
                return message.reply(t(cfg, `✅ Rol **${rol.name}** quitado a **${usuario.user.username}**`, `✅ Role **${rol.name}** removed from **${usuario.user.username}**`));
            }
        } catch (e) {
            return message.reply(t(cfg, `❌ Discord no lo ha permitido: ${e.message}`, `❌ Discord didn’t allow it: ${e.message}`)).catch(() => {});
        }

        return message.reply(t(cfg, '❌ Subcomando desconocido. Usa: `create`, `assign` o `remove`', '❌ Unknown subcommand. Use: `create`, `assign` or `remove`'));
    },
};

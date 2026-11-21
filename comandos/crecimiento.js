const { PermissionsBitField } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');

const AYUDA = `**Configuración de crecimiento** (solo admins)
\`!crecimiento bienvenida #canal\` — activa la bienvenida en ese canal
\`!crecimiento mensaje <texto>\` — personaliza el mensaje (usa {usuario}, {servidor}, {miembros})
\`!crecimiento rol @rol\` — rol que se da automáticamente al entrar
\`!crecimiento xp on|off\` — activa/desactiva los niveles
\`!crecimiento desactivar\` — quita bienvenida y rol automático`;

module.exports = {
    name: 'crecimiento',
    description: 'Configura bienvenida, rol automático y niveles',
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Necesitas permisos de Administrador.');
        }
        const sub = (args.shift() || '').toLowerCase();
        const filtro = { guildId: message.guild.id };
        const set = async cambios => ServidorConfig.updateOne(filtro, { $set: cambios }, { upsert: true });

        switch (sub) {
            case 'bienvenida': {
                const canal = message.mentions.channels.first();
                if (!canal) return message.reply('Menciona un canal: `!crecimiento bienvenida #canal`');
                await set({ canalBienvenidaId: canal.id });
                return message.reply(`✅ Bienvenidas activadas en ${canal}.`);
            }
            case 'mensaje': {
                const texto = args.join(' ').trim();
                if (!texto) return message.reply('Escribe el mensaje. Variables: {usuario} {servidor} {miembros}');
                await set({ mensajeBienvenida: texto.slice(0, 1500) });
                return message.reply('✅ Mensaje de bienvenida actualizado.');
            }
            case 'rol': {
                const rol = message.mentions.roles.first();
                if (!rol) return message.reply('Menciona un rol: `!crecimiento rol @rol`');
                const yo = message.guild.members.me;
                if (rol.managed || rol.position >= yo.roles.highest.position) {
                    return message.reply('❌ Ese rol está por encima del mío (o es gestionado); sube el rol del bot en la lista de roles.');
                }
                await set({ rolAutomaticoId: rol.id });
                return message.reply(`✅ Los nuevos miembros recibirán ${rol.name}.`);
            }
            case 'xp': {
                const valor = (args[0] || '').toLowerCase();
                if (!['on', 'off'].includes(valor)) return message.reply('Usa `!crecimiento xp on` u `off`.');
                await set({ xpActivo: valor === 'on' });
                return message.reply(`✅ Niveles ${valor === 'on' ? 'activados' : 'desactivados'}.`);
            }
            case 'desactivar':
                await set({ canalBienvenidaId: null, rolAutomaticoId: null });
                return message.reply('✅ Bienvenida y rol automático desactivados.');
            default:
                return message.reply(AYUDA);
        }
    }
};

const { Events } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const MiembroStats = require('../models/MiembroStats.js');
const { detectarInvitacion } = require('../utils/invitaciones.js');

// Bienvenida + rol automático + atribución de la invitación usada
module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const { guild } = member;
        try {
            const config = await ServidorConfig.findOne({ guildId: guild.id });

            // 1. Rol automático
            if (config?.rolAutomaticoId && !member.user.bot) {
                await member.roles.add(config.rolAutomaticoId).catch(e =>
                    console.error('No se pudo asignar el rol automático:', e.message));
            }

            // 2. Quién lo invitó
            let invitador = null;
            const invite = await detectarInvitacion(guild);
            if (invite?.inviter && invite.inviter.id !== member.id && !member.user.bot) {
                invitador = invite.inviter;
                await MiembroStats.updateOne(
                    { guildId: guild.id, userId: invitador.id },
                    { $inc: { invitaciones: 1 } }, { upsert: true });
                await MiembroStats.updateOne(
                    { guildId: guild.id, userId: member.id },
                    { $set: { invitadoPor: invitador.id } }, { upsert: true });
            }

            // 3. Mensaje de bienvenida
            if (config?.canalBienvenidaId) {
                const canal = guild.channels.cache.get(config.canalBienvenidaId);
                if (canal?.isTextBased()) {
                    let texto = (config.mensajeBienvenida || '')
                        .replaceAll('{usuario}', `<@${member.id}>`)
                        .replaceAll('{servidor}', guild.name)
                        .replaceAll('{miembros}', guild.memberCount);
                    if (invitador) texto += `\n📨 Invitado por **${invitador.username}**`;
                    await canal.send({ content: texto, allowedMentions: { users: [member.id] } });
                }
            }
        } catch (error) { console.error('Error en bienvenida/invitaciones:', error); }
    }
};

// Atajos para comprobar permisos dentro de comandos e interacciones de Discord.
const { MessageFlags } = require('discord.js');
const ServidorConfig = require('../models/ServidorConfig.js');
const { calcularPermisos, PERMISOS } = require('./permisos.js');

const EPH = MessageFlags.Ephemeral;

// Obtiene (o crea) la configuración del servidor.
async function obtenerConfig(guildId) {
    return (await ServidorConfig.findOne({ guildId })) || (await ServidorConfig.create({ guildId }));
}

async function permisosDe(member) {
    const config = await ServidorConfig.findOne({ guildId: member.guild.id });
    return calcularPermisos(member, config);
}

// Exige que quien interactúa tenga TODOS los permisos indicados. Si no, responde (efímero) y devuelve false.
async function exigir(interaction, ...ids) {
    if (!interaction.inGuild() || !interaction.member) {
        await interaction.reply({ content: '❌ Esto solo funciona dentro de un servidor.', flags: EPH }).catch(() => {});
        return false;
    }
    const calculo = await permisosDe(interaction.member);
    const faltan = ids.filter(id => !calculo.permisos.has(id));
    if (faltan.length === 0) return calculo;
    const nombres = faltan.map(id => `**${PERMISOS.find(p => p.id === id)?.nombre || id}**`).join(', ');
    const msg = `🔒 No tienes permiso para esto. Te falta: ${nombres}.`;
    if (interaction.deferred || interaction.replied) await interaction.editReply({ content: msg }).catch(() => {});
    else await interaction.reply({ content: msg, flags: EPH }).catch(() => {});
    return false;
}

module.exports = { EPH, obtenerConfig, permisosDe, exigir };

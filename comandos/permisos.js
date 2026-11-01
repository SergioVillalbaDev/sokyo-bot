// /permisos — muestra qué puedes hacer tú en el panel y con el bot (y por qué).
const { SlashCommandBuilder, EmbedBuilder, InteractionContextType } = require('discord.js');
const { GRUPOS, PERMISOS } = require('../utils/permisos.js');
const { permisosDe, EPH } = require('../utils/accesos.js');

module.exports = {
    data: new SlashCommandBuilder().setName('permisos').setDescription('Mira a qué tienes acceso en el panel y con el bot').setContexts(InteractionContextType.Guild),
    async execute(interaction) {
        const calculo = await permisosDe(interaction.member);
        const embed = new EmbedBuilder().setColor('#5865F2').setTitle(`🔐 Tus permisos — ${calculo.rango}`)
            .setDescription('✅ = puedes · 🔒 = no tienes acceso. Los permisos de moderación dependen solo de tus permisos de Discord.');
        for (const g of GRUPOS) {
            const lineas = PERMISOS.filter(p => p.grupo === g.id).map(p => `${calculo.permisos.has(p.id) ? '✅' : '🔒'} ${p.nombre}`);
            embed.addFields({ name: `${g.icono} ${g.nombre}`, value: lineas.join('\n'), inline: true });
        }
        await interaction.reply({ embeds: [embed], flags: EPH });
    }
};

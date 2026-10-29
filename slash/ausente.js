const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { ponerAusente, quitarAusente, estaAusente, cargar } = require('../utils/ausente.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');
const { t } = require('../utils/i18n.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /ausente [motivo]: si alguien te menciona, el bot le dice que no estás. Se quita
// solo al volver a escribir (o usando /ausente otra vez).
module.exports = {
    data: new SlashCommandBuilder()
        .setName('afk')
        .setNameLocalizations(ES('ausente'))
        .setDescription('Let people know you’re away when they mention you')
        .setDescriptionLocalizations(ES('Avisa de que no estás cuando alguien te mencione'))
        .setContexts(InteractionContextType.Guild)
        .addStringOption((o) => o.setName('reason').setNameLocalizations(ES('motivo'))
            .setDescription('Why you’re away (optional): “having dinner”, “back tomorrow”…')
            .setDescriptionLocalizations(ES('Por qué no estás (opcional): «cenando», «vuelvo mañana»…'))
            .setMaxLength(200)),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        if (cfg?.ausente?.activo === false) {
            return interaction.reply({ content: t(idioma, '💤 El modo ausente está apagado en este servidor.', '💤 Away status is turned off on this server.'), flags: 64 });
        }
        await cargar();
        // Usarlo estando ya ausente lo quita (por si quieres volver sin escribir nada).
        if (estaAusente(interaction.guildId, interaction.user.id) && !interaction.options.getString('reason')) {
            await quitarAusente(interaction.guild, interaction.user.id);
            return interaction.reply({ content: t(idioma, '👋 Ya no estás ausente.', '👋 You’re no longer away.'), flags: 64 });
        }
        const motivo = interaction.options.getString('reason') || '';
        await ponerAusente(interaction.member, motivo, cfg);
        await interaction.reply({
            content: motivo
                ? t(idioma, `💤 Estás ausente: «${motivo}». Si alguien te menciona, se lo diré. Se quita solo cuando vuelvas a escribir.`, `💤 You’re away: “${motivo}”. If someone mentions you, I’ll let them know. It clears itself when you write again.`)
                : t(idioma, '💤 Estás ausente. Si alguien te menciona, se lo diré. Se quita solo cuando vuelvas a escribir.', '💤 You’re away. If someone mentions you, I’ll let them know. It clears itself when you write again.'),
            flags: 64,
        });
    },
};

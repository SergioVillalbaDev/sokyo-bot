const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const referidos = require('../utils/referidos.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');
const { t } = require('../utils/i18n.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

// /referidos ver · canjear · destino — el programa de referidos (utils/referidos.js).
module.exports = {
    data: new SlashCommandBuilder()
        .setName('referrals')
        .setNameLocalizations(ES('referidos'))
        .setDescription('Recommend Sokyo and earn Premium days for your server')
        .setDescriptionLocalizations(ES('Recomienda Sokyo y gana días de Premium para tu servidor'))
        .addSubcommand((s) => s.setName('view').setNameLocalizations(ES('ver'))
            .setDescription('Your referral code and how it’s going').setDescriptionLocalizations(ES('Tu código de referido y cómo va')))
        .addSubcommand((s) => s.setName('redeem').setNameLocalizations(ES('canjear'))
            .setDescription('Say who recommended Sokyo to this server').setDescriptionLocalizations(ES('Di quién te recomendó Sokyo para este servidor'))
            .addStringOption((o) => o.setName('code').setNameLocalizations(ES('codigo')).setDescription('The code they gave you')
                .setDescriptionLocalizations(ES('El código que te dio')).setRequired(true).setMaxLength(12)))
        .addSubcommand((s) => s.setName('destination').setNameLocalizations(ES('destino'))
            .setDescription('Send your Premium days to THIS server').setDescriptionLocalizations(ES('Que tus días de Premium vayan a ESTE servidor'))),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        const sub = interaction.options.getSubcommand();

        if (sub === 'redeem') {
            if (!interaction.guild) return interaction.reply({ content: t(idioma, '❌ Úsalo dentro del servidor nuevo.', '❌ Use it inside the new server.'), flags: 64 });
            const r = await referidos.canjear(interaction.guild, interaction.member, interaction.options.getString('code'));
            if (r.error) return interaction.reply({ content: `❌ ${referidos.textoError(idioma, r.error)}`, flags: 64 });
            return interaction.reply({ content: t(idioma,
                `✅ ¡Hecho! Si Sokyo sigue aquí dentro de ${referidos.DIAS_ESPERA} días y el servidor tiene al menos ${referidos.MIEMBROS_MIN} miembros, <@${r.referidorId}> recibirá su premio.`,
                `✅ Done! If Sokyo is still here in ${referidos.DIAS_ESPERA} days and the server has at least ${referidos.MIEMBROS_MIN} members, <@${r.referidorId}> will get their reward.`),
            allowedMentions: { parse: [] } });
        }

        if (sub === 'destination') {
            if (!interaction.guild) return interaction.reply({ content: t(idioma, '❌ Úsalo en el servidor que quieres que reciba los días.', '❌ Use it in the server that should get the days.'), flags: 64 });
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return interaction.reply({ content: t(idioma, '❌ Tienes que poder «Gestionar servidor» aquí.', '❌ You need “Manage Server” here.'), flags: 64 });
            }
            await referidos.fijarDestino(interaction.user.id, interaction.guild.id);
            return interaction.reply({ content: t(idioma, `✅ Tus días de Premium irán a **${interaction.guild.name}**.`, `✅ Your Premium days will go to **${interaction.guild.name}**.`), flags: 64 });
        }

        const r = await referidos.resumen(interaction.user.id);
        const destino = r.destinoGuildId ? client.guilds.cache.get(r.destinoGuildId) : null;
        const embed = new EmbedBuilder()
            .setColor(0x7c5cff)
            .setTitle(t(idioma, '🤝 Recomienda Sokyo', '🤝 Recommend Sokyo'))
            .setDescription([
                t(idioma, `Tu código: **\`${r.codigo}\`**`, `Your code: **\`${r.codigo}\`**`),
                '',
                t(idioma,
                    `Cuando alguien añada Sokyo a su servidor, que use \`/referidos canjear ${r.codigo}\` allí. Si a los ${referidos.DIAS_ESPERA} días el bot sigue y el servidor tiene ${referidos.MIEMBROS_MIN}+ miembros, ganas **${referidos.DIAS_PREMIUM} días de Premium**.`,
                    `When someone adds Sokyo to their server, have them use \`/referrals redeem ${r.codigo}\` there. If after ${referidos.DIAS_ESPERA} days the bot is still there and the server has ${referidos.MIEMBROS_MIN}+ members, you get **${referidos.DIAS_PREMIUM} days of Premium**.`),
                destino
                    ? t(idioma, `Los días van a **${destino.name}**.`, `The days go to **${destino.name}**.`)
                    : t(idioma, `⚠️ Aún no has elegido servidor: usa \`/referidos destino\` en el tuyo (si no, te damos ${referidos.ORO_EN_VEZ} de oro).`, `⚠️ You haven’t picked a server: use \`/referrals destination\` in yours (otherwise you get ${referidos.ORO_EN_VEZ} gold).`),
                '',
                t(idioma, `⏳ Esperando: ${r.pendientes} · ✅ Premiados: ${r.premiados} · ❌ Sin premio: ${r.anulados}`, `⏳ Waiting: ${r.pendientes} · ✅ Rewarded: ${r.premiados} · ❌ No reward: ${r.anulados}`),
            ].join('\n'));
        return interaction.reply({ embeds: [embed], flags: 64 });
    },
};

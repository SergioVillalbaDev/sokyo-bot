const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const bromas = require('../utils/bromas.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');
const { t } = require('../utils/i18n.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });
const conObjetivo = (s) => s.addUserOption((o) => o.setName('member').setNameLocalizations(ES('miembro')).setDescription('Who gets pranked').setDescriptionLocalizations(ES('A quién se la gastas')).setRequired(true));

// /broma apodo · payaso · reaccion · loro · escudo · precios · salir · volver
module.exports = {
    data: new SlashCommandBuilder()
        .setName('prank')
        .setDescription('Pranks paid with gold: nickname, clown, reactions or parrot')
        .setDescriptionLocalizations(ES('Bromas que se pagan con oro: apodo, payaso, reacciones o loro'))
        .setContexts(InteractionContextType.Guild)
        .addSubcommand((s) => conObjetivo(s.setName('nickname').setNameLocalizations(ES('apodo'))
            .setDescription('Change someone’s nickname for a while')
            .setDescriptionLocalizations(ES('Cámbiale el apodo a alguien durante un rato')))
            .addStringOption((o) => o.setName('text').setNameLocalizations(ES('texto')).setDescription('Their new nickname').setDescriptionLocalizations(ES('Su nuevo apodo')).setRequired(true).setMaxLength(32)))
        .addSubcommand((s) => conObjetivo(s.setName('clown').setNameLocalizations(ES('payaso'))
            .setDescription('Make someone the 🤡 Clown of the day')
            .setDescriptionLocalizations(ES('Hazle el 🤡 Payaso del día'))))
        .addSubcommand((s) => conObjetivo(s.setName('reaction').setNameLocalizations(ES('reaccion'))
            .setDescription('The bot reacts with an emoji to everything they write')
            .setDescriptionLocalizations(ES('El bot reacciona con un emoji a todo lo que escriba')))
            .addStringOption((o) => o.setName('emoji').setDescription('Which emoji (💩 if you don’t pick one)').setDescriptionLocalizations(ES('Qué emoji (💩 si no eliges)')).setMaxLength(8)))
        .addSubcommand((s) => conObjetivo(s.setName('parrot').setNameLocalizations(ES('loro'))
            .setDescription('A 🦜 parrot repeats their next 3 messages in mOcKiNg mode')
            .setDescriptionLocalizations(ES('Un 🦜 loro repite sus 3 próximos mensajes en mOdO bUrLa'))))
        .addSubcommand((s) => s.setName('shield').setNameLocalizations(ES('escudo'))
            .setDescription('Buy a shield against pranks')
            .setDescriptionLocalizations(ES('Cómprate un escudo contra las bromas')))
        .addSubcommand((s) => s.setName('prices').setNameLocalizations(ES('precios'))
            .setDescription('What each prank costs here')
            .setDescriptionLocalizations(ES('Lo que cuesta cada broma aquí')))
        .addSubcommand((s) => s.setName('optout').setNameLocalizations(ES('salir'))
            .setDescription('Don’t take part in pranks (you can’t make them either)')
            .setDescriptionLocalizations(ES('No jugar a las bromas (tampoco podrás gastarlas)')))
        .addSubcommand((s) => s.setName('rejoin').setNameLocalizations(ES('volver'))
            .setDescription('Play pranks again')
            .setDescriptionLocalizations(ES('Volver a jugar a las bromas'))),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        const sub = interaction.options.getSubcommand();
        const privado = (content) => interaction.reply({ content, flags: 64 });
        if (!cfg?.bromas?.activo) return privado(bromas.textoError('apagadas', idioma));

        if (sub === 'prices') {
            const lineas = bromas.TIPOS.filter((x) => cfg.bromas.tipos?.[x]?.activo).map((x) => `${bromas.INFO[x].emoji} **${t(idioma, bromas.INFO[x].es, bromas.INFO[x].en)}** · 🪙 ${bromas.precioDe(cfg, x)}`);
            lineas.push(`🛡️ **${t(idioma, `Escudo ${cfg.bromas.escudoHoras || 12} h`, `${cfg.bromas.escudoHoras || 12} h shield`)}** · 🪙 ${cfg.bromas.escudoPrecio ?? 400}`);
            const d = require('../utils/mascota.js').descuentoBromasServidor(interaction.guildId);
            return privado([t(idioma, `🃏 **Bromas** (duran ${bromas.duracionMin(cfg.bromas)} min)`, `🃏 **Pranks** (last ${bromas.duracionMin(cfg.bromas)} min)`), ...lineas, d ? t(idioma, `🐾 La mascota os hace un ${Math.round(d * 100)} % de descuento.`, `🐾 Your pet gives you ${Math.round(d * 100)}% off.`) : ''].filter(Boolean).join('\n'));
        }
        if (sub === 'shield') {
            const r = await bromas.comprarEscudo(interaction.guildId, interaction.user.id, cfg, idioma);
            if (r.error) return privado(`❌ ${r.error}`);
            return privado(t(idioma, `🛡️ Tienes escudo hasta <t:${Math.floor(r.hasta / 1000)}:t> (🪙 ${r.precio}). Te quedan 🪙 ${r.saldo}.`, `🛡️ You’re shielded until <t:${Math.floor(r.hasta / 1000)}:t> (🪙 ${r.precio}). You have 🪙 ${r.saldo} left.`));
        }
        if (sub === 'optout' || sub === 'rejoin') {
            const activa = await bromas.salir(interaction.guildId, interaction.user.id, sub === 'optout');
            if (activa) await bromas.finalizar(client, activa);
            return privado(sub === 'optout'
                ? t(idioma, '👋 Ya no juegas a las bromas: nadie podrá gastártelas (ni tú a los demás). Para volver: `/broma volver`.', '👋 You’re out of pranks: nobody can prank you (and you can’t prank others). To come back: `/prank rejoin`.')
                : t(idioma, '🃏 ¡Vuelves a jugar a las bromas!', '🃏 You’re back in the prank game!'));
        }
        const tipo = { nickname: 'apodo', clown: 'payaso', reaction: 'reaccion', parrot: 'loro' }[sub];
        const usuario = interaction.options.getUser('member');
        const objetivo = await interaction.guild.members.fetch(usuario.id).catch(() => null);
        if (!objetivo) return privado(t(idioma, 'Esa persona no está en el servidor.', 'That person isn’t on the server.'));
        await interaction.deferReply({ flags: 64 });
        const r = await bromas.gastar({
            client, guild: interaction.guild, cfg, autor: interaction.member, objetivo, tipo,
            texto: interaction.options.getString('text') || interaction.options.getString('emoji') || '',
            canal: interaction.channel, idioma,
        });
        if (r.error) return interaction.editReply(`❌ ${r.error}`);
        return interaction.editReply(t(idioma, `🃏 ¡Hecho! (🪙 ${r.coste}). Te quedan 🪙 ${r.saldo}.`, `🃏 Done! (🪙 ${r.coste}). You have 🪙 ${r.saldo} left.`));
    },
};

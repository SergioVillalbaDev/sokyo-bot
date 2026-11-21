const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const casino = require('../utils/casino.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');
const { t } = require('../utils/i18n.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });
const cantidad = (o) => o.setName('bet').setNameLocalizations(ES('apuesta')).setDescription('How much gold').setDescriptionLocalizations(ES('Cuánto oro')).setRequired(true).setMinValue(1).setMaxValue(10000000);

// /casino ayuda · tragaperras · ruleta · blackjack · crash · minas · moneda · duelo · carrera · diaria · bote · pausa
module.exports = {
    data: new SlashCommandBuilder()
        .setName('casino')
        .setDescription('Gold casino: slots, roulette, blackjack, crash, mines, duels and races')
        .setDescriptionLocalizations(ES('Casino de oro: tragaperras, ruleta, blackjack, crash, minas, duelos y carreras'))
        .setContexts(InteractionContextType.Guild)
        .addSubcommand((s) => s.setName('slots').setNameLocalizations(ES('tragaperras')).setDescription('🎰 Spin the slots (💎💎💎 wins the jackpot)').setDescriptionLocalizations(ES('🎰 Tira de la tragaperras (💎💎💎 se lleva el bote)')).addIntegerOption(cantidad))
        .addSubcommand((s) => s.setName('roulette').setNameLocalizations(ES('ruleta')).setDescription('🎡 European roulette').setDescriptionLocalizations(ES('🎡 Ruleta europea'))
            .addStringOption((o) => o.setName('on').setNameLocalizations(ES('a')).setDescription('What you bet on').setDescriptionLocalizations(ES('A qué apuestas')).setRequired(true).addChoices(
                { name: '🔴 Red (×2)', name_localizations: ES('🔴 Rojo (×2)'), value: 'rojo' }, { name: '⚫ Black (×2)', name_localizations: ES('⚫ Negro (×2)'), value: 'negro' },
                { name: 'Even (×2)', name_localizations: ES('Par (×2)'), value: 'par' }, { name: 'Odd (×2)', name_localizations: ES('Impar (×2)'), value: 'impar' },
                { name: '1-18 (×2)', value: 'bajo' }, { name: '19-36 (×2)', value: 'alto' },
                { name: '1st dozen 1-12 (×3)', name_localizations: ES('1.ª docena 1-12 (×3)'), value: 'docena1' }, { name: '2nd dozen 13-24 (×3)', name_localizations: ES('2.ª docena 13-24 (×3)'), value: 'docena2' },
                { name: '3rd dozen 25-36 (×3)', name_localizations: ES('3.ª docena 25-36 (×3)'), value: 'docena3' }, { name: 'One number (×36)', name_localizations: ES('Un número (×36)'), value: 'numero' }))
            .addIntegerOption(cantidad)
            .addIntegerOption((o) => o.setName('number').setNameLocalizations(ES('numero')).setDescription('If you bet on a number (0-36)').setDescriptionLocalizations(ES('Si apuestas a un número (0-36)')).setMinValue(0).setMaxValue(36)))
        .addSubcommand((s) => s.setName('blackjack').setDescription('🃏 Blackjack against the dealer').setDescriptionLocalizations(ES('🃏 Blackjack contra la banca')).addIntegerOption(cantidad))
        .addSubcommand((s) => s.setName('crash').setDescription('🚀 Cash out before the rocket blows up').setDescriptionLocalizations(ES('🚀 Retírate antes de que explote el cohete')).addIntegerOption(cantidad)
            .addNumberOption((o) => o.setName('auto').setDescription('Automatic cash-out at this multiplier (e.g. 2)').setDescriptionLocalizations(ES('Retirarte solo en este multiplicador (p. ej. 2)')).setMinValue(1.01).setMaxValue(100)))
        .addSubcommand((s) => s.setName('mines').setNameLocalizations(ES('minas')).setDescription('💣 Find the gems, avoid the mines').setDescriptionLocalizations(ES('💣 Encuentra las gemas sin pisar una mina')).addIntegerOption(cantidad)
            .addIntegerOption((o) => o.setName('mines').setNameLocalizations(ES('minas')).setDescription('How many mines (1-10, more = higher prize)').setDescriptionLocalizations(ES('Cuántas minas (1-10, más = más premio)')).setMinValue(1).setMaxValue(10)))
        .addSubcommand((s) => s.setName('coinflip').setNameLocalizations(ES('moneda')).setDescription('🪙 Heads or tails (×1.94)').setDescriptionLocalizations(ES('🪙 Cara o cruz (×1,94)'))
            .addStringOption((o) => o.setName('side').setNameLocalizations(ES('lado')).setDescription('Heads or tails').setDescriptionLocalizations(ES('Cara o cruz')).setRequired(true)
                .addChoices({ name: '👑 Heads', name_localizations: ES('👑 Cara'), value: 'cara' }, { name: '⭐ Tails', name_localizations: ES('⭐ Cruz'), value: 'cruz' }))
            .addIntegerOption(cantidad))
        .addSubcommand((s) => s.setName('duel').setNameLocalizations(ES('duelo')).setDescription('⚔️ Challenge someone to a coin flip for gold').setDescriptionLocalizations(ES('⚔️ Reta a alguien a cara o cruz por oro'))
            .addUserOption((o) => o.setName('rival').setDescription('Who').setDescriptionLocalizations(ES('A quién')).setRequired(true)).addIntegerOption(cantidad))
        .addSubcommand((s) => s.setName('race').setNameLocalizations(ES('carrera')).setDescription('🏇 Start a race: everyone in the channel can bet').setDescriptionLocalizations(ES('🏇 Empieza una carrera: todo el canal puede apostar')))
        .addSubcommand((s) => s.setName('daily').setNameLocalizations(ES('diaria')).setDescription('🎁 Your free slots spin of the day').setDescriptionLocalizations(ES('🎁 Tu tirada gratis del día en la tragaperras')))
        .addSubcommand((s) => s.setName('help').setNameLocalizations(ES('ayuda')).setDescription('📖 How to play each game (with a button to try it)').setDescriptionLocalizations(ES('📖 Cómo se juega a cada juego (con un botón para probarlo)')))
        .addSubcommand((s) => s.setName('jackpot').setNameLocalizations(ES('bote')).setDescription('💎 The jackpot, the biggest winners and your stats').setDescriptionLocalizations(ES('💎 El bote, los que más ganan y tus números')))
        .addSubcommand((s) => s.setName('pause').setNameLocalizations(ES('pausa')).setDescription('🧘 Take a break from the casino (can’t be undone early)').setDescriptionLocalizations(ES('🧘 Tómate un descanso del casino (no se puede quitar antes)'))
            .addIntegerOption((o) => o.setName('days').setNameLocalizations(ES('dias')).setDescription('How many days').setDescriptionLocalizations(ES('Cuántos días')).setRequired(true)
                .addChoices({ name: '1', value: 1 }, { name: '3', value: 3 }, { name: '7', value: 7 }, { name: '30', value: 30 }))),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        const sub = interaction.options.getSubcommand();
        const privado = (content) => interaction.reply({ content, flags: 64 });
        if (sub === 'help') return interaction.reply({ ...require('../utils/casinoAyuda.js').guiaGeneral(idioma, cfg), flags: 64 });
        if (sub === 'pause') {
            const hasta = await casino.pausa(interaction.guildId, interaction.user.id, interaction.options.getInteger('days'));
            return privado(t(idioma, `🧘 Hecho. No podrás jugar en el casino hasta <t:${Math.floor(hasta / 1000)}:F>. Cuídate 💛`, `🧘 Done. You can’t play at the casino until <t:${Math.floor(hasta / 1000)}:F>. Take care 💛`));
        }
        if (!cfg?.casino?.activo) return privado(casino.textoFallo({ fallo: 'apagado' }, idioma));
        if (sub === 'jackpot') return interaction.reply({ embeds: [await casino.embedBote(interaction.guild, idioma, interaction.user.id)], allowedMentions: { parse: [] } });
        await interaction.deferReply();
        const base = { interaction, client, cfg, idioma, cantidad: interaction.options.getInteger('bet') };
        let r;
        if (sub === 'slots') r = await casino.tragaperras(base);
        else if (sub === 'roulette') r = await casino.ruleta({ ...base, apuesta: interaction.options.getString('on'), numero: interaction.options.getInteger('number') });
        else if (sub === 'blackjack') r = await casino.blackjack(base);
        else if (sub === 'crash') r = await casino.crash({ ...base, auto: interaction.options.getNumber('auto') });
        else if (sub === 'mines') r = await casino.minas({ ...base, numMinas: interaction.options.getInteger('mines') || 3 });
        else if (sub === 'coinflip') r = await casino.moneda({ ...base, lado: interaction.options.getString('side') });
        else if (sub === 'duel') r = await casino.duelo({ ...base, rival: interaction.options.getUser('rival') });
        else if (sub === 'race') r = await casino.carrera(base);
        else if (sub === 'daily') r = await casino.diaria(base);
        if (r?.error) {
            await interaction.deleteReply().catch(() => {});
            return interaction.followUp({ content: `❌ ${r.error}`, flags: 64 });
        }
        return undefined;
    },
};

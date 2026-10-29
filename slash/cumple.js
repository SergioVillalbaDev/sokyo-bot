const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { guardarCumple, borrarCumple, cumpleDe, proximos, textoFecha } = require('../utils/cumpleanos.js');
const { idiomaInteraccion } = require('../utils/preferencias.js');
const { t } = require('../utils/i18n.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });
const MESES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MESES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// /cumple guardar · borrar · lista. El día vale en todos los servidores con Sokyo
// (también se cambia en «Mi cuenta»).
module.exports = {
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setNameLocalizations(ES('cumple'))
        .setDescription('Your birthday: the server congratulates you on your day')
        .setDescriptionLocalizations(ES('Tu cumpleaños: el servidor te felicita ese día'))
        .addSubcommand((s) => s.setName('set').setNameLocalizations(ES('guardar'))
            .setDescription('Save your birthday (only the day and month)')
            .setDescriptionLocalizations(ES('Guarda tu cumpleaños (solo el día y el mes)'))
            .addIntegerOption((o) => o.setName('day').setNameLocalizations(ES('dia')).setDescription('Day').setDescriptionLocalizations(ES('Día')).setRequired(true).setMinValue(1).setMaxValue(31))
            .addIntegerOption((o) => o.setName('month').setNameLocalizations(ES('mes')).setDescription('Month').setDescriptionLocalizations(ES('Mes')).setRequired(true)
                .addChoices(...MESES_EN.map((m, i) => ({ name: m, name_localizations: ES(MESES_ES[i]), value: i + 1 })))))
        .addSubcommand((s) => s.setName('remove').setNameLocalizations(ES('borrar'))
            .setDescription('Delete your birthday')
            .setDescriptionLocalizations(ES('Borra tu cumpleaños')))
        .addSubcommand((s) => s.setName('list').setNameLocalizations(ES('lista'))
            .setDescription('Upcoming birthdays on this server')
            .setDescriptionLocalizations(ES('Los próximos cumpleaños del servidor'))),

    async execute(interaction, client, cfg) {
        const idioma = await idiomaInteraccion(interaction, cfg);
        const sub = interaction.options.getSubcommand();

        if (sub === 'set') {
            const r = await guardarCumple(interaction.user.id, interaction.options.getInteger('day'), interaction.options.getInteger('month'));
            if (!r.ok) return interaction.reply({ content: t(idioma, '❌ Esa fecha no existe. Revisa el día y el mes.', '❌ That date doesn’t exist. Check the day and month.'), flags: 64 });
            const aviso = interaction.guildId && !cfg?.cumpleanos?.activo
                ? t(idioma, '\n-# Este servidor aún no tiene las felicitaciones activadas; los que sí, te felicitarán.', '\n-# This server hasn’t turned on birthday wishes yet; the ones that have will congratulate you.')
                : '';
            return interaction.reply({ content: t(idioma, `🎂 ¡Apuntado! Tu cumpleaños es el **${textoFecha(r.dia, r.mes, 'es')}**. Vale en todos los servidores con Sokyo.${aviso}`, `🎂 Saved! Your birthday is **${textoFecha(r.dia, r.mes, 'en')}**. It works on every server with Sokyo.${aviso}`), flags: 64 });
        }

        if (sub === 'remove') {
            const antes = await cumpleDe(interaction.user.id);
            await borrarCumple(interaction.user.id);
            return interaction.reply({ content: antes ? t(idioma, '🗑️ He borrado tu cumpleaños.', '🗑️ I deleted your birthday.') : t(idioma, 'No tenías ningún cumpleaños guardado.', 'You didn’t have a birthday saved.'), flags: 64 });
        }

        // lista
        if (!interaction.guild) return interaction.reply({ content: t(idioma, 'Esto solo funciona en un servidor.', 'This only works on a server.'), flags: 64 });
        await interaction.deferReply({ flags: 64 });
        const lista = await proximos(interaction.guild, 10);
        const mio = await cumpleDe(interaction.user.id);
        const lineas = lista.map((c) => {
            const cuando = c.faltan === 0 ? t(idioma, '🎉 **¡hoy!**', '🎉 **today!**') : c.faltan === 1 ? t(idioma, 'mañana', 'tomorrow') : t(idioma, `en ${c.faltan} días`, `in ${c.faltan} days`);
            return `🎂 **${c.member.displayName}** — ${textoFecha(c.dia, c.mes, idioma)} · ${cuando}`;
        });
        const embed = new EmbedBuilder()
            .setColor('#f472b6')
            .setTitle(t(idioma, '🎂 Próximos cumpleaños', '🎂 Upcoming birthdays'))
            .setDescription(lineas.length ? lineas.join('\n') : t(idioma, 'Nadie ha guardado su cumpleaños todavía. ¡Sé el primero con `/cumple guardar`!', 'Nobody has saved their birthday yet. Be the first with `/birthday set`!'))
            .setFooter({ text: mio ? t(idioma, `El tuyo: ${textoFecha(mio.dia, mio.mes, 'es')}`, `Yours: ${textoFecha(mio.dia, mio.mes, 'en')}`) : t(idioma, 'Guarda el tuyo con /cumple guardar', 'Save yours with /birthday set') });
        return interaction.editReply({ embeds: [embed] });
    },
};

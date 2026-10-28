const { SlashCommandBuilder } = require('discord.js');
const { mensajeCola } = require('../utils/musicaExtra.js');
const { t } = require('../utils/i18n.js');

const ES = (v) => ({ 'es-ES': v, 'es-419': v });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setNameLocalizations(ES('cola'))
        .setDescription('Show what’s coming up, page by page')
        .setDescriptionLocalizations(ES('Ver lo que va a sonar, por páginas')),

    async execute(interaction, client, cfg) {
        const player = client.lavalink.getPlayer(interaction.guildId);
        if (!player || !player.queue.current) {
            return interaction.reply({ content: t(cfg, '📭 La cola está vacía y no hay nada sonando. Pon algo con `/play`.', '📭 The queue is empty and nothing is playing. Play something with `/play`.'), flags: 64 });
        }
        return interaction.reply(mensajeCola(player, 0, cfg));
    },
};

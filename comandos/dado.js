const { SlashCommandBuilder } = require('discord.js');

const RESPUESTAS = {
    1: '🎲 Has sacado un 1, por el culo te vacuno',
    2: '🎲 Has sacado un 2, me la agarras de a dos',
    3: '🎲 Has sacado un 3, me la agarras del reves',
    4: '🎲 Has sacado un 4, en tu culo mi aparato',
    5: '🎲 Has sacado un 5, por el culo te la hinco',
    6: '🎲 Has sacado un 6, si os agachais me la veis'
};

module.exports = {
    data: new SlashCommandBuilder().setName('dado').setDescription('Tira un dado de 6 caras con rima incluida'),
    async execute(interaction) {
        const resultado = Math.floor(Math.random() * 6) + 1;
        await interaction.reply(RESPUESTAS[resultado]);
    }
};

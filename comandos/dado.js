const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dado')
        .setDescription('Tira un dado de 6 caras con rima incluida'),
    async execute(interaction) {
        const resultado = Math.floor(Math.random() * 6) + 1;

        switch (resultado) {
            case 6:
                await interaction.reply('🎲 Has sacado un 6, si os agachais me la veis');
                break;
            case 1:
                await interaction.reply('🎲 Has sacado un 1, por el culo te vacuno');
                break;
            case 2:
                await interaction.reply('🎲 Has sacado un 2, me la agarras de a dos');
                break;
            case 3:
                await interaction.reply('🎲 Has sacado un 3, me la agarras del reves');
                break;
            case 4:
                await interaction.reply('🎲 Has sacado un 4, en tu culo mi aparato');
                break;
            case 5:
                await interaction.reply('🎲 Has sacado un 5, por el culo te la hinco');
                break;
        } 
    }
};
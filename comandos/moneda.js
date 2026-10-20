const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('moneda')
        .setDescription('Juega a cara o cruz'),

    async execute(interaction) {
        const resultado = Math.random() < 0.5 ? 'Cara 🪙' : 'Cruz 🦅';
        await interaction.reply(`La moneda está en el aire... ¡Ha salido **${resultado}**!`);
    }
};

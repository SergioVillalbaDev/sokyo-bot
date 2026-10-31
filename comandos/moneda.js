const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('moneda')
        .setDescription('Juega a cara o cruz'),
    async execute(interaction) {
        const opciones = ['Cara 🪙', 'Cruz 🦅'];
        const eleccion = Math.floor(Math.random() * 2); 
        await interaction.reply(`La moneda está en el aire... ¡Ha salido **${opciones[eleccion]}**!`);
    }
};
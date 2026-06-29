module.exports = {
    name: 'dice',
    description: 'Roll a 6-sided die',
    async execute(message, args, client) {
        const resultado = Math.floor(Math.random() * 6) + 1;
        await message.reply(`🎲 You rolled a **${resultado}**!`);
    }
};
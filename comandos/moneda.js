module.exports = {
    name: 'coin',
    description: 'Flip a coin (heads or tails)',
    async execute(message, args, client) {
        const opciones = ['Heads 🪙', 'Tails 🦅'];
        const eleccion = Math.floor(Math.random() * 2);
        await message.reply(`The coin is in the air... it landed on **${opciones[eleccion]}**!`);
    }
};
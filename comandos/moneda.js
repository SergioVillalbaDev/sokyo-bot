module.exports = {
    name: 'moneda',
    description: 'Juega a cara o cruz',
    async execute(message, args, client) {
        const opciones = ['Cara 🪙', 'Cruz 🦅'];
        const eleccion = Math.floor(Math.random() * 2); 
        await message.reply(`La moneda está en el aire... ¡Ha salido **${opciones[eleccion]}**!`);
    }
};
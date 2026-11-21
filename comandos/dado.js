const RIMAS = {
    1: '¡Un 1! Ni para empezar el juego.',
    2: '¡Un 2! Mejor suerte para las tres.',
    3: '¡Un 3! A la tercera va la vencida.',
    4: '¡Un 4! Cuatro y a por más.',
    5: '¡Un 5! Casi, casi, casi...',
    6: '¡Un 6! ¡Máxima puntuación, nadie te gana hoy!'
};

module.exports = {
    name: 'dado',
    description: 'Tira un dado de 6 caras',
    async execute(message) {
        const resultado = Math.floor(Math.random() * 6) + 1;
        await message.reply(`🎲 ${RIMAS[resultado]}`);
    }
};

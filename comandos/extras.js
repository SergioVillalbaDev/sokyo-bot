module.exports = {
    
    // Función para tirar un dado
    tirarDado: async (message) => {
        const resultado = Math.floor(Math.random() * 6) + 1;

        switch (resultado) {
            case 6:
                await message.reply('🎲 Has sacado un 6, si os agachais me la veis');
                break;
            case 1:
                await message.reply('🎲 Has sacado un 1, por el culo te vacuno');
                break;
            case 2:
                await message.reply('🎲 Has sacado un 2, me la agarras de a dos');
                break;
            case 3:
                await message.reply('🎲 Has sacado un 3, me la agarras del reves');
                break;
            case 4:
                await message.reply('🎲 Has sacado un 4, en tu culo mi aparato');
                break;
            case 5:
                await message.reply('🎲 Has sacado un 5, por el culo te la hinco');
                break;
        } 
    }, 

    // Función para jugar a cara o cruz
    caraCruz: async (message) => {
        const opciones = ['Cara 🪙', 'Cruz 🦅'];
        const eleccion = Math.floor(Math.random() * 2); 
        await message.reply(`La moneda está en el aire... ¡Ha salido **${opciones[eleccion]}**!`);
    }
};
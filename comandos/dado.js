module.exports = {
    name: 'dado',
    description: 'Tira un dado de 6 caras con rima incluida',
    async execute(message, args, client) {
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
    }
};
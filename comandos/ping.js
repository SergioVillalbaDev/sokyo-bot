
module.exports = {

    name: 'ping',
    description: 'hace ping al bot',

    async execute(message, args, client){

        const ping = client.ws.ping
        message.reply(`Actualmente tengo una latencia de ${ping}! ms`);

    }

}

module.exports = {

    name: 'ping',
    description: 'Pings the bot',

    async execute(message, args, client){

        const ping = client.ws.ping
        message.reply(`My current latency is ${ping} ms!`);

    }

}
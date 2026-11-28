// El usuario mencionado en un comando con prefijo (!ban @alguien…): el PRIMERO que se escribe en el texto.
// `message.mentions.users.first()` no vale: si el comando se escribe respondiendo (con ping) a otro mensaje, Discord
// mete también a esa persona en las menciones, y el orden no es el del texto (2.5.1: «!ban @A» respondiendo a B
// podía ir contra B). Sin mención escrita, null.
function primeraMencion(message) {
    const id = (/<@!?(\d{15,21})>/.exec(String(message?.content || '')) || [])[1];
    if (!id) return null;
    return message.mentions?.users?.get(id) || message.client?.users?.cache?.get(id) || null;
}

module.exports = { primeraMencion };

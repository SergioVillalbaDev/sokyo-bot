require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,        // Necesario para logs de entradas/salidas (intent privilegiado)
        GatewayIntentBits.GuildMessageReactions, // Necesario para los roles por reacción
        GatewayIntentBits.GuildVoiceStates,    // Necesario para registrar la actividad de voz
        GatewayIntentBits.GuildInvites,        // Crecimiento: saber con qué invitación entra cada miembro
        GatewayIntentBits.MessageContent
    ],
    // Partials: permite reaccionar/editar/borrar también en mensajes que no están en caché,
    // y registrar la salida de miembros que no estaban en caché (GuildMember)
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember]
});

// 1. Cargador de Comandos
client.commands = new Collection();
const comandosPath = path.join(__dirname, 'comandos');
const commandFiles = fs.readdirSync(comandosPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(comandosPath, file);
    const command = require(filePath);
    if ('name' in command && 'execute' in command) {
        client.commands.set(command.name, command);
        console.log(`✅ Comando cargado: ${command.name}`);
    } else {
        console.log(`⚠️ Falta el 'name' o 'execute' en el comando ${file}`);
    }
}

// 1.b Cargador de Slash Commands
client.slashCommands = new Collection();
const slashPath = path.join(__dirname, 'slash');
for (const file of fs.readdirSync(slashPath).filter(f => f.endsWith('.js'))) {
    const cmd = require(path.join(slashPath, file));
    if (cmd.data && cmd.execute) {
        client.slashCommands.set(cmd.data.name, cmd);
        console.log(`⚡ Slash cargado: /${cmd.data.name}`);
    }
}

// 2. Cargador de Eventos
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    // Un error en un evento no debe tumbar el bot: lo registramos y seguimos.
    const ejecutar = async (...args) => {
        try {
            await event.execute(...args, client);
        } catch (error) {
            console.error(`❌ Error en el evento ${event.name} (${file}):`, error);
        }
    };
    if (event.once) {
        client.once(event.name, ejecutar);
    } else {
        client.on(event.name, ejecutar);
    }
}

// Errores sueltos (promesas sin catch, errores del gateway): se registran en vez
// de cerrar el proceso, así pm2 no entra en bucle de reinicios por un fallo puntual.
process.on('unhandledRejection', (error) => console.error('❌ Promesa rechazada sin capturar:', error));
client.on('error', (error) => console.error('❌ Error del cliente de Discord:', error));

// 2.b Motor de música (Lavalink)
const { initMusica } = require('./utils/musica.js');
initMusica(client);

// 3. Arrancamos la API pasándole el cliente de Discord
require('./api/server.js')(client);

// 4. Conexión a Base de Datos y Login
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('🟢 Conectado a MongoDB'))
    .catch(err => console.error('🔴 Error de MongoDB:', err));

client.login(process.env.DISCORD_TOKEN);
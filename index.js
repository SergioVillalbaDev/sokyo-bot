require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,   // Necesario para logs de entradas/salidas (intent privilegiado)
        GatewayIntentBits.MessageContent
    ],
    // Permite que los eventos de editar/borrar se disparen también con mensajes que no están en caché
    partials: [Partials.Message, Partials.Channel]
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

// 2. Cargador de Eventos
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// 3. Arrancamos la API pasándole el cliente de Discord
require('./api/server.js')(client);

// 4. Conexión a Base de Datos y Login
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('🟢 Conectado a MongoDB'))
    .catch(err => console.error('🔴 Error de MongoDB:', err));

client.login(process.env.DISCORD_TOKEN);
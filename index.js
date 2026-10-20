require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Client, GatewayIntentBits, Collection, Partials, Events } = require('discord.js');

// 0. Variables obligatorias: si faltan, avisamos claramente en vez de fallar a medias
const faltan = ['DISCORD_TOKEN', 'MONGO_URI'].filter(nombre => !process.env[nombre]);
if (faltan.length > 0) {
    console.error(`🔴 Faltan variables en el .env: ${faltan.join(', ')}. Copia .env.example a .env y rellénalas.`);
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,   // Entradas/salidas y comprobación de staff (intent privilegiado)
        GatewayIntentBits.MessageContent  // Guardar la conversación de los tickets (intent privilegiado)
    ],
    // Permite que los eventos se disparen también con mensajes/miembros que no están en caché
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

// 1. Cargador de comandos (slash commands)
client.commands = new Collection();
const comandosPath = path.join(__dirname, 'comandos');
for (const file of fs.readdirSync(comandosPath).filter(f => f.endsWith('.js'))) {
    const command = require(path.join(comandosPath, file));
    if (command.data && typeof command.execute === 'function') {
        client.commands.set(command.data.name, command);
    } else {
        console.warn(`⚠️ El comando ${file} no exporta 'data' y 'execute'; se ignora.`);
    }
}
console.log(`✅ ${client.commands.size} comandos cargados: ${[...client.commands.keys()].map(n => `/${n}`).join(', ')}`);

// 2. Cargador de eventos. Cada handler va envuelto para que un error no tumbe el proceso.
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
    const event = require(path.join(eventsPath, file));
    const ejecutar = async (...args) => {
        try {
            await event.execute(...args, client);
        } catch (error) {
            console.error(`❌ Error en el evento ${event.name}:`, error);
        }
    };
    if (event.once) client.once(event.name, ejecutar);
    else client.on(event.name, ejecutar);
}

client.on(Events.Error, (error) => console.error('❌ Error del cliente de Discord:', error));
process.on('unhandledRejection', (error) => console.error('❌ Promesa rechazada sin capturar:', error));

// 3. Arranque: base de datos -> API -> Discord
let servidorApi = null;
async function arrancar() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🟢 Conectado a MongoDB');
    servidorApi = require('./api/server.js')(client);
    await client.login(process.env.DISCORD_TOKEN);
}

arrancar().catch((error) => {
    console.error('🔴 No se pudo arrancar el bot:', error.message || error);
    process.exit(1);
});

// 4. Apagado limpio (Ctrl+C, systemd, pm2...)
let apagando = false;
async function apagar(senal) {
    if (apagando) return;
    apagando = true;
    console.log(`👋 ${senal} recibido: apagando Sokyo...`);
    try {
        servidorApi?.close();
        await client.destroy();
        await mongoose.disconnect();
    } finally {
        process.exit(0);
    }
}
process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));

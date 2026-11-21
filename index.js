require('dotenv').config();

// Fail-fast: sin claves seguras el bot no arranca (antes la API quedaba abierta si faltaba API_KEY).
const { validarEntorno } = require('./utils/entorno.js');
const erroresEntorno = validarEntorno();
if (erroresEntorno.length) {
    console.error('🔴 Configuración del .env no válida:\n - ' + erroresEntorno.join('\n - '));
    console.error('Genera claves con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    process.exit(1);
}

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

// Un error suelto (p. ej. una promesa rechazada) no debe tumbar el bot en silencio.
client.on('error', (error) => console.error('Error del cliente de Discord:', error));
process.on('unhandledRejection', (motivo) => console.error('Promesa rechazada sin capturar:', motivo));
process.on('uncaughtException', (error) => { console.error('Excepción sin capturar:', error); process.exit(1); });

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
const servidorApi = require('./api/server.js')(client);

// 4. Conexión a Base de Datos y Login (sin base de datos el bot no sirve: salimos para que el gestor de procesos lo reinicie)
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('🟢 Conectado a MongoDB');
        return client.login(process.env.DISCORD_TOKEN);
    })
    .catch(err => { console.error('🔴 Error al iniciar (MongoDB/Discord):', err.message); process.exit(1); });

// 5. Apagado ordenado
let cerrando = false;
async function apagar(senal) {
    if (cerrando) return;
    cerrando = true;
    console.log(`\n${senal} recibido: cerrando...`);
    servidorApi.close();
    await client.destroy();
    await mongoose.disconnect();
    process.exit(0);
}
process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
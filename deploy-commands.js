require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const commands = [];
const dir = path.join(__dirname, 'slash');
for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
    const cmd = require(path.join(dir, file));
    if (cmd.data) commands.push(cmd.data.toJSON());
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Modo de registro según el argumento:
//   node deploy-commands.js        -> GLOBAL: aparecen en TODOS los servidores donde
//                                     está el bot (la 1ª vez tardan hasta ~1h en salir).
//   node deploy-commands.js dev    -> SOLO en el servidor de pruebas (GUILD_ID),
//                                     aparecen al instante. Ideal para desarrollar.
//   node deploy-commands.js clear-dev -> BORRA todos los comandos guild-scoped de
//                                     GUILD_ID (deja solo los globales). Úsalo si ves
//                                     comandos duplicados/viejos (p. ej. en español)
//                                     en el servidor de pruebas.
const modoDev = process.argv[2] === 'dev';
const modoClearDev = process.argv[2] === 'clear-dev';

(async () => {
    try {
        if (modoClearDev) {
            if (!process.env.GUILD_ID) throw new Error('Falta GUILD_ID en el .env para clear-dev.');
            console.log('Borrando todos los comandos guild-scoped del servidor de pruebas...');
            await rest.put(
                Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.GUILD_ID),
                { body: [] },
            );
            console.log('✅ Comandos guild-scoped borrados. Solo quedan los globales.');
        } else if (modoDev) {
            if (!process.env.GUILD_ID) throw new Error('Falta GUILD_ID en el .env para el modo dev.');
            console.log(`Registrando ${commands.length} slash commands en el servidor de pruebas...`);
            await rest.put(
                Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.GUILD_ID),
                { body: commands },
            );
            console.log('✅ Comandos registrados en el servidor de pruebas (instantáneo).');
        } else {
            console.log(`Registrando ${commands.length} slash commands GLOBALMENTE (todos los servidores)...`);
            await rest.put(
                Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
                { body: commands },
            );
            console.log('✅ Comandos registrados globalmente. Pueden tardar hasta ~1h en aparecer en todos los servidores.');
        }
    } catch (e) {
        console.error(e);
    }
})();

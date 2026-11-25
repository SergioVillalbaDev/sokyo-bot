require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

// 1.34.0: globales solo los que valen también por privado (utils/catalogo.js → GLOBALES). Los demás los registra el
// bot en cada servidor según lo que tenga activo (utils/comandosServidor.js). El modo dev registra en GUILD_ID todos.
const CS = require('./utils/comandosServidor.js');
const commands = CS.comandosGlobales();
const todosServidor = () => CS.comandosPara(new Proxy({}, { get: () => ({ activo: true }) }));
void fs; void path;

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
                { body: todosServidor() },
            );
            console.log('✅ Comandos registrados en el servidor de pruebas (instantáneo).');
        } else {
            // El botón de la Actividad (Entry Point, tipo 4) lo crea Discord al activar las Actividades: se conserva.
            const actuales = await rest.get(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID)).catch(() => []);
            const entrada = (actuales || []).filter((c) => c.type === 4).map(({ id, application_id, version, ...c }) => c);
            console.log(`Registrando ${commands.length} slash commands GLOBALMENTE (+${entrada.length} de la Actividad)...`);
            await rest.put(
                Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
                { body: [...commands, ...entrada] },
            );
            console.log('✅ Comandos registrados globalmente. Pueden tardar hasta ~1h en aparecer en todos los servidores.');
        }
    } catch (e) {
        console.error(e);
        process.exitCode = 1; // el despliegue automático lo usa para saber si ha fallado
    }
})();

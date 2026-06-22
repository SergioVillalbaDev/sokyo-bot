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

(async () => {
    try {
        console.log(`Registrando ${commands.length} slash commands...`);
        // Por GUILD = aparecen al instante (ideal para probar). Necesitas GUILD_ID en el .env.
        // Para todos los servidores usa Routes.applicationCommands(CLIENT_ID) (tarda hasta 1h).
        await rest.put(
            Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );
        console.log('✅ Comandos registrados.');
    } catch (e) {
        console.error(e);
    }
})();

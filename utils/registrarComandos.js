// Registra los comandos "/" en un servidor (al instante, sin esperar a la propagación global).
async function registrarComandos(client, guild) {
    try {
        await guild.commands.set(client.commands.map(c => c.data.toJSON()));
        console.log(`📡 Comandos / registrados en ${guild.name}`);
    } catch (error) {
        console.error(`Error registrando comandos en ${guild.name}:`, error.message);
    }
}
module.exports = { registrarComandos };

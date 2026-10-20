const { Events, MessageFlags } = require('discord.js');
const { buscarManejador } = require('../interacciones/tickets.js');

// Mensaje claro para el usuario según el tipo de error.
function mensajeDeError(error) {
    if (error?.name === 'TicketError') return `❌ ${error.message}`;
    if (error?.code === 50013) return '❌ Me faltan permisos para hacer eso. Pide a un administrador que revise mis permisos (Gestionar canales y Gestionar roles).';
    if (error?.code === 50001) return '❌ No tengo acceso a ese canal.';
    return '❌ Ha ocurrido un error inesperado. Inténtalo de nuevo en unos segundos.';
}

async function responderError(interaction, error) {
    if (!interaction.isRepliable()) return;
    const respuesta = { content: mensajeDeError(error), components: [], embeds: [] };
    try {
        if (interaction.deferred || interaction.replied) await interaction.editReply(respuesta);
        else await interaction.reply({ ...respuesta, flags: MessageFlags.Ephemeral });
    } catch {
        // La interacción caducó o ya no existe: nada más que hacer.
    }
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (interaction.isAutocomplete()) {
            const comando = client.commands.get(interaction.commandName);
            await comando?.autocomplete?.(interaction).catch(() => {});
            return;
        }
        try {
            if (interaction.isChatInputCommand()) {
                const comando = client.commands.get(interaction.commandName);
                if (comando) await comando.execute(interaction, client);
                return;
            }
            if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
                const manejador = buscarManejador(interaction.customId);
                if (manejador) await manejador(interaction, client);
            }
        } catch (error) {
            if (error?.name !== 'TicketError') {
                console.error(`❌ Error en la interacción "${interaction.customId || interaction.commandName}":`, error);
            }
            await responderError(interaction, error);
        }
    }
};

// Botones, menús y ventanas de las funciones de la 1.9.0: buscar grupo, confesiones,
// solicitudes, la ayuda antes de abrir un ticket y los tickets por privado.
// manejar() devuelve true si la interacción era suya.
async function manejar(interaction, client) {
    const id = interaction.customId || '';
    if (!id) return false;
    try {
        if (interaction.isButton() && /^grp_(unir|salir|cerrar):/.test(id)) {
            await require('./grupos.js').manejarBoton(interaction, client);
            return true;
        }
        if (interaction.isButton() && /^conf_(ok|no):/.test(id)) {
            await require('./confesiones.js').manejarBoton(interaction, client);
            return true;
        }
        if ((interaction.isButton() || interaction.isModalSubmit()) && /^sol_(abrir|modal|ok|no|nomodal):/.test(id)) {
            await require('./solicitudes.js').manejarBoton(interaction, client);
            return true;
        }
        if (interaction.isButton() && /^tkayuda_(si|no):/.test(id)) {
            await manejarAyudaPrevia(interaction, client);
            return true;
        }
        if ((interaction.isButton() && (id.startsWith('tkpriv_abrir:') || id === 'tkpriv_cancelar')) || (interaction.isStringSelectMenu() && id === 'tkpriv_srv')) {
            await require('./ticketsPrivado.js').manejarInteraccion(interaction, client);
            return true;
        }
    } catch (e) {
        console.error(`Interacción ${id}:`, e);
        const { respuestaError } = require('./erroresDiscord.js');
        const msg = respuestaError(e, interaction.locale?.startsWith('es') ? 'es' : 'en');
        (interaction.replied || interaction.deferred ? interaction.followUp(msg) : interaction.reply(msg)).catch(() => {});
        return true;
    }
    return false;
}

// «¿Esto resuelve tu duda?» → Sí (no se abre) o No (se abre el ticket como siempre).
async function manejarAyudaPrevia(interaction, client) {
    const ayuda = require('./ayudaPrevia.js');
    const { t } = require('./i18n.js');
    const { getConfigCached } = require('./config.js');
    const cfg = await getConfigCached(interaction.guildId).catch(() => null);
    const [accion, clave] = interaction.customId.split(':');
    const datos = ayuda.tomarPendiente(clave, interaction.user.id);
    if (!datos) {
        return interaction.update({ content: t(cfg, '⌛ Esto ha caducado. Si aún lo necesitas, vuelve a pulsar «Abrir ticket».', '⌛ This has expired. If you still need it, press “Open a ticket” again.'), embeds: [], components: [] });
    }
    if (accion === 'tkayuda_si') {
        await ayuda.marcarResuelta(interaction.guildId);
        return interaction.update({ content: t(cfg, '🎉 ¡Genial! Si necesitas algo más, aquí estamos.', '🎉 Great! If you need anything else, we’re here.'), embeds: [], components: [] });
    }
    await interaction.update({ content: t(cfg, '⏳ Procesando tu solicitud y creando el canal...', '⏳ Processing your request and creating the channel...'), embeds: [], components: [] });
    const { abrirTicketFormulario } = require('../events/interactionCreate.js');
    return abrirTicketFormulario(interaction, client, datos);
}

module.exports = { manejar };

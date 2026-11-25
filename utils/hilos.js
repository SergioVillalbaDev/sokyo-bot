// 🧵 Partidas largas en un hilo (1.34.0): póker, bingo, cohete y ruleta en mesa duran un rato y se editan mucho; para
// no llenar el canal, la partida va en un hilo propio y en el canal queda una línea con el enlace. Si no se puede (el
// bot no puede crear hilos, ya estamos en un hilo o el servidor lo ha apagado en el panel: casino.hilos), va en el
// canal como antes. Devuelve el mensaje de la partida y una forma de editarlo (como la de la interacción).
const { t } = require('./i18n.js');

async function publicar(interaction, cfg, titulo, payload, idioma = 'es') {
    const canal = interaction.channel;
    const puede = cfg?.casino?.hilos !== false && canal && !canal.isThread?.() && typeof canal.threads?.create === 'function'
        && canal.permissionsFor?.(interaction.guild?.members?.me)?.has?.(['CreatePublicThreads', 'SendMessagesInThreads']);
    if (puede) {
        try {
            const aviso = await interaction.editReply({ content: t(idioma, `${titulo} — la partida está en el hilo de abajo 👇`, `${titulo} — the game is in the thread below 👇`), embeds: [], components: [], files: [] });
            const hilo = await aviso.startThread({ name: titulo.replace(/[*_`]/g, '').slice(0, 90), autoArchiveDuration: 60 });
            const msg = await hilo.send(payload);
            return { msg, hilo, editar: (v) => msg.edit(v) };
        } catch (e) { console.warn('Hilo de la partida:', e.message); }
    }
    const msg = await interaction.editReply(payload);
    return { msg, hilo: null, editar: (v) => (msg?.edit ? msg.edit(v) : interaction.editReply(v)) };
}

module.exports = { publicar };

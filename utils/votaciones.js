// Sugerencias y encuestas: construcción del embed y de los botones de voto.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const COLORES = { abierta: '#5865F2', aprobada: '#2ecc71', rechazada: '#e74c3c', cerrada: '#95a5a6' };
const ETIQUETA = { abierta: '🗳️ En votación', aprobada: '✅ Aprobada', rechazada: '❌ Rechazada', cerrada: '🔒 Cerrada' };

function barra(parte, total, ancho = 12) {
    if (!total) return '░'.repeat(ancho);
    const llenos = Math.round((parte / total) * ancho);
    return '█'.repeat(llenos) + '░'.repeat(ancho - llenos);
}

function embedVotacion(v) {
    const total = v.opciones.reduce((a, o) => a + o.votos.length, 0);
    const embed = new EmbedBuilder()
        .setColor(COLORES[v.estado] || COLORES.abierta)
        .setTitle(v.tipo === 'sugerencia' ? '💡 Sugerencia' : '📊 Encuesta')
        .setDescription(v.texto.slice(0, 3500))
        .setFooter({ text: `${v.autorNombre || 'Anónimo'} · ${ETIQUETA[v.estado] || ''} · ${total} voto${total === 1 ? '' : 's'}` })
        .setTimestamp(v.fecha);
    v.opciones.forEach((o, i) => {
        const pct = total ? Math.round((o.votos.length / total) * 100) : 0;
        embed.addFields({ name: `${i + 1}. ${o.texto}`.slice(0, 250), value: `${barra(o.votos.length, total)} **${o.votos.length}** (${pct}%)` });
    });
    if (v.resolucion) embed.addFields({ name: 'Resolución del equipo', value: v.resolucion.slice(0, 1000) });
    return embed;
}

function filaVotacion(v, deshabilitado = false) {
    const fila = new ActionRowBuilder();
    v.opciones.forEach((o, i) => {
        const esSugerencia = v.tipo === 'sugerencia';
        fila.addComponents(new ButtonBuilder()
            .setCustomId(`vot_${i}`)
            .setLabel(esSugerencia ? (i === 0 ? '👍 A favor' : '👎 En contra') : `${i + 1}. ${o.texto}`.slice(0, 80))
            .setStyle(esSugerencia ? (i === 0 ? ButtonStyle.Success : ButtonStyle.Danger) : ButtonStyle.Secondary)
            .setDisabled(deshabilitado || v.estado !== 'abierta'));
    });
    return fila;
}

module.exports = { embedVotacion, filaVotacion };

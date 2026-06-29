// /sistema — Estado de recursos de la máquina donde corre el bot (la Pi).
// SOLO para propietarios (IDs en OWNER_IDS del .env). Respuesta efímera:
// solo la ve quien ejecuta el comando.
const os = require('os');
const fs = require('fs');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Mismo patrón de propietarios que api/server.js.
const OWNER_IDS = new Set((process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean));

// Bytes -> unidad legible (MB/GB).
const fmtBytes = (b) =>
    b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : `${(b / 1024 ** 2).toFixed(0)} MB`;

// Segundos -> "Xd Xh Xm".
const fmtUptime = (s) => {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ') || '0m';
};

// % de CPU: dos lecturas de os.cpus() separadas 200ms.
function muestreaCpu() {
    const lee = () => os.cpus().reduce((acc, c) => {
        for (const t of Object.values(c.times)) acc.total += t;
        acc.idle += c.times.idle;
        return acc;
    }, { total: 0, idle: 0 });
    const a = lee();
    return new Promise((resolve) => setTimeout(() => {
        const b = lee();
        const totalDiff = b.total - a.total;
        const idleDiff = b.idle - a.idle;
        resolve(totalDiff > 0 ? (1 - idleDiff / totalDiff) * 100 : 0);
    }, 200));
}

// Temperatura de la CPU (Raspberry/Linux). Si no existe, null.
function tempCpu() {
    try {
        return parseInt(fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8'), 10) / 1000;
    } catch { return null; }
}

// Uso de disco de la raíz (Node 18.15+/22). Si falla, null.
function discoRaiz() {
    try {
        const s = fs.statfsSync('/');
        const total = s.blocks * s.bsize;
        return { total, usado: total - s.bfree * s.bsize };
    } catch { return null; }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('system')
        .setDescription('📊 Status of the server running the bot (owners only)'),

    async execute(interaction, client) {
        // Control de acceso: solo propietarios.
        if (!OWNER_IDS.has(interaction.user.id)) {
            return interaction.reply({ content: '⛔ This command is only for the bot owners.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const cpuUso = await muestreaCpu();
        const totalMem = os.totalmem();
        const usadaMem = totalMem - os.freemem();
        const temp = tempCpu();
        const disco = discoRaiz();
        const carga = os.loadavg().map((n) => n.toFixed(2)).join(' / ');

        const nodes = client.lavalink?.nodeManager?.nodes;
        const lavalinkOk = nodes ? [...nodes.values()].some((n) => n.connected) : false;
        const reproduciendo = client.lavalink?.players?.size || 0;

        const embed = new EmbedBuilder()
            .setColor(cpuUso > 85 ? 0xe74c3c : cpuUso > 60 ? 0xf1c40f : 0x2ecc71)
            .setTitle('📊 System status')
            .addFields(
                { name: '🖥️ CPU', value: `${cpuUso.toFixed(1)}%${temp !== null ? ` · ${temp.toFixed(1)}°C` : ''}\nLoad: ${carga}`, inline: true },
                { name: '🧠 RAM', value: `${fmtBytes(usadaMem)} / ${fmtBytes(totalMem)}\nBot: ${fmtBytes(process.memoryUsage().rss)}`, inline: true },
                ...(disco ? [{ name: '💾 Disk', value: `${fmtBytes(disco.usado)} / ${fmtBytes(disco.total)}`, inline: true }] : []),
                { name: '⏱️ Uptime', value: `Pi: ${fmtUptime(os.uptime())}\nBot: ${fmtUptime(process.uptime())}`, inline: true },
                { name: '🤖 Discord', value: `Servers: ${client.guilds.cache.size}\nPing: ${Math.round(client.ws.ping)} ms`, inline: true },
                { name: '🎵 Music', value: `Lavalink: ${lavalinkOk ? '🟢 connected' : '🔴 down'}\nPlaying: ${reproduciendo}`, inline: true },
            )
            .setFooter({ text: `${os.hostname()} · ${os.type()} ${os.arch()}` })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    },
};

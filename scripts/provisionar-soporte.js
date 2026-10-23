// ============================================================================
// Aprovisiona el servidor de SOPORTE PRIORITARIO (Premium) de una sola vez.
//
// Pasos ANTES de ejecutar este script:
//   1) Crea un servidor de Discord nuevo y VACÍO a mano (el típico botón "+" de
//      Discord). No hace falta nombre especial, será privado/invite-only.
//   2) Invita a tu propio bot a ese servidor (Developer Portal -> tu app ->
//      OAuth2 -> URL Generator -> scope "bot" -> permisos: Manage Roles,
//      Manage Channels, Create Invite -> abre la URL generada y añádelo).
//   3) Copia el ID de ese servidor (modo desarrollador -> clic derecho sobre
//      el icono del servidor -> "Copiar ID de servidor").
//
// Uso (desde la raíz del proyecto):
//   node scripts/provisionar-soporte.js <guildId>
//
// El script crea el rol "⭐ Soporte Prioritario" + una categoría privada con
// canales (#bienvenida, #soporte, #reportar-bug, #sugerencias) visibles SOLO
// para ese rol, y te imprime los IDs que hay que pegar en el .env:
//   SUPPORT_GUILD_ID=<guildId que le pasaste>
//   SUPPORT_ROL_PREMIUM_ID=<el que imprime este script>
// ============================================================================
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { provisionarServidor } = require('../utils/soporte.js');

const guildId = process.argv[2];

(async () => {
    if (!guildId) {
        console.log('Uso: node scripts/provisionar-soporte.js <guildId>');
        process.exit(1);
    }
    if (!process.env.DISCORD_TOKEN) {
        console.error('🔴 Falta DISCORD_TOKEN en el .env');
        process.exit(1);
    }

    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    await client.login(process.env.DISCORD_TOKEN);
    await new Promise((resolve) => client.once('ready', resolve));
    console.log(`🟢 Conectado como ${client.user.tag}`);

    try {
        const { rolId, categoriaId, canales } = await provisionarServidor(client, guildId);
        console.log('\n✅ Servidor de soporte listo. Pega esto en tu .env:\n');
        console.log(`SUPPORT_GUILD_ID=${guildId}`);
        console.log(`SUPPORT_ROL_PREMIUM_ID=${rolId}`);
        console.log(`\nCategoría creada: ${categoriaId}`);
        console.log('Canales:', canales);
        console.log('\nReinicia el bot (pm2 restart bot) para que los lea.');
    } catch (e) {
        console.error('🔴 Error aprovisionando el servidor:', e.message);
    }

    await client.destroy();
    process.exit(0);
})();

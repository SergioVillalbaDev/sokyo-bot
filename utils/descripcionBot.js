// Descripción pública del bot (2.0.0). La de Discord («Acerca de mí» del bot, máx. 400) se
// pone sola al arrancar si ha cambiado, para que siempre diga lo que el bot hace de verdad.
// Se apaga con DESCRIPCION_AUTOMATICA=no en el .env. Los textos largos (top.gg, web) están
// en MARKETING.md: si cambias lo que hace el bot, cambia los dos.
const DESCRIPCION = [
    '🇪🇸 Bot todo en uno: tickets, moderación con IA, bienvenidas y roles, y además mascotas, cartas, combates, casino y niveles para que tu comunidad no pare. Panel web, listo en 1 minuto.',
    '🇬🇧 All-in-one: tickets, AI moderation, pets, cards, battles, casino & levels.',
    '👉 dashboard.sokyo.studio',
].join('\n');

async function ponerDescripcion(client) {
    if (String(process.env.DESCRIPCION_AUTOMATICA || '').toLowerCase() === 'no') return false;
    const app = await client.application?.fetch().catch(() => null);
    if (!app || app.description === DESCRIPCION) return false;
    await client.application.edit({ description: DESCRIPCION });
    console.log('📝 Descripción del bot en Discord puesta al día.');
    return true;
}

module.exports = { DESCRIPCION, ponerDescripcion };

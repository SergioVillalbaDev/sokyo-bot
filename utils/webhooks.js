// ============================================================================
// Webhooks SALIENTES (Pro). Avisan a un endpoint externo (Slack, Discord, n8n,
// Zapier o uno propio) cuando pasa algo en el servidor: ticket nuevo, sanción o
// raid. Para comunidades/empresas que quieren integrar Sokyo con sus flujos.
//
// El payload sirve para todos sin configurar formato:
//   - Slack  lee  "text"
//   - Discord lee "content"
//   - n8n / propio reciben el objeto completo (event, guildId, data...)
//
// Es "fire and forget": nunca bloquea la acción que lo dispara (timeout de 5s).
// Solo se envía si el servidor tiene plan Pro y el evento está activado.
// ============================================================================
const { esPro } = require('./billing.js');

// Dispara un webhook para un evento. `cfg` = ServidorConfig del servidor.
// No usar await en quien lo llama: se ignora el resultado a propósito.
async function enviarWebhook(cfg, evento, { text = '', data = {} } = {}) {
    const w = cfg && cfg.webhooksSalientes;
    if (!w || !w.activo || !w.url) return;
    if (!esPro(cfg)) return;                                  // gate de plan Pro
    if (w.eventos && w.eventos[evento] === false) return;     // evento desactivado
    if (!/^https:\/\//i.test(w.url)) return;                  // solo https

    const payload = {
        event: evento,
        guildId: cfg.guildId,
        text,            // Slack
        content: text,   // Discord
        data,            // n8n / endpoint propio
        timestamp: new Date().toISOString(),
    };
    const headers = { 'Content-Type': 'application/json' };
    if (w.secret) headers['X-Sokyo-Secret'] = w.secret;       // verificación opcional

    try {
        await fetch(w.url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(5000),
        });
    } catch (e) {
        console.error('Webhook saliente:', e.message);
    }
}

module.exports = { enviarWebhook };

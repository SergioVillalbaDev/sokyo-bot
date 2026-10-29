// «Fulano está escribiendo…» en el chat de un ticket del panel. Se guarda en
// memoria quién escribe en cada ticket (desde el panel o desde Discord) durante
// unos segundos. Quien escribe en el panel hace además que en Discord salga
// «Sokyo está escribiendo…», para que la persona del ticket sepa que la atienden.
const VIVO_MS = 7000;         // tras dejar de teclear, se borra a los 7 s
const TYPING_DISCORD_MS = 8000; // Discord lo enseña ~10 s: se renueva cada 8
const porTicket = new Map();    // canalId -> Map(id -> { nombre, origen, t })
const ultimoTyping = new Map(); // canalId -> momento del último sendTyping

function marcarEscribiendo(canalId, { id, nombre, origen = 'panel' }) {
    if (!canalId || !id) return;
    let m = porTicket.get(canalId);
    if (!m) { m = new Map(); porTicket.set(canalId, m); }
    m.set(id, { nombre: String(nombre || '').slice(0, 80), origen, t: Date.now() });
    if (porTicket.size > 2000) porTicket.clear(); // por si acaso: nunca crece sin fin
}

function dejarDeEscribir(canalId, id) {
    porTicket.get(canalId)?.delete(id);
}

// Quién escribe ahora en un ticket (sin contar a `excepto`).
function quienEscribe(canalId, excepto = null) {
    const m = porTicket.get(canalId);
    if (!m) return [];
    const ahora = Date.now();
    const out = [];
    for (const [id, x] of m) {
        if (ahora - x.t > VIVO_MS) { m.delete(id); continue; }
        if (id !== excepto) out.push({ nombre: x.nombre, origen: x.origen });
    }
    return out;
}

// Que en Discord se vea «Sokyo está escribiendo…» (sin pasarse de peticiones).
function avisarEnDiscord(client, canalId) {
    const antes = ultimoTyping.get(canalId) || 0;
    if (Date.now() - antes < TYPING_DISCORD_MS) return;
    ultimoTyping.set(canalId, Date.now());
    if (ultimoTyping.size > 2000) ultimoTyping.clear();
    const canal = client.channels.cache.get(canalId);
    canal?.sendTyping?.().catch(() => {});
}

module.exports = { marcarEscribiendo, dejarDeEscribir, quienEscribe, avisarEnDiscord };

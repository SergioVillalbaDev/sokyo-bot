// ============================================================================
// Asistente IA para tickets (API de Claude / Anthropic).
//   - resumirTicket: resumen para un agente que se incorpora.
//   - sugerirRespuesta: borrador de respuesta lista para enviar al cliente.
//
// Se activa SOLO si existe ANTHROPIC_API_KEY en el .env (cuesta dinero por uso).
// Sin la clave, queda desactivado y el resto del bot funciona igual.
//
// Modelo configurable con ANTHROPIC_MODEL (por defecto claude-opus-4-8).
// Para gastar menos puedes poner un modelo más barato, p. ej. claude-haiku-4-5.
// ============================================================================
let _sdk = null;
let _intentado = false;

// Inicializa el SDK de Anthropic perezosamente. Null si no hay clave.
function getIA() {
    if (_intentado) return _sdk;
    _intentado = true;
    if (!process.env.ANTHROPIC_API_KEY) {
        console.warn('⚠️  ANTHROPIC_API_KEY no definida: el asistente IA está desactivado.');
        return null;
    }
    try {
        const SDK = require('@anthropic-ai/sdk');
        const Anthropic = SDK.default || SDK;
        _sdk = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    } catch (e) {
        console.error('🔴 No se pudo iniciar la IA:', e.message);
        _sdk = null;
    }
    return _sdk;
}

function iaDisponible() {
    return !!process.env.ANTHROPIC_API_KEY;
}

// Por defecto Haiku (barato: ~medio céntimo por uso). Cambia ANTHROPIC_MODEL
// a claude-opus-4-8 / claude-sonnet-4-6 si quieres más calidad (y más coste).
const modelo = () => process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

// Convierte los mensajes del ticket en un texto que la IA pueda leer.
function transcripcion(mensajes, ticket) {
    const lineas = (mensajes || []).map((m) => `${m.usuario || 'User'}: ${m.contenido || '(no text)'}`);
    return [
        `Customer (opened the ticket): ${(ticket && ticket.creadorNombre) || 'unknown'}`,
        `Subject: ${(ticket && ticket.titulo) || '-'}`,
        `Reason: ${(ticket && ticket.motivo) || '-'}`,
        '',
        'Conversation:',
        lineas.join('\n') || '(no messages)',
    ].join('\n');
}

// Llamada base a la API. Devuelve el texto de la respuesta.
async function pedir(system, contenido, maxTokens = 1024) {
    const cliente = getIA();
    if (!cliente) throw new Error('AI not configured');
    const r = await cliente.messages.create({
        model: modelo(),
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: contenido }],
    });
    const txt = (r.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
    return txt || '(the AI returned no text)';
}

async function resumirTicket(mensajes, ticket) {
    const system = 'You are a support assistant. Summarize the ticket in English, short and clear, for an agent picking it up. Structure it with bullet points: 1) the customer’s problem, 2) what has already been done, 3) current status, 4) suggested next steps. Don’t make up details that aren’t in the conversation.';
    return pedir(system, transcripcion(mensajes, ticket));
}

async function sugerirRespuesta(mensajes, ticket) {
    const system = 'You are a professional, friendly support agent. Write in English ONE reply ready to send to the customer, answering their last message. Polite, solution-focused tone. Don’t make up information; if a detail is missing to resolve it, kindly ask for it. Return only the reply text, with no meta-comments or "here you go".';
    return pedir(system, transcripcion(mensajes, ticket));
}

// Informe ejecutivo del servidor a partir de las métricas de la analítica.
async function informeServidor(data) {
    const system = 'You are an expert Discord community consultant. From these metrics, write in English a clear, motivating executive report with this structure and headings: "Overview" (2-3 sentences), "Strengths" (3 bullets), "To improve" (3 bullets) and "Action plan" (5 concrete, actionable steps to grow next month). Be specific and cite the numbers. Don’t make up data that isn’t here.';
    const r = data.resumen || {}, ac = data.actividad || {}, ni = data.niveles || {}, mo = data.moderacion || {}, ti = (data.tickets && data.tickets.totales) || {};
    const topCanal = (ac.topCanales && ac.topCanales[0] && ac.topCanales[0].nombre) || '-';
    const contenido = [
        `Periodo analizado: ${data.dias} días`,
        `Miembros: ${r.miembros} · crecimiento neto: ${r.crecimientoNeto}`,
        `Mensajes: ${r.mensajes} · miembros activos: ${r.activos} (${r.pctActivos}%) · mensajes por activo: ${r.mensajesPorActivo} · activos en voz: ${r.vozActivos}`,
        `Hora pico de actividad: ${ac.horaPico} (UTC) · canal más activo: ${topCanal}`,
        `Niveles/XP: ${ni.conXp} usuarios con XP de ${ni.total} (nivel medio ${ni.nivelMedio})`,
        `Moderación: ${mo.total} sanciones (${mo.automod} por automod) · reportes pendientes: ${mo.reportesPendientes}`,
        `Tickets: ${ti.total} (abiertos ${ti.abiertos}, cerrados ${ti.cerrados}) · CSAT ${ti.csat ?? 'n/d'} · cierre medio ${ti.tiempoMedioCierreH ?? 'n/d'}h`,
        `Señales detectadas: ${(data.insights || []).map((i) => i.titulo).join('; ') || 'ninguna'}`,
    ].join('\n');
    return pedir(system, contenido, 1500);
}

// Briefing diario: parte del día anterior, en tono de mensaje matutino al dueño.
async function resumenDiario(data, nombre) {
    const ayer = (arr) => (arr && arr.length >= 2 ? arr[arr.length - 2] : (arr && arr[arr.length - 1]) || {});
    const com = ayer(data.comunidad && data.comunidad.serie);
    const msg = ayer(data.actividad && data.actividad.serie);
    const tk = ayer(data.tickets && data.tickets.serie);
    const mod = ayer(data.moderacion && data.moderacion.serie);
    const r = data.resumen || {}, ti = (data.tickets && data.tickets.totales) || {};
    const topCanal = (data.actividad && data.actividad.topCanales && data.actividad.topCanales[0] && data.actividad.topCanales[0].nombre) || '-';
    const contenido = [
        `Servidor: ${nombre}`,
        `Miembros: ${r.miembros} (crecimiento neto 7 días: ${r.crecimientoNeto})`,
        `AYER → entradas: ${com.entradas || 0}, salidas: ${com.salidas || 0}, mensajes: ${msg.n || 0}, tickets nuevos: ${tk.creados || 0}, sanciones: ${mod.n || 0}`,
        `Ahora mismo → tickets abiertos: ${ti.abiertos}, reportes pendientes: ${(data.moderacion && data.moderacion.reportesPendientes) || 0}`,
        `Hora pico: ${data.actividad && data.actividad.horaPico} (UTC) · canal más activo: ${topCanal}`,
        `Señales: ${(data.insights || []).map((i) => i.titulo).join('; ') || 'ninguna'}`,
    ].join('\n');
    const system = 'You are the assistant to a Discord server owner. Write in English a short, friendly daily BRIEFING, good-morning message style (max ~120 words): a greeting, 3-4 key facts from YESTERDAY, any ALERT that needs their attention today, and ONE concrete recommendation for today. Use a few emojis sparingly. Don’t make up data that isn’t here.';
    return pedir(system, contenido, 700);
}

// Moderación por IA: clasifica UN mensaje. Devuelve { accionar, categoria, motivo }.
// Pensado para ser barato (pocos tokens) y robusto: si la IA no devuelve un JSON
// válido, asumimos que NO hay que actuar (no castigamos por una respuesta rara).
async function moderarTexto(texto, opciones = {}) {
    const { categorias = [], sensibilidad = 'media' } = opciones;
    const cats = categorias.length ? categorias.join(', ') : 'toxicidad, acoso, amenazas, nsfw, autolesion';
    const system = [
        'You are a content moderator for a Discord chat.',
        `Decide whether the user MESSAGE violates any of these categories: ${cats}.`,
        'Account for slang, irony and attempts to evade filters (l3tt3rs, spaces, symbols).',
        `Sensitivity: ${sensibilidad} (low = only clear, serious cases; medium = balanced; high = borderline cases too).`,
        'Respond ONLY with valid JSON, nothing else, with this exact shape:',
        '{"accionar": true|false, "categoria": "<category or empty string>", "motivo": "<max 8 words in English>"}',
        'accionar=true only if it truly violates per the given sensitivity.',
    ].join(' ');

    const raw = await pedir(system, `MESSAGE: ${texto}`, 200);
    try {
        const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
        return {
            accionar: json.accionar === true,
            categoria: typeof json.categoria === 'string' ? json.categoria : '',
            motivo: (typeof json.motivo === 'string' && json.motivo) ? json.motivo : 'Inappropriate content',
        };
    } catch {
        return { accionar: false, categoria: '', motivo: '' };
    }
}

module.exports = { getIA, iaDisponible, resumirTicket, sugerirRespuesta, informeServidor, resumenDiario, moderarTexto };

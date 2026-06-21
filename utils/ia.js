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

const modelo = () => process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

// Convierte los mensajes del ticket en un texto que la IA pueda leer.
function transcripcion(mensajes, ticket) {
    const lineas = (mensajes || []).map((m) => `${m.usuario || 'Usuario'}: ${m.contenido || '(sin texto)'}`);
    return [
        `Cliente (abrió el ticket): ${(ticket && ticket.creadorNombre) || 'desconocido'}`,
        `Asunto: ${(ticket && ticket.titulo) || '-'}`,
        `Motivo: ${(ticket && ticket.motivo) || '-'}`,
        '',
        'Conversación:',
        lineas.join('\n') || '(sin mensajes)',
    ].join('\n');
}

// Llamada base a la API. Devuelve el texto de la respuesta.
async function pedir(system, contenido) {
    const cliente = getIA();
    if (!cliente) throw new Error('IA no configurada');
    const r = await cliente.messages.create({
        model: modelo(),
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: contenido }],
    });
    const txt = (r.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
    return txt || '(la IA no devolvió texto)';
}

async function resumirTicket(mensajes, ticket) {
    const system = 'Eres un asistente de soporte. Resume el ticket en español, breve y claro, para un agente que se incorpora. Estructura con viñetas: 1) problema del cliente, 2) qué se ha hecho ya, 3) estado actual, 4) próximos pasos sugeridos. No inventes datos que no aparezcan en la conversación.';
    return pedir(system, transcripcion(mensajes, ticket));
}

async function sugerirRespuesta(mensajes, ticket) {
    const system = 'Eres un agente de soporte profesional y cercano. Redacta en español UNA respuesta lista para enviar al cliente, contestando a su último mensaje. Tono educado y resolutivo. No inventes información; si falta un dato para resolver, pídelo con amabilidad. Devuelve solo el texto de la respuesta, sin meta-comentarios ni "aquí tienes".';
    return pedir(system, transcripcion(mensajes, ticket));
}

module.exports = { getIA, iaDisponible, resumirTicket, sugerirRespuesta };

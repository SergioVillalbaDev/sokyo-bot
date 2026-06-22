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
async function pedir(system, contenido, maxTokens = 1024) {
    const cliente = getIA();
    if (!cliente) throw new Error('IA no configurada');
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

// Informe ejecutivo del servidor a partir de las métricas de la analítica.
async function informeServidor(data) {
    const system = 'Eres un consultor experto en comunidades de Discord. A partir de estas métricas escribe en español un informe ejecutivo, claro y motivador, con esta estructura y encabezados: "Estado general" (2-3 frases), "Puntos fuertes" (3 viñetas), "A mejorar" (3 viñetas) y "Plan de acción" (5 pasos concretos y accionables para crecer el próximo mes). Sé específico citando los números. No inventes datos que no estén aquí.';
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
    const system = 'Eres el asistente del dueño de un servidor de Discord. Escribe en español un BRIEFING diario breve y cercano, estilo mensaje de buenos días (máx ~120 palabras): un saludo, 3-4 datos clave de AYER, cualquier ALERTA que requiera su atención hoy, y UNA recomendación concreta para hoy. Usa algún emoji con moderación. No inventes datos que no estén aquí.';
    return pedir(system, contenido, 700);
}

module.exports = { getIA, iaDisponible, resumirTicket, sugerirRespuesta, informeServidor, resumenDiario };

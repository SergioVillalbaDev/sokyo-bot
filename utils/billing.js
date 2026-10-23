// ============================================================================
// Facturación con Stripe. Centraliza TODO el cobro de planes (Pro / Agencia):
//   - crear sesiones de pago (Checkout) y portal de gestión del cliente,
//   - procesar los webhooks de Stripe (activar / renovar / cancelar premium),
//   - barrer suscripciones caducadas.
//
// Variables de entorno (ver .env.example):
//   STRIPE_SECRET_KEY            clave secreta de la cuenta de Stripe
//   STRIPE_WEBHOOK_SECRET        secreto para verificar los webhooks
//   STRIPE_PRICE_PRO_MONTH / _YEAR / _LIFETIME       price IDs del plan Pro
//   STRIPE_PRICE_AGENCY_MONTH / _YEAR / _LIFETIME    price IDs del plan Agencia
//
// Si STRIPE_SECRET_KEY no está definida, los pagos quedan DESACTIVADOS (el resto
// del bot funciona igual) y los endpoints responden 503.
// ============================================================================
const ServidorConfig = require('../models/ServidorConfig.js');
const soporte = require('./soporte.js');

let _stripe = null;
let _intentado = false;

// Inicializa Stripe perezosamente. Devuelve null si no hay clave configurada.
function getStripe() {
    if (_intentado) return _stripe;
    _intentado = true;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
        console.warn('⚠️  STRIPE_SECRET_KEY no definida: los pagos están desactivados.');
        return null;
    }
    try {
        _stripe = require('stripe')(key);
    } catch (e) {
        console.error('🔴 No se pudo iniciar Stripe:', e.message);
        _stripe = null;
    }
    return _stripe;
}

const PLANES_VALIDOS = ['pro', 'agency'];
const INTERVALOS_VALIDOS = ['month', 'year', 'lifetime'];

// Mapa plan + intervalo -> price ID (se lee en cada llamada por si cambia el .env).
function precioId(plan, intervalo) {
    const tabla = {
        pro: {
            month: process.env.STRIPE_PRICE_PRO_MONTH,
            year: process.env.STRIPE_PRICE_PRO_YEAR,
            lifetime: process.env.STRIPE_PRICE_PRO_LIFETIME,
        },
        agency: {
            month: process.env.STRIPE_PRICE_AGENCY_MONTH,
            year: process.env.STRIPE_PRICE_AGENCY_YEAR,
            lifetime: process.env.STRIPE_PRICE_AGENCY_LIFETIME,
        },
    };
    return (tabla[plan] && tabla[plan][intervalo]) || null;
}

// ¿Este servidor tiene un plan de pago ACTIVO (no caducado)?
function premiumActivo(cfg) {
    if (!cfg) return false;
    if (!cfg.esPremium && (!cfg.plan || cfg.plan === 'free')) return false;
    if (cfg.premiumHasta && cfg.premiumHasta.getTime() < Date.now()) return false;
    return true;
}

// Tramo efectivo del servidor: 'free' | 'pro' | 'agency' (respeta la caducidad).
function nivel(cfg) {
    if (!premiumActivo(cfg)) return 'free';
    return cfg.plan === 'agency' ? 'agency' : 'pro';
}

// ¿Tiene un plan de pago (Pro o Agencia)? Es el gate de la mayoría de funciones premium.
function esPro(cfg) {
    const n = nivel(cfg);
    return n === 'pro' || n === 'agency';
}

// ¿Es del tramo Agencia? (multi-servidor, bot personalizado, marca 100% blanca).
function esAgency(cfg) {
    return nivel(cfg) === 'agency';
}

// --- CUOTA DE IA por servidor y mes (evita sorpresas de coste) ---
const CUOTA_IA = { free: 5, pro: 150, agency: 1500 };
const mesActual = () => new Date().toISOString().slice(0, 7); // 'YYYY-MM'

function cuotaIA(cfg) {
    return CUOTA_IA[nivel(cfg)] || 0;
}

// Estado del contador de IA (sin tocar nada). Reinicia virtualmente al cambiar de mes.
function estadoIA(cfg) {
    const cuota = cuotaIA(cfg);
    const usos = (cfg && cfg.iaMesRef === mesActual()) ? (cfg.iaUsos || 0) : 0;
    return { cuota, usos, restantes: Math.max(0, cuota - usos), mes: mesActual() };
}

// Suma 1 uso de IA al servidor (tras una llamada con éxito). Devuelve el estado nuevo.
// Incremento ATÓMICO en la propia BD (pipeline de agregación): si varias llamadas de
// IA llegan a la vez (varios mensajes moderados en paralelo), Mongo serializa cada
// incremento en vez de perderlos por un leer-y-escribir en memoria.
async function consumirIA(guildId, cfg) {
    const cuota = cuotaIA(cfg);
    const mes = mesActual();
    const r = await ServidorConfig.findOneAndUpdate(
        { guildId },
        [{ $set: {
            iaUsos: { $cond: [{ $eq: ['$iaMesRef', mes] }, { $add: [{ $ifNull: ['$iaUsos', 0] }, 1] }, 1] },
            iaMesRef: mes,
        } }],
        { returnDocument: 'after' },
    );
    const usos = r.iaUsos;
    return { cuota, usos, restantes: Math.max(0, cuota - usos), mes };
}

// Activa / renueva un plan en la BD. `premiumHasta === null` = de por vida.
async function activarPlan(guildId, datos) {
    const set = { esPremium: true, plan: datos.plan || 'pro' };
    if (datos.premiumHasta !== undefined) set.premiumHasta = datos.premiumHasta;
    if (datos.stripeCustomerId) set.stripeCustomerId = datos.stripeCustomerId;
    if (datos.stripeSubscriptionId !== undefined) set.stripeSubscriptionId = datos.stripeSubscriptionId;
    if (datos.cancelaAlFinal !== undefined) set.premiumCancelaAlFinal = datos.cancelaAlFinal;
    if (datos.compradorId) set.soporteCompradorId = datos.compradorId;
    await ServidorConfig.findOneAndUpdate({ guildId }, { $set: set }, { upsert: true });
}

// Devuelve el servidor a Free. `client` (opcional): si se pasa, además quita el
// acceso al servidor de soporte prioritario a quien lo compró.
async function desactivarPlan(guildId, client = null) {
    const cfg = await ServidorConfig.findOneAndUpdate(
        { guildId },
        { $set: { esPremium: false, plan: 'free', premiumCancelaAlFinal: false, stripeSubscriptionId: null } },
    );
    if (client && cfg && cfg.soporteCompradorId) {
        await soporte.revocarAcceso(client, cfg.soporteCompradorId).catch((e) => console.error('Soporte prioritario (revocar):', e.message));
    }
}

// Crea una sesión de Checkout (la página de pago de Stripe). Devuelve la sesión (.url).
// `compradorId` (Discord ID de quien paga) viaja en los metadatos para poder darle
// después acceso al servidor de soporte prioritario (Premium).
async function crearSesionCheckout({ guildId, plan, intervalo, precio, compradorId, clienteExistenteId, exitoUrl, cancelUrl }) {
    const stripe = getStripe();
    const modo = intervalo === 'lifetime' ? 'payment' : 'subscription';
    const metadata = { guildId, plan, ...(compradorId ? { compradorId } : {}) };
    const params = {
        mode: modo,
        line_items: [{ price: precio, quantity: 1 }],
        success_url: exitoUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
        metadata,
    };
    if (clienteExistenteId) params.customer = clienteExistenteId;
    if (modo === 'subscription') params.subscription_data = { metadata };
    else params.payment_intent_data = { metadata };
    return stripe.checkout.sessions.create(params);
}

// Crea una sesión del Portal de Cliente de Stripe (para cancelar / cambiar tarjeta).
async function crearSesionPortal({ clienteId, retornoUrl }) {
    const stripe = getStripe();
    return stripe.billingPortal.sessions.create({ customer: clienteId, return_url: retornoUrl });
}

// Verifica la firma del webhook y reconstruye el evento.
function construirEvento(rawBody, signature) {
    const stripe = getStripe();
    return stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
}

// Procesa un evento de Stripe ya verificado y actualiza la BD.
// `client` (opcional): si se pasa, sincroniza el acceso al servidor de soporte
// prioritario (lo concede en el primer pago, lo revoca al cancelar/caducar).
async function procesarEvento(event, client = null) {
    const stripe = getStripe();
    const obj = event.data.object;

    switch (event.type) {
        case 'checkout.session.completed': {
            const guildId = obj.metadata && obj.metadata.guildId;
            const plan = (obj.metadata && obj.metadata.plan) || 'pro';
            const compradorId = obj.metadata && obj.metadata.compradorId;
            if (!guildId) break;
            if (obj.mode === 'payment') {
                // Pago único (lifetime): premium de por vida.
                await activarPlan(guildId, {
                    plan, premiumHasta: null, stripeCustomerId: obj.customer,
                    stripeSubscriptionId: null, cancelaAlFinal: false, compradorId,
                });
            } else {
                let hasta;
                const subId = obj.subscription || null;
                if (subId) {
                    const sub = await stripe.subscriptions.retrieve(subId);
                    hasta = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
                }
                await activarPlan(guildId, {
                    plan, premiumHasta: hasta, stripeCustomerId: obj.customer,
                    stripeSubscriptionId: subId, cancelaAlFinal: false, compradorId,
                });
            }
            // Primer pago confirmado: le mandamos el acceso al soporte prioritario.
            if (client && compradorId) {
                await soporte.otorgarAcceso(client, compradorId).catch((e) => console.error('Soporte prioritario (otorgar):', e.message));
            }
            break;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
            const sub = obj;
            const guildId = sub.metadata && sub.metadata.guildId;
            const plan = (sub.metadata && sub.metadata.plan) || 'pro';
            const compradorId = sub.metadata && sub.metadata.compradorId;
            if (!guildId) break;
            const activa = ['active', 'trialing', 'past_due'].includes(sub.status);
            if (activa) {
                // Solo renovación/actualización de la suscripción: NO se vuelve a mandar
                // el invite (eso ya pasó en checkout.session.completed la primera vez).
                await activarPlan(guildId, {
                    plan,
                    premiumHasta: sub.current_period_end ? new Date(sub.current_period_end * 1000) : undefined,
                    stripeCustomerId: sub.customer,
                    stripeSubscriptionId: sub.id,
                    cancelaAlFinal: !!sub.cancel_at_period_end,
                    compradorId,
                });
            } else {
                await desactivarPlan(guildId, client);
            }
            break;
        }
        case 'customer.subscription.deleted': {
            const guildId = obj.metadata && obj.metadata.guildId;
            if (guildId) await desactivarPlan(guildId, client);
            break;
        }
        default:
            break;
    }
}

// Devuelve a Free los servidores cuyo periodo pagado ya venció (red de seguridad
// además de los webhooks). Los planes de por vida (premiumHasta = null) se respetan.
// `client` (opcional): si se pasa, también revoca el acceso al soporte prioritario
// de quien compró cada uno de esos servidores.
async function barrerPremiumCaducado(client = null) {
    const filtro = { esPremium: true, premiumHasta: { $ne: null, $lt: new Date() } };
    const caducados = client ? await ServidorConfig.find(filtro).select('soporteCompradorId') : [];
    const res = await ServidorConfig.updateMany(
        filtro,
        { $set: { esPremium: false, plan: 'free', premiumCancelaAlFinal: false } },
    );
    if (client) {
        for (const cfg of caducados) {
            if (cfg.soporteCompradorId) {
                await soporte.revocarAcceso(client, cfg.soporteCompradorId).catch((e) => console.error('Soporte prioritario (revocar por caducidad):', e.message));
            }
        }
    }
    return res.modifiedCount || 0;
}

module.exports = {
    getStripe, precioId, premiumActivo, nivel, esPro, esAgency,
    cuotaIA, estadoIA, consumirIA,
    PLANES_VALIDOS, INTERVALOS_VALIDOS,
    activarPlan, desactivarPlan,
    crearSesionCheckout, crearSesionPortal,
    construirEvento, procesarEvento, barrerPremiumCaducado,
};

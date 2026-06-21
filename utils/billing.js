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

// Activa / renueva un plan en la BD. `premiumHasta === null` = de por vida.
async function activarPlan(guildId, datos) {
    const set = { esPremium: true, plan: datos.plan || 'pro' };
    if (datos.premiumHasta !== undefined) set.premiumHasta = datos.premiumHasta;
    if (datos.stripeCustomerId) set.stripeCustomerId = datos.stripeCustomerId;
    if (datos.stripeSubscriptionId !== undefined) set.stripeSubscriptionId = datos.stripeSubscriptionId;
    if (datos.cancelaAlFinal !== undefined) set.premiumCancelaAlFinal = datos.cancelaAlFinal;
    await ServidorConfig.findOneAndUpdate({ guildId }, { $set: set }, { upsert: true });
}

// Devuelve el servidor a Free.
async function desactivarPlan(guildId) {
    await ServidorConfig.findOneAndUpdate(
        { guildId },
        { $set: { esPremium: false, plan: 'free', premiumCancelaAlFinal: false, stripeSubscriptionId: null } },
    );
}

// Crea una sesión de Checkout (la página de pago de Stripe). Devuelve la sesión (.url).
async function crearSesionCheckout({ guildId, plan, intervalo, precio, clienteExistenteId, exitoUrl, cancelUrl }) {
    const stripe = getStripe();
    const modo = intervalo === 'lifetime' ? 'payment' : 'subscription';
    const params = {
        mode: modo,
        line_items: [{ price: precio, quantity: 1 }],
        success_url: exitoUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
        metadata: { guildId, plan },
    };
    if (clienteExistenteId) params.customer = clienteExistenteId;
    if (modo === 'subscription') params.subscription_data = { metadata: { guildId, plan } };
    else params.payment_intent_data = { metadata: { guildId, plan } };
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
async function procesarEvento(event) {
    const stripe = getStripe();
    const obj = event.data.object;

    switch (event.type) {
        case 'checkout.session.completed': {
            const guildId = obj.metadata && obj.metadata.guildId;
            const plan = (obj.metadata && obj.metadata.plan) || 'pro';
            if (!guildId) break;
            if (obj.mode === 'payment') {
                // Pago único (lifetime): premium de por vida.
                await activarPlan(guildId, {
                    plan, premiumHasta: null, stripeCustomerId: obj.customer,
                    stripeSubscriptionId: null, cancelaAlFinal: false,
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
                    stripeSubscriptionId: subId, cancelaAlFinal: false,
                });
            }
            break;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
            const sub = obj;
            const guildId = sub.metadata && sub.metadata.guildId;
            const plan = (sub.metadata && sub.metadata.plan) || 'pro';
            if (!guildId) break;
            const activa = ['active', 'trialing', 'past_due'].includes(sub.status);
            if (activa) {
                await activarPlan(guildId, {
                    plan,
                    premiumHasta: sub.current_period_end ? new Date(sub.current_period_end * 1000) : undefined,
                    stripeCustomerId: sub.customer,
                    stripeSubscriptionId: sub.id,
                    cancelaAlFinal: !!sub.cancel_at_period_end,
                });
            } else {
                await desactivarPlan(guildId);
            }
            break;
        }
        case 'customer.subscription.deleted': {
            const guildId = obj.metadata && obj.metadata.guildId;
            if (guildId) await desactivarPlan(guildId);
            break;
        }
        default:
            break;
    }
}

// Devuelve a Free los servidores cuyo periodo pagado ya venció (red de seguridad
// además de los webhooks). Los planes de por vida (premiumHasta = null) se respetan.
async function barrerPremiumCaducado() {
    const res = await ServidorConfig.updateMany(
        { esPremium: true, premiumHasta: { $ne: null, $lt: new Date() } },
        { $set: { esPremium: false, plan: 'free', premiumCancelaAlFinal: false } },
    );
    return res.modifiedCount || 0;
}

module.exports = {
    getStripe, precioId, premiumActivo, nivel, esPro, esAgency,
    PLANES_VALIDOS, INTERVALOS_VALIDOS,
    activarPlan, desactivarPlan,
    crearSesionCheckout, crearSesionPortal,
    construirEvento, procesarEvento, barrerPremiumCaducado,
};

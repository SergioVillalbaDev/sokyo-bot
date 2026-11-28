// Pagos con Stripe de punta a punta (2.0.1): firma del webhook y lo que hace cada evento con el plan.
// Con la API actual de Stripe la fecha del periodo va en las líneas de la suscripción: una suscripción
// mensual nunca puede quedar como «de por vida».
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_simulado';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_prueba_123';
const billing = require('../utils/billing.js');
const ServidorConfig = require('../models/ServidorConfig.js');

describe('pagos con Stripe', () => {
    let guardado; let orig; let stripe;
    const fin = Math.floor(Date.now() / 1000) + 30 * 86400;
    before(() => {
        stripe = billing.getStripe();
        orig = { fou: ServidorConfig.findOneAndUpdate, ret: stripe.subscriptions.retrieve };
        ServidorConfig.findOneAndUpdate = async (filtro, upd) => { guardado = { ...(guardado || {}), ...upd.$set }; return { soporteCompradorId: null }; };
        stripe.subscriptions.retrieve = async () => ({ id: 'sub_1', status: 'active', items: { data: [{ current_period_end: fin }] } });
    });
    after(() => { ServidorConfig.findOneAndUpdate = orig.fou; stripe.subscriptions.retrieve = orig.ret; });

    it('el webhook solo acepta eventos firmados con nuestra clave', () => {
        const cuerpo = JSON.stringify({ id: 'evt_1', type: 'ping', data: { object: {} } });
        const firma = stripe.webhooks.generateTestHeaderString({ payload: cuerpo, secret: process.env.STRIPE_WEBHOOK_SECRET });
        assert.strictEqual(billing.construirEvento(Buffer.from(cuerpo), firma).id, 'evt_1');
        const falsa = stripe.webhooks.generateTestHeaderString({ payload: cuerpo, secret: 'whsec_otra' });
        assert.throws(() => billing.construirEvento(Buffer.from(cuerpo), falsa));
        assert.throws(() => billing.construirEvento(Buffer.from(cuerpo.replace('ping', 'pong')), firma), 'cuerpo cambiado');
    });

    it('pagar una suscripción mensual activa Pro HASTA el fin del periodo (no de por vida)', async () => {
        guardado = null;
        await billing.procesarEvento({ type: 'checkout.session.completed', data: { object: { mode: 'subscription', subscription: 'sub_1', customer: 'cus_1', metadata: { guildId: 'G1', plan: 'pro' } } } });
        assert.strictEqual(guardado.esPremium, true);
        assert.strictEqual(guardado.plan, 'pro');
        assert.ok(guardado.premiumHasta instanceof Date, 'tiene fecha de fin');
        assert.strictEqual(Math.round(guardado.premiumHasta.getTime() / 1000), fin);
    });

    it('si Stripe no da la fecha, un mes de margen, nunca de por vida', async () => {
        guardado = null;
        stripe.subscriptions.retrieve = async () => ({ id: 'sub_2', status: 'active', items: { data: [] } });
        await billing.procesarEvento({ type: 'checkout.session.completed', data: { object: { mode: 'subscription', subscription: 'sub_2', customer: 'cus_1', metadata: { guildId: 'G1', plan: 'pro' } } } });
        assert.ok(guardado.premiumHasta instanceof Date);
        assert.ok(guardado.premiumHasta.getTime() < Date.now() + 40 * 86400000);
    });

    it('pago único = de por vida', async () => {
        guardado = null;
        await billing.procesarEvento({ type: 'checkout.session.completed', data: { object: { mode: 'payment', customer: 'cus_1', metadata: { guildId: 'G1', plan: 'agency' } } } });
        assert.strictEqual(guardado.premiumHasta, null);
        assert.strictEqual(guardado.plan, 'agency');
    });

    it('la renovación mueve la fecha; cancelar o impagar devuelve a Free', async () => {
        guardado = null;
        const fin2 = fin + 30 * 86400;
        await billing.procesarEvento({ type: 'customer.subscription.updated', data: { object: { id: 'sub_1', status: 'active', customer: 'cus_1', cancel_at_period_end: true, items: { data: [{ current_period_end: fin2 }] }, metadata: { guildId: 'G1', plan: 'pro' } } } });
        assert.strictEqual(Math.round(guardado.premiumHasta.getTime() / 1000), fin2);
        assert.strictEqual(guardado.premiumCancelaAlFinal, true);
        await billing.procesarEvento({ type: 'customer.subscription.updated', data: { object: { id: 'sub_1', status: 'unpaid', metadata: { guildId: 'G1' } } } });
        assert.strictEqual(guardado.esPremium, false);
        guardado = null;
        await billing.procesarEvento({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', metadata: { guildId: 'G1' } } } });
        assert.strictEqual(guardado.plan, 'free');
    });

    it('2.5.2: cancelar una suscripción solo quita el plan si es la de ese servidor (el de por vida no se toca)', async () => {
        let filtro = null;
        const antes = ServidorConfig.findOneAndUpdate;
        ServidorConfig.findOneAndUpdate = async (f, upd) => { filtro = f; guardado = { ...(guardado || {}), ...upd.$set }; return null; };
        try {
            await billing.procesarEvento({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_vieja', metadata: { guildId: 'G1' } } } });
            assert.deepStrictEqual(filtro.$or[0], { stripeSubscriptionId: 'sub_vieja' });
            assert.deepStrictEqual(filtro.$or[1], { stripeSubscriptionId: null, premiumHasta: { $ne: null } }, 'de por vida (sin fecha) queda fuera');
        } finally { ServidorConfig.findOneAndUpdate = antes; }
    });

    it('2.5.2: renovar una suscripción vieja no le pone fecha a un plan de por vida', async () => {
        const antes = { fou: ServidorConfig.findOneAndUpdate, ex: ServidorConfig.exists };
        const llamadas = [];
        ServidorConfig.findOneAndUpdate = async (f, upd) => { llamadas.push(f); return null; }; // el filtro no encaja: es de por vida
        ServidorConfig.exists = async () => ({ _id: 'x' });
        try {
            await billing.procesarEvento({ type: 'customer.subscription.updated', data: { object: { id: 'sub_vieja', status: 'active', customer: 'cus_1', items: { data: [{ current_period_end: fin }] }, metadata: { guildId: 'G1', plan: 'pro' } } } });
            assert.strictEqual(llamadas.length, 1, 'no se vuelve a guardar sin el filtro');
            assert.deepStrictEqual(llamadas[0].$nor, [{ esPremium: true, premiumHasta: null, stripeSubscriptionId: null }]);
        } finally { ServidorConfig.findOneAndUpdate = antes.fou; ServidorConfig.exists = antes.ex; }
    });

    it('2.5.2: un pago que aún no se ha cobrado no activa nada', async () => {
        guardado = null;
        await billing.procesarEvento({ type: 'checkout.session.completed', data: { object: { mode: 'payment', payment_status: 'unpaid', customer: 'cus_1', metadata: { guildId: 'G1', plan: 'pro' } } } });
        assert.strictEqual(guardado, null);
        await billing.procesarEvento({ type: 'checkout.session.async_payment_succeeded', data: { object: { mode: 'payment', payment_status: 'paid', customer: 'cus_1', metadata: { guildId: 'G1', plan: 'pro' } } } });
        assert.strictEqual(guardado.esPremium, true);
    });

    it('finPeriodo lee la fecha de la suscripción o de sus líneas', () => {
        assert.strictEqual(billing.finPeriodo({ current_period_end: 100 }).getTime(), 100000);
        assert.strictEqual(billing.finPeriodo({ items: { data: [{ current_period_end: 50 }, { current_period_end: 200 }] } }).getTime(), 200000);
        assert.strictEqual(billing.finPeriodo({}), null);
    });
});

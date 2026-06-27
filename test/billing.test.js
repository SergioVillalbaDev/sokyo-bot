// ============================================================================
// Tests de la lógica de COBRO (utils/billing.js).
//
// Usan el runner nativo de Node (`node --test`), sin dependencias externas.
//   Ejecutar:  npm test
//
// Cubren el corazón del riesgo del cobro:
//   · que el premium se respete y CADUQUE bien (premiumActivo / nivel),
//   · que los tramos free/pro/agency se calculen bien,
//   · que la cuota de IA se reinicie al cambiar de mes,
//   · que los webhooks de Stripe se traduzcan al cambio de plan correcto.
//
// Las funciones que escriben en Mongo se prueban sustituyendo (stub) los
// métodos del modelo, así NO se toca ninguna base de datos real.
// ============================================================================
const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');

const billing = require('../utils/billing.js');
const ServidorConfig = require('../models/ServidorConfig.js');

// --- Helpers para construir configuraciones de prueba ---
const horas = (h) => new Date(Date.now() + h * 3600 * 1000);
const cfgFree = () => ({ esPremium: false, plan: 'free', premiumHasta: null });
const cfgPro = (premiumHasta = null) => ({ esPremium: true, plan: 'pro', premiumHasta });
const cfgAgency = (premiumHasta = null) => ({ esPremium: true, plan: 'agency', premiumHasta });
const mesActual = () => new Date().toISOString().slice(0, 7);

// --- Sustitución de métodos del modelo (sin BD real) ---
const originales = {};
function stub(metodo, impl) {
    if (!(metodo in originales)) originales[metodo] = ServidorConfig[metodo];
    ServidorConfig[metodo] = impl;
}
function restaurar() {
    for (const k of Object.keys(originales)) ServidorConfig[k] = originales[k];
    for (const k of Object.keys(originales)) delete originales[k];
}

// ----------------------------------------------------------------------------
describe('premiumActivo (¿plan de pago vigente?)', () => {
    it('un servidor free no tiene premium', () => assert.equal(billing.premiumActivo(cfgFree()), false));
    it('null / undefined no tiene premium', () => assert.equal(billing.premiumActivo(null), false));
    it('pro de por vida (premiumHasta null) está activo', () => assert.equal(billing.premiumActivo(cfgPro(null)), true));
    it('pro con periodo en el futuro está activo', () => assert.equal(billing.premiumActivo(cfgPro(horas(24))), true));
    it('pro con periodo ya vencido NO está activo', () => assert.equal(billing.premiumActivo(cfgPro(horas(-1))), false));
});

describe('nivel / esPro / esAgency (tramos)', () => {
    it('free', () => {
        assert.equal(billing.nivel(cfgFree()), 'free');
        assert.equal(billing.esPro(cfgFree()), false);
        assert.equal(billing.esAgency(cfgFree()), false);
    });
    it('pro', () => {
        assert.equal(billing.nivel(cfgPro()), 'pro');
        assert.equal(billing.esPro(cfgPro()), true);
        assert.equal(billing.esAgency(cfgPro()), false);
    });
    it('agency', () => {
        assert.equal(billing.nivel(cfgAgency()), 'agency');
        assert.equal(billing.esPro(cfgAgency()), true);
        assert.equal(billing.esAgency(cfgAgency()), true);
    });
    it('un plan caducado cae a free aunque ponga agency', () => {
        assert.equal(billing.nivel(cfgAgency(horas(-1))), 'free');
        assert.equal(billing.esPro(cfgAgency(horas(-1))), false);
    });
});

describe('precioId (mapa plan+intervalo -> price de Stripe)', () => {
    afterEach(() => {
        delete process.env.STRIPE_PRICE_PRO_MONTH;
        delete process.env.STRIPE_PRICE_AGENCY_YEAR;
    });
    it('devuelve el price configurado en el .env', () => {
        process.env.STRIPE_PRICE_PRO_MONTH = 'price_pro_m';
        process.env.STRIPE_PRICE_AGENCY_YEAR = 'price_ag_y';
        assert.equal(billing.precioId('pro', 'month'), 'price_pro_m');
        assert.equal(billing.precioId('agency', 'year'), 'price_ag_y');
    });
    it('plan/intervalo válido pero sin env => null', () => assert.equal(billing.precioId('pro', 'lifetime'), null));
    it('plan desconocido => null', () => assert.equal(billing.precioId('inventado', 'month'), null));
});

describe('cuota de IA (estadoIA: reinicio mensual)', () => {
    it('cuotas por tramo', () => {
        assert.equal(billing.cuotaIA(cfgFree()), 5);
        assert.equal(billing.cuotaIA(cfgPro()), 150);
        assert.equal(billing.cuotaIA(cfgAgency()), 1500);
    });
    it('sin usos este mes => restantes = cuota', () => {
        const e = billing.estadoIA(cfgPro());
        assert.equal(e.usos, 0);
        assert.equal(e.restantes, 150);
    });
    it('los usos del mes EN CURSO cuentan', () => {
        const e = billing.estadoIA({ ...cfgPro(), iaUsos: 10, iaMesRef: mesActual() });
        assert.equal(e.usos, 10);
        assert.equal(e.restantes, 140);
    });
    it('los usos de un mes anterior se ignoran (se reinicia)', () => {
        const e = billing.estadoIA({ ...cfgPro(), iaUsos: 999, iaMesRef: '2020-01' });
        assert.equal(e.usos, 0);
        assert.equal(e.restantes, 150);
    });
    it('cuota agotada => restantes 0, nunca negativo', () => {
        const e = billing.estadoIA({ ...cfgFree(), iaUsos: 99, iaMesRef: mesActual() });
        assert.equal(e.restantes, 0);
    });
});

describe('activarPlan / desactivarPlan (escritura en BD)', () => {
    afterEach(restaurar);

    it('activarPlan marca esPremium=true con su plan y datos de Stripe', async () => {
        let args;
        stub('findOneAndUpdate', async (...a) => { args = a; return {}; });
        await billing.activarPlan('G1', {
            plan: 'pro', premiumHasta: null, stripeCustomerId: 'cus_1',
            stripeSubscriptionId: 'sub_1', cancelaAlFinal: false,
        });
        const [filtro, update, opts] = args;
        assert.deepEqual(filtro, { guildId: 'G1' });
        assert.equal(update.$set.esPremium, true);
        assert.equal(update.$set.plan, 'pro');
        assert.equal(update.$set.premiumHasta, null);
        assert.equal(update.$set.stripeCustomerId, 'cus_1');
        assert.equal(update.$set.stripeSubscriptionId, 'sub_1');
        assert.equal(update.$set.premiumCancelaAlFinal, false);
        assert.equal(opts.upsert, true);
    });

    it('desactivarPlan devuelve el servidor a free', async () => {
        let args;
        stub('findOneAndUpdate', async (...a) => { args = a; return {}; });
        await billing.desactivarPlan('G1');
        const [filtro, update] = args;
        assert.deepEqual(filtro, { guildId: 'G1' });
        assert.equal(update.$set.esPremium, false);
        assert.equal(update.$set.plan, 'free');
        assert.equal(update.$set.stripeSubscriptionId, null);
    });
});

describe('consumirIA (suma 1 uso)', () => {
    afterEach(restaurar);

    it('incrementa el uso del mes en curso', async () => {
        let args;
        stub('updateOne', async (...a) => { args = a; return {}; });
        const r = await billing.consumirIA('G1', { ...cfgPro(), iaUsos: 4, iaMesRef: mesActual() });
        assert.equal(r.usos, 5);
        assert.equal(r.restantes, 145);
        assert.equal(args[1].$set.iaUsos, 5);
        assert.equal(args[1].$set.iaMesRef, mesActual());
    });

    it('reinicia el contador si el mes cambió', async () => {
        stub('updateOne', async () => ({}));
        const r = await billing.consumirIA('G1', { ...cfgPro(), iaUsos: 100, iaMesRef: '2020-01' });
        assert.equal(r.usos, 1); // arranca de 0 y suma 1
    });
});

describe('barrerPremiumCaducado (red de seguridad)', () => {
    afterEach(restaurar);

    it('devuelve a free los caducados, respetando los de por vida', async () => {
        let args;
        stub('updateMany', async (...a) => { args = a; return { modifiedCount: 3 }; });
        const n = await billing.barrerPremiumCaducado();
        assert.equal(n, 3);
        const [filtro, update] = args;
        assert.equal(filtro.esPremium, true);
        assert.equal(filtro.premiumHasta.$ne, null);   // los lifetime (null) NO se tocan
        assert.ok(filtro.premiumHasta.$lt instanceof Date);
        assert.equal(update.$set.plan, 'free');
        assert.equal(update.$set.esPremium, false);
    });
});

describe('procesarEvento (webhook de Stripe -> cambio de plan)', () => {
    afterEach(restaurar);

    it('checkout completado en modo pago (lifetime) activa premium de por vida', async () => {
        let args;
        stub('findOneAndUpdate', async (...a) => { args = a; return {}; });
        await billing.procesarEvento({
            type: 'checkout.session.completed',
            data: { object: { mode: 'payment', customer: 'cus_1', metadata: { guildId: 'G1', plan: 'pro' } } },
        });
        assert.ok(args, 'debe escribir en la BD');
        assert.equal(args[1].$set.esPremium, true);
        assert.equal(args[1].$set.premiumHasta, null); // de por vida
    });

    it('suscripción activa: guarda plan, cliente y fecha de renovación', async () => {
        let args;
        stub('findOneAndUpdate', async (...a) => { args = a; return {}; });
        const fin = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
        await billing.procesarEvento({
            type: 'customer.subscription.updated',
            data: { object: { id: 'sub_1', status: 'active', customer: 'cus_1', current_period_end: fin, cancel_at_period_end: false, metadata: { guildId: 'G1', plan: 'agency' } } },
        });
        assert.equal(args[1].$set.esPremium, true);
        assert.equal(args[1].$set.plan, 'agency');
        assert.ok(args[1].$set.premiumHasta instanceof Date);
        assert.equal(args[1].$set.premiumCancelaAlFinal, false);
    });

    it('suscripción cancelada (status canceled) vuelve a free', async () => {
        let args;
        stub('findOneAndUpdate', async (...a) => { args = a; return {}; });
        await billing.procesarEvento({
            type: 'customer.subscription.updated',
            data: { object: { id: 'sub_1', status: 'canceled', customer: 'cus_1', metadata: { guildId: 'G1' } } },
        });
        assert.equal(args[1].$set.esPremium, false);
        assert.equal(args[1].$set.plan, 'free');
    });

    it('suscripción borrada vuelve a free', async () => {
        let args;
        stub('findOneAndUpdate', async (...a) => { args = a; return {}; });
        await billing.procesarEvento({
            type: 'customer.subscription.deleted',
            data: { object: { customer: 'cus_1', metadata: { guildId: 'G1' } } },
        });
        assert.equal(args[1].$set.esPremium, false);
    });

    it('un evento sin guildId NO toca la base de datos', async () => {
        let llamado = false;
        stub('findOneAndUpdate', async () => { llamado = true; return {}; });
        await billing.procesarEvento({
            type: 'checkout.session.completed',
            data: { object: { mode: 'payment', metadata: {} } },
        });
        assert.equal(llamado, false);
    });
});

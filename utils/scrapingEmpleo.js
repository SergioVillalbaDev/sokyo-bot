// ============================================================================
// Scraping de ofertas de empleo (InfoJobs + JobToday) para /buscoempleo.
//
// IMPORTANTE — esto es scraping "best-effort":
//   - InfoJobs bloquea activamente peticiones sin navegador real (antibot tipo
//     Cloudflare/Akamai): por eso usamos Puppeteer con el plugin stealth en vez
//     de un simple fetch. Aun así no hay garantía de que no lo siga bloqueando.
//   - JobToday renderiza los resultados por JavaScript (SPA), así que también
//     necesita un navegador real.
//   - Los selectores de abajo están escritos según la estructura conocida de
//     hoy de ambos portales. Es ESPERABLE tener que ajustarlos (banners de
//     cookies, cambios de maquetación, nuevos bloqueos) tras la primera
//     ejecución real: revisa los logs de aviso si un portal devuelve 0 ofertas.
//
// Cada función de portal captura sus propios errores y nunca tira el resto de
// la búsqueda: si InfoJobs falla, JobToday sigue funcionando (y viceversa).
//
// "Modo degradado": si un portal falla varias veces seguidas, dejamos de
// intentarlo durante unas horas en vez de insistir contra un bloqueo activo
// (evita empeorar un posible bloqueo de IP/cuenta).
// ============================================================================
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// Al fallar una búsqueda, guarda una captura de la página tal cual estaba en
// ese momento. Sin esto, diagnosticar un fallo que solo pasa en la Pi (sin
// pantalla propia) obliga a ir probando cambios a ciegas y esperar al
// siguiente intento real — con la captura se ve directamente qué mostró el
// portal (banner distinto, captcha, maquetación nueva...).
async function guardarCapturaDebug(page, portal) {
    try {
        const carpeta = process.env.JOB_SEARCH_OUTPUT_DIR || path.join(__dirname, '..', 'output', 'job-search');
        const dir = path.join(carpeta, '_debug');
        fs.mkdirSync(dir, { recursive: true });
        const ruta = path.join(dir, `${portal}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`);
        await page.screenshot({ path: ruta });
        console.warn(`📸 ${portal}: captura de depuración guardada en ${ruta}`);
    } catch (err) {
        console.warn(`No se pudo guardar la captura de depuración de ${portal}:`, err.message);
    }
}

const UMBRAL_FALLOS_CONSECUTIVOS = 3;
const PAUSA_TRAS_FALLOS_MS = 6 * 60 * 60 * 1000; // 6h

const estado = {
    infojobs: { fallos: 0, bloqueadoHasta: 0 },
    jobtoday: { fallos: 0, bloqueadoHasta: 0 },
};

function portalDisponible(nombre) {
    return Date.now() >= estado[nombre].bloqueadoHasta;
}

function registrarResultado(nombre, ok) {
    const e = estado[nombre];
    if (ok) { e.fallos = 0; e.bloqueadoHasta = 0; return; }
    e.fallos += 1;
    if (e.fallos >= UMBRAL_FALLOS_CONSECUTIVOS) {
        e.bloqueadoHasta = Date.now() + PAUSA_TRAS_FALLOS_MS;
        console.warn(`⚠️ Búsqueda de empleo: ${nombre} lleva ${e.fallos} fallos seguidos, en pausa ${PAUSA_TRAS_FALLOS_MS / 3600000}h.`);
    }
}

const UA_REALISTA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// page.waitForTimeout() se eliminó de Puppeteer (ya no existe en puppeteer-core
// 23.x, que es lo que usamos aquí) — este es el reemplazo directo.
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function lanzarBrowser() {
    return puppeteer.launch({
        headless: 'new',
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // poco /dev/shm en la Raspberry Pi
        ],
    });
}

async function nuevaPagina(browser) {
    const page = await browser.newPage();
    await page.setUserAgent(UA_REALISTA);
    await page.setViewport({ width: 1366, height: 900 });
    return page;
}

// Acepta el banner de cookies si aparece (varía el texto/selector según el
// portal, e incluso el IDIOMA: el navegador headless puede recibir la web en
// inglés aunque el resto del scraping asuma español — InfoJobs, por ejemplo,
// nos la sirve con botones "Agree and close" / "Disagree and close", no
// "Aceptar"). Primero probamos IDs conocidos de gestores de consentimiento
// habituales (más fiable que el texto), y si no, caemos al texto en ambos
// idiomas.
const SELECTORES_CONSENTIMIENTO_CONOCIDOS = [
    '#didomi-notice-agree-button', // Didomi (InfoJobs y otros)
    '#onetrust-accept-btn-handler', // OneTrust
    'button[data-testid="uc-accept-all-button"]', // Usercentrics
];
async function aceptarCookiesSiHay(page, textos = ['Aceptar', 'Accept', 'Aceptar todas', 'Agree and close', 'Agree', 'I agree', 'Accept all']) {
    // Sondeo en vez de una espera fija: en hardware lento (p. ej. la Raspberry
    // Pi frente a un PC de pruebas) el banner de consentimiento puede tardar
    // bastante más en pintarse que en una máquina rápida, y una espera fija
    // corta lo buscaba antes de que existiera.
    const intentosMax = 16; // 16 x 500ms = 8s como mucho
    for (let intento = 0; intento < intentosMax; intento++) {
        try {
            for (const sel of SELECTORES_CONSENTIMIENTO_CONOCIDOS) {
                const boton = await page.$(sel);
                if (boton) { await boton.click().catch(() => {}); await esperar(500); return; }
            }
            const botones = await page.$$('button');
            for (const b of botones) {
                const texto = (await page.evaluate((el) => el.textContent, b) || '').trim();
                if (textos.some((t) => texto.includes(t))) {
                    await b.click().catch(() => {});
                    await esperar(500);
                    return;
                }
            }
        } catch { /* DOM aún cambiando entre intentos, seguimos sondeando */ }
        await esperar(500);
    }
    // Sin banner tras 8s: probablemente no había, seguimos sin más.
}

// Extrae tarjetas de oferta a partir de un patrón de URL (más resistente a
// cambios de clases CSS que depender de nombres de clase concretos).
async function extraerPorPatronUrl(page, patronUrl, limite) {
    return page.evaluate((patronStr, lim) => {
        const patron = new RegExp(patronStr, 'i');
        const anclas = Array.from(document.querySelectorAll('a[href]'))
            .filter((a) => patron.test(a.href));
        const vistos = new Set();
        const resultado = [];
        for (const a of anclas) {
            if (vistos.has(a.href)) continue;
            vistos.add(a.href);
            // Sube hasta un contenedor razonable (tarjeta) para sacar más contexto.
            let contenedor = a;
            for (let i = 0; i < 4 && contenedor.parentElement; i++) contenedor = contenedor.parentElement;
            const texto = (contenedor.innerText || '').replace(/\s+/g, ' ').trim();
            const titulo = (a.innerText || '').replace(/\s+/g, ' ').trim() || texto.slice(0, 80);
            resultado.push({ url: a.href, titulo, descripcion: texto.slice(0, 1500) });
            if (resultado.length >= lim) break;
        }
        return resultado;
    }, patronUrl, limite);
}

// Un intento de búsqueda. InfoJobs a veces no llega a navegar tras pulsar
// "Buscar" (visto en pruebas reales: el mismo código funciona con un término
// y falla con otro, sin motivo aparente por nuestro lado — parece más un
// comportamiento intermitente del propio portal que un selector roto). Por
// eso esta función puede lanzar y quien la llama decide si reintenta.
async function intentarBuscarInfoJobs(page, puesto, ubicacion, limite) {
    await page.goto('https://www.infojobs.net/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await aceptarCookiesSiHay(page);

    const inputKeyword = await page.$('input#keyword, input[name="keyword"], input[name="palabra"]');
    if (!inputKeyword) throw new Error('No se encontró el campo de búsqueda (posible bloqueo o cambio de maquetación).');
    await inputKeyword.type(puesto, { delay: 30 });

    if (ubicacion) {
        const inputUbicacion = await page.$('input#provinceId, input[name="place"], input[name="provincia"]');
        if (inputUbicacion) await inputUbicacion.type(ubicacion, { delay: 30 });
    }

    // El botón "Buscar" (id="searchOffers") es más fiable que el Enter: en
    // pruebas reales, pulsar Enter no siempre envía el formulario (posible
    // JS del propio buscador escuchando el click, no el submit del campo).
    const botonBuscar = await page.$('#searchOffers');
    await Promise.all([
        botonBuscar ? botonBuscar.click() : page.keyboard.press('Enter'),
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
    ]);

    // Las ofertas de InfoJobs tienen URLs con el patrón "/of-i<id>".
    const ofertas = await extraerPorPatronUrl(page, '/of-i[0-9a-z]+', limite);
    if (!ofertas.length) throw new Error('0 ofertas extraídas: probable bloqueo antibot o cambio de maquetación (revisar selectores).');
    return ofertas;
}

async function buscarInfoJobs(page, puesto, ubicacion, limite = 20) {
    if (!portalDisponible('infojobs')) return { ofertas: [], error: 'InfoJobs en pausa tras varios bloqueos recientes.' };
    let ultimoError = null;
    for (let intento = 1; intento <= 2; intento++) {
        try {
            const ofertas = await intentarBuscarInfoJobs(page, puesto, ubicacion, limite);
            registrarResultado('infojobs', true);
            return { ofertas: ofertas.map((o) => ({ ...o, portal: 'infojobs', empresa: '', ubicacion: ubicacion || '' })), error: null };
        } catch (e) {
            ultimoError = e;
            if (intento === 1) console.warn(`⚠️ InfoJobs: intento 1 falló (${e.message}), reintentando...`);
        }
    }
    await guardarCapturaDebug(page, 'infojobs');
    registrarResultado('infojobs', false);
    return { ofertas: [], error: ultimoError.message };
}

async function buscarJobToday(page, puesto, ubicacion, limite = 20) {
    if (!portalDisponible('jobtoday')) return { ofertas: [], error: 'JobToday en pausa tras varios bloqueos recientes.' };
    try {
        const url = `https://www.jobtoday.com/es/search?keyword=${encodeURIComponent(puesto)}${ubicacion ? `&location=${encodeURIComponent(ubicacion)}` : ''}`;
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await aceptarCookiesSiHay(page);
        // SPA: dar un margen extra a que pinte los resultados tras el fetch inicial.
        await esperar(2000);

        const ofertas = await extraerPorPatronUrl(page, '/(job|jobs|oferta)/', limite);
        if (!ofertas.length) throw new Error('0 ofertas extraídas: probable cambio de maquetación (revisar selectores) o SPA no cargó a tiempo.');

        registrarResultado('jobtoday', true);
        return { ofertas: ofertas.map((o) => ({ ...o, portal: 'jobtoday', empresa: '', ubicacion: ubicacion || '' })), error: null };
    } catch (e) {
        await guardarCapturaDebug(page, 'jobtoday');
        registrarResultado('jobtoday', false);
        return { ofertas: [], error: e.message };
    }
}

// Abre la página de UNA oferta concreta para sacar la descripción completa y,
// si el portal las muestra públicamente, sus preguntas de selección (+ una
// captura de pantalla de esa sección, como referencia visual además del texto).
// Solo se llama para las pocas ofertas que ya superaron el umbral de match (no
// para todo el listado), así que el coste extra de red/RAM es pequeño.
//
// Best-effort: los portales no siempre exponen las preguntas fuera del propio
// formulario de inscripción (que no automatizamos, esto no envía candidaturas).
// Si no se detecta nada, se devuelve un array vacío sin romper la ejecución.
async function obtenerDetalleOferta(page, url) {
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await esperar(1000);
        const resultado = await page.evaluate(() => {
            const texto = (document.body.innerText || '').replace(/\s+/g, ' ').trim();
            // Heurística: busca una lista de preguntas cerca de una cabecera que
            // mencione "pregunta"/"cuestionario"/"question" (varía según el portal).
            // El contenedor donde se encuentran se marca con un atributo temporal
            // para poder capturarlo luego desde Node (page.$ no ve elementos, solo
            // selectores, así que hay que "etiquetarlo" dentro del propio DOM).
            const preguntas = [];
            let marcado = false;
            const cabeceras = Array.from(document.querySelectorAll('h2, h3, h4'))
                .filter((h) => /pregunta|cuestionario|question/i.test(h.textContent || ''));
            for (const h of cabeceras) {
                let siguiente = h.nextElementSibling;
                let saltos = 0;
                while (siguiente && saltos < 5 && !preguntas.length) {
                    const items = siguiente.querySelectorAll ? siguiente.querySelectorAll('li') : [];
                    for (const li of items) {
                        const t = (li.textContent || '').trim();
                        if (t.includes('?')) preguntas.push(t);
                    }
                    if (preguntas.length && !marcado) {
                        siguiente.setAttribute('data-sokyo-preguntas', '1');
                        marcado = true;
                    }
                    siguiente = siguiente.nextElementSibling;
                    saltos++;
                }
            }
            return { descripcionCompleta: texto.slice(0, 6000), preguntas: preguntas.slice(0, 10) };
        });

        let capturaPreguntas = null;
        if (resultado.preguntas.length) {
            try {
                const el = await page.$('[data-sokyo-preguntas="1"]');
                if (el) capturaPreguntas = await el.screenshot({ type: 'png' });
            } catch { /* la captura es un extra, no crítico: si falla se sigue sin ella */ }
        }

        return { ...resultado, capturaPreguntas };
    } catch (e) {
        return { descripcionCompleta: null, preguntas: [], capturaPreguntas: null, error: e.message };
    }
}

// Recorre las ofertas dadas (normalmente las pocas que van a adaptarse) con un
// único browser, secuencial. Devuelve un Map urlOferta -> {descripcionCompleta,
// preguntas}. Si el navegador falla al abrirse, devuelve un Map vacío (cada
// oferta se queda sin detalle extra, pero la ejecución sigue).
async function obtenerDetallesOfertas(ofertas) {
    const detalles = new Map();
    if (!ofertas.length) return detalles;
    let browser = null;
    try {
        browser = await lanzarBrowser();
        const page = await nuevaPagina(browser);
        for (const oferta of ofertas) {
            const url = oferta.urlOferta || oferta.url;
            const detalle = await obtenerDetalleOferta(page, url);
            detalles.set(url, detalle);
        }
    } catch (e) {
        console.warn('⚠️ Búsqueda de empleo: no se pudo abrir el navegador para los detalles de las ofertas:', e.message);
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
    return detalles;
}

// Orquesta ambos portales con un único browser (secuencial, no en paralelo, para
// no disparar el pico de RAM en la Raspberry Pi). Nunca lanza: siempre devuelve
// { infojobs: {ofertas, error}, jobtoday: {ofertas, error} }.
async function buscarOfertas(puesto, ubicacion, limite = 20) {
    let browser = null;
    try {
        browser = await lanzarBrowser();
        const page = await nuevaPagina(browser);

        const infojobs = await buscarInfoJobs(page, puesto, ubicacion, limite);
        const jobtoday = await buscarJobToday(page, puesto, ubicacion, limite);

        return { infojobs, jobtoday };
    } catch (e) {
        console.error('Búsqueda de empleo: fallo lanzando el navegador:', e.message);
        return {
            infojobs: { ofertas: [], error: 'No se pudo iniciar el navegador.' },
            jobtoday: { ofertas: [], error: 'No se pudo iniciar el navegador.' },
        };
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
}

module.exports = { buscarOfertas, buscarInfoJobs, buscarJobToday, lanzarBrowser, obtenerDetallesOfertas };

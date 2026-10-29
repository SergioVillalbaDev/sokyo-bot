// Peticiones a direcciones que escribe el staff (webhooks, webs con RSS): solo a
// internet. Se rechazan las IP privadas, locales y de enlace local, también tras
// cada redirección, para que nadie use el bot para asomarse a la red de la casa
// donde está la Raspberry Pi. Al leer un RSS, la IP que se comprueba es la misma a
// la que se conecta (sin una segunda consulta al DNS que pudiera dar otra).
const dns = require('dns');
const net = require('net');
const http = require('http');
const https = require('https');

// '::ffff:10.0.0.1' o '::ffff:a00:1' -> '10.0.0.1' (una IPv4 escrita como IPv6).
function ipv4Incrustada(ip) {
    const m = String(ip).toLowerCase().match(/^(?:0*:)*:?ffff:(.+)$/) || String(ip).toLowerCase().match(/^::(\d+\.\d+\.\d+\.\d+)$/);
    if (!m) return null;
    if (net.isIP(m[1]) === 4) return m[1];
    const hex = m[1].match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (!hex) return null;
    const a = parseInt(hex[1], 16);
    const b = parseInt(hex[2], 16);
    return `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`;
}

function ipEnRangoPrivado(ip) {
    if (net.isIP(ip) === 4) {
        const [a, b] = ip.split('.').map(Number);
        return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
    }
    if (net.isIP(ip) === 6) {
        const v4 = ipv4Incrustada(ip);
        if (v4) return ipEnRangoPrivado(v4);
        const low = ip.toLowerCase();
        return low === '::1' || low === '::' || low.startsWith('fe80:') || low.startsWith('fc') || low.startsWith('fd') || low.startsWith('ff');
    }
    return true; // no es una IP reconocible: por precaución, la tratamos como no segura
}

// ¿La dirección es http(s) y su servidor está en internet (no en una red privada)?
async function urlEsSegura(urlStr) {
    let url;
    try { url = new URL(urlStr); } catch { return false; }
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(host)) return !ipEnRangoPrivado(host);
    try {
        const direcciones = await dns.promises.lookup(host, { all: true });
        return direcciones.length > 0 && direcciones.every((d) => !ipEnRangoPrivado(d.address));
    } catch { return false; }
}

const noPermitida = () => Object.assign(new Error('Esa dirección no está permitida'), { code: 'EPRIVADA' });

// Búsqueda DNS para la conexión: si alguna IP es privada, no se conecta.
function lookupSeguro(hostname, opciones, cb) {
    dns.lookup(hostname, { ...opciones, all: true }, (err, direcciones) => {
        if (err) return cb(err);
        if (!direcciones.length || direcciones.some((d) => ipEnRangoPrivado(d.address))) return cb(noPermitida());
        if (opciones && opciones.all) return cb(null, direcciones);
        return cb(null, direcciones[0].address, direcciones[0].family);
    });
}

// Un GET (sin seguir redirecciones) que no pasa de `maxBytes`.
function getUnaVez(url, { cabeceras, maxBytes, timeoutMs }) {
    return new Promise((resolve, reject) => {
        const host = url.hostname.replace(/^\[|\]$/g, '');
        if (net.isIP(host) && ipEnRangoPrivado(host)) return reject(noPermitida());
        const modulo = url.protocol === 'https:' ? https : http;
        const peticion = modulo.get(url, { headers: { 'Accept-Encoding': 'identity', ...cabeceras }, lookup: lookupSeguro, timeout: timeoutMs }, (res) => {
            const partes = [];
            let total = 0;
            res.on('data', (trozo) => {
                total += trozo.length;
                if (total > maxBytes) { res.destroy(); reject(new Error('La respuesta es demasiado grande')); return; }
                partes.push(trozo);
            });
            res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location, texto: Buffer.concat(partes).toString('utf8') }));
            res.on('error', reject);
        });
        peticion.on('timeout', () => peticion.destroy(new Error('La web tarda demasiado en responder')));
        peticion.on('error', reject);
    });
}

// GET a una dirección pública, siguiendo como mucho 3 redirecciones (comprobando
// cada una) y leyendo como mucho `maxBytes`. Devuelve { status, url, texto }.
async function pedirTextoSeguro(urlStr, { cabeceras = {}, maxBytes = 2 * 1024 * 1024, timeoutMs = 12000 } = {}) {
    let actual = urlStr;
    for (let salto = 0; salto <= 3; salto++) {
        let url;
        try { url = new URL(actual); } catch { throw noPermitida(); }
        if (!['http:', 'https:'].includes(url.protocol)) throw noPermitida();
        const r = await getUnaVez(url, { cabeceras, maxBytes, timeoutMs });
        if (r.status >= 300 && r.status < 400 && r.location) {
            actual = new URL(r.location, actual).toString();
            continue;
        }
        return { status: r.status, url: actual, texto: r.texto };
    }
    throw new Error('Demasiadas redirecciones');
}

module.exports = { ipEnRangoPrivado, urlEsSegura, pedirTextoSeguro };

// Generador de captcha de imagen para la verificación de entrada.
// Devuelve { codigo, buffer } o null si @napi-rs/canvas no está disponible.
require('./fonts.js'); // registra las fuentes
const { FUENTE } = require('./fonts.js');

let createCanvas = null;
try { ({ createCanvas } = require('@napi-rs/canvas')); } catch { createCanvas = null; }

// Caracteres sin ambigüedad (sin 0/O, 1/I/L).
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function codigoAleatorio(n = 5) {
    let s = '';
    for (let i = 0; i < n; i++) s += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
    return s;
}

function aleatorio(min, max) { return Math.random() * (max - min) + min; }

// Genera el captcha. Si no hay canvas, devuelve solo el código (modo texto).
function generarCaptcha() {
    const codigo = codigoAleatorio(5);
    if (!createCanvas) return { codigo, buffer: null };

    const W = 320, H = 110;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // Fondo
    ctx.fillStyle = '#1e2030';
    ctx.fillRect(0, 0, W, H);

    // Ruido: líneas
    for (let i = 0; i < 8; i++) {
        ctx.strokeStyle = `hsla(${aleatorio(0, 360)}, 60%, 60%, 0.4)`;
        ctx.lineWidth = aleatorio(1, 2.5);
        ctx.beginPath();
        ctx.moveTo(aleatorio(0, W), aleatorio(0, H));
        ctx.lineTo(aleatorio(0, W), aleatorio(0, H));
        ctx.stroke();
    }
    // Ruido: puntos
    for (let i = 0; i < 120; i++) {
        ctx.fillStyle = `hsla(${aleatorio(0, 360)}, 70%, 70%, 0.5)`;
        ctx.beginPath();
        ctx.arc(aleatorio(0, W), aleatorio(0, H), aleatorio(0.5, 1.8), 0, Math.PI * 2);
        ctx.fill();
    }

    // Caracteres, cada uno rotado y desplazado
    const paso = W / (codigo.length + 1);
    for (let i = 0; i < codigo.length; i++) {
        ctx.save();
        ctx.translate(paso * (i + 1), H / 2 + aleatorio(-8, 8));
        ctx.rotate(aleatorio(-0.4, 0.4));
        ctx.font = `bold ${aleatorio(46, 58)}px ${FUENTE}`;
        ctx.fillStyle = `hsl(${aleatorio(0, 360)}, 75%, 75%)`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(codigo[i], 0, 0);
        ctx.restore();
    }

    return { codigo, buffer: canvas.toBuffer('image/png') };
}

module.exports = { generarCaptcha };

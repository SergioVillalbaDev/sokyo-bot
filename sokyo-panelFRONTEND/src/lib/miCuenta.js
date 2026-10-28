import { apiFetch } from './api';

// Del panel a «Mi cuenta» con la misma sesión: la API da una del portal (solo con
// tu usuario) y se abre /cuenta. Sin conexión, /cuenta pedirá entrar con Discord.
export async function abrirMiCuenta() {
  try {
    const res = await apiFetch('/api/staff/mi-cuenta', { method: 'POST' });
    const datos = await res.json().catch(() => ({}));
    if (res.ok && datos.token) { try { localStorage.setItem('portalToken', datos.token); } catch { /* sin almacenamiento */ } }
  } catch { /* sin conexión */ }
  window.location.href = '/cuenta';
}

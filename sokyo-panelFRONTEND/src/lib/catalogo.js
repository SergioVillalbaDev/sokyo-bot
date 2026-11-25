// Catálogo de funciones (1.34.0): lo mismo que usa el bot (utils/catalogo.js) — qué es cada función, sus comandos en
// Discord, si está encendida y su guía —, pedido una vez por servidor e idioma (GET /api/catalogo).
import { useEffect, useState } from 'react';
import { apiFetch, procesarRespuesta } from './api';

const cache = new Map(); // `${guildId}:${idioma}` → promesa
export function cargarCatalogo(guildId, idioma, { forzar = false } = {}) {
  const k = `${guildId || ''}:${idioma}`;
  if (forzar || !cache.has(k)) cache.set(k, apiFetch(`/api/catalogo?guildId=${encodeURIComponent(guildId || '')}`).then(procesarRespuesta).catch(() => null));
  return cache.get(k);
}
export const olvidarCatalogo = () => cache.clear();

export function useCatalogo(guildId, idioma, version = 0) {
  const [datos, setDatos] = useState(null);
  useEffect(() => {
    let vivo = true;
    cargarCatalogo(guildId, idioma, { forzar: version > 0 }).then((d) => { if (vivo) setDatos(d); });
    return () => { vivo = false; };
  }, [guildId, idioma, version]);
  return datos;
}
// Las funciones de una sección del panel (por su tab).
export const modulosDeTab = (catalogo, tab) => (catalogo?.modulos || []).filter((m) => m.tab === tab);

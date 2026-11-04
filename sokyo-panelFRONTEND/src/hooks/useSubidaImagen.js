// Elegir una imagen, GIF o vídeo (del móvil o del PC) y dejarla lista para subir:
// tipo real, GIF que no caben, WebP animados y vídeos a GIF… (lib/imagenes.js). Lo
// usan todos los campos de imagen del panel, para que se porten igual. El estado se
// pinta con <EstadoSubida sub={…} /> (components/dashboard/EstadoSubida.jsx).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { prepararImagen, aDataUrl, MAX_SUBIDA, enlaceGiphyDirecto, esPaginaTenor, tamanoLegible, textoErrorImagen } from '../lib/imagenes';
import { apiFetch } from '../lib/api';
import { marcarInteraccion } from './useAutoguardado';

// Lo que se puede elegir: cualquier imagen (también WebP o GIF de la galería) y vídeos
// cortos, que se convierten en GIF.
export const ACEPTA_IMAGEN = 'image/*,video/mp4,video/webm,video/quicktime';
export const ACEPTA_SOLO_IMAGEN = 'image/*';

export function useSubidaImagen({ max = MAX_SUBIDA, video = true, sinWebp = false } = {}) {
  const { t, i18n } = useTranslation();
  const [estado, setEstado] = useState(''); // '' | 'preparando' | 'subiendo' | 'error:…'
  const [progreso, setProgreso] = useState(0);
  const [nota, setNota] = useState('');
  const tamano = (bytes) => tamanoLegible(bytes, i18n.language);
  const textoError = (e) => textoErrorImagen(e, t, { max, idioma: i18n.language });

  // Prepara el archivo. Devuelve lo de prepararImagen o null (y deja el error puesto).
  const preparar = async (file) => {
    setEstado('preparando'); setProgreso(0); setNota('');
    try {
      const r = await prepararImagen(file, { max, video, sinWebp, alProgreso: (p) => setProgreso(Math.round(p * 100)) });
      setEstado('');
      if (r.cambio) {
        setNota(t(`dashboard.imagen.cambios.${r.cambio}`, { antes: tamano(file.size), despues: tamano(r.archivo.size) })
          + (r.recortado ? ` ${t('dashboard.imagen.recortado')}` : ''));
      }
      return r;
    } catch (e) {
      setEstado(`error:${textoError(e)}`);
      return null;
    }
  };

  // Sube un File (o un dataURL ya hecho, p. ej. el recorte) con la función del panel.
  const subir = async (subirImagen, origen) => {
    setEstado('subiendo');
    try {
      const datos = typeof origen === 'string' ? origen : await aDataUrl(origen);
      const r = await subirImagen(datos);
      if (!r || r.error) { setEstado(`error:${(r && r.error) || t('dashboard.imagen.errores.fallo')}`); return null; }
      setEstado('');
      marcarInteraccion(); // la subida tarda: que el autoguardado cuente el cambio como suyo
      return r;
    } catch {
      setEstado(`error:${t('dashboard.imagen.errores.fallo')}`);
      return null;
    }
  };

  return {
    estado, setEstado, progreso, nota, setNota, preparar, subir,
    ocupado: estado === 'preparando' || estado === 'subiendo',
    error: estado.startsWith('error:') ? estado.slice(6) : '',
  };
}

// Un enlace pegado a mano: si es la página de un GIF de Giphy o Tenor (que Discord no
// enseña como imagen), devuelve la dirección del GIF. { url, origen } o { error }.
export async function resolverEnlaceImagen(url) {
  const limpia = String(url || '').trim();
  const giphy = enlaceGiphyDirecto(limpia);
  if (giphy) return { url: giphy, origen: 'giphy' };
  if (!esPaginaTenor(limpia)) return { url: limpia, origen: null };
  try {
    const res = await apiFetch(`/api/imagen/enlace?url=${encodeURIComponent(limpia)}`);
    const d = await res.json().catch(() => ({}));
    marcarInteraccion(); // la respuesta tarda: el cambio que viene es de la persona
    return res.ok && d.url ? { url: d.url, origen: d.origen || 'tenor' } : { error: d.error || 'tenor' };
  } catch { return { error: 'tenor' }; }
}

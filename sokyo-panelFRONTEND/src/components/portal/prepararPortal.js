// «Mi cuenta»: preparar una imagen elegida antes de subirla, igual que en el panel
// (lib/imagenes.js: tipo real, GIF grandes, WebP animados, vídeos → GIF). Devuelve
// { datos (dataURL), nota } o lanza un Error con el texto ya traducido (portal.card.*).
import { prepararImagen, aDataUrl, tamanoLegible, textoErrorImagen } from '../../lib/imagenes';

// `opciones`: las de prepararImagen (p. ej. { video: false, ladoMinimo: 900 }).
export async function prepararParaSubir(archivo, t, opciones = {}, idioma) {
  try {
    const r = await prepararImagen(archivo, opciones);
    return {
      datos: await aDataUrl(r.archivo),
      nota: r.cambio ? t(`portal.card.imgCambio.${r.cambio}`, { despues: tamanoLegible(r.archivo.size, idioma) }) : '',
    };
  } catch (e) {
    throw new Error(textoErrorImagen(e, t, { idioma, clave: 'portal.card.imgError' }), { cause: e });
  }
}

// Imagen adjunta de un mensaje de ticket.
//
// Las imágenes que guarda el bot se sirven desde la API con autenticación (URLs relativas
// "/api/..."), así que un <img src> no basta: se descargan con `fetcher` (que añade la
// cabecera de autenticación) y se muestran como blob. Las URLs absolutas (respaldo del
// CDN de Discord en mensajes antiguos) se muestran tal cual.
import { useEffect, useState } from 'react';

const estiloAviso = { display: 'inline-block', fontSize: '0.85em', opacity: 0.7, fontStyle: 'italic', marginTop: '6px' };

export default function ImagenAdjunta({ src, fetcher, style }) {
  const protegida = typeof src === 'string' && src.startsWith('/');
  const [blob, setBlob] = useState({ src: null, url: null });
  const [srcFallida, setSrcFallida] = useState(null);

  useEffect(() => {
    if (!protegida) return;
    let cancelado = false;
    let objectUrl = null;
    fetcher(src)
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.blob(); })
      .then(datos => {
        if (cancelado) return;
        objectUrl = URL.createObjectURL(datos);
        setBlob({ src, url: objectUrl });
      })
      .catch(() => { if (!cancelado) setSrcFallida(src); });
    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, protegida, fetcher]);

  if (!src || srcFallida === src) return <span style={estiloAviso}>🖼️ Imagen no disponible</span>;

  const url = protegida ? (blob.src === src ? blob.url : null) : src;
  if (!url) return <span style={estiloAviso}>Cargando imagen…</span>;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img src={url} alt="Adjunto del ticket" style={style} onError={() => setSrcFallida(src)} />
    </a>
  );
}

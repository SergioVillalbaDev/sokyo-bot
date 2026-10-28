// Vídeo de demostración que se repite solo (como un GIF). Empieza cuando se ve
// en pantalla y se para al salir; mientras no, solo se ve su póster, que tampoco
// se pide hasta que el vídeo se acerca a la pantalla. Quien prefiere menos movimiento o ahorra datos lo ve quieto,
// con el botón ▶. Lo usan la landing (recorrido por el panel) y el panel
// («Ver cómo se hace»). Al cambiar de vídeo, el que lo usa le pone otra `key`.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause } from 'lucide-react';
import { videoDemo } from '../lib/videos';

const quieto = () => {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !!navigator.connection?.saveData;
  } catch { return false; }
};

export default function VideoDemo({ id, alt = '', className = '' }) {
  const { t, i18n } = useTranslation();
  const ref = useRef(null);
  const { mp4, webm, poster } = videoDemo(i18n.language, id);
  const [enMarcha, setEnMarcha] = useState(false);
  const [cerca, setCerca] = useState(() => typeof IntersectionObserver === 'undefined');
  // El usuario lo paró (o lo arrancó) a mano: entonces manda él, no el scroll.
  const [aMano, setAMano] = useState(quieto);

  useEffect(() => {
    const v = ref.current;
    if (!v || cerca) return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setCerca(true); io.disconnect(); } }, { rootMargin: '400px 0px' });
    io.observe(v);
    return () => io.disconnect();
  }, [cerca]);

  useEffect(() => {
    const v = ref.current;
    if (!v || aMano || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => {}); else v.pause();
    }, { threshold: 0.35 });
    io.observe(v);
    return () => io.disconnect();
  }, [aMano]);

  const alternar = () => {
    const v = ref.current;
    if (!v) return;
    setAMano(true);
    if (v.paused) v.play().catch(() => {}); else v.pause();
  };

  return (
    <div className={`relative ${className}`}>
      <video
        ref={ref} poster={cerca ? poster : undefined} muted loop playsInline preload="none" width="1280" height="800"
        aria-label={alt} onPlay={() => setEnMarcha(true)} onPause={() => setEnMarcha(false)}
        className="block h-auto w-full"
      >
        <source src={mp4} type={'video/mp4; codecs="avc1.640032"'} />
        <source src={webm} type={'video/webm; codecs="vp9"'} />
      </video>
      <button
        type="button" onClick={alternar} aria-label={enMarcha ? t('common.video.pause') : t('common.video.play')} title={enMarcha ? t('common.video.pause') : t('common.video.play')}
        className={`absolute grid place-items-center rounded-full border border-white/25 bg-black/55 text-white shadow-lg backdrop-blur-sm transition-all hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 ${enMarcha ? 'bottom-3 right-3 h-9 w-9 opacity-70 hover:opacity-100' : 'left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2'}`}
      >
        {enMarcha ? <Pause size={16} /> : <Play size={26} className="translate-x-0.5" />}
      </button>
    </div>
  );
}

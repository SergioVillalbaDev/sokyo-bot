// Red de seguridad para lo que se descarga por partes (secciones del panel, sus
// textos…). Si una parte no llega —lo normal justo después de un despliegue, con
// la pestaña abierta desde antes, o con la red del móvil cortada— se recarga la
// página una vez sola; si vuelve a fallar enseguida, se ofrece un botón.
import { Component } from 'react';
import { RefreshCw } from 'lucide-react';
import i18n from '../i18n';

const CLAVE = 'sokyoRecargaPorFallo';
const esFalloDeCarga = (e) => /dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError|Unable to preload|Loading chunk/i.test(`${e?.name} ${e?.message}`);

export default class RecargaSiFalla extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error) {
    if (!esFalloDeCarga(error)) return;
    let ultima = 0;
    try { ultima = Number(sessionStorage.getItem(CLAVE)) || 0; } catch { /* sin almacenamiento */ }
    if (Date.now() - ultima < 30000) return; // ya se recargó hace nada: no entrar en bucle
    try { sessionStorage.setItem(CLAVE, String(Date.now())); } catch { /* sin almacenamiento */ }
    window.location.reload();
  }

  render() {
    if (!this.state.error) return this.props.children;
    const t = (k) => i18n.t(`common.${k}`);
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-6 py-16 text-center" role="alert">
        <p className="text-base font-bold text-fg">{t('errorTitle')}</p>
        <p className="max-w-sm text-sm text-muted">{t('errorDesc')}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 inline-flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-on-brand shadow-soft transition-opacity hover:opacity-90"
        >
          <RefreshCw size={16} /> {t('reload')}
        </button>
      </div>
    );
  }
}

// Aviso «El bot escribe en inglés en este servidor» (1.9.14). El idioma del bot en
// Discord (ServidorConfig.idioma, inglés por defecto) es distinto del del panel (el
// del navegador), y por eso sus mensajes de fábrica salían en inglés aunque el panel
// estuviera en español. Sale solo si no coinciden, con un botón para cambiarlo ya
// (el bot adapta sus textos de fábrica y reescribe los paneles ya publicados).
// `ocultable`: con «Ocultar este aviso» (se recuerda por servidor en este navegador).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, Loader2, X } from 'lucide-react';

const claveOculto = (guildId) => `sokyoAvisoIdiomaBot:${guildId || ''}`;
const leerOculto = (guildId) => { try { return localStorage.getItem(claveOculto(guildId)) === '1'; } catch { return false; } };

export default function AvisoIdiomaBot({ dash, ocultable = false, className = '' }) {
  const { t, i18n } = useTranslation();
  const { configServidor, guildId, cambiarIdiomaBot, misPermisos } = dash;
  const [estado, setEstado] = useState(null); // null | 'cambiando' | { ok, idioma }
  const [oculto, setOculto] = useState(() => ocultable && leerOculto(guildId));

  const idiomaBot = configServidor?.idioma === 'es' ? 'es' : 'en';
  const idiomaPanel = String(i18n.language || '').toLowerCase().startsWith('es') ? 'es' : 'en';
  const nombre = (l) => t(`dashboard.idiomaBot.nombres.${l}`);

  // Recién cambiado: el aviso deja paso a la confirmación (o al error).
  if (estado && estado !== 'cambiando') {
    return (
      <p role="status" className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${estado.ok ? 'border-success/30 bg-success/10 text-success' : 'border-danger/40 bg-danger/10 text-danger'} ${className}`}>
        {estado.ok ? t('dashboard.idiomaBot.ok', { idioma: nombre(estado.idioma) }) : t('dashboard.idiomaBot.error')}
      </p>
    );
  }
  // Cambiarlo es de «Servidor y ajustes» (área config): sin ella, el botón siempre fallaría.
  const puede = !misPermisos || misPermisos.config !== false;
  if (!configServidor || typeof cambiarIdiomaBot !== 'function' || idiomaBot === idiomaPanel || oculto || !puede) return null;

  const cambiar = async () => {
    setEstado('cambiando');
    const ok = await cambiarIdiomaBot(idiomaPanel);
    setEstado({ ok, idioma: idiomaPanel });
  };
  const ocultar = () => {
    try { localStorage.setItem(claveOculto(guildId), '1'); } catch { /* sin almacenamiento: solo por ahora */ }
    setOculto(true);
  };

  return (
    <div className={`flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 sm:flex-row sm:items-center ${className}`} data-aviso="idioma-bot">
      <Languages size={20} className="hidden shrink-0 text-warning sm:block" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-fg">{t('dashboard.idiomaBot.titulo', { idioma: nombre(idiomaBot) })}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{t('dashboard.idiomaBot.desc', { idioma: nombre(idiomaBot) })}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={cambiar} disabled={estado === 'cambiando'}
          className="sk-foco flex items-center gap-1.5 rounded-xl bg-warning px-3 py-2 text-xs font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-60">
          {estado === 'cambiando' ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />}
          {estado === 'cambiando' ? t('dashboard.idiomaBot.cambiando') : t('dashboard.idiomaBot.boton', { otro: nombre(idiomaPanel) })}
        </button>
        {ocultable && (
          <button type="button" onClick={ocultar} title={t('dashboard.idiomaBot.ocultar')} aria-label={t('dashboard.idiomaBot.ocultar')}
            className="sk-foco grid h-8 w-8 place-items-center rounded-xl text-muted transition-colors hover:bg-elevated hover:text-fg">
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

// Resumen diario (Pro) — briefing del servidor escrito por IA, por MD al dueño
// (+ canal opcional) a la hora elegida. Gasta 1 uso de la cuota de IA al día.
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Send, Save, Check, AlertTriangle, Loader2, Info } from 'lucide-react';
import { Toggle } from '../../ui/primitives';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';

export default function ResumenView({ dash }) {
  const { t } = useTranslation();
  const { configServidor, canales, guardarResumen, probarResumen } = dash;

  const [activo, setActivo] = useState(false);
  const [hora, setHora] = useState(9);
  const [canalId, setCanalId] = useState('');
  const [estado, setEstado] = useState(''); // '', 'guardado', 'error'
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');

  // Carga inicial desde la config del servidor.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const rd = (configServidor && configServidor.resumenDiario) || {};
    setActivo(!!rd.activo);
    setHora(typeof rd.hora === 'number' ? rd.hora : 9);
    setCanalId(rd.canalId || '');
  }, [configServidor]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!configServidor) return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;

  const guardar = async () => {
    setEstado(''); setAviso('');
    const r = await guardarResumen({ activo, hora, canalId: canalId || null });
    setEstado(r.ok ? 'guardado' : 'error');
    if (r.error) setAviso(r.error);
  };
  const probar = async () => {
    setAviso(''); setEnviando(true);
    const r = await probarResumen();
    setEnviando(false);
    setAviso(r.ok ? t('dashboard.resumen_v.sent') : (r.error || t('dashboard.resumen_v.sendError')));
  };

  const field = 'rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg outline-none focus:ring-2 focus:ring-brand/40';
  const canalesTexto = canales || [];

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.resumen_v.intro')}</p>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-xs text-muted">{t('dashboard.resumen_v.note')}</p>
      </div>

      <div className={card}>
        <div data-help="resumen-toggle" className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-bold text-fg"><Mail size={18} className="text-brand" /> {t('dashboard.resumen_v.title')}</h3>
          <Toggle checked={activo} onChange={setActivo} />
        </div>

        <div data-help="resumen-cuando" className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted">{t('dashboard.resumen_v.hour')}</label>
            <select value={hora} onChange={(e) => setHora(parseInt(e.target.value, 10))} className={field}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00 UTC</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted">{t('dashboard.resumen_v.channel')}</label>
            <select value={canalId} onChange={(e) => setCanalId(e.target.value)} className={field}>
              <option value="">{t('dashboard.resumen_v.dmOnly')}</option>
              {canalesTexto.map((c) => <option key={c.id} value={c.id}># {c.nombre || c.name}</option>)}
            </select>
          </div>
        </div>

        <div data-help="resumen-acciones" className="mt-5 flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={guardar}
            className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-on-brand shadow-soft transition-opacity hover:opacity-90">
            <Save size={16} /> {t('dashboard.resumen_v.save')}
          </button>
          <button type="button" onClick={probar} disabled={enviando}
            className="flex items-center gap-2 rounded-2xl border border-line bg-bg px-5 py-2.5 text-sm font-bold text-fg transition-colors hover:border-brand disabled:opacity-50">
            {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {t('dashboard.resumen_v.test')}
          </button>
          {estado === 'guardado' && <span className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check size={16} /> {t('dashboard.resumen_v.saved')}</span>}
        </div>

        {aviso && <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-fg"><AlertTriangle size={15} className="text-warning" /> {aviso}</p>}
      </div>
    </div>
  );
}

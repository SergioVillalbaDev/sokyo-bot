// Canal «📖 Cómo funciona» (1.34.0): el bot escribe en un canal la guía de todo lo que hay encendido y la reescribe sola
// al cambiar algo (utils/guiaServidor.js). Aquí se elige el canal o se apaga. API: GET/POST /api/config/:g/guia.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Loader2, CheckCircle2 } from 'lucide-react';
import { apiFetch, procesarRespuesta } from '../../lib/api';
import { SelectCanal } from './views/crecimientoShared';

export default function GuiaCanal({ dash }) {
  const { t } = useTranslation();
  const { guildId, canales = [] } = dash;
  const [estado, setEstado] = useState(null);
  const [canalId, setCanalId] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!guildId) return;
    apiFetch(`/api/config/${guildId}/guia`).then(procesarRespuesta).then((r) => { setEstado(r); setCanalId(r.canalId || ''); }).catch(() => setEstado({ activo: false }));
  }, [guildId]);
  const guardar = async (id) => {
    setOcupado(true); setMsg('');
    try {
      await procesarRespuesta(await apiFetch(`/api/config/${guildId}/guia`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ canalId: id || null }) }));
      setEstado({ activo: !!id, canalId: id || null }); setMsg(id ? t('dashboard.guiaCanal.hecho') : t('dashboard.guiaCanal.apagada'));
    } catch (e) { setMsg(e.message); } finally { setOcupado(false); }
  };
  return (
    <div className="rounded-3xl border border-line bg-card p-5 shadow-soft" data-help="guia-canal">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand/15 text-brand"><BookOpen size={20} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-fg">{t('dashboard.guiaCanal.titulo')} {estado?.activo && <span className="ml-1 rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">{t('dashboard.guiaCanal.encendida')}</span>}</h3>
          <p className="mt-0.5 text-sm text-muted">{t('dashboard.guiaCanal.desc')}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="min-w-[200px] flex-1"><SelectCanal canales={canales} value={canalId} onChange={setCanalId} vacio={t('dashboard.guiaCanal.elige')} /></div>
            <button type="button" disabled={!canalId || ocupado} onClick={() => guardar(canalId)} className="sk-foco rounded-xl bg-brand px-4 py-2 text-sm font-bold text-on-brand disabled:opacity-50">
              {ocupado ? <Loader2 size={16} className="animate-spin" /> : estado?.activo ? t('dashboard.guiaCanal.actualizar') : t('dashboard.guiaCanal.publicar')}
            </button>
            {estado?.activo && <button type="button" disabled={ocupado} onClick={() => guardar(null)} className="sk-foco rounded-xl border border-line px-3 py-2 text-sm font-semibold text-muted hover:text-fg">{t('dashboard.guiaCanal.apagar')}</button>}
          </div>
          {msg && <p className="mt-2 flex items-center gap-1.5 text-sm text-muted"><CheckCircle2 size={14} className="text-success" /> {msg}</p>}
        </div>
      </div>
    </div>
  );
}

// Productividad · Auto-respuestas / triggers — si alguien escribe X, el bot
// responde Y. CRUD de reglas guardadas en la config del servidor.
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Toggle } from '../../ui/primitives';
import { MessagesSquare, Plus, Trash2, Save, Check, Info } from 'lucide-react';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none';

const REGLA_VACIA = { activo: true, nombre: '', patron: '', tipo: 'contiene', respuesta: '', comoEmbed: false, eliminarMensaje: false };

// Una tarjeta de regla (a nivel de módulo para cumplir react-hooks).
function ReglaCard({ regla, onSet, onDelete, t }) {
  return (
    <div className="rounded-2xl border border-line bg-bg p-4">
      <div className="flex items-center justify-between gap-3">
        <input
          value={regla.nombre}
          onChange={(e) => onSet('nombre', e.target.value)}
          className={input + ' max-w-xs font-semibold'}
          placeholder={t('dashboard.autoresp_v.namePh')}
          maxLength={80}
        />
        <div className="flex items-center gap-3">
          <Toggle checked={regla.activo} onChange={(v) => onSet('activo', v)} />
          <button type="button" onClick={onDelete} className="rounded-xl border border-line px-2 py-2 text-muted transition-colors hover:text-danger"><Trash2 size={15} /></button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.autoresp_v.trigger')}</span>
          <input value={regla.patron} onChange={(e) => onSet('patron', e.target.value)} className={input} placeholder={t('dashboard.autoresp_v.triggerPh')} maxLength={200} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.autoresp_v.matchType')}</span>
          <select value={regla.tipo} onChange={(e) => onSet('tipo', e.target.value)} className={input}>
            <option value="contiene">{t('dashboard.autoresp_v.type.contiene')}</option>
            <option value="exacto">{t('dashboard.autoresp_v.type.exacto')}</option>
            <option value="empieza">{t('dashboard.autoresp_v.type.empieza')}</option>
          </select>
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.autoresp_v.reply')}</span>
        <textarea value={regla.respuesta} onChange={(e) => onSet('respuesta', e.target.value)} rows={2} className={input} placeholder={t('dashboard.autoresp_v.replyPh')} maxLength={2000} />
      </label>

      <div className="mt-3 flex flex-wrap gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-fg">
          <input type="checkbox" checked={regla.comoEmbed} onChange={(e) => onSet('comoEmbed', e.target.checked)} className="h-4 w-4 cursor-pointer" />
          {t('dashboard.autoresp_v.asEmbed')}
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-fg">
          <input type="checkbox" checked={regla.eliminarMensaje} onChange={(e) => onSet('eliminarMensaje', e.target.checked)} className="h-4 w-4 cursor-pointer" />
          {t('dashboard.autoresp_v.deleteTrigger')}
        </label>
      </div>
    </div>
  );
}

export default function AutoRespuestasView({ dash }) {
  const { t } = useTranslation();
  const { configServidor, guardarAutoRespuestas } = dash;

  const [lista, setLista] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (configServidor) setLista(Array.isArray(configServidor.autoRespuestas) ? configServidor.autoRespuestas.map((a) => ({ ...REGLA_VACIA, ...a })) : []);
  }, [configServidor]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setRegla = (i, k, v) => { setGuardado(false); setLista((prev) => prev.map((r, idx) => (idx === i ? { ...r, [k]: v } : r))); };
  const addRegla = () => { setGuardado(false); setLista((prev) => [...prev, { ...REGLA_VACIA }]); };
  const delRegla = (i) => { setGuardado(false); setLista((prev) => prev.filter((_, idx) => idx !== i)); };

  const guardar = async () => {
    setGuardando(true);
    const ok = await guardarAutoRespuestas(lista.filter((r) => r.patron.trim() && r.respuesta.trim()));
    setGuardando(false);
    setGuardado(ok);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.autoresp_v.intro')}</p>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-xs text-muted">{t('dashboard.autoresp_v.note')}</p>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-bold text-fg"><MessagesSquare size={18} className="text-brand" /> {t('dashboard.autoresp_v.rules')} ({lista.length})</h3>
        <button type="button" onClick={addRegla} className="flex items-center gap-1.5 rounded-xl border border-line bg-bg px-3 py-2 text-sm font-semibold text-fg transition-colors hover:border-brand">
          <Plus size={15} /> {t('dashboard.autoresp_v.add')}
        </button>
      </div>

      {lista.length === 0 ? (
        <div className={card + ' text-center'}>
          <p className="py-4 text-sm italic text-muted">{t('dashboard.autoresp_v.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map((regla, i) => (
            <ReglaCard key={i} regla={regla} onSet={(k, v) => setRegla(i, k, v)} onDelete={() => delRegla(i)} t={t} />
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando || !configServidor}
          className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={16} /> {guardando ? t('dashboard.autoresp_v.saving') : t('dashboard.autoresp_v.save')}
        </button>
        {guardado && <span className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check size={16} /> {t('dashboard.autoresp_v.saved')}</span>}
      </div>
    </div>
  );
}

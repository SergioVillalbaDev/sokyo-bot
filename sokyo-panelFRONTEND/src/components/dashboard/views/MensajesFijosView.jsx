// Mensajes · Mensajes fijos — un mensaje que el bot mantiene siempre al final de un
// canal (normas, cómo pedir ayuda…): cuando alguien escribe, lo vuelve a publicar
// abajo. Lógica del bot en utils/mensajesFijos.js.
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pin, Plus, Trash2, Save, Loader2, Check, Pencil } from 'lucide-react';
import { Toggle } from '../../ui/primitives';
import { tarjeta, campo, CabeceraTarjeta, Campo, SelectCanal, Aviso } from './crecimientoShared';
import { Vacio, FilaInterruptor } from './modulosShared';

const NUEVO = { canalId: '', titulo: '', texto: '', color: '#a855f7', comoEmbed: true, activo: true };

// Vista previa con el aspecto de Discord.
function Previa({ f }) {
  if (!f.comoEmbed) {
    return <div className="whitespace-pre-wrap rounded-lg bg-[#313338] p-3 text-sm text-[#dbdee1]">📌 {f.titulo ? <b>{f.titulo}</b> : null}{f.titulo ? '\n' : ''}{f.texto}</div>;
  }
  return (
    <div className="rounded-lg bg-[#313338] p-3">
      <div className="rounded bg-[#2b2d31] p-3" style={{ borderLeft: `4px solid ${f.color || '#a855f7'}` }}>
        {f.titulo && <div className="mb-1 text-sm font-bold text-white">📌 {f.titulo}</div>}
        <div className="whitespace-pre-wrap text-sm text-[#dbdee1]">{f.texto}</div>
      </div>
    </div>
  );
}

export default function MensajesFijosView({ dash }) {
  const { t } = useTranslation();
  const { canales, cargarModulo, accionModulo } = dash;
  const [datos, setDatos] = useState(null);
  const [edicion, setEdicion] = useState(null); // { ...fijo } o NUEVO
  const [estado, setEstado] = useState('');

  const cargar = useCallback(async () => {
    const r = await cargarModulo('fijos');
    setDatos(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar(); }, [cargar]);

  if (!datos) return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  if (datos.error) return <Aviso tipo="alerta">{datos.error}</Aviso>;

  const nombreCanal = (id) => canales.find((c) => c.id === id)?.nombre || '?';
  const libres = canales.filter((c) => !datos.fijos.some((f) => f.canalId === c.id) || c.id === edicion?.canalId);
  const set = (k) => (v) => { setEdicion((e) => ({ ...e, [k]: v })); setEstado(''); };

  const guardar = async () => {
    setEstado('guardando');
    const r = edicion.id ? await accionModulo(`fijos/${edicion.id}`, 'PUT', edicion) : await accionModulo('fijos', 'POST', edicion);
    if (r.error) { setEstado(r.error); return; }
    setEstado(r.aviso || 'ok');
    setDatos((d) => ({ ...d, fijos: edicion.id ? d.fijos.map((f) => (f.id === r.fijo.id ? r.fijo : f)) : [...d.fijos, r.fijo] }));
    setEdicion(r.fijo);
  };
  const borrar = async (f) => {
    if (!window.confirm(t('dashboard.fijos_v.confirmDelete', { canal: nombreCanal(f.canalId) }))) return;
    const r = await accionModulo(`fijos/${f.id}`, 'DELETE');
    if (r.error) return;
    setDatos((d) => ({ ...d, fijos: d.fijos.filter((x) => x.id !== f.id) }));
    if (edicion?.id === f.id) setEdicion(null);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.fijos_v.intro')}</p>

      <div data-help="fijos-lista" className={tarjeta}>
        <CabeceraTarjeta icono={Pin} titulo={t('dashboard.fijos_v.title', { n: datos.fijos.length, max: datos.max })}
          extra={datos.fijos.length < datos.max && (
            <button type="button" onClick={() => { setEdicion({ ...NUEVO }); setEstado(''); }} className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-fg hover:border-brand"><Plus size={14} /> {t('dashboard.fijos_v.add')}</button>
          )} />
        {datos.fijos.length === 0 && !edicion ? (
          <Vacio icono={Pin} titulo={t('dashboard.fijos_v.emptyTitle')} sub={t('dashboard.fijos_v.emptySub')} />
        ) : (
          <ul className="mt-4 space-y-2">
            {datos.fijos.map((f) => (
              <li key={f.id} className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${edicion?.id === f.id ? 'border-brand bg-brand/5' : 'border-line bg-bg'}`}>
                <Pin size={16} className={f.activo ? 'text-brand' : 'text-muted'} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-fg">#{nombreCanal(f.canalId)}</span>
                  <span className="block truncate text-xs text-muted">{f.titulo || f.texto}</span>
                </span>
                {!f.activo && <span className="shrink-0 rounded-full bg-elevated px-2 py-0.5 text-xs text-muted">{t('dashboard.fijos_v.off')}</span>}
                <button type="button" onClick={() => { setEdicion({ ...f }); setEstado(''); }} className="shrink-0 rounded-xl border border-line p-2 text-muted hover:text-fg" aria-label={t('dashboard.fijos_v.edit')} title={t('dashboard.fijos_v.edit')}><Pencil size={14} /></button>
                <button type="button" onClick={() => borrar(f)} className="shrink-0 rounded-xl border border-line p-2 text-muted hover:text-danger" aria-label={t('dashboard.fijos_v.delete')} title={t('dashboard.fijos_v.delete')}><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {edicion && (
        <div data-help="fijos-editor" className={tarjeta}>
          <CabeceraTarjeta icono={Pencil} titulo={edicion.id ? t('dashboard.fijos_v.editTitle', { canal: nombreCanal(edicion.canalId) }) : t('dashboard.fijos_v.newTitle')} />
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <Campo etiqueta={t('dashboard.fijos_v.channel')}>
                {edicion.id
                  ? <input value={`#${nombreCanal(edicion.canalId)}`} disabled className={campo} />
                  : <SelectCanal canales={libres} value={edicion.canalId} onChange={set('canalId')} />}
              </Campo>
              <Campo etiqueta={t('dashboard.fijos_v.titleField')}><input maxLength={200} value={edicion.titulo} onChange={(e) => set('titulo')(e.target.value)} className={campo} placeholder={t('dashboard.fijos_v.titlePh')} /></Campo>
              <Campo etiqueta={t('dashboard.fijos_v.text')}><textarea rows={5} maxLength={3800} value={edicion.texto} onChange={(e) => set('texto')(e.target.value)} className={`${campo} resize-y`} placeholder={t('dashboard.fijos_v.textPh')} /></Campo>
              <div className="grid gap-3 sm:grid-cols-2">
                <FilaInterruptor titulo={t('dashboard.fijos_v.embed')}><Toggle checked={edicion.comoEmbed} onChange={set('comoEmbed')} /></FilaInterruptor>
                {edicion.comoEmbed && (
                  <label className="flex items-center gap-3 rounded-2xl border border-line bg-bg px-4 py-3">
                    <input type="color" value={edicion.color} onChange={(e) => set('color')(e.target.value)} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0" />
                    <span className="text-sm font-semibold text-fg">{t('dashboard.fijos_v.color')}</span>
                  </label>
                )}
              </div>
              <FilaInterruptor titulo={t('dashboard.fijos_v.active')} desc={t('dashboard.fijos_v.activeHint')}><Toggle checked={edicion.activo} onChange={set('activo')} /></FilaInterruptor>
            </div>
            <div>
              <span className="text-xs font-semibold text-muted">{t('dashboard.fijos_v.preview')}</span>
              <div className="mt-1.5"><Previa f={edicion} /></div>
              <p className="mt-2 text-xs text-muted">{t('dashboard.fijos_v.how')}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={guardar} disabled={estado === 'guardando' || !edicion.canalId}
              className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-on-brand shadow-soft hover:opacity-90 disabled:opacity-50">
              {estado === 'guardando' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {edicion.id ? t('dashboard.fijos_v.save') : t('dashboard.fijos_v.create')}
            </button>
            <button type="button" onClick={() => setEdicion(null)} className="rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-muted hover:text-fg">{t('dashboard.fijos_v.cancel')}</button>
            {estado === 'ok' && <span className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check size={16} /> {t('dashboard.fijos_v.saved')}</span>}
            {estado && !['ok', 'guardando'].includes(estado) && <span className="text-sm font-semibold text-danger">{estado}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// Crecimiento · Contadores en canales — canales de voz cerrados arriba del todo con
// una cifra en el nombre («👥 Miembros: 1.234») que el bot mantiene al día cada 10
// minutos (Discord no deja renombrar más a menudo). Lógica del bot en utils/contadoresCanal.js.
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Hash, Plus, Trash2, Loader2, Save, AlertTriangle } from 'lucide-react';
import { tarjeta, campo, CabeceraTarjeta, Campo, Aviso } from './crecimientoShared';
import { Vacio } from './modulosShared';

export default function ContadoresView({ dash }) {
  const { t, i18n } = useTranslation();
  const { categorias = [], cargarModulo, accionModulo } = dash;
  const [datos, setDatos] = useState(null);
  const [nuevo, setNuevo] = useState({ tipo: 'miembros', plantilla: '', categoriaId: '' });
  const [ocupado, setOcupado] = useState('');
  const [error, setError] = useState('');
  const [plantillas, setPlantillas] = useState({});

  const cargar = useCallback(async () => {
    const r = await cargarModulo('contadores');
    setDatos(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar(); }, [cargar]);

  if (!datos) return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  if (datos.error) return <Aviso tipo="alerta">{datos.error}</Aviso>;

  const es = i18n.language?.startsWith('es');
  const tipoTexto = (id) => { const x = datos.tipos.find((y) => y.id === id); return x ? (es ? x.es : x.en) : id; };
  const plantillaDe = (id) => tipoTexto(id);
  const crear = async () => {
    setOcupado('nuevo'); setError('');
    const r = await accionModulo('contadores', 'POST', { tipo: nuevo.tipo, plantilla: nuevo.plantilla || plantillaDe(nuevo.tipo), categoriaId: nuevo.categoriaId || null });
    setOcupado('');
    if (r.error) { setError(r.error); return; }
    setDatos((d) => ({ ...d, contadores: r.contadores }));
    setNuevo({ tipo: 'miembros', plantilla: '', categoriaId: '' });
  };
  const guardarPlantilla = async (c) => {
    setOcupado(c.canalId); setError('');
    const r = await accionModulo(`contadores/${c.canalId}`, 'PUT', { plantilla: plantillas[c.canalId] });
    setOcupado('');
    if (r.error) { setError(r.error); return; }
    setDatos((d) => ({ ...d, contadores: r.contadores }));
    setPlantillas((p) => { const q = { ...p }; delete q[c.canalId]; return q; });
  };
  const borrar = async (c) => {
    const borrarCanal = window.confirm(t('dashboard.contadores_v.confirmDelete'));
    const r = await accionModulo(`contadores/${c.canalId}${borrarCanal ? '?borrarCanal=1' : ''}`, 'DELETE');
    if (!r.error) setDatos((d) => ({ ...d, contadores: r.contadores }));
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.contadores_v.intro')}</p>
      <Aviso>{t('dashboard.contadores_v.limit')}</Aviso>
      {error && <Aviso tipo="alerta">{error}</Aviso>}

      <div data-help="contadores-lista" className={tarjeta}>
        <CabeceraTarjeta icono={Hash} titulo={t('dashboard.contadores_v.title', { n: datos.contadores.length, max: datos.max })} />
        {datos.contadores.length === 0 ? (
          <Vacio icono={Hash} titulo={t('dashboard.contadores_v.emptyTitle')} sub={t('dashboard.contadores_v.emptySub')} />
        ) : (
          <ul className="mt-4 space-y-2">
            {datos.contadores.map((c) => (
              <li key={c.canalId} className="rounded-2xl border border-line bg-bg p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-elevated px-2.5 py-1 text-xs font-semibold text-muted">{tipoTexto(c.tipo).replace(/:?\s*\{n\}/, '')}</span>
                  {c.existe
                    ? <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{c.nombre}</span>
                    : <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold text-danger"><AlertTriangle size={14} /> {t('dashboard.contadores_v.gone')}</span>}
                  <button type="button" onClick={() => borrar(c)} className="shrink-0 rounded-xl border border-line p-2 text-muted hover:text-danger" aria-label={t('dashboard.contadores_v.delete')} title={t('dashboard.contadores_v.delete')}><Trash2 size={14} /></button>
                </div>
                <div className="mt-2 flex gap-2">
                  <input maxLength={90} value={plantillas[c.canalId] ?? c.plantilla} onChange={(e) => setPlantillas((p) => ({ ...p, [c.canalId]: e.target.value }))} className={campo} aria-label={t('dashboard.contadores_v.template')} />
                  {plantillas[c.canalId] !== undefined && plantillas[c.canalId] !== c.plantilla && (
                    <button type="button" onClick={() => guardarPlantilla(c)} disabled={ocupado === c.canalId} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-brand px-3 text-xs font-bold text-on-brand disabled:opacity-50">
                      {ocupado === c.canalId ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} {t('dashboard.contadores_v.save')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {datos.contadores.length < datos.max && (
        <div data-help="contadores-nuevo" className={tarjeta}>
          <CabeceraTarjeta icono={Plus} titulo={t('dashboard.contadores_v.newTitle')} />
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <Campo etiqueta={t('dashboard.contadores_v.type')}>
              <select value={nuevo.tipo} onChange={(e) => setNuevo((n) => ({ ...n, tipo: e.target.value, plantilla: '' }))} className={campo}>
                {datos.tipos.map((x) => <option key={x.id} value={x.id}>{(es ? x.es : x.en).replace(/:?\s*\{n\}/, '')}</option>)}
              </select>
            </Campo>
            <Campo etiqueta={t('dashboard.contadores_v.template')} ayuda={t('dashboard.contadores_v.templateHint')}>
              <input maxLength={90} value={nuevo.plantilla} placeholder={plantillaDe(nuevo.tipo)} onChange={(e) => setNuevo((n) => ({ ...n, plantilla: e.target.value }))} className={campo} />
            </Campo>
            <Campo etiqueta={t('dashboard.contadores_v.category')}>
              <select value={nuevo.categoriaId} onChange={(e) => setNuevo((n) => ({ ...n, categoriaId: e.target.value }))} className={campo}>
                <option value="">{t('dashboard.contadores_v.top')}</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Campo>
          </div>
          <button type="button" onClick={crear} disabled={ocupado === 'nuevo'}
            className="mt-5 flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-on-brand shadow-soft hover:opacity-90 disabled:opacity-50">
            {ocupado === 'nuevo' ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} {t('dashboard.contadores_v.create')}
          </button>
          <p className="mt-2 text-xs text-muted">{t('dashboard.contadores_v.createHint')}</p>
        </div>
      )}
    </div>
  );
}

// Diversión · Confesiones — /confesar publica una confesión anónima. Con canal de
// revisión, el staff la aprueba antes. «Ver quién fue» es solo para casos de acoso
// y queda en el registro. Lógica del bot en utils/confesiones.js.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquareHeart, Inbox, Check, Trash2, Eye, Loader2 } from 'lucide-react';
import { Avatar } from '../../ui/primitives';
import { tarjeta, CabeceraTarjeta, Campo, SelectCanal, Aviso, BotonGuardar } from './crecimientoShared';
import { Vacio } from './modulosShared';
import { useModulo, useRelativo } from '../../../hooks/useModulo';
import VistaDiscord from '../VistaDiscord';

const COLOR = { pendiente: 'bg-warning/15 text-warning', publicada: 'bg-success/15 text-success', rechazada: 'bg-elevated text-muted' };
const FILTROS = ['todas', 'pendiente', 'publicada', 'rechazada'];

export default function ConfesionesView({ dash }) {
  const { t } = useTranslation();
  const { canales, accionModulo } = dash;
  const { datos, setDatos, form, set, guardar, estado, autoguardado } = useModulo(dash, 'confesiones');
  const relativo = useRelativo();
  const [filtro, setFiltro] = useState('todas');
  const [ocupado, setOcupado] = useState('');
  const [autores, setAutores] = useState({});
  const [error, setError] = useState('');

  if (!datos) return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  if (datos.error) return <Aviso tipo="alerta">{datos.error}</Aviso>;
  if (!form) return null;

  const cambiar = (c) => setDatos((d) => ({ ...d, confesiones: d.confesiones.map((x) => (x.id === c.id ? c : x)) }));
  const accion = async (c, tipo) => {
    setOcupado(`${tipo}:${c.id}`); setError('');
    const r = tipo === 'quitar'
      ? await accionModulo(`confesiones/${c.id}`, 'DELETE')
      : await accionModulo(`confesiones/${c.id}/revisar`, 'POST', { aprobar: tipo === 'aprobar' });
    setOcupado('');
    if (r.error) setError(r.error); else cambiar(r.confesion);
  };
  const verAutor = async (c) => {
    if (!window.confirm(t('dashboard.confes_v.revealConfirm'))) return;
    setOcupado(`autor:${c.id}`); setError('');
    const r = await accionModulo(`confesiones/${c.id}/autor`);
    setOcupado('');
    if (r.error) setError(r.error); else setAutores((a) => ({ ...a, [c.id]: r.autor }));
  };
  const lista = datos.confesiones.filter((c) => filtro === 'todas' || c.estado === filtro);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.confes_v.intro')}</p>
      {form.activo && !form.canalId && <Aviso tipo="alerta">{t('dashboard.confes_v.needChannel')}</Aviso>}

      <div data-help="confes-config" className={tarjeta}>
        <CabeceraTarjeta icono={MessageSquareHeart} titulo={t('dashboard.confes_v.title')} activo={form.activo} onActivo={set('activo')} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta={t('dashboard.confes_v.channel')}>
            <SelectCanal canales={canales} value={form.canalId} onChange={set('canalId')} />
          </Campo>
          <Campo etiqueta={t('dashboard.confes_v.review')} ayuda={t('dashboard.confes_v.reviewHint')}>
            <SelectCanal canales={canales} value={form.canalRevisionId} onChange={set('canalRevisionId')} vacio={t('dashboard.confes_v.noReview')} />
          </Campo>
        </div>
        <div className="mt-4"><Aviso>{t('dashboard.confes_v.safety')}</Aviso></div>
        <div className="mt-5"><BotonGuardar estado={estado} onClick={guardar} autoguardado={autoguardado} /></div>
      </div>

      {/* Cómo se ve en Discord (utils/confesiones.js: embedConfesion y el aviso de revisión) */}
      <div data-help="confes-previa" className={tarjeta}>
        <CabeceraTarjeta icono={MessageSquareHeart} titulo={t('dashboard.confes_v.prevTitle')} />
        <p className="mb-3 mt-1 text-xs text-muted">{t('dashboard.confes_v.prevHint')}</p>
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted">{t('dashboard.confes_v.prevStepPosted')}</p>
            <VistaDiscord embed={{ titulo: t('dashboard.confes_v.prevPosted'), descripcion: t('dashboard.confes_v.prevPostedText'), color: '#c084fc', pie: t('dashboard.confes_v.prevPostedFooter') }} />
          </div>
          {form.canalRevisionId && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted">{t('dashboard.confes_v.prevStepReview')}</p>
              <VistaDiscord embed={{ titulo: t('dashboard.confes_v.prevReview'), descripcion: t('dashboard.confes_v.prevPostedText'), color: '#fbbf24', pie: t('dashboard.confes_v.prevReviewFooter') }}
                botones={[{ texto: t('dashboard.confes_v.prevPublish'), estilo: 'verde' }, { texto: t('dashboard.confes_v.prevReject'), estilo: 'rojo' }]} />
            </div>
          )}
        </div>
      </div>

      <div data-help="confes-lista" className={tarjeta}>
        <CabeceraTarjeta icono={Inbox} titulo={t('dashboard.confes_v.list')} />
        <div className="mt-3 flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <button key={f} type="button" onClick={() => setFiltro(f)}
              className={`rounded-2xl border px-3 py-1.5 text-xs font-semibold transition-colors ${filtro === f ? 'border-brand bg-brand/10 text-brand' : 'border-line bg-card text-muted hover:text-fg'}`}>
              {t(`dashboard.confes_v.filtros.${f}`)}{f !== 'todas' && ` (${datos.confesiones.filter((c) => c.estado === f).length})`}
            </button>
          ))}
        </div>
        {error && <div className="mt-3"><Aviso tipo="alerta">{error}</Aviso></div>}
        {lista.length === 0 ? (
          <Vacio icono={MessageSquareHeart} titulo={t('dashboard.confes_v.emptyTitle')} sub={t('dashboard.confes_v.emptySub')} />
        ) : (
          <ul className="mt-4 space-y-2">
            {lista.map((c) => (
              <li key={c.id} className="rounded-2xl border border-line bg-bg p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-fg">{c.numero ? `#${c.numero}` : t('dashboard.confes_v.noNumber')}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR[c.estado]}`}>{t(`dashboard.confes_v.filtros.${c.estado}`)}</span>
                  <span className="text-xs text-muted">{relativo(c.fecha)}{c.revisadoPor ? ` · ${c.revisadoPor}` : ''}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-fg">{c.texto}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {c.estado === 'pendiente' && (
                    <>
                      <button type="button" onClick={() => accion(c, 'aprobar')} disabled={!!ocupado} className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-success hover:border-success disabled:opacity-50">
                        {ocupado === `aprobar:${c.id}` ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {t('dashboard.confes_v.publish')}
                      </button>
                      <button type="button" onClick={() => accion(c, 'rechazar')} disabled={!!ocupado} className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-muted hover:text-danger disabled:opacity-50">
                        <Trash2 size={12} /> {t('dashboard.confes_v.reject')}
                      </button>
                    </>
                  )}
                  {c.estado === 'publicada' && (
                    <button type="button" onClick={() => accion(c, 'quitar')} disabled={!!ocupado} className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-muted hover:text-danger disabled:opacity-50">
                      {ocupado === `quitar:${c.id}` ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} {t('dashboard.confes_v.remove')}
                    </button>
                  )}
                  {autores[c.id] ? (
                    <span className="ml-auto flex items-center gap-1.5 rounded-lg bg-elevated px-2.5 py-1 text-xs font-semibold text-fg"><Avatar src={autores[c.id].avatar} name={autores[c.id].nombre} size={16} /> {autores[c.id].nombre}</span>
                  ) : (
                    <button type="button" onClick={() => verAutor(c)} disabled={!!ocupado} className="ml-auto flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-muted hover:text-fg disabled:opacity-50">
                      <Eye size={12} /> {t('dashboard.confes_v.reveal')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

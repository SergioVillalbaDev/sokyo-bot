// Crecimiento · Página pública — una web del servidor (/s/<dirección>) con botón
// para unirse y aparición opcional en el directorio (/servidores). La página la
// genera el bot (utils/paginaPublica.js); aquí se configura.
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe2, SlidersHorizontal, Link2, ExternalLink, Copy, Check, X, Eye, LayoutGrid } from 'lucide-react';
import { Toggle } from '../../ui/primitives';
import { tarjeta, campo, CabeceraTarjeta, Campo, SelectCanal, Aviso, BotonGuardar } from './crecimientoShared';

const limpiarSlug = (v) => String(v || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 32);

function Opcion({ etiqueta, ayuda, checked, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-bg px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-fg">{etiqueta}</p>
        {ayuda && <p className="text-xs text-muted">{ayuda}</p>}
      </div>
      <Toggle checked={!!checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export default function CrecPaginaView({ dash }) {
  const { t } = useTranslation();
  const { canales, configServidor, cargarCrecimiento, guardarCrecimiento } = dash;

  const [datos, setDatos] = useState(null);
  const [form, setForm] = useState(null);
  const [estado, setEstado] = useState('');
  const [aviso, setAviso] = useState('');
  const [etiqueta, setEtiqueta] = useState('');
  const [copiado, setCopiado] = useState(false);

  const aplicar = (r) => { setDatos(r); setForm({ ...r.config, slug: r.config.slug || '', etiquetas: r.config.etiquetas || [] }); };
  const cargar = useCallback(async () => {
    const r = await cargarCrecimiento('pagina');
    if (r.error) { setDatos({ error: r.error }); return; }
    aplicar(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar(); }, [cargar]);

  if (!datos) return <p className="text-sm text-muted">{t('dashboard.crec_v.loading')}</p>;
  if (datos.error) return <Aviso tipo="alerta">{datos.error}</Aviso>;
  if (!form) return null;

  const set = (k) => (v) => { setForm((f) => ({ ...f, [k]: v })); setEstado(''); setAviso(''); };
  const nivelesActivos = !!(configServidor && configServidor.nivelesActivo);

  const anadirEtiqueta = () => {
    const e = etiqueta.replace(/[<>#,]/g, '').trim().slice(0, 24);
    if (e && form.etiquetas.length < 5 && !form.etiquetas.some((x) => x.toLowerCase() === e.toLowerCase())) set('etiquetas')([...form.etiquetas, e]);
    setEtiqueta('');
  };

  const guardar = async () => {
    setEstado('guardando'); setAviso('');
    const r = await guardarCrecimiento('pagina', form);
    if (r.error) { setEstado(r.error); return; }
    setEstado('ok');
    if (r.aviso) setAviso(r.aviso);
    aplicar(r);
  };

  const copiar = () => {
    if (!datos.url || !navigator.clipboard) return;
    navigator.clipboard.writeText(datos.url).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1800); });
  };

  const boton = 'flex items-center gap-1.5 rounded-xl border border-line bg-bg px-3 py-2 text-sm font-semibold text-fg transition-colors hover:border-brand';

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.crec_v.pagina.intro')}</p>
      {!form.activo && <Aviso>{t('dashboard.crec_v.pagina.notPublished')}</Aviso>}

      <div data-help="pagina-config" className={tarjeta}>
        <CabeceraTarjeta icono={Globe2} titulo={t('dashboard.crec_v.pagina.title')} activo={form.activo} onActivo={set('activo')} />
        <div className="mt-5 grid gap-4">
          <Campo etiqueta={t('dashboard.crec_v.pagina.address')} ayuda={t('dashboard.crec_v.pagina.addressHint')}>
            <div className="flex min-w-0 items-stretch overflow-hidden rounded-xl border border-line bg-bg focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30">
              <span className="hidden shrink-0 items-center border-r border-line bg-elevated px-3 text-xs text-muted sm:flex">{datos.base}</span>
              <input value={form.slug} onChange={(e) => set('slug')(limpiarSlug(e.target.value))} maxLength={32}
                placeholder={datos.sugerido} className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-fg outline-none" />
            </div>
          </Campo>
          {!form.slug && datos.sugerido && (
            <button type="button" onClick={() => set('slug')(datos.sugerido)} className="-mt-2 self-start text-xs font-semibold text-brand hover:underline">
              {t('dashboard.crec_v.pagina.useSuggested', { s: datos.sugerido })}
            </button>
          )}
          <Campo etiqueta={t('dashboard.crec_v.pagina.description')} ayuda={`${t('dashboard.crec_v.pagina.descriptionHint')} · ${(form.descripcion || '').length}/1000`}>
            <textarea rows={4} maxLength={1000} value={form.descripcion || ''} onChange={(e) => set('descripcion')(e.target.value)}
              placeholder={datos.descripcionDiscord || t('dashboard.crec_v.pagina.descriptionPh')} className={campo} />
          </Campo>
          <Campo etiqueta={t('dashboard.crec_v.pagina.tags')} ayuda={t('dashboard.crec_v.pagina.tagsHint')}>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-bg px-2 py-2 focus-within:border-brand">
              {form.etiquetas.map((e) => (
                <span key={e} className="flex items-center gap-1 rounded-full bg-brand/15 px-2.5 py-1 text-xs font-semibold text-brand">
                  #{e}
                  <button type="button" onClick={() => set('etiquetas')(form.etiquetas.filter((x) => x !== e))} aria-label="✕" className="hover:text-fg"><X size={12} /></button>
                </span>
              ))}
              {form.etiquetas.length < 5 && (
                <input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); anadirEtiqueta(); }
                    if (e.key === 'Backspace' && !etiqueta && form.etiquetas.length) set('etiquetas')(form.etiquetas.slice(0, -1));
                  }}
                  onBlur={anadirEtiqueta}
                  placeholder={t('dashboard.crec_v.pagina.tagsPh')} className="min-w-[10rem] flex-1 bg-transparent px-1 text-sm text-fg outline-none" />
              )}
            </div>
          </Campo>
          <Campo etiqueta={t('dashboard.crec_v.pagina.inviteChannel')} ayuda={t('dashboard.crec_v.pagina.inviteHint')}>
            <SelectCanal canales={canales} value={form.canalInvitacionId} onChange={set('canalInvitacionId')} vacio={t('dashboard.crec_v.pagina.inviteAuto')} />
          </Campo>
        </div>
      </div>

      <div data-help="pagina-opciones" className={tarjeta}>
        <CabeceraTarjeta icono={SlidersHorizontal} titulo={t('dashboard.crec_v.pagina.optionsTitle')} />
        <div className="mt-4 grid gap-3">
          <Opcion etiqueta={t('dashboard.crec_v.pagina.listed')} checked={form.listado} onChange={set('listado')} />
          <Opcion etiqueta={t('dashboard.crec_v.pagina.showEvents')} checked={form.mostrarEventos} onChange={set('mostrarEventos')} />
          <Opcion etiqueta={t('dashboard.crec_v.pagina.showRanking')} ayuda={nivelesActivos ? null : t('dashboard.crec_v.pagina.rankingOff')}
            checked={form.mostrarRanking && nivelesActivos} onChange={set('mostrarRanking')} disabled={!nivelesActivos} />
        </div>
      </div>

      <BotonGuardar estado={estado} onClick={guardar} />
      {aviso && <Aviso tipo="alerta">{aviso}</Aviso>}

      <div data-help="pagina-enlace" className={tarjeta}>
        <CabeceraTarjeta icono={Link2} titulo={t('dashboard.crec_v.pagina.linkTitle')}
          extra={<span className="flex items-center gap-1 text-xs text-muted"><Eye size={13} /> {t('dashboard.crec_v.pagina.visits', { n: datos.visitas || 0 })}</span>} />
        {datos.url ? (
          <>
            <p className="mt-4 break-all rounded-2xl border border-line bg-bg px-4 py-3 font-mono text-sm text-fg">{datos.url}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={datos.url} target="_blank" rel="noreferrer" className={boton}><ExternalLink size={15} /> {t('dashboard.crec_v.pagina.view')}</a>
              <button type="button" onClick={copiar} className={boton}>
                {copiado ? <Check size={15} className="text-success" /> : <Copy size={15} />} {copiado ? t('dashboard.crec_v.pagina.copied') : t('dashboard.crec_v.pagina.copy')}
              </button>
              <a href={datos.directorio} target="_blank" rel="noreferrer" className={boton}><LayoutGrid size={15} /> {t('dashboard.crec_v.pagina.directory')}</a>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted">{t('dashboard.crec_v.pagina.saveFirst')}</p>
        )}
        <p className="mt-4 text-xs text-muted">
          {t('dashboard.crec_v.pagina.invite')}: {datos.invitacion
            ? <a href={datos.invitacion} target="_blank" rel="noreferrer" className="font-mono text-brand hover:underline">{datos.invitacion}</a>
            : t('dashboard.crec_v.pagina.noInvite')}
        </p>
      </div>
    </div>
  );
}

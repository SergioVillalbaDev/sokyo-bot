// «Esto está apagado» (1.17.1): al entrar en una sección que está desactivada sale arriba,
// bien grande, qué hace, qué va a pasar al activarla y un botón «⚡ Activarlo ahora» que la
// deja funcionando con lo recomendado (lib/activar.js). Si el bot no sabe activarla solo,
// el botón lleva al interruptor de la sección y lo hace brillar. «Lo configuro yo» lo
// esconde mientras estés en esa sección.
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, Loader2, CheckCircle2, ChevronDown, Power, Sparkles, X } from 'lucide-react';
import { ubicacion } from './navConfig';
import { ACTIVABLE, activarSeccion } from '../../lib/activar';

// Lleva al primer interruptor de la sección y lo hace brillar.
function irAlInterruptor() {
  const zona = document.querySelector('[data-vista-seccion]') || document;
  const sw = zona.querySelector('[role="switch"]');
  const bloque = sw?.closest('[data-help]') || sw?.parentElement;
  if (!sw) return;
  sw.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (bloque) { bloque.classList.remove('sk-resaltado'); void bloque.offsetWidth; bloque.classList.add('sk-resaltado'); }
  sw.focus({ preventScroll: true });
}

export default function AvisoApagado({ tab, dash }) {
  const { t } = useTranslation();
  const [estado, setEstado] = useState('');       // '' | 'activando' | 'hecho'
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [oculto, setOculto] = useState(false);
  const { estadoModulos = {}, configServidor, guildId } = dash;
  // Fuera del Inicio la configuración general puede no estar cargada todavía: se pide.
  const falta = !configServidor;
  useEffect(() => {
    if (falta) dash.recargarSeccion?.({ soloDatos: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId, falta]);

  const u = ubicacion(tab);
  const conocido = Object.prototype.hasOwnProperty.call(estadoModulos, tab);
  // Ya activado en esta visita: se enseña el «¡Listo!» aunque el estado cambie.
  if (estado === 'hecho' && resultado) {
    return (
      <div className="sk-aparece mb-5 flex flex-col gap-3 rounded-3xl border border-success/40 bg-success/10 p-5 shadow-soft sm:flex-row sm:items-center">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-success/20 text-success"><CheckCircle2 size={24} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold text-fg">{t('dashboard.activar.hecho', { n: t(`dashboard.nav.items.${tab}`) })}</p>
          <p className="text-sm text-muted">
            {[
              // Si se han creado canales, se dicen una vez (no también en el detalle del paso).
              ...resultado.pasos.map((p) => p.detalle).filter((d) => d && !(resultado.creados.length && d.startsWith('#'))),
              ...(resultado.creados.length ? [t('dashboard.activar.creados', { lista: resultado.creados.map((c) => `#${c.nombre}`).join(', ') })] : []),
            ].join(' · ') || t('dashboard.activar.hechoSub')}
          </p>
          <p className="mt-1 text-xs font-semibold text-fg">{t('dashboard.activar.ahoraAfina')}</p>
        </div>
        <button type="button" onClick={() => { setResultado(null); setEstado(''); setOculto(true); }} className="sk-boton-icono shrink-0" aria-label={t('dashboard.activar.cerrar')}><X size={16} /></button>
      </div>
    );
  }
  if (!u || !conocido || estadoModulos[tab] || oculto || !configServidor) return null;

  const Icono = u.item.icon;
  const color = u.group.color;
  const modulo = ACTIVABLE[tab];
  const nombre = t(`dashboard.nav.items.${tab}`);
  const porque = t(`dashboard.asistente.porque.${tab}`, { defaultValue: t(`dashboard.meta.${tab}.subtitle`, { defaultValue: '' }) });

  const activar = async () => {
    setEstado('activando'); setError('');
    let tipo = 'comunidad';
    try { tipo = JSON.parse(localStorage.getItem(`sokyoAsistente:${guildId}`) || '{}').tipo || 'comunidad'; } catch { /* sin almacenamiento */ }
    const r = await activarSeccion(guildId, tab, { idioma: configServidor?.idioma, tipo });
    if (!r.ok) {
      setEstado('');
      setError(r.motivo === 'admin' ? t('dashboard.activar.errAdmin')
        : r.motivo === 'permisos' ? t('dashboard.setup.errPerms', { lista: r.permisos.map((p) => t(`dashboard.setup.perm.${p}`, { defaultValue: p })).join(', ') })
          : r.motivo === 'espera' ? t('dashboard.activar.errEspera')
            : r.detalle || t('dashboard.setup.errGeneric'));
      return;
    }
    setResultado(r); setEstado('hecho');
    // La sección se vuelve a cargar con lo nuevo (y el aviso pasa a «¡Listo!»).
    dash.recargarSeccion?.();
  };

  return (
    <div className="sk-aparece relative mb-5 overflow-hidden rounded-3xl border-2 p-5 shadow-soft sm:p-6" style={{ borderColor: `color-mix(in srgb, ${color} 55%, transparent)`, background: `linear-gradient(135deg, color-mix(in srgb, ${color} 16%, transparent), transparent 70%)` }}>
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-30 blur-3xl" style={{ background: color }} />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white shadow-soft" style={{ background: color }}>
          {Icono && <Icono size={26} />}
          <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-card bg-elevated text-muted"><Power size={12} /></span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.activar.apagadoEtiqueta')}</p>
          <h2 className="mt-0.5 text-xl font-black text-fg sm:text-2xl">{t('dashboard.activar.apagado', { n: nombre })}</h2>
          {porque && <p className="mt-1 text-sm text-fg/90">{porque}</p>}
          {modulo && (
            <div className="mt-3 rounded-2xl border border-line bg-bg/60 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-bold text-fg"><Sparkles size={13} className="text-brand" /> {t('dashboard.activar.alActivar')}</p>
              <ul className="mt-1.5 space-y-1 text-xs text-muted">
                {t(`dashboard.activar.que.${modulo}`, { returnObjects: true, defaultValue: [] }).map?.((x, i) => <li key={i}>✓ {x}</li>)}
              </ul>
            </div>
          )}
          {error && <p className="mt-3 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{error}</p>}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            {modulo ? (
              <button type="button" onClick={activar} disabled={estado === 'activando'}
                className="sk-foco flex items-center justify-center gap-2 rounded-2xl bg-gradient-brand px-6 py-3 text-base font-extrabold text-on-brand shadow-soft transition-transform hover:scale-[1.02] disabled:opacity-70">
                {estado === 'activando' ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                {estado === 'activando' ? t('dashboard.activar.activando') : t('dashboard.activar.boton')}
              </button>
            ) : (
              <button type="button" onClick={irAlInterruptor}
                className="sk-foco flex items-center justify-center gap-2 rounded-2xl bg-gradient-brand px-6 py-3 text-base font-extrabold text-on-brand shadow-soft transition-transform hover:scale-[1.02]">
                <Power size={18} /> {t('dashboard.activar.irInterruptor')}
              </button>
            )}
            <button type="button" onClick={() => { setOculto(true); if (modulo) setTimeout(irAlInterruptor, 50); }}
              className="sk-foco flex items-center justify-center gap-1 rounded-2xl px-4 py-3 text-sm font-semibold text-muted hover:text-fg">
              {modulo ? t('dashboard.activar.yoMismo') : t('dashboard.activar.ocultar')} <ChevronDown size={15} />
            </button>
          </div>
          {modulo && <p className="mt-2 text-[11px] text-muted">{t('dashboard.activar.seguro')}</p>}
        </div>
      </div>
    </div>
  );
}

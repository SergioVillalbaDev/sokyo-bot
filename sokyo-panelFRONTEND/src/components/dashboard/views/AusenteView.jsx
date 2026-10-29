// Mensajes · Ausente y traducir — /ausente avisa a quien te menciona de que no
// estás (se quita solo al volver a escribir) y el clic derecho «Traducir» pone
// cualquier mensaje en tu idioma. Lógica del bot en utils/ausente.js y utils/traducir.js.
import { useTranslation } from 'react-i18next';
import { Moon, Languages, MousePointerClick, Users, X } from 'lucide-react';
import { Avatar, Toggle } from '../../ui/primitives';
import { tarjeta, CabeceraTarjeta, Aviso, BotonGuardar } from './crecimientoShared';
import { Vacio, FilaInterruptor } from './modulosShared';
import { useModulo, useRelativo } from '../../../hooks/useModulo';

export default function AusenteView({ dash }) {
  const { t } = useTranslation();
  const { accionModulo } = dash;
  const { datos, setDatos, form, set, guardar, estado, autoguardado } = useModulo(dash, 'ausente');
  const relativo = useRelativo();

  if (!datos) return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  if (datos.error) return <Aviso tipo="alerta">{datos.error}</Aviso>;
  if (!form) return null;

  const quitar = async (a) => {
    const r = await accionModulo(`ausente/${a.id}`, 'DELETE');
    if (!r.error) setDatos((d) => ({ ...d, ausentes: d.ausentes.filter((x) => x.id !== a.id) }));
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.ausente_v.intro')}</p>

      <div data-help="ausente-config" className={tarjeta}>
        <CabeceraTarjeta icono={Moon} titulo={t('dashboard.ausente_v.title')} activo={form.activo !== false} onActivo={set('activo')} />
        <ol className="mt-4 space-y-1.5 text-sm text-fg/90">
          <li>1. {t('dashboard.ausente_v.step1')}</li>
          <li>2. {t('dashboard.ausente_v.step2')}</li>
          <li>3. {t('dashboard.ausente_v.step3')}</li>
        </ol>
        <div className="mt-4">
          <FilaInterruptor titulo={t('dashboard.ausente_v.nick')} desc={t('dashboard.ausente_v.nickHint')}>
            <Toggle checked={!!form.cambiarApodo} onChange={set('cambiarApodo')} />
          </FilaInterruptor>
        </div>
        <div className="mt-5"><BotonGuardar estado={estado} onClick={guardar} autoguardado={autoguardado} /></div>
      </div>

      <div data-help="ausente-lista" className={tarjeta}>
        <CabeceraTarjeta icono={Users} titulo={t('dashboard.ausente_v.now', { count: datos.ausentes.length })} />
        {datos.ausentes.length === 0 ? (
          <Vacio icono={Moon} titulo={t('dashboard.ausente_v.emptyTitle')} sub={t('dashboard.ausente_v.emptySub')} />
        ) : (
          <ul className="mt-4 space-y-2">
            {datos.ausentes.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-2xl border border-line bg-bg px-3 py-2.5">
                <Avatar src={a.avatar} name={a.nombre} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-fg">{a.nombre}</span>
                  <span className="block truncate text-xs text-muted">{a.motivo || t('dashboard.ausente_v.noReason')} · {relativo(a.desde)}{a.menciones ? ` · ${t('dashboard.ausente_v.mentions', { count: a.menciones })}` : ''}</span>
                </span>
                <button type="button" onClick={() => quitar(a)} className="shrink-0 rounded-xl border border-line p-2 text-muted hover:text-danger" aria-label={t('dashboard.ausente_v.clear')} title={t('dashboard.ausente_v.clear')}><X size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div data-help="traducir" className={tarjeta}>
        <CabeceraTarjeta icono={Languages} titulo={t('dashboard.ausente_v.translateTitle')} />
        <p className="mt-2 text-sm text-muted">{t('dashboard.ausente_v.translateDesc')}</p>
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-line bg-bg px-4 py-3">
          <MousePointerClick size={18} className="mt-0.5 shrink-0 text-brand" />
          <p className="text-sm text-fg">{t('dashboard.ausente_v.translateHow')}</p>
        </div>
        <p className="mt-3 text-xs text-muted">{t('dashboard.ausente_v.translateNote')}</p>
      </div>
    </div>
  );
}

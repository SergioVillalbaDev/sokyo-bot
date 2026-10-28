// Piezas compartidas por las pestañas de Crecimiento (invitaciones, bump, página
// pública y directos): tarjeta, campos, selectores y el botón de guardar.
import { useTranslation } from 'react-i18next';
import { Save, Check, Loader2, AlertTriangle, Info } from 'lucide-react';
import { Toggle } from '../../ui/primitives';
import EstadoAutoguardado from '../EstadoAutoguardado';

export const tarjeta = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
export const campo = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:opacity-50';

// Cabecera de tarjeta con icono, título y (opcional) interruptor.
export function CabeceraTarjeta({ icono: Icono, titulo, activo, onActivo, extra }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 font-bold text-fg">{Icono && <Icono size={18} className="text-brand" />} {titulo}</h3>
      <div className="flex items-center gap-3">
        {extra}
        {onActivo && (
          <label className="flex items-center gap-2 text-sm font-semibold text-muted">
            {t('dashboard.crec_v.enable')}
            <Toggle checked={!!activo} onChange={onActivo} />
          </label>
        )}
      </div>
    </div>
  );
}

// Campo con etiqueta y ayuda debajo.
export function Campo({ etiqueta, ayuda, children, className = '' }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-semibold text-muted">{etiqueta}</span>
      {children}
      {ayuda && <span className="text-xs text-muted">{ayuda}</span>}
    </label>
  );
}

export function SelectCanal({ canales = [], value, onChange, vacio }) {
  const { t } = useTranslation();
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={campo}>
      <option value="">{vacio || t('dashboard.crec_v.pickChannel')}</option>
      {canales.map((c) => <option key={c.id} value={c.id}># {c.nombre || c.name}</option>)}
    </select>
  );
}

export function SelectRol({ roles = [], value, onChange, vacio }) {
  const { t } = useTranslation();
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={campo}>
      <option value="">{vacio || t('dashboard.crec_v.pickRole')}</option>
      {roles.filter((r) => r.nombre !== '@everyone').map((r) => <option key={r.id} value={r.id}>@{r.nombre}</option>)}
    </select>
  );
}

export function Numero({ value, onChange, min = 0, max = 100000, disabled }) {
  return (
    <input type="number" inputMode="numeric" min={min} max={max} value={value} disabled={disabled}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} className={campo} />
  );
}

// Aviso informativo o de alerta.
export function Aviso({ tipo = 'info', children, accion }) {
  const alerta = tipo === 'alerta';
  return (
    <div className={`flex flex-wrap items-start gap-2.5 rounded-2xl border px-4 py-3 ${alerta ? 'border-warning/40 bg-warning/10' : 'border-line bg-elevated'}`}>
      {alerta ? <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" /> : <Info size={16} className="mt-0.5 shrink-0 text-brand" />}
      <p className="min-w-0 flex-1 text-xs text-fg/90">{children}</p>
      {accion}
    </div>
  );
}

// Botón de guardar con su estado ('' | 'guardando' | 'ok' | mensaje de error).
// `autoguardado`: estado de useAutoguardado (se enseña al lado, si se pasa).
export function BotonGuardar({ estado, onClick, disabled, autoguardado }) {
  const { t } = useTranslation();
  const guardando = estado === 'guardando';
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={onClick} disabled={guardando || disabled}
        className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-on-brand shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
        {guardando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {guardando ? t('dashboard.crec_v.saving') : t('dashboard.crec_v.save')}
      </button>
      {estado === 'ok' && <span className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check size={16} /> {t('dashboard.crec_v.saved')}</span>}
      {estado && estado !== 'ok' && !guardando && <span className="text-sm font-semibold text-danger">{estado}</span>}
      {autoguardado && <EstadoAutoguardado estado={autoguardado} />}
    </div>
  );
}

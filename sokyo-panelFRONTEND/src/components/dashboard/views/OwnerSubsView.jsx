// Panel de SUSCRIPCIONES — solo para los propietarios del bot (OWNER_IDS).
// Lista todos los servidores con su plan y caducidad, y permite activar/ajustar
// el plan y la duración a mano (útil para corregir bugs de cobro).
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Crown, RefreshCw, Search, Check, Loader2, Infinity as InfinityIcon, ShieldCheck } from 'lucide-react';
import { Card } from '../../ui/primitives';
import { getStaffSession } from '../../../lib/api';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const inputCls = 'rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-brand/50';

// Días que faltan para una fecha (negativo = ya caducó).
const diasRestantes = (fecha) => Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000);

function PlanBadge({ plan, activo }) {
  const map = {
    free: 'bg-elevated text-muted',
    pro: 'bg-gradient-brand text-on-brand',
    agency: 'bg-amber-500/20 text-amber-400',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${map[plan] || map.free} ${!activo && plan !== 'free' ? 'opacity-50 line-through' : ''}`}>
      {plan === 'agency' && <Crown size={11} />} {plan.toUpperCase()}
    </span>
  );
}

// Editor inline de una fila: plan + días + aplicar.
function FilaServidor({ s, onAplicar }) {
  const { t } = useTranslation();
  const [plan, setPlan] = useState(s.plan || 'free');
  const [dias, setDias] = useState(0); // 0 = de por vida
  const [cargando, setCargando] = useState(false);
  const [ok, setOk] = useState(false);

  const aplicar = async () => {
    setCargando(true); setOk(false);
    const r = await onAplicar(s.guildId, plan, plan === 'free' ? 0 : Number(dias) || 0);
    setCargando(false); setOk(r);
    if (r) setTimeout(() => setOk(false), 2500);
  };

  const caduca = s.premiumHasta ? new Date(s.premiumHasta) : null;
  const restantes = caduca ? diasRestantes(caduca) : null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-bg/40 p-4 lg:flex-row lg:items-center lg:justify-between">
      {/* Servidor + estado */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {s.icono
            ? <img src={s.icono} alt="" className="h-7 w-7 rounded-full" />
            : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-elevated text-xs">?</span>}
          <span className="truncate font-semibold text-fg">{s.nombre || t('dashboard.ownersubs_v.unknownServer')}</span>
          <PlanBadge plan={s.plan} activo={s.activo} />
          {!s.presente && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-400">{t('dashboard.ownersubs_v.botLeft')}</span>}
          {s.pagado && <span className="rounded-full bg-elevated px-2 py-0.5 text-[11px] text-muted">Stripe</span>}
        </div>
        <div className="mt-1 text-xs text-muted">
          <span className="font-mono">{s.guildId}</span>
          {s.miembros != null && <> · {s.miembros} {t('dashboard.ownersubs_v.members')}</>}
          {' · '}
          {s.plan === 'free'
            ? t('dashboard.ownersubs_v.noSubscription')
            : !s.activo
              ? <span className="text-red-400">{t('dashboard.ownersubs_v.expired')}</span>
              : caduca
                ? <span className={restantes <= 7 ? 'text-amber-400' : 'text-green-400'}>{t('dashboard.ownersubs_v.expires', { date: caduca.toLocaleDateString(), n: restantes })}</span>
                : <span className="inline-flex items-center gap-1 text-green-400"><InfinityIcon size={12} /> {t('dashboard.ownersubs_v.lifetime')}</span>}
          {s.cancelaAlFinal && <span className="text-amber-400"> · {t('dashboard.ownersubs_v.cancelsAtEnd')}</span>}
        </div>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={plan} onChange={(e) => setPlan(e.target.value)} className={inputCls}>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="agency">{t('dashboard.ownersubs_v.agency')}</option>
        </select>
        {plan !== 'free' && (
          <div className="flex items-center gap-1">
            <input type="number" min="0" max="3650" value={dias} onChange={(e) => setDias(e.target.value)}
              title={t('dashboard.ownersubs_v.subDays')}
              className={`w-20 ${inputCls}`} />
            <span className="text-xs text-muted">{t('dashboard.ownersubs_v.days')}<br />(0 = ∞)</span>
          </div>
        )}
        <button onClick={aplicar} disabled={cargando}
          className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {cargando ? <Loader2 size={14} className="animate-spin" /> : ok ? <Check size={14} /> : null}
          {ok ? t('dashboard.ownersubs_v.done') : t('dashboard.ownersubs_v.apply')}
        </button>
      </div>
    </div>
  );
}

export default function OwnerSubsView({ dash }) {
  const { t } = useTranslation();
  const { ownerServidores, cargarOwnerServidores, ownerSetPlan } = dash;
  const [q, setQ] = useState('');

  const esOwner = !!getStaffSession()?.owner;

  const lista = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return ownerServidores;
    return ownerServidores.filter((s) =>
      (s.nombre || '').toLowerCase().includes(term) || s.guildId.includes(term));
  }, [ownerServidores, q]);

  const totales = useMemo(() => {
    const r = { total: ownerServidores.length, pro: 0, agency: 0, activos: 0 };
    ownerServidores.forEach((s) => {
      if (s.activo && s.plan === 'pro') r.pro += 1;
      if (s.activo && s.plan === 'agency') r.agency += 1;
      if (s.activo && s.plan !== 'free') r.activos += 1;
    });
    return r;
  }, [ownerServidores]);

  if (!esOwner) {
    return (
      <Card className={card}>
        <p className="text-sm text-muted">{t('dashboard.ownersubs_v.ownerOnly')}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card data-help="ownersubs-header" className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold text-fg"><ShieldCheck size={18} className="text-brand" /> {t('dashboard.ownersubs_v.title')}</div>
          <button onClick={cargarOwnerServidores}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-bg px-3 py-1.5 text-sm text-fg hover:bg-elevated">
            <RefreshCw size={14} /> {t('dashboard.ownersubs_v.refresh')}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted">
          <span><strong className="text-fg">{totales.total}</strong> {t('dashboard.ownersubs_v.servers')}</span>
          <span><strong className="text-green-400">{totales.activos}</strong> {t('dashboard.ownersubs_v.activeSubsCount')}</span>
          <span>{t('dashboard.ownersubs_v.proCount')}: <strong className="text-fg">{totales.pro}</strong></span>
          <span>{t('dashboard.ownersubs_v.agencyCount')}: <strong className="text-fg">{totales.agency}</strong></span>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2">
          <Search size={15} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('dashboard.ownersubs_v.searchPh')}
            className="w-full bg-transparent text-sm text-fg focus:outline-none" />
        </div>
        <p className="mt-2 text-xs text-muted">{t('dashboard.ownersubs_v.help')}</p>
      </Card>

      <div data-help="ownersubs-lista" className="space-y-2">
        {lista.length === 0
          ? <Card className={card}><p className="text-center text-sm text-muted">{t('dashboard.ownersubs_v.noMatch')}</p></Card>
          : lista.map((s) => <FilaServidor key={s.guildId} s={s} onAplicar={ownerSetPlan} />)}
      </div>
    </div>
  );
}

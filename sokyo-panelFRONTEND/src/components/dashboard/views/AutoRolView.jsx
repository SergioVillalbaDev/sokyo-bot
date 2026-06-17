// Vista de Autorol al entrar — elige qué roles se asignan automáticamente
// cuando alguien (o un bot) entra al servidor.
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus, Bot, Save, Lock, Check, Info } from 'lucide-react';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const colorVisible = (c) => (!c || c === '#000000' ? '#99AAB5' : c);

// Selector de varios roles como "chips" que se activan/desactivan al pulsar.
function SelectorRoles({ roles, seleccion, onToggle }) {
  const { t } = useTranslation();
  if (roles.length === 0) return <p className="text-sm italic text-muted">{t('dashboard.autorol_v.noRoles')}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {roles.map((rol) => {
        const activo = seleccion.includes(rol.id);
        const color = colorVisible(rol.color);
        return (
          <button
            key={rol.id}
            onClick={() => rol.gestionable && onToggle(rol.id)}
            disabled={!rol.gestionable}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${activo ? 'border-brand bg-brand/10 text-fg' : 'border-line bg-bg text-muted hover:text-fg'} ${!rol.gestionable ? 'cursor-not-allowed opacity-40' : ''}`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            {rol.nombre}
            {activo && <Check size={14} className="text-brand" />}
            {!rol.gestionable && <Lock size={12} />}
          </button>
        );
      })}
    </div>
  );
}

export default function AutoRolView({ dash }) {
  const { t } = useTranslation();
  const { rolesDetalle, configServidor, guardarAutoRoles } = dash;

  const [autoRoles, setAutoRoles] = useState([]);
  const [autoRolesBots, setAutoRolesBots] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  // Inicializa los selectores con lo que ya hay guardado en la config.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (configServidor) {
      setAutoRoles(configServidor.autoRoles || []);
      setAutoRolesBots(configServidor.autoRolesBots || []);
    }
  }, [configServidor]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggle = (lista, setLista) => (id) => {
    setGuardado(false);
    setLista(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);
  };

  const guardar = async () => {
    setGuardando(true);
    const ok = await guardarAutoRoles({ autoRoles, autoRolesBots });
    setGuardando(false);
    setGuardado(ok);
  };

  const hayBloqueados = rolesDetalle.some((r) => !r.gestionable);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.autorol_v.intro')}</p>

      {/* Aviso de jerarquía si hay roles bloqueados */}
      {hayBloqueados && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
          <Info size={16} className="mt-0.5 shrink-0 text-brand" />
          <p className="text-xs text-muted">{t('dashboard.roles_v.hierarchyHint')}</p>
        </div>
      )}

      {/* Autorol para personas */}
      <div className={card}>
        <h3 className="mb-1 flex items-center gap-2 font-bold text-fg"><UserPlus size={18} className="text-brand" /> {t('dashboard.autorol_v.peopleTitle')}</h3>
        <p className="mb-4 text-xs text-muted">{t('dashboard.autorol_v.peopleDesc')}</p>
        <SelectorRoles roles={rolesDetalle} seleccion={autoRoles} onToggle={toggle(autoRoles, setAutoRoles)} />
      </div>

      {/* Autorol para bots */}
      <div className={card}>
        <h3 className="mb-1 flex items-center gap-2 font-bold text-fg"><Bot size={18} className="text-brand" /> {t('dashboard.autorol_v.botsTitle')}</h3>
        <p className="mb-4 text-xs text-muted">{t('dashboard.autorol_v.botsDesc')}</p>
        <SelectorRoles roles={rolesDetalle} seleccion={autoRolesBots} onToggle={toggle(autoRolesBots, setAutoRolesBots)} />
      </div>

      {/* Guardar */}
      <div className="flex items-center gap-3">
        <button
          onClick={guardar}
          disabled={guardando || !configServidor}
          className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={16} /> {guardando ? t('dashboard.autorol_v.saving') : t('dashboard.autorol_v.save')}
        </button>
        {guardado && <span className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check size={16} /> {t('dashboard.autorol_v.saved')}</span>}
      </div>
    </div>
  );
}

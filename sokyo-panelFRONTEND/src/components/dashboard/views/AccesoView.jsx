// Vista de Acceso y permisos — define qué roles pueden entrar al panel web y
// qué roles pueden moderar (panel de moderación + comandos).
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MonitorSmartphone, ShieldAlert, Save, Check, Info, LayoutList } from 'lucide-react';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const colorVisible = (c) => (!c || c === '#000000' ? '#99AAB5' : c);
const AREAS = ['tickets', 'roles', 'moderacion', 'logs', 'config'];

// Selector de varios roles como chips que se activan/desactivan al pulsar.
function SelectorRoles({ roles, seleccion, onToggle }) {
  const { t } = useTranslation();
  if (roles.length === 0) return <p className="text-sm italic text-muted">{t('dashboard.acceso_v.noRoles')}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {roles.map((rol) => {
        const activo = seleccion.includes(rol.id);
        return (
          <button
            key={rol.id}
            onClick={() => onToggle(rol.id)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${activo ? 'border-brand bg-brand/10 text-fg' : 'border-line bg-bg text-muted hover:text-fg'}`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorVisible(rol.color) }} />
            {rol.nombre}
            {activo && <Check size={14} className="text-brand" />}
          </button>
        );
      })}
    </div>
  );
}

export default function AccesoView({ dash }) {
  const { t } = useTranslation();
  const { roles, configServidor, guardarAcceso } = dash;

  const [panel, setPanel] = useState([]);
  const [moderacion, setModeracion] = useState([]);
  const [areas, setAreas] = useState({ tickets: [], roles: [], moderacion: [], logs: [], config: [] });
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (configServidor) {
      setPanel(configServidor.rolesPanelAcceso || []);
      setModeracion(configServidor.rolesModeracion || []);
      const a = configServidor.accesoAreas || {};
      setAreas({ tickets: a.tickets || [], roles: a.roles || [], moderacion: a.moderacion || [], logs: a.logs || [], config: a.config || [] });
    }
  }, [configServidor]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggle = (lista, setLista) => (id) => {
    setGuardado(false);
    setLista(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);
  };

  // Alterna un rol dentro de un área concreta de la matriz.
  const toggleArea = (area) => (id) => {
    setGuardado(false);
    setAreas((prev) => {
      const actual = prev[area] || [];
      return { ...prev, [area]: actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id] };
    });
  };

  const guardar = async () => {
    setGuardando(true);
    const ok = await guardarAcceso({ rolesPanelAcceso: panel, rolesModeracion: moderacion, accesoAreas: areas });
    setGuardando(false);
    setGuardado(ok);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.acceso_v.intro')}</p>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-xs text-muted">{t('dashboard.acceso_v.adminNote')}</p>
      </div>

      {/* Acceso al panel */}
      <div data-help="acceso-panel" className={card}>
        <h3 className="mb-1 flex items-center gap-2 font-bold text-fg"><MonitorSmartphone size={18} className="text-brand" /> {t('dashboard.acceso_v.panelTitle')}</h3>
        <p className="mb-4 text-xs text-muted">{t('dashboard.acceso_v.panelDesc')}</p>
        <SelectorRoles roles={roles} seleccion={panel} onToggle={toggle(panel, setPanel)} />
      </div>

      {/* Roles de moderación */}
      <div data-help="acceso-moderacion" className={card}>
        <h3 className="mb-1 flex items-center gap-2 font-bold text-fg"><ShieldAlert size={18} className="text-brand" /> {t('dashboard.acceso_v.modTitle')}</h3>
        <p className="mb-4 text-xs text-muted">{t('dashboard.acceso_v.modDesc')}</p>
        <SelectorRoles roles={roles} seleccion={moderacion} onToggle={toggle(moderacion, setModeracion)} />
      </div>

      {/* ¿Quién ve cada sección? */}
      <div data-help="acceso-areas" className={card}>
        <h3 className="mb-1 flex items-center gap-2 font-bold text-fg"><LayoutList size={18} className="text-brand" /> {t('dashboard.acceso_v.areasTitle')}</h3>
        <p className="mb-4 text-xs text-muted">{t('dashboard.acceso_v.areasDesc')}</p>
        <div className="space-y-4">
          {AREAS.map((area) => (
            <div key={area} className="rounded-2xl border border-line bg-bg p-3.5">
              <p className="mb-2 text-sm font-semibold text-fg">{t(`dashboard.nav.groups.${area}`)}</p>
              <SelectorRoles roles={roles} seleccion={areas[area] || []} onToggle={toggleArea(area)} />
            </div>
          ))}
        </div>
      </div>

      <div data-help="acceso-guardar" className="flex items-center gap-3">
        <button
          onClick={guardar}
          disabled={guardando || !configServidor}
          className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={16} /> {guardando ? t('dashboard.acceso_v.saving') : t('dashboard.acceso_v.save')}
        </button>
        {guardado && <span className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check size={16} /> {t('dashboard.acceso_v.saved')}</span>}
      </div>
    </div>
  );
}

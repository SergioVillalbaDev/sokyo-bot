// Vista de Reglas y control (Fase 3) — rol de staff, categoría, límites y auto-cierre.
// Selectores: guardado automático. Campos numéricos: se guardan al salir (blur).
import { useTranslation } from 'react-i18next';
import { ShieldCheck, FolderTree, Hash, Clock, Info, UserCheck } from 'lucide-react';
import { Card, Toggle } from '../../ui/primitives';

export default function RulesView({ dash }) {
  const { t } = useTranslation();
  const { configServidor, roles, categorias, guardarReglas } = dash;

  if (!configServidor) {
    return <p className="text-sm text-muted">{t('dashboard.loading')}</p>;
  }
  const r = (k) => t(`dashboard.rules_v.${k}`);

  const c = configServidor;
  const select = 'w-full min-w-[200px] rounded-xl border border-line bg-bg px-4 py-3 text-sm text-fg outline-none focus:ring-2 focus:ring-brand/40';
  const num = 'w-28 rounded-xl border border-line bg-bg px-4 py-3 text-sm text-fg outline-none focus:ring-2 focus:ring-brand/40';

  const guardarNumero = (campo, valor) => {
    const n = Math.max(0, parseInt(valor, 10) || 0);
    guardarReglas({ [campo]: n });
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-card px-4 py-3 text-xs text-muted shadow-soft">
        <Info size={15} className="text-brand" /> {r('autosave')}
      </div>

      {/* Rol de soporte */}
      <Card data-help="reglas-staff" className="p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-brand"><ShieldCheck size={18} /></span>
            <div>
              <p className="text-sm font-semibold text-fg">{r('staff')}</p>
              <p className="text-xs text-muted">{r('staffDesc')}</p>
            </div>
          </div>
          <select
            value={c.rolStaffId || ''}
            onChange={(e) => guardarReglas({ rolStaffId: e.target.value || null })}
            className={select}
          >
            <option value="">{r('onlyAdmins')}</option>
            {roles.map((rol) => <option key={rol.id} value={rol.id}>{rol.nombre}</option>)}
          </select>
        </div>
        {roles.length === 0 && <p className="mt-2 text-xs italic text-muted">{r('noRoles')}</p>}
      </Card>

      {/* Categoría de creación */}
      <Card data-help="reglas-categoria" className="p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-brand"><FolderTree size={18} /></span>
            <div>
              <p className="text-sm font-semibold text-fg">{r('category')}</p>
              <p className="text-xs text-muted">{r('categoryDesc')}</p>
            </div>
          </div>
          <select
            value={c.categoriaTicketsId || ''}
            onChange={(e) => guardarReglas({ categoriaTicketsId: e.target.value || null })}
            className={select}
          >
            <option value="">{r('noCategory')}</option>
            {categorias.map((cat) => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
          </select>
        </div>
      </Card>

      {/* Límite de tickets abiertos */}
      <Card data-help="reglas-limite" className="p-6 shadow-soft">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-brand"><Hash size={18} /></span>
            <div>
              <p className="text-sm font-semibold text-fg">{r('limit')}</p>
              <p className="text-xs text-muted">{r('limitDesc')}</p>
            </div>
          </div>
          <input
            type="number" min="0" defaultValue={c.maxTicketsAbiertos ?? 0}
            onBlur={(e) => guardarNumero('maxTicketsAbiertos', e.target.value)}
            className={num}
          />
        </div>
      </Card>

      {/* Auto-cierre por inactividad */}
      <Card className="p-6 shadow-soft">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-brand"><Clock size={18} /></span>
            <div>
              <p className="text-sm font-semibold text-fg">{r('autoclose')}</p>
              <p className="text-xs text-muted">{r('autocloseDesc')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number" min="0" defaultValue={c.autoCierreDias ?? 0}
              onBlur={(e) => guardarNumero('autoCierreDias', e.target.value)}
              className={num}
            />
            <span className="text-sm text-muted">{r('days')}</span>
          </div>
        </div>
      </Card>

      {/* Asignación automática (round-robin) */}
      <Card data-help="reglas-autoasignar" className="p-6 shadow-soft">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-brand"><UserCheck size={18} /></span>
            <div>
              <p className="text-sm font-semibold text-fg">{r('autoAssign')}</p>
              <p className="text-xs text-muted">{r('autoAssignDesc')}</p>
            </div>
          </div>
          <Toggle
            checked={!!c.autoAsignar}
            onChange={(v) => guardarReglas({ autoAsignar: v })}
          />
        </div>
      </Card>
    </div>
  );
}

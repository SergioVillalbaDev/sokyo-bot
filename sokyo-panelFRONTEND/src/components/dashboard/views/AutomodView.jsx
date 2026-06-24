// Vista del Automoderador — filtros automáticos de mensajes + defensa de
// entradas (anti-raid, cuentas nuevas) + anti-estafas, todo con presets.
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Save, Check, Info, Power, MessageSquareWarning, Link2, Link,
  Repeat2, AtSign, CaseUpper, ShieldOff, Hash, Banknote, Siren, UserPlus,
} from 'lucide-react';
import { PRESETS } from '../../../automodPresets';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const colorVisible = (c) => (!c || c === '#000000' ? '#99AAB5' : c);

// Conjuntos de acciones según el contexto.
const ACC_MSG = ['borrar', 'aviso', 'timeout', 'expulsion', 'ban'];   // filtros de mensajes
const ACC_RAID = ['kick', 'ban', 'timeout'];                          // raiders
const ACC_MIEMBRO = ['alerta', 'timeout', 'kick', 'ban'];             // cuentas nuevas

// Estructura por defecto (refleja los defaults del modelo ServidorConfig.automod).
const POR_DEFECTO = {
  activo: false, preset: '', avisarEnCanal: true, canalAlertasId: null,
  rolesExentos: [], canalesExentos: [],
  palabras: { activo: false, lista: [], accion: 'borrar', timeoutMin: 10 },
  invitaciones: { activo: false, accion: 'borrar', timeoutMin: 10 },
  enlaces: { activo: false, accion: 'borrar', timeoutMin: 10, listaBlanca: [] },
  spam: { activo: false, accion: 'timeout', timeoutMin: 5, maxMensajes: 5, enSegundos: 5, repetidos: true },
  menciones: { activo: false, accion: 'borrar', timeoutMin: 10, max: 5, bloquearEveryone: true },
  mayusculas: { activo: false, accion: 'borrar', timeoutMin: 5, porcentaje: 70, minLongitud: 10 },
  estafas: { activo: false, accion: 'ban', timeoutMin: 60, palabrasClave: [], conEnlace: true, conImagen: true, nitroFalso: true, borrarHoras: 1 },
  antiRaid: { activo: false, uniones: 8, enSegundos: 10, accion: 'kick', timeoutMin: 60, edadMinHoras: 0, lockdownMin: 10 },
  cuentasNuevas: { activo: false, edadMinHoras: 72, sinAvatar: true, accion: 'alerta', timeoutMin: 60, asignarRolId: null },
};

const MODULOS = ['palabras', 'invitaciones', 'enlaces', 'spam', 'menciones', 'mayusculas', 'estafas', 'antiRaid', 'cuentasNuevas'];

// Combina los valores guardados (o un preset) con los defaults.
function fusionar(guardado) {
  const g = guardado || {};
  const out = { ...POR_DEFECTO, ...g };
  for (const k of MODULOS) out[k] = { ...POR_DEFECTO[k], ...(g[k] || {}) };
  out.rolesExentos = g.rolesExentos || [];
  out.canalesExentos = g.canalesExentos || [];
  return out;
}

// --- Subcomponentes reutilizables (a nivel de módulo por react-hooks v7) ---

function Toggle({ on, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-brand' : 'bg-line'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

function NumField({ label, value, onChange, min = 1, max }) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          let n = parseInt(e.target.value, 10);
          if (!Number.isFinite(n)) n = min;
          n = Math.max(min, max != null ? Math.min(max, n) : n);
          onChange(n);
        }}
        className="w-20 rounded-xl border border-line bg-bg px-2.5 py-1.5 text-sm text-fg focus:border-brand focus:outline-none"
      />
    </label>
  );
}

function ToggleRow({ label, on, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted">{label}</span>
      <Toggle on={on} onChange={onChange} />
    </label>
  );
}

// Selector de acción + (si es timeout) minutos de aislamiento.
function AccionSelect({ opciones, accion, timeoutMin, onAccion, onTimeout }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-muted">
        <span>{t('dashboard.automod_v.action')}</span>
        <select
          value={accion}
          onChange={(e) => onAccion(e.target.value)}
          className="rounded-xl border border-line bg-bg px-2.5 py-1.5 text-sm font-semibold text-fg focus:border-brand focus:outline-none"
        >
          {opciones.map((a) => <option key={a} value={a}>{t(`dashboard.automod_v.acc.${a}`)}</option>)}
        </select>
      </label>
      {accion === 'timeout' && (
        <NumField label={t('dashboard.automod_v.timeoutMin')} value={timeoutMin} onChange={onTimeout} />
      )}
    </div>
  );
}

// Tarjeta de un módulo: cabecera con toggle + (si activo) extras y acción.
function ModuloCard({ icon: Icon, titulo, desc, modulo, onChange, accionOpciones, children, danger }) {
  return (
    <div className={card}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-fg">
            <Icon size={18} className={danger ? 'text-danger' : 'text-brand'} /> {titulo}
          </h3>
          <p className="mt-0.5 text-xs text-muted">{desc}</p>
        </div>
        <Toggle on={modulo.activo} onChange={(v) => onChange({ ...modulo, activo: v })} />
      </div>
      {modulo.activo && (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          {children}
          {accionOpciones && (
            <AccionSelect
              opciones={accionOpciones}
              accion={modulo.accion}
              timeoutMin={modulo.timeoutMin}
              onAccion={(v) => onChange({ ...modulo, accion: v })}
              onTimeout={(v) => onChange({ ...modulo, timeoutMin: v })}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SelectorRoles({ roles, seleccion, onToggle, vacio }) {
  if (roles.length === 0) return <p className="text-sm italic text-muted">{vacio}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {roles.map((rol) => {
        const activo = seleccion.includes(rol.id);
        return (
          <button
            key={rol.id}
            type="button"
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

function SelectorCanales({ canales, seleccion, onToggle, vacio }) {
  if (canales.length === 0) return <p className="text-sm italic text-muted">{vacio}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {canales.map((c) => {
        const activo = seleccion.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onToggle(c.id)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${activo ? 'border-brand bg-brand/10 text-fg' : 'border-line bg-bg text-muted hover:text-fg'}`}
          >
            <Hash size={13} className="opacity-70" />
            {c.nombre}
            {activo && <Check size={14} className="text-brand" />}
          </button>
        );
      })}
    </div>
  );
}

// Desplegable de selección única (canal o rol). value = id | null.
function SelectUno({ label, items, value, onChange, placeholder }) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <span>{label}</span>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="max-w-[220px] rounded-xl border border-line bg-bg px-2.5 py-1.5 text-sm font-semibold text-fg focus:border-brand focus:outline-none"
      >
        <option value="">{placeholder}</option>
        {items.map((it) => <option key={it.id} value={it.id}>{it.nombre}</option>)}
      </select>
    </label>
  );
}

export default function AutomodView({ dash }) {
  const { t } = useTranslation();
  const { roles, canales, configServidor, guardarAutomod } = dash;

  const [am, setAm] = useState(POR_DEFECTO);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (configServidor) setAm(fusionar(configServidor.automod));
  }, [configServidor]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Edita una clave de primer nivel. Al editar a mano se deselecciona el preset.
  const set = (clave, valor) => {
    setGuardado(false);
    setAm((prev) => ({ ...prev, [clave]: valor, preset: clave === 'preset' ? valor : '' }));
  };

  const aplicarPreset = (p) => {
    setGuardado(false);
    setAm(fusionar({ ...p.config, preset: p.id }));
  };

  const toggleEn = (clave) => (id) => {
    setGuardado(false);
    setAm((prev) => {
      const lista = prev[clave] || [];
      return { ...prev, preset: '', [clave]: lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id] };
    });
  };

  const guardar = async () => {
    setGuardando(true);
    const ok = await guardarAutomod(am);
    setGuardando(false);
    setGuardado(ok);
  };

  const textoLista = (arr) => (arr || []).join('\n');
  const parseLista = (txt) => txt.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('dashboard.automod_v.intro')}</p>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-elevated px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-brand" />
        <p className="text-xs text-muted">{t('dashboard.automod_v.note')}</p>
      </div>

      {/* Presets */}
      <div data-help="automod-presets" className={card}>
        <h3 className="mb-1 font-bold text-fg">{t('dashboard.automod_v.presetsTitle')}</h3>
        <p className="mb-4 text-xs text-muted">{t('dashboard.automod_v.presetsDesc')}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRESETS.map((p) => {
            const activo = am.preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => aplicarPreset(p)}
                className={`rounded-2xl border p-3.5 text-left transition-colors ${activo ? 'border-brand bg-brand/10' : 'border-line bg-bg hover:border-brand/50'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{p.emoji}</span>
                  <span className="font-semibold text-fg">{t(`dashboard.automod_v.presets.${p.id}.name`)}</span>
                  {activo && <Check size={15} className="ml-auto text-brand" />}
                </div>
                <p className="mt-1 text-xs text-muted">{t(`dashboard.automod_v.presets.${p.id}.desc`)}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interruptor general + ajustes globales */}
      <div data-help="automod-master" className={card}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-bold text-fg"><Power size={18} className="text-brand" /> {t('dashboard.automod_v.masterTitle')}</h3>
          <Toggle on={am.activo} onChange={(v) => set('activo', v)} />
        </div>
        <p className="mt-1 text-xs text-muted">{t('dashboard.automod_v.masterDesc')}</p>
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <ToggleRow label={t('dashboard.automod_v.warnInChannel')} on={am.avisarEnCanal} onChange={(v) => set('avisarEnCanal', v)} />
          <SelectUno
            label={t('dashboard.automod_v.alertChannel')}
            items={canales}
            value={am.canalAlertasId}
            onChange={(v) => set('canalAlertasId', v)}
            placeholder={t('dashboard.automod_v.alertChannelNone')}
          />
          <p className="text-xs text-muted">{t('dashboard.automod_v.alertChannelHint')}</p>
        </div>
      </div>

      {/* Exenciones */}
      <div className={card}>
        <h3 className="mb-1 flex items-center gap-2 font-bold text-fg"><ShieldOff size={18} className="text-brand" /> {t('dashboard.automod_v.exemptTitle')}</h3>
        <p className="mb-4 text-xs text-muted">{t('dashboard.automod_v.exemptDesc')}</p>
        <p className="mb-2 text-sm font-semibold text-fg">{t('dashboard.automod_v.exemptRoles')}</p>
        <SelectorRoles roles={roles} seleccion={am.rolesExentos} onToggle={toggleEn('rolesExentos')} vacio={t('dashboard.automod_v.noRoles')} />
        <p className="mb-2 mt-4 text-sm font-semibold text-fg">{t('dashboard.automod_v.exemptChannels')}</p>
        <SelectorCanales canales={canales} seleccion={am.canalesExentos} onToggle={toggleEn('canalesExentos')} vacio={t('dashboard.automod_v.noChannels')} />
      </div>

      {/* === DEFENSA DE ENTRADAS === */}
      <h4 data-help="automod-entradas" className="px-1 pt-2 text-xs font-bold uppercase tracking-wider text-muted">{t('dashboard.automod_v.groupGuard')}</h4>

      <ModuloCard icon={Siren} danger titulo={t('dashboard.automod_v.raidTitle')} desc={t('dashboard.automod_v.raidDesc')} modulo={am.antiRaid} onChange={(m) => set('antiRaid', m)} accionOpciones={ACC_RAID}>
        <div className="flex flex-wrap gap-4">
          <NumField label={t('dashboard.automod_v.raidJoins')} value={am.antiRaid.uniones} min={2} onChange={(v) => set('antiRaid', { ...am.antiRaid, uniones: v })} />
          <NumField label={t('dashboard.automod_v.raidSeconds')} value={am.antiRaid.enSegundos} onChange={(v) => set('antiRaid', { ...am.antiRaid, enSegundos: v })} />
          <NumField label={t('dashboard.automod_v.raidLockdown')} value={am.antiRaid.lockdownMin} onChange={(v) => set('antiRaid', { ...am.antiRaid, lockdownMin: v })} />
          <NumField label={t('dashboard.automod_v.raidAgeHours')} value={am.antiRaid.edadMinHoras} min={0} onChange={(v) => set('antiRaid', { ...am.antiRaid, edadMinHoras: v })} />
        </div>
        <p className="text-xs text-muted">{t('dashboard.automod_v.raidHint')}</p>
      </ModuloCard>

      <ModuloCard icon={UserPlus} titulo={t('dashboard.automod_v.newTitle')} desc={t('dashboard.automod_v.newDesc')} modulo={am.cuentasNuevas} onChange={(m) => set('cuentasNuevas', m)} accionOpciones={ACC_MIEMBRO}>
        <NumField label={t('dashboard.automod_v.newAgeHours')} value={am.cuentasNuevas.edadMinHoras} onChange={(v) => set('cuentasNuevas', { ...am.cuentasNuevas, edadMinHoras: v })} />
        <ToggleRow label={t('dashboard.automod_v.newNoAvatar')} on={am.cuentasNuevas.sinAvatar} onChange={(v) => set('cuentasNuevas', { ...am.cuentasNuevas, sinAvatar: v })} />
        <SelectUno
          label={t('dashboard.automod_v.newQuarantineRole')}
          items={roles}
          value={am.cuentasNuevas.asignarRolId}
          onChange={(v) => set('cuentasNuevas', { ...am.cuentasNuevas, asignarRolId: v })}
          placeholder={t('dashboard.automod_v.newNoRole')}
        />
        <p className="text-xs text-muted">{t('dashboard.automod_v.newHint')}</p>
      </ModuloCard>

      {/* === FILTROS DE MENSAJES === */}
      <h4 data-help="automod-mensajes" className="px-1 pt-2 text-xs font-bold uppercase tracking-wider text-muted">{t('dashboard.automod_v.groupMessages')}</h4>

      <ModuloCard icon={Banknote} danger titulo={t('dashboard.automod_v.scamTitle')} desc={t('dashboard.automod_v.scamDesc')} modulo={am.estafas} onChange={(m) => set('estafas', m)} accionOpciones={ACC_MSG}>
        <ToggleRow label={t('dashboard.automod_v.scamNitro')} on={am.estafas.nitroFalso} onChange={(v) => set('estafas', { ...am.estafas, nitroFalso: v })} />
        <ToggleRow label={t('dashboard.automod_v.scamLinkOnly')} on={am.estafas.conEnlace} onChange={(v) => set('estafas', { ...am.estafas, conEnlace: v })} />
        <ToggleRow label={t('dashboard.automod_v.scamImage')} on={am.estafas.conImagen} onChange={(v) => set('estafas', { ...am.estafas, conImagen: v })} />
        {am.estafas.accion === 'ban' && (
          <NumField label={t('dashboard.automod_v.scamDeleteHours')} value={am.estafas.borrarHoras} min={0} max={168} onChange={(v) => set('estafas', { ...am.estafas, borrarHoras: v })} />
        )}
        <p className="text-sm font-semibold text-fg">{t('dashboard.automod_v.scamKeywords')}</p>
        <textarea
          value={textoLista(am.estafas.palabrasClave)}
          onChange={(e) => set('estafas', { ...am.estafas, palabrasClave: parseLista(e.target.value) })}
          rows={3}
          placeholder={t('dashboard.automod_v.scamKeywordsPh')}
          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none"
        />
        <p className="text-xs text-muted">{t('dashboard.automod_v.scamKeywordsHint')}</p>
      </ModuloCard>

      <ModuloCard icon={MessageSquareWarning} titulo={t('dashboard.automod_v.wordsTitle')} desc={t('dashboard.automod_v.wordsDesc')} modulo={am.palabras} onChange={(m) => set('palabras', m)} accionOpciones={ACC_MSG}>
        <textarea
          value={textoLista(am.palabras.lista)}
          onChange={(e) => set('palabras', { ...am.palabras, lista: parseLista(e.target.value) })}
          rows={4}
          placeholder={t('dashboard.automod_v.wordsPlaceholder')}
          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none"
        />
        <p className="text-xs text-muted">{t('dashboard.automod_v.wordsHint')}</p>
      </ModuloCard>

      <ModuloCard icon={Link2} titulo={t('dashboard.automod_v.invitesTitle')} desc={t('dashboard.automod_v.invitesDesc')} modulo={am.invitaciones} onChange={(m) => set('invitaciones', m)} accionOpciones={ACC_MSG} />

      <ModuloCard icon={Link} titulo={t('dashboard.automod_v.linksTitle')} desc={t('dashboard.automod_v.linksDesc')} modulo={am.enlaces} onChange={(m) => set('enlaces', m)} accionOpciones={ACC_MSG}>
        <p className="text-sm font-semibold text-fg">{t('dashboard.automod_v.whitelist')}</p>
        <textarea
          value={textoLista(am.enlaces.listaBlanca)}
          onChange={(e) => set('enlaces', { ...am.enlaces, listaBlanca: parseLista(e.target.value) })}
          rows={2}
          placeholder="youtube.com, twitch.tv, tenor.com"
          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none"
        />
        <p className="text-xs text-muted">{t('dashboard.automod_v.whitelistHint')}</p>
      </ModuloCard>

      <ModuloCard icon={Repeat2} titulo={t('dashboard.automod_v.spamTitle')} desc={t('dashboard.automod_v.spamDesc')} modulo={am.spam} onChange={(m) => set('spam', m)} accionOpciones={ACC_MSG}>
        <div className="flex flex-wrap gap-4">
          <NumField label={t('dashboard.automod_v.spamMax')} value={am.spam.maxMensajes} min={2} onChange={(v) => set('spam', { ...am.spam, maxMensajes: v })} />
          <NumField label={t('dashboard.automod_v.spamSeconds')} value={am.spam.enSegundos} onChange={(v) => set('spam', { ...am.spam, enSegundos: v })} />
        </div>
        <ToggleRow label={t('dashboard.automod_v.spamRepeated')} on={am.spam.repetidos} onChange={(v) => set('spam', { ...am.spam, repetidos: v })} />
      </ModuloCard>

      <ModuloCard icon={AtSign} titulo={t('dashboard.automod_v.mentionsTitle')} desc={t('dashboard.automod_v.mentionsDesc')} modulo={am.menciones} onChange={(m) => set('menciones', m)} accionOpciones={ACC_MSG}>
        <NumField label={t('dashboard.automod_v.mentionsMax')} value={am.menciones.max} onChange={(v) => set('menciones', { ...am.menciones, max: v })} />
        <ToggleRow label={t('dashboard.automod_v.mentionsEveryone')} on={am.menciones.bloquearEveryone} onChange={(v) => set('menciones', { ...am.menciones, bloquearEveryone: v })} />
      </ModuloCard>

      <ModuloCard icon={CaseUpper} titulo={t('dashboard.automod_v.capsTitle')} desc={t('dashboard.automod_v.capsDesc')} modulo={am.mayusculas} onChange={(m) => set('mayusculas', m)} accionOpciones={ACC_MSG}>
        <div className="flex flex-wrap gap-4">
          <NumField label={t('dashboard.automod_v.capsPercent')} value={am.mayusculas.porcentaje} max={100} onChange={(v) => set('mayusculas', { ...am.mayusculas, porcentaje: v })} />
          <NumField label={t('dashboard.automod_v.capsMinLen')} value={am.mayusculas.minLongitud} onChange={(v) => set('mayusculas', { ...am.mayusculas, minLongitud: v })} />
        </div>
      </ModuloCard>

      {/* Guardar */}
      <div data-help="automod-guardar" className="sticky bottom-0 flex items-center gap-3 rounded-2xl bg-bg/80 py-3 backdrop-blur">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando || !configServidor}
          className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={16} /> {guardando ? t('dashboard.automod_v.saving') : t('dashboard.automod_v.save')}
        </button>
        {guardado && <span className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check size={16} /> {t('dashboard.automod_v.saved')}</span>}
      </div>
    </div>
  );
}

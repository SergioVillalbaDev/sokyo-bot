// Vista de Niveles / XP — configuración completa + ranking.
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Trophy, Save, Check, Plus, X, Mic, Gauge, Megaphone, Ban, Image, Zap, Palette, Eye, EyeOff } from 'lucide-react';
import { Avatar, Toggle } from '../../ui/primitives';
import { PRESETS_TARJETA } from '../../../presetsTarjeta';

const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const inputCls = 'w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm text-fg outline-none focus:border-brand';
const numCls = 'w-24 rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-brand';
const ANUNCIOS = ['canal', 'dm', 'off'];

// Selector de varios elementos (canales/roles) como chips.
function Chips({ items, seleccion, onToggle, prefijo = '' }) {
  const { t } = useTranslation();
  if (items.length === 0) return <p className="text-sm italic text-muted">{t('dashboard.niveles_v.nada')}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const activo = seleccion.includes(it.id);
        return (
          <button key={it.id} onClick={() => onToggle(it.id)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${activo ? 'border-brand bg-brand/10 text-fg' : 'border-line bg-bg text-muted hover:text-fg'}`}>
            {prefijo}{it.nombre}
          </button>
        );
      })}
    </div>
  );
}

export default function NivelesView({ dash }) {
  const { t } = useTranslation();
  const { configServidor, canales, roles, ranking, guardarNiveles, catalogoPresets, guardarCatalogoPresets } = dash;

  const [f, setF] = useState(null); // formulario
  const [recompensas, setRecompensas] = useState([]);
  const [multiplicadores, setMultiplicadores] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  // Catálogo de presets (global): ocultos de fábrica + personalizados.
  const [ocultos, setOcultos] = useState([]);
  const [custom, setCustom] = useState([]);
  const [guardandoCat, setGuardandoCat] = useState(false);
  const [guardadoCat, setGuardadoCat] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setOcultos(catalogoPresets?.ocultos || []);
    setCustom((catalogoPresets?.personalizados || []).map((p) => ({ ...p })));
  }, [catalogoPresets]);

  useEffect(() => {
    if (configServidor) {
      const c = configServidor;
      setF({
        nivelesActivo: !!c.nivelesActivo,
        xpMin: c.xpMin ?? 15, xpMax: c.xpMax ?? 25, xpCooldownSeg: c.xpCooldownSeg ?? 60,
        xpVozActivo: !!c.xpVozActivo, xpVozPorMin: c.xpVozPorMin ?? 5,
        dificultad: c.dificultad ?? 1,
        anuncioTipo: c.anuncioTipo || 'canal', canalNivelesId: c.canalNivelesId || '',
        mensajeSubida: c.mensajeSubida || '🎉 ¡{mention} ha subido a **nivel {level}**!',
        recompensaAcumulativa: c.recompensaAcumulativa !== false,
        canalesSinXp: c.canalesSinXp || [], rolesSinXp: c.rolesSinXp || [],
        tarjetaActiva: c.tarjetaActiva !== false,
      });
      setRecompensas((c.recompensasNivel || []).map((r) => ({ ...r })));
      setMultiplicadores((c.multiplicadoresRol || []).map((m) => ({ ...m })));
    }
  }, [configServidor]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!f) return null;
  const set = (campo, valor) => { setGuardado(false); setF((p) => ({ ...p, [campo]: valor })); };
  const toggleEnLista = (campo, id) => set(campo, f[campo].includes(id) ? f[campo].filter((x) => x !== id) : [...f[campo], id]);

  const setRecompensa = (i, c, v) => { setGuardado(false); setRecompensas(recompensas.map((r, j) => (j === i ? { ...r, [c]: v } : r))); };
  const addRecompensa = () => { setGuardado(false); setRecompensas([...recompensas, { nivel: 5, rolId: '' }]); };
  const removeRecompensa = (i) => { setGuardado(false); setRecompensas(recompensas.filter((_, j) => j !== i)); };

  const setMulti = (i, c, v) => { setGuardado(false); setMultiplicadores(multiplicadores.map((m, j) => (j === i ? { ...m, [c]: v } : m))); };
  const addMulti = () => { setGuardado(false); setMultiplicadores([...multiplicadores, { rolId: '', multiplicador: 2 }]); };
  const removeMulti = (i) => { setGuardado(false); setMultiplicadores(multiplicadores.filter((_, j) => j !== i)); };

  const guardar = async () => {
    setGuardando(true);
    const ok = await guardarNiveles({
      ...f, canalNivelesId: f.canalNivelesId || null,
      recompensasNivel: recompensas.filter((r) => r.rolId).map((r) => ({ nivel: Number(r.nivel) || 1, rolId: r.rolId })),
      multiplicadoresRol: multiplicadores.filter((m) => m.rolId).map((m) => ({ rolId: m.rolId, multiplicador: Number(m.multiplicador) || 1 })),
    });
    setGuardando(false);
    setGuardado(ok);
  };

  // --- Catálogo de presets ---
  const toggleOculto = (id) => { setGuardadoCat(false); setOcultos((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id])); };
  const setCustomCampo = (i, c, v) => { setGuardadoCat(false); setCustom(custom.map((p, j) => (j === i ? { ...p, [c]: v } : p))); };
  const addCustom = () => { setGuardadoCat(false); setCustom([...custom, { id: `custom-${Date.now()}`, nombre: t('dashboard.niveles_v.catNewName'), colorAcento: '#5865F2', fondoColor: '#1e2030', colorSecundario: '#9b59b6', fondoTipo: 'degradado', premium: false }]); };
  const removeCustom = (i) => { setGuardadoCat(false); setCustom(custom.filter((_, j) => j !== i)); };
  const guardarCatalogo = async () => {
    setGuardandoCat(true);
    const ok = await guardarCatalogoPresets({ ocultos, personalizados: custom });
    setGuardandoCat(false);
    setGuardadoCat(ok);
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        {/* Activar */}
        <div data-help="niveles-enable" className={card}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-fg"><TrendingUp size={18} className="text-brand" /> {t('dashboard.niveles_v.enable')}</h3>
              <p className="mt-0.5 text-xs text-muted">{t('dashboard.niveles_v.enableDesc')}</p>
            </div>
            <Toggle checked={f.nivelesActivo} onChange={(v) => set('nivelesActivo', v)} />
          </div>
        </div>

        {/* Ganancia de XP */}
        <div data-help="niveles-xp" className={card}>
          <h3 className="mb-3 flex items-center gap-2 font-bold text-fg"><Gauge size={18} className="text-brand" /> {t('dashboard.niveles_v.gain')}</h3>
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-xs font-semibold text-muted">{t('dashboard.niveles_v.xpMin')}<input type="number" min={0} value={f.xpMin} onChange={(e) => set('xpMin', Math.max(0, parseInt(e.target.value, 10) || 0))} className={`${numCls} mt-1 block`} /></label>
            <label className="text-xs font-semibold text-muted">{t('dashboard.niveles_v.xpMax')}<input type="number" min={0} value={f.xpMax} onChange={(e) => set('xpMax', Math.max(0, parseInt(e.target.value, 10) || 0))} className={`${numCls} mt-1 block`} /></label>
            <label className="text-xs font-semibold text-muted">{t('dashboard.niveles_v.cooldown')}<input type="number" min={0} value={f.xpCooldownSeg} onChange={(e) => set('xpCooldownSeg', Math.max(0, parseInt(e.target.value, 10) || 0))} className={`${numCls} mt-1 block`} /></label>
            <label className="text-xs font-semibold text-muted">{t('dashboard.niveles_v.difficulty')}<input type="number" min={0.1} max={5} step={0.1} value={f.dificultad} onChange={(e) => set('dificultad', parseFloat(e.target.value) || 1)} className={`${numCls} mt-1 block`} /></label>
          </div>
          <p className="mt-2 text-xs text-muted">{t('dashboard.niveles_v.difficultyHint')}</p>
        </div>

        {/* XP por voz */}
        <div className={card}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-fg"><Mic size={18} className="text-brand" /> {t('dashboard.niveles_v.voice')}</h3>
              <p className="mt-0.5 text-xs text-muted">{t('dashboard.niveles_v.voiceDesc')}</p>
            </div>
            <Toggle checked={f.xpVozActivo} onChange={(v) => set('xpVozActivo', v)} />
          </div>
          {f.xpVozActivo && (
            <label className="mt-3 block text-xs font-semibold text-muted">{t('dashboard.niveles_v.voicePerMin')}
              <input type="number" min={0} value={f.xpVozPorMin} onChange={(e) => set('xpVozPorMin', Math.max(0, parseInt(e.target.value, 10) || 0))} className={`${numCls} mt-1 block`} />
            </label>
          )}
        </div>

        {/* Anuncios */}
        <div data-help="niveles-anuncios" className={card}>
          <h3 className="mb-3 flex items-center gap-2 font-bold text-fg"><Megaphone size={18} className="text-brand" /> {t('dashboard.niveles_v.announce')}</h3>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {ANUNCIOS.map((a) => (
              <button key={a} onClick={() => set('anuncioTipo', a)} className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${f.anuncioTipo === a ? 'border-brand bg-brand/10 text-fg' : 'border-line bg-bg text-muted hover:text-fg'}`}>{t(`dashboard.niveles_v.announce_${a}`)}</button>
            ))}
          </div>
          {f.anuncioTipo === 'canal' && (
            <select value={f.canalNivelesId} onChange={(e) => set('canalNivelesId', e.target.value)} className={`${inputCls} mb-3`}>
              <option value="">{t('dashboard.niveles_v.sameChannel')}</option>
              {canales.map((c) => <option key={c.id} value={c.id}>#{c.nombre}</option>)}
            </select>
          )}
          {f.anuncioTipo !== 'off' && (
            <>
              <label className="mb-1.5 block text-xs font-semibold text-muted">{t('dashboard.niveles_v.message')}</label>
              <input value={f.mensajeSubida} onChange={(e) => set('mensajeSubida', e.target.value)} className={inputCls} />
              <p className="mt-1.5 text-xs text-muted">{t('dashboard.niveles_v.placeholders')}</p>
            </>
          )}
        </div>

        {/* Tarjeta de rango */}
        <div className={card}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-fg"><Image size={18} className="text-brand" /> {t('dashboard.niveles_v.cardTitle')}</h3>
              <p className="mt-0.5 text-xs text-muted">{t('dashboard.niveles_v.cardDesc')}</p>
            </div>
            <Toggle checked={f.tarjetaActiva} onChange={(v) => set('tarjetaActiva', v)} />
          </div>
        </div>

        {/* Catálogo de diseños (presets) — gestión de admin */}
        <div className={card}>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-fg"><Palette size={18} className="text-brand" /> {t('dashboard.niveles_v.catTitle')}</h3>
            <button onClick={addCustom} className="flex items-center gap-1 text-xs font-semibold text-brand hover:opacity-80"><Plus size={13} /> {t('dashboard.niveles_v.catAdd')}</button>
          </div>
          <p className="mb-3 text-xs text-muted">{t('dashboard.niveles_v.catDesc')}</p>

          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.niveles_v.catFactory')}</p>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {PRESETS_TARJETA.map((p) => {
              const oculto = ocultos.includes(p.id);
              return (
                <div key={p.id} className={`overflow-hidden rounded-xl border bg-bg ${oculto ? 'border-line opacity-50' : 'border-brand/40'}`}>
                  <div className="relative h-12" style={{ background: p.swatch || `linear-gradient(135deg, ${p.fondoColor}, ${p.colorSecundario})` }}>
                    {p.animado && <span className="absolute right-1 top-1 rounded bg-black/55 px-1 text-[9px] font-bold text-white">✨ GIF</span>}
                  </div>
                  <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                    <span className="truncate text-xs font-semibold text-fg">{p.nombre}</span>
                    <button onClick={() => toggleOculto(p.id)} title={oculto ? t('dashboard.niveles_v.catShow') : t('dashboard.niveles_v.catHide')} className="shrink-0 text-muted hover:text-fg">
                      {oculto ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.niveles_v.catCustom')}</p>
          {custom.length === 0 ? (
            <p className="text-sm italic text-muted">{t('dashboard.niveles_v.catNone')}</p>
          ) : (
            <div className="space-y-3">
              {custom.map((p, i) => (
                <div key={i} className="rounded-2xl border border-line bg-bg p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <input value={p.nombre} onChange={(e) => setCustomCampo(i, 'nombre', e.target.value)} placeholder={t('dashboard.niveles_v.catName')} className={`${inputCls} flex-1`} />
                    <button onClick={() => removeCustom(i)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-muted hover:border-danger/40 hover:text-danger"><X size={14} /></button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-muted">{t('dashboard.niveles_v.catAccent')} <input type="color" value={p.colorAcento} onChange={(e) => setCustomCampo(i, 'colorAcento', e.target.value)} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent" /></label>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-muted">{t('dashboard.niveles_v.catBg')} <input type="color" value={p.fondoColor} onChange={(e) => setCustomCampo(i, 'fondoColor', e.target.value)} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent" /></label>
                    {p.fondoTipo === 'degradado' && <label className="flex items-center gap-1.5 text-xs font-semibold text-muted">{t('dashboard.niveles_v.catSecondary')} <input type="color" value={p.colorSecundario} onChange={(e) => setCustomCampo(i, 'colorSecundario', e.target.value)} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent" /></label>}
                    <select value={p.fondoTipo} onChange={(e) => setCustomCampo(i, 'fondoTipo', e.target.value)} className="rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-brand" style={{ width: '120px' }}>
                      <option value="degradado">{t('dashboard.niveles_v.catGradient')}</option>
                      <option value="color">{t('dashboard.niveles_v.catSolid')}</option>
                    </select>
                    <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-muted">{t('dashboard.niveles_v.catPremium')} <Toggle checked={!!p.premium} onChange={(v) => setCustomCampo(i, 'premium', v)} /></label>
                  </div>
                  <div className="mt-2 h-8 rounded-lg" style={{ background: p.fondoTipo === 'color' ? p.fondoColor : `linear-gradient(135deg, ${p.fondoColor}, ${p.colorSecundario})`, border: `2px solid ${p.colorAcento}` }} />
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button onClick={guardarCatalogo} disabled={guardandoCat} className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:opacity-50">
              <Save size={16} /> {guardandoCat ? t('dashboard.niveles_v.catSaving') : t('dashboard.niveles_v.catSave')}
            </button>
            {guardadoCat && <span className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check size={16} /> {t('dashboard.niveles_v.catSaved')}</span>}
          </div>
        </div>

        {/* Multiplicadores por rol */}
        <div className={card}>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-fg"><Zap size={18} className="text-brand" /> {t('dashboard.niveles_v.multipliers')}</h3>
            <button onClick={addMulti} className="flex items-center gap-1 text-xs font-semibold text-brand hover:opacity-80"><Plus size={13} /> {t('dashboard.niveles_v.addMulti')}</button>
          </div>
          <p className="mb-3 text-xs text-muted">{t('dashboard.niveles_v.multipliersDesc')}</p>
          {multiplicadores.length === 0 ? (
            <p className="text-sm italic text-muted">{t('dashboard.niveles_v.noMulti')}</p>
          ) : (
            <div className="space-y-2">
              {multiplicadores.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={m.rolId} onChange={(e) => setMulti(i, 'rolId', e.target.value)} className={`${inputCls} flex-1`}>
                    <option value="">{t('dashboard.niveles_v.pickRole')}</option>
                    {roles.map((rol) => <option key={rol.id} value={rol.id}>{rol.nombre}</option>)}
                  </select>
                  <span className="text-sm font-bold text-muted">×</span>
                  <input type="number" min={0} step={0.5} value={m.multiplicador} onChange={(e) => setMulti(i, 'multiplicador', parseFloat(e.target.value) || 1)} className="w-20 rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-brand" />
                  <button onClick={() => removeMulti(i)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-muted hover:border-danger/40 hover:text-danger"><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recompensas */}
        <div data-help="niveles-recompensas" className={card}>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-fg"><Trophy size={18} className="text-brand" /> {t('dashboard.niveles_v.rewards')}</h3>
            <button onClick={addRecompensa} className="flex items-center gap-1 text-xs font-semibold text-brand hover:opacity-80"><Plus size={13} /> {t('dashboard.niveles_v.addReward')}</button>
          </div>
          <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-line bg-bg p-3">
            <div><p className="text-sm font-semibold text-fg">{t('dashboard.niveles_v.cumulative')}</p><p className="text-xs text-muted">{t('dashboard.niveles_v.cumulativeDesc')}</p></div>
            <Toggle checked={f.recompensaAcumulativa} onChange={(v) => set('recompensaAcumulativa', v)} />
          </div>
          {recompensas.length === 0 ? (
            <p className="text-sm italic text-muted">{t('dashboard.niveles_v.noRewards')}</p>
          ) : (
            <div className="space-y-2">
              {recompensas.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted">{t('dashboard.niveles_v.level')}</span>
                  <input type="number" min={1} value={r.nivel} onChange={(e) => setRecompensa(i, 'nivel', Math.max(1, parseInt(e.target.value, 10) || 1))} className="w-20 rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-brand" />
                  <span className="text-xs text-muted">→</span>
                  <select value={r.rolId} onChange={(e) => setRecompensa(i, 'rolId', e.target.value)} className={`${inputCls} flex-1`}>
                    <option value="">{t('dashboard.niveles_v.pickRole')}</option>
                    {roles.map((rol) => <option key={rol.id} value={rol.id}>{rol.nombre}</option>)}
                  </select>
                  <button onClick={() => removeRecompensa(i)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-muted hover:border-danger/40 hover:text-danger"><X size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Exclusiones */}
        <div className={card}>
          <h3 className="mb-1 flex items-center gap-2 font-bold text-fg"><Ban size={18} className="text-brand" /> {t('dashboard.niveles_v.exclusions')}</h3>
          <p className="mb-3 text-xs text-muted">{t('dashboard.niveles_v.exclusionsDesc')}</p>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.niveles_v.noXpChannels')}</p>
          <Chips items={canales} seleccion={f.canalesSinXp} onToggle={(id) => toggleEnLista('canalesSinXp', id)} prefijo="#" />
          <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.niveles_v.noXpRoles')}</p>
          <Chips items={roles} seleccion={f.rolesSinXp} onToggle={(id) => toggleEnLista('rolesSinXp', id)} />
        </div>

        <div className="flex items-center gap-3">
          <button onClick={guardar} disabled={guardando} className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:opacity-50">
            <Save size={16} /> {guardando ? t('dashboard.niveles_v.saving') : t('dashboard.niveles_v.save')}
          </button>
          {guardado && <span className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check size={16} /> {t('dashboard.niveles_v.saved')}</span>}
        </div>
      </div>

      {/* Ranking */}
      <div data-help="niveles-ranking" className={`${card} h-fit`}>
        <h3 className="mb-3 flex items-center gap-2 font-bold text-fg"><Trophy size={18} className="text-amber-400" /> {t('dashboard.niveles_v.ranking')}</h3>
        {ranking.length === 0 ? (
          <p className="py-4 text-center text-sm italic text-muted">{t('dashboard.niveles_v.noRanking')}</p>
        ) : (
          <div className="space-y-2">
            {ranking.map((u) => (
              <motion.div key={u.userId} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 rounded-xl border border-line bg-bg px-3 py-2">
                <span className={`w-6 text-center text-sm font-extrabold ${u.posicion <= 3 ? 'text-amber-400' : 'text-muted'}`}>{u.posicion}</span>
                <Avatar src={u.avatar} name={u.nombre} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg">{u.nombre}</p>
                  <p className="text-[11px] text-muted">{u.xp} XP</p>
                </div>
                <span className="rounded-full border border-line bg-card px-2.5 py-0.5 text-xs font-bold text-brand">{t('dashboard.niveles_v.lvl', { n: u.nivel })}</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

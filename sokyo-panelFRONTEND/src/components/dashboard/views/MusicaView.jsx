// Vista de Música (panel admin): configuración del reproductor + control en vivo.
import { useState, useEffect, useCallback } from 'react';
import { Music, Save, Check, Play, Pause, SkipForward, Square, Volume2, Shuffle } from 'lucide-react';
import { Card, Toggle } from '../../ui/primitives';
import { apiFetch } from '../../../lib/api';

const VERDE = '#1db954';
const card = 'rounded-3xl border border-line bg-card p-5 shadow-soft';
const fmt = (ms) => {
  if (!ms || ms <= 0) return '0:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};

// Fila etiqueta + control (toggle/selector) reutilizable.
function Ajuste({ titulo, desc, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-line/60 last:border-0">
      <div className="min-w-0">
        <div className="font-semibold text-fg">{titulo}</div>
        {desc && <div className="text-sm text-muted">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function MusicaView({ dash }) {
  const { configServidor, roles, canales, guildId, guardarMusica } = dash;
  const [f, setF] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  // Estado en vivo del reproductor.
  const [estado, setEstado] = useState(null);
  const gid = guildId || configServidor?.guildId;

  // Cargar el formulario desde la config.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const m = configServidor?.musica || {};
    setF({
      activo: m.activo ?? true,
      canalMusicaId: m.canalMusicaId || '',
      djRolId: m.djRolId || '',
      soloMismoCanal: m.soloMismoCanal ?? true,
      volumenDefecto: m.volumenDefecto ?? 60,
      volumenMax: m.volumenMax ?? 150,
      maxCola: m.maxCola ?? 100,
      permitirPlaylists: m.permitirPlaylists ?? true,
      anunciarAhora: m.anunciarAhora ?? true,
      autoSalir: m.autoSalir ?? true,
      fuentes: {
        youtube: m.fuentes?.youtube ?? true,
        spotify: m.fuentes?.spotify ?? true,
        soundcloud: m.fuentes?.soundcloud ?? true,
      },
    });
  }, [configServidor]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Sondeo del estado en vivo.
  const cargarEstado = useCallback(() => {
    if (!gid) return;
    apiFetch(`/api/config/${gid}/musica/estado`)
      .then((r) => r.json())
      .then((d) => setEstado(d))
      .catch(() => {});
  }, [gid]);

  useEffect(() => {
    cargarEstado();
    const id = setInterval(cargarEstado, 3000);
    return () => clearInterval(id);
  }, [cargarEstado]);

  const set = (campo, valor) => { setGuardado(false); setF((s) => ({ ...s, [campo]: valor })); };
  const setFuente = (k, v) => { setGuardado(false); setF((s) => ({ ...s, fuentes: { ...s.fuentes, [k]: v } })); };

  const guardar = async () => {
    setGuardando(true);
    const ok = await guardarMusica(f);
    setGuardando(false);
    setGuardado(ok);
  };

  const control = async (accion, valor) => {
    if (!gid) return;
    await apiFetch(`/api/config/${gid}/musica/control`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion, valor }),
    }).catch(() => {});
    cargarEstado();
  };

  if (!f) return <p className="text-muted">Cargando…</p>;

  const t = estado?.actual;

  return (
    <div className="space-y-6">
      {/* PANEL EN VIVO */}
      <Card className={card}>
        <div className="mb-4 flex items-center gap-2">
          <Music size={18} style={{ color: VERDE }} />
          <h3 className="text-lg font-bold text-fg">Sonando ahora</h3>
          {estado?.canalVoz && <span className="text-sm text-muted">· 🔊 {estado.canalVoz.nombre}</span>}
        </div>

        {t ? (
          <>
            <div className="flex items-center gap-4">
              {t.artwork
                ? <img src={t.artwork} alt="" className="h-20 w-20 rounded-2xl object-cover" />
                : <div className="flex h-20 w-20 items-center justify-center rounded-2xl text-3xl" style={{ background: `linear-gradient(135deg, ${VERDE}, #128a3e)` }}>🎵</div>}
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-bold text-fg">{t.title}</div>
                <div className="truncate text-muted">{t.author}</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                  <div className="h-full" style={{ width: `${t.duration ? Math.min(100, (estado.posicion / t.duration) * 100) : 0}%`, background: VERDE }} />
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted">
                  <span>{t.isStream ? 'EN DIRECTO' : fmt(estado.posicion)}</span>
                  <span>{t.isStream ? '🔴' : fmt(t.duration)}</span>
                </div>
              </div>
            </div>

            {/* Controles admin */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <BotonCtrl onClick={() => control(estado.pausado ? 'resume' : 'pause')}>
                {estado.pausado ? <Play size={18} /> : <Pause size={18} />}
              </BotonCtrl>
              <BotonCtrl onClick={() => control('skip')}><SkipForward size={18} /></BotonCtrl>
              <BotonCtrl onClick={() => control('stop')}><Square size={18} /></BotonCtrl>
              <BotonCtrl onClick={() => control('shuffle')} disabled={!estado.cola?.length}><Shuffle size={18} /></BotonCtrl>
              <div className="ml-auto flex items-center gap-2">
                <Volume2 size={18} className="text-muted" />
                <input type="range" min="0" max={f.volumenMax} defaultValue={estado.volumen ?? 60}
                  onMouseUp={(e) => control('volume', Number(e.target.value))}
                  style={{ accentColor: VERDE }} className="w-32" />
              </div>
            </div>

            {/* Cola */}
            {estado.cola?.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <div className="text-sm font-bold text-muted">En cola ({estado.cola.length})</div>
                {estado.cola.slice(0, 8).map((c, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl border border-line bg-bg px-3 py-1.5 text-sm">
                    <span className="w-5 text-center font-bold text-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-fg">{c.title}</span>
                    <span className="text-muted">{fmt(c.duration)}</span>
                    <button onClick={() => control('remove', i)} className="text-danger hover:opacity-70" title="Quitar">✕</button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="py-6 text-center text-muted">No hay nada sonando. Cuando alguien ponga música, la verás aquí en directo.</p>
        )}
      </Card>

      {/* CONFIGURACIÓN */}
      <Card className={card}>
        <h3 className="mb-2 text-lg font-bold text-fg">Configuración del reproductor</h3>

        <Ajuste titulo="Música activada" desc="Interruptor general. Si lo apagas, nadie puede poner música.">
          <Toggle checked={f.activo} onChange={(v) => set('activo', v)} />
        </Ajuste>

        <Ajuste titulo="Canal de música" desc="Dónde se publica el panel 'reproduciendo ahora' con sus botones. Vacío = el canal donde se use /play.">
          <select value={f.canalMusicaId} onChange={(e) => set('canalMusicaId', e.target.value)}
            className="rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg">
            <option value="">Automático</option>
            {(canales || []).map((c) => <option key={c.id} value={c.id}>#{c.nombre}</option>)}
          </select>
        </Ajuste>

        <Ajuste titulo="Rol DJ" desc="Si eliges un rol, solo ese rol (y los admins) controlan la música.">
          <select value={f.djRolId} onChange={(e) => set('djRolId', e.target.value)}
            className="rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg">
            <option value="">Cualquiera</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </Ajuste>

        <Ajuste titulo="Solo en el mismo canal" desc="Hay que estar en el mismo canal de voz que el bot para controlar.">
          <Toggle checked={f.soloMismoCanal} onChange={(v) => set('soloMismoCanal', v)} />
        </Ajuste>

        <Ajuste titulo="Permitir playlists" desc="Dejar que se encolen playlists enteras de una vez.">
          <Toggle checked={f.permitirPlaylists} onChange={(v) => set('permitirPlaylists', v)} />
        </Ajuste>

        <Ajuste titulo="Anunciar 'reproduciendo ahora'" desc="Mandar un mensaje en Discord cada vez que empieza una canción.">
          <Toggle checked={f.anunciarAhora} onChange={(v) => set('anunciarAhora', v)} />
        </Ajuste>

        <Ajuste titulo="Salir solo del canal" desc="Desconectarse al quedarse sin gente o sin cola.">
          <Toggle checked={f.autoSalir} onChange={(v) => set('autoSalir', v)} />
        </Ajuste>

        <Ajuste titulo="Volumen por defecto" desc={`Volumen al empezar: ${f.volumenDefecto}%`}>
          <input type="range" min="0" max={f.volumenMax} value={f.volumenDefecto}
            onChange={(e) => set('volumenDefecto', Number(e.target.value))} style={{ accentColor: VERDE }} className="w-40" />
        </Ajuste>

        <Ajuste titulo="Volumen máximo" desc={`Tope que se puede poner: ${f.volumenMax}%`}>
          <input type="range" min="50" max="300" value={f.volumenMax}
            onChange={(e) => set('volumenMax', Number(e.target.value))} style={{ accentColor: VERDE }} className="w-40" />
        </Ajuste>

        <Ajuste titulo="Tamaño máximo de cola" desc="0 = sin límite.">
          <input type="number" min="0" max="1000" value={f.maxCola}
            onChange={(e) => set('maxCola', Number(e.target.value))}
            className="w-24 rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg" />
        </Ajuste>

        <div className="pt-4">
          <div className="mb-2 font-semibold text-fg">Fuentes permitidas</div>
          <div className="flex flex-wrap gap-2">
            {[['youtube', 'YouTube'], ['spotify', 'Spotify'], ['soundcloud', 'SoundCloud']].map(([k, label]) => (
              <button key={k} onClick={() => setFuente(k, !f.fuentes[k])}
                className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${f.fuentes[k] ? 'border-brand bg-brand/10 text-fg' : 'border-line bg-bg text-muted hover:text-fg'}`}>
                {f.fuentes[k] && <Check size={14} style={{ color: VERDE }} />} {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button onClick={guardar} disabled={guardando}
            className="flex items-center gap-2 rounded-2xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-white shadow-soft transition-opacity hover:opacity-90 disabled:opacity-50">
            <Save size={16} /> {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
          {guardado && <span className="flex items-center gap-1 font-semibold" style={{ color: VERDE }}><Check size={16} /> Guardado</span>}
        </div>
      </Card>
    </div>
  );
}

function BotonCtrl({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-bg text-fg transition-colors hover:bg-elevated disabled:opacity-40">
      {children}
    </button>
  );
}

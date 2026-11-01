import { useEffect, useMemo, useState } from 'react';
import { apiJson, enviar, avatarPorDefecto } from './api.js';
import { usePermisos } from './contexto.js';
import { toast } from './toast.js';
import { Aviso, RolChip } from './ui.jsx';

const rolTiene = (rol, id) => (rol.heredados.includes(id) ? 'd' : rol.concedidos.includes(id) ? 'p' : null);

const PLANTILLAS = [
  { nombre: '🎧 Soporte básico', permisos: ['tickets.ver', 'tickets.responder', 'tickets.reclamar', 'tickets.notas', 'tickets.macros'] },
  { nombre: '🧑‍✈️ Supervisor', permisos: ['tickets.ver', 'tickets.responder', 'tickets.reclamar', 'tickets.reasignar', 'tickets.notas', 'tickets.macros', 'tickets.cerrar', 'tickets.reabrir', 'tickets.exportar'] },
  { nombre: '📊 Analista', permisos: ['tickets.ver', 'metricas.ver', 'usuarios.ver', 'logs.ver'] },
];

// ---------- 1) Mi acceso ----------
function MiAcceso({ yo, rolesData }) {
  const { catalogo, usuario, rango, guild } = usePermisos();
  const total = catalogo.permisos.length;
  const mios = yo.permisos.length;
  const pct = mios / total;
  const R = 44, C = 2 * Math.PI * R;
  const rolesCon = (id) => (rolesData?.roles || []).filter((r) => rolTiene(r, id) && !r.esAdmin);

  return (
    <>
      <div className="card hero">
        <img src={usuario.avatar || avatarPorDefecto(usuario.username)} alt="" />
        <div>
          <h2>{usuario.username}</h2>
          <span className={`rango ${rango}`}>{rango}</span>
          <div className="muted small" style={{ marginTop: 8 }}>en <strong>{guild.nombre}</strong> · {mios} de {total} permisos activos</div>
        </div>
        <div className="anillo" title={`${Math.round(pct * 100)}% de acceso`}>
          <svg width="104" height="104" viewBox="0 0 104 104">
            <circle cx="52" cy="52" r={R} fill="none" stroke="var(--border-color)" strokeWidth="9" />
            <circle cx="52" cy="52" r={R} fill="none" stroke="url(#g)" strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
            <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stopColor="#5865F2" /><stop offset="1" stopColor="#3ba55d" /></linearGradient></defs>
          </svg>
          <div className="centro"><div>{Math.round(pct * 100)}%<small>de acceso</small></div></div>
        </div>
      </div>

      {catalogo.grupos.map((g) => {
        const perms = catalogo.permisos.filter((p) => p.grupo === g.id);
        const activos = perms.filter((p) => yo.permisos.includes(p.id)).length;
        return (
          <div className="grupo" key={g.id} style={{ '--c': g.color }}>
            <div className="grupo-cab"><span style={{ fontSize: '1.3rem' }}>{g.icono}</span>{g.nombre}<span className="cuenta">{activos}/{perms.length} activos</span></div>
            <div className="perm-lista">
              {perms.map((p) => {
                const on = yo.permisos.includes(p.id);
                const fuentes = yo.fuentes[p.id] || [];
                const quienes = on ? [] : rolesCon(p.id).slice(0, 4);
                return (
                  <div key={p.id} className={`perm ${on ? 'on' : 'off'}`}>
                    <div className="ico">{on ? p.icono : '🔒'}</div>
                    <div>
                      <div className="t">{p.nombre}</div>
                      <div className="d">{p.desc}</div>
                      <div className="origen">
                        {on && fuentes.map((f, i) => <span key={i} className={`pill ${f.tipo === 'rol' ? 'panel' : 'discord'}`}>{f.tipo === 'dueno' ? '👑' : f.tipo === 'rol' ? '🎭' : '🎮'} {f.detalle}</span>)}
                        {!on && p.soloDiscord && <span className="pill discord">🎮 Requiere en Discord: {p.nativosNombre}</span>}
                        {!on && !p.soloDiscord && (quienes.length > 0
                          ? <><span className="pill">Pídeselo a alguien con:</span>{quienes.map((r) => <RolChip key={r.id} rol={r} />)}</>
                          : <span className="pill">Pide acceso a un administrador</span>)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ---------- 2) Mapa: qué roles entran a cada sección ----------
function Mapa({ yo, rolesData }) {
  const { catalogo } = usePermisos();
  const colorGrupo = (sec) => catalogo.grupos.find((g) => g.id === catalogo.permisos.find((p) => p.id === sec.requiere[0])?.grupo)?.color;
  return (
    <>
      <Aviso>Cada tarjeta es un apartado del panel. Abajo ves <strong>qué roles pueden entrar</strong>. El propietario del servidor siempre tiene acceso a todo.</Aviso>
      <div className="mapa">
        {catalogo.secciones.map((sec) => {
          const roles = rolesData.roles.filter((r) => sec.requiere.some((p) => rolTiene(r, p)));
          const yoEntro = sec.requiere.some((p) => yo.permisos.includes(p));
          return (
            <div key={sec.id} className={`seccion ${roles.length === 0 ? 'sin' : ''}`} style={{ '--c': colorGrupo(sec) }}>
              <div className="titulo"><span style={{ fontSize: '1.4rem' }}>{sec.icono}</span>{sec.nombre}<span className={`pill yo ${yoEntro ? 'panel' : ''}`}>{yoEntro ? '✅ Tú entras' : '🔒 No entras'}</span></div>
              <div className="small muted">Requiere: {sec.requiere.map((id) => catalogo.permisos.find((p) => p.id === id)?.nombre).join(' · ')}</div>
              <div className="roles">
                <span className="rol-chip" style={{ borderColor: '#f1c40f88' }}>👑 Propietario</span>
                {roles.map((r) => <RolChip key={r.id} rol={r} />)}
                {roles.length === 0 && <span className="small muted">Ningún otro rol tiene acceso todavía.</span>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------- 3) Matriz roles × permisos ----------
function Matriz({ rolesData }) {
  const { catalogo } = usePermisos();
  const roles = rolesData.roles.filter((r) => r.heredados.length + r.concedidos.length > 0).slice(0, 14);
  if (roles.length === 0) return <Aviso tipo="warn">Todavía no hay roles con permisos de panel.</Aviso>;
  return (
    <>
      <div className="leyenda">
        <span><span className="celda d">✓</span> Heredado de los permisos de Discord</span>
        <span><span className="celda p">✓</span> Concedido desde este panel</span>
        <span><span className="celda n">–</span> Sin acceso</span>
      </div>
      <div className="matriz-caja">
        <table className="matriz">
          <thead><tr><th>Permiso</th>{roles.map((r) => <th key={r.id}><RolChip rol={r} /></th>)}</tr></thead>
          <tbody>
            {catalogo.grupos.map((g) => (
              <MatrizGrupo key={g.id} g={g} roles={roles} permisos={catalogo.permisos.filter((p) => p.grupo === g.id)} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
function MatrizGrupo({ g, roles, permisos }) {
  return (
    <>
      <tr className="grupo-fila"><td colSpan={roles.length + 1}>{g.icono} {g.nombre}</td></tr>
      {permisos.map((p) => (
        <tr key={p.id}>
          <td title={p.desc}>{p.icono} {p.nombre}{p.soloDiscord && <span className="pill discord" style={{ marginLeft: 8 }}>solo Discord</span>}</td>
          {roles.map((r) => { const t = rolTiene(r, p.id); return <td key={r.id}><span className={`celda ${t || 'n'}`} title={t === 'd' ? 'Heredado de Discord' : t === 'p' ? 'Concedido desde el panel' : 'Sin acceso'}>{t ? '✓' : '–'}</span></td>; })}
        </tr>
      ))}
    </>
  );
}

// ---------- 4) Editor por rol ----------
function Editor({ rolesData, recargar }) {
  const [selId, setSelId] = useState(null);
  const sel = rolesData.roles.find((r) => r.id === selId) || null;
  return (
    <div className="editor">
      <div className="lista-roles">
        {rolesData.roles.map((r) => (
          <button key={r.id} className={`rol-item ${r.id === selId ? 'sel' : ''}`} style={{ '--c': r.color }} onClick={() => setSelId(r.id)}>
            <div className="grow">
              <div className="n">{r.nombre}</div>
              <div className="m">{r.miembros} miembro{r.miembros === 1 ? '' : 's'} · {r.heredados.length + r.concedidos.length} permisos</div>
            </div>
            <div className="avatares">{r.muestra.slice(0, 3).map((m) => <img key={m.id} src={m.avatar || avatarPorDefecto(m.nombre)} alt="" title={m.nombre} />)}</div>
          </button>
        ))}
      </div>
      <div className="pg">
        {!sel && <div className="card" style={{ textAlign: 'center', padding: 50 }}><div style={{ fontSize: '2.6rem' }}>👈</div><h3 style={{ justifyContent: 'center' }}>Elige un rol</h3><div className="muted">Verás y podrás ajustar a qué partes del panel accede.</div></div>}
        {/* key: al cambiar de rol (o tras guardar) el borrador se reinicia con los datos nuevos */}
        {sel && <EditorRol key={`${sel.id}:${sel.concedidos.join(',')}`} rol={sel} puedeEditarGlobal={rolesData.puedeEditar} recargar={recargar} />}
      </div>
    </div>
  );
}

function EditorRol({ rol: sel, puedeEditarGlobal, recargar }) {
  const { catalogo, tiene } = usePermisos();
  const [borrador, setBorrador] = useState(() => new Set(sel.concedidos));
  const [guardando, setGuardando] = useState(false);
  const editable = !!sel.editable;

  const cambios = useMemo(() => {
    const a = new Set(sel.concedidos);
    return [...borrador].filter((p) => !a.has(p)).length + [...a].filter((p) => !borrador.has(p)).length;
  }, [sel, borrador]);

  const alternar = (id) => setBorrador((b) => { const n = new Set(b); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const aplicarPlantilla = (pl) => setBorrador((b) => { const n = new Set(b); pl.permisos.filter((p) => tiene(p)).forEach((p) => n.add(p)); return n; });

  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await enviar('PUT', `/api/permisos/roles/${sel.id}`, { permisos: [...borrador] });
      toast(r.rechazados?.length ? `Guardado, pero ${r.rechazados.length} permiso(s) no se pudieron dar (no los tienes tú).` : `✅ Permisos de @${sel.nombre} guardados`, r.rechazados?.length ? 'info' : 'ok');
      await recargar();
    } catch (e) { toast(e.message, 'error'); } finally { setGuardando(false); }
  };

  return (
    <>
      <div className="card" style={{ borderLeft: `5px solid ${sel.color}` }}>
        <div className="row">
          <div className="grow"><h3 style={{ margin: 0 }}>@{sel.nombre}</h3><div className="muted small">{sel.miembros} miembro(s){sel.esAdmin && ' · Rol de Administrador: lo tiene todo'}</div></div>
          <div className="avatares">{sel.muestra.map((m) => <img key={m.id} src={m.avatar || avatarPorDefecto(m.nombre)} alt="" title={m.nombre} />)}</div>
        </div>
        {!puedeEditarGlobal && <div style={{ marginTop: 12 }}><Aviso tipo="warn">Estás en <strong>modo lectura</strong>: necesitas el permiso «Permisos del panel» para editar.</Aviso></div>}
        {puedeEditarGlobal && !sel.editable && <div style={{ marginTop: 12 }}><Aviso tipo="warn">Este rol está <strong>por encima del tuyo</strong>: no puedes modificarlo.</Aviso></div>}
        {editable && <div className="row" style={{ marginTop: 14 }}><span className="small muted">Plantillas rápidas:</span>{PLANTILLAS.map((pl) => <button key={pl.nombre} className="btn fantasma pequeno" onClick={() => aplicarPlantilla(pl)}>{pl.nombre}</button>)}</div>}
      </div>

      {catalogo.grupos.map((g) => (
        <div className="grupo" key={g.id} style={{ '--c': g.color }}>
          <div className="grupo-cab"><span style={{ fontSize: '1.3rem' }}>{g.icono}</span>{g.nombre}</div>
          {g.id === 'moderacion' && <div style={{ padding: '14px 14px 0' }}><Aviso tipo="info">Los permisos de moderación <strong>no se pueden dar desde el panel</strong>: salen solo de los permisos del rol en Discord (<em>Ajustes del servidor → Roles</em>). Así nadie banea desde la web sin poder banear en Discord.</Aviso></div>}
          <div className="perm-lista">
            {catalogo.permisos.filter((p) => p.grupo === g.id).map((p) => {
              const heredado = sel.heredados.includes(p.id);
              const on = heredado || borrador.has(p.id);
              const bloqDiscord = p.soloDiscord;
              const sinPoder = !bloqDiscord && !heredado && !tiene(p.id);
              const puedeTocar = editable && !heredado && !bloqDiscord && !sinPoder;
              return (
                <div key={p.id} className={`perm ${on ? 'on' : 'off'} ${puedeTocar ? 'editable' : ''} ${bloqDiscord ? 'bloq-discord' : ''}`}
                  onClick={() => puedeTocar && alternar(p.id)} role={puedeTocar ? 'switch' : undefined} aria-checked={puedeTocar ? !!on : undefined}>
                  <div className="ico">{p.icono}</div>
                  <div className="grow">
                    <div className="t">{p.nombre}</div>
                    <div className="d">{p.desc}</div>
                    <div className="origen">
                      {heredado && <span className="pill discord">🎮 {bloqDiscord ? 'Lo da Discord' : 'Heredado de Discord'}</span>}
                      {bloqDiscord && !heredado && <span className="pill">🔒 Solo desde Discord: {p.nativosNombre}</span>}
                      {sinPoder && <span className="pill">🔒 No puedes dar lo que no tienes</span>}
                      {!heredado && !bloqDiscord && borrador.has(p.id) && <span className="pill panel">🎭 Concedido desde el panel</span>}
                    </div>
                  </div>
                  {!bloqDiscord && <label className="switch" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={!!on} disabled={!puedeTocar} onChange={() => alternar(p.id)} aria-label={p.nombre} /><span className="pista" /></label>}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {editable && cambios > 0 && (
        <div className="barra-guardar">
          <span className="grow">✏️ <strong>{cambios}</strong> cambio{cambios === 1 ? '' : 's'} sin guardar</span>
          <button className="btn fantasma" onClick={() => setBorrador(new Set(sel.concedidos))}>Descartar</button>
          <button className="btn verde" disabled={guardando} onClick={guardar}>{guardando ? 'Guardando…' : '💾 Guardar permisos'}</button>
        </div>
      )}
    </>
  );
}

// ---------- Pantalla ----------
export default function Permisos() {
  const { guild, catalogo } = usePermisos();
  const [tab, setTab] = useState('yo');
  const [yo, setYo] = useState(null);
  const [rolesData, setRolesData] = useState(null);
  const [error, setError] = useState('');

  const cargar = () => Promise.all([apiJson('/api/permisos/yo'), apiJson('/api/permisos/roles')])
    .then(([a, b]) => { setYo(a); setRolesData(b); setError(''); })
    .catch((e) => setError(e.message));
  useEffect(() => {
    let vivo = true;
    Promise.all([apiJson('/api/permisos/yo'), apiJson('/api/permisos/roles')])
      .then(([a, b]) => { if (vivo) { setYo(a); setRolesData(b); setError(''); } })
      .catch((e) => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [guild.id]);

  if (error) return <Aviso tipo="error">{error}</Aviso>;
  if (!yo || !rolesData || !catalogo) return <div className="muted">Cargando permisos…</div>;

  return (
    <div className="pg">
      <div className="tabs" role="tablist">
        {[['yo', '🪪 Mi acceso'], ['mapa', '🗺️ Quién entra a qué'], ['matriz', '🧮 Matriz'], ['editor', '🎛️ Editar roles']].map(([id, nombre]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'activa' : ''}`} onClick={() => setTab(id)}>{nombre}</button>
        ))}
      </div>
      {tab === 'yo' && <MiAcceso yo={yo} rolesData={rolesData} />}
      {tab === 'mapa' && <Mapa yo={yo} rolesData={rolesData} />}
      {tab === 'matriz' && <Matriz rolesData={rolesData} />}
      {tab === 'editor' && <Editor rolesData={rolesData} recargar={cargar} />}
    </div>
  );
}

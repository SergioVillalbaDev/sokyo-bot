// Portal del Cliente: los usuarios entran con Discord y gestionan SUS tickets.
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LogIn, AlertTriangle, ArrowLeft, Send, Ticket as TicketIcon, Palette, Music as MusicIcon,
  Inbox, Upload, X, Check, Loader2,
} from 'lucide-react';
import { PRESETS_TARJETA } from './presetsTarjeta';
import MusicaPortal from './components/portal/MusicaPortal';
import { Avatar, Badge } from './components/ui/primitives';
import LanguageSwitcher from './components/LanguageSwitcher';
import './index.css';

// En producción la API y el portal se sirven en el mismo dominio: por defecto
// usamos rutas relativas (mismo origen). Para desarrollo define VITE_API_URL.
const API_URL = import.meta.env.VITE_API_URL || '';

function Portal() {
  const { t } = useTranslation();
  const [token, setToken] = useState(localStorage.getItem('portalToken') || '');
  const [usuario, setUsuario] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [ticketSel, setTicketSel] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [vista, setVista] = useState('tickets');
  const [tarjeta, setTarjeta] = useState({ colorAcento: '#5865F2', fondoTipo: 'color', fondoColor: '#1e2030', colorSecundario: '#9b59b6', fondoImagen: '', preset: null, animado: false });
  const [guardadoT, setGuardadoT] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewUrlRef = useRef('');
  const [catalogo, setCatalogo] = useState({ ocultos: [], personalizados: [] });

  // Tema de marca (Aurora) fijo para el portal — igual que landing y panel.
  useEffect(() => { document.documentElement.setAttribute('data-theme', 'lima'); }, []);

  // Al cargar: capturar token de la URL (vuelta del login) o errores.
  // Efecto solo-en-montaje: el setState aquí es intencional (leer la URL una vez).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tk = params.get('token');
    const err = params.get('error');
    if (err) setError(err === 'denegado' ? t('portal.login.errDenied') : t('portal.login.errOauth'));
    if (tk) {
      localStorage.setItem('portalToken', tk);
      setToken(tk);
      window.history.replaceState({}, '', '/?portal=1'); // limpia el token de la URL
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const portalFetch = (path, options = {}) => fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` }
  });

  const logout = () => { localStorage.removeItem('portalToken'); setToken(''); setUsuario(null); setTickets([]); setTicketSel(null); };

  // Cargar usuario + tickets cuando hay token
  useEffect(() => {
    if (!token) return;
    setCargando(true);
    Promise.all([
      portalFetch('/api/portal/yo').then(r => { if (r.status === 401) throw new Error('sesion'); return r.json(); }),
      portalFetch('/api/portal/tickets').then(r => r.json()),
      portalFetch('/api/portal/tarjeta').then(r => r.json()).catch(() => ({})),
      portalFetch('/api/portal/presets').then(r => r.json()).catch(() => ({ ocultos: [], personalizados: [] }))
    ])
      .then(([yo, tks, tj, cat]) => {
        setUsuario(yo); setTickets(Array.isArray(tks) ? tks : []); setError('');
        setCatalogo({ ocultos: cat?.ocultos || [], personalizados: cat?.personalizados || [] });
        if (tj && tj.colorAcento) setTarjeta({ colorAcento: tj.colorAcento, fondoTipo: tj.fondoTipo || 'color', fondoColor: tj.fondoColor || '#1e2030', colorSecundario: tj.colorSecundario || '#9b59b6', fondoImagen: tj.fondoImagen || '', preset: tj.preset || null, animado: !!tj.animado });
      })
      .catch(() => { setError(t('portal.login.errOauth')); logout(); })
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Refresco del chat abierto cada 4s
  useEffect(() => {
    if (!ticketSel) return;
    const cargar = () => portalFetch(`/api/portal/tickets/${ticketSel.canalId}/mensajes`).then(r => r.json()).then(d => setMensajes(Array.isArray(d) ? d : [])).catch(() => {});
    cargar();
    const id = setInterval(cargar, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketSel]);

  // Vista previa REAL: pide al bot la imagen (PNG o GIF) con los ajustes
  // actuales. Con debounce para no saturar al cambiar colores rápido.
  useEffect(() => {
    if (!token || vista !== 'tarjeta') return;
    const id = setTimeout(() => {
      setPreviewLoading(true);
      portalFetch('/api/portal/tarjeta/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tarjeta),
      })
        .then(r => (r.ok ? r.blob() : Promise.reject(new Error('preview'))))
        .then(blob => {
          const url = URL.createObjectURL(blob);
          if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
          previewUrlRef.current = url;
          setPreviewUrl(url);
        })
        .catch(() => {})
        .finally(() => setPreviewLoading(false));
    }, 500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarjeta, token, vista]);

  const enviar = async () => {
    if (!nuevoMensaje.trim()) return;
    const res = await portalFetch(`/api/portal/tickets/${ticketSel.canalId}/mensajes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contenido: nuevoMensaje })
    });
    if (res.ok) {
      setNuevoMensaje('');
      const d = await portalFetch(`/api/portal/tickets/${ticketSel.canalId}/mensajes`).then(r => r.json());
      setMensajes(Array.isArray(d) ? d : []);
    }
  };

  const setT = (campo, valor) => { setGuardadoT(false); setTarjeta(t2 => ({ ...t2, [campo]: valor })); };
  // Edición manual de un color/fondo: deja de coincidir con un preset, lo deselecciona.
  const setManual = (campo, valor) => { setGuardadoT(false); setTarjeta(t2 => ({ ...t2, [campo]: valor, preset: null, animado: false })); };
  // Aplica un diseño prediseñado: vuelca sus colores. Los premium están
  // bloqueados para no-premium; los personalizados gratis los puede usar todo el mundo.
  const aplicarPreset = (p) => {
    if (p.premium !== false && !usuario?.esPremium) return; // bloqueado
    setGuardadoT(false);
    setTarjeta(t2 => ({ ...t2, colorAcento: p.colorAcento, fondoColor: p.fondoColor, colorSecundario: p.colorSecundario, fondoTipo: p.fondoTipo, preset: p.id, animado: !!p.animado }));
  };
  const guardarTarjeta = async () => {
    const res = await portalFetch('/api/portal/tarjeta', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tarjeta)
    });
    setGuardadoT(res.ok);
  };
  // Sube un archivo del ordenador como fondo.
  // La tarjeta se genera a 900x270 px: exigimos al menos ese tamaño para que
  // no salga borrosa (imágenes más grandes con el mismo ratio valen igual).
  const ANCHO_MIN = 900, ALTO_MIN = 270;
  const subirFondo = (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    const lector = new FileReader();
    lector.onload = () => {
      // Comprobamos las dimensiones reales cargando la imagen en memoria.
      const img = new Image();
      img.onload = async () => {
        if (img.naturalWidth < ANCHO_MIN || img.naturalHeight < ALTO_MIN) {
          setError(t('portal.card.imgTooSmall', { w: img.naturalWidth, h: img.naturalHeight, minW: ANCHO_MIN, minH: ALTO_MIN }));
          return;
        }
        const res = await portalFetch('/api/portal/tarjeta/upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ datos: lector.result })
        });
        const data = await res.json().catch(() => ({}));
        if (data.url) setT('fondoImagen', data.url);
        else setError(data.error || t('portal.card.imgUploadError'));
      };
      img.onerror = () => setError(t('portal.card.imgReadError'));
      img.src = lector.result;
    };
    lector.readAsDataURL(file);
  };

  const colorEstado = (estado) => estado === 'Cerrado' ? 'var(--danger)' : 'var(--success)';
  const renderEstrellas = (p) => !p ? null : <span className="text-amber-400">{'★'.repeat(p)}{'☆'.repeat(5 - p)}</span>;

  // ---------- PANTALLA DE LOGIN ----------
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-4 text-fg">
        <div className="absolute right-5 top-5"><LanguageSwitcher /></div>
        <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-8 text-center shadow-soft">
          <img src="/assets/logo.jpg" alt="Sokyo" className="mx-auto h-14 w-14 rounded-full object-cover" />
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-fg">{t('portal.login.title')}</h1>
          <p className="mt-2 text-sm text-muted">{t('portal.login.subtitle')}</p>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-left text-sm text-danger">
              <AlertTriangle size={16} className="shrink-0" /> {error}
            </div>
          )}

          <a
            href={`${API_URL}/api/auth/discord`}
            className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-[#5865F2] px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#5865F2]/40 transition-transform hover:scale-[1.03]"
          >
            <LogIn size={18} /> {t('portal.login.button')}
          </a>
        </div>
      </div>
    );
  }

  // ---------- VISTA DE UN TICKET (CHAT) ----------
  if (ticketSel) {
    const cerrado = ticketSel.estado === 'Cerrado';
    return (
      <div className="min-h-screen bg-bg text-fg">
        <Cabecera usuario={usuario} onLogout={logout} />
        <div className="mx-auto max-w-3xl p-5">
          <button
            onClick={() => { setTicketSel(null); setMensajes([]); }}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-2 text-sm font-semibold text-fg transition-colors hover:bg-elevated"
          >
            <ArrowLeft size={16} /> {t('portal.chat.back')}
          </button>

          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-card shadow-soft">
            <div className="border-b border-line p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-fg">{ticketSel.titulo || ticketSel.motivo}</h2>
                <Badge color={colorEstado(ticketSel.estado)}>{ticketSel.estado}</Badge>
              </div>
              {ticketSel.descripcion && <p className="mt-2 text-sm italic leading-relaxed text-muted">{ticketSel.descripcion}</p>}
            </div>
            <div className="chat-box flex flex-col gap-3 overflow-y-auto p-5" style={{ minHeight: 350, maxHeight: '50vh' }}>
              {mensajes.length === 0
                ? <p className="m-auto text-center text-sm italic text-muted">{t('portal.chat.noMessages')}</p>
                : mensajes.map((m, i) => {
                    const mio = m.usuarioId === usuario?.id;
                    return (
                      <div key={i} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                          mio ? 'rounded-br-sm bg-gradient-brand text-on-brand' : 'rounded-bl-sm border border-line bg-bg text-fg'
                        }`}>
                          <p className={`mb-1 text-xs font-semibold ${mio ? 'text-on-brand/70' : 'text-brand'}`}>{m.usuario || t('portal.chat.unknownUser')}</p>
                          {m.contenido && <p className="whitespace-pre-wrap break-words leading-relaxed">{m.contenido}</p>}
                          {m.imagenes && m.imagenes.map((url, j) => <img key={j} src={url} alt="attachment" className="mt-2 max-w-full rounded-lg" />)}
                        </div>
                      </div>
                    );
                  })}
            </div>
            <div className="border-t border-line p-4">
              {cerrado
                ? <p className="text-center text-sm text-muted">{t('portal.chat.closedNote')}</p>
                : <div className="flex gap-2">
                    <input
                      value={nuevoMensaje}
                      onChange={e => setNuevoMensaje(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && enviar()}
                      placeholder={t('portal.chat.placeholder')}
                      className="flex-1 rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-fg outline-none transition-shadow focus:ring-2 focus:ring-brand/40"
                    />
                    <button
                      onClick={enviar}
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-on-brand transition-transform hover:scale-[1.03]"
                    >
                      <Send size={15} /> {t('portal.chat.send')}
                    </button>
                  </div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- MI TARJETA DE NIVEL (personalización) ----------
  if (vista === 'tarjeta') {
    // Presets de fábrica (sin los ocultados por el admin) + los personalizados.
    const presetsEfectivos = [
      ...PRESETS_TARJETA.filter(p => !catalogo.ocultos.includes(p.id)).map(p => ({ ...p, premium: true })),
      ...catalogo.personalizados.map(p => ({
        id: p.id, nombre: p.nombre, colorAcento: p.colorAcento, fondoColor: p.fondoColor,
        colorSecundario: p.colorSecundario, fondoTipo: p.fondoTipo || 'degradado', animado: !!p.animado, premium: !!p.premium,
        swatch: p.fondoTipo === 'color' ? p.fondoColor : `linear-gradient(135deg, ${p.fondoColor}, ${p.colorSecundario})`,
      })),
    ];
    const label = 'text-sm font-semibold text-fg';
    const colorInput = 'h-9 w-14 cursor-pointer rounded-lg border border-line bg-transparent p-0';
    return (
      <div className="min-h-screen bg-bg text-fg">
        <Cabecera usuario={usuario} onLogout={logout} />
        <div className="mx-auto max-w-3xl p-5">
          <Nav vista={vista} setVista={setVista} t={t} />
          <h1 className="flex items-center gap-2 text-xl font-bold text-fg"><Palette size={20} className="text-brand" /> {t('portal.card.title')}</h1>
          <p className="mt-1 text-sm text-muted">
            {t('portal.card.subtitlePre')} <strong className="text-fg">{t('portal.card.subtitleColors')}</strong> {t('portal.card.subtitleMid')} <strong className="text-amber-400">{t('portal.card.subtitlePremium')}</strong> {t('portal.card.subtitleEnd')}
          </p>

          {/* Vista previa REAL: la misma imagen que genera el bot (PNG o GIF animado) */}
          <div className="relative mt-4 overflow-hidden rounded-2xl border border-line bg-[#0b0b14]" style={{ aspectRatio: '900 / 270' }}>
            {previewUrl
              ? <img src={previewUrl} alt={t('portal.card.previewAlt')} className="block h-full w-full object-cover" />
              : <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">{t('portal.card.previewGenerating')}</div>}
            {previewLoading && (
              <div className="absolute right-3 top-2.5 flex items-center gap-1.5 rounded-md bg-black/55 px-2.5 py-1 text-xs text-white">
                <Loader2 size={12} className="animate-spin" /> {t('portal.card.previewUpdating')}
              </div>
            )}
          </div>

          {/* Controles */}
          <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-soft">
            <label className="flex items-center justify-between">
              <span className={label}>{t('portal.card.accentColor')}</span>
              <input type="color" value={tarjeta.colorAcento} onChange={e => setManual('colorAcento', e.target.value)} className={colorInput} />
            </label>
            <label className="flex items-center justify-between">
              <span className={label}>{t('portal.card.bgType')}</span>
              <select
                value={tarjeta.fondoTipo}
                onChange={e => setManual('fondoTipo', e.target.value)}
                className="w-40 rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg outline-none focus:ring-2 focus:ring-brand/40"
              >
                <option value="color">{t('portal.card.bgTypeSolid')}</option>
                <option value="degradado">{t('portal.card.bgTypeGradient')}</option>
                <option value="imagen" disabled={!usuario?.esPremium}>{t('portal.card.bgTypeImage')}</option>
              </select>
            </label>

            {(tarjeta.fondoTipo === 'color' || tarjeta.fondoTipo === 'degradado') && (
              <label className="flex items-center justify-between">
                <span className={label}>{t('portal.card.bgColor')}</span>
                <input type="color" value={tarjeta.fondoColor} onChange={e => setManual('fondoColor', e.target.value)} className={colorInput} />
              </label>
            )}

            {tarjeta.fondoTipo === 'degradado' && (
              <label className="flex items-center justify-between">
                <span className={label}>{t('portal.card.secondaryColor')}</span>
                <input type="color" value={tarjeta.colorSecundario} onChange={e => setManual('colorSecundario', e.target.value)} className={colorInput} />
              </label>
            )}

            {tarjeta.fondoTipo === 'imagen' && (
              <div className="flex flex-col gap-2 border-t border-line pt-4">
                <span className={label}>{t('portal.card.bgImageLabel')} <span className="text-amber-400">{t('portal.card.bgImagePremium')}</span></span>
                <div className="flex gap-2">
                  <input
                    value={tarjeta.fondoImagen} onChange={e => setT('fondoImagen', e.target.value)}
                    placeholder={t('portal.card.bgImagePlaceholder')}
                    className="flex-1 rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-fg outline-none focus:ring-2 focus:ring-brand/40"
                  />
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-gradient-brand px-4 text-sm font-semibold text-on-brand">
                    <Upload size={14} /> {t('portal.card.upload')}
                    <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={subirFondo} className="hidden" />
                  </label>
                </div>
                <span className="text-xs text-muted">{t('portal.card.bgImageHint')}</span>
                {tarjeta.fondoImagen && (
                  <button onClick={() => setT('fondoImagen', '')} className="flex w-fit items-center gap-1 self-start rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-danger/50 hover:text-danger">
                    <X size={12} /> {t('portal.card.removeImage')}
                  </button>
                )}
              </div>
            )}

            {/* Diseños prediseñados (los premium bloqueados para free) */}
            <div className="flex flex-col gap-2.5 border-t border-line pt-4">
              <span className={label}>{t('portal.card.presetsTitle')}</span>
              {!usuario?.esPremium && <span className="text-xs text-muted">{t('portal.card.presetsLockedHint')}</span>}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {presetsEfectivos.map(p => {
                  const bloqueado = p.premium !== false && !usuario?.esPremium;
                  const activo = tarjeta.preset === p.id;
                  return (
                    <button
                      key={p.id} onClick={() => aplicarPreset(p)} disabled={bloqueado}
                      className={`overflow-hidden rounded-xl border-2 transition-colors ${activo ? 'border-brand' : 'border-line'} ${bloqueado ? 'cursor-not-allowed' : 'cursor-pointer hover:border-brand/50'}`}
                    >
                      <div className="relative h-14" style={{ background: p.swatch || `linear-gradient(135deg, ${p.fondoColor}, ${p.colorSecundario})` }}>
                        <div className="absolute bottom-1.5 left-2 h-4 w-4 rounded-full border-2" style={{ borderColor: p.colorAcento }} />
                        {p.animado && <div className="absolute right-1.5 top-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white">✨ GIF</div>}
                        {bloqueado && <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-lg">🔒</div>}
                      </div>
                      <div className="p-1.5 text-left text-xs font-semibold text-fg">{p.nombre}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={guardarTarjeta} className="flex items-center gap-1.5 rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-bold text-on-brand transition-transform hover:scale-[1.03]">
                <Check size={15} /> {t('portal.card.save')}
              </button>
              {guardadoT && <span className="flex items-center gap-1 text-sm font-semibold text-ok"><Check size={15} /> {t('portal.card.saved')}</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- MÚSICA ----------
  if (vista === 'musica') {
    return (
      <div className="min-h-screen bg-bg text-fg">
        <Cabecera usuario={usuario} onLogout={logout} />
        <div className="mx-auto max-w-3xl p-5">
          <Nav vista={vista} setVista={setVista} t={t} />
          <h1 className="flex items-center gap-2 text-xl font-bold text-fg"><MusicIcon size={20} className="text-brand" /> {t('portal.nav.music')}</h1>
          <MusicaPortal portalFetch={portalFetch} />
        </div>
      </div>
    );
  }

  // ---------- LISTA DE MIS TICKETS ----------
  return (
    <div className="min-h-screen bg-bg text-fg">
      <Cabecera usuario={usuario} onLogout={logout} />
      <div className="mx-auto max-w-3xl p-5">
        <Nav vista={vista} setVista={setVista} t={t} />
        <h1 className="text-xl font-bold text-fg">{t('portal.tickets.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('portal.tickets.subtitle')}</p>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            <AlertTriangle size={16} className="shrink-0" /> {error}
          </div>
        )}

        <div className="mt-4">
          {cargando ? (
            <p className="text-sm text-muted">{t('portal.tickets.loading')}</p>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-elevated text-muted"><Inbox size={22} /></span>
              <p className="font-semibold text-fg">{t('portal.tickets.emptyTitle')}</p>
              <p className="text-sm text-muted">{t('portal.tickets.emptyDesc')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {tickets.map((tk, i) => (
                <button
                  key={i}
                  onClick={() => setTicketSel(tk)}
                  className="rounded-2xl border border-line bg-card p-4 text-left shadow-soft transition-colors hover:border-brand/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-fg">{tk.titulo || tk.motivo}</strong>
                    <Badge color={colorEstado(tk.estado)}>{tk.estado}</Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
                    <span className="flex items-center gap-1.5"><TicketIcon size={13} /> {tk.motivo} · {new Date(tk.fechaCreacion).toLocaleDateString()}</span>
                    {tk.estado === 'Cerrado' && renderEstrellas(tk.valoracionCSAT)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Nav({ vista, setVista, t }) {
  const tabs = [
    { id: 'tickets', label: t('portal.nav.tickets'), icon: TicketIcon },
    { id: 'tarjeta', label: t('portal.nav.card'), icon: Palette },
    { id: 'musica', label: t('portal.nav.music'), icon: MusicIcon },
  ];
  return (
    <div className="mb-5 flex flex-wrap items-center gap-1.5 rounded-full border border-line bg-card p-1.5">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setVista(id)}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            vista === id ? 'bg-gradient-brand text-on-brand shadow-md' : 'text-muted hover:bg-elevated hover:text-fg'
          }`}
        >
          <Icon size={15} /> {label}
        </button>
      ))}
    </div>
  );
}

function Cabecera({ usuario, onLogout }) {
  const { t } = useTranslation();
  return (
    <header className="flex items-center justify-between gap-2 border-b border-line bg-card px-4 py-3 sm:gap-3 sm:px-6 sm:py-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <img src="/assets/logo.jpg" alt="Sokyo" className="h-8 w-8 shrink-0 rounded-full object-cover" />
        <span className="truncate text-base font-extrabold tracking-tight text-fg">{t('portal.header.brand')}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <LanguageSwitcher />
        {usuario && (
          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <Avatar src={usuario.avatar} name={usuario.username} size={32} />
            <span className="hidden text-sm font-semibold text-fg sm:inline">{usuario.username}</span>
            <button
              onClick={onLogout}
              className="shrink-0 whitespace-nowrap rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-elevated hover:text-fg"
            >
              {t('portal.header.logout')}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Portal;

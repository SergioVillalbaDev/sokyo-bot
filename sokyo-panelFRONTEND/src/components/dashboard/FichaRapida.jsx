// Ficha rápida de una persona: al pasar el ratón (o al enfocar con el teclado)
// por su nombre en el panel, sale una tarjeta con lo justo para decidir: desde
// cuándo está, nivel, sanciones, tickets y roles. Pide los datos una vez
// (GET /api/servidor/miembro/:id/ficha) y los recuerda un minuto.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Crown, Bot, Ticket, ShieldAlert, TrendingUp, CalendarDays, Loader2, Gavel } from 'lucide-react';
import { Avatar, Badge } from '../ui/primitives';
import { apiFetch, procesarRespuesta } from '../../lib/api';

const cache = new Map(); // `${guildId}:${userId}` -> { t, datos }
const VIDA = 60 * 1000;
const ANCHO = 300;

function pedirFicha(guildId, userId) {
  const clave = `${guildId}:${userId}`;
  const c = cache.get(clave);
  if (c && Date.now() - c.t < VIDA) return Promise.resolve(c.datos);
  return apiFetch(`/api/servidor/miembro/${userId}/ficha?guildId=${encodeURIComponent(guildId)}`).then(procesarRespuesta).then((datos) => {
    cache.set(clave, { t: Date.now(), datos });
    return datos;
  });
}

const fecha = (ts, lng) => (ts ? new Date(ts).toLocaleDateString(lng, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export default function FichaRapida({ userId, guildId, children, onSancionar, className = '' }) {
  const { t, i18n } = useTranslation();
  const [pos, setPos] = useState(null); // { top, left } cuando está abierta
  const [datos, setDatos] = useState(null);
  const [fallo, setFallo] = useState(false);
  const ancla = useRef(null);
  const espera = useRef(null);
  const cierre = useRef(null);
  // Sin ratón (móvil) no hay «pasar por encima»: ahí no se abre.
  const conRaton = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

  useEffect(() => () => { clearTimeout(espera.current); clearTimeout(cierre.current); }, []);
  if (!userId || !guildId) return children;

  const abrir = () => {
    clearTimeout(cierre.current);
    if (pos) return;
    clearTimeout(espera.current);
    espera.current = setTimeout(() => {
      const r = ancla.current?.getBoundingClientRect();
      if (!r) return;
      const left = Math.max(8, Math.min(window.innerWidth - ANCHO - 8, r.left));
      const abajo = r.bottom + 8;
      setPos({ left, top: abajo + 260 > window.innerHeight ? Math.max(8, r.top - 268) : abajo });
      pedirFicha(guildId, userId).then((d) => { setDatos(d); setFallo(false); }).catch(() => setFallo(true));
    }, 380);
  };
  const cerrar = () => {
    clearTimeout(espera.current);
    cierre.current = setTimeout(() => setPos(null), 180);
  };

  return (
    <span ref={ancla} className={`inline-flex min-w-0 ${className}`}
      onMouseEnter={conRaton ? abrir : undefined} onMouseLeave={conRaton ? cerrar : undefined}
      onFocus={abrir} onBlur={cerrar}>
      {children}
      {pos && createPortal(
        <div role="dialog" aria-label={t('dashboard.ficha.titulo')} onMouseEnter={() => clearTimeout(cierre.current)} onMouseLeave={cerrar}
          className="sk-glass sk-aparece fixed z-[70] rounded-2xl border border-line bg-card p-4 text-left shadow-xl"
          style={{ top: pos.top, left: pos.left, width: ANCHO }}>
          {!datos && !fallo && <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-muted" /></div>}
          {fallo && <p className="text-sm text-muted">{t('dashboard.ficha.error')}</p>}
          {datos && (
            <>
              <div className="flex items-center gap-3">
                <Avatar src={datos.avatar} name={datos.displayName} size={44} />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-bold text-fg">
                    <span className="truncate">{datos.displayName}</span>
                    {datos.esDueno && <Crown size={13} className="shrink-0 text-amber-400" />}
                    {datos.bot && <Bot size={13} className="shrink-0 text-brand" />}
                  </p>
                  <p className="truncate text-xs text-muted">@{datos.username}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {!datos.enServidor && <Badge color="#e74c3c">{t('dashboard.ficha.fuera')}</Badge>}
                {datos.aisladoHasta && <Badge color="#e67e22">{t('dashboard.ficha.aislado')}</Badge>}
                {datos.roles.slice(0, 4).map((r) => <Badge key={r.id} color={r.color && r.color !== '#000000' ? r.color : undefined}>{r.nombre}</Badge>)}
                {datos.totalRoles > 4 && <span className="text-[11px] text-muted">+{datos.totalRoles - 4}</span>}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-elevated p-2"><dt className="flex items-center gap-1 text-muted"><CalendarDays size={12} /> {t('dashboard.ficha.desde')}</dt><dd className="mt-0.5 font-semibold text-fg">{fecha(datos.unidoEn, i18n.language)}</dd></div>
                <div className="rounded-xl bg-elevated p-2"><dt className="flex items-center gap-1 text-muted"><TrendingUp size={12} /> {t('dashboard.ficha.nivel')}</dt><dd className="mt-0.5 font-semibold text-fg">{datos.nivel} · {t('dashboard.ficha.mensajes', { count: datos.mensajes })}</dd></div>
                <div className="rounded-xl bg-elevated p-2"><dt className="flex items-center gap-1 text-muted"><ShieldAlert size={12} /> {t('dashboard.ficha.sanciones')}</dt><dd className={`mt-0.5 font-semibold ${datos.sanciones.activas ? 'text-danger' : 'text-fg'}`}>{datos.sanciones.total}{datos.sanciones.activas ? ` · ${t('dashboard.ficha.activas', { count: datos.sanciones.activas })}` : ''}</dd></div>
                <div className="rounded-xl bg-elevated p-2"><dt className="flex items-center gap-1 text-muted"><Ticket size={12} /> {t('dashboard.ficha.tickets')}</dt><dd className="mt-0.5 font-semibold text-fg">{datos.tickets.total}{datos.tickets.abiertos ? ` · ${t('dashboard.ficha.abiertos', { count: datos.tickets.abiertos })}` : ''}</dd></div>
              </dl>
              {datos.sanciones.ultimas.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-[11.5px] text-muted">
                  {datos.sanciones.ultimas.map((s, i) => (
                    <li key={i} className={`truncate ${s.revocada ? 'line-through' : ''}`}>• {t(`dashboard.ficha.accion.${s.accion}`, { defaultValue: s.accion })} · {fecha(s.fecha, i18n.language)}{s.motivo ? ` — ${s.motivo}` : ''}</li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[11px] text-muted">{t('dashboard.ficha.cuenta', { fecha: fecha(datos.creadoEn, i18n.language) })}</p>
              {onSancionar && datos.enServidor && !datos.esDueno && (
                <button onClick={() => { setPos(null); onSancionar(datos); }} className="sk-foco mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-elevated px-3 py-2 text-sm font-semibold text-fg ring-1 ring-line hover:text-brand">
                  <Gavel size={14} /> {t('dashboard.ficha.sancionar')}
                </button>
              )}
            </>
          )}
        </div>,
        // Dentro del panel, para que tenga su estilo de cristal y sus colores.
        document.querySelector('.sk-dash') || document.body,
      )}
    </span>
  );
}

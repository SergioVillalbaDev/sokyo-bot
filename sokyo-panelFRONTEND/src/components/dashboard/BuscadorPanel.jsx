// Buscador de todo el panel (Ctrl + K): encuentra cualquier sección aunque no
// se sepa cómo se llama ("ban", "xp", "welcome", "spotify"…) y los tickets.
// Sin escribir nada hace de índice: todas las secciones, agrupadas como el menú.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, CornerDownLeft, Crown, Ticket as TicketIcon, ArrowUp, ArrowDown } from 'lucide-react';
import { gruposVisibles, normalizar, metaKey, bloqueadoPorPlan, itemVisible } from './navConfig';
import { getStaffSession } from '../../lib/api';
import { cn } from '../../lib/cn';

const esOwner = !!getStaffSession()?.owner;

export default function BuscadorPanel({ abierto, onCerrar, irA, permisos, esPremium, moduleStatus = {}, tickets = [], abrirTicket, onRequestUpgrade }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const lista = useRef(null);

  // Todas las secciones visibles, con lo que se puede buscar de cada una.
  const secciones = useMemo(() => gruposVisibles(permisos, esOwner).flatMap((g) => g.items.map((it) => {
    const titulo = t(`dashboard.nav.items.${it.tab}`);
    const grupo = t(`dashboard.nav.groups.${g.id}`);
    const desc = t(`dashboard.meta.${metaKey(it.tab)}.subtitle`, { defaultValue: '' });
    return {
      tipo: 'seccion', id: it.tab, tab: it.tab, icono: it.icon, color: g.color, grupoId: g.id, titulo, grupo, desc,
      bloqueado: bloqueadoPorPlan(it, esPremium, esOwner),
      texto: normalizar(`${titulo} ${grupo} ${desc} ${it.kw || ''}`),
      tituloN: normalizar(titulo),
    };
  })), [t, permisos, esPremium]);

  const resultados = useMemo(() => {
    const palabras = normalizar(q).split(/\s+/).filter(Boolean);
    if (!palabras.length) return secciones;
    const puntos = (s) => {
      if (!palabras.every((p) => s.texto.includes(p))) return -1;
      const frase = palabras.join(' ');
      if (s.tituloN.startsWith(frase)) return 3;
      if (s.tituloN.includes(frase)) return 2;
      return 1;
    };
    const secc = secciones.map((s) => ({ s, p: puntos(s) })).filter((x) => x.p >= 0).sort((a, b) => b.p - a.p).map((x) => x.s);
    // Los tickets solo para quien puede abrir la bandeja (área "tickets").
    const puedeTickets = itemVisible({ area: 'tickets' }, permisos);
    const tks = (puedeTickets ? tickets || [] : []).filter((tk) => palabras.every((p) => normalizar(`${tk.titulo || ''} ${tk.motivo || ''} ${tk.creadorNombre || ''}`).includes(p)))
      .slice(0, 5)
      .map((tk) => ({ tipo: 'ticket', id: `tk-${tk.canalId}`, ticket: tk, titulo: tk.titulo || tk.motivo || 'Ticket', desc: `${tk.creadorNombre || ''} · ${tk.estado || ''}` }));
    return [...secc, ...tks];
  }, [q, secciones, tickets, permisos]);

  // Al abrir: vacío y con el foco en el primero.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { if (abierto) { setQ(''); setSel(0); } }, [abierto]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Mantener visible la fila elegida con el teclado.
  useEffect(() => {
    lista.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  if (!abierto) return null;

  const elegir = (r) => {
    if (!r) return;
    onCerrar();
    if (r.tipo === 'ticket') return abrirTicket?.(r.ticket);
    if (r.bloqueado) return onRequestUpgrade?.(r.tab);
    irA(r.tab);
  };
  const tecla = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onCerrar(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(resultados.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); elegir(resultados[sel]); }
  };

  const vacio = !q.trim();

  return (
    <div className="sk-velo flex items-start justify-center px-3 pt-[9vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div role="dialog" aria-modal="true" aria-label={t('dashboard.search.title')} className="sk-glass sk-brillo sk-aparece flex max-h-[78vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-xl">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={19} className="shrink-0 text-brand" />
          <input
            autoFocus value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} onKeyDown={tecla}
            placeholder={t('dashboard.search.placeholder')} aria-label={t('dashboard.search.placeholder')}
            className="w-full bg-transparent py-4 text-base text-fg outline-none placeholder:text-muted"
          />
          <span className="sk-tecla shrink-0">Esc</span>
        </div>

        <div ref={lista} className="flex-1 overflow-y-auto p-2" role="listbox">
          {resultados.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="font-semibold text-fg">{t('dashboard.search.nothingTitle')}</p>
              <p className="mt-1 text-sm text-muted">{t('dashboard.search.nothingDesc')}</p>
            </div>
          )}
          {resultados.map((r, i) => {
            // Sin buscar, las secciones van agrupadas con su título de grupo.
            const cabecera = vacio && r.tipo === 'seccion' && r.grupoId !== resultados[i - 1]?.grupoId ? r.grupo : null;
            const ticketsInicio = !vacio && r.tipo === 'ticket' && resultados[i - 1]?.tipo !== 'ticket';
            const Icono = r.tipo === 'ticket' ? TicketIcon : r.icono;
            const estado = r.tipo === 'seccion' && Object.prototype.hasOwnProperty.call(moduleStatus, r.tab) ? moduleStatus[r.tab] : undefined;
            return (
              <div key={r.id}>
                {cabecera && <p className="px-3 pb-1 pt-3 text-[10.5px] font-bold uppercase tracking-[.14em] text-muted">{cabecera}</p>}
                {ticketsInicio && <p className="px-3 pb-1 pt-3 text-[10.5px] font-bold uppercase tracking-[.14em] text-muted">{t('dashboard.header.searchTickets')}</p>}
                <button
                  data-i={i} role="option" aria-selected={i === sel}
                  onClick={() => elegir(r)} onMouseMove={() => sel !== i && setSel(i)}
                  className={cn('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors', i === sel ? 'bg-elevated' : '')}
                  style={{ '--grupo': r.color || 'var(--accent-color)' }}
                >
                  <span className="sk-icono-grupo h-9 w-9"><Icono size={17} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-fg">{r.titulo}</span>
                      {!vacio && r.tipo === 'seccion' && <span className="hidden shrink-0 text-[11px] text-muted sm:inline">· {r.grupo}</span>}
                      {estado !== undefined && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', estado ? 'bg-success' : 'ring-1 ring-muted/60')} title={estado ? t('dashboard.nav.moduleOn') : t('dashboard.nav.moduleOff')} />}
                    </span>
                    {r.desc && <span className="block truncate text-xs text-muted">{r.desc}</span>}
                  </span>
                  {r.bloqueado && <Crown size={14} className="shrink-0 text-amber-400" />}
                  {i === sel && <CornerDownLeft size={15} className="shrink-0 text-muted" />}
                </button>
              </div>
            );
          })}
        </div>

        <div className="hidden items-center gap-4 border-t border-line px-4 py-2.5 text-[11px] text-muted sm:flex">
          <span className="flex items-center gap-1.5"><span className="sk-tecla"><ArrowUp size={10} /><ArrowDown size={10} /></span> {t('dashboard.search.move')}</span>
          <span className="flex items-center gap-1.5"><span className="sk-tecla"><CornerDownLeft size={10} /></span> {t('dashboard.search.go')}</span>
          <span className="ml-auto">{t('dashboard.search.tip')}</span>
        </div>
      </div>
    </div>
  );
}

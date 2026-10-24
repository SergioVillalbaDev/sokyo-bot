// Mover y ordenar canales y categorías arrastrando (ratón o dedo).
// Se agarra por el asa ⠿ y se suelta donde se quiera: un canal puede cambiar
// de categoría. Las demás filas se apartan con una animación y, al guardar, el
// nuevo orden se aplica en Discord de una sola vez. Las flechas ↑ ↓ hacen lo
// mismo sin arrastrar (teclado y lectores de pantalla).
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { GripVertical, FolderTree, Hash, Volume2, Megaphone, MessagesSquare, Radio, ChevronUp, ChevronDown, Save, X, Loader2, Move, Inbox } from 'lucide-react';
import { cn } from '../../../lib/cn';

const ICONO_TIPO = { texto: Hash, voz: Volume2, anuncios: Megaphone, foro: MessagesSquare, escenario: Radio };
const SUELTOS = '__sueltos';
// En Discord los canales de voz van siempre debajo de los de texto dentro de cada
// categoría: el panel lo respeta para que lo que ves sea lo que quedará.
const esVoz = (tipo) => tipo === 'voz' || tipo === 'escenario';

function borradorDe(estructura) {
  return {
    sueltos: (estructura.sinCategoria || []).map((c) => c.id),
    cats: (estructura.categorias || []).map((c) => ({ id: c.id, canales: (c.canales || []).map((x) => x.id) })),
  };
}

export default function OrdenarCanales({ estructura, onGuardar, onCerrar, avisoInicial = '' }) {
  const { t } = useTranslation();
  const datos = useMemo(() => {
    const canales = new Map();
    const cats = new Map();
    (estructura.sinCategoria || []).forEach((c) => canales.set(c.id, c));
    (estructura.categorias || []).forEach((cat) => { cats.set(cat.id, cat); (cat.canales || []).forEach((c) => canales.set(c.id, c)); });
    return { canales, cats };
  }, [estructura]);

  const original = useMemo(() => JSON.stringify(borradorDe(estructura)), [estructura]);
  const [borrador, setBorrador] = useState(() => borradorDe(estructura));
  const [arrastre, setArrastre] = useState(null); // { tipo, id, x, y, dx, dy, ancho }
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(avisoInicial);
  const raiz = useRef(null);
  const puntero = useRef({ x: 0, y: 0 });
  const hayCambios = JSON.stringify(borrador) !== original;

  // Voz debajo de texto en cada lista (orden estable).
  const ordenarTipos = (ids) => [...ids.filter((id) => !esVoz(datos.canales.get(id)?.tipo)), ...ids.filter((id) => esVoz(datos.canales.get(id)?.tipo))];
  const normalizar = (b) => ({ sueltos: ordenarTipos(b.sueltos), cats: b.cats.map((c) => ({ ...c, canales: ordenarTipos(c.canales) })) });

  // Dónde está ahora un canal: { lista, indice }.
  const ubicar = (b, id) => {
    const i = b.sueltos.indexOf(id);
    if (i >= 0) return { lista: SUELTOS, indice: i };
    for (const c of b.cats) { const j = c.canales.indexOf(id); if (j >= 0) return { lista: c.id, indice: j }; }
    return null;
  };
  const listaDe = (b, lista) => (lista === SUELTOS ? b.sueltos : b.cats.find((c) => c.id === lista)?.canales || []);

  // Mueve un canal a (lista, índice). No hace nada si ya está ahí.
  const moverCanal = (id, lista, indice) => setBorrador((b) => {
    const desde = ubicar(b, id);
    if (!desde) return b;
    if (desde.lista === lista && (desde.indice === indice || desde.indice + 1 === indice)) return b;
    const sinEl = { sueltos: b.sueltos.filter((x) => x !== id), cats: b.cats.map((c) => ({ ...c, canales: c.canales.filter((x) => x !== id) })) };
    const destino = [...listaDe(sinEl, lista)];
    const ajuste = desde.lista === lista && desde.indice < indice ? indice - 1 : indice;
    destino.splice(Math.max(0, Math.min(ajuste, destino.length)), 0, id);
    const nuevo = lista === SUELTOS ? { ...sinEl, sueltos: destino } : { ...sinEl, cats: sinEl.cats.map((c) => (c.id === lista ? { ...c, canales: destino } : c)) };
    const normal = normalizar(nuevo);
    return JSON.stringify(normal) === JSON.stringify(b) ? b : normal;
  });
  const moverCategoria = (id, indice) => setBorrador((b) => {
    const desde = b.cats.findIndex((c) => c.id === id);
    if (desde < 0 || desde === indice || desde + 1 === indice) return b;
    const cats = [...b.cats];
    const [cat] = cats.splice(desde, 1);
    cats.splice(desde < indice ? indice - 1 : indice, 0, cat);
    return { ...b, cats };
  });

  // Flechas: un paso arriba/abajo (al llegar al borde, pasa a la categoría vecina).
  // El borde es el de su grupo: un canal de voz no puede subir por encima de los
  // de texto, así que desde el primero de voz se salta ya a la categoría anterior.
  const pasoCanal = (id, dir) => {
    const b = borrador;
    const u = ubicar(b, id);
    if (!u) return;
    const listas = [SUELTOS, ...b.cats.map((c) => c.id)];
    const actual = listaDe(b, u.lista);
    const mismoGrupo = (otro) => otro !== undefined && esVoz(datos.canales.get(otro)?.tipo) === esVoz(datos.canales.get(id)?.tipo);
    if (dir < 0 && mismoGrupo(actual[u.indice - 1])) return moverCanal(id, u.lista, u.indice - 1);
    if (dir > 0 && mismoGrupo(actual[u.indice + 1])) return moverCanal(id, u.lista, u.indice + 2);
    const vecina = listas[listas.indexOf(u.lista) + dir];
    if (vecina === undefined) return;
    moverCanal(id, vecina, dir < 0 ? listaDe(b, vecina).length : 0);
  };
  const pasoCategoria = (id, dir) => {
    const i = borrador.cats.findIndex((c) => c.id === id);
    const destino = dir < 0 ? i - 1 : i + 2;
    if (i < 0 || destino < 0 || destino > borrador.cats.length) return;
    moverCategoria(id, destino);
  };

  // ---- Arrastrar ----
  const empezar = (e, tipo, id) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const fila = e.currentTarget.closest('[data-arrastrable]');
    const r = fila.getBoundingClientRect();
    puntero.current = { x: e.clientX, y: e.clientY };
    setArrastre({ tipo, id, x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, ancho: r.width });
  };

  useEffect(() => {
    if (!arrastre) return undefined;
    const scroller = raiz.current?.closest('main');
    let raf = 0;

    // Decide dónde caería lo que se arrastra según lo que hay bajo el puntero.
    // Encima de su propio hueco o en el espacio entre filas no se mueve nada:
    // así no "salta" mientras las demás filas se apartan.
    const objetivo = (x, y) => {
      const pila = document.elementsFromPoint(x, y);
      if (arrastre.tipo === 'canal') {
        const fila = pila.find((el) => el.dataset?.canal);
        if (fila) {
          if (fila.dataset.canal === arrastre.id) return undefined;
          const r = fila.getBoundingClientRect();
          return moverCanal(arrastre.id, fila.dataset.lista, Number(fila.dataset.indice) + (y > r.top + r.height / 2 ? 1 : 0));
        }
        const cab = pila.find((el) => el.dataset?.cabeceraLista);
        if (cab) return moverCanal(arrastre.id, cab.dataset.cabeceraLista, 0);
        const zona = pila.find((el) => el.dataset?.zonaLista);
        if (zona) {
          // Solo al final de la lista (o si está vacía), nunca en un hueco entre filas.
          const filas = zona.querySelectorAll('[data-canal]');
          const ultima = filas[filas.length - 1];
          if (!ultima || y > ultima.getBoundingClientRect().bottom) return moverCanal(arrastre.id, zona.dataset.zonaLista, Number.MAX_SAFE_INTEGER);
        }
      } else {
        const bloque = pila.find((el) => el.dataset?.bloqueCat);
        if (bloque && bloque.dataset.bloqueCat !== arrastre.id) {
          const r = bloque.getBoundingClientRect();
          moverCategoria(arrastre.id, Number(bloque.dataset.indice) + (y > r.top + r.height / 2 ? 1 : 0));
        }
      }
      return undefined;
    };

    const mover = (e) => {
      puntero.current = { x: e.clientX, y: e.clientY };
      setArrastre((a) => (a ? { ...a, x: e.clientX, y: e.clientY } : a));
      objetivo(e.clientX, e.clientY);
    };
    const soltar = () => setArrastre(null);
    // Desplazamiento automático al acercarse a los bordes, solo cuando ya se
    // está arrastrando de verdad (si no, agarrar algo pegado al borde de abajo
    // movía la pantalla antes de mover nada). Más rápido cuanto más al borde.
    const inicioY = arrastre.y;
    let movido = false;
    const BORDE = 64;
    const bucle = () => {
      const { y } = puntero.current;
      if (!movido && Math.abs(y - inicioY) > 14) movido = true;
      if (scroller && movido) {
        const r = scroller.getBoundingClientRect();
        if (y < r.top + BORDE) scroller.scrollBy(0, -Math.ceil(14 * (1 - Math.max(0, y - r.top) / BORDE)));
        else if (y > r.bottom - BORDE) scroller.scrollBy(0, Math.ceil(14 * (1 - Math.max(0, r.bottom - y) / BORDE)));
      }
      raf = requestAnimationFrame(bucle);
    };
    raf = requestAnimationFrame(bucle);
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', soltar);
    const esc = (e) => { if (e.key === 'Escape') soltar(); };
    window.addEventListener('keydown', esc);
    document.documentElement.classList.add('sk-arrastrando');
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', soltar);
      window.removeEventListener('keydown', esc);
      document.documentElement.classList.remove('sk-arrastrando');
    };
    // Solo al empezar/terminar un arrastre (tipo e id), no en cada movimiento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrastre?.tipo, arrastre?.id]);

  const guardar = async () => {
    setGuardando(true); setError('');
    const r = await onGuardar({
      categorias: borrador.cats.map((c) => c.id),
      canales: [
        ...borrador.sueltos.map((id) => ({ id, categoriaId: null })),
        ...borrador.cats.flatMap((c) => c.canales.map((id) => ({ id, categoriaId: c.id }))),
      ],
    });
    setGuardando(false);
    if (r?.ok) onCerrar(true, r.aviso);
    else setError(mensajeError(r || {}));
  };

  // Qué decir si no se ha podido guardar (lo manda la API en `codigo`).
  const mensajeError = ({ codigo, canales = [], detalle = '' }) => {
    const clave = (k, extra) => t(`dashboard.canales_v.${k}`, extra);
    if (codigo === 'sin_permiso' && canales.length) return clave('orderNoPermChannels', { lista: canales.map((n) => `«${n}»`).join(', ') });
    const porCodigo = {
      sin_permiso: 'orderNoPerm', sin_permiso_servidor: 'orderNoPermServer', acceso: 'orderNoAccess',
      limite: 'orderRateLimit', tiempo: 'saveTimeout', red: 'orderNetwork', desactualizado: 'orderStale',
    };
    if (porCodigo[codigo]) return clave(porCodigo[codigo]);
    return detalle ? clave('orderDiscord', { detalle }) : clave('orderError');
  };

  const filaCanal = (id, lista, indice) => {
    const c = datos.canales.get(id);
    if (!c) return null;
    const Icono = ICONO_TIPO[c.tipo] || Hash;
    const arrastrando = arrastre?.tipo === 'canal' && arrastre.id === id;
    return (
      <motion.div
        key={id} layout layoutId={`canal-${id}`} transition={{ type: 'spring', stiffness: 520, damping: 40 }}
        data-arrastrable data-canal={id} data-lista={lista} data-indice={indice}
        className={cn('flex items-center gap-2 rounded-xl border px-2 py-2 text-sm transition-colors',
          arrastrando ? 'border-dashed border-brand/60 bg-brand/10 opacity-60' : 'border-line bg-bg')}
      >
        <button
          type="button" onPointerDown={(e) => empezar(e, 'canal', id)}
          className="sk-foco grid h-8 w-7 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted transition-colors hover:bg-elevated hover:text-fg active:cursor-grabbing"
          aria-label={t('dashboard.canales_v.dragChannel', { name: c.nombre })} title={t('dashboard.canales_v.dragHint')}
        >
          <GripVertical size={16} />
        </button>
        <Icono size={15} className="shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate text-fg">{c.nombre}</span>
        <span className="hidden shrink-0 text-xs text-muted sm:inline">{t(`dashboard.canales_v.types.${c.tipo}`)}</span>
        <button type="button" onClick={() => pasoCanal(id, -1)} className="sk-foco grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-fg" aria-label={t('dashboard.canales_v.moveUp')}><ChevronUp size={15} /></button>
        <button type="button" onClick={() => pasoCanal(id, 1)} className="sk-foco grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-fg" aria-label={t('dashboard.canales_v.moveDown')}><ChevronDown size={15} /></button>
      </motion.div>
    );
  };

  // Lo que se lleva bajo el dedo/ratón mientras se arrastra.
  const fantasma = arrastre && (() => {
    const estilo = { left: arrastre.x - arrastre.dx, top: arrastre.y - arrastre.dy, width: Math.min(arrastre.ancho, window.innerWidth - 16) };
    if (arrastre.tipo === 'canal') {
      const c = datos.canales.get(arrastre.id);
      const Icono = ICONO_TIPO[c?.tipo] || Hash;
      return (
        <div className="pointer-events-none fixed z-[80]" style={estilo}>
          <div className="sk-glass flex rotate-[-1.2deg] items-center gap-2 rounded-xl border border-brand/60 bg-card px-2 py-2 text-sm shadow-xl ring-2 ring-brand/30">
            <span className="grid h-8 w-7 place-items-center text-brand"><GripVertical size={16} /></span>
            <Icono size={15} className="text-brand" />
            <span className="truncate font-semibold text-fg">{c?.nombre}</span>
          </div>
        </div>
      );
    }
    const cat = datos.cats.get(arrastre.id);
    return (
      <div className="pointer-events-none fixed z-[80]" style={estilo}>
        <div className="sk-glass flex rotate-[-1deg] items-center gap-2.5 rounded-2xl border border-brand/60 bg-card px-3 py-3 shadow-xl ring-2 ring-brand/30">
          <GripVertical size={16} className="text-brand" />
          <FolderTree size={16} className="text-brand" />
          <span className="truncate font-bold uppercase tracking-wide text-fg">{cat?.nombre}</span>
        </div>
      </div>
    );
  })();

  return (
    <div ref={raiz} className="space-y-4">
      {/* Barra de acciones: siempre a la vista (compacta en el móvil) */}
      {/* Casi opaca (sk-flotante): la lista pasa por debajo al hacer scroll y no debe transparentarse. */}
      <div className="sk-flotante sticky top-0 z-20 flex flex-col gap-2.5 rounded-2xl border border-line px-3.5 py-3 shadow-lg sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Move size={18} className="shrink-0 text-brand" />
          <p className="min-w-0 flex-1 text-sm text-muted">
            <span className="sm:hidden">{t('dashboard.canales_v.orderHelpShort')}</span>
            <span className="hidden sm:inline">{t('dashboard.canales_v.orderHelp')}</span>
          </p>
          <AnimatePresence>
            {hayCambios && (
              <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="shrink-0 rounded-full bg-warn/15 px-2.5 py-1 text-xs font-bold text-warn">
                {t('dashboard.canales_v.unsaved')}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => onCerrar(false)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line px-3.5 py-2 text-sm font-semibold text-fg transition-colors hover:bg-elevated sm:flex-none">
            <X size={15} /> {t('dashboard.canales_v.orderCancel')}
          </button>
          <button onClick={guardar} disabled={!hayCambios || guardando} className="sk-nav-activo flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-opacity disabled:opacity-45 sm:flex-none">
            {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {t('dashboard.canales_v.orderSave')}
          </button>
        </div>
        {error && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold leading-snug text-danger sm:basis-full">{error}</p>}
      </div>
      <p className="px-1 text-xs text-muted">{t('dashboard.canales_v.voiceNote')}</p>

      <LayoutGroup>
        {/* Canales sin categoría (en Discord van arriba del todo) */}
        <div className="rounded-3xl border border-dashed border-line bg-card/40 p-3" data-zona-lista={SUELTOS}>
          <div className="mb-2 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider text-muted" data-cabecera-lista={SUELTOS}>
            <Inbox size={14} /> {t('dashboard.canales_v.uncategorized')}
          </div>
          <div className="space-y-1.5">
            {borrador.sueltos.map((id, i) => filaCanal(id, SUELTOS, i))}
            {borrador.sueltos.length === 0 && <p className="rounded-xl border border-dashed border-line px-3 py-3 text-center text-xs text-muted">{t('dashboard.canales_v.dropHere')}</p>}
          </div>
        </div>

        {borrador.cats.map((cat, ci) => {
          const info = datos.cats.get(cat.id);
          const arrastrando = arrastre?.tipo === 'categoria' && arrastre.id === cat.id;
          return (
            <motion.div
              key={cat.id} layout layoutId={`cat-${cat.id}`} transition={{ type: 'spring', stiffness: 420, damping: 38 }}
              data-arrastrable data-bloque-cat={cat.id} data-indice={ci}
              className={cn('rounded-3xl border p-3 shadow-soft', arrastrando ? 'border-dashed border-brand/60 bg-brand/10 opacity-60' : 'border-line bg-card')}
            >
              <div className="flex items-center gap-2" data-cabecera-lista={cat.id}>
                <button
                  type="button" onPointerDown={(e) => empezar(e, 'categoria', cat.id)}
                  className="sk-foco grid h-9 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted transition-colors hover:bg-elevated hover:text-fg active:cursor-grabbing"
                  aria-label={t('dashboard.canales_v.dragCategory', { name: info?.nombre })} title={t('dashboard.canales_v.dragHint')}
                >
                  <GripVertical size={17} />
                </button>
                <FolderTree size={16} className="shrink-0 text-brand" />
                <span className="min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-wide text-fg">{info?.nombre}</span>
                <span className="shrink-0 text-xs text-muted">{cat.canales.length}</span>
                <button type="button" onClick={() => pasoCategoria(cat.id, -1)} className="sk-foco grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-fg" aria-label={t('dashboard.canales_v.moveUp')}><ChevronUp size={16} /></button>
                <button type="button" onClick={() => pasoCategoria(cat.id, 1)} className="sk-foco grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-fg" aria-label={t('dashboard.canales_v.moveDown')}><ChevronDown size={16} /></button>
              </div>
              <div className="mt-2 space-y-1.5 pl-1 sm:pl-3" data-zona-lista={cat.id}>
                {cat.canales.map((id, i) => filaCanal(id, cat.id, i))}
                {cat.canales.length === 0 && <p className="rounded-xl border border-dashed border-line px-3 py-3 text-center text-xs text-muted">{t('dashboard.canales_v.dropHere')}</p>}
              </div>
            </motion.div>
          );
        })}
      </LayoutGroup>

      {fantasma}
    </div>
  );
}

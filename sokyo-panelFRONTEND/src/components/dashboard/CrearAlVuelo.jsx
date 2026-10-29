// «➕ Crear canal nuevo…» / «➕ Crear rol nuevo…» al final de los desplegables
// de canal o de rol: así no hay que irse a otra sección (ni a Discord) para
// crear el canal o el rol que falta. Cada desplegable solo añade <OpcionCrear />;
// este componente (montado una vez en el panel) se encarga del resto: pide el
// nombre, lo crea en Discord, recarga la lista y lo deja elegido.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Hash, AtSign, Loader2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';

const VALOR = { canal: '__crear_canal__', rol: '__crear_rol__' };

export function OpcionCrear({ tipo = 'canal' }) {
  const { t } = useTranslation();
  return <option value={VALOR[tipo]}>{t(`dashboard.crear.opcion.${tipo}`)}</option>;
}

// Cambia el valor de un <select> como si lo hubiera elegido la persona (React se entera).
function elegir(select, valor) {
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  set.call(select, valor);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

export default function CrearAlVuelo({ dash }) {
  const { t } = useTranslation();
  const [pedido, setPedido] = useState(null); // { tipo, select, antes }
  const [nombre, setNombre] = useState('');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const dashRef = useRef(dash);
  useEffect(() => { dashRef.current = dash; });

  useEffect(() => {
    // Lo que había elegido antes de abrir el desplegable (para volver a ello si cancela).
    const alEnfocar = (e) => { if (e.target instanceof HTMLSelectElement) e.target.dataset.skAntes = e.target.value; };
    const alCambiar = (e) => {
      const s = e.target;
      if (!(s instanceof HTMLSelectElement)) return;
      const tipo = s.value === VALOR.canal ? 'canal' : s.value === VALOR.rol ? 'rol' : null;
      if (!tipo) { s.dataset.skAntes = s.value; return; }
      // La sección no se entera de esta elección: el valor vuelve a lo de antes (lo
      // apuntado al abrir el desplegable o, si no, lo que tenía al pintarse).
      e.stopPropagation();
      s.value = s.dataset.skAntes ?? ([...s.options].find((o) => o.defaultSelected)?.value || '');
      setNombre(''); setError('');
      setPedido({ tipo, select: s, voz: s.dataset.crear === 'voz' });
    };
    window.addEventListener('focusin', alEnfocar, true);
    window.addEventListener('change', alCambiar, true);
    return () => { window.removeEventListener('focusin', alEnfocar, true); window.removeEventListener('change', alCambiar, true); };
  }, []);

  useEffect(() => {
    if (!pedido) return undefined;
    const alTeclear = (e) => { if (e.key === 'Escape' && !creando) setPedido(null); };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [pedido, creando]);

  if (!pedido) return null;
  const esCanal = pedido.tipo === 'canal';

  const crear = async (e) => {
    e.preventDefault();
    const limpio = nombre.trim();
    if (!limpio) return;
    setCreando(true); setError('');
    const d = dashRef.current;
    try {
      const res = esCanal
        ? await apiFetch(`/api/config/${d.guildId}/canales`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: pedido.voz ? 'voz' : 'texto', nombre: limpio }) })
        : await apiFetch('/api/roles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guildId: d.guildId, nombre: limpio, color: '#99aab5', permisos: [] }) });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok || !datos.success) { setError(datos.error || t('dashboard.crear.error')); setCreando(false); return; }
      const nuevoId = esCanal ? datos.canal?.id : (datos.rol?.id || datos.id);
      // Se recarga la lista y, cuando ya sale en el desplegable, se deja elegido.
      await (esCanal ? d.cargarCanales?.() : d.cargarRoles?.());
      const select = pedido.select;
      const intentar = (n) => {
        if (nuevoId && [...select.options].some((o) => o.value === nuevoId)) elegir(select, nuevoId);
        else if (n > 0) setTimeout(() => intentar(n - 1), 120);
      };
      intentar(15);
      setPedido(null);
    } catch {
      setError(t('dashboard.crear.error'));
    }
    setCreando(false);
  };

  return (
    <div className="sk-velo flex items-center justify-center p-3" onMouseDown={(e) => { if (e.target === e.currentTarget && !creando) setPedido(null); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="crear-titulo" onSubmit={crear} className="sk-glass sk-aparece w-full max-w-sm rounded-3xl border border-line bg-card p-5 shadow-xl">
        <h2 id="crear-titulo" className="flex items-center gap-2 text-lg font-extrabold text-fg">
          {esCanal ? <Hash size={19} className="text-brand" /> : <AtSign size={19} className="text-brand" />}
          {t(`dashboard.crear.titulo.${esCanal ? (pedido.voz ? 'voz' : 'canal') : 'rol'}`)}
        </h2>
        <p className="mt-1 text-sm text-muted">{t(`dashboard.crear.sub.${pedido.tipo}`)}</p>
        <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100}
          placeholder={t(`dashboard.crear.placeholder.${pedido.tipo}`)} aria-label={t(`dashboard.crear.placeholder.${pedido.tipo}`)}
          className="mt-4 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-fg outline-none focus:border-brand" />
        {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setPedido(null)} disabled={creando} className="sk-foco rounded-xl px-4 py-2.5 text-sm font-semibold text-muted hover:text-fg">{t('dashboard.crear.cancelar')}</button>
          <button type="submit" disabled={creando || !nombre.trim()} className="sk-foco flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2.5 text-sm font-semibold text-on-brand disabled:opacity-50">
            {creando && <Loader2 size={15} className="animate-spin" />} {t('dashboard.crear.crear')}
          </button>
        </div>
      </form>
    </div>
  );
}

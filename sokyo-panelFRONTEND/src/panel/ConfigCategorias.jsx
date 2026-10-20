import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAvisoSalida } from '../hooks.js';
import { useToast } from '../contexto.js';
import { BarraGuardar } from '../components/ui.jsx';
import Icono from '../components/Icono.jsx';

const MAX_MOTIVOS = 25;
const MAX_URGENCIAS = 10;
const limpiarUrgencias = (lista) => (lista || []).map(({ nombre, color, nivel }) => ({ nombre, color, nivel }));
const limpiarMotivos = (lista) => (lista || []).map(({ nombre, urgencia }) => ({ nombre, urgencia }));

function validar(urgencias, motivos) {
  const errores = [];
  const repetido = (lista) => lista.find((x, i) => lista.findIndex(y => y.nombre.trim().toLowerCase() === x.nombre.trim().toLowerCase()) !== i);
  if (urgencias.some(u => !u.nombre.trim())) errores.push('Hay una urgencia sin nombre.');
  if (motivos.some(m => !m.nombre.trim())) errores.push('Hay una categoría sin nombre.');
  if (repetido(urgencias)) errores.push(`La urgencia «${repetido(urgencias).nombre}» está repetida.`);
  if (repetido(motivos)) errores.push(`La categoría «${repetido(motivos).nombre}» está repetida.`);
  if (motivos.length === 0) errores.push('Debe haber al menos una categoría.');
  if (urgencias.some(u => !Number.isInteger(Number(u.nivel)) || u.nivel < 1 || u.nivel > 1000)) errores.push('El nivel de urgencia debe ser un número entre 1 y 1000.');
  return errores;
}

export default function ConfigCategorias({ guildId, config, setConfig, marcarCambios }) {
  const toast = useToast();
  const [urgencias, setUrgencias] = useState(() => limpiarUrgencias(config.urgencias));
  const [motivos, setMotivos] = useState(() => limpiarMotivos(config.motivos));
  const [guardando, setGuardando] = useState(false);
  const [nuevaUrgencia, setNuevaUrgencia] = useState({ nombre: '', color: '#9b59b6', nivel: 1 });
  const [nuevoMotivo, setNuevoMotivo] = useState({ nombre: '', urgencia: '' });

  const original = JSON.stringify([limpiarUrgencias(config.urgencias), limpiarMotivos(config.motivos)]);
  const hayCambios = JSON.stringify([urgencias, motivos]) !== original;
  const errores = validar(urgencias, motivos);
  useEffect(() => { marcarCambios(hayCambios); return () => marcarCambios(false); }, [hayCambios, marcarCambios]);
  useAvisoSalida(hayCambios);

  const usos = (nombreUrgencia) => motivos.filter(m => m.urgencia === nombreUrgencia).length;
  const ordenadas = urgencias.map((u, i) => ({ ...u, indice: i })).sort((a, b) => b.nivel - a.nivel);
  const urgenciaPorDefecto = urgencias.find(u => u.nombre === 'Normal')?.nombre || ordenadas[ordenadas.length - 1]?.nombre || '';

  // --- urgencias
  const editarUrgencia = (indice, cambios) => {
    const anterior = urgencias[indice];
    setUrgencias(lista => lista.map((u, i) => (i === indice ? { ...u, ...cambios } : u)));
    // Si se renombra, las categorías que la usaban la siguen usando.
    if (cambios.nombre !== undefined && anterior.nombre !== cambios.nombre) {
      setMotivos(lista => lista.map(m => (m.urgencia === anterior.nombre ? { ...m, urgencia: cambios.nombre } : m)));
    }
  };
  const borrarUrgencia = (indice) => {
    const u = urgencias[indice];
    const n = usos(u.nombre);
    if (n > 0) return toast.error(`«${u.nombre}» la usan ${n} categoría(s). Cámbiales la urgencia antes de borrarla.`);
    if (urgencias.length === 1) return toast.error('Debe quedar al menos un nivel de urgencia.');
    setUrgencias(lista => lista.filter((_, i) => i !== indice));
  };
  const añadirUrgencia = (e) => {
    e.preventDefault();
    const nombre = nuevaUrgencia.nombre.trim();
    if (!nombre) return;
    if (urgencias.some(u => u.nombre.toLowerCase() === nombre.toLowerCase())) return toast.error(`Ya existe la urgencia «${nombre}».`);
    setUrgencias(lista => [...lista, { nombre, color: nuevaUrgencia.color, nivel: Number(nuevaUrgencia.nivel) || 1 }]);
    setNuevaUrgencia({ nombre: '', color: '#9b59b6', nivel: 1 });
  };

  // --- categorías
  const editarMotivo = (indice, cambios) => setMotivos(lista => lista.map((m, i) => (i === indice ? { ...m, ...cambios } : m)));
  const moverMotivo = (indice, delta) => setMotivos(lista => {
    const copia = [...lista];
    const [item] = copia.splice(indice, 1);
    copia.splice(indice + delta, 0, item);
    return copia;
  });
  const añadirMotivo = (e) => {
    e.preventDefault();
    const nombre = nuevoMotivo.nombre.trim();
    if (!nombre) return;
    if (motivos.some(m => m.nombre.toLowerCase() === nombre.toLowerCase())) return toast.error(`Ya existe la categoría «${nombre}».`);
    setMotivos(lista => [...lista, { nombre, urgencia: nuevoMotivo.urgencia || urgenciaPorDefecto }]);
    setNuevoMotivo({ nombre: '', urgencia: nuevoMotivo.urgencia });
  };

  const descartar = () => {
    setUrgencias(limpiarUrgencias(config.urgencias));
    setMotivos(limpiarMotivos(config.motivos));
  };
  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await api(`/api/servidores/${guildId}/config`, {
        metodo: 'PUT',
        body: {
          urgencias: urgencias.map(u => ({ ...u, nombre: u.nombre.trim(), nivel: Number(u.nivel) })),
          motivos: motivos.map(m => ({ ...m, nombre: m.nombre.trim() }))
        }
      });
      setConfig(r.config);
      setUrgencias(limpiarUrgencias(r.config.urgencias));
      setMotivos(limpiarMotivos(r.config.motivos));
      toast.exito('Categorías guardadas. Los próximos tickets ya las usarán.');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <div className="rejilla-config">
        <section className="tarjeta">
          <div className="tarjeta-cabecera">
            <div>
              <h3>🏷️ Categorías del formulario</h3>
              <p>Lo que el usuario elige al abrir un ticket, en este orden. Máximo {MAX_MOTIVOS}.</p>
            </div>
            <span className="texto-3 pequeño">{motivos.length}/{MAX_MOTIVOS}</span>
          </div>
          <div className="tarjeta-cuerpo">
            <div className="lista-editable">
              {motivos.map((m, i) => (
                <div key={i} className="item-editable">
                  <div className="columna" style={{ gap: 0 }}>
                    <button className="btn btn-fantasma btn-icono btn-sm" style={{ width: 24, minHeight: 18 }} onClick={() => moverMotivo(i, -1)} disabled={i === 0} aria-label={`Subir ${m.nombre}`}><Icono nombre="arriba" /></button>
                    <button className="btn btn-fantasma btn-icono btn-sm" style={{ width: 24, minHeight: 18 }} onClick={() => moverMotivo(i, 1)} disabled={i === motivos.length - 1} aria-label={`Bajar ${m.nombre}`}><Icono nombre="abajo" /></button>
                  </div>
                  <input className="entrada entrada-sm" style={{ flex: 1 }} value={m.nombre} maxLength={80} aria-label="Nombre de la categoría"
                    onChange={(e) => editarMotivo(i, { nombre: e.target.value })} />
                  <select className="entrada entrada-sm" style={{ width: 130 }} value={m.urgencia} aria-label={`Urgencia de ${m.nombre}`}
                    onChange={(e) => editarMotivo(i, { urgencia: e.target.value })}>
                    {ordenadas.map(u => <option key={u.indice} value={u.nombre}>{u.nombre}</option>)}
                  </select>
                  <button className="btn btn-fantasma btn-icono btn-sm" onClick={() => setMotivos(lista => lista.filter((_, j) => j !== i))}
                    disabled={motivos.length === 1} aria-label={`Borrar ${m.nombre}`} title="Borrar categoría"><Icono nombre="papelera" /></button>
                </div>
              ))}
            </div>
            <form className="form-añadir" onSubmit={añadirMotivo}>
              <input className="entrada entrada-sm" placeholder="Nueva categoría, ej: Problemas de pago" maxLength={80} value={nuevoMotivo.nombre}
                onChange={(e) => setNuevoMotivo(v => ({ ...v, nombre: e.target.value }))} aria-label="Nombre de la nueva categoría" />
              <select className="entrada entrada-sm" style={{ width: 130, flex: 'none' }} value={nuevoMotivo.urgencia || urgenciaPorDefecto}
                onChange={(e) => setNuevoMotivo(v => ({ ...v, urgencia: e.target.value }))} aria-label="Urgencia de la nueva categoría">
                {ordenadas.map(u => <option key={u.indice} value={u.nombre}>{u.nombre}</option>)}
              </select>
              <button className="btn btn-exito btn-sm" disabled={!nuevoMotivo.nombre.trim() || motivos.length >= MAX_MOTIVOS}><Icono nombre="mas" />Añadir</button>
            </form>
          </div>
        </section>

        <section className="tarjeta">
          <div className="tarjeta-cabecera">
            <div>
              <h3>🚥 Niveles de urgencia</h3>
              <p>Cuanto mayor el nivel, antes aparece en el panel. El color se usa en Discord y aquí.</p>
            </div>
          </div>
          <div className="tarjeta-cuerpo">
            <div className="lista-editable">
              {ordenadas.map(u => (
                <div key={u.indice} className="item-editable" style={{ borderLeft: `4px solid ${u.color}` }}>
                  <input type="color" className="entrada-color" value={u.color} onChange={(e) => editarUrgencia(u.indice, { color: e.target.value })} aria-label={`Color de ${u.nombre}`} />
                  <input className="entrada entrada-sm" style={{ flex: 1 }} value={u.nombre} maxLength={30} aria-label="Nombre de la urgencia"
                    onChange={(e) => editarUrgencia(u.indice, { nombre: e.target.value })} />
                  <label className="fila texto-3 pequeño" style={{ gap: 6 }}>
                    Nivel
                    <input className="entrada entrada-sm" type="number" min="1" max="1000" style={{ width: 72 }} value={u.nivel}
                      onChange={(e) => editarUrgencia(u.indice, { nivel: e.target.value === '' ? '' : Number(e.target.value) })} />
                  </label>
                  <span className="texto-3 pequeño" style={{ width: 70, textAlign: 'right' }}>{usos(u.nombre) ? `${usos(u.nombre)} en uso` : 'sin uso'}</span>
                  <button className="btn btn-fantasma btn-icono btn-sm" onClick={() => borrarUrgencia(u.indice)} aria-label={`Borrar ${u.nombre}`} title="Borrar urgencia"><Icono nombre="papelera" /></button>
                </div>
              ))}
            </div>
            <form className="form-añadir" onSubmit={añadirUrgencia}>
              <input type="color" className="entrada-color" value={nuevaUrgencia.color} onChange={(e) => setNuevaUrgencia(v => ({ ...v, color: e.target.value }))} aria-label="Color de la nueva urgencia" />
              <input className="entrada entrada-sm" placeholder="Nueva urgencia, ej: Crítica" maxLength={30} value={nuevaUrgencia.nombre}
                onChange={(e) => setNuevaUrgencia(v => ({ ...v, nombre: e.target.value }))} aria-label="Nombre de la nueva urgencia" />
              <input className="entrada entrada-sm" type="number" min="1" max="1000" style={{ width: 80, flex: 'none' }} value={nuevaUrgencia.nivel}
                onChange={(e) => setNuevaUrgencia(v => ({ ...v, nivel: e.target.value }))} aria-label="Nivel de la nueva urgencia" title="Nivel" />
              <button className="btn btn-exito btn-sm" disabled={!nuevaUrgencia.nombre.trim() || urgencias.length >= MAX_URGENCIAS}><Icono nombre="mas" />Añadir</button>
            </form>
          </div>
        </section>
      </div>

      <BarraGuardar visible={hayCambios} guardando={guardando} errores={errores} onGuardar={guardar} onDescartar={descartar} />
    </>
  );
}

import { useState } from 'react';
import { api } from '../api.js';
import { useCarga } from '../hooks.js';
import { useToast } from '../contexto.js';
import { AvisoError, Avatar, Campo, Cargando, Vacio } from '../components/ui.jsx';
import Icono from '../components/Icono.jsx';

export default function NuevoTicket({ onCreado }) {
  const toast = useToast();
  const servidores = useCarga(() => api('/api/portal/servidores'), []);
  const [guildId, setGuildId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [asunto, setAsunto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (servidores.error && !servidores.datos) return <AvisoError error={servidores.error} onReintentar={servidores.recargar} />;
  if (!servidores.datos) return <Cargando />;

  const lista = servidores.datos;
  if (lista.length === 0) {
    return (
      <div className="tarjeta">
        <Vacio emoji="🤷" titulo="No hay servidores disponibles" accion={<a className="btn btn-secundario" href="#/portal">Volver</a>}>
          Para abrir un ticket tienes que estar en un servidor de Discord donde esté Sokyo.
        </Vacio>
      </div>
    );
  }

  const servidor = lista.find(s => s.id === guildId) || (lista.length === 1 ? lista[0] : null);
  const enLimite = servidor && servidor.abiertos >= servidor.maxTickets;
  const listo = servidor && motivo && asunto.trim().length >= 3 && descripcion.trim() && !enLimite;

  const enviar = async (e) => {
    e.preventDefault();
    if (!listo) return;
    setEnviando(true);
    try {
      const ticket = await api('/api/portal/tickets', {
        metodo: 'POST',
        body: { guildId: servidor.id, motivo, asunto: asunto.trim(), descripcion: descripcion.trim() }
      });
      toast.exito(`Ticket ${ticket.numero ? `#${String(ticket.numero).padStart(4, '0')} ` : ''}creado. ¡Te responderemos pronto!`);
      onCreado(ticket);
    } catch (err) {
      toast.error(err.message);
      setEnviando(false);
    }
  };

  return (
    <>
      <div className="fila" style={{ gap: 12 }}>
        <a className="btn btn-secundario btn-icono" href="#/portal" aria-label="Volver a mis tickets" title="Volver"><Icono nombre="atras" /></a>
        <div>
          <h1>Nuevo ticket</h1>
          <p className="texto-2">Cuéntanos qué pasa y el equipo te responderá por aquí y por Discord.</p>
        </div>
      </div>

      <form className="tarjeta tarjeta-cuerpo columna" style={{ gap: 20 }} onSubmit={enviar}>
        {lista.length > 1 && (
          <div className="campo">
            <span className="etiqueta">1. Servidor</span>
            <div className="opciones-categoria">
              {lista.map(s => (
                <button key={s.id} type="button" className="opcion" aria-pressed={servidor?.id === s.id} onClick={() => { setGuildId(s.id); setMotivo(''); }}>
                  <span className="fila"><Avatar src={s.icono} nombre={s.nombre} tamaño={24} /><strong className="recortar">{s.nombre}</strong></span>
                </button>
              ))}
            </div>
          </div>
        )}

        {servidor && (
          <>
            {enLimite && (
              <div className="aviso aviso-alerta">
                <span aria-hidden>⚠️</span>
                <span>Ya tienes {servidor.abiertos} ticket{servidor.abiertos === 1 ? '' : 's'} abierto{servidor.abiertos === 1 ? '' : 's'} en {servidor.nombre} (máximo {servidor.maxTickets}). <a href="#/portal">Escribe en el que ya tienes</a> o ciérralo antes de abrir otro.</span>
              </div>
            )}

            <div className="campo">
              <span className="etiqueta">{lista.length > 1 ? '2. ' : '1. '}¿Sobre qué es tu consulta?</span>
              <div className="opciones-categoria" role="group" aria-label="Categoría">
                {servidor.motivos.map(m => (
                  <button key={m.nombre} type="button" className="opcion" aria-pressed={motivo === m.nombre} onClick={() => setMotivo(m.nombre)}>
                    <strong>{m.nombre}</strong>
                    <span className="texto-3 pequeño">Prioridad {m.urgencia}</span>
                  </button>
                ))}
              </div>
            </div>

            <Campo etiqueta="Asunto" id="asunto" max={100} valor={asunto}>
              <input id="asunto" className="entrada" maxLength={100} value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Ej: No puedo acceder a mi cuenta" />
            </Campo>
            <Campo etiqueta="Describe tu problema" id="descripcion" max={1500} valor={descripcion} ayuda="Cuanto más detalle (qué pasa, desde cuándo, qué has probado), antes podremos ayudarte.">
              <textarea id="descripcion" className="entrada" style={{ minHeight: 150 }} maxLength={1500} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </Campo>

            <div className="fila" style={{ justifyContent: 'flex-end' }}>
              <a className="btn btn-fantasma" href="#/portal">Cancelar</a>
              <button className="btn btn-primario" disabled={!listo || enviando}><Icono nombre="enviar" />{enviando ? 'Creando ticket…' : 'Abrir ticket'}</button>
            </div>
          </>
        )}
      </form>
    </>
  );
}

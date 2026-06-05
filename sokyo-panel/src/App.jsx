import { useState, useEffect } from 'react';

function App() {
  const [servidores, setServidores] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [mensajes, setMensajes] = useState([]); // Mensajes del ticket seleccionado
  const [ticketSeleccionado, setTicketSeleccionado] = useState(null);

  // Cargar tickets al iniciar
  useEffect(() => {
    fetch('http://localhost:3000/api/tickets')
      .then(res => res.json())
      .then(data => setTickets(data));
  }, []);

  // Función para abrir un ticket y cargar sus mensajes
  const seleccionarTicket = (ticket) => {
    setTicketSeleccionado(ticket);
    fetch(`http://localhost:3000/api/mensajes/${ticket.canalId}`)
      .then(res => res.json())
      .then(data => setMensajes(data));
  };

  return (
    <div style={{ display: 'flex', padding: '20px', gap: '20px' }}>
      
      {/* Columna Izquierda: Lista de Tickets */}
      <div style={{ flex: 1 }}>
        <h1>Tickets</h1>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
              <th style={{ padding: '10px' }}>Usuario</th>
              <th style={{ padding: '10px' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(t => (
              <tr key={t.canalId} 
                  onClick={() => seleccionarTicket(t)}
                  style={{ cursor: 'pointer', borderBottom: '1px solid #ddd', backgroundColor: ticketSeleccionado?.canalId === t.canalId ? '#e1f5fe' : 'white' }}>
                <td style={{ padding: '10px' }}>{t.creadorNombre}</td>
                <td style={{ padding: '10px' }}>{t.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Columna Derecha: Chat del Ticket */}
      <div style={{ flex: 2, border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}>
        <h2>Chat del Ticket</h2>
        {ticketSeleccionado ? (
          <div style={{ height: '400px', overflowY: 'auto', backgroundColor: '#f9f9f9', padding: '10px' }}>
            {mensajes.map((m, i) => (
              <div key={i} style={{ marginBottom: '10px' }}>
                <strong>{m.usuario}:</strong> {m.contenido}
              </div>
            ))}
          </div>
        ) : (
          <p>Selecciona un ticket para ver la conversación.</p>
        )}
      </div>
    </div>
  );
}

export default App;
// Cambia los {marcadores} de un mensaje por valores de ejemplo para las vistas previas
// del panel (components/dashboard/VistaDiscord.jsx). Los que no se conocen se dejan tal
// cual, para que se vea que no existen. Los nombres son los que rellena el bot al enviar.
export function rellenarEjemplo(texto, variables = {}) {
  return String(texto || '').replace(/\{(\w+)\}/g, (todo, nombre) => (Object.prototype.hasOwnProperty.call(variables, nombre) ? String(variables[nombre]) : todo));
}

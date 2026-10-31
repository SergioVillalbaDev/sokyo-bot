// Colores de los botones de Discord que se pueden elegir en los paneles
// (verificación, doble bienvenida…). El bot los traduce en utils/embeds.js
// (`estiloBoton`): verde = Success, azul = Primary, gris = Secondary, rojo = Danger.
export const ESTILOS_BOTON = [
  { id: 'verde', fondo: '#248046' },
  { id: 'azul', fondo: '#5865F2' },
  { id: 'gris', fondo: '#4E5058' },
  { id: 'rojo', fondo: '#DA373C' },
];

export const fondoBoton = (id) => (ESTILOS_BOTON.find((e) => e.id === id) || ESTILOS_BOTON[0]).fondo;

// Mensajes con botón que el bot deja fijos en un canal («Preséntate», «Nueva
// sugerencia»…), 1.9.14: lo que guarda cada sección y su forma en el formulario
// (EditorMensajePanel.jsx). En el bot: utils/panelMensaje.js.
export const PANEL_VACIO = { contenido: '', embed: null, textoBoton: '', estiloBoton: '' };

// Lo guardado (models/ServidorConfig.js) → el formulario.
export const panelDesde = (p) => ({
  contenido: p?.contenido || '', embed: p?.embed || null, textoBoton: p?.textoBoton || '', estiloBoton: p?.estiloBoton || '',
});

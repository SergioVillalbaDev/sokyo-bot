// Valores por defecto de un embed para el constructor (EmbedBuilder) y las
// vistas que lo usan (EmbedsView, AnunciosView). En un archivo aparte para
// no romper el fast-refresh (un .jsx solo debe exportar componentes).
export const EMBED_VACIO = {
  titulo: '', tituloUrl: '', descripcion: '', color: '#5865F2',
  imagenUrl: '', imagenArchivo: '', miniaturaUrl: '', miniaturaArchivo: '',
  autorNombre: '', autorUrl: '', autorIconoUrl: '', autorIconoArchivo: '',
  footer: '', footerIconoUrl: '', footerIconoArchivo: '',
  fecha: false, campos: [],
};

// Paletas de color rápidas para el selector.
export const PALETAS_COLOR = [
  '#5865F2', '#eb459e', '#ed4245', '#fee75c', '#57f287', '#1abc9c',
  '#e67e22', '#f47fff', '#9b59b6', '#3498db', '#2c3e50', '#ffffff',
];

// Valores por defecto de un embed para el constructor (EmbedBuilder) y las
// vistas que lo usan (EmbedsView, AnunciosView). En un archivo aparte para
// no romper el fast-refresh (un .jsx solo debe exportar componentes).
export const EMBED_VACIO = {
  titulo: '', descripcion: '', color: '#5865F2',
  imagenUrl: '', imagenArchivo: '', miniaturaUrl: '', miniaturaArchivo: '',
  autorNombre: '', footer: '', fecha: false, campos: [],
};

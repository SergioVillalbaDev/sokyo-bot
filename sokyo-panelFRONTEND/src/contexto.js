import { createContext, useContext } from 'react';

// Permisos del usuario en el servidor activo + catálogo (grupos, permisos, secciones).
export const PermisosContext = createContext({
  permisos: new Set(), rango: 'Sin acceso', catalogo: null, usuario: null, guild: null,
  tiene: () => false, tieneAlguno: () => false,
});

export const usePermisos = () => useContext(PermisosContext);

export const crearChequeos = (lista) => {
  const set = new Set(lista);
  return { permisos: set, tiene: (p) => set.has(p), tieneAlguno: (ps) => ps.some((p) => set.has(p)) };
};

// Nombre legible de un permiso a partir del catálogo.
export const nombrePermiso = (catalogo, id) => catalogo?.permisos.find((p) => p.id === id)?.nombre || id;

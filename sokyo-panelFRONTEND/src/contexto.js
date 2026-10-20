import { createContext, useContext } from 'react';

// Avisos flotantes (toasts): toast.exito('Guardado'), toast.error('Algo falló')
export const ContextoToast = createContext(null);
export const useToast = () => useContext(ContextoToast);

// Diálogo de confirmación: const ok = await confirmar({ titulo, mensaje, peligro: true })
// Con `campo` devuelve { ok, valor } para pedir un texto (p. ej. el motivo de cierre).
export const ContextoConfirmar = createContext(null);
export const useConfirmar = () => useContext(ContextoConfirmar);

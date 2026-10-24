// App móvil del panel. Android: una app (Trusted Web Activity, ver
// app-android/) que abre /panel con el motor de Chrome. iPhone: la web.
// Si se publica una APK nueva, actualizar aquí su versión y su tamaño.
export const APK_URL = '/descargas/sokyo-panel.apk';
export const APK_VERSION = '1.0.0';
export const APK_MB = 1.2;
export const PAQUETE_ANDROID = 'studio.sokyo.panel';

const CLAVE = 'sokyoApp';

// Al abrir la app de Android, Chrome pone como referrer el paquete de la app.
// Se recuerda en sessionStorage: es de esa pestaña (la de la app) y sobrevive a
// la vuelta del login con Discord. localStorage no vale: Chrome lo comparte.
export function marcarSiEsApp() {
  try {
    if (document.referrer.startsWith(`android-app://${PAQUETE_ANDROID}`)) sessionStorage.setItem(CLAVE, 'android');
  } catch { /* sin almacenamiento: solo no se detecta la app */ }
}

export function enLaAppAndroid() {
  try { return sessionStorage.getItem(CLAVE) === 'android'; } catch { return false; }
}

// Dispositivo desde el que se mira, para destacar la opción que le sirve.
export function dispositivo() {
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  // El iPad con iPadOS se presenta como un Mac, pero con pantalla táctil.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  return 'ordenador';
}

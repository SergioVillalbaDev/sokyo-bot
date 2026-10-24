# App de Android del panel (Sokyo Panel)

Una *Trusted Web Activity*: abre `https://dashboard.sokyo.studio/panel` a
pantalla completa con el motor de Chrome. Todo el contenido es la web, así que
**cada despliegue del panel llega solo a la app**; solo hace falta una APK nueva
si cambian el icono, el nombre, el dominio o la versión de Android mínima.

- Paquete: `studio.sokyo.panel` · minSdk 21 (Android 5.0) · targetSdk 35
- La descarga se sirve desde `sokyo-panelFRONTEND/public/descargas/sokyo-panel.apk`
  (sección «App móvil» del panel).
- La web confirma que confía en la app en `/.well-known/assetlinks.json`
  (`api/server.js`). Ahí va la huella SHA-256 de la clave con la que se firma.
  Si no coincide, la app sigue funcionando pero enseña una barra de dirección.

## Recompilar

Requisitos: JDK 17 o superior y el SDK de Android (plataforma 35 y build-tools
35.0.0). Indica dónde está el SDK en `local.properties` (`sdk.dir=...`, no se
sube al repositorio) o con `ANDROID_HOME`.

La clave de firma **no está en el repositorio**. Guárdala bien: Android solo
acepta actualizaciones firmadas con la misma clave.

```bash
cd app-android
export SOKYO_KEYSTORE=/ruta/a/sokyo-panel.keystore
export SOKYO_KEYSTORE_PASS='la contraseña'
export SOKYO_KEY_ALIAS=sokyo
./gradlew assembleRelease
cp app/build/outputs/apk/release/app-release.apk ../sokyo-panelFRONTEND/public/descargas/sokyo-panel.apk
```

Sin `SOKYO_KEYSTORE` se firma con la clave de depuración (vale para probar,
pero no para publicar: la huella no coincidiría con `assetlinks.json`).

Al publicar una APK nueva:

1. Sube `versionCode` y `versionName` en `app/build.gradle`.
2. Actualiza `APK_VERSION` y `APK_MB` en `sokyo-panelFRONTEND/src/lib/appMovil.js`.
3. Si cambias de clave, pon su huella en `ANDROID_CERT_SHA256` del `.env`
   (`keytool -list -v -keystore sokyo-panel.keystore` → «SHA256»).

Los iconos salen del logo (`sokyo-panelFRONTEND/public/assets/logo.jpg`).

# Vídeos de Instagram en la web (@pikt314)

Cómo funciona:

```
Cron de Vercel (1 vez al día)
        └─> /api/instagram?action=sync
                 ├─ renueva el token si tiene más de 20 días
                 ├─ pide las publicaciones a graph.instagram.com/me/media
                 └─ guarda el resultado en Firestore: sitio_publico/instagram_feed
                                 │
La web (VideosInstagram.jsx) ────┘  lee ese documento → rejilla de tarjetas
                                    al pulsar → embed oficial dentro de un modal
```

La web **nunca** habla con Instagram ni ve el token: solo lee un documento de Firestore.
Si algún día el token muere, la galería sigue mostrando lo último sincronizado.

---

## 1. Cuenta de Instagram profesional

En la app de Instagram: **Configuración → Tipo de cuenta → Cambiar a cuenta profesional**
(Creador o Empresa, da igual). La API ya no funciona con cuentas personales.

## 2. App en Meta for Developers

1. Entra en <https://developers.facebook.com/apps> → **Crear app**.
2. Caso de uso: **Otro** → tipo **Empresa** (o directamente el caso de uso de Instagram si te lo ofrece).
3. En el panel de la app: **Añadir producto → Instagram → Configurar**.
4. Dentro de Instagram, pestaña **Configuración de la API con inicio de sesión de Instagram**.
5. En **Generación de tokens** pulsa **Añadir cuenta** y conecta `@pikt314`.
6. Pulsa **Generar token** y **cópialo**. Ese es un token de larga duración (60 días);
   a partir de ahí nuestra función lo renueva sola.

> No hace falta pasar la revisión de la app ni sacarla de modo desarrollo:
> los permisos `instagram_business_basic` sobre **tu propia cuenta** funcionan sin revisión.

## 3. Cuenta de servicio de Firebase

Para que la función pueda escribir en Firestore:

1. <https://console.firebase.google.com> → proyecto `aprendiendo-db0b3` → ⚙️ **Configuración del proyecto** → **Cuentas de servicio**.
2. **Generar nueva clave privada** → se descarga un `.json`.
3. Ese JSON entero es el valor de la variable `GOOGLE_SERVICE_ACCOUNT_JSON`.
   Para evitar problemas con los saltos de línea, mejor pégalo en base64:

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\ruta\a\la\clave.json")) | Set-Clipboard
   ```

   La función acepta las dos formas (JSON crudo o base64).

⚠️ **No subas nunca ese .json al repositorio.**

## 4. Variables de entorno en Vercel

Proyecto → **Settings → Environment Variables** (marca Production, Preview y Development):

| Variable | Valor |
|---|---|
| `IG_TOKEN` | el token del paso 2 (solo se usa el primer día; luego manda el de Firestore) |
| `CRON_SECRET` | una cadena larga inventada, p. ej. la salida de `openssl rand -hex 24` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | el JSON (o base64) del paso 3 |

## 5. Publicar reglas de Firestore

Se ha añadido a `firebase-reglas/firestore.rules`:

```
match /sitio_publico/{doc} {
  allow read: if true;
  allow write: if false;
}
```

Cópialo a la consola de Firebase → Firestore → Reglas → **Publicar**.
La escritura desde el servidor usa la cuenta de servicio, que **se salta las reglas**,
así que `write: false` es correcto: nadie puede tocarlo desde el navegador.

## 6. Desplegar y probar

Tras el deploy, lanza la primera sincronización a mano:

```
https://pikt.es/api/instagram?action=sync&key=TU_CRON_SECRET
```

Respuesta esperada:

```json
{ "ok": true, "guardados": 37, "videos": 29, "tokenRenovado": true, "caduca": "..." }
```

Y luego mira la galería en **<https://pikt.es/videos>**.

Para ver el estado sin secreto: `https://pikt.es/api/instagram` (devuelve el feed cacheado).

---

## Mantenimiento

- **El cron** corre a las 05:00 UTC todos los días (`vercel.json`). En el plan Hobby de Vercel
  solo se permite frecuencia diaria; es más que suficiente.
- **El token** se renueva solo a los 20 días de vida. Solo tendrías que volver a generarlo a mano
  si la web estuviera más de 60 días sin sincronizar (o si cambias de cuenta).
- **Las miniaturas** son URLs del CDN de Instagram y caducan con el tiempo: por eso el cron
  diario las reescribe. Si una falla, la tarjeta enseña un degradado en vez de romperse.
- La API no devuelve nº de visualizaciones ni de "me gusta" en este modo; si algún día
  los quieres, hacen falta permisos de `instagram_business_manage_insights`.

## Usar la galería en otro sitio

```jsx
import VideosInstagram from './components/VideosInstagram';

// Sección dentro de otra página (los 6 últimos vídeos)
<VideosInstagram compacto limite={6} />

// Incluir también fotos y carruseles
<VideosInstagram soloVideos={false} />
```

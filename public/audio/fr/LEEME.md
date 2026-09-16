# Audios de Listening en francés

Un mp3 por tema, con el nombre del campo `topic` de `src/BibliotecaListeningFR.js`.

## Grabarlos

    npm run audios:fr                       # graba los que falten
    npm run audios:fr -- --force            # regraba todos
    npm run audios:fr -- --solo=le-sport    # solo un tema
    npm run audios:fr -- --voces            # lista las voces francesas disponibles
    npm run audios:fr -- --voz=fr-FR-HenriNeural --rate=-15%

Usa las voces neuronales de Edge (gratis, sin clave de API) a través de la
dependencia de desarrollo `msedge-tts`. Salida: mp3 mono 24 kHz 48 kbps,
~300 KB por tema de un minuto.

El texto locutado es el `fullTranscript` de cada tema (sin los huecos), así que
si cambias un texto hay que regenerar la biblioteca (`npm run listening:fr`) y
volver a grabar ese tema con `--solo=<topic> --force`.

## Si falta un audio

No pasa nada: el juego lo detecta y lee el texto con la voz del dispositivo
(fr-FR). En cuanto el mp3 existe, lo usa automáticamente.

## Cuando la colección crezca

Con 50-100 temas serían 25-35 MB en el repositorio. A partir de ahí conviene
subirlos a Firebase Storage y cambiar `audioUrl` a la URL pública.

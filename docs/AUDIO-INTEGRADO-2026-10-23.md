# Audio integrado — 0.8.3

La prueba en navegador reprodujo el fallo de SpeechSynthesis: el efecto de inicio se ejecutaba, pero la voz no emitía el evento de arranque. El indicador de preferencia activada no demostraba reproducción efectiva.

Las 54 figuras tradicionales ahora usan un archivo de voz sintética integrado de 560543 bytes con un índice de 54 segmentos. No dependen de las voces instaladas en el dispositivo. El canto y los tres efectos comparten un único AudioContext y fuentes de búfer; no crean elementos HTML de audio/video, reproductores externos, ventanas ni controles MediaSession. La descarga y decodificación se reutilizan. Cancelar antes de terminar la descarga evita sonidos atrasados.

Se mantiene SpeechSynthesis como alternativa para nombres personalizados sin grabación. En esa alternativa se retiene la referencia a la emisión, se reactiva el motor antes de hablar y se detecta el arranque fallido mediante un plazo. El usuario puede reactivar la voz; un fallo no se confunde con una preferencia voluntaria de silencio. Las 54 figuras no invocan esa alternativa.

Se conservan las políticas del administrador, silencio del jugador, pausa/visibilidad/desconexión y las reglas de presentación. El toque sigue sin audio; última carta una vez, sin bucle; final únicamente después de una presentación ganadora validada.

Verificación: pruebas automatizadas del motor único, caché, cancelaciones, autorización de reproducción, índice de las 54 figuras, canto sin SpeechSynthesis y detección de arranque fallido. Prueba local con eventos reales del navegador: inicio integrado y, sin otros gestos, El Gallo y La Luna con eventos de inicio y fin; cero elementos de reproductor. No se operaron partidas reales.

La modalidad solicitada es sonido dentro del juego sin abrir reproductor; no reproducción con la pantalla bloqueada. El navegador conserva su requisito de un primer gesto para habilitar AudioContext.

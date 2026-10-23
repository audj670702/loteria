# Audio de inicio y pregonero predeterminado — 0.8.2

La app carga assets/inicia_partida.mp3 y lo reproduce una sola vez al pasar de BORRADOR a EN_CURSO (o al entrar en curso antes de la primera figura). No se repite por actualizaciones, pausa/reanudación ni al volver a una partida avanzada. Se suspende al pausar, perder sincronización, ocultar la app o cerrar la partida. Respeta la política de audio del administrador y el silencio del jugador.

La voz del pregonero está activada de manera predeterminada en la app. Un gesto de puntero o teclado habilita la síntesis del navegador mediante una emisión silenciosa; se conserva el estado explícito de silencio durante la partida. Empezar otra partida restablece el valor predeterminado. No recita el historial al entrar.

Se conservan las reglas anteriores: toque sin audio, última carta una vez sin bucle y audio final sólo al presentar un cartón que el servidor valida como ganador. No se modifican backend, PCP, usuarios, EO ni colecciones. Se conserva la versión más reciente de los audios que el usuario subió al repositorio.

Validación: 52 pruebas automatizadas aprobadas y verificación visual en demostración local: el menú muestra Silenciar pregonero y Audio activado desde el ingreso, sin pulsar Activar audio.

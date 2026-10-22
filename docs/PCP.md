# PCP · Preparación y seguimiento

1. Nueva preparación: baraja, nombre, premio opcional, canto MANUAL o AUTOMATICO e intervalo de 5 a 120 segundos.
2. Crear partida y, si hace falta, Guardar configuración. El ingreso permanece cerrado.
3. Abrir ingreso: publica la partida en Mis partidas dentro de la app del jugador. Al pulsar Inscribirme con SYS LOT aparece su nombre en Participantes. El enlace queda opcional.
4. Iniciar partida: cierra ingreso y congela configuración. En manual, elegir figura o Cantar figura / siguiente al azar. En automático avanza por reloj del servidor; todas las pantallas consultan el mismo orden. Pausar canto y Reanudar conservan el tiempo acumulado.
5. Revisar el comprobante del cartón lleno, confirmar presencialmente y registrar ganador; el premio se toma de la preparación. Finalizar o Cancelar limpia las presencias.

## Datos

LOT_Partidas.reglas (OBJECT existente) guarda nombre, premio, ingresoAbierto y canto. canto contiene modo, intervalo, orden del canto, acumuladoMs, desde y pausado. No contiene cartones de personas. El orden futuro se entrega solo al PCP autenticado; la sala ve únicamente figuras ya cantadas. Las partidas previas conservan comportamiento e historial.

LOT_Presencias es una colección temporal ADMIN. Mantiene las referencias partida, usuario y enteOperador, nombre, ultimaActividad, expira y el nuevo campo fechaInscripcion DATETIME. Una fila por usuario y partida: la inscripción y la conexión son conceptos separados. Salir deja la inscripción y marca desconexión; los latidos actualizan solo ultimaActividad. A los 45 segundos sin actividad se muestra desconectado. La inscripción caduca siete días después de registrarse; no se extiende con los latidos. Finalizar/cancelar elimina las filas y la limpieza horaria elimina cualquier fila vencida. No guarda cartones, comprobantes, tokens ni marcas. El cartón se reconstruye con usuario, partida y la fecha de inscripción previa del servidor. Solo se permite reingreso con esa inscripción durante espera o curso; al volver hay que marcar nuevamente las figuras cantadas.

El canto automático es una proyección temporal sin escritura por cada lectura. Pausar y cerrar materializan en figurasCantadas la secuencia alcanzada. El canto continúa si se cierra la pantalla del responsable; para detenerlo se debe pulsar Pausar canto. El fin de baraja no confirma ganadores ni asigna premios.

## Verificación

20 pruebas automatizadas: aislamiento, baraja, comprobantes, ingreso cerrado/abierto, premio inmutable después de abrir, reloj automático, pausa/reanudación, bloqueo del canto manual en automático y limpieza al cerrar. Prueba publicada documentada al terminar la integración.

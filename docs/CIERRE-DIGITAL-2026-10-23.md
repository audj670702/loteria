# LOTERÍA 0.8.1 — presentación digital y últimos momentos

Presentar usa el comprobante firmado del cartón asignado y la identidad autenticada, no las marcas. El servidor verifica EO, inscripción anterior al inicio, firma, baraja y 16 figuras realmente cantadas. Una presentación inválida no altera el juego.

La primera presentación válida inserta un ganador con clave única por partida; su corte de canto es la autoridad ante solicitudes concurrentes. Registra ganador, congela el canto y finaliza sin revisión administrativa. Reintentar no duplica resultados. Se admiten durante 30 segundos otros cartones que completaron en el mismo turno que el primero. El PCP resuelve el cierre antes de operar, impidiendo reanudarlo; una escritura atrasada se corrige desde ese corte inmutable.

Participantes y ganadores se integran en el bloque 4. Los ganadores se destacan con identidad, estado de validación y cartón sólo de consulta. Se retira el formulario de verificación presencial; el método manual anterior devuelve una indicación de presentar desde la app.

La app ya no muestra el comprobante antes de enviar. Habilita el grito configurado con 16 coincidencias reales, incluso con cero marcas. Después de la validación muestra el anuncio de ganador con nombre, avatar y premio. Continúa actualizando 35 segundos para resolver presentaciones simultáneas.

Los efectos carta_final.mp3 y partida_terminada.mp3 se consumen desde assets. La última carta se reproduce una sola vez por partida, sin bucle, con 15 coincidencias reales, independientemente de marcas. El toque de tarjeta es silencioso y ya no carga tap.mp3. Pausa, pérdida de sincronización, silencio o política ADM suspenden el efecto; completar el cartón o finalizar lo detienen. El final suena únicamente tras una presentación digital validada, con estado FINALIZADA, motivo GANADOR_DIGITAL y al menos un ganador. Completar el cartón o agotar las 54 figuras no termina la partida ni dispara ese audio. La baraja agotada sigue permitiendo presentar, sin inventar un ganador. El navegador requiere una interacción para habilitar audio. Efectos y voz tienen controles en el menú.

El mínimo de canto sigue en 5 segundos. Se consulta el estado cada 1.5 segundos para reducir estados intermedios omitidos; nunca se anticipan figuras en cliente. El contorno se refuerza con borde rojo y resplandor interior/exterior. Preferencias de movimiento reducido conservan una señal estática fuerte.

No se crean colecciones ni se duplican USR/EO. Sólo se conserva el cartón del ganador. Las inscripciones no ganadoras siguen temporales con su vencimiento original y limpieza programada; se conservan hasta expirar para comprobar presentaciones simultáneas.

Validación: pruebas automatizadas de firma/autorización, idempotencia, concurrencia, cierre y efectos; recorrido móvil local con cero marcas: aviso de falta una y presentación habilitada al completarse el canto, seguido del anuncio final. No se registraron ganadores ni se operaron partidas reales durante la verificación visual.

# Integración pendiente con Wix / SYS

Este archivo define un contrato propuesto, no endpoints ya desplegados. `js/config.js` mantiene `liveEnabled:false`. No encender hasta cumplir todos los puntos siguientes.

## Identidad

Usar el flujo existente `https://www.scad.mx/sys-autenticacion?app=LOT&returnUrl=...`. Verificar en SYS que la URL de retorno `https://loteria.scad.mx` esté admitida antes de habilitar el acceso. El retorno debe entregar token firmado en `#t=`. No transportar identidad fiable por memberId, EO o roles declarados por el navegador.

El servidor debe validar firma, caducidad, aplicación LOT, usuario activo SCaD_USR, EO activa SCaD_EO y pertenencia por codigoContexto en cada petición. Reutilizar la validación SYS existente, sin copiar secretos ni alterar los permisos ADMIN del CMS. No usar nexusPwaContext ni tokens NEXUS para LOT.

## API de participantes propuesta

Dos lecturas CORS con `Authorization: Bearer <token>` y sin cookies: `GET /_functions/lotSalaContexto` y `GET /_functions/lotSalaEstado?partida=<id>`. Atender preflight OPTIONS y permitir únicamente origen loteria.scad.mx, métodos GET/OPTIONS y cabecera Authorization. Respuestas privadas `Cache-Control: no-store`, sin tokens en logs. HTTP 401 finaliza sesión; 403 deniega EO/partida ajena. No exponer nombres de otros participantes, responsables, ganadores ni las colecciones completas.

Contexto: `{ok:true,data:{usuario:{nombre},eo:{nombre}}}`. Estado: `{ok:true,data:{id,estado,figuras:[{id,numero,nombre,imagen}],carton:[16 IDs],cantadas:[IDs]}}`. Nombres y números proceden de LOT_Figuras; el pool de la partida procede de reglas.figuras, no de un catálogo mutable. Estados BORRADOR, EN_CURSO, FINALIZADA, CANCELADA. Cantadas en orden real. Error `{ok:false,mensaje}` con status adecuado.

## Emisión de cartones

No aceptar un cartón arbitrario enviado por el navegador como prueba de ganador remoto. Antes de habilitar partidas reales, definir y emitir en servidor un comprobante firmado con partida, usuario, 16 figuras y caducidad, ligado al pool congelado. Puede ser una emisión determinista mediante HMAC para el mismo usuario y partida, evitando conservar cartones no ganadores y evitando regenerarlos hasta obtener uno favorable. Debe emitirse antes del primer canto y verificarse con hora de emisión firmada. Nunca entregar la clave de firma al frontend. El protocolo de comprobante y entrega al responsable aún no está implementado.

La pantalla «¡Lotería!» solo presenta el cartón para revisión. No escribe LOT_Ganadores ni concede un premio. El responsable mantiene la validación presencial en LOT_Panel. Si se habilita validación remota, comprobar el comprobante en el backend antes de insertar únicamente la evidencia del ganador. No crear colecciones de cartones o marcas de no ganadores.

## Puesta en operación

1. Desplegar métodos de lectura y autenticación LOT; probar sesión, EO ajena, token vencido y CORS.
2. Implementar emisión firmada y recuperación del mismo cartón al volver a la sesión, sin datos permanentes de no ganadores.
3. Mostrar en LOT_Panel un enlace compartible a la partida, sin token ni información privada en la URL.
4. Conectar imágenes 600 × 900 con número y título renderizados por la app; el cliente convierte wix:image a HTTPS.
5. Probar desconexión, cierre, cancelación y recarga. La sala pausa marcas y presentación de cartón cuando falla la actualización.
6. Activar liveEnabled y probar un ciclo completo sin premios antes de abrir la sala.

No se modificaron en este PR los módulos compartidos SYS ni http-functions.js del sitio Wix.

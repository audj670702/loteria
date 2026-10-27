# Integración Wix / SYS

La sala usa SYS con app LOT y retorno HTTPS a loteria.scad.mx. El token firmado llega en #t, se retira de la URL y se conserva en localStorage hasta que el usuario pulse «Cerrar sesión». Un 401 no borra la sesión; sólo pide volver a ingresar. El servidor valida firma, caducidad, app, usuario activo SCaD_USR, EO activa SCaD_EO y pertenencia por codigoContexto en cada petición. No se duplican identidades.

## Rutas

- GET /_functions/lotSalaContexto: identidad propia mínima.
- POST /_functions/lotSalaEntrada con JSON {partida}: devuelve estado y comprobante firmado, únicamente antes de iniciar.
- GET /_functions/lotSalaEstado?partida=... con X-LOT-Carton: estado y cartón propio verificado.
- POST /_functions/lotSalaSalida con JSON {partida}: elimina la presencia propia.
- OPTIONS en las cuatro rutas. CORS exacto https://loteria.scad.mx, Authorization y Content-Type, respuestas no-store.

Todas requieren Authorization Bearer SYS LOT. No usan cookies ni permiten leer usuarios o empresas de terceros. El CMS conserva permisos ADMIN.

## Cartón

lotCards.js genera 16 figuras deterministas por usuario, partida y pool congelado, usando HMAC SHA256 con separación de dominio. Reingresar antes del inicio entrega el mismo cartón. El comprobante incluye usuario, partida, EO, pool, figuras y vigencia de siete días; su emisión debe preceder al inicio. La clave permanece en el backend Wix existente NEXUS_TOKEN_SECRET.

Cartón, comprobante y marcas viven en memoria de la pestaña; no se guardan en CMS ni cachés. Al salir o recargar se pierden. Después del inicio pueden volver únicamente quienes tengan inscripción previa; el servidor reconstruye el mismo cartón y comprobante. Las marcas se hacen nuevamente. Al fallar actualización se detienen marcas y presentación. Finalización y cancelación deshabilitan el juego.

## Responsable

LOT_Panel muestra enlace sin token. El participante presenta su comprobante al completar las 16. «Leer cartón digital» llena los datos para revisión; esto no autentica la firma. Al registrar, loteria.web.js verifica la firma en servidor y exige coincidencia de las 16 figuras, persona y partida, además de las comprobaciones de cartón lleno y confirmación presencial ya existentes. Solo el ganador confirmado conserva el comprobante dentro de cartonGanador. La revisión manual de cartones físicos permanece disponible.

## Cambios de Velo

Los archivos privados lotCards.js y lotSala.js se copian a backend; http-lot-exports.txt se añade al final del http-functions.js existente, preservando sus rutas. En nexusAuth.js y sysToken.web.js se añade LOT a las listas de apps; en SYS_Autenticacion se añade a APPS_CON_TOKEN y APPS_SOLO_TOKEN. No se modifican permisos CMS ni secretos. No copiar el código compartido completo desde otro sitio.

Antes de abrir una partida pública, comprobar un ciclo DEMO sin premios: SYS, entrada antes de inicio, canto, marcas, comprobante y cierre. El responsable realiza la confirmación presencial final.

La preparación, premio, presencias y canto automático del PCP se describen en [PCP.md](PCP.md).

GET /_functions/lotSalaPartidas lista las cien partidas más recientes del ente autenticado, excluyendo preparaciones no abiertas. Solo devuelve nombre, premio, estado y permisos de inscripción/reingreso del propio usuario. LOT_Presencias.fechaInscripcion conserva el ingreso previo hasta cerrar la partida o caducar a los siete días; salir actualiza conexión, sin borrar la inscripción.

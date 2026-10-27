# LOTERÍA · SCaD

Sala de participantes, modalidad tradicional de cartón lleno 4 × 4. Versión 0.9.0: monitor TV en la bienvenida.

## Estado

La demostración funciona sin Wix: genera un cartón aleatorio de 16 figuras, simula un canto sin repeticiones, permite marcar únicamente figuras cantadas y presenta el cartón al completar las 16. No registra ganadores ni asigna premios. Las 54 ilustraciones tradicionales se sirven desde Media Wix, sin duplicarlas en GitHub; número y nombre permanecen como texto.

La conexión a Wix usa SYS LOT, ingreso antes del inicio y comprobantes firmados. El responsable conserva la validación presencial. Consulta [el contrato de integración](docs/INTEGRACION.md).

## Monitor TV

La bienvenida es la pantalla de entrada. En la franja superior lleva la tarjeta de identidad del usuario a la izquierda y el monitor TV a la derecha, como en CPC. `js/tv.js`, `js/tv-model.js` y `tv.css` toman como referencia el monitor de CPC (`cpc-tv.js` v0.5.34). Los ajustes son propios de LOT: sin CH 00, estática y canales de YouTube que arrancan silenciados para no pedir Reproducir. CPC no se modifica.

- No hay canal de la EO (CH 00). CH 01 y CH 02 son las salidas de TV Digital (HLS), y CH 01 es el predeterminado.
- CH 03 en adelante son canales virtuales según el catálogo y la programación del panel TV Digital (`tvdCanales` y `tvdTransmision`).
- Al cambiar de canal aparece la estática del monitor del panel TV Digital.
- El monitor sólo transmite mientras la bienvenida está a la vista.

Con sesión, la app abre en la bienvenida. Al volver del ingreso SYS continúa a Mis partidas. El menú del topbar reúne Mis partidas, Cómo jugar, SCaD HUB y Cerrar sesión.

## Ejecutar

Desde esta carpeta: `python3 -m http.server 4173` y abrir `http://localhost:4173`.
Pruebas con Node.js 22 o posterior (26 comprobaciones): `npm test` (sin instalar dependencias).

## Privacidad

Cartón y marcas permanecen en memoria, se pierden al recargar o salir y nunca se guardan en CMS, localStorage, IndexedDB o caché. El token SYS se conserva en localStorage hasta que el usuario pulsa «Cerrar sesión», y se retira del fragmento de URL. Ninguna identidad o empresa se crea en esta app.

## Publicación

Código estático publicado en GitHub Pages con dominio loteria.scad.mx y HTTPS. Conservar CNAME al actualizar. La instalación móvil incluye un manifiesto básico; no se garantiza funcionamiento sin conexión ni instalación compatible con todos los dispositivos.

La separación de barajas institucionales compartidas y catálogos propios se describe en [CATALOGOS.md](docs/CATALOGOS.md).

Planes comerciales BÁSICO, ESTÁNDAR y PRO (Wix Pricing Plans), registro de empresa por autoservicio y suspensión sin plan vigente: [PLANES-2026-10-25.md](docs/PLANES-2026-10-25.md). Usa el módulo comercial de SYS (repo `scad-sys`).

Retención de datos: resumen de partidas cerradas (ganadores sin cartón), historial de 1 año y borrado a los 30 días sin plan: [RETENCION-2026-10-25.md](docs/RETENCION-2026-10-25.md).

La app del jugador descubre las partidas de su EO desde Mis partidas. El PCP muestra inscritos y conexión por separado; no es necesario compartir un enlace. Los inscritos pueden volver a su mismo cartón durante la partida. Las marcas no se almacenan.

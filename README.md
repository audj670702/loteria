# LOTERÍA · SCaD

Sala de participantes, modalidad tradicional de cartón lleno 4 × 4. Versión 0.3.0: Mis partidas e inscripción desde la app.

## Estado

La demostración funciona sin Wix: genera un cartón aleatorio de 16 figuras, simula un canto sin repeticiones, permite marcar únicamente figuras cantadas y presenta el cartón al completar las 16. No registra ganadores ni asigna premios. Las 54 ilustraciones tradicionales se sirven desde Media Wix, sin duplicarlas en GitHub; número y nombre permanecen como texto.

La conexión a Wix usa SYS LOT, ingreso antes del inicio y comprobantes firmados. El responsable conserva la validación presencial. Consulta [el contrato de integración](docs/INTEGRACION.md).

## Ejecutar

Desde esta carpeta: `python3 -m http.server 4173` y abrir `http://localhost:4173`.
Pruebas con Node.js 22 o posterior (26 comprobaciones): `npm test` (sin instalar dependencias).

## Privacidad

Cartón y marcas permanecen en memoria, se pierden al recargar o salir y nunca se guardan en CMS, localStorage, IndexedDB o caché. El token SYS se conserva solo en sessionStorage y se retira del fragmento de URL. Ninguna identidad o empresa se crea en esta app.

## Publicación

Código estático publicado en GitHub Pages con dominio loteria.scad.mx y HTTPS. Conservar CNAME al actualizar. La instalación móvil incluye un manifiesto básico; no se garantiza funcionamiento sin conexión ni instalación compatible con todos los dispositivos.

La separación de barajas institucionales compartidas y catálogos propios se describe en [CATALOGOS.md](docs/CATALOGOS.md).

La app del jugador descubre las partidas de su EO desde Mis partidas. El PCP muestra inscritos y conexión por separado; no es necesario compartir un enlace. Los inscritos pueden volver a su mismo cartón durante la partida. Las marcas no se almacenan.

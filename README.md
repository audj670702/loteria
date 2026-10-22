# LOTERÍA · SCaD

Sala de participantes, modalidad tradicional de cartón lleno 4 × 4. Primera versión 0.1.0.

## Estado

La demostración funciona sin Wix: genera un cartón aleatorio de 16 figuras, simula un canto sin repeticiones, permite marcar únicamente figuras cantadas y presenta el cartón al completar las 16. No registra ganadores ni asigna premios. Las 54 ilustraciones tradicionales se sirven desde Media Wix, sin duplicarlas en GitHub; número y nombre permanecen como texto.

Las partidas reales están bloqueadas por configuración. El panel Wix existente solo expone operaciones para ADM y no se reutiliza como API de participantes. Antes de activar `liveEnabled`, implementar y verificar [el contrato de integración](docs/INTEGRACION.md).

## Ejecutar

Desde esta carpeta: `python3 -m http.server 4173` y abrir `http://localhost:4173`.
Pruebas con Node.js 22 o posterior (10 comprobaciones): `npm test` (sin instalar dependencias).

## Privacidad

Cartón y marcas permanecen en memoria, se pierden al recargar o salir y nunca se guardan en CMS, localStorage, IndexedDB o caché. El futuro token SYS se conserva solo en sessionStorage y se retira del fragmento de URL. Ninguna identidad o empresa se crea en esta app.

## Publicación

Código estático compatible con GitHub Pages. Publicar la raíz de main una vez revisado el PR. El CNAME de Wix ya apunta `loteria.scad.mx` a `audj670702.github.io`; falta asignar el dominio en GitHub Pages y activar HTTPS. No se incluye un archivo CNAME hasta completar esa configuración. La instalación móvil incluye un manifiesto básico; no se garantiza funcionamiento sin conexión ni se anuncia instalación compatible con todos los dispositivos.

La separación de barajas institucionales compartidas y catálogos propios se describe en [CATALOGOS.md](docs/CATALOGOS.md).

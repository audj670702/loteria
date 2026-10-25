# Retención de datos de LOTERÍA · 25 oct 2026

Complementa [PLANES-2026-10-25.md](PLANES-2026-10-25.md). El código está en `wix/lotRetencion.js`, que corre como trabajos programados de Wix.

## Qué se conserva

| Dato | Se conserva | Cuánto tiempo |
|---|---|---|
| Partida cerrada (finalizada o cancelada, con o sin ganador) | Resumen: nombre, premio, estado, fechas, motivo de cierre y número de figuras cantadas | 1 año |
| Ganador | Identidad del jugador (usuario y nombre), fecha y hora de validación, premio y folio | 1 año |
| Cartón ganador, baraja de la partida, orden del canto y figuras cantadas | No. Se quitan 10 minutos después del cierre | — |
| Inscripciones | No. Ya se borraban al cerrar y con la limpieza horaria | — |

El historial se sigue consultando en el panel. En *Participantes y ganadores* cada ganador muestra fecha, hora y premio. Ya no existe "Ver cartón ganador".

Los 10 minutos dan margen a los empates del mismo turno (30 s) y a que los jugadores vean el anuncio final. Después, la app del jugador recibe "La partida terminó".

## Plan cancelado o sin pago

1. Mientras no hay plan vigente, la EO queda **suspendida**, como ya funcionaba. Los datos se conservan y, si renueva, todo vuelve a operar.
2. **30 días** después del fin de su última orden en Pricing, el trabajo diario:
   - **borra** las partidas, los ganadores, las inscripciones y las barajas propias de la EO, con sus figuras;
   - **desactiva** la EO y todos sus usuarios (SYS `desactivarEO`, `motivoBaja: PLAN_VENCIDO`). No los borra.
3. La baraja TRADICIONAL (compartida) y los datos de otras EO no se tocan.
4. Si Pricing no responde, ese día no se declara vencida ninguna EO.
5. Si el titular vuelve a comprar, el registro reactiva **la misma EO** con sus usuarios, pero sin el historial ni las barajas borradas.

Las imágenes que la EO haya subido a la biblioteca de medios de Wix no se borran automáticamente.

## Otros cambios

- **Editar figuras de una baraja propia:** antes se bloqueaba para siempre si la baraja había tenido alguna partida. Ahora solo se bloquea mientras una partida la usa: en preparación, en curso o cerrada aún sin resumir.
- **Avisos de suspensión:** dicen que los datos se conservan 30 días después del fin del plan.

## Instalación en Wix (scad.mx)

1. **SYS** (repo `scad-sys`, v1.1): reemplazar `backend/sysComercialCore.js`.
2. **LOT** (este repo). Copiar al backend:
   - `wix/lotRetencion.js` → `backend/lotRetencion.js` (nuevo)
   - `wix/lotSala.js` → `backend/lotSala.js` (reemplaza)
   - `wix/loteria.web.js` → `backend/loteria.web.js` (reemplaza)
3. **Panel:** pegar `wix/panel.html` en el componente HTML de `/panel-loteria`.
4. **`backend/jobs.config`:** agregar estas dos entradas al final del arreglo `"jobs"`, después de `limpiarPresencias`, sin quitar las que ya existen. Agrega una coma después de la entrada anterior.

```json
    {
      "functionLocation": "/lotRetencion.js",
      "functionName": "lotCompactarCerradas",
      "description": "LOT: resume partidas cerradas (ganadores sin cartón)",
      "executionConfig": { "cronExpression": "30 * * * *" }
    },
    {
      "functionLocation": "/lotRetencion.js",
      "functionName": "lotRetencionDiaria",
      "description": "LOT: borra historial de más de 1 año y EO con 30 días sin plan",
      "executionConfig": { "time": "06:30" }
    }
```

El resumen corre al minuto 30 de cada hora, para no coincidir con `limpiarPresencias`, que corre al minuto 0. El diario corre a las 06:30, después de las tareas de 06:10, 06:15 y 06:20. Wix usa la misma zona horaria para todas las entradas.

## Prueba sugerida

1. Cerrar una partida con ganador. Pasada la siguiente media hora (o al ejecutar `lotCompactarCerradas` desde el editor), el panel sigue mostrando al ganador con fecha, hora y premio.
2. En el CMS, `LOT_Ganadores` ya no tiene `cartonGanador` y `LOT_Partidas` tiene `fechaCompactacion`.
3. El trabajo diario escribe un resumen en los registros del sitio (`LOT_RETENCION`).

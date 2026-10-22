# Catálogos compartidos y propios

`LOT_Catalogos.compartido` es BOOLEAN opcional. Solo el valor booleano true concede lectura compartida a administradores LOT autenticados de otras EO; valores ausentes o false mantienen el aislamiento anterior. Los permisos CMS permanecen ADMIN.

La baraja institucional `6df6da59-5c5c-403e-aee9-7e38b1ba5d5b` está marcada compartida y activa. Conserva la referencia de origen EO008 DEMO para no alterar relaciones. La visibilidad ya no depende de ese origen cuando compartido=true. Una EO puede escogerla o utilizar sus catálogos personalizados. No se duplican las imágenes ni las figuras por empresa.

En el backend LOT, catalog() permite leer un catálogo propio o compartido; figuraGuardar exige además que sea propio y no compartido, incluso para DEMO. catalogoCrear fuerza compartido=false e ignora cualquier valor aportado por el cliente. cargar combina propios y compartidos activos sin duplicados. partidaCrear sigue asociando partida y responsable a la EO autenticada y congela los IDs de la baraja. La lectura de partidas y ganadores conserva las comprobaciones anteriores por EO. No se habilita un acceso anónimo al CMS.

Las funciones de wix/catalog-policy.js corresponden a las incorporadas en el backend Velo y tienen pruebas de aislamiento y edición. La designación de nuevas predeterminadas corresponde a administración SCaD desde el CMS, no a un control editable del panel de cada empresa.

Las ilustraciones de js/traditional.js apuntan a los 54 archivos públicos en Media Wix LOTERIA/Tradicional/v1; sirven a la demostración local sin exponer usuarios o empresas. La integración de participantes se describe en INTEGRACION.md.

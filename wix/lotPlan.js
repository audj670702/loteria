// LOT · Planes comerciales (Ficha técnica de planes v1.0 · 25 oct 2026).
// Configuración que LOT entrega al módulo SYS backend/sysComercial (repo scad-sys).
// Sin dependencias de Wix: se prueba fuera del sitio.

export const CFG_COMERCIAL = {
  APP: 'LOT',
  PLANES: [
    { id: '4cb541ef-a7a1-4c30-927d-a137664a19fa', nivel: 'BASICO' },   // Plan BÁSICO LOTERÍA
    { id: 'c8f67fe9-44f7-4693-9619-d63c897174d4', nivel: 'ESTANDAR' }, // Plan ESTÁNDAR LOTERÍA
    { id: 'd82f6e6d-fc22-49b9-93d3-c8eac6a3be62', nivel: 'PRO' }       // LOTERÍA - Plan PRO
  ],
  NIVELES: ['BASICO', 'ESTANDAR', 'PRO']
  // Sin NIVEL_CORTESIA: toda EO de LOT necesita un plan vigente (no hay cortesía).
};

// BÁSICO: sólo la baraja TRADICIONAL (compartida). ESTÁNDAR: una baraja propia.
// PRO: varias barajas propias y canto automático con intervalo.
// Modalidades de victoria: fuera de esta versión (sólo cartón lleno).
const CAPACIDADES = {
  BASICO: { barajasPropias: 0, cantoAutomatico: false },
  ESTANDAR: { barajasPropias: 1, cantoAutomatico: false },
  PRO: { barajasPropias: Infinity, cantoAutomatico: true }
};
const NOMBRES = { BASICO: 'Básico', ESTANDAR: 'Estándar', PRO: 'PRO' };

/** Capacidades de un nivel. Sin nivel conocido se aplica la más restrictiva. */
export function capacidades(nivel) { return CAPACIDADES[nivel] || CAPACIDADES.BASICO; }
export function nombreNivel(nivel) { return NOMBRES[nivel] || ''; }

/**
 * Barajas propias habilitadas: las primeras N por fecha de creación.
 * Al bajar de plan, las excedentes quedan bloqueadas y la EO decide si
 * actualiza la que conserva. La TRADICIONAL (compartida) siempre está habilitada.
 */
export function barajasHabilitadas(propias, nivel) {
  const n = capacidades(nivel).barajasPropias;
  const orden = [...(propias || [])].sort((a, b) =>
    (new Date(a._createdDate || 0).getTime() - new Date(b._createdDate || 0).getTime()) || String(a._id).localeCompare(String(b._id)));
  return new Set((n === Infinity ? orden : orden.slice(0, n)).map(c => c._id));
}

/** ¿El nivel permite crear otra baraja propia, dado cuántas tiene? */
export function puedeCrearBaraja(cuantasPropias, nivel) {
  return Number(cuantasPropias || 0) < capacidades(nivel).barajasPropias;
}

/** Mensaje cuando una configuración pide canto automático sin permitirlo el plan. */
export function revisarCanto(modo, nivel) {
  if (modo === 'AUTOMATICO' && !capacidades(nivel).cantoAutomatico) {
    throw new Error('El canto automático está disponible en el Plan PRO. Usa canto manual o cambia de plan.');
  }
}

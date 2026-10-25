// LOT · Retención de datos (25 oct 2026). Backend privado de Velo: trabajos de jobs.config.
// - Partida cerrada: se conserva un resumen (nombre, premio, estado, fechas, cierre y totales).
//   Ganadores: identidad del jugador, fecha y hora de validación y premio; sin cartón.
// - Historial: 1 año. Después se borran la partida y sus ganadores.
// - Plan vencido: 30 días después del fin del plan se borran partidas, ganadores,
//   inscripciones y barajas propias de la EO; la EO y sus usuarios se desactivan (SYS).
import wixData from 'wix-data';
import { comercial } from 'backend/sysComercial';
import { CFG_COMERCIAL } from 'backend/lotPlan';
import { resolveDigitalResult } from 'backend/lotSala';
const C = comercial(CFG_COMERCIAL);
const O = { suppressAuth: true, consistentRead: true };
const W = { suppressAuth: true };
const DIA = 24 * 60 * 60 * 1000;
const CERRADAS = ['FINALIZADA', 'CANCELADA'];
export const RETENCION = { compactarTrasMs: 10 * 60 * 1000, historialDias: 365, graciaDias: 30, lote: 200 };

/** Resumen de una partida cerrada: sin baraja, orden de canto ni figuras cantadas. */
export function partidaCompacta(game, ahora = new Date()) {
  const { figuras, ...reglas } = game.reglas || {};
  const { orden, ...canto } = reglas.canto || {};
  return {
    ...game,
    figurasCantadas: [],
    fechaCompactacion: ahora,
    reglas: { ...reglas, canto, figurasTotal: (figuras || []).length, cantadasTotal: (game.figurasCantadas || []).length }
  };
}

/** Registro de ganador: identidad, fecha y hora (fechaValidacion) y premio. Sin cartón. */
export function ganadorCompacto(w) {
  const { cartonGanador, ...resto } = w;
  return { ...resto, jugador: resto.jugador || cartonGanador?.nombre || 'Jugador' };
}

async function todos(query) {
  let r = await query.limit(1000).find(O);
  const out = [...r.items];
  while (r.hasNext()) { r = await r.next(); out.push(...r.items); }
  return out;
}
async function borrar(col, ids) {
  for (let i = 0; i < ids.length; i += 1000) {
    const r = await wixData.bulkRemove(col, ids.slice(i, i + 1000), W);
    if (r.errors?.length) throw new Error('Retención LOT: no se completó el borrado en ' + col + '.');
  }
  return ids.length;
}
async function borrarPartidas(games) {
  let ganadores = 0, presencias = 0;
  for (const g of games) {
    ganadores += await borrar('LOT_Ganadores', (await todos(wixData.query('LOT_Ganadores').eq('partida', g._id))).map(x => x._id));
    presencias += await borrar('LOT_Presencias', (await todos(wixData.query('LOT_Presencias').eq('partida', g._id))).map(x => x._id));
  }
  return { partidas: await borrar('LOT_Partidas', games.map(g => g._id)), ganadores, presencias };
}

/** Cada hora: resume las partidas cerradas hace más de 10 minutos. */
export async function lotCompactarCerradas() {
  const limite = new Date(Date.now() - RETENCION.compactarTrasMs);
  const r = await wixData.query('LOT_Partidas').hasSome('estado', CERRADAS).isEmpty('fechaCompactacion')
    .lt('_updatedDate', limite).ascending('_updatedDate').limit(RETENCION.lote).find(O);
  let partidas = 0, ganadores = 0;
  for (let game of r.items) {
    // Primero se fija el resultado digital en la partida (cierre, turno y fecha).
    if (game.estado === 'FINALIZADA') game = (await resolveDigitalResult(game)).game;
    for (const w of await todos(wixData.query('LOT_Ganadores').eq('partida', game._id))) {
      if (!w.cartonGanador) continue;
      await wixData.update('LOT_Ganadores', ganadorCompacto(w), W); ganadores++;
    }
    await wixData.update('LOT_Partidas', partidaCompacta(game), W); partidas++;
  }
  return { partidas, ganadores };
}

/** Borra todo lo de LOT de una EO: partidas, ganadores, inscripciones y barajas propias. */
export async function borrarDatosEO(eo) {
  const games = await todos(wixData.query('LOT_Partidas').eq('enteOperador', eo._id));
  const r = await borrarPartidas(games);
  r.presencias += await borrar('LOT_Presencias', (await todos(wixData.query('LOT_Presencias').eq('enteOperador', eo._id))).map(x => x._id));
  const cats = (await todos(wixData.query('LOT_Catalogos').eq('enteOperador', eo._id))).filter(c => c.compartido !== true);
  let figuras = 0;
  for (const c of cats) figuras += await borrar('LOT_Figuras', (await todos(wixData.query('LOT_Figuras').eq('catalogo', c._id))).map(x => x._id));
  return { ...r, barajas: await borrar('LOT_Catalogos', cats.map(c => c._id)), figuras };
}

/** Cada día: historial de más de 1 año y EO con 30 días sin plan. */
export async function lotRetencionDiaria() {
  const corte = new Date(Date.now() - RETENCION.historialDias * DIA);
  const viejas = (await todos(wixData.query('LOT_Partidas').lt('_createdDate', corte))).filter(g => g.estado !== 'EN_CURSO');
  const historial = await borrarPartidas(viejas);
  historial.ganadores += await borrar('LOT_Ganadores', (await todos(wixData.query('LOT_Ganadores').lt('fechaValidacion', corte))).map(x => x._id));

  const entes = [];
  for (const eo of await C.eosVencidas(RETENCION.graciaDias)) {
    try {
      const datos = await borrarDatosEO(eo);
      await C.desactivarEO(eo);
      entes.push({ eo: eo.codigoContexto, ...datos });
    } catch (e) { console.error('LOT_RETENCION', eo.codigoContexto, e); }
  }
  console.log('LOT_RETENCION', JSON.stringify({ historial, entes }));
  return { historial, entes };
}

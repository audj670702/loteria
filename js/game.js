import {TRADITIONAL} from './traditional.js';
export const NAMES = ['El Gallo','El Diablito','La Dama','El Catrín','El Paraguas','La Sirena','La Escalera','La Botella','El Barril','El Árbol','El Melón','El Valiente','El Gorrito','La Muerte','La Pera','La Bandera','El Bandolón','El Violoncello','La Garza','El Pájaro','La Mano','La Bota','La Luna','El Cotorro','El Borracho','El Negrito','El Corazón','La Sandía','El Tambor','El Camarón','Las Jaras','El Músico','La Araña','El Soldado','La Estrella','El Cazo','El Mundo','El Apache','El Nopal','El Alacrán','La Rosa','La Calavera','La Campana','El Cantarito','El Venado','El Sol','La Corona','La Chalupa','El Pino','El Pescado','La Palma','La Maceta','El Arpa','La Rana'];
export const DEMO_FIGURES = NAMES.map((nombre, i) => ({id:`demo-${i+1}`,numero:i+1,nombre,imagen:TRADITIONAL.find(f=>f.numero===i+1 && f.nombre===nombre)?.imagen || null}));

function randomInt(max) {
  const range = 0x100000000;
  const limit = range - range % max;
  const value = new Uint32Array(1);
  do { crypto.getRandomValues(value); } while (value[0] >= limit);
  return value[0] % max;
}
export function shuffle(items, pick = randomInt) {
  const out = [...items];
  for (let i=out.length-1; i>0; i--) {
    const j=pick(i+1);
    if (!Number.isInteger(j) || j<0 || j>i) throw new Error('Sorteo inválido.');
    [out[i],out[j]]=[out[j],out[i]];
  }
  return out;
}
export function makeCard(figures) {
  if (new Set(figures.map(f=>f.id)).size!==figures.length || figures.length<16) throw new Error('Baraja incompleta.');
  return shuffle(figures).slice(0,16).map(f=>f.id);
}
export function toggleMark(id, card, called, marks, allowUncalled=false) {
  const next = new Set(marks);
  if (!card.includes(id) || (!allowUncalled&&!called.includes(id))) return next;
  next.has(id) ? next.delete(id) : next.add(id);
  return next;
}
export function isFull(card, called, marks) {
  return card.length===16 && new Set(card).size===16 && card.every(id=>called.includes(id) && marks.has(id));
}
export function normalizeState(raw) {
  if (!raw || !['BORRADOR','EN_CURSO','FINALIZADA','CANCELADA'].includes(raw.estado)) throw new Error('Estado de partida inválido.');
  if (!Array.isArray(raw.figuras) || raw.figuras.length<16 || raw.figuras.length>1000) throw new Error('Baraja inválida.');
  const figures=raw.figuras;
  if (figures.some(f=>!f || typeof f.id!=='string' || !f.id || !Number.isSafeInteger(f.numero) || f.numero<1 || typeof f.nombre!=='string' || !f.nombre.trim())) throw new Error('Figuras inválidas.');
  const pool=new Set(figures.map(f=>f.id));
  if (pool.size!==figures.length || new Set(figures.map(f=>f.numero)).size!==figures.length) throw new Error('Baraja repetida.');
  if (!Array.isArray(raw.carton) || raw.carton.length!==16 || new Set(raw.carton).size!==16 || raw.carton.some(id=>!pool.has(id))) throw new Error('Cartón inválido.');
  if (!Array.isArray(raw.cantadas) || new Set(raw.cantadas).size!==raw.cantadas.length || raw.cantadas.some(id=>!pool.has(id))) throw new Error('Canto inválido.');
  return {...raw, figuras:figures.map(f=>({...f})),carton:[...raw.carton],cantadas:[...raw.cantadas]};
}
export function imageUrl(value) {
  if (typeof value!=='string') return null;
  if (value.startsWith('wix:image://v1/')) {
    const media=value.slice(15).split('/')[0];
    return /^[a-zA-Z0-9_.~-]+$/.test(media) ? 'https://static.wixstatic.com/media/'+media : null;
  }
  try { const url=new URL(value); return url.protocol==='https:' ? url.href : null; } catch { return null; }
}

export function isOneAway(card,called){return card.length===16&&new Set(card).size===16&&card.filter(id=>called.includes(id)).length===15;}

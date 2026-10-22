// Estas funciones se insertan en backend/loteria.web.js, después del helper id.
const id = v => typeof v === 'string' ? v : v?._id || '';
export function canReadCatalog(cat, eoId) { return !!cat && (id(cat.enteOperador) === eoId || cat.compartido === true); }
export function canEditCatalog(cat, eoId) { return !!cat && cat.compartido !== true && id(cat.enteOperador) === eoId; }
export function mergeCatalogs(own, shared) { return [...new Map([...own,...shared].map(c=>[c._id,c])).values()].sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')); }

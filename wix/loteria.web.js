// LOTERIA v2.0 · 2026-10-22 · presencial, carton lleno 4x4.
// No crea ni modifica usuarios/entes. Solo ADM puede operar.
import wixData from 'wix-data';
import crypto from 'crypto';
import { configPartida, ingresoAbierto, cantadas, vistaPartida, pausa } from 'backend/lotFlow';
import { listaPresencias, cerrarPresencias } from 'backend/lotPresence';
import { verifyDigitalCard } from 'backend/lotSala';
import { currentMember } from 'wix-members-backend';
import { webMethod, Permissions } from 'wix-web-module';
const O = { suppressAuth: true, consistentRead: true };
const id = v => typeof v === 'string' ? v : v?._id || '';
const text = v => typeof v === 'string' ? v.trim() : '';
function check(ok, message) { if (!ok) throw new Error(message); }
async function all(query) {
  let r = await query.limit(1000).find(O);
  const out = [...r.items];
  while (r.hasNext()) { r = await r.next(); out.push(...r.items); }
  return out;
}
async function context(eoKey) {
  const member = await currentMember.getMember();
  check(member?._id, 'Inicia sesion en Wix.');
  const users = await all(wixData.query('SCaD_USR').eq('app','LOT').eq('activo',true).eq('memberId',member._id));
  const eos = await all(wixData.query('SCaD_EO').eq('app','LOT').eq('activo',true));
  const allowed = eos.map(eo => ({eo, usr:users.find(u => u.enteOperador === eo.codigoContexto)})).filter(x => {
    if (!x.usr) return false;
    const roles = Array.isArray(x.usr.roles) ? x.usr.roles : [];
    return roles.map(r => String(r).toUpperCase()).includes('ADM') || id(x.eo.admPrincipal) === x.usr._id || id(x.eo.admSys) === x.usr._id;
  });
  const key = text(eoKey);
  const selected = key ? allowed.find(x => [x.eo._id,x.eo.codigoEO,x.eo.codigoContexto].includes(key)) : allowed.length === 1 ? allowed[0] : null;
  return {allowed, selected};
}
async function owned(col, key, ctx) {
  const item = await wixData.get(col,text(key),O);
  check(item && id(item.enteOperador) === ctx.eo._id,'Registro fuera del ente autorizado.');
  return item;
}
function canReadCatalog(cat, eoId) { return !!cat && (id(cat.enteOperador) === eoId || cat.compartido === true); }
function canEditCatalog(cat, eoId) { return !!cat && cat.compartido !== true && id(cat.enteOperador) === eoId; }
function mergeCatalogs(own, shared) { return [...new Map([...own,...shared].map(c=>[c._id,c])).values()].sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')); }
async function catalog(key, ctx) {
  const cat = await wixData.get('LOT_Catalogos',text(key),O);
  check(canReadCatalog(cat,ctx.eo._id),'Catalogo fuera del ente autorizado.');
  return cat;
}
async function figures(key) { return all(wixData.query('LOT_Figuras').eq('catalogo',key).ascending('numero')); }
function evidence(cards, called, pool) {
  check(Array.isArray(cards) && cards.length === 16,'El carton debe tener 16 figuras.');
  check(cards.every(c => typeof c === 'string' && c.length > 0) && new Set(cards).size === 16,'El carton contiene figuras invalidas o repetidas.');
  check(cards.every(c => pool.includes(c)),'El carton contiene figuras ajenas a la partida.');
  check(cards.every(c => called.includes(c)),'El carton aun no esta lleno.');
  return {filas:4,columnas:4,figuras:[...cards],posicionesGanadoras:Array.from({length:16},(_,i)=>i)};
}
export const lotOperacion = webMethod(Permissions.SiteMember, async (request) => {
  request = request || {};
  try {
    const {accion, eo, datos = {}} = request;
    const resolved = await context(eo);
    if (accion === 'contexto') { const x = resolved.selected; return {ok:true,data:{entes:resolved.allowed.map(x=>({_id:x.eo._id,nombre:x.eo.nombreVisible || x.eo.nombre,codigo:x.eo.codigoEO})),seleccionado:x?.eo._id || '',identidad:x ? {usuario:x.usr.nombreVisible || x.usr.nombreCompleto || x.usr.nombre || x.usr.codigoUSR,rol:'ADM',ente:x.eo.nombreVisible || x.eo.nombre,codigoEO:x.eo.codigoEO,aplicacion:'LOTERÍA'} : null,modalidad:'CARTON_LLENO',filas:4,columnas:4}}; }
    const ctx = resolved.selected;
    check(ctx,'Selecciona un ente LOT activo para el que tengas permiso ADM.');
    if (accion === 'usuarios') {
      const users = await all(wixData.query('SCaD_USR').eq('app','LOT').eq('activo',true).eq('enteOperador',ctx.eo.codigoContexto));
      return {ok:true,data:users.map(u=>({_id:u._id,nombre:u.nombreVisible || u.nombreCompleto || u.nombre || u.codigoUSR}))};
    }
    if (accion === 'cargar') {
      const ownCatalogs = await all(wixData.query('LOT_Catalogos').eq('enteOperador',ctx.eo._id).ascending('nombre'));
      const sharedCatalogs = await all(wixData.query('LOT_Catalogos').eq('compartido',true).eq('activo',true));
      const catalogs = mergeCatalogs(ownCatalogs,sharedCatalogs);
      const rawGames = await all(wixData.query('LOT_Partidas').eq('enteOperador',ctx.eo._id).descending('_createdDate'));
      return {ok:true,data:{catalogos:catalogs,partidas:rawGames.map(g=>vistaPartida(g))}};
    }
    if (accion === 'catalogoCrear') {
      check(text(datos.nombre).length >= 2,'Escribe el nombre del catalogo.');
      const saved = await wixData.insert('LOT_Catalogos',{nombre:text(datos.nombre).slice(0,120),descripcion:text(datos.descripcion).slice(0,1000),enteOperador:ctx.eo._id,activo:true,compartido:false},O);
      return {ok:true,data:saved};
    }
    if (accion === 'figuras') {
      const cat = await catalog(datos.catalogo,ctx);
      return {ok:true,data:await figures(cat._id)};
    }
    if (accion === 'figuraGuardar') {
      const cat = await catalog(datos.catalogo,ctx);
      check(canEditCatalog(cat,ctx.eo._id),'La baraja predeterminada es de solo lectura. Crea un catalogo personalizado para tus figuras.');
      const used = await wixData.query('LOT_Partidas').eq('catalogo',cat._id).limit(1).find(O);
      check(!used.items.length,'La baraja ya tiene partidas; crea otro catalogo para modificar sus figuras.');
      check(Number.isSafeInteger(datos.numero) && datos.numero > 0,'Numero de figura invalido.');
      check(text(datos.nombre),'Escribe el nombre de la figura.');
      const key = cat._id + '-' + datos.numero;
      const image = text(datos.imagen);
      check(!image || image.startsWith('https://') || image.startsWith('wix:image://'),'Usa una imagen HTTPS o Wix.');
      const existing = await wixData.query('LOT_Figuras').eq('_id',key).limit(1).find(O);
      const values = {_id:key,catalogo:cat._id,numero:datos.numero,nombre:text(datos.nombre).slice(0,120),imagen:image,activo:datos.activo !== false};
      const saved = existing.items.length ? await wixData.update('LOT_Figuras',{...existing.items[0],...values},O) : await wixData.insert('LOT_Figuras',values,O);
      return {ok:true,data:saved};
    }
    if (accion === 'partidaCrear') {
      const cat = await catalog(datos.catalogo,ctx);
      check(cat.activo === true,'El catalogo esta inactivo.');
      const pool = (await figures(cat._id)).filter(f=>f.activo === true);
      check(pool.length >= 16 && pool.length <= 1000,'La baraja debe tener de 16 a 1000 figuras activas.');
      check(new Set(pool.map(f=>f.numero)).size === pool.length,'Hay numeros duplicados en la baraja.');
      const key = text(datos.solicitudId);
      check(/^[a-zA-Z0-9-]{16,64}$/.test(key),'Identificador de solicitud invalido.');
      const previous = await wixData.query('LOT_Partidas').eq('_id',key).limit(1).find(O);
      if (previous.items.length) {
        check(id(previous.items[0].enteOperador) === ctx.eo._id && id(previous.items[0].catalogo) === cat._id,'Solicitud ya utilizada.');
        return {ok:true,data:previous.items[0]};
      }
      const saved = await wixData.insert('LOT_Partidas',{_id:key,folio:'LOT-'+key,enteOperador:ctx.eo._id,catalogo:cat._id,responsable:ctx.usr._id,estado:'BORRADOR',reglas:{version:2,modalidad:'CARTON_LLENO',filas:4,columnas:4,figuras:pool.map(f=>f._id),ingresoAbierto:false,...configPartida(datos)},figurasCantadas:[]},O);
      return {ok:true,data:saved};
    }
    if (accion === 'seguimiento') {
      const game = await owned('LOT_Partidas',datos.partida,ctx);
      return {ok:true,data:{partida:vistaPartida(game),participantes:await listaPresencias(game,ctx.eo)}};
    }
    if (accion === 'ganadores') {
      const game = await owned('LOT_Partidas',datos.partida,ctx);
      const winners = await all(wixData.query('LOT_Ganadores').eq('partida',game._id));
      return {ok:true,data:winners};
    }
    if (['configurar','abrir','iniciar','cantar','pausar','reanudar','finalizar','cancelar','ganadorValidar'].includes(accion)) {
      const game = await owned('LOT_Partidas',datos.partida,ctx);
      check(id(game.responsable) === ctx.usr._id,'Solo el responsable de la partida puede operarla.');
      check(game.reglas?.modalidad === 'CARTON_LLENO' && game.reglas.filas === 4 && game.reglas.columnas === 4,'Reglas incompatibles con esta version.');
      const called = cantadas(game);
      const pool = game.reglas.figuras || [];
      if (accion === 'ganadorValidar') {
        check(game.estado === 'EN_CURSO','Valida el carton antes de finalizar la partida.');
        check(datos.confirmacionPresencial === true,'El responsable debe verificar presencialmente el carton presentado.');
        const proof = evidence(datos.figuras,called,pool);
        const usr = await wixData.get('SCaD_USR',text(datos.usuario),O);
        check(usr?.activo === true && usr.app === 'LOT' && usr.enteOperador === ctx.eo.codigoContexto,'El ganador debe ser un usuario LOT activo del mismo ente.');
        const ticket = text(datos.comprobante);
        if (ticket) {
          const card = await verifyDigitalCard(ticket,game,usr);
          check(card.every((value,index)=>value === datos.figuras[index]),'El comprobante no coincide con el carton presentado.');
          proof.comprobante = ticket;
        }
        const key = game._id + '-' + usr._id;
        const previous = await wixData.query('LOT_Ganadores').eq('_id',key).limit(1).find(O);
        if (previous.items.length) return {ok:true,data:previous.items[0]};
        const saved = await wixData.insert('LOT_Ganadores',{_id:key,folio:'GAN-'+key,partida:game._id,usuario:usr._id,figuraGanadora:'CARTON_LLENO',fechaValidacion:new Date(),validadoPor:ctx.usr._id,cartonGanador:proof,premio:game.reglas.version>=2?game.reglas.premio||'':text(datos.premio).slice(0,300)},O);
        return {ok:true,data:saved};
      }
      check(datos.version === new Date(game._updatedDate).toISOString(),'La partida cambio; actualiza el panel.');
      if (accion === 'configurar') {
        check(game.estado === 'BORRADOR' && !ingresoAbierto(game),'La configuración se cierra al abrir el ingreso.');
        game.reglas={...game.reglas,...configPartida(datos)};
      } else if (accion === 'abrir') {
        check(game.estado === 'BORRADOR','La partida ya inició o está cerrada.');
        game.reglas.ingresoAbierto=true;
      } else if (accion === 'iniciar') {
        check(ingresoAbierto(game),'Abre el ingreso antes de iniciar.');
        game.estado='EN_CURSO'; game.inicio=new Date();game.reglas.ingresoAbierto=false;
        const c=game.reglas.canto||configPartida().canto;
        const orden=[...pool];
        for(let i=orden.length-1;i>0;i--){const max=i+1,limit=0x100000000-0x100000000%max;let r;do{r=crypto.randomBytes(4).readUInt32BE(0);}while(r>=limit);const j=r%max;[orden[i],orden[j]]=[orden[j],orden[i]];}
        game.reglas.canto={...c,orden,desde:Date.now(),acumuladoMs:0,pausado:false};
        game.participantesTotal=(await listaPresencias(game,ctx.eo)).length;
      } else if (accion === 'pausar' || accion === 'reanudar') {
        pausa(game,accion === 'pausar');
      } else if (accion === 'cantar') {
        check(game.estado === 'EN_CURSO','La partida no está en curso.');
        check(game.reglas.canto?.modo !== 'AUTOMATICO','El canto está configurado en automático.');
        check(!game.reglas.canto?.pausado,'Reanuda el canto antes de avanzar.');
        const figure=text(datos.figura)||(game.reglas.canto?.orden||pool).find(k=>!called.includes(k));
        check(pool.includes(figure)&&!called.includes(figure),'Figura ajena a la baraja, ya cantada o baraja agotada.');
        game.figurasCantadas=[...called,figure];
      } else {
        check(['BORRADOR','EN_CURSO'].includes(game.estado),'La partida ya está cerrada.');
        check(accion !== 'finalizar'||game.estado === 'EN_CURSO','Inicia la partida antes de finalizar.');
        game.figurasCantadas=called;
        game.estado=accion === 'cancelar'?'CANCELADA':'FINALIZADA';game.fin=new Date();game.reglas.ingresoAbierto=false;
      }
      const saved=await wixData.update('LOT_Partidas',game,O);
      if(['FINALIZADA','CANCELADA'].includes(saved.estado))await cerrarPresencias(saved);
      return {ok:true,data:vistaPartida(saved)};
    }
    throw new Error('Operacion no disponible.');
  } catch (error) {
    return {ok:false,error:{message:error instanceof Error ? error.message : 'No se pudo completar la operacion.'}};
  }
});

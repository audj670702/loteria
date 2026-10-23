// Backend privado de Velo. No colocar en Público ni importar desde frontend.
import wixData from 'wix-data';
import { ingresoAbierto, vistaPartida } from 'backend/lotFlow';
import { presencia, salirPresencia, inscribir, misInscripciones, comprobarParticipacion } from 'backend/lotPresence';
import { response } from 'wix-http-functions';
import { getSecret } from 'wix-secrets-backend';
import { nexusAuth } from 'backend/nexusAuth';
import { restoreCard, verifyCard } from 'backend/lotCards';
const O={suppressAuth:true,consistentRead:true};
const ORIGIN='https://loteria.scad.mx';
const id=v=>typeof v==='string'?v:v?._id||'';
const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, X-LOT-Carton','Cache-Control':'no-store','Vary':'Origin'};
function json(status,body){return response({status,headers,body:JSON.stringify(body)});}
function check(condition,message,status=403){if(!condition){const e=new Error(message);e.status=status;throw e;}}
async function secret(){const s=await getSecret('NEXUS_TOKEN_SECRET');check(typeof s==='string'&&s.length>=32,'Configuración de firma no disponible.',500);return s;}
function origin(request){const o=request?.headers?.origin||request?.headers?.Origin;check(!o||o===ORIGIN,'Origen no permitido.');}
async function identity(request){
  origin(request);
  const auth=await nexusAuth(request,{app:'LOT',headers});
  if(!auth.ok)return {response:auth.response};
  const users=await wixData.query('SCaD_USR').eq('app','LOT').eq('activo',true).eq('memberId',auth.memberId).eq('enteOperador',auth.eo).limit(2).find(O);
  const eos=await wixData.query('SCaD_EO').eq('app','LOT').eq('activo',true).eq('codigoContexto',auth.eo).limit(2).find(O);
  check(users.items.length===1&&eos.items.length===1,'No tienes un acceso LOT activo para este ente.');
  return {user:users.items[0],eo:eos.items[0]};
}
async function gameFor(key,ctx){
  check(typeof key==='string'&&/^[a-zA-Z0-9-]{16,64}$/.test(key),'Identificador de partida inválido.',400);
  const game=await wixData.get('LOT_Partidas',key,O);
  check(game&&id(game.enteOperador)===ctx.eo._id,'La partida no está disponible para tu ente.');
  check(game.reglas?.modalidad==='CARTON_LLENO'&&game.reglas.filas===4&&game.reglas.columnas===4,'Modalidad no disponible.');
  return game;
}
async function snapshot(game,carton){
  const r=await wixData.query('LOT_Figuras').eq('catalogo',id(game.catalogo)).limit(1000).find(O);
  const byId=new Map(r.items.map(f=>[f._id,f]));
  const figuras=game.reglas.figuras.map(k=>{const f=byId.get(k);check(f,'La baraja de esta partida no está completa.',409);return {id:f._id,numero:f.numero,nombre:f.nombre,imagen:f.imagen||null};});
  const view=vistaPartida(game);
  return {id:game._id,estado:game.estado,nombre:game.reglas.nombre&&!game.reglas.nombre.startsWith('LOT-')?game.reglas.nombre:'Partida de lotería',premio:game.reglas.premio||'',presentacion:{resaltarCantadas:game.reglas.presentacion?.resaltarCantadas===true,audioJugadores:game.reglas.presentacion?.audioJugadores!==false,anuncioGanador:game.reglas.presentacion?.anuncioGanador||'Lotería'},canto:view._canto,figuras,carton,cantadas:view.figurasCantadas};
}
function failure(e){console.error('LOT_SALA',e.status||500);return json(e.status||500,{ok:false,mensaje:e.status?e.message:'No se pudo completar la operación. Intenta de nuevo.',codigo:e.code});}
export function lotOptions(request){try{origin(request);return response({status:204,headers});}catch(e){return failure(e);}}
export async function lotContext(request){try{const ctx=await identity(request);if(ctx.response)return ctx.response;return json(200,{ok:true,data:{usuario:{nombre:ctx.user.nombreVisible||ctx.user.nombreCompleto||ctx.user.nombre||ctx.user.codigoUSR,avatar:ctx.user.avatar||''},eo:{nombre:ctx.eo.nombreVisible||ctx.eo.nombre}}});}catch(e){return failure(e);}}
export async function lotEntry(request){try{
  const ctx=await identity(request);if(ctx.response)return ctx.response;
  const body=await request.body.json();
  const game=await gameFor(body.partida,ctx);
  let registration;try{registration=await inscribir(game,ctx.user,ctx.eo);}catch(e){e.status=409;throw e;}
  const fresh=await gameFor(game._id,ctx);
  let issued;try{issued=restoreCard(await secret(),fresh,ctx.user,registration.row);}catch{check(false,'No se puede recuperar el cartón: la inscripción venció o la partida está cerrada.',409);}
  await presencia(fresh,ctx.user,ctx.eo);
  return json(200,{ok:true,data:{...await snapshot(fresh,issued.carton),comprobante:issued.comprobante,recuperada:registration.recuperada}});
}catch(e){return failure(e);}}
export async function lotState(request){try{
  const ctx=await identity(request);if(ctx.response)return ctx.response;
  const game=await gameFor(request.query?.partida,ctx);
  try{await comprobarParticipacion(game,ctx.user);}catch(e){e.status=403;throw e;}
  const ticket=request.headers?.['x-lot-carton']||request.headers?.['X-LOT-Carton'];
  let card;try{card=verifyCard(await secret(),ticket,game,ctx.user);}catch{check(false,'Tu comprobante no es válido para esta partida. Vuelve a entrar antes de su inicio.',403);}
  if(request.query?.presencia==='1'){const payload=JSON.parse(Buffer.from(ticket.split('.')[0].replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8'));await presencia(game,ctx.user,ctx.eo,payload.iat);}
  return json(200,{ok:true,data:await snapshot(game,card)});
}catch(e){return failure(e);}}
export async function verifyDigitalCard(ticket,game,user){await comprobarParticipacion(game,user);return verifyCard(await secret(),ticket,game,user);}

export async function lotExit(request){try{
  const ctx=await identity(request);if(ctx.response)return ctx.response;
  const body=await request.body.json();const game=await gameFor(body.partida,ctx);
  await salirPresencia(game,ctx.user);return json(200,{ok:true,data:{salio:true}});
}catch(e){return failure(e);}}

export async function lotGames(request){try{
  const ctx=await identity(request);if(ctx.response)return ctx.response;
  const results=await wixData.query('LOT_Partidas').eq('enteOperador',ctx.eo._id).descending('_createdDate').limit(100).find(O);
  const registrations=await misInscripciones(ctx.user,ctx.eo);const joined=new Map(registrations.map(r=>[id(r.partida),r]));
  const partidas=results.items.filter(g=>g.reglas?.modalidad==='CARTON_LLENO'&&(g.estado!=='BORRADOR'||ingresoAbierto(g))).map(g=>{
    const closed=['FINALIZADA','CANCELADA'].includes(g.estado),r=joined.get(g._id),retirado=r?.retirado===true;
    const inscrita=!!r&&!retirado&&(!g.inicio||new Date(r.fechaInscripcion).getTime()<=new Date(g.inicio).getTime());
    return {id:g._id,nombre:g.reglas.nombre&&!g.reglas.nombre.startsWith('LOT-')?g.reglas.nombre:'Partida de lotería',premio:g.reglas.premio||'',estado:closed?'CERRADA':g.estado==='BORRADOR'?'EN_ESPERA':'EN_CURSO',inscrita,retirado,puedeInscribirse:ingresoAbierto(g)&&!inscrita&&!retirado,puedeEntrar:!closed&&inscrita,modo:g.reglas.canto?.modo||'MANUAL',fecha:g.inicio||g._createdDate};
  });
  return json(200,{ok:true,data:{usuario:{nombre:ctx.user.nombreVisible||ctx.user.nombreCompleto||ctx.user.nombre||ctx.user.codigoUSR,avatar:ctx.user.avatar||''},eo:{nombre:ctx.eo.nombreVisible||ctx.eo.nombre},partidas}});
}catch(e){return failure(e);}}

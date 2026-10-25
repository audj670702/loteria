// Backend privado de Velo. No colocar en Público ni importar desde frontend.
import wixData from 'wix-data';
import { ingresoAbierto, vistaPartida, cantadas } from 'backend/lotFlow';
import { presencia, salirPresencia, inscribir, misInscripciones, comprobarParticipacion } from 'backend/lotPresence';
import { response } from 'wix-http-functions';
import { getSecret } from 'wix-secrets-backend';
import { nexusAuth } from 'backend/nexusAuth';
import { restoreCard, verifyCard } from 'backend/lotCards';
import { comercial } from 'backend/sysComercial';
import { CFG_COMERCIAL } from 'backend/lotPlan';
const C=comercial(CFG_COMERCIAL);
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
  // EO comercial sin plan vigente del titular: suspendida para todos sus usuarios (caché de 10 min en SYS).
  check(await C.vigenciaEO(eos.items[0]),'La suscripción de LOTERÍA de tu ente no está vigente. Pide al responsable que la renueve.');
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
  const resolved=await resolveDigitalResult(game);game=resolved.game;
  const view=vistaPartida(game);
  return {ganadores:resolved.winners.map(w=>({usuario:id(w.usuario),nombre:w.cartonGanador?.nombre||'Jugador',avatar:w.cartonGanador?.avatar||'',fecha:w.fechaValidacion})),cierre:game.reglas.cierre||null,id:game._id,estado:game.estado,nombre:game.reglas.nombre&&!game.reglas.nombre.startsWith('LOT-')?game.reglas.nombre:'Partida de lotería',premio:game.reglas.premio||'',presentacion:{resaltarCantadas:game.reglas.presentacion?.resaltarCantadas===true,audioJugadores:game.reglas.presentacion?.audioJugadores!==false,anuncioGanador:game.reglas.presentacion?.anuncioGanador||'Lotería'},canto:view._canto,figuras,carton,cantadas:view.figurasCantadas};
}
function failure(e){console.error('LOT_SALA',e.status||500);return json(e.status||500,{ok:false,mensaje:e.status?e.message:'No se pudo completar la operación. Intenta de nuevo.',codigo:e.code});}
export function lotOptions(request){try{origin(request);return response({status:204,headers});}catch(e){return failure(e);}}
export async function lotContext(request){try{const ctx=await identity(request);if(ctx.response)return ctx.response;return json(200,{ok:true,data:{usuario:{id:ctx.user._id,nombre:ctx.user.nombreVisible||ctx.user.nombreCompleto||ctx.user.nombre||ctx.user.codigoUSR,avatar:ctx.user.avatar||''},eo:{nombre:ctx.eo.nombreVisible||ctx.eo.nombre}}});}catch(e){return failure(e);}}
export async function lotEntry(request){try{
  const ctx=await identity(request);if(ctx.response)return ctx.response;
  const body=await request.body.json();
  const game=await gameFor(body.partida,ctx);
  if(body.accion==='presentar')return await presentDigital(request,ctx,game);
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
  return json(200,{ok:true,data:{usuario:{id:ctx.user._id,nombre:ctx.user.nombreVisible||ctx.user.nombreCompleto||ctx.user.nombre||ctx.user.codigoUSR,avatar:ctx.user.avatar||''},eo:{nombre:ctx.eo.nombreVisible||ctx.eo.nombre},partidas}});
}catch(e){return failure(e);}}

// La primera inserción con ID único congela el canto. No almacena cartones de no ganadores.
const closeKey=game=>game._id+'-cierre-digital';
async function closingWinner(game){const r=await wixData.query('LOT_Ganadores').eq('_id',closeKey(game)).limit(1).find(O);return r.items[0];}
function applyDigitalClose(game,winner){const close=winner.cartonGanador.cierre;return {...game,estado:'FINALIZADA',fin:new Date(close.fecha),figurasCantadas:[...close.cantadas],reglas:{...game.reglas,ingresoAbierto:false,cierre:{motivo:'GANADOR_DIGITAL',fecha:close.fecha,turno:close.cantadas.length},canto:{...game.reglas.canto,pausado:true,desde:null}}};}
export async function resolveDigitalResult(game){
  const first=await closingWinner(game);
  if(first){const needs=game.estado!=='FINALIZADA'||game.reglas.cierre?.motivo!=='GANADOR_DIGITAL'||JSON.stringify(game.figurasCantadas)!==JSON.stringify(first.cartonGanador.cierre.cantadas);game=applyDigitalClose(game,first);if(needs)game=await wixData.update('LOT_Partidas',game,{suppressAuth:true});}
  const r=await wixData.query('LOT_Ganadores').eq('partida',game._id).limit(1000).find(O);let page=r;const winners=[...r.items];while(page.hasNext()){page=await page.next();winners.push(...page.items);}
  return {game,winners};
}
function completionTurn(card,called){return Math.max(...card.map(k=>called.indexOf(k)))+1;}
export async function registerDigitalWinner(game,user,card){
  check(card.length===16&&new Set(card).size===16&&card.every(k=>game.reglas.figuras.includes(k)),'Cartón inválido.',400);
  let first=await closingWinner(game);
  const previous=await wixData.query('LOT_Ganadores').eq('partida',game._id).eq('usuario',user._id).limit(1).find(O);
  if(previous.items.length)return resolveDigitalResult(game);
  check(game.estado==='EN_CURSO'||!!first,'La partida ya está cerrada.',409);
  let called=first?.cartonGanador.cierre.cantadas||cantadas(game);
  check(card.every(k=>called.includes(k)),'El sistema aún no reconoce las 16 figuras cantadas de tu cartón.',409);
  const now=Date.now();
  const values={folio:'GAN-DIGITAL',partida:game._id,usuario:user._id,figuraGanadora:'CARTON_LLENO',fechaValidacion:new Date(now),premio:game.reglas.premio||'',cartonGanador:{filas:4,columnas:4,figuras:[...card],posicionesGanadoras:Array.from({length:16},(_,i)=>i),validacion:'SISTEMA',presentacion:'DIGITAL',nombre:user.nombreVisible||user.nombreCompleto||user.nombre||user.codigoUSR,avatar:user.avatar||''}};
  if(!first){
    // La clave única evita que dos peticiones simultáneas elijan cortes diferentes.
    const closing={...values,_id:closeKey(game),cartonGanador:{...values.cartonGanador,cierre:{fecha:new Date(now).toISOString(),cantadas:[...called],turnoGanador:completionTurn(card,called)}}};
    try{first=await wixData.insert('LOT_Ganadores',closing,{suppressAuth:true});}catch(error){first=await closingWinner(game);if(!first)throw error;}
  }
  if(id(first.usuario)!==user._id){
    const close=first.cartonGanador.cierre;called=close.cantadas;
    check(now-new Date(close.fecha).getTime()<=30000,'Terminó el plazo de presentación de cartones simultáneos.',409);
    check(card.every(k=>called.includes(k))&&completionTurn(card,called)===close.turnoGanador,'El cartón no corresponde al mismo turno ganador.',409);
    try{await wixData.insert('LOT_Ganadores',{...values,_id:game._id+'-'+user._id},{suppressAuth:true});}catch(error){const same=await wixData.query('LOT_Ganadores').eq('partida',game._id).eq('usuario',user._id).limit(1).find(O);if(!same.items.length)throw error;}
  }
  // Inscripciones siguen siendo temporales: permiten resolver empates y expiran por el trabajo de limpieza.
  return resolveDigitalResult(game);
}
async function presentDigital(request,ctx,game){
  const registration=await comprobarParticipacion(game,ctx.user);
  check(registration&&new Date(registration.fechaInscripcion).getTime()<=new Date(game.inicio).getTime(),'No tienes una inscripción válida anterior al inicio.',403);
  const ticket=request.headers?.['x-lot-carton']||request.headers?.['X-LOT-Carton'];
  let card;try{card=verifyCard(await secret(),ticket,game,ctx.user);}catch{check(false,'El comprobante no corresponde a tu cartón asignado.',403);}
  const resolved=await registerDigitalWinner(game,ctx.user,card);
  return json(200,{ok:true,data:await snapshot(resolved.game,card)});
}

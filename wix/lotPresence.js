import wixData from 'wix-data';
import crypto from 'crypto';
import { ingresoAbierto } from 'backend/lotFlow';
const O={suppressAuth:true,consistentRead:true};
const W={suppressAuth:true};
const COL='LOT_Presencias';
const key=(game,user)=>crypto.createHash('sha256').update(game._id+':'+user._id).digest('hex').slice(0,32);
const date=v=>new Date(v).getTime();
async function removeQuery(query){let total=0;for(let batch=0;batch<50;batch++){const r=await query.limit(1000).find(O);if(!r.items.length)return total;const result=await wixData.bulkRemove(COL,r.items.map(x=>x._id),W);if(result.errors?.length)throw new Error('No se completó la limpieza temporal LOT.');total+=r.items.length;}throw new Error('Limpieza LOT excedió el límite; revisar el trabajo programado.');}
export async function limpiarPresencias(){return removeQuery(wixData.query(COL).lt('expira',new Date()));}
export async function cerrarPresencias(game){return removeQuery(wixData.query(COL).eq('partida',game._id));}
export async function inscripcion(game,user){const r=await wixData.query(COL).eq('_id',key(game,user)).limit(1).find(O);const row=r.items[0];return row&&Number.isFinite(date(row.fechaInscripcion))&&date(row.expira)>Date.now()?row:null;}
function valid(game,row){return ['BORRADOR','EN_CURSO'].includes(game.estado)&&(!game.inicio||date(row.fechaInscripcion)<=date(game.inicio));}
async function saveEnrollment(game,user,eo,at){
  const k=key(game,user),now=new Date();const old=await wixData.query(COL).eq('_id',k).limit(1).find(O);
  if(old.items[0]?.fechaInscripcion&&date(old.items[0].expira)>now.getTime())return old.items[0];
  const values={_id:k,partida:game._id,usuario:user._id,enteOperador:eo._id,nombre:user.nombreVisible||user.nombreCompleto||user.nombre||user.codigoUSR,fechaInscripcion:new Date(at),ultimaActividad:now,expira:new Date(at+7*24*60*60*1000)};
  let row;
  if(old.items.length)row=await wixData.update(COL,{...old.items[0],...values},W);
  else {try{row=await wixData.insert(COL,values,W);}catch(e){row=await inscripcion(game,user);if(!row)throw e;}}
  const fresh=await wixData.get('LOT_Partidas',game._id,O);
  if(!valid(fresh,row)){await removeQuery(wixData.query(COL).eq('_id',k));throw new Error('El ingreso acaba de cerrarse. Inscríbete en la siguiente partida.');}
  return row;
}
export async function inscribir(game,user,eo){
  const old=await inscripcion(game,user);if(old&&valid(game,old))return {row:old,recuperada:true};
  if(!ingresoAbierto(game))throw new Error('La inscripción está cerrada. Solo pueden volver quienes se inscribieron antes del inicio.');
  return {row:await saveEnrollment(game,user,eo,Date.now()),recuperada:false};
}
export async function presencia(game,user,eo,verifiedAt){
  if(!['BORRADOR','EN_CURSO'].includes(game.estado))return;
  let row=await inscripcion(game,user);
  // Migración de una sesión previa: verifiedAt viene solo de un comprobante cuya firma ya se validó en backend.
  if(!row&&Number.isFinite(verifiedAt)&&verifiedAt<=Date.now()&&(!game.inicio||verifiedAt<=date(game.inicio)))row=await saveEnrollment(game,user,eo,verifiedAt);
  if(!row)return;
  await wixData.update(COL,{...row,ultimaActividad:new Date()},W);
  const fresh=await wixData.get('LOT_Partidas',game._id,O);
  if(!['BORRADOR','EN_CURSO'].includes(fresh.estado))await cerrarPresencias(game);
}
export async function salirPresencia(game,user){const row=await inscripcion(game,user);if(row)await wixData.update(COL,{...row,ultimaActividad:new Date(0)},W);}
export async function misInscripciones(user,eo){let r=await wixData.query(COL).eq('usuario',user._id).eq('enteOperador',eo._id).gt('expira',new Date()).limit(1000).find(O);const rows=[...r.items];while(r.hasNext()){r=await r.next();rows.push(...r.items);}return rows.filter(p=>Number.isFinite(date(p.fechaInscripcion)));}
export async function listaPresencias(game,eo){
  await removeQuery(wixData.query(COL).eq('partida',game._id).lt('expira',new Date()));
  let result=await wixData.query(COL).eq('partida',game._id).eq('enteOperador',eo._id).ascending('nombre').limit(1000).find(O);
  const rows=[...result.items];while(result.hasNext()){result=await result.next();rows.push(...result.items);}
  return rows.filter(p=>Number.isFinite(date(p.fechaInscripcion))).map(p=>({usuario:typeof p.usuario==='string'?p.usuario:p.usuario._id,nombre:p.nombre,fechaInscripcion:p.fechaInscripcion,ultimaActividad:p.ultimaActividad,conectado:Date.now()-date(p.ultimaActividad)<45000}));
}

import wixData from 'wix-data';
import crypto from 'crypto';
const O={suppressAuth:true,consistentRead:true};
const W={suppressAuth:true};
const COL='LOT_Presencias';
const key=(game,user)=>crypto.createHash('sha256').update(game._id+':'+user._id).digest('hex').slice(0,32);
async function removeQuery(query){let total=0;for(let batch=0;batch<50;batch++){const r=await query.limit(1000).find(O);if(!r.items.length)return total;const result=await wixData.bulkRemove(COL,r.items.map(x=>x._id),W);if(result.errors?.length)throw new Error('No se completó la limpieza temporal LOT.');total+=r.items.length;}throw new Error('Limpieza LOT excedió el límite; revisar el trabajo programado.');}
export async function limpiarPresencias(){return removeQuery(wixData.query(COL).lt('expira',new Date()));}
export async function cerrarPresencias(game){return removeQuery(wixData.query(COL).eq('partida',game._id));}
export async function presencia(game,user,eo){
  if(!['BORRADOR','EN_CURSO'].includes(game.estado))return;
  const now=new Date();const k=key(game,user);
  const values={_id:k,partida:game._id,usuario:user._id,enteOperador:eo._id,nombre:user.nombreVisible||user.nombreCompleto||user.nombre||user.codigoUSR,ultimaActividad:now,expira:new Date(now.getTime()+5*60*1000)};
  const old=await wixData.query(COL).eq('_id',k).limit(1).find(O);
  if(old.items.length)await wixData.update(COL,{...old.items[0],...values},W);
  else {try{await wixData.insert(COL,values,W);}catch(e){const existing=await wixData.query(COL).eq('_id',k).limit(1).find(O);if(!existing.items.length)throw e;}}
  // Una entrada que se cruzó con el cierre no debe dejar presencia residual.
  const fresh=await wixData.get('LOT_Partidas',game._id,O);
  if(!['BORRADOR','EN_CURSO'].includes(fresh.estado))await cerrarPresencias(game);
}
export async function salirPresencia(game,user){return removeQuery(wixData.query(COL).eq('_id',key(game,user)));}
export async function listaPresencias(game,eo){
  await removeQuery(wixData.query(COL).eq('partida',game._id).lt('expira',new Date()));
  let result=await wixData.query(COL).eq('partida',game._id).eq('enteOperador',eo._id).ascending('nombre').limit(1000).find(O);
  const rows=[...result.items];while(result.hasNext()){result=await result.next();rows.push(...result.items);}
  return rows.map(p=>({usuario:typeof p.usuario==='string'?p.usuario:p.usuario._id,nombre:p.nombre,ultimaActividad:p.ultimaActividad,conectado:Date.now()-new Date(p.ultimaActividad).getTime()<45000}));
}

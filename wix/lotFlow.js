// Reglas puras compartidas por PCP y sala; el reloj se evalúa en el servidor.
export function configPartida(datos={}) {
  const nombre=String(datos.nombre||'Partida de lotería').trim().slice(0,120);
  const premio=String(datos.premio||'').trim().slice(0,300);
  const modo=datos.modo||'MANUAL';
  const intervalo=Number(datos.intervalo||8);
  if(!['MANUAL','AUTOMATICO'].includes(modo))throw new Error('Elige canto manual o automático.');
  if(!Number.isSafeInteger(intervalo)||intervalo<5||intervalo>120)throw new Error('El intervalo debe ser de 5 a 120 segundos.');
  const anuncioGanador=String(datos.anuncioGanador??'Lotería').trim().replace(/\s+/g,' ');
  if(!anuncioGanador||anuncioGanador.length>40)throw new Error('El anuncio de cartón lleno debe tener entre 1 y 40 caracteres.');
  const presentacion={resaltarCantadas:datos.resaltarCantadas===true,audioJugadores:datos.audioJugadores!==false,anuncioGanador};
  return {nombre,premio,presentacion,canto:{modo,intervalo,pausado:false,acumuladoMs:0,desde:null,orden:[]}};
}
export function ingresoAbierto(game) {return game.estado==='BORRADOR'&&(game.reglas?.version<2||game.reglas?.ingresoAbierto===true);}
export function transcurrido(game,now=Date.now()) {
  const c=game.reglas?.canto;
  return Math.max(0,Number(c?.acumuladoMs)||0)+(game.estado==='EN_CURSO'&&!c?.pausado&&Number.isFinite(c?.desde)?Math.max(0,now-c.desde):0);
}
export function cantadas(game,now=Date.now()) {
  const c=game.reglas?.canto;
  if(c?.modo!=='AUTOMATICO'||game.estado!=='EN_CURSO')return [...(game.figurasCantadas||[])];
  const count=Math.min(c.orden.length,Math.floor(transcurrido(game,now)/(c.intervalo*1000)));
  return c.orden.slice(0,count);
}
export function vistaPartida(game,now=Date.now()) {
  const c=game.reglas?.canto;
  return {...game,figurasCantadas:cantadas(game,now),_reloj:now,_canto:{modo:c?.modo||'MANUAL',pausado:c?.pausado===true,intervalo:c?.intervalo||8,proximoEn:c?.modo==='AUTOMATICO'&&game.estado==='EN_CURSO'&&!c.pausado&&cantadas(game,now).length<c.orden.length?Math.ceil((c.intervalo*1000-transcurrido(game,now)%(c.intervalo*1000))/1000):null}};
}
export function pausa(game,paused,now=Date.now()) {
  const c=game.reglas?.canto||{modo:'MANUAL',intervalo:8,acumuladoMs:0,desde:null,orden:[],pausado:false};
  if(game.estado!=='EN_CURSO')throw new Error('La partida no está en curso.');
  if(c.pausado===paused)throw new Error(paused?'La partida ya está pausada.':'El canto ya está activo.');
  const elapsed=transcurrido(game,now);game.figurasCantadas=cantadas(game,now);
  game.reglas.canto={...c,acumuladoMs:elapsed,desde:paused?null:now,pausado:paused};
  return game;
}

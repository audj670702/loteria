import {DEMO_FIGURES,makeCard,shuffle,toggleMark,isFull,normalizeState,imageUrl} from './game.js';
import {CONFIG} from './config.js';
import {captureSession,clearSession,login,getContext,getState} from './api.js';
const $=id=>document.getElementById(id);
let state=null, marks=new Set(), mode='', deck=[], timer=null, controller=null, generation=0, stale=false, deferredInstall=null;
function message(text='',error=false){$('message').textContent=text;$('message').className='message'+(error?' error':'');}
function figure(id){return state.figuras.find(f=>f.id===id);}
function textName(id){const f=figure(id);return f.numero+' · '+f.nombre;}
function art(f){const url=imageUrl(f.imagen);if(!url)return document.createTextNode(String(f.numero).padStart(2,'0'));const img=document.createElement('img');img.src=url;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>img.replaceWith(document.createTextNode(String(f.numero).padStart(2,'0'))),{once:true});return img;}
function openDialog(id){if(!$(id).open)$(id).showModal();}
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('how').onclick=()=>openDialog('helpDialog');
function updateProgress(){
  const total=state.carton.filter(id=>marks.has(id)).length;
  $('progress').textContent=total+' / 16';$('progressBar').style.width=(100*total/16)+'%';
  $('claim').disabled=stale||state.estado!=='EN_CURSO'||!isFull(state.carton,state.cantadas,marks);
}
function renderBoard(){
  $('board').replaceChildren(...state.carton.map(id=>{
    const f=figure(id),called=state.cantadas.includes(id),marked=marks.has(id);
    const tile=document.createElement('button');tile.type='button';tile.className='tile'+(called?' called':'')+(marked?' marked':'');
    tile.setAttribute('aria-label',textName(id)+(called?' · cantada':' · aún no cantada'));tile.setAttribute('aria-pressed',String(marked));
    tile.disabled=stale||state.estado!=='EN_CURSO'||!called;
    const number=document.createElement('span');number.className='number';number.textContent=f.numero;
    const image=document.createElement('span');image.className='art';image.append(art(f));
    const name=document.createElement('span');name.className='name';name.textContent=f.nombre;
    tile.append(number,image,name);
    tile.onclick=()=>{if(stale||state.estado!=='EN_CURSO')return;marks=toggleMark(id,state.carton,state.cantadas,marks);tile.classList.toggle('marked',marks.has(id));tile.setAttribute('aria-pressed',String(marks.has(id)));updateProgress();};
    return tile;
  }));updateProgress();
}
function render(){
  $('stateLabel').textContent={BORRADOR:'En espera',EN_CURSO:'En curso',FINALIZADA:'Finalizada',CANCELADA:'Cancelada'}[state.estado];
  $('calledCount').textContent=state.cantadas.length+' figuras cantadas';
  const id=state.cantadas.at(-1);$('last').replaceChildren();
  const number=document.createElement('span');number.className='last-number';number.textContent=id?figure(id).numero:'—';
  const title=document.createElement('h2');title.textContent=id?figure(id).nombre:'Esperando el canto';if(id && imageUrl(figure(id).imagen)){const image=document.createElement('span');image.className='last-art';image.append(art(figure(id)));$('last').append(image,title);}else $('last').append(number,title);
  $('history').replaceChildren(...state.cantadas.map(id=>{const li=document.createElement('li');li.textContent=textName(id);return li;}));
  $('next').disabled=mode!=='demo'||deck.length===0;
  renderBoard();
}
function enter(){ $('welcome').hidden=true;$('room').hidden=false;render();$('room').scrollIntoView({block:'start'}); }
function stop(){generation++;clearTimeout(timer);controller?.abort();controller=null;}
function clearRoom(){stop();state=null;marks.clear();deck=[];mode='';stale=false;document.querySelectorAll('dialog[open]').forEach(d=>d.close());$('board').replaceChildren();$('history').replaceChildren();$('claimFigures').replaceChildren();$('room').hidden=true;$('welcome').hidden=false;message();$('demo').focus();}
$('demo').onclick=()=>{stop();mode='demo';stale=false;marks=new Set();state={id:'demostracion',estado:'EN_CURSO',figuras:DEMO_FIGURES,carton:makeCard(DEMO_FIGURES),cantadas:[]};deck=shuffle(DEMO_FIGURES.map(f=>f.id));$('userName').textContent='Visitante de demostración';$('eoName').textContent='Sin conexión a una empresa';$('roomMode').textContent='DEMOSTRACIÓN · SIN PREMIOS';$('sync').textContent='Prueba local';$('demoTools').hidden=false;message('Esta demostración no crea partidas ni ganadores reales.');enter();};
$('next').onclick=()=>{if(mode!=='demo'||!deck.length)return;state.cantadas.push(deck.shift());render();if(!deck.length)message('Se cantó toda la baraja. Completa las marcas de tu cartón para probar el cierre.');};
$('claim').onclick=()=>{if(stale||state.estado!=='EN_CURSO'||!isFull(state.carton,state.cantadas,marks))return;$('claimMode').textContent=mode==='demo'?'DEMOSTRACIÓN · SIN PREMIOS':'CARTÓN PARA REVISIÓN';$('claimText').textContent=mode==='demo'?'Completaste la prueba. No se ha registrado un ganador real ni se ha asignado un premio.':'Muestra este cartón al responsable. Esta pantalla no confirma ni registra un ganador.';$('claimFigures').replaceChildren(...state.carton.map(id=>{const li=document.createElement('li');li.textContent=textName(id);return li;}));openDialog('claimDialog');};
$('leave').onclick=()=>openDialog('leaveDialog');$('confirmLeave').onclick=()=>{if(mode==='live')clearSession();clearRoom();};
// El token identifica al miembro únicamente ante SYS. Ningún parámetro de URL concede acceso.
async function poll(id,runId){
  controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),12000);
  try {
    const incoming=normalizeState(await getState(id,controller.signal));if(runId!==generation)return;
    if(incoming.id!==id || incoming.carton.some((key,i)=>key!==state.carton[i]))throw new Error('El cartón cambió. Consulta al responsable antes de continuar.');
    state=incoming;stale=false;marks=new Set([...marks].filter(k=>state.cantadas.includes(k)));$('sync').textContent='Actualizado';message();render();
  } catch(error){if(runId!==generation)return;stale=true;$('sync').textContent='Sin actualizar';message(error.message||'No se pudo actualizar. Tus marcas siguen en esta pestaña.',true);renderBoard();}
  finally{clearTimeout(timeout);if(runId===generation && ['BORRADOR','EN_CURSO'].includes(state?.estado))timer=setTimeout(()=>poll(id,runId),4000);}
}
async function join(){
  const id=$('gameId').value.trim();if(!id){message('Escribe el identificador que comparte el responsable.',true);return;}
  if(!CONFIG.liveEnabled){message('Las partidas reales aún no están conectadas. Usa «Probar una demostración».',true);return;}
  $('join').disabled=true;const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),12000);
  try{
    const context=await getContext(abort.signal);
    if(!context?.usuario?.nombre||!context?.eo?.nombre)throw new Error('No se pudo resolver tu identidad SCaD.');
    const incoming=normalizeState(await getState(id,abort.signal));if(incoming.id!==id)throw new Error('La partida recibida no coincide.');
    stop();mode='live';state=incoming;stale=false;marks=new Set();$('userName').textContent=context.usuario.nombre;$('eoName').textContent=context.eo.nombre;$('roomMode').textContent='PARTIDA · '+id;$('sync').textContent='Actualizado';$('demoTools').hidden=true;message();enter();if(['BORRADOR','EN_CURSO'].includes(state.estado))timer=setTimeout(()=>poll(id,generation),4000);
  }catch(error){if(error.auth)login(id);else message(error.message||'No se pudo entrar a la partida.',true);}
  finally{clearTimeout(timeout);$('join').disabled=false;}
}
$('join').onclick=join;$('gameId').onkeydown=e=>{if(e.key==='Enter')join();};
window.addEventListener('beforeunload',e=>{if(state){e.preventDefault();e.returnValue='';}});
window.addEventListener('pagehide',()=>stop());
window.addEventListener('pageshow',e=>{if(e.persisted&&state&&mode==='live'){stale=true;renderBoard();poll(state.id,generation);}});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('install').hidden=false;});
$('install').onclick=async()=>{if(!deferredInstall)return;await deferredInstall.prompt();deferredInstall=null;$('install').hidden=true;};
try{captureSession();}catch(error){message(error.message,true);}
const partida=new URL(location.href).searchParams.get('partida');if(partida){$('gameId').value=partida;if(CONFIG.liveEnabled)join();}
if(CONFIG.liveEnabled)$('connectionNote').textContent='Ingresa con tu identidad SCaD. El responsable comparte el identificador de la partida.';
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});

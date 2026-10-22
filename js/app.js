import {DEMO_FIGURES,makeCard,shuffle,toggleMark,isFull,normalizeState,imageUrl} from './game.js';
import {CONFIG} from './config.js';
import {captureSession,clearSession,login,getContext,getState,enterGame,exitGame,getGames,hasSession} from './api.js?v=lobby-3';
const $=id=>document.getElementById(id);
let lobbyTimer=null,lobbyRun=0,lobbyGames=[],
lastPresence=0, ticket='', state=null, marks=new Set(), mode='', deck=[], timer=null, controller=null, generation=0, stale=false, deferredInstall=null;
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
  $('gamePrize').textContent=state.premio?'Premio: '+state.premio:'Sin premio anunciado';$('gameCanto').textContent=state.canto?(state.canto.modo==='AUTOMATICO'?'Canto automático':'Canto manual')+(state.canto.pausado?' · En pausa':''):'';
  $('stateLabel').textContent={BORRADOR:'En espera',EN_CURSO:'En curso',FINALIZADA:'Finalizada',CANCELADA:'Cancelada'}[state.estado];
  $('calledCount').textContent=state.cantadas.length+' figuras cantadas';
  const id=state.cantadas.at(-1);$('last').replaceChildren();
  const number=document.createElement('span');number.className='last-number';number.textContent=id?figure(id).numero:'—';
  const title=document.createElement('h2');title.textContent=id?figure(id).nombre:'Esperando el canto';if(id && imageUrl(figure(id).imagen)){const image=document.createElement('span');image.className='last-art';image.append(art(figure(id)));$('last').append(image,title);}else $('last').append(number,title);
  $('history').replaceChildren(...state.cantadas.map(id=>{const li=document.createElement('li');li.textContent=textName(id);return li;}));
  $('next').disabled=mode!=='demo'||deck.length===0;
  renderBoard();
}
function enter(){ $('lobby').hidden=true;$('welcome').hidden=true;$('room').hidden=false;render();$('room').scrollIntoView({block:'start'}); }
function stop(){generation++;clearTimeout(timer);controller?.abort();controller=null;}
function clearRoom(){stop();ticket='';$('claimProof').value='';state=null;marks.clear();deck=[];mode='';stale=false;document.querySelectorAll('dialog[open]').forEach(d=>d.close());$('board').replaceChildren();$('history').replaceChildren();$('claimFigures').replaceChildren();$('room').hidden=true;$('welcome').hidden=false;message();$('demo').focus();}
$('demo').onclick=()=>{stopLobby();$('lobby').hidden=true;stop();ticket='';mode='demo';stale=false;marks=new Set();state={id:'demostracion',estado:'EN_CURSO',figuras:DEMO_FIGURES,carton:makeCard(DEMO_FIGURES),cantadas:[]};deck=shuffle(DEMO_FIGURES.map(f=>f.id));$('userName').textContent='Visitante de demostración';$('eoName').textContent='Sin conexión a una empresa';$('roomMode').textContent='DEMOSTRACIÓN · SIN PREMIOS';$('sync').textContent='Prueba local';$('demoTools').hidden=false;message('Esta demostración no crea partidas ni ganadores reales.');enter();};
$('next').onclick=()=>{if(mode!=='demo'||!deck.length)return;state.cantadas.push(deck.shift());render();if(!deck.length)message('Se cantó toda la baraja. Completa las marcas de tu cartón para probar el cierre.');};
$('claim').onclick=()=>{if(stale||state.estado!=='EN_CURSO'||!isFull(state.carton,state.cantadas,marks))return;$('claimMode').textContent=mode==='demo'?'DEMOSTRACIÓN · SIN PREMIOS':'CARTÓN PARA REVISIÓN';$('claimText').textContent=mode==='demo'?'Completaste la prueba. No se ha registrado un ganador real ni se ha asignado un premio.':'Muestra este cartón al responsable. Esta pantalla no confirma ni registra un ganador.';$('claimFigures').replaceChildren(...state.carton.map(id=>{const li=document.createElement('li');li.textContent=textName(id);return li;}));$('digitalEvidence').hidden=mode!=='live';$('claimProof').value=ticket;openDialog('claimDialog');};
$('copyProof').onclick=async()=>{try{await navigator.clipboard.writeText(ticket);$('proofStatus').textContent='Comprobante copiado. Entrégalo al responsable.';}catch{$('claimProof').select();$('proofStatus').textContent='Selecciona y copia el comprobante.';}};
$('leave').onclick=()=>{$('leaveText').textContent=mode==='live'?'La inscripción se conserva. Podrás recuperar el mismo cartón; tendrás que volver a marcar las figuras.':'Se borrará esta demostración y sus marcas.';openDialog('leaveDialog');};$('confirmLeave').onclick=async()=>{if(mode==='live'){const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),4000);try{await exitGame(state.id,abort.signal);}catch{}finally{clearTimeout(timeout);}}const wasLive=mode==='live';clearRoom();if(wasLive)loadLobby();};
// El token identifica al miembro únicamente ante SYS. Ningún parámetro de URL concede acceso.
async function poll(id,runId){
  controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),12000);
  try {
    const presenceDue=Date.now()-lastPresence>20000;
    const incoming=normalizeState(await getState(id,ticket,controller.signal,presenceDue));if(presenceDue)lastPresence=Date.now();if(runId!==generation)return;
    if(incoming.id!==id || incoming.carton.some((key,i)=>key!==state.carton[i]))throw new Error('El cartón cambió. Consulta al responsable antes de continuar.');
    state=incoming;stale=false;marks=new Set([...marks].filter(k=>state.cantadas.includes(k)));$('sync').textContent='Actualizado';message();render();
  } catch(error){if(runId!==generation)return;stale=true;$('sync').textContent='Sin actualizar';message(error.message||'No se pudo actualizar. Tus marcas siguen en esta pestaña.',true);renderBoard();}
  finally{clearTimeout(timeout);if(runId===generation && ['BORRADOR','EN_CURSO'].includes(state?.estado))timer=setTimeout(()=>poll(id,runId),4000);}
}
async function join(requestedId){
  stopLobby();const id=typeof requestedId==='string'?requestedId:$('gameId').value.trim();if(!id){message('Escribe el identificador que comparte el responsable.',true);return;}
  if(!CONFIG.liveEnabled){message('Las partidas reales aún no están conectadas. Usa «Probar una demostración».',true);return;}
  $('join').disabled=true;const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),12000);
  try{
    const context=await getContext(abort.signal);
    if(!context?.usuario?.nombre||!context?.eo?.nombre)throw new Error('No se pudo resolver tu identidad SCaD.');
    const entered=await enterGame(id,abort.signal);
    if(typeof entered.comprobante!=='string'||!entered.comprobante)throw new Error('No se recibió un comprobante del cartón.');
    const incoming=normalizeState(entered);if(incoming.id!==id)throw new Error('La partida recibida no coincide.');
    stop();lastPresence=Date.now();ticket=entered.comprobante;mode='live';state=incoming;stale=false;marks=new Set();$('userName').textContent=context.usuario.nombre;$('eoName').textContent=context.eo.nombre;$('roomMode').textContent=incoming.nombre||'PARTIDA · '+id;$('sync').textContent='Actualizado';$('demoTools').hidden=true;message(entered.recuperada?'Recuperaste tu mismo cartón. Marca nuevamente las figuras que ya fueron cantadas.':'Inscripción confirmada. Tu cartón está listo.');enter();if(['BORRADOR','EN_CURSO'].includes(state.estado))timer=setTimeout(()=>poll(id,generation),4000);
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
function stopLobby(){clearTimeout(lobbyTimer);lobbyRun++;}
function renderLobby(){
  const filter=$('gameFilter').value;const games=lobbyGames.filter(g=>filter==='TODAS'||g.estado===filter);
  $('gameList').replaceChildren(...games.map(g=>{
    const card=document.createElement('article');card.className='game-card';
    const title=document.createElement('h2');title.textContent=g.nombre;
    const status=document.createElement('p');status.className='pill';status.textContent={EN_ESPERA:'En espera · inscripción abierta',EN_CURSO:'En curso',CERRADA:'Cerrada'}[g.estado];
    const prize=document.createElement('p');prize.className='muted';prize.textContent=g.premio?'Premio: '+g.premio:'Sin premio anunciado';
    const joined=document.createElement('p');joined.className='muted';joined.textContent=g.inscrita?'Ya estás inscrito':g.estado==='EN_CURSO'?'La inscripción ya cerró.':g.estado==='CERRADA'?'Esta partida terminó.':'Inscríbete antes del inicio.';
    const button=document.createElement('button');button.className='primary';button.textContent=g.puedeEntrar?(g.estado==='EN_CURSO'?'Volver a mi cartón':'Ver mi cartón'):g.puedeInscribirse?'Inscribirme':g.estado==='CERRADA'?'Partida cerrada':'Inscripción cerrada';button.disabled=!g.puedeEntrar&&!g.puedeInscribirse;button.onclick=()=>join(g.id);
    card.append(title,status,prize,joined,button);return card;
  }));$('lobbyStatus').textContent=games.length?games.length+' partidas · actualizado':'No hay partidas en esta vista. El responsable debe abrir la inscripción para que aparezcan.';
}
async function loadLobby(quiet=false){
  if(state)return;clearTimeout(lobbyTimer);const run=++lobbyRun;
  const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),12000);
  $('refreshLobby').disabled=true;
  try{const data=await getGames(abort.signal);if(run!==lobbyRun||state)return;lobbyGames=data.partidas;history.replaceState(null,'',location.pathname);$('lobbyIdentity').textContent=data.usuario.nombre+' · '+data.eo.nombre;$('welcome').hidden=true;$('lobby').hidden=false;message();renderLobby();}
  catch(e){if(run!==lobbyRun)return;if(e.auth&&!quiet)login('');else{$('lobbyStatus').textContent=e.message;message(e.message,true);}}
  finally{clearTimeout(timeout);$('refreshLobby').disabled=false;if(run===lobbyRun&&!state)lobbyTimer=setTimeout(()=>loadLobby(true),15000);}
}
$('openLobby').onclick=()=>loadLobby();$('refreshLobby').onclick=()=>loadLobby();$('gameFilter').onchange=renderLobby;
$('logout').onclick=()=>{stopLobby();clearSession();$('lobby').hidden=true;$('welcome').hidden=false;message('Sesión cerrada.');};
const partida=new URL(location.href).searchParams.get('partida');if(partida){$('gameId').value=partida;if(CONFIG.liveEnabled)join(partida);}else if(CONFIG.liveEnabled&&hasSession())loadLobby();
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});

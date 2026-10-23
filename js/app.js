import {createEffects} from './effects.js?v=audio-10';
import {createBoardView} from './board-view.js?v=cierre-9';
import {createPregonero} from './pregonero.js?v=cierre-9';
import {DEMO_FIGURES,makeCard,shuffle,toggleMark,isSystemFull,normalizeState,imageUrl,isOneAway,formatClaim} from './game.js?v=cierre-9';
import {CONFIG} from './config.js';
import {captureSession,clearSession,login,getContext,getState,enterGame,exitGame,getGames,hasSession,presentCard} from './api.js?v=cierre-9';
const $=id=>document.getElementById(id);
let lobbyTimer=null,lobbyRun=0,lobbyGames=[],
lastPresence=0, ticket='', state=null, marks=new Set(), mode='', deck=[], timer=null, controller=null, generation=0, stale=false, deferredInstall=null;
let presenting=false,endStamp='',playerUser=null;
const effects=createEffects({onBlocked:()=>{$('effectsStatus').textContent='Toca Activar efectos para habilitar los sonidos en este dispositivo.';}});
document.addEventListener('pointerdown',()=>effects.unlock(),{capture:true});
$('effectsToggle').onclick=()=>{effectsMuted=!effectsMuted;effects.setEnabled(!effectsMuted);$('effectsToggle').textContent=effectsMuted?'Activar efectos':'Silenciar efectos';$('effectsStatus').textContent=effectsMuted?'Efectos silenciados.':'Efectos activados.';syncAudio();};
let effectsMuted=false;
function playersAudioAllowed(){return mode==='demo'||state?.presentacion?.audioJugadores!==false;}
const pregonero=createPregonero({synth:window.speechSynthesis,Utterance:window.SpeechSynthesisUtterance,onChange:view=>{const allowed=playersAudioAllowed();$('audioToggle').disabled=!allowed||!view.supported;$('audioToggle').textContent=!allowed?'Sin audio':view.enabled?'Silenciar pregonero':'Activar audio';$('audioToggle').setAttribute('aria-label',!allowed?'Audio desactivado por el responsable':view.enabled?'Silenciar pregonero':'Activar audio del pregonero');$('audioToggle').setAttribute('aria-pressed',String(view.enabled));$('audioRepeat').disabled=!allowed||!view.canRepeat;$('audioStatus').textContent=allowed?view.status:'Audio desactivado por el responsable. Sigue el canto del panel o el anuncio en vivo.';}});
$('audioToggle').onclick=()=>{if(playersAudioAllowed()){const turningOff=pregonero.snapshot().enabled;pregonero.toggle();effectsMuted=turningOff;effects.setEnabled(!effectsMuted);$('effectsToggle').textContent=effectsMuted?'Activar efectos':'Silenciar efectos';}};$('audioRepeat').onclick=()=>{if(playersAudioAllowed())pregonero.repeat();};
function syncAudio(){effects.sync(state,{hidden:document.hidden,outdated:stale,allowed:playersAudioAllowed()});$('effectsToggle').disabled=!playersAudioAllowed();if(!playersAudioAllowed()){pregonero.reset();return;}pregonero.sync(state,{hidden:document.hidden,outdated:stale});}
function message(text='',error=false){$('message').textContent=text;$('message').className='message'+(error?' error':'');}
function figure(id){return state.figuras.find(f=>f.id===id);}
function textName(id){const f=figure(id);return f.numero+' · '+f.nombre;}
function art(f){const url=imageUrl(f.imagen);if(!url)return document.createTextNode(String(f.numero).padStart(2,'0'));const img=document.createElement('img');img.src=url;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>img.replaceWith(document.createTextNode(String(f.numero).padStart(2,'0'))),{once:true});return img;}
function openDialog(id){document.querySelectorAll('dialog[open]').forEach(d=>{if(d.id!==id)d.close();});if(!$(id).open)$(id).showModal();}
$('gameMenu').onclick=()=>openDialog('gameMenuDialog');$('playerIdentity').onclick=()=>openDialog('identityDialog');
function setPlayerIdentity(user,eo){playerUser=user;const name=user.nombre||'Jugador';$('userName').textContent=name;$('playerIdentity').setAttribute('aria-label','Ver identidad de '+name);$('identityName').textContent=name;$('eoName').textContent=eo.nombre||'—';const initials=name.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toLocaleUpperCase('es');for(const id of ['playerAvatar','identityAvatar']){const target=$(id);target.textContent=initials;const url=imageUrl(user.avatar);if(url){const img=document.createElement('img');img.src=url;img.alt='';img.onerror=()=>img.remove();target.append(img);}}}
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('how').onclick=()=>openDialog('helpDialog');
function updateProgress(){
  const total=state.carton.filter(id=>marks.has(id)).length;
  $('progress').textContent=total+' / 16 marcadas';
  const coClaim=state.cierre?.motivo==='GANADOR_DIGITAL'&&Date.now()-new Date(state.cierre.fecha).getTime()<30000&&!state.ganadores?.some(w=>w.usuario===playerUser?.id);
  $('claim').disabled=presenting||stale||!(state.estado==='EN_CURSO'||coClaim)||!isSystemFull(state.carton,state.cantadas);
}
const boardView=createBoardView({container:$('board'),createTile(id){
  const f=figure(id),tile=document.createElement('button');tile.type='button';tile.className='tile';
  const number=document.createElement('span');number.className='number';number.textContent=f.numero;
  const image=document.createElement('span');image.className='art';image.append(art(f));
  const name=document.createElement('span');name.className='name';name.textContent=f.nombre;
  tile.append(number,image,name);
  tile.onclick=()=>{if(stale||state.estado!=='EN_CURSO')return;marks=toggleMark(id,state.carton,state.cantadas,marks,true);tile.classList.toggle('marked',marks.has(id));tile.setAttribute('aria-pressed',String(marks.has(id)));updateProgress();};
  return tile;
},updateTile(tile,id){
  const called=state.cantadas.includes(id),marked=marks.has(id),hint=state.presentacion?.resaltarCantadas===true;
  tile.classList.toggle('called',hint&&called);tile.classList.toggle('marked',marked);
  const label=textName(id)+(hint?(called?' · cantada':' · aún no cantada'):'');
  if(tile.getAttribute('aria-label')!==label)tile.setAttribute('aria-label',label);
  if(tile.getAttribute('aria-pressed')!==String(marked))tile.setAttribute('aria-pressed',String(marked));
  const disabled=stale||state.estado!=='EN_CURSO';if(tile.disabled!==disabled)tile.disabled=disabled;
}});
let lastFigureStamp='',historyIds=[];
function renderBoard(){
  boardView.render(state.carton);updateProgress();
  const near=state.estado==='EN_CURSO'&&!stale&&!state.canto?.pausado&&isOneAway(state.carton,state.cantadas);$('boardPanel').classList.toggle('one-away',near);$('nearNotice').hidden=!near;
}
function renderLastFigure(){
  const id=state.cantadas.at(-1),f=id?figure(id):null;
  const stamp=JSON.stringify(f?[f.id,f.numero,f.nombre,f.imagen]:['waiting']);if(stamp===lastFigureStamp)return;
  lastFigureStamp=stamp;const title=document.createElement('h2');title.textContent=f?f.nombre:'Esperando el canto';
  if(f&&imageUrl(f.imagen)){const image=document.createElement('span');image.className='last-art';image.append(art(f));$('last').replaceChildren(image,title);}
  else{const number=document.createElement('span');number.className='last-number';number.textContent=f?f.numero:'—';$('last').replaceChildren(number,title);}
}
function renderHistory(){
  if(historyIds.some((id,i)=>state.cantadas[i]!==id)){historyIds=[];$('history').replaceChildren();}
  for(const id of state.cantadas.slice(historyIds.length)){const li=document.createElement('li');li.textContent=textName(id);const thumb=document.createElement('span');thumb.className='history-art';thumb.append(art(figure(id)));const label=document.createElement('span');label.textContent=textName(id);li.replaceChildren(thumb,label);$('history').prepend(li);}
  historyIds=[...state.cantadas];$('history').start=state.cantadas.length;$('historyEmpty').hidden=state.cantadas.length>0;
}
function render(){
  document.body.classList.toggle('playing',state.estado==='EN_CURSO');$('waitingNotice').hidden=state.estado!=='BORRADOR';$('gameTitle').textContent=state.nombre||'Lotería tradicional';const phrase=formatClaim(state.presentacion?.anuncioGanador);$('claimLabel').textContent=phrase;$('claim').setAttribute('aria-label',phrase+' Presentar cartón');$('claim').title=phrase+' Presentar cartón';const total=state.figuras.length,count=state.cantadas.length;$('deckProgress').max=total;$('deckProgress').value=count;$('deckRemaining').textContent=(total-count)+' restantes';$('deckProgress').setAttribute('aria-label',count+' de '+total+' figuras cantadas');$('markHint').textContent=state.presentacion?.resaltarCantadas?'El responsable permite resaltar las figuras cantadas. Tú marcas tu cartón.':'Escucha el canto y marca tu cartón. Las figuras cantadas no se resaltan.';
  $('gamePrize').textContent=state.premio?'Premio: '+state.premio:'Sin premio anunciado';$('gameCanto').textContent=state.canto?(state.canto.modo==='AUTOMATICO'?'Canto automático':'Canto manual')+(state.canto.pausado?' · En pausa':''):'';
  $('stateLabel').textContent=state.estado==='EN_CURSO'&&state.cantadas.length===state.figuras.length?'Canto terminado · presenta tu cartón':{BORRADOR:'En espera',EN_CURSO:'En curso',FINALIZADA:'Finalizada',CANCELADA:'Cancelada'}[state.estado];
  $('calledCount').textContent=state.cantadas.length+' cantadas';
  renderLastFigure();renderHistory();
  $('next').disabled=mode!=='demo'||deck.length===0;
  renderBoard();syncAudio();renderResult();
}
function enter(){ document.body.classList.add('in-room');$('lobby').hidden=true;$('welcome').hidden=true;$('room').hidden=false;render();$('room').scrollIntoView({block:'start'}); }
function stop(){generation++;clearTimeout(timer);controller?.abort();controller=null;}
function clearRoom(){document.body.classList.remove('playing','in-room');stop();pregonero.reset();effects.reset();endStamp='';presenting=false;ticket='';state=null;marks.clear();deck=[];mode='';stale=false;document.querySelectorAll('dialog[open]').forEach(d=>d.close());boardView.reset();lastFigureStamp='';historyIds=[];$('history').replaceChildren();$('resultNames').replaceChildren();$('room').hidden=true;$('welcome').hidden=false;message();$('demo').focus();}
$('demo').onclick=()=>{pregonero.reset();effects.reset();endStamp='';stopLobby();$('lobby').hidden=true;stop();ticket='';mode='demo';stale=false;marks=new Set();state={id:'demostracion',estado:'EN_CURSO',figuras:DEMO_FIGURES,carton:makeCard(DEMO_FIGURES),cantadas:[],presentacion:{resaltarCantadas:false,audioJugadores:true,anuncioGanador:'Lotería'}};deck=shuffle(DEMO_FIGURES.map(f=>f.id));setPlayerIdentity({id:'demo',nombre:'Visitante de demostración'},{nombre:'Sin conexión a una empresa'});$('roomMode').textContent='DEMOSTRACIÓN · SIN PREMIOS';$('sync').textContent='Prueba local';$('demoTools').hidden=false;message('Esta demostración no crea partidas ni ganadores reales.');enter();};
$('next').onclick=()=>{if(mode!=='demo'||!deck.length)return;state.cantadas.push(deck.shift());render();if(!deck.length)message('Terminó el canto. Puedes presentar tu cartón completo.');};
function renderResult(){
  const winners=state.ganadores||[];if(state.estado!=='FINALIZADA'||!winners.length)return;
  $('resultClaim').hidden=$('claim').disabled;const stamp=state.id+':'+winners.map(w=>w.usuario).join(',');if(stamp===endStamp)return;endStamp=stamp;
  $('resultTitle').textContent=winners.length>1?'¡Tenemos ganadores!':'¡Tenemos ganador!';
  $('resultNames').replaceChildren(...winners.map(w=>{const row=document.createElement('div');row.className='winner-person';const avatar=document.createElement('span');avatar.className='player-avatar';avatar.textContent=(w.nombre||'J')[0];const url=imageUrl(w.avatar);if(url){const img=document.createElement('img');img.src=url;img.alt='';avatar.append(img);}const name=document.createElement('strong');name.textContent=w.nombre;row.append(avatar,name);return row;}));
  $('resultPrize').textContent=state.premio?'Premio: '+state.premio:'Cartón completo validado por el sistema.';
  $('resultClaim').hidden=$('claim').disabled;openDialog('resultDialog');
}
async function present(){
  if($('claim').disabled||presenting)return;presenting=true;updateProgress();effects.unlock();
  const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),20000),run=generation;
  try{
    if(mode==='demo'){state={...state,estado:'FINALIZADA',cierre:{motivo:'GANADOR_DIGITAL',fecha:new Date().toISOString()},ganadores:[{usuario:'demo',nombre:'Visitante de demostración',avatar:''}]};}
    else {const incoming=normalizeState(await presentCard(state.id,ticket,abort.signal));if(run!==generation)return;state=incoming;}
    stale=false;message();render();
  }catch(e){if(run===generation)message(e.message||'No se pudo presentar. Intenta de nuevo.',true);}
  finally{clearTimeout(timeout);presenting=false;if(state)updateProgress();}
}
$('claim').onclick=present;$('resultClaim').onclick=()=>{$('resultDialog').close();present();};
$('leave').onclick=()=>{$('leaveText').textContent=mode==='live'?'La inscripción se conserva. Podrás recuperar el mismo cartón; tendrás que volver a marcar las figuras.':'Se borrará esta demostración y sus marcas.';openDialog('leaveDialog');};$('confirmLeave').onclick=async()=>{if(mode==='live'){const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),4000);try{await exitGame(state.id,abort.signal);}catch{}finally{clearTimeout(timeout);}}const wasLive=mode==='live';clearRoom();if(wasLive)loadLobby();};
// El token identifica al miembro únicamente ante SYS. Ningún parámetro de URL concede acceso.
async function poll(id,runId){
  controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),12000);
  try {
    const presenceDue=Date.now()-lastPresence>20000;
    const incoming=normalizeState(await getState(id,ticket,controller.signal,presenceDue));if(presenceDue)lastPresence=Date.now();if(runId!==generation)return;
    if(incoming.id!==id || incoming.carton.some((key,i)=>key!==state.carton[i]))throw new Error('El cartón cambió. Consulta al responsable antes de continuar.');
    if(presenting||state.cierre&&incoming.cierre?.fecha!==state.cierre.fecha)return;state=incoming;stale=false;marks=new Set([...marks].filter(k=>state.carton.includes(k)));$('sync').textContent='Actualizado';message();render();
  } catch(error){if(runId!==generation)return;if(error.code==='LOT_RETIRO'){clearRoom();await loadLobby();message(error.message,true);return;}stale=true;$('sync').textContent='Sin actualizar';message(error.message||'No se pudo actualizar. Tus marcas siguen en esta pestaña.',true);renderBoard();syncAudio();}
  finally{clearTimeout(timeout);if(runId===generation && (['BORRADOR','EN_CURSO'].includes(state?.estado)||state?.cierre&&Date.now()-new Date(state.cierre.fecha).getTime()<35000))timer=setTimeout(()=>poll(id,runId),1500);}
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
    stop();pregonero.reset();effects.reset();endStamp='';lastPresence=Date.now();ticket=entered.comprobante;mode='live';state=incoming;stale=false;marks=new Set();setPlayerIdentity(context.usuario,context.eo);$('roomMode').textContent=incoming.nombre||'PARTIDA · '+id;$('sync').textContent='Actualizado';$('demoTools').hidden=true;message(entered.recuperada?'Recuperaste tu mismo cartón. Marca nuevamente las figuras que ya fueron cantadas.':'Inscripción confirmada. Tu cartón está listo.');enter();if(['BORRADOR','EN_CURSO'].includes(state.estado))timer=setTimeout(()=>poll(id,generation),1500);
  }catch(error){if(error.auth)login(id);else message(error.message||'No se pudo entrar a la partida.',true);}
  finally{clearTimeout(timeout);$('join').disabled=false;}
}
$('join').onclick=join;$('gameId').onkeydown=e=>{if(e.key==='Enter')join();};
window.addEventListener('beforeunload',e=>{if(state){e.preventDefault();e.returnValue='';}});
window.addEventListener('pagehide',()=>{stop();pregonero.suspend();effects.suspend();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){pregonero.suspend();effects.suspend();}else if(state){if(mode==='live')stale=true;syncAudio();}});
window.addEventListener('pageshow',e=>{if(e.persisted&&state&&mode==='live'){stale=true;renderBoard();syncAudio();poll(state.id,generation);}});
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
    const joined=document.createElement('p');joined.className='muted';joined.textContent=g.retirado?'El administrador te retiró de esta partida.':g.inscrita?'Ya estás inscrito':g.estado==='EN_CURSO'?'La inscripción ya cerró.':g.estado==='CERRADA'?'Esta partida terminó.':'Inscríbete antes del inicio.';
    const button=document.createElement('button');button.className='primary';button.textContent=g.retirado?'Retirado de la partida':g.puedeEntrar?(g.estado==='EN_CURSO'?'Volver a mi cartón':'Ver mi cartón'):g.puedeInscribirse?'Inscribirme':g.estado==='CERRADA'?'Partida cerrada':'Inscripción cerrada';button.disabled=!g.puedeEntrar&&!g.puedeInscribirse;button.onclick=()=>join(g.id);
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

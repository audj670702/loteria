import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
import {cantadas,vistaPartida} from '../wix/lotFlow.js';
import {isSystemFull,isOneAway} from '../js/game.js';
import {createEffects} from '../js/effects.js';
function harness(){
 const pool=Array.from({length:20},(_,i)=>'f'+i),user={_id:'u1',nombre:'Jugadora',avatar:'https://example.org/avatar.png'},game={_id:'game-12345678901',enteOperador:'eo1',inicio:new Date(Date.now()-120000),estado:'EN_CURSO',reglas:{figuras:pool,premio:'Premio',canto:{modo:'MANUAL'}},figurasCantadas:pool.slice(0,16)};
 const rows={LOT_Ganadores:[],LOT_Partidas:[game]};let writes=0;
 const wixData={query(col){const fs=[];const q={eq(k,v){fs.push(x=>x[k]===v);return q;},limit(){return q;},async find(){return {items:structuredClone((rows[col]||[]).filter(x=>fs.every(f=>f(x)))),hasNext:()=>false};}};return q;},async insert(col,item){if(rows[col].some(x=>x._id===item._id))throw Error('duplicate');rows[col].push(structuredClone(item));writes++;return structuredClone(item);},async update(col,item){rows[col][rows[col].findIndex(x=>x._id===item._id)]=structuredClone(item);return structuredClone(item);}};
 const source=fs.readFileSync(new URL('../wix/lotSala.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'')+'\nglobalThis.register=registerDigitalWinner;globalThis.resolve=resolveDigitalResult;';const ctx={wixData,cantadas,vistaPartida,Date,console,Buffer};vm.runInNewContext(source,ctx);return {game,user,pool,rows,register:ctx.register,resolve:ctx.resolve,writes:()=>writes};
}
test('presentar valida en servidor, congela canto, registra identidad y cierra sin acción ADM',async()=>{const h=harness();const r=await h.register(h.game,h.user,h.pool.slice(0,16));assert.equal(r.game.estado,'FINALIZADA');assert.equal(r.game.reglas.canto.pausado,true);assert.equal(r.game.reglas.cierre.motivo,'GANADOR_DIGITAL');assert.equal(r.winners.length,1);assert.equal(r.winners[0].cartonGanador.nombre,'Jugadora');assert.equal(r.winners[0].cartonGanador.validacion,'SISTEMA');assert.equal(r.winners[0].premio,'Premio');assert.equal(r.winners[0].validadoPor,undefined);});
test('cartón incompleto, duplicado o ajeno no pausa ni crea registros',async()=>{for(const card of [Array.from({length:16},()=> 'f0'),Array.from({length:16},(_,i)=>'f'+(i+1)),Array.from({length:16},(_,i)=>'x'+i)]){const h=harness();await assert.rejects(h.register(h.game,h.user,card));assert.equal(h.writes(),0);assert.equal(h.rows.LOT_Partidas[0].estado,'EN_CURSO');}});
test('doble clic y solicitudes simultáneas son idempotentes; admite empate del mismo turno',async()=>{const h=harness(),card=h.pool.slice(0,16);await Promise.all([h.register(h.game,h.user,card),h.register(h.game,h.user,card),h.register(h.game,{_id:'u2',nombre:'Otra'},card)]);assert.equal(h.rows.LOT_Ganadores.length,2);assert.equal(h.rows.LOT_Ganadores.filter(w=>w.usuario==='u1').length,1);assert.equal(h.rows.LOT_Partidas[0].estado,'FINALIZADA');});
test('un cierre existente no acepta una figura posterior ni se reanuda con una escritura atrasada',async()=>{const h=harness();await h.register(h.game,h.user,h.pool.slice(0,16));await assert.rejects(h.register(h.game,{_id:'u2'},h.pool.slice(1,17)));h.rows.LOT_Partidas[0]=structuredClone(h.game);const r=await h.resolve(h.rows.LOT_Partidas[0]);assert.equal(r.game.estado,'FINALIZADA');assert.deepEqual([...r.game.figurasCantadas],h.pool.slice(0,16));});
test('botón y última carta se basan en canto real, incluso con cero marcas o marcas erróneas',()=>{const card=Array.from({length:16},(_,i)=>'f'+i);assert.equal(isOneAway(card,card.slice(0,15)),true);assert.equal(isSystemFull(card,card.slice(0,15)),false);assert.equal(isSystemFull(card,card),true);assert.equal(isOneAway(card,card),false);});
function effectsHarness(){const files={};const e=createEffects({makeAudio:src=>{const a={src,paused:true,plays:0,currentTime:0,play(){this.paused=false;this.plays++;return Promise.resolve();},pause(){this.paused=true;}};files[src]=a;return a;}});return {e,files};}
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
test('última carta suena una vez: no loop ni repetición al sincronizar, silenciar o volver',async()=>{
 const {e,files}=effectsHarness();assert.equal(files['./assets/tap.mp3'],undefined);e.unlock();await settle();
 const card=Array.from({length:16},(_,i)=>'f'+i),state={id:'g',estado:'EN_CURSO',carton:card,figuras:Array.from({length:54},(_,i)=>'f'+i),cantadas:card.slice(0,15)};
 const near=files['./assets/carta_final.mp3'],baseline=near.plays;e.sync(state);assert.equal(near.loop,false);assert.equal(near.plays,baseline+1);
 near.paused=true;for(let i=0;i<5;i++)e.sync(state);e.setEnabled(false);e.setEnabled(true);e.sync(state,{hidden:true});e.sync(state);assert.equal(near.plays,baseline+1);
 e.sync({...state,cantadas:card});assert.equal(near.paused,true);
 e.sync({...state,id:'otra'});assert.equal(near.plays,baseline+2);
});
test('cartón lleno y 54 cantadas no disparan fin; sólo presentación ganadora confirmada',async()=>{
 const {e,files}=effectsHarness();e.unlock();await settle();const card=Array.from({length:16},(_,i)=>'f'+i),pool=Array.from({length:54},(_,i)=>'f'+i),state={id:'g',estado:'EN_CURSO',carton:card,figuras:pool,cantadas:card};
 const end=files['./assets/partida_terminada.mp3'],baseline=end.plays;
 e.sync(state);e.sync({...state,cantadas:pool});assert.equal(end.plays,baseline);
 e.sync({...state,estado:'FINALIZADA'});assert.equal(end.plays,baseline);
 e.sync({...state,estado:'FINALIZADA',cierre:{motivo:'GANADOR_DIGITAL'},ganadores:[]});assert.equal(end.plays,baseline);
 const confirmed={...state,estado:'FINALIZADA',cierre:{motivo:'GANADOR_DIGITAL'},ganadores:[{usuario:'u1'}]};e.sync(confirmed);assert.equal(end.plays,baseline+1);e.sync(confirmed);assert.equal(end.plays,baseline+1);
});
test('silencio, pausa, desconexión y política ADM impiden iniciar el aviso',async()=>{
 const card=Array.from({length:16},(_,i)=>'f'+i),state={id:'g',estado:'EN_CURSO',carton:card,figuras:card,cantadas:card.slice(0,15)};
 for(const opts of [{allowed:false},{outdated:true},{hidden:true}]){const {e,files}=effectsHarness();e.unlock();await settle();const near=files['./assets/carta_final.mp3'],baseline=near.plays;e.sync(state,opts);assert.equal(near.plays,baseline);e.sync(state);assert.equal(near.plays,baseline+1);}
 const {e,files}=effectsHarness();e.unlock();await settle();const baseline=files['./assets/carta_final.mp3'].plays;e.sync({...state,canto:{pausado:true}});e.setEnabled(false);e.sync(state);assert.equal(files['./assets/carta_final.mp3'].plays,baseline);
});
test('entrada digital exige identidad, EO, inscripción previa y firma antes de registrar',async()=>{
 const card=Array.from({length:16},(_,i)=>'f'+i),base={_id:'game-12345678901',enteOperador:'eo1',inicio:new Date(Date.now()-100000),estado:'EN_CURSO',catalogo:'cat1',reglas:{modalidad:'CARTON_LLENO',filas:4,columnas:4,figuras:card,canto:{modo:'MANUAL'}},figurasCantadas:card};
 async function run({token='valid',eo='eo1',enrolled=true,ticket='signed'}={}){
  let inserts=0;const winners=[];const rows={SCaD_USR:[{_id:'u1',memberId:'m1',app:'LOT',activo:true,enteOperador:'EO1',nombre:'Yo'}],SCaD_EO:[{_id:'eo1',app:'LOT',activo:true,codigoContexto:'EO1'}],LOT_Figuras:card.map((id,i)=>({_id:id,catalogo:'cat1',numero:i+1,nombre:id})),LOT_Ganadores:winners};
  const query=col=>{const fs=[];const q={eq(k,v){fs.push(x=>x[k]===v);return q;},limit(){return q;},async find(){return {items:rows[col].filter(x=>fs.every(f=>f(x))),hasNext:()=>false};}};return q;};
  const ctx={wixData:{query,get:async()=>({...structuredClone(base),enteOperador:eo}),insert:async(col,item)=>{inserts++;winners.push(item);return item;},update:async(col,item)=>item},cantadas,vistaPartida,nexusAuth:async req=>req.headers.authorization==='valid'?{ok:true,memberId:'m1',eo:'EO1'}:{ok:false,response:{status:401}},response:r=>r,getSecret:async()=> 'x'.repeat(32),comprobarParticipacion:async()=>enrolled?{fechaInscripcion:new Date(Date.now()-200000)}:null,verifyCard:(secret,t)=>{if(t!=='signed')throw Error('signature');return card;},console,Date,Buffer};
  const source=fs.readFileSync(new URL('../wix/lotSala.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'')+'\nglobalThis.entry=lotEntry;';vm.runInNewContext(source,ctx);const r=await ctx.entry({headers:{authorization:token,origin:'https://loteria.scad.mx','x-lot-carton':ticket},body:{json:async()=>({partida:base._id,accion:'presentar'})}});return {r,inserts};
 }
 for(const options of [{token:'invalid'},{eo:'other'},{enrolled:false},{ticket:'forged'}]){const {r,inserts}=await run(options);assert.ok([401,403].includes(r.status));assert.equal(inserts,0);}
 const {r,inserts}=await run();assert.equal(r.status,200);assert.equal(inserts,1);assert.equal(JSON.parse(r.body).data.estado,'FINALIZADA');
});

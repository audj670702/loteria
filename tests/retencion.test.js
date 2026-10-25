import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
import {cantadas,vistaPartida} from '../wix/lotFlow.js';

const DIA=86400000,now=Date.now();
function fakeData(rows){
  const val=(x,k)=>k.split('.').reduce((o,p)=>o?.[p],x);
  const t=v=>v instanceof Date?v.getTime():typeof v==='string'&&/^\d{4}-/.test(v)?Date.parse(v):v;
  const removed=[],updates=[];
  return {removed,updates,rows,
    query(col){const fs=[];let lim=1000;const q={eq(k,v){fs.push(x=>val(x,k)===v);return q;},hasSome(k,vs){fs.push(x=>vs.includes(val(x,k)));return q;},isEmpty(k){fs.push(x=>val(x,k)==null||val(x,k)==='');return q;},lt(k,v){fs.push(x=>val(x,k)!=null&&t(val(x,k))<t(v));return q;},ascending(){return q;},limit(n){lim=n;return q;},async find(){const items=structuredClone((rows[col]||[]).filter(x=>fs.every(f=>f(x)))).slice(0,lim);return {items,hasNext:()=>false};}};return q;},
    async update(col,item){const i=rows[col].findIndex(x=>x._id===item._id);rows[col][i]=structuredClone(item);updates.push([col,item._id]);return structuredClone(item);},
    async bulkRemove(col,ids){removed.push([col,...ids]);rows[col]=rows[col].filter(x=>!ids.includes(x._id));return {errors:[]};}
  };
}
function load(rows,{vencidas=[]}={}){
  const wixData=fakeData(rows),desactivadas=[];
  const ctx={wixData,console:{log(){},error(){}},Date,JSON,
    comercial:()=>({eosVencidas:async d=>{assert.equal(d,30);return vencidas;},desactivarEO:async eo=>{desactivadas.push(eo._id);}}),CFG_COMERCIAL:{},
    resolveDigitalResult:async g=>({game:{...g,reglas:{...g.reglas,cierre:{motivo:'GANADOR_DIGITAL',fecha:'2026-10-25T18:00:00Z',turno:20}}},winners:[]})};
  const src=fs.readFileSync(new URL('../wix/lotRetencion.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'')+'\nglobalThis.api={lotCompactarCerradas,lotRetencionDiaria,partidaCompacta,ganadorCompacto};';
  vm.runInNewContext(src,ctx);return {...ctx.api,wixData,desactivadas};
}
const pool=Array.from({length:54},(_,i)=>'cat1-'+(i+1));
const carton={filas:4,columnas:4,figuras:pool.slice(0,16),posicionesGanadoras:[],nombre:'Ana Ruiz',avatar:'x',cierre:{fecha:'2026-10-25T18:00:00Z',cantadas:pool.slice(0,20),turnoGanador:20}};
function partida(o={}){return {_id:'g1',enteOperador:'eo1',catalogo:'cat1',estado:'FINALIZADA',_createdDate:new Date(now-DIA),_updatedDate:new Date(now-20*60000),reglas:{nombre:'Kermés',premio:'Pastel',figuras:pool,canto:{modo:'AUTOMATICO',intervalo:8,orden:pool}},figurasCantadas:pool.slice(0,20),...o};}

test('resumen: la partida cerrada pierde baraja, orden y cantadas; el ganador conserva identidad, fecha y premio sin cartón',async()=>{
  const rows={LOT_Partidas:[partida(),partida({_id:'g2',estado:'CANCELADA',figurasCantadas:pool.slice(0,3)}),partida({_id:'g3',_updatedDate:new Date(now-60000)}),partida({_id:'g4',estado:'EN_CURSO'})],
    LOT_Ganadores:[{_id:'g1-cierre-digital',partida:'g1',usuario:'u1',folio:'GAN-DIGITAL',premio:'Pastel',fechaValidacion:new Date(now-DIA),cartonGanador:carton}]};
  const r=load(rows);const out=await r.lotCompactarCerradas();
  assert.deepEqual({...out},{partidas:2,ganadores:1});
  const g1=rows.LOT_Partidas.find(g=>g._id==='g1');
  assert.ok(g1.fechaCompactacion);assert.equal(g1.reglas.figuras,undefined);assert.equal(g1.reglas.canto.orden,undefined);
  assert.deepEqual([...g1.figurasCantadas],[]);assert.equal(g1.reglas.cantadasTotal,20);assert.equal(g1.reglas.figurasTotal,54);
  assert.equal(g1.reglas.cierre.motivo,'GANADOR_DIGITAL','el resultado queda fijado antes de resumir');
  assert.equal(g1.reglas.premio,'Pastel');assert.equal(g1.reglas.nombre,'Kermés');
  const w=rows.LOT_Ganadores[0];assert.equal(w.cartonGanador,undefined);assert.equal(w.jugador,'Ana Ruiz');assert.equal(w.premio,'Pastel');assert.ok(w.fechaValidacion);assert.equal(w.usuario,'u1');
  assert.equal(rows.LOT_Partidas.find(g=>g._id==='g2').reglas.cantadasTotal,3,'cancelada: resumen');
  assert.equal(rows.LOT_Partidas.find(g=>g._id==='g3').fechaCompactacion,undefined,'cerrada hace menos de 10 minutos');
  assert.ok(rows.LOT_Partidas.find(g=>g._id==='g4').reglas.figuras,'en curso no se toca');
  assert.equal(vistaPartida(g1).figurasCantadas.length,0);assert.deepEqual(cantadas(g1),[]);
  assert.deepEqual({...await r.lotCompactarCerradas()},{partidas:0,ganadores:0},'no repite');
});

test('historial: se borran partidas y ganadores de más de un año; lo reciente y lo en curso se conservan',async()=>{
  const viejo=new Date(now-366*DIA);
  const rows={LOT_Partidas:[partida({_id:'vieja',_createdDate:viejo}),partida({_id:'curso-vieja',_createdDate:viejo,estado:'EN_CURSO'}),partida({_id:'reciente'})],
    LOT_Ganadores:[{_id:'w1',partida:'vieja',fechaValidacion:viejo},{_id:'w2',partida:'reciente',fechaValidacion:new Date(now-DIA)},{_id:'w3',partida:'huerfana',fechaValidacion:viejo}],LOT_Presencias:[],LOT_Catalogos:[],LOT_Figuras:[]};
  const r=load(rows);const out=await r.lotRetencionDiaria();
  assert.deepEqual(rows.LOT_Partidas.map(g=>g._id).sort(),['curso-vieja','reciente']);
  assert.deepEqual(rows.LOT_Ganadores.map(w=>w._id),['w2']);
  assert.equal(out.historial.partidas,1);assert.equal(out.historial.ganadores,2);assert.equal(r.desactivadas.length,0);
});

test('plan vencido 30 días: se borran partidas, ganadores, inscripciones y barajas propias; la EO se desactiva; lo compartido y otras EO quedan',async()=>{
  const rows={LOT_Partidas:[partida(),partida({_id:'otra',enteOperador:'eo2'})],LOT_Ganadores:[{_id:'w1',partida:'g1',fechaValidacion:new Date()},{_id:'w2',partida:'otra',fechaValidacion:new Date()}],
    LOT_Presencias:[{_id:'p1',partida:'g9',enteOperador:'eo1'},{_id:'p2',partida:'otra',enteOperador:'eo2'}],
    LOT_Catalogos:[{_id:'cat1',enteOperador:'eo1'},{_id:'trad',enteOperador:'eo1',compartido:true},{_id:'cat2',enteOperador:'eo2'}],
    LOT_Figuras:[{_id:'cat1-1',catalogo:'cat1'},{_id:'trad-1',catalogo:'trad'},{_id:'cat2-1',catalogo:'cat2'}]};
  const r=load(rows,{vencidas:[{_id:'eo1',codigoContexto:'EO008-LOT-SALON'}]});const out=await r.lotRetencionDiaria();
  assert.deepEqual(rows.LOT_Partidas.map(x=>x._id),['otra']);assert.deepEqual(rows.LOT_Ganadores.map(x=>x._id),['w2']);
  assert.deepEqual(rows.LOT_Presencias.map(x=>x._id),['p2']);assert.deepEqual(rows.LOT_Catalogos.map(x=>x._id),['trad','cat2']);
  assert.deepEqual(rows.LOT_Figuras.map(x=>x._id),['trad-1','cat2-1']);
  assert.deepEqual(r.desactivadas,['eo1']);assert.equal(out.entes[0].barajas,1);assert.equal(out.entes[0].figuras,1);
});

test('sala: una partida resumida responde "terminó" y su resultado se lee sin cartón',async()=>{
  const g=partida({fechaCompactacion:new Date(),reglas:{modalidad:'CARTON_LLENO',filas:4,columnas:4,premio:'Pastel',cierre:{motivo:'GANADOR_DIGITAL'}},figurasCantadas:[]});
  const rows={LOT_Ganadores:[{_id:'g1-cierre-digital',partida:'g1',usuario:'u1',jugador:'Ana Ruiz',premio:'Pastel',fechaValidacion:new Date()}]};
  const wixData={query(col){const fs=[];const q={eq(k,v){fs.push(x=>x[k]===v);return q;},limit(){return q;},async find(){return {items:rows[col].filter(x=>fs.every(f=>f(x))),hasNext:()=>false};}};return q;},get:async()=>structuredClone(g),update:async()=>{throw Error('no debe escribir');}};
  const src=fs.readFileSync(new URL('../wix/lotSala.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'')+'\nglobalThis.api={gameFor,resolveDigitalResult};';
  const ctx={comercial:()=>({vigenciaEO:async()=>true}),CFG_COMERCIAL:{},wixData,cantadas,vistaPartida,Date,console,Buffer};vm.runInNewContext(src,ctx);
  await assert.rejects(ctx.api.gameFor('g1-12345678901234',{eo:{_id:'eo1'}}),e=>e.status===410&&/terminó/.test(e.message));
  const r=await ctx.api.resolveDigitalResult(g);assert.equal(r.winners[0].jugador,'Ana Ruiz');assert.equal(r.game.estado,'FINALIZADA');
});

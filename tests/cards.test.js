import test from 'node:test';
import assert from 'node:assert/strict';
import {issueCard,verifyCard,deterministicCard} from '../wix/lotCards.js';
const secret='test-secret-for-cards-only-not-used-in-production';
const game={_id:'game-1234567890123456',enteOperador:'eo1',estado:'BORRADOR',reglas:{figuras:Array.from({length:54},(_,i)=>'f'+i)}};
const user={_id:'u1'};
test('mismo usuario recibe siempre el mismo cartón sin conservarlo en CMS',()=>{const a=issueCard(secret,game,user,1000);const b=issueCard(secret,game,user,2000);assert.deepEqual(a.carton,b.carton);assert.equal(new Set(a.carton).size,16);assert.deepEqual(verifyCard(secret,a.comprobante,game,user,3000),a.carton);assert.notDeepEqual(deterministicCard(secret,game,{_id:'u2'}),a.carton);});
test('firma, persona, EO y partida manipuladas se rechazan',()=>{const a=issueCard(secret,game,user,1000);for(const [g,u] of [[game,{_id:'u2'}],[{...game,enteOperador:'eo2'},user],[{...game,_id:'otra'},user]])assert.throws(()=>verifyCard(secret,a.comprobante,g,u,2000));assert.throws(()=>verifyCard(secret,a.comprobante+'x',game,user,2000));assert.throws(()=>verifyCard('otro-secreto',a.comprobante,game,user,2000));});
test('solo emite antes de iniciar y verifica fecha de inicio, caducidad y pool',()=>{const a=issueCard(secret,game,user,1000);assert.throws(()=>issueCard(secret,{...game,estado:'EN_CURSO'},user));assert.throws(()=>verifyCard(secret,a.comprobante,{...game,inicio:new Date(500)},user,2000));assert.throws(()=>verifyCard(secret,a.comprobante,game,user,8*86400000));assert.throws(()=>verifyCard(secret,a.comprobante,{...game,reglas:{figuras:game.reglas.figuras.slice(1)}},user,2000));});

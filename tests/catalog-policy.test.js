import test from 'node:test';
import assert from 'node:assert/strict';
import {canReadCatalog,canEditCatalog,mergeCatalogs} from '../wix/catalog-policy.js';
test('EO ajena puede leer predeterminada, pero nadie puede editarla desde LOT',()=>{const c={_id:'shared',nombre:'Tradicional',compartido:true,enteOperador:'eo1'};assert.equal(canReadCatalog(c,'eo2'),true);assert.equal(canEditCatalog(c,'eo2'),false);assert.equal(canEditCatalog(c,'eo1'),false);});
test('privadas quedan aisladas por EO y legado sin marca sigue siendo privado',()=>{for(const compartido of [undefined,false,'true']){const c={enteOperador:{_id:'eo1'},compartido};assert.equal(canReadCatalog(c,'eo2'),false);assert.equal(canEditCatalog(c,'eo2'),false);assert.equal(canReadCatalog(c,'eo1'),true);assert.equal(canEditCatalog(c,'eo1'),true);}assert.equal(canReadCatalog(null,'eo1'),false);});
test('listado une barajas sin duplicar una compartida propiedad de la misma EO',()=>{const c={_id:'s',nombre:'Tradicional',compartido:true};const p={_id:'p',nombre:'Personalizada'};const result=mergeCatalogs([c,p],[c]);assert.equal(result.length,2);assert.deepEqual(result.map(x=>x._id),['p','s']);});

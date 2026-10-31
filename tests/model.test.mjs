import test from 'node:test';
import assert from 'node:assert/strict';
import {demoRoutes,routeEvidence,escapeHtml,compactCoordinate,validateLocalReport,normalizeCategory, safeStoredJson} from '../web/model.mjs';
test('all demo routes are explicitly demo, not real navigation',()=>{
  for(const r of demoRoutes('walk')){assert.equal(r.sourceType,'demo');assert.match(r.source,/Synthetic/);assert.ok(r.durationMin>0);assert.ok(r.distanceKm>0)}
});
test('walking versus driving examples differ',()=>{
  assert.ok(demoRoutes('walk')[0].durationMin>demoRoutes('drive')[0].durationMin)
});
test('no route is claimed verified safe',()=>{
  for(const r of demoRoutes())assert.equal(routeEvidence(r).verified,false);
  assert.equal(routeEvidence({sourceType:'live'}).verified,false);
});
test('content safely escaped',()=>{
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
test('coordinate inputs validated',()=>{
  assert.equal(compactCoordinate(28.634,77.211),'28.63400, 77.21100');
  assert.throws(()=>compactCoordinate(NaN,20));
  assert.throws(()=>compactCoordinate(200,20));
});
test('untrusted road reports require minimum text',()=>{
  assert.ok(validateLocalReport({type:'bad',location:'Road',description:'Broken light'}));
  assert.ok(validateLocalReport({type:'Streetlight not working',location:'A',description:'Broken light'}));
  assert.equal(validateLocalReport({type:'Streetlight not working',location:'Near crossing',description:'Light flickering at night'}),'');
});
test('clinic alias normalized',()=>assert.equal(normalizeCategory('clinic'),'hospital'));
test('corrupted saved data does not crash',()=>{
  const fake={getItem:()=>'{not-json'};
  assert.deepEqual(safeStoredJson(fake,'x',[]),[]);
});

import {routeSamples} from '../web/model.mjs';
test('route samples take start, midpoint and destination without duplicate coordinates',()=>{
  assert.deepEqual(routeSamples([[28,77],[28.1,77.1],[28.2,77.2],[28.3,77.3],[28.4,77.4]]),[[28,77],[28.2,77.2],[28.4,77.4]]);
  assert.deepEqual(routeSamples([[28,77]]),[]);
});

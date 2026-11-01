import test from 'node:test';
import assert from 'node:assert/strict';
import {lngLat,routeFeatures,mapStyle} from '../web/map-data.mjs';
const route={id:'r1',points:[[28.6,77.2],[28.61,77.21]]};
test('API coordinates are converted into map longitude/latitude order',()=>{
 assert.deepEqual(lngLat([28.6,77.2]),[77.2,28.6]);
 assert.deepEqual(routeFeatures([route],'live','r1').features[0].geometry.coordinates,[[77.2,28.6],[77.21,28.61]]);
});
test('fictional example routes are never drawn on a real map',()=>{
 assert.equal(routeFeatures([route],'demo','r1').features.length,0);
});
test('invalid geometry is omitted without joining across missing points',()=>{
 for(const bad of [[NaN,77],[91,77],[28,181],null])assert.equal(lngLat(bad),null);
 assert.equal(routeFeatures([{...route,points:[[28,77],[NaN,77],[29,78]]}],'live','r1').features.length,0);
});
test('default basemap works without a key; configured key cannot inject URL options',()=>{
 assert.equal(mapStyle().sources.osm.type,'raster');
 assert.match(mapStyle({maptilerKey:'a&extra=value'}),/key=a%26extra%3Dvalue$/);
});

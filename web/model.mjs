// Pure, framework-free domain helpers. Real route safety is never inferred.
export const STOPS = Object.freeze({
  cp: { name: 'Connaught Place', lat: 28.6315, lon: 77.2167 },
  indiaGate: { name: 'India Gate', lat: 28.6129, lon: 77.2295 },
  karol: { name: 'Karol Bagh', lat: 28.6512, lon: 77.1906 },
  ito: { name: 'ITO', lat: 28.6280, lon: 77.2410 },
});
export const DEMO_WARNING = 'Illustrative scenario only — routes, ETAs and road conditions are invented for a product demonstration. Never navigate using demo paths.';
export function demoRoutes(mode='walk') {
  const multiplier = mode === 'drive' ? .48 : 1;
  const plans = [
    { id:'demo-0', title:'Main corridor', durationMin:Math.round(32*multiplier), distanceKm:3.9, tag:'More described', description:'A fictional route with a recorded streetlight observation and listed help categories.', evidence:[{kind:'Lighting',status:'Example only',source:'Synthetic pilot scenario'}]},
    { id:'demo-1', title:'Direct shortcut', durationMin:Math.round(25*multiplier), distanceKm:3.0, tag:'Faster example', description:'A fictional shorter route, with no reliable observation data about lighting or activity.', evidence:[] },
    { id:'demo-2', title:'Service corridor', durationMin:Math.round(39*multiplier), distanceKm:4.5, tag:'More service types', description:'A fictional detour that illustrates how verified assistance listings could affect a journey.', evidence:[{kind:'Services',status:'Example only',source:'Synthetic pilot scenario'}] }
  ];
  return plans.map(r=>({...r,sourceType:'demo',source:'Synthetic product demonstration',warnings:['Activity counts unknown','No safety certification','Example-only road conditions']}));
}
export function routeEvidence(route){
  return { verified: false, unknown: ['Actual streetlight operation','Pedestrian presence','Gender activity','Emergency-service availability'], label: route?.sourceType === 'live' ? 'Live directions · conditions unverified' : 'Illustrative route · not for navigation' };
}
export function escapeHtml(s){return String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function mapStatus(status) { return status?.routingConfigured ? `Real street routing available: ${status.routingProvider || 'configured provider'}. Demo/public services may have rate limits.` : 'Routing unavailable; map and fictional examples only'; }
export function compactCoordinate(lat, lon){
  if (![lat,lon].every(x=>Number.isFinite(x))) throw new Error('Invalid coordinate');
  if (Math.abs(lat)>90 || Math.abs(lon)>180) throw new Error('Out of range');
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}
export function validateLocalReport(data){
  const allowed=['Streetlight not working','Road obstruction','Footpath condition','Business info incorrect'];
  if (!allowed.includes(data.type)) return 'Choose a valid observation type.';
  if (!data.location || data.location.trim().length < 4) return 'Add a location description (at least 4 characters).';
  if (data.location.length > 160) return 'Location description too long.';
  if (!data.description || data.description.trim().length < 8) return 'Explain what you observed (at least 8 characters).';
  if (data.description.length>500) return 'Observation too long.';
  return '';
}
export function safeStoredJson(storage, key, defaultValue){ try{const v=JSON.parse(storage.getItem(key)||'null');return v===null?defaultValue:v;}catch{return defaultValue;} }
export function normalizeCategory(c){
  if(c==='clinic')return 'hospital';
  if(c==='car_repair')return 'car_repair';
  return ['hospital','police','fuel','pharmacy'].includes(c)?c:'other';
}
export function displayCategory(c){return ({hospital:'Medical',police:'Police station',fuel:'Fuel',pharmacy:'Pharmacy',car_repair:'Vehicle repair',other:'Service'})[normalizeCategory(c)];}

// Select at most three representative points from route geometry for an explicit place lookup.
export function routeSamples(points){
  if(!Array.isArray(points)||points.length<2) return [];
  const indices=[0,Math.floor((points.length-1)/2),points.length-1];
  return [...new Set(indices)].map(i=>points[i]).filter(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite));
}

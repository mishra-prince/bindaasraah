import {STOPS, DEMO_WARNING, demoRoutes, routeEvidence, escapeHtml, mapStatus, compactCoordinate, validateLocalReport, safeStoredJson, normalizeCategory, displayCategory, routeSamples} from './model.mjs';

const $=id=>document.getElementById(id);
const REPORT_KEY='br_local_reports_v01';
const JOURNEY_KEY='br_local_journey_v01';
const PAGE_TITLES={explore:'A journey that feels more prepared',journey:'Your journey, your choice',assistance:'Know where to find help',reports:'Make every observation count',circle:'Better together, only by choice',privacy:'Privacy is the starting point'};
const state={page:'explore', mode:'walk', originKey:'cp', destKey:'indiaGate',customOrigin:null,customDest:null,routes:demoRoutes(), selectedRouteId:'demo-0', routeMode:'demo', places:[],placeMode:'none',filter:'all', status:{routingConfigured:false}, map:null, mapLayer:null,poiLayer:null,mapPick:'origin', trip:safeStoredJson(localStorage,JOURNEY_KEY,null), reports:safeStoredJson(localStorage,REPORT_KEY,[])};
let toastTimer=null;
let currentCoords=null; // ephemeral; never saved

function toast(msg){const node=$('toast'); node.textContent=msg;node.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),4200);}
function go(page){
  state.page=page;
  document.querySelectorAll('.page').forEach(el=>el.classList.toggle('active',el.id===`page-${page}`));
  document.querySelectorAll('[data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===page));
  $('pageHeading').innerHTML=`${escapeHtml(PAGE_TITLES[page])}<span>.</span>`;
  if(page==='assistance')renderPlaces();
  if(page==='journey')renderTrip();
  if(page==='reports')renderReports();
  window.scrollTo({top:0,behavior:'instant'});
}
function origin(){return state.originKey==='custom'?state.customOrigin:STOPS[state.originKey];}
function destination(){return state.destKey==='custom'?state.customDest:STOPS[state.destKey];}
function selectedRoute(){return state.routes.find(x=>x.id===state.selectedRouteId)||state.routes[0];}
function setMode(mode){state.mode=mode;document.querySelectorAll('.segment').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode)); findRoutes();}
function renderRoutes(){
  $('routeCount').textContent=`${state.routes.length} ${state.routes.length===1?'route':'routes'}`;
  $('routeCards').innerHTML=state.routes.map((r,i)=>{
    const active=r.id===state.selectedRouteId;
    const live=r.sourceType==='live';
    return `<article class="route-card ${active?'selected':''}" data-route="${escapeHtml(r.id)}" role="button" tabindex="0" aria-pressed="${active}" aria-label="Select ${escapeHtml(r.title)}"><div class="route-title"><h3>${String.fromCharCode(65+i)} · ${escapeHtml(r.title)}</h3><span class="tag ${live?'mint':'demo'}">${live?'REAL ROUTE':'DEMO ONLY'}</span></div><p class="route-desc">${live?'Calculated from a routing provider. Lighting, crowd activity and service readiness are not verified.':escapeHtml(r.description)}</p><div class="route-meta"><strong>${r.durationMin} min</strong><span>·</span><span>${r.distanceKm.toFixed(1)} km</span><span class="tag ${active?'mint':'warn'}">${active?'Selected':'View details'}</span><button class="route-action" data-route="${escapeHtml(r.id)}">Select ↗</button></div></article>`;
  }).join('');
  const r=selectedRoute();
  const re=routeEvidence(r);
  $('insightHeading').textContent=r?.sourceType==='live'?'A real route, with honest unknowns.':'Context matters more than a safety score.';
  $('insightBody').textContent=r?.sourceType==='live'?'These directions come from road-network data. Actual lighting, nearby people and emergency-service availability have not been verified. Compare travel time, then use independently confirmed information to decide.':'Example routes show how journey context may influence decisions. The distances, conditions, and descriptions here are fictional; the app cannot certify any route safe.';
  $('sourceStrip').textContent=`◷ Source: ${r?.source||'none'} · Lighting: unknown · People activity: unknown`;
  drawMap();
}
function setRoute(id){if(!state.routes.some(x=>x.id===id))return;state.selectedRouteId=id;clearLighting();renderRoutes();toast('Route selected. See its source and limitations.');}
function clearLighting(){$('lightingResult').textContent='Not queried for this route. Mapped tags never prove streetlights currently work.';}
async function loadStatus(){try {let response=await fetch('/api/status'); if(response.ok)state.status=await response.json();}catch{} $('routingNote').textContent=mapStatus(state.status);}
async function findRoutes(){
  state.originKey=$('originSelect').value;state.destKey=$('destinationSelect').value;
  const start=origin(),end=destination();
  if(!start||!end){toast('Select both a starting point and destination.');return;}
  if(Math.abs(start.lat-end.lat)<.00001&&Math.abs(start.lon-end.lon)<.00001){toast('Choose a different start and destination.');return;}
  const btn=$('findRoutesBtn');btn.disabled=true;btn.textContent='Finding your route…';
  try{
    if(!state.status.routingConfigured)throw new Error('demo');
    const params=new URLSearchParams({origin_lat:start.lat,origin_lon:start.lon,dest_lat:end.lat,dest_lon:end.lon,mode:state.mode});
    const res=await fetch(`/api/routes?${params}`);
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||'Provider unavailable');
    state.routes=data.routes;state.routeMode='live';state.selectedRouteId=data.routes[0].id;clearLighting();
    $('modeBadge').textContent='● Live directions';$('modeBadge').style.borderColor='#3c7a68';$('modeBadge').style.color='#a7f0cc';
    $('mapBadge').textContent='Real map + route · Conditions unknown';
    toast(`${data.routes.length} real route option(s) received. Road conditions are still unverified.`);
  }catch(e){
    state.routes=demoRoutes(state.mode);state.selectedRouteId='demo-0';state.routeMode='demo';clearLighting();
    $('modeBadge').textContent='● Demo data';$('mapBadge').textContent='Real map · Demo routes not drawn';
    if(e.message!=='demo')toast(`Routing provider unavailable: ${e.message}. Showing clearly labeled demo.`);
    drawMap();
  }finally {btn.disabled=false;btn.innerHTML='Explore route options <span>↗</span>';renderRoutes();}
}
function ensureMap(){
  if(state.map)return true;
  if(!window.L){$('mapBadge').textContent='Map library unavailable — check connection';return false;}
  $('map').style.display='block';$('mapFallback').style.display='none';
  state.map=L.map('map',{zoomControl:true,attributionControl:true}).setView([28.6304,77.2180],12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>',
    maxZoom:19,
  }).addTo(state.map);
  state.map.on('click',e=>{
    const point={name:'Selected map point',lat:e.latlng.lat,lon:e.latlng.lng};
    if(state.mapPick==='origin'){
      state.customOrigin=point;state.originKey='custom';$('originSelect').value='custom';
    }else{
      state.customDest=point;state.destKey='custom';$('destinationSelect').value='custom';
    }
    invalidateExistingRoutes();
    toast(`${state.mapPick==='origin'?'Starting point':'Destination'} chosen on map. Tap Explore route options.`);
  });
  setTimeout(()=>state.map?.invalidateSize(),80);
  return true;
}
function drawMap(){
  if(!ensureMap())return;
  if(state.mapLayer){state.map.removeLayer(state.mapLayer);state.mapLayer=null;}
  const palette=['#159c85','#dc9d52','#8691eb'],layers=[];
  if(state.routeMode==='live'){
    for(let i=0;i<state.routes.length;i++){
      const r=state.routes[i];if(!r.points||r.points.length<2)continue;
      const active=r.id===state.selectedRouteId;
      const line=L.polyline(r.points,{color:palette[i]||'#b6c4ca',weight:active?7:4,opacity:active?1:.58});
      line.on('click',()=>setRoute(r.id));layers.push(line);
    }
  }
  const start=origin(),end=destination();
  if(start){const pop=document.createElement('span');pop.textContent='Start: '+start.name;layers.push(L.circleMarker([start.lat,start.lon],{radius:10,color:'#0d2a31',weight:3,fillColor:'#20b59a',fillOpacity:1}).bindPopup(pop));}
  if(end){const pop=document.createElement('span');pop.textContent='Destination: '+end.name;layers.push(L.circleMarker([end.lat,end.lon],{radius:10,color:'#0d2a31',weight:3,fillColor:'#f5ac8f',fillOpacity:1}).bindPopup(pop));}
  state.mapLayer=L.layerGroup(layers).addTo(state.map);
  const active=selectedRoute();
  if(state.routeMode==='live'&&active?.points?.length>1){state.map.fitBounds(L.latLngBounds(active.points),{padding:[40,40],maxZoom:16});}
  else if(start&&end){state.map.fitBounds(L.latLngBounds([[start.lat,start.lon],[end.lat,end.lon]]),{padding:[55,55],maxZoom:14});}
  drawPlaceMarkers();
  setTimeout(()=>state.map?.invalidateSize(),80);
}
function drawPlaceMarkers(){
  if(!state.map || !window.L)return;
  if(state.poiLayer){state.map.removeLayer(state.poiLayer);state.poiLayer=null;}
  if(state.placeMode!=='live'||!state.places.length)return;
  state.poiLayer=L.layerGroup(state.places.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)).slice(0,45).map(p=>{
    const icon=L.circleMarker([p.lat,p.lon],{radius:5,color:'#142c40',weight:2,fillColor:'#f5d8a3',fillOpacity:1});
    // Leaflet popup uses DOM textContent, not untrusted HTML interpolation.
    const popup=document.createElement('div');
    const label=document.createElement('strong');label.textContent=p.name;
    const sub=document.createElement('p');sub.textContent=`${displayCategory(p.category)} · Hours: ${p.hours||'Unknown'} · Not verified open`;
    popup.append(label,sub);icon.bindPopup(popup);return icon;
  })).addTo(state.map);
}
function invalidateExistingRoutes(){
  state.routeMode='demo';state.routes=demoRoutes(state.mode);state.selectedRouteId='demo-0';clearLighting();
  $('modeBadge').textContent='● No calculated route';$('mapBadge').textContent='Real map · route not calculated';renderRoutes();
}
async function searchAddress(kind){
  const isStart=kind==='origin';
  const input=$(isStart?'originSearch':'destinationSearch');
  const slot=$(isStart?'originMatches':'destinationMatches');
  const term=input.value.trim();
  if(term.length<4){slot.textContent='Enter at least 4 characters.';return;}
  const btn=$(isStart?'originSearchBtn':'destinationSearchBtn');
  btn.disabled=true;btn.textContent='Searching…';slot.textContent='';
  try{
    const response=await fetch(`/api/geocode?q=${encodeURIComponent(term)}`);
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Search failed');
    if(!data.results.length){slot.textContent='No matching places found. Try a more specific address.';return;}
    for(const item of data.results){
      const button=document.createElement('button');button.type='button';
      button.textContent=item.name;
      button.addEventListener('click',()=>{
        const selected={name:item.name.split(',')[0],lat:item.lat,lon:item.lon};
        if(isStart){state.originKey='custom';state.customOrigin=selected;$('originSelect').value='custom';}
        else{state.destKey='custom';state.customDest=selected;$('destinationSelect').value='custom';}
        input.value=selected.name;slot.replaceChildren();invalidateExistingRoutes();
        toast('Place selected. Tap Explore route options for real directions.');
      });
      slot.appendChild(button);
    }
  }catch(e){slot.textContent=`Search unavailable: ${e.message}`;}
  finally{btn.disabled=false;btn.textContent='Search';}
}
async function getMyLocation({forSharing=false}={}){
  if(!navigator.geolocation){toast('This browser cannot access location.');return null;}
  return new Promise(resolve=>navigator.geolocation.getCurrentPosition(pos=>{
    const p={name:'My location',lat:pos.coords.latitude,lon:pos.coords.longitude,accuracy:pos.coords.accuracy};
    currentCoords=p;
    if(!forSharing){state.customOrigin=p;state.originKey='custom';$('originSelect').value='custom';invalidateExistingRoutes();toast('Current start position selected. No background tracking started.');}
    resolve(p);
  },()=>{toast('Location was unavailable or permission was declined.');resolve(null);},{enableHighAccuracy:false,timeout:10000,maximumAge:60000}));
}
const DEMO_PLACES=[
  {id:'example-a',category:'hospital',name:'Example hospital listing',hours:'Not checked',source:'Synthetic example; not a real provider listing'},
  {id:'example-b',category:'police',name:'Example police station',hours:'Not checked',source:'Synthetic example; not a real provider listing'},
  {id:'example-c',category:'fuel',name:'Example petrol station',hours:'Not checked',source:'Synthetic example; not a real provider listing'},
  {id:'example-d',category:'pharmacy',name:'Example pharmacy',hours:'Not checked',source:'Synthetic example; not a real provider listing'},
  {id:'example-e',category:'car_repair',name:'Example vehicle repair shop',hours:'Not checked',source:'Synthetic example; not a real provider listing'}
];
function renderPlaces(){
  const list=state.places.filter(p=>state.filter==='all'||normalizeCategory(p.category)===state.filter);
  $('placeCards').innerHTML=list.length?list.map(p=>{
    const live=state.placeMode==='live';
    const url=live&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)?`<a href="https://www.openstreetmap.org/?mlat=${encodeURIComponent(p.lat)}&mlon=${encodeURIComponent(p.lon)}#map=18/${encodeURIComponent(p.lat)}/${encodeURIComponent(p.lon)}" target="_blank" rel="noopener noreferrer">View listing location ↗</a>`:'';
    return `<article class="place-card"><span class="place-type">${escapeHtml(displayCategory(p.category))} · ${live?'OSM LISTED':'ILLUSTRATIVE'}</span><h3>${escapeHtml(p.name)}</h3><p>Opening hours: ${escapeHtml(p.hours||'Not verified')}<br>${escapeHtml(p.source)}</p>${url}</article>`;
  }).join(''):'<div class="panel" style="padding:22px;color:#b3c6d1;font-size:13px">No matching services are available. Do not assume none exist.</div>';
  $('placesStatus').textContent=state.placeMode==='none'?'No provider lookup performed yet.':state.placeMode==='live'?'Real OpenStreetMap listings — hours, staffing and readiness NOT confirmed.': 'Synthetic examples only. Not actual nearby services.';
  drawPlaceMarkers();
}
async function loadPlaces(){
  const start=origin();if(!start){toast('Select a start point first.');return;}
  const btn=$('loadPlacesBtn');btn.disabled=true;btn.textContent='Looking up listed places…';
  try{
    const query=new URLSearchParams({origin_lat:start.lat,origin_lon:start.lon});
    const res=await fetch(`/api/places?${query}`),data=await res.json();
    if(!res.ok)throw new Error(data.error||'Unavailable');
    state.places=data.places;state.placeMode='live';toast(`Received ${data.places.length} OSM listing(s). Their readiness is not verified.`);
  }catch(e){toast(`No live place data: ${e.message}`);state.places=[];state.placeMode='none';}
  finally{btn.disabled=false;btn.textContent='Search real nearby services ↗';renderPlaces();}
}
async function loadMappedLighting(){
  const route=selectedRoute();
  if(state.routeMode!=='live'||!route?.points?.length){toast('Calculate a real route before checking mapped lighting.');return;}
  const button=$('lightingBtn');button.disabled=true;button.textContent='Checking OSM tags…';
  try{
    const response=await fetch('/api/route-lighting',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({points:routeSamples(route.points)})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Unavailable');
    const tags=data.tagCounts||{};
    $('lightingResult').textContent=`${data.taggedWayCount||0} tagged road segment(s) near the sampled points: lit=yes ${tags.yes||0}; lit=no ${tags.no||0}; other lit values ${(tags.automatic||0)+(tags.limited||0)+(tags['24/7']||0)}. OSM mapping may be incomplete or outdated. This does NOT verify current streetlight operation or overall route safety.`;
  }catch(e){$('lightingResult').textContent=`Lighting observations unavailable: ${e.message}. Status remains unknown.`;}
  finally{button.disabled=false;button.textContent='Check mapped lighting tags ↗';}
}
async function loadRoutePlaces(){
  const route=selectedRoute();
  if(state.routeMode!=='live'||!route?.points?.length){toast('Calculate a real route first, then search services along it.');return;}
  const button=$('routePlacesBtn');button.disabled=true;button.textContent='Looking along route…';
  try{
    const response=await fetch('/api/route-places',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({points:routeSamples(route.points)})});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'Service unavailable');
    state.places=result.places;state.placeMode='live';renderPlaces();
    toast(`${result.places.length} real OSM listings found near points along this route. Verify opening hours.`);
  }catch(e){toast(`Route services unavailable: ${e.message}`);}
  finally{button.disabled=false;button.textContent='Find services along selected route ↗';}
}
function demoPlaces(){state.places=DEMO_PLACES;state.placeMode='demo';renderPlaces();toast('Showing fictional examples, NOT real nearby services.');}
function persistTrip(){if(state.trip)localStorage.setItem(JOURNEY_KEY,JSON.stringify(state.trip));else localStorage.removeItem(JOURNEY_KEY);}
function renderTrip(){
  const t=state.trip;
  $('tripStatus').textContent=!t?'Not started':t.endedAt?'Ended':'In progress';
  if(!t){$('tripClock').textContent='00:00';$('lastCheckin').textContent='—';}
  else{
    const secs=Math.max(0,Math.floor(((t.endedAt||Date.now())-t.startedAt)/1000));
    $('tripClock').textContent=`${String(Math.floor(secs/60)).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`;
    $('lastCheckin').textContent=t.lastCheckin?new Date(t.lastCheckin).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'Not yet';
  }
  const r=selectedRoute();$('tripRouteLabel').textContent=`${origin()?.name||'Selected origin'} → ${destination()?.name||'Destination'}`;
  $('tripRouteInfo').textContent=`${r?.title||'No route'} · ${r?.durationMin||'—'} min · ${r?.sourceType==='demo'?'DEMO route, not navigable.':'Live directions; safety conditions unknown.'}`;
  $('startTrip').disabled=Boolean(t&&!t.endedAt); $('checkInBtn').disabled=!t||Boolean(t.endedAt);$('endTripBtn').disabled=!t||Boolean(t.endedAt);
}
function startTrip(){const r=selectedRoute();state.trip={startedAt:Date.now(),endedAt:null,lastCheckin:null,routeTitle:r?.title||'Unspecified'};persistTrip();renderTrip();toast('Local journey timer started. No background monitoring or alerts.');}
function checkIn(){if(!state.trip||state.trip.endedAt)return;state.trip.lastCheckin=Date.now();persistTrip();renderTrip();toast('Check-in saved on this device. It was not sent to anyone.');}
function endTrip(){if(!state.trip||state.trip.endedAt)return;state.trip.endedAt=Date.now();persistTrip();renderTrip();toast('Journey ended. No more check-ins will be recorded.');}
async function shareTrip(){
  const base=`BindaasRaah trip update (sent by me): ${origin()?.name||'Origin'} → ${destination()?.name||'Destination'}. This is a voluntary update; BindaasRaah does not alert anyone automatically.`;
  let details=base;
  if($('sharePrecise').checked){const p=await getMyLocation({forSharing:true});if(!p)return;details+=`\nMy current approximate device coordinates: ${compactCoordinate(p.lat,p.lon)} (GPS accuracy ±${Math.round(p.accuracy)} m).`;}
  if(navigator.share){try{await navigator.share({title:'My journey update',text:details});return;}catch(e){if(e.name==='AbortError')return;}}
  try{await navigator.clipboard.writeText(details);toast('Trip text copied. Share it with someone you trust.');}catch{toast('Share is unavailable on this browser.');}
}
function renderReports(){const list=Array.isArray(state.reports)?state.reports:[];$('reportCount').textContent=`${list.length} reports`;
  $('reportCards').innerHTML=list.length?list.slice().reverse().map(r=>`<article class="report-item"><strong>${escapeHtml(r.type)}</strong> <span>UNVERIFIED · LOCAL ONLY</span><p>${escapeHtml(r.location)}<br>${escapeHtml(r.description)}</p><span>${new Date(r.createdAt).toLocaleString()}</span></article>`).join(''):'<p style="color:#9fb5c5;font-size:12px">No observations saved. Reports here are private practice entries, not public advisories.</p>';
}
function saveReport(){const data={type:$('reportType').value,location:$('reportLocation').value.trim(),description:$('reportDescription').value.trim()};const problem=validateLocalReport(data);if(problem){toast(problem);return;}
  state.reports=Array.isArray(state.reports)?state.reports:[];state.reports.push({...data,createdAt:Date.now(),status:'UNVERIFIED_LOCAL'});
  localStorage.setItem(REPORT_KEY,JSON.stringify(state.reports.slice(-100)));
  $('reportLocation').value='';$('reportDescription').value='';renderReports();toast('Unverified observation saved only on this device.');
}
function exportData(){const data={exportedAt:new Date().toISOString(),reports:state.reports,journey:state.trip,note:'No server-side personal data is exported because none is retained by this app.'};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download='bindaasraah-local-data.json';a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);}
function eraseData(){if(!confirm('Erase all BindaasRaah reports and journey information saved on this device?'))return;localStorage.removeItem(REPORT_KEY);localStorage.removeItem(JOURNEY_KEY);state.trip=null;state.reports=[];currentCoords=null;renderTrip();renderReports();toast('Local reports and journey records erased.');}
function bind(){
  document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.page)));
  document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
  document.querySelectorAll('.segment').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
  $('originSelect').addEventListener('change',e=>{state.originKey=e.target.value;if(e.target.value==='custom'&&!state.customOrigin){toast('Choose a start by search, GPS, or tapping the map.');return;}invalidateExistingRoutes();});
  $('destinationSelect').addEventListener('change',e=>{state.destKey=e.target.value;if(e.target.value==='custom'&&!state.customDest){toast('Choose a destination by search or tapping the map.');return;}invalidateExistingRoutes();});
  $('findRoutesBtn').addEventListener('click',findRoutes);
  $('routeCards').addEventListener('click',e=>{const n=e.target.closest('[data-route]');if(n)setRoute(n.dataset.route);});
  $('routeCards').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const n=e.target.closest('[data-route]');if(n){e.preventDefault();setRoute(n.dataset.route);}}});
  $('geolocateBtn').addEventListener('click',()=>getMyLocation());
  $('mapPickBtn').addEventListener('click',()=>{state.mapPick=state.mapPick==='origin'?'destination':'origin';$('mapPickBtn').textContent='Pick: '+(state.mapPick==='origin'?'Start':'Destination');toast('Tap the map to set '+state.mapPick+'.');});
  $('originSearchBtn').addEventListener('click',()=>searchAddress('origin'));
  $('destinationSearchBtn').addEventListener('click',()=>searchAddress('destination'));
  for(const key of ['origin','destination']){$(key+'Search').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchAddress(key);}});}
  $('loadPlacesBtn').addEventListener('click',loadPlaces);$('routePlacesBtn').addEventListener('click',loadRoutePlaces);$('lightingBtn').addEventListener('click',loadMappedLighting);$('demoPlacesBtn').addEventListener('click',demoPlaces);
  document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{state.filter=b.dataset.category;document.querySelectorAll('.filter').forEach(f=>f.classList.toggle('active',f===b));renderPlaces();}));
  $('startTrip').addEventListener('click',startTrip);$('checkInBtn').addEventListener('click',checkIn);$('endTripBtn').addEventListener('click',endTrip);$('shareTripBtn').addEventListener('click',shareTrip);
  $('saveReportBtn').addEventListener('click',saveReport);$('exportBtn').addEventListener('click',exportData);$('eraseBtn').addEventListener('click',eraseData);
  setInterval(()=>{if(state.page==='journey'&&state.trip&&!state.trip.endedAt)renderTrip();},1000);
}

bind();renderRoutes();renderTrip();renderReports();renderPlaces();loadStatus();
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'))navigator.serviceWorker.register('/sw.js').catch(()=>{});

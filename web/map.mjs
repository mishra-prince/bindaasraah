import {lngLat,routeFeatures,mapStyle,osmStyle} from './map-data.mjs';

const validPlace=p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
function popupText(title,description){const box=document.createElement('div');const strong=document.createElement('strong');strong.textContent=title;const text=document.createElement('p');text.textContent=description;box.append(strong,text);return box;}
function markerElement(label,end=false){const button=document.createElement('button');button.type='button';button.className='journey-marker'+(end?' destination-marker':'');button.textContent=label;button.setAttribute('aria-label',label==='A'?'Starting point':'Destination');return button;}

export async function createJourneyMap(container,config,onPick,onRoute,onStatus){
  let lib,map;
  try{
    lib=await import('./vendor/maplibre-gl.mjs');
    map=new lib.Map({container,style:mapStyle(config),center:[77.218,28.6304],zoom:12,attributionControl:true,renderWorldCopies:false});
    let usingMapTiler=Boolean(config.maptilerKey);
    map.addControl(new lib.NavigationControl({showCompass:false}),'top-right');
    map.addControl(new lib.ScaleControl({maxWidth:100}),'bottom-left');
    map.on('error',()=>{
      if(usingMapTiler){usingMapTiler=false;map.setStyle(osmStyle());onStatus('MapLibre · OpenStreetMap fallback');}
      else onStatus('Map tiles may be unavailable. Check your connection.');
    });
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Map did not load')),15000);map.once('load',()=>{clearTimeout(timer);resolve();});});
    map.on('click',e=>{if(e.originalEvent.target.closest('.maplibregl-marker,.maplibregl-ctrl'))return;if(map.getLayer('route-line')&&map.queryRenderedFeatures(e.point,{layers:['route-line']}).length)return;onPick(e.lngLat.lat,e.lngLat.lng);});
    onStatus('MapLibre · '+(usingMapTiler?'MapTiler vector map':'OpenStreetMap'));
    let markers=[],places=[],latest=null;
    let routeClickBound=false;
    const update=(snapshot,fit=false)=>{
      latest=snapshot;
      if(!map.getStyle()?.layers)return;
      const data=routeFeatures(snapshot.routes,snapshot.routeMode,snapshot.selectedRouteId);
      if(!map.getSource('journey-routes')){
        map.addSource('journey-routes',{type:'geojson',data});
        map.addLayer({id:'route-outline',type:'line',source:'journey-routes',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#0c2233','line-width':['case',['get','selected'],12,8]}});
        map.addLayer({id:'route-line',type:'line',source:'journey-routes',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':['get','color'],'line-width':['case',['get','selected'],7,4],'line-opacity':['case',['get','selected'],1,.65]}});
        if(!routeClickBound){map.on('click','route-line',e=>{e.preventDefault();onRoute(e.features[0].properties.id);});routeClickBound=true;}
      }else map.getSource('journey-routes').setData(data);
      for(const id of ['route-line','route-outline'])map.setLayoutProperty(id,'visibility',snapshot.showRoute?'visible':'none');
      markers.forEach(m=>m.remove());markers=[];
      for(const [point,label,end] of [[snapshot.start,'A',false],[snapshot.end,'B',true]]){
        if(point&&validPlace(point))markers.push(new lib.Marker({element:markerElement(label,end)}).setLngLat([point.lon,point.lat]).setPopup(new lib.Popup({offset:22}).setDOMContent(popupText(label==='A'?'Starting point':'Destination',point.name))).addTo(map));
      }
      places.forEach(m=>m.remove());places=[];
      if(snapshot.showPlaces&&snapshot.placeMode==='live')for(const p of snapshot.places.filter(validPlace).slice(0,45)){
        const el=markerElement(p.category==='police'?'P':p.category==='hospital'||p.category==='clinic'?'H':'+');el.className='service-marker';el.setAttribute('aria-label',p.name);
        places.push(new lib.Marker({element:el}).setLngLat([p.lon,p.lat]).setPopup(new lib.Popup({offset:16}).setDOMContent(popupText(p.name,`${p.source}. Hours: ${p.hours||'unknown'}. Not verified open or staffed.`))).addTo(map));
      }
      if(fit)fitJourney();
    };
    function fitJourney(){
      if(!latest)return;
      const selected=latest.routes.find(r=>r.id===latest.selectedRouteId);
      const coords=latest.routeMode==='live'&&selected?.points?.length>1?selected.points.map(lngLat).filter(Boolean):[latest.start,latest.end].filter(p=>p&&validPlace(p)).map(p=>[p.lon,p.lat]);
      if(!coords.length)return;
      const bounds=coords.reduce((b,p)=>b.extend(p),new lib.LngLatBounds(coords[0],coords[0]));
      map.fitBounds(bounds,{padding:{top:100,bottom:115,left:55,right:60},maxZoom:15,duration:0});
    }
    map.on('style.load',()=>{if(latest)update(latest,false);});
    return {engine:'maplibre',update,fit:fitJourney,resize:()=>map.resize()};
  }catch{
    if(map)map.remove();container.replaceChildren();
    if(!window.L){onStatus('Map unavailable. Routing and search remain available.');throw new Error('No map renderer available');}
    onStatus('Standard map · OpenStreetMap');
    const L=window.L,standard=L.map(container,{zoomControl:true}).setView([28.6304,77.218],12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',maxZoom:19}).addTo(standard);
    standard.on('click',e=>onPick(e.latlng.lat,e.latlng.lng));
    let layer=null,latest=null;
    const update=(snapshot,fit=false)=>{
      latest=snapshot;if(layer)layer.remove();const elements=[];
      const data=routeFeatures(snapshot.routes,snapshot.routeMode,snapshot.selectedRouteId);
      if(snapshot.showRoute)for(const f of data.features){const line=L.polyline(f.geometry.coordinates.map(([lon,lat])=>[lat,lon]),{color:f.properties.color,weight:f.properties.selected?7:4});line.on('click',e=>{L.DomEvent.stopPropagation(e.originalEvent);onRoute(f.properties.id);});elements.push(line);}
      for(const [point,label,end] of [[snapshot.start,'A',false],[snapshot.end,'B',true]])if(point&&validPlace(point))elements.push(L.marker([point.lat,point.lon],{icon:L.divIcon({className:'fallback-pin',html:markerElement(label,end).outerHTML,iconSize:[36,36],iconAnchor:[18,36]})}).bindPopup(popupText(label==='A'?'Starting point':'Destination',point.name)));
      if(snapshot.showPlaces&&snapshot.placeMode==='live')for(const p of snapshot.places.filter(validPlace).slice(0,45))elements.push(L.circleMarker([p.lat,p.lon],{radius:7,color:'#172a38',weight:2,fillColor:'#f4c87c',fillOpacity:1}).bindPopup(popupText(p.name,`${p.source}. Hours: ${p.hours||'unknown'}. Not verified open or staffed.`)));
      layer=L.layerGroup(elements).addTo(standard);if(fit)fitJourney();
    };
    function fitJourney(){if(!latest)return;const route=latest.routes.find(r=>r.id===latest.selectedRouteId);const coords=latest.routeMode==='live'&&route?.points?.length>1?route.points:[latest.start,latest.end].filter(p=>p&&validPlace(p)).map(p=>[p.lat,p.lon]);if(coords.length)standard.fitBounds(coords,{paddingTopLeft:[55,100],paddingBottomRight:[60,115],maxZoom:15,animate:false});}
    return {engine:'leaflet',update,fit:fitJourney,resize:()=>standard.invalidateSize()};
  }
}

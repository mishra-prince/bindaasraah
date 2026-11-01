// Route geometry stays [lat, lon] in API responses; maps consume [lon, lat].
export function lngLat(point){
  if(!Array.isArray(point)||point.length<2||!Number.isFinite(point[0])||!Number.isFinite(point[1])||Math.abs(point[0])>90||Math.abs(point[1])>180)return null;
  return [point[1],point[0]];
}
export function routeFeatures(routes,mode,selectedId){
  return {type:'FeatureCollection',features:mode==='live'?routes.flatMap((route,index)=>{
    const coordinates=(route.points||[]).map(lngLat);
    if(coordinates.length<2||coordinates.some(p=>!p))return [];
    return [{type:'Feature',properties:{id:route.id,selected:route.id===selectedId,color:['#39d6b4','#f3b667','#aeb4ff'][index%3]},geometry:{type:'LineString',coordinates}}];
  }):[]};
}
export function osmStyle(){return {version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'}},layers:[{id:'base-map',type:'raster',source:'osm'}]};}
export function mapStyle(config={}){
  return config.maptilerKey?`https://api.maptiler.com/maps/streets-v4/style.json?key=${encodeURIComponent(config.maptilerKey)}`:osmStyle();
}

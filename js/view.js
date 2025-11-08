const DEFAULT_CENTER = { lat: 24.73722164546818, lng: 46.53877581519047 };
const DEFAULT_ZOOM   = 14;

let map;
const infoWindows = new Map();

function fromBase64Url(s){let b=s.replace(/-/g,"+").replace(/_/g,"/");const p=b.length%4;if(p)b+="=".repeat(4-p);const bin=atob(b);const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;}
function expandData(c){return{center:c.c,circles:c.r.map(x=>({center:{lat:x.l[0],lng:x.l[1]},radius:x.r,strokeColor:x.co,fillColor:x.fc,fillOpacity:x.o,name:x.n||'',security:x.s||'',notes:x.t||''}))};}
function decodeData(s){const json=new TextDecoder().decode(fromBase64Url(s));return expandData(JSON.parse(json));}

function escapeHtml(t){const d=document.createElement('div');d.textContent=t??'';return d.innerHTML;}
function infoHtml(d){
  const name  = escapeHtml(d?.name || 'نقطة مراقبة');
  const lines = String(d?.security ?? '---').split(/\r?\n/).map(s=>escapeHtml(s.trim())).filter(Boolean);
  return `<div class="info-card">
    <div class="tt-title">${name}</div>
    <div class="tt-label">الأمن:</div>
    <div class="tt-names">${lines.length ? lines.map(s=>`<div class="name-line">${s}</div>`).join("") : `<div class="name-line">---</div>`}</div>
    ${d?.notes ? `<div class="tt-notes">${escapeHtml(d.notes)}</div>` : ''}
  </div>`;
}
function topEdgeLatLng(center, rMeters){
  return google.maps.geometry.spherical.computeOffset(center, rMeters, 0);
}
function ensureInfoWindow(id, circle, data){
  let iw = infoWindows.get(id);
  const html = infoHtml(data);
  const pos  = topEdgeLatLng(circle.getCenter(), circle.getRadius());
  if (!iw){
    iw = new google.maps.InfoWindow({ content: html, position: pos });
    infoWindows.set(id, iw);
  } else {
    iw.setContent(html);
    iw.setPosition(pos);
  }
  return iw;
}
function closeAllInfoWindows(except){
  infoWindows.forEach(iw => { if (iw !== except) iw.close(); });
}

function setupLayersControl(){
  const box = document.createElement('div');
  box.className = 'godj-layers min';
  box.innerHTML = `
    <div class="lc-head" id="lcHead" title="الطبقات">الطبقات</div>
    <div class="lc-body" id="lcBody">
      <div class="lc-row">
        <label for="lcBase">نوع الخريطة</label>
        <select id="lcBase">
          <option value="roadmap">افتراضي</option>
          <option value="satellite">صور فضائية</option>
          <option value="hybrid">هجينة</option>
          <option value="terrain">تضاريس</option>
        </select>
      </div>
      <label class="chk"><input type="checkbox" id="lcTraffic"> حركة المرور</label>
      <label class="chk"><input type="checkbox" id="lcTransit"> النقل العام</label>
      <label class="chk"><input type="checkbox" id="lcBike"> مسارات الدراجات</label>
    </div>`;
  map.controls[google.maps.ControlPosition.TOP_LEFT].push(box);

  const sel      = box.querySelector('#lcBase');
  const tTraffic = box.querySelector('#lcTraffic');
  const tTransit = box.querySelector('#lcTransit');
  const tBike    = box.querySelector('#lcBike');
  const head     = box.querySelector('#lcHead');

  const trafficLayer   = new google.maps.TrafficLayer();
  const transitLayer   = new google.maps.TransitLayer();
  const bicyclingLayer = new google.maps.BicyclingLayer();

  sel.addEventListener('change', ()=> map.setMapTypeId(sel.value));
  tTraffic.addEventListener('change',()=> trafficLayer  .setMap(tTraffic.checked ? map : null));
  tTransit.addEventListener('change',()=> transitLayer  .setMap(tTransit.checked ? map : null));
  tBike   .addEventListener('change',()=> bicyclingLayer.setMap(tBike.checked    ? map : null));

  head.addEventListener('click',()=> box.classList.toggle('min'));
}

function loadFromHash(){
  const h = (location.hash || "").replace(/^#/,'');
  const ps = new URLSearchParams(h);
  if (!ps.has('view')) return;
  const data = decodeData(ps.get('view'));

  if (data.center){
    map.setCenter(new google.maps.LatLng(data.center.lat, data.center.lng));
    map.setZoom(data.center.zoom || DEFAULT_ZOOM);
  }
  (data.circles || []).forEach(c=>{
    const circle = new google.maps.Circle({
      map,
      center: new google.maps.LatLng(c.center.lat, c.center.lng),
      radius: c.radius || 100,
      strokeColor: c.strokeColor || '#7c3aed',
      strokeOpacity: 1, strokeWeight: 2,
      fillColor: c.fillColor || '#c084fc',
      fillOpacity: (typeof c.fillOpacity==='number') ? c.fillOpacity : 0.35,
      clickable: true, draggable: false, editable: false
    });
    const id = Math.random().toString(36).slice(2);
    const open = ()=>{ const iw=ensureInfoWindow(id, circle, {name:c.name,security:c.security,notes:c.notes}); closeAllInfoWindows(iw); iw.open({map}); };
    const move = ()=>{ const iw=ensureInfoWindow(id, circle, {name:c.name,security:c.security,notes:c.notes}); iw.setPosition(topEdgeLatLng(circle.getCenter(),circle.getRadius())); };
    const close= ()=>{ const iw=infoWindows.get(id); if(iw) iw.close(); };

    circle.addListener('mouseover', open);
    circle.addListener('mousemove', move);
    circle.addListener('mouseout',  close);
    circle.addListener('click', open);
  });
}

window.initMap = function(){
  map = new google.maps.Map(document.getElementById('map'),{
    center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, gestureHandling:'greedy',
    mapTypeControl:false, fullscreenControl:true, streetViewControl:false
  });
  setupLayersControl();
  loadFromHash();
};

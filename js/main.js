/* ===== إعدادات عامة ===== */
const DEFAULT_CENTER = { lat: 24.73722164546818, lng: 46.53877581519047 };
const DEFAULT_ZOOM = 14;

let map;
let addMode = false;
const circles = [];
const infoWindows = new Map();
let activeCircle = null;

/* وضع العرض من الرابط */
const urlParams = new URLSearchParams(location.search);
const isViewMode = urlParams.has('view') || (location.hash||"").includes("view=");

document.addEventListener('DOMContentLoaded', () => {
  // في وضع العرض نخفي زر التحرير واللوحة
  if (isViewMode) {
    document.getElementById('mobileToggle')?.classList.add('hidden');
    document.getElementById('sidebar')?.classList.remove('open');
  }
});

/* ===== ترميز/فك ترميز ===== */
function toBase64Url(bytes){let b="";bytes.forEach(x=>b+=String.fromCharCode(x));return btoa(b).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
function fromBase64Url(s){let b=s.replace(/-/g,"+").replace(/_/g,"/");const p=b.length%4;if(p)b+="=".repeat(4-p);const bin=atob(b);const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;}
function compactData(data){return{c:data.center,r:data.circles.map(c=>({l:[c.center.lat,c.center.lng],r:c.radius,co:c.strokeColor,fc:c.fillColor,o:c.fillOpacity,n:c.name,s:c.security,t:c.notes}))};}
function expandData(c){return{center:c.c,circles:c.r.map(x=>({center:{lat:x.l[0],lng:x.l[1]},radius:x.r,strokeColor:x.co,fillColor:x.fc,fillOpacity:x.o,name:x.n||'',security:x.s||'',notes:x.t||''}))};}
function encodeData(d){const json=JSON.stringify(compactData(d));return toBase64Url(new TextEncoder().encode(json));}
function decodeData(s){const json=new TextDecoder().decode(fromBase64Url(s));return expandData(JSON.parse(json));}
function getViewParam(){if(location.hash){const h=location.hash.replace(/^#/,'');const ps=new URLSearchParams(h.includes('=')?h:`view=${h}`);if(ps.has('view'))return ps.get('view');}const sp=new URLSearchParams(location.search);return sp.get('view');}
function setViewParam(e){const newHash=`view=${e}`;const url=`${location.origin}${location.pathname}#${newHash}`;history.replaceState(null,"",url);return url;}

/* ===== كرت المعلومات ===== */
function escapeHtml(t){const d=document.createElement('div');d.textContent=t??'';return d.innerHTML;}
function infoHtml(d){
  const name=escapeHtml(d?.name||'نقطة مراقبة');
  const lines=String(d?.security??'---').split(/\r?\n/).map(s=>escapeHtml(s.trim())).filter(Boolean);
  return `<div class="info-card">
    <div class="tt-title">${name}</div>
    <div class="tt-label">الأمن:</div>
    <div class="tt-names">${lines.length?lines.map(s=>`<div class="name-line">${s}</div>`).join(""):`<div class="name-line">---</div>`}</div>
    ${d?.notes?`<div class="tt-notes">${escapeHtml(d.notes)}</div>`:''}
  </div>`;
}
function topEdgeLatLng(center,r){return google.maps.geometry.spherical.computeOffset(center,r,0);}
function ensureInfoWindow(circle){
  let iw=infoWindows.get(circle.__id);
  const html=infoHtml(circle.__data);
  const pos=topEdgeLatLng(circle.getCenter(),circle.getRadius());
  if(!iw){iw=new google.maps.InfoWindow({content:html,position:pos});infoWindows.set(circle.__id,iw);}
  else{iw.setContent(html);iw.setPosition(pos);}
  return iw;
}
function closeAllInfoWindows(except){infoWindows.forEach(iw=>{if(iw!==except)iw.close();});}

/* ===== Hover/Click ===== */
function wireCircleHover(circle){
  const open=()=>{const iw=ensureInfoWindow(circle);closeAllInfoWindows(iw);iw.open({map});};
  const move=()=>{const iw=ensureInfoWindow(circle);iw.setPosition(topEdgeLatLng(circle.getCenter(),circle.getRadius()));};
  const close=()=>{const iw=infoWindows.get(circle.__id);if(iw)iw.close();};
  circle.setOptions({clickable:true});
  circle.addListener('mouseover',open);
  circle.addListener('mousemove',move);
  circle.addListener('mouseout',close);
  circle.addListener('click',()=>{open();selectCircle(circle);});
}

/* ===== إنشاء دائرة ===== */
function createCircleAt(latLng){
  const circle=new google.maps.Circle({
    map,center:latLng,radius:100,strokeColor:'#7c3aed',strokeOpacity:1,strokeWeight:2,
    fillColor:'#c084fc',fillOpacity:0.35,clickable:true,draggable:false,editable:false
  });
  circle.__id=Math.random().toString(36).slice(2);
  circle.__data={name:'',security:'',notes:''};
  wireCircleHover(circle);
  circles.push(circle);
  selectCircle(circle);
}

/* ===== مراجع عناصر التحرير ===== */
const ed={};
function cacheEditorEls(){
  ed.sidebar=document.getElementById('sidebar');
  ed.backdrop=document.getElementById('drawerBackdrop');
  ed.mobileToggle=document.getElementById('mobileToggle');

  ed.wrap=document.getElementById('editor');
  ed.empty=document.getElementById('emptyState');
  ed.close=document.getElementById('closeEditor');

  ed.name=document.getElementById('ed-name');
  ed.security=document.getElementById('ed-security');
  ed.notes=document.getElementById('ed-notes');
  ed.stroke=document.getElementById('ed-stroke');
  ed.fill=document.getElementById('ed-fill');
  ed.opacity=document.getElementById('ed-opacity');
  ed.opVal=document.getElementById('op-val');
  ed.radius=document.getElementById('ed-radius');
  ed.radiusNum=document.getElementById('ed-radius-num');
  ed.radVal=document.getElementById('radius-val');
  ed.draggable=document.getElementById('ed-draggable');
  ed.editable=document.getElementById('ed-editable');
  ed.dup=document.getElementById('dupBtn');
  ed.del=document.getElementById('delBtn');
}

/* فتح/غلق اللوحة */
function openDrawer(){ ed.sidebar?.classList.add('open'); ed.backdrop?.classList.remove('hidden'); }
function closeDrawer(){ ed.sidebar?.classList.remove('open'); ed.backdrop?.classList.add('hidden'); }

/* تحديث المحرر */
function updateEditorFromCircle(c){
  const has=!!c; if(ed.del) ed.del.disabled=!has;
  if(!c){ed.wrap.classList.add('hidden');ed.empty.classList.remove('hidden');return;}
  ed.empty.classList.add('hidden'); ed.wrap.classList.remove('hidden');

  ed.name.value=c.__data.name||''; ed.security.value=c.__data.security||''; ed.notes.value=c.__data.notes||'';
  ed.stroke.value=c.get('strokeColor')||'#7c3aed'; ed.fill.value=c.get('fillColor')||'#c084fc';
  ed.opacity.value=(typeof c.get('fillOpacity')==='number')?c.get('fillOpacity'):0.35; ed.opVal.textContent=ed.opacity.value;
  const r=Math.round(c.getRadius()); ed.radius.value=Math.min(Math.max(r,+ed.radius.min),+ed.radius.max); ed.radiusNum.value=r; ed.radVal.textContent=r;
  ed.draggable.checked=!!c.getDraggable?.()||c.get('draggable'); ed.editable.checked=!!c.getEditable?.()||c.get('editable');
}

/* أحداث المحرر */
function bindEditorEvents(){
  ed.mobileToggle?.addEventListener('click', ()=> openDrawer());
  ed.backdrop?.addEventListener('click', ()=> closeDrawer());
  ed.close?.addEventListener('click', ()=> { selectCircle(null); closeDrawer(); });

  if (isViewMode && ed.mobileToggle) ed.mobileToggle.style.display = 'none';

  ed.name?.addEventListener('input',()=>{if(!activeCircle)return;activeCircle.__data.name=ed.name.value.trim();ensureInfoWindow(activeCircle);});
  ed.security?.addEventListener('input',()=>{if(!activeCircle)return;activeCircle.__data.security=ed.security.value;ensureInfoWindow(activeCircle);});
  ed.notes?.addEventListener('input',()=>{if(!activeCircle)return;activeCircle.__data.notes=ed.notes.value;ensureInfoWindow(activeCircle);});
  ed.stroke?.addEventListener('input',()=>{if(!activeCircle)return;activeCircle.setOptions({strokeColor:ed.stroke.value});ensureInfoWindow(activeCircle);});
  ed.fill?.addEventListener('input',()=>{if(!activeCircle)return;activeCircle.setOptions({fillColor:ed.fill.value});ensureInfoWindow(activeCircle);});
  ed.opacity?.addEventListener('input',()=>{if(!activeCircle)return;const v=parseFloat(ed.opacity.value);ed.opVal.textContent=v.toFixed(2);activeCircle.setOptions({fillOpacity:v});ensureInfoWindow(activeCircle);});
  const applyRadius=v=>{if(!activeCircle)return;const val=Math.max(10,Math.round(+v||100));activeCircle.setRadius(val);ed.radius.value=val;ed.radiusNum.value=val;ed.radVal.textContent=val;ensureInfoWindow(activeCircle);};
  ed.radius?.addEventListener('input',()=>applyRadius(ed.radius.value));
  ed.radiusNum?.addEventListener('input',()=>applyRadius(ed.radiusNum.value));
  ed.draggable?.addEventListener('change',()=>{if(!activeCircle)return;activeCircle.setDraggable?.(ed.draggable.checked);});
  ed.editable?.addEventListener('change',()=>{if(!activeCircle)return;activeCircle.setEditable?.(ed.editable.checked);});
  ed.dup?.addEventListener('click',()=>{if(!activeCircle)return;const ll=activeCircle.getCenter();const off=0.0006;const nl={lat:ll.lat()+((Math.random()-0.5)*off),lng:ll.lng()+((Math.random()-0.5)*off)};
    const nc=new google.maps.Circle({map,center:nl,radius:activeCircle.getRadius(),strokeColor:activeCircle.get('strokeColor'),strokeOpacity:1,strokeWeight:2,fillColor:activeCircle.get('fillColor'),fillOpacity:activeCircle.get('fillOpacity'),clickable:true,draggable:activeCircle.getDraggable?.(),editable:activeCircle.getEditable?.()});
    nc.__id=Math.random().toString(36).slice(2); nc.__data={...activeCircle.__data}; wireCircleHover(nc); circles.push(nc); selectCircle(nc); openDrawer();});
  ed.del?.addEventListener('click',()=>{if(!activeCircle)return;if(!confirm('هل تريد حذف هذه الدائرة؟'))return;const i=circles.indexOf(activeCircle);if(i>-1)circles.splice(i,1);const iw=infoWindows.get(activeCircle.__id);if(iw)iw.close();activeCircle.setMap(null);infoWindows.delete(activeCircle.__id);selectCircle(null);});
}

/* اختيار دائرة */
function selectCircle(circle){
  activeCircle=circle; updateEditorFromCircle(circle);
  if(!circle) return;
  const iw=ensureInfoWindow(circle); closeAllInfoWindows(iw); iw.open({map});
  circle.addListener('center_changed',()=>ensureInfoWindow(circle));
  circle.addListener('radius_changed',()=>ensureInfoWindow(circle));
  circle.addListener('dragend',()=>ensureInfoWindow(circle));
  openDrawer(); // عند التحديد افتح اللوحة
}

/* مشاركة/تحميل */
function shareMap(){
  const data={center:{lat:map.getCenter().lat(),lng:map.getCenter().lng(),zoom:map.getZoom()},
    circles:circles.map(c=>({center:{lat:c.getCenter().lat(),lng:c.getCenter().lng()},radius:c.getRadius(),strokeColor:c.get('strokeColor'),fillColor:c.get('fillColor'),fillOpacity:c.get('fillOpacity'),name:c.__data?.name||'',security:c.__data?.security||'',notes:c.__data?.notes||''}))};
  try{const encoded=encodeData(data);const url=setViewParam(encoded);
    if(navigator.share){navigator.share({title:document.title,url}).catch(()=>{navigator.clipboard.writeText(url).then(()=>alert('تم نسخ رابط الخريطة!'));});}
    else{navigator.clipboard.writeText(url).then(()=>alert('تم نسخ رابط الخريطة!'));}}
  catch(e){console.error('فشل إنشاء الرابط:',e);alert('حدث خطأ أثناء إنشاء الرابط.');}
}
function loadFromUrl(){
  if(!isViewMode) return;
  try{const encoded=getViewParam();if(!encoded) return;const data=decodeData(encoded);
    if(data.center){map.setCenter(new google.maps.LatLng(data.center.lat,data.center.lng));map.setZoom(data.center.zoom||DEFAULT_ZOOM);}
    (data.circles||[]).forEach(c=>{const circle=new google.maps.Circle({map,center:new google.maps.LatLng(c.center.lat,c.center.lng),radius:c.radius||100,strokeColor:c.strokeColor||'#7c3aed',strokeOpacity:1,strokeWeight:2,fillColor:c.fillColor||'#c084fc',fillOpacity:(typeof c.fillOpacity==='number')?c.fillOpacity:0.35,clickable:true,draggable:false,editable:false});
      circle.__id=Math.random().toString(36).slice(2); circle.__data={name:c.name||'',security:c.security||'',notes:c.notes||''}; wireCircleHover(circle); circles.push(circle);});
  }catch(e){console.warn('فشل تحميل الخريطة من الرابط:',e);}
}

/* لوحة الطبقات — قابلة للطيّ، وتُطوى تلقائيًا على الشاشات الصغيرة */
function setupLayersControl(){
  const box=document.createElement('div');
  box.className='godj-layers';
  const startMin = window.matchMedia('(max-width: 900px)').matches;
  if (startMin) box.classList.add('min');

  box.innerHTML=`
    <div class="lc-head" id="lcHead">
      <div class="lc-title"><span>الطبقات</span></div>
      <button id="lcToggle" class="lc-btn" title="طي/فتح">▾</button>
    </div>
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

  const sel=box.querySelector('#lcBase');
  const tTraffic=box.querySelector('#lcTraffic');
  const tTransit=box.querySelector('#lcTransit');
  const tBike=box.querySelector('#lcBike');
  const toggle=box.querySelector('#lcToggle');
  const head=box.querySelector('#lcHead');

  const trafficLayer=new google.maps.TrafficLayer();
  const transitLayer=new google.maps.TransitLayer();
  const bicyclingLayer=new google.maps.BicyclingLayer();

  sel.addEventListener('change',()=>map.setMapTypeId(sel.value));
  tTraffic.addEventListener('change',()=>trafficLayer.setMap(tTraffic.checked?map:null));
  tTransit.addEventListener('change',()=>transitLayer.setMap(tTransit.checked?map:null));
  tBike.addEventListener('change',()=>bicyclingLayer.setMap(tBike.checked?map:null));

  const toggleMin = ()=> box.classList.toggle('min');
  toggle.addEventListener('click',toggleMin);
  head.addEventListener('click',toggleMin); // النقر على العنوان أيضًا يطوي/يفتح
}

/* تهيئة الخريطة */
window.initMap=function(){
  map=new google.maps.Map(document.getElementById('map'),{
    center:DEFAULT_CENTER,zoom:DEFAULT_ZOOM,gestureHandling:'greedy',
    mapTypeControl:false,fullscreenControl:true,streetViewControl:false
  });
  setupLayersControl();
  cacheEditorEls();
  bindEditorEvents();

  // أزرار إضافة/مشاركة
  document.getElementById('addCircleBtn')?.addEventListener('click',()=>{
    addMode=true;document.getElementById('map').classList.add('add-cursor');
    alert('انقر على الخريطة لوضع دائرة جديدة.');
    openDrawer();
  });
  document.getElementById('shareBtn')?.addEventListener('click',shareMap);

  map.addListener('click',(e)=>{ if(!addMode) return; addMode=false; document.getElementById('map').classList.remove('add-cursor'); createCircleAt(e.latLng); });

  loadFromUrl();
};

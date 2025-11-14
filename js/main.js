/* Diriyah Security Map – v11.3 (close on save + marker icons) */
'use strict';

/* ---------------- Robust init ---------------- */
let __BOOTED__ = false;
function tryBoot(){
  if(__BOOTED__) return true;
  if(window.google && google.maps && document.readyState !== 'loading'){
    __BOOTED__ = true; boot(); return true;
  }
  return false;
}
window.initMap = function(){ tryBoot(); };
document.addEventListener('DOMContentLoaded', ()=>{
  tryBoot();
  let n=0, iv=setInterval(()=>{ if(tryBoot()||++n>60) clearInterval(iv); },250);
}, {passive:true});
window.addEventListener('load', tryBoot, {once:true, passive:true});
document.addEventListener('visibilitychange', ()=>{
  if(!document.hidden) tryBoot();
  else flushPersist();
}, {passive:true});

/* ---------------- Globals ---------------- */
let map, trafficLayer, infoWin=null;
let editMode=false, shareMode=false, cardPinned=false, addMode=false;
let btnRoadmap, btnSatellite, btnTraffic, btnShare, btnEdit, modeBadge, toast, btnAdd;

const DEFAULT_CENTER = { lat:24.7399, lng:46.5731 };
const DEFAULT_RADIUS = 20;
const DEFAULT_COLOR  = '#ff0000';
const DEFAULT_FILL_OPACITY = 0.40;
const DEFAULT_STROKE_WEIGHT = 2;

// إعدادات الأيقونة
const DEFAULT_MARKER_COLOR = '#ff0000';
const DEFAULT_MARKER_SCALE = 1.4;

const LOCATIONS = [
  { id:0,  name:"بوابة سمحان", lat:24.742132284177778, lng:46.569503913805825 },
  { id:1,  name:"منطقة سمحان", lat:24.74091335108621,  lng:46.571891407130025 },
  { id:2,  name:"دوار البجيري", lat:24.737521801476476, lng:46.57406918772067  },
  { id:3,  name:"إشارة البجيري", lat:24.73766260194535,  lng:46.575429040147306 },
  { id:4,  name:"طريق الملك فيصل", lat:24.736133848943062, lng:46.57696607050239  },
  { id:5,  name:"نقطة فرز الشلهوب", lat:24.73523670533632,  lng:46.57785639752234  },
  { id:6,  name:"المسار الرياضي المديد", lat:24.735301077804944, lng:46.58178092599035  },
  { id:7,  name:"ميدان الملك سلمان", lat:24.73611373368281,  lng:46.58407097038162  },
  { id:8,  name:"دوار الضوء الخافت", lat:24.739718342668006, lng:46.58352614787052  },
  { id:9,  name:"المسار الرياضي طريق الملك خالد الفرعي", lat:24.740797019998627, lng:46.5866145907347 },
  { id:10, name:"دوار البلدية", lat:24.739266101368777, lng:46.58172727078356 },
  { id:11, name:"مدخل ساحة البلدية الفرعي", lat:24.738638518378387, lng:46.579858026042785 },
  { id:12, name:"مدخل مواقف البجيري (كار بارك)", lat:24.73826438056506, lng:46.57789576275729 },
  { id:13, name:"مواقف الامن", lat:24.73808736962705, lng:46.57771858346317 },
  { id:14, name:"دوار الروقية", lat:24.741985907266145, lng:46.56269186990043 },
  { id:15, name:"بيت مبارك", lat:24.732609768937607, lng:46.57827089439368 },
  { id:16, name:"دوار وادي صفار", lat:24.72491458984474, lng:46.57345489743978 },
  { id:17, name:"دوار راس النعامة", lat:24.710329841152387, lng:46.572921959358204 },
  { id:18, name:"مزرعة الحبيب", lat:24.709445443672344, lng:46.593971867951346 },
];

/* Each entry: {id,circle,marker?,meta:{name,origName,recipients[],isNew:boolean,useMarker,markerColor,markerScale}} */
const circles = [];

const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
const escapeHtml=s=>String(s)
  .replace(/&/g,'&amp;')
  .replace(/</g,'&lt;')
  .replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;');
const toHex=(c)=>{
  if(/^#/.test(c)) return c;
  const m=c&&c.match(/rgba?\s*\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if(!m) return DEFAULT_COLOR;
  const [r,g,b]=[+m[1],+m[2],+m[3]];
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
};
const parseRecipients=t=>String(t)
  .split(/\r?\n/)
  .map(s=>s.replace(/[،;,]+/g,' ').trim())
  .filter(Boolean);

let persistTimer=null;
const persist=()=>{
  if(shareMode) return;
  clearTimeout(persistTimer);
  persistTimer=setTimeout(()=>writeShare(buildState()),180);
};
function flushPersist(){
  if(shareMode) return;
  clearTimeout(persistTimer);
  writeShare(buildState());
}

/* ---- compact Base64URL ---- */
function b64uEncode(s){
  const b=btoa(unescape(encodeURIComponent(s)));
  return b.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function b64uDecode(t){
  try{
    t=String(t||'').replace(/[^A-Za-z0-9\-_]/g,'');
    const pad=t.length%4 ? '='.repeat(4-(t.length%4)) : '';
    return decodeURIComponent(escape(
      atob(t.replace(/-/g,'+').replace(/_/g,'/')+pad)
    ));
  }catch{
    return '';
  }
}
function readShare(){
  const h=(location.hash||'').trim();
  if(!/^#x=/.test(h)) return null;
  try{
    return JSON.parse(b64uDecode(h.slice(3)));
  }catch{
    return null;
  }
}

/* ------------ Marker helpers ------------- */
function buildMarkerIcon(color, scale){
  const path =
    "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z";
  const c = color || DEFAULT_MARKER_COLOR;
  const s = Number.isFinite(scale) ? scale : DEFAULT_MARKER_SCALE;
  return {
    path,
    fillColor: c,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 1.5,
    scale: s,
    anchor: new google.maps.Point(12, 24)
  };
}

function ensureMarker(item){
  if(item.marker) return item.marker;
  const center = item.circle.getCenter();
  const meta = item.meta;
  const color = meta.markerColor || DEFAULT_MARKER_COLOR;
  const scale = Number.isFinite(meta.markerScale) ? meta.markerScale : DEFAULT_MARKER_SCALE;
  const marker = new google.maps.Marker({
    map,
    position: center,
    icon: buildMarkerIcon(color, scale),
    clickable: true,
    draggable: false
  });
  marker.addListener('click', ()=>{
    openCard(item);
    cardPinned = true;
  });
  item.marker = marker;
  return marker;
}

function applyShapeVisibility(item){
  const meta = item.meta;
  const useMarker = !!meta.useMarker;
  if(useMarker){
    const m = ensureMarker(item);
    m.setVisible(true);
    item.circle.setVisible(false);
  }else{
    if(item.marker) item.marker.setVisible(false);
    item.circle.setVisible(true);
  }
}

/**
 * نكتب حالة الخريطة في الـ hash بدون قصّ مواقع.
 * إذا زاد الطول كثير، نحذف إعدادات العرض (المركز/الزوم/النوع/المرور)
 * ونترك بيانات المواقع كاملة.
 */
function writeShare(state){
  if(shareMode) return;

  let payload = state;
  let tok = b64uEncode(JSON.stringify(payload));

  if(tok.length > 1800){
    payload = {
      c: state.c || [],
      n: state.n || []
    };
    tok = b64uEncode(JSON.stringify(payload));
  }

  const newHash = `#x=${tok}`;
  if(location.hash !== newHash){
    history.replaceState(null,'',newHash);
  }
}

/* ---- state build/apply ---- */
function buildState(){
  const ctr=map.getCenter(), z=map.getZoom();
  const m=map.getMapTypeId()==='roadmap'?'r':'h';
  const t=btnTraffic.getAttribute('aria-pressed')==='true'?1:0;

  const c=[];  // deltas for seeded locations
  const n=[];  // full specs for new locations

  circles.forEach(({id,circle,meta})=>{
    const r=Math.round(circle.getRadius());
    const sc=(circle.get('strokeColor')||DEFAULT_COLOR).replace('#','');
    const fo=Math.round((circle.get('fillOpacity')??DEFAULT_FILL_OPACITY)*100);
    const sw=(circle.get('strokeWeight')??DEFAULT_STROKE_WEIGHT)|0;
    const rec=(meta.recipients||[]).join('~');
    const center=circle.getCenter();
    const lat=center.lat();
    const lng=center.lng();
    const useMarker = meta.useMarker ? 1 : 0;
    const mc = (meta.markerColor || '').replace('#','');
    const ms = Number.isFinite(meta.markerScale) ? meta.markerScale : DEFAULT_MARKER_SCALE;

    if(meta.isNew){
      n.push([
        id,
        +lat.toFixed(7),
        +lng.toFixed(7),
        meta.name||'',
        r, sc, fo, sw, rec,
        useMarker, mc, ms
      ]);
      return;
    }

    const changed =
      (r!==DEFAULT_RADIUS) ||
      (toHex('#'+sc)!==toHex(DEFAULT_COLOR)) ||
      (fo!==Math.round(DEFAULT_FILL_OPACITY*100)) ||
      (sw!==DEFAULT_STROKE_WEIGHT) ||
      rec.length>0 ||
      ((meta.name||'')!==(meta.origName||'')) ||
      meta.useMarker ||
      !!meta.markerColor ||
      Number.isFinite(meta.markerScale);

    if(changed){
      c.push([
        id, r, sc, fo, sw, rec, meta.name||'',
        useMarker, mc, ms
      ]);
    }
  });

  return {
    p:[+ctr.lng().toFixed(4), +ctr.lat().toFixed(4)],
    z,
    m,
    t,
    c,
    n
  };
}

function applyState(s){
  if(!s) return;

  // المركز والزوم
  if(Array.isArray(s.p) && s.p.length === 2){
    map.setCenter({lat:s.p[1], lng:s.p[0]});
  }
  if(Number.isFinite(s.z)){
    map.setZoom(s.z);
  }

  // نوع الخريطة
  if(typeof s.m === 'string'){
    const isRoad = (s.m === 'r');
    map.setMapTypeId(isRoad ? 'roadmap' : 'hybrid');
    if(btnRoadmap && btnSatellite){
      btnRoadmap.setAttribute('aria-pressed', isRoad ? 'true' : 'false');
      btnSatellite.setAttribute('aria-pressed', isRoad ? 'false' : 'true');
    }
  }

  // طبقة حركة المرور
  if (s.t === 1){
    trafficLayer.setMap(map);
    btnTraffic.setAttribute('aria-pressed','true');
  } else if (s.t === 0){
    trafficLayer.setMap(null);
    btnTraffic.setAttribute('aria-pressed','false');
  }

  // apply deltas for seeds
  if(Array.isArray(s.c)){
    s.c.forEach(row=>{
      const [id,r,sc,fo,sw,rec,name,useMarker,mc,ms] = row;
      const it=circles.find(x=>x.id===id);
      if(!it) return;
      it.circle.setOptions({
        radius:Number.isFinite(r)?r:DEFAULT_RADIUS,
        strokeColor:sc?`#${sc}`:DEFAULT_COLOR,
        fillColor:sc?`#${sc}`:DEFAULT_COLOR,
        fillOpacity:Number.isFinite(fo)?(fo/100):DEFAULT_FILL_OPACITY,
        strokeWeight:Number.isFinite(sw)?sw:DEFAULT_STROKE_WEIGHT
      });
      if(typeof name==='string' && name.trim()){
        it.meta.name = name.trim();
      }
      it.meta.recipients = rec
        ? rec.split('~').map(s=>s.trim()).filter(Boolean)
        : [];

      // بيانات الأيقونة (مع توافق خلفي)
      const meta = it.meta;
      meta.useMarker = (useMarker === 1);
      if(mc) meta.markerColor = '#'+mc;
      if(Number.isFinite(ms)) meta.markerScale = ms;

      applyShapeVisibility(it);
    });
  }

  // spawn newly added circles
  if(Array.isArray(s.n)){
    s.n.forEach(row=>{
      const [id,lat,lng,name,r,sc,fo,sw,rec,useMarker,mc,ms] = row;
      if(circles.some(x=>x.id===id)) return;
      const circle = new google.maps.Circle({
        map,
        center:{lat:+lat,lng:+lng},
        radius:Number.isFinite(r)?r:DEFAULT_RADIUS,
        strokeColor:sc?`#${sc}`:DEFAULT_COLOR,
        strokeOpacity:.95,
        strokeWeight:Number.isFinite(sw)?sw:DEFAULT_STROKE_WEIGHT,
        fillColor:sc?`#${sc}`:DEFAULT_COLOR,
        fillOpacity:Number.isFinite(fo)?(fo/100):DEFAULT_FILL_OPACITY,
        clickable:true,
        draggable:false,
        editable:false,
        zIndex:9999
      });
      const meta = {
        name:(name||'موقع جديد'),
        origName:(name||'موقع جديد'),
        recipients: rec?rec.split('~').filter(Boolean):[],
        isNew:true,
        useMarker: (useMarker === 1),
        markerColor: mc ? '#'+mc : undefined,
        markerScale: Number.isFinite(ms) ? ms : undefined
      };
      const item = { id, circle, marker:null, meta };
      circles.push(item);
      bindCircleEvents(item);
      applyShapeVisibility(item);
    });
  }
}

/* ---------------- Boot ---------------- */
function boot(){
  btnRoadmap  = document.getElementById('btnRoadmap');
  btnSatellite= document.getElementById('btnSatellite');
  btnTraffic  = document.getElementById('btnTraffic');
  btnShare    = document.getElementById('btnShare');
  btnEdit     = document.getElementById('btnEdit');
  btnAdd      = document.getElementById('btnAdd');
  modeBadge   = document.getElementById('modeBadge');
  toast       = document.getElementById('toast');

  map = new google.maps.Map(document.getElementById('map'), {
    center:DEFAULT_CENTER,
    zoom:15,
    mapTypeId:'roadmap',
    disableDefaultUI:true,
    clickableIcons:false,
    gestureHandling:'greedy'
  });
  trafficLayer = new google.maps.TrafficLayer();

  btnRoadmap.addEventListener('click', ()=>{
    map.setMapTypeId('roadmap');
    btnRoadmap.setAttribute('aria-pressed','true');
    btnSatellite.setAttribute('aria-pressed','false');
    persist();
  }, {passive:true});

  btnSatellite.addEventListener('click', ()=>{
    map.setMapTypeId('hybrid');
    btnSatellite.setAttribute('aria-pressed','true');
    btnRoadmap.setAttribute('aria-pressed','false');
    persist();
  }, {passive:true});

  btnTraffic.addEventListener('click', ()=>{
    const on=btnTraffic.getAttribute('aria-pressed')==='true';
    if(on) trafficLayer.setMap(null);
    else   trafficLayer.setMap(map);
    btnTraffic.setAttribute('aria-pressed', String(!on));
    persist();
  }, {passive:true});

  // مشاركة
  btnShare.addEventListener('click', async ()=>{
    await nextTick();
    flushPersist();
    await nextTick();
    await copyShareLink();
  }, {passive:true});

  btnEdit.addEventListener('click', ()=>{
    if(shareMode) return;
    editMode=!editMode;
    cardPinned=false;
    if(infoWin) infoWin.close();
    modeBadge.textContent=editMode?'Edit':'Share';
    setDraggableForAll(editMode);
    if(!editMode){
      addMode=false;
      btnAdd.setAttribute('aria-pressed','false');
      document.body.classList.remove('add-cursor');
    }
    persist();
  }, {passive:true});

  btnAdd.addEventListener('click', ()=>{
    if(shareMode) return;
    if(!editMode){
      showToast('فعّل وضع التحرير أولاً');
      return;
    }
    addMode=!addMode;
    btnAdd.setAttribute('aria-pressed', String(addMode));
    document.body.classList.toggle('add-cursor', addMode);
    showToast(addMode?'انقر على الخريطة لإضافة موقع جديد':'تم إلغاء الإضافة');
  }, {passive:true});

  map.addListener('click', (e)=>{
    if (cardPinned && infoWin) {
      infoWin.close();
      cardPinned = false;
    }
    if(addMode && editMode && !shareMode){
      const id = genNewId();
      const circle = new google.maps.Circle({
        map,
        center:e.latLng,
        radius:DEFAULT_RADIUS,
        strokeColor:DEFAULT_COLOR,
        strokeOpacity:.95,
        strokeWeight:DEFAULT_STROKE_WEIGHT,
        fillColor:DEFAULT_COLOR,
        fillOpacity:DEFAULT_FILL_OPACITY,
        clickable:true,
        draggable:true,
        editable:false,
        zIndex:9999
      });
      const meta = {
        name:'موقع جديد',
        origName:'موقع جديد',
        recipients:[],
        isNew:true,
        useMarker:false,
        markerColor:undefined,
        markerScale:undefined
      };
      const item = { id, circle, marker:null, meta };
      circles.push(item);
      bindCircleEvents(item);
      openCard(item);
      cardPinned=true;
      persist();
    }
  });

  // seed circles
  const openCardThrottled = throttle((item)=>openCard(item), 120);
  LOCATIONS.forEach(loc=>{
    const circle = new google.maps.Circle({
      map,
      center:{lat:loc.lat,lng:loc.lng},
      radius:DEFAULT_RADIUS,
      strokeColor:DEFAULT_COLOR,
      strokeOpacity:.95,
      strokeWeight:DEFAULT_STROKE_WEIGHT,
      fillColor:DEFAULT_COLOR,
      fillOpacity:DEFAULT_FILL_OPACITY,
      clickable:true,
      draggable:false,
      editable:false,
      zIndex:9999
    });
    const meta = {
      name:loc.name,
      origName:loc.name,
      recipients:[],
      isNew:false,
      useMarker:false,
      markerColor:undefined,
      markerScale:undefined
    };
    const item = { id:loc.id, circle, marker:null, meta };
    circles.push(item);

    circle.addListener('mouseover', ()=>{ if(!cardPinned) openCardThrottled(item); });
    circle.addListener('mouseout',  ()=>{ if(!cardPinned && infoWin) infoWin.close(); });
    circle.addListener('click',     ()=>{ openCard(item); cardPinned=true; });
  });

  // share/view-only
  const S = readShare();
  shareMode = !!S;
  if(S){
    applyState(S);
    setViewOnly();
  } else {
    writeShare(buildState());
  }

  map.addListener('idle', persist);

  // أمان قبل الإغلاق
  window.addEventListener('beforeunload', ()=>{
    flushPersist();
  });
}

/* helper to bind events for newly created circles */
function bindCircleEvents(item){
  const openCardThrottled = throttle((it)=>openCard(it), 120);
  const c = item.circle;
  c.addListener('mouseover', ()=>{ if(!cardPinned) openCardThrottled(item); });
  c.addListener('mouseout',  ()=>{ if(!cardPinned && infoWin) infoWin.close(); });
  c.addListener('click',     ()=>{ openCard(item); cardPinned=true; });

  // تحريك الدائرة يحرك الأيقونة ويعمل حفظ مباشر
  google.maps.event.addListener(c,'center_changed', ()=>{
    if(item.marker){
      item.marker.setPosition(c.getCenter());
    }
    persist();
  });
}

/* ---------------- Card ---------------- */
function openCard(item){
  if(!infoWin){
    infoWin = new google.maps.InfoWindow({
      content:'',
      maxWidth:520,
      pixelOffset:new google.maps.Size(0,-6)
    });
  }
  infoWin.setContent(renderCard(item));
  infoWin.setPosition(item.circle.getCenter());
  infoWin.open({ map });

  // glass look + attach events
  setTimeout(()=>{
    const root=document.getElementById('iw-root');
    if(!root) return;
    const close=root.parentElement?.querySelector('.gm-ui-hover-effect');
    if(close) close.style.display='none';
    const iw=root.closest('.gm-style-iw');
    if(iw && iw.parentElement){
      iw.parentElement.style.background='transparent';
      iw.parentElement.style.boxShadow='none';
      const tail=iw.parentElement.previousSibling;
      if(tail && tail.style) tail.style.display='none';
    }
    attachCardEvents(item);
  },0);
}

function renderCard(item){
  const c=item.circle, meta=item.meta;
  const names=Array.isArray(meta.recipients)?meta.recipients:[];
  const namesHtml = names.length
    ? `<ol style="margin:6px 0 0; padding-inline-start:20px;">${names.map(n=>`<li>${escapeHtml(n)}</li>`).join('')}</ol>`
    : `<div style="font-size:12px;color:#666">لا توجد أسماء مضافة</div>`;

  const center=c.getCenter();
  const radius=Math.round(c.getRadius());
  const color =toHex(c.get('strokeColor')||DEFAULT_COLOR);
  const stroke=c.get('strokeWeight')||DEFAULT_STROKE_WEIGHT;
  const fillO =Number(c.get('fillOpacity')??DEFAULT_FILL_OPACITY);

  const useMarker = !!meta.useMarker;
  const markerColor = meta.markerColor || color;
  const markerScale = Number.isFinite(meta.markerScale) ? meta.markerScale : DEFAULT_MARKER_SCALE;

  return `
  <div id="iw-root" dir="rtl" style="min-width:360px;max-width:520px">
    <div style="background:rgba(255,255,255,0.93); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
                border:1px solid rgba(0,0,0,0.06); border-radius:18px; padding:14px; color:#111; box-shadow:0 16px 36px rgba(0,0,0,.22)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
        <img src="img/diriyah-logo.png" alt="Diriyah" style="width:50px;height:50px;object-fit:contain;">
        <div style="flex:1 1 auto; min-width:0">
          ${(!shareMode && editMode) ? `
            <input id="ctl-name" value="${escapeHtml(meta.name||'')}" placeholder="اسم الموقع"
              style="width:100%;border:1px solid #ddd;border-radius:10px;padding:6px 8px;font-weight:700;font-size:16px;">
          ` : `
            <div style="font-weight:800;font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(meta.name)}</div>
          `}
        </div>
        ${(!shareMode && editMode) ? `<button id="btn-card-share" title="نسخ الرابط"
            style="margin-inline-start:6px;border:1px solid #ddd;background:#fff;border-radius:10px;padding:4px 8px;cursor:pointer;">نسخ الرابط</button>` : ``}
      </div>

      <div style="font-size:12px;color:#666;margin-bottom:6px">
        الإحداثيات: ${center.lat().toFixed(6)}, ${center.lng().toFixed(6)}
      </div>

      <div style="border-top:1px dashed #e7e7e7; padding-top:8px;">
        <div style="font-weight:700; margin-bottom:4px;">المستلمون:</div>
        ${namesHtml}
      </div>

      ${(!shareMode && editMode) ? `
      <div style="margin-top:12px;border-top:1px dashed #e7e7e7;padding-top:10px;">
        <div style="font-weight:700; margin-bottom:6px;">أدوات التمثيل:</div>

        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
          <label style="font-size:12px;color:#333;white-space:nowrap;">نوع التمثيل:</label>
          <select id="ctl-shape" style="flex:1;border:1px solid #ddd;border-radius:8px;padding:4px 6px;">
            <option value="circle" ${useMarker?'':'selected'}>دائرة</option>
            <option value="marker" ${useMarker?'selected':''}>أيقونة</option>
          </select>
        </div>

        <div id="circle-tools" style="${useMarker?'display:none;':''}">
          <div style="font-weight:700; margin-bottom:6px;">أدوات الدائرة:</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div class="field"><label style="font-size:12px;color:#333;white-space:nowrap;">نصف القطر (م):</label>
              <input id="ctl-radius" type="range" min="5" max="300" step="1" value="${radius}" style="width:100%;">
              <span id="lbl-radius" style="font-size:12px;color:#666">${radius}</span></div>
            <div class="field"><label style="font-size:12px;color:#333;white-space:nowrap;">اللون:</label>
              <input id="ctl-color" type="color" value="${color}" style="width:38px;height:28px;border:none;background:transparent;padding:0"></div>
            <div class="field"><label style="font-size:12px;color:#333;white-space:nowrap;">حدّ الدائرة:</label>
              <input id="ctl-stroke" type="number" min="0" max="8" step="1" value="${stroke}" style="width:70px;"></div>
            <div class="field"><label style="font-size:12px;color:#333;white-space:nowrap;">شفافية التعبئة:</label>
              <input id="ctl-fill" type="range" min="0" max="0.95" step="0.02" value="${fillO}" style="width:100%;">
              <span id="lbl-fill" style="font-size:12px;color:#666">${fillO.toFixed(2)}</span></div>
          </div>
        </div>

        <div id="marker-tools" style="margin-top:10px;${useMarker?'':'display:none;'}">
          <div style="font-weight:700; margin-bottom:6px;">أدوات الأيقونة:</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div class="field"><label style="font-size:12px;color:#333;white-space:nowrap;">لون الأيقونة:</label>
              <input id="ctl-marker-color" type="color" value="${markerColor}"
                     style="width:38px;height:28px;border:none;background:transparent;padding:0"></div>
            <div class="field"><label style="font-size:12px;color:#333;white-space:nowrap;">حجم الأيقونة:</label>
              <input id="ctl-marker-scale" type="range" min="0.6" max="2.4" step="0.1" value="${markerScale}" style="width:100%;">
              <span id="lbl-marker-scale" style="font-size:12px;color:#666">${markerScale.toFixed(1)}</span></div>
          </div>
        </div>

        <div style="margin-top:8px;">
          <label style="font-size:12px;color:#666">أسماء المستلمين (سطر لكل اسم):</label>
          <textarea id="ctl-names" rows="4" style="width:100%; background:#fff; border:1px solid #ddd; border-radius:10px; padding:8px; white-space:pre;">${escapeHtml(names.join("\n"))}</textarea>
          <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
            <button id="btn-save"  style="border:1px solid #ddd; background:#fff; border-radius:10px; padding:6px 10px; cursor:pointer;">حفظ</button>
            <button id="btn-clear" style="border:1px solid #ddd; background:#fff; border-radius:10px; padding:6px 10px; cursor:pointer;">حذف الأسماء</button>
            <button id="btn-del"   style="border:1px solid #f33; color:#f33; background:#fff; border-radius:10px; padding:6px 10px; cursor:pointer;">حذف الموقع</button>
          </div>
          <div style="margin-top:6px;font-size:12px;color:#666">يمكن سحب الدائرة لتغيير موقعها أثناء وضع التحرير (كما تتحرك الأيقونة تلقائيًا).</div>
        </div>
      </div>` : ``}
    </div>
  </div>`;
}

function attachCardEvents(item){
  if(shareMode || !editMode) return;
  const c=item.circle;

  const inShare=document.getElementById('btn-card-share');
  if(inShare){
    inShare.addEventListener('click', async ()=>{
      flushPersist();
      await nextTick();
      await copyShareLink();
    }, {passive:true});
  }

  const nameEl=document.getElementById('ctl-name');
  const r=document.getElementById('ctl-radius');
  const lr=document.getElementById('lbl-radius');
  const col=document.getElementById('ctl-color');
  const sw=document.getElementById('ctl-stroke');
  const fo=document.getElementById('ctl-fill');
  const lf=document.getElementById('lbl-fill');
  const names=document.getElementById('ctl-names');
  const save=document.getElementById('btn-save');
  const clr=document.getElementById('btn-clear');
  const del=document.getElementById('btn-del');

  const shapeSel=document.getElementById('ctl-shape');
  const circleTools=document.getElementById('circle-tools');
  const markerTools=document.getElementById('marker-tools');
  const markerColorEl=document.getElementById('ctl-marker-color');
  const markerScaleEl=document.getElementById('ctl-marker-scale');
  const markerScaleLbl=document.getElementById('lbl-marker-scale');

  const persistBoth=(fn)=>(...a)=>{ fn(...a); persist(); };

  if(nameEl){
    const h=()=>{ item.meta.name = nameEl.value.trim(); };
    nameEl.addEventListener('input', persistBoth(h), {passive:true});
    nameEl.addEventListener('change', persistBoth(h), {passive:true});
  }
  if(r){
    r.addEventListener('input', ()=>{
      const v=+r.value||DEFAULT_RADIUS;
      lr.textContent=v;
      c.setRadius(v);
      persist();
    }, {passive:true});
    r.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }
  if(col){
    col.addEventListener('input', ()=>{
      const v=col.value||DEFAULT_COLOR;
      c.setOptions({strokeColor:v, fillColor:v});
      persist();
    }, {passive:true});
    col.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }
  if(sw){
    sw.addEventListener('input', ()=>{
      const v=clamp(+sw.value,0,8);
      sw.value=v;
      c.setOptions({strokeWeight:v});
      persist();
    }, {passive:true});
    sw.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }
  if(fo){
    fo.addEventListener('input', ()=>{
      const v=clamp(+fo.value,0,0.95);
      lf.textContent=v.toFixed(2);
      c.setOptions({fillOpacity:v});
      persist();
    }, {passive:true});
    fo.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }

  // اختيار نوع التمثيل
  if(shapeSel){
    shapeSel.addEventListener('change', ()=>{
      const useMarker = (shapeSel.value === 'marker');
      item.meta.useMarker = useMarker;
      if(circleTools) circleTools.style.display = useMarker ? 'none' : '';
      if(markerTools) markerTools.style.display = useMarker ? '' : 'none';
      applyShapeVisibility(item);
      flushPersist();
    }, {passive:true});
  }

  if(markerColorEl){
    markerColorEl.addEventListener('input', ()=>{
      const v = markerColorEl.value || DEFAULT_MARKER_COLOR;
      item.meta.markerColor = v;
      if(item.meta.useMarker){
        const m = ensureMarker(item);
        m.setIcon(buildMarkerIcon(v, item.meta.markerScale));
      }
      persist();
    }, {passive:true});
    markerColorEl.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }

  if(markerScaleEl){
    markerScaleEl.addEventListener('input', ()=>{
      const scale = +markerScaleEl.value || DEFAULT_MARKER_SCALE;
      markerScaleEl.value = scale;
      if(markerScaleLbl) markerScaleLbl.textContent = scale.toFixed(1);
      item.meta.markerScale = scale;
      if(item.meta.useMarker){
        const m = ensureMarker(item);
        m.setIcon(buildMarkerIcon(item.meta.markerColor, scale));
      }
      persist();
    }, {passive:true});
    markerScaleEl.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }

  // حفظ / حذف الأسماء / حذف الموقع
  if(save){
    save.addEventListener('click', ()=>{
      item.meta.recipients = parseRecipients(names.value);
      flushPersist();
      if(infoWin){
        infoWin.close();
        cardPinned = false;
      }
      showToast('تم الحفظ وتم إغلاق الكرت. الرابط الآن يعكس كل التعديلات');
    });
  }
  if(clr){
    clr.addEventListener('click',  ()=>{
      item.meta.recipients=[];
      openCard(item);
      flushPersist();
      showToast('تم حذف الأسماء');
    });
  }
  if(del){
    del.addEventListener('click',  ()=>{
      if(confirm('تأكيد حذف الموقع؟')){
        c.setMap(null);
        if(item.marker) item.marker.setMap(null);
        const idx=circles.findIndex(x=>x===item);
        if(idx>=0) circles.splice(idx,1);
        if(infoWin) infoWin.close();
        cardPinned=false;
        flushPersist();
        showToast('تم حذف الموقع');
      }
    });
  }
}

/* ---------------- View-only ---------------- */
function setViewOnly(){
  editMode=false;
  document.body.setAttribute('data-viewonly','1');
  modeBadge.textContent='Share';
  setDraggableForAll(false);
}

/* ---------------- Share ---------------- */
async function copyShareLink(){
  try{
    await navigator.clipboard.writeText(location.href);
    showToast('تم نسخ رابط المشاركة ✅');
  }catch{
    const tmp=document.createElement('input');
    tmp.value=location.href;
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand('copy');
    tmp.remove();
    showToast('تم النسخ');
  }
}

/* ---------------- Helpers ---------------- */
function showToast(msg){
  if(!toast) return;
  toast.textContent=msg;
  toast.classList.remove('hidden');
  setTimeout(()=>toast.classList.add('hidden'),1600);
}
function throttle(fn,ms){
  let last=0, t=null, pending=null;
  return function(...args){
    const now=performance.now();
    if(now-last>=ms){
      last=now;
      fn.apply(this,args);
    }else{
      pending=args;
      clearTimeout(t);
      t=setTimeout(()=>{
        last=performance.now();
        fn.apply(this,pending);
        pending=null;
      }, ms-(now-last));
    }
  };
}
function setDraggableForAll(on){
  circles.forEach(it=> it.circle.setDraggable(on));
}
function genNewId(){
  let id = -Date.now();
  while(circles.some(x=>x.id===id)) id--;
  return id;
}
function nextTick(){
  return new Promise(res=>
    requestAnimationFrame(()=>
      requestAnimationFrame(res)
    )
  );
}

/* Diriyah Security Map – v9 (robust init + Tajawal + mobile-safe + share fix) */
'use strict';

/* ---------- Robust init for Google Maps ---------- */
let __BOOTED__ = false;

function tryBoot(){
  if (__BOOTED__) return true;
  if (window.google && google.maps && document.readyState !== 'loading') {
    __BOOTED__ = true;
    try { boot(); } catch(e){ console.error(e); }
    return true;
  }
  return false;
}

// تُستدعى من Google Maps (callback=initMap)
window.initMap = function(){
  window.__MAP_API_READY__ = true;
  tryBoot();
};

// عند تحميل الـDOM
document.addEventListener('DOMContentLoaded', () => {
  tryBoot();
  // مؤقّت احتياطي يكرّر المحاولة حتى 15 ثانية
  let tries = 0;
  const iv = setInterval(() => {
    if (tryBoot()) { clearInterval(iv); }
    else if (++tries > 60) { clearInterval(iv); }
  }, 250);
});

// عند اكتمال تحميل الصفحة
window.addEventListener('load', tryBoot);

// إذا عاد التبويب من الخلفية
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) tryBoot();
});

/* ---------- Globals ---------- */
let map, trafficLayer, infoWin=null;
let cardPinned=false, editMode=false, shareMode=false, hideTimer=null;

let btnRoadmap, btnSatellite, btnTraffic, btnEditMode, btnShare, modeBadge, toast, fabShare;

const DEFAULT_CENTER = { lat:24.7399, lng:46.5731 };
const DEFAULT_RADIUS = 20;
const DEFAULT_COLOR  = '#ff0000';
const DEFAULT_FILL_OPACITY = 0.4;
const DEFAULT_STROKE_WEIGHT = 2;
const CIRCLE_Z = 9999;

/* ---------- Locations ---------- */
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
];

/* ---------- Utility helpers ---------- */
function clamp(x,min,max){ return Math.min(max, Math.max(min, x)); }
function toHex(col){ if(/^#/.test(col)) return col; const m=col.match(/rgba?\s*\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i); if(!m) return DEFAULT_COLOR; const [r,g,b]=[+m[1],+m[2],+m[3]]; return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join(''); }
function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ---------- State helpers ---------- */
let persistTimer=null;
const persist=()=>{ if(shareMode) return; clearTimeout(persistTimer); persistTimer=setTimeout(()=>writeShare(buildState()),200); };

function b64uEncode(s){
  const b = btoa(unescape(encodeURIComponent(s)));
  return b.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function b64uDecode(tok){
  try{
    tok = String(tok||'').replace(/[^A-Za-z0-9\-_]/g,'');
    const pad = tok.length % 4 ? '='.repeat(4 - (tok.length % 4)) : '';
    const s = tok.replace(/-/g,'+').replace(/_/g,'/') + pad;
    return decodeURIComponent(escape(atob(s)));
  }catch{ return ''; }
}

function readShare(){
  const h = (location.hash||'').trim();
  if(!/^#x=/.test(h)) return null;
  try{ return JSON.parse(b64uDecode(h.slice(3))); }catch{ return null; }
}

function writeShare(state){
  if(shareMode) return;
  const tok=b64uEncode(JSON.stringify(state));
  if(location.hash!==`#x=${tok}`) history.replaceState(null,'',`#x=${tok}`);
}

function buildState(){
  const ctr=map.getCenter(), z=map.getZoom();
  const m = map.getMapTypeId()==='roadmap'?'r':'h';
  const t = btnTraffic.getAttribute('aria-pressed')==='true'?1:0;
  return { p:[+ctr.lng().toFixed(4), +ctr.lat().toFixed(4)], z, m, t };
}

/* ---------- Boot ---------- */
function boot(){
  btnRoadmap  = document.getElementById('btnRoadmap');
  btnSatellite= document.getElementById('btnSatellite');
  btnTraffic  = document.getElementById('btnTraffic');
  btnEditMode = document.getElementById('btnEditMode');
  btnShare    = document.getElementById('btnShare');
  modeBadge   = document.getElementById('modeBadge');
  toast       = document.getElementById('toast');
  fabShare    = document.getElementById('fabShare');

  map = new google.maps.Map(document.getElementById('map'), {
    center: DEFAULT_CENTER,
    zoom: 15,
    mapTypeId:'roadmap',
    disableDefaultUI:true,
    clickableIcons:false,
    gestureHandling:'greedy'
  });

  trafficLayer = new google.maps.TrafficLayer();

  btnRoadmap.onclick   = ()=>{ map.setMapTypeId('roadmap');  persist(); };
  btnSatellite.onclick = ()=>{ map.setMapTypeId('hybrid');   persist(); };
  btnTraffic.onclick   = ()=>{ const on=btnTraffic.getAttribute('aria-pressed')==='true'; if(on){trafficLayer.setMap(null);} else {trafficLayer.setMap(map);} btnTraffic.setAttribute('aria-pressed', String(!on)); persist(); };
  btnShare.onclick     = copyShareLink;

  // إنشاء دوائر افتراضية
  LOCATIONS.forEach(loc=>{
    const c=new google.maps.Circle({
      map, center:loc, radius:DEFAULT_RADIUS,
      strokeColor:DEFAULT_COLOR, strokeOpacity:.95,
      strokeWeight:DEFAULT_STROKE_WEIGHT, fillColor:DEFAULT_COLOR,
      fillOpacity:DEFAULT_FILL_OPACITY, clickable:true, zIndex:9999
    });
  });

  const S = readShare();
  shareMode = !!S;
  if(S){ applyState(S); setViewOnly(); }
  else writeShare(buildState());

  map.addListener('idle', persist);
}

function applyState(s){
  if(!s) return;
  if(Array.isArray(s.p)) map.setCenter({lat:s.p[1], lng:s.p[0]});
  if(Number.isFinite(s.z)) map.setZoom(s.z);
  map.setMapTypeId(s.m==='r'?'roadmap':'hybrid');
  if(s.t) trafficLayer.setMap(map); else trafficLayer.setMap(null);
}

/* ---------- View-only ---------- */
function setViewOnly(){
  editMode=false;
  document.body.setAttribute('data-viewonly','1');
  modeBadge.textContent='Share';
}

/* ---------- Share ---------- */
async function copyShareLink(){
  writeShare(buildState());
  try{
    await navigator.clipboard.writeText(location.href);
    showToast('تم نسخ رابط المشاركة ✅');
  }catch{
    const tmp=document.createElement('input');
    tmp.value=location.href;
    document.body.appendChild(tmp);
    tmp.select(); document.execCommand('copy'); tmp.remove();
    showToast('تم نسخ الرابط');
  }
}

function showToast(msg){
  if(!toast) return;
  toast.textContent=msg;
  toast.classList.remove('hidden');
  setTimeout(()=>toast.classList.add('hidden'),1800);
}

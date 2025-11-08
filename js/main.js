/* ================================
   Security Map – main.js (fixed)
   ================================ */

let map;
const circles = [];
let infoWindow; // نعيد استخدام نافذة واحدة

// حقن CSS بسيط لبطاقة المعلومات (لو ما عدلت style.css بعد)
(function injectCardCSS(){
  const css = `
    .circle-card{min-width:260px;max-width:320px;padding:12px 14px;border-radius:14px;
      background:#1f2937;color:#fff;box-shadow:0 10px 24px rgba(0,0,0,.25);line-height:1.6}
    .circle-card .title{font-size:18px;font-weight:700;margin-bottom:6px}
    .circle-card .label{opacity:.85;font-size:14px;margin-top:6px}
    .circle-card .names{font-size:16px;white-space:pre-line}
  `;
  const tag = document.createElement('style');
  tag.appendChild(document.createTextNode(css));
  document.head.appendChild(tag);
})();

/* ----------------
   Utils
------------------*/
function escapeHtml(s=''){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function $(sel){ return document.querySelector(sel); }

/* ----------------
   Default sites (15m)
------------------*/
const DEFAULT_SITES = [
  {name:'بوابة سمحان', lat:24.742132284177778, lng:46.569503913805825},
  {name:'منطقة سمحان', lat:24.74091335108621, lng:46.571891407130025},
  {name:'دوار البجيري', lat:24.737521801476476, lng:46.57406918772067},
  {name:'إشارة البجيري', lat:24.73766260194535, lng:46.575429040147306},
  {name:'طريق الملك فيصل', lat:24.736133848943062, lng:46.57696607050239},
  {name:'نقطة فرز الشلهوب', lat:24.73523670533632, lng:46.57785639752234},
  {name:'المسار الرياضي المديد', lat:24.735301077804944, lng:46.58178092599035},
  {name:'ميدان الملك سلمان', lat:24.73611373368281, lng:46.58407097038162},
  {name:'دوار الضوء الخافت', lat:24.739718342668006, lng:46.58352614787052},
  {name:'المسار الرياضي طريق الملك خالد الفرعي', lat:24.740797019998627, lng:46.5866145907347},
  {name:'دوار البلدية', lat:24.739266101368777, lng:46.58172727078356},
  {name:'مدخل ساحة البلدية الفرعي', lat:24.738638518378387, lng:46.579858026042785},
  {name:'مدخل مواقف البجيري (كار بارك)', lat:24.73826438056506, lng:46.57789576275729},
  {name:'مواقف الامن', lat:24.73808736962705, lng:46.57771858346317},
  {name:'دوار الروقية', lat:24.741985907266145, lng:46.56269186990043},
  {name:'بيت مبارك', lat:24.732609768937607, lng:46.57827089439368},
  {name:'دوار وادي صفار', lat:24.72491458984474, lng:46.57345489743978},
  {name:'دوار راس النعامة', lat:24.710329841152387, lng:46.572921959358204},
  {name:'مزرعة الحبيب', lat:24.709445443672344, lng:46.593971867951346},
];

/* ----------------
   Map init
------------------*/
window.initMap = function initMap(){
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 24.73722164546818, lng: 46.53877581519047 },
    zoom: 14,
    // إيقاف خطف الكيبورد ومنع تضارب الإيماءات
    keyboardShortcuts: false,
    gestureHandling: 'greedy',
    clickableIcons: false,
    mapTypeControl: false,
    fullscreenControl: true,
    zoomControl: true,
  });

  // طبقات (لو عندك عناصر واجهة، الربط هنا)
  wireLayersControls();

  infoWindow = new google.maps.InfoWindow();

  // تحميل من رابط العرض إن وُجد
  const params = new URLSearchParams(location.search);
  if (params.has('view')) {
    try {
      const data = decodeData(decodeURIComponent(params.get('view')));
      loadFromData(data);
      // في وضع العرض أخفِ لوحة التحرير (إن وجدت)
      const panel = $('#editorPanel'); if (panel) panel.classList.add('hidden');
    } catch(e){ alert('لا يمكن تحميل الخريطة من الرابط.'); }
    return;
  }

  // وضع التحرير: أنشئ المواقع الافتراضية (مرة واحدة فقط)
  DEFAULT_SITES.forEach(p => {
    addCircle(p.lat, p.lng, {
      title: p.name,
      radius: 15,
      strokeColor: '#7c3aed',
      fillColor: '#a78bfa',
      fillOpacity: 0.25,
      draggable: false,
      editable: false,
    });
  });

  // عناصر واجهة التحرير (إن وُجدت)
  if ($('#addCircleBtn')) {
    $('#addCircleBtn').addEventListener('click', () => {
      const c = map.getCenter();
      addCircle(c.lat(), c.lng(), { title: 'موقع جديد', radius: 15 });
    });
  }
  if ($('#shareBtn')) $('#shareBtn').addEventListener('click', shareMap);

  // امنع مرور الأحداث من لوحة التحرير إلى الخريطة
  makePanelInputsSafe();
};

/* ----------------
   Layers controls
------------------*/
let trafficLayer, transitLayer, bikeLayer;
function wireLayersControls(){
  const sel = $('#mapTypeSelect'); // <select> نوع الخريطة (اختياري)
  if (sel) {
    sel.addEventListener('change', () => map.setMapTypeId(sel.value));
  }
  const chkTraffic = $('#layerTraffic');
  const chkTransit = $('#layerTransit');
  const chkBike    = $('#layerBike');

  if (chkTraffic){
    trafficLayer = new google.maps.TrafficLayer();
    chkTraffic.addEventListener('change', ()=> chkTraffic.checked ? trafficLayer.setMap(map) : trafficLayer.setMap(null));
  }
  if (chkTransit){
    transitLayer = new google.maps.TransitLayer();
    chkTransit.addEventListener('change', ()=> chkTransit.checked ? transitLayer.setMap(map) : transitLayer.setMap(null));
  }
  if (chkBike){
    bikeLayer = new google.maps.BicyclingLayer();
    chkBike.addEventListener('change', ()=> chkBike.checked ? bikeLayer.setMap(map) : bikeLayer.setMap(null));
  }
}

/* ----------------
   Editor safety: stop events bubbling
------------------*/
function makePanelInputsSafe(){
  const panel = $('#editorPanel');
  if (!panel) return;
  const stop = e => e.stopPropagation();
  const stopWheel = e => { e.stopPropagation(); e.preventDefault(); };

  panel.querySelectorAll('input, textarea, select, button, label').forEach(el => {
    ['click','mousedown','mouseup','pointerdown','pointerup','touchstart','touchend','keydown','keyup','keypress']
      .forEach(ev => el.addEventListener(ev, stop));
    el.addEventListener('wheel', stopWheel, { passive:false });
  });
}

/* ----------------
   Circles
------------------*/
function circleCardHTML(data) {
  const title = data.name || data.title || 'نقطة';
  const names = (data.security || '').trim();
  const notes = (data.notes || '').trim();
  return `
    <div class="circle-card">
      <div class="title">${escapeHtml(title)}</div>
      <div class="label">الأمن:</div>
      <div class="names">${escapeHtml(names)}</div>
      ${notes ? `<div class="label">ملاحظات:</div><div>${escapeHtml(notes)}</div>` : ''}
    </div>
  `;
}

function bindCircleUI(circle){
  // افتح البطاقة عند المرور بالفأرة (أو اللمس بالنقر)
  circle.addListener('mouseover', () => {
    infoWindow.setContent(circleCardHTML(circle.data || {}));
    infoWindow.setPosition(circle.getCenter());
    infoWindow.open({ map });
  });
  circle.addListener('mouseout', () => infoWindow.close());

  // عند النقر، حدّد الدائرة واملأ اللوحة (إن وُجدت)
  circle.addListener('click', () => {
    selectCircle(circle);
  });
}

function selectCircle(circle){
  const panel = $('#editorPanel');
  if (!panel) return;

  panel.classList.remove('hidden');

  // عناصر الإدخال باللوحة (عدّل الـ IDs بما يطابق HTML لديك)
  const inName   = $('#siteName');
  const inSec    = $('#securityNames');
  const inNotes  = $('#notes');
  const inStroke = $('#strokeColor');
  const inFill   = $('#fillColor');
  const inOp     = $('#fillOpacity');
  const inRad    = $('#radius');
  const inDrag   = $('#dragToggle');
  const inEdit   = $('#editToggle');

  // تعبئة
  inName && (inName.value   = circle.data?.name || circle.data?.title || '');
  inSec  && (inSec.value    = circle.data?.security || '');
  inNotes&& (inNotes.value  = circle.data?.notes || '');
  inStroke && (inStroke.value = circle.get('strokeColor') || '#7c3aed');
  inFill   && (inFill.value   = circle.get('fillColor') || '#a78bfa');
  inOp     && (inOp.value     = Number(circle.get('fillOpacity') ?? 0.25));
  inRad    && (inRad.value    = Math.round(circle.getRadius()));
  inDrag   && (inDrag.checked = !!circle.getDraggable());
  inEdit   && (inEdit.checked = !!circle.getEditable());

  // ربط الحفظ المباشر
  if (inName)   inName.oninput   = () => { circle.data = circle.data || {}; circle.data.name   = inName.value;   };
  if (inSec)    inSec.oninput    = () => { circle.data = circle.data || {}; circle.data.security = inSec.value;    };
  if (inNotes)  inNotes.oninput  = () => { circle.data = circle.data || {}; circle.data.notes  = inNotes.value;  };
  if (inStroke) inStroke.oninput = () => circle.setOptions({ strokeColor: inStroke.value });
  if (inFill)   inFill.oninput   = () => circle.setOptions({ fillColor: inFill.value });
  if (inOp)     inOp.oninput     = () => circle.setOptions({ fillOpacity: clamp(+inOp.value,0,1) });
  if (inRad)    inRad.oninput    = () => circle.setRadius(Math.max(1, +inRad.value));
  if (inDrag)   inDrag.onchange  = () => circle.setDraggable(!!inDrag.checked);
  if (inEdit)   inEdit.onchange  = () => circle.setEditable(!!inEdit.checked);
}

function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

function addCircle(lat, lng, opts={}){
  const circle = new google.maps.Circle({
    map,
    center: {lat, lng},
    radius: opts.radius ?? 15, // 15m
    strokeColor: opts.strokeColor ?? '#7c3aed',
    strokeOpacity: 1,
    strokeWeight: 2,
    fillColor: opts.fillColor ?? '#a78bfa',
    fillOpacity: opts.fillOpacity ?? 0.25,
    draggable: opts.draggable ?? false, // افتراضيًا مقفّلة
    editable:  opts.editable  ?? false, // افتراضيًا مقفّلة
  });

  circle.data = {
    name: opts.title || '',
    security: '',
    notes: ''
  };

  bindCircleUI(circle);
  circles.push(circle);
  return circle;
}

/* ----------------
   Share / Load
------------------*/
function compactData() {
  return {
    c: { lat: map.getCenter().lat(), lng: map.getCenter().lng(), z: map.getZoom() },
    r: circles.map(c => ({
      l: { lat: c.getCenter().lat(), lng: c.getCenter().lng() },
      r: c.getRadius(),
      sc: c.get('strokeColor'),
      fc: c.get('fillColor'),
      fo: c.get('fillOpacity'),
      n: c.data?.name || '',
      s: c.data?.security || '',
      t: c.data?.notes || ''
    }))
  };
}
function expandData(d) {
  return {
    center: d.c,
    circles: (d.r||[]).map(x => ({
      lat: x.l.lat, lng: x.l.lng, radius: x.r,
      strokeColor: x.sc, fillColor: x.fc, fillOpacity: x.fo,
      name: x.n, security: x.s, notes: x.t
    }))
  };
}
function encodeData(obj){
  const json = JSON.stringify(obj);
  const utf8 = new TextEncoder().encode(json);
  let bin=''; utf8.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin);
}
function decodeData(s){
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
  const json = new TextDecoder().decode(bytes);
  return expandData(JSON.parse(json));
}

function shareMap(){
  const data = compactData();
  const encoded = encodeData(data);
  // نستخدم view.html للعرض فقط
  const url = `${location.origin}/view.html?view=${encodeURIComponent(encoded)}`;
  navigator.clipboard?.writeText(url).then(
    ()=> alert('تم نسخ رابط الخريطة!'),
    ()=> prompt('انسخ الرابط:', url)
  );
}

function loadFromData(data){
  if (data.center) {
    map.setCenter({lat:data.center.lat, lng:data.center.lng});
    if (data.center.z) map.setZoom(data.center.z);
  }
  (data.circles||[]).forEach(c => {
    const circle = addCircle(c.lat, c.lng, {
      title: c.name, radius: c.radius,
      strokeColor: c.strokeColor, fillColor: c.fillColor, fillOpacity: c.fillOpacity,
      draggable: false, editable: false
    });
    circle.data = { name:c.name||'', security:c.security||'', notes:c.notes||'' };
  });
}

/* ----------------
   Important: do NOT re-init on zoom
------------------*/
// لا تربط أي initMap / إعادة رندر هنا. لو احتجت مراقبة:
let zoomRAF=null;
function onZoomChangedLight(){
  if (zoomRAF) cancelAnimationFrame(zoomRAF);
  zoomRAF = requestAnimationFrame(()=>{ /* مكان لأي تحديث خفيف عند الحاجة */ });
}
// مفعّل فقط لو أردت
// map.addListener('zoom_changed', onZoomChangedLight);

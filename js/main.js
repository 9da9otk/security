/* Security Map – v4 (Share/Edit + Popover)
   - كرت معلومات منبثق (Popover) مثبت على الدائرة عبر google.maps.InfoWindow
   - يظهر عند المرور (hover) ويُثبَّت عند الضغط (click)، ويختفي بالخروج إذا غير مُثبت
   - وضع التحرير يُفعل/يُلغى بالزر، ومحظور في روابط المشاركة #s=...
   - روابط مشاركة قصيرة تحمل الحالة
*/

let map, trafficLayer;
let cardPinned = false;       // تثبيت الكرت بعد الضغط
let editMode = false;         // من زر التحرير
let shareMode = false;        // true إذا الرابط يحوي s=
let circles = [];             // [{id, circle, meta}]
let activeItem = null;        // {id, circle, meta}
let infoWin = null;           // InfoWindow واحد يُعاد استخدامه

// DOM refs
let btnRoadmap, btnSatellite, btnTraffic, btnRecipients, btnEditMode, modeBadge;
let recipientsModal, recipientsInput, saveRecipients, cancelRecipients, toast;

const DEFAULT_ZOOM = 16;
const DEFAULT_CENTER = { lat: 24.7399, lng: 46.5731 };
const DEFAULT_RADIUS = 15;
const DEFAULT_COLOR = '#c1a476';
const DEFAULT_FILL_OPACITY = 0.15;
const CIRCLE_Z = 9999;

/* مواقعك (أسماء عربية + إحداثيات) */
const LOCATIONS = [
  { id: 0,  name: "بوابة سمحان",                          lat: 24.742132284177778, lng: 46.569503913805825, notes: "" },
  { id: 1,  name: "منطقة سمحان",                          lat: 24.74091335108621,  lng: 46.571891407130025, notes: "" },
  { id: 2,  name: "دوار البجيري",                         lat: 24.737521801476476, lng: 46.57406918772067,  notes: "" },
  { id: 3,  name: "إشارة البجيري",                        lat: 24.73766260194535,  lng: 46.575429040147306, notes: "" },
  { id: 4,  name: "طريق الملك فيصل",                      lat: 24.736133848943062, lng: 46.57696607050239,  notes: "" },
  { id: 5,  name: "نقطة فرز الشلهوب",                     lat: 24.73523670533632,  lng: 46.57785639752234,  notes: "" },
  { id: 6,  name: "المسار الرياضي المديد",                lat: 24.735301077804944, lng: 46.58178092599035,  notes: "" },
  { id: 7,  name: "ميدان الملك سلمان",                    lat: 24.73611373368281,  lng: 46.58407097038162,  notes: "" },
  { id: 8,  name: "دوار الضوء الخافت",                     lat: 24.739718342668006, lng: 46.58352614787052,  notes: "" },
  { id: 9,  name: "المسار الرياضي طريق الملك خالد الفرعي", lat: 24.740797019998627, lng: 46.5866145907347,   notes: "" },
  { id:10,  name: "دوار البلدية",                          lat: 24.739266101368777, lng: 46.58172727078356,  notes: "" },
  { id:11,  name: "مدخل ساحة البلدية الفرعي",             lat: 24.738638518378387, lng: 46.579858026042785, notes: "" },
  { id:12,  name: "مدخل مواقف البجيري (كار بارك)",        lat: 24.73826438056506,  lng: 46.57789576275729,  notes: "" },
  { id:13,  name: "مواقف الامن",                           lat: 24.73808736962705,  lng: 46.57771858346317,  notes: "" },
  { id:14,  name: "دوار الروقية",                          lat: 24.741985907266145, lng: 46.56269186990043,  notes: "" },
  { id:15,  name: "بيت مبارك",                             lat: 24.732609768937607, lng: 46.57827089439368,  notes: "" },
  { id:16,  name: "دوار وادي صفار",                        lat: 24.72491458984474,  lng: 46.57345489743978,  notes: "" },
  { id:17,  name: "دوار راس النعامة",                      lat: 24.710329841152387, lng: 46.572921959358204, notes: "" },
  { id:18,  name: "مزرعة الحبيب",                          lat: 24.709445443672344, lng: 46.593971867951346, notes: "" },
];

/* ===== مشاركة مختصرة: ترميز/فك ترميز ===== */
function encodeState(o){ try{ return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }catch{ return ""; } }
function decodeState(t){ try{ return JSON.parse(decodeURIComponent(escape(atob(t.replace(/-/g,'+').replace(/_/g,'/'))))); }catch{ return null; } }
function writeShareToken(state){ if(shareMode) return; const token=encodeState(state); const t=Date.now().toString(36).slice(-6); const h=`#s=${token}&t=${t}`; if(location.hash!==h) history.replaceState(null,'',h); }
function readShareToken(){ if(!location.hash) return null; const q=new URLSearchParams(location.hash.slice(1)); const s=q.get('s'); return s?decodeState(s):null; }

function buildShareState(){
  const type = map.getMapTypeId()==='roadmap'?'r':'h';
  const tr = (btnTraffic.getAttribute('aria-pressed')==='true')?1:0;
  const rcp = recipientsInput.value.trim();
  const c = circles.map(({id,circle,meta})=>{
    const r=Math.round(circle.getRadius());
    const sc=(circle.get('strokeColor')||DEFAULT_COLOR).replace('#','');
    const fo=Number((circle.get('fillOpacity')??DEFAULT_FILL_OPACITY).toFixed(2));
    return [id,r,sc,fo,meta?.notes||''];
  });
  const ctr=map.getCenter(); const cy=+ctr.lat().toFixed(6), cx=+ctr.lng().toFixed(6), z=map.getZoom();
  return {m:type,tr,rcp,c,cx,cy,z};
}
function applyShareState(s){
  if(!s) return;
  if(Number.isFinite(s.cy)&&Number.isFinite(s.cx)) map.setCenter({lat:s.cy,lng:s.cx});
  if(Number.isFinite(s.z)) map.setZoom(s.z);
  setMapType(s.m==='r'?'roadmap':'hybrid',true);
  if(s.tr){trafficLayer.setMap(map);btnTraffic.setAttribute('aria-pressed','true');}
  else{trafficLayer.setMap(null);btnTraffic.setAttribute('aria-pressed','false');}
  if(typeof s.rcp==='string'){ recipientsInput.value=s.rcp; try{localStorage.setItem('recipients',s.rcp);}catch{} }
  if(Array.isArray(s.c)){ s.c.forEach(([id,r,sc,fo,notes])=>{ const it=circles.find(x=>x.id===id); if(!it) return; if(Number.isFinite(r)) it.circle.setRadius(r); if(sc) it.circle.setOptions({strokeColor:`#${sc}`,fillColor:`#${sc}`, zIndex:CIRCLE_Z}); if(Number.isFinite(fo)) it.circle.setOptions({fillOpacity:fo}); if(typeof notes==='string') it.meta.notes=notes; }); }
}

let persistTimer=null;
function persistShareThrottled(){ if(shareMode) return; clearTimeout(persistTimer); persistTimer=setTimeout(()=>writeShareToken(buildShareState()),220); }

/* ===== محتوى الـ InfoWindow (HTML + أحداث) ===== */
function renderInfoContent(item){
  const {meta, circle} = item;
  const c = circle.getCenter();
  const radius = Math.round(circle.getRadius());
  const notes = meta.notes || '';

  // HTML داخلي للكرت (تصميم قريب من السابق)
  return `
  <div id="iw-root" dir="rtl" style="
    min-width:260px; max-width:320px; color:#111; font-family:inherit;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
      <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Diriyah_Company_Logo.svg/64px-Diriyah_Company_Logo.svg.png"
           alt="Diriyah" style="width:28px;height:28px;object-fit:contain;">
      <div style="line-height:1.2;">
        <div id="iw-title" style="font-weight:700;">${meta.name || '—'}</div>
        <div id="iw-sub" style="font-size:12px;color:#666;">${notes || ''}</div>
      </div>
      <div style="margin-inline-start:auto;display:flex;gap:6px;">
        ${editMode ? `<button id="iw-gear" title="أدوات" style="border:1px solid #ddd;padding:2px 6px;border-radius:8px;background:#fff;">⚙️</button>` : ''}
        <button id="iw-pin" title="تثبيت" style="border:1px solid #ddd;padding:2px 6px;border-radius:8px;background:#fff;">📌</button>
        <button id="iw-close" title="إغلاق" style="border:1px solid #ddd;padding:2px 6px;border-radius:8px;background:#fff;">✕</button>
      </div>
    </div>
    <div style="border-top:1px dashed #eee;padding-top:6px;font-size:13px;">
      <div style="margin:4px 0;">📍 <strong>الإحداثيات:</strong> ${c.lat().toFixed(6)}, ${c.lng().toFixed(6)}</div>
      <div style="margin:4px 0;">🎯 <strong>نصف القطر:</strong> <span id="iw-radius">${radius}</span> م</div>
      ${notes ? `<div style="margin:4px 0;">📝 <strong>ملاحظات:</strong> <span id="iw-notes">${notes}</span></div>` : ''}
    </div>

    ${editMode ? `
    <div id="iw-edit" style="margin-top:8px;border:1px solid #eee;border-radius:10px;padding:8px;background:#fafafa;display:none;">
      <div style="display:flex;gap:8px;align-items:center;margin:6px 0;">
        <label style="min-width:86px;">اللون</label>
        <input id="ed-color" type="color" value="${(circle.get('strokeColor')||DEFAULT_COLOR)}" />
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin:6px 0;">
        <label style="min-width:86px;">نصف القطر</label>
        <input id="ed-radius" type="range" min="5" max="300" step="1" value="${radius}" style="flex:1;" />
        <span style="width:50px;text-align:center;"><span id="ed-radius-val">${radius}</span>م</span>
      </div>
      <div style="display:flex;gap:8px;align-items:flex-start;margin:6px 0;">
        <label style="min-width:86px;">ملاحظات</label>
        <textarea id="ed-notes" rows="3" style="flex:1;background:#fff;border:1px solid #ddd;border-radius:8px;padding:6px;">${notes}</textarea>
      </div>
      <div style="display:flex;gap:8px;margin-top:6px;">
        <button id="ed-save" class="btn">حفظ</button>
        <button id="ed-delete" class="btn">حذف</button>
      </div>
    </div>` : ``}
  </div>`;
}

function attachInfoEvents(item){
  const root   = document.getElementById('iw-root');
  if (!root) return;

  const {circle, meta} = item;

  const btnClose = document.getElementById('iw-close');
  const btnPin   = document.getElementById('iw-pin');
  btnClose?.addEventListener('click', () => { cardPinned=false; infoWin && infoWin.close(); });
  btnPin?.addEventListener('click', () => { cardPinned=!cardPinned; });

  if (!editMode) return;

  const btnGear  = document.getElementById('iw-gear');
  const editBox  = document.getElementById('iw-edit');
  const edColor  = document.getElementById('ed-color');
  const edRadius = document.getElementById('ed-radius');
  const edRadiusVal = document.getElementById('ed-radius-val');
  const edNotes  = document.getElementById('ed-notes');
  const edSave   = document.getElementById('ed-save');
  const edDel    = document.getElementById('ed-delete');

  btnGear?.addEventListener('click', () => {
    if (!editBox) return;
    const vis = editBox.style.display !== 'none';
    editBox.style.display = vis ? 'none' : 'block';
  });

  edRadius?.addEventListener('input', () => {
    const v = +edRadius.value;
    circle.setRadius(v);
    edRadiusVal.textContent = v;
    const rSpan = document.getElementById('iw-radius');
    if (rSpan) rSpan.textContent = v;
  });

  edColor?.addEventListener('input', () => {
    circle.setOptions({ strokeColor: edColor.value, fillColor: edColor.value, zIndex: CIRCLE_Z });
  });

  edSave?.addEventListener('click', () => {
    meta.notes = (edNotes?.value || '').trim();
    // اعادة فتح المحتوى لتحديث النصوص
    openInfoWindow(item, /*reopen*/ true);
    showToast('تم حفظ تعديلات الدائرة');
    persistShareThrottled();
  });

  edDel?.addEventListener('click', () => {
    circle.setMap(null);
    circles = circles.filter(x=>x.id !== item.id);
    infoWin && infoWin.close();
    activeItem = null;
    showToast('تم حذف الدائرة');
    persistShareThrottled();
  });
}

/* ===== فتح الـ InfoWindow على الدائرة ===== */
function openInfoWindow(item, reopen=false){
  activeItem = item;

  if (!infoWin){
    infoWin = new google.maps.InfoWindow({
      content: '', // سنحقن لاحقًا
      maxWidth: 360,
      // pixelOffset خفيفة لعدم تغطية الدائرة تمامًا
      pixelOffset: new google.maps.Size(0, -6),
    });
    // إغلاق غير المُثبت عند إغلاق المستخدم للـ InfoWindow
    infoWin.addListener('closeclick', () => { cardPinned=false; });
  }

  const html = renderInfoContent(item);
  infoWin.setContent(html);
  infoWin.setPosition(item.circle.getCenter());

  // افتح إن لم يكن مفتوحًا، أو أعد تعيين المحتوى فقط
  if (!reopen) infoWin.open({ map });

  // ارتبط بالأحداث الداخلية
  // انتظر frame لضمان أن الـ DOM داخل الـ InfoWindow صار موجودًا
  setTimeout(() => attachInfoEvents(item), 0);
}

/* ===== خريطة Google + دوائر ===== */
function addCircleForLocation(loc){
  const center = new google.maps.LatLng(loc.lat, loc.lng);
  const circle = new google.maps.Circle({
    strokeColor: DEFAULT_COLOR,
    strokeOpacity: 0.95,
    strokeWeight: 2,
    fillColor: DEFAULT_COLOR,
    fillOpacity: DEFAULT_FILL_OPACITY,
    map,
    center,
    radius: DEFAULT_RADIUS,
    clickable: true,
    draggable: false,
    editable: false,
    zIndex: CIRCLE_Z
  });

  // hover → افتح مؤقتًا إن لم يكن مُثبت
  circle.addListener('mouseover', () => { if(!cardPinned) openInfoWindow({id:loc.id, meta:loc, circle}); });
  // mouseout → أغلق إذا ليس مُثبتًا
  circle.addListener('mouseout',  () => { if(!cardPinned && infoWin) infoWin.close(); });
  // click → افتح + ثبّت
  circle.addListener('click',     () => { openInfoWindow({id:loc.id, meta:loc, circle}); cardPinned = true; });

  circles.push({ id: loc.id, circle, meta: { ...loc } });
}

function setMapType(type, silent=false){
  map.setMapTypeId(type);
  btnRoadmap.setAttribute('aria-pressed', String(type==='roadmap'));
  btnSatellite.setAttribute('aria-pressed', String(type!=='roadmap'));
  if(!silent) persistShareThrottled();
}

/* ===== المستلمون / إشعارات ===== */
function getRecipients(){ try{ return (localStorage.getItem('recipients')||'').split(',').map(s=>s.trim()).filter(Boolean); }catch{ return []; } }
function openRecipientsEditor(){ recipientsInput.value = getRecipients().join(', ') || recipientsInput.value || ''; recipientsModal.classList.remove('hidden'); recipientsModal.setAttribute('aria-hidden','false'); }
function closeRecipientsEditor(){ recipientsModal.classList.add('hidden'); recipientsModal.setAttribute('aria-hidden','true'); }
function onSaveRecipients(){ const list=recipientsInput.value.split(',').map(s=>s.trim()).filter(Boolean); try{localStorage.setItem('recipients',list.join(', '));}catch{} showToast('تم الحفظ وتحديث المستلمين'); closeRecipientsEditor(); persistShareThrottled(); }

let toastTimer; 
function showToast(msg){ if(!toast) return; toast.textContent=msg; toast.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.add('hidden'), 2000); }

/* ===== وضع التحرير ===== */
function setEditMode(on){
  editMode = !!on;
  if(shareMode) editMode = false; // حماية
  modeBadge.textContent = editMode ? 'Edit' : 'Share';
  modeBadge.className   = editMode ? 'badge-edit' : 'mode-badge badge-share';

  if(editMode){
    // إن لا يوجد عنصر نشط، افتح أول دائرة
    if(!activeItem && circles.length){
      const first = circles[0];
      openInfoWindow(first);
      cardPinned = true;
    }
  }else{
    // إغلاق أي قائمة تحرير مع ترك InfoWindow كما هو (حسب التثبيت)
    if (infoWin) {
      // لو غير مُثبت، أغلقه
      if(!cardPinned) infoWin.close();
    }
  }
  showToast(editMode ? 'تم تفعيل وضع التحرير' : 'تم إلغاء وضع التحرير');
}

/* ===== initMap ===== */
function initMap(){
  // DOM refs
  btnRoadmap = document.getElementById('btnRoadmap');
  btnSatellite = document.getElementById('btnSatellite');
  btnTraffic = document.getElementById('btnTraffic');
  btnRecipients = document.getElementById('btnRecipients');
  btnEditMode = document.getElementById('btnEditMode');
  modeBadge = document.getElementById('modeBadge');

  recipientsModal = document.getElementById('recipientsModal');
  recipientsInput = document.getElementById('recipientsInput');
  saveRecipients = document.getElementById('saveRecipients');
  cancelRecipients = document.getElementById('cancelRecipients');
  toast = document.getElementById('toast');

  // Map
  map = new google.maps.Map(document.getElementById('map'), {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    mapTypeId: 'roadmap',
    disableDefaultUI: true,
    clickableIcons: false,
    gestureHandling: 'greedy',
  });
  trafficLayer = new google.maps.TrafficLayer();

  // أزرار عليا
  btnRoadmap.addEventListener('click', ()=> setMapType('roadmap'));
  btnSatellite.addEventListener('click', ()=> setMapType('hybrid'));
  btnTraffic.addEventListener('click', ()=>{
    const v = btnTraffic.getAttribute('aria-pressed')==='true';
    if(v){ trafficLayer.setMap(null); btnTraffic.setAttribute('aria-pressed','false'); }
    else { trafficLayer.setMap(map);  btnTraffic.setAttribute('aria-pressed','true'); }
    persistShareThrottled();
  });

  btnRecipients.addEventListener('click', openRecipientsEditor);
  saveRecipients.addEventListener('click', onSaveRecipients);
  cancelRecipients.addEventListener('click', closeRecipientsEditor);

  // دوائر
  LOCATIONS.forEach(addCircleForLocation);

  // اكتشاف وضع المشاركة
  const S = readShareToken();
  shareMode = !!S;
  if(shareMode){
    modeBadge.textContent='Share'; modeBadge.className='mode-badge badge-share';
    applyShareState(S);
  }else{
    recipientsInput.value = getRecipients().join(', ');
    writeShareToken(buildShareState());
  }

  // زر تحرير: لو أنت في Share، امسح الهاش أولًا
  btnEditMode.addEventListener('click', ()=>{
    if(shareMode){ history.replaceState(null,'',location.pathname); shareMode=false; }
    setEditMode(!editMode);
  });

  // تحديث الرابط عند التحريك/التكبير
  map.addListener('idle', persistShareThrottled);
}

// تأكيد توفير initMap قبل سكربت Google
window.initMap = initMap;

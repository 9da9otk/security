/*
  Security Map – Share Mode (v2.1)
  - إصلاح عدم ظهور الخريطة بعد التعديل: ترتيب تحميل مؤكد + حراسة للأخطاء
  - رابط مشاركة قصير #s=TOKEN&t=.. يحمل كل الإعدادات (map type/traffic/recipients/circles/center/zoom)
  - robust guards: try/catch، فحص عناصر DOM، fallback آمن عند فشل token
*/

let map, trafficLayer;
let cardPinned = false;
let circles = [];
let _persistTimer = null;

// ===== عناصر الواجهة (نتأكد لاحقًا داخل initMap) =====
let btnRoadmap, btnSatellite, btnTraffic, btnRecipients;
let infoCard, infoTitle, infoSubtitle, infoLatLng, infoRadius, infoNotesRow, infoNotes, pinCard, closeCard;
let recipientsModal, recipientsInput, saveRecipients, cancelRecipients;
let toast;

// ===== إعدادات عامة =====
const DEFAULT_ZOOM = 16;
const DEFAULT_CENTER = { lat: 24.7399, lng: 46.5731 }; // Diriyah
const DEFAULT_RADIUS = 15; // m
const DEFAULT_COLOR = '#c1a476';
const DEFAULT_FILL_OPACITY = 0.15;

// ===== مواقع افتراضية (أكمل قائمتك) =====
const LOCATIONS = [
  { id: 0, name: "Samhan Gate", lat: 24.742132355539432, lng: 46.56966664740594, notes: "بوابة سَمْحان" },
  { id: 1, name: "Al-Bujairi Roundabout", lat: 24.73754835059363, lng: 46.57401116325427, notes: "دوار البجيري" },
  { id: 2, name: "King Salman Square", lat: 24.73647, lng: 46.57254, notes: "ميدان الملك سلمان" },
  { id: 3, name: "AlMozah Roundabout", lat: 24.743980167228152, lng: 46.56606089138615, notes: "دوار الموزة" },
];

// ================= مشاركة: ترميز/فك ترميز =================
function encodeState(obj){
  try{
    const json = JSON.stringify(obj);
    const b64 = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    return b64;
  }catch{ return ""; }
}
function decodeState(token){
  try{
    const b64 = token.replace(/-/g,'+').replace(/_/g,'/');
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json);
  }catch{ return null; }
}
function writeShareToken(state){
  try{
    const token = encodeState(state);
    const t = Date.now().toString(36).slice(-6); // كاسر كاش
    const hash = `#s=${token}&t=${t}`;
    if (location.hash !== hash) history.replaceState(null, '', hash);
  }catch(e){ /* ignore */ }
}
function readShareToken(){
  try{
    if (!location.hash) return null;
    const q = new URLSearchParams(location.hash.slice(1));
    const s = q.get('s');
    if (!s) return null;
    const obj = decodeState(s);
    return obj && typeof obj === 'object' ? obj : null;
  }catch{ return null; }
}

// يبني الحالة الحالية من الخريطة والواجهة
function buildShareState(){
  if (!map) return {};
  // نوع الخريطة
  const type = (map.getMapTypeId && map.getMapTypeId() === 'roadmap') ? 'r' : 'h';
  // المرور
  const trafficOn = (btnTraffic && btnTraffic.getAttribute('aria-pressed') === 'true') ? 1 : 0;
  // المستلمين
  const recipients = recipientsInput ? (recipientsInput.value.trim()) : "";
  // الدوائر
  const c = circles.map(({id, circle}) => {
    const r  = Math.round(circle.getRadius());
    // Google Circle لا يعرّض خصائص مباشرة، لذلك نقرأ من options الحالية إن وجدت
    const sc = (circle.get('strokeColor') || DEFAULT_COLOR).replace('#','');
    const fo = Number((circle.get('fillOpacity') ?? DEFAULT_FILL_OPACITY).toFixed(2));
    return [id, r, sc, fo];
  });
  // موضع الخريطة
  const center = map.getCenter();
  const cy = +center.lat().toFixed(6);
  const cx = +center.lng().toFixed(6);
  const z = map.getZoom();

  return { m: type, tr: trafficOn, rcp: recipients, c, cx, cy, z };
}

// يطبّق حالة المشاركة
function applyShareState(s){
  try{
    if (!s) return;

    if (Number.isFinite(s.cy) && Number.isFinite(s.cx)) {
      map.setCenter({ lat: s.cy, lng: s.cx });
    }
    if (Number.isFinite(s.z)) map.setZoom(s.z);

    setMapType(s.m === 'r' ? 'roadmap' : 'hybrid', /*silent*/true);

    if (s.tr) { trafficLayer.setMap(map); btnTraffic.setAttribute('aria-pressed','true'); }
    else      { trafficLayer.setMap(null); btnTraffic.setAttribute('aria-pressed','false'); }

    if (typeof s.rcp === 'string') {
      recipientsInput.value = s.rcp;
      localStorage.setItem('recipients', s.rcp);
    }

    if (Array.isArray(s.c)) {
      s.c.forEach(([id, r, sc, fo]) => {
        const item = circles.find(x => x.id === id);
        if (item) {
          if (Number.isFinite(r)) item.circle.setRadius(r);
          if (sc) item.circle.setOptions({ strokeColor: `#${sc}`, fillColor: `#${sc}` });
          if (Number.isFinite(fo)) item.circle.setOptions({ fillOpacity: fo });
        }
      });
    }
  }catch(e){ console.warn('applyShareState error', e); }
}

// حفظ مؤجل (يمنع الكتابة كل millisecond أثناء التحريك)
function persistShareThrottled(){
  clearTimeout(_persistTimer);
  _persistTimer = setTimeout(()=> writeShareToken(buildShareState()), 250);
}

// ================= خريطة Google =================
function addCircleForLocation(loc){
  const center = new google.maps.LatLng(loc.lat, loc.lng);
  const circle = new google.maps.Circle({
    strokeColor: DEFAULT_COLOR,
    strokeOpacity: 0.9,
    strokeWeight: 2,
    fillColor: DEFAULT_COLOR,
    fillOpacity: DEFAULT_FILL_OPACITY,
    map,
    center,
    radius: DEFAULT_RADIUS,
    clickable: true,
    draggable: false,
    editable: false,
  });

  circle.addListener('mouseover', () => { if(!cardPinned){ showInfo(loc, circle); } });
  circle.addListener('mouseout',  () => { if(!cardPinned){ hideInfoCard(); } });
  circle.addListener('click', () => {
    showInfo(loc, circle);
    cardPinned = true;
    if (pinCard) pinCard.setAttribute('aria-pressed','true');
  });

  circles.push({ id: loc.id, circle, meta: loc });
}

function setMapType(type, silent=false){
  if (!map) return;
  map.setMapTypeId(type);
  if (btnRoadmap && btnSatellite){
    btnRoadmap.setAttribute('aria-pressed', String(type === 'roadmap'));
    btnSatellite.setAttribute('aria-pressed', String(type !== 'roadmap'));
  }
  if (!silent) persistShareThrottled();
}

function toggleTraffic(){
  if (!map || !trafficLayer) return;
  const visible = btnTraffic.getAttribute('aria-pressed') === 'true';
  if (visible){
    trafficLayer.setMap(null);
    btnTraffic.setAttribute('aria-pressed','false');
  } else {
    trafficLayer.setMap(map);
    btnTraffic.setAttribute('aria-pressed','true');
  }
  persistShareThrottled();
}

function showInfo(loc, circle){
  if (!infoCard) return;
  const c = circle.getCenter();
  if (infoTitle) infoTitle.textContent = loc.name || '—';
  if (infoSubtitle) infoSubtitle.textContent = loc.notes || '';
  if (infoLatLng) infoLatLng.textContent = `${c.lat().toFixed(6)}, ${c.lng().toFixed(6)}`;
  if (infoRadius) infoRadius.textContent = `${Math.round(circle.getRadius())} م`;

  if (loc.notes && infoNotes && infoNotesRow){
    infoNotes.textContent = loc.notes;
    infoNotesRow.classList.remove('hidden');
  } else if (infoNotesRow){
    infoNotesRow.classList.add('hidden');
  }

  infoCard.classList.remove('hidden');
}
function hideInfoCard(){ if (infoCard) infoCard.classList.add('hidden'); }

// ================= المستلمون =================
function getRecipients(){
  try{
    const raw = localStorage.getItem('recipients') || '';
    return raw.split(',').map(s=>s.trim()).filter(Boolean);
  }catch{ return []; }
}
function openRecipientsEditor(){
  if (!recipientsModal) return;
  recipientsInput.value = getRecipients().join(', ') || recipientsInput.value || '';
  recipientsModal.classList.remove('hidden');
  recipientsModal.setAttribute('aria-hidden','false');
}
function closeRecipientsEditor(){
  if (!recipientsModal) return;
  recipientsModal.classList.add('hidden');
  recipientsModal.setAttribute('aria-hidden','true');
}
function onSaveRecipients(){
  const list = recipientsInput.value.split(',').map(s=>s.trim()).filter(Boolean);
  try{ localStorage.setItem('recipients', list.join(', ')); }catch{}
  persistShareThrottled();
  showToast('تم الحفظ وتحديث المستلمين');
  closeRecipientsEditor();
}

// ================= إشعار =================
let toastTimer;
function showToast(msg){
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toast.classList.add('hidden'), 2200);
}

// ================= initMap =================
function initMap(){
  // اجلب عناصر الواجهة بأمان هنا (DOM جاهز مع defer)
  btnRoadmap     = document.getElementById('btnRoadmap');
  btnSatellite   = document.getElementById('btnSatellite');
  btnTraffic     = document.getElementById('btnTraffic');
  btnRecipients  = document.getElementById('btnRecipients');

  infoCard       = document.getElementById('infoCard');
  infoTitle      = document.getElementById('infoTitle');
  infoSubtitle   = document.getElementById('infoSubtitle');
  infoLatLng     = document.getElementById('infoLatLng');
  infoRadius     = document.getElementById('infoRadius');
  infoNotesRow   = document.getElementById('infoNotesRow');
  infoNotes      = document.getElementById('infoNotes');
  pinCard        = document.getElementById('pinCard');
  closeCard      = document.getElementById('closeCard');

  recipientsModal= document.getElementById('recipientsModal');
  recipientsInput= document.getElementById('recipientsInput');
  saveRecipients = document.getElementById('saveRecipients');
  cancelRecipients=document.getElementById('cancelRecipients');

  toast          = document.getElementById('toast');

  // أنشئ الخريطة (مع حراسة استثنائية)
  try{
    map = new google.maps.Map(document.getElementById('map'), {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      mapTypeId: 'roadmap',
      disableDefaultUI: true,
      clickableIcons: false,
      gestureHandling: 'greedy',
    });
  }catch(e){
    console.error('Google Map init error', e);
    showToast('تعذّر تحميل الخريطة. تحقّق من مفتاح Google/API.');
    return;
  }

  trafficLayer = new google.maps.TrafficLayer();

  // ربط الأزرار
  if (btnRoadmap)   btnRoadmap.addEventListener('click', () => setMapType('roadmap'));
  if (btnSatellite) btnSatellite.addEventListener('click', () => setMapType('hybrid'));
  if (btnTraffic)   btnTraffic.addEventListener('click', toggleTraffic);

  if (btnRecipients) btnRecipients.addEventListener('click', openRecipientsEditor);
  if (saveRecipients) saveRecipients.addEventListener('click', onSaveRecipients);
  if (cancelRecipients) cancelRecipients.addEventListener('click', closeRecipientsEditor);

  if (pinCard) pinCard.addEventListener('click', () => {
    cardPinned = !cardPinned;
    pinCard.setAttribute('aria-pressed', String(cardPinned));
    showToast(cardPinned ? 'تم تثبيت الكرت' : 'تم إلغاء تثبيت الكرت');
  });
  if (closeCard) closeCard.addEventListener('click', () => { cardPinned = false; hideInfoCard(); });

  // أضف الدوائر
  LOCATIONS.forEach(addCircleForLocation);

  // طبّق حالة المشاركة إن وُجدت، وإلا جهّز مستلمين البداية واكتب رابط أولي
  const S = readShareToken();
  if (S) {
    applyShareState(S);
  } else {
    try { recipientsInput.value = getRecipients().join(', '); } catch{}
    persistShareThrottled();
  }

  // حدّث الرابط بعد تحريك/تكبير (بـ throttle)
  map.addListener('idle', persistShareThrottled);
}

// اجعلها متاحة قبل تحميل سكربت Google (منع السباق)
window.initMap = initMap;

// ================= ملاحظات =================
// - إذا بقيت الخلفية فقط بدون طبقات: تأكد من صلاحيات مفتاح Google على نطاق Render.
// - 404 favicon.ico غير مؤثر.

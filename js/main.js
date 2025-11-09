/* Diriyah Security Map – Glass Info Card + Edit Recipients */

let map, trafficLayer;
let infoWin = null;
let cardPinned = false;      // يُثبَّت عند الضغط على الدائرة
let editMode  = false;       // زر التحرير من الشريط
let hideTimer = null;

// عناصر الشريط
let btnRoadmap, btnSatellite, btnTraffic, btnEditMode, modeBadge;

/* نقاط الدوائر + بيانات (أسماء مستلمين لكل نقطة) */
const LOCATIONS = [
  { id: 0,  name: "بوابة سمحان",                          lat: 24.742132284177778, lng: 46.569503913805825, recipients: [] },
  { id: 1,  name: "منطقة سمحان",                          lat: 24.74091335108621,  lng: 46.571891407130025, recipients: [] },
  { id: 2,  name: "دوار البجيري",                         lat: 24.737521801476476, lng: 46.57406918772067,  recipients: [] },
  { id: 3,  name: "إشارة البجيري",                        lat: 24.73766260194535,  lng: 46.575429040147306, recipients: [] },
  { id: 4,  name: "طريق الملك فيصل",                      lat: 24.736133848943062, lng: 46.57696607050239,  recipients: [] },
  { id: 5,  name: "نقطة فرز الشلهوب",                     lat: 24.73523670533632,  lng: 46.57785639752234,  recipients: [] },
  { id: 6,  name: "المسار الرياضي المديد",                lat: 24.735301077804944, lng: 46.58178092599035,  recipients: [] },
  { id: 7,  name: "ميدان الملك سلمان",                    lat: 24.73611373368281,  lng: 46.58407097038162,  recipients: [] },
  { id: 8,  name: "دوار الضوء الخافت",                     lat: 24.739718342668006, lng: 46.58352614787052,  recipients: [] },
  { id: 9,  name: "المسار الرياضي طريق الملك خالد الفرعي", lat: 24.740797019998627, lng: 46.5866145907347,   recipients: [] },
  { id:10,  name: "دوار البلدية",                          lat: 24.739266101368777, lng: 46.58172727078356,  recipients: [] },
  { id:11,  name: "مدخل ساحة البلدية الفرعي",             lat: 24.738638518378387, lng: 46.579858026042785, recipients: [] },
  { id:12,  name: "مدخل مواقف البجيري (كار بارك)",        lat: 24.73826438056506,  lng: 46.57789576275729,  recipients: [] },
  { id:13,  name: "مواقف الامن",                           lat: 24.73808736962705,  lng: 46.57771858346317,  recipients: [] },
  { id:14,  name: "دوار الروقية",                          lat: 24.741985907266145, lng: 46.56269186990043,  recipients: [] },
  { id:15,  name: "بيت مبارك",                             lat: 24.732609768937607, lng: 46.57827089439368,  recipients: [] },
  { id:16,  name: "دوار وادي صفار",                        lat: 24.72491458984474,  lng: 46.57345489743978,  recipients: [] },
  { id:17,  name: "دوار راس النعامة",                      lat: 24.710329841152387, lng: 46.572921959358204, recipients: [] },
  { id:18,  name: "مزرعة الحبيب",                          lat: 24.709445443672344, lng: 46.593971867951346, recipients: [] },
];

// إعدادات دوائر افتراضية
const DEFAULT_RADIUS = 15;
const DEFAULT_COLOR  = '#c1a476';
const DEFAULT_FILL_OPACITY = 0.15;

function initMap(){
  // مراجع الشريط
  btnRoadmap  = document.getElementById('btnRoadmap');
  btnSatellite= document.getElementById('btnSatellite');
  btnTraffic  = document.getElementById('btnTraffic');
  btnEditMode = document.getElementById('btnEditMode');
  modeBadge   = document.getElementById('modeBadge');

  // الخريطة
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 24.7399, lng: 46.5731 },
    zoom: 15,
    mapTypeId: 'roadmap',
    disableDefaultUI: true,
    clickableIcons: false,
    gestureHandling: 'greedy',
  });

  trafficLayer = new google.maps.TrafficLayer();

  // أزرار العرض
  btnRoadmap.addEventListener('click', () => {
    map.setMapTypeId('roadmap');
    btnRoadmap.setAttribute('aria-pressed','true');
    btnSatellite.setAttribute('aria-pressed','false');
  });
  btnSatellite.addEventListener('click', () => {
    map.setMapTypeId('hybrid');
    btnSatellite.setAttribute('aria-pressed','true');
    btnRoadmap.setAttribute('aria-pressed','false');
  });
  btnTraffic.addEventListener('click', () => {
    const active = btnTraffic.getAttribute('aria-pressed') === 'true';
    if (active) { trafficLayer.setMap(null);  btnTraffic.setAttribute('aria-pressed','false'); }
    else        { trafficLayer.setMap(map);   btnTraffic.setAttribute('aria-pressed','true');  }
  });

  // وضع التحرير
  btnEditMode.addEventListener('click', () => {
    editMode = !editMode;
    modeBadge.textContent = editMode ? 'Edit' : 'Share';
    modeBadge.className = 'badge ' + (editMode ? 'badge-edit' : 'badge-share');
    // عند التبديل لإلغاء تثبيت قديم
    cardPinned = false;
    if (infoWin) infoWin.close();
  });

  // إغلاق الكرت عند الضغط على الخريطة
  map.addListener('click', () => { cardPinned = false; if (infoWin) infoWin.close(); });

  // دوائر
  LOCATIONS.forEach(addCircle);
}

/* إنشاء دائرة وإضافة تفاعلاتها */
function addCircle(loc){
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
    zIndex: 9999
  });

  const item = { id: loc.id, circle, meta: loc };

  circle.addListener('mouseover', () => {
    clearTimeout(hideTimer);
    if (!cardPinned) openInfo(item);
  });
  circle.addListener('mouseout', () => {
    if (cardPinned) return;
    hideTimer = setTimeout(() => { if (infoWin) infoWin.close(); }, 120);
  });
  circle.addListener('click', () => {
    openInfo(item);
    cardPinned = true; // تثبيت
  });
}

function openInfo(item){
  if (!infoWin){
    infoWin = new google.maps.InfoWindow({ content: '', maxWidth: 400, pixelOffset: new google.maps.Size(0,-6) });
  }
  infoWin.setContent(renderInfoHTML(item));
  infoWin.setPosition(item.circle.getCenter());
  infoWin.open({ map });

  // أخفِ زر الإغلاق والذيل وخلفية الفقاعة (ليظهر الكرت الزجاجي فقط)
  setTimeout(() => {
    const root = document.getElementById('iw-root');
    if (!root) return;
    const closeBtn = root.parentElement?.querySelector('.gm-ui-hover-effect');
    if (closeBtn) closeBtn.style.display = 'none';
    const iw = root.closest('.gm-style-iw');
    if (iw && iw.parentElement){
      iw.parentElement.style.background = 'transparent';
      iw.parentElement.style.boxShadow = 'none';
      const tail = iw.parentElement.previousSibling;
      if (tail && tail.style) tail.style.display = 'none';
    }
    attachInfoEvents(item);
  }, 0);
}

/* محتوى الكرت الزجاجي + محرر المستلمين في وضع التحرير */
function renderInfoHTML(item){
  const meta  = item.meta;
  const names = Array.isArray(meta.recipients) ? meta.recipients : [];
  const namesHTML = names.length
    ? `<ol style="margin:6px 0 0 0;padding-inline-start:20px;">
         ${names.map(n => `<li>${escapeHtml(n)}</li>`).join('')}
       </ol>`
    : `<div style="color:#777;font-size:12px;margin-top:4px;">لا توجد أسماء مضافة</div>`;

  return `
    <div id="iw-root" dir="rtl" style="min-width:260px;max-width:380px;">
      <div style="
        background: rgba(255,255,255,.82);
        backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(0,0,0,.06);
        border-radius: 16px; padding: 10px 12px; color:#111;
        box-shadow: 0 12px 28px rgba(0,0,0,.18);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <img src="img/diriyah-logo.png" alt="Diriyah" style="width:40px;height:40px;object-fit:contain;">
          <div style="line-height:1.2;">
            <div style="font-weight:800;font-size:16px;">${escapeHtml(meta.name)}</div>
          </div>
          <div style="margin-inline-start:auto;display:flex;gap:6px;">
            ${editMode ? `<button id="iw-gear" title="تحرير" style="border:1px solid #ddd;padding:2px 6px;border-radius:8px;background:#fff;">⚙️</button>` : ``}
          </div>
        </div>

        <div style="border-top:1px dashed #eaeaea; padding-top:6px;">
          <div style="font-weight:700;margin-bottom:4px;">المستلمون:</div>
          ${namesHTML}
        </div>

        ${editMode ? `
        <div id="iw-edit" style="margin-top:10px;border:1px solid #eee;border-radius:10px;padding:8px;background:#fafafa;display:none;">
          <div style="font-size:12px;color:#666;margin-bottom:6px;">اكتب اسمًا في كل سطر (يُحافظ على الترتيب).</div>
          <textarea id="ed-recipients" rows="5" style="width:100%;background:#fff;border:1px solid #ddd;border-radius:8px;padding:8px;white-space:pre;">${escapeHtml(names.join("\n"))}</textarea>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button id="ed-save" style="border:1px solid #ddd;padding:6px 10px;border-radius:8px;background:#fff;cursor:pointer;">حفظ</button>
            <button id="ed-clear" style="border:1px solid #ddd;padding:6px 10px;border-radius:8px;background:#fff;cursor:pointer;">حذف جميع الأسماء</button>
          </div>
        </div>` : ``}
      </div>
    </div>`;
}

function attachInfoEvents(item){
  if (!editMode) return;
  const gear   = document.getElementById('iw-gear');
  const editor = document.getElementById('iw-edit');
  const input  = document.getElementById('ed-recipients');
  const save   = document.getElementById('ed-save');
  const clear  = document.getElementById('ed-clear');

  gear?.addEventListener('click', () => {
    if (!editor) return;
    editor.style.display = editor.style.display === 'none' ? 'block' : 'none';
  });

  save?.addEventListener('click', () => {
    item.meta.recipients = parseRecipients(input.value);
    openInfo(item, true); // إعادة تحديث العرض
  });

  clear?.addEventListener('click', () => {
    item.meta.recipients = [];
    openInfo(item, true);
  });
}

/* أدوات مساعدة */
function parseRecipients(text){
  return String(text)
    .split(/\r?\n/)
    .map(s => s.replace(/[،;,]+/g,' ').trim())
    .filter(Boolean);
}
function escapeHtml(s){
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

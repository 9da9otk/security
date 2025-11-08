/* =========================================================
   خريطة الأمن — ملف رئيسي كامل
   - يدعم وضع التحرير ووضع العرض (?view=1)
   - كرت معلومات عند التحويم/الضغط
   - طبقات (Traffic/Transit/Bicycle) وتغيير نوع الخريطة
   - مشاركة حالة الخريطة والدوائر عبر الرابط
   ========================================================= */

let map;
let trafficLayer, transitLayer, bikeLayer;
let circles = [];            // [{ circle, meta }]
let selected = null;         // { circle, meta }
const infoWin = new google.maps.InfoWindow();

// عناصر الواجهة
const els = {};
function qs(id){ return document.getElementById(id); }

const isViewMode = new URLSearchParams(location.search).get('view') === '1';

/* ---------- تهيئة الخريطة ---------- */
window.initMap = function initMap(){
  // مركز الدرعية الافتراضي
  const center = { lat: 24.7365, lng: 46.5759 };

  map = new google.maps.Map(qs('map'), {
    center,
    zoom: 14,
    mapTypeId: 'roadmap',
    clickableIcons: true,
    gestureHandling: 'greedy',
    streetViewControl: false,
    fullscreenControl: false,
    mapId: '' // يمكن تركه فارغاً
  });

  // طبقات
  trafficLayer = new google.maps.TrafficLayer();
  transitLayer = new google.maps.TransitLayer();
  bikeLayer    = new google.maps.BicyclingLayer();

  cacheDom();
  bindUi();

  // إذا الرابط يحوي بيانات عرض
  const dataParam = new URLSearchParams(location.search).get('data');
  if (dataParam){
    try{
      const decoded = JSON.parse(atob(decodeURIComponent(dataParam)));
      loadFromPayload(decoded, /*editing*/ !isViewMode);
    }catch(e){ console.warn('Bad payload', e); }
  }

  // تأكد من ترتيب الطبقات
  ensureUiOnTop();
};

/* ---------- DOM ---------- */
function cacheDom(){
  els.layersBox     = qs('layersBox');
  els.mapTypeSelect = qs('mapTypeSelect');
  els.layerTraffic  = qs('layerTraffic');
  els.layerTransit  = qs('layerTransit');
  els.layerBike     = qs('layerBike');

  els.panel         = qs('editorPanel');
  els.addBtn        = qs('addCircleBtn');
  els.shareBtn      = qs('shareBtn');
  els.siteName      = qs('siteName');
  els.names         = qs('securityNames');
  els.notes         = qs('notes');
  els.fillColor     = qs('fillColor');
  els.strokeColor   = qs('strokeColor');
  els.fillOpacity   = qs('fillOpacity');
  els.radius        = qs('radius');
  els.dragToggle    = qs('dragToggle');
  els.editToggle    = qs('editToggle');

  if (isViewMode){
    // إخفاء لوحة التحرير في وضع العرض
    els.panel.style.display = 'none';
  }
}

function ensureUiOnTop(){
  const mapEl = qs('map');
  if (mapEl){ mapEl.style.position = 'fixed'; mapEl.style.inset = '0'; mapEl.style.zIndex = '0'; }
  if (els.layersBox){ els.layersBox.style.position = 'fixed'; els.layersBox.style.zIndex = '100000'; }
  if (els.panel){ els.panel.style.position = 'fixed'; els.panel.style.zIndex = '100001'; }
}

/* ---------- ربط الواجهة ---------- */
function bindUi(){
  // نوع الخريطة
  els.mapTypeSelect.addEventListener('change', () => {
    map.setMapTypeId(els.mapTypeSelect.value);
  });

  // طبقات إضافية
  els.layerTraffic.addEventListener('change', () => {
    trafficLayer.setMap(els.layerTraffic.checked ? map : null);
  });
  els.layerTransit.addEventListener('change', () => {
    transitLayer.setMap(els.layerTransit.checked ? map : null);
  });
  els.layerBike.addEventListener('change', () => {
    bikeLayer.setMap(els.layerBike.checked ? map : null);
  });

  if (!isViewMode){
    // إضافة دائرة جديدة عند المركز الحالي
    els.addBtn.addEventListener('click', () => {
      const c = createCircle({
        center: map.getCenter().toJSON(),
        radius: 15,
        draggable: false,   // افتراضياً غير قابلة للسحب كما طلبت
        editable: false,    // وافتراضياً غير قابلة لتغيير الحجم
        title: '',
        names: [],
        notes: '',
        fillColor: els.fillColor.value || '#a78bfa',
        strokeColor: els.strokeColor.value || '#7c3aed',
        fillOpacity: parseFloat(els.fillOpacity.value || '0.25')
      });
      selectCircle(c);
    });

    // مشاركة
    els.shareBtn.addEventListener('click', shareMap);

    // الحقول — نحدّث الميتا بدون إعادة حقن النص (لتجنّب مشكلة تحرك المؤشر)
    els.siteName.addEventListener('input', () => {
      if (selected){ selected.meta.title = els.siteName.value.trim(); refreshInfo(selected); }
    });
    els.names.addEventListener('input', () => {
      if (selected){
        selected.meta.names = els.names.value.split('\n').map(s=>s.trim()).filter(Boolean);
        refreshInfo(selected);
      }
    });
    els.notes.addEventListener('input', () => {
      if (selected){ selected.meta.notes = els.notes.value; }
    });
    els.fillColor.addEventListener('input', () => {
      if (selected){ selected.circle.setOptions({ fillColor: els.fillColor.value }); }
    });
    els.strokeColor.addEventListener('input', () => {
      if (selected){ selected.circle.setOptions({ strokeColor: els.strokeColor.value }); }
    });
    els.fillOpacity.addEventListener('input', () => {
      if (selected){ selected.circle.setOptions({ fillOpacity: parseFloat(els.fillOpacity.value) }); }
    });
    els.radius.addEventListener('input', () => {
      if (selected){ selected.circle.setRadius(parseFloat(els.radius.value||'15')); }
    });
    els.dragToggle.addEventListener('change', () => {
      if (selected){ selected.circle.setDraggable(!!els.dragToggle.checked); }
    });
    els.editToggle.addEventListener('change', () => {
      if (selected){ selected.circle.setEditable(!!els.editToggle.checked); }
    });
  }else{
    // وضع العرض: تعطيل الطبقات الافتراضية — يسمح للمشاهد بتبديلها فقط
    els.layerTraffic.addEventListener('change', () => {
      trafficLayer.setMap(els.layerTraffic.checked ? map : null);
    });
    els.layerTransit.addEventListener('change', () => {
      transitLayer.setMap(els.layerTransit.checked ? map : null);
    });
    els.layerBike.addEventListener('change', () => {
      bikeLayer.setMap(els.layerBike.checked ? map : null);
    });
  }
}

/* ---------- إنشاء دائرة وربط الكرت ---------- */
function createCircle(meta){
  const circle = new google.maps.Circle({
    map,
    center: meta.center,
    radius: meta.radius ?? 15,
    fillColor: meta.fillColor ?? '#a78bfa',
    fillOpacity: meta.fillOpacity ?? 0.25,
    strokeColor: meta.strokeColor ?? '#7c3aed',
    strokeOpacity: 1,
    strokeWeight: 2,
    draggable: !!meta.draggable,
    editable: !!meta.editable,
    clickable: true
  });

  const entry = { circle, meta: {
    title: meta.title || '',
    names: Array.isArray(meta.names) ? meta.names : [],
    notes: meta.notes || ''
  }};
  circles.push(entry);

  attachInfoWindow(entry);

  if (!isViewMode){
    circle.addListener('click', () => selectCircle(entry));
    circle.addListener('dragend', () => refreshInfo(entry));
    circle.addListener('radius_changed', () => refreshInfo(entry));
    circle.addListener('center_changed', () => refreshInfo(entry));
  }else{
    // للجوال عند العرض: النقر يفتح/يغلق
    let opened = false;
    circle.addListener('click', () => {
      opened = !opened;
      if (opened){
        infoWin.setContent(infoContent(entry.meta));
        infoWin.setPosition(circle.getCenter());
        infoWin.open(map);
      }else{
        infoWin.close();
      }
    });
  }

  return entry;
}

/* ---------- كرت المعلومات ---------- */
function infoContent(meta){
  const namesHtml = (meta.names||[]).map(n=>`<li>${n}</li>`).join('');
  return `
    <div class="info-card">
      <div class="title">${meta.title || 'موقع بدون اسم'}</div>
      ${
        namesHtml
          ? `<div class="tag">الأمن:</div><ul>${namesHtml}</ul>`
          : `<div class="tag">لا يوجد أسماء مُسجلة.</div>`
      }
    </div>
  `;
}
function attachInfoWindow(entry){
  const {circle, meta} = entry;
  circle.addListener('mouseover', () => {
    infoWin.setContent(infoContent(meta));
    infoWin.setPosition(circle.getCenter());
    infoWin.open(map);
  });
  circle.addListener('mousemove', () => {
    infoWin.setPosition(circle.getCenter());
  });
  circle.addListener('mouseout', () => infoWin.close());
}
function refreshInfo(entry){
  // تحديث الكرت المفتوح إن كان على نفس الدائرة
  if (infoWin.getMap()){
    infoWin.setContent(infoContent(entry.meta));
    infoWin.setPosition(entry.circle.getCenter());
  }
}

/* ---------- اختيار دائرة وملء النموذج ---------- */
function selectCircle(entry){
  selected = entry;
  // ملء الحقول دون إعادة ضبط قيمة textarea (تجنّب قفز المؤشر)
  els.siteName.value  = entry.meta.title || '';
  els.names.value     = (entry.meta.names||[]).join('\n');
  els.notes.value     = entry.meta.notes || '';
  els.fillColor.value = entry.circle.get('fillColor');
  els.strokeColor.value = entry.circle.get('strokeColor');
  els.fillOpacity.value = entry.circle.get('fillOpacity');
  els.radius.value = Math.round(entry.circle.getRadius());
  els.dragToggle.checked = !!entry.circle.getDraggable();
  els.editToggle.checked = !!entry.circle.getEditable();
}

/* ---------- المشاركة/الحفظ في الرابط ---------- */
function buildPayload(){
  return {
    map: {
      c: map.getCenter().toJSON(),
      z: map.getZoom(),
      t: map.getMapTypeId()
    },
    circles: circles.map(e => ({
      c: e.circle.getCenter().toJSON(),
      r: e.circle.getRadius(),
      fc: e.circle.get('fillColor'),
      fo: e.circle.get('fillOpacity'),
      sc: e.circle.get('strokeColor'),
      t: e.meta.title,
      n: e.meta.names,
      note: e.meta.notes
    }))
  };
}
function shareMap(){
  const payload = buildPayload();
  const data = encodeURIComponent(btoa(JSON.stringify(payload)));
  const shareUrl = `${location.origin}${location.pathname}?view=1&data=${data}`;
  navigator.clipboard?.writeText(shareUrl).catch(()=>{});
  alert('تم نسخ رابط المشاركة إلى الحافظة.\nيمكنك لصقه وإرساله.');
}

/* ---------- تحميل من البيانات ---------- */
function loadFromPayload(payload, editing){
  try{
    if (payload.map){
      map.setCenter(payload.map.c);
      if (payload.map.z) map.setZoom(payload.map.z);
      if (payload.map.t) map.setMapTypeId(payload.map.t);
    }
    (payload.circles||[]).forEach(item => {
      createCircle({
        center: item.c,
        radius: item.r,
        fillColor: item.fc,
        fillOpacity: item.fo,
        strokeColor: item.sc,
        title: item.t,
        names: item.n,
        notes: item.note,
        draggable: !!editing && false,   // افتراضياً غير قابل للسحب
        editable:  !!editing && false    // وغير قابل لتغيير الحجم
      });
    });
  }catch(e){ console.error(e); }
}

/* ---------- احترازي: اجعل الواجهة فوق الخريطة حتى لو تغيرت الأنماط ---------- */
ensureUiOnTop();

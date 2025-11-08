/* ============ خريطة الأمن - سكربت رئيسي ============ */

let map;
let trafficLayer, transitLayer, bikeLayer;

/* حماية من التهيئة المكررة */
function markBootstrapped() {
  window.__mapBootstrapped = true;
}

/* ============ initMap: تُستدعى من callback خرائط قوقل ============ */
window.initMap = function initMap() {
  if (window.__mapBootstrapped) return;

  const mapEl = document.getElementById('map');
  if (!mapEl) {
    console.error('لم يتم العثور على عنصر الخريطة #map');
    return;
  }

  /* مركز الدرعية */
  const center = { lat: 24.7419, lng: 46.5756 };

  /* إنشاء الخريطة */
  map = new google.maps.Map(mapEl, {
    center,
    zoom: 15,
    mapTypeId: 'roadmap',
    mapTypeControl: false,
    fullscreenControl: true,
    streetViewControl: false,
    rotateControl: false,
    gestureHandling: 'greedy',   // تفاعل أفضل على الجوال
    disableDefaultUI: false
  });

  // ** لضمان إعادة الرسم عند تغيّر حجم اللوحات **
  requestAnimationFrame(() => google.maps.event.trigger(map, 'resize'));

  // طبقات إضافية
  trafficLayer = new google.maps.TrafficLayer();
  transitLayer = new google.maps.TransitLayer();
  bikeLayer    = new google.maps.BicyclingLayer();

  // ربط واجهة الطبقات
  bindLayersUI();

  // ربط لوحة التحرير (هنا فقط تحضير – ميزات الإضافة/الحفظ… إلخ حسب كودك)
  bindEditorUI();

  // مثال: دوائر جاهزة (يمكنك إزالة المثال إن أردت)
  addExampleCircles();

  markBootstrapped();
};

/* ====== ربط عناصر واجهة الطبقات ====== */
function bindLayersUI() {
  const mapTypeSelect = document.getElementById('mapTypeSelect');
  const chkTraffic    = document.getElementById('layerTraffic');
  const chkTransit    = document.getElementById('layerTransit');
  const chkBike       = document.getElementById('layerBike');

  if (mapTypeSelect) {
    mapTypeSelect.addEventListener('change', () => {
      try {
        map.setMapTypeId(mapTypeSelect.value);
      } catch (e) {}
    });
  }

  if (chkTraffic) {
    chkTraffic.addEventListener('change', () => {
      chkTraffic.checked ? trafficLayer.setMap(map) : trafficLayer.setMap(null);
    });
  }
  if (chkTransit) {
    chkTransit.addEventListener('change', () => {
      chkTransit.checked ? transitLayer.setMap(map) : transitLayer.setMap(null);
    });
  }
  if (chkBike) {
    chkBike.addEventListener('change', () => {
      chkBike.checked ? bikeLayer.setMap(map) : bikeLayer.setMap(null);
    });
  }
}

/* ====== ربط لوحة التحرير الأساسية ====== */
function bindEditorUI() {
  const addCircleBtn   = document.getElementById('addCircleBtn');
  const shareBtn       = document.getElementById('shareBtn');

  const siteName       = document.getElementById('siteName');
  const securityNames  = document.getElementById('securityNames');
  const notes          = document.getElementById('notes');
  const fillColor      = document.getElementById('fillColor');
  const strokeColor    = document.getElementById('strokeColor');
  const fillOpacity    = document.getElementById('fillOpacity');
  const radiusInput    = document.getElementById('radius');
  const dragToggle     = document.getElementById('dragToggle');
  const editToggle     = document.getElementById('editToggle');

  let activeCircle = null;
  let activeMarker = null;
  let infoWindow   = new google.maps.InfoWindow({});

  function buildCardHtml(title, namesTxt, notesTxt) {
    const names = (namesTxt || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    const li = names.map(n => `<li>${escapeHtml(n)}</li>`).join('');
    const notesHtml = notesTxt ? `<div style="margin-top:6px;color:#94a3b8;font-size:12px">${escapeHtml(notesTxt)}</div>` : '';

    return `
      <div class="info-card">
        <div class="info-title">${escapeHtml(title || 'بدون اسم')}</div>
        ${names.length ? `<div class="info-subtitle">الأمن:</div><ul class="info-list">${li}</ul>` : `<div class="info-subtitle">الأمن: —</div>`}
        ${notesHtml}
      </div>
    `;
  }

  function applyUiToCircle() {
    if (!activeCircle) return;
    const fill = (fillColor && fillColor.value) || '#a78bfa';
    const stroke = (strokeColor && strokeColor.value) || '#7c3aed';
    const opacity = fillOpacity ? Number(fillOpacity.value || 0.25) : 0.25;
    const r = radiusInput ? Number(radiusInput.value || 15) : 15;

    activeCircle.setOptions({
      fillColor: fill,
      strokeColor: stroke,
      fillOpacity: opacity,
      radius: r,
      draggable: !!(dragToggle && dragToggle.checked),
      editable: !!(editToggle && editToggle.checked)
    });

    if (activeMarker && siteName) {
      const html = buildCardHtml(siteName.value, securityNames?.value, notes?.value);
      infoWindow.setContent(html);
    }
  }

  // إنشاء موقع جديد (دائرة + ماركر + InfoWindow)
  function createCircleAt(center) {
    if (activeCircle) { activeCircle.setMap(null); activeCircle = null; }
    if (activeMarker) { activeMarker.setMap(null); activeMarker = null; }

    activeCircle = new google.maps.Circle({
      map,
      center,
      radius: Number(radiusInput?.value || 15),
      fillColor: fillColor?.value || '#a78bfa',
      fillOpacity: Number(fillOpacity?.value || 0.25),
      strokeColor: strokeColor?.value || '#7c3aed',
      strokeWeight: 2,
      strokeOpacity: 1,
      draggable: !!(dragToggle && dragToggle.checked),
      editable: !!(editToggle && editToggle.checked),
    });

    activeMarker = new google.maps.Marker({
      map,
      position: center,
      draggable: false,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 5,
        fillColor: '#7c3aed',
        fillOpacity: 1,
        strokeColor: '#7c3aed',
        strokeWeight: 2
      }
    });

    // إظهار البطاقة عند المرور فوق الدائرة أو النقر على الجوال
    const showInfo = () => {
      const html = buildCardHtml(siteName?.value, securityNames?.value, notes?.value);
      infoWindow.setContent(html);
      infoWindow.open({ map, anchor: activeMarker });
    };

    activeCircle.addListener('mouseover', showInfo);
    activeCircle.addListener('click', showInfo);
    activeMarker.addListener('click', showInfo);

    // تحديث البطاقة عند تغيير حقول الإدخال
    [siteName, securityNames, notes, fillColor, strokeColor, fillOpacity, radiusInput, dragToggle, editToggle]
      .filter(Boolean)
      .forEach(el => el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', applyUiToCircle));

    showInfo();
  }

  if (addCircleBtn) {
    addCircleBtn.addEventListener('click', () => {
      // ضع دائرة في مركز الخريطة (يمكنك تغييره للضغط على الخريطة)
      createCircleAt(map.getCenter());
    });
  }

  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      const url = location.origin + '/view.html';
      navigator.clipboard?.writeText(url);
      alert('تم نسخ رابط العرض: ' + url);
    });
  }
}

/* ===== مثال بسيط لإظهار أن الخريطة تعمل (يمكن حذفها) ===== */
function addExampleCircles() {
  const examples = [
    { name: 'بوابة سمحان',  lat: 24.742132284177778, lng: 46.569503913805825 },
    { name: 'دوار الروقية', lat: 24.741985907266145, lng: 46.56269186990043 },
  ];

  const iw = new google.maps.InfoWindow();

  examples.forEach(p => {
    const marker = new google.maps.Marker({
      map,
      position: { lat: p.lat, lng: p.lng },
      title: p.name
    });
    const circle = new google.maps.Circle({
      map,
      center: { lat: p.lat, lng: p.lng },
      radius: 15,
      fillColor: '#a78bfa',
      fillOpacity: 0.25,
      strokeColor: '#7c3aed',
      strokeWeight: 2
    });

    const html = `
      <div class="info-card">
        <div class="info-title">${escapeHtml(p.name)}</div>
        <div class="info-subtitle">الأمن: —</div>
      </div>
    `;
    marker.addListener('click', () => {
      iw.setContent(html);
      iw.open({ map, anchor: marker });
    });
    circle.addListener('mouseover', () => {
      iw.setContent(html);
      iw.open({ map, anchor: marker });
    });
  });
}

/* ===== Util: تهريب HTML بسيط ===== */
function escapeHtml(s = '') {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* ===== fallback بسيط لو لم تُستدعَ callback لسبب ما ===== */
window.addEventListener('load', () => {
  if (!window.__mapBootstrapped &&
      typeof window.google === 'object' &&
      window.google?.maps &&
      typeof window.initMap === 'function') {
    try { window.initMap(); } catch (e) { console.error(e); }
  }
});

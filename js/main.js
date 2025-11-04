const MAPTILER_KEY = 'a5Bw04JDHtYYQy2RwFvl'; // أو استخدم OpenStreetMap كما شرحت سابقًا
const DEFAULT_CENTER = [24.7136, 46.6753];
const DEFAULT_ZOOM = 12;

const urlParams = new URLSearchParams(window.location.search);
const isViewMode = urlParams.has('view');

const map = L.map('map').setView(DEFAULT_CENTER, DEFAULT_ZOOM);

// استخدم OpenStreetMap لتتجنب مشاكل المفتاح
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

const sidebar = document.getElementById('sidebar');
if (isViewMode) {
  sidebar.classList.add('hidden');
  map.dragging.enable();
  map.scrollWheelZoom.enable();
}

let circles = [];
let addMode = false;

function loadFromUrl() {
  if (isViewMode) {
    try {
      const data = JSON.parse(atob(urlParams.get('view')));
      data.circles.forEach(c => {
        const circle = L.circle([c.lat, c.lng], {
          radius: c.radius,
          color: c.color,
          fillColor: c.fillColor,
          fillOpacity: c.fillOpacity
        }).addTo(map);
        circle.data = c;
        circles.push(circle);
        attachEvents(circle);
      });
      if (data.center) map.setView([data.center.lat, data.center.lng], data.center.zoom);
    } catch (e) {
      console.error("فشل تحميل الخريطة");
    }
  }
}

function shareMap() {
  const data = {
    center: { lat: map.getCenter().lat, lng: map.getCenter().lng, zoom: map.getZoom() },
    circles: circles.map(c => ({
      lat: c.getLatLng().lat,
      lng: c.getLatLng().lng,
      radius: c.getRadius(),
      color: c.options.color,
      fillColor: c.options.fillColor,
      fillOpacity: c.options.fillOpacity,
      ...c.data
    }))
  };
  const encoded = btoa(JSON.stringify(data));
  const url = `${window.location.origin}${window.location.pathname}?view=${encoded}`;
  navigator.clipboard.writeText(url).then(() => {
    alert('تم نسخ رابط الخريطة إلى الحافظة!');
  }).catch(() => {
    prompt('انسخ الرابط يدويًا:', url);
  });
}

function createEditPopup(circle, isNew = false) {
  const d = circle.data || {};
  const color = circle.options.color || '#3388ff';
  const opacity = circle.options.fillOpacity || 0.3;
  const radius = circle.getRadius() || 100;

  const content = `
    <div class="circle-edit-popup">
      <label>اسم الموقع:</label>
      <input type="text" id="siteName" value="${d.name || ''}">
      <label>أفراد الأمن:</label>
      <input type="text" id="securityNames" value="${d.security || ''}">
      <label>ملاحظات:</label>
      <textarea id="notes" rows="2">${d.notes || ''}</textarea>
      <label>اللون (hex):</label>
      <input type="color" id="color" value="${color}">
      <label>الشفافية (0-1):</label>
      <input type="number" id="opacity" min="0" max="1" step="0.1" value="${opacity}">
      <label>نصف القطر (متر):</label>
      <input type="number" id="radius" min="10" value="${radius}">
      <button onclick="saveCircleData(this, ${circle._leaflet_id})">حفظ</button>
    </div>
  `;

  const popup = L.popup()
    .setLatLng(circle.getLatLng())
    .setContent(content)
    .openOn(map);

  // ربط الدائرة بالـ popup لاستخدامها لاحقًا
  popup._circle = circle;
  return popup;
}

// دالة محدثة تقرأ القيم من داخل الـ popup
window.saveCircleData = function(btn, circleId) {
  // نحصل على الـ popup الذي يحتوي الزر
  const popupElement = btn.closest('.leaflet-popup-content');
  if (!popupElement) return;

  const circle = circles.find(c => c._leaflet_id == circleId);
  if (!circle) return;

  const name = popupElement.querySelector('#siteName')?.value || '';
  const security = popupElement.querySelector('#securityNames')?.value || '';
  const notes = popupElement.querySelector('#notes')?.value || '';
  const color = popupElement.querySelector('#color')?.value || '#3388ff';
  const opacity = parseFloat(popupElement.querySelector('#opacity')?.value) || 0.3;
  const radius = parseFloat(popupElement.querySelector('#radius')?.value) || 100;

  circle.data = { name, security, notes };
  circle.setStyle({ color, fillColor: color, fillOpacity: opacity });
  circle.setRadius(radius);

  const tooltipContent = `<b>${name || 'نقطة غير معنونة'}</b><br><small>الأمن: ${security || '---'}</small><br><small>${notes || ''}</small>`;
  circle.setTooltipContent(tooltipContent);
  map.closePopup();
};

function attachEvents(circle) {
  if (!isViewMode) {
    circle.on('click', function(e) {
      createEditPopup(circle);
    });
  }
  const tooltipContent = circle.data?.name ? 
    `<b>${circle.data.name}</b><br><small>الأمن: ${circle.data.security || '---'}</small>` : 'نقطة مراقبة';
  circle.bindTooltip(tooltipContent, {
    className: 'custom-tooltip',
    direction: 'top',
    offset: [0, -10]
  });
}

document.getElementById('addCircleBtn')?.addEventListener('click', () => {
  addMode = true;
  alert('الآن انقر على الخريطة لتحديد موقع الدائرة.');
  map.getContainer().style.cursor = 'crosshair';
});

document.getElementById('shareBtn')?.addEventListener('click', shareMap);

map.on('click', (e) => {
  if (isViewMode || !addMode) return;
  addMode = false;
  map.getContainer().style.cursor = '';
  const circle = L.circle(e.latlng, {
    radius: 100,
    color: '#3388ff',
    fillColor: '#3388ff',
    fillOpacity: 0.3
  }).addTo(map);
  circle.data = { name: '', security: '', notes: '' };
  circles.push(circle);
  attachEvents(circle);
  createEditPopup(circle, true);
});

loadFromUrl();

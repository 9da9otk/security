// ========================
// الإعدادات: الدرعية
// ========================
const DEFAULT_CENTER = [24.8592, 46.6715]; // الدرعية التاريخية
const DEFAULT_ZOOM = 14;

const urlParams = new URLSearchParams(window.location.search);
const isViewMode = urlParams.has('view');

const map = L.map('map').setView(DEFAULT_CENTER, DEFAULT_ZOOM);

L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=5d937485-a301-4455-9ba7-95a93120ff7d', {
  attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>'
}).addTo(map);

const sidebar = document.getElementById('sidebar');
if (isViewMode) {
  sidebar?.classList.add('hidden');
}

let circles = [];
let addMode = false;

// ========================
// إنشاء دائرة قابلة للسحب
// ========================
function createDraggableCircle(latlng, options = {}) {
  const circle = L.circle(latlng, {
    radius: options.radius || 100,
    color: options.color || '#1a5fb4',
    fillColor: options.fillColor || '#3388ff',
    fillOpacity: options.fillOpacity || 0.3
  }).addTo(map);

  // إنشاء علامة غير مرئية في المركز للسحب
  const dragMarker = L.marker(latlng, {
    draggable: true,
    zIndexOffset: 1000,
    icon: L.divIcon({ className: 'drag-helper', iconSize: [0,0] }) // غير مرئي
  }).addTo(map);

  // عند سحب العلامة، حرّك الدائرة
  dragMarker.on('drag', function() {
    const newLatLng = dragMarker.getLatLng();
    circle.setLatLng(newLatLng);
  });

  // عند الانتهاء من السحب، حدّث بيانات الدائرة
  dragMarker.on('dragend', function() {
    const newLatLng = dragMarker.getLatLng();
    circle.data.lat = newLatLng.lat;
    circle.data.lng = newLatLng.lng;
  });

  // ربط العلامة بالدائرة لحذفها لاحقًا
  circle._dragMarker = dragMarker;

  return circle;
}

// ========================
// إنشاء نافذة تعديل
// ========================
function createEditPopup(circle) {
  const d = circle.data || {};
  const content = `
    <div style="width:260px; font-family: sans-serif;">
      <label><b>حذف الدائرة</b></label><br>
      <button onclick="deleteCircle(${circle._leaflet_id})" 
              style="background:#d32f2f; color:white; border:none; padding:6px 12px; margin-top:6px;">
        حذف
      </button>
    </div>
  `;
  L.popup({ maxWidth: 280 })
    .setLatLng(circle.getLatLng())
    .setContent(content)
    .openOn(map);
}

// ========================
// حذف الدائرة (مع العلامة المساعدة)
// ========================
window.deleteCircle = function(id) {
  const idx = circles.findIndex(c => c._leaflet_id == id);
  if (idx === -1) return;
  if (!confirm('حذف الدائرة؟')) return;

  const circle = circles[idx];
  map.removeLayer(circle);
  if (circle._dragMarker) map.removeLayer(circle._dragMarker);
  circles.splice(idx, 1);
  map.closePopup();
};

// ========================
// النقر على الخريطة لإنشاء دائرة
// ========================
map.on('click', (e) => {
  if (isViewMode || !addMode) return;
  addMode = false;

  const circle = createDraggableCircle(e.latlng, {
    radius: 100,
    color: '#1a5fb4',
    fillColor: '#3388ff'
  });

  circle.data = { name: '', security: '', notes: '', lat: e.latlng.lat, lng: e.latlng.lng };
  circles.push(circle);

  circle.on('click', () => {
    if (!isViewMode) createEditPopup(circle);
  });

  createEditPopup(circle);
});

// ========================
// زر إضافة دائرة
// ========================
document.getElementById('addCircleBtn')?.addEventListener('click', () => {
  addMode = true;
  map.getContainer().style.cursor = 'crosshair';
  alert('انقر على الخريطة لإنشاء دائرة قابلة للسحب.');
});

// ========================
// مشاركة (مبسطة)
// ========================
document.getElementById('shareBtn')?.addEventListener('click', () => {
  alert('وضع المشاركة غير مكتمل في هذا الإصدار المبسط. ركّز على السحب أولاً.');
});

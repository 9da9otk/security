// تُستدعى عبر callback=initMap من سكربت Google
window.initMap = function () {
  const center = { lat: 24.7418, lng: 46.5758 }; // الدرعية تقريباً

  const el = document.getElementById('map');
  if (!el) {
    console.error('عنصر #map غير موجود.');
    return;
  }

  const map = new google.maps.Map(el, {
    center,
    zoom: 14,
    mapTypeId: 'roadmap',
    gestureHandling: 'greedy',
    disableDefaultUI: true // لا نضيف عناصر واجهة الآن
  });

  // بيانات اختبار بسيطة (يمكن استبدالها لاحقاً بمصدر خارجي)
  const SITES = [
    { name: 'بوابة سمحان', type: 'بوابة',   lat: 24.742132355539432, lng: 46.56966664740594 },
    { name: 'دوار البجيري', type: 'دوار',   lat: 24.73754835059363,  lng: 46.57401116325427 },
    { name: 'ميدان الملك سلمان', type: 'ميدان', lat: 24.7406,            lng: 46.5802 },
  ];

  // نمط دائري افتراضي (15 متر)
  const DEFAULT_RADIUS_M = 15;

  // مرجع لكرت المعلومات
  const card = document.getElementById('info-card');
  const closeBtn = card.querySelector('.close');
  const nameEl = document.getElementById('site-name');
  const typeEl = document.getElementById('site-type');
  const coordEl = document.getElementById('site-coord');
  const radiusEl = document.getElementById('site-radius');

  const state = { openId: null };

  function openCard(site) {
    nameEl.textContent = site.name || '—';
    typeEl.textContent = site.type || '—';
    coordEl.textContent = `${site.lat.toFixed(6)}, ${site.lng.toFixed(6)}`;
    radiusEl.textContent = `${DEFAULT_RADIUS_M} م`;
    card.classList.remove('hidden');
  }
  function closeCard() {
    card.classList.add('hidden');
    state.openId = null;
  }

  closeBtn.addEventListener('click', closeCard);
  map.addListener('click', closeCard);

  // نصنع ماركر + دائرة لكل موقع
  SITES.forEach((site, idx) => {
    const pos = { lat: site.lat, lng: site.lng };

    const marker = new google.maps.Marker({
      position: pos,
      map,
      title: site.name,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 6,
        fillColor: '#e11d48', // أحمر رزين
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
      zIndex: 2
    });

    const circle = new google.maps.Circle({
      map,
      center: pos,
      radius: DEFAULT_RADIUS_M, // 15م
      strokeColor: '#60a5fa',   // أزرق فاتح
      strokeOpacity: 0.9,
      strokeWeight: 2,
      fillColor: '#60a5fa',
      fillOpacity: 0.15,
      clickable: false,
      zIndex: 1
    });

    // عند الضغط على الماركر: افتح الكرت وركّز الخريطة قليلاً
    marker.addListener('click', () => {
      state.openId = idx;
      openCard(site);
      map.panTo(pos);
      // نبض بصري بسيط للدائرة
      circle.setOptions({ strokeOpacity: 1, fillOpacity: 0.22 });
      setTimeout(() => circle.setOptions({ strokeOpacity: 0.9, fillOpacity: 0.15 }), 250);
    });
  });

  // دبوس تشغيل (يمكن إبقاؤه أو حذفه لاحقاً)
  new google.maps.Marker({
    position: center,
    map,
    title: 'Test OK',
    icon: {
      path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
      scale: 4,
      fillColor: '#22c55e',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 1.5
    },
    zIndex: 0
  });

  console.log('Map with 15m circles initialized ✅');
};

// التقاط أي رفض وعود غير معالج
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason || e);
});

// إن لم تُحمّل مكتبة الخرائط
setTimeout(() => {
  if (!window.google || !window.google.maps) {
    console.error('لم يتم تحميل مكتبة Google Maps. تحقق من المفتاح/القيود/الشبكة/مانعات الإعلانات.');
  }
}, 4000);

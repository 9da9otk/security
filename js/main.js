"use strict";

/** عناصر مساعدة للتشخيص */
const dbg = (msg) => {
  console.log("[MAP]", msg);
  const el = document.getElementById("dbg");
  if (el) el.textContent = msg;
};

// التقط أي أخطاء عامة لنعرف إن كانت قبل تهيئة الخرائط
window.addEventListener("error", (e) => console.error("[ERR] onerror:", e.message, e));
window.addEventListener("unhandledrejection", (e) => console.error("[ERR] unhandled:", e.reason));

/** سيستدعيه سكربت Google عبر callback=initApp */
function initApp() {
  try {
    dbg("callback وصل — نبدأ التهيئة…");

    // تأكد أن google.maps موجود فعلاً
    if (!(window.google && google.maps)) {
      dbg("google.maps غير جاهزة بعد — إعادة محاولة…");
      setTimeout(initApp, 100);
      return;
    }

    // تأكد من وجود عنصر الخريطة وارتفاعه
    const mapEl = document.getElementById("map");
    if (!mapEl) {
      console.error("لا يوجد عنصر #map في DOM");
      dbg("لا يوجد #map");
      return;
    }
    if (!mapEl.offsetHeight) {
      mapEl.style.height = "100vh";
      dbg("ارتفاع #map كان 0 — تم ضبطه 100vh");
    }

    // إنشاء الخريطة
    const CENTER = { lat: 24.73722164546818, lng: 46.53877581519047 };
    const map = new google.maps.Map(mapEl, {
      center: CENTER,
      zoom: 14,
      mapTypeId: "roadmap",
      streetViewControl: false,
      gestureHandling: "greedy",
      fullscreenControl: true,
      mapTypeControl: true
    });

    // مؤشر صغير للتأكد بصرياً أن الخريطة تعمل
    new google.maps.Marker({
      position: CENTER,
      map,
      title: "الدرعية"
    });

    // دائرة اختبار 15 م
    new google.maps.Circle({
      map,
      center: CENTER,
      radius: 15,
      strokeColor: "#6b46ff",
      strokeWeight: 2,
      fillColor: "#b28dff",
      fillOpacity: 0.35
    });

    dbg("تمت تهيئة الخريطة بنجاح ✅");
  } catch (err) {
    console.error("فشل تهيئة الخريطة:", err);
    dbg("خطأ أثناء التهيئة");
  }
}

// مهم جداً: إتاحة الدالة للـ callback
window.initApp = initApp;

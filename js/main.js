/* =========================
   إعدادات عامة
========================= */

const DEFAULT_CENTER = { lat: 24.73722164546818, lng: 46.53877581519047 };
const DEFAULT_ZOOM   = 14;
const DEFAULT_RADIUS = 15; // نصف القطر الافتراضي (متر)

const STYLE_STROKE = "#7c3aed";  // لون حد واضح
const STYLE_FILL   = "#c084fc";  // لون تعبئة واضح
const STYLE_OPAC   = 0.25;       // شفافية التعبئة

// المواقع الافتراضية (من قائمتك) - الاسم + الإحداثيات + نصف القطر 15م
const DEFAULT_SITES = [
  { name:"بوابة سمحان",                         lat:24.742132284177778, lng:46.569503913805825 },
  { name:"منطقة سمحان",                         lat:24.74091335108621,  lng:46.571891407130025 },
  { name:"دوار البجيري",                        lat:24.737521801476476, lng:46.57406918772067  },
  { name:"إشارة البجيري",                       lat:24.73766260194535,  lng:46.575429040147306 },
  { name:"طريق الملك فيصل",                     lat:24.736133848943062, lng:46.57696607050239  },
  { name:"نقطة فرز الشلهوب",                    lat:24.73523670533632,  lng:46.57785639752234  },
  { name:"المسار الرياضي المديد",               lat:24.735301077804944, lng:46.58178092599035  },
  { name:"ميدان الملك سلمان",                   lat:24.73611373368281,  lng:46.58407097038162  },
  { name:"دوار الضوء الخافت",                   lat:24.739718342668006, lng:46.58352614787052  },
  { name:"المسار الرياضي طريق الملك خالد الفرعي",lat:24.740797019998627, lng:46.5866145907347   },
  { name:"دوار البلدية",                        lat:24.739266101368777, lng:46.58172727078356  },
  { name:"مدخل ساحة البلدية الفرعي",            lat:24.738638518378387, lng:46.579858026042785 },
  { name:"مدخل مواقف البجيري (كار بارك)",       lat:24.73826438056506,  lng:46.57789576275729  },
  { name:"مواقف الامن",                         lat:24.73808736962705,  lng:46.57771858346317  },
  { name:"دوار الروقية",                        lat:24.741985907266145, lng:46.56269186990043  },
  { name:"بيت مبارك",                           lat:24.732609768937607, lng:46.57827089439368  },
  { name:"دوار وادي صفار",                      lat:24.72491458984474,  lng:46.57345489743978  },
  { name:"دوار راس النعامة",                    lat:24.710329841152387, lng:46.572921959358204 },
  { name:"مزرعة الحبيب",                        lat:24.709445443672344, lng:46.593971867951346 }
].map(s => ({
  ...s,
  radius: DEFAULT_RADIUS,
  strokeColor: STYLE_STROKE,
  fillColor: STYLE_FILL,
  fillOpacity: STYLE_OPAC,
  security: "",
  notes: ""
}));

/* =========================
   ترميز/فك ترميز للمشاركة
========================= */
function compactData(data) {
  return {
    c: { L: data.center.lat, G: data.center.lng, z: data.center.zoom },
    r: data.circles.map(c => ({
      L: c.lat, G: c.lng, d: c.radius,
      sc: c.strokeColor, fc: c.fillColor, fo: c.fillOpacity,
      n: c.name, s: c.security, t: c.notes
    }))
  };
}
function expandData(obj) {
  return {
    center: { lat: obj.c?.L ?? DEFAULT_CENTER.lat, lng: obj.c?.G ?? DEFAULT_CENTER.lng, zoom: obj.c?.z ?? DEFAULT_ZOOM },
    circles: (obj.r ?? []).map(e => ({
      lat: e.L, lng: e.G, radius: e.d ?? DEFAULT_RADIUS,
      strokeColor: e.sc ?? STYLE_STROKE, fillColor: e.fc ?? STYLE_FILL, fillOpacity: e.fo ?? STYLE_OPAC,
      name: e.n || "", security: e.s || "", notes: e.t || ""
    }))
  };
}
function encodeData(data) {
  const json = JSON.stringify(compactData(data));
  const bytes = new TextEncoder().encode(json);
  let bin = ""; bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin);
}
function decodeData(encoded) {
  const bin = atob(encoded);
  const bytes = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
  return expandData(JSON.parse(new TextDecoder().decode(bytes)));
}

/* =========================
   حالة التطبيق + DOM
========================= */
let map, infoWindow;
let circles = [];     // عناصر الدوائر [{ circle, __data }]
let selected = null;

const $ = s => document.querySelector(s);

const edName       = () => $("#ed-name");
const edSecurity   = () => $("#ed-security");
const edNotes      = () => $("#ed-notes");
const edStroke     = () => $("#ed-stroke");
const edFill       = () => $("#ed-fill");
const edOpacity    = () => $("#ed-opacity");
const edRadius     = () => $("#ed-radius");
const edRadiusNum  = () => $("#ed-radius-num");
const edDraggable  = () => $("#ed-draggable");
const edEditable   = () => $("#ed-editable");

/* =========================
   Google Map
========================= */
window.initMap = function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    mapId: "DIRIYAH_SECURITY_MAP",
    gestureHandling: "greedy",
    fullscreenControl: true
  });
  infoWindow = new google.maps.InfoWindow({});

  const url = new URL(location.href);
  const view = url.searchParams.get("view");
  if (view) {
    try {
      const data = decodeData(decodeURIComponent(view));
      renderFromData(data);
      map.setCenter({lat: data.center.lat, lng: data.center.lng});
      map.setZoom(data.center.zoom);
    } catch(e){
      console.error("فشل التحميل من الرابط:", e);
      seedDefaults();
    }
  } else {
    seedDefaults();
  }

  wireUi();
};

/* =========================
   الرسم من بيانات
========================= */
function renderFromData(data){
  // تنظيف
  circles.forEach(o => o.circle.setMap(null));
  circles = [];

  (data.circles || []).forEach(d => {
    const c = new google.maps.Circle({
      map,
      center: { lat: d.lat, lng: d.lng },
      radius: d.radius ?? DEFAULT_RADIUS,
      strokeColor: d.strokeColor ?? STYLE_STROKE,
      strokeOpacity: 1,
      strokeWeight: 3,
      fillColor: d.fillColor ?? STYLE_FILL,
      fillOpacity: d.fillOpacity ?? STYLE_OPAC,
      draggable: true,
      editable: true
    });

    const obj = { circle: c, __data: { ...d } };
    circles.push(obj);
    bindCircleEvents(obj);
  });
}

function seedDefaults(){
  renderFromData({
    center: { lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng, zoom: DEFAULT_ZOOM },
    circles: DEFAULT_SITES
  });
}

/* =========================
   InfoWindow (الكرت)
========================= */
function infoHtml(d){
  return `
    <div class="infocard">
      <div class="infocard-header">${escapeHtml(d.name || "بدون اسم")}</div>
      <div class="infocard-body">
        <div class="label">الأمن:</div>
        <div class="names">${escapeHtml(d.security || "—").replace(/\n/g,"<br>")}</div>
        ${d.notes ? `<div class="sep"></div><div class="notes">${escapeHtml(d.notes)}</div>` : ""}
      </div>
    </div>
  `;
}

function bindCircleEvents(obj){
  const c = obj.circle;

  // فتح المحرر عند النقر
  c.addListener("click", () => { setSelected(obj); openEditor(); });

  // كرت منبثق عند المرور/الخروج
  c.addListener("mouseover", () => {
    infoWindow.setContent(infoHtml(obj.__data));
    infoWindow.setPosition(c.getCenter());
    infoWindow.open({ map });
  });
  c.addListener("mouseout", () => infoWindow.close());

  // تحديث البيانات عند التغيير
  c.addListener("center_changed", () => {
    const center = c.getCenter();
    obj.__data.lat = center.lat();
    obj.__data.lng = center.lng();
    if (selected === obj) updateEditorFields(obj);
  });
  c.addListener("radius_changed", () => {
    obj.__data.radius = Math.round(c.getRadius());
    if (selected === obj) {
      edRadius().value = obj.__data.radius;
      edRadiusNum().value = obj.__data.radius;
      $("#radius-val").textContent = obj.__data.radius;
    }
  });
}

function setSelected(obj){
  selected = obj;
  $("#delBtn").disabled = !selected;
  updateEditorFields(obj);
}

function updateEditorFields(obj){
  const d = obj.__data || {};
  edName().value      = d.name || "";
  edSecurity().value  = d.security || "";
  edNotes().value     = d.notes || "";
  edStroke().value    = d.strokeColor || STYLE_STROKE;
  edFill().value      = d.fillColor   || STYLE_FILL;
  edOpacity().value   = d.fillOpacity ?? STYLE_OPAC;
  $("#op-val").textContent = edOpacity().value;

  const r = Math.round(d.radius ?? DEFAULT_RADIUS);
  edRadius().value    = r;
  edRadiusNum().value = r;
  $("#radius-val").textContent = r;

  edDraggable().checked = obj.circle.getDraggable();
  edEditable().checked  = obj.circle.getEditable();
}

function openEditor(){
  $("#emptyState")?.classList.add("hidden");
  $("#editor")?.classList.remove("hidden");
  $(".sidebar")?.classList.add("open");
  $("#drawerBackdrop")?.classList.remove("hidden");
}

/* =========================
   واجهة المستخدم
========================= */
function wireUi(){
  // إضافة موقع جديد (بنقرة على الخريطة)
  $("#addCircleBtn")?.addEventListener("click", () => {
    $("#addHint")?.classList.remove("hidden");
    const once = map.addListener("click", (e) => {
      google.maps.event.removeListener(once);
      $("#addHint")?.classList.add("hidden");

      const c = new google.maps.Circle({
        map,
        center: e.latLng,
        radius: DEFAULT_RADIUS,
        strokeColor: STYLE_STROKE,
        strokeOpacity: 1,
        strokeWeight: 3,
        fillColor: STYLE_FILL,
        fillOpacity: STYLE_OPAC,
        draggable: true,
        editable: true
      });

      const obj = {
        circle: c,
        __data: {
          name:"", security:"", notes:"",
          lat:e.latLng.lat(), lng:e.latLng.lng(),
          radius: DEFAULT_RADIUS,
          strokeColor: STYLE_STROKE, fillColor: STYLE_FILL, fillOpacity: STYLE_OPAC
        }
      };
      circles.push(obj);
      bindCircleEvents(obj);
      setSelected(obj);
      openEditor();
    });
  });

  // مشاركة (ينشئ رابط view.html)
  $("#shareBtn")?.addEventListener("click", () => {
    const data = collectState();
    const encoded = encodeData(data);
    const url = `${location.origin}${location.pathname.replace(/index\.html?$/,'')}view.html?view=${encodeURIComponent(encoded)}`;
    navigator.clipboard?.writeText(url).then(()=>alert("تم نسخ رابط العرض!")).catch(()=>prompt("انسخ الرابط:", url));
  });

  // Drawer (الجوال)
  $("#closeEditor")?.addEventListener("click", () => {
    $(".sidebar")?.classList.remove("open");
    $("#drawerBackdrop")?.classList.add("hidden");
  });
  $("#drawerBackdrop")?.addEventListener("click", () => {
    $(".sidebar")?.classList.remove("open");
    $("#drawerBackdrop")?.classList.add("hidden");
  });
  $("#mobileToggle")?.addEventListener("click", () => {
    $(".sidebar")?.classList.add("open");
    $("#drawerBackdrop")?.classList.remove("hidden");
  });

  // حقول التحرير (حفظ فوري)
  edName()?.addEventListener("input", () => {
    if(!selected) return;
    selected.__data.name = edName().value;
    // تحديث الكرت المفتوح (إن كان ظاهرًا)
    infoWindow.setContent(infoHtml(selected.__data));
  });
  edSecurity()?.addEventListener("input", () => { if(!selected) return; selected.__data.security = edSecurity().value; });
  edNotes()?.addEventListener("input", () => { if(!selected) return; selected.__data.notes = edNotes().value; });

  edStroke()?.addEventListener("input", () => {
    if(!selected) return;
    selected.__data.strokeColor = edStroke().value;
    selected.circle.setOptions({ strokeColor: edStroke().value });
  });
  edFill()?.addEventListener("input", () => {
    if(!selected) return;
    selected.__data.fillColor = edFill().value;
    selected.circle.setOptions({ fillColor: edFill().value });
  });
  edOpacity()?.addEventListener("input", () => {
    if(!selected) return;
    const v = parseFloat(edOpacity().value) || STYLE_OPAC;
    $("#op-val").textContent = v.toString();
    selected.__data.fillOpacity = v;
    selected.circle.setOptions({ fillOpacity: v });
  });

  edRadius()?.addEventListener("input", syncRadiusFromSlider);
  edRadiusNum()?.addEventListener("input", syncRadiusFromNumber);

  edDraggable()?.addEventListener("change", () => { if(!selected) return; selected.circle.setDraggable(edDraggable().checked); });
  edEditable()?.addEventListener("change", () =>  { if(!selected) return; selected.circle.setEditable(edEditable().checked); });

  // حذف/نسخ
  $("#delBtn")?.addEventListener("click", () => {
    if(!selected) return;
    if(!confirm("حذف هذه الدائرة؟")) return;
    selected.circle.setMap(null);
    circles = circles.filter(o => o !== selected);
    selected = null;
    $("#editor")?.classList.add("hidden");
    $("#emptyState")?.classList.remove("hidden");
  });

  $("#dupBtn")?.addEventListener("click", () => {
    if(!selected) return;
    const center = selected.circle.getCenter();
    const off = 0.0005;
    const pos = { lat: center.lat() + (Math.random()-0.5)*off, lng: center.lng() + (Math.random()-0.5)*off };

    const c = new google.maps.Circle({
      map,
      center: pos,
      radius: selected.__data.radius ?? DEFAULT_RADIUS,
      strokeColor: selected.__data.strokeColor ?? STYLE_STROKE,
      strokeOpacity: 1,
      strokeWeight: 3,
      fillColor: selected.__data.fillColor ?? STYLE_FILL,
      fillOpacity: selected.__data.fillOpacity ?? STYLE_OPAC,
      draggable: true,
      editable: true
    });

    const clone = { circle: c, __data: { ...selected.__data, lat: pos.lat, lng: pos.lng } };
    circles.push(clone);
    bindCircleEvents(clone);
    setSelected(clone);
    openEditor();
  });
}

function syncRadiusFromSlider(){
  if(!selected) return;
  const v = Math.round(parseFloat(edRadius().value) || DEFAULT_RADIUS);
  $("#radius-val").textContent = v.toString();
  edRadiusNum().value = v;
  selected.__data.radius = v;
  selected.circle.setRadius(v);
}
function syncRadiusFromNumber(){
  if(!selected) return;
  const v = Math.round(parseFloat(edRadiusNum().value) || DEFAULT_RADIUS);
  $("#radius-val").textContent = v.toString();
  edRadius().value = v;
  selected.__data.radius = v;
  selected.circle.setRadius(v);
}

/* =========================
   تجميع الحالة للمشاركة
========================= */
function collectState(){
  return {
    center: { lat: map.getCenter().lat(), lng: map.getCenter().lng(), zoom: map.getZoom() },
    circles: circles.map(o => ({
      lat: o.circle.getCenter().lat(),
      lng: o.circle.getCenter().lng(),
      radius: Math.round(o.circle.getRadius()),
      strokeColor: o.__data.strokeColor,
      fillColor: o.__data.fillColor,
      fillOpacity: o.__data.fillOpacity,
      name: o.__data.name || "",
      security: o.__data.security || "",
      notes: o.__data.notes || ""
    }))
  };
}

/* =========================
   أدوات مساعدة
========================= */
function escapeHtml(t=""){
  const div = document.createElement("div");
  div.textContent = t;
  return div.innerHTML;
}

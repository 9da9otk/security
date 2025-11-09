// ===== URL utils =====
function getParams(){ return new URLSearchParams(location.search); }
function toFixed6(x){ return Number(x).toFixed ? Number(x).toFixed(6) : x; }

// ===== Base64 / Base64URL =====
function b64Encode(str){ return btoa(unescape(encodeURIComponent(str))); }
function b64Decode(b64){ return decodeURIComponent(escape(atob(b64))); }
function toBase64Url(b64){ return b64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function fromBase64Url(b64url){ let b64=b64url.replace(/-/g,'+').replace(/_/g,'/'); while(b64.length%4)b64+='='; return b64; }

// ===== ترميز مضغوط للغاية v=c2 =====
// الشكل: {v:'c2', t:0/1, s:[ [name, type, latB36, lngB36, style? , rec?] ... ] }
// latB36/lngB36: أعداد قاعدة 36 (lat*1e5 ، lng*1e5 مع الإشارة)
// style = [r, fillHex, fop, strokeHex, sw] فقط إذا اختلف عن الافتراضي
// rec = "a|b|c" إن وُجدت
const DEF_STYLE = { radius:15, fill:'#60a5fa', fillOpacity:0.16, stroke:'#60a5fa', strokeWeight:2 };

function nToB36(n){ // يدعم السالب
  const s = Math.round(n).toString(36);
  return s;
}
function b36ToN(s){
  const n = parseInt(s, 36);
  return n;
}
function packSite(site){
  const latE5 = Math.round(site.lat*1e5);
  const lngE5 = Math.round(site.lng*1e5);
  const arr = [site.name, site.type||'', nToB36(latE5), nToB36(lngE5)];
  const st = site.style || DEF_STYLE;
  const stIsDef = st.radius===DEF_STYLE.radius && st.fill===DEF_STYLE.fill &&
                  Math.abs(st.fillOpacity-DEF_STYLE.fillOpacity)<1e-9 &&
                  st.stroke===DEF_STYLE.stroke && st.strokeWeight===DEF_STYLE.strokeWeight;
  if (!stIsDef){
    arr.push([st.radius||15, (st.fill||DEF_STYLE.fill).replace('#',''),
              +(+st.fillOpacity).toFixed(2), (st.stroke||DEF_STYLE.stroke).replace('#',''),
              st.strokeWeight||2]);
  } else {
    arr.push(0); // افتراضي
  }
  const rec = (site.recipients && site.recipients.length) ? site.recipients.join('|') : '';
  arr.push(rec);
  return arr;
}
function unpackSite(arr){
  const [name,type,latB36,lngB36,styleOrZero,recStr=''] = arr;
  const lat = b36ToN(latB36)/1e5;
  const lng = b36ToN(lngB36)/1e5;
  let style = DEF_STYLE;
  if (styleOrZero && styleOrZero!==0){
    const [r,fillHex,fop,strokeHex,sw] = styleOrZero;
    style = { radius:r??15, fill:'#'+(fillHex||'60a5fa'),
              fillOpacity: fop??0.16, stroke:'#'+(strokeHex||'60a5fa'),
              strokeWeight: sw??2 };
  }
  const recipients = recStr ? recStr.split('|') : [];
  // ننشئ id تلقائيًا (قصير) لأننا لا ننقله داخل الرابط
  const id = 's-' + Math.random().toString(36).slice(2,8);
  return { id, name, type, lat, lng, recipients, style };
}
function encodeShareState(state){
  const payload = { v:'c2', t: state.traffic ? 1 : 0, s: state.sites.map(packSite) };
  return toBase64Url(b64Encode(JSON.stringify(payload)));
}
function decodeShareState(s){
  try{
    const o = JSON.parse(b64Decode(fromBase64Url(s)));
    if (o && o.v === 'c2' && Array.isArray(o.s)){
      return { traffic: !!o.t, sites: o.s.map(unpackSite) };
    }
    // توافق خلفي (c1/كلاسيكي)
    return null;
  }catch{ return null; }
}

// ===== LocalStorage (للوضع العادي فقط) =====
const LS_KEY = 'security:state.v3';
function loadLocal(){ try{ const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : null; }catch{ return null; } }
function saveLocal(state){ try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch{} }

// ===== الحالة الافتراضية =====
function defaultState(){
  const S = (name,lat,lng,type) => ({
    id: 's-' + Math.random().toString(36).slice(2,8),
    name, type, lat, lng,
    recipients: [],
    style: {...DEF_STYLE}
  });
  return {
    traffic: false,
    sites: [
      S('بوابة سمحان',24.742132284177778,46.569503913805825,'بوابة'),
      S('منطقة سمحان',24.74091335108621,46.571891407130025,'منطقة'),
      S('دوار البجيري',24.737521801476476,46.57406918772067,'دوار'),
      S('إشارة البجيري',24.73766260194535,46.575429040147306,'إشارة'),
      S('طريق الملك فيصل',24.736133848943062,46.57696607050239,'طريق'),
      S('نقطة فرز الشلهوب',24.73523670533632,46.57785639752234,'نقطة فرز'),
      S('المسار الرياضي المديد',24.735301077804944,46.58178092599035,'مسار رياضي'),
      S('ميدان الملك سلمان',24.73611373368281,46.58407097038162,'ميدان'),
      S('دوار الضوء الخافت',24.739718342668006,46.58352614787052,'دوار'),
      S('المسار الرياضي طريق الملك خالد الفرعي',24.740797019998627,46.5866145907347,'مسار رياضي'),
      S('دوار البلدية',24.739266101368777,46.58172727078356,'دوار'),
      S('مدخل ساحة البلدية الفرعي',24.738638518378387,46.579858026042785,'مدخل'),
      S('مدخل مواقف البجيري (كار بارك)',24.73826438056506,46.57789576275729,'مدخل'),
      S('مواقف الامن',24.73808736962705,46.57771858346317,'مواقف'),
      S('دوار الروقية',24.741985907266145,46.56269186990043,'دوار'),
      S('بيت مبارك',24.732609768937607,46.57827089439368,'موقع'),
      S('دوار وادي صفار',24.72491458984474,46.57345489743978,'دوار'),
      S('دوار راس النعامة',24.710329841152387,46.572921959358204,'دوار'),
      S('مزرعة الحبيب',24.709445443672344,46.593971867951346,'مزرعة')
    ]
  };
}

// ===== التطبيق =====
window.initMap = function () {
  const params = getParams();
  const isShare = params.get('view') === 'share';
  if (isShare) document.body.classList.add('share');

  let state;
  if (isShare) {
    state = params.get('s') ? (decodeShareState(params.get('s')) || defaultState()) : defaultState();
  } else {
    state = loadLocal() || defaultState();
  }

  // الخريطة
  const map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 24.7418, lng: 46.5758 }, zoom: 14, mapTypeId: 'roadmap',
    gestureHandling: 'greedy',
    disableDefaultUI: false, mapTypeControl: true, zoomControl: true,
    streetViewControl: false, fullscreenControl: true, keyboardShortcuts: true
  });

  // حركة المرور
  const trafficLayer = new google.maps.TrafficLayer();
  let trafficOn = !!state.traffic;
  const trafficBtn = document.getElementById('traffic-toggle');
  function setTraffic(on){ trafficOn = !!on; trafficBtn.setAttribute('aria-pressed', on?'true':'false'); trafficLayer.setMap(on?map:null); }
  setTraffic(trafficOn);
  trafficBtn.addEventListener('click', () => setTraffic(!trafficOn));

  // عناصر الكرت والمحرر
  const card = document.getElementById('info-card');
  const closeBtn = card.querySelector('.close');
  const nameEl = document.getElementById('site-name');
  const typeEl = document.getElementById('site-type');
  const coordEl = document.getElementById('site-coord');
  const radiusEl = document.getElementById('site-radius');
  const recEl = document.getElementById('site-recipients');
  const editActions = document.getElementById('edit-actions');
  const editBtn = document.getElementById('edit-recipients');
  const editor = document.getElementById('editor');
  const editorInput = document.getElementById('editor-input');
  const editorSave = document.getElementById('editor-save');
  const editorCancel = document.getElementById('editor-cancel');

  const markers = [];
  const circles = [];
  const byId = Object.create(null);

  let selectedId = null, pinnedId = null, hoverId = null;

  function renderRecipients(list){ return (list && list.length) ? list.join('، ') : '—'; }
  function openCard(site){
    selectedId = site.id;
    nameEl.textContent = site.name || '—';
    typeEl.textContent = site.type || '—';
    coordEl.textContent = `${toFixed6(site.lat)}, ${toFixed6(site.lng)}`;
    radiusEl.textContent = `${site.style.radius} م`;
    recEl.textContent = renderRecipients(site.recipients);
    if (!isShare) editActions.classList.remove('hidden'); else editActions.classList.add('hidden');
    card.classList.remove('hidden');
    if (!isShare) {
      document.getElementById('ed-radius').value   = site.style.radius;
      document.getElementById('ed-fill').value     = site.style.fill;
      document.getElementById('ed-fillop').value   = site.style.fillOpacity;
      document.getElementById('ed-stroke').value   = site.style.stroke;
      document.getElementById('ed-stroke-w').value = site.style.strokeWeight;
    }
  }
  function closeCard(){ card.classList.add('hidden'); selectedId=null; hoverId=null; }

  function syncFeature(site){
    const m = markers.find(x => x.__id === site.id);
    const c = circles.find(x => x.__id === site.id);
    if (!m || !c) return;
    const pos = { lat: site.lat, lng: site.lng };
    m.setPosition(pos); c.setCenter(pos);
    c.setOptions({
      radius: site.style.radius, fillColor: site.style.fill, fillOpacity: site.style.fillOpacity,
      strokeColor: site.style.stroke, strokeWeight: site.style.strokeWeight
    });
    if (!isShare) localStorage.setItem(LS_KEY, JSON.stringify(state));
    if (selectedId === site.id){
      coordEl.textContent = `${toFixed6(site.lat)}, ${toFixed6(site.lng)}`;
      radiusEl.textContent = `${site.style.radius} م`;
      recEl.textContent = renderRecipients(site.recipients);
    }
  }

  function createFeature(site){
    byId[site.id] = site;
    const pos = { lat: site.lat, lng: site.lng };

    const marker = new google.maps.Marker({
      position: pos, map, title: site.name,
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor:'#e11d48', fillOpacity:1, strokeColor:'#ffffff', strokeWeight:2 },
      draggable: !isShare, zIndex: 2
    });
    marker.__id = site.id; markers.push(marker);

    const circle = new google.maps.Circle({
      map, center: pos, radius: site.style.radius,
      strokeColor: site.style.stroke, strokeOpacity: 0.95, strokeWeight: site.style.strokeWeight,
      fillColor: site.style.fill, fillOpacity: site.style.fillOpacity,
      clickable: true, cursor: 'pointer', zIndex: 1
    });
    circle.__id = site.id; circles.push(circle);

    function flash(){ circle.setOptions({ strokeOpacity:1, fillOpacity:Math.min(site.style.fillOpacity+0.06,1) });
                      setTimeout(()=>circle.setOptions({ strokeOpacity:0.95, fillOpacity:site.style.fillOpacity }),240); }

    const pinOpen = () => { pinnedId = site.id; openCard(site); map.panTo(pos); flash(); };
    marker.addListener('click', pinOpen);
    circle.addListener('click', pinOpen);

    circle.addListener('mouseover', () => { if (pinnedId) return; hoverId = site.id; openCard(site); flash(); });
    circle.addListener('mouseout',  () => { if (pinnedId) return; if (hoverId===site.id) closeCard(); });

    marker.addListener('dragend', (e) => {
      if (isShare) return;
      site.lat = e.latLng.lat(); site.lng = e.latLng.lng();
      syncFeature(site);
    });
  }

  const bounds = new google.maps.LatLngBounds();
  state.sites.forEach(s => { createFeature(s); bounds.extend({lat:s.lat, lng:s.lng}); });
  if (isShare && !bounds.isEmpty()) map.fitBounds(bounds, 60);

  // أدوات التحرير (الوضع العادي فقط)
  if (!isShare) {
    const toggleMarkers = document.getElementById('toggle-markers');
    const toggleCircles = document.getElementById('toggle-circles');
    const baseMapSel = document.getElementById('basemap');
    const shareBtn = document.getElementById('share-btn');
    const toast = document.getElementById('toast');

    const edRadius  = document.getElementById('ed-radius');
    const edFill    = document.getElementById('ed-fill');
    const edFillOp  = document.getElementById('ed-fillop');
    const edStroke  = document.getElementById('ed-stroke');
    const edStrokeW = document.getElementById('ed-stroke-w');
    const btnAdd    = document.getElementById('btn-add');
    const btnDel    = document.getElementById('btn-del');

    baseMapSel.value = map.getMapTypeId();
    toggleMarkers.addEventListener('change', () => { const on = toggleMarkers.checked; markers.forEach(m=>m.setMap(on?map:null)); });
    toggleCircles.addEventListener('change', () => { const on = toggleCircles.checked; circles.forEach(c=>c.setMap(on?map:null)); });
    baseMapSel.addEventListener('change', () => map.setMapTypeId(baseMapSel.value));

    function withSel(fn){ if (!selectedId) return; const s = byId[selectedId]; fn(s); syncFeature(s); }
    edRadius.addEventListener('input', () => withSel(s => s.style.radius = parseInt(edRadius.value,10)));
    edFill.addEventListener('input',   () => withSel(s => s.style.fill = edFill.value));
    edFillOp.addEventListener('input', () => withSel(s => s.style.fillOpacity = parseFloat(edFillOp.value)));
    edStroke.addEventListener('input', () => withSel(s => s.style.stroke = edStroke.value));
    edStrokeW.addEventListener('input',() => withSel(s => s.style.strokeWeight = parseInt(edStrokeW.value,10)));

    btnAdd.addEventListener('click', () => {
      const c = map.getCenter();
      const site = { id:'s-'+Math.random().toString(36).slice(2,8), name:'موقع جديد', type:'نقطة', lat:c.lat(), lng:c.lng(),
        recipients:[], style:{...DEF_STYLE} };
      state.sites.push(site); createFeature(site); bounds.extend({lat:site.lat,lng:site.lng});
      pinnedId = site.id; openCard(site); saveLocal(state);
    });
    btnDel.addEventListener('click', () => {
      if (!selectedId) return;
      const i = state.sites.findIndex(x=>x.id===selectedId);
      if (i>=0){
        const mIdx = markers.findIndex(m=>m.__id===selectedId);
        const cIdx = circles.findIndex(c=>c.__id===selectedId);
        if (mIdx>=0){ markers[mIdx].setMap(null); markers.splice(mIdx,1); }
        if (cIdx>=0){ circles[cIdx].setMap(null); circles.splice(cIdx,1); }
        delete byId[selectedId];
        state.sites.splice(i,1);
        pinnedId=null; closeCard(); saveLocal(state);
      }
    });

    // محرر المستلمين
    document.getElementById('edit-recipients')?.addEventListener('click', () => {
      if (!selectedId) return; const s = byId[selectedId];
      editorInput.value = (s.recipients||[]).join('\n'); editor.classList.remove('hidden'); editorInput.focus();
    });
    editorCancel.addEventListener('click', ()=> editor.classList.add('hidden'));
    editorSave.addEventListener('click', () => {
      if (!selectedId) return; const s = byId[selectedId];
      s.recipients = editorInput.value.split('\n').map(x=>x.trim()).filter(Boolean);
      syncFeature(s); editor.classList.add('hidden'); saveLocal(state);
    });

    // رابط المشاركة القصير: ?view=share&s=...
    shareBtn.addEventListener('click', async () => {
      const s = encodeShareState({ traffic: trafficOn, sites: state.sites });
      const url = `${location.origin}${location.pathname}?view=share&s=${s}`;
      try{ await navigator.clipboard.writeText(url); }catch{}
      toast.textContent='تم النسخ ✅'; toast.classList.remove('hidden');
      setTimeout(()=>toast.classList.add('hidden'), 2000);
    });
  }

  // إغلاق الكرت عند الضغط على الخريطة وفك التثبيت
  map.addListener('click', () => { pinnedId=null; closeCard(); });

  console.log(isShare ? 'Share View (c2 compact)' : 'Editor View');
};

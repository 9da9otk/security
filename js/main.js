/* Diriyah Security Map – v6 (Mobile-proof Share + Glass Card + View-only on share) */

let map, trafficLayer, infoWin=null;
let cardPinned=false, editMode=false, shareMode=false, hideTimer=null;

// toolbar refs
let btnRoadmap, btnSatellite, btnTraffic, btnEditMode, btnShare, modeBadge, toast;

const DEFAULT_CENTER = { lat:24.7399, lng:46.5731 };
const DEFAULT_RADIUS = 15;
const DEFAULT_COLOR  = '#c1a476';
const DEFAULT_FILL_OPACITY = 0.18;
const DEFAULT_STROKE_WEIGHT = 2;
const CIRCLE_Z = 9999;

const LOCATIONS = [
  { id:0,  name:"بوابة سمحان",                          lat:24.742132284177778, lng:46.569503913805825 },
  { id:1,  name:"منطقة سمحان",                          lat:24.74091335108621,  lng:46.571891407130025 },
  { id:2,  name:"دوار البجيري",                         lat:24.737521801476476, lng:46.57406918772067  },
  { id:3,  name:"إشارة البجيري",                        lat:24.73766260194535,  lng:46.575429040147306 },
  { id:4,  name:"طريق الملك فيصل",                      lat:24.736133848943062, lng:46.57696607050239  },
  { id:5,  name:"نقطة فرز الشلهوب",                     lat:24.73523670533632,  lng:46.57785639752234  },
  { id:6,  name:"المسار الرياضي المديد",                lat:24.735301077804944, lng:46.58178092599035  },
  { id:7,  name:"ميدان الملك سلمان",                    lat:24.73611373368281,  lng:46.58407097038162  },
  { id:8,  name:"دوار الضوء الخافت",                     lat:24.739718342668006, lng:46.58352614787052  },
  { id:9,  name:"المسار الرياضي طريق الملك خالد الفرعي", lat:24.740797019998627, lng:46.5866145907347   },
  { id:10, name:"دوار البلدية",                          lat:24.739266101368777, lng:46.58172727078356  },
  { id:11, name:"مدخل ساحة البلدية الفرعي",             lat:24.738638518378387, lng:46.579858026042785 },
  { id:12, name:"مدخل مواقف البجيري (كار بارك)",        lat:24.73826438056506,  lng:46.57789576275729  },
  { id:13, name:"مواقف الامن",                           lat:24.73808736962705,  lng:46.57771858346317  },
  { id:14, name:"دوار الروقية",                          lat:24.741985907266145, lng:46.56269186990043  },
  { id:15, name:"بيت مبارك",                             lat:24.732609768937607, lng:46.57827089439368  },
  { id:16, name:"دوار وادي صفار",                        lat:24.72491458984474,  lng:46.57345489743978  },
  { id:17, name:"دوار راس النعامة",                      lat:24.710329841152387, lng:46.572921959358204 },
  { id:18, name:"مزرعة الحبيب",                          lat:24.709445443672344, lng:46.593971867951346 },
];

const circles = []; // [{id, circle, meta:{name, recipients:[]}}]

/* ========= LZ-String (subset) لروابط قصيرة وآمنة ========= */
const LZ = (function(){
  function u(e){return unescape(encodeURIComponent(e))}
  function d(e){return decodeURIComponent(escape(e))}
  const f="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
  const keyStrUriSafe=f;
  function getBaseValue(alphabet,c){return alphabet.indexOf(c)}
  function compressToEncodedURIComponent(input){
    if(input==null) return "";
    return _compress(input,6,function(a){return keyStrUriSafe.charAt(a)})+"~";
  }
  function decompressFromEncodedURIComponent(input){
    if(input==null) return "";
    if(input.charAt(input.length-1)!=="~") return "";
    input=input.substring(0,input.length-1);
    return _decompress(input.length,32,function(index){return getBaseValue(keyStrUriSafe,input.charAt(index))});
  }
  function _compress(uncompressed, bitsPerChar, getCharFromInt){
    if(uncompressed==null) return "";
    var i,value,context_dictionary={},context_dictionaryToCreate={},context_c,context_wc,context_w="",context_enlargeIn=2,context_dictSize=3,context_numBits=2,context_data=[],context_data_val=0,context_data_position=0;
    for(i=0;i<uncompressed.length;i+=1){context_c=uncompressed.charAt(i);if(!Object.prototype.hasOwnProperty.call(context_dictionary,context_c)){context_dictionary[context_c]=context_dictSize++;context_dictionaryToCreate[context_c]=true}
      context_wc=context_w+context_c;if(Object.prototype.hasOwnProperty.call(context_dictionary,context_wc)){context_w=context_wc}else{if(Object.prototype.hasOwnProperty.call(context_dictionaryToCreate,context_w)){if(context_w.charCodeAt(0)<256){for(i=0;i<context_numBits;i++)context_data_val=context_data_val<<1;if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0}else context_data_position++ ;value=context_w.charCodeAt(0);for(i=0;i<8;i++){context_data_val=context_data_val<<1|value&1; if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0}else context_data_position++; value=value>>1 }}else{value=1;for(i=0;i<context_numBits;i++){context_data_val=context_data_val<<1|value&1; if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0}else context_data_position++ } value=context_w.charCodeAt(0);for(i=0;i<16;i++){context_data_val=context_data_val<<1|value&1; if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0}else context_data_position++; value=value>>1 }} context_enlargeIn--; if(context_enlargeIn==0){context_enlargeIn=Math.pow(2,context_numBits);context_numBits++} delete context_dictionaryToCreate[context_w]}else{value=context_dictionary[context_w];for(i=0;i<context_numBits;i++){context_data_val=context_data_val<<1|value&1; if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0}else context_data_position++ } } context_enlargeIn--; if(context_enlargeIn==0){context_enlargeIn=Math.pow(2,context_numBits);context_numBits++} context_dictionary[context_wc]=context_dictSize++; context_w=String(context_c)}
    if(context_w!==""){ if(Object.prototype.hasOwnProperty.call(context_dictionaryToCreate,context_w)){ if(context_w.charCodeAt(0)<256){ for(i=0;i<context_numBits;i++)context_data_val=context_data_val<<1; if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0}else context_data_position++; value=context_w.charCodeAt(0); for(i=0;i<8;i++){context_data_val=context_data_val<<1|value&1; if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0}else context_data_position++; value=value>>1 }} else { value=1; for(i=0;i<context_numBits;i++){context_data_val=context_data_val<<1|value&1; if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0}else context_data_position++ } value=context_w.charCodeAt(0); for(i=0;i<16;i++){context_data_val=context_data_val<<1|value&1; if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0}else context_data_position++; value=value>>1 } } context_enlargeIn--; if(context_enlargeIn==0){context_enlargeIn=Math.pow(2,context_numBits);context_numBits++} } value=2; for(i=0;i<context_numBits;i++){context_data_val=context_data_val<<1|value&1; if(context_data_position==bitsPerChar-1){context_data_position=0;context_data.push(getCharFromInt(context_data_val));context_data_val=0}else context_data_position++ }
    while(true){context_data_val=context_data_val<<1; if(context_data_position==bitsPerChar-1){context_data.push(getCharFromInt(context_data_val));break}else context_data_position++}
    return context_data.join("");
  }
  function _decompress(length, resetValue, getNextValue){
    var dictionary=[], next, enlargeIn=4, dictSize=4, numBits=3, entry="", result=[], i, w, bits, resb, maxpower, power, c, data={val:getNextValue(0), position:resetValue, index:1};
    for(i=0;i<3;i+=1) dictionary[i]=i;
    bits=0; maxpower=Math.pow(2,2); power=1; while(power!=maxpower){ resb=data.val&data.position; data.position>>=1; if(data.position==0){ data.position=resetValue; data.val=getNextValue(data.index++);} bits|=(resb>0?1:0)*power; power<<=1 }
    switch(next=bits){
      case 0: bits=0; maxpower=Math.pow(2,8); power=1; while(power!=maxpower){ resb=data.val&data.position; data.position>>=1; if(data.position==0){ data.position=resetValue; data.val=getNextValue(data.index++);} bits|=(resb>0?1:0)*power; power<<=1 } c=String.fromCharCode(bits); break;
      case 1: bits=0; maxpower=Math.pow(2,16); power=1; while(power!=maxpower){ resb=data.val&data.position; data.position>>=1; if(data.position==0){ data.position=resetValue; data.val=getNextValue(data.index++);} bits|=(resb>0?1:0)*power; power<<=1 } c=String.fromCharCode(bits); break;
      case 2: return "";
    }
    dictionary[3]=c; w=c; result.push(c);
    while(true){
      if(data.index>length) return "";
      bits=0; maxpower=Math.pow(2,numBits); power=1; while(power!=maxpower){ resb=data.val&data.position; data.position>>=1; if(data.position==0){ data.position=resetValue; data.val=getNextValue(data.index++);} bits|=(resb>0?1:0)*power; power<<=1 }
      switch(c=next=bits){
        case 0: bits=0; maxpower=Math.pow(2,8); power=1; while(power!=maxpower){ resb=data.val&data.position; data.position>>=1; if(data.position==0){ data.position=resetValue; data.val=getNextValue(data.index++);} bits|=(resb>0?1:0)*power; power<<=1 } dictionary[dictSize++]=String.fromCharCode(bits); c=dictSize-1; enlargeIn--; break;
        case 1: bits=0; maxpower=Math.pow(2,16); power=1; while(power!=maxpower){ resb=data.val&data.position; data.position>>=1; if(data.position==0){ data.position=resetValue; data.val=getNextValue(data.index++);} bits|=(resb>0?1:0)*power; power<<=1 } dictionary[dictSize++]=String.fromCharCode(bits); c=dictSize-1; enlargeIn--; break;
        case 2: return result.join("");
      }
      if(enlargeIn==0){enlargeIn=Math.pow(2,numBits); numBits++}
      if(dictionary[c]){ entry=dictionary[c]; }
      else{ if(c===dictSize){ entry=w+w.charAt(0); } else { return ""; } }
      result.push(entry); dictionary[dictSize++]=w+entry.charAt(0); enlargeIn--; w=entry; if(enlargeIn==0){enlargeIn=Math.pow(2,numBits); numBits++}
    }
  }
  return { c:compressToEncodedURIComponent, d:decompressFromEncodedURIComponent };
})();
/* ========================================================= */

/* ===== Share helpers: token في #x=token(.ts) ===== */
function readShareToken() {
  const h = location.hash || "";
  if (!h.startsWith("#x=")) return null;
  // يدعم #x=token أو #x=token.ts
  const raw = h.slice(3);
  const token = raw.split(".")[0];
  const json = LZ.d(token);
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}
function writeShareToken(state){
  if (shareMode) return;
  const token = LZ.c(JSON.stringify(state));
  const h = `#x=${token}.${Date.now().toString(36).slice(-6)}`;
  if (location.hash !== h) history.replaceState(null, "", h);
}

function buildState(){
  const ctr=map.getCenter(), z=map.getZoom();
  const m=map.getMapTypeId()==='roadmap'?'r':'h';
  const tr=btnTraffic.getAttribute('aria-pressed')==='true'?1:0;
  const c=circles.map(({id,circle,meta})=>{
    const r=Math.round(circle.getRadius());
    const sc=(circle.get('strokeColor')||DEFAULT_COLOR).replace('#','');
    const fo=Number((circle.get('fillOpacity')??DEFAULT_FILL_OPACITY).toFixed(2));
    const sw=(circle.get('strokeWeight')??DEFAULT_STROKE_WEIGHT)|0;
    return [id,r,sc,fo,sw,(meta.recipients||[]).join("\n")];
  });
  return {cx:+ctr.lng().toFixed(6), cy:+ctr.lat().toFixed(6), z, m, tr, c};
}
function applyState(s){
  if(!s) return;
  if(Number.isFinite(s.cy)&&Number.isFinite(s.cx)) map.setCenter({lat:s.cy,lng:s.cx});
  if(Number.isFinite(s.z)) map.setZoom(s.z);
  map.setMapTypeId(s.m==='r'?'roadmap':'hybrid');
  btnRoadmap.setAttribute('aria-pressed', String(s.m==='r'));
  btnSatellite.setAttribute('aria-pressed', String(s.m!=='r'));
  if(s.tr){ trafficLayer.setMap(map); btnTraffic.setAttribute('aria-pressed','true'); }
  else    { trafficLayer.setMap(null); btnTraffic.setAttribute('aria-pressed','false'); }
  if(Array.isArray(s.c)){
    s.c.forEach(([id,r,sc,fo,sw,rec])=>{
      const it=circles.find(x=>x.id===id); if(!it) return;
      it.circle.setOptions({
        radius: Number.isFinite(r)?r:DEFAULT_RADIUS,
        strokeColor: sc?`#${sc}`:DEFAULT_COLOR,
        fillColor: sc?`#${sc}`:DEFAULT_COLOR,
        fillOpacity: Number.isFinite(fo)?fo:DEFAULT_FILL_OPACITY,
        strokeWeight: Number.isFinite(sw)?sw:DEFAULT_STROKE_WEIGHT,
      });
      it.meta.recipients = typeof rec==='string' ? parseRecipients(rec) : [];
    });
  }
}
let persistTimer=null; const persist=()=>{ if(shareMode) return; clearTimeout(persistTimer); persistTimer=setTimeout(()=>writeShareToken(buildState()),220); };

/* ===== Init ===== */
function initMap(){
  btnRoadmap  = document.getElementById('btnRoadmap');
  btnSatellite= document.getElementById('btnSatellite');
  btnTraffic  = document.getElementById('btnTraffic');
  btnEditMode = document.getElementById('btnEditMode');
  btnShare    = document.getElementById('btnShare');
  modeBadge   = document.getElementById('modeBadge');
  toast       = document.getElementById('toast');

  map = new google.maps.Map(document.getElementById('map'), {
    center: DEFAULT_CENTER, zoom: 15, mapTypeId:'roadmap',
    disableDefaultUI:true, clickableIcons:false, gestureHandling:'greedy'
  });
  trafficLayer = new google.maps.TrafficLayer();

  btnRoadmap.onclick   = ()=>{ map.setMapTypeId('roadmap');  btnRoadmap.setAttribute('aria-pressed','true');  btnSatellite.setAttribute('aria-pressed','false'); persist(); };
  btnSatellite.onclick = ()=>{ map.setMapTypeId('hybrid');   btnSatellite.setAttribute('aria-pressed','true'); btnRoadmap.setAttribute('aria-pressed','false');  persist(); };
  btnTraffic.onclick   = ()=>{ const on=btnTraffic.getAttribute('aria-pressed')==='true'; if(on){trafficLayer.setMap(null);} else {trafficLayer.setMap(map);} btnTraffic.setAttribute('aria-pressed', String(!on)); persist(); };

  btnEditMode.onclick  = ()=>{ if(shareMode) return; editMode=!editMode; modeBadge.textContent=editMode?'Edit':'Share'; modeBadge.className='badge '+(editMode?'badge-edit':'badge-share'); cardPinned=false; if(infoWin) infoWin.close(); };
  btnShare.onclick     = copyShareLink;

  // أنشئ الدوائر أولاً
  LOCATIONS.forEach(addCircle);

  // اقرأ المشاركة (متوافق جوال) ثم طبّق وضع العرض
  const S = readShareToken();
  shareMode = !!S;
  if(S){ applyState(S); setViewOnly(); }
  else { writeShareToken(buildState()); }

  map.addListener('idle', persist);
  map.addListener('click', ()=>{ cardPinned=false; if(infoWin) infoWin.close(); });
}
window.initMap = initMap;

function setViewOnly(){
  editMode = false;
  modeBadge.textContent='Share';
  modeBadge.className='badge badge-share';
  if(btnEditMode){ btnEditMode.style.display='none'; btnEditMode.disabled=true; }
}

/* ===== Circles & Card ===== */
function addCircle(loc){
  const circle = new google.maps.Circle({
    map, center:{lat:loc.lat,lng:loc.lng}, radius:DEFAULT_RADIUS,
    strokeColor:DEFAULT_COLOR, strokeOpacity:.95, strokeWeight:DEFAULT_STROKE_WEIGHT,
    fillColor:DEFAULT_COLOR, fillOpacity:DEFAULT_FILL_OPACITY,
    clickable:true, draggable:false, editable:false, zIndex:CIRCLE_Z
  });
  const meta = { name:loc.name, recipients:[] };
  const item = { id:loc.id, circle, meta };
  circles.push(item);

  circle.addListener('mouseover', ()=>{ clearTimeout(hideTimer); if(!cardPinned) openCard(item); });
  circle.addListener('mouseout',  ()=>{ if(cardPinned) return; hideTimer=setTimeout(()=>{ if(infoWin) infoWin.close(); },120); });
  circle.addListener('click',     ()=>{ openCard(item); cardPinned=true; });
}

function openCard(item){
  if(!infoWin){
    infoWin = new google.maps.InfoWindow({ content:'', maxWidth: 520, pixelOffset: new google.maps.Size(0,-6) });
  }
  infoWin.setContent(renderCard(item));
  infoWin.setPosition(item.circle.getCenter());
  infoWin.open({ map });

  // إزالة الـX والذيل افتراضيًا
  setTimeout(()=>{
    const root = document.getElementById('iw-root');
    if(!root) return;
    const closeBtn = root.parentElement?.querySelector('.gm-ui-hover-effect');
    if(closeBtn) closeBtn.style.display='none';
    const iw = root.closest('.gm-style-iw');
    if(iw && iw.parentElement){
      iw.parentElement.style.background='transparent';
      iw.parentElement.style.boxShadow='none';
      const tail = iw.parentElement.previousSibling;
      if(tail && tail.style) tail.style.display='none';
    }
    attachCardEvents(item);
  },0);
}

function renderCard(item){
  const c = item.circle, meta=item.meta;
  const names = Array.isArray(meta.recipients) ? meta.recipients : [];
  const namesHtml = names.length
    ? `<ol style="margin:6px 0 0 0;padding-inline-start:20px;">${names.map(n=>`<li>${escapeHtml(n)}</li>`).join('')}</ol>`
    : `<div class="note">لا توجد أسماء مضافة</div>`;

  // قيم التحرير
  const radius = Math.round(c.getRadius());
  const color  = c.get('strokeColor') || DEFAULT_COLOR;
  const stroke = c.get('strokeWeight') || DEFAULT_STROKE_WEIGHT;
  const fillO  = Number(c.get('fillOpacity') ?? DEFAULT_FILL_OPACITY);

  return `
  <div id="iw-root" dir="rtl" style="min-width:360px; max-width:520px;">
    <div style="
      background: rgba(255,255,255,0.93);
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(0,0,0,0.06);
      border-radius: 18px; padding: 14px; color:#111;
      box-shadow: 0 16px 36px rgba(0,0,0,.22);">

      <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
        <img src="img/diriyah-logo.png" alt="Diriyah" style="width:50px; height:50px; object-fit:contain;">
        <div style="font-weight:800; font-size:18px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(meta.name)}</div>
        <div style="margin-inline-start:auto;"></div>
        ${(!shareMode && editMode) ? `<span class="badge-edit" style="padding:2px 8px;border-radius:8px;background:#1f5a1f;color:#eaffea;border:1px solid #2d7a2d;">وضع التحرير</span>` : ``}
      </div>

      <div style="border-top:1px dashed #e7e7e7; padding-top:8px;">
        <div style="font-weight:700; margin-bottom:4px;">المستلمون:</div>
        ${namesHtml}
      </div>

      ${(!shareMode && editMode) ? `
      <div style="margin-top:12px; border-top:1px dashed #e7e7e7; padding-top:10px;">
        <div style="font-weight:700; margin-bottom:6px;">أدوات الدائرة:</div>
        <div class="form-grid">
          <div class="field">
            <label>نصف القطر (م):</label>
            <input id="ctl-radius" type="range" min="5" max="120" step="1" value="${radius}" style="width:100%;">
            <span id="lbl-radius" class="note">${radius}</span>
          </div>
          <div class="field">
            <label>اللون:</label>
            <input id="ctl-color" type="color" value="${toHex(color)}">
          </div>
          <div class="field">
            <label>حدّ الدائرة:</label>
            <input id="ctl-stroke" type="number" min="1" max="8" step="1" value="${stroke}" style="width:70px;">
          </div>
          <div class="field">
            <label>شفافية التعبئة:</label>
            <input id="ctl-fill" type="range" min="0" max="0.8" step="0.02" value="${fillO}" style="width:100%;">
            <span id="lbl-fill" class="note">${fillO.toFixed(2)}</span>
          </div>
        </div>

        <div style="margin-top:8px;">
          <label class="note">أسماء المستلمين (سطر لكل اسم):</label>
          <textarea id="ctl-names" rows="4" style="width:100%; background:#fff; border:1px solid #ddd; border-radius:10px; padding:8px; white-space:pre;">${escapeHtml(names.join("\n"))}</textarea>
          <div style="display:flex; gap:8px; margin-top:8px;">
            <button id="btn-save"  style="border:1px solid #ddd; background:#fff; border-radius:10px; padding:6px 10px; cursor:pointer;">حفظ</button>
            <button id="btn-clear" style="border:1px solid #ddd; background:#fff; border-radius:10px; padding:6px 10px; cursor:pointer;">حذف الأسماء</button>
          </div>
        </div>
      </div>` : ``}
    </div>
  </div>`;
}

function attachCardEvents(item){
  if(shareMode || !editMode) return;
  const c=item.circle;
  const r = document.getElementById('ctl-radius');
  const lr= document.getElementById('lbl-radius');
  const col=document.getElementById('ctl-color');
  const sw =document.getElementById('ctl-stroke');
  const fo =document.getElementById('ctl-fill');
  const lf =document.getElementById('lbl-fill');
  const names=document.getElementById('ctl-names');
  const save=document.getElementById('btn-save');
  const clr =document.getElementById('btn-clear');

  r?.addEventListener('input', ()=>{ const v=+r.value||DEFAULT_RADIUS; lr.textContent=v; c.setRadius(v); persist(); });
  col?.addEventListener('input', ()=>{ const v=col.value||DEFAULT_COLOR; c.setOptions({strokeColor:v, fillColor:v}); persist(); });
  sw?.addEventListener('input', ()=>{ const v=clamp(+sw.value,1,8); sw.value=v; c.setOptions({strokeWeight:v}); persist(); });
  fo?.addEventListener('input', ()=>{ const v=clamp(+fo.value,0,0.8); lf.textContent=v.toFixed(2); c.setOptions({fillOpacity:v}); persist(); });

  save?.addEventListener('click', ()=>{ item.meta.recipients = parseRecipients(names.value); openCard(item); persist(); });
  clr?.addEventListener('click',  ()=>{ item.meta.recipients = []; openCard(item); persist(); });
}

/* ===== Share button ===== */
async function copyShareLink(){
  writeShareToken(buildState());
  try{ await navigator.clipboard.writeText(location.href); showToast('تم نسخ رابط المشاركة ✅'); }
  catch{
    const tmp=document.createElement('input'); tmp.value=location.href; document.body.appendChild(tmp);
    tmp.select(); document.execCommand('copy'); tmp.remove(); showToast('تم نسخ رابط المشاركة ✅');
  }
}

/* ===== Helpers ===== */
function clamp(x,min,max){ return Math.min(max, Math.max(min, x)); }
function toHex(col){ if(/^#/.test(col)) return col; const m=col.match(/rgba?\s*\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i); if(!m) return DEFAULT_COLOR; const [r,g,b]=[+m[1],+m[2],+m[3]]; return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join(''); }
function parseRecipients(text){ return String(text).split(/\r?\n/).map(s=>s.replace(/[،;,]+/g,' ').trim()).filter(Boolean); }
function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function showToast(msg){ if(!toast) return; toast.textContent=msg; toast.classList.remove('hidden'); setTimeout(()=>toast.classList.add('hidden'),1600); }

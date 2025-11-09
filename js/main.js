// ===== Helpers =====
function qs() { return new URLSearchParams(location.search); }
function qh() {
  const h = (location.hash || '').replace(/^#/, '');
  const p = new URLSearchParams(h.includes('=') ? h : ('s='+h));
  return p;
}
function toFixed6(x){ return Number(x).toFixed ? Number(x).toFixed(6) : x; }

// ===== Base64URL =====
function b64e(s){ return btoa(unescape(encodeURIComponent(s))); }
function b64d(s){ return decodeURIComponent(escape(atob(s))); }
function toUrl(b){ return b.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function fromUrl(u){ let b=u.replace(/-/g,'+').replace(/_/g,'/'); while(b.length%4)b+='='; return b; }

// ===== Compact payload v=c2 =====
const DEF_STYLE = { radius:15, fill:'#60a5fa', fillOpacity:0.16, stroke:'#60a5fa', strokeWeight:2 };
const nToB36 = n => Math.round(n).toString(36);
const b36ToN = s => parseInt(s,36);

function packSite(s){
  const latE5 = Math.round(s.lat*1e5), lngE5 = Math.round(s.lng*1e5);
  const st = s.style || DEF_STYLE;
  const def = st.radius===DEF_STYLE.radius &&
              (st.fill||'').toLowerCase()===(DEF_STYLE.fill).toLowerCase() &&
              Math.abs((+st.fillOpacity)-(DEF_STYLE.fillOpacity))<1e-9 &&
              (st.stroke||'').toLowerCase()===(DEF_STYLE.stroke).toLowerCase() &&
              (st.strokeWeight||2)===(DEF_STYLE.strokeWeight);
  return [
    s.name, s.type||'', nToB36(latE5), nToB36(lngE5),
    def ? 0 : [st.radius||15,(st.fill||DEF_STYLE.fill).replace('#','').toLowerCase(), +(+st.fillOpacity).toFixed(2),
               (st.stroke||DEF_STYLE.stroke).replace('#','').toLowerCase(), st.strokeWeight||2],
    (s.recipients && s.recipients.length) ? s.recipients.join('|') : ''
  ];
}
function unpackSite(a){
  const [name,type,latB,lngB,styleOr0,recStr=''] = a;
  const lat=b36ToN(latB)/1e5, lng=b36ToN(lngB)/1e5;
  let style = { ...DEF_STYLE };
  if (styleOr0 && styleOr0!==0){
    const [r,fillHex,fop,strokeHex,sw] = styleOr0;
    style = { radius:r??15, fill:'#'+(fillHex||'60a5fa'), fillOpacity:fop??0.16, stroke:'#'+(strokeHex||'60a5fa'), strokeWeight:sw??2 };
  }
  return { id:'s-'+Math.random().toString(36).slice(2,8), name, type, lat, lng, recipients: recStr?recStr.split('|'):[], style };
}
function encState(st){ return toUrl(b64e(JSON.stringify({v:'c2', t:st.traffic?1:0, s:st.sites.map(packSite)}))); }
function decState(s){
  try{ const o = JSON.parse(b64d(fromUrl(s)));
       if (o && o.v==='c2' && Array.isArray(o.s)) return { traffic:!!o.t, sites:o.s.map(unpackSite) }; }catch{}
  return null;
}

// ===== Storage =====
const LS_KEY='security:state.v3';
const loadLocal=()=>{ try{const s=localStorage.getItem(LS_KEY);return s?JSON.parse(s):null;}catch{return null;} };
const saveLocal=s=>{ try{localStorage.setItem(LS_KEY,JSON.stringify(s));}catch{} };

// ===== Defaults (your sites) =====
function defaultState(){
  const S=(n,la,ln,t)=>({id:'s-'+Math.random().toString(36).slice(2,8),name:n,type:t,lat:la,lng:ln,recipients:[],style:{...DEF_STYLE}});
  return { traffic:false, sites:[
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
  ]};
}

// ===== App =====
window.initMap = function(){
  const sp = qs(), hp = qh();
  const hashHasS = !!hp.get('s');
  const queryIsShare = (sp.get('view')||'').toLowerCase()==='share' || !!sp.get('s');
  const isShare = hashHasS || queryIsShare;

  // lock UI in share
  if (isShare){ document.body.classList.add('share'); document.getElementById('panel')?.remove(); document.getElementById('editor')?.remove(); document.getElementById('edit-actions')?.remove(); }

  // state source: hash > query > local > default
  const sParam = hashHasS ? hp.get('s') : (sp.get('s')||'');
  let state = isShare ? (sParam ? (decState(sParam)||defaultState()) : defaultState())
                      : (loadLocal()||defaultState());

  const map = new google.maps.Map(document.getElementById('map'), {
    center:{lat:24.7418,lng:46.5758}, zoom:14, mapTypeId:'roadmap',
    gestureHandling:'greedy', disableDefaultUI:false, mapTypeControl:true, zoomControl:true,
    streetViewControl:false, fullscreenControl:true, keyboardShortcuts:true
  });

  const trafficLayer = new google.maps.TrafficLayer();
  let trafficOn = !!state.traffic;
  const trafficBtn = document.getElementById('traffic-toggle');
  function setTraffic(on){ trafficOn=!!on; trafficBtn?.setAttribute('aria-pressed', on?'true':'false'); trafficLayer.setMap(on?map:null); }
  setTraffic(trafficOn);
  trafficBtn?.addEventListener('click',()=>setTraffic(!trafficOn));

  // card refs
  const card=document.getElementById('info-card');
  const nameEl=document.getElementById('site-name');
  const typeEl=document.getElementById('site-type');
  const coordEl=document.getElementById('site-coord');
  const radiusEl=document.getElementById('site-radius');
  const recEl=document.getElementById('site-recipients');
  const editActions=document.getElementById('edit-actions');
  card.querySelector('.close').addEventListener('click',()=>{pinnedId=null; closeCard();});

  // collections
  const markers=[], circles=[], byId=Object.create(null);
  let selectedId=null, pinnedId=null, hoverId=null;

  function renderRecipients(a){return (a&&a.length)?a.join('، '):'—';}
  function openCard(s){
    selectedId=s.id;
    nameEl.textContent=s.name||'—';
    typeEl.textContent=s.type||'—';
    coordEl.textContent=`${toFixed6(s.lat)}, ${toFixed6(s.lng)}`;
    radiusEl.textContent=`${s.style.radius} م`;
    recEl.textContent=renderRecipients(s.recipients);
    if(!isShare) editActions.classList.remove('hidden'); else editActions?.classList.add('hidden');
    card.classList.remove('hidden');
    if(!isShare){
      document.getElementById('ed-radius').value=s.style.radius;
      document.getElementById('ed-fill').value=s.style.fill;
      document.getElementById('ed-fillop').value=s.style.fillOpacity;
      document.getElementById('ed-stroke').value=s.style.stroke;
      document.getElementById('ed-stroke-w').value=s.style.strokeWeight;
    }
  }
  function closeCard(){ card.classList.add('hidden'); selectedId=null; hoverId=null; }

  // live snapshot from map
  const normHex = c => {c=(c||'#60a5fa').toLowerCase(); return c.startsWith('#')?c:('#'+c);};
  function snapshotFromMap(){
    const ed=document.getElementById('editor');
    if(ed && !ed.classList.contains('hidden') && typeof selectedId==='string'){
      const s=byId[selectedId];
      if(s){
        s.recipients=(document.getElementById('editor-input').value||'').split('\n').map(x=>x.trim()).filter(Boolean);
      }
    }
    const sites = circles.map(c=>{
      const id=c.__id, s=byId[id]||{}, ctr=c.getCenter();
      return {
        id, name:s.name||'', type:s.type||'',
        lat:+ctr.lat(), lng:+ctr.lng(),
        recipients:Array.isArray(s.recipients)?s.recipients.slice():[],
        style:{ radius:+c.getRadius(), fill:normHex(c.get('fillColor')), fillOpacity:+c.get('fillOpacity'),
                stroke:normHex(c.get('strokeColor')), strokeWeight:+(c.get('strokeWeight')||2) }
      };
    });
    return { traffic:trafficOn, sites };
  }

  function syncFeature(s){
    const m=markers.find(x=>x.__id===s.id), c=circles.find(x=>x.__id===s.id);
    if(!m||!c) return;
    const pos={lat:s.lat,lng:s.lng};
    m.setPosition(pos); c.setCenter(pos);
    c.setOptions({ radius:s.style.radius, fillColor:s.style.fill, fillOpacity:s.style.fillOpacity,
                   strokeColor:s.style.stroke, strokeWeight:s.style.strokeWeight });
    if(selectedId===s.id){
      coordEl.textContent=`${toFixed6(s.lat)}, ${toFixed6(s.lng)}`;
      radiusEl.textContent=`${s.style.radius} م`;
      recEl.textContent=renderRecipients(s.recipients);
    }
    if(!isShare) saveLocal(snapshotFromMap());
  }

  function createFeature(s){
    byId[s.id]=s;
    const pos={lat:s.lat,lng:s.lng};
    const marker=new google.maps.Marker({
      position:pos,map,title:s.name,
      icon:{path:google.maps.SymbolPath.CIRCLE,scale:6,fillColor:'#e11d48',fillOpacity:1,strokeColor:'#fff',strokeWeight:2},
      draggable:!isShare,zIndex:2
    });
    marker.__id=s.id; markers.push(marker);

    const circle=new google.maps.Circle({
      map,center:pos,radius:s.style.radius,
      strokeColor:s.style.stroke,strokeOpacity:0.95,strokeWeight:s.style.strokeWeight,
      fillColor:s.style.fill,fillOpacity:s.style.fillOpacity,
      clickable:true,cursor:'pointer',zIndex:1
    });
    circle.__id=s.id; circles.push(circle);

    const flash=()=>{circle.setOptions({strokeOpacity:1,fillOpacity:Math.min(s.style.fillOpacity+0.06,1)});
                     setTimeout(()=>circle.setOptions({strokeOpacity:0.95,fillOpacity:s.style.fillOpacity}),240);};
    const pinOpen=()=>{pinnedId=s.id; openCard(s); map.panTo(pos); flash();};
    marker.addListener('click',pinOpen);
    circle.addListener('click',pinOpen);
    circle.addListener('mouseover',()=>{ if(pinnedId) return; hoverId=s.id; openCard(s); flash(); });
    circle.addListener('mouseout', ()=>{ if(pinnedId) return; if(hoverId===s.id) closeCard(); });

    marker.addListener('dragend',e=>{ if(isShare) return; s.lat=e.latLng.lat(); s.lng=e.latLng.lng(); syncFeature(s); });
  }

  // build features + bounds
  const bounds=new google.maps.LatLngBounds();
  state.sites.forEach(s=>{ createFeature(s); bounds.extend({lat:s.lat,lng:s.lng}); });
  if(isShare && !bounds.isEmpty()) map.fitBounds(bounds,60);

  // ===== editor-only =====
  if(!isShare){
    const toggleMarkers=document.getElementById('toggle-markers');
    const toggleCircles=document.getElementById('toggle-circles');
    const baseMapSel=document.getElementById('basemap');
    const shareBtn=document.getElementById('share-btn');
    const toastEl=document.getElementById('toast');
    const previewBox=document.getElementById('share-preview');
    const shareInput=document.getElementById('share-url');
    const openBtn=document.getElementById('open-url');

    const edRadius=document.getElementById('ed-radius');
    const edFill=document.getElementById('ed-fill');
    const edFillOp=document.getElementById('ed-fillop');
    const edStroke=document.getElementById('ed-stroke');
    const edStrokeW=document.getElementById('ed-stroke-w');
    const btnAdd=document.getElementById('btn-add');
    const btnDel=document.getElementById('btn-del');

    baseMapSel.value = map.getMapTypeId();
    toggleMarkers.addEventListener('change',()=>{ const on=toggleMarkers.checked; markers.forEach(m=>m.setMap(on?map:null)); });
    toggleCircles.addEventListener('change',()=>{ const on=toggleCircles.checked; circles.forEach(c=>c.setMap(on?map:null)); });
    baseMapSel.addEventListener('change',()=>map.setMapTypeId(baseMapSel.value));

    const withSel=fn=>{ if(!selectedId) return; const s=byId[selectedId]; fn(s); syncFeature(s); };
    edRadius.addEventListener('input', ()=>withSel(s=>s.style.radius=edRadius.valueAsNumber||parseInt(edRadius.value,10)));
    edFill  .addEventListener('input', ()=>withSel(s=>s.style.fill=(edFill.value||'#60a5fa').toLowerCase()));
    edFillOp.addEventListener('input', ()=>withSel(s=>s.style.fillOpacity=(edFillOp.valueAsNumber ?? parseFloat(edFillOp.value))));
    edStroke.addEventListener('input', ()=>withSel(s=>s.style.stroke=(edStroke.value||'#60a5fa').toLowerCase()));
    edStrokeW.addEventListener('input',()=>withSel(s=>s.style.strokeWeight=edStrokeW.valueAsNumber||parseInt(edStrokeW.value,10)));

    btnAdd.addEventListener('click',()=>{
      const c=map.getCenter();
      const s={id:'s-'+Math.random().toString(36).slice(2,8),name:'موقع جديد',type:'نقطة',lat:c.lat(),lng:c.lng(),recipients:[],style:{...DEF_STYLE}};
      state.sites.push(s); createFeature(s); bounds.extend({lat:s.lat,lng:s.lng});
      pinnedId=s.id; openCard(s); saveLocal(snapshotFromMap());
    });
    btnDel.addEventListener('click',()=>{
      if(!selectedId) return;
      const i=state.sites.findIndex(x=>x.id===selectedId);
      if(i>=0){
        const mi=markers.findIndex(m=>m.__id===selectedId);
        const ci=circles.findIndex(c=>c.__id===selectedId);
        if(mi>=0){ markers[mi].setMap(null); markers.splice(mi,1); }
        if(ci>=0){ circles[ci].setMap(null); circles.splice(ci,1); }
        delete byId[selectedId]; state.sites.splice(i,1);
        pinnedId=null; closeCard(); saveLocal(snapshotFromMap());
      }
    });

    // recipients editor
    document.getElementById('edit-recipients')?.addEventListener('click',()=>{
      if(!selectedId) return;
      document.getElementById('editor').classList.remove('hidden');
      document.getElementById('editor-input').value=(byId[selectedId].recipients||[]).join('\n');
      document.getElementById('editor-input').focus();
    });
    document.getElementById('editor-cancel')?.addEventListener('click',()=>document.getElementById('editor').classList.add('hidden'));
    document.getElementById('editor-save')?.addEventListener('click',()=>{
      if(!selectedId) return; const s=byId[selectedId];
      s.recipients=(document.getElementById('editor-input').value||'').split('\n').map(x=>x.trim()).filter(Boolean);
      document.getElementById('editor').classList.add('hidden'); syncFeature(s); saveLocal(snapshotFromMap());
    });

    // SHARE: use hash link (#s=...) to survive messengers
    async function doShare(){
      const snap=snapshotFromMap();
      const s=encState(snap);
      const url=`${location.origin}${location.pathname}#s=${s}`;   // ← هاش بدل الكويري

      previewBox?.classList.remove('hidden');
      if(shareInput) shareInput.value=url;

      let copied=false; try{ await navigator.clipboard.writeText(url); copied=true; }catch{}
      if(!copied && shareInput){ shareInput.focus(); shareInput.select(); }
      if(toastEl){ toastEl.textContent = copied?'تم النسخ ✅':'انسخ الرابط من الحقل ↑'; toastEl.classList.remove('hidden'); setTimeout(()=>toastEl.classList.add('hidden'),2000); }
    }
    shareBtn.addEventListener('click',doShare);
    openBtn?.addEventListener('click',()=>{ if(shareInput?.value) window.open(shareInput.value,'_blank'); });
  }

  map.addListener('click',()=>{ pinnedId=null; closeCard(); });

  console.log(isShare ? 'Share View' : 'Editor View');
};

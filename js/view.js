/* عرض فقط – بدون أدوات تحرير */
let map;

function escapeHtml(s=""){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");
}
function fromBase64Url(s){
  s = s.replaceAll("-","+").replaceAll("_","/");
  while(s.length % 4) s += "=";
  const bin = atob(s);
  const arr = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  return arr;
}
function expandData(o){
  const out = {
    center: {lat:o.c?.[0], lng:o.c?.[1], zoom:o.c?.[2]},
    circles: []
  };
  (o.r||[]).forEach(a=>{
    out.circles.push({
      lat:a[0], lng:a[1], radius:a[2],
      strokeColor:a[3], fillColor:a[4], fillOpacity:a[5],
      name:a[6], security:a[7], notes:a[8]
    });
  });
  return out;
}

function infoHtml(data){
  const name = (data.name||"موقع بدون اسم").trim();
  const sec = (data.security||"").trim();
  const notes = (data.notes||"").trim();
  const secLines = sec ? sec.split(/\r?\n/).map(s=>`<div>• ${escapeHtml(s)}</div>`).join("") : "<div>—</div>";
  return `
    <div style="min-width:240px;max-width:320px;direction:rtl;text-align:right;line-height:1.7;color:#fff">
      <div class="custom-badge">${escapeHtml(name)}</div>
      <div style="color:#cbd5e1;font-size:13px;margin-bottom:4px">الأمن:</div>
      <div style="font-size:14px;color:#fff">${secLines}</div>
      ${notes?`<div style="margin-top:8px;color:#cbd5e1;font-size:12px">${escapeHtml(notes)}</div>`:""}
    </div>
  `;
}

window.initMap = function(){
  const p = new URLSearchParams(location.search).get("d");
  if(!p){ alert("لا توجد بيانات لعرضها."); return; }
  let payload;
  try{
    const json = new TextDecoder().decode(fromBase64Url(p));
    payload = expandData(JSON.parse(json));
  }catch(e){
    alert("تعذر تحميل الخريطة من الرابط."); return;
  }

  map = new google.maps.Map(document.getElementById("map"), {
    center:{lat: payload.center.lat, lng: payload.center.lng},
    zoom: payload.center.zoom || 14,
    mapTypeControl: true,
    fullscreenControl: true
  });

  // طبقات بسيطة في العرض
  const traffic = new google.maps.TrafficLayer();
  const transit = new google.maps.TransitLayer();
  const bike    = new google.maps.BicyclingLayer();
  // تفعيل عند الحاجة فقط – افتراضيًا مغلقة
  // traffic.setMap(map);

  const iw = new google.maps.InfoWindow();

  payload.circles.forEach(d=>{
    const circle = new google.maps.Circle({
      map,
      center:{lat:d.lat, lng:d.lng},
      radius: d.radius,
      strokeColor: d.strokeColor || "#7c3aed",
      strokeOpacity: 1,
      strokeWeight: 3,
      fillColor: d.fillColor || "#a78bfa",
      fillOpacity: d.fillOpacity ?? 0.25,
      clickable: true
    });
    const show = (e)=> {
      iw.setContent(infoHtml(d));
      iw.setPosition(circle.getCenter());
      iw.open({map, anchor: circle});
    };
    circle.addListener("click", show);
    circle.addListener("mouseover", show);
  });
};

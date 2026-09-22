// WFAudit · core — cliente API, estado, persistencia de inputs, helpers, modales, toasts, navegación, tema y barra lateral responsive
// La API se sirve desde el MISMO host que la interfaz (puerto 8000), para que
// funcione igual en localhost que accediendo por la IP de la LAN. Si se abre como
// file:// (hostname vacío) se cae a localhost.
const API=`${location.protocol==='https:'?'https':'http'}://${location.hostname||'localhost'}:8000`;
// ─── Token de acceso ─── (solo necesario si el backend se expone en LAN con WFAUDIT_TOKEN)
let AUTH_TOKEN=localStorage.getItem('wf_token')||'';
function setToken(t){AUTH_TOKEN=(t||'').trim();try{AUTH_TOKEN?localStorage.setItem('wf_token',AUTH_TOKEN):localStorage.removeItem('wf_token');}catch{}}
function authHeaders(){return AUTH_TOKEN?{'Authorization':'Bearer '+AUTH_TOKEN}:{};}
// Para URLs que van directas al DOM (img/PDF/descargas) y no pueden llevar cabecera → token por query.
function withTok(u){return AUTH_TOKEN?u+(u.includes('?')?'&':'?')+'token='+encodeURIComponent(AUTH_TOKEN):u;}
const ST={section:'dashboard',theme:localStorage.getItem('theme')||'dark',activeSession:JSON.parse(localStorage.getItem('activeSession')||'null'),processes:[],apiOk:false,lastScan:JSON.parse(localStorage.getItem('lastScan')||'null')};
// ─── Persistencia UNIVERSAL de inputs ───
// Cualquier <input>/<select>/<textarea> con id dentro de #content se guarda
// automáticamente al escribir y se restaura al renderizar cualquier pestaña,
// para no perder la configuración al moverse entre secciones.
const IP=JSON.parse(localStorage.getItem('IP')||'{}');
function _persistable(e){if(!e||!e.id)return false;const tag=e.tagName;if(tag!=='INPUT'&&tag!=='SELECT'&&tag!=='TEXTAREA')return false;const t=(e.type||'').toLowerCase();if(t==='file'||t==='submit'||t==='button'||t==='password'||e.hasAttribute('data-nopersist'))return false;return true;}
function persistInput(e){if(!_persistable(e))return;const c=document.getElementById('content');if(!c||!c.contains(e))return;const t=(e.type||'').toLowerCase();IP[e.id]=(t==='checkbox'||t==='radio')?e.checked:e.value;try{localStorage.setItem('IP',JSON.stringify(IP));}catch{}}
function restoreInputs(root){if(!root)return;root.querySelectorAll('input[id],select[id],textarea[id]').forEach(e=>{if(!(e.id in IP)||!_persistable(e))return;const t=(e.type||'').toLowerCase();if(t==='checkbox'||t==='radio'){e.checked=!!IP[e.id];const mi=e.closest&&e.closest('.mitem');if(mi)mi.classList.toggle('on',e.checked);}else{e.value=IP[e.id];}});}
function setIP(obj){Object.assign(IP,obj);try{localStorage.setItem('IP',JSON.stringify(IP));}catch{}}
// Compat: shims no-op (el sistema universal ya cubre estos casos)
function saveFP(){}function restFP(){}function saveAllFP(){}
async function apiFetch(path,opts={}){const {headers:oh,...rest}=opts;const res=await fetch(API+path,{...rest,headers:{'Content-Type':'application/json',...authHeaders(),...(oh||{})}});if(res.status===401){onAuthFail();throw new Error('No autorizado — se requiere token de acceso');}if(!res.ok){let m=`HTTP ${res.status}`;try{const j=await res.json();m=j.detail||j.error||m;}catch{}throw new Error(m);}const ct=res.headers.get('content-type')||'';if(ct.includes('application/json'))return res.json();return res.text();}
const A={
  health:()=>apiFetch('/system/health'),preflight:()=>apiFetch('/system/preflight'),info:()=>apiFetch('/system/info'),
  authStatus:()=>apiFetch('/system/auth-status'),
  procs:()=>apiFetch('/system/processes'),cancelProc:id=>apiFetch(`/system/processes/${id}/cancel`,{method:'POST'}),
  oui:mac=>apiFetch(`/system/oui/${mac}`),
  ouiDownload:()=>apiFetch('/system/oui/download',{method:'POST'}),
  dataUsage:()=>apiFetch('/system/data-usage'),
  wipeData:()=>apiFetch('/system/wipe-data',{method:'POST'}),
  ifaces:()=>apiFetch('/interfaces/'),netSt:()=>apiFetch('/interfaces/network-status'),
  setMon:(i,k=false)=>apiFetch(`/interfaces/${i}/monitor?kill_conflicting=${k}`,{method:'POST'}),
  setMgd:i=>apiFetch(`/interfaces/${i}/managed`,{method:'POST'}),
  spoofMac:(i,m,vp)=>apiFetch(`/interfaces/${i}/mac${m?`?new_mac=${encodeURIComponent(m)}`:vp?`?vendor_prefix=${encodeURIComponent(vp)}`:''}`,{method:'POST'}),
  channels:i=>apiFetch(`/interfaces/${i}/channels`),
  setTx:(i,p)=>apiFetch(`/interfaces/${i}/txpower?power_dbm=${p}`,{method:'POST'}),
  startScan:b=>apiFetch('/wifi/scan',{method:'POST',body:JSON.stringify(b)}),
  getScan:id=>apiFetch(`/wifi/scans/${id}`),listScans:()=>apiFetch('/wifi/scans'),pnl:id=>apiFetch(`/wifi/scans/${id}/pnl`),
  stopScan:id=>apiFetch(`/wifi/scans/${id}/stop`,{method:'POST'}),
  captureHS:b=>apiFetch('/wifi/handshake',{method:'POST',body:JSON.stringify(b)}),
  crack:b=>apiFetch('/wifi/crack',{method:'POST',body:JSON.stringify(b)}),
  deauth:b=>apiFetch('/wifi/deauth',{method:'POST',body:JSON.stringify(b)}),
  reconMap:()=>apiFetch('/recon/map'),
  reconDiscover:cidr=>apiFetch('/recon/discover',{method:'POST',body:JSON.stringify({cidr})}),
  reconScan:(ip,scan_type)=>apiFetch('/recon/scan',{method:'POST',body:JSON.stringify({ip,scan_type})}),
  reconAddHost:ip=>apiFetch('/recon/host',{method:'POST',body:JSON.stringify({ip})}),
  reconDelHost:ip=>apiFetch('/recon/host/'+encodeURIComponent(ip),{method:'DELETE'}),
  reconUpdateHost:(ip,u)=>apiFetch('/recon/host/'+encodeURIComponent(ip),{method:'PATCH',body:JSON.stringify(u)}),
  reconSetLegend:legend=>apiFetch('/recon/legend',{method:'PUT',body:JSON.stringify({legend})}),
  reconClear:()=>apiFetch('/recon/map',{method:'DELETE'}),
  pmkidCap:b=>apiFetch('/advanced/pmkid/capture',{method:'POST',body:JSON.stringify(b)}),
  pmkidCrack:b=>apiFetch('/advanced/pmkid/crack',{method:'POST',body:JSON.stringify(b)}),
  aplStart:b=>apiFetch('/advanced/apless/start',{method:'POST',body:JSON.stringify(b)}),
  aplStop:()=>apiFetch('/advanced/apless/stop',{method:'POST'}),
  aplSt:()=>apiFetch('/advanced/apless/status'),
  entStart:b=>apiFetch('/advanced/enterprise/start',{method:'POST',body:JSON.stringify(b)}),
  entStop:()=>apiFetch('/advanced/enterprise/stop',{method:'POST'}),
  entSt:()=>apiFetch('/advanced/enterprise/status'),
  entCreds:()=>apiFetch('/advanced/enterprise/credentials'),
  wpa3:b=>apiFetch('/advanced/wpa3/attack',{method:'POST',body:JSON.stringify(b)}),
  etStart:b=>apiFetch('/attacks/evil-twin/start',{method:'POST',body:JSON.stringify(b)}),
  etStop:()=>apiFetch('/attacks/evil-twin/stop',{method:'POST'}),
  etSt:()=>apiFetch('/attacks/evil-twin/status'),
  etFlows:(n=100)=>apiFetch(`/attacks/evil-twin/flows?limit=${n}`),
  etDeauth:b=>apiFetch('/attacks/evil-twin/deauth',{method:'POST',body:JSON.stringify(b)}),
  mitmStart:b=>apiFetch('/attacks/mitm/start',{method:'POST',body:JSON.stringify(b)}),
  mitmStop:()=>apiFetch('/attacks/mitm/stop',{method:'POST'}),
  mitmSt:()=>apiFetch('/attacks/mitm/status'),
  mitmFlows:(n=50,c=false)=>apiFetch(`/attacks/mitm/flows?limit=${n}&credentials_only=${c}`),
  mitmCaCert:()=>apiFetch('/attacks/mitm/ca-cert'),
  caps:(sid)=>apiFetch('/captures/'+(sid?`?session_id=${sid}`:'')),
  checkHS:fp=>apiFetch(`/captures/check-handshake?filepath=${encodeURIComponent(fp)}`,{method:'POST'}),
  delCap:fp=>apiFetch(`/captures/?filepath=${encodeURIComponent(fp)}`,{method:'DELETE'}),
  sessions:()=>apiFetch('/sessions/'),getSession:id=>apiFetch(`/sessions/${id}`),
  createSession:b=>apiFetch('/sessions/',{method:'POST',body:JSON.stringify(b)}),
  updSession:(id,b)=>apiFetch(`/sessions/${id}`,{method:'PATCH',body:JSON.stringify(b)}),
  delSession:id=>apiFetch(`/sessions/${id}`,{method:'DELETE'}),
  closeSession:(id,reason)=>apiFetch(`/sessions/${id}/close`,{method:'POST',body:JSON.stringify({reason:reason||''})}),
  reopenSession:(id,reason)=>apiFetch(`/sessions/${id}/reopen`,{method:'POST',body:JSON.stringify({reason:reason||''})}),
  addEvent:(id,type,message)=>apiFetch(`/sessions/${id}/events`,{method:'POST',body:JSON.stringify({type,message})}),
  addFinding:(sid,b)=>apiFetch(`/sessions/${sid}/findings`,{method:'POST',body:JSON.stringify(b)}),
  updFinding:(sid,fid,b)=>apiFetch(`/sessions/${sid}/findings/${fid}`,{method:'PATCH',body:JSON.stringify(b)}),
  delFinding:(sid,fid)=>apiFetch(`/sessions/${sid}/findings/${fid}`,{method:'DELETE'}),
  uploadPhoto:(sid,fid,file,caption)=>{const fd=new FormData();fd.append('file',file);fd.append('caption',caption||'');return fetch(`${API}/sessions/${sid}/findings/${fid}/photos`,{method:'POST',body:fd,headers:authHeaders()}).then(async r=>{if(!r.ok)throw new Error((await r.json().catch(()=>({}))).detail||'Error subiendo foto');return r.json();});},
  delPhoto:(sid,fid,pid)=>apiFetch(`/sessions/${sid}/findings/${fid}/photos/${pid}`,{method:'DELETE'}),
  photoUrl:(sid,fid,pid)=>withTok(`${API}/sessions/${sid}/findings/${fid}/photos/${pid}`),
  pdfUrl:id=>withTok(`${API}/sessions/${id}/report/pdf`),
  report:id=>apiFetch(`/sessions/${id}/report`),
  wls:()=>apiFetch('/wordlists'),genWL:b=>apiFetch('/wordlists/generate',{method:'POST',body:JSON.stringify(b)}),
  previewWL:b=>apiFetch('/wordlists/preview',{method:'POST',body:JSON.stringify(b)}),
  estimateWL:b=>apiFetch('/wordlists/estimate',{method:'POST',body:JSON.stringify(b)}),
  delWL:fn=>apiFetch(`/wordlists/${fn}`,{method:'DELETE'}),
  wlCommonLists:()=>apiFetch('/wordlists/common-lists'),
  wlImportCommon:key=>apiFetch('/wordlists/import-common/'+key,{method:'POST'}),
  presets:()=>apiFetch('/wordlists/presets/info'),
};
function toast(msg,type='info',dur=4000){
  const icons={success:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,error:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,info:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,warn:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`};
  const el=document.createElement('div');el.className=`toast t-${type}`;el.innerHTML=`${icons[type]||icons.info}<span>${msg}</span>`;
  document.getElementById('tc').appendChild(el);
  setTimeout(()=>{el.style.opacity='0';el.style.transition='opacity .3s';},dur-300);setTimeout(()=>el.remove(),dur);
}
function showModal(title,body,footer='',lg=false){document.getElementById('mr').innerHTML=`<div class="mov" onclick="if(event.target===this)closeModal()"><div class="modal${lg?' lg':''}"><div class="mhdr"><span class="mtitle">${title}</span><button class="mclose" onclick="closeModal()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><div class="mbody">${body}</div>${footer?`<div class="mfoot">${footer}</div>`:''}</div></div>`;}
function closeModal(){document.getElementById('mr').innerHTML='';}
// Escape cierra el overlay superior (primero lightbox, luego modal) — vale para todos los modales
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const lb=document.getElementById('lbr');if(lb&&lb.innerHTML){closeLb();return;}const mr=document.getElementById('mr');if(mr&&mr.innerHTML){closeModal();return;}if(document.body.classList.contains('nav-open'))closeSidebar();});
let _cdCb=null;
function confirmDlg(msg,fn,opts){opts=opts||{};_cdCb=fn;showModal(opts.title||'Confirmar',`<div style="display:flex;gap:11px;align-items:flex-start"><span style="color:var(--${opts.danger===false?'c':'y'});flex-shrink:0;margin-top:1px">${ic(opts.danger===false?'info':'warn',20)}</span><div style="color:var(--t1);font-size:.85rem;line-height:1.65">${msg}</div></div>`,`<button class="btn btn-gh" onclick="closeModal()">Cancelar</button><button class="btn ${opts.danger===false?'btn-p':'btn-d'}" onclick="runConfirm()">${opts.ok||'Confirmar'}</button>`);}
function runConfirm(){const cb=_cdCb;_cdCb=null;closeModal();if(cb)cb();}
// ─── Autenticación por token ───
let _authPrompting=false;
function onAuthFail(){if(_authPrompting)return;_authPrompting=true;promptToken(!!AUTH_TOKEN);}
function promptToken(failed){
  showModal('Acceso protegido',
    `<div style="font-size:.83rem;color:var(--t1);line-height:1.6;margin-bottom:13px">${failed?'El token no es válido o ha caducado. ':''}Este servidor WFAudit está protegido. Introduce el <b>token de acceso</b> (el valor de <code>WFAUDIT_TOKEN</code> con el que se arrancó el servidor).</div>
     <input id="authTok" type="password" class="inp" autocomplete="off" placeholder="Token de acceso" style="width:100%">`,
    `<button class="btn btn-p" onclick="saveTokenFromModal()">Acceder</button>`);
  setTimeout(()=>{const i=document.getElementById('authTok');if(i){i.focus();i.onkeydown=e=>{if(e.key==='Enter')saveTokenFromModal();};}},60);
}
function saveTokenFromModal(){const i=document.getElementById('authTok');const v=(i&&i.value||'').trim();if(!v){toast('Introduce el token','warn');return;}setToken(v);_authPrompting=false;closeModal();location.reload();}
function clearToken(){setToken('');toast('Sesión cerrada','info');setTimeout(()=>location.reload(),400);}
function setC(h){const c=document.getElementById('content');c.innerHTML=h;restoreInputs(c);}
function setTB(title,sub,acts=''){document.getElementById('tb-title').textContent=title;document.getElementById('tb-sub').textContent=sub;document.getElementById('tb-acts').innerHTML=acts;}
const SVG={
  wifi:`<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/>`,
  folder:`<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>`,
  shield:`<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
  zap:`<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
  search:`<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>`,
  key:`<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>`,
  plus:`<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`,
  trash:`<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>`,
  edit:`<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>`,
  stop:`<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>`,
  play:`<polygon points="5 3 19 12 5 21 5 3"/>`,
  refresh:`<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>`,
  report:`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>`,
  check:`<polyline points="20 6 9 17 4 12"/>`,
  x:`<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`,
  info:`<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`,
  warn:`<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
  download:`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>`,
  cpu:`<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>`,
  eye:`<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`,
  terminal:`<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>`,
};
function ic(n,s=14){return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SVG[n]||''}</svg>`;}
const CI={wifi:'📡',network:'🌐',router:'🏠',credentials:'🔑',encryption:'🔒',access_control:'🚫',other:'📋'};
const CL={wifi:'WiFi',network:'Network',router:'Router',credentials:'Credentials',encryption:'Encryption',access_control:'Access Control',other:'Other'};
function sbadge(s){const m={WPA3:'b-g',WPA2:'b-c',WPA:'b-y',WEP:'b-o',OPEN:'b-r'};return `<span class="badge ${m[s]||'b-x'}">${s}</span>`;}
function sevb(s){const m={critical:'b-r',high:'b-o',medium:'b-y',low:'b-g',info:'b-c'};return `<span class="badge ${m[s]||'b-x'}">${(s||'').toUpperCase()}</span>`;}
function stb(s){const m={running:'b-y',completed:'b-g',failed:'b-r',cancelled:'b-x',active:'b-g',closed:'b-x'};return `<span class="badge ${m[s]||'b-x'}">${s}</span>`;}
function sigb(d){const t=[-90,-80,-70,-60,-50];let c='sb-p';if(d>=-50)c='sb-e';else if(d>=-60)c='sb-g';else if(d>=-70)c='sb-f';else if(d>=-80)c='sb-w';return `<div class="sbars">${t.map((_,i)=>`<div class="sb ${d>t[i]?c:''}"></div>`).join('')}</div>`;}
function fd(d){if(!d)return '—';try{return new Date(d).toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'});}catch{return d;}}
function fb(n){if(!n)return '0 B';const u=['B','KB','MB','GB'];let i=0;while(n>=1024&&i<3){n/=1024;i++;}return `${n.toFixed(i?1:0)} ${u[i]}`;}
function nl2(s){return (s||'').replace(/\n/g,'<br>');}
const SM={dashboard:{t:'DASHBOARD',s:'Vista general'},sessions:{t:'SESIONES',s:'Gestión de auditorías'},interfaces:{t:'INTERFACES',s:'Adaptadores WiFi'},wifiscan:{t:'ESCANEO WIFI',s:'Detección de APs y clientes'},recon:{t:'RECONOCIMIENTO',s:'Descubrimiento con nmap'},sniffing:{t:'SNIFFING',s:'Captura de handshake WPA'},crack:{t:'CRACK',s:'Crackeo offline (handshake · PMKID)'},advanced:{t:'AVANZADO',s:'PMKID · AP-Less · WPA3'},attacks:{t:'ATAQUES',s:'Evil Twin · MITM'},captures:{t:'CAPTURAS',s:'Gestión de capturas'},wordlists:{t:'WORDLISTS',s:'Generador de diccionarios'},system:{t:'SISTEMA',s:'Herramientas y procesos'},help:{t:'AYUDA',s:'Documentación y guía de uso'}};
function goto(s){closeSidebar();saveAllFP();ST.section=s;document.querySelectorAll('.ni').forEach(e=>e.classList.toggle('active',e.dataset.s===s));const m=SM[s]||{};setTB(m.t||s.toUpperCase(),m.s||'',`<button class="btn btn-gh btn-sm" onclick="${s}()">${ic('refresh')} Actualizar</button>`);const fn=window[s];if(typeof fn==='function')fn();}
document.getElementById('nav').addEventListener('click',e=>{const ni=e.target.closest('.ni');if(ni?.dataset.s)goto(ni.dataset.s);});
function applyTheme(t){ST.theme=t;document.documentElement.setAttribute('data-theme',t);localStorage.setItem('theme',t);const l=t==='light';document.getElementById('theme-lbl').textContent=l?'Modo Claro':'Modo Oscuro';document.getElementById('tsw').classList.toggle('on',!l);}
function toggleTheme(){applyTheme(ST.theme==='dark'?'light':'dark');}
// Barra lateral colapsable en pantallas estrechas (en escritorio la clase nunca se aplica, así que es no-op)
function toggleSidebar(){document.body.classList.toggle('nav-open');}
function closeSidebar(){document.body.classList.remove('nav-open');}
function setSession(s){ST.activeSession=s;localStorage.setItem('activeSession',JSON.stringify(s));updateSB();}
function updateSB(){const s=ST.activeSession;document.getElementById('sb-ses-name').textContent=s?s.name:'Sin sesión';const dot=document.getElementById('sb-ses-dot'),st=document.getElementById('sb-ses-st');if(s){const a=s.status==='active';dot.className=`dot ${a?'dot-g':'dot-d'}`;st.textContent=a?'● ACTIVA':'○ CERRADA';st.style.color=a?'var(--g)':'var(--t2)';document.getElementById('sb-ses').textContent=`Sesión: ${s.name}`;}else{dot.className='dot dot-d';st.textContent='Selecciona una sesión';st.style.color='var(--t2)';document.getElementById('sb-ses').textContent='Sin sesión activa';}}
let _procSeen={};
function procLabel(cmd){cmd=(cmd||'').toLowerCase();
  if(cmd.includes('airodump'))return 'Escaneo WiFi';
  if(cmd.includes('aircrack')||cmd.includes('hashcat'))return 'Crackeo';
  if(cmd.includes('aireplay'))return 'Deauth';
  if(cmd.includes('hcxdumptool'))return 'Captura PMKID';
  if(cmd.includes('arp-scan'))return 'Descubrimiento ARP';
  if(cmd.includes('nmap'))return 'Escaneo nmap';
  if(cmd.includes('hostapd'))return 'Evil Twin';
  if(cmd.includes('mitmdump')||cmd.includes('mitmproxy'))return 'MITM';
  if(cmd.includes('freeradius'))return 'Enterprise (RADIUS)';
  if(cmd.includes('macchanger'))return 'Cambio de MAC';
  return 'Proceso';}
async function pollProcs(){try{
  ST.processes=await A.procs();const procs=ST.processes||[];
  procs.forEach(p=>{
    if(_procSeen[p.id]==='running'&&p.status!=='running'){
      const ok=p.status==='completed';
      toast((ok?'✓ ':'⚠ ')+procLabel(p.command)+(ok?' terminado':' — '+p.status),ok?'success':'warn');
    }
    _procSeen[p.id]=p.status;
  });
  const ids=new Set(procs.map(p=>p.id));Object.keys(_procSeen).forEach(id=>{if(!ids.has(id))delete _procSeen[id];});
  const r=procs.filter(p=>p.status==='running').length;
  document.getElementById('sb-procs').textContent=`${r} proceso${r!==1?'s':''} activo${r!==1?'s':''}`;
  const old=document.getElementById('pbadge');if(r>0){if(!old){const ni=document.querySelector('[data-s="system"]');ni&&ni.insertAdjacentHTML('beforeend',`<span class="nbadge" id="pbadge">${r}</span>`);}else old.textContent=r;}else old&&old.remove();
}catch{}}
async function checkHealth(){try{await A.health();ST.apiOk=true;document.getElementById('apidot').className='ok';document.getElementById('api-txt').textContent='API conectada';}catch{ST.apiOk=false;document.getElementById('apidot').className='err';document.getElementById('api-txt').textContent='API sin conexión';}}
function startClock(){setInterval(()=>{document.getElementById('sb-time').textContent=new Date().toLocaleTimeString('es-ES');},1000);}
function swTab(cid,pref,idx){document.querySelectorAll(`#${cid} .tab`).forEach((t,i)=>t.classList.toggle('active',i===idx));document.querySelectorAll(`[id^="${pref}-"]`).forEach((c,i)=>c.classList.toggle('active',i===idx));}

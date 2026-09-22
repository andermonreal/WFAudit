// WFAudit · ataques y gestión — Evil Twin, MITM, avanzado, capturas, wordlists, sistema y ayuda
// ======== ATTACKS ========
async function attacks(){
  let ifaces=[];try{ifaces=await A.ifaces();}catch{}
  setC(`<div class="sup">
  <div class="tabs" id="att-tabs"><div class="tab active" onclick="swTab('att-tabs','att-tc',0)">Evil Twin</div><div class="tab" onclick="swTab('att-tabs','att-tc',1)">MITM</div><div class="tab" onclick="swTab('att-tabs','att-tc',2)">Flujos</div></div>
  <div class="tc active" id="att-tc-0">${etT(ifaces)}</div>
  <div class="tc" id="att-tc-1">${mitmT(ifaces)}</div>
  <div class="tc" id="att-tc-2">${flowsT()}</div></div>`);
  pollAttSt();}
function etT(ifaces){return `<div class="g2"><div class="card"><div class="ctitle">${ic('wifi')} Evil Twin AP</div><div class="frow"><label>Interfaz AP</label><select id="et-if" class="inp">${ifaces.map(i=>`<option value="${i.name}">${i.name}</option>`).join('')}</select></div><div class="fgrid"><div class="frow"><label>ESSID *</label><input id="et-essid" class="inp" placeholder="MyWiFi"></div><div class="frow"><label>Canal</label><input id="et-ch" class="inp" type="number" value="6"></div></div><div class="frow"><label>Iface internet <span class="tip" data-tip="Interfaz con salida a internet (ej. eth0) para dar conexión real a las víctimas por NAT, para que no sospechen. Opcional.">?</span></label><input id="et-inet" class="inp" placeholder="eth0"></div><div class="crow"><input type="checkbox" id="et-portal"><label for="et-portal">Captive Portal <span class="tip" data-tip="Redirige todas las consultas DNS a tu máquina para servir una página de login falsa y cosechar credenciales.">?</span></label></div><div class="crow"><input type="checkbox" id="et-da" onchange="document.getElementById('et-da-opts').style.display=this.checked?'block':'none'"><label for="et-da">Deauth al AP legítimo <span class="tip" data-tip="Desautentica a los clientes del AP real para forzarlos a migrar a tu Evil Twin (mismo nombre, mejor señal). Requiere una 2ª interfaz en monitor.">?</span></label></div><div id="et-da-opts" style="display:none;margin-bottom:10px;padding:10px;background:var(--bg3);border-radius:8px"><div class="fgrid"><div class="frow"><label>Iface deauth</label><select id="et-dif" class="inp">${ifaces.map(i=>`<option value="${i.name}">${i.name}</option>`).join('')}</select></div><div class="frow"><label>BSSID legítimo</label><input id="et-dbssid" class="inp" placeholder="AA:BB:CC:DD:EE:FF"></div></div></div><div style="display:flex;gap:7px"><button class="btn btn-g" style="flex:1" onclick="doETStart()">Iniciar</button><button class="btn btn-d" style="flex:1" onclick="doETStop()">Detener</button></div></div><div class="card"><div class="ctitle">${ic('wifi')} Estado ET</div><div id="et-st" class="empty" style="padding:20px">${ic('wifi',30)}<h3>Inactivo</h3></div>
    <div style="border:1px solid var(--b0);border-radius:8px;padding:11px;margin-top:12px;background:var(--bg3)">
      <div style="font-size:.66rem;color:var(--t2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;display:flex;align-items:center;gap:6px">${ic('stop',11)} Deauth manual (bajo demanda)</div>
      <div class="hint" style="margin-bottom:8px">${ic('info',11)}Envía deauth cuando quieras — no requiere el Evil Twin activo. Útil para forzar reconexiones o expulsar clientes.</div>
      <div class="frow"><label>Interfaz (monitor)</label><select id="etd-if" class="inp">${ifaces.map(i=>`<option value="${i.name}">${i.name}</option>`).join('')}</select></div>
      <div class="frow"><label>BSSID objetivo</label><input id="etd-bssid" class="inp" placeholder="AA:BB:CC:DD:EE:FF"></div>
      <div class="fgrid"><div class="frow"><label>MAC cliente (vacío=broadcast)</label><input id="etd-cli" class="inp" placeholder="FF:FF:FF:FF:FF:FF"></div><div class="frow"><label>Paquetes</label><input id="etd-pkts" class="inp" type="number" value="50"></div></div>
      <button class="btn btn-d btn-sm" style="width:100%" onclick="doETDeauth()">${ic('stop')} Enviar Deauth</button>
      <div id="etd-res" style="margin-top:8px"></div>
    </div>
  </div></div>`;}
function mitmT(ifaces){return `<div class="g2"><div class="card"><div class="ctitle">${ic('shield')} MITM</div><div class="frow"><label>Interfaz (LAN)</label><select id="mitm-if" class="inp">${ifaces.map(i=>`<option value="${i.name}">${i.name}</option>`).join('')}</select></div><div class="frow"><label>IPs objetivo (vacío=todos) <span class="tip" data-tip="IPs concretas a interceptar, separadas por coma. Vacío = toda la red (más ruidoso y pesado). Mejor apuntar a un dispositivo concreto.">?</span></label><input id="mitm-tgts" class="inp" placeholder="192.168.0.5,192.168.0.10"></div><div class="frow"><label>Gateway <span class="tip" data-tip="IP del router/puerta de enlace de la red. El ARP spoofing se hace entre la víctima y este gateway. Suele ser .1 de tu subred.">?</span></label><input id="mitm-gw" class="inp" placeholder="192.168.0.1"></div><div class="frow"><label>Puerto proxy</label><input id="mitm-port" class="inp" type="number" value="8080"></div><div class="frow"><label>Modo de interceptación</label>
    <input type="checkbox" id="mitm-st" checked hidden>
    <div class="modesel">
      <div class="modeopt mo-s" onclick="mitmSetMode(true)"><span class="mo-t">🔇 STEALTH</span><span class="mo-d">Invisible — sin avisos</span></div>
      <div class="modeopt mo-f" onclick="mitmSetMode(false)"><span class="mo-t">🔓 FULL</span><span class="mo-d">Requiere CA en el objetivo</span></div>
    </div>
    <div class="mo-desc mo-desc-s">${ic('info',11)} Captura consultas DNS, conexiones TLS (SNI) y tráfico HTTP. El HTTPS pasa <b>intacto</b> — la víctima no ve avisos. Requiere <span class="hcode" style="font-size:.66rem">tshark</span>.</div>
    <div class="mo-desc mo-desc-f">${ic('warn',11)} Intercepta <b>TODO</b> el tráfico, incluido el contenido HTTPS. La víctima verá avisos SSL salvo que instale antes el certificado CA de mitmproxy.</div>
    </div>
    <div class="crow"><input type="checkbox" id="mitm-cr"><label for="mitm-cr">Capturar credenciales <span class="tip" data-tip="Analiza los flujos buscando usuarios/contraseñas en formularios y cabeceras. Los flujos con credenciales se resaltan en rojo en la pestaña Flujos.">?</span></label></div><div style="display:flex;gap:7px;margin-top:8px"><button class="btn btn-g" style="flex:1" onclick="doMitmStart()">Iniciar</button><button class="btn btn-d" style="flex:1" onclick="doMitmStop()">Detener</button></div><button class="btn btn-gh btn-sm" style="width:100%;margin-top:9px" onclick="showCaCert()">${ic('download',12)} Certificado CA (para modo full)</button></div><div class="card"><div class="ctitle">${ic('shield')} Estado MITM</div><div id="mitm-st-el" class="empty" style="padding:20px">${ic('shield',30)}<h3>Inactivo</h3></div></div></div>`;}
function flowsT(){return `<div class="card"><div style="display:flex;justify-content:space-between;margin-bottom:12px"><div class="ctitle" style="margin-bottom:0">${ic('search')} Flujos</div><div style="display:flex;gap:7px;align-items:center"><label class="crow" style="margin-bottom:0"><input type="checkbox" id="fl-cr"><span>Solo credenciales</span></label><button class="btn btn-gh btn-sm" onclick="loadFlows()">Cargar</button></div></div><div id="fl-table" class="empty" style="padding:28px">${ic('search',36)}<h3>Sin flujos</h3></div></div>`;}
async function pollAttSt(){try{const [e,m]=await Promise.all([A.etSt().catch(()=>null),A.mitmSt().catch(()=>null)]);renderAttSt(e,'et-st');renderAttSt(m,'mitm-st-el');}catch{}}
function renderAttSt(st,id){const el=document.getElementById(id);if(!el)return;const isMitm=id.includes('mitm');if(!st||!st.active){el.className='empty';el.style.padding='20px';el.innerHTML=`${ic(isMitm?'shield':'wifi',30)}<h3>Inactivo</h3>`;return;}el.className='';el.style.padding='0';el.innerHTML=`<div class="alert as" style="margin-bottom:10px">${ic('check')}<div>Activo${st.started_at?` · ${fd(st.started_at)}`:''}</div></div><div style="font-size:.8rem;display:flex;flex-direction:column;gap:5px">${st.target_essid?`<div><span style="color:var(--t2)">ESSID:</span> <strong>${st.target_essid}</strong></div>`:''} ${st.mode?`<div><span style="color:var(--t2)">Modo:</span> <span class="badge b-c">${st.mode}</span></div>`:''} ${st.connected_clients!=null?`<div><span style="color:var(--t2)">Clientes:</span> <strong>${st.connected_clients}</strong></div>`:''} ${st.captured_credentials!=null?`<div><span style="color:var(--t2)">Credenciales:</span> <strong style="color:var(--r)">${st.captured_credentials}</strong></div>`:''}</div><button class="btn btn-d btn-xs" style="margin-top:10px" onclick="${isMitm?'doMitmStop()':'doETStop()'}">${ic('stop',11)} Detener</button>`;}
function setNavBadge(section,n){const ni=document.querySelector(`[data-s="${section}"]`);if(!ni)return;let b=ni.querySelector('.nbadge.atk');if(n>0){if(!b){b=document.createElement('span');b.className='nbadge atk';ni.appendChild(b);}b.textContent=n;}else if(b){b.remove();}}
async function pollAttacks(){try{const[e,m,ap,en]=await Promise.all([A.etSt().catch(()=>null),A.mitmSt().catch(()=>null),A.aplSt().catch(()=>null),A.entSt().catch(()=>null)]);setNavBadge('attacks',(e&&e.active?1:0)+(m&&m.active?1:0));setNavBadge('advanced',(ap&&ap.active?1:0)+(en&&en.active?1:0));if(ST.section==='attacks'){renderAttSt(e,'et-st');renderAttSt(m,'mitm-st-el');}else if(ST.section==='advanced'){if(document.getElementById('apl-st'))pollAplSt();if(document.getElementById('ent-st'))pollEntSt();}}catch{}}
async function doETStart(){const i=document.getElementById('et-if')?.value,e=document.getElementById('et-essid')?.value?.trim(),c=parseInt(document.getElementById('et-ch')?.value)||6,in2=document.getElementById('et-inet')?.value?.trim(),p=document.getElementById('et-portal')?.checked,da=document.getElementById('et-da')?.checked;if(!e){toast('ESSID obligatorio','warn');return;}try{const r=await A.etStart({interface:i,target_essid:e,channel:c,internet_interface:in2||null,captive_portal:p,deauth_legitimate:da,deauth_interface:da?document.getElementById('et-dif')?.value:null,deauth_bssid:da?document.getElementById('et-dbssid')?.value?.trim():null,deauth_packets:50});toast(r.started?'ET iniciado':'Error',r.started?'success':'error');pollAttSt();}catch(e2){toast(e2.message,'error');}}
async function doETStop(){try{await A.etStop();toast('ET detenido','success');pollAttSt();}catch(e){toast(e.message,'error');}}
async function doETDeauth(){const i=document.getElementById('etd-if')?.value,b=document.getElementById('etd-bssid')?.value?.trim(),cli=document.getElementById('etd-cli')?.value?.trim(),p=parseInt(document.getElementById('etd-pkts')?.value)||50;if(!b){toast('BSSID obligatorio','warn');return;}const el=document.getElementById('etd-res');if(el)el.innerHTML=`<div style="display:flex;align-items:center;gap:7px;color:var(--y);font-size:.78rem"><div class="spin"></div> Enviando deauth...</div>`;try{const r=await A.etDeauth({interface:i,target_bssid:b,client_mac:cli||null,packets:p});const n=r.packets_sent!=null?`${r.packets_sent} paquetes enviados`:(r.success!==false?'Deauth enviado':'Sin respuesta');if(el)el.innerHTML=`<div class="alert as" style="margin-bottom:0">${ic('check')}<div>${n}${r.target?' → '+r.target:''}</div></div>`;toast('Deauth enviado','success');}catch(e){toast(e.message,'error');if(el)el.innerHTML=`<div class="alert ae" style="margin-bottom:0">${ic('x')}<div>${e.message}</div></div>`;}}
function mitmSetMode(stealth){const cb=document.getElementById('mitm-st');if(cb){cb.checked=stealth;persistInput(cb);}}
async function doMitmStart(){const i=document.getElementById('mitm-if')?.value,gw=document.getElementById('mitm-gw')?.value?.trim(),port=parseInt(document.getElementById('mitm-port')?.value)||8080,st=document.getElementById('mitm-st')?.checked,cr=document.getElementById('mitm-cr')?.checked,t=document.getElementById('mitm-tgts')?.value?.trim();try{const r=await A.mitmStart({interface:i,target_ips:t?t.split(',').map(x=>x.trim()).filter(Boolean):[],gateway:gw,proxy_port:port,stealth:st,ssl_strip:false,capture_credentials:cr});toast(r.started?`MITM iniciado (${r.mode})`:'Error',r.started?'success':'error');pollAttSt();}catch(e){toast(e.message,'error');}}
async function doMitmStop(){try{await A.mitmStop();toast('MITM detenido','success');pollAttSt();}catch(e){toast(e.message,'error');}}
async function showCaCert(){showModal('Certificado CA de mitmproxy',`<div style="display:flex;align-items:center;gap:8px;color:var(--y)"><div class="spin"></div> Consultando...</div>`,'',false);try{const d=await A.mitmCaCert();const certs=d.certs||{},fmt=[['pem','PEM','Android · Linux · macOS'],['cer','CER','iOS · Windows'],['p12','PKCS12','Windows']];const ins=d.instructions||{};const anyGen=Object.values(certs).some(c=>c.exists);const body=`${!anyGen?`<div class="alert aw" style="margin-bottom:12px">${ic('warn')}<div>El certificado aún no existe. Ejecuta una vez el MITM (o <span class="hcode">mitmdump</span>) para generarlo en <span class="mono">${d.cert_dir||'~/.mitmproxy'}</span>.</div></div>`:`<div class="alert ai" style="margin-bottom:12px">${ic('info')}<div>Instala este certificado en el dispositivo víctima <strong>antes</strong> de usar el modo full para evitar avisos de HTTPS.</div></div>`}
  <div style="font-size:.66rem;color:var(--t2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Descargas</div>
  <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:16px">${fmt.map(([f,l,plat])=>{const ex=certs[`mitmproxy-ca-cert.${f}`]?.exists;return `<div style="display:flex;align-items:center;gap:10px;padding:9px 11px;background:var(--bg3);border:1px solid var(--b0);border-radius:8px"><span class="badge ${ex?'b-g':'b-x'}">${f.toUpperCase()}</span><div style="flex:1;min-width:0"><div style="font-size:.78rem;font-weight:600">${l}</div><div style="font-size:.66rem;color:var(--t2)">${plat}</div></div>${ex?`<a class="btn btn-p btn-sm" href="${API}/attacks/mitm/ca-cert/download/${f}" target="_blank" download>${ic('download',12)} Descargar</a>`:`<span class="badge b-x">no generado</span>`}</div>`;}).join('')}</div>
  <div style="font-size:.66rem;color:var(--t2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Instalación por sistema</div>
  ${[['Android','android','🤖'],['iOS','ios','🍎'],['Windows','windows','🪟'],['Linux','linux','🐧']].map(([l,k,ico])=>ins[k]?`<div style="margin-bottom:9px"><div style="font-size:.74rem;font-weight:600;margin-bottom:3px">${ico} ${l}</div><div style="font-size:.72rem;color:var(--t1);line-height:1.6;padding-left:4px">${ins[k]}</div></div>`:'').join('')}`;showModal('Certificado CA de mitmproxy',body,`<button class="btn btn-gh" onclick="closeModal()">Cerrar</button>`,true);}catch(e){toast(e.message,'error');closeModal();}}
async function loadFlows(){const cr=document.getElementById('fl-cr')?.checked||false;const el=document.getElementById('fl-table');if(!el)return;try{const[ef,mf]=await Promise.all([A.etFlows(50).catch(()=>null),A.mitmFlows(50,cr).catch(()=>null)]);const all=[...((ef?.flows)||[]),...((mf?.flows)||[])].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));if(!all.length){el.innerHTML=`<div class="empty" style="padding:24px">${ic('search',30)}<h3>Sin flujos</h3></div>`;return;}el.innerHTML=`<div class="twrap"><table><thead><tr><th>Hora</th><th>Tipo</th><th>Cliente</th><th>Host</th><th>Método</th><th>Estado</th></tr></thead><tbody>${all.slice(0,50).map(f=>`<tr ${f.has_credentials?'style="background:var(--r2)"':''}><td class="mono" style="font-size:.66rem;color:var(--t2)">${fd(f.timestamp)}</td><td><span class="badge ${f.type==='http'?'b-o':f.type==='dns'?'b-c':'b-p'}">${f.type||'—'}</span></td><td class="mono" style="font-size:.7rem">${f.client_ip||'—'}</td><td style="font-size:.76rem;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.host||'—'}</td><td class="mono" style="font-size:.7rem">${f.method||'—'}</td><td>${f.has_credentials?`<span class="badge b-r">CREDS</span>`:`<span class="badge b-x">${f.status_code||'—'}</span>`}</td></tr>`).join('')}</tbody></table></div>`;}catch(e){toast(e.message,'error');}}
// ======== CAPTURES ========
async function captures(){
  setC(`<div style="display:flex;align-items:center;gap:10px;color:var(--t2)"><div class="spin"></div> Cargando...</div>`);
  const sid=ST.activeSession?.id;let caps=[];try{caps=await A.caps(sid||null);}catch(e){toast(e.message,'error');}
  const arr=Array.isArray(caps)?caps:[];
  const wlCrk=c=>['cap','pcap','pcapng','22000','16800','hc22000','hccapx'].includes((c.file_type||'').toLowerCase());
  const hsCell=(has,crk)=>crk?(has?`<span class="badge b-g" style="font-weight:700;box-shadow:0 0 7px -1px var(--g)">${ic('check',11)} SÍ</span>`:`<span class="badge b-x" style="opacity:.5">NO</span>`):`<span style="color:var(--t3)">—</span>`;
  setC(`<div class="sup"><div class="card"><div class="ctitle">${ic('download')} Capturas (${arr.length})</div>${!arr.length?`<div class="empty" style="padding:38px">${ic('download',40)}<h3>Sin capturas</h3></div>`:`<div class="twrap"><table><thead><tr><th>Archivo</th><th>Tipo</th><th>Red</th><th>Tamaño</th><th>HS</th><th>PMKID</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>${arr.map(c=>`<tr><td class="mono" style="font-size:.7rem;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${c.filepath}">${c.filename}</td><td><span class="badge b-c">${c.file_type||'—'}</span></td><td style="font-size:.76rem">${c.target_essid||'—'}</td><td class="mono" style="font-size:.72rem">${fb(c.size_bytes)}</td><td>${hsCell(c.has_handshake,wlCrk(c))}</td><td>${hsCell(c.has_pmkid,wlCrk(c))}</td><td class="mono" style="font-size:.7rem;color:var(--t2)">${fd(c.created_at)}</td><td><div style="display:flex;gap:4px">${wlCrk(c)?`<button class="btn btn-p btn-xs" onclick="checkCap('${c.filepath}','${c.filename}')">${ic('eye',11)} Verificar</button>`:''}<button class="btn btn-d btn-xs btn-ico" onclick="delCap('${c.filepath}')">${ic('trash',11)}</button></div></td></tr>`).join('')}</tbody></table></div>`}</div></div>`);}
async function checkCap(fp,fn){
  showModal(`Verificando — ${fn}`,`<div style="display:flex;align-items:center;gap:8px;color:var(--y)"><div class="spin"></div> Analizando...</div>`,'',true);
  try{const r=await A.checkHS(fp);showModal(`Análisis — ${fn}`,`<div style="display:flex;gap:9px;margin-bottom:14px;flex-wrap:wrap">
    <div style="flex:1;text-align:center;padding:13px;background:var(--bg3);border-radius:8px;border:1px solid ${r.has_handshake?'var(--g)':'var(--b0)'}"><div style="font-size:1.4rem">${r.has_handshake?'✅':'❌'}</div><div style="font-size:.68rem;color:var(--t2);margin-top:4px;text-transform:uppercase">Handshake</div></div>
    <div style="flex:1;text-align:center;padding:13px;background:var(--bg3);border-radius:8px;border:1px solid ${r.has_pmkid?'var(--g)':'var(--b0)'}"><div style="font-size:1.4rem">${r.has_pmkid?'✅':'❌'}</div><div style="font-size:.68rem;color:var(--t2);margin-top:4px;text-transform:uppercase">PMKID</div></div>
    <div style="flex:1;text-align:center;padding:13px;background:var(--bg3);border-radius:8px;border:1px solid var(--b0)"><div style="font-size:1.4rem;font-weight:700;font-family:'Orbitron',monospace;color:var(--c)">${r.networks_found||0}</div><div style="font-size:.68rem;color:var(--t2);margin-top:4px;text-transform:uppercase">Redes</div></div>
  </div>
  <div style="font-size:.7rem;color:var(--t2);margin-bottom:6px;text-transform:uppercase;letter-spacing:.08em">Output de aircrack-ng</div>
  <pre style="background:var(--bg0);border:1px solid var(--b0);border-radius:8px;padding:14px;font-family:'JetBrains Mono',monospace;font-size:.72rem;color:var(--t1);white-space:pre-wrap;line-height:1.6;max-height:420px;overflow-y:auto;word-break:break-all">${r.raw_output||'(sin output)'}</pre>`,`<button class="btn btn-gh" onclick="closeModal()">Cerrar</button>`,true);}catch(e){toast(e.message,'error');closeModal();}}
function delCap(fp){confirmDlg('¿Eliminar captura?',async()=>{try{await A.delCap(fp);toast('Eliminada','success');captures();}catch(e){toast(e.message,'error');}});}
// ======== WORDLISTS ========
let _seeds=JSON.parse(localStorage.getItem('wl-seeds')||'[]'),_presets=[];
const WLPRESETS=[
  {id:'fast',l:'Rápido',ic:'⚡',c:'~50K',cfg:{use_leet:true,use_number_infix:false,use_doubling:false,use_stretching:false,use_reverse:false,use_palindrome:false,use_alternating_case:false,use_years:false,use_birth_years:false,use_double_symbols:false,use_symbol_pairs:false,combine_words:false,combine_3_words:false,add_common_base:false,add_spanish_base:false,add_spanish_names:false},leet:'low'},
  {id:'balanced',l:'Equilibrado',ic:'⚖',c:'1-2M',cfg:{use_leet:true,use_number_infix:true,use_doubling:true,use_stretching:false,use_reverse:false,use_palindrome:false,use_alternating_case:false,use_years:true,use_birth_years:true,use_double_symbols:true,use_symbol_pairs:true,combine_words:true,combine_3_words:false,add_common_base:true,add_spanish_base:true,add_spanish_names:true},leet:'medium'},
  {id:'exhaustive',l:'Exhaustivo',ic:'🔥',c:'5-10M',cfg:{use_leet:true,use_number_infix:true,use_doubling:true,use_stretching:true,use_reverse:true,use_palindrome:true,use_alternating_case:true,use_years:true,use_birth_years:true,use_double_symbols:true,use_symbol_pairs:true,combine_words:true,combine_3_words:true,add_common_base:true,add_spanish_base:true,add_spanish_names:true},leet:'high'},
  {id:'spanish',l:'Español',ic:'🇪🇸',c:'~1.5M',cfg:{use_leet:true,use_number_infix:true,use_doubling:true,use_stretching:false,use_reverse:false,use_palindrome:false,use_alternating_case:false,use_years:true,use_birth_years:true,use_double_symbols:true,use_symbol_pairs:true,combine_words:true,combine_3_words:false,add_common_base:false,add_spanish_base:true,add_spanish_names:true},leet:'medium'},
];
async function wordlists(){
  setC(`<div style="display:flex;align-items:center;gap:10px;color:var(--t2)"><div class="spin"></div> Cargando...</div>`);
  let wls={},pr={};try{[wls,pr]=await Promise.all([A.wls(),A.presets().catch(()=>({presets:[]}))]);}catch(e){console.warn('wordlists load error',e);}_presets=pr.presets||[];
  const wlArr=wls.wordlists||[];
  const MUT=[
    {grp:'Mayúsculas / minúsculas',items:[
      {id:'use_lowercase',   l:'Minúsculas',        ex:'empresa → empresa',          d:'Convierte todas las letras a minúsculas',          def:true},
      {id:'use_uppercase',   l:'Mayúsculas',         ex:'empresa → EMPRESA',          d:'Convierte todas las letras a mayúsculas',          def:true},
      {id:'use_capitalize',  l:'Capitalizar',        ex:'empresa → Empresa',          d:'Primera letra en mayúscula, resto minúsculas',     def:true},
      {id:'use_alternating_case',l:'Alternada',      ex:'empresa → eMpReSa',          d:'Alterna mayúsculas y minúsculas (multiplica mucho)',def:false},
    ]},
    {grp:'Mutaciones de letras',items:[
      {id:'use_leet',        l:'Leet speak',         ex:'empresa → 3mpr3s4',          d:'Sustituye letras por números/símbolos (e→3, a→4)', def:true},
      {id:'use_number_infix',l:'Número intercalado', ex:'ander → an1der',             d:'Inserta un número entre las letras de la palabra',  def:true},
      {id:'use_doubling',    l:'Duplicar',           ex:'empresa → empresaempresa',   d:'Repite la palabra dos veces',                      def:false},
      {id:'use_stretching',  l:'Estirar',            ex:'ola → oolllaaa',             d:'Repite caracteres consecutivos (muy explosivo)',    def:false},
      {id:'use_reverse',     l:'Reverso',            ex:'empresa → aserpme',          d:'Invierte el orden de los caracteres',               def:false},
      {id:'use_palindrome',  l:'Palíndromo',         ex:'sol → sollos',               d:'Concatena la palabra con su reverso',               def:false},
    ]},
    {grp:'Números',items:[
      {id:'use_numbers',     l:'Sufijos numéricos',  ex:'empresa → empresa123',       d:'Añade secuencias de números al final',              def:true},
      {id:'use_years',       l:'Años',               ex:'empresa → empresa2024',      d:'Añade años comunes: 2020, 2021 … 2030',            def:true},
      {id:'use_birth_years', l:'Años de nacimiento', ex:'empresa → empresa1985',      d:'Añade años típicos de nacimiento (1950-2010)',      def:true},
    ]},
    {grp:'Símbolos',items:[
      {id:'use_symbols',     l:'Símbolos',           ex:'empresa → empresa!',         d:'Añade !, @, #, $ … al final de la palabra',        def:true},
      {id:'use_double_symbols',l:'Símbolos dobles',  ex:'empresa → empresa!!',        d:'Añade pares del mismo símbolo al final',            def:true},
      {id:'use_symbol_pairs',l:'Pares de símbolos',  ex:'empresa → !empresa!',        d:'Envuelve la palabra entre símbolos',                def:true},
    ]},
    {grp:'Combinación de palabras',items:[
      {id:'combine_words',   l:'Combinar 2',         ex:'[A,B] → AB, BA',            d:'Combina las semillas de dos en dos',                def:true},
      {id:'combine_3_words', l:'Combinar 3',         ex:'[A,B,C] → ABC…',            d:'Combina de tres en tres (muy explosivo)',           def:false},
      {id:'use_separators',  l:'Separadores',        ex:'[A,B] → A_B, A.B, A-B',     d:'Une las combinaciones con _ . - etc.',              def:true},
      {id:'use_reverse_combine',l:'Combinar+reverso',ex:'[A,B] → BA, B_A',           d:'Añade también las combinaciones en orden inverso',  def:true},
    ]},
    {grp:'Palabras base',items:[
      {id:'add_common_base', l:'Base común',         ex:'→ password, admin, 123456…', d:'Añade contraseñas comunes universales',             def:true},
      {id:'add_spanish_base',l:'Base española',      ex:'→ contraseña, acceso…',      d:'Añade ~250 palabras comunes en español',            def:false},
      {id:'add_spanish_names',l:'Nombres españoles', ex:'→ Juan, María, Carlos…',     d:'Añade los 100 nombres más frecuentes en España',   def:false},
    ]},
  ];
  setC(`<div class="sup"><div class="tabs" id="wl-tabs"><div class="tab active" onclick="swTab('wl-tabs','wl-tc',0)">${ic('zap',13)} Generar</div><div class="tab" onclick="swTab('wl-tabs','wl-tc',1)">${ic('download',13)} Diccionarios existentes (${wls.total||0})</div></div>
  <div class="tc active" id="wl-tc-0">
    <div class="card" id="wl-form" data-pp="wl-form" style="margin-bottom:16px">
      <div class="ctitle">${ic('zap')} Generar Wordlist</div>
      <div class="frow"><label>Palabras semilla <span class="tip" data-tip="Escribe una palabra y pulsa Enter (o coma) para añadirla como etiqueta. Repite con cada semilla.">?</span></label>
        <div class="seed-box" id="sbox" onclick="document.getElementById('sinput').focus()">
          <input id="sinput" placeholder="Escribe y pulsa Enter o usa comas..." onkeydown="hSK(event)" oninput="hSI(event)">
        </div>
      </div>
      <div class="hint">${ic('info',11)}Introduce semillas de OSINT del objetivo: nombre, empresa, mascota, hijos, pareja, año de nacimiento, equipo, ciudad favorita. El motor las combina con mutaciones de fugas reales (leet, números intercalados, duplicados, combinaciones, base española y nombres) para generar <b>millones de candidatas</b> desde 3 semillas.</div>
      <div style="font-size:.66rem;color:var(--t2);text-transform:uppercase;letter-spacing:.08em;margin:4px 0 6px">Presets rápidos</div>
      <div class="wl-presets">${WLPRESETS.map(p=>`<div class="wl-preset" id="wlp-${p.id}" onclick="wlPreset('${p.id}')"><div class="wl-preset-i">${p.ic}</div><div class="wl-preset-l">${p.l}</div><div class="wl-preset-c">${p.c}</div></div>`).join('')}</div>
      ${_presets.length?`<div class="frow"><label>Preset del servidor <span class="tip" data-tip="Configuraciones predefinidas en el backend, además de los presets rápidos de arriba.">?</span></label><select id="wl-preset" class="inp" onchange="applyPreset(this)"><option value="">— Personalizado —</option>${_presets.map(p=>`<option value="${p.id}">${p.label} (~${(p.estimated_count||0).toLocaleString()})</option>`).join('')}</select></div>`:''}
      <div class="frow"><label>Nombre del archivo</label><input id="wl-name" class="inp" value="custom.txt" data-p></div>
      <div class="hint">${ic('info',11)}Filtro de longitud: WPA/WPA2 exige mínimo <b>8</b> caracteres, así que subir la longitud mínima a 8 descarta candidatas inútiles y acelera el crackeo.</div>
      <div class="fgrid"><div class="frow"><label>Long. mínima</label><input id="wl-min" class="inp" type="number" value="6" data-p></div><div class="frow"><label>Long. máxima</label><input id="wl-max" class="inp" type="number" value="32" data-p></div></div>
      <div class="frow" style="margin-bottom:12px"><label>Máx. total de contraseñas <span class="tip" data-tip="Tope duro de candidatas a generar. La generación se detiene al alcanzarlo. Protege contra explosiones accidentales (ej. combinar 3 + estirar con muchas semillas).">?</span></label><input id="wl-maxtotal" class="inp" type="number" value="10000000" min="1000" step="1000000" data-p></div>
      <div style="font-size:.66rem;color:var(--t2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px">Mutaciones</div>
      <div class="hint">${ic('info',11)}Cada mutación multiplica el número de candidatas. Activa solo las que encajen con tu objetivo — más no siempre es mejor: una wordlist enorme puede tardar horas en crackear. Usa <b>Estimar</b> antes de generar.</div>
      ${MUT.map(g=>`<div class="wl-grp"><div class="wl-grp-t">${g.grp}</div>
        <div class="mgrid">${g.items.map(m=>`<div class="mitem ${m.def?'on':''}" onclick="togM(this,'${m.id}')">
          <div class="mlabel"><input type="checkbox" id="${m.id}" ${m.def?'checked':''} onclick="event.stopPropagation();this.closest('.mitem').classList.toggle('on',this.checked)" data-p>${m.l}</div>
          <div class="mex">${m.ex}</div>
          <div class="mdesc">${m.d}</div>
        </div>`).join('')}</div>
        ${g.grp==='Mutaciones de letras'?`<div class="frow" style="margin:8px 0 0"><label>Intensidad Leet <span class="tip" data-tip="Baja: sustituciones básicas (a→4, e→3, o→0). Media: añade i→1, s→5, t→7. Alta: todas las variantes posibles por letra (mucho más explosivo).">?</span></label><select id="wl-leet" class="inp" data-p><option value="low">Baja</option><option value="medium" selected>Media</option><option value="high">Alta</option></select></div>`:''}
        ${g.grp==='Números'?`<div class="frow" style="margin:8px 0 0"><label>Máx. dígitos del sufijo numérico</label><input id="wl-numlen" class="inp" type="number" value="4" min="1" max="6" data-p></div>`:''}
      </div>`).join('')}
      <div style="display:flex;gap:7px;flex-wrap:wrap"><button class="btn btn-gh btn-sm" onclick="doEstWL()">Estimar</button><button class="btn btn-gh btn-sm" onclick="doPrevWL()">Preview</button><button class="btn btn-g btn-sm" style="flex:1" id="wl-gen-btn" onclick="doGenWL()">${ic('zap')} Generar</button></div>
      <div id="wl-est" style="margin-top:9px"></div>
    </div>
    <div class="card"><div class="ctitle">${ic('eye')} Vista previa / Resultado</div><div id="wl-prev" class="empty" style="padding:24px">${ic('zap',36)}<h3>Sin vista previa</h3><p>Pulsa Vista previa o Generar</p></div></div>
  </div>
  <div class="tc" id="wl-tc-1"><div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:8px"><div class="ctitle" style="margin-bottom:0">${ic('download')} Wordlists Disponibles</div><button class="btn btn-gh btn-sm" onclick="wordlists()">${ic('refresh',12)} Actualizar</button></div><div style="font-size:.76rem;color:var(--t2);margin-bottom:12px">${wls.total||0} archivos · ${wls.total_size_human||'—'} · <span class="mono">${wls.directory||'—'}</span></div>
  ${!wlArr.length?`<div class="empty" style="padding:28px">${ic('download',36)}<h3>Sin wordlists</h3></div>`:`<div class="twrap"><table><thead><tr><th>Archivo</th><th>Líneas</th><th>Tamaño</th><th>Muestra</th><th>Modificado</th><th></th></tr></thead><tbody>${wlArr.map(w=>`<tr><td class="mono">${w.filename}</td><td class="mono"><strong>${(w.lines||0).toLocaleString()}</strong></td><td class="mono">${w.size_human||fb(w.size_bytes)}</td><td style="font-size:.68rem;color:var(--t2);font-family:'JetBrains Mono',monospace">${(w.sample_first||[]).slice(0,4).join(', ')}</td><td class="mono" style="font-size:.7rem;color:var(--t2)">${fd(w.modified_at)}</td><td><div style="display:flex;gap:4px"><a class="btn btn-gh btn-xs" href="${API}/wordlists/${w.filename}/download" target="_blank">${ic('download',11)}</a><button class="btn btn-d btn-xs btn-ico" onclick="doDelWL('${w.filename}')">${ic('trash',11)}</button></div></td></tr>`).join('')}</tbody></table></div>`}</div></div>
  </div>`);
  restFP('wl-form');renderSeeds();
  // sincroniza el resaltado visual de las mutaciones con el estado restaurado
  document.querySelectorAll('#wl-form .mitem').forEach(m=>{const cb=m.querySelector('input[type=checkbox]');if(cb)m.classList.toggle('on',cb.checked);});}
function togM(el,id){const cb=document.getElementById(id);if(cb){cb.checked=!cb.checked;el.classList.toggle('on',cb.checked);persistInput(cb);}}
function renderSeeds(){const box=document.getElementById('sbox');if(!box)return;const inp=document.getElementById('sinput');box.querySelectorAll('.stag').forEach(e=>e.remove());_seeds.forEach(s=>{const t=document.createElement('span');t.className='stag';t.innerHTML=`${s}<span class="stag-x" onclick="rmSeed('${s}')">×</span>`;box.insertBefore(t,inp);});if(inp)inp.placeholder=_seeds.length?'Añadir más...':'Escribe y pulsa Enter o usa comas...';}
function addSeed(w){w=w.trim();if(!w||_seeds.includes(w))return;_seeds.push(w);localStorage.setItem('wl-seeds',JSON.stringify(_seeds));renderSeeds();}
function rmSeed(w){_seeds=_seeds.filter(s=>s!==w);localStorage.setItem('wl-seeds',JSON.stringify(_seeds));renderSeeds();}
function hSK(e){if(e.key==='Enter'||e.key===','){e.preventDefault();const v=e.target.value.replace(/,/g,'').trim();if(v)addSeed(v);e.target.value='';}else if(e.key==='Backspace'&&!e.target.value.length&&_seeds.length){rmSeed(_seeds[_seeds.length-1]);}}
function hSI(e){if(e.target.value.includes(',')){const p=e.target.value.split(',');p.slice(0,-1).forEach(s=>{if(s.trim())addSeed(s);});e.target.value=p[p.length-1];}}
function addPaste(){const inp=document.getElementById('spaste');if(!inp?.value)return;inp.value.split(',').map(s=>s.trim()).filter(Boolean).forEach(addSeed);inp.value='';toast('Palabras añadidas','success');}
const WL_BOOL_IDS=['use_lowercase','use_uppercase','use_capitalize','use_alternating_case','use_leet','use_number_infix','use_doubling','use_stretching','use_reverse','use_palindrome','use_numbers','use_years','use_birth_years','use_symbols','use_double_symbols','use_symbol_pairs','combine_words','combine_3_words','use_separators','use_reverse_combine','add_common_base','add_spanish_base','add_spanish_names'];
function getWLC(){const M={};WL_BOOL_IDS.forEach(k=>{const e=document.getElementById(k);M[k]=e?e.checked:false;});return{seed_words:_seeds,output_filename:document.getElementById('wl-name')?.value||'custom.txt',min_length:parseInt(document.getElementById('wl-min')?.value)||6,max_length:parseInt(document.getElementById('wl-max')?.value)||32,leet_intensity:document.getElementById('wl-leet')?.value||'medium',number_max_length:parseInt(document.getElementById('wl-numlen')?.value)||4,max_total:parseInt(document.getElementById('wl-maxtotal')?.value)||10000000,...M};}
function wlPreset(id){const p=WLPRESETS.find(x=>x.id===id);if(!p)return;document.querySelectorAll('.wl-preset').forEach(e=>e.classList.remove('on'));document.getElementById('wlp-'+id)?.classList.add('on');Object.entries(p.cfg).forEach(([k,v])=>{const e=document.getElementById(k);if(e){e.checked=v;e.closest('.mitem')?.classList.toggle('on',v);}});const leet=document.getElementById('wl-leet');if(leet&&p.leet)leet.value=p.leet;document.getElementById('wl-preset')&&(document.getElementById('wl-preset').value='');toast(`Preset "${p.l}" aplicado`,'success');if(_seeds.length)doEstWL();}
async function doEstWL(){if(!_seeds.length){toast('Añade palabras semilla','warn');return;}const el=document.getElementById('wl-est');if(el)el.innerHTML=`<div style="display:flex;align-items:center;gap:7px;color:var(--t2);font-size:.76rem"><div class="spin"></div> Estimando...</div>`;try{const r=await A.estimateWL(getWLC());if(el)el.innerHTML=`<div style="font-size:.78rem;color:var(--t1);display:flex;gap:12px;flex-wrap:wrap"><div>Total: <strong style="color:var(--g)">${r.estimated_count_human}</strong></div><div>Tamaño: <strong>${r.estimated_size_human}</strong></div><div>Tiempo: <strong>~${r.estimated_time_seconds}s</strong></div></div>`;}catch(e){toast(e.message,'error');if(el)el.innerHTML='';}}
async function doPrevWL(){
  if(!_seeds.length){toast('Añade palabras semilla','warn');return;}
  const el=document.getElementById('wl-prev');if(el)el.innerHTML=`<div style="display:flex;align-items:center;gap:7px;color:var(--t2)"><div class="spin"></div> Generando vista previa...</div>`;
  try{
    const r=await A.previewWL(getWLC());
    const cats=Object.entries(r.categories||{}).filter(([k,v])=>v&&v.length);
    if(!cats.length){if(el)el.innerHTML=`<div class="empty" style="padding:20px">${ic('zap',30)}<h3>Sin resultados</h3><p>Activa alguna mutación</p></div>`;return;}
    // muestra VARIADA: repartida a lo largo de cada categoría, no solo las primeras
    const spread=(arr,n)=>{if(arr.length<=n)return arr.slice();const st=arr.length/n,out=[];for(let i=0;i<n;i++)out.push(arr[Math.floor(i*st)]);return out;};
    if(el)el.innerHTML=`
      <div style="font-size:.72rem;color:var(--t2);margin-bottom:13px">Muestra variada de <strong style="color:var(--t1)">${cats.length}</strong> categorías de mutación. La generación real produce muchísimas más.</div>
      <div style="display:flex;flex-direction:column;gap:13px">${cats.map(([cat,s])=>`
        <div>
          <div style="display:flex;align-items:center;gap:9px;margin-bottom:6px"><span style="font-size:.63rem;color:var(--c);text-transform:uppercase;letter-spacing:.12em;font-weight:700;white-space:nowrap">${cat}</span><span style="flex:1;height:1px;background:var(--b0)"></span><span class="badge b-x" style="font-size:.56rem">${s.length}</span></div>
          <div style="display:flex;gap:5px;flex-wrap:wrap">${spread(s,8).map(w=>`<span class="kbd">${(''+w).replace(/</g,'&lt;')}</span>`).join('')}</div>
        </div>`).join('')}</div>`;
  }catch(e){toast(e.message,'error');if(el)el.innerHTML=`<div class="alert ae">${ic('x')}<div>${e.message}</div></div>`;}
}
async function doGenWL(){if(!_seeds.length){toast('Añade palabras semilla','warn');return;}const btn=document.getElementById('wl-gen-btn');if(btn)btn.disabled=true;const el=document.getElementById('wl-prev');if(el)el.innerHTML=`<div style="display:flex;align-items:center;gap:8px;color:var(--y)"><div class="spin"></div> Generando...</div><div class="ptrack" style="margin-top:10px"><div class="pbar ind"></div></div>`;try{const r=await A.genWL(getWLC());if(el)el.innerHTML=`<div class="alert as" style="margin-bottom:12px">${ic('check')}<div><strong>¡Generada!</strong> ${(r.total_passwords||0).toLocaleString()} contraseñas en ${r.elapsed_seconds}s</div></div><div style="font-size:.76rem;color:var(--t2)">Archivo: <span class="mono" style="color:var(--g)">${r.path}</span></div><div style="font-size:.76rem;color:var(--t2)">Tamaño: ${r.file_size_human} · ${Math.round(r.rate_per_second||0).toLocaleString()} pass/s</div>`;toast(`Wordlist: ${(r.total_passwords||0).toLocaleString()} entradas`,'success');wordlists();}catch(e){toast(e.message,'error');if(el)el.innerHTML=`<div class="alert ae">${ic('x')}<div>${e.message}</div></div>`;if(btn)btn.disabled=false;}}
function doDelWL(fn){confirmDlg(`¿Eliminar "${fn}"?`,async()=>{try{await A.delWL(fn);toast('Eliminada','success');wordlists();}catch(e){toast(e.message,'error');}});}
async function applyPreset(sel){const id=sel.value;if(!id)return;const p=_presets.find(x=>x.id===id);if(!p?.config)return;const c=p.config;document.querySelectorAll('.wl-preset').forEach(e=>e.classList.remove('on'));WL_BOOL_IDS.forEach(k=>{if(k in c){const e=document.getElementById(k);if(e){e.checked=c[k];e.closest('.mitem')?.classList.toggle('on',c[k]);}}});if(c.min_length){const e=document.getElementById('wl-min');if(e)e.value=c.min_length;}if(c.max_length){const e=document.getElementById('wl-max');if(e)e.value=c.max_length;}if(c.leet_intensity){const e=document.getElementById('wl-leet');if(e)e.value=c.leet_intensity;}if(c.number_max_length){const e=document.getElementById('wl-numlen');if(e)e.value=c.number_max_length;}if(c.max_total){const e=document.getElementById('wl-maxtotal');if(e)e.value=c.max_total;}toast(`Preset "${p.label}" aplicado`,'success');await doEstWL();}
// ======== SYSTEM ========
function fmtUptime(s){if(s==null)return '—';s=Math.floor(s);const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);return (d?d+'d ':'')+(h?h+'h ':'')+m+'m';}
function meterBar(pct){pct=Math.max(0,Math.min(100,pct||0));const col=pct<60?'var(--g)':pct<85?'var(--y)':'var(--r)';return `<div class="ptrack" style="height:6px"><div style="height:100%;border-radius:2px;width:${pct}%;background:${col};transition:width .5s"></div></div>`;}
async function system(){
  setC(`<div style="display:flex;align-items:center;gap:10px;color:var(--t2)"><div class="spin"></div> Cargando...</div>`);
  let pf=null,info=null,procs=[];
  try{[pf,info,procs]=await Promise.all([A.preflight().catch(()=>null),A.info().catch(()=>null),A.procs().catch(()=>[])]);}catch{}
  const sys=info||pf?.system||{},tools=pf?.tools||{},byC={};
  Object.entries(tools).forEach(([n,t])=>{const c=t.category||'other';if(!byC[c])byC[c]=[];byC[c].push([n,t]);});
  const run=procs.filter(p=>p.status==='running').length;
  const toolCount=Object.keys(tools).length,okCount=Object.values(tools).filter(t=>t.installed).length;
  setC(`<div class="sup">
    <div class="tabs" id="sys-tabs">
      <div class="tab active" onclick="swTab('sys-tabs','sys-tc',0)">${ic('cpu',13)} Información</div>
      <div class="tab" onclick="swTab('sys-tabs','sys-tc',1)">${ic('refresh',13)} Procesos${run?` <span class="badge b-y" style="margin-left:4px">${run}</span>`:''}</div>
      <div class="tab" onclick="swTab('sys-tabs','sys-tc',2)">${ic('zap',13)} Herramientas <span class="badge ${okCount===toolCount?'b-g':'b-x'}" style="margin-left:4px">${okCount}/${toolCount}</span></div>
    </div>
    <div class="tc active" id="sys-tc-0">${sysInfoHTML(sys,pf)}</div>
    <div class="tc" id="sys-tc-1"><div id="sys-procs">${sysProcsHTML(procs)}</div></div>
    <div class="tc" id="sys-tc-2">${sysToolsHTML(byC)}</div>
  </div>`);loadDataUsage();}
function sysInfoHTML(sys,pf){
  const rows=[['Hostname',sys.hostname,'var(--c)'],['Distribución',sys.distro,null],['Kernel',sys.kernel||sys.release,null],['Arquitectura',sys.arch,null],['Usuario',sys.user,null],['Python',sys.python||sys.python_version,null],['Uptime',fmtUptime(sys.uptime_seconds),null]];
  return `<div class="g2" style="margin-bottom:14px;align-items:start">
    <div class="card">
      <div class="ctitle">${ic('cpu')} Información del Sistema</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${sys.is_root?`<span class="badge b-g">ROOT ✓</span>`:`<span class="badge b-r">NO ROOT</span>`} ${pf?`<span class="badge ${pf.ready?'b-g':'b-r'}">${pf.ready?'✅ Sistema listo':'❌ No listo'}</span>`:''}</div>
      ${rows.map(([k,v,col])=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--b0);gap:10px"><span style="color:var(--t2);font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;flex-shrink:0">${k}</span><span class="mono" style="color:${col||'var(--t0)'};font-size:.8rem;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v||'—'}</span></div>`).join('')}
      ${(pf?.missing_critical||[]).length?`<div class="alert aw" style="margin-top:12px">${ic('warn')}<div><strong>Herramientas críticas faltantes:</strong> ${pf.missing_critical.join(', ')} — <span onclick="swTab('sys-tabs','sys-tc',2)" style="cursor:pointer;text-decoration:underline">Ver herramientas</span></div></div>`:''}
    </div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="card">
        <div class="ctitle">${ic('cpu')} CPU</div>
        <div style="font-size:.82rem;font-weight:600;margin-bottom:3px">${sys.cpu_model||'—'}</div>
        <div style="font-size:.7rem;color:var(--t2);margin-bottom:9px">${sys.cpu_count!=null?sys.cpu_count+' hilos':''}${sys.cpu_count_physical!=null?' · '+sys.cpu_count_physical+' núcleos':''}${sys.load_avg?' · load '+sys.load_avg.join(' / '):''}</div>
        ${sys.cpu_percent!=null?`<div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--t2);margin-bottom:3px"><span>Uso actual</span><span class="mono">${sys.cpu_percent}%</span></div>${meterBar(sys.cpu_percent)}`:''}
      </div>
      <div class="card">
        <div class="ctitle">${ic('cpu')} Memoria RAM</div>
        ${sys.memory_total_gb!=null?`<div style="display:flex;justify-content:space-between;font-size:.76rem;margin-bottom:4px"><span class="mono" style="color:var(--t0)">${sys.memory_used_gb} / ${sys.memory_total_gb} GB</span><span class="mono" style="color:var(--t2)">${sys.memory_percent}%</span></div>${meterBar(sys.memory_percent)}<div style="font-size:.68rem;color:var(--t2);margin-top:5px">Disponible: ${sys.memory_available_gb} GB</div>`:`<div style="color:var(--t2);font-size:.76rem">No disponible</div>`}
      </div>
      <div class="card">
        <div class="ctitle">${ic('folder')} Disco (/)</div>
        ${sys.disk_total_gb!=null?`<div style="display:flex;justify-content:space-between;font-size:.76rem;margin-bottom:4px"><span class="mono" style="color:var(--t0)">${sys.disk_used_gb} / ${sys.disk_total_gb} GB</span><span class="mono" style="color:var(--t2)">${sys.disk_percent}%</span></div>${meterBar(sys.disk_percent)}`:`<div style="color:var(--t2);font-size:.76rem">No disponible</div>`}
      </div>
      <div class="card">
        <div class="ctitle">${ic('search')} Búsqueda OUI / Fabricante</div>
        <div class="hint" style="margin-bottom:7px">${ic('info',11)}Introduce una MAC para identificar el fabricante. Ojo: los móviles modernos usan <b>MAC aleatorizada</b> y no son identificables (privacidad).</div>
        <div style="display:flex;gap:7px"><input id="oui-in" class="inp" placeholder="AA:BB:CC:DD:EE:FF" style="flex:1" onkeydown="if(event.key==='Enter')doOUI(this.value.trim())"><button class="btn btn-p" onclick="doOUI(document.getElementById('oui-in').value.trim())">Buscar</button></div>
        <button class="btn btn-gh btn-xs" style="margin-top:8px;width:100%" onclick="reloadOuiDB(this)">${ic('download',11)} Actualizar base de datos OUI (IEEE) para más precisión</button>
      </div>
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px"><div class="ctitle" style="margin-bottom:0">${ic('folder')} Datos del backend</div><button class="btn btn-gh btn-xs" onclick="loadDataUsage()" title="Recargar uso de disco">${ic('refresh',12)}</button></div>
        <div id="sys-data-usage" style="font-size:.76rem;color:var(--t2)">Cargando uso de disco…</div>
        <button class="btn btn-d btn-sm" style="width:100%;margin-top:11px" onclick="wipeAllData()">${ic('trash',12)} Eliminar TODOS los datos</button>
      </div>
    </div>
  </div>`;}
function sysProcsHTML(procs){
  const run=procs.filter(p=>p.status==='running');
  return `<div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
      <div class="ctitle" style="margin-bottom:0">${ic('refresh')} Procesos (${procs.length}) · <span style="color:${run.length?'var(--y)':'var(--t2)'}" class="${run.length?'ppulse':''}">${run.length} activos</span></div>
      <div style="display:flex;gap:6px">${run.length?`<button class="btn btn-d btn-sm" onclick="killAllProcs()">${ic('stop',12)} Matar todos</button>`:''}<button class="btn btn-gh btn-sm" onclick="refreshProcs()">${ic('refresh',12)} Actualizar</button></div>
    </div>
    <div class="hint" style="margin-bottom:11px">${ic('info',11)}Cada herramienta se ejecuta como subproceso gestionado. Detén uno colgado con <b>Matar</b>. Para módulos de ataque (MITM/Evil Twin), usa antes el botón <b>Detener</b> del propio módulo — hace la limpieza de red (iptables, ARP).</div>
    ${!procs.length?`<div class="empty" style="padding:34px">${ic('refresh',36)}<h3>Sin procesos</h3><p>Los subprocesos aparecen aquí al lanzar escaneos o ataques</p></div>`:`<div class="twrap"><table><thead><tr><th>Estado</th><th>ID</th><th>Comando</th><th>Inicio</th><th>Acción</th></tr></thead><tbody>${procs.map(p=>`<tr><td>${stb(p.status)}</td><td class="mono" style="font-size:.7rem">${p.id}</td><td class="mono" style="font-size:.68rem;color:var(--t2);max-width:520px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(p.command||'').replace(/"/g,'&quot;')}">${p.command}</td><td class="mono" style="font-size:.68rem;color:var(--t2)">${fd(p.started_at)}</td><td>${p.status==='running'?`<button class="btn btn-d btn-xs" onclick="cancelPS('${p.id}')">${ic('stop',11)} Matar</button>`:`<span class="badge b-x">—</span>`}</td></tr>`).join('')}</tbody></table></div>`}
  </div>`;}
function sysToolsHTML(byC){
  const html=Object.entries(byC).map(([cat,ts])=>`<div class="card" style="margin-bottom:11px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:11px"><div class="ctitle" style="margin-bottom:0">${ic('zap')} ${cat.toUpperCase().replace(/_/g,' ')}</div><div style="display:flex;gap:5px"><span class="badge b-g">${ts.filter(([,t])=>t.installed).length} ok</span>${ts.filter(([,t])=>!t.installed&&t.critical).length?`<span class="badge b-r">${ts.filter(([,t])=>!t.installed&&t.critical).length} críticos</span>`:''}</div></div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(182px,1fr));gap:8px">${ts.map(([n,t])=>`<div style="display:flex;align-items:center;gap:8px;padding:9px 10px;background:var(--bg3);border-radius:8px;border:1px solid ${t.installed?'rgba(0,255,136,.2)':'rgba(255,59,92,.18)'}"><div style="width:7px;height:7px;border-radius:50%;background:${t.installed?'var(--g)':'var(--r)'};flex-shrink:0;${t.installed?'box-shadow:0 0 5px var(--g)':''}"></div><div style="flex:1;min-width:0"><div class="mono" style="font-size:.76rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${n}</div><div style="font-size:.62rem;color:${t.installed?'var(--t2)':'var(--r)'}">${t.installed?(t.version||'instalado'):'no instalado'}</div></div>${t.critical&&!t.installed?`<span class="badge b-r" style="font-size:.5rem;padding:1px 4px">CRIT</span>`:''}</div>`).join('')}</div></div>`).join('');
  return html||`<div class="empty" style="padding:34px">${ic('zap',36)}<h3>Sin datos de herramientas</h3></div>`;}
async function refreshProcs(){const el=document.getElementById('sys-procs');if(!el)return;try{const procs=await A.procs();el.innerHTML=sysProcsHTML(procs);}catch(e){toast(e.message,'error');}}
async function cancelPS(id){try{await A.cancelProc(id);toast('Proceso detenido','success');refreshProcs();}catch(e){toast(e.message,'error');}}
async function killAllProcs(){const procs=await A.procs().catch(()=>[]);const run=procs.filter(p=>p.status==='running');if(!run.length){toast('No hay procesos activos','info');return;}confirmDlg(`¿Matar los ${run.length} procesos activos?`,async()=>{for(const p of run){await A.cancelProc(p.id).catch(()=>{});}toast('Procesos detenidos','success');refreshProcs();});}
async function doOUI(mac){
  if(!mac){toast('Introduce una MAC','warn');return;}
  try{
    const r=await A.oui(mac);
    const rand=r.is_randomized,vendor=(r.manufacturer&&!/random/i.test(r.manufacturer))?r.manufacturer:null;
    const body=`<div style="padding:14px;background:var(--bg0);border-radius:8px;border:1px solid var(--b1);margin-bottom:12px">
        <div class="mono" style="font-size:1.05rem;color:var(--c);margin-bottom:9px">${r.mac}</div>
        <div style="font-size:.86rem;margin-bottom:6px"><span style="color:var(--t2)">Fabricante:</span> <strong>${vendor||(rand?'No identificable':'Desconocido')}</strong></div>
        <div style="font-size:.8rem"><span style="color:var(--t2)">OUI:</span> <span class="mono">${r.oui||'—'}</span></div>
      </div>
      ${rand
        ?`<div class="alert aw" style="margin-bottom:0">${ic('warn')}<div><strong>MAC aleatorizada (privacidad).</strong> El fabricante real no es identificable: los móviles modernos (iOS/Android) usan una MAC aleatoria distinta por red. No es un fallo del lookup — es el comportamiento esperado.</div></div>`
        :vendor
          ?`<div class="alert as" style="margin-bottom:0">${ic('check')}<div>MAC de fabricante real identificada.</div></div>`
          :`<div class="alert ai" style="margin-bottom:0">${ic('info')}<div>OUI no encontrado. Pulsa <strong>Actualizar base de datos OUI</strong> (abajo, en la tarjeta de búsqueda) para descargar la lista completa del IEEE y afinar los resultados.</div></div>`}`;
    showModal('OUI / Fabricante',body,`<button class="btn btn-gh" onclick="closeModal()">Cerrar</button>`);
  }catch(e){toast(e.message,'error');}
}
async function reloadOuiDB(btn){const t=btn?btn.innerHTML:null;if(btn){btn.disabled=true;btn.innerHTML='<div class="spin"></div> Descargando base de datos…';}try{const r=await A.ouiDownload();toast(r.success?'Base de datos OUI actualizada — lookups más precisos':'No se pudo descargar (¿sin internet o sin wget?)',r.success?'success':'warn');}catch(e){toast(e.message,'error');}if(btn){btn.disabled=false;btn.innerHTML=t;}}
async function loadDataUsage(){
  const el=document.getElementById('sys-data-usage');if(!el)return;
  try{
    const d=await A.dataUsage();
    const top=(d.folders||[]).filter(f=>f.bytes>0).slice(0,6);
    el.innerHTML=`<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span>Total en <span class="mono">data/</span></span><strong style="color:var(--t0)">${d.total_human}</strong></div>${top.length?top.map(f=>`<div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--t2);padding:2px 0"><span class="mono">${f.name}</span><span>${f.human} · ${f.files} arch.</span></div>`).join(''):`<div style="font-size:.72rem;color:var(--t3)">Sin datos guardados.</div>`}`;
  }catch(e){el.innerHTML=`<div style="font-size:.72rem;color:var(--t3)">No disponible</div>`;}
}
function wipeAllData(){
  confirmDlg('Vas a <b>eliminar TODOS los datos</b> del backend: capturas, handshakes, PMKID, wordlists generadas, informes, evidencias de sesiones y el mapa de recon. <b>Es irreversible.</b>',()=>{
    confirmDlg('Última confirmación: se borrará <b>todo el contenido de la carpeta <span class="mono">data/</span></b> y se reseteará el estado en memoria. ¿Seguro?',async()=>{
      try{const r=await A.wipeData();toast('Todos los datos han sido eliminados','success');if(ST.activeSession)setSession(null);loadDataUsage();}catch(e){toast(e.message,'error');}
    },{ok:'Sí, borrar TODO definitivamente'});
  },{ok:'Continuar'});
}
// ======== HELP / AYUDA ========
let _helpOpen=null;
function help(){
  // Helpers de formato (locales para no colisionar con A/API)
  const _b=t=>'<b>'+t+'</b>';
  const _a=t=>'<span class="hl-a">'+t+'</span>';
  const _w=t=>'<span class="hl-w">'+t+'</span>';
  const _d=t=>'<span class="hl-d">'+t+'</span>';
  const _g=t=>'<span class="hl-g">'+t+'</span>';
  const _c=t=>'<span class="hcode">'+t+'</span>';
  const hP=t=>'<p>'+t+'</p>';
  const hLi=(l,t)=>'<div class="hli"><span>'+(l?_b(l)+': ':'')+t+'</span></div>';
  const hH=t=>'<div class="hsec-h">'+t+'</div>';
  const hH2=t=>'<div class="hsec-h2">'+t+'</div>';
  const hStep=(n,ti,de)=>'<div class="hstep"><span class="hstep-n">'+n+'</span><div><b>'+ti+'</b><span> — '+de+'</span></div></div>';
  const hTool=(n,d,fl)=>'<div class="htool"><span class="htool-n">'+n+'</span><div class="htool-d">'+d+'</div>'+(fl?'<div class="htool-flags">'+fl.map(f=>'<div><code>'+f[0]+'</code><span>'+f[1]+'</span></div>').join('')+'</div>':'')+'</div>';
  const hBox=(ty,ti,bo)=>'<div class="hbox '+ty+'"><div class="hbox-t">'+ti+'</div><div class="hbox-d">'+bo+'</div></div>';
  const hReqs=items=>'<div class="hreqs"><div class="hreqs-t">📋 Requisitos</div>'+items.map(i=>'<div class="req">• '+i+'</div>').join('')+'</div>';

  const SECS=[
    {id:'overview',t:'📖  ¿Qué es WFAudit?',b:()=>[
      hP('WFAudit es una '+_b('plataforma profesional de auditoría de seguridad WiFi')+' diseñada para pentesters y equipos de red team que realizan evaluaciones inalámbricas autorizadas. Orquesta un conjunto completo de herramientas ofensivas estándar del sector a través de un backend REST unificado y esta interfaz web.'),
      hP('En lugar de memorizar decenas de invocaciones de línea de comandos para herramientas como '+_c('aircrack-ng')+', '+_c('hcxdumptool')+', '+_c('hashcat')+', '+_c('hostapd')+', '+_c('arpspoof')+' o '+_c('mitmproxy')+', WFAudit las presenta en paneles guiados con visualizaciones en tiempo real y gestión automática de estado.'),
      hH('Qué puedes hacer'),
      hLi('Reconocimiento','Escanear '+_a('2.4 GHz, 5 GHz o ambas bandas')+' a la vez; enumerar APs con tipo de seguridad, cifrado, canal, señal, clientes conectados y disponibilidad de PMKID; analizar las redes que buscan los clientes (PNL).'),
      hLi('Ataques WPA/WPA2',_a('Capturar handshakes')+' con deauth dirigido o broadcast; '+_a('ataques PMKID sin cliente')+' que funcionan sin dispositivos conectados; honeypots AP-less para objetivos fuera de su red habitual.'),
      hLi('Ataques Enterprise',_a('Servidores RADIUS falsos')+' con Evil Twin Enterprise para capturar credenciales '+_b('PEAP/EAP-TTLS')+' de redes 802.1X.'),
      hLi('Ataques WPA3',_a('Detectar debilidades de modo transición')+', explotar downgrades WPA2/WPA3 y ataques de denegación de servicio SAE.'),
      hLi('Ataques de red',_a('Evil Twin')+' con deauth integrado y monitorización MITM automática; '+_a('MITM por ARP spoofing')+' con modo '+_b('sigiloso')+' (invisible) e '+_b('intercepción total')+'.'),
      hLi('Post-explotación',_a('Integración con nmap')+' con 8 perfiles: escaneo de vulnerabilidades, detección de SO y enumeración de servicios.'),
      hLi('Informes',_a('Seguimiento por sesiones')+' con hallazgos clasificados por severidad (crítico/alto/medio/bajo/info), gestión de capturas y exportación de informe JSON.'),
      hH('Arquitectura'),
      hP('WFAudit usa una arquitectura de '+_b('tres capas')+': un backend FastAPI (Python 3.11+) que expone la API y orquesta subprocesos, una capa de servicios con la lógica de ataque, y una capa de utilidades con parsers, lookups OUI y gestión de procesos. Todas las operaciones largas (escaneos, capturas, cracks, ataques) se ejecutan como '+_b('subprocesos asíncronos')+' con cancelación, timeouts y limpieza correcta.'),
      hBox('danger','⚖️  Aviso legal','Esta plataforma es '+_b('exclusivamente para auditorías autorizadas')+' bajo contrato escrito. Atacar redes WiFi sin autorización es ilegal en prácticamente todas las jurisdicciones (en España: arts. 197 y 264 del Código Penal; UE: Directiva 2013/40/UE; EE.UU.: CFAA 18 U.S.C. §1030). Obtén siempre autorización escrita del propietario de la red, documenta el alcance y conserva la prueba de autorización. '+_b('Eres el único responsable del cumplimiento legal.')),
    ].join('')},

    {id:'workflow',t:'🗺  Flujo de trabajo recomendado',b:()=>[
      hP('Una auditoría WiFi bien ejecutada sigue una progresión estructurada: reconocimiento → explotación → análisis post-acceso. Este flujo maximiza la información obtenida minimizando el riesgo de detección y evitando acciones irreversibles en las fases tempranas.'),
      hH('Fase 1 — Preparación y verificación'),
      hStep('1','Chequeo del sistema','Dashboard → verifica que el backend corre como root y que todas las herramientas están instaladas (preflight). Resuelve cualquier dependencia faltante antes de continuar.'),
      hStep('2','Crear sesión de auditoría','Sesiones → Nueva. Documenta cliente, alcance, activos autorizados y fechas. Todos los hallazgos se vinculan a esta sesión para el informe final.'),
      hStep('3','Preparar el adaptador','Interfaces → identifica tus tarjetas WiFi, verifica soporte de modo monitor y créalo. Opcionalmente aleatoriza la MAC para anonimato.'),
      hH('Fase 2 — Reconocimiento pasivo'),
      hStep('4','Escaneo dual-band','Escaneo WiFi → 60-120s en modo "abg" captura 2.4 GHz y 5 GHz a la vez. No te limites a 2.4 GHz: perderías la mayoría de redes corporativas.'),
      hStep('5','Analizar clientes y PNL','Tras el escaneo, revisa qué redes busca cada cliente. Esas probe requests revelan patrones, redes domésticas y oportunidades de Evil Twin.'),
      hStep('6','Priorizar objetivos','Prioriza: redes abiertas (trivial), WEP (crítico + trivial), APs con WPS, redes con PMKID disponible, y enterprise para cosecha de credenciales.'),
      hH('Fase 3 — Extracción de credenciales'),
      hStep('7','PMKID primero','Avanzado → PMKID. Pruébalo primero en cualquier WPA2: es rápido (30-60s), sin cliente y silencioso. ~70-80% de los APs modernos son vulnerables.'),
      hStep('8','Handshake como respaldo','Si PMKID falla, ve a Handshake con clientes activos. Usa deauth dirigido (no broadcast: menos ruidoso y más efectivo).'),
      hStep('9','Crackeo offline','Con el hash, crackéalo con hashcat (modo 22000) usando wordlists adecuadas. Empieza por rockyou.txt y escala solo si es necesario.'),
      hH('Fase 4 — Ataques de red'),
      hStep('10','Evil Twin','Ataques → Evil Twin. Clona una red atractiva, deauth al AP legítimo para forzar a los clientes. El monitor MITM integrado captura todo el tráfico automáticamente.'),
      hStep('11','Credenciales Enterprise','Si hay WPA2-Enterprise en alcance, Avanzado → Enterprise lanza un RADIUS falso para capturar credenciales PEAP/EAP-TTLS (crackeables con hashcat modo 5500).'),
      hStep('12','MITM post-acceso','Ya conectado a la red (por password crackeada o Evil Twin), Ataques → MITM. Usa modo SIGILOSO para monitorizar invisiblemente a un usuario concreto.'),
      hH('Fase 5 — Reconocimiento interno'),
      hStep('13','Descubrimiento de red','Recon → escaneo quick de nmap para identificar hosts vivos, luego service scan en los interesantes. No hagas full scans de /24 salvo que esté en alcance.'),
      hStep('14','Auditar el router/gateway','Recon → escanea el gateway. Busca credenciales por defecto, CVEs conocidos del modelo e interfaces de administración expuestas en la LAN.'),
      hH('Fase 6 — Documentación y limpieza'),
      hStep('15','Registrar hallazgos','Para cada issue, Sesiones → Añadir Hallazgo con severidad, descripción, evidencia y recomendación. Hazlo en tiempo real, no confíes en la memoria.'),
      hStep('16','Parar ataques y restaurar','Detén todos los ataques desde sus botones Stop. Esto limpia iptables, restaura cachés ARP y mata subprocesos. Crítico antes de desconectar.'),
      hStep('17','Volver a modo managed','Interfaces → Managed en todas las interfaces monitor. Si no lo haces, tu sistema queda alterado hasta reiniciar.'),
      hStep('18','Exportar informe','Sesiones → Informe. Guarda todo: hallazgos, capturas y metadatos por motivos contractuales y legales.'),
      hBox('info','Orientación temporal','Una auditoría WiFi de una pyme (1-3 APs, un edificio) lleva '+_b('4-8 horas')+'. Una auditoría corporativa completa con varias sedes y post-acceso puede llevar '+_b('3-5 días')+' o más. Reserva siempre un 25-30% del tiempo para documentación e informe.'),
    ].join('')},

    {id:'dashboard',t:'◉  Panel Dashboard',b:()=>[
      hP('El Dashboard es la '+_b('primera pantalla')+' al abrir WFAudit y actúa como indicador central de salud de la plataforma. Ofrece un resumen del estado del sistema, verifica que las dependencias estén instaladas y funcionales, y muestra cualquier problema que impediría que los ataques funcionen.'),
      hH('Qué muestra'),
      hLi('Sistema','Hostname, SO, cores y si el backend corre como root. '+_b('Root es innegociable')+': operaciones con sockets raw, iptables y modo monitor lo requieren. Si sale en rojo, no puedes continuar.'),
      hLi('Herramientas','Recuento de herramientas instaladas vs. requeridas, con barra de progreso. Los críticos faltantes se marcan en rojo.'),
      hLi('Sesiones','Número de sesiones y cuántas están activas. Acceso rápido a la gestión.'),
      hLi('Procesos','Subprocesos en ejecución en tiempo real. Pulsa para ver y cancelar.'),
      hLi('Accesos rápidos','Atajos a los flujos principales (escaneo, recon, handshake, Evil Twin, avanzado, wordlists).'),
      hLi('Inventario de herramientas','Listado con estado de instalación (verde=instalada, rojo=falta) y versión cuando está disponible.'),
      hH('Herramientas críticas'),
      hTool('aircrack-ng','Suite fundamental para WPA/WEP. Incluye airodump-ng (escáner/sniffer), aireplay-ng (inyección), airmon-ng (modo monitor) y aircrack-ng (ataque de diccionario por CPU).'),
      hTool('hcxdumptool','Reemplazo moderno de airodump-ng para captura de PMKID. Más rápido y eficiente contra APs concretos. Necesario para ataques PMKID.'),
      hTool('hcxtools','Aporta hcxpcapngtool, que convierte los .pcapng a formato .22000 que hashcat necesita. Sin él no puedes crackear los PMKID capturados.'),
      hTool('hashcat','Motor de cracking acelerado por GPU. 300+ tipos de hash. Velocidades típicas: 500.000-5.000.000 intentos WPA/s en GPU moderna, frente a 500-5.000/s en CPU.'),
      hTool('nmap','Mapeador de red estándar del sector. Escaneo de puertos, detección de versiones y de SO, y checks de vulnerabilidades vía scripts NSE.'),
      hTool('hostapd','Demonio que convierte un adaptador WiFi en un AP funcional. Base de Evil Twin, honeypot AP-less y ataques WPA3.'),
      hTool('dnsmasq','Servidor DHCP/DNS ligero. Junto a hostapd en Evil Twin asigna IPs a los clientes y resuelve (o redirige) las consultas DNS.'),
      hH2('Específicas de ataque'),
      hTool('mitmproxy / mitmdump','Proxy HTTP/HTTPS transparente con scripting en Python. Intercepta, descifra (con CA), modifica y registra tráfico web en tiempo real.'),
      hTool('tshark','Versión CLI de Wireshark. En MITM sigiloso extrae pasivamente consultas DNS y SNI de TLS sin romper HTTPS.'),
      hTool('dsniff (arpspoof)','Aporta arpspoof, que envía respuestas ARP gratuitas para envenenar la caché ARP del objetivo y del gateway, redirigiendo el tráfico.'),
      hTool('freeradius','Servidor RADIUS completo. En ataques WPA2-Enterprise acepta intentos EAP de las víctimas y registra los hashes para crackeo offline.'),
      hTool('macchanger','Modifica la MAC de una interfaz. Útil para anonimización antes de un ataque.'),
      hReqs(['Backend corriendo como root (euid == 0)','Al menos una interfaz WiFi conectada','Herramientas críticas instaladas (aircrack-ng, hcxdumptool, hcxtools, hashcat, nmap, hostapd)']),
    ].join('')},

    {id:'interfaces',t:'⚡  Panel Interfaces',b:()=>[
      hP('El panel Interfaces gestiona los '+_b('adaptadores inalámbricos')+' conectados a tu sistema. Todo ataque WiFi requiere el adaptador en el modo correcto (monitor o managed), en el canal correcto y a menudo con una MAC concreta para evitar detección o saltar filtros.'),
      hH('Qué muestra'),
      hLi('Nombre','El nombre del kernel Linux (ej. '+_c('wlan0')+', '+_c('wlan0mon')+').'),
      hLi('MAC','La dirección hardware o falsificada que emite el adaptador.'),
      hLi('Modo',_a('managed')+' (cliente normal, solo recibe paquetes dirigidos a él) o '+_a('monitor')+' (promiscuo, ve todas las tramas 802.11 del entorno).'),
      hLi('Driver y chipset','Driver del kernel (ath9k_htc, rtl8812au, mt76...) y chipset. El chipset determina las capacidades: algunos soportan monitor pero no inyección.'),
      hLi('Capacidades','Indicadores de soporte de monitor, inyección de paquetes, modo AP y 5 GHz.'),
      hLi('Canal y potencia','Canal actual y potencia de transmisión en dBm.'),
      hH('Operaciones'),
      hTool('Modo Monitor','Crea una interfaz virtual monitor desde una managed, o la destruye. En monitor el adaptador captura todas las tramas 802.11 del entorno (beacons, probes, datos, management).',[['airmon-ng start','Crea wlan0mon desde wlan0'],['airmon-ng check kill','Mata NetworkManager/wpa_supplicant que interferirían'],['iw dev set type monitor','Método alternativo sin airmon-ng']]),
      hTool('Cambio de MAC','Modifica la MAC de la interfaz. Útil para anonimización, saltar filtros MAC o suplantar dispositivos. Baja la interfaz, cambia la MAC y la vuelve a subir.',[['macchanger -A','MAC aleatoria del mismo fabricante (preserva OUI)'],['macchanger -r','MAC totalmente aleatoria (puede ser sospechosa)'],['macchanger -m <MAC>','Fija una MAC específica'],['macchanger -p','Restaura la MAC permanente (hardware)']]),
      hTool('TX Power','Ajusta la potencia de transmisión (1-30 dBm). Más potencia = más alcance, pero también más detectable. El máximo real depende del dominio regulatorio.'),
      hH('Chipsets recomendados'),
      hLi('Atheros AR9271',_a('Referencia')+' para 2.4 GHz. Driver nativo (ath9k_htc) con excelente inyección. Usado en Alfa AWUS036NHA, TP-Link TL-WN722N v1.'),
      hLi('Realtek RTL8812AU','Dual-band (2.4 + 5 GHz), excelente inyección. Alfa AWUS036ACH. Requiere driver externo en algunos kernels.'),
      hLi('Ralink RT3070/RT5572','Opción dual-band fiable. Alfa AWUS036NH.'),
      hLi('MediaTek MT7612U','Dual-band moderno con buen soporte Linux. Alfa AWUS036ACM.'),
      hBox('warn','Evita estos','TP-Link TL-WN722N v2/v3 (cambió de Atheros a Realtek RTL8188EUS, mala inyección); adaptadores Intel integrados (iwlwifi bloquea inyección); la mayoría de Broadcom (mal soporte Linux).'),
      hBox('info','Prueba tu adaptador','Antes de atacar, verifica la inyección: pon el adaptador en monitor y ejecuta '+_c('sudo aireplay-ng --test wlan0mon')+'. Si responde "Injection is working!" estás listo.'),
      hReqs(['Adaptador WiFi con soporte de monitor e inyección','Privilegios root','Utilidades iw, iwconfig, macchanger, airmon-ng instaladas']),
    ].join('')},

    {id:'scanner',t:'◈  Panel Escaneo WiFi',b:()=>[
      hP('El escáner WiFi es el '+_b('punto de partida de toda auditoría')+'. Antes de atacar una red necesitas identificarla, caracterizar su seguridad, encontrar sus clientes y entender el entorno. Este panel hace reconocimiento pasivo del espectro.'),
      hP('El escáner pone el adaptador en modo monitor y captura todas las tramas 802.11 del entorno, parseándolas en tiempo real para extraer APs, su configuración (ESSID, canal, seguridad, cifrado), sus clientes y las '+_a('probe requests')+'. Al ser '+_b('puramente pasivo')+' (solo escucha), eres invisible en el aire.'),
      hH('Selección de banda'),
      hTool('2.4 GHz (bg)','Escanea canales 1-13. Rápido (30-60s), captura redes B/G/N heredadas. La mayoría de routers domésticos e IoT. Los canales no solapados son 1, 6 y 11.'),
      hTool('5 GHz (a)','Escanea canales 36+. La mayoría de redes corporativas y modernas. Menos interferencia pero menor alcance. Incluye canales DFS donde el AP cede ante radar.'),
      hTool('Dual-band (abg)','Escanea ambas bandas a la vez. Recomendado: da la imagen completa del entorno. Tarda algo más y requiere un adaptador dual-band.'),
      hH('Entender los resultados'),
      hLi('BSSID','La MAC del AP (dirección física de su radio). Única por AP.'),
      hLi('ESSID','El nombre de red legible. Puede estar oculto (0 bytes) o ser legítimo. Si está vacío, el AP está en modo oculto pero a menudo se descubre por las probe responses.'),
      hLi('Canal','El canal RF del AP. Tu adaptador debe estar en él para capturar su tráfico.'),
      hLi('Señal (PWR)','Fuerza en dBm (siempre negativa; más cerca de 0 = más fuerte). -30 muy cerca, -70 lejos, -90 apenas detectable. Para atacar quieres -70 o mejor.'),
      hLi('Cifrado','Combinaciones habituales: '+_w('OPN')+' (sin seguridad), '+_d('WEP')+' (roto), '+_w('WPA/WPA2-PSK')+' (con AES), '+_a('WPA2-MGT')+' (Enterprise), '+_a('WPA3-SAE')+'.'),
      hLi('WPS','Si Wi-Fi Protected Setup está activo. Potencialmente vulnerable a fuerza bruta del PIN con reaver/bully.'),
      hLi('Fabricante','Identificado por el OUI (primeros 3 bytes del BSSID). Útil para detectar dispositivos con vulnerabilidades conocidas.'),
      hH('Clientes y probe requests'),
      hP('Cuando un dispositivo no está conectado, suele enviar '+_b('probe requests')+' buscando redes a las que se conectó antes. Estas probes son visibles en modo monitor y revelan el historial del dispositivo (red doméstica, oficina...).'),
      hLi('Candidatos a Evil Twin','Redes buscadas por los clientes pero que NO se están emitiendo en la zona. Candidatas perfectas: el cliente se auto-conectará si emites una con ese nombre.'),
      hLi('MAC aleatorizada','iOS (14+) y Android (10+) aleatorizan su MAC en las probes. El panel detecta MACs aleatorizadas (bit local activado) y las marca.'),
      hBox('info','Duración de escaneo',_b('30s')+': reconocimiento rápido, APs y clientes con tráfico frecuente. '+_b('60-120s')+': equilibrado, la mayoría de APs (recomendado). '+_b('300s+')+': exhaustivo, redes ocultas y señales débiles. '+_b('600s+')+': monitorización larga, probes raras.'),
      hReqs(['Adaptador en modo monitor (automático si hace falta)','Adaptador que soporte la(s) banda(s) objetivo','Privilegios root']),
    ].join('')},

    {id:'handshake',t:'◎  Panel Handshake / Crack',b:()=>[
      hP('Este panel realiza el '+_b('ataque clásico contra WPA/WPA2-Personal')+': capturar el handshake de 4 vías del proceso de autenticación y luego hacer ataques de diccionario offline contra el hash para recuperar la passphrase. Funciona contra prácticamente el 100% de las redes WPA/WPA2-PSK con al menos un cliente conectado.'),
      hH('Cómo funciona el handshake de 4 vías'),
      hP('Al conectarse un cliente WPA/WPA2, realiza un handshake de 4 mensajes EAPOL con el AP para derivar claves de sesión desde la PSK (clave precompartida):'),
      hLi('Mensaje 1 (AP→Cliente)','El AP envía ANonce. Aquí es donde un AP vulnerable incluye el PMKID.'),
      hLi('Mensaje 2 (Cliente→AP)','El cliente envía SNonce + MIC calculado desde la PTK (derivada de PSK + nonces + MACs).'),
      hLi('Mensaje 3 (AP→Cliente)','El AP verifica el MIC y envía la instalación de clave + su propio MIC.'),
      hLi('Mensaje 4 (Cliente→AP)','El cliente confirma y la conexión se establece.'),
      hP(_b('La debilidad')+': los MIC de los mensajes 2 y 3 se pueden verificar offline contra cualquier passphrase candidata. Se calcula qué MIC '+_b('debería')+' dar cada candidata y se compara con el capturado. Si coincide, la passphrase es correcta.'),
      hH('Fase 1: Captura'),
      hTool('airodump-ng','Herramienta principal de captura. Bloqueada al canal del AP objetivo, escribe todas las tramas a un .cap. Debe capturar al menos los mensajes 2 y 3.',[['-c <canal>','Bloqueo al canal (crítico: debe coincidir con el AP)'],['--bssid <MAC>','Filtra al AP concreto'],['-w <prefijo>','Escribe los ficheros de salida']]),
      hTool('aireplay-ng (deauth)','Envía tramas de desautenticación para forzar al cliente a desconectarse. Al reconectar (en segundos), rehace el handshake que airodump-ng captura.',[['--deauth <N>','Envía N paquetes deauth (5-50 típico)'],['-a <AP>','AP objetivo (obligatorio)'],['-c <cliente>','Cliente concreto (recomendado: menos ruidoso y más efectivo)']]),
      hH('Estrategias de deauth'),
      hLi('Dirigido (recomendado)','Especifica un cliente con '+_c('-c')+'. Solo ese se desconecta, reconecta rápido y suele dar un handshake limpio. Menos disruptivo y detectable.'),
      hLi('Broadcast','Omite '+_c('-c')+'. Todos los clientes se desconectan a la vez. Más intentos de reconexión pero más colisiones y más visible para el administrador.'),
      hBox('warn','Dificultades de captura',_b('802.11w (PMF)')+' autentica las tramas de management, haciendo inútil el deauth. El '+_b('roaming agresivo')+' puede hacer que el cliente salte de AP/canal. Si no capturas tras varios intentos, cambia a PMKID.'),
      hH('Fase 2: Cracking'),
      hP('Con un handshake válido, el siguiente paso es el crackeo offline. Es costoso (cada candidata requiere PBKDF2 con 4096 iteraciones de HMAC-SHA1) pero paraleliza perfectamente en GPU.'),
      hTool('aircrack-ng','Cracking solo por CPU. Simple pero lento (500-5.000 pass/s por core). Bueno para wordlists pequeñas. Espera 4-8h para agotar rockyou.txt (14M) en una CPU moderna de 8 cores.',[['-w <wordlist>','Fichero de diccionario'],['-b <BSSID>','AP objetivo si hay varios en la captura']]),
      hTool('hashcat (modo 22000)','Cracking por GPU. Muchísimo más rápido: 500.000-5.000.000+ pass/s en GPU moderna. Requiere convertir el .cap a .22000 (automático vía hcxpcapngtool). El modo 22000 maneja PMKID y handshakes EAPOL.',[['-m 22000','Modo hash: WPA-PBKDF2-PMKID+EAPOL'],['-a 0','Ataque de diccionario directo'],['-a 3 ?d?d?d?d?d?d?d?d','Ataque por máscara (ej. 8 dígitos)'],['-r rules/best64.rule','Aplica reglas de variación']]),
      hH('Estrategia de wordlist'),
      hLi('rockyou.txt (14M)','El punto de partida clásico. En Kali está en /usr/share/wordlists/rockyou.txt.'),
      hLi('A medida','Para auditorías dirigidas, genera wordlists a medida (Panel Wordlists) con datos del objetivo: nombre de empresa, palabras clave, fechas.'),
      hLi('Máscaras','Para patrones sospechados: 10 dígitos (teléfonos), 8-12 dígitos (fechas), o restricciones de conjunto de caracteres.'),
      hReqs(['Handshake de 4 vías o PMKID capturado','Wordlist (rockyou.txt mínimo)','hashcat + GPU compatible para velocidad razonable (o crack largo por CPU con aircrack-ng)']),
    ].join('')},

    {id:'advanced',t:'⬡  Panel Avanzado',b:()=>[
      hP('El panel Avanzado contiene '+_b('cuatro vectores especializados')+' que van más allá del handshake-y-crack tradicional. Cada uno ataca clases concretas de despliegues WiFi con prerrequisitos distintos: PMKID, AP-Less, Enterprise y WPA3.'),
      hH('PMKID (WPA/WPA2 sin cliente)'),
      hP('Descubierto por Jens Steube (autor de hashcat) en 2018, el ataque PMKID elimina la necesidad de capturar un handshake de 4 vías. Extrae un PMKID del primer mensaje (M1) que envía el AP, incluso sin ningún cliente. Esto permite '+_b('atacar APs sin clientes conectados')+'.'),
      hP('El PMKID es un hash incluido en M1 para caché PMKSA: '+_c('PMKID = HMAC-SHA1-128(PMK, "PMK Name" || MAC_AP || MAC_STA)')+'. Como la PMK deriva de la passphrase vía PBKDF2, atacar el PMKID equivale a atacar un handshake completo, pero con una sola trama del AP.'),
      hTool('hcxdumptool','Herramienta especializada en captura de PMKID. Solicita activamente mensajes M1 (a diferencia del airodump-ng pasivo). Mucho más rápida obteniendo PMKIDs.',[['-i <iface>','Interfaz en modo monitor'],['-c <canal>','Bloqueo al canal'],['--enable_status=15','Salida verbosa con detección de PMKID']]),
      hP(_b('Tasa de vulnerabilidad')+': ~70-80% de los APs de consumo posteriores a ~2015 incluyen PMKID en M1. '+_b('Ventajas')+': sin clientes, sin deauth (silencioso), captura rápida (30-60s), una sola trama basta.'),
      hH('AP-Less (estilo KARMA)'),
      hP('El ataque AP-less ataca a dispositivos cuando su red habitual '+_b('no está cerca')+' (ej. auditar a un ejecutivo en un hotel, lejos de su oficina). En vez de atacar un AP, atacas el '+_b('comportamiento de auto-conexión del cliente')+'.'),
      hP('Cuando un dispositivo no está conectado y tiene redes en su PNL, envía probe requests constantemente. Tu ataque: crear un AP falso con el mismo ESSID que una red buscada. Al ver la coincidencia, el dispositivo intenta conectarse y durante el intento capturas un handshake derivado de la PSK REAL de su red guardada (porque la PMK deriva de PSK + SSID, y el SSID coincide).'),
      hP(_b('Clave')+': la PMK = PBKDF2(passphrase, SSID). El dispositivo calcula la PMK con su passphrase real guardada. Aunque tu AP tenga otra password y la conexión falle, el handshake parcial capturado sirve para crackeo offline. '+_b('Limitaciones')+': solo WPA/WPA2-PSK; las MACs aleatorizadas modernas reducen el éxito; no funciona contra WPA3-SAE.'),
      hH('Enterprise (WPA2-Enterprise / 802.1X)'),
      hP('WPA2-Enterprise sustituye la contraseña compartida por autenticación individual vía servidor RADIUS. Cada usuario tiene credenciales autenticadas por EAP. Variantes: '+_b('EAP-PEAP')+' (MSCHAPv2 en túnel TLS), '+_b('EAP-TTLS')+', '+_b('EAP-TLS')+' (certificado mutuo, seguro).'),
      hP('El ataque: montar un '+_b('RADIUS falso')+' con certificado SSL genérico y emitir un Evil Twin de la red Enterprise. Al intentar autenticarse, los clientes envían sus credenciales (o hashes challenge/response) por el túnel falso a tu RADIUS, que las registra para crackeo offline.'),
      hTool('freeradius','Servidor RADIUS completo en modo captura: acepta cualquier intento EAP y registra los challenges/responses y hashes. No autentica realmente, solo registra.',[['default_eap_type=peap','Anuncia soporte PEAP'],['tls_file=<cert.pem>','Certificado SSL autofirmado']]),
      hP(_b('Qué capturas')+': usuario (siempre en claro) + challenge/response MSCHAPv2 (para PEAP). Crackea con '+_c('hashcat -m 5500')+'. '+_b('Mitigaciones')+': validación de certificado en clientes, EAP-TLS (cert mutuo). Muchas empresas con MDM tienen validación de certificado y el ataque falla.'),
      hH('WPA3'),
      hP('WPA3 (2018) introdujo '+_b('SAE (Dragonfly)')+' como reemplazo del handshake PSK. SAE resiste ataques de diccionario offline porque cada intento requiere participación interactiva con el AP.'),
      hP('Sin embargo, el '+_b('Modo Transición')+' (WPA2 + WPA3 a la vez en el mismo ESSID para compatibilidad) crea una '+_b('vulnerabilidad de downgrade')+': un atacante puede forzar a un cliente WPA3 a caer a WPA2 y atacar ese handshake.'),
      hP(_b('SAE DoS (Dragonblood)')+': CVE-2019-9494 y relacionados. La fase commit de SAE requiere que el AP compute una multiplicación escalar en curva elíptica; inundar con commits puede sobrecargar su CPU.'),
      hBox('info','Qué ataque avanzado elegir',_b('WPA2-PSK con clientes')+': PMKID primero → handshake si falla. '+_b('WPA2-PSK sin clientes')+': PMKID es tu única opción. '+_b('Objetivo fuera de su red')+': honeypot AP-less. '+_b('Enterprise')+': módulo Enterprise. '+_b('WPA3')+': comprueba modo transición primero.'),
    ].join('')},

    {id:'recon',t:'🔍  Panel Reconocimiento',b:()=>[
      hP('Una vez con acceso a la red (por credenciales crackeadas o Evil Twin), el panel Recon hace '+_b('reconocimiento interno')+': descubrir hosts vivos, enumerar puertos y servicios, identificar sistemas operativos y detectar vulnerabilidades. Aquí la auditoría WiFi pasa a pentest interno tradicional.'),
      hTool('nmap','El mapeador de red estándar. Escaneo TCP/UDP, fingerprinting de SO, detección de versiones y motor de scripts (NSE) con miles de scripts de detección de vulnerabilidades. WFAudit ofrece perfiles preconfigurados.',[['-sS','Escaneo SYN (sigiloso, por defecto)'],['-sV','Detección de versión de cada servicio'],['-sC','Scripts NSE por defecto'],['-O','Detección de SO por fingerprint TCP/IP'],['-p <puertos>','Rango de puertos (ej. 22,80,443 o -p- para todos)'],['--script vuln','Todos los scripts de detección de vulnerabilidades']]),
      hH('Perfiles de escaneo'),
      hLi('Quick',_c('-T4 -F')+' — 100 puertos más comunes. <1 min por host. Barrido inicial de una subred.'),
      hLi('Full',_c('-T4 -p-')+' — Todos los 65535 puertos TCP. 5-30 min por host. Tras identificar hosts interesantes.'),
      hLi('Vuln',_c('--script vuln')+' — Detección de vulnerabilidades NSE. Identifica CVEs y credenciales por defecto. Ruidoso y lento (20-60 min).'),
      hLi('Service',_c('-sV -sC')+' — Versiones + scripts por defecto. El escaneo de trabajo habitual (3-15 min).'),
      hLi('OS Detect',_c('-O')+' — Fingerprinting del stack TCP/IP para detección de SO.'),
      hLi('Stealth',_c('-sS -T2')+' — SYN scan con timing lento. Menos probable que dispare el IDS (10-30 min por host).'),
      hLi('UDP',_c('-sU --top-ports 100')+' — Escaneo UDP (DNS, SNMP, NTP, NetBIOS). Lento por naturaleza (20-60 min).'),
      hH('Escaneo por host (Deep / Vuln)'),
      hP('Cada host descubierto se puede expandir para ver sus puertos abiertos, servicios y versiones. Los botones '+_b('Deep')+' (service scan) y '+_b('Vuln')+' (scripts de vulnerabilidad) relanzan un escaneo dirigido solo a ese host, mostrando el comando exacto ejecutado.'),
      hH('Router / Gateway'),
      hP('Los routers son un '+_b('objetivo de alto valor')+': comprometerlos suele dar control total de la red. Escanea el gateway buscando puertos de administración (21, 22, 23, 53, 80/8080, 443/8443, 1900, 5000), identifica modelo y firmware por banners, y comprueba credenciales por defecto (admin/admin...).'),
      hBox('warn','Disciplina en post-acceso','Una vez dentro, '+_b('resiste la tentación de escanearlo todo a máxima velocidad')+'. Las redes corporativas suelen tener IDS/IPS que alertan ante escaneos agresivos. Empieza con quick scans y reserva los full scans para objetivos concretos ya validados en alcance.'),
      hReqs(['Acceso a la red objetivo (como cliente o puente vía Evil Twin)','nmap instalado','Rangos de IP u hosts objetivo']),
    ].join('')},

    {id:'attacks',t:'◆  Panel Ataques (Evil Twin + MITM)',b:()=>[
      hP('El panel Ataques alberga los '+_b('dos módulos más complejos')+': Evil Twin y Man-in-the-Middle. Evil Twin crea un AP falso para cosechar credenciales o servir de pivote; MITM intercepta el tráfico de dispositivos ya conectados a una red a la que tienes acceso.'),
      hH('Evil Twin'),
      hP('Un Evil Twin es un '+_b('AP falso que suplanta una red legítima')+'. Los clientes, creyendo conectarse a una red conocida, se asocian al AP falso. Como el atacante controla el AP, actúa como gateway de todo el tráfico de la víctima, siendo un '+_b('MITM automático')+' sin ARP spoofing.'),
      hH2('Cómo funciona'),
      hLi('1. Setup','hostapd con el ESSID objetivo, mismo canal que el AP legítimo, seguridad equivalente (abierta o WPA2 con cualquier password).'),
      hLi('2. DHCP/DNS','dnsmasq asigna IPs a los clientes desde un rango controlado (10.0.0.0/24). Tu máquina es el gateway (10.0.0.1).'),
      hLi('3. NAT/forwarding','iptables enruta el tráfico de la víctima por tu interfaz con internet, para que naveguen con normalidad y no noten nada.'),
      hLi('4. Monitorización','tshark captura todo el tráfico (consultas DNS, SNI de TLS, peticiones HTTP) y lo registra para verlo en tiempo real.'),
      hLi('5. Deauth opcional','aireplay-ng deauth al AP legítimo para forzar a sus clientes a migrar a tu Evil Twin (mismo nombre, señal fuerte).'),
      hH2('Opciones'),
      hLi('Evil Twin simple','Solo el AP falso con forwarding a internet. Las víctimas navegan y todo su tráfico pasa por ti (DNS + SNI + HTTP visibles).'),
      hLi('+ Captive Portal','dnsmasq redirige TODAS las consultas DNS a tu máquina. Sirves una página de login falsa para cosechar credenciales.'),
      hLi('+ Deauth','Deauth simultáneo al AP legítimo para acelerar la migración de víctimas.'),
      hH('MITM'),
      hP('El módulo MITM intercepta tráfico de '+_b('dispositivos ya conectados')+' a una red (no controlas el AP, ellos sí). Usa '+_b('ARP spoofing')+' para redirigir el tráfico por tu máquina. Dos modos con compromisos muy distintos.'),
      hH2('🔇 Modo SIGILOSO — invisible'),
      hP('El tráfico pasa por tu máquina pero '+_b('nada se intercepta ni modifica')+' a nivel de aplicación. El HTTPS pasa intacto (sin avisos de certificado). Extraes inteligencia de las partes no cifradas:'),
      hLi('Consultas DNS','Cada dominio que resuelve el dispositivo (UDP 53). Revela cada web visitada y cada backend contactado.'),
      hLi('SNI de TLS','En el ClientHello de TLS, el hostname destino viaja en '+_b('texto plano')+' incluso para HTTPS. Revela el host exacto de cada conexión.'),
      hP(_b('Úsalo cuando')+': monitorizar sin alertar, mapear comportamiento, identificar servicios. La víctima no lo detecta (salvo un admin vigilando tablas ARP o latencia).'),
      hH2('🔓 Modo FULL — intercepción total de HTTPS'),
      hP('TODO el HTTPS se intercepta y descifra. mitmproxy actúa de proxy transparente que termina el TLS de la víctima, lee/modifica el contenido y reconecta al destino real. '+_b('Limitación crítica')+': genera un certificado firmado por la CA de mitmproxy que el dispositivo NO confía por defecto → '+_b('avisos de certificado')+' en cada web. En auditorías autorizadas se instala antes la CA de mitmproxy en el dispositivo víctima.'),
      hLi('Qué ves en modo full','HTTPS completo: cabeceras, cuerpos (incluidas credenciales POST), cookies, llamadas API, tokens JWT — todo.'),
      hH('Visor de flujos'),
      hP('Ambos modos alimentan un visor en tiempo real: tabla con hora, tipo (🔒 HTTPS / ⚠ HTTP / 📡 DNS), cliente, host, método y estado. Casilla para mostrar solo flujos con credenciales detectadas. Las filas con credenciales se resaltan en rojo.'),
      hBox('info','Qué modo MITM elegir',_b('Sigiloso')+': monitorización autorizada sin ser descubierto; muchos dispositivos. '+_b('Full')+': auditoría de un dispositivo concreto con CA preinstalada; capturar credenciales o tokens. '+_b('¿Solo comportamiento?')+' Usa Evil Twin (más simple, sin ARP spoofing).'),
      hReqs(['Evil Twin: 2 adaptadores WiFi (uno AP, otro monitor/deauth) O 1 adaptador + ethernet para uplink','MITM: acceso a la LAN objetivo (conectado como cliente)','MITM full: CA de mitmproxy instalada en el dispositivo víctima']),
    ].join('')},

    {id:'captures',t:'📁  Panel Capturas',b:()=>[
      hP('El panel Capturas es el '+_b('gestor centralizado')+' de todos los artefactos de tu auditoría: handshakes, hashes PMKID, capturas de paquetes, logs de flujos MITM y más. Cada herramienta que escribe salida la produce aquí en formatos estándar.'),
      hH('Tipos de fichero'),
      hTool('.cap / .pcap','Formato estándar de captura (libpcap). Tramas 802.11 en crudo. Producido por airodump-ng. Abrible con Wireshark, crackeable con aircrack-ng.'),
      hTool('.pcapng','Formato de nueva generación. Metadatos más ricos y timestamps de nanosegundos. Producido por hcxdumptool en capturas PMKID. Se convierte a .22000 con hcxpcapngtool.'),
      hTool('.22000','Formato de hash WPA moderno de hashcat (reemplaza al 2500). Un hash por línea con un PMKID o un handshake EAPOL. Se carga con -m 22000.'),
      hTool('.csv','Salida de airodump-ng. Lista de todos los APs vistos (BSSID, canal, cifrado, señal, ESSID...) seguida de los clientes. Legible y fácil de parsear.'),
      hTool('.jsonl','JSON Lines: un objeto JSON por línea. Usado por los módulos MITM para transmitir flujos capturados con todos sus metadatos.'),
      hTool('.json','Exportaciones de sesión: el informe estructurado del panel Sesiones. Metadatos, hallazgos, capturas y timestamps. Para archivo e informe.'),
      hH('Funciones'),
      hLi('Verificar','Analiza el fichero con aircrack-ng para confirmar si contiene handshake y/o PMKID válidos y cuántas redes. '+_b('Hazlo siempre antes de crackear')+' para no perder horas con una captura incompleta.'),
      hLi('Descargar','Copia local de cualquier fichero para respaldo o análisis externo.'),
      hLi('Eliminar','Libera espacio. Confirma antes de borrar.'),
      hBox('info','Estrategia de respaldo','Los ficheros críticos (handshakes, PMKIDs, credenciales) deberían '+_b('copiarse fuera de la máquina de auditoría')+' inmediatamente. Guarda respaldos cifrados en medios externos. El informe debería referenciarlos por checksum (SHA-256) para verificar integridad.'),
    ].join('')},

    {id:'sessions',t:'📋  Panel Sesiones y Hallazgos',b:()=>[
      hP('El panel Sesiones es el '+_b('motor de documentación e informes')+' de WFAudit. Cada engagement debería organizarse bajo una sesión que registre alcance, cronología, hallazgos y evidencias. Al final exportas la sesión como informe estructurado para el cliente.'),
      hH('Qué contiene una sesión'),
      hLi('Metadatos','Cliente, empresa, auditor, fechas, notas de alcance.'),
      hLi('Hallazgos','Issues descubiertos, cada uno con severidad, descripción, evidencia y recomendación.'),
      hLi('Capturas','Ficheros de evidencia vinculados a la sesión.'),
      hH('Sistema de hallazgos'),
      hP('Los hallazgos son las '+_b('salidas accionables')+' de tu auditoría. La estructura y consistencia son lo que distingue un informe profesional de un volcado de output crudo.'),
      hH2('Severidades'),
      hLi('Crítico',_d('Explotación inmediata, impacto alto')+' (red abierta, credenciales por defecto del router, WiFi crackeada de una red privilegiada).'),
      hLi('Alto',_w('Explotable con esfuerzo, impacto material')+' (WiFi con password débil observada, WPS vulnerable a reaver).'),
      hLi('Medio','Requiere condiciones, impacto moderado (WPA2-Enterprise con MSCHAPv2, WPA3 en modo transición con clientes).'),
      hLi('Bajo','Explotabilidad limitada, impacto menor (política de PIN WPS débil).'),
      hLi('Info','Observación sin impacto directo (APs detectados, análisis PNL, topología).'),
      hH2('Buenas prácticas'),
      hLi('Título','Descripción concisa (<80 car.). "Credenciales por defecto en el router" mejor que "el router tiene contraseñas débiles que deberían cambiarse".'),
      hLi('Descripción','Explicación técnica de qué se encontró y por qué es un problema. Incluye evidencia concreta: BSSIDs, ESSIDs, IPs, usuarios.'),
      hLi('Recomendación','Pasos concretos y accionables para remediar. Referencia estándares (NIST, OWASP, guía del fabricante) cuando aplique.'),
      hH('Hallazgo rápido desde el escáner'),
      hP('En el panel Escaneo WiFi, con una sesión activa, cada AP tiene un botón que '+_b('pre-rellena un hallazgo')+' con severidad, título, descripción y recomendación según la seguridad de la red (OPEN → crítico, WEP → alto...). Ahorra tiempo documentando en el momento.'),
      hBox('warn','Disciplina de documentación',_b('Documenta los hallazgos según los descubres')+', no al final. La memoria es poco fiable; detalles cruciales (MACs, señales, timing) se pierden fácil. Cada issue debería convertirse en hallazgo a los pocos minutos, aunque luego refines la descripción.'),
    ].join('')},

    {id:'system',t:'▣  Panel Sistema y Procesos',b:()=>[
      hP('El panel Sistema muestra información del host (hostname, SO, kernel, root, CPU, RAM, Python), el inventario completo de herramientas por categoría, una búsqueda OUL/fabricante y un '+_b('monitor en vivo de todos los subprocesos')+' del backend.'),
      hH('Monitor de procesos'),
      hP('Cada herramienta que ejecuta WFAudit (airodump-ng, hostapd, mitmdump, nmap, hashcat...) corre como subproceso gestionado. Se auto-refresca cada 5s.'),
      hLi('ID y comando','Identificador interno y la línea de comando completa con sus flags.'),
      hLi('Estado','Running / Completed / Failed / Cancelled.'),
      hLi('Inicio','Cuándo arrancó el proceso.'),
      hH('Cuándo usarlo'),
      hLi('Debug','Un escaneo o ataque no da resultados: comprueba si el proceso realmente corre.'),
      hLi('Cancelación','Un proceso largo (hashcat con una wordlist enorme) necesita pararse.'),
      hLi('Búsqueda OUI','Introduce una MAC para identificar el fabricante y saber si está aleatorizada.'),
      hBox('warn','Al matar procesos','Cuando matas un proceso directamente aquí, la capa de servicios puede no enterarse. Para módulos de ataque, '+_b('usa siempre el botón Stop del propio módulo primero')+' (que hace la limpieza: flush de iptables, restaurar ARP...). Mata directo solo como último recurso.'),
    ].join('')},

    {id:'tips',t:'💡  Consejos y errores comunes',b:()=>[
      hH('10 errores comunes'),
      hLi('1. Escanear solo 2.4 GHz','Perderías la mayoría de despliegues corporativos modernos. Usa banda "abg" salvo que tengas un motivo concreto.'),
      hLi('2. Empezar con deauth broadcast','Es más ruidoso y menos efectivo que el dirigido. Empieza con -c a un cliente concreto; escala a broadcast solo si necesitas mover todos a la vez.'),
      hLi('3. Handshake antes que PMKID','PMKID es más rápido, silencioso y no requiere clientes. Prueba PMKID primero.'),
      hLi('4. No validar el handshake antes de crackear','Un handshake incompleto es incrackeable. Verifícalo (botón Verificar en Capturas) antes de lanzar hashcat. No pierdas horas con una captura mala.'),
      hLi('5. Empezar con wordlists de 10.000 millones','Empieza con rockyou.txt (14M). ~70% de las passwords crackeadas salen de ahí. Escala solo si falla.'),
      hLi('6. Usar aircrack-ng teniendo GPU','aircrack-ng es solo CPU. Una GPU moderna es 100-1000x más rápida. Usa hashcat con GPU siempre que puedas.'),
      hLi('7. Olvidar restaurar el modo managed','Tras el engagement, vuelve a managed. Si no, tu sistema puede no reconectar a WiFi hasta reiniciar.'),
      hLi('8. MITM sin confirmar que mitmproxy corre','Si mitmproxy cae al arrancar, el ARP spoofing redirige tráfico pero nada lo captura → la víctima pierde conectividad. Comprueba siempre el estado tras iniciar.'),
      hLi('9. No cerrar los ataques limpiamente','Matar el backend directo (Ctrl+C) salta la limpieza: quedan reglas iptables, ARP envenenado, ip_forward activo. Usa siempre los botones Stop de la interfaz.'),
      hLi('10. No documentar en tiempo real','La memoria falla. Añade cada hallazgo según lo descubres.'),
      hH('Consejos'),
      hLi('La antena importa','Busca línea de visión con el objetivo. Muros y obstáculos pueden bajar 20-40 dB. Usa antenas direccionales para ataques a distancia.'),
      hLi('Varios adaptadores desbloquean escenarios','Uno en monitor + uno en managed + ethernet de uplink = Evil Twin completo con internet y deauth.'),
      hLi('Guarda el progreso del crack','hashcat tiene gestión de sesión: '+_c('--session=audit1 --restore')+' permite reanudar cracks interrumpidos.'),
      hH('Escalar vs. documentar'),
      hLi('Red abierta','Crítico — hallazgo inmediato. Todo el tráfico en claro. Prueba solo servicios permitidos por el alcance.'),
      hLi('WEP','Crítico — crackeable en minutos. Documéntalo sin llegar a crackear si es trivialmente roto en alcance.'),
      hLi('Credenciales por defecto del router','Crítico — documenta que funcionan, pero NO entres más allá de la verificación. Más requiere autorización explícita.'),
      hLi('WPA3-only (sin transición)','Positivo/Info — la organización lo ha hecho bien. Documéntalo positivamente: la seguridad moderna es rara y merece reconocerse.'),
    ].join('')},
  ];

  const toc=SECS.map(s=>'<button onclick="openHelp(\''+s.id+'\')">'+s.t+'</button>').join('');
  const acc=SECS.map(s=>'<div class="hacc" id="hacc-'+s.id+'"><div class="hacc-hd" onclick="toggleHelp(\''+s.id+'\')"><span class="hacc-t">'+s.t+'</span><span class="hacc-x">'+ic('play',13)+'</span></div><div class="hacc-bd">'+s.b()+'</div></div>').join('');
  setC('<div class="sup">'+
    '<div class="help-intro">'+ic('info',15)+' Documentación completa de WFAudit: cada panel, herramienta, flag y buena práctica. Pulsa cualquier sección para desplegarla. Cubre las <b>'+SECS.length+' áreas</b> de la plataforma. Toda la actividad se realiza <b>exclusivamente bajo autorización escrita</b>.</div>'+
    '<div class="help-toc">'+toc+'</div>'+acc+'</div>');
  if(_helpOpen){const el=document.getElementById('hacc-'+_helpOpen);if(el)el.classList.add('open');}
}
function toggleHelp(id){const el=document.getElementById('hacc-'+id);if(!el)return;const willOpen=!el.classList.contains('open');document.querySelectorAll('.hacc.open').forEach(e=>e.classList.remove('open'));if(willOpen){el.classList.add('open');_helpOpen=id;}else{_helpOpen=null;}}
function openHelp(id){document.querySelectorAll('.hacc.open').forEach(e=>e.classList.remove('open'));const el=document.getElementById('hacc-'+id);if(el){el.classList.add('open');_helpOpen=id;el.scrollIntoView({behavior:'smooth',block:'start'});}}
// ======== INIT ========
function showTip(el){const box=document.getElementById('tipbox');if(!box)return;const txt=el.getAttribute('data-tip');if(!txt)return;box.textContent=txt;box.classList.add('show');
  const r=el.getBoundingClientRect(),bw=box.offsetWidth,bh=box.offsetHeight,vw=window.innerWidth,vh=window.innerHeight,gap=9,m=8;
  const sb=document.getElementById('sidebar');
  const leftBound=Math.max(m,sb?Math.min(sb.getBoundingClientRect().right+4,vw-bw-m):m); // nunca por debajo del menú
  // Horizontal: al lado del ? (derecha por defecto; voltea a la izquierda si no cabe)
  let x;
  if(r.right+gap+bw+m<=vw)x=r.right+gap;
  else if(r.left-gap-bw>=leftBound)x=r.left-gap-bw;
  else x=Math.max(leftBound,Math.min(r.right+gap,vw-bw-m));
  // Vertical: centrado en el ?, acotado al viewport
  let y=Math.max(m+bh/2,Math.min(r.top+r.height/2,vh-m-bh/2));
  box.style.left=Math.round(x)+'px';box.style.top=Math.round(y)+'px';}
function hideTip(){const box=document.getElementById('tipbox');if(box)box.classList.remove('show');}

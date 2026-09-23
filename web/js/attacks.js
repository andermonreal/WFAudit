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
  <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:16px">${fmt.map(([f,l,plat])=>{const ex=certs[`mitmproxy-ca-cert.${f}`]?.exists;return `<div style="display:flex;align-items:center;gap:10px;padding:9px 11px;background:var(--bg3);border:1px solid var(--b0);border-radius:8px"><span class="badge ${ex?'b-g':'b-x'}">${f.toUpperCase()}</span><div style="flex:1;min-width:0"><div style="font-size:.78rem;font-weight:600">${l}</div><div style="font-size:.66rem;color:var(--t2)">${plat}</div></div>${ex?`<a class="btn btn-p btn-sm" href="${withTok(`${API}/attacks/mitm/ca-cert/download/${f}`)}" target="_blank" download>${ic('download',12)} Descargar</a>`:`<span class="badge b-x">no generado</span>`}</div>`;}).join('')}</div>
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
      {id:'use_doubling',    l:'Duplicar letras',    ex:'ander → aander, anderr',     d:'Duplica la primera y/o última letra',              def:false},
      {id:'use_stretching',  l:'Estirar',            ex:'ola → oolllaaa',             d:'Repite caracteres consecutivos (muy explosivo)',    def:false},
      {id:'use_reverse',     l:'Reverso',            ex:'empresa → aserpme',          d:'Invierte el orden de los caracteres',               def:false},
      {id:'use_palindrome',  l:'Palíndromo',         ex:'sol → sollos',               d:'Concatena la palabra con su reverso',               def:false},
      {id:'use_strip_accents',l:'Quitar acentos',    ex:'josé → jose',                d:'Añade la variante sin tildes ni ñ (clave en español)',def:true},
    ]},
    {grp:'Números',items:[
      {id:'use_numbers',     l:'Sufijos numéricos',  ex:'empresa → empresa123',       d:'Añade secuencias de números al final',              def:true},
      {id:'use_years',       l:'Años',               ex:'empresa → empresa2024',      d:'Añade años comunes: 2020, 2021 … 2030',            def:true},
      {id:'use_birth_years', l:'Años de nacimiento', ex:'empresa → empresa1985',      d:'Añade años típicos de nacimiento (1950-2030)',      def:true},
      {id:'use_wide_years',  l:'Años 1900–2050',     ex:'empresa → empresa1972',      d:'Rango amplio completo de años (1900 a 2050)',       def:false},
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
      {id:'add_spanish_names',l:'Nombres españoles', ex:'→ Juan, María, JoseMaria…',  d:'~450 nombres reales (incl. compuestos) + año/número',def:false},
      {id:'add_common_passwords',l:'Contraseñas comunes',ex:'→ 123456, password…',    d:'Añade las N contraseñas más usadas (xato/SecLists)',def:false},
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
      <div style="display:flex;gap:7px;flex-wrap:wrap"><button class="btn btn-gh btn-sm" onclick="doEstWL()">Estimar</button><button class="btn btn-gh btn-sm" onclick="doPrevWL()">Preview</button><button class="btn btn-g btn-sm" id="wl-gen-btn" style="margin-left:auto" onclick="doGenWL()">${ic('zap')} Generar</button></div>
      <div id="wl-est" style="margin-top:9px"></div>
    </div>
    <div class="card"><div class="ctitle">${ic('eye')} Vista previa / Resultado</div><div id="wl-prev" class="empty" style="padding:24px">${ic('zap',36)}<h3>Sin vista previa</h3><p>Pulsa Vista previa o Generar</p></div></div>
  </div>
  <div class="tc" id="wl-tc-1"><div class="card" style="margin-bottom:14px"><div class="ctitle">${ic('download')} Importar diccionarios comunes</div><div class="hint">${ic('info',11)}Copia listas famosas del sistema (SecLists/rockyou) a tu carpeta de wordlists para usarlas directamente al crackear.</div><div id="wl-common-lists" style="display:flex;flex-direction:column;gap:8px"><div style="color:var(--t2);font-size:.78rem"><div class="spin" style="display:inline-block"></div> Cargando…</div></div></div><div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:8px"><div class="ctitle" style="margin-bottom:0">${ic('download')} Wordlists Disponibles</div><button class="btn btn-gh btn-sm" onclick="wordlists()">${ic('refresh',12)} Actualizar</button></div><div style="font-size:.76rem;color:var(--t2);margin-bottom:12px">${wls.total||0} archivos · ${wls.total_size_human||'—'} · <span class="mono">${wls.directory||'—'}</span></div>
  ${!wlArr.length?`<div class="empty" style="padding:28px">${ic('download',36)}<h3>Sin wordlists</h3></div>`:`<div class="twrap"><table><thead><tr><th>Archivo</th><th>Líneas</th><th>Tamaño</th><th>Muestra</th><th>Modificado</th><th></th></tr></thead><tbody>${wlArr.map(w=>`<tr><td class="mono">${w.filename}</td><td class="mono"><strong>${(w.lines||0).toLocaleString()}</strong></td><td class="mono">${w.size_human||fb(w.size_bytes)}</td><td style="font-size:.68rem;color:var(--t2);font-family:'JetBrains Mono',monospace">${(w.sample_first||[]).slice(0,4).join(', ')}</td><td class="mono" style="font-size:.7rem;color:var(--t2)">${fd(w.modified_at)}</td><td><div style="display:flex;gap:4px"><a class="btn btn-gh btn-xs" href="${withTok(`${API}/wordlists/${w.filename}/download`)}" target="_blank">${ic('download',11)}</a><button class="btn btn-d btn-xs btn-ico" onclick="doDelWL('${w.filename}')">${ic('trash',11)}</button></div></td></tr>`).join('')}</tbody></table></div>`}</div></div>
  </div>`);
  restFP('wl-form');renderSeeds();
  // sincroniza el resaltado visual de las mutaciones con el estado restaurado
  document.querySelectorAll('#wl-form .mitem').forEach(m=>{const cb=m.querySelector('input[type=checkbox]');if(cb)m.classList.toggle('on',cb.checked);});
  loadCommonLists();}
async function loadCommonLists(){
  const el=document.getElementById('wl-common-lists');if(!el)return;
  try{
    const lists=await A.wlCommonLists();
    if(!lists||!lists.length){el.innerHTML='<span style="color:var(--t3);font-size:.76rem">Ninguno disponible en el sistema</span>';return;}
    el.innerHTML=lists.map(l=>`<div style="display:flex;align-items:center;gap:10px;padding:9px 11px;background:var(--bg0);border:1px solid var(--b0);border-radius:8px">
      <div style="flex:1;min-width:0"><div class="mono" style="font-size:.78rem;color:var(--t0)">${l.name}</div><div style="font-size:.66rem;color:var(--t2)">${l.size_bytes?fb(l.size_bytes):'—'}${l.imported?' · <span style="color:var(--g)">ya importado</span>':''}</div></div>
      ${l.available?`<button class="btn ${l.imported?'btn-gh':'btn-p'} btn-sm" onclick="wlImportBtn('${l.key}',this)">${l.imported?ic('refresh',12)+' Recopiar':ic('download',12)+' Importar'}</button>`:`<span class="badge b-x" style="font-size:.6rem">no en el sistema</span>`}
    </div>`).join('');
  }catch(e){el.innerHTML='<span style="color:var(--t3);font-size:.76rem">No disponible</span>';}
}
async function wlImportBtn(key,btn){
  const t=btn?btn.innerHTML:null;if(btn){btn.disabled=true;btn.innerHTML='<div class="spin"></div> Copiando…';}
  try{const r=await A.wlImportCommon(key);toast('Importado: '+r.filename+' ('+fb(r.size_bytes)+')','success');loadCommonLists();}
  catch(e){toast(e.message,'error');}
  if(btn){btn.disabled=false;btn.innerHTML=t;}
}
function togM(el,id){const cb=document.getElementById(id);if(cb){cb.checked=!cb.checked;el.classList.toggle('on',cb.checked);persistInput(cb);}}
function renderSeeds(){const box=document.getElementById('sbox');if(!box)return;const inp=document.getElementById('sinput');box.querySelectorAll('.stag').forEach(e=>e.remove());_seeds.forEach(s=>{const t=document.createElement('span');t.className='stag';t.innerHTML=`${s}<span class="stag-x" onclick="rmSeed('${s}')">×</span>`;box.insertBefore(t,inp);});if(inp)inp.placeholder=_seeds.length?'Añadir más...':'Escribe y pulsa Enter o usa comas...';}
function addSeed(w){w=w.trim();if(!w||_seeds.includes(w))return;_seeds.push(w);localStorage.setItem('wl-seeds',JSON.stringify(_seeds));renderSeeds();}
function rmSeed(w){_seeds=_seeds.filter(s=>s!==w);localStorage.setItem('wl-seeds',JSON.stringify(_seeds));renderSeeds();}
function hSK(e){if(e.key==='Enter'||e.key===','){e.preventDefault();const v=e.target.value.replace(/,/g,'').trim();if(v)addSeed(v);e.target.value='';}else if(e.key==='Backspace'&&!e.target.value.length&&_seeds.length){rmSeed(_seeds[_seeds.length-1]);}}
function hSI(e){if(e.target.value.includes(',')){const p=e.target.value.split(',');p.slice(0,-1).forEach(s=>{if(s.trim())addSeed(s);});e.target.value=p[p.length-1];}}
function addPaste(){const inp=document.getElementById('spaste');if(!inp?.value)return;inp.value.split(',').map(s=>s.trim()).filter(Boolean).forEach(addSeed);inp.value='';toast('Palabras añadidas','success');}
const WL_BOOL_IDS=['use_lowercase','use_uppercase','use_capitalize','use_alternating_case','use_leet','use_number_infix','use_doubling','use_stretching','use_reverse','use_palindrome','use_strip_accents','use_numbers','use_years','use_birth_years','use_wide_years','use_symbols','use_double_symbols','use_symbol_pairs','combine_words','combine_3_words','use_separators','use_reverse_combine','add_common_base','add_spanish_base','add_spanish_names','add_common_passwords'];
function getWLC(){const M={};WL_BOOL_IDS.forEach(k=>{const e=document.getElementById(k);M[k]=e?e.checked:false;});return{seed_words:_seeds,output_filename:document.getElementById('wl-name')?.value||'custom.txt',min_length:parseInt(document.getElementById('wl-min')?.value)||6,max_length:parseInt(document.getElementById('wl-max')?.value)||32,leet_intensity:document.getElementById('wl-leet')?.value||'medium',number_max_length:parseInt(document.getElementById('wl-numlen')?.value)||4,max_total:parseInt(document.getElementById('wl-maxtotal')?.value)||10000000,common_passwords_count:parseInt(document.getElementById('wl-cpwcount')?.value)||10000,...M};}
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
          <div style="display:flex;gap:5px;flex-wrap:wrap">${spread(s,12).map(w=>`<span class="kbd">${(''+w).replace(/</g,'&lt;')}</span>`).join('')}</div>
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
  let pf=null,info=null,procs=[],authSt=null;
  try{[pf,info,procs,authSt]=await Promise.all([A.preflight().catch(()=>null),A.info().catch(()=>null),A.procs().catch(()=>[]),A.authStatus().catch(()=>null)]);}catch{}
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
    <div class="tc active" id="sys-tc-0">${sysInfoHTML(sys,pf,authSt)}</div>
    <div class="tc" id="sys-tc-1"><div id="sys-procs">${sysProcsHTML(procs)}</div></div>
    <div class="tc" id="sys-tc-2">${sysToolsHTML(byC)}</div>
  </div>`);loadDataUsage();}
function sysInfoHTML(sys,pf,auth){
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
      <div class="card">
        <div class="ctitle">${ic('shield')} Seguridad / Acceso</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px">
          ${auth&&auth.require_auth?`<span class="badge b-g">🔒 Token requerido</span>`:`<span class="badge b-x">Sin token</span>`}
          ${(location.hostname==='localhost'||location.hostname==='127.0.0.1')?`<span class="badge b-c">Solo localhost</span>`:`<span class="badge b-y">Accesible en LAN</span>`}
          ${AUTH_TOKEN?`<span class="badge b-g">Sesión activa</span>`:''}
        </div>
        <div class="hint" style="margin-bottom:${AUTH_TOKEN?'9px':'0'}">${ic('info',11)}${auth&&auth.require_auth?'El backend exige token de acceso. Para exponerlo protegido en la red local: <b>sudo WFAUDIT_TOKEN=secreto ./wfaudit start</b>.':'El backend solo escucha en localhost (seguro por defecto). Arráncalo con <b>WFAUDIT_TOKEN</b> para exponerlo en la LAN protegido con token.'}</div>
        ${AUTH_TOKEN?`<div style="display:flex;gap:7px"><button class="btn btn-gh btn-sm" style="flex:1" onclick="promptToken(false)">${ic('key',12)} Cambiar token</button><button class="btn btn-d btn-sm" style="flex:1" onclick="clearToken()">Cerrar sesión</button></div>`:''}
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
  // Chips con las herramientas reales que WFAudit ejecuta por detrás en ese módulo
  const hStack=items=>'<div class="hstack"><span>⚙ Por detrás:</span>'+items.map(x=>'<code>'+x+'</code>').join('')+'</div>';
  // Pipeline de comandos (captura → conversión → crackeo, etc.)
  const hPipe=steps=>'<div class="hpipe">'+steps.map((s,i)=>'<span class="hpipe-s">'+s+'</span>'+(i<steps.length-1?'<span class="hpipe-a">→</span>':'')).join('')+'</div>';

  const SECS=[
    {id:'overview',t:'📖  ¿Qué es WFAudit?',b:()=>[
      hP('WFAudit es una '+_b('plataforma profesional de auditoría de seguridad WiFi')+' para pentesters y equipos de red team que realizan evaluaciones inalámbricas autorizadas. No reinventa los ataques: '+_b('orquesta las herramientas ofensivas estándar del sector')+' (aircrack-ng, hcxdumptool, hashcat, hostapd, dnsmasq, arpspoof, mitmproxy, nmap...) tras una API REST unificada y esta interfaz web, con visualización en tiempo real y gestión automática de estado, procesos y limpieza.'),
      hP('En lugar de memorizar decenas de invocaciones de línea de comandos y de encadenar ficheros a mano, cada panel te guía por un vector concreto, construye el comando exacto por ti (que además se muestra), lo lanza como '+_b('subproceso asíncrono cancelable')+' y parsea su salida en vivo.'),
      hH('Qué puedes hacer'),
      hLi('Reconocimiento RF','Escanear '+_a('2.4 GHz, 5 GHz o ambas bandas')+' a la vez; enumerar APs con seguridad, cifrado, canal, señal, fabricante (OUI), clientes y disponibilidad de PMKID; analizar las redes que buscan los clientes (PNL / probe requests).'),
      hLi('Ataques WPA/WPA2',_a('Captura de handshakes')+' con deauth dirigido o broadcast; '+_a('PMKID sin cliente')+'; honeypots AP-less contra objetivos fuera de su red; y crackeo offline por GPU (hashcat) o CPU (aircrack-ng).'),
      hLi('Enterprise y WPA3',_a('RADIUS/AP falso 802.1X')+' para cosechar credenciales PEAP/EAP-TTLS; detección de modo transición WPA2/WPA3 y ataques SAE (Dragonblood).'),
      hLi('Ataques de red',_a('Evil Twin')+' (AP falso con DHCP/DNS/NAT y monitor de tráfico integrado) y '+_a('MITM por ARP spoofing')+' con modo sigiloso (invisible) e intercepción total de HTTPS.'),
      hLi('Post-explotación',_a('Recon interno con nmap')+' (3 perfiles), mapa de red interactivo, auditoría de gateway.'),
      hLi('Diccionarios',_a('Generador de wordlists')+' a medida con decenas de mutaciones, importación de diccionarios de SecLists y estimación exacta previa.'),
      hLi('Informes',_a('Sesiones')+' con hallazgos por severidad, evidencia gráfica y exportación a '+_b('PDF')+'.'),
      hH('Arquitectura de tres capas'),
      hLi('API (FastAPI)','Backend Python que expone la API REST, valida entradas con pydantic y orquesta los subprocesos. Sirve la documentación OpenAPI en '+_c('/docs')+'.'),
      hLi('Servicios','Un servicio por vector ('+_c('aircrack_service')+', '+_c('pmkid_service')+', '+_c('evil_twin_service')+', '+_c('mitm_service')+', '+_c('enterprise_service')+', '+_c('apless_service')+', '+_c('wpa3_service')+', '+_c('recon_service')+', '+_c('wordlist_service')+'...) con la lógica de ataque y el ciclo de vida de sus procesos.'),
      hLi('Utilidades',_c('process_manager')+' (lanza, cancela, aplica timeouts y limpia subprocesos), parsers de salida, lookup OUI y más.'),
      hStack(['FastAPI','uvicorn','pydantic','asyncio']),
      hBox('success','Seguro por defecto','El backend escucha solo en '+_c('127.0.0.1')+' (localhost). No es accesible desde la red hasta que tú lo decides con un token. Ver la sección '+_b('Seguridad / Acceso')+'.'),
      hBox('info','Notificaciones','Los trabajos largos (escaneos, capturas, cracks, ataques) corren en segundo plano. Cuando terminan aparece un '+_b('aviso (toast)')+' aunque estés en otra pestaña — no tienes que quedarte mirando.'),
      hBox('danger','⚖️  Aviso legal','Uso '+_b('exclusivo para auditorías autorizadas')+' bajo contrato escrito. Atacar redes sin autorización es delito en casi todas las jurisdicciones (España: arts. 197 y 264 CP; UE: Directiva 2013/40/UE; EE.UU.: CFAA 18 U.S.C. §1030). Obtén autorización escrita, documenta el alcance y conserva la prueba. '+_b('Eres el único responsable del cumplimiento legal.')),
    ].join('')},

    {id:'install',t:'⬇  Instalación y arranque',b:()=>[
      hP('Toda la plataforma se controla con el script '+_c('./wfaudit')+' desde la raíz del proyecto. Prepara un entorno virtual de Python aislado, instala las dependencias del sistema y del backend, y gestiona el ciclo de vida de los dos servicios (API + interfaz web).'),
      hH('Comandos del script'),
      hTool('./wfaudit install','Instala TODO: crea el virtualenv, instala las dependencias Python (FastAPI, uvicorn, pydantic, reportlab...), instala los paquetes del sistema con el gestor de tu distro y descarga la base de datos de fabricantes (OUI) del IEEE. Ejecútalo una vez al principio.',[['apt/dnf/pacman','Detecta tu gestor de paquetes'],['python -m venv','Crea el entorno aislado en .venv'],['OUI DB','Descarga oui.txt del IEEE para el lookup de fabricante']]),
      hTool('sudo ./wfaudit start','Arranca el backend (uvicorn) y la interfaz web. Requiere root: el modo monitor, los sockets raw, iptables y hostapd lo exigen. Espera a que el backend responda en /system/health antes de dar el OK.'),
      hTool('sudo ./wfaudit stop','Para ambos servicios con parada grácil: uvicorn ejecuta su limpieza (mata subprocesos, restaura iptables) antes de salir.'),
      hTool('./wfaudit status','Muestra si el backend y la web están arriba, sus PIDs, y consulta el estado de ataques MITM / Evil Twin en marcha.'),
      hTool('./wfaudit logs','Sigue en vivo los logs del backend y de la interfaz web (útil para depurar un arranque fallido).'),
      hTool('sudo ./wfaudit restart','stop + start. Útil tras cambiar configuración o variables de entorno.'),
      hH('Dependencias del sistema que instala'),
      hStack(['aircrack-ng','hcxdumptool','hcxtools','hashcat','hostapd','dnsmasq','dsniff','freeradius','nmap','mitmproxy','tshark','macchanger','seclists','wordlists']),
      hP('Los paquetes '+_b('seclists')+' y '+_b('wordlists')+' aportan diccionarios enormes (rockyou, xato-net...) que luego puedes importar desde el panel Wordlists para crackear.'),
      hH('Puertos y acceso'),
      hLi('Backend / API',_c('http://localhost:8000')+' — la API REST y su documentación Swagger en '+_c('/docs')+'.'),
      hLi('Interfaz web',_c('http://localhost:8080/')+' — esta interfaz (HTML/CSS/JS servida con un http.server sencillo, sin build).'),
      hBox('info','Exposición en la red','Por defecto ambos servicios escuchan solo en localhost. Para abrirlos a la LAN de forma protegida, arranca con un token: '+_c('sudo WFAUDIT_TOKEN=tu-secreto ./wfaudit start')+'. Ver '+_b('Seguridad / Acceso')+'.'),
      hReqs(['Linux con systemd o gestor apt/dnf/pacman','Python 3.11+','Privilegios root para start','Conexión a internet para la instalación inicial']),
    ].join('')},

    {id:'security',t:'🛡  Seguridad / Acceso',b:()=>[
      hP('WFAudit es una herramienta ofensiva que corre como '+_b('root')+' y controla tus interfaces, iptables y subprocesos. Exponerla sin protección en una red sería regalar ese poder a cualquiera. Por eso el modelo de acceso es '+_b('seguro por defecto y expansible bajo demanda')+'.'),
      hH('Modo por defecto — solo localhost'),
      hP('Sin configuración, el backend y la interfaz se enlazan a '+_c('127.0.0.1')+'. Solo la propia máquina puede hablar con la API; no hay superficie de ataque en la red y no hace falta contraseña. Es lo recomendado si trabajas en tu propio equipo.'),
      hH('Modo LAN protegido — con token'),
      hP('Si necesitas usar la interfaz desde otro dispositivo (un móvil, un portátil en la misma red), arranca con la variable '+_c('WFAUDIT_TOKEN')+':'),
      hPipe(['WFAUDIT_TOKEN=secreto','bind 0.0.0.0','exige token en cada petición']),
      hP('Definir el token hace dos cosas a la vez: '+_b('expone el servicio en la LAN')+' (bind 0.0.0.0) y '+_b('activa la autenticación')+' (el backend rechaza con 401 toda petición sin el token correcto). Sin token no hay exposición; con token no hay exposición sin protección.'),
      hH('Cómo se envía el token'),
      hLi('Authorization: Bearer','El método principal. La interfaz web lo añade automáticamente a cada llamada a la API.'),
      hLi('X-API-Key','Cabecera alternativa, cómoda para scripts y curl.'),
      hLi('?token=…','Por query string. Necesario para recursos que van directos al DOM (imágenes de evidencia, PDF, descargas de wordlists o del certificado CA) donde el navegador no puede poner cabeceras.'),
      hH('Rutas sin autenticación'),
      hP('Solo tres rutas quedan exentas para que el arranque y el login funcionen: '+_c('/system/health')+' (sonda de vida), '+_c('/system/auth-status')+' (para que la interfaz sepa si debe pedir token '+_b('antes')+' de tenerlo) y '+_c('/docs')+' (la documentación de la API). Todo lo demás exige el token.'),
      hH('En la interfaz'),
      hLi('Petición de token','Al abrir la web contra un backend protegido, aparece un diálogo pidiendo el token. Se guarda en el navegador (localStorage) y se reutiliza; ante un 401 se vuelve a pedir.'),
      hLi('Panel Sistema','La tarjeta '+_b('Seguridad / Acceso')+' muestra si hay token requerido, si accedes por localhost o LAN, y permite '+_b('cambiar el token')+' o '+_b('cerrar sesión')+'.'),
      hStack(['FastAPI middleware','CORS','localStorage','Bearer token']),
      hBox('info','Por qué CORS envuelve la autenticación','El middleware de auth se coloca por dentro del de CORS, de modo que incluso una respuesta 401 lleva cabeceras CORS. Si no, el navegador vería un error de CORS opaco en lugar del 401 y no podría pedirte el token.'),
      hBox('warn','El token es la única barrera','Elige un token largo y aleatorio (no "1234"). Cualquiera en la red con el token tiene control total del backend root. Y recuerda: exponer en LAN sin token deja la API abierta a toda la red.'),
      hReqs(['Para LAN: arrancar con WFAUDIT_TOKEN definido','Token robusto (largo y aleatorio)','Red de confianza aunque uses token']),
    ].join('')},

    {id:'workflow',t:'🗺  Flujo de trabajo recomendado',b:()=>[
      hP('Una auditoría WiFi bien ejecutada sigue una progresión estructurada: reconocimiento → explotación → post-acceso → documentación. Este orden maximiza la información obtenida minimizando ruido, riesgo de detección y acciones irreversibles en fases tempranas.'),
      hH('Fase 1 — Preparación'),
      hStep('1','Chequeo del sistema','Dashboard: verifica que el backend corre como root y que las herramientas críticas están instaladas (preflight). Resuelve dependencias antes de seguir.'),
      hStep('2','Crear sesión','Sesiones → Nueva. Documenta cliente, alcance, activos autorizados y fechas. Todos los hallazgos se vinculan a ella para el informe.'),
      hStep('3','Preparar el adaptador','Interfaces: identifica tus tarjetas, comprueba soporte de monitor e inyección, y crea el modo monitor. Opcional: aleatoriza la MAC.'),
      hH('Fase 2 — Reconocimiento pasivo'),
      hStep('4','Escaneo dual-band','Escaneo WiFi 60-120s en "abg" para captar 2.4 y 5 GHz a la vez. Solo 2.4 GHz te haría perder la mayoría de redes corporativas.'),
      hStep('5','Analizar clientes y PNL','Revisa qué redes busca cada cliente. Esas probe requests revelan redes domésticas y candidatas a Evil Twin / AP-less.'),
      hStep('6','Priorizar','Abiertas (trivial) → WEP (crítico) → WPS → APs con PMKID disponible → Enterprise (credenciales).'),
      hH('Fase 3 — Extracción de credenciales'),
      hStep('7','PMKID primero','Avanzado → PMKID. Rápido (30-60s), sin cliente y silencioso. ~70-80% de APs modernos son vulnerables.'),
      hStep('8','Handshake de respaldo','Si PMKID falla y hay clientes, captura el handshake con deauth dirigido (no broadcast).'),
      hStep('9','Crackeo offline','Convierte y crackea con hashcat -m 22000 (GPU). Empieza por rockyou.txt o una wordlist a medida (panel Wordlists).'),
      hH('Fase 4 — Ataques de red'),
      hStep('10','Evil Twin','Ataques → Evil Twin. Clona una red, deauth al AP legítimo para migrar clientes. El monitor de tráfico integrado captura DNS/SNI/HTTP.'),
      hStep('11','Enterprise','Si hay 802.1X en alcance, Avanzado → Enterprise levanta un AP/RADIUS falso para capturar retos MSCHAPv2 (hashcat -m 5500).'),
      hStep('12','MITM','Ya en la red, Ataques → MITM. Modo sigiloso para observar sin alertar; modo full (con CA instalada) para ver HTTPS completo.'),
      hH('Fase 5 — Reconocimiento interno'),
      hStep('13','Descubrir hosts','Recon → discover del rango, luego service scan de los interesantes. Evita full scans de /24 salvo que esté en alcance.'),
      hStep('14','Auditar el gateway','Escanea el router: credenciales por defecto, CVEs del modelo, interfaces de administración expuestas.'),
      hH('Fase 6 — Cierre'),
      hStep('15','Registrar hallazgos','Sesiones → Añadir hallazgo con severidad, evidencia y recomendación. En tiempo real, no de memoria.'),
      hStep('16','Parar ataques','Detén cada módulo con su botón Stop: eso limpia iptables, restaura ARP e ip_forward y mata procesos.'),
      hStep('17','Restaurar interfaces','Interfaces → Managed en todas las monitor. Si no, tu sistema queda alterado hasta reiniciar.'),
      hStep('18','Exportar informe','Sesiones → PDF. Guarda hallazgos, evidencias y metadatos por motivos contractuales y legales.'),
      hBox('info','Orientación temporal','Pyme (1-3 APs, un edificio): '+_b('4-8 h')+'. Corporativo con varias sedes y post-acceso: '+_b('3-5 días')+' o más. Reserva un 25-30% del tiempo para documentación.'),
    ].join('')},

    {id:'dashboard',t:'◉  Panel Dashboard',b:()=>[
      hP('El Dashboard es la '+_b('primera pantalla')+' y el indicador de salud de la plataforma: resumen del sistema, verificación de dependencias (preflight) y cualquier problema que impediría que los ataques funcionen.'),
      hH('Qué muestra'),
      hLi('Sistema','Hostname, SO, cores y si el backend corre como root. '+_b('Root es innegociable')+' para sockets raw, iptables y modo monitor. En rojo = no puedes continuar.'),
      hLi('Herramientas','Instaladas vs. requeridas, con barra de progreso. Los críticos faltantes en rojo.'),
      hLi('Sesiones y procesos','Sesiones activas y subprocesos en ejecución en vivo (pulsa para ver/cancelar).'),
      hLi('Accesos rápidos','Atajos a los flujos principales.'),
      hH('Herramientas críticas y para qué sirven'),
      hTool('aircrack-ng (suite)','El núcleo WPA/WEP. Aporta airodump-ng (escáner/sniffer), aireplay-ng (inyección/deauth), airmon-ng (modo monitor) y aircrack-ng (crackeo por CPU).'),
      hTool('hcxdumptool + hcxtools','Captura moderna de PMKID (hcxdumptool) y conversión de .pcapng al formato .22000 de hashcat (hcxpcapngtool). Imprescindibles para el ataque PMKID.'),
      hTool('hashcat','Motor de cracking por GPU, 300+ tipos de hash. 500.000-5.000.000+ intentos WPA/s en GPU moderna frente a 500-5.000/s en CPU.'),
      hTool('hostapd','Convierte un adaptador en un AP real. Base de Evil Twin, honeypot AP-less, Enterprise y WPA3.'),
      hTool('dnsmasq','Servidor DHCP/DNS ligero. En Evil Twin asigna IPs y resuelve (o redirige) DNS.'),
      hTool('nmap','Mapeador de red: puertos, versiones, SO y scripts NSE de vulnerabilidades. Motor del panel Recon.'),
      hTool('mitmproxy (mitmdump)','Proxy HTTP/HTTPS transparente con scripting Python. Intercepta y descifra (con CA) el tráfico web en el MITM full.'),
      hTool('dsniff (arpspoof)','arpspoof envenena la caché ARP del objetivo y del gateway para redirigir su tráfico por tu máquina.'),
      hTool('tshark','Wireshark por CLI. En modo sigiloso extrae DNS y SNI de TLS pasivamente sin romper HTTPS.'),
      hTool('freeradius / hostapd-wpe','Autenticación 802.1X falsa para cosechar credenciales Enterprise.'),
      hTool('macchanger','Cambia la MAC del adaptador para anonimato o para saltar filtros.'),
      hReqs(['Backend como root (euid == 0)','Al menos una interfaz WiFi con monitor e inyección','Herramientas críticas instaladas (usa ./wfaudit install)']),
    ].join('')},

    {id:'interfaces',t:'⚡  Panel Interfaces',b:()=>[
      hP('Gestiona los '+_b('adaptadores inalámbricos')+'. Todo ataque necesita el adaptador en el modo correcto (monitor o managed), en el canal correcto y a veces con una MAC concreta.'),
      hH('Qué muestra'),
      hLi('Nombre y MAC','Nombre del kernel ('+_c('wlan0')+', '+_c('wlan0mon')+') y la MAC hardware o falsificada.'),
      hLi('Modo',_a('managed')+' (cliente normal) o '+_a('monitor')+' (promiscuo: ve todas las tramas 802.11 del entorno).'),
      hLi('Driver y chipset','ath9k_htc, rtl8812au, mt76... El chipset determina las capacidades: algunos hacen monitor pero no inyección.'),
      hLi('Capacidades','Soporte de monitor, inyección, modo AP y 5 GHz (leídos de '+_c('iw list')+').'),
      hH('Cómo crea el modo monitor (y por qué NO tira tu red)'),
      hP('Muchas guías dicen '+_c('airmon-ng check kill')+', que mata NetworkManager y wpa_supplicant '+_b('globalmente')+' — tumbando tu ethernet y el resto de adaptadores. WFAudit es quirúrgico: solo desasocia la interfaz objetivo.'),
      hPipe(['nmcli set managed no (solo esa iface)','kill wpa_supplicant de esa iface','ip link down','iw set monitor control','ip link up']),
      hStack(['iw','ip','nmcli','airmon-ng','iwconfig']),
      hP('Si '+_c('iw set monitor control')+' falla, reintenta con '+_c('iw dev set type monitor')+' y, como último recurso, con '+_c('airmon-ng start')+'. Volver a managed revierte el proceso y reactiva la gestión de red de esa interfaz.'),
      hH('Otras operaciones'),
      hTool('Cambio de MAC','Baja la interfaz, cambia la MAC con macchanger y la vuelve a subir. Para anonimato o saltar filtros MAC.',[['macchanger -m <MAC>','Fija una MAC concreta'],['macchanger -r','MAC totalmente aleatoria']]),
      hTool('TX Power','Ajusta la potencia (dBm). Más potencia = más alcance pero más detectable. El máximo depende del dominio regulatorio.'),
      hH('Chipsets recomendados'),
      hLi('Atheros AR9271',_a('Referencia')+' 2.4 GHz (ath9k_htc). Excelente inyección. Alfa AWUS036NHA, TL-WN722N v1.'),
      hLi('Realtek RTL8812AU','Dual-band con buena inyección. Alfa AWUS036ACH. Driver externo en algunos kernels.'),
      hLi('MediaTek MT7612U','Dual-band moderno con buen soporte Linux. Alfa AWUS036ACM.'),
      hBox('warn','Evita','TL-WN722N v2/v3 (pasó a Realtek RTL8188EUS, mala inyección); Intel integrados (iwlwifi bloquea inyección); la mayoría de Broadcom.'),
      hBox('info','Prueba la inyección','En monitor, ejecuta '+_c('aireplay-ng --test wlan0mon')+'. Si dice "Injection is working!" estás listo.'),
      hReqs(['Adaptador con monitor e inyección','Root','iw, iwconfig, macchanger, airmon-ng instalados']),
    ].join('')},

    {id:'scanner',t:'◈  Panel Escaneo WiFi',b:()=>[
      hP('El escáner es el '+_b('punto de partida de toda auditoría')+'. Pone el adaptador en monitor y captura pasivamente todas las tramas 802.11, parseándolas en vivo para extraer APs, su configuración, sus clientes y las probe requests. Al ser '+_b('puramente pasivo')+', eres invisible.'),
      hStack(['airodump-ng','airmon-ng']),
      hP('El escaneo corre '+_b('en segundo plano')+': la tabla se va rellenando con resultados parciales mientras dura (no esperas a que acabe), y puedes detenerlo cuando quieras con el botón Stop (que mata el airodump-ng real por su proc_id).'),
      hH('Selección de banda'),
      hTool('2.4 GHz (bg)','Canales 1-13. Rápido (30-60s). Redes B/G/N heredadas, routers domésticos e IoT. No solapados: 1, 6 y 11.'),
      hTool('5 GHz (a)','Canales 36+. Redes corporativas y modernas. Menos interferencia, menor alcance. Incluye canales DFS.'),
      hTool('Dual-band (abg)','Ambas bandas a la vez. Recomendado: imagen completa del entorno. Requiere adaptador dual-band.'),
      hH('Entender los resultados'),
      hLi('BSSID / ESSID','MAC del AP y nombre de red. El ESSID puede estar oculto (0 bytes) y descubrirse por las probe responses.'),
      hLi('Canal','Canal RF del AP. Tu adaptador debe estar en él para capturar su tráfico.'),
      hLi('Señal (PWR)','dBm, siempre negativa (más cerca de 0 = más fuerte). -30 muy cerca, -70 lejos, -90 apenas. Para atacar, quieres -70 o mejor.'),
      hLi('Cifrado',_w('OPN')+' (sin seguridad), '+_d('WEP')+' (roto), '+_w('WPA/WPA2-PSK')+', '+_a('WPA2-MGT')+' (Enterprise), '+_a('WPA3-SAE')+'.'),
      hLi('PMKID','Si el AP incluye PMKID en su M1 → vulnerable al ataque sin cliente (panel Avanzado).'),
      hLi('WPS','Wi-Fi Protected Setup activo → atacable con Pixie-Dust o fuerza bruta de PIN. Cada AP con WPS lleva un botón directo al ataque (ver panel Avanzado → WPS).'),
      hLi('Fabricante','Por OUI (primeros 3 bytes del BSSID). Útil para detectar modelos con CVEs conocidos.'),
      hH('Clientes, PNL y marcado'),
      hP('Pulsa un AP para ver (o el botón «mostrar clientes») los '+_b('dispositivos asociados')+'. Los clientes sin conectar emiten '+_b('probe requests')+' buscando redes conocidas: su PNL revela redes domésticas/oficina y candidatas a Evil Twin (redes buscadas que NADIE emite cerca).'),
      hLi('MAC aleatorizada','iOS 14+ y Android 10+ aleatorizan la MAC en las probes; el panel las marca (bit local activado).'),
      hLi('Marcar objetivos','Puedes '+_b('resaltar filas de AP')+' como objetivos; la marca se recuerda entre pestañas.'),
      hLi('Hallazgo rápido','Con una sesión activa, cada AP tiene un botón que pre-rellena un hallazgo según su seguridad (OPEN → crítico, WEP → alto...).'),
      hBox('info','Duración',_b('30s')+' rápido · '+_b('60-120s')+' equilibrado (recomendado) · '+_b('300s+')+' redes ocultas y señales débiles · '+_b('600s+')+' probes raras.'),
      hReqs(['Adaptador en monitor (automático si hace falta)','Soporte de la(s) banda(s) objetivo','Root']),
    ].join('')},

    {id:'handshake',t:'◎  Panel Handshake / Crack',b:()=>[
      hP('El '+_b('ataque clásico contra WPA/WPA2-Personal')+': capturar el handshake de 4 vías y luego atacar el hash offline por diccionario para recuperar la passphrase. Funciona contra casi el 100% de redes WPA/WPA2-PSK con al menos un cliente.'),
      hH('El handshake de 4 vías (EAPOL)'),
      hP('Al conectarse un cliente, negocia con el AP claves de sesión derivadas de la PSK en 4 mensajes EAPOL:'),
      hLi('M1 (AP→Cliente)','El AP envía ANonce. Aquí es donde un AP vulnerable incluye el '+_b('PMKID')+'.'),
      hLi('M2 (Cliente→AP)','El cliente envía SNonce + MIC calculado desde la PTK.'),
      hLi('M3 / M4','El AP instala la clave; el cliente confirma.'),
      hP(_b('La debilidad')+': los MIC de M2/M3 se verifican offline contra cada passphrase candidata. Se calcula el MIC que '+_b('debería')+' dar cada candidata y se compara con el capturado.'),
      hH('Fase 1 — Captura'),
      hPipe(['airodump-ng (-c canal, --bssid)','aireplay-ng --deauth','handshake M2+M3 en el .cap']),
      hStack(['airodump-ng','aireplay-ng','aircrack-ng (verificación)']),
      hTool('airodump-ng','Bloqueado al canal del AP, escribe todas las tramas a un .cap. Debe capturar al menos M2 y M3.',[['-c <canal>','Bloqueo al canal (debe coincidir con el AP)'],['--bssid <MAC>','Filtra al AP concreto'],['-w <prefijo>','Ficheros de salida']]),
      hTool('aireplay-ng (deauth)','Desautentica al cliente para forzar su reconexión (y con ella el handshake).',[['--deauth <N>','N paquetes (5-50 típico)'],['-a <AP>','AP objetivo'],['-c <cliente>','Cliente concreto (dirigido: menos ruidoso)']]),
      hH('Estrategias de deauth'),
      hLi('Dirigido (recomendado)','Con '+_c('-c <cliente>')+': solo ese se desconecta, reconecta rápido, handshake limpio, menos detectable.'),
      hLi('Broadcast','Sin '+_c('-c')+': todos a la vez. Más intentos pero más colisiones y más visible.'),
      hBox('warn','Cuándo falla',_b('802.11w (PMF)')+' autentica las tramas de management y anula el deauth. El '+_b('roaming')+' puede mover al cliente de canal. Si no capturas tras varios intentos → PMKID.'),
      hH('Fase 2 — Crackeo'),
      hP('Cada candidata requiere PBKDF2 con 4096 iteraciones de HMAC-SHA1 → costoso, pero paraleliza perfecto en GPU.'),
      hPipe(['(.cap → .22000 con hcxpcapngtool)','hashcat -m 22000 -a 0 <hash> <wordlist>']),
      hTool('aircrack-ng','Crackeo por CPU. Simple pero lento (500-5.000 pass/s por core). Agotar rockyou.txt puede llevar horas.',[['-w <wordlist>','Diccionario'],['-b <BSSID>','AP objetivo si hay varios']]),
      hTool('hashcat (modo 22000)','Crackeo por GPU, muchísimo más rápido. El modo 22000 maneja PMKID y handshakes EAPOL.',[['-m 22000','WPA-PBKDF2-PMKID+EAPOL'],['-a 0','Diccionario directo'],['-a 3 ?d?d?d?d?d?d?d?d','Máscara (ej. 8 dígitos)'],['-r rules/best64.rule','Reglas de variación']]),
      hH('Estrategia de wordlist'),
      hLi('rockyou.txt (14M)','El punto de partida. Impórtalo desde el panel Wordlists.'),
      hLi('A medida','Genera una wordlist dirigida con datos del objetivo (panel Wordlists): nombre de empresa, fechas, palabras clave.'),
      hLi('Máscaras','Para patrones sospechados: teléfonos (10 dígitos), fechas (8 dígitos), etc.'),
      hReqs(['Handshake de 4 vías o PMKID capturado','Wordlist (rockyou.txt mínimo)','hashcat + GPU para velocidad (o aircrack-ng por CPU)']),
    ].join('')},

    {id:'wordlists',t:'📖  Panel Wordlists (Diccionarios)',b:()=>[
      hP('El crackeo solo es tan bueno como tu diccionario. Este panel '+_b('genera wordlists a medida')+' a partir de datos del objetivo (nombre, empresa, fechas, mascota...) aplicando decenas de mutaciones que imitan cómo la gente construye contraseñas reales, y también '+_b('importa diccionarios masivos')+' del sistema.'),
      hStack(['Generador propio (Python)','SecLists','rockyou','hashcat -m 22000']),
      hH('Semillas (seeds)'),
      hP('Introduces una o varias '+_b('semillas')+': las palabras base con significado para el objetivo (nombre de la empresa, del titular, de la pareja, fechas señaladas, ciudad, equipo...). Cada semilla se expande en cientos o miles de variantes.'),
      hH('Tipos de mutación'),
      hLi('Leetspeak','Sustituciones a→4, e→3, i→1, o→0, s→5... en intensidad baja / media / alta (más sustituciones y combinaciones).'),
      hLi('Mayúsculas/minúsculas','minúsculas, MAYÚSCULAS, Capitalizada y '+_b('alternada')+' (cUcHaRa).'),
      hLi('Repetición de letras','Duplica/estira letras (ej. estirar y alargar caracteres).'),
      hLi('Palíndromo e inverso','La palabra al revés y capicúa.'),
      hLi('Combinaciones','Une semillas entre sí, con repetición (anderander), leet sobre la combinación, combinación inversa y '+_b('año intercalado')+' entre dos palabras.'),
      hLi('Números y símbolos','Añade sufijos numéricos (hasta N dígitos), símbolos y dobles símbolos al principio/final.'),
      hLi('Años',_b('Años de nacimiento')+', años recientes y el rango '+_b('amplio 1900–2050')+' completo.'),
      hLi('Semilla + año + símbolo','El patrón más humano: base + año + símbolo → '+_c('cuchara2023!')+', '+_c('Madrid2010#')+'.'),
      hLi('Sin acentos','Normaliza tildes y ñ (josé→jose, ñ→n) para cubrir cómo se teclean de verdad.'),
      hLi('Nombres y base española','Inyecta un catálogo de +450 nombres españoles (masculinos, femeninos, diminutivos y compuestos como josemaria, mariacarmen) y bases comunes.'),
      hLi('Contraseñas comunes','Añade las top-N contraseñas más usadas (10.000 por defecto) desde SecLists o una lista integrada de reserva.'),
      hH('Importar diccionarios de SecLists'),
      hP('Con botones de un clic copias a tu carpeta de wordlists (listos para crackear) los grandes diccionarios del sistema:'),
      hLi('xato-net 100k','Las 100.000 contraseñas más comunes (equilibrio tamaño/cobertura).'),
      hLi('xato-net 10M','El diccionario masivo de 10 millones (cobertura máxima).'),
      hLi('rockyou','El clásico de 14M filtrado de brechas reales.'),
      hLi('10k-most-common','Ultrarrápido para un primer barrido.'),
      hH('Estimación, preview y generación'),
      hLi('Estimación exacta','Antes de generar, un '+_b('recuento en seco')+' (dry-run real, sin escribir a disco) te dice cuántas líneas producirá exactamente tu configuración. Nada de fórmulas aproximadas.'),
      hLi('Preview variado','Muestra ejemplos reales y '+_b('variados')+' por categoría, para que veas qué producirá cada mutación antes de lanzarla.'),
      hLi('Barra de progreso','La generación de listas enormes muestra progreso en vivo y corre en segundo plano (te avisa al terminar).'),
      hLi('Persistencia','Tu configuración de semillas y opciones se recuerda entre pestañas.'),
      hStack(['unicodedata','PBKDF2 (indirecto vía hashcat)','dedup por conjunto']),
      hBox('info','Cómo pensar la wordlist','Una lista dirigida de 50.000-2.000.000 con datos reales del objetivo suele romper más rápido que 10M genéricas. Empieza dirigida + rockyou; escala a xato-10M solo si hace falta. El generador deduplica automáticamente, así que no repites trabajo.'),
      hReqs(['Semillas relevantes del objetivo','Espacio en disco para listas grandes','seclists/wordlists instalados para importar (./wfaudit install)']),
    ].join('')},

    {id:'advanced',t:'⬡  Panel Avanzado',b:()=>[
      hP('Cinco vectores especializados más allá del handshake clásico. Cada uno ataca una clase concreta de despliegue con prerrequisitos distintos: '+_b('PMKID, AP-Less, Enterprise, WPA3 y WPS')+'.'),

      hH('PMKID — WPA/WPA2 sin cliente'),
      hP('Descubierto por Jens Steube (autor de hashcat) en 2018. Extrae el PMKID que el AP incluye en su primer mensaje (M1), '+_b('sin necesidad de ningún cliente conectado')+'. Permite atacar APs vacíos.'),
      hP(_c('PMKID = HMAC-SHA1-128(PMK, "PMK Name" || MAC_AP || MAC_STA)')+'. Como la PMK deriva de la passphrase por PBKDF2, atacar el PMKID equivale a atacar el handshake completo, pero con una sola trama del AP.'),
      hPipe(['hcxdumptool --enable_status 3 -o .pcapng','hcxpcapngtool -o .22000','hashcat -m 22000 (o aircrack-ng)']),
      hStack(['hcxdumptool','hcxpcapngtool','hashcat','aircrack-ng (fallback)']),
      hTool('hcxdumptool','Solicita activamente el M1 al AP y guarda la captura. Mucho más rápido que esperar pasivamente.',[['-i <iface>','Interfaz en monitor'],['-c <canal>','Bloqueo al canal'],['--enable_status 3','Salida con detección de PMKID']]),
      hP(_b('Vulnerabilidad')+' ~70-80% de APs de consumo post-2015. '+_b('Ventajas')+': sin clientes, sin deauth (silencioso), captura rápida (30-60s), una sola trama basta. Si hcxdumptool no está, airodump-ng también puede captar PMKID como respaldo.'),

      hH('AP-Less — honeypot de SSID (estilo KARMA)'),
      hP('Ataca al dispositivo cuando su red habitual '+_b('no está cerca')+' (p. ej. auditar a un directivo en un hotel). En vez de atacar un AP, explotas el '+_b('auto-connect')+' del cliente: creas un AP falso con el ESSID exacto que el cliente lleva en su PNL.'),
      hP(_b('La clave criptográfica')+': PMK = PBKDF2(passphrase, '+_b('SSID')+'). El dispositivo calcula la PMK con su passphrase REAL guardada y el SSID (que coincide con tu AP falso). Aunque tu AP tenga otra contraseña y la conexión falle, el handshake parcial captado sirve para crackeo offline.'),
      hStack(['hostapd (AP falso)','airodump-ng (captura)','2 adaptadores']),
      hP(_b('Requiere DOS adaptadores')+': uno en managed corriendo '+_c('hostapd')+' como AP falso con el ESSID objetivo, y otro en monitor corriendo '+_c('airodump-ng')+' para capturar el handshake que provoca el intento de conexión.'),
      hBox('warn','Limitaciones','Solo WPA/WPA2-PSK. Las MACs aleatorizadas modernas reducen el éxito. No funciona contra WPA3-SAE.'),

      hH('Enterprise — WPA2-Enterprise / 802.1X'),
      hP('Enterprise sustituye la clave compartida por autenticación individual vía RADIUS. Variantes: '+_b('EAP-PEAP')+' (MSCHAPv2 en túnel TLS), '+_b('EAP-TTLS')+', y '+_b('EAP-TLS')+' (certificado mutuo, seguro).'),
      hP('El ataque: levantar un '+_b('AP Enterprise falso con RADIUS falso')+' y un certificado genérico. Al intentar autenticarse, los clientes envían su usuario (en claro) y el reto/respuesta MSCHAPv2 a tu servidor, que los registra para crackeo offline.'),
      hStack(['hostapd-wpe','freeradius','hostapd-mana','hashcat -m 5500']),
      hTool('hostapd (config enterprise / WPE)','WFAudit genera una config de hostapd en modo enterprise con tu certificado y la lanza para capturar los intentos EAP. Alternativas del ecosistema: freeradius o hostapd-mana.',[['default_eap_type=peap','Anuncia soporte PEAP'],['tls cert','Certificado SSL autofirmado']]),
      hP(_b('Qué capturas')+': usuario + reto/respuesta MSCHAPv2. Crackea con '+_c('hashcat -m 5500')+'. '+_b('Mitigación')+': validación de certificado en el cliente y EAP-TLS hacen fallar el ataque (frecuente en flotas con MDM).'),

      hH('WPA3 — SAE / Dragonfly'),
      hP('WPA3 (2018) introdujo '+_b('SAE (Dragonfly)')+' en lugar del handshake PSK. SAE resiste el diccionario offline porque cada intento exige interacción con el AP. Pero hay vectores conocidos:'),
      hLi('Downgrade de modo transición','Si el AP ofrece WPA2+WPA3 a la vez (compatibilidad), fuerzas al cliente a caer a WPA2 (deauth + AP rogue solo-WPA2) y atacas ese handshake.'),
      hLi('SAE DoS (Dragonblood)','CVE-2019-9494/9495 y relacionados: la fase commit de SAE obliga al AP a una multiplicación escalar en curva elíptica; inundar con commits agota su CPU.'),
      hLi('Timing / side-channel','Fugas de tiempo en Dragonfly que pueden revelar información de la contraseña.'),
      hStack(['wpa_supplicant','aireplay-ng (deauth)','herramientas dragonblood']),

      hH('WPS — Pixie-Dust y fuerza bruta de PIN'),
      hP('WPS (Wi-Fi Protected Setup) permite unir un cliente a la red con un '+_b('PIN de 8 dígitos')+' (en realidad 7 + checksum) en vez de la passphrase. Ese PIN es su talón de Aquiles: si lo recuperas, el AP te entrega la '+_b('PSK WPA completa')+'. El escáner marca con '+_b('WPS')+' los APs que lo tienen activo (y cada uno lleva un botón directo a este ataque).'),
      hLi('Pixie-Dust (offline)','Explota la generación débil de los nonces '+_c('E-S1/E-S2')+' en muchos chipsets (Ralink, Realtek, Broadcom...). Con el primer intercambio M1-M3 basta para calcular el PIN '+_b('sin fuerza bruta')+': segundos o minutos. Es el ataque a probar primero.'),
      hLi('Fuerza bruta de PIN (online)','Prueba los '+_b('~11.000 PIN válidos')+' contra el AP. Lento (horas) y ruidoso; muchos APs aplican '+_b('lockout')+' (bloqueo temporal) tras varios fallos. El checksum y la validación por mitades reducen el espacio de 10⁸ a ~11.000.'),
      hPipe(['reaver -K 1 (Pixie-Dust)','PIN recuperado','reaver entrega la PSK WPA']),
      hStack(['reaver','bully','pixiewps']),
      hTool('reaver','Herramienta de referencia para WPS. Pixie-Dust e iteración de PIN, con control de lockout y reanudación de sesión.',[['-i <iface>','Interfaz en monitor'],['-b <BSSID>','AP objetivo'],['-c <canal>','Canal del AP'],['-K 1','Ataque Pixie-Dust (offline)'],['-L','Ignora el lockout reportado por el AP'],['-d <seg>','Retardo entre intentos (evita el lockout)']]),
      hTool('bully','Alternativa a reaver, a menudo más robusta con ciertos drivers. Pixie-Dust con '+_c('-d')+' (invoca pixiewps).',[['<iface> -b <BSSID>','Objetivo'],['-c <canal>','Canal'],['-d','Pixie-Dust'],['-p <pin>','Prueba un PIN concreto']]),
      hBox('warn','Cuándo NO funciona',_b('WPS desactivado')+' (cada vez más por defecto), '+_b('lockout')+' agresivo o permanente, y routers modernos con PIN aleatorio por sesión. Si el AP se bloquea, sube el retardo ('+_c('-d')+') o cambia a Pixie-Dust, que no necesita fuerza bruta.'),

      hBox('info','Qué vector elegir',_b('WPS activo')+': WPS (Pixie-Dust primero) — suele ser el camino más rápido a la PSK. '+_b('WPA2-PSK con clientes')+': PMKID → handshake. '+_b('WPA2-PSK sin clientes')+': PMKID. '+_b('Objetivo fuera de su red')+': AP-less. '+_b('Enterprise')+': módulo Enterprise. '+_b('WPA3')+': comprueba primero el modo transición.'),
    ].join('')},

    {id:'recon',t:'🔍  Panel Reconocimiento',b:()=>[
      hP('Con acceso a la red (por credenciales crackeadas o Evil Twin), el panel Recon hace '+_b('reconocimiento interno')+': descubrir hosts vivos, enumerar puertos/servicios/SO y detectar vulnerabilidades. Aquí la auditoría WiFi se convierte en pentest interno.'),
      hStack(['nmap','ARP/ping sweep','grafo force-directed']),
      hH('Descubrimiento y mapa interactivo'),
      hP('El botón '+_b('discover')+' hace un barrido (ARP/ping) del rango que le indiques para listar hosts vivos. Los resultados se pintan en un '+_b('grafo de red interactivo')+' centrado en el gateway real, con nodos que se repelen entre sí (fuerza dirigida), arrastrables y con zoom/pan.'),
      hLi('Leyenda editable','Asigna significado a los colores (p. ej. rojo = pwned, verde = siguiente objetivo) y anota cada host. El mapa se guarda en disco y sobrevive a reinicios.'),
      hLi('Añadir/editar hosts','Puedes añadir hosts manualmente, anotarlos y borrarlos.'),
      hH('nmap y sus perfiles'),
      hTool('nmap','El mapeador estándar: puertos TCP/UDP, versiones, fingerprint de SO y motor de scripts NSE (miles de detecciones de vulnerabilidades). WFAudit ofrece perfiles preconfigurados y muestra el comando exacto ejecutado.',[['-sS','SYN scan (sigiloso)'],['-sV','Versión de cada servicio'],['-sC','Scripts NSE por defecto'],['-O','Detección de SO'],['--script vuln','Detección de vulnerabilidades']]),
      hLi('Silencioso',_c('-sS -p- -T4')+' — SYN scan a los 65535 puertos TCP. Rápido y discreto (no completa la conexión). El barrido de trabajo por host.'),
      hLi('Completo',_c('-sS -sV -sC -O -p- --script vuln -T4')+' — el escaneo total: todos los puertos + versión de cada servicio + scripts NSE por defecto + detección de SO + scripts de vulnerabilidades. Lento pero exhaustivo.'),
      hLi('UDP',_c('-sU --top-ports 100 -sV -sC -T4')+' — los 100 puertos UDP más comunes (DNS, SNMP, NTP, NetBIOS...) con versiones. Lento por naturaleza del UDP.'),
      hH('Router / Gateway'),
      hP('El router es un '+_b('objetivo de alto valor')+': comprometerlo da control de la red. Busca puertos de administración (22, 23, 53, 80/8080, 443/8443...), identifica modelo/firmware por banners y prueba credenciales por defecto (admin/admin...).'),
      hBox('warn','Disciplina post-acceso','No escanees todo a máxima velocidad: las redes corporativas tienen IDS/IPS. Empieza con quick scans y reserva los full/vuln para objetivos ya validados en alcance.'),
      hReqs(['Acceso a la red objetivo','nmap instalado','Rangos/hosts objetivo']),
    ].join('')},

    {id:'attacks',t:'◆  Panel Ataques (Evil Twin + MITM)',b:()=>[
      hP('Los '+_b('dos módulos más complejos')+'. Evil Twin crea un AP falso para cosechar credenciales o servir de pivote; MITM intercepta el tráfico de dispositivos ya conectados a una red a la que tienes acceso.'),

      hH('Evil Twin'),
      hP('Un '+_b('AP falso que suplanta una red legítima')+'. Los clientes se asocian creyendo que es su red conocida y, como controlas el AP, eres su gateway: un '+_b('MITM automático')+' sin necesidad de ARP spoofing.'),
      hStack(['hostapd','dnsmasq','iptables (NAT)','ip_forward','tshark','aireplay-ng']),
      hLi('1. AP falso','hostapd con el ESSID objetivo, mismo canal y seguridad equivalente.'),
      hLi('2. Red',_c('ip addr add 10.0.0.1/24')+' + dnsmasq como DHCP/DNS: asigna IPs a las víctimas desde 10.0.0.0/24, tu máquina es el gateway.'),
      hLi('3. Salida a internet',_c('sysctl net.ipv4.ip_forward=1')+' + iptables NAT (POSTROUTING) y FORWARD para que las víctimas naveguen con normalidad y no sospechen.'),
      hLi('4. Monitor','tshark captura DNS, SNI de TLS y HTTP y lo registra para verlo en vivo. Las leases DHCP del log de dnsmasq revelan los clientes conectados.'),
      hLi('5. Deauth opcional','aireplay-ng deauth al AP legítimo para forzar a sus clientes a migrar a tu Evil Twin.'),
      hPipe(['hostapd (AP)','dnsmasq (DHCP/DNS)','iptables + ip_forward (NAT)','tshark (monitor)']),
      hH2('Variantes'),
      hLi('Simple','Solo AP + forwarding: las víctimas navegan y ves su DNS/SNI/HTTP.'),
      hLi('+ Captive Portal','dnsmasq redirige TODO el DNS a tu máquina para servir un login falso y cosechar credenciales.'),
      hLi('+ Deauth','Deauth simultáneo al AP legítimo para acelerar la migración.'),

      hH('MITM — dispositivos ya conectados'),
      hP('Aquí no controlas el AP: usas '+_b('ARP spoofing')+' (arpspoof envenena la caché ARP del objetivo y del gateway) para que su tráfico pase por tu máquina. Dos modos con compromisos opuestos.'),
      hStack(['arpspoof (dsniff)','ip_forward','iptables','mitmdump','tshark']),
      hH2('🔇 Modo SIGILOSO — invisible'),
      hP('El tráfico te atraviesa pero '+_b('nada se intercepta ni modifica')+'. El HTTPS pasa intacto (sin avisos de certificado). Extraes inteligencia de lo no cifrado:'),
      hLi('DNS','Cada dominio que resuelve la víctima (UDP 53): cada web y backend que contacta.'),
      hLi('SNI de TLS','En el ClientHello, el host destino viaja en '+_b('texto plano')+' aun en HTTPS: revela el host exacto de cada conexión.'),
      hP(_b('Úsalo para')+' monitorizar sin alertar y mapear comportamiento. La víctima no lo detecta salvo un admin vigilando la tabla ARP.'),
      hH2('🔓 Modo FULL — intercepción de HTTPS'),
      hP('mitmproxy (mitmdump) actúa de proxy transparente: iptables redirige (PREROUTING) los puertos 80/443 a su puerto, termina el TLS de la víctima, lee/modifica el contenido y reconecta al destino real.'),
      hBox('warn','La CA es imprescindible','mitmproxy firma los certificados con SU CA, que el dispositivo NO confía por defecto → avisos de certificado en cada web. En una auditoría autorizada se instala antes la CA de mitmproxy en el dispositivo víctima (descargable desde el propio panel).'),
      hLi('Qué ves en full','HTTPS completo: cabeceras, cuerpos (incl. credenciales POST), cookies, llamadas API, tokens JWT.'),
      hH('Visor de flujos'),
      hP('Ambos modos alimentan una tabla en vivo (hora, tipo 🔒/⚠/📡, cliente, host, método, estado). Casilla para ver solo flujos con credenciales; esas filas se resaltan en rojo. Los flujos se transmiten en formato JSONL.'),
      hBox('info','Qué modo elegir',_b('Sigiloso')+': monitorización sin ser descubierto, muchos dispositivos. '+_b('Full')+': un dispositivo concreto con CA preinstalada, para capturar credenciales/tokens. '+_b('¿Solo comportamiento?')+' Evil Twin (más simple, sin ARP spoofing).'),
      hReqs(['Evil Twin: 2 adaptadores (o 1 + ethernet de uplink)','MITM: acceso a la LAN objetivo','MITM full: CA de mitmproxy instalada en la víctima']),
    ].join('')},

    {id:'captures',t:'📁  Panel Capturas',b:()=>[
      hP('El '+_b('gestor centralizado')+' de los artefactos de tu auditoría: handshakes, hashes PMKID, capturas de paquetes, logs de flujos MITM e informes. Cada herramienta escribe aquí en formatos estándar.'),
      hH('Tipos de fichero'),
      hTool('.cap / .pcap','Captura estándar (libpcap): tramas 802.11 en crudo (airodump-ng). Se abre con Wireshark y se crackea con aircrack-ng.'),
      hTool('.pcapng','Formato de nueva generación con metadatos ricos (hcxdumptool en PMKID). Se convierte a .22000 con hcxpcapngtool.'),
      hTool('.22000','Formato de hash WPA moderno de hashcat (reemplaza al 2500). Un PMKID o handshake EAPOL por línea. Se carga con -m 22000.'),
      hTool('.csv','Salida de airodump-ng: lista de APs y clientes vistos. Legible y fácil de parsear — pero NO es crackeable.'),
      hTool('.jsonl / .json','JSON Lines para los flujos MITM, y JSON para las exportaciones de sesión.'),
      hH('Análisis automático de cada captura'),
      hP('WFAudit analiza cada fichero con '+_c('aircrack-ng')+' (resultado cacheado) para decirte, en la propia lista, si contiene '+_b('handshake')+' y/o '+_b('PMKID')+' válidos. La columna HS marca '+_g('SÍ')+' de forma llamativa cuando hay handshake real.'),
      hStack(['aircrack-ng (análisis)','mergecap','hcxpcapngtool']),
      hBox('info','Los .csv no son crackeables','Un .csv es solo el inventario de redes de airodump-ng, no contiene material criptográfico. Por eso no muestran handshake/PMKID ni aparecen como opción para crackear — evitas perder tiempo con un fichero que nunca romperá una clave.'),
      hH('Funciones'),
      hLi('Verificar','Confirma con aircrack-ng si la captura tiene handshake/PMKID válidos y cuántas redes. '+_b('Hazlo antes de crackear')+' para no perder horas con una captura incompleta.'),
      hLi('Descargar','Copia local para respaldo o análisis externo.'),
      hLi('Eliminar','Libera espacio (con confirmación).'),
      hBox('warn','Respaldo','Copia los ficheros críticos (handshakes, PMKIDs, credenciales) '+_b('fuera de la máquina')+' cuanto antes, cifrados. Referéncialos por checksum SHA-256 en el informe para probar integridad.'),
    ].join('')},

    {id:'sessions',t:'📋  Panel Sesiones y Hallazgos',b:()=>[
      hP('El '+_b('motor de documentación e informes')+'. Cada engagement se organiza bajo una sesión que registra alcance, cronología, hallazgos y evidencias, y se exporta como '+_b('informe PDF')+' para el cliente.'),
      hStack(['reportlab (PDF)','evidencia gráfica','severidad CVSS']),
      hH('Qué contiene una sesión'),
      hLi('Metadatos','Cliente, empresa, auditor, fechas y notas de alcance.'),
      hLi('Hallazgos','Cada issue con severidad, descripción, evidencia (texto e imágenes) y recomendación.'),
      hLi('Capturas y eventos','Ficheros vinculados y una cronología de la sesión.'),
      hH('Severidades'),
      hLi('Crítico',_d('Explotación inmediata, impacto alto')+' (red abierta, credenciales por defecto del router, WiFi crackeada privilegiada).'),
      hLi('Alto',_w('Explotable con esfuerzo, impacto material')+' (password WiFi débil, WPS vulnerable).'),
      hLi('Medio','Requiere condiciones (WPA2-Enterprise MSCHAPv2, WPA3 en transición con clientes).'),
      hLi('Bajo','Explotabilidad limitada (política PIN WPS débil).'),
      hLi('Info','Observación sin impacto directo (APs detectados, análisis PNL, topología).'),
      hH('Buenas prácticas de hallazgo'),
      hLi('Título','Conciso (<80 car.). "Credenciales por defecto en el router" mejor que una frase vaga.'),
      hLi('Descripción','Qué se encontró y por qué es un problema, con evidencia concreta: BSSIDs, ESSIDs, IPs, usuarios.'),
      hLi('Recomendación','Pasos accionables para remediar; referencia estándares (NIST, OWASP, fabricante).'),
      hLi('Evidencia gráfica','Adjunta capturas de pantalla; se incrustan en el PDF (que parte las evidencias largas correctamente entre páginas).'),
      hBox('warn','Documenta en tiempo real',_b('Registra cada hallazgo según lo descubres')+', no al final. Detalles cruciales (MACs, señales, timing) se pierden de memoria. El botón de hallazgo rápido del escáner ayuda a capturarlos al vuelo.'),
    ].join('')},

    {id:'system',t:'▣  Panel Sistema y Procesos',b:()=>[
      hP('Estado del host (hostname, SO, kernel, root, CPU, RAM, disco, Python), inventario de herramientas por categoría, uso de disco, búsqueda OUI, control de acceso y un '+_b('monitor en vivo de todos los subprocesos')+' del backend.'),
      hH('Monitor de procesos'),
      hP('Cada herramienta que ejecuta WFAudit (airodump-ng, hostapd, mitmdump, nmap, hashcat...) corre como subproceso gestionado, con ID, comando completo, estado (Running/Completed/Failed/Cancelled) e inicio. Se auto-refresca cada 5s.'),
      hLi('Depurar','¿Un ataque no da resultados? Comprueba si el proceso realmente corre.'),
      hLi('Cancelar','Para un proceso largo (hashcat con una wordlist enorme) desde aquí.'),
      hH('Utilidades del panel'),
      hTool('Búsqueda OUI / Fabricante','Identifica el fabricante por la MAC (primeros 3 bytes). Botón para descargar la base de datos completa del IEEE y afinar los resultados. Ojo: los móviles con MAC aleatorizada no son identificables (privacidad).'),
      hTool('Datos del backend','Uso de disco por carpeta (capturas, wordlists, evidencias...) y botón de '+_b('Eliminar TODOS los datos')+' con doble confirmación (irreversible).'),
      hTool('Seguridad / Acceso','Estado de la autenticación (token requerido, localhost vs LAN) y acciones para cambiar el token o cerrar sesión. Ver la sección Seguridad.'),
      hStack(['OUI IEEE DB','psutil (métricas)','process_manager']),
      hBox('warn','Al matar procesos','Si matas un proceso directo aquí, la capa de servicios puede no enterarse. Para los módulos de ataque, '+_b('usa siempre su botón Stop primero')+' (hace la limpieza: flush de iptables, restaurar ARP, ip_forward...). Matar directo, solo como último recurso.'),
    ].join('')},

    {id:'tips',t:'💡  Consejos y errores comunes',b:()=>[
      hH('10 errores comunes'),
      hLi('1. Escanear solo 2.4 GHz','Pierdes casi todo lo corporativo. Usa "abg" salvo motivo concreto.'),
      hLi('2. Empezar con deauth broadcast','Más ruidoso y menos efectivo que el dirigido. Empieza con -c a un cliente.'),
      hLi('3. Handshake antes que PMKID','PMKID es más rápido, silencioso y sin clientes. Pruébalo primero.'),
      hLi('4. No validar antes de crackear','Un handshake incompleto es incrackeable. Verifícalo (panel Capturas) antes de lanzar hashcat.'),
      hLi('5. Empezar por la wordlist de 10M','Empieza con rockyou o una lista dirigida. ~70% de las passwords salen de rockyou. Escala solo si falla.'),
      hLi('6. Usar aircrack-ng teniendo GPU','aircrack-ng es solo CPU. Con GPU, hashcat es 100-1000x más rápido.'),
      hLi('7. Olvidar volver a managed','Tras el engagement, restaura las interfaces o tu WiFi no reconectará hasta reiniciar.'),
      hLi('8. MITM sin comprobar mitmproxy','Si mitmproxy cae al arrancar, el ARP spoof redirige tráfico pero nada lo captura y la víctima pierde conexión. Verifica el estado.'),
      hLi('9. No cerrar los ataques limpiamente','Matar el backend con Ctrl+C salta la limpieza: quedan iptables, ARP envenenado, ip_forward. Usa los botones Stop.'),
      hLi('10. No documentar en tiempo real','La memoria falla. Añade cada hallazgo según lo descubres.'),
      hH('Consejos'),
      hLi('La antena importa','Busca línea de visión: muros pueden bajar 20-40 dB. Antenas direccionales para distancia.'),
      hLi('Varios adaptadores','Uno monitor + uno managed + ethernet de uplink = Evil Twin completo con internet y deauth.'),
      hLi('Guarda el progreso del crack','hashcat tiene sesiones: '+_c('--session=audit1 --restore')+' reanuda cracks interrumpidos.'),
      hLi('Aprovecha las notificaciones','Lanza un crack o escaneo largo y sigue trabajando en otra pestaña: el toast te avisará al terminar.'),
      hH('Escalar vs. documentar'),
      hLi('Red abierta','Crítico — hallazgo inmediato. Prueba solo servicios permitidos por el alcance.'),
      hLi('WEP','Crítico — crackeable en minutos. Documéntalo sin llegar a crackear si es trivial en alcance.'),
      hLi('Credenciales por defecto del router','Crítico — documenta que funcionan, pero NO vayas más allá de la verificación sin autorización explícita.'),
      hLi('WPA3-only','Info positivo — la organización lo hizo bien. Reconócelo en el informe.'),
    ].join('')},

    {id:'glossary',t:'📗  Glosario técnico',b:()=>[
      hP('Los términos y siglas que aparecen por toda la plataforma, explicados brevemente.'),
      hH('Protocolos y claves'),
      hLi('PSK','Pre-Shared Key: la contraseña compartida de una red WPA/WPA2-Personal.'),
      hLi('PMK','Pairwise Master Key: clave maestra derivada de la PSK y el SSID por PBKDF2. '+_c('PMK = PBKDF2(passphrase, SSID, 4096, 256)')+'.'),
      hLi('PTK','Pairwise Transient Key: clave de sesión derivada de la PMK + nonces + MACs durante el handshake.'),
      hLi('PMKID','Identificador de la PMK que algunos APs incluyen en el M1. Permite el ataque WPA2 sin cliente.'),
      hLi('EAPOL','EAP Over LAN: las tramas del handshake de 4 vías WPA/WPA2.'),
      hLi('MIC','Message Integrity Code: firma de cada mensaje EAPOL. Verificarlo offline permite el crackeo por diccionario.'),
      hLi('SAE / Dragonfly','Simultaneous Authentication of Equals: el handshake de WPA3, resistente al diccionario offline.'),
      hLi('802.1X / EAP','Marco de autenticación de WPA-Enterprise (PEAP, EAP-TTLS, EAP-TLS) con servidor RADIUS.'),
      hLi('802.11w (PMF)','Protected Management Frames: firma las tramas de management y neutraliza el deauth.'),
      hH('Red e identificadores'),
      hLi('BSSID / ESSID','MAC del AP / nombre de red legible.'),
      hLi('OUI','Los 3 primeros bytes de una MAC, que identifican al fabricante (base de datos IEEE).'),
      hLi('PNL','Preferred Network List: la lista de redes conocidas que un dispositivo busca con probe requests. Base de AP-less y Evil Twin.'),
      hLi('SNI','Server Name Indication: el hostname destino, en '+_b('texto plano')+' dentro del ClientHello de TLS, aun en HTTPS.'),
      hLi('ARP spoofing','Envenenar la caché ARP para que el tráfico de la víctima pase por tu máquina (MITM).'),
      hLi('DFS','Dynamic Frequency Selection: canales 5 GHz que ceden ante radar.'),
      hH('Cracking'),
      hLi('Modo 22000 (hashcat)','Formato WPA moderno que unifica PMKID y handshake EAPOL.'),
      hLi('Modo 5500 (hashcat)','NetNTLMv1 / MSCHAPv2: lo que capturas en el ataque Enterprise.'),
      hLi('Leetspeak','Sustituir letras por símbolos parecidos (a→4, e→3, o→0). Mutación clave del generador de wordlists.'),
      hLi('Máscara','Patrón de fuerza bruta por conjunto de caracteres (ej. '+_c('?d?d?d?d')+' = 4 dígitos).'),
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

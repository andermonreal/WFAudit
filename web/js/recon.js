// WFAudit · recopilación — dashboard, interfaces, escaneo WiFi y reconocimiento (nmap)
// ======== DASHBOARD ========
async function dashboard(){
  setC(`<div style="display:flex;align-items:center;gap:10px;color:var(--t2)"><div class="spin"></div> Cargando...</div>`);
  let pf=null,procs=[],sess=[];
  try{[pf,procs,sess]=await Promise.all([A.preflight().catch(()=>null),A.procs().catch(()=>[]),A.sessions().catch(()=>[])]);}catch{}
  const sys=pf?.system||{},tools=pf?.tools||{},tl=Object.entries(tools),inst=tl.filter(([,v])=>v.installed).length,miss=pf?.missing_critical||[],run=procs.filter(p=>p.status==='running'),s=ST.activeSession,fi=s?.findings||[],sc={critical:0,high:0,medium:0,low:0,info:0};
  fi.forEach(f=>{if(f.severity in sc)sc[f.severity]++;});
  setC(`<div class="sup">
    ${miss.length?`<div class="alert aw" style="margin-bottom:14px">${ic('warn')}<div><strong>Críticos faltantes:</strong> ${miss.join(', ')} — <span onclick="goto('system')" style="cursor:pointer;text-decoration:underline">Ver sistema</span></div></div>`:''}
    <div class="g4" style="margin-bottom:14px">
      <div class="card ${pf?.ready?'card-g':''}">
        <div class="ctitle">${ic('cpu')} Sistema</div>
        <div style="font-family:'Orbitron',monospace;font-size:.95rem;font-weight:700;color:var(--g)">${sys.hostname||'—'}</div>
        <div style="font-size:.7rem;color:var(--t2);margin:4px 0 8px">${sys.os||'—'}</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap">${sys.is_root?`<span class="badge b-g">ROOT ✓</span>`:`<span class="badge b-r">NO ROOT</span>`}${sys.cpu_count?`<span class="badge b-x">${sys.cpu_count} cores</span>`:''}</div>
      </div>
      <div class="card">
        <div class="ctitle">${ic('zap')} Herramientas</div>
        <div style="font-family:'Orbitron',monospace;font-size:1.5rem;font-weight:700">${inst}<span style="font-size:.85rem;color:var(--t2)">/${tl.length}</span></div>
        <div class="ptrack" style="margin:8px 0 5px"><div class="pbar" style="width:${tl.length?Math.round(inst/tl.length*100):0}%"></div></div>
        <div style="font-size:.7rem;color:${miss.length?'var(--r)':'var(--g)'}">${miss.length?`${miss.length} críticos faltantes`:'Todas OK'}</div>
      </div>
      <div class="card">
        <div class="ctitle">${ic('folder')} Sesiones</div>
        <div style="font-family:'Orbitron',monospace;font-size:1.5rem;font-weight:700">${sess.length}</div>
        <div style="font-size:.7rem;color:var(--t2);margin-top:4px">${sess.filter(x=>x.status==='active').length} activas</div>
        <button class="btn btn-gh btn-xs" style="margin-top:8px" onclick="goto('sessions')">Gestionar →</button>
      </div>
      <div class="card">
        <div class="ctitle">${ic('refresh')} Procesos</div>
        <div style="font-family:'Orbitron',monospace;font-size:1.5rem;font-weight:700;color:${run.length?'var(--y)':'var(--t0)'}" class="${run.length?'ppulse':''}">${run.length}</div>
        <div style="font-size:.7rem;color:var(--t2);margin-top:4px">${procs.length} total</div>
        <button class="btn btn-gh btn-xs" style="margin-top:8px" onclick="goto('system')">Ver →</button>
      </div>
    </div>
    <div class="g2" style="margin-bottom:14px">
      <div class="card ${s?'card-c glow-c':''}">
        <div class="ctitle">${ic('folder')} Sesión Activa</div>
        ${s?`<div style="font-family:'Orbitron',monospace;font-size:.95rem;font-weight:700;margin-bottom:4px">${s.name}</div>
          <div style="font-size:.74rem;color:var(--t2);margin-bottom:8px">${s.company||'—'} · ${s.auditor||'—'} · <span class="mono">${s.id}</span></div>
          ${stb(s.status)}
          ${fi.length>0?`<div style="margin:10px 0 6px"><div style="display:flex;height:6px;border-radius:3px;overflow:hidden;margin-bottom:7px">${Object.entries(sc).filter(([,v])=>v>0).map(([sv,n])=>`<div style="flex:${n};background:var(--${sv==='critical'?'r':sv==='high'?'o':sv==='medium'?'y':sv==='low'?'g':'c'})" title="${sv}:${n}"></div>`).join('')}</div><div style="display:flex;gap:5px;flex-wrap:wrap">${Object.entries(sc).filter(([,v])=>v>0).map(([sv,n])=>`<span class="badge b-${sv==='critical'?'r':sv==='high'?'o':sv==='medium'?'y':sv==='low'?'g':'c'}">${sv}:${n}</span>`).join('')}</div></div>`:`<div style="font-size:.76rem;color:var(--t2);margin-top:8px">Sin hallazgos</div>`}
          <div style="display:flex;gap:7px;margin-top:12px;flex-wrap:wrap"><button class="btn btn-gh btn-sm" onclick="goto('sessions')">Ver sesión</button><button class="btn btn-p btn-sm" onclick="addFindingModal('${s.id}')">${ic('plus')} Hallazgo</button><a class="btn btn-gh btn-sm" href="${A.pdfUrl(s.id)}" target="_blank">${ic('download')} PDF</a></div>`:
        `<div class="empty" style="padding:22px">${ic('folder',36)}<h3>Sin sesión activa</h3><button class="btn btn-g btn-sm" style="margin-top:10px" onclick="goto('sessions')">${ic('plus')} Nueva</button></div>`}
      </div>
      <div class="card">
        <div class="ctitle">${ic('zap')} Accesos Rápidos</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${[['wifi','Escanear WiFi','wifiscan','var(--c)'],['search','Reconocimiento','recon','var(--g)'],['wifi','Sniffing','sniffing','var(--y)'],['key','Crack','crack','var(--y)'],['shield','Evil Twin','attacks','var(--o)'],['zap','Avanzado','advanced','var(--p)'],['download','Wordlists','wordlists','var(--c)']].map(([i2,l,s2,col])=>`<div onclick="goto('${s2}')" style="padding:12px;background:var(--bg3);border:1px solid var(--b0);border-radius:9px;cursor:pointer;transition:all .15s" onmouseover="this.style.borderColor='${col}'" onmouseout="this.style.borderColor='var(--b0)'"><div style="color:${col}">${ic(i2,16)}</div><div style="font-size:.8rem;font-weight:600;margin-top:5px">${l}</div></div>`).join('')}
        </div>
      </div>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;margin-bottom:10px"><div class="ctitle" style="margin-bottom:0">${ic('zap')} Herramientas</div><button class="btn btn-gh btn-xs" onclick="goto('system')">Ver todo →</button></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:6px">
        ${tl.slice(0,16).map(([name,t])=>`<div style="display:flex;align-items:center;gap:7px;padding:7px;background:var(--bg3);border-radius:6px;border:1px solid ${t.installed?'rgba(0,255,136,.2)':'rgba(255,59,92,.15)'}"><div style="width:6px;height:6px;border-radius:50%;background:${t.installed?'var(--g)':'var(--r)'};flex-shrink:0"></div><span class="mono" style="font-size:.72rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${name}</span></div>`).join('')}
      </div>
    </div>
    ${run.length?`<div class="card" style="margin-top:14px"><div class="ctitle">${ic('refresh')} Procesos Activos</div><div class="twrap"><table><thead><tr><th>ID</th><th>Comando</th><th>Estado</th><th>Inicio</th><th></th></tr></thead><tbody>${run.map(p=>`<tr><td class="mono" style="font-size:.7rem">${p.id}</td><td class="mono" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.68rem;color:var(--t2)">${p.command}</td><td>${stb(p.status)}</td><td class="mono" style="font-size:.68rem;color:var(--t2)">${fd(p.started_at)}</td><td><button class="btn btn-d btn-xs" onclick="cancelPD('${p.id}')">Stop</button></td></tr>`).join('')}</tbody></table></div></div>`:''}
  </div>`);}
async function cancelPD(id){try{await A.cancelProc(id);toast('Cancelado','success');dashboard();}catch(e){toast(e.message,'error');}}
// ======== SESSIONS ========
async function interfaces(){
  setC(`<div style="display:flex;align-items:center;gap:10px;color:var(--t2)"><div class="spin"></div> Cargando...</div>`);
  let ifaces=[],ns=null;try{[ifaces,ns]=await Promise.all([A.ifaces(),A.netSt()]);}catch(e){toast(e.message,'error');}
  const sug=(ns?.suggestions||[]).filter(s=>s.level!=='ok'),mon=ifaces.filter(i=>i.mode==='monitor'),mgd=ifaces.filter(i=>i.mode==='managed'&&i.is_up),down=ifaces.filter(i=>!i.is_up);
  setC(`<div class="sup">
    <div class="hint" style="margin-bottom:10px">${ic('info',12)}<b>Monitor</b> = captura todas las tramas del aire (necesario para escanear, capturar handshakes y deauth). <b>Managed</b> = cliente normal (para conectarte a una red o hacer MITM/recon). Pasa a monitor la interfaz con la que vayas a auditar; recuerda volver a managed al terminar.</div>
    ${sug.map(s=>`<div class="alert ${s.level==='warning'?'aw':'ai'}" style="margin-bottom:8px">${ic(s.level==='warning'?'warn':'info')}<div>${s.message}</div></div>`).join('')}
    ${ns?`<div style="background:var(--bg1);border:1px solid var(--b0);border-radius:var(--rl);padding:14px;margin-bottom:18px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><div class="ctitle" style="margin-bottom:0">${ic('wifi')} Estado de Red</div><span class="badge ${ns.internet_available?'b-g':'b-r'}" style="margin-left:auto">${ns.internet_available?'Internet OK':'Sin Internet'}</span></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
        ${[['Ethernet',ns.ethernet||[],'var(--c)'],['WiFi Managed',ns.wifi_managed||[],'var(--g)'],['WiFi Monitor',ns.wifi_monitor||[],'var(--y)']].map(([lbl,items,col])=>`<div><div class="net-col">${lbl}</div>${items.length?items.map(i=>`<div class="net-e"><div style="width:7px;height:7px;border-radius:50%;background:${i.state==='up'?col:'var(--t2)'};flex-shrink:0;${i.state==='up'?`box-shadow:0 0 5px ${col};`:''}"></div><span class="mono" style="font-size:.75rem">${i.interface}</span>${i.ipv4?`<span style="font-size:.72rem;color:var(--t2)">${i.ipv4}</span>`:''}<span class="badge ${i.state==='up'?'b-g':'b-x'}" style="margin-left:auto">${i.state}</span></div>`).join(''):`<div style="font-size:.74rem;color:var(--t2);padding:4px 0">—</div>`}</div>`).join('')}
      </div>
    </div>`:''}
    ${mon.length?`<div class="iface-sec">${ic('wifi',12)} MONITOR MODE (${mon.length})</div><div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px">${mon.map(ifCard).join('')}</div>`:''}
    ${mgd.length?`<div class="iface-sec">${ic('wifi',12)} MANAGED MODE (${mgd.length})</div><div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px">${mgd.map(ifCard).join('')}</div>`:''}
    ${down.length?`<div class="iface-sec">DOWN (${down.length})</div><div style="display:flex;flex-direction:column;gap:10px">${down.map(ifCard).join('')}</div>`:''}
    ${!ifaces.length?`<div class="empty">${ic('wifi',48)}<h3>Sin interfaces WiFi</h3></div>`:''}
  </div>`);}
function ifCard(i){const cl=!i.is_up?'iface-down':i.mode==='monitor'?'iface-mon':'iface-mgd';return `<div class="${cl}"><div class="iface-name">${i.name}</div><div class="iface-meta"><span>MAC: <strong class="mono">${i.mac||'—'}</strong></span><span>Driver: <strong>${i.driver||'—'}</strong></span><span>Chipset: <strong>${i.chipset||'—'}</strong></span><span>TX: <strong>${i.tx_power||'?'} dBm</strong></span>${i.phy?`<span>PHY: <strong>${i.phy}</strong></span>`:''}</div><div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">${i.supports_monitor?`<span class="badge b-g">Monitor ✓</span>`:''} ${i.supports_5ghz?`<span class="badge b-c">5GHz ✓</span>`:''} ${i.supports_inject?`<span class="badge b-p">Inject ✓</span>`:''}</div><div style="display:flex;gap:7px;flex-wrap:wrap">${i.mode==='managed'?`<button class="btn btn-g btn-sm" onclick="setMon('${i.name}')">→ Monitor</button>`:`<button class="btn btn-gh btn-sm" onclick="setMgd('${i.name}')">→ Managed</button>`}<button class="btn btn-gh btn-sm" onclick="spoofUI('${i.name}')">Spoof MAC</button><button class="btn btn-gh btn-sm" onclick="txUI('${i.name}',${i.tx_power||20})">TX Power</button><button class="btn btn-gh btn-sm" onclick="showChannels('${i.name}')">Canales</button></div></div>`;}
async function showChannels(n){showModal(`Canales soportados — ${n}`,`<div style="display:flex;align-items:center;gap:8px;color:var(--y)"><div class="spin"></div> Consultando...</div>`,'',false);try{const r=await A.channels(n);const arr=Array.isArray(r)?r:(r.channels||r.supported_channels||[]);const g24=arr.filter(c=>c<=14),g5=arr.filter(c=>c>14);const chip=c=>`<span class="kbd" style="margin:2px">${c}</span>`;showModal(`Canales soportados — ${n}`,`${!arr.length?`<div class="alert ai">${ic('info')}<div>Sin datos de canales para esta interfaz.</div></div>`:`<div style="font-size:.72rem;color:var(--t2);margin-bottom:10px">${arr.length} canales soportados</div>${g24.length?`<div style="font-size:.66rem;color:var(--t2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">2.4 GHz</div><div style="margin-bottom:12px;line-height:2">${g24.map(chip).join('')}</div>`:''}${g5.length?`<div style="font-size:.66rem;color:var(--t2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">5 GHz</div><div style="line-height:2">${g5.map(chip).join('')}</div>`:''}`}`,`<button class="btn btn-gh" onclick="closeModal()">Cerrar</button>`,false);}catch(e){toast(e.message,'error');closeModal();}}
async function setMon(n){try{const r=await A.setMon(n);toast(r.success?`${n} → monitor (${r.monitor_interface})`:'Error',r.success?'success':'error');interfaces();}catch(e){toast(e.message,'error');}}
async function setMgd(n){try{await A.setMgd(n);toast(`${n} → managed`,'success');interfaces();}catch(e){toast(e.message,'error');}}
function spoofUI(n){showModal(`Spoof MAC — ${n}`,`<div class="alert aw">${ic('warn')}<div>Puede interrumpir la conexión.</div></div><div class="frow"><label>Nueva MAC (vacío=aleatoria)</label><input id="sm-mac" class="inp" placeholder="AA:BB:CC:DD:EE:FF"></div><div class="frow"><label>Vendor prefix (opcional) <span class="tip" data-tip="Clona solo los 3 primeros octetos para imitar a un fabricante (ej. 00:1A:2B). El resto es aleatorio. Ignorado si rellenas una MAC completa arriba.">?</span></label><input id="sm-vp" class="inp" placeholder="00:1A:2B (Cisco, Apple…)"></div>`,`<button class="btn btn-gh" onclick="closeModal()">Cancelar</button><button class="btn btn-p" onclick="doSpoof('${n}')">Aplicar</button>`);}
async function doSpoof(n){const m=document.getElementById('sm-mac')?.value?.trim(),vp=document.getElementById('sm-vp')?.value?.trim();try{const r=await A.spoofMac(n,m||null,vp||null);closeModal();toast(`Nueva MAC: ${r.new_mac}`,'success');interfaces();}catch(e){toast(e.message,'error');}}
function txUI(n,c){showModal(`TX Power — ${n}`,`<div class="frow"><label>Potencia dBm (1–30)</label><input id="tx-v" class="inp" type="number" min="1" max="30" value="${c}"></div>`,`<button class="btn btn-gh" onclick="closeModal()">Cancelar</button><button class="btn btn-p" onclick="doTx('${n}')">Aplicar</button>`);}
async function doTx(n){const p=parseInt(document.getElementById('tx-v')?.value);try{const r=await A.setTx(n,p);closeModal();toast(`TX → ${r.tx_power} dBm`,'success');interfaces();}catch(e){toast(e.message,'error');}}
// ======== WIFI SCAN ========
let _scan=null,_scanPoll=null;
let _wsMarked=new Set();try{_wsMarked=new Set(JSON.parse(localStorage.getItem('wsMarked')||'[]'));}catch(e){}
function wsToggleMark(bssid,tr){if(_wsMarked.has(bssid)){_wsMarked.delete(bssid);tr&&tr.classList.remove('ws-mark');}else{_wsMarked.add(bssid);tr&&tr.classList.add('ws-mark');}try{localStorage.setItem('wsMarked',JSON.stringify([..._wsMarked]));}catch(e){}}
function wsShowClients(bssid,essid){
  const cls=((_scan&&_scan.clients)||[]).filter(c=>c.bssid===bssid);
  const body=cls.length
    ?`<div style="font-size:.74rem;color:var(--t2);margin-bottom:10px">${cls.length} cliente(s) asociado(s) a <strong style="color:var(--t1)">${essid||bssid}</strong></div><div class="twrap"><table><thead><tr><th>MAC</th><th>Fabricante</th><th>Señal</th><th>Paquetes</th></tr></thead><tbody>${cls.map(c=>`<tr><td class="mono" style="font-size:.72rem;color:var(--c)">${c.mac}</td><td style="font-size:.74rem;color:var(--t2)">${c.manufacturer||'—'}</td><td class="mono" style="font-size:.7rem">${c.power||'—'}</td><td class="mono">${c.frames||0}</td></tr>`).join('')}</tbody></table></div>`
    :`<div class="empty" style="padding:22px">${ic('wifi',32)}<h3>Sin clientes captados</h3><p>No se captó ningún cliente asociado a este AP en el escaneo</p></div>`;
  showModal(`Clientes · ${essid||bssid}`,body,`<button class="btn btn-gh" onclick="closeModal()">Cerrar</button>`,cls.length>5);
}
async function wifiscan(){
  let ifaces=[];try{ifaces=await A.ifaces();}catch{}
  setC(`<div class="sup"><div class="card" id="ws-form" data-pp="ws-form" style="margin-bottom:16px">
    <div class="ctitle">${ic('search')} Nueva Exploración</div>
    ${!ifaces.filter(i=>i.mode==='monitor').length?`<div class="alert aw" style="margin-bottom:10px">${ic('warn')}<div>Sin interfaces en monitor. <button class="btn btn-gh btn-xs" onclick="goto('interfaces')">Ir a Interfaces →</button></div></div>`:''}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px 11px;align-items:end">
      <div class="frow" style="margin:0"><label>Interfaz</label><select id="ws-if" class="inp" data-p>${ifaces.map(i=>`<option value="${i.name}" ${i.mode==='monitor'?'selected':''}>${i.name} (${i.mode})</option>`).join('')}</select></div>
      <div class="frow" style="margin:0"><label>Banda <span class="tip" data-tip="2.4 GHz: routers domésticos e IoT (rápido). 5 GHz: redes corporativas modernas. Dual Band: ambas a la vez (recomendado, no pierdes redes).">?</span></label><select id="ws-band" class="inp" data-p><option value="bg">2.4 GHz (b/g/n)</option><option value="a">5 GHz (a/n/ac)</option><option value="abg">Dual Band</option></select></div>
      <div class="frow" style="margin:0"><label>Duración (s) <span class="tip" data-tip="30s: reconocimiento rápido. 60-120s: equilibrado (recomendado). 300s+: captura redes ocultas, clientes poco activos y señales débiles.">?</span></label><input id="ws-dur" class="inp" type="number" value="30" min="10" max="300" data-p></div>
      <div class="frow" style="margin:0"><label>Canal <span class="tip" data-tip="Opcional. Fija un canal concreto. Vacío = todos.">?</span></label><input id="ws-ch" class="inp" type="number" placeholder="Todos" data-p></div>
      <div class="frow" style="margin:0"><label>BSSID objetivo <span class="tip" data-tip="Opcional. Filtra el escaneo a un único AP por su MAC. Reduce ruido y consumo cuando ya sabes qué red quieres.">?</span></label><input id="ws-bssid" class="inp" placeholder="AA:BB:CC:DD:EE:FF" data-p></div>
      <div class="frow" style="margin:0"><label>ESSID objetivo <span class="tip" data-tip="Opcional. Filtra el escaneo a las redes con este nombre. Déjalo vacío para ver todas.">?</span></label><input id="ws-essid" class="inp" placeholder="Nombre de red" data-p></div>
      <button class="btn btn-g" id="ws-btn" onclick="startScan()" style="height:39px;white-space:nowrap">${ic('play')} Escanear</button>
    </div>
    <div id="ws-live" style="display:none;margin-top:12px"></div>
  </div>
  <div id="ws-results"></div>
  <div id="ws-history"><div style="font-family:'Orbitron',monospace;font-size:.68rem;color:var(--t2);letter-spacing:.1em;text-transform:uppercase;margin-bottom:9px">${ic('folder',12)} Escaneos Anteriores</div><div id="ws-hist-list"><div style="color:var(--t2);font-size:.78rem">Cargando...</div></div></div>
  </div>`);
  restFP('ws-form');
  if(ST.lastScan)renderScanR(ST.lastScan);
  loadScHist();}
async function loadScHist(){try{const sc=await A.listScans();const el=document.getElementById('ws-hist-list');if(!el)return;if(!sc.length){el.innerHTML=`<div style="color:var(--t2);font-size:.78rem">Sin escaneos previos</div>`;return;}el.innerHTML=`<div class="twrap"><table><thead><tr><th>ID</th><th>Iface</th><th>Banda</th><th>APs</th><th>Estado</th><th>Inicio</th><th></th></tr></thead><tbody>${sc.slice(0,10).map(s=>`<tr><td class="mono" style="font-size:.7rem">${s.id}</td><td class="mono" style="font-size:.72rem">${s.interface||'—'}</td><td><span class="badge b-c">${s.band||'—'}</span></td><td><strong>${s.access_points?.length||0}</strong></td><td>${stb(s.status)}</td><td class="mono" style="font-size:.68rem;color:var(--t2)">${fd(s.started_at)}</td><td><button class="btn btn-gh btn-xs" onclick="loadScanR('${s.id}')">Ver</button></td></tr>`).join('')}</tbody></table></div>`;}catch{}}
async function startScan(){const iface=document.getElementById('ws-if')?.value,band=document.getElementById('ws-band')?.value||'bg',dur=parseInt(document.getElementById('ws-dur')?.value)||30,ch=document.getElementById('ws-ch')?.value,bssid=document.getElementById('ws-bssid')?.value?.trim(),essid=document.getElementById('ws-essid')?.value?.trim();if(!iface){toast('Selecciona interfaz','warn');return;}try{document.getElementById('ws-btn').disabled=true;const sc=await A.startScan({interface:iface,band,duration:dur,channel:ch?parseInt(ch):null,target_bssid:bssid||null,target_essid:essid||null});_scan=sc;toast('Escaneo iniciado','success');startScanPoll(sc.id,dur);}catch(e){toast(e.message,'error');const b=document.getElementById('ws-btn');if(b)b.disabled=false;}}
function startScanPoll(id,dur){let el=0;if(_scanPoll)clearInterval(_scanPoll);updateScanSt(null,0,dur,'running');_scanPoll=setInterval(async()=>{el=Math.min(el+2,dur);try{const sc=await A.getScan(id);_scan=sc;updateScanSt(sc,el,dur,sc.status);if(sc.status!=='running'){clearInterval(_scanPoll);_scanPoll=null;ST.lastScan=sc;localStorage.setItem('lastScan',JSON.stringify(sc));renderScanR(sc);loadScHist();const b=document.getElementById('ws-btn');if(b)b.disabled=false;}}catch{}},2000);}
function updateScanSt(sc,el,tot,st){const live=document.getElementById('ws-live');if(!live)return;live.style.display='block';const p=tot?Math.round(el/tot*100):0;const col=st==='running'?'y':st==='completed'?'g':'r';const lbl=st==='running'?'Escaneando':st==='completed'?'Completado':st;live.innerHTML=`<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:var(--bg0);border:1px solid var(--b0);border-radius:8px;padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:6px;font-size:.78rem;color:var(--${col})">${st==='running'?'<div class="spin"></div>':st==='completed'?ic('check',13):ic('x',13)} ${lbl}</span><span class="mono" style="font-size:.72rem;color:var(--t2)">${el}s/${tot}s</span><div class="ptrack" style="flex:1;min-width:120px;max-width:300px"><div class="pbar" style="width:${p}%"></div></div>${sc?`<span style="font-size:.75rem"><span style="color:var(--t2)">APs</span> <strong style="color:var(--g)">${sc.access_points?.length||0}</strong></span><span style="font-size:.75rem"><span style="color:var(--t2)">Clientes</span> <strong style="color:var(--c)">${sc.client_count||0}</strong></span>`:''}${st==='running'?`<button class="btn btn-d btn-sm" style="margin-left:auto" onclick="stopScan()">${ic('stop',11)} Detener</button>`:''}</div>`;}async function stopScan(){if(!_scan)return;try{await A.stopScan(_scan.id);toast('Escaneo detenido','success');}catch(e){toast(e.message,'error');}
  if(_scanPoll){clearInterval(_scanPoll);_scanPoll=null;}
  const b=document.getElementById('ws-btn');if(b)b.disabled=false;
  try{const sc=await A.getScan(_scan.id);if(sc){_scan=sc;ST.lastScan=sc;try{localStorage.setItem('lastScan',JSON.stringify(sc));}catch(e){}const tot=parseInt(document.getElementById('ws-dur')?.value)||30;updateScanSt(sc,tot,tot,sc.status==='running'?'completed':sc.status);renderScanR(sc);loadScHist();}}catch(e){}}
async function loadScanR(id){try{const sc=await A.getScan(id);ST.lastScan=sc;localStorage.setItem('lastScan',JSON.stringify(sc));renderScanR(sc);}catch(e){toast(e.message,'error');}}
function renderScanR(scan){
  const el=document.getElementById('ws-results');if(!el)return;
  const aps=scan.access_points||[],cli=scan.clients||[],sorted=[...aps].sort((a,b)=>b.power-a.power);
  el.innerHTML=`<div class="card" style="margin-bottom:16px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px"><div class="ctitle" style="margin-bottom:0">${ic('wifi')} APs (${aps.length})</div><div style="display:flex;gap:6px;align-items:center"><span class="badge b-c">${scan.band}</span>${stb(scan.status)}${scan.id?`<button class="btn btn-gh btn-sm" onclick="loadPnl('${scan.id}')" title="Analiza las probe requests para detectar candidatos a Evil Twin">${ic('eye',12)} Analizar PNL</button>`:''}</div></div>
  ${!aps.length?`<div class="empty" style="padding:24px">${ic('wifi',32)}<h3>Sin APs</h3></div>`:`<div class="twrap"><table><thead><tr><th>ESSID</th><th>BSSID</th><th>Señal</th><th>CH</th><th>Seguridad</th><th>Fab.</th><th>Cli</th><th>Acciones</th></tr></thead><tbody>
  ${sorted.map(ap=>`<tr class="ws-ap${_wsMarked.has(ap.bssid)?' ws-mark':''}" style="cursor:pointer" title="Clic para marcar/desmarcar este AP" onclick="wsToggleMark('${ap.bssid}',this)"><td><div style="display:flex;align-items:center;gap:5px"><strong>${ap.essid||'<oculto>'}</strong>${ap.is_hidden?`<span class="badge b-x" style="font-size:.56rem">OCU</span>`:''}</div></td><td class="mono" style="font-size:.7rem;color:var(--t2)">${ap.bssid}</td><td><div style="display:flex;align-items:center;gap:4px">${sigb(ap.power)}<span class="mono" style="font-size:.66rem;color:var(--t2)">${ap.power}</span></div></td><td class="mono" style="font-weight:600">${ap.channel||'—'}</td><td>${sbadge(ap.security||'?')} ${ap.wps?`<span class="badge b-y" style="font-size:.56rem">WPS</span>`:''}</td><td style="font-size:.7rem;color:var(--t2);max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ap.manufacturer||'—'}</td><td onclick="event.stopPropagation()">${(ap.clients?.length||0)>0?`<button class="btn btn-gh btn-xs" title="Ver clientes conectados a este AP" onclick="wsShowClients('${ap.bssid}','${(ap.essid||'').replace(/'/g,"\\'")}')">👥 ${ap.clients.length}</button>`:`<span style="color:var(--t2);font-weight:700">0</span>`}</td><td onclick="event.stopPropagation()"><div style="display:flex;gap:3px"><button class="btn btn-gh btn-xs" title="Capturar handshake de este AP" onclick="goHS('${ap.bssid}','${(ap.essid||'').replace(/'/g,"\\'")}',${ap.channel||6})">${ic('key',11)} HS</button>${ST.activeSession?`<button class="btn btn-gh btn-xs" title="Añadir como hallazgo a la sesión" onclick="qkF('${ap.bssid}','${(ap.essid||'').replace(/'/g,"\\'")}','${ap.security||'?'}')">${ic('plus',11)}</button>`:''}</div></td></tr>`).join('')}
  </tbody></table></div>`}
  </div>
  <div id="ws-pnl"></div>
  ${cli.length?`<div class="card" style="margin-bottom:16px"><div class="ctitle">${ic('wifi')} Clientes (${cli.length})</div><div class="twrap"><table><thead><tr><th>MAC</th><th>Señal</th><th>AP</th><th>Fabricante</th><th>Probes</th></tr></thead><tbody>${cli.map(c=>`<tr><td class="mono" style="font-size:.76rem">${c.mac}</td><td><div style="display:flex;align-items:center;gap:4px">${sigb(c.power)}<span class="mono" style="font-size:.66rem;color:var(--t2)">${c.power}</span></div></td><td class="mono" style="font-size:.7rem;color:${c.bssid?'var(--c)':'var(--t2)'}">${c.bssid||'No asoc.'}</td><td style="font-size:.7rem;color:var(--t2)">${c.manufacturer||'—'}</td><td style="font-size:.66rem">${(c.probes||[]).slice(0,3).map(p=>`<span class="kbd">${p}</span>`).join(' ')||'—'}</td></tr>`).join('')}</tbody></table></div></div>`:''}`;
}
async function loadPnl(id){const el=document.getElementById('ws-pnl');if(el)el.innerHTML=`<div class="card" style="margin-bottom:16px"><div style="display:flex;align-items:center;gap:8px;color:var(--y)"><div class="spin"></div> Analizando listas de redes preferidas (PNL)...</div></div>`;try{const p=await A.pnl(id);renderPnl(p);}catch(e){toast(e.message,'error');if(el)el.innerHTML=`<div class="alert ae">${ic('x')}<div>${e.message}</div></div>`;}}
function renderPnl(p){const el=document.getElementById('ws-pnl');if(!el)return;const cands=p.evil_twin_candidates||[],uniq=p.unique_probed_networks||[],cls=p.clients||[];
  el.innerHTML=`<div class="card card-c" style="margin-bottom:16px"><div class="ctitle">${ic('eye')} Análisis PNL — Inteligencia para Evil Twin</div>
    <div class="hint" style="margin-bottom:12px">${ic('info',11)}Redes que buscan los clientes (probe requests). Las que se buscan pero <b>no se emiten</b> en la zona son candidatas perfectas a Evil Twin: el dispositivo se auto-conectará si emites una con ese nombre.</div>
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      ${[['Clientes',p.total_clients,'var(--c)'],['Asociados',p.associated_clients,'var(--g)'],['Libres',p.unassociated_clients,'var(--y)']].map(([l,v,c])=>`<div style="flex:1;min-width:90px;text-align:center;padding:11px;background:var(--bg3);border-radius:8px;border:1px solid var(--b0)"><div style="font-family:'Orbitron',monospace;font-size:1.4rem;font-weight:700;color:${c}">${v!=null?v:0}</div><div style="font-size:.62rem;color:var(--t2);text-transform:uppercase;margin-top:2px">${l}</div></div>`).join('')}
    </div>
    ${cands.length?`<div style="padding:11px 14px;background:var(--r2);border:1px solid var(--r);border-left:3px solid var(--r);border-radius:var(--r);margin-bottom:12px"><div style="color:var(--r);font-family:'Orbitron',monospace;font-size:.66rem;text-transform:uppercase;letter-spacing:.12em;margin-bottom:7px">${ic('warn',11)} Candidatos a Evil Twin</div>${cands.map(s=>`<div style="color:var(--o);font-size:.8rem;margin-bottom:3px;display:flex;align-items:center;gap:6px"><span>• <strong>"${s}"</strong> — buscada por clientes no asociados</span>${ST.activeSession?'':''}</div>`).join('')}</div>`:`<div class="alert ai" style="margin-bottom:12px">${ic('info')}<div>Sin candidatos claros a Evil Twin en este escaneo.</div></div>`}
    ${uniq.length?`<div style="font-size:.74rem;color:var(--t2);margin-bottom:12px"><strong style="color:var(--t1)">Todas las SSID buscadas:</strong> ${uniq.map(s=>`<span class="kbd">${s}</span>`).join(' ')}</div>`:''}
    ${cls.length?`<div style="font-size:.62rem;color:var(--t2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Clientes y sus probes</div>${cls.map(c=>`<div style="padding:9px 12px;background:var(--bg3);border-radius:6px;margin-bottom:6px;border-left:2px solid ${(c.vulnerability_notes||[]).length?'var(--y)':'var(--c)'}"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><span class="mono" style="font-size:.76rem;font-weight:600">${c.client_mac}</span><span style="font-size:.72rem;color:var(--p)">${c.manufacturer||'Desconocido'}</span><span class="badge ${c.is_associated?'b-g':'b-x'}">${c.is_associated?'Asociado':'Libre'}</span></div>${(c.probed_networks||[]).length?`<div style="font-size:.7rem;color:var(--t2);margin-top:4px">Busca: ${c.probed_networks.map(s=>`<span class="kbd">${s}</span>`).join(' ')}</div>`:''}${(c.vulnerability_notes||[]).map(n=>`<div style="font-size:.68rem;color:var(--y);margin-top:3px">→ ${n}</div>`).join('')}</div>`).join('')}`:''}
  </div>`;el.scrollIntoView({behavior:'smooth',block:'nearest'});}
function goHS(bssid,essid,ch){setIP({'hs-bssid':bssid,'hs-essid':essid,'hs-ch':ch,'cr-bssid':bssid,'cr-essid':essid});goto('sniffing');}
async function qkF(bssid,essid,sec){if(!ST.activeSession){toast('Activa una sesión primero','warn');return;}if(ST.activeSession.status==='closed'){toast('La sesión activa está cerrada','warn');return;}const sv=sec==='OPEN'?'critical':sec==='WEP'?'high':sec==='WPA'?'medium':'low';const b={session_id:ST.activeSession.id,severity:sv,category:'wifi',title:sec==='OPEN'?'Red WiFi sin cifrado (OPEN)':sec==='WEP'?'Cifrado WEP obsoleto':sec==='WPA'?'WPA v1 obsoleto':'Seguridad WiFi — '+(essid||bssid),description:sec==='OPEN'?`La red "${essid}" (${bssid}) opera sin cifrado. El tráfico puede ser interceptado.`:`Red "${essid}" (${bssid}) usa ${sec}.`,evidence:`BSSID: ${bssid}\nESSID: ${essid||'oculto'}\nSeguridad: ${sec}`,recommendation:sec==='OPEN'?'Configurar WPA3-SAE o WPA2-PSK con contraseña de mínimo 16 caracteres.':sec==='WEP'?'Migrar a WPA2/WPA3 inmediatamente.':'Actualizar a WPA3-SAE si el hardware lo soporta.'};try{await A.addFinding(ST.activeSession.id,b);const u=await A.getSession(ST.activeSession.id).catch(()=>null);if(u)setSession(u);toast(`Hallazgo añadido a "${ST.activeSession.name}"`,'success');}catch(e){toast(e.message,'error');}}
async function showOUI(mac){try{const r=await A.oui(mac);showModal('OUI / Fabricante',`<div style="padding:13px;background:var(--bg0);border-radius:8px;border:1px solid var(--b1);margin-bottom:10px"><div class="mono" style="font-size:1rem;color:var(--c);margin-bottom:7px">${r.mac}</div><div style="font-size:.84rem;margin-bottom:5px"><span style="color:var(--t2)">Fabricante:</span> <strong>${r.manufacturer||'Desconocido'}</strong></div><div style="font-size:.8rem"><span style="color:var(--t2)">OUI:</span> <span class="mono">${r.oui||'—'}</span></div></div>${r.is_randomized?`<div class="alert aw">${ic('warn')}<div>MAC aleatorizada (privacidad)</div></div>`:`<span class="badge b-g">✓ MAC estática</span>`}`,`<button class="btn btn-gh" onclick="closeModal()">Cerrar</button>`);}catch(e){toast(e.message,'error');}}
// ======== RECON ========
// ─── Recon (nmap / arp-scan): mapa de red persistente con escaneos en 2º plano ───
let _recMap=null,_recPoll=null,_recOpen={};
let _fg=null,_recGraphIds=null,_rhColor='',_recResizeBound=false;
let _recView='grafo';try{_recView=localStorage.getItem('rec-view')||'grafo';}catch(e){}
const REC_SCANS=[['stealth','Silencioso','Rápido y sigiloso · -sS -p-'],['full','Completo','Puertos + versiones + SO + vulnerabilidades · lento'],['udp','UDP','Top 100 puertos UDP · -sV -sC']];
const REC_STCOL={completed:'g',running:'y',failed:'r'};
function _recKey(ip){return ip.split('.').map(n=>('00'+n).slice(-3)).join('.');}
function _recBusy(m){return !!(m&&(m.discovering||Object.values(m.hosts||{}).some(h=>Object.values(h.scans||{}).some(s=>s.status==='running'))));}

async function recon(){
  setC(`<div class="sup">
    <div class="card" id="rec-bar" data-pp="rec-bar" style="padding:14px 16px;margin-bottom:14px">
      <div style="display:flex;gap:9px;align-items:flex-end;flex-wrap:wrap">
        <div class="frow" style="flex:1;min-width:190px;margin-bottom:0"><label>Objetivo <span class="tip" data-tip="Para DESCUBRIR hosts: un rango CIDR (192.168.1.0/24). Para ESCANEAR un host suelto: su IP (192.168.1.10). La herramienta (arp-scan o nmap) la elijo yo automáticamente.">?</span></label><input id="rec-tgt" class="inp" placeholder="192.168.1.0/24   ·   ó   192.168.1.10" data-p></div>
        <button class="btn btn-g" id="rec-disc-btn" onclick="reconDiscoverUI()">${ic('search')} Descubrir hosts</button>
        <button class="btn btn-p" onclick="reconAddIP()">${ic('plus')} Añadir IP</button>
      </div>
      <div id="rec-status" style="margin-top:11px"></div>
    </div>
    <div id="rec-views" style="display:flex;gap:6px;margin-bottom:12px">${reconViewTabs()}</div>
    <div id="rec-map"></div>
  </div>`);
  await reconRefresh();
}

function reconViewTabs(){
  return [['grafo','Grafo','search'],['resumen','Resumen','report'],['detalle','Detalle','warn']]
    .map(([v,l,i])=>`<button class="btn ${_recView===v?'btn-p':'btn-gh'} btn-sm" onclick="setRecView('${v}')">${ic(i,12)} ${l}</button>`).join('');
}
function setRecView(v){
  _recView=v;try{localStorage.setItem('rec-view',v);}catch(e){}
  const tb=document.getElementById('rec-views');if(tb)tb.innerHTML=reconViewTabs();
  if(v!=='grafo'&&_fg){_fg.destroy();_fg=null;_recGraphIds=null;}
  renderReconView(_recMap||{hosts:{}});
}

async function reconRefresh(){
  try{_recMap=await A.reconMap();}catch(e){const m=document.getElementById('rec-map');if(m)m.innerHTML=`<div class="card"><div class="alert ae" style="margin-bottom:0">${ic('x')}<div>${e.message}</div></div></div>`;return;}
  renderReconStatus(_recMap);renderReconView(_recMap);reconEnsurePoll();
}

function reconEnsurePoll(){
  if(_recBusy(_recMap)){if(!_recPoll)_recPoll=setInterval(reconPollTick,2500);}
  else if(_recPoll){clearInterval(_recPoll);_recPoll=null;}
}
async function reconPollTick(){
  if(!document.getElementById('rec-map')){clearInterval(_recPoll);_recPoll=null;return;}
  try{_recMap=await A.reconMap();}catch{return;}
  renderReconStatus(_recMap);renderReconView(_recMap);
  if(!_recBusy(_recMap)){clearInterval(_recPoll);_recPoll=null;}
}

function renderReconStatus(map){
  const el=document.getElementById('rec-status');if(!el)return;
  const hosts=Object.values(map.hosts||{}),running=hosts.reduce((n,h)=>n+Object.values(h.scans||{}).filter(s=>s.status==='running').length,0);
  const p=[`<span class="badge b-x">${ic('search',9)} ${hosts.length} host${hosts.length!==1?'s':''}</span>`];
  if(map.discover_via)p.push(`<span style="color:var(--t2)">herramienta: <strong style="color:var(--t1)">${map.discover_via}</strong></span>`);
  if(map.discovering)p.push(`<span style="color:var(--y);display:inline-flex;align-items:center;gap:5px"><div class="spin"></div> descubriendo…</span>`);
  if(running)p.push(`<span style="color:var(--y);display:inline-flex;align-items:center;gap:5px"><div class="spin"></div> ${running} escaneo${running!==1?'s':''} en curso</span>`);
  p.push(`<span style="margin-left:auto;display:flex;gap:6px">${hosts.length?`<button class="btn btn-gh btn-xs" onclick="reconRefresh()">${ic('refresh',11)} Refrescar</button><button class="btn btn-gh btn-xs" onclick="reconClearUI()">${ic('trash',11)} Vaciar</button>`:''}</span>`);
  el.innerHTML=`<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:.74rem">${p.join('')}</div>`;
}

function recEmpty(){return `<div class="card"><div class="empty" style="padding:34px">${ic('search',38)}<h3>Mapa de red vacío</h3><p style="color:var(--t2);font-size:.8rem;max-width:440px;margin:6px auto 0">Introduce un rango (p.ej. <span class="mono">192.168.1.0/24</span>) y pulsa <strong>Descubrir hosts</strong>, o añade una IP suelta con <strong>Añadir IP</strong> para escanearla directamente.</p></div></div>`;}

function renderReconView(map){
  const el=document.getElementById('rec-map');if(!el)return;
  if(_recView!=='grafo'&&_fg){_fg.destroy();_fg=null;_recGraphIds=null;}
  if(_recView==='grafo')renderReconGraph(map);
  else if(_recView==='resumen')renderReconSummary(map);
  else renderReconDetail(map);
}

function renderReconDetail(map){
  const el=document.getElementById('rec-map');if(!el)return;
  const hosts=Object.values(map.hosts||{}).sort((a,b)=>_recKey(a.ip).localeCompare(_recKey(b.ip)));
  if(!hosts.length){el.innerHTML=recEmpty();return;}
  el.innerHTML=`<div class="card" style="padding:14px 16px"><div class="ctitle" style="margin-bottom:12px">${ic('search')} Mapa de red · vista detallada</div>${hosts.map(hostCard).join('')}</div>`;
}

function renderReconSummary(map){
  const el=document.getElementById('rec-map');if(!el)return;
  const hosts=Object.values(map.hosts||{}).sort((a,b)=>_recKey(a.ip).localeCompare(_recKey(b.ip)));
  if(!hosts.length){el.innerHTML=recEmpty();return;}
  el.innerHTML=`<div class="card"><div class="twrap"><table><thead><tr><th></th><th>IP</th><th>Etiqueta</th><th>Host / Fabricante</th><th>Abiertos</th><th>SO</th><th>Escaneos</th><th></th></tr></thead><tbody>${hosts.map(h=>{
    const scans=h.scans||{},openN=new Set();let os=null;
    Object.values(scans).forEach(s=>{(s.ports||[]).forEach(p=>{if(p.state==='open')openN.add(p.port);});if(s.os&&!os)os=s.os;});
    const dot=h.color?`<span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${h.color};box-shadow:0 0 0 2px var(--bg2)"></span>`:'<span style="display:inline-block;width:11px;height:11px;border-radius:50%;border:1px solid var(--b1)"></span>';
    const st=REC_SCANS.filter(([t])=>scans[t]).map(([t,l])=>`<span class="badge b-${REC_STCOL[scans[t].status]||'x'}" style="font-size:.55rem" title="${l}">${l[0]}</span>`).join(' ');
    return `<tr style="cursor:pointer" onclick="reconHostModal('${h.ip}')"><td>${dot}</td><td class="mono" style="color:var(--c);font-weight:600">${h.ip}</td><td>${h.label?`<strong>${h.label}</strong>`:'<span style="color:var(--t3)">—</span>'}</td><td style="font-size:.74rem;color:var(--t2)">${h.hostname||h.vendor||'—'}</td><td>${openN.size?`<span class="badge b-g">${openN.size}</span>`:'<span style="color:var(--t3)">—</span>'}</td><td style="font-size:.7rem;color:var(--t2)">${os?(os.length>22?os.slice(0,22)+'…':os):'—'}</td><td>${st||'<span style="color:var(--t3)">—</span>'}</td><td><button class="btn btn-gh btn-xs" onclick="event.stopPropagation();reconHostModal('${h.ip}')">Abrir</button></td></tr>`;
  }).join('')}</tbody></table></div></div>`;
}

function reconGateway(map){
  const hosts=Object.keys(map.hosts||{});if(!hosts.length)return null;
  if(map.gateway&&map.hosts[map.gateway])return map.gateway;
  const one=hosts.find(ip=>/\.1$/.test(ip));if(one)return one;
  return hosts.slice().sort((a,b)=>_recKey(a).localeCompare(_recKey(b)))[0];
}

function reconGraphData(map){
  const hosts=Object.values(map.hosts||{}),gw=reconGateway(map);
  const sats=hosts.filter(h=>h.ip!==gw);
  const cx=480,cy=340,R=120+sats.length*9;          // anillo alrededor del gateway
  const nodes=hosts.map(h=>{
    const scans=h.scans||{},openN=new Set();let running=false;
    Object.values(scans).forEach(s=>{(s.ports||[]).forEach(p=>{if(p.state==='open')openN.add(p.port);});if(s.status==='running')running=true;});
    const isGw=h.ip===gw;
    const n={id:h.ip,label:h.label||h.ip,color:h.color||(isGw?'#ff9f43':'#54a0ff'),
      r:(isGw?17:11)+Math.min(13,openN.size*1.7),running,hub:isGw};
    if(h.x!=null&&h.y!=null){n.x=h.x;n.y=h.y;n.pin=true;}                       // guardado → fijado
    else if(isGw){n.x=cx;n.y=cy;n.center=true;}                                // gateway anclado al centro
    else{const i=sats.indexOf(h),a=(i/Math.max(1,sats.length))*2*Math.PI;n.x=cx+R*Math.cos(a);n.y=cy+R*Math.sin(a);}
    return n;
  });
  return {nodes,links:sats.map(h=>({source:gw,target:h.ip})),gw};
}

function reconSizeGraph(){
  const svg=document.getElementById('rec-svg');if(!svg)return;
  const top=svg.getBoundingClientRect().top;
  const lg=document.getElementById('rec-legend'),lh=lg?lg.getBoundingClientRect().height:0;
  svg.style.height=Math.max(340,Math.round(window.innerHeight-top-lh-40))+'px';
}

function renderReconLegend(map){
  const el=document.getElementById('rec-legend');if(!el)return;
  const entries=Object.entries(map.legend||{}).filter(([c,l])=>l&&(''+l).trim());
  el.innerHTML=entries.length
    ?entries.map(([c,l])=>`<span style="display:inline-flex;align-items:center;gap:6px;font-size:.7rem;color:var(--t1)"><span style="width:12px;height:12px;border-radius:50%;background:${c};box-shadow:0 0 0 2px var(--bg2)"></span>${l}</span>`).join('')
      +`<button class="btn btn-gh btn-xs" style="margin-left:auto" onclick="reconLegendModal()">${ic('edit',10)} Editar</button>`
    :`<span style="font-size:.66rem;color:var(--t3)">Sin leyenda — pulsa <strong>Leyenda</strong> para dar significado a los colores (p.ej. rojo = comprometido).</span>`;
}

function renderReconGraph(map){
  const el=document.getElementById('rec-map');if(!el)return;
  const hosts=Object.values(map.hosts||{});
  if(!hosts.length){if(_fg){_fg.destroy();_fg=null;_recGraphIds=null;}el.innerHTML=recEmpty();return;}
  if(!document.getElementById('rec-svg')){
    el.innerHTML=`<div class="card" style="padding:0;overflow:hidden">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid var(--b0);flex-wrap:wrap">
        <div class="ctitle" style="margin-bottom:0">${ic('search')} Grafo de red</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span style="font-size:.64rem;color:var(--t2)">arrastra · rueda: zoom · clic: detalles · doble-clic: soltar</span><button class="btn btn-gh btn-xs" onclick="reconLegendModal()">${ic('info',10)} Leyenda</button><button class="btn btn-gh btn-xs" onclick="_fg&&_fg.fit()">${ic('search',10)} Encajar</button></div>
      </div>
      <svg id="rec-svg" style="width:100%;display:block;background:radial-gradient(circle at 50% 42%,var(--bg2),var(--bg0));cursor:grab;touch-action:none"></svg>
      <div id="rec-legend" style="padding:8px 14px;border-top:1px solid var(--b0);display:flex;gap:14px;flex-wrap:wrap;align-items:center"></div>
    </div>`;
    _fg=new ForceGraph(document.getElementById('rec-svg'));
    _fg.on('nodeClick',id=>reconHostModal(id));
    _fg.on('nodeMove',(id,x,y)=>A.reconUpdateHost(id,{x,y}).catch(()=>{}));
    _recGraphIds=null;
    if(!_recResizeBound){_recResizeBound=true;window.addEventListener('resize',reconSizeGraph);}
  }
  renderReconLegend(map);reconSizeGraph();
  const {nodes,links}=reconGraphData(map);
  const ids=nodes.map(n=>n.id).sort().join(',');
  if(ids!==_recGraphIds){_fg.setData(nodes,links);_recGraphIds=ids;setTimeout(()=>{if(_fg){reconSizeGraph();_fg.fit();}},480);}
  else _fg.update(nodes);
}

function reconLegendModal(){
  const lg=(_recMap&&_recMap.legend)||{};
  const body=`<div style="font-size:.78rem;color:var(--t2);margin-bottom:12px">Asigna un significado a cada color. Los que dejes en blanco no salen en la leyenda. Luego colorea cada host desde su ficha.</div>
    ${REC_PALETTE.map(c=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span style="width:22px;height:22px;border-radius:50%;background:${c};flex-shrink:0;box-shadow:0 0 0 2px var(--bg2)"></span><input class="inp lg-in" data-c="${c}" value="${(lg[c]||'').replace(/"/g,'&quot;')}" placeholder="p.ej. Comprometido, Objetivo, IoT, servidor..." data-nopersist></div>`).join('')}`;
  showModal('Leyenda de colores',body,`<button class="btn btn-gh" onclick="closeModal()">Cancelar</button><button class="btn btn-g" onclick="reconSaveLegend()">${ic('check')} Guardar</button>`,true);
}
async function reconSaveLegend(){
  const lg={};document.querySelectorAll('.lg-in').forEach(i=>{const v=(i.value||'').trim();if(v)lg[i.dataset.c]=v;});
  try{await A.reconSetLegend(lg);if(_recMap)_recMap.legend=lg;closeModal();renderReconLegend(_recMap);toast('Leyenda guardada','success');}
  catch(e){toast(e.message,'error');}
}

function hostCard(h){
  const open=_recOpen[h.ip],scans=h.scans||{},openPorts=new Set();let os=null;
  Object.values(scans).forEach(s=>{(s.ports||[]).forEach(x=>{if(x.state==='open')openPorts.add(x.port+'/'+x.protocol);});if(s.os&&!os)os=s.os;});
  const badges=REC_SCANS.filter(([t])=>scans[t]).map(([t,l])=>{const s=scans[t],c=REC_STCOL[s.status]||'x';return `<span class="badge b-${c}" style="font-size:.6rem" title="${l}: ${s.status}">${s.status==='running'?'◍':s.status==='completed'?'✓':'✗'} ${l}</span>`;}).join('');
  const btns=REC_SCANS.map(([t,l,tip])=>{const r=scans[t]&&scans[t].status==='running';return `<button class="btn btn-gh btn-xs" ${r?'disabled':''} title="${tip}" onclick="event.stopPropagation();reconScanUI('${h.ip}','${t}')">${r?'<div class="spin"></div>':ic('play',10)} ${l}</button>`;}).join('');
  return `<div class="hitem"><div class="hhdr" onclick="recToggle('${h.ip}')">
    <span style="color:var(--t2);display:inline-block;transition:transform .2s;${open?'transform:rotate(90deg)':''}">▸</span>
    <span class="mono" style="font-size:.9rem;color:var(--c);font-weight:600">${h.ip}</span>
    ${h.hostname?`<span style="font-size:.74rem;color:var(--t2)">${h.hostname}</span>`:''}
    ${h.vendor?`<span class="badge b-x" style="font-size:.58rem">${h.vendor}</span>`:''}
    ${openPorts.size?`<span class="badge b-g">${openPorts.size} abierto${openPorts.size!==1?'s':''}</span>`:''}
    ${os?`<span class="badge b-p" style="font-size:.58rem" title="${os}">SO: ${os.length>20?os.slice(0,20)+'…':os}</span>`:''}
    ${badges}
    <span style="display:flex;gap:4px;margin-left:auto;flex-wrap:wrap" onclick="event.stopPropagation()">
      ${btns}
      <button class="btn btn-gh btn-xs" title="Volcar los puertos/vulns de este host como hallazgo a la sesión activa" onclick="reconHostFinding('${h.ip}')">${ic('plus',10)} Sesión</button>
      <button class="btn btn-d btn-xs btn-ico" title="Quitar del mapa" onclick="reconDelHostUI('${h.ip}')">${ic('trash',11)}</button>
    </span>
  </div>${open?`<div class="hdetail">${hostDetail(h)}</div>`:''}</div>`;
}

function hostDetail(h){
  const scans=h.scans||{},done=REC_SCANS.filter(([t])=>scans[t]);
  if(!done.length)return `<div style="color:var(--t2);font-size:.78rem">Sin escaneos todavía. Usa <strong>Silencioso</strong>, <strong>Completo</strong> o <strong>UDP</strong> — los resultados se irán acumulando aquí, uno debajo de otro.</div>`;
  return done.map(([t])=>scanResultHTML(scans[t])).join('');
}

function scanResultHTML(s){
  const openPorts=(s.ports||[]).filter(p=>p.state==='open'),scripts=[];
  (s.ports||[]).forEach(p=>Object.entries(p.scripts||{}).forEach(([id,out])=>scripts.push({port:p.port,proto:p.protocol,id,out})));
  let inner='';
  if(s.status==='running')inner=`<div style="display:flex;align-items:center;gap:8px;color:var(--y);font-size:.8rem"><div class="spin"></div> escaneando…</div><div class="ptrack" style="margin-top:7px"><div class="pbar ind"></div></div>`;
  else if(s.status==='failed')inner=`<div class="alert ae" style="margin-bottom:0">${ic('x')}<div>${s.error||'Falló el escaneo'}</div></div>`;
  else{
    inner=openPorts.length?`<div class="twrap"><table><thead><tr><th>Puerto</th><th>Servicio</th><th>Versión</th></tr></thead><tbody>${openPorts.map(p=>`<tr><td><span class="badge b-g mono">${p.port}/${p.protocol}</span></td><td><strong>${p.service||'—'}</strong></td><td style="font-size:.72rem;color:var(--t2)">${[p.product,p.version,p.extra].filter(Boolean).join(' ')||'—'}</td></tr>`).join('')}</tbody></table></div>`:`<div style="color:var(--t2);font-size:.76rem">Sin puertos abiertos detectados.</div>`;
    if(s.os)inner+=`<div style="margin-top:8px;font-size:.76rem"><span style="color:var(--t2)">Sistema operativo:</span> <span class="badge b-p">${s.os}</span></div>`;
    if(scripts.length)inner+=`<div style="margin-top:10px"><div style="font-size:.62rem;color:var(--y);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">${ic('warn',10)} Vulnerabilidades (NSE)</div>${scripts.map(sc=>`<div style="margin-bottom:6px;padding:7px;background:var(--bg0);border-radius:5px;border-left:3px solid var(--y)"><div style="font-size:.66rem;font-weight:700;color:var(--y);margin-bottom:3px">${sc.port}/${sc.proto} · ${sc.id}</div><pre style="font-size:.62rem;color:var(--t2);white-space:pre-wrap;max-height:220px;overflow-y:auto;line-height:1.45;margin:0">${(sc.out||'').replace(/</g,'&lt;')}</pre></div>`).join('')}</div>`;
  }
  const col=REC_STCOL[s.status]||'x';
  return `<div style="margin-bottom:11px;border:1px solid var(--b0);border-radius:8px;overflow:hidden">
    <div style="display:flex;align-items:center;gap:8px;padding:7px 11px;background:var(--bg3);flex-wrap:wrap">
      <span class="badge b-${col}">${s.label||s.type}</span>
      ${s.status==='completed'?`<span class="badge b-x" style="font-size:.58rem">${openPorts.length} abierto${openPorts.length!==1?'s':''}</span>`:''}
      ${s.finished_at?`<span style="font-size:.66rem;color:var(--t2)">${fd(s.finished_at)}</span>`:''}
      ${s.command?`<span class="mono" style="font-size:.6rem;color:var(--t3);margin-left:auto;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${s.command}">${s.command}</span>`:''}
    </div>
    <div style="padding:10px 11px">${inner}</div>
  </div>`;
}

function recToggle(ip){_recOpen[ip]=!_recOpen[ip];renderReconView(_recMap);}

async function reconDiscoverUI(){
  const t=(document.getElementById('rec-tgt')?.value||'').trim();
  if(!t){toast('Introduce un rango CIDR (p.ej. 192.168.1.0/24)','warn');return;}
  const btn=document.getElementById('rec-disc-btn');if(btn)btn.disabled=true;
  try{_recMap=await A.reconDiscover(t);renderReconStatus(_recMap);renderReconView(_recMap);reconEnsurePoll();}
  catch(e){toast(e.message,'error');}
  if(btn)btn.disabled=false;
}

async function reconAddIP(){
  const ip=(document.getElementById('rec-tgt')?.value||'').trim();
  if(!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)){toast('Introduce una IP válida (p.ej. 192.168.1.10)','warn');return;}
  try{await A.reconAddHost(ip);_recOpen[ip]=true;await reconRefresh();toast(`${ip} añadido al mapa`,'success');}
  catch(e){toast(e.message,'error');}
}

async function reconScanUI(ip,type){
  try{await A.reconScan(ip,type);_recOpen[ip]=true;await reconRefresh();toast(`Escaneo lanzado en ${ip}`,'success');}
  catch(e){toast(e.message,'error');}
}

async function reconDelHostUI(ip){
  confirmDlg(`¿Quitar <b>${ip}</b> del mapa? Se pierden sus escaneos.`,async()=>{try{await A.reconDelHost(ip);delete _recOpen[ip];await reconRefresh();}catch(e){toast(e.message,'error');}});
}

async function reconClearUI(){
  confirmDlg('¿Vaciar todo el mapa de red? Se borran todos los hosts y sus escaneos.',async()=>{try{await A.reconClear();_recOpen={};await reconRefresh();toast('Mapa vaciado','success');}catch(e){toast(e.message,'error');}});
}

const REC_PALETTE=['#ff5c5c','#ff9f43','#feca57','#1dd1a1','#54a0ff','#5f27cd','#ee5253','#c8d6e5'];
function reconHostModal(ip){
  const h=(_recMap&&_recMap.hosts||{})[ip];if(!h)return;
  const scans=h.scans||{};_rhColor=h.color||'';
  const meta=[h.hostname,h.vendor,h.mac].filter(Boolean).join(' · ')||'Sin metadatos';
  const body=`
    <div style="margin-bottom:14px">
      <div class="mono" style="font-size:1.15rem;color:var(--c);font-weight:700">${h.ip}</div>
      <div style="font-size:.76rem;color:var(--t2);margin-top:3px">${meta}</div>
      <div style="font-size:.68rem;color:var(--t3);margin-top:2px">Descubierto por ${h.discovered_via||'—'}</div>
    </div>
    <div class="fgrid">
      <div class="frow"><label>Etiqueta / título</label><input id="rh-label" class="inp" value="${(h.label||'').replace(/"/g,'&quot;')}" placeholder="p.ej. Router, TV del salón..." data-nopersist></div>
      <div class="frow"><label>Color del nodo</label><div id="rh-pal" style="display:flex;gap:6px;flex-wrap:wrap;padding-top:6px">${REC_PALETTE.map(c=>`<span class="rh-sw" data-c="${c}" onclick="reconPickColor('${c}')" style="width:24px;height:24px;border-radius:50%;background:${c};cursor:pointer;border:2px solid ${h.color===c?'var(--t0)':'transparent'}"></span>`).join('')}<span class="rh-sw" data-c="" onclick="reconPickColor('')" title="Por defecto" style="width:24px;height:24px;border-radius:50%;background:var(--bg4);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.72rem;color:var(--t2);border:2px solid ${!h.color?'var(--t0)':'var(--b1)'}">×</span></div></div>
    </div>
    <div class="frow"><label>Notas</label><textarea id="rh-notes" class="inp" style="min-height:70px" placeholder="Notas libres sobre esta máquina..." data-nopersist>${h.notes||''}</textarea></div>
    <div style="display:flex;gap:7px;margin:8px 0 4px;flex-wrap:wrap;align-items:center">
      <span style="font-size:.72rem;color:var(--t2)">Escanear puertos:</span>
      ${REC_SCANS.map(([t,l,tip])=>{const r=scans[t]&&scans[t].status==='running';return `<button class="btn btn-gh btn-sm" ${r?'disabled':''} title="${tip}" onclick="reconScanUI('${ip}','${t}')">${r?'<div class="spin"></div>':ic('play',11)} ${l}</button>`;}).join('')}
      <button class="btn btn-gh btn-sm" onclick="reconHostFinding('${ip}')">${ic('plus',11)} A sesión</button>
    </div>
    <div id="rh-detail" style="border-top:1px solid var(--b0);margin-top:12px;padding-top:12px">${hostDetail(h)}</div>`;
  showModal(h.label?`${h.label} · ${h.ip}`:h.ip,body,
    `<button class="btn btn-gh btn-d" onclick="reconDelHostUI('${ip}')">${ic('trash')} Quitar</button><button class="btn btn-gh" onclick="closeModal()">Cerrar</button><button class="btn btn-g" onclick="reconSaveHost('${ip}')">${ic('check')} Guardar</button>`,true);
}
function reconPickColor(c){_rhColor=c;document.querySelectorAll('#rh-pal .rh-sw').forEach(sw=>{const own=sw.dataset.c||'';sw.style.border='2px solid '+(own===c?'var(--t0)':(own?'transparent':'var(--b1)'));});}
async function reconSaveHost(ip){
  const label=(document.getElementById('rh-label')?.value||'').trim();
  const notes=(document.getElementById('rh-notes')?.value||'');
  try{
    await A.reconUpdateHost(ip,{label,notes,color:_rhColor||''});
    const u=await A.reconMap().catch(()=>null);if(u)_recMap=u;
    closeModal();renderReconStatus(_recMap);renderReconView(_recMap);toast('Host actualizado','success');
  }catch(e){toast(e.message,'error');}
}

async function reconHostFinding(ip){
  if(!ST.activeSession){toast('Activa una sesión primero','warn');return;}
  if(ST.activeSession.status==='closed'){toast('La sesión activa está cerrada','warn');return;}
  const h=(_recMap&&_recMap.hosts||{})[ip];if(!h){toast('Host no encontrado','warn');return;}
  const openPorts=[],scripts=[];let os=null;
  Object.values(h.scans||{}).forEach(s=>{if(s.os&&!os)os=s.os;(s.ports||[]).forEach(p=>{if(p.state==='open')openPorts.push(p);Object.entries(p.scripts||{}).forEach(([id,out])=>scripts.push(`${p.port}/${p.protocol} ${id}:\n${out}`));});});
  if(!openPorts.length){toast('Escanea puertos primero: este host no tiene resultados','warn');return;}
  const lines=openPorts.map(p=>`${p.port}/${p.protocol}  ${p.service||''}  ${[p.product,p.version].filter(Boolean).join(' ')}`.trim()).join('\n');
  const hasVuln=scripts.length>0;
  const b={session_id:ST.activeSession.id,severity:hasVuln?'high':'medium',category:'network',
    title:`Servicios expuestos en ${ip}${h.hostname?' ('+h.hostname+')':''}`,
    description:`El host ${ip}${h.hostname?' ('+h.hostname+')':''}${os?', '+os+',':''} expone ${openPorts.length} puerto(s) en la red.${hasVuln?' El análisis NSE de vulnerabilidades reportó hallazgos (ver evidencia).':''}`,
    evidence:`Puertos abiertos:\n${lines}${hasVuln?'\n\n--- NSE vuln ---\n'+scripts.join('\n\n'):''}`,
    recommendation:'Revisar la exposición de cada servicio, cerrar o segmentar los puertos innecesarios, parchear los servicios vulnerables y restringir el acceso por firewall a redes de confianza.'};
  try{await A.addFinding(ST.activeSession.id,b);const u=await A.getSession(ST.activeSession.id).catch(()=>null);if(u)setSession(u);toast('Hallazgo añadido a la sesión','success');}
  catch(e){toast(e.message,'error');}
}

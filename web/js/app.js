// WFAudit · bootstrap — arranque de la aplicación (init)
async function init(){
  document.addEventListener('mouseover',e=>{const t=e.target.closest&&e.target.closest('.tip');if(t)showTip(t);});
  document.addEventListener('mouseout',e=>{const t=e.target.closest&&e.target.closest('.tip');if(t)hideTip();});
  document.addEventListener('input',e=>persistInput(e.target),true);
  document.addEventListener('change',e=>persistInput(e.target),true);
  applyTheme(ST.theme);updateSB();
  // Si el backend exige token y no lo tenemos, lo pedimos antes de seguir
  // (evita una cascada de 401 al arrancar). Al guardarlo se recarga la página.
  try{const a=await A.authStatus();if(a&&a.require_auth&&!AUTH_TOKEN){_authPrompting=true;promptToken(false);return;}}catch{}
  await checkHealth();await pollProcs();await pollAttacks();
  goto('dashboard');
  setInterval(checkHealth,30000);setInterval(pollProcs,5000);setInterval(pollAttacks,5000);
  startClock();
  if(ST.activeSession?.id){A.getSession(ST.activeSession.id).then(s=>{if(s)setSession(s);}).catch(()=>{});}
}
init();

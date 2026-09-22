// WFAudit · bootstrap — arranque de la aplicación (init)
async function init(){
  document.addEventListener('mouseover',e=>{const t=e.target.closest&&e.target.closest('.tip');if(t)showTip(t);});
  document.addEventListener('mouseout',e=>{const t=e.target.closest&&e.target.closest('.tip');if(t)hideTip();});
  document.addEventListener('input',e=>persistInput(e.target),true);
  document.addEventListener('change',e=>persistInput(e.target),true);
  applyTheme(ST.theme);updateSB();
  await checkHealth();await pollProcs();await pollAttacks();
  goto('dashboard');
  setInterval(checkHealth,30000);setInterval(pollProcs,5000);setInterval(pollAttacks,5000);
  startClock();
  if(ST.activeSession?.id){A.getSession(ST.activeSession.id).then(s=>{if(s)setSession(s);}).catch(()=>{});}
}
init();

import { wireMenu } from './router.js';
import { wireAuth, applyRoleUI } from './auth.js';
import { state, initCommonData, fillMessSelects, api } from './api.js';
import { go } from './util.js';

import { initReservasi } from './pages/reservasi.js';
import { initKamar } from './pages/kamar.js';
import { showApproval } from './pages/approval.js';
import { initMess, loadMessQueue } from './pages/mess.js';
import { initJurnal } from './pages/jurnal.js';
import { showStat } from './pages/stat.js';
import { initSettings, onPageShown as settingsOnPageShown } from './pages/settings.js';

function onShow(pid){
  // dipanggil setiap pindah halaman
  if(pid==='page-approval') showApproval();
  if(pid==='page-mess') loadMessQueue();
  if(pid==='page-stat'){
    import('./pages/stat.js').then(mod=>{
      // jika mau selalu realtime saat masuk, kosongkan cache
      mod.invalidateStatKPI?.();
      mod.showStat();
    });
  }
  if(pid.startsWith('page-kelola') || pid === 'page-config') {
    settingsOnPageShown(pid);
  }
}
function onReady(){
  // saat login sukses / restore sesi
  initCommonData().then(()=>fillMessSelects());
  if(state.user?.role === 'admin') {
      api('config.get', {}).then(r => {
        if(r.ok) state.config = {...state.config, ...(r.config||{})};
      });
    }
}

function bootstrap(){
  // wire router
  wireMenu(onShow);
  // wire auth
  wireAuth(applyRoleUI, onReady);
  // init page modules
  initReservasi();
  initKamar();
  initMess();
  initJurnal();
  initSettings();
}
window.addEventListener('DOMContentLoaded', bootstrap);

// --- NAVBAR MOBILE FIX: tutup navbar setelah pilih item halaman (mobile) ---
(function(){
  const navEl = document.getElementById('nav');
  const toggler = document.querySelector('.navbar-toggler');
  if(!navEl || !toggler) return;

  function isMobileView(){
    return getComputedStyle(toggler).display !== 'none';
  }
  function hideNavbar(){
    if(navEl.classList.contains('show')) navEl.classList.remove('show');
  }

  // Tutup setelah klik item halaman (menu utama & sub-menu) — TIDAK untuk .dropdown-toggle
  document.querySelectorAll('#menu a.nav-link[data-page], #menu .dropdown-menu .dropdown-item[data-page]').forEach(a=>{
    a.addEventListener('click', ()=>{
      if(isMobileView()){
        setTimeout(hideNavbar, 50); // beri waktu router.go menggambar halaman dulu
      }
    });
  });
})();



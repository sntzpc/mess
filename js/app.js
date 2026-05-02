import { wireMenu } from './router.js';
import { wireAuth, applyRoleUI } from './auth.js';
import { state, initCommonData, fillMessSelects, api } from './api.js';
import { go, closeMobileNavbar } from './util.js';

import { initReservasi } from './pages/reservasi.js';
import { initKamar } from './pages/kamar.js';
import { initKalender, loadKalender } from './pages/kalender.js';
import { showApproval } from './pages/approval.js';
import { initMess, loadMessQueue } from './pages/mess.js';
import { initJurnal } from './pages/jurnal.js';
import { initLabelTamu, loadLabelAgendas } from './pages/label_tamu.js';
import { initQrTamu, loadQrAgendas, initQrPublicFromUrl } from './pages/qr_tamu.js';
import { showStat } from './pages/stat.js';
import { initSettings, onPageShown as settingsOnPageShown } from './pages/settings.js';

function onShow(pid){
  // dipanggil setiap pindah halaman
  if(pid==='page-approval') showApproval();
  if(pid==='page-kalender') loadKalender();
  if(pid==='page-mess') loadMessQueue();
  if(pid==='page-label-tamu') loadLabelAgendas();
  if(pid==='page-qr-tamu') loadQrAgendas();
  if(pid==='page-stat'){
    import('./pages/stat.js').then(mod=>{
      mod.invalidateStatKPI?.();
      mod.showStat();
    });
  }
  if(pid==='page-register'){
    import('./pages/register.js').then(mod=>mod.showRegister());
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
  // QR publik tanpa login: jika URL berisi ?qr=..., tampilkan hanya halaman publik dan hentikan init menu/login.
  // Ini harus menjadi proses pertama sebelum wireAuth(), karena wireAuth akan me-redirect ke halaman login.
  if(initQrPublicFromUrl()) return;
  // wire router
  wireMenu(onShow);
  // wire auth
  wireAuth(applyRoleUI, onReady);
  // init page modules
  initReservasi();
  initKamar();
  initKalender();
  initMess();
  initJurnal();
  initLabelTamu();
  initQrTamu();
  initSettings();
}
window.addEventListener('DOMContentLoaded', bootstrap);

// --- NAVBAR MOBILE FIX: tutup navbar setelah pilih item halaman (mobile) ---
(function(){
  document.querySelectorAll('#menu a.nav-link[data-page], #menu .dropdown-menu .dropdown-item[data-page]').forEach(a=>{
    a.addEventListener('click', ()=> setTimeout(closeMobileNavbar, 50));
  });
})();

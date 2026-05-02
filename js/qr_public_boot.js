// Boot paling awal untuk halaman QR publik.
// File ini sengaja dibuat non-module dan dipanggil sebelum app.js.
// Tujuannya: jika URL berisi token QR, aplikasi langsung masuk mode publik tanpa login.
(function(){
  'use strict';

  function readQrToken(){
    try{
      var href = String(window.location.href || '');
      var url = new URL(href);
      var token = url.searchParams.get('qr') || url.searchParams.get('guest_qr') || url.searchParams.get('qr_token') || '';
      if(token) return decodeURIComponent(token);

      var hash = String(url.hash || '');
      var m = hash.match(/[?#&](?:qr|guest_qr|qr_token)=([^&]+)/i)
           || hash.match(/(?:^#|[\/ ?#&])(?:qr|guest_qr|qr_token)=([^&]+)/i);
      if(m && m[1]) return decodeURIComponent(m[1]);

      var m2 = hash.match(/\/qr\/([^/?#&]+)/i);
      if(m2 && m2[1]) return decodeURIComponent(m2[1]);

      var m3 = href.match(/[?&#](?:qr|guest_qr|qr_token)=([^&]+)/i);
      return m3 && m3[1] ? decodeURIComponent(m3[1]) : '';
    }catch(_){
      return '';
    }
  }

  function activateShell(){
    document.documentElement.classList.add('qr-public-boot');
    if(document.body) document.body.classList.add('qr-public-mode');

    var nav = document.querySelector('.navbar');
    if(nav) nav.style.setProperty('display','none','important');

    document.querySelectorAll('.page').forEach(function(p){
      p.style.setProperty('display','none','important');
    });

    var publicPage = document.getElementById('page-qr-public');
    if(publicPage) publicPage.style.setProperty('display','block','important');

    var login = document.getElementById('page-login');
    if(login) login.style.setProperty('display','none','important');

    try{ document.title = 'QR Check-in / Check-out - Mess SNTZ'; }catch(_){ }
  }

  var token = readQrToken();
  if(!token) return;

  window.__MESS_QR_PUBLIC_BOOT__ = true;
  window.__MESS_DISABLE_AUTH_BOOTSTRAP__ = true;
  window.__MESS_QR_TOKEN__ = token;

  // Aktifkan secepat mungkin. Jika body belum ada, ulang saat DOM siap.
  activateShell();
  document.addEventListener('DOMContentLoaded', function(){
    activateShell();
    // Jalankan modul QR secara mandiri. Ini membuat QR publik tidak bergantung pada login/router.
    import('./pages/qr_tamu.js')
      .then(function(mod){
        activateShell();
        if(mod && typeof mod.initQrPublicFromUrl === 'function') mod.initQrPublicFromUrl();
      })
      .catch(function(err){
        var host = document.getElementById('qr-public-content');
        if(host){
          host.innerHTML = '<div class="alert alert-danger">Gagal membuka halaman QR mandiri.<br><small>' +
            String((err && err.message) || err || '') + '</small></div>';
        }
      });
  });
})();

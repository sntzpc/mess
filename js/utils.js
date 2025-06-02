/* File: frontend/js/utils.js */

// 1. Ganti dengan URL Web App Anda (sesuai yang diperoleh saat deploy Code.gs)
const BASE_URL = 'https://script.google.com/macros/s/AKfycbw6u-wpxVHSzxqmcePw8q_jGcB1D61wJ6S7VSjCjY_mwGYIxM2v4mp0llvs-kk6FV_zpQ/exec';

/**
 * Membuat request JSONP ke Apps Script.
 * @param {string} action  – nama action (misal: 'login', 'addUser', 'getUsers', dsb.)
 * @param {Object} params  – object key:value untuk parameter tambahan
 * @param {string} callbackName – nama fungsi global yang akan dipanggil (string)
 */
function jsonpRequest(action, params, callbackName) {
  // Bangun query string
  params = params || {};
  params.action = action;
  params.callback = callbackName;

  const esc = encodeURIComponent;
  const query = Object.keys(params)
    .map(k => esc(k) + '=' + esc(params[k]))
    .join('&');

  const url = BASE_URL + '?' + query;
  const script = document.createElement('script');
  script.src = url;
  script.async = true;
  script.onerror = function () {
    showAlert('Gagal memuat data dari server.', 'danger');
  };
  document.body.appendChild(script);
  // Setelah script dieksekusi, tag ini bisa dibiarkan (browser membersihkannya otomatis saat reload)
}

/**
 * Menampilkan Bootstrap Alert di atas konten
 * @param {string} message – teks pesan
 * @param {string} type    – 'success', 'danger', 'warning', 'info'
 */
function showAlert(message, type = 'danger') {
  // Jika sudah ada alert lain, buang dulu
  const existing = document.querySelector('.alert-container');
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.className = 'alert-container';

  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.setAttribute('role', 'alert');
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  container.appendChild(alertDiv);
  document.body.appendChild(container);

  // Setelah 4 detik, otomatis hilang
  setTimeout(() => {
    const btn = alertDiv.querySelector('.btn-close');
    if (btn) btn.click();
  }, 4000);
}

/**
 * Cek session (login). 
 * Jika tidak ada 'username' di sessionStorage, redirect ke login.html
 */
function checkSession() {
  const username = sessionStorage.getItem('username');
  if (!username) {
    window.location.href = 'login.html';
  }
}

/**
 * Logout user: hapus sessionStorage, redirect ke login.html
 */
function logout() {
  sessionStorage.clear();
  window.location.href = 'login.html';
}

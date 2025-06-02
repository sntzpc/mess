/* File: frontend/js/auth.js */

/**
 * JSONP callback untuk login
 */
window.handleLoginResponse = function(resp) {
  if (resp.status === 'success') {
    sessionStorage.setItem('username', document.getElementById('username').value);
    sessionStorage.setItem('role', resp.role);

    if (resp.role === 'admin') {
      window.location.href = 'admin-dashboard.html';
    } else {
      window.location.href = 'reservation.html';
    }
  } else {
    showAlert(resp.message, 'danger');
  }
};

/**
 * Inisialisasi form login
 */
function initLoginForm() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const uname = document.getElementById('username').value.trim();
    const pwd = document.getElementById('password').value.trim();
    if (!uname || !pwd) {
      showAlert('Username dan password wajib diisi.', 'warning');
      return;
    }
    // Panggil JSONP
    jsonpRequest('login', { username: uname, password: pwd }, 'handleLoginResponse');
  });
}

/**
 * Proteksi halaman admin
 */
function protectAdminPage() {
  checkSession();
  const role = sessionStorage.getItem('role');
  if (role !== 'admin') {
    window.location.href = 'reservation.html';
  }
}

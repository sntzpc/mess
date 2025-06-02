/* File: frontend/js/auth.js */

/**
 * handleLoginResponse(resp)
 * – Callback yang dipanggil oleh JSONP saat login
 */
function handleLoginResponse(resp) {
  if (resp.status === 'success') {
    // Simpan session
    sessionStorage.setItem('username', document.getElementById('username').value);
    sessionStorage.setItem('role', resp.role);

    // Arahkan ke halaman sesuai role
    if (resp.role === 'admin') {
      window.location.href = 'admin-dashboard.html';
    } else {
      window.location.href = 'reservation.html';
    }
  } else {
    showAlert(resp.message, 'danger');
  }
}

/**
 * Inisialisasi event listener untuk form login
 * Harus dipanggil saat login.html selesai di‐render
 */
function initLoginForm() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const uname = document.getElementById('username').value.trim();
    const pwd   = document.getElementById('password').value.trim();

    if (!uname || !pwd) {
      showAlert('Username dan password wajib diisi.', 'warning');
      return;
    }

    // Panggil JSONP: action=login
    jsonpRequest('login', { username: uname, password: pwd }, 'handleLoginResponse');
  });
}

/**
 * Periksa akses halaman admin
 * Jika role !== 'admin', redirect ke reservation.html
 */
function protectAdminPage() {
  checkSession();
  const role = sessionStorage.getItem('role');
  if (role !== 'admin') {
    window.location.href = 'reservation.html';
  }
}

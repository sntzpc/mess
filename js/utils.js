/* File: frontend/js/utils.js */

/**
 * Menampilkan toast singkat di pojok kanan atas.
 * message: teks yang ingin ditampilkan.
 * type: 'success' | 'warning' | 'danger' | 'info' (sesuai kelas Bootstrap).
 */
function showAlert(message, type = 'info') {
  // Buat container toast jika belum ada
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.position = 'fixed';
    container.style.top = '1rem';
    container.style.right = '1rem';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
  }

  // Buat elemen toast
  const toast = document.createElement('div');
  toast.className = `toast align-items-center text-bg-${type} border-0 show`;
  toast.role = 'alert';
  toast.ariaLive = 'assertive';
  toast.ariaAtomic = 'true';
  toast.style.minWidth = '250px';
  toast.style.marginBottom = '0.5rem';

  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;

  container.appendChild(toast);

  // Buat agar toast hilang otomatis setelah 3 detik
  setTimeout(() => {
    bootstrap.Toast.getOrCreateInstance(toast).hide();
    toast.addEventListener('hidden.bs.toast', () => {
      toast.remove();
    });
  }, 3000);
}

/**
 * Mengirim request JSONP ke GAS.
 * action: nama action di GAS (misal 'addReservation', 'getReservations', dll).
 * params: objek key:value yang akan dijadikan query params.
 * callbackName: nama fungsi JS global yang akan dipanggil oleh JSONP.
 */
function jsonpRequest(action, params = {}, callbackName) {
  if (!action || !callbackName) {
    console.error('jsonpRequest: action dan callbackName wajib diisi.');
    return;
  }

  // Ganti dengan URL Web App GAS Anda (hasil "Deploy as web app").
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw6u-wpxVHSzxqmcePw8q_jGcB1D61wJ6S7VSjCjY_mwGYIxM2v4mp0llvs-kk6FV_zpQ/exec';

  // Buat query string
  const query = new URLSearchParams({ action, callback: callbackName, ...params }).toString();
  const url = `${SCRIPT_URL}?${query}`;

  const script = document.createElement('script');
  script.src = url;
  script.onerror = () => {
    showAlert('Gagal memuat data dari server.', 'danger');
    script.remove();
  };
  script.onload = () => script.remove();

  document.body.appendChild(script);
}

// Konfigurasi aplikasi frontend.
// Ganti GAS_URL sesuai URL deployment Apps Script Anda.
export const APP_CONFIG = Object.freeze({
  APP_NAME: 'Mess SNTZ',
  GAS_URL: 'https://script.google.com/macros/s/AKfycbyx1j4ukTFsXM0c_-vxnMbLbv8Ku5qSXYi6WKdB8efeV7PK3jgRRS-o38-kFi7OlbAt/exec',
  // Alamat produksi GitHub Pages. QR Code tamu selalu diarahkan ke alamat ini, bukan localhost.
  PUBLIC_APP_URL: 'https://sntzpc.github.io/mess',
  REQUEST_TIMEOUT_MS: 45000,
});

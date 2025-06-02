/* File: frontend/js/reservation.js */

/**
 * Callback JSONP untuk addReservation
 */
window.handleAddReservationResponse = function(resp) {
  if (resp.status === 'success') {
    showAlert(
      'Reservasi terkirim (ID: ' + resp.reservation_id + '), menunggu persetujuan admin.',
      'success'
    );
    // Reset form
    document.getElementById('reservationForm').reset();
    document.getElementById('guestsContainer').innerHTML = '';
    localStorage.removeItem('guestDetails');
  } else {
    showAlert(resp.message, 'danger');
  }
};

/**
 * Inisialisasi form reservasi:
 * 1) Klik Generate → buat blok detail tiap tamu
 * 2) Submit → validasi semua field, lalu kirim JSONP
 */
function initReservationForm() {
  const form = document.getElementById('reservationForm');
  const numGuestsInput = document.getElementById('numGuests');
  const generateBtn = document.getElementById('generateGuestsBtn');
  const guestsContainer = document.getElementById('guestsContainer');

  if (!form || !numGuestsInput || !generateBtn || !guestsContainer) return;

  // Jika user merubah angka Jumlah Tamu → bersihkan blok lama
  numGuestsInput.addEventListener('input', () => {
    guestsContainer.innerHTML = '';
    localStorage.removeItem('guestDetails');
  });

  // 1) Klik "Generate Fields" → buat blok detail tamu
  generateBtn.addEventListener('click', () => {
    const count = parseInt(numGuestsInput.value, 10) || 0;
    if (count < 1) {
      showAlert('Jumlah Tamu harus diisi minimal 1 sebelum generate.', 'warning');
      return;
    }

    // Kosongkan container lama
    guestsContainer.innerHTML = '';
    localStorage.removeItem('guestDetails');

    // Buat blok input detail per tamu
    for (let i = 1; i <= count; i++) {
      const div = document.createElement('div');
      div.className = 'guest-block';
      div.innerHTML = `
        <h6>Tamu #${i}</h6>
        <div class="mb-2">
          <label for="guestName_${i}" class="form-label">Nama Tamu</label>
          <input
            type="text"
            class="form-control"
            id="guestName_${i}"
            placeholder="Nama Tamu #${i}"
            required
          />
        </div>
        <div class="mb-2">
          <label for="guestUnit_${i}" class="form-label">Unit Tamu</label>
          <input
            type="text"
            class="form-control"
            id="guestUnit_${i}"
            placeholder="Unit Tamu #${i}"
            required
          />
        </div>
        <div class="mb-2">
          <label for="guestPosition_${i}" class="form-label">Jabatan Tamu</label>
          <input
            type="text"
            class="form-control"
            id="guestPosition_${i}"
            placeholder="Jabatan Tamu #${i}"
            required
          />
        </div>
        <div class="mb-2">
          <label for="guestGender_${i}" class="form-label">Gender Tamu</label>
          <select class="form-select" id="guestGender_${i}" required>
            <option value="" disabled selected>Pilih Gender</option>
            <option value="L">Laki-laki</option>
            <option value="W">Perempuan</option>
          </select>
        </div>
      `;
      guestsContainer.appendChild(div);
    }

    showAlert(`Silakan isi detail untuk ${count} tamu di bawah ini.`, 'info');
  });

  // 2) Saat form disubmit → validasi dan kirim JSONP
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Ambil value dari field umum
    const requester_name = document.getElementById('requesterName').value.trim();
    const requesterUnit = document.getElementById('requesterUnit').value.trim();
    const requesterPosition = document
      .getElementById('requesterPosition')
      .value.trim();
    const numGuests = parseInt(numGuestsInput.value, 10) || 0;
    const agenda = document.getElementById('agenda').value.trim();
    const checkin_date = document.getElementById('checkinDate').value;
    const checkin_time = document.getElementById('checkinTime').value;
    const checkout_date = document.getElementById('checkoutDate').value;
    const checkout_time = document.getElementById('checkoutTime').value;

    // Validasi "field umum"
    if (!requester_name) {
      showAlert('Nama Pemesan wajib diisi.', 'warning');
      return;
    }
    if (!requesterUnit) {
      showAlert('Unit Pemesan wajib diisi.', 'warning');
      return;
    }
    if (!requesterPosition) {
      showAlert('Jabatan Pemesan wajib diisi.', 'warning');
      return;
    }
    if (numGuests < 1) {
      showAlert('Jumlah Tamu wajib diisi minimal 1.', 'warning');
      return;
    }
    if (!agenda) {
      showAlert('Agenda wajib diisi.', 'warning');
      return;
    }
    if (!checkin_date || !checkin_time) {
      showAlert('Tanggal dan Jam Masuk wajib diisi.', 'warning');
      return;
    }
    if (!checkout_date || !checkout_time) {
      showAlert('Tanggal dan Jam Keluar wajib diisi.', 'warning');
      return;
    }
    if (
      new Date(checkout_date + ' ' + checkout_time) <
      new Date(checkin_date + ' ' + checkin_time)
    ) {
      showAlert(
        'Tanggal/Jam Keluar harus sama atau setelah Tanggal/Jam Masuk.',
        'warning'
      );
      return;
    }

    // Validasi detail tamu
    const blocks = guestsContainer.querySelectorAll('.guest-block');
    if (blocks.length !== numGuests) {
      showAlert(
        'Klik tombol “Generate Fields” dan isi detail semua tamu sebelum submit.',
        'warning'
      );
      return;
    }

    // Kumpulkan detail tamu ke array
    const guests = [];
    for (let i = 1; i <= numGuests; i++) {
      const nameEl = document.getElementById(`guestName_${i}`);
      const unitEl = document.getElementById(`guestUnit_${i}`);
      const posEl = document.getElementById(`guestPosition_${i}`);
      const genEl = document.getElementById(`guestGender_${i}`);

      if (
        !nameEl ||
        !unitEl ||
        !posEl ||
        !genEl ||
        !nameEl.value.trim() ||
        !unitEl.value.trim() ||
        !posEl.value.trim() ||
        !genEl.value
      ) {
        showAlert(`Mohon isi semua field untuk Tamu #${i}.`, 'warning');
        return;
      }

      guests.push({
        name: nameEl.value.trim(),
        unit: unitEl.value.trim(),
        position: posEl.value.trim(),
        gender: genEl.value
      });
    }

    // Jika semua valid → kirim JSONP
    jsonpRequest(
      'addReservation',
      {
        requester_name:     requester_name,
        requester_unit:     requesterUnit,
        requester_position: requesterPosition,
        num_guests:         numGuests,
        guest_details:      JSON.stringify(guests),
        agenda:             agenda,
        checkin_date:       checkin_date,
        checkin_time:       checkin_time,
        checkout_date:      checkout_date,
        checkout_time:      checkout_time
      },
      'handleAddReservationResponse'
    );
  });
}

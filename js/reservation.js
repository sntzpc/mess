/* File: frontend/js/reservation.js */

/**
 * JSONP callback untuk addReservation
 */
window.handleAddReservationResponse = function(resp) {
  if (resp.status === 'success') {
    showAlert(
      'Reservasi terkirim (ID: ' + resp.reservation_id + '), menunggu persetujuan admin.',
      'success'
    );
    document.getElementById('reservationForm').reset();
    // Kosongkan juga container guest fields kalau ada
    document.getElementById('guestFieldsContainer').innerHTML = '';
  } else {
    showAlert(resp.message, 'danger');
  }
};

/**
 * Membuat atau menghapus field per guest sesuai jumlah.
 * @param {number} count – jumlah tamu yang diinginkan
 */
function renderGuestFields(count) {
  const container = document.getElementById('guestFieldsContainer');
  container.innerHTML = ''; // kosongkan dulu

  if (count < 1) return;

  for (let i = 1; i <= count; i++) {
    // Setiap tamu butuh: Nama Tamu, Unit, Jabatan, Gender
    const div = document.createElement('div');
    div.className = 'border rounded p-3 mb-3';
    div.innerHTML = `
      <h6 class="mb-2">Tamu #${i}</h6>
      <div class="mb-2">
        <label for="guestName_${i}" class="form-label">Nama Tamu</label>
        <input type="text" class="form-control" id="guestName_${i}" required />
      </div>
      <div class="mb-2">
        <label for="guestUnit_${i}" class="form-label">Unit Tamu</label>
        <input type="text" class="form-control" id="guestUnit_${i}" required />
      </div>
      <div class="mb-2">
        <label for="guestPosition_${i}" class="form-label">Jabatan Tamu</label>
        <input type="text" class="form-control" id="guestPosition_${i}" required />
      </div>
      <div class="mb-2">
        <label for="guestGender_${i}" class="form-label">Gender Tamu</label>
        <select class="form-select" id="guestGender_${i}" required>
          <option value="" disabled selected>Pilih gender</option>
          <option value="L">Laki-laki</option>
          <option value="W">Perempuan</option>
        </select>
      </div>
    `;
    container.appendChild(div);
  }
}

/**
 * Inisialisasi form reservasi:
 * 1) Tatap listener pada #numGuests
 * 2) Tatap listener submit form
 */
function initReservationForm() {
  const form = document.getElementById('reservationForm');
  const numGuestsInput = document.getElementById('numGuests');

  if (!form || !numGuestsInput) return;

  // Ketika jumlah tamu berubah → render guest fields
  numGuestsInput.addEventListener('input', function() {
    const count = parseInt(this.value, 10) || 0;
    if (count > 0) {
      renderGuestFields(count);
    } else {
      document.getElementById('guestFieldsContainer').innerHTML = '';
    }
  });

  // Saat form disubmit
  form.addEventListener('submit', function(e) {
    e.preventDefault();

    // 1) Validasi Pemesan
    const requester_name = document
      .getElementById('requesterName')
      .value.trim();
    const requesterUnit = document.getElementById('requesterUnit').value.trim();
    const requesterPosition = document
      .getElementById('requesterPosition')
      .value.trim();

    // 2) Jumlah tamu
    const numGuests = parseInt(numGuestsInput.value, 10) || 0;

    // 3) Ambil data tiap tamu
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
        showAlert(
          `Semua field pada Tamu #${i} harus diisi lengkap.`,
          'warning'
        );
        return;
      }

      guests.push({
        name: nameEl.value.trim(),
        unit: unitEl.value.trim(),
        position: posEl.value.trim(),
        gender: genEl.value
      });
    }

    // 4) Agenda + tanggal/jam
    const agenda = document.getElementById('agenda').value.trim();
    const checkin_date = document.getElementById('checkinDate').value;
    const checkin_time = document.getElementById('checkinTime').value;
    const checkout_date = document.getElementById('checkoutDate').value;
    const checkout_time = document.getElementById('checkoutTime').value;

    // Validasi sederhana
    if (
      !requester_name ||
      !requesterUnit ||
      !requesterPosition ||
      numGuests < 1 ||
      !agenda ||
      !checkin_date ||
      !checkin_time ||
      !checkout_date ||
      !checkout_time
    ) {
      showAlert('Mohon isi semua field yang dibutuhkan.', 'warning');
      return;
    }
    if (
      new Date(checkout_date + ' ' + checkout_time) <
      new Date(checkin_date + ' ' + checkin_time)
    ) {
      showAlert(
        'Tanggal/jam keluar harus sama atau setelah tanggal/jam masuk.',
        'warning'
      );
      return;
    }

    // 5) Kirim via JSONP
    // Kita kirimkan guests sebagai JSON-stringified
    jsonpRequest(
      'addReservation',
      {
        requester_name: requester_name,
        requester_unit: requesterUnit,
        requester_position: requesterPosition,
        num_guests: numGuests,
        guest_details: JSON.stringify(guests),
        agenda: agenda,
        checkin_date: checkin_date,
        checkin_time: checkin_time,
        checkout_date: checkout_date,
        checkout_time: checkout_time
      },
      'handleAddReservationResponse'
    );
  });
}

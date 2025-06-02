/* File: frontend/js/reservation.js */

/**
 * handleAddReservationResponse(resp)
 * – Callback JSONP untuk action=addReservation
 */
function handleAddReservationResponse(resp) {
  if (resp.status === 'success') {
    showAlert('Reservasi terkirim (ID: ' + resp.reservation_id + '), menunggu persetujuan admin.', 'success');
    document.getElementById('reservationForm').reset();
  } else {
    showAlert(resp.message, 'danger');
  }
}

/**
 * initReservationForm()
 * – Inisialisasi listener form reservasi
 */
function initReservationForm() {
  const form = document.getElementById('reservationForm');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    // Ambil nilai
    const requester_name = document.getElementById('requesterName').value.trim();
    const unit           = document.getElementById('unit').value.trim();
    const position       = document.getElementById('position').value.trim();
    const agenda         = document.getElementById('agenda').value.trim();
    const gender         = document.getElementById('gender').value;
    const checkin_date   = document.getElementById('checkinDate').value;
    const checkin_time   = document.getElementById('checkinTime').value;
    const checkout_date  = document.getElementById('checkoutDate').value;
    const checkout_time  = document.getElementById('checkoutTime').value;
    const num_guests     = document.getElementById('numGuests').value;

    // Validasi sederhana
    if (!requester_name || !unit || !position || !agenda || !gender ||
        !checkin_date || !checkin_time || !checkout_date || !checkout_time || !num_guests) {
      showAlert('Semua field wajib diisi.', 'warning');
      return;
    }
    if (new Date(checkout_date + ' ' + checkout_time) < new Date(checkin_date + ' ' + checkin_time)) {
      showAlert('Tanggal/jam keluar harus sama atau setelah tanggal/jam masuk.', 'warning');
      return;
    }

    // Panggil JSONP
    jsonpRequest('addReservation', {
      requester_name: requester_name,
      unit: unit,
      position: position,
      agenda: agenda,
      gender: gender,
      checkin_date: checkin_date,
      checkin_time: checkin_time,
      checkout_date: checkout_date,
      checkout_time: checkout_time,
      num_guests: num_guests
    }, 'handleAddReservationResponse');
  });
}

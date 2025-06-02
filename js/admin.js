/* File: frontend/js/admin.js */

/**
 * Callback JSONP: handle data getReservations untuk semua status.
 * Resp: { status: "success", reservations: [...] }
 */
function handleGetReservationsResponse(resp) {
  if (resp.status !== 'success') {
    showAlert(resp.message, 'danger');
    return;
  }
  const data = resp.reservations;

  // Hitung statistik
  const pendingCount   = data.filter(r => r.status === 'Pending').length;
  const approvedCount  = data.filter(r => r.status === 'Approved').length;
  const checkedInCount = data.filter(r => r.status === 'Checked-In').length;
  const checkedOutCount= data.filter(r => r.status === 'Checked-Out').length;

  document.getElementById('countPending').innerText    = pendingCount;
  document.getElementById('countApproved').innerText   = approvedCount;
  document.getElementById('countCheckedIn').innerText  = checkedInCount;
  document.getElementById('countCheckedOut').innerText = checkedOutCount;

  // Render tiap tabel berdasarkan status
  renderTable('Pending',   data.filter(r => r.status === 'Pending'));
  renderTable('Approved',  data.filter(r => r.status === 'Approved'));
  renderTable('Checked-In',data.filter(r => r.status === 'Checked-In'));
  renderTable('Checked-Out',data.filter(r => r.status === 'Checked-Out'));
}

/**
 * loadDashboardStats()
 * – Memanggil getReservations (tanpa filter) untuk statistik
 */
function loadDashboardStats() {
  jsonpRequest('getReservations', {}, 'handleGetReservationsResponse');
}

/**
 * loadAllReservations()
 * – Sama dengan loadDashboardStats(), men-trigger render semua tabel
 */
function loadAllReservations() {
  jsonpRequest('getReservations', {}, 'handleGetReservationsResponse');
}

/**
 * renderTable(status, listData)
 * – Tampilkan data listData (array) di tabel sesuai status
 */
function renderTable(status, listData) {
  let tableBodyId = '';
  if (status === 'Pending')      tableBodyId = 'tablePending';
  else if (status === 'Approved') tableBodyId = 'tableApproved';
  else if (status === 'Checked-In') tableBodyId = 'tableCheckedIn';
  else if (status === 'Checked-Out') tableBodyId = 'tableCheckedOut';
  else return;

  const tbody = document.querySelector(`#${tableBodyId} tbody`);
  tbody.innerHTML = ''; // kosongkan

  if (listData.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="${status === 'Approved' || status === 'Checked-In' ? 10 : 9}" class="text-center">Tidak ada data.</td>`;
    tbody.appendChild(tr);
    return;
  }

  listData.forEach((r, idx) => {
    const tr = document.createElement('tr');
    const checkInLabel  = `${r.checkin_date} ${r.checkin_time}`;
    const checkOutLabel = `${r.checkout_date} ${r.checkout_time}`;
    const assignedRoom  = r.assigned_room || '-';

    let actionButtons = '';
    if (status === 'Pending') {
      // Tombol Approve (minta input assigned_room) & Reject
      actionButtons = `
        <button class="btn btn-sm btn-success me-1" onclick="promptApprove('${r.reservation_id}')">Approve</button>
        <button class="btn btn-sm btn-danger" onclick="rejectReservation('${r.reservation_id}')">Reject</button>
      `;
    } else if (status === 'Approved') {
      // Tombol Check-In
      actionButtons = `
        <button class="btn btn-sm btn-primary" onclick="checkInReservation('${r.reservation_id}')">Check-In</button>
      `;
    } else if (status === 'Checked-In') {
      // Tombol Check-Out
      actionButtons = `
        <button class="btn btn-sm btn-warning" onclick="checkOutReservation('${r.reservation_id}')">Check-Out</button>
      `;
    } else {
      actionButtons = '-';
    }

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${r.requester_name}</td>
      <td>${r.unit}</td>
      <td>${r.position}</td>
      <td>${r.agenda}</td>
      <td>${checkInLabel}</td>
      <td>${checkOutLabel}</td>
      <td>${r.num_guests}</td>
      ${ (status === 'Approved' || status === 'Checked-In' || status === 'Checked-Out')
        ? `<td>${assignedRoom}</td>` : '' }
      <td>${actionButtons}</td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * promptApprove(reservation_id)
 * – Menampilkan prompt untuk memasukkan assigned_room lalu panggil action=approveReservation
 */
function promptApprove(reservation_id) {
  const room = prompt('Masukkan ID kamar yang akan di‐assign (misal: R01, R02, ...):');
  if (room === null) return; // batal
  const assigned_room = room.trim();
  if (!assigned_room) {
    showAlert('Assigned room tidak boleh kosong.', 'warning');
    return;
  }
  // Lakukan approve via JSONP
  jsonpRequest(
    'approveReservation',
    { reservation_id: reservation_id, assigned_room: assigned_room, admin_user: sessionStorage.getItem('username') },
    'handleApproveResponse'
  );
}

/**
 * Callback untuk approveReservation
 */
function handleApproveResponse(resp) {
  if (resp.status === 'success') {
    showAlert('Reservasi berhasil disetujui.', 'success');
    loadAllReservations();
  } else {
    showAlert(resp.message, 'danger');
  }
}

/**
 * rejectReservation(reservation_id)
 * – Langsung panggil action=rejectReservation
 */
function rejectReservation(reservation_id) {
  if (!confirm('Yakin ingin menolak reservasi ini?')) return;
  jsonpRequest(
    'rejectReservation',
    { reservation_id: reservation_id, admin_user: sessionStorage.getItem('username') },
    'handleRejectResponse'
  );
}

/**
 * Callback untuk rejectReservation
 */
function handleRejectResponse(resp) {
  if (resp.status === 'success') {
    showAlert('Reservasi berhasil ditolak.', 'success');
    loadAllReservations();
  } else {
    showAlert(resp.message, 'danger');
  }
}

/**
 * checkInReservation(reservation_id)
 * – Panggil action=checkIn
 */
function checkInReservation(reservation_id) {
  if (!confirm('Konfirmasi Check-In?')) return;
  jsonpRequest(
    'checkIn',
    { reservation_id: reservation_id, admin_user: sessionStorage.getItem('username') },
    'handleCheckInResponse'
  );
}

/**
 * Callback untuk checkIn
 */
function handleCheckInResponse(resp) {
  if (resp.status === 'success') {
    showAlert('Check-In berhasil.', 'success');
    loadAllReservations();
  } else {
    showAlert(resp.message, 'danger');
  }
}

/**
 * checkOutReservation(reservation_id)
 * – Panggil action=checkOut
 */
function checkOutReservation(reservation_id) {
  if (!confirm('Konfirmasi Check-Out?')) return;
  jsonpRequest(
    'checkOut',
    { reservation_id: reservation_id, admin_user: sessionStorage.getItem('username') },
    'handleCheckOutResponse'
  );
}

/**
 * Callback untuk checkOut
 */
function handleCheckOutResponse(resp) {
  if (resp.status === 'success') {
    showAlert('Check-Out berhasil.', 'success');
    loadAllReservations();
  } else {
    showAlert(resp.message, 'danger');
  }
}

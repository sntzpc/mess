/* File: frontend/js/admin.js */

/**
 * JSONP callback untuk getReservations
 */
window.handleGetReservationsResponse = function(resp) {
  if (resp.status !== 'success') {
    showAlert(resp.message, 'danger');
    return;
  }
  const data = resp.reservations;

  const pendingCount = data.filter((r) => r.status === 'Pending').length;
  const approvedCount = data.filter((r) => r.status === 'Approved').length;
  const checkedInCount = data.filter((r) => r.status === 'Checked-In').length;
  const checkedOutCount = data.filter((r) => r.status === 'Checked-Out').length;

  document.getElementById('countPending').innerText = pendingCount;
  document.getElementById('countApproved').innerText = approvedCount;
  document.getElementById('countCheckedIn').innerText = checkedInCount;
  document.getElementById('countCheckedOut').innerText = checkedOutCount;

  renderTable('Pending', data.filter((r) => r.status === 'Pending'));
  renderTable('Approved', data.filter((r) => r.status === 'Approved'));
  renderTable('Checked-In', data.filter((r) => r.status === 'Checked-In'));
  renderTable('Checked-Out', data.filter((r) => r.status === 'Checked-Out'));
};

/**
 * Memuat statistik dashboard
 */
function loadDashboardStats() {
  jsonpRequest('getReservations', {}, 'handleGetReservationsResponse');
}

/**
 * Memuat semua reservasi (termasuk render tabel)
 */
function loadAllReservations() {
  jsonpRequest('getReservations', {}, 'handleGetReservationsResponse');
}

/**
 * Render data pada tabel berdasarkan status
 */
function renderTable(status, listData) {
  let tableBodyId = '';
  if (status === 'Pending') tableBodyId = 'tablePending';
  else if (status === 'Approved') tableBodyId = 'tableApproved';
  else if (status === 'Checked-In') tableBodyId = 'tableCheckedIn';
  else if (status === 'Checked-Out') tableBodyId = 'tableCheckedOut';
  else return;

  const tbody = document.querySelector(`#${tableBodyId} tbody`);
  tbody.innerHTML = '';

  if (listData.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="${
      status === 'Approved' || status === 'Checked-In' ? 10 : 9
    }" class="text-center">Tidak ada data.</td>`;
    tbody.appendChild(tr);
    return;
  }

  listData.forEach((r, idx) => {
    const tr = document.createElement('tr');
    const checkInLabel = `${r.checkin_date} ${r.checkin_time}`;
    const checkOutLabel = `${r.checkout_date} ${r.checkout_time}`;
    const assignedRoom = r.assigned_room || '-';

    let actionButtons = '';
    if (status === 'Pending') {
      actionButtons = `
        <button class="btn btn-sm btn-success me-1" onclick="promptApprove('${r.reservation_id}')">Approve</button>
        <button class="btn btn-sm btn-danger" onclick="rejectReservation('${r.reservation_id}')">Reject</button>
      `;
    } else if (status === 'Approved') {
      actionButtons = `
        <button class="btn btn-sm btn-primary" onclick="checkInReservation('${r.reservation_id}')">Check-In</button>
      `;
    } else if (status === 'Checked-In') {
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
      ${
        status === 'Approved' ||
        status === 'Checked-In' ||
        status === 'Checked-Out'
          ? `<td>${assignedRoom}</td>`
          : ''
      }
      <td>${actionButtons}</td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Meminta input assigned_room lalu panggil action=approveReservation
 */
function promptApprove(reservation_id) {
  const room = prompt(
    'Masukkan ID kamar yang akan di‐assign (misal: R01, R02, ...):'
  );
  if (room === null) return;
  const assigned_room = room.trim();
  if (!assigned_room) {
    showAlert('Assigned room tidak boleh kosong.', 'warning');
    return;
  }
  jsonpRequest(
    'approveReservation',
    {
      reservation_id: reservation_id,
      assigned_room: assigned_room,
      admin_user: sessionStorage.getItem('username'),
    },
    'handleApproveResponse'
  );
}

/**
 * JSONP callback untuk approveReservation
 */
window.handleApproveResponse = function(resp) {
  if (resp.status === 'success') {
    showAlert('Reservasi berhasil disetujui.', 'success');
    loadAllReservations();
  } else {
    showAlert(resp.message, 'danger');
  }
};

/**
 * Tolak reservasi
 */
function rejectReservation(reservation_id) {
  if (!confirm('Yakin ingin menolak reservasi ini?')) return;
  jsonpRequest(
    'rejectReservation',
    {
      reservation_id: reservation_id,
      admin_user: sessionStorage.getItem('username'),
    },
    'handleRejectResponse'
  );
}

/**
 * JSONP callback untuk rejectReservation
 */
window.handleRejectResponse = function(resp) {
  if (resp.status === 'success') {
    showAlert('Reservasi berhasil ditolak.', 'success');
    loadAllReservations();
  } else {
    showAlert(resp.message, 'danger');
  }
};

/**
 * Check-In reservasi
 */
function checkInReservation(reservation_id) {
  if (!confirm('Konfirmasi Check-In?')) return;
  jsonpRequest(
    'checkIn',
    {
      reservation_id: reservation_id,
      admin_user: sessionStorage.getItem('username'),
    },
    'handleCheckInResponse'
  );
}

/**
 * JSONP callback untuk checkIn
 */
window.handleCheckInResponse = function(resp) {
  if (resp.status === 'success') {
    showAlert('Check-In berhasil.', 'success');
    loadAllReservations();
  } else {
    showAlert(resp.message, 'danger');
  }
};

/**
 * Check-Out reservasi
 */
function checkOutReservation(reservation_id) {
  if (!confirm('Konfirmasi Check-Out?')) return;
  jsonpRequest(
    'checkOut',
    {
      reservation_id: reservation_id,
      admin_user: sessionStorage.getItem('username'),
    },
    'handleCheckOutResponse'
  );
}

/**
 * JSONP callback untuk checkOut
 */
window.handleCheckOutResponse = function(resp) {
  if (resp.status === 'success') {
    showAlert('Check-Out berhasil.', 'success');
    loadAllReservations();
  } else {
    showAlert(resp.message, 'danger');
  }
};

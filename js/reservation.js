// js/reservation.js

// Setelah DOM siap, event untuk generate form tamu & upload file diinisiasi di loadReservationForm

/**
 * Tampilkan form reservasi di tab "Reservasi"
 */
function loadReservationForm() {
  const container = document.getElementById("contentReservations");
  container.innerHTML = `
    <h4>Form Reservasi</h4>
    <form id="reservationForm">
      <!-- Data Pemesan -->
      <div class="row mb-3">
        <div class="col">
          <label for="reqName" class="form-label">Nama Pemesan</label>
          <input type="text" class="form-control" id="reqName" required>
        </div>
        <div class="col">
          <label for="reqUnit" class="form-label">Unit</label>
          <input type="text" class="form-control" id="reqUnit" required>
        </div>
        <div class="col">
          <label for="reqPosition" class="form-label">Jabatan</label>
          <input type="text" class="form-control" id="reqPosition" required>
        </div>
      </div>
      <!-- Jumlah Tamu -->
      <div class="row mb-3">
        <div class="col-4">
          <label for="numGuests" class="form-label">Jumlah Tamu</label>
          <select id="numGuests" class="form-select" required>
            <option value="" disabled selected>Pilih jumlah</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </select>
        </div>
      </div>
      <div id="guestsContainer"></div>
      <!-- Upload CSV/Excel Tamu -->
      <div class="mb-3">
        <label for="guestFile" class="form-label">Upload Data Tamu (CSV/Excel)</label>
        <input type="file" class="form-control" id="guestFile" accept=".csv, .xlsx">
        <small class="text-muted">Jika di-upload, akan override form tamu manual.</small>
      </div>
      <!-- Tanggal Check‐In / Check‐Out -->
      <div class="row mb-3">
        <div class="col">
          <label for="checkinDate" class="form-label">Check‐In</label>
          <input type="date" class="form-control" id="checkinDate" required>
        </div>
        <div class="col">
          <label for="checkoutDate" class="form-label">Check‐Out</label>
          <input type="date" class="form-control" id="checkoutDate" required>
        </div>
      </div>
      <!-- Agenda -->
      <div class="mb-3">
        <label for="agenda" class="form-label">Agenda</label>
        <textarea class="form-control" id="agenda" rows="2" required></textarea>
      </div>
      <!-- Hidden untuk assigned_room -->
      <input type="hidden" id="assignedRoom" value="">
      <button type="submit" class="btn btn-success">Kirim Reservasi</button>
      <div id="reservationAlert" class="mt-2"></div>
    </form>
  `;

  // Event listener untuk jumlah tamu & file upload
  document.getElementById("numGuests").addEventListener("change", (e) => {
    const count = parseInt(e.target.value);
    renderGuestFields(count);
  });
  document.getElementById("guestFile").addEventListener("change", handleGuestFileUpload);
  document.getElementById("reservationForm").addEventListener("submit", handleReservationSubmit);

  // Jika ada preferredRoom di sessionStorage, isi hidden field
  const preferred = sessionStorage.getItem("preferredRoom");
  if (preferred) {
    document.getElementById("assignedRoom").value = preferred;
    sessionStorage.removeItem("preferredRoom");
  }
}

/**
 * Render form dinamis untuk setiap tamu
 */
function renderGuestFields(count) {
  const container = document.getElementById("guestsContainer");
  container.innerHTML = "";
  for (let i = 1; i <= count; i++) {
    const html = `
      <div class="card mb-2 p-2">
        <h6>Tamu ${i}</h6>
        <div class="row mb-2">
          <div class="col">
            <label class="form-label">Nama</label>
            <input type="text" class="form-control guestName" data-index="${i}" required>
          </div>
          <div class="col">
            <label class="form-label">Unit</label>
            <input type="text" class="form-control guestUnit" data-index="${i}" required>
          </div>
          <div class="col">
            <label class="form-label">Jabatan</label>
            <input type="text" class="form-control guestPosition" data-index="${i}" required>
          </div>
          <div class="col">
            <label class="form-label">Gender</label>
            <select class="form-select guestGender" data-index="${i}" required>
              <option value="" disabled selected>Pilih</option>
              <option value="L">L</option>
              <option value="P">P</option>
            </select>
          </div>
        </div>
      </div>
    `;
    container.insertAdjacentHTML("beforeend", html);
  }
}

/**
 * Handle upload file tamu (CSV/Excel) via SheetJS
 */
function handleGuestFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    const data = evt.target.result;
    const workbook = XLSX.read(data, { type: "binary" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const guests = [];
    for (let i = 1; i < json.length; i++) {
      const row = json[i];
      if (row.length >= 4) {
        guests.push({
          guest_name: row[0],
          guest_unit: row[1],
          guest_position: row[2],
          guest_gender: row[3]
        });
      }
    }
    populateGuestDataFromFile(guests);
  };
  reader.readAsBinaryString(file);
}

/**
 * Isi data tamu dari file ke form
 */
function populateGuestDataFromFile(arr) {
  document.getElementById("numGuests").value = arr.length;
  renderGuestFields(arr.length);
  arr.forEach((g, idx) => {
    const i = idx + 1;
    document.querySelector(`.guestName[data-index="${i}"]`).value = g.guest_name;
    document.querySelector(`.guestUnit[data-index="${i}"]`).value = g.guest_unit;
    document.querySelector(`.guestPosition[data-index="${i}"]`).value = g.guest_position;
    document.querySelector(`.guestGender[data-index="${i}"]`).value = g.guest_gender;
  });
}

/**
 * Submit form reservasi → kirim ke GAS
 */
async function handleReservationSubmit(e) {
  e.preventDefault();
  const checkin  = document.getElementById("checkinDate").value;
  const checkout = document.getElementById("checkoutDate").value;
  if (new Date(checkin) >= new Date(checkout)) {
    showReservationAlert("Check‐in harus lebih awal dari Check‐out", "danger");
    return;
  }
  const requester_name     = document.getElementById("reqName").value.trim();
  const requester_unit     = document.getElementById("reqUnit").value.trim();
  const requester_position = document.getElementById("reqPosition").value.trim();
  const num_guests         = parseInt(document.getElementById("numGuests").value);
  const guest_details      = [];
  for (let i = 1; i <= num_guests; i++) {
    guest_details.push({
      guest_name: document.querySelector(`.guestName[data-index="${i}"]`).value.trim(),
      guest_unit: document.querySelector(`.guestUnit[data-index="${i}"]`).value.trim(),
      guest_position: document.querySelector(`.guestPosition[data-index="${i}"]`).value.trim(),
      guest_gender: document.querySelector(`.guestGender[data-index="${i}"]`).value
    });
  }
  const agenda        = document.getElementById("agenda").value.trim();
  const assigned_room = document.getElementById("assignedRoom").value;

  // Persiapkan callback unik
  const callbackName = "jsonpSubmitRes_" + Date.now();
  const params = {
    action: "submitReservation",
    requester_name,
    requester_unit,
    requester_position,
    num_guests: num_guests.toString(),
    guest_details: JSON.stringify(guest_details),
    agenda,
    checkin_date: checkin,
    checkout_date: checkout,
    assigned_room
  };

  jsonpRequest(
    SCRIPT_URL,
    params,
    callbackName,
    (result) => {
      if (result.success) {
        showReservationAlert(`Reservasi berhasil. ID: ${result.reservation_id}`, "success");
        document.getElementById("reservationForm").reset();
        document.getElementById("guestsContainer").innerHTML = "";
      } else {
        showReservationAlert(result.message || "Gagal mengirim reservasi", "danger");
      }
    },
    (err) => {
      console.error("Error submitReservation JSONP:", err);
      showReservationAlert("Kesalahan jaringan / timeout.", "danger");
    }
  );
}


/**
 * Tampilkan pesan (alert) form reservasi
 */
function showReservationAlert(msg, type) {
  const el = document.getElementById("reservationAlert");
  el.textContent = msg;
  el.className = `mt-2 alert alert-${type}`;
  setTimeout(() => {
    el.textContent = "";
    el.className = "";
  }, 5000);
}

/**
 * Load tabel Manajemen Reservasi (Admin)
 */
async function loadManagement() {
  const container = document.getElementById("contentManagement");
  container.innerHTML = `
    <h4>Manajemen Reservasi</h4>
    <div class="mb-3">
      <select id="filterStatus" class="form-select w-25">
        <option value="">Semua Status</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="checked-in">Checked In</option>
        <option value="checked-out">Checked Out</option>
      </select>
    </div>
    <table class="table table-bordered" id="tblReservations">
      <thead class="table-light">
        <tr>
          <th>ID</th>
          <th>Pemesan</th>
          <th>Unit</th>
          <th>Check-In</th>
          <th>Check-Out</th>
          <th>Status</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;

  document.getElementById("filterStatus").addEventListener("change", loadManagement);

  const filter = document.getElementById("filterStatus").value;
  const callbackName = "jsonpFetchRes_" + Date.now();
  const params = {
    action: "fetchReservations",
    filterStatus: filter
  };

  jsonpRequest(
    SCRIPT_URL,
    params,
    callbackName,
    (result) => {
      if (result.success) {
        renderReservationsTable(result.data);
      }
    },
    (err) => {
      console.error("Error fetchReservations JSONP:", err);
    }
  );
}
/**
 * Render baris-baris tabel Reservasi di admin
 */
function renderReservationsTable(data) {
  const tbody = document.querySelector("#tblReservations tbody");
  tbody.innerHTML = "";
  data.forEach((item) => {
    const tr = document.createElement("tr");
    let aksiBtns = '';
    if (item.status === "pending") {
      aksiBtns = `
        <button class="btn btn-sm btn-success me-1" onclick="approveReservation('${item.reservation_id}')">Approve</button>
        <button class="btn btn-sm btn-danger" onclick="rejectReservation('${item.reservation_id}')">Reject</button>`;
    } else if (item.status === "approved") {
      aksiBtns = `<button class="btn btn-sm btn-primary me-1" onclick="checkIn('${item.reservation_id}')">Check In</button>`;
    } else if (item.status === "checked-in") {
      aksiBtns = `<button class="btn btn-sm btn-warning" onclick="checkOut('${item.reservation_id}')">Check Out</button>`;
    } else {
      aksiBtns = `-`;
    }
    tr.innerHTML = `
      <td>${item.reservation_id}</td>
      <td>${item.requester_name}</td>
      <td>${item.requester_unit}</td>
      <td>${item.checkin_date}</td>
      <td>${item.checkout_date}</td>
      <td>${item.status}</td>
      <td>${aksiBtns}</td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Aksi Approve Reservasi (Admin)
 */
function approveReservation(id) {
  const user = JSON.parse(sessionStorage.getItem("user"));
  const callbackName = "jsonpApproveRes_" + Date.now();
  const params = {
    action: "approveReservation",
    reservation_id: id,
    admin_user: user.username
  };
  jsonpRequest(
    SCRIPT_URL,
    params,
    callbackName,
    (result) => {
      if (result.success) loadManagement();
      else alert("Gagal approve: " + result.message);
    },
    (err) => { console.error(err); }
  );
}

/**
 * Aksi Reject Reservasi (Admin)
 */
function rejectReservation(id) {
  const user = JSON.parse(sessionStorage.getItem("user"));
  const callbackName = "jsonpRejectRes_" + Date.now();
  const params = {
    action: "rejectReservation",
    reservation_id: id,
    admin_user: user.username
  };
  jsonpRequest(
    SCRIPT_URL,
    params,
    callbackName,
    (result) => {
      if (result.success) loadManagement();
      else alert("Gagal reject: " + result.message);
    },
    (err) => { console.error(err); }
  );
}

/**
 * Aksi Check In (Admin)
 */
function checkIn(id) {
  const assignedRoom = prompt("Masukkan Room ID untuk Check In:");
  if (!assignedRoom) return;
  const user = JSON.parse(sessionStorage.getItem("user"));
  const callbackName = "jsonpCheckIn_" + Date.now();
  const params = {
    action: "checkIn",
    reservation_id: id,
    assigned_room: assignedRoom,
    admin_user: user.username
  };
  jsonpRequest(
    SCRIPT_URL,
    params,
    callbackName,
    (result) => {
      if (result.success) loadManagement();
      else alert("Gagal check-in: " + result.message);
    },
    (err) => { console.error(err); }
  );
}

/**
 * Aksi Check Out (Admin)
 */
function checkOut(id) {
  const user = JSON.parse(sessionStorage.getItem("user"));
  const callbackName = "jsonpCheckOut_" + Date.now();
  const params = {
    action: "checkOut",
    reservation_id: id,
    admin_user: user.username
  };
  jsonpRequest(
    SCRIPT_URL,
    params,
    callbackName,
    (result) => {
      if (result.success) loadManagement();
      else alert("Gagal check-out: " + result.message);
    },
    (err) => { console.error(err); }
  );
}
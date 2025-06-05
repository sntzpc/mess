// js/reservation.js

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
        <div class="col-12 col-md-4">
          <label for="reqName" class="form-label">Nama Pemesan</label>
          <input type="text" id="reqName" class="form-control" required>
        </div>
        <div class="col-12 col-md-4">
          <label for="reqUnit" class="form-label">Unit Pemesan</label>
          <input type="text" id="reqUnit" class="form-control" required>
        </div>
        <div class="col-12 col-md-4">
          <label for="reqPosition" class="form-label">Jabatan Pemesan</label>
          <input type="text" id="reqPosition" class="form-control" required>
        </div>
      </div>

      <!-- Jumlah Tamu -->
      <div class="row mb-3">
        <div class="col-12 col-md-4">
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
        <div class="mt-1">
          <a href="template_tamu.xlsx" download class="link-primary">
            ⬇️ Download Template Data Tamu (Excel)
          </a>
        </div>
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

  const numGuestsSelect = document.getElementById("numGuests");
  const guestFileInput  = document.getElementById("guestFile");

  // Ketika dropdown "Jumlah Tamu" berubah → render form tamu manual, kecuali ada file terpilih
  numGuestsSelect.addEventListener("change", (e) => {
    if (guestFileInput.files.length) return;
    const count = parseInt(e.target.value);
    renderGuestFields(count);
  });

  // Ketika user memilih/membatalkan file upload
  guestFileInput.addEventListener("change", (e) => {
    if (e.target.files.length) {
      numGuestsSelect.disabled = true;
      numGuestsSelect.removeAttribute("required");
      document.getElementById("guestsContainer").innerHTML = "";
      handleGuestFileUpload(e);
    } else {
      numGuestsSelect.disabled = false;
      numGuestsSelect.setAttribute("required", "");
      document.getElementById("guestsContainer").innerHTML = "";
    }
  });

  document.getElementById("reservationForm").addEventListener("submit", handleReservationSubmit);

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
  reader.onload = function (evt) {
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
          guest_name:     row[0] || "",
          guest_unit:     row[1] || "",
          guest_position: row[2] || "",
          guest_gender:   row[3] || ""
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
    document.querySelector(`.guestName[data-index="${i}"]`).value     = g.guest_name;
    document.querySelector(`.guestUnit[data-index="${i}"]`).value     = g.guest_unit;
    document.querySelector(`.guestPosition[data-index="${i}"]`).value = g.guest_position;
    document.querySelector(`.guestGender[data-index="${i}"]`).value   = g.guest_gender;
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

  const guestFile = document.getElementById("guestFile");
  let guest_details = [];
  let num_guests    = 0;

  if (guestFile.files.length) {
    num_guests = document.querySelectorAll(".guestName").length;
    for (let i = 1; i <= num_guests; i++) {
      guest_details.push({
        guest_name:     document.querySelector(`.guestName[data-index="${i}"]`).value.trim(),
        guest_unit:     document.querySelector(`.guestUnit[data-index="${i}"]`).value.trim(),
        guest_position: document.querySelector(`.guestPosition[data-index="${i}"]`).value.trim(),
        guest_gender:   document.querySelector(`.guestGender[data-index="${i}"]`).value
      });
    }
  } else {
    num_guests = parseInt(document.getElementById("numGuests").value);
    for (let i = 1; i <= num_guests; i++) {
      guest_details.push({
        guest_name:     document.querySelector(`.guestName[data-index="${i}"]`).value.trim(),
        guest_unit:     document.querySelector(`.guestUnit[data-index="${i}"]`).value.trim(),
        guest_position: document.querySelector(`.guestPosition[data-index="${i}"]`).value.trim(),
        guest_gender:   document.querySelector(`.guestGender[data-index="${i}"]`).value
      });
    }
  }

  const agenda        = document.getElementById("agenda").value.trim();
  const assigned_room = document.getElementById("assignedRoom").value;

  const callbackName = "jsonpSubmitRes_" + Date.now();
  const params = {
    action:            "submitReservation",
    requester_name:    requester_name,
    requester_unit:    requester_unit,
    requester_position: requester_position,
    num_guests:        num_guests.toString(),
    guest_details:     JSON.stringify(guest_details),
    agenda:            agenda,
    checkin_date:      checkin,
    checkout_date:     checkout,
    assigned_room:     assigned_room
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
        document.getElementById("numGuests").disabled = false;
        document.getElementById("numGuests").setAttribute("required", "");
      } else {
        showReservationAlert(result.message || "Gagal mengirim reservasi", "danger");
      }
    },
    (err) => {
      console.error("Error submitReservation JSONP:", err);
      showReservationAlert("Kesalahan jaringan / timeout.", "danger");
      document.getElementById("numGuests").disabled = false;
      document.getElementById("numGuests").setAttribute("required", "");
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

// ------------------------ Paging dan pencarian untuk Manajemen Reservasi ------------------------

// Variabel global untuk menyimpan data reservasi dan status paging
let resReservationsData = [];
let resFilteredReservations = [];
let resCurrentPage = 1;
let resPageSize = 20; // default 20
let resTotalPages = 0;

/**
 * Load tabel Manajemen Reservasi (Admin) — versi baru dengan paging, search, page size,
 * dan daftar tamu yang bisa expand/collapse
 */
async function loadManagement() {
  const container = document.getElementById("contentManagement");
  container.innerHTML = `
    <h4>Manajemen Reservasi</h4>
    <div class="row mb-3">
      <div class="col-md-4">
        <input type="text" id="searchRes" class="form-control" placeholder="Cari reservasi...">
      </div>
      <div class="col-md-2">
        <select id="selectResPageSize" class="form-select">
          <option value="20" selected>20 / halaman</option>
          <option value="50">50 / halaman</option>
          <option value="100">100 / halaman</option>
          <option value="500">500 / halaman</option>
        </select>
      </div>
      <div class="col-md-3">
        <select id="filterStatus" class="form-select">
          <option value="">Semua Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="checked-in">Checked In</option>
          <option value="checked-out">Checked Out</option>
        </select>
      </div>
    </div>
    <table class="table table-bordered" id="tblReservations">
      <thead class="table-light">
        <tr>
          <th></th>
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
    <nav>
      <ul class="pagination" id="paginationRes"></ul>
    </nav>
  `;

  document.getElementById("searchRes").addEventListener("input", () => {
    resCurrentPage = 1;
    applyFilterSearchAndRender();
  });
  document.getElementById("selectResPageSize").addEventListener("change", (e) => {
    resPageSize = parseInt(e.target.value, 10);
    resCurrentPage = 1;
    applyFilterSearchAndRender();
  });
  document.getElementById("filterStatus").addEventListener("change", () => {
    resCurrentPage = 1;
    applyFilterSearchAndRender();
  });

  const filter = document.getElementById("filterStatus").value;
  const callbackName = "jsonpFetchRes_" + Date.now();
  const params = {
    action:       "fetchReservations",
    filterStatus: filter
  };

  jsonpRequest(
    SCRIPT_URL,
    params,
    callbackName,
    (result) => {
      if (result.success) {
        // Urutkan berdasarkan timestamp descending (yang terbaru paling atas)
        resReservationsData = (result.data || []).sort((a, b) => {
          return new Date(b.timestamp) - new Date(a.timestamp);
        });
        applyFilterSearchAndRender();
      }
    },
    (err) => {
      console.error("Error fetchReservations JSONP:", err);
    }
  );
}

/**
 * Terapkan filter status + search dan hitung paging, lalu render tabel + pagination
 */
function applyFilterSearchAndRender() {
  const searchTerm = document.getElementById("searchRes").value.trim().toLowerCase();
  const statusFilter = document.getElementById("filterStatus").value;

  resFilteredReservations = resReservationsData.filter(item => {
    const statusMatch = statusFilter ? item.status === statusFilter : true;
    const textMatch = (
      (item.reservation_id || "").toLowerCase().includes(searchTerm) ||
      (item.requester_name || "").toLowerCase().includes(searchTerm) ||
      (item.requester_unit || "").toLowerCase().includes(searchTerm) ||
      (item.checkin_date || "").toLowerCase().includes(searchTerm) ||
      (item.checkout_date || "").toLowerCase().includes(searchTerm) ||
      (item.status || "").toLowerCase().includes(searchTerm)
    );
    return statusMatch && textMatch;
  });

  resTotalPages = Math.ceil(resFilteredReservations.length / resPageSize) || 1;
  renderReservationsTablePaginated();
  renderReservationsPaginationControls();
}

/**
 * Render baris‐baris tabel hanya untuk halaman resCurrentPage
 * Setiap baris utama diikuti baris collapsible untuk daftar tamu, default hidden.
 */
function renderReservationsTablePaginated() {
  const tbody = document.querySelector("#tblReservations tbody");
  tbody.innerHTML = "";

  if (!resFilteredReservations.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center">Tidak ada reservasi</td></tr>`;
    return;
  }

  const start = (resCurrentPage - 1) * resPageSize;
  const end   = start + resPageSize;
  const pageData = resFilteredReservations.slice(start, end);

  pageData.forEach((item) => {
    // Baris utama
    const trMain = document.createElement("tr");
    trMain.innerHTML = `
      <td>
        <button class="btn btn-sm btn-outline-secondary" onclick="toggleGuests('${item.reservation_id}')">
          ➕
        </button>
      </td>
      <td>${item.reservation_id}</td>
      <td>${item.requester_name}</td>
      <td>${item.requester_unit}</td>
      <td>${item.checkin_date}</td>
      <td>${item.checkout_date}</td>
      <td>${item.status}</td>
      <td>${getAksiButtons(item)}</td>
    `;
    tbody.appendChild(trMain);

    // Baris collapsible untuk daftar tamu (default disembunyikan)
    const trGuests = document.createElement("tr");
    trGuests.id = `guests-row-${item.reservation_id}`;
    trGuests.style.display = "none";
    trGuests.innerHTML = `
      <td colspan="8" id="guests-container-${item.reservation_id}" data-loaded="false">
        <!-- Konten akan di‐load secara Dinamis -->
      </td>
    `;
    tbody.appendChild(trGuests);
  });
}

/**
 * Render kontrol pagination dengan ellipsis jika resTotalPages > 5
 */
function renderReservationsPaginationControls() {
  const ul = document.getElementById("paginationRes");
  ul.innerHTML = "";

  function createPageItem(page, text, disabled = false, active = false) {
    const li = document.createElement("li");
    li.className = "page-item" + (disabled ? " disabled" : "") + (active ? " active" : "");
    const a = document.createElement("a");
    a.className = "page-link";
    a.href = "#";
    a.textContent = text;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      if (page !== resCurrentPage && !disabled) {
        resCurrentPage = page;
        renderReservationsTablePaginated();
        renderReservationsPaginationControls();
      }
    });
    li.appendChild(a);
    return li;
  }

  // Tombol “Previous”
  const prevDisabled = resCurrentPage === 1;
  ul.appendChild(createPageItem(resCurrentPage - 1, "«", prevDisabled, false));

  if (resTotalPages <= 5) {
    for (let p = 1; p <= resTotalPages; p++) {
      ul.appendChild(createPageItem(p, p, false, p === resCurrentPage));
    }
  } else {
    ul.appendChild(createPageItem(1, "1", false, resCurrentPage === 1));

    const left  = Math.max(2, resCurrentPage - 1);
    const right = Math.min(resTotalPages - 1, resCurrentPage + 1);

    if (left > 2) {
      const li = document.createElement("li");
      li.className = "page-item disabled";
      li.innerHTML = `<span class="page-link">…</span>`;
      ul.appendChild(li);
    }

    for (let p = left; p <= right; p++) {
      ul.appendChild(createPageItem(p, p, false, p === resCurrentPage));
    }

    if (right < resTotalPages - 1) {
      const li = document.createElement("li");
      li.className = "page-item disabled";
      li.innerHTML = `<span class="page-link">…</span>`;
      ul.appendChild(li);
    }

    ul.appendChild(createPageItem(resTotalPages, resTotalPages, false, resCurrentPage === resTotalPages));
  }

  // Tombol “Next”
  const nextDisabled = resCurrentPage === resTotalPages;
  ul.appendChild(createPageItem(resCurrentPage + 1, "»", nextDisabled, false));
}

/**
 * Menghasilkan HTML untuk tombol Aksi (Approve/Reject/Check In/Check Out)
 */
function getAksiButtons(item) {
  const id = item.reservation_id;
  if (item.status === "pending") {
    return `
      <button class="btn btn-sm btn-success me-1" onclick="approveReservation('${id}')">Approve</button>
      <button class="btn btn-sm btn-danger" onclick="rejectReservation('${id}')">Reject</button>
    `;
  } else if (item.status === "approved") {
    return `<button class="btn btn-sm btn-primary me-1" onclick="checkIn('${id}')">Check In</button>`;
  } else if (item.status === "checked-in") {
    return `<button class="btn btn-sm btn-warning" onclick="checkOut('${id}')">Check Out</button>`;
  } else {
    return `-`;
  }
}

/**
 * Toggle baris daftar tamu: jika hidden → tampilkan dan load data, 
 * jika tampilkan → sembunyikan.
 */
function toggleGuests(reservationId) {
  const trGuests = document.getElementById(`guests-row-${reservationId}`);
  const btn = trGuests.previousElementSibling.querySelector("button");
  if (trGuests.style.display === "none") {
    trGuests.style.display = "";
    btn.textContent = "➖";
    // Jika belum ada konten, load dari server
    const container = document.getElementById(`guests-container-${reservationId}`);
    if (container.dataset.loaded === "false") {
      container.textContent = "Loading tamu...";
      const callbackName = "jsonpFetchGuests_" + Date.now();
      jsonpRequest(
        SCRIPT_URL,
        { action: "fetchGuests", reservation_id: reservationId },
        callbackName,
        (result) => {
          if (result.success) {
            renderGuestList(reservationId, result.data);
            container.dataset.loaded = "true";
          } else {
            container.textContent = "Gagal load daftar tamu";
          }
        },
        (err) => {
          console.error("Error fetchGuests JSONP:", err);
          container.textContent = "Gagal load daftar tamu";
        }
      );
    }
  } else {
    trGuests.style.display = "none";
    btn.textContent = "➕";
  }
}

/**
 * Render daftar tamu (dipanggil oleh toggleGuests)
 * Parameter `guests` adalah array objek {guest_name, guest_unit,
 * guest_position, guest_gender}, diambil dari sheet "Guests".
 */
function renderGuestList(reservationId, guests) {
  const container = document.getElementById(`guests-container-${reservationId}`);
  if (!guests.length) {
    container.innerHTML = `<em>Tidak ada tamu</em>`;
    return;
  }
  let html = `<ul class="list-group">`;
  guests.forEach((g) => {
    html += `
      <li class="list-group-item">
        <strong>${g.guest_name}</strong> — ${g.guest_unit}, ${g.guest_position} (${g.guest_gender})
      </li>
    `;
  });
  html += `</ul>`;
  container.innerHTML = html;
}

/**
 * Aksi Approve Reservasi (Admin)
 */
function approveReservation(id) {
  const user = JSON.parse(sessionStorage.getItem("user"));
  const callbackName = "jsonpApproveRes_" + Date.now();
  const params = {
    action:         "approveReservation",
    reservation_id: id,
    admin_user:     user.username
  };
  jsonpRequest(
    SCRIPT_URL,
    params,
    callbackName,
    (result) => {
      if (result.success) loadManagement();
      else alert("Gagal approve: " + result.message);
    },
    (err) => {
      console.error(err);
    }
  );
}

/**
 * Aksi Reject Reservasi (Admin)
 */
function rejectReservation(id) {
  const user = JSON.parse(sessionStorage.getItem("user"));
  const callbackName = "jsonpRejectRes_" + Date.now();
  const params = {
    action:         "rejectReservation",
    reservation_id: id,
    admin_user:     user.username
  };
  jsonpRequest(
    SCRIPT_URL,
    params,
    callbackName,
    (result) => {
      if (result.success) loadManagement();
      else alert("Gagal reject: " + result.message);
    },
    (err) => {
      console.error(err);
    }
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
    action:         "checkIn",
    reservation_id: id,
    assigned_room:  assignedRoom,
    admin_user:     user.username
  };
  jsonpRequest(
    SCRIPT_URL,
    params,
    callbackName,
    async (result) => {
      if (result.success) {
        // Setelah sukses check-in, fetch daftar tamu
        const guestsCallback = "jsonpGuests_" + Date.now();
        jsonpRequest(
          SCRIPT_URL,
          { action: "fetchGuests", reservation_id: id },
          guestsCallback,
          (resGuests) => {
            if (resGuests.success && resGuests.data && resGuests.data.length) {
              const nowIso = new Date().toISOString();
              resGuests.data.forEach(guest => {
                // Panggil createJournalEntry untuk setiap tamu
                const journalParams = {
                  action: 'createJournalEntry',
                  reservation_id: id,
                  guest_name: guest.guest_name,
                  guest_unit: guest.guest_unit,
                  guest_position: guest.guest_position,
                  assigned_room: assignedRoom,
                  checkin_timestamp: nowIso,
                  admin_user: user.username,
                  callback: "callbackFn"
                };
                // Kirim request ke GAS
                fetch(`${SCRIPT_URL}?${(new URLSearchParams(journalParams)).toString()}`)
                  .then(r => r.text())
                  .then(txt => {
                    // Opsional: handle respon per-tamu
                    // const result = JSON.parse(txt.replace(/^callbackFn\((.*)\);?$/, '$1'));
                  });
              });
            }
            loadManagement(); // Refresh tampilan
          },
          (err) => {
            alert("Check-in berhasil, tapi gagal mengambil data tamu.");
            loadManagement();
          }
        );
      } else {
        alert("Gagal check-in: " + result.message);
      }
    },
    (err) => {
      console.error(err);
    }
  );
}


/**
 * Aksi Check Out (Admin)
 */
function checkOut(id) {
  const user = JSON.parse(sessionStorage.getItem("user"));
  // Modifikasi agar panggil checkOutReservation (update ke Journal GAS)
  checkOutReservation(id, user.username).then(result => {
    if (result.success) {
      loadManagement();
    } else {
      alert("Gagal check-out: " + result.message);
    }
  }).catch(err => {
    console.error(err);
    alert("Gagal check-out (jaringan): " + err);
  });
}

// Contoh: Fungsi panggil GAS untuk update checkout Journal
async function checkOutReservation(reservation_id, admin_user) {
  const nowIso = new Date().toISOString();
  const params = new URLSearchParams({
    action: 'updateJournalExit',
    reservation_id: reservation_id,
    checkout_timestamp: nowIso,
    last_timestamp: nowIso,
    admin_user: admin_user,
    callback: 'callbackFn' // Jika menggunakan JSONP, sesuaikan dengan setup anda
  });
  // Panggil endpoint GAS (SCRIPT_URL harus sudah didefinisikan)
  const url = `${SCRIPT_URL}?${params.toString()}`;
  return fetch(url)
    .then(r => r.text())
    .then(txt => {
      // Jika JSONP, perlu parsing, misal:
      // callbackFn({...result...});
      // Di bawah contoh parsing manual:
      const result = JSON.parse(txt.replace(/^callbackFn\((.*)\);?$/, '$1'));
      if (result.success) {
        alert('Check-Out berhasil!');
      } else {
        alert('Check-Out gagal: ' + result.message);
      }
      return result;
    });
}


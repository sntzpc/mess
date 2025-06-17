// js/users.js

// Fungsi untuk menambahkan styles dinamis untuk tabel Jurnal
function addJournalTableStyles() {
  if (document.getElementById('journal-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'journal-styles';
  style.textContent = `
    .journal-responsive-container {
      max-width: 100%;
      overflow: auto;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      margin-bottom: 1rem;
    }
    
    #tblJournal {
      width: 100%;
      white-space: nowrap;
      margin-bottom: 0;
    }
    
    #tblJournal th, #tblJournal td {
      vertical-align: middle;
      padding: 8px 12px;
    }
    
    #tblJournal thead th {
      position: sticky;
      top: 0;
      background-color: #f8f9fa;
      z-index: 10;
    }
    
    #tblJournal tbody tr:hover {
      background-color: rgba(0,0,0,0.02);
    }
  `;
  document.head.appendChild(style);
}

function addLogsTableStyles() {
  if (document.getElementById('logs-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'logs-styles';
  style.textContent = `
    .logs-responsive-container {
      max-width: 100%;
      overflow: auto;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      margin-bottom: 1rem;
    }
    
    #tblLogs {
      width: 100%;
      white-space: nowrap;
      margin-bottom: 0;
    }
    
    #tblLogs th, #tblLogs td {
      vertical-align: middle;
      padding: 8px 12px;
    }
    
    #tblLogs thead th {
      position: sticky;
      top: 0;
      background-color: #f8f9fa;
      z-index: 10;
    }
    
    #tblLogs tbody tr:hover {
      background-color: rgba(0,0,0,0.02);
    }
  `;
  document.head.appendChild(style);
}

/**
 * Load Manajemen User (Admin)
 */
async function loadUsers() {
  const container = document.getElementById("contentUsers");
  container.innerHTML = `
    <h4>Manajemen User</h4>
    <button class="btn btn-success mb-3" id="btnAddUser">Tambah User</button>
    <table class="table table-bordered" id="tblUsers">
      <thead class="table-light">
        <tr>
          <th>Username</th>
          <th>Role</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>

    <!-- Modal Tambah/Edit User -->
    <div class="modal fade" id="modalUser" tabindex="-1" aria-labelledby="modalUserLabel" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="modalUserLabel">Tambah/Edit User</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <form id="userForm">
              <input type="hidden" id="userUsernameInput">
              <div class="mb-3">
                <label for="newUsername" class="form-label">Username</label>
                <input type="text" class="form-control" id="newUsername" required>
              </div>
              <div class="mb-3">
                <label for="newPassword" class="form-label">Password</label>
                <input type="password" class="form-control" id="newPassword" required>
              </div>
              <div class="mb-3">
                <label for="newRole" class="form-label">Role</label>
                <select id="newRole" class="form-select" required>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button type="submit" class="btn btn-primary">Simpan</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("btnAddUser").addEventListener("click", () => {
    document.getElementById("modalUserLabel").textContent = "Tambah User";
    document.getElementById("userForm").reset();
    document.getElementById("userUsernameInput").value = "";
    document.getElementById("newUsername").disabled = false;
    document.getElementById("newUsername").focus();
    new bootstrap.Modal(document.getElementById("modalUser")).show();
  });
  document.getElementById("userForm").addEventListener("submit", handleUserFormSubmit);

  // Fetch data user dengan JSONP
  const callbackName = "jsonpFetchUsers_" + Date.now();
  jsonpRequest(
    SCRIPT_URL, {
      action: "fetchUsers"
    },
    callbackName,
    (result) => {
      if (result.success) {
        window.usersCache = result.data;
        renderUsersTable(result.data);
      }
    },
    (err) => {
      console.error(err);
    }
  );
}

/**
 * Render tabel user
 */
function renderUsersTable(data) {
  const tbody = document.querySelector("#tblUsers tbody");
  tbody.innerHTML = "";
  data.forEach((u) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.username}</td>
      <td>${u.role}</td>
      <td>
        <button class="btn btn-sm btn-warning me-1" onclick="editUser('${u.username}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteUser('${u.username}')">Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}


/**
 * Isi form Edit User
 */
function editUser(username) {
  const user = window.usersCache.find((u) => u.username === username);
  if (!user) return;
  document.getElementById("modalUserLabel").textContent = "Edit User";
  document.getElementById("userUsernameInput").value = user.username;
  document.getElementById("newUsername").value = user.username;
  document.getElementById("newUsername").disabled = true;
  document.getElementById("newPassword").value = "";
  document.getElementById("newRole").value = user.role;
  new bootstrap.Modal(document.getElementById("modalUser")).show();
}

/**
 * Submit form tambah/edit user (Admin)
 */
function handleUserFormSubmit(e) {
  e.preventDefault();
  const origUsername = document.getElementById("userUsernameInput").value;
  const username = document.getElementById("newUsername").value.trim();
  const password = document.getElementById("newPassword").value;
  const role = document.getElementById("newRole").value;
  const userLoggedIn = JSON.parse(sessionStorage.getItem("user"));
  const isEdit = Boolean(origUsername);
  const callbackName = (isEdit ? "jsonpUpdateUser_" : "jsonpCreateUser_") + Date.now();
  const params = isEdit ?
    {
      action: "updateUser",
      username,
      password,
      role,
      admin_user: userLoggedIn.username
    } :
    {
      action: "createUser",
      username,
      password,
      role,
      admin_user: userLoggedIn.username
    };

  jsonpRequest(
    SCRIPT_URL,
    params,
    callbackName,
    (result) => {
      if (result.success) {
        new bootstrap.Modal(document.getElementById("modalUser")).hide();
        loadUsers();
      } else {
        alert("Gagal simpan user: " + result.message);
      }
    },
    (err) => {
      console.error(err);
    }
  );
}

/**
 * Hapus user (Admin)
 */
function deleteUser(username) {
  if (!confirm("Yakin ingin menghapus user ini?")) return;
  const userLoggedIn = JSON.parse(sessionStorage.getItem("user"));
  const callbackName = "jsonpDeleteUser_" + Date.now();
  const params = {
    action: "deleteUser",
    username,
    admin_user: userLoggedIn.username
  };
  jsonpRequest(
    SCRIPT_URL,
    params,
    callbackName,
    (result) => {
      if (result.success) {
        loadUsers();
      } else {
        alert("Gagal hapus user: " + result.message);
      }
    },
    (err) => {
      console.error(err);
    }
  );
}

/**
 * Load Profil (tab “Profil”)
 */
function loadProfile() {
  const container = document.getElementById("contentProfile");
  container.innerHTML = `
    <h4>Profil Saya</h4>
    <div class="card p-3 w-50">
      <div><strong>Username:</strong> <span id="profUsername"></span></div>
      <div><strong>Role:</strong> <span id="profRole"></span></div>
    </div>
  `;
  const user = JSON.parse(sessionStorage.getItem("user"));
  document.getElementById("profUsername").textContent = user.username;
  document.getElementById("profRole").textContent = user.role;
}

/**
 * Load Log Sistem (Admin)
 */
// js/users.js (Bagian Log Sistem yang sudah di‐sort)

// Variabel global untuk menyimpan data log dan status paging
let logsData = [];
let filteredLogs = [];
let currentPage = 1;
let pageSize = 20; // default 20
let totalPages = 0;

/**
 * Load Log Sistem (Admin) — versi baru dengan paging, search, page size,
 * dan pengurutan data terbaru (timestamp) di atas.
 */
function loadLogs() {
  const container = document.getElementById("contentLogs");
  container.innerHTML = `
    <h4>Log Sistem</h4>
    <div class="row mb-3">
      <div class="col-md-4">
        <input type="text" id="searchLogs" class="form-control" placeholder="Cari log...">
      </div>
      <div class="col-md-2">
        <select id="selectPageSize" class="form-select">
          <option value="20" selected>20 / halaman</option>
          <option value="50">50 / halaman</option>
          <option value="100">100 / halaman</option>
          <option value="500">500 / halaman</option>
        </select>
      </div>
    </div>
    <div class="logs-responsive-container">
      <table class="table table-striped" id="tblLogs">
        <thead class="table-light">
          <tr>
            <th>Log ID</th>
            <th>Reservasi ID</th>
            <th>Aksi</th>
            <th>Waktu</th>
            <th>Admin</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
    <nav>
      <ul class="pagination" id="paginationLogs"></ul>
    </nav>
  `;

  // Tambahkan styles untuk tabel log
  addLogsTableStyles();

  // Event listener untuk pencarian (search)
  document.getElementById("searchLogs").addEventListener("input", () => {
    currentPage = 1;
    applySearchAndRender();
  });

  // Event listener untuk mengganti page size
  document.getElementById("selectPageSize").addEventListener("change", (e) => {
    pageSize = parseInt(e.target.value, 10);
    currentPage = 1;
    applySearchAndRender();
  });

  // Fetch data log via JSONP
  const callbackName = "jsonpFetchLogs_" + Date.now();
  jsonpRequest(
    SCRIPT_URL, {
      action: "fetchLogs"
    },
    callbackName,
    (result) => {
      if (result.success) {
        // Simpan data awal
        logsData = result.data || [];

        // Sort logsData berdasarkan timestamp (descending: terbaru di atas)
        logsData.sort((a, b) => {
          const dateA = new Date(a.timestamp);
          const dateB = new Date(b.timestamp);
          return dateB - dateA;
        });

        // Setelah di‐sort, langsung terapkan search & render
        applySearchAndRender();
      } else {
        console.error("fetchLogs gagal:", result.message);
      }
    },
    (err) => {
      console.error("Error fetchLogs JSONP:", err);
    }
  );
}

/**
 * Terapkan filter pencarian dan hitung jumlah halaman, lalu render tabel + pagination
 */
function applySearchAndRender() {
  const term = document.getElementById("searchLogs").value.trim().toLowerCase();
  if (term) {
    filteredLogs = logsData.filter(log => {
      return (
        (log.log_id || "").toLowerCase().includes(term) ||
        (log.reservation_id || "").toLowerCase().includes(term) ||
        (log.action || "").toLowerCase().includes(term) ||
        (log.timestamp || "").toLowerCase().includes(term) ||
        (log.admin_user || "").toLowerCase().includes(term)
      );
    });
  } else {
    // Jika tidak ada pencarian, gunakan seluruh logsData yang sudah di‐sort
    filteredLogs = logsData.slice();
  }
  totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  renderLogsTablePaginated();
  renderPaginationControls();
}

/**
 * Render baris‐baris tabel hanya untuk halaman currentPage
 */
function renderLogsTablePaginated() {
  const tbody = document.querySelector("#tblLogs tbody");
  tbody.innerHTML = "";

  if (!filteredLogs.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center">Tidak ada data log</td></tr>`;
    return;
  }

  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pageData = filteredLogs.slice(start, end);

  pageData.forEach((log) => {
    const tr = document.createElement("tr");
    // Format timestamp menjadi lebih mudah dibaca
    const timestamp = log.timestamp ? formatDateTimeIndo(new Date(log.timestamp)) : '-';
    
    tr.innerHTML = `
      <td>${log.log_id || '-'}</td>
      <td>${log.reservation_id || '-'}</td>
      <td>${log.action || '-'}</td>
      <td>${timestamp}</td>
      <td>${log.admin_user || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Render kontrol pagination dengan ellipsis jika totalPages > 5
 */
function renderPaginationControls() {
  const ul = document.getElementById("paginationLogs");
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
      if (page !== currentPage && !disabled) {
        currentPage = page;
        renderLogsTablePaginated();
        renderPaginationControls();
      }
    });
    li.appendChild(a);
    return li;
  }

  // Tombol “Previous”
  const prevDisabled = currentPage === 1;
  ul.appendChild(createPageItem(currentPage - 1, "«", prevDisabled, false));

  if (totalPages <= 5) {
    // Jika total halaman ≤ 5, tampilkan semua
    for (let p = 1; p <= totalPages; p++) {
      ul.appendChild(createPageItem(p, p, false, p === currentPage));
    }
  } else {
    // Tampilkan halaman 1
    ul.appendChild(createPageItem(1, "1", false, currentPage === 1));

    const left = Math.max(2, currentPage - 1);
    const right = Math.min(totalPages - 1, currentPage + 1);

    if (left > 2) {
      const li = document.createElement("li");
      li.className = "page-item disabled";
      li.innerHTML = `<span class="page-link">…</span>`;
      ul.appendChild(li);
    }

    for (let p = left; p <= right; p++) {
      ul.appendChild(createPageItem(p, p, false, p === currentPage));
    }

    if (right < totalPages - 1) {
      const li = document.createElement("li");
      li.className = "page-item disabled";
      li.innerHTML = `<span class="page-link">…</span>`;
      ul.appendChild(li);
    }

    // Tampilkan halaman terakhir
    ul.appendChild(createPageItem(totalPages, totalPages, false, currentPage === totalPages));
  }

  // Tombol “Next”
  const nextDisabled = currentPage === totalPages;
  ul.appendChild(createPageItem(currentPage + 1, "»", nextDisabled, false));
}

// =======================================================
// JURNAL TAMU (penuh dengan kolom “No. Kamar”)
// =======================================================

// Variabel global untuk Jurnal
let guestsData = []; // data tamu (dari sheet Guests, jika diperlukan)
let reservationsData = []; // data reservasi (dari sheet Reservations)
let journalData = []; // data Jurnal (dari sheet Journal)
let filteredJournal = []; // hasil filter (tanggal)
let currentPageJournal = 1; // halaman sekarang
let pageSizeJournal = 20; // default 20 row per halaman
let totalJournalPages = 0; // total halaman


/**
 * Load Jurnal Tamu (Admin)
 */
function loadJournal() {
  const container = document.getElementById("contentJournal");
  container.innerHTML = `
    <h4>Jurnal Tamu</h4>

    <!-- (1) Filter Tanggal & Page Size & Export -->
    <div class="row mb-3">
      <div class="col-md-3">
        <label for="filterStartDate" class="form-label">Dari Tanggal</label>
        <input type="date" id="filterStartDate" class="form-control">
      </div>
      <div class="col-md-3">
        <label for="filterEndDate" class="form-label">Sampai Tanggal</label>
        <input type="date" id="filterEndDate" class="form-control">
      </div>
      <div class="col-md-2">
        <label for="selectPageSizeJournal" class="form-label">Tampilkan</label>
        <select id="selectPageSizeJournal" class="form-select">
          <option value="20" selected>20 / halaman</option>
          <option value="50">50 / halaman</option>
          <option value="100">100 / halaman</option>
          <option value="500">500 / halaman</option>
        </select>
      </div>
      <div class="col-md-4 d-flex align-items-end justify-content-end">
        <button id="btnExportExcelJournal" class="btn btn-success me-2">Export Excel</button>
        <button id="btnExportPDFJournal" class="btn btn-danger">Export PDF</button>
      </div>
    </div>

    <!-- (2) Tabel Jurnal Tamu -->
    <div class="journal-responsive-container">
      <table class="table table-striped" id="tblJournal">
        <thead class="table-light">
          <tr>
            <th>No.</th>
            <th>Nama</th>
            <th>Unit</th>
            <th>Jabatan</th>
            <th>Agenda</th>
            <th>No. Kamar</th>
            <th>Tgl Masuk</th>
            <th>Jam Masuk</th>
            <th>Tgl Keluar</th>
            <th>Jam Keluar</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>

    <!-- (3) Pagination -->
    <nav>
      <ul class="pagination" id="paginationJournal"></ul>
    </nav>
  `;

  // Event listener Filter Tanggal & Page Size
  document.getElementById("filterStartDate")
    .addEventListener("change", () => {
      currentPageJournal = 1;
      applyFiltersAndRender();
    });
  document.getElementById("filterEndDate")
    .addEventListener("change", () => {
      currentPageJournal = 1;
      applyFiltersAndRender();
    });
  document.getElementById("selectPageSizeJournal")
    .addEventListener("change", (e) => {
      pageSizeJournal = parseInt(e.target.value, 10);
      currentPageJournal = 1;
      applyFiltersAndRender();
    });

  // Event listener Export
  document.getElementById("btnExportExcelJournal")
    .addEventListener("click", exportJournalToExcel);
  document.getElementById("btnExportPDFJournal")
    .addEventListener("click", exportJournalToPDF);

  // Fetch data Reservations → lalu Fetch data Jurnal
  fetchReservationsThenJournal();
  addJournalTableStyles();
}


/**
 * Fetch data Reservasi (Reservations), kemudian Fetch Journal
 */
function fetchReservationsThenJournal() {
  // 1) Fetch Reservations
  const callbackResv = "jsonpFetchReservations_" + Date.now();
  jsonpRequest(
    SCRIPT_URL, {
      action: "fetchReservations"
    },
    callbackResv,
    (resR) => {
      if (resR.success) {
        reservationsData = resR.data || [];
        // 2) Setelah itu, Fetch Journal
        fetchJournalEntries();
      } else {
        console.error("fetchReservations gagal:", resR.message);
      }
    },
    (err) => {
      console.error("Error fetchReservations JSONP:", err);
    }
  );
}


/**
 * Fetch seluruh data Jurnal Tamu dari backend (action fetchJournal),
 * kemudian join dengan Reservations untuk mendapatkan field assigned_room
 */
function fetchJournalEntries() {
  const callbackJ = "jsonpFetchJournal_" + Date.now();
  jsonpRequest(
    SCRIPT_URL, {
      action: "fetchJournal"
    },
    callbackJ,
    (resJ) => {
      if (resJ.success) {
        journalData = resJ.data || [];

        // Gabungkan data journal dengan Reservations:
        journalData.forEach(entry => {
          // Cari reservation yang sesuai
          const rv = reservationsData.find(x => x.reservation_id === entry.reservation_id) || {};
          entry.agenda = rv.agenda || "";
          entry.assigned_room = rv.assigned_room || "";
        });

        // Sort berdasarkan last_timestamp descending (terbaru di atas)
        journalData.sort((a, b) => {
          const dateA = new Date(a.last_timestamp || a.checkin_timestamp);
          const dateB = new Date(b.last_timestamp || b.checkin_timestamp);
          return dateB - dateA;
        });

        // Terapkan filter dan render
        applyFiltersAndRender();
      } else {
        console.error("fetchJournal gagal:", resJ.message);
      }
    },
    (err) => {
      console.error("Error fetchJournal JSONP:", err);
    }
  );
}


/**
 * Terapkan filter (berdasarkan Tgl Masuk) kemudian render tabel + pagination
 */
function applyFiltersAndRender() {
  const startDate = document.getElementById("filterStartDate").value;
  const endDate = document.getElementById("filterEndDate").value;

  filteredJournal = journalData.slice(); // copy

  if (startDate) {
    const d0 = new Date(startDate + "T00:00:00");
    filteredJournal = filteredJournal.filter(e => {
      const ci = new Date(e.checkin_timestamp);
      return ci >= d0;
    });
  }
  if (endDate) {
    const d1 = new Date(endDate + "T23:59:59");
    filteredJournal = filteredJournal.filter(e => {
      const ci = new Date(e.checkin_timestamp);
      return ci <= d1;
    });
  }

  totalJournalPages = Math.ceil(filteredJournal.length / pageSizeJournal) || 1;
  renderJournalTablePaginated();
  renderJournalPagination();
}


/**
 * Render baris‐baris tabel untuk halaman currentPageJournal
 */
function renderJournalTablePaginated() {
  const tbody = document.querySelector("#tblJournal tbody");
  tbody.innerHTML = "";

  if (!filteredJournal.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="text-center">Tidak ada data jurnal</td></tr>`;
    return;
  }

  const start = (currentPageJournal - 1) * pageSizeJournal;
  const end = start + pageSizeJournal;
  const pageData = filteredJournal.slice(start, end);
  const totalRows = filteredJournal.length;

  pageData.forEach((entry, idx) => {
    // Hitung nomor: nomor terbaru = totalRows - (start + idx)
    const nomor = totalRows - (start + idx);

    // Format checkin
    const dtCI = new Date(entry.checkin_timestamp || "");
    const tglMasuk = isNaN(dtCI) ? "" : dtCI.toLocaleDateString("id-ID");
    const jamMasuk = isNaN(dtCI) ? "" : dtCI.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

    // Format checkout
    let tglKeluar = "",
      jamKeluar = "";
    if (entry.checkout_timestamp) {
      const dtCO = new Date(entry.checkout_timestamp);
      tglKeluar = dtCO.toLocaleDateString("id-ID");
      jamKeluar = dtCO.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
    }

    // Format last_timestamp
    let timestmp = "";
    if (entry.last_timestamp) {
      const dtL = new Date(entry.last_timestamp);
      timestmp = dtL.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${nomor}</td>
      <td>${entry.guest_name}</td>
      <td>${entry.guest_unit}</td>
      <td>${entry.guest_position}</td>
      <td>${entry.agenda}</td>
      <td>${entry.assigned_room}</td>
      <td>${tglMasuk}</td>
      <td>${jamMasuk}</td>
      <td>${tglKeluar}</td>
      <td>${jamKeluar}</td>
      <td>${timestmp}</td>
    `;
    tbody.appendChild(tr);
  });

  // Tidak ada lagi listener atau tombol aksi di sini!
}



/**
 * Render pagination controls (dengan ellipsis jika > 5 halaman)
 */
function renderJournalPagination() {
  const ul = document.getElementById("paginationJournal");
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
      if (page !== currentPageJournal && !disabled) {
        currentPageJournal = page;
        renderJournalTablePaginated();
        renderJournalPagination();
      }
    });
    li.appendChild(a);
    return li;
  }

  // Tombol “Previous”
  const prevDisabled = currentPageJournal === 1;
  ul.appendChild(createPageItem(currentPageJournal - 1, "«", prevDisabled, false));

  if (totalJournalPages <= 5) {
    for (let p = 1; p <= totalJournalPages; p++) {
      ul.appendChild(createPageItem(p, p, false, p === currentPageJournal));
    }
  } else {
    ul.appendChild(createPageItem(1, "1", false, currentPageJournal === 1));

    const left = Math.max(2, currentPageJournal - 1);
    const right = Math.min(totalJournalPages - 1, currentPageJournal + 1);

    if (left > 2) {
      const li = document.createElement("li");
      li.className = "page-item disabled";
      li.innerHTML = `<span class="page-link">…</span>`;
      ul.appendChild(li);
    }

    for (let p = left; p <= right; p++) {
      ul.appendChild(createPageItem(p, p, false, p === currentPageJournal));
    }

    if (right < totalJournalPages - 1) {
      const li = document.createElement("li");
      li.className = "page-item disabled";
      li.innerHTML = `<span class="page-link">…</span>`;
      ul.appendChild(li);
    }

    ul.appendChild(createPageItem(totalJournalPages, totalJournalPages, false, currentPageJournal === totalJournalPages));
  }

  // Tombol “Next”
  const nextDisabled = currentPageJournal === totalJournalPages;
  ul.appendChild(createPageItem(currentPageJournal + 1, "»", nextDisabled, false));
}


/**
 * handleCheckOut: Update entry di sheet Journal (action updateJournalExit)
 */
function handleCheckOut(evt) {
  const journalId = evt.currentTarget.getAttribute("data-id");
  if (!journalId) return;

  const now = new Date();
  const ts = now.toISOString();

  const userLoggedIn = JSON.parse(sessionStorage.getItem("user")) || {
    username: ''
  };
  const callbackCO = "jsonpUpdateJournalExit_" + Date.now();
  jsonpRequest(
    SCRIPT_URL, {
      action: "updateJournalExit",
      journal_id: journalId,
      checkout_timestamp: ts,
      last_timestamp: ts,
      admin_user: userLoggedIn.username
    },
    callbackCO,
    (resCO) => {
      if (resCO.success) {
        fetchJournalEntries();
      } else {
        alert("Gagal Check-Out: " + resCO.message);
      }
    },
    (err) => {
      console.error("Error updateJournalExit JSONP:", err);
    }
  );
}


/**
 * Export ke Excel (.xlsx)
 */
function exportJournalToExcel() {
  if (!filteredJournal.length) {
    alert("Tidak ada data untuk diekspor.");
    return;
  }

  // Siapkan data array 2D (header + baris)
  const wsData = [];
  const header = [
    "No.",
    "Nama",
    "Unit",
    "Jabatan",
    "Agenda",
    "No. Kamar",
    "Tgl Masuk",
    "Jam Masuk",
    "Tgl Keluar",
    "Jam Keluar",
    "Timestamp"
  ];
  wsData.push(header);

  // Urut ascending berdasarkan checkin_timestamp
  const dataAsc = filteredJournal.slice().sort((a, b) => {
    return new Date(a.checkin_timestamp) - new Date(b.checkin_timestamp);
  });

  dataAsc.forEach((entry, idx) => {
    const nomor = idx + 1;
    const dCI = new Date(entry.checkin_timestamp);
    const tglIn = isNaN(dCI) ? "" : dCI.toLocaleDateString("id-ID");
    const jIn = isNaN(dCI) ? "" : dCI.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

    let tglOut = "",
      jamOut = "";
    if (entry.checkout_timestamp) {
      const dCO = new Date(entry.checkout_timestamp);
      tglOut = dCO.toLocaleDateString("id-ID");
      jamOut = dCO.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
    }

    const dL = new Date(entry.last_timestamp || entry.checkin_timestamp);
    const tST = isNaN(dL) ? "" : dL.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

    wsData.push([
      nomor,
      entry.guest_name,
      entry.guest_unit,
      entry.guest_position,
      entry.agenda,
      entry.assigned_room,
      tglIn,
      jIn,
      tglOut,
      jamOut,
      tST
    ]);
  });

  // Buat workbook & worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Atur kolom lebar (opsional)
  ws["!cols"] = [{
      wch: 5
    }, // No.
    {
      wch: 20
    }, // Nama
    {
      wch: 15
    }, // Unit
    {
      wch: 15
    }, // Jabatan
    {
      wch: 25
    }, // Agenda
    {
      wch: 10
    }, // No. Kamar
    {
      wch: 12
    }, // Tgl Masuk
    {
      wch: 8
    }, // Jam Masuk
    {
      wch: 12
    }, // Tgl Keluar
    {
      wch: 8
    }, // Jam Keluar
    {
      wch: 20
    } // Timestamp
  ];

  XLSX.utils.book_append_sheet(wb, ws, "JurnalTamu");

  // Nama file berdasar periode
  let namaPeriode = "Semua_Periode";
  const sd = document.getElementById("filterStartDate").value;
  const ed = document.getElementById("filterEndDate").value;
  if (sd && ed) {
    namaPeriode = `${sd}_${ed}`;
  } else if (sd && !ed) {
    namaPeriode = `${sd}_sampaiSekarang`;
  } else if (!sd && ed) {
    namaPeriode = `sejakAwal_${ed}`;
  }
  const filename = `Jurnal_Tamu_${namaPeriode}.xlsx`;
  XLSX.writeFile(wb, filename);
}


/**
 * Export ke PDF (jsPDF + AutoTable)
 */
function exportJournalToPDF() {
  if (!filteredJournal.length) {
    alert("Tidak ada data untuk diekspor.");
    return;
  }

  // Urut ascending berdasarkan checkin_timestamp
  const dataAsc = filteredJournal.slice().sort((a, b) => {
    return new Date(a.checkin_timestamp) - new Date(b.checkin_timestamp);
  });

  // Siapkan baris untuk autoTable
  const tableBody = [];
  dataAsc.forEach((entry, idx) => {
    const nomor = idx + 1;
    const dCI = new Date(entry.checkin_timestamp);
    const tglIn = isNaN(dCI) ? "" : dCI.toLocaleDateString("id-ID");
    const jIn = isNaN(dCI) ? "" : dCI.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

    let tglOut = "",
      jamOut = "";
    if (entry.checkout_timestamp) {
      const dCO = new Date(entry.checkout_timestamp);
      tglOut = dCO.toLocaleDateString("id-ID");
      jamOut = dCO.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
    }

    const dL = new Date(entry.last_timestamp || entry.checkin_timestamp);
    const tST = isNaN(dL) ? "" : dL.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

    tableBody.push([
      nomor,
      entry.guest_name,
      entry.guest_unit,
      entry.guest_position,
      entry.agenda,
      entry.assigned_room,
      tglIn,
      jIn,
      tglOut,
      jamOut,
      tST
    ]);
  });

  // Inisialisasi jsPDF
  const {
    jsPDF
  } = window.jspdf;
  const doc = new jsPDF("l", "pt", "a4");

  // Judul berdasarkan periode
  const sd = document.getElementById("filterStartDate").value;
  const ed = document.getElementById("filterEndDate").value;
  let judulPeriode = "Semua Periode";
  if (sd && ed) {
    judulPeriode = `${formatDateIndo(sd)} – ${formatDateIndo(ed)}`;
  } else if (sd && !ed) {
    judulPeriode = `Sejak ${formatDateIndo(sd)}`;
  } else if (!sd && ed) {
    judulPeriode = `Hingga ${formatDateIndo(ed)}`;
  }
  const title = `JURNAL TAMU MESS SNTZ PERIODE ${judulPeriode}`;
  doc.setFontSize(14);
  doc.text(title, 40, 40);

  // Header kolom untuk autoTable
  const columns = [{
      header: "No.",
      dataKey: "no"
    },
    {
      header: "Nama",
      dataKey: "nama"
    },
    {
      header: "Unit",
      dataKey: "unit"
    },
    {
      header: "Jabatan",
      dataKey: "jabatan"
    },
    {
      header: "Agenda",
      dataKey: "agenda"
    },
    {
      header: "No. Kamar",
      dataKey: "kamar"
    },
    {
      header: "Tgl Masuk",
      dataKey: "tglMasuk"
    },
    {
      header: "Jam Masuk",
      dataKey: "jamMasuk"
    },
    {
      header: "Tgl Keluar",
      dataKey: "tglKeluar"
    },
    {
      header: "Jam Keluar",
      dataKey: "jamKeluar"
    },
    {
      header: "Timestamp",
      dataKey: "timestamp"
    }
  ];

  // Bentuk baris menjadi array of objects
  const rows = tableBody.map(rowArr => ({
    no: rowArr[0],
    nama: rowArr[1],
    unit: rowArr[2],
    jabatan: rowArr[3],
    agenda: rowArr[4],
    kamar: rowArr[5],
    tglMasuk: rowArr[6],
    jamMasuk: rowArr[7],
    tglKeluar: rowArr[8],
    jamKeluar: rowArr[9],
    timestamp: rowArr[10]
  }));

  // AutoTable
  doc.autoTable({
    startY: 60,
    head: [columns.map(col => col.header)],
    body: rows.map(r => columns.map(c => r[c.dataKey])),
    styles: {
      fontSize: 9,
      cellPadding: 4
    },
    headStyles: {
      fillColor: [220, 220, 220]
    },
    margin: {
      left: 40,
      right: 40
    }
  });

  // Footer: “Laporan dicetak tanggal …”
  const now = new Date();
  const printedAt = formatDateTimeIndo(now);
  const footerText = `Laporan dicetak tanggal ${printedAt}`;
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(10);
  doc.text(footerText, 40, pageHeight - 30);

  // Simpan PDF
  const pdfFilename = `Jurnal_Tamu_${namaFilePDF()}.pdf`;
  doc.save(pdfFilename);
}


/** Helper: format “YYYY-MM-DD” → “DD MMM YYYY” */
function formatDateIndo(isoDateStr) {
  const d = new Date(isoDateStr);
  if (isNaN(d)) return isoDateStr;
  const hari = String(d.getDate()).padStart(2, "0");
  const bulan = d.toLocaleString("id-ID", {
    month: "short"
  });
  const tahun = d.getFullYear();
  return `${hari} ${bulan} ${tahun}`;
}

/** Helper: format complete date‐time → “DD MMM YYYY – HH:MM” */
function formatDateTimeIndo(dateObj) {
  const hari = String(dateObj.getDate()).padStart(2, "0");
  const bulan = dateObj.toLocaleString("id-ID", {
    month: "short"
  });
  const tahun = dateObj.getFullYear();
  const jam = String(dateObj.getHours()).padStart(2, "0");
  const menit = String(dateObj.getMinutes()).padStart(2, "0");
  return `${hari} ${bulan} ${tahun} – ${jam}:${menit}`;
}

/** Helper: nama file PDF berdasar periode */
function namaFilePDF() {
  const sd = document.getElementById("filterStartDate").value;
  const ed = document.getElementById("filterEndDate").value;
  let np = "Semua_Periode";
  if (sd && ed) np = `${sd}_${ed}`;
  else if (sd && !ed) np = `${sd}_sampaiSekarang`;
  else if (!sd && ed) np = `sejakAwal_${ed}`;
  return np;
}
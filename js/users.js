// js/users.js

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
    SCRIPT_URL,
    { action: "fetchUsers" },
    callbackName,
    (result) => {
      if (result.success) {
        window.usersCache = result.data;
        renderUsersTable(result.data);
      }
    },
    (err) => { console.error(err); }
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
  const username     = document.getElementById("newUsername").value.trim();
  const password     = document.getElementById("newPassword").value;
  const role         = document.getElementById("newRole").value;
  const userLoggedIn = JSON.parse(sessionStorage.getItem("user"));
  const isEdit       = Boolean(origUsername);
  const callbackName = (isEdit ? "jsonpUpdateUser_" : "jsonpCreateUser_") + Date.now();
  const params = isEdit
    ? { action: "updateUser", username, password, role, admin_user: userLoggedIn.username }
    : { action: "createUser", username, password, role, admin_user: userLoggedIn.username };

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
    (err) => { console.error(err); }
  );
}

/**
 * Hapus user (Admin)
 */
function deleteUser(username) {
  if (!confirm("Yakin ingin menghapus user ini?")) return;
  const userLoggedIn = JSON.parse(sessionStorage.getItem("user"));
  const callbackName = "jsonpDeleteUser_" + Date.now();
  const params = { action: "deleteUser", username, admin_user: userLoggedIn.username };
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
    (err) => { console.error(err); }
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
// js/users.js (bagian Log Sistem)

// Variabel global untuk menyimpan data log dan status paging
let logsData = [];
let filteredLogs = [];
let currentPage = 1;
let pageSize = 20; // default 20
let totalPages = 0;

/**
 * Load Log Sistem (Admin) — versi baru dengan paging, search, dan page size
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
    <nav>
      <ul class="pagination" id="paginationLogs"></ul>
    </nav>
  `;

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
    SCRIPT_URL,
    { action: "fetchLogs" },
    callbackName,
    (result) => {
      if (result.success) {
        logsData = result.data || [];
        applySearchAndRender();
      }
    },
    (err) => { console.error("Error fetchLogs JSONP:", err); }
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
  const end   = start + pageSize;
  const pageData = filteredLogs.slice(start, end);

  pageData.forEach((log) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${log.log_id}</td>
      <td>${log.reservation_id}</td>
      <td>${log.action}</td>
      <td>${log.timestamp}</td>
      <td>${log.admin_user}</td>
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

    const left  = Math.max(2, currentPage - 1);
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

/* 
  Setelah ini, pastikan di main.js atau di tempat manapun Anda
  memanggil:
    showTab("Logs");
    loadLogs();
  ketika user mengklik tab “Log Sistem”.
*/

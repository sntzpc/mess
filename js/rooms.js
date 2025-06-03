// js/rooms.js

/**
 * Load daftar kamar untuk user biasa (tab “Kamar”)
 */
async function loadRooms() {
  const container = document.getElementById("contentRooms");
  container.innerHTML = `
    <h4>Ketersediaan Kamar</h4>
    <div class="row mb-3">
      <div class="col-3">
        <label for="filterDate" class="form-label">Pilih Tanggal:</label>
        <input type="date" id="filterDate" class="form-control">
      </div>
      <div class="col-3 d-flex align-items-end">
        <button class="btn btn-secondary" id="btnFilterRooms">Filter</button>
      </div>
    </div>
    <div class="row" id="roomsContainer"></div>
  `;
  document.getElementById("btnFilterRooms").addEventListener("click", fetchAndRenderRooms);
  fetchAndRenderRooms();
}

/**
 * Fetch kamar & render kartu
 */
function fetchAndRenderRooms() {
  const date = document.getElementById("filterDate").value;
  const callbackName = "jsonpFetchRooms_" + Date.now();
  const params = {
    action: "fetchRooms",
    date: date
  };
  jsonpRequest(
    SCRIPT_URL,
    params,
    callbackName,
    (result) => {
      if (result.success) {
        renderRoomCards(result.data);
      }
    },
    (err) => { console.error(err); }
  );
}

/**
 * Render kartu-kartu kamar
 */
function renderRoomCards(rooms) {
  const container = document.getElementById("roomsContainer");
  container.innerHTML = "";
  rooms.forEach((room) => {
    const statusBadge = room.status === "available"
      ? '<span class="badge bg-success">Tersedia</span>'
      : '<span class="badge bg-danger">Dipesan</span>';
    const btn = room.status === "available"
      ? `<button class="btn btn-sm btn-primary mt-2" onclick="bookRoom('${room.room_id}')">Pesan</button>`
      : '';
    const cardHTML = `
      <div class="col-md-4 mb-3">
        <div class="card">
          <div class="card-body">
            <h5 class="card-title">${room.room_name}</h5>
            <p class="card-text">Kapasitas: ${room.capacity} orang</p>
            ${statusBadge}
            ${btn}
          </div>
        </div>
      </div>
    `;
    container.insertAdjacentHTML("beforeend", cardHTML);
  });
}

/**
 * Ketika user klik “Pesan” pada kartu kamar
 */
function bookRoom(roomId) {
  sessionStorage.setItem("preferredRoom", roomId);
  showTab("Reservations");
  alert(`Silakan isi form reservasi. Kamar ${roomId} akan terisi otomatis.`);
}


/**
 * Load Manajemen Kamar (Admin)
 */
async function loadRoomsAdmin() {
  const container = document.getElementById("contentRoomsAdmin");
  container.innerHTML = `
    <h4>Manajemen Kamar</h4>
    <button class="btn btn-success mb-3" id="btnAddRoom">Tambah Kamar</button>
    <table class="table table-hover" id="tblRoomsAdmin">
      <thead class="table-light">
        <tr>
          <th>ID</th>
          <th>Nama Kamar</th>
          <th>Kapasitas</th>
          <th>Status</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>

    <!-- Modal Tambah/Edit Kamar -->
    <div class="modal fade" id="modalRoom" tabindex="-1" aria-labelledby="modalRoomLabel" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="modalRoomLabel">Tambah/Edit Kamar</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <form id="roomForm">
              <input type="hidden" id="roomIdInput">
              <div class="mb-3">
                <label for="roomNameInput" class="form-label">Nama Kamar</label>
                <input type="text" class="form-control" id="roomNameInput" required>
              </div>
              <div class="mb-3">
                <label for="roomCapacityInput" class="form-label">Kapasitas</label>
                <input type="number" class="form-control" id="roomCapacityInput" min="1" required>
              </div>
              <div class="mb-3">
                <label for="roomStatusInput" class="form-label">Status</label>
                <select id="roomStatusInput" class="form-select" required>
                  <option value="available">Available</option>
                  <option value="booked">Booked</option>
                </select>
              </div>
              <button type="submit" class="btn btn-primary">Simpan</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("btnAddRoom").addEventListener("click", () => {
    document.getElementById("modalRoomLabel").textContent = "Tambah Kamar";
    document.getElementById("roomForm").reset();
    document.getElementById("roomIdInput").value = "";
    document.getElementById("roomNameInput").focus();
    new bootstrap.Modal(document.getElementById("modalRoom")).show();
  });
  document.getElementById("roomForm").addEventListener("submit", handleRoomFormSubmit);

  // Fetch data kamar dengan JSONP
  const callbackName = "jsonpFetchRoomsAdmin_" + Date.now();
  jsonpRequest(
    SCRIPT_URL,
    { action: "fetchRooms" },
    callbackName,
    (result) => {
      if (result.success) {
        window.roomsCache = result.data;
        renderRoomsAdminTable(result.data);
      }
    },
    (err) => { console.error(err); }
  );
}

/**
 * Render tabel kamar (admin)
 */
function renderRoomsAdminTable(rooms) {
  const tbody = document.querySelector("#tblRoomsAdmin tbody");
  tbody.innerHTML = "";
  rooms.forEach((rm) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rm.room_id}</td>
      <td>${rm.room_name}</td>
      <td>${rm.capacity}</td>
      <td>${rm.status}</td>
      <td>
        <button class="btn btn-sm btn-warning me-1" onclick="editRoom('${rm.room_id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteRoom('${rm.room_id}')">Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Isi form Edit Kamar
 */
function editRoom(id) {
  const room = window.roomsCache.find((r) => r.room_id === id);
  if (!room) return;
  document.getElementById("modalRoomLabel").textContent = "Edit Kamar";
  document.getElementById("roomIdInput").value = room.room_id;
  document.getElementById("roomNameInput").value = room.room_name;
  document.getElementById("roomCapacityInput").value = room.capacity;
  document.getElementById("roomStatusInput").value = room.status;
  new bootstrap.Modal(document.getElementById("modalRoom")).show();
}

/**
 * Submit form tambah/edit kamar (Admin)
 */
function handleRoomFormSubmit(e) {
  e.preventDefault();
  const id     = document.getElementById("roomIdInput").value;
  const name   = document.getElementById("roomNameInput").value.trim();
  const cap    = parseInt(document.getElementById("roomCapacityInput").value);
  const status = document.getElementById("roomStatusInput").value;
  const user   = JSON.parse(sessionStorage.getItem("user"));

  const isEdit = Boolean(id);
  const callbackName = (isEdit ? "jsonpUpdateRoom_" : "jsonpCreateRoom_") + Date.now();
  const params = isEdit
    ? { action: "updateRoom", room_id: id, room_name: name, capacity: cap.toString(), status: status, admin_user: user.username }
    : { action: "createRoom", room_name: name, capacity: cap.toString(), admin_user: user.username };

  jsonpRequest(
    SCRIPT_URL,
    params,
    callbackName,
    (result) => {
      if (result.success) {
        new bootstrap.Modal(document.getElementById("modalRoom")).hide();
        loadRoomsAdmin();
      } else {
        alert("Gagal menyimpan kamar: " + result.message);
      }
    },
    (err) => {
      console.error(err);
    }
  );
}

/**
 * Hapus kamar (Admin)
 */
function deleteRoom(id) {
  if (!confirm("Yakin ingin menghapus kamar ini?")) return;
  const user = JSON.parse(sessionStorage.getItem("user"));
  const callbackName = "jsonpDeleteRoom_" + Date.now();
  const params = { action: "deleteRoom", room_id: id, admin_user: user.username };
  jsonpRequest(
    SCRIPT_URL,
    params,
    callbackName,
    (result) => {
      if (result.success) {
        loadRoomsAdmin();
      } else {
        alert("Gagal hapus: " + result.message);
      }
    },
    (err) => { console.error(err); }
  );
}

/* File: frontend/js/users.js */

/**
 * handleGetUsersResponse(resp)
 * – Callback JSONP untuk action=getUsers
 */
function handleGetUsersResponse(resp) {
  if (resp.status !== 'success') {
    showAlert(resp.message, 'danger');
    return;
  }
  const users = resp.users;
  const tbody = document.querySelector('#tableUsers tbody');
  tbody.innerHTML = '';

  if (users.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="4" class="text-center">Belum ada user.</td>`;
    tbody.appendChild(tr);
    return;
  }

  users.forEach((u, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${u.username}</td>
      <td>${u.role}</td>
      <td>
        <button class="btn btn-sm btn-warning me-1" onclick="showEditUserModal('${u.username}', '${u.role}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteUser('${u.username}')">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * loadUsers()
 * – Panggil action=getUsers via JSONP
 */
function loadUsers() {
  jsonpRequest('getUsers', {}, 'handleGetUsersResponse');
}

/**
 * addUser()
 * – Baca nilai dari form Add User & kirim action=addUser
 */
function addUser() {
  const uname = document.getElementById('addUsername').value.trim();
  const pwd   = document.getElementById('addPassword').value.trim();
  const role  = document.getElementById('addRole').value;

  if (!uname || !pwd || !role) {
    showAlert('Semua field wajib diisi.', 'warning');
    return;
  }

  jsonpRequest(
    'addUser',
    { username: uname, password: pwd, role: role, admin_user: sessionStorage.getItem('username') },
    'handleAddUserResponse'
  );
}

/**
 * Callback untuk addUser
 */
function handleAddUserResponse(resp) {
  if (resp.status === 'success') {
    showAlert('User berhasil ditambahkan.', 'success');
    // Tutup modal
    const modalEl = document.getElementById('modalAddUser');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
    // Reset form
    document.getElementById('formAddUser').reset();
    loadUsers();
  } else {
    showAlert(resp.message, 'danger');
  }
}

/**
 * showEditUserModal(username, role)
 * – Tampilkan modal Edit User dengan data yang diisi sesuai user terpilih
 */
function showEditUserModal(username, role) {
  document.getElementById('editUsernameOld').value = username;
  document.getElementById('editPassword').value = '';
  document.getElementById('editRole').value = role || 'user';

  const modalEl = document.getElementById('modalEditUser');
  const modal = new bootstrap.Modal(modalEl, {});
  modal.show();
}

/**
 * updateUser()
 * – Ambil data dari form Edit User & kirim action=updateUser
 */
function updateUser() {
  const oldUsername = document.getElementById('editUsernameOld').value;
  const newPassword = document.getElementById('editPassword').value;
  const newRole     = document.getElementById('editRole').value;

  if (!oldUsername) {
    showAlert('Username lama tidak ditemukan.', 'danger');
    return;
  }
  if (!newPassword && !newRole) {
    showAlert('Isi setidaknya password baru atau role baru.', 'warning');
    return;
  }

  jsonpRequest(
    'updateUser',
    { username: oldUsername, newPassword: newPassword, newRole: newRole, admin_user: sessionStorage.getItem('username') },
    'handleUpdateUserResponse'
  );
}

/**
 * Callback untuk updateUser
 */
function handleUpdateUserResponse(resp) {
  if (resp.status === 'success') {
    showAlert('User berhasil diperbarui.', 'success');
    const modalEl = document.getElementById('modalEditUser');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
    loadUsers();
  } else {
    showAlert(resp.message, 'danger');
  }
}

/**
 * deleteUser(username)
 * – Konfirmasi lalu kirim action=deleteUser
 */
function deleteUser(username) {
  if (!confirm('Yakin ingin menghapus user "' + username + '"?')) return;
  jsonpRequest(
    'deleteUser',
    { username: username, admin_user: sessionStorage.getItem('username') },
    'handleDeleteUserResponse'
  );
}

/**
 * Callback untuk deleteUser
 */
function handleDeleteUserResponse(resp) {
  if (resp.status === 'success') {
    showAlert('User berhasil dihapus.', 'success');
    loadUsers();
  } else {
    showAlert(resp.message, 'danger');
  }
}

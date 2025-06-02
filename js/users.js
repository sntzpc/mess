/* File: frontend/js/users.js */

/**
 * JSONP callback untuk getUsers
 */
window.handleGetUsersResponse = function(resp) {
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
};

/**
 * Memuat daftar user via JSONP
 */
function loadUsers() {
  jsonpRequest('getUsers', {}, 'handleGetUsersResponse');
}

/**
 * Tambah user baru
 */
function addUser() {
  const uname = document.getElementById('addUsername').value.trim();
  const pwd = document.getElementById('addPassword').value.trim();
  const role = document.getElementById('addRole').value;

  if (!uname || !pwd || !role) {
    showAlert('Semua field wajib diisi.', 'warning');
    return;
  }

  jsonpRequest(
    'addUser',
    {
      username: uname,
      password: pwd,
      role: role,
      admin_user: sessionStorage.getItem('username'),
    },
    'handleAddUserResponse'
  );
}

/**
 * JSONP callback untuk addUser
 */
window.handleAddUserResponse = function(resp) {
  if (resp.status === 'success') {
    showAlert('User berhasil ditambahkan.', 'success');
    const modalEl = document.getElementById('modalAddUser');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
    document.getElementById('formAddUser').reset();
    loadUsers();
  } else {
    showAlert(resp.message, 'danger');
  }
};

/**
 * Tampilkan modal Edit User dan isi form dengan data user lama
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
 * Update data user
 */
function updateUser() {
  const oldUsername = document.getElementById('editUsernameOld').value;
  const newPassword = document.getElementById('editPassword').value;
  const newRole = document.getElementById('editRole').value;

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
    {
      username: oldUsername,
      newPassword: newPassword,
      newRole: newRole,
      admin_user: sessionStorage.getItem('username'),
    },
    'handleUpdateUserResponse'
  );
}

/**
 * JSONP callback untuk updateUser
 */
window.handleUpdateUserResponse = function(resp) {
  if (resp.status === 'success') {
    showAlert('User berhasil diperbarui.', 'success');
    const modalEl = document.getElementById('modalEditUser');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
    loadUsers();
  } else {
    showAlert(resp.message, 'danger');
  }
};

/**
 * Hapus user
 */
function deleteUser(username) {
  if (!confirm('Yakin ingin menghapus user "' + username + '"?')) return;
  jsonpRequest(
    'deleteUser',
    {
      username: username,
      admin_user: sessionStorage.getItem('username'),
    },
    'handleDeleteUserResponse'
  );
}

/**
 * JSONP callback untuk deleteUser
 */
window.handleDeleteUserResponse = function(resp) {
  if (resp.status === 'success') {
    showAlert('User berhasil dihapus.', 'success');
    loadUsers();
  } else {
    showAlert(resp.message, 'danger');
  }
};

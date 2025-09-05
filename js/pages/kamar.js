import { showNotif } from '../util.js';
import { api } from '../api.js';

export function initKamar(){
  document.getElementById('btn-kamar-tampil').addEventListener('click', loadCards);
}

async function loadCards(){
  const mess = document.getElementById('kamar-mess').value;
  if(!mess){ showNotif('Pilih mess', false); return; }

  const r = await api('rooms.list', {mess_name: mess});
  const host = document.getElementById('kamar-cards');
  host.innerHTML = '';

  (r.rows || []).forEach(room => {
    const used = Number(room.used || 0);
    const cap  = Number(room.capacity || 0);
    const sisa = Math.max(cap - used, 0);

    // Badge warna
    let badgeClass = 'text-bg-secondary';
    if (room.status === 'tersedia') badgeClass = 'text-bg-success';
    else if (room.status === 'terisi') badgeClass = 'text-bg-warning';
    else if (room.status === 'penuh') badgeClass = 'text-bg-danger';

    // Kelas kartu untuk arsiran status
    let cardClass = 'card card-room shadow-sm';
    if (room.status === 'terisi') cardClass += ' occupied-terisi';
    else if (room.status === 'penuh') cardClass += ' occupied-penuh';

    // Info sisa kapasitas untuk status "terisi"
    const infoSisa = (room.status === 'terisi')
      ? `<div>Sisa kapasitas: <b>${sisa}</b></div>`
      : '';

    // Tombol Pesan: tampil hanya jika bukan "penuh"
    const btnPesan = (room.status !== 'penuh')
      ? `<button class="btn btn-primary btn-sm btn-pesan">Pesan</button>`
      : '';

    const div = document.createElement('div');
    div.className = 'col-md-4';
    div.innerHTML = `
      <div class="${cardClass}">
        <div class="card-body">
          <h5 class="card-title">${room.room_name}</h5>
          <div class="text-muted small">Mess: ${room.mess_name}</div>
          <div>Kapasitas: <b>${cap}</b></div>
          <div>Golongan: <b>${room.grade || '-'}</b></div>
          <div>Status: <span class="badge ${badgeClass}">${room.status}</span></div>
          ${infoSisa}
          <div class="mt-2 text-end">
            ${btnPesan}
          </div>
        </div>
      </div>`;

    // tombol pesan (hanya ada jika bukan penuh)
    const btn = div.querySelector('.btn-pesan');
    if (btn) {
      btn.addEventListener('click', () => {
        document.getElementById('rsv-mess').value = room.mess_name;
        showNotif('Kamar dipilih: ' + room.room_name);
        import('../util.js').then(({ go }) => go('page-reservasi'));
      });
    }

    host.appendChild(div);
  });
}



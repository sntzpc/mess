/*************** CONFIG / TELEGRAM (baruu) ***************/
/* Prinsip:
   - Admin  : terima Reservasi, Approval, Check-In, Check-Out, Reject, Hapus
   - User   : terima Approval, Check-In, Check-Out, Reject, Hapus (broadcast ke semua role 'user')
   - Mess   : terima Approval, Check-In, Check-Out yang sesuai mess-nya saja
*/

function tgGetBotToken_(){ return getConfig_('telegram_bot_token'); }
function tgEnabled_(){ return !!tgGetBotToken_(); }

function tgSendTo_(chatId, text){
  try{
    const token = tgGetBotToken_();
    if(!token || !chatId) return;
    const url = 'https://api.telegram.org/bot' + token + '/sendMessage';
    const payload = { chat_id: String(chatId), text, parse_mode: 'Markdown' };
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  }catch(e){}
}

function tgBroadcast_(chatIds, text){
  if(!chatIds || chatIds.length===0) return;
  chatIds.forEach(id => tgSendTo_(id, text));
}

/* Ambil seluruh user dari sheet Users (return array of objects) */
function getAllUsers_(){
  const vals = sheet('Users').getDataRange().getValues();
  const rows = [];
  for(let i=1;i<vals.length;i++){
    const [id, username, passhash, role, mess_name, telegram_id] = vals[i];
    rows.push({
      id, username, role: String(role||'').trim(), mess_name: String(mess_name||'').trim(),
      telegram_id: String(telegram_id||'').trim()
    });
  }
  return rows;
}

/* Kumpulan chat id menurut role */
function getTgIdsByRole_(role){
  return getAllUsers_()
    .filter(u => u.role === role && u.telegram_id)
    .map(u => u.telegram_id);
}

/* Kumpulan chat id untuk semua user role 'mess' pada mess tertentu */
function getTgIdsByMess_(messName){
  const target = String(messName||'').trim();
  if(!target) return [];
  return getAllUsers_()
    .filter(u => u.role === 'mess' && u.mess_name === target && u.telegram_id)
    .map(u => u.telegram_id);
}

/* Alias cepat untuk admin & user */
function tgAdmins_(){ return getTgIdsByRole_('admin'); }
function tgUsers_(){ return getTgIdsByRole_('user'); }

/* Format baris tamu singkat */
function fmtGuestLine_(g){ // g: object {name, unit, title, gender, mess_alloc, room_alloc}
  return [
    '👤 *'+(g.name||'-')+'*',
    (g.unit?(' • '+g.unit):'') + (g.title?(' • '+g.title):''),
    '\n🏠 '+(g.mess_alloc||'-') + (g.room_alloc?(' • '+g.room_alloc):'')
  ].join('');
}

function notifyTest_(user, body){
  // hanya admin yang boleh test
  assertAdmin_(user);

  if(!tgEnabled_()){
    return json_({ok:false, error:'telegram_not_configured', hint:'Isi Telegram Bot Token di Config'});
  }

  const now = new Date();
  const when = fmtDate_(now) + ' ' + fmtTime_(now);

  // optional: batasi ke mess tertentu
  const messName = (body && body.mess_name) ? String(body.mess_name).trim() : '';

  // kumpulkan target
  const adminIds = tgAdmins_();               // semua role=admin yang punya telegram_id
  const userIds  = tgUsers_();                // semua role=user  yang punya telegram_id
  const messIds  = messName ? getTgIdsByMess_(messName) : []; // semua role=mess untuk mess tsb

  // gabungkan & de-dupe
  const targets = Array.from(new Set([ ...adminIds, ...userIds, ...messIds ]));

  // pesan uji
  const title = '🔔 *Tes Notifikasi*';
  const lines = [
    title,
    'Sumber : Aplikasi Mess Kebun',
    'Waktu  : ' + when
  ];
  if(messName){ lines.push('Mess   : ' + messName + ' (khusus role mess terkait)'); }

  const msg = lines.join('\n');

  // kirim
  targets.forEach(id => tgSendTo_(id, msg));

  return json_({
    ok: true,
    sent_count: targets.length,
    recipients: {
      admins: adminIds,
      users: userIds,
      mess: { mess_name: messName, ids: messIds }
    }
  });
}

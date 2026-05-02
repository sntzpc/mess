/*************** RESERVATION & APPROVAL ***************/
function reserveCreate_(user, body){
  // body: orderer {name,unit,title}, agenda, mess/mess_selected, checkin_plan, checkout_plan, guests:[{name,unit,title,gender}]
  const orderer = body.orderer || {};
  const agenda = body.agenda || '';
  const mess_selected = body.mess_selected || body.mess || '';
  const checkin_plan = toWibDateString_(body.checkin_plan || '');
  const checkout_plan = toWibDateString_(body.checkout_plan || '');
  const guests = Array.isArray(body.guests) ? body.guests : [];
  const rid = genId_();
  sheet('Reservations').appendRow([rid, orderer.name||'', orderer.unit||'', orderer.title||'', agenda||'', mess_selected||'', checkin_plan||'', checkout_plan||'', 'submitted', nowWibDateTime_()]);
  const gsh = sheet('Guests');
  guests.slice(0,200).forEach(g=>{
    gsh.appendRow([genId_(), rid, g.name||'', g.unit||'', g.title||'', g.gender||'', mess_selected||'', '', 'pending']);
  });

  // === Telegram: ke semua admin ===
  if(tgEnabled_()){
    const lines = [
      '📝 *Reservasi Baru*',
      'Pemesan: *'+(orderer.name||'-')+'* ('+(orderer.unit||'-')+')',
      'Agenda : '+(agenda||'-'),
      'Mess   : '+(mess_selected||'-'),
      'Periode: '+(checkin_plan||'-')+' → '+(checkout_plan||'-'),
      'Tamu   : '+guests.length+' orang'
    ];
    tgBroadcast_(tgAdmins_(), lines.join('\n'));
  }

  return json_({ok:true, reservation_id: rid});
}
function reserveList_(user, body){
  // admin can see all; mess user sees only their mess approvals
  const shR = sheet('Reservations').getDataRange().getValues();
  const shG = sheet('Guests').getDataRange().getValues();
  const res = [];
  for(let i=1;i<shR.length;i++){
    const r = shR[i];
    if(r[8]==='submitted' || r[8]==='partially_approved'){ // show pending
      const rid=r[0];
      // filter by mess for mess-role
      if(user.role==='mess' && user.mess && r[5]!==user.mess) continue;
      const guests = shG.slice(1).filter(g=>g[1]===rid && g[8]!=='deleted' && g[8]!=='rejected').map(g=>({
        id:g[0], name:g[2], unit:g[3], title:g[4], gender:g[5], mess_alloc:g[6]||r[5], room_alloc:g[7]||'', status:g[8]
      }));
      res.push({
        id: rid, orderer_name:r[1], orderer_unit:r[2], orderer_title:r[3], agenda:r[4], mess_selected:r[5],
        checkin_plan:toWibDateString_(r[6]), checkout_plan:toWibDateString_(r[7]), status:r[8], guests
      });
    }
  }
  return json_({ok:true, rows:res});
}
function approveAlloc_(user, body){
  // update guest row allocation (mess/room) before approve; admin only
  assertAdmin_(user);
  const {guest_id, mess_alloc, room_alloc} = body;
  const sh=sheet('Guests'); const vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    if(vals[i][0]===guest_id){
      const nextMess = mess_alloc!==undefined ? mess_alloc : vals[i][6];
      const nextRoom = room_alloc!==undefined ? room_alloc : vals[i][7];

      // Validasi otomatis bentrok kamar. Warning masih boleh disimpan, danger ditolak.
      const check = conflictCheckData_(user, {guest_id:guest_id, mess_alloc:nextMess, room_alloc:nextRoom});
      if(check && check.ok && check.severity === 'danger'){
        return json_({ok:false, error:'room_conflict', conflict:check});
      }

      if(mess_alloc!==undefined) sh.getRange(i+1,7).setValue(mess_alloc);
      if(room_alloc!==undefined) sh.getRange(i+1,8).setValue(room_alloc);
      return json_({ok:true, conflict: check && check.has_conflict ? check : null});
    }
  }
  return json_({ok:false, error:'guest_not_found'});
}
function guestApprove_(user, body){
  assertAdmin_(user);
  const {guest_id} = body;
  const gsh=sheet('Guests'); const vals=gsh.getDataRange().getValues();
  let rid = null, row = null;
  for(let i=1;i<vals.length;i++){
    if(vals[i][0]===guest_id){
      rid = vals[i][1]; row = vals[i];

      // Validasi terakhir sebelum approval agar double booking tidak lolos walau frontend lama/cache.
      const check = conflictCheckData_(user, {guest_id:guest_id, mess_alloc:vals[i][6], room_alloc:vals[i][7]});
      if(check && check.ok && check.severity === 'danger'){
        return json_({ok:false, error:'room_conflict', conflict:check});
      }

      gsh.getRange(i+1,9).setValue('approved');
      break;
    }
  }
  if(!rid) return json_({ok:false, error:'guest_not_found'});

  // update reservation status if all guests approved
  const all = gsh.getDataRange().getValues().slice(1).filter(r=>r[1]===rid && r[8]!=='deleted' && r[8]!=='rejected');
  const approved = all.every(r=>r[8]==='approved');
  const partial = all.some(r=>r[8]==='approved');
  const rsh=sheet('Reservations'); const rvals=rsh.getDataRange().getValues();
  for(let i=1;i<rvals.length;i++){ if(rvals[i][0]===rid){
    rsh.getRange(i+1,9).setValue(approved?'approved':'partially_approved');
    break;
  }}

  // === Telegram ===
  if(tgEnabled_() && row){
    const g = { name: row[2], unit: row[3], title: row[4], gender: row[5], mess_alloc: row[6], room_alloc: row[7] };
    const msg = '✅ *Approval Tamu*\n' + fmtGuestLine_(g);
    // Admin (opsional, tapi sesuai requirement: admin menerima Approval)
    tgBroadcast_(tgAdmins_(), msg);
    // Semua User
    tgBroadcast_(tgUsers_(), msg);
    // Mess terkait saja
    tgBroadcast_(getTgIdsByMess_(g.mess_alloc), msg);
  }

  return json_({ok:true});
}
function guestDelete_(user, body){
  assertAdmin_(user);
  const {guest_id, reason=''} = body;
  const sh=sheet('Guests'); const vals=sh.getDataRange().getValues();
  let row=null;
  for(let i=1;i<vals.length;i++){
    if(vals[i][0]===guest_id){
      sh.getRange(i+1,9).setValue('deleted');
      row = vals[i];
      break;
    }
  }
  if(!row) return json_({ok:false, error:'guest_not_found'});

  // === Telegram ===
  if(tgEnabled_()){
    const g = { name: row[2], unit: row[3], title: row[4], gender: row[5], mess_alloc: row[6], room_alloc: row[7] };
    const msg = '🗑️ *Guest Dihapus*\n' + fmtGuestLine_(g) + (reason?('\nAlasan: '+reason):'');
    tgBroadcast_(tgAdmins_(), msg);
    tgBroadcast_(tgUsers_(), msg);
  }

  return json_({ok:true});
}
function approveReject_(user, body){
  assertAdmin_(user);
  const {reservation_id, reason=''} = body;
  const rsh=sheet('Reservations'); const vals=rsh.getDataRange().getValues();
  let any=false, row=null;
  for(let i=1;i<vals.length;i++){
    if(vals[i][0]===reservation_id){
      rsh.getRange(i+1,9).setValue('rejected'); any=true; row=vals[i]; break;
    }
  }
  if(!any) return json_({ok:false, error:'reservation_not_found'});

  const gsh=sheet('Guests'); const gvals=gsh.getDataRange().getValues();
  for(let i=1;i<gvals.length;i++){
    if(gvals[i][1]===reservation_id){ gsh.getRange(i+1,9).setValue('rejected'); }
  }

  // === Telegram ===
  if(tgEnabled_()){
    const msg = '⛔️ *Reservasi DITOLAK*\n' +
      'Agenda: ' + (row ? (row[4]||'-') : '-') + '\n' +
      'Mess  : ' + (row ? (row[5]||'-') : '-') + '\n' +
      (reason?('Alasan: '+reason+'\n'):'') +
      'ID: ' + reservation_id.substring(0,8);
    tgBroadcast_(tgAdmins_(), msg);
    tgBroadcast_(tgUsers_(), msg);
  }

  return json_({ok:true});
}


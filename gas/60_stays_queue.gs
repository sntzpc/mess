/*************** MESS QUEUE & STAY ***************/
function messQueue_(user, body){
  // role mess: hanya mess miliknya; admin bisa pilih mess via body.mess_name
  let messName = user.role==='mess' ? (user.mess||'') : (body.mess_name||'');
  if(!messName) return json_({ok:false, error:'mess_required'});

  const gvals = sheet('Guests').getDataRange().getValues().slice(1);
  // ambil tamu yang dialokasikan ke mess ini dan statusnya approved ATAU checkedin
  const rows = gvals
    .filter(g => g[6] === messName && (g[8] === 'approved' || g[8] === 'checkedin'))
    .map(g => ({
      id: g[0], name: g[2], unit: g[3], title: g[4], gender: g[5], mess_alloc: g[6], room_alloc: g[7], status: g[8] // 'approved' atau 'checkedin'
    }));

  return json_({ok:true, rows});
}

function guestCheckin_(user, body){
  const {guest_id} = body;
  const gsh=sheet('Guests'); const vals=gsh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    if(vals[i][0]===guest_id && (user.role==='admin' || vals[i][6]===user.mess)){
      const now=new Date();
      gsh.getRange(i+1,9).setValue('checkedin');
      sheet('Stays').appendRow([genId_(), guest_id, vals[i][6], vals[i][7], fmtDate_(now), fmtTime_(now), '', '']);

      // === Telegram ===
      if(tgEnabled_()){
        const g = { name: vals[i][2], unit: vals[i][3], title: vals[i][4], gender: vals[i][5], mess_alloc: vals[i][6], room_alloc: vals[i][7] };
        const msg = '🟢 *Check-In*\n' + fmtGuestLine_(g) + '\n🕒 ' + fmtDate_(now) + ' ' + fmtTime_(now);
        tgBroadcast_(tgAdmins_(), msg);
        tgBroadcast_(tgUsers_(), msg);
        tgBroadcast_(getTgIdsByMess_(g.mess_alloc), msg);
      }

      return json_({ok:true, ts_date:fmtDate_(now), ts_time:fmtTime_(now)});
    }
  }
  return json_({ok:false, error:'guest_not_found_or_forbidden'});
}
function guestCheckout_(user, body){
  const {guest_id} = body;
  const gsh=sheet('Guests'); const gvals=gsh.getDataRange().getValues();
  let gRow=-1; let g=null;
  for(let i=1;i<gvals.length;i++){
    if(gvals[i][0]===guest_id){ gRow=i+1; g=gvals[i]; break; }
  }
  if(gRow<0) return json_({ok:false, error:'guest_not_found'});
  if(!(user.role==='admin' || g[6]===user.mess)) return json_({ok:false, error:'forbidden'});

  const now=new Date();
  gsh.getRange(gRow,9).setValue('checkedout');
  const ssh=sheet('Stays'); const svals=ssh.getDataRange().getValues();
  for(let i=1;i<svals.length;i++){
    if(svals[i][1]===guest_id && !svals[i][6]){
      ssh.getRange(i+1,7).setValue(fmtDate_(now));
      ssh.getRange(i+1,8).setValue(fmtTime_(now));
      break;
    }
  }

  // === Telegram ===
  if(tgEnabled_()){
    const gg = { name: g[2], unit: g[3], title: g[4], gender: g[5], mess_alloc: g[6], room_alloc: g[7] };
    const msg = '🔵 *Check-Out*\n' + fmtGuestLine_(gg) + '\n🕒 ' + fmtDate_(now) + ' ' + fmtTime_(now);
    tgBroadcast_(tgAdmins_(), msg);
    tgBroadcast_(tgUsers_(), msg);
    tgBroadcast_(getTgIdsByMess_(gg.mess_alloc), msg);
  }

  return json_({ok:true, ts_date:fmtDate_(now), ts_time:fmtTime_(now)});
}



/*************** USERS ***************/
function usersList_(user){
  assertAdmin_(user);
  const sh = sheet('Users'); const vals=sh.getDataRange().getValues().slice(1);
  const rows = vals.map(r=>({id:r[0], username:r[1], role:r[3], mess_name:r[4]||'', telegram_id:r[5]||''}));
  return json_({ok:true, rows});
}
function usersAdd_(user, body){
  assertAdmin_(user);
  const {username, password, role, mess_name, telegram_id} = body;
  if(!username || !role) return json_({ok:false, error:'missing_fields'});

  const sh = sheet('Users');
  const vals = sh.getDataRange().getValues();

  // cari user existing
  let foundRow = -1;
  for(let i=1;i<vals.length;i++){
    if(vals[i][1] === username){
      foundRow = i+1; break;
    }
  }

  if(foundRow > 0){
    // UPDATE
    if(password){ sh.getRange(foundRow, 3).setValue(hash_(password)); }          // password_hash
    sh.getRange(foundRow, 4).setValue(role);                                     // role
    sh.getRange(foundRow, 5).setValue(mess_name || '');                          // mess_name
    sh.getRange(foundRow, 6).setValue(telegram_id || '');                        // telegram_id
  }else{
    // INSERT
    const row = [genId_(), username, password ? hash_(password) : hash_(''), role, mess_name||'', telegram_id||'', nowWibDateTime_()];
    sh.appendRow(row);
  }

  // Sinkronisasi 2 arah: jika admin punya telegram_id, set juga di Config
  if(role === 'admin'){
    setConfig_('telegram_admin_id', String(telegram_id||'').trim());
  }

  return json_({ok:true, updated:(foundRow>0)});
}

function usersDel_(user, body){
  assertAdmin_(user);
  if(body.username==='admin') return json_({ok:false, error:'cannot_delete_admin'});
  const sh = sheet('Users'); const vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){ if(vals[i][1]===body.username){ sh.deleteRow(i+1); return json_({ok:true}); } }
  return json_({ok:false, error:'not_found'});
}
function usersPass_(user, body){
  // admin can change anyone, user can change self
  const {username, newpass} = body;
  const target = username || user.username;
  const sh = sheet('Users'); const vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    if(vals[i][1]===target){
      sh.getRange(i+1,3).setValue(hash_(newpass));
      return json_({ok:true});
    }
  }
  return json_({ok:false, error:'user_not_found'});
}

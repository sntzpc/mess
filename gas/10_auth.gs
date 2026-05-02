/*************** AUTH ***************/
function login_(body){
  const {username, password} = body;
  const u = sheet('Users'); const vals = u.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    const [id, un, ph, role, messName, teleId] = vals[i];
    if(un===username && ph===hash_(password)){
      const payload = { uid:id, username:un, role, mess: messName || '', exp: Date.now()+TOKEN_TTL_MS };
      return json_({ok:true, token:signToken_(payload), user:payload});
    }
  }
  return json_({ok:false, error:'invalid_credentials'});
}
function assertAdmin_(user){ if(user.role!=='admin') throw new Error('forbidden'); }

function authRegisterPublic_(body){
  var fullname    = String((body && body.fullname)    || '').trim();
  var username    = String((body && body.username)    || '').trim().toLowerCase();
  var password    = String((body && body.password)    || '').trim();
  var telegram_id = String((body && body.telegram_id) || '').trim();          // <-- ADD

  if (!fullname) return json_({ok:false, error:'Nama lengkap wajib diisi.'});
  if (!username) return json_({ok:false, error:'Username wajib diisi.'});
  if (!password) return json_({ok:false, error:'Password wajib diisi.'});

  var sh = sheet('Users'); // header dibuat oleh initOnce_()
  var vals = sh.getDataRange().getValues();
  // kolom: ['id','username','password_hash','role','mess_name','telegram_id','created_at']

  // Cek duplikat username (case-insensitive)
  for (var i=1; i<vals.length; i++){
    var u = String(vals[i][1]||'').trim().toLowerCase();
    if (u && u === username){
      return json_({ok:false, error:'Username sudah digunakan. Silakan pilih yang lain.'});
    }
  }

  var id = genId_();
  var now = nowWibDateTime_();
  //            id, username,       password_hash,       role,   mess_name, telegram_id,  created_at
  var row = [   id, username,       hash_(password),     'user', '',        telegram_id,  now ];   // <-- SAVE telegram_id
  sh.appendRow(row);

  return json_({ok:true, id:id, role:'user'});
}




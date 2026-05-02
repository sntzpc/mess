/*************** MESS MASTER ***************/
/*
  Modul ini mengelola master data Mess.
  Dipakai oleh action:
  - mess.list
  - mess.add
  - mess.update
  - mess.del

  Struktur sheet Mess:
  id | name | location | notes | created_at | is_active
*/

function messNormalizeName_(name){
  return String(name || '').trim().replace(/\s+/g, ' ');
}

function messIsActive_(v){
  // Google Sheet kadang menyimpan angka sebagai number/string/boolean.
  return !(v === 0 || v === '0' || v === false || String(v).toLowerCase() === 'false');
}

function messFindRowById_(sh, id){
  var vals = sh.getDataRange().getValues();
  for(var i = 1; i < vals.length; i++){
    if(String(vals[i][0]) === String(id)){
      return { row: i + 1, values: vals[i] };
    }
  }
  return null;
}

function messNameExists_(sh, name, exceptId){
  var target = messNormalizeName_(name).toLowerCase();
  if(!target) return false;
  var vals = sh.getDataRange().getValues();
  for(var i = 1; i < vals.length; i++){
    var rowId = String(vals[i][0] || '');
    var rowName = messNormalizeName_(vals[i][1]).toLowerCase();
    if(rowName === target && (!exceptId || rowId !== String(exceptId))){
      return true;
    }
  }
  return false;
}

function messList_(user, body){
  var includeInactive = body && (body.include_inactive === true || body.include_inactive === 1 || body.include_inactive === '1');
  var sh = sheet('Mess');
  var vals = sh.getDataRange().getValues();
  var rows = [];

  for(var i = 1; i < vals.length; i++){
    var r = vals[i];
    var active = messIsActive_(r[5]);
    if(!includeInactive && !active) continue;
    if(!r[0] && !r[1]) continue;

    rows.push({
      id: r[0],
      name: r[1] || '',
      location: r[2] || '',
      notes: r[3] || '',
      created_at: r[4] || '',
      is_active: active
    });
  }

  rows.sort(function(a, b){
    return String(a.name || '').localeCompare(String(b.name || ''), 'id');
  });

  return json_({ ok: true, rows: rows });
}

function messAdd_(user, body){
  assertAdmin_(user);

  var name = messNormalizeName_(body && body.name);
  var location = String((body && body.location) || '').trim();
  var notes = String((body && body.notes) || '').trim();

  if(!name) return json_({ ok:false, error:'name_required' });

  var sh = sheet('Mess');
  if(messNameExists_(sh, name, '')){
    return json_({ ok:false, error:'mess_name_already_exists' });
  }

  var id = genId_();
  sh.appendRow([id, name, location, notes, nowWibDateTime_(), 1]);

  return json_({ ok:true, id:id });
}

function messUpdate_(user, body){
  assertAdmin_(user);

  if(!body || !body.id) return json_({ ok:false, error:'id_required' });

  var sh = sheet('Mess');
  var found = messFindRowById_(sh, body.id);
  if(!found) return json_({ ok:false, error:'not_found' });

  if(body.name !== undefined){
    var name = messNormalizeName_(body.name);
    if(!name) return json_({ ok:false, error:'name_required' });
    if(messNameExists_(sh, name, body.id)){
      return json_({ ok:false, error:'mess_name_already_exists' });
    }
    sh.getRange(found.row, 2).setValue(name);
  }

  if(body.location !== undefined){
    sh.getRange(found.row, 3).setValue(String(body.location || '').trim());
  }

  if(body.notes !== undefined){
    sh.getRange(found.row, 4).setValue(String(body.notes || '').trim());
  }

  if(body.is_active !== undefined){
    var active = !(body.is_active === 0 || body.is_active === '0' || body.is_active === false || String(body.is_active).toLowerCase() === 'false');
    sh.getRange(found.row, 6).setValue(active ? 1 : 0);
  }

  return json_({ ok:true });
}

function messDel_(user, body){
  assertAdmin_(user);

  if(!body || !body.id) return json_({ ok:false, error:'id_required' });

  var sh = sheet('Mess');
  var found = messFindRowById_(sh, body.id);
  if(!found) return json_({ ok:false, error:'not_found' });

  // Untuk menjaga histori reservasi/jurnal tidak rusak, hapus dilakukan sebagai nonaktif.
  // Data tidak tampil di dropdown/list normal karena mess.list default hanya menampilkan is_active=1.
  sh.getRange(found.row, 6).setValue(0);

  return json_({ ok:true, soft_deleted:true });
}

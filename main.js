/* PakKom Eco Track v3.3.5 — Unified Core
   Application Core + Authentication Core dalam satu file klasik.
*/

/* PakKom Eco Track v3.3.5 — Compat Application Core
   Seluruh Authentication + Firestore memakai Firebase Compat yang sama. */
(function(){
'use strict';

// ---- Firebase Compat adapters (API mirip modular agar fitur lama tetap stabil) ----
function initializeApp(config,name){
  if(name) return firebase.initializeApp(config,name);
  return firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
}
function deleteApp(app){ return app.delete(); }
function getAuth(app){ return app.auth(); }
function getFirestore(app){ return app.firestore(); }
function signOut(auth){ return auth.signOut(); }
function createUserWithEmailAndPassword(auth,email,password){ return auth.createUserWithEmailAndPassword(email,password); }

function collection(db,name){ return db.collection(name); }
function doc(db){
  const parts=Array.prototype.slice.call(arguments,1);
  return db.doc(parts.join('/'));
}
function where(field,op,value){ return {kind:'where',field,op,value}; }
function orderBy(field,direction){ return {kind:'orderBy',field,direction:direction||'asc'}; }
function query(ref){
  const clauses=Array.prototype.slice.call(arguments,1);
  let q=ref;
  clauses.forEach(c=>{
    if(!c) return;
    if(c.kind==='where') q=q.where(c.field,c.op,c.value);
    if(c.kind==='orderBy') q=q.orderBy(c.field,c.direction);
  });
  return q;
}
function wrapDocSnapshot(snap){
  return {
    id:snap.id,
    exists:function(){ return !!snap.exists; },
    data:function(){ return snap.data(); },
    ref:snap.ref
  };
}
function wrapQuerySnapshot(snap){
  return {
    docs:snap.docs.map(wrapDocSnapshot),
    empty:snap.empty,
    size:snap.size
  };
}
async function getDoc(ref){ return wrapDocSnapshot(await ref.get()); }
async function getDocs(ref){ return wrapQuerySnapshot(await ref.get()); }
function setDoc(ref,data,options){
  if(options && options.merge) return ref.set(data,{merge:true});
  return ref.set(data);
}
function deleteDoc(ref){ return ref.delete(); }
function writeBatch(db){
  const b=db.batch();
  return {
    set:function(ref,data,opts){ b.set(ref,data,opts&&opts.merge?{merge:true}:undefined); return this; },
    delete:function(ref){ b.delete(ref); return this; },
    commit:function(){ return b.commit(); }
  };
}
function serverTimestamp(){ return firebase.firestore.FieldValue.serverTimestamp(); }

const cfg = window.PAKKOM_FIREBASE_CONFIG || {};
const configured = cfg.apiKey && !String(cfg.apiKey).includes('GANTI_') && cfg.projectId && !String(cfg.projectId).includes('GANTI_');
const $ = s => document.querySelector(s);
const content = $('#content');
const classesDefault = ['7A','7B','7C','7D','7E','7F','7G','7H','7I','8A','8B','8C','8D','8E','8F','8G','8H','8I','9A','9B','9C','9D','9E','9F','9G','9H','9I'];
const todayKey = () => new Date().toLocaleDateString('en-CA');
const dateID = () => new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
function dayFromKey(key){ const [y,m,d]=String(key).split('-').map(Number); return new Date(y,m-1,d).getDay(); }
async function loadNationalHolidays(year){
  const cacheKey=`pakkom_holidays_${year}`;
  try{
    const cached=JSON.parse(localStorage.getItem(cacheKey)||'null');
    if(cached?.items) state.holidays=cached.items;
    if(cached?.savedAt && Date.now()-cached.savedAt<7*86400000) return state.holidays;
  }catch(_){}

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),2500);
  try{
    const r=await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/ID`,{
      cache:'no-cache',signal:controller.signal
    });
    if(!r.ok) throw new Error('holiday-api');
    const arr=await r.json();
    state.holidays=Object.fromEntries(arr.map(h=>[h.date,h.localName||h.name||'Libur Nasional']));
    localStorage.setItem(cacheKey,JSON.stringify({savedAt:Date.now(),items:state.holidays}));
    return state.holidays;
  }catch(e){
    console.warn('Kalender libur nasional memakai cache/fallback',e);
    state.holidays=state.holidays||{};
    return state.holidays;
  }finally{
    clearTimeout(timer);
  }
}
function syncNationalHolidaysInBackground(){
  loadNationalHolidays(new Date().getFullYear()).then(()=>{
    // Segarkan halaman aktif tanpa mengganggu proses login.
    if(state.profile && state.page==='home') renderPage();
  }).catch(()=>{});
}
function operationalInfo(dateKey=todayKey()){
  const override=state.calendarSettings?.overrides?.[dateKey];
  const dow=dayFromKey(dateKey);
  const national=state.holidays?.[dateKey];
  let active=!(dow===0||dow===6) && !national;
  let jp=active?(dow===5?5:9):0;
  let label=national?`Libur Nasional • ${national}`:(dow===0||dow===6?'Akhir Pekan':'Hari Sekolah');
  if(override){
    if(typeof override.active==='boolean') active=override.active;
    if(Number.isFinite(Number(override.jp))) jp=active?Math.max(1,Math.min(12,Number(override.jp))):0;
    label=override.label|| (active?'Hari Aktif Khusus':'Libur Sekolah');
  }
  return {active,jp,label,national:!!national,override};
}
const ADMIN_LOGIN_EMAIL = 'komarudingalasta@gmail.com';
const loginEmail = id => {
  const normalized = String(id).trim().toUpperCase();
  if (normalized === 'ADMIN') return ADMIN_LOGIN_EMAIL;
  return `${normalized.toLowerCase().replace(/[^a-z0-9._-]/g,'')}@pakkom-ecotrack.app`;
};
let app, auth, db;
let authResolved = true;
let loginInProgress = false;
let state = { user:null, profile:null, page:'home', selectedClass:null, classes:[], classDocs:[], recordsToday:[], students:[], cleanlinessToday:[], masterTab:'students', holidays:{}, calendarSettings:{overrides:{}} };

const APP_VERSION='3.3.3';
function withTimeout(promise, ms=5000, label='Proses'){
  return Promise.race([
    promise,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label} terlalu lama.`)),ms))
  ]);
}
function resetCoreState(){
  state.classDocs=[]; state.classes=[]; state.recordsToday=[]; state.cleanlinessToday=[];
  state.students=[]; state.calendarSettings={overrides:{}};
}


function toast(msg, ms=4200){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(window.__toastTimer); window.__toastTimer=setTimeout(()=>t.classList.remove('show'),ms); }
function authErrorMessage(e){
  const code=e?.code||'';
  const map={
    'auth/invalid-credential':'Email/NIP Guru/ADMIN atau password tidak cocok dengan Firebase Authentication.',
    'auth/wrong-password':'Password tidak cocok.',
    'auth/user-not-found':'Akun tidak ditemukan di Firebase Authentication.',
    'auth/user-disabled':'Akun Firebase dinonaktifkan.',
    'auth/operation-not-allowed':'Login Email/Password belum diaktifkan di Firebase Authentication.',
    'auth/too-many-requests':'Terlalu banyak percobaan login. Tunggu sebentar lalu coba lagi.',
    'auth/network-request-failed':'Koneksi ke Firebase gagal. Periksa internet lalu coba lagi.'
  };
  return map[code] || `Login gagal${code?` (${code})`:''}.`;
}
function esc(v=''){ return String(v).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m])); }
function pageMeta(title,sub=''){ $('#pageTitle').textContent=title; $('#pageSubtitle').textContent=sub; }
function navItems(){
  if(state.profile?.role==='admin') return [['home','🏠 Beranda'],['input','🥤 Wadah'],['clean','🧹 Kebersihan'],['recap','📊 Rekap'],['master','⚙️ Kelola']];
  return [['home','🏠 Beranda'],['input','🥤 Wadah'],['clean','🧹 Kebersihan'],['recap','📊 Rekap'],['account','👤 Akun']];
}

function showAuthLoading(show=true){
  // v3.2.2 Direct Login: tidak ada splash / pemeriksaan sesi.
  return;
}

function showLoginError(msg=''){
  const el=$('#loginError'); if(!el)return;
  el.textContent=msg; el.classList.toggle('hidden',!msg);
}
async function loadProfileForUser(user){
  const snap=await withTimeout(
    getDoc(doc(db,'users',user.uid)),
    5000,
    'Membaca profil pengguna'
  );
  if(!snap.exists()) throw new Error(`Profil users/${user.uid} tidak ditemukan.`);
  const profile={uid:user.uid,...snap.data()};
  if(profile.rejected===true) throw new Error('Pendaftaran akun tidak disetujui Admin.');
  if(profile.approved===false && profile.role==='guru') throw new Error('Pendaftaran akun masih menunggu persetujuan Admin.');
  if(profile.active===false) throw new Error('Akun dinonaktifkan administrator.');
  if(!['admin','guru'].includes(profile.role)) throw new Error('Role akun tidak dikenali.');
  return profile;
}
async function loadCoreDataInBackground(){
  try{
    await refreshCore();
    if(state.profile) renderShell();
  }catch(e){
    console.error('Core data background error',e);
    toast('Sebagian data belum dapat dimuat. Coba refresh menu jika diperlukan.',5000);
  }
  syncNationalHolidaysInBackground();
}

async function finishSignedIn(user){
  try{
    const profile=await loadProfileForUser(user);
    state.user=user;
    state.profile=profile;
    authResolved=true;

    // Login selesai begitu Authentication + profil valid.
    // Data dashboard dimuat setelah shell aplikasi sudah tampil.
    renderShell();
    loadCoreDataInBackground();
  }catch(e){
    console.error('Profile/login completion error',e);
    await signOut(auth).catch(()=>{});
    state.user=null;
    state.profile=null;
    resetCoreState();
    authResolved=true;
    renderShell();
    showLoginError(e.message||'Profil akun tidak dapat dibaca.');
  }
}

// Login initialization ditangani hanya oleh Auth Core di bagian bawah file.


// Password toggle ditangani oleh index.html.

function openRegisterModal(){
  const modal=$('#registerModal');
  $('#regClass').innerHTML=classesDefault.map(c=>`<option value="${c}">${c}</option>`).join('');
  $('#regType').value='guru'; $('#regClassWrap').classList.add('hidden');
  $('#regLoginId').value=''; $('#regName').value=''; $('#regPassword').value=''; $('#regPassword2').value='';
  modal.classList.remove('hidden');
}
function closeRegisterModal(){ $('#registerModal').classList.add('hidden'); }
$('#openRegister').onclick=openRegisterModal;
$('#registerClose').onclick=closeRegisterModal; $('#registerCancel').onclick=closeRegisterModal;
$('#regType').onchange=()=>$('#regClassWrap').classList.toggle('hidden',$('#regType').value!=='wali');
$('#registerSubmit').onclick=async()=>{
  const loginId=$('#regLoginId').value.trim().toUpperCase(), name=$('#regName').value.trim(), type=$('#regType').value;
  const homeroomClass=type==='wali'?$('#regClass').value:''; const password=$('#regPassword').value, password2=$('#regPassword2').value;
  if(!loginId||loginId==='ADMIN'||!name)return toast('NIP Guru dan nama wajib diisi.');
  if(!/^[A-Z0-9._-]{2,30}$/.test(loginId))return toast('NIP Guru hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.');
  if(password.length<6)return toast('Password minimal 6 karakter.');
  if(password!==password2)return toast('Ulangi password belum sama.');
  const btn=$('#registerSubmit'); btn.disabled=true; btn.textContent='Mengirim...';
  let secondary=null;
  try{
    secondary=initializeApp(cfg,`registration-${Date.now()}-${Math.random()}`);
    const secondaryAuth=getAuth(secondary), secondaryDb=getFirestore(secondary);
    const cred=await createUserWithEmailAndPassword(secondaryAuth,loginEmail(loginId),password);
    await setDoc(doc(secondaryDb,'users',cred.user.uid),{
      loginId,name,role:'guru',approved:false,active:false,rejected:false,
      requestedType:type,requestedHomeroomClass:homeroomClass,
      isHomeroom:false,homeroomClass:'',createdAt:new Date().toISOString()
    });
    await signOut(secondaryAuth).catch(()=>{}); closeRegisterModal();
    toast('Pendaftaran berhasil dikirim. Tunggu persetujuan Admin sebelum login.',7000);
  }catch(e){console.error(e);toast(e.code==='auth/email-already-in-use'?'NIP Guru sudah pernah didaftarkan.':(e.message||'Pendaftaran gagal.'),6500);}
  finally{btn.disabled=false;btn.textContent='Kirim Pendaftaran';if(secondary)await deleteApp(secondary).catch(()=>{});}
};


async function logoutNow(){
  state.user=null; state.profile=null; resetCoreState(); authResolved=true;
  if(window.PAKKOM_COMPAT_CORE?.logout) return window.PAKKOM_AUTH_CORE.logout();
}

$('#logoutBtn').onclick=logoutNow; if($('#quickLogout')) $('#quickLogout').onclick=logoutNow;
$('#menuBtn').onclick=()=>document.querySelector('.sidebar').classList.toggle('open');

async function refreshCore(){
  const jobs=[
    withTimeout(getDocs(query(collection(db,'classes'),orderBy('name'))),5000,'Memuat kelas'),
    withTimeout(getDocs(query(collection(db,'records'),where('date','==',todayKey()))),5000,'Memuat pendataan hari ini'),
    withTimeout(getDocs(query(collection(db,'cleanliness'),where('date','==',todayKey()))),5000,'Memuat kebersihan hari ini'),
    withTimeout(getDoc(doc(db,'settings','calendar')),5000,'Memuat kalender sekolah')
  ];
  const [classRes,recordRes,cleanRes,calendarRes]=await Promise.allSettled(jobs);

  if(classRes.status==='fulfilled'){
    state.classDocs=classRes.value.docs.map(d=>({id:d.id,...d.data()}));
    state.classes=state.classDocs.filter(c=>c.active!==false).map(c=>c.id);
  } else console.warn(classRes.reason);

  if(recordRes.status==='fulfilled'){
    state.recordsToday=recordRes.value.docs.map(d=>({id:d.id,...d.data()}));
  } else console.warn(recordRes.reason);

  if(cleanRes.status==='fulfilled'){
    state.cleanlinessToday=cleanRes.value.docs.map(d=>({id:d.id,...d.data()}))
      .sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  } else console.warn(cleanRes.reason);

  if(calendarRes.status==='fulfilled'){
    state.calendarSettings=calendarRes.value?.exists?.()
      ? calendarRes.value.data()
      : {overrides:{}};
  } else console.warn(calendarRes.reason);

  return {
    classes:classRes.status,
    records:recordRes.status,
    cleanliness:cleanRes.status,
    calendar:calendarRes.status
  };
}

function classRecord(c){ return state.recordsToday.find(r=>r.classId===c); }

function renderShell(){
  if(!state.profile){
    $('#loginView').classList.remove('hidden');
    $('#appView').classList.add('hidden');
    return;
  }
  showLoginError(''); $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden');
  const chipRole=state.profile.role==='admin'?'Admin':(state.profile.isHomeroom?`Wali Kelas${state.profile.homeroomClass?' • '+esc(state.profile.homeroomClass):''}`:'Guru');
  $('#userChip').innerHTML=`<b>${esc(state.profile.name)}</b><br>${chipRole}`;
  $('#nav').innerHTML=navItems().map(([k,l])=>`<button class="nav-btn ${state.page===k?'active':''}" data-page="${k}">${l}</button>`).join('');
  document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>{state.page=b.dataset.page;state.selectedClass=null;renderShell();document.querySelector('.sidebar').classList.remove('open')});
  renderPage();
}
function renderPage(){ if(state.page==='home')return home(); if(state.page==='input')return inputPage(); if(state.page==='clean')return cleanlinessPage(); if(state.page==='recap')return recap(); if(state.page==='account')return account(); if(state.page==='master')return master(); }

function home(){
  pageMeta('Beranda',dateID());
  const done=new Set(state.recordsToday.map(r=>r.classId));
  const items=state.recordsToday.flatMap(r=>(r.items||[]).filter(i=>i.presence==='hadir'));
  const food=items.length?Math.round(items.filter(i=>i.food).length/items.length*100):0;
  const tumb=items.length?Math.round(items.filter(i=>i.tumbler).length/items.length*100):0;
  const lastClean=state.cleanlinessToday[0];
  const waliClass=state.profile?.isHomeroom?state.profile.homeroomClass:'';
  const waliRec=waliClass?classRecord(waliClass):null;
  const waliClean=waliClass?state.cleanlinessToday.find(x=>x.classId===waliClass):null;
  const op=operationalInfo();
  content.innerHTML=`<div class="welcome"><span>Selamat datang,</span><h2>${esc(state.profile.name)} 👋</h2></div>
  ${!op.active?`<div class="holiday-banner"><div>🏖️</div><div><b>Hari Tidak Aktif</b><span>${esc(op.label)} • Pendataan harian dan pemeriksaan kebersihan dinonaktifkan.</span></div></div>`:''}
  <div class="module-grid ${!op.active?'modules-off':''}">
    <div class="module-card module-wadah"><div class="module-icon">🥤</div><div><span class="eyebrow">PENDATAAN HARI INI</span><h3>Wadah & Tumbler</h3><strong>${done.size} dari ${state.classes.length} kelas</strong><div class="progress"><i style="width:${state.classes.length?Math.round(done.size/state.classes.length*100):0}%"></i></div><p>Wadah ${food}% • Tumbler ${tumb}%</p></div><button class="btn primary module-go" data-go="input" ${!op.active?'disabled':''}>${op.active?'Mulai Pendataan →':'Hari Libur'}</button></div>
    <div class="module-card module-clean"><div class="module-icon">🧹</div><div><span class="eyebrow">PEMERIKSAAN HARI INI</span><h3>Kebersihan Kelas</h3><strong>${state.cleanlinessToday.length} pemeriksaan</strong><p>${lastClean?`Terakhir: ${esc(lastClean.classId)} • JP ${esc(lastClean.jp)} • ${esc(lastClean.timeLabel||'')}`:'Belum ada pemeriksaan hari ini'}</p></div><button class="btn clean-btn module-go" data-go="clean" ${!op.active?'disabled':''}>${op.active?'+ Cek Kebersihan':'Hari Libur'}</button></div>
  </div>
  ${waliClass?`<div class="card homeroom-card"><span class="badge ok">⭐ Kelas Saya</span><h3>${esc(waliClass)}</h3><div class="wali-summary"><span>🥤 ${waliRec?'Sudah didata':'Belum didata'}</span><span>🧹 ${waliClean?`${cleanOverall(waliClean).label} • JP ${waliClean.jp}`:'Belum diperiksa'}</span></div></div>`:''}
  ${op.active?`<div class="card"><div class="section-head"><div><h3 style="margin:0">Belum Pendataan Wadah & Tumbler</h3><small>Hanya pendataan wadah & tumbler yang dihitung sekali per kelas per hari.</small></div></div><div class="chip-list">${state.classes.filter(c=>!done.has(c)).map(c=>`<button class="mini-chip" data-class="${c}">${c}</button>`).join('')||'<span class="badge ok">Semua kelas sudah didata ✓</span>'}</div></div>`:''}`;
  document.querySelectorAll('.module-go').forEach(b=>b.onclick=()=>{state.page=b.dataset.go;renderShell()});
  document.querySelectorAll('.mini-chip').forEach(b=>b.onclick=()=>{state.selectedClass=b.dataset.class;state.page='input';renderShell()});
}
function bindClassButtons(){ document.querySelectorAll('[data-class]').forEach(b=>b.onclick=()=>{state.page='input';state.selectedClass=b.dataset.class;renderShell()}); }

function inputPage(){
  pageMeta('Wadah & Tumbler','Pilih kelas lalu tandai kondisi siswa');
  const op=operationalInfo(); if(!op.active){ content.innerHTML=`<div class="card holiday-card"><div class="holiday-icon">🏖️</div><h3>Hari Tidak Aktif</h3><p>${esc(op.label)}</p><small>Pendataan Wadah & Tumbler tidak tersedia hari ini.</small></div>`; return; }
  if(!state.selectedClass){ content.innerHTML=`<div class="card"><h3>Pilih Kelas</h3><div class="grid class-grid">${state.classes.map(c=>{const r=classRecord(c);return `<button class="class-btn ${r?'done':'pending'}" data-class="${c}"><b>${c}</b><small>${r?'Sudah didata':'Belum didata'}</small></button>`}).join('')}</div></div>`; bindClassButtons(); return; }
  loadClassForm(state.selectedClass);
}
async function loadClassForm(c){
  content.innerHTML='<div class="card"><div class="empty">Memuat data siswa...</div></div>';
  try{
    const snap=await getDocs(query(collection(db,'students'),where('classId','==',c)));
    const students=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.active!==false).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    const existing=classRecord(c);
    const oldMap=new Map((existing?.items||[]).map(i=>[String(i.studentId||i.nis),i]));
    window.formItems=students.map(st=>{
      const old=oldMap.get(String(st.id))||oldMap.get(String(st.nis||st.id));
      return old?{...old,studentId:st.id,nis:st.nis||st.id,name:st.name}:{studentId:st.id,nis:st.nis||st.id,name:st.name,presence:'hadir',food:true,tumbler:true};
    });
    window.rosterChanged=!!existing && ((existing.items||[]).length!==window.formItems.length || window.formItems.some((i,idx)=>!existing.items?.[idx] || existing.items[idx].studentId!==i.studentId || existing.items[idx].name!==i.name));
    window.originalRecord=existing||null; window.formLocked=!!(existing && existing.createdByUid!==state.user.uid && state.profile.role!=='admin');
    renderClassForm(c);
  }catch(e){ console.error(e); content.innerHTML='<div class="card"><div class="empty">Gagal memuat siswa. Periksa Firestore Rules dan koneksi.</div></div>'; }
}
function renderClassForm(c){
  const existing=window.originalRecord;
  content.innerHTML=`<div class="section-head"><div><h3 style="margin:0">Kelas ${c}</h3><small>${existing?`Sudah didata oleh ${esc(existing.createdByName||'Guru')} • ${esc(existing.timeLabel||'-')}`:'Belum pernah disimpan hari ini'}</small></div><button class="btn ghost" id="backClasses">← Pilih kelas lain</button></div>
  ${window.formLocked?'<div class="notice">Data dibuat guru lain. Saat ini hanya ditampilkan. Gunakan “Koreksi Data” jika memang perlu mengubahnya.</div>':''}${window.rosterChanged?'<div class="notice">Daftar siswa aktif kelas ini berubah sejak pendataan terakhir. Form sudah disesuaikan dengan master siswa terbaru tanpa menghapus status siswa yang masih terdaftar.</div>':''}
  <div class="card attendance-card">
    <div class="wadah-sticky-tools">
      <div class="toolbar wadah-bulk"><button class="btn secondary bulk" data-bulk="presence">✓ Semua Hadir</button><button class="btn secondary bulk" data-bulk="food">🥡 Semua Bawa Wadah</button><button class="btn secondary bulk" data-bulk="tumbler">💧 Semua Bawa Tumbler</button>${window.formLocked?'<button id="unlockBtn" class="btn ghost">Koreksi Data</button>':''}</div>
      <div id="wadahSummary" class="wadah-summary"></div>
    </div>
    <div id="studentRows" class="student-card-list"></div>
    <div class="wadah-save-bar"><div id="wadahSaveSummary" class="save-summary"></div><button id="saveBtn" class="btn primary" ${window.formLocked?'disabled':''}>Simpan Data ${c}</button></div>
  </div>`;
  $('#backClasses').onclick=()=>{state.selectedClass=null;renderPage()};
  if($('#unlockBtn')) $('#unlockBtn').onclick=()=>{window.formLocked=false;$('#saveBtn').disabled=false;$('#unlockBtn').disabled=true;renderStudentRows();toast('Mode koreksi aktif')};
  document.querySelectorAll('.bulk').forEach(b=>b.onclick=()=>setAll(b.dataset.bulk));
  $('#saveBtn').onclick=()=>saveClass(c); renderStudentRows();
}
function setAll(field){ if(window.formLocked)return; window.formItems.forEach(i=>{if(field==='presence')i.presence='hadir';else if(i.presence==='hadir')i[field]=true}); renderStudentRows(); }
function renderStudentRows(){
  const rows=$('#studentRows'); if(!rows)return;
  const items=window.formItems||[];
  rows.innerHTML=items.map((i,idx)=>{
    const hadir=i.presence==='hadir';
    const complete=hadir && i.food && i.tumbler;
    return `<article class="student-entry ${complete?'complete':''} ${!hadir?'absent':''}">
      <div class="student-entry-head">
        <span class="student-number">${idx+1}</span>
        <div class="student-identity"><b>${esc(i.name)}</b><small>NIS ${esc(i.nis)}</small></div>
        ${complete?'<span class="complete-badge">✓ Lengkap</span>':''}
      </div>
      <div class="student-controls">
        <label class="presence-control"><span>Kehadiran</span><select ${window.formLocked?'disabled':''} data-presence="${idx}"><option value="hadir" ${i.presence==='hadir'?'selected':''}>Hadir</option><option value="izin" ${i.presence==='izin'?'selected':''}>Izin</option><option value="sakit" ${i.presence==='sakit'?'selected':''}>Sakit</option><option value="alpa" ${i.presence==='alpa'?'selected':''}>Alpa</option></select></label>
        <button type="button" class="carry-choice ${i.food&&hadir?'active':''}" data-toggle="food" data-index="${idx}" ${(!hadir||window.formLocked)?'disabled':''}><span>🥡</span><b>Wadah</b><small>${i.food&&hadir?'Membawa':'Tidak'}</small></button>
        <button type="button" class="carry-choice ${i.tumbler&&hadir?'active':''}" data-toggle="tumbler" data-index="${idx}" ${(!hadir||window.formLocked)?'disabled':''}><span>💧</span><b>Tumbler</b><small>${i.tumbler&&hadir?'Membawa':'Tidak'}</small></button>
      </div>
    </article>`;
  }).join('');

  const hadir=items.filter(i=>i.presence==='hadir');
  const food=hadir.filter(i=>i.food).length;
  const tumbler=hadir.filter(i=>i.tumbler).length;
  const summary=`${items.length} siswa • ${hadir.length} hadir • ${food} wadah • ${tumbler} tumbler`;
  if($('#wadahSummary')) $('#wadahSummary').textContent=summary;
  if($('#wadahSaveSummary')) $('#wadahSaveSummary').textContent=summary;

  document.querySelectorAll('[data-presence]').forEach(el=>el.onchange=()=>{
    if(window.formLocked)return;
    const i=window.formItems[+el.dataset.presence];
    i.presence=el.value;
    if(el.value!=='hadir'){i.food=false;i.tumbler=false}
    renderStudentRows();
  });
  document.querySelectorAll('[data-toggle]').forEach(el=>el.onclick=()=>{
    if(window.formLocked)return;
    const i=window.formItems[+el.dataset.index];
    if(i.presence!=='hadir')return;
    i[el.dataset.toggle]=!i[el.dataset.toggle];
    renderStudentRows();
  });
}
async function saveClass(c){
  if(!window.formItems?.length){toast('Belum ada siswa di kelas ini');return;}
  const btn=$('#saveBtn');btn.disabled=true;btn.textContent='Menyimpan...';
  try{
    const id=`${todayKey()}_${c}`; const old=window.originalRecord; const now=new Date();
    const audit=[...(old?.audit||[])]; if(old) audit.push({editedAt:now.toISOString(),editedByUid:state.user.uid,editedByName:state.profile.name});
    const payload={date:todayKey(),classId:c,items:window.formItems,
      createdByUid:old?.createdByUid||state.user.uid,createdByName:old?.createdByName||state.profile.name,createdAt:old?.createdAt||now.toISOString(),
      lastEditedByUid:state.user.uid,lastEditedByName:state.profile.name,lastEditedAt:now.toISOString(),timeLabel:now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}),audit};
    await setDoc(doc(db,'records',id),payload,{merge:false});
    await refreshCore(); toast(`Data ${c} berhasil disimpan`); state.selectedClass=null; renderPage();
  }catch(e){ console.error(e); toast('Gagal menyimpan data'); btn.disabled=false;btn.textContent=`Simpan Data ${c}`; }
}

function cleanlinessPage(){
  pageMeta('Kebersihan Kelas','Pemeriksaan dapat dilakukan beberapa kali dalam sehari');
  const op=operationalInfo(); if(!op.active){ content.innerHTML=`<div class="card holiday-card"><div class="holiday-icon">🏖️</div><h3>Hari Tidak Aktif</h3><p>${esc(op.label)}</p><small>Pemeriksaan kebersihan tidak tersedia hari ini.</small></div>`; return; }
  const list=state.cleanlinessToday;
  content.innerHTML=`<div class="clean-hero card"><div><span class="eyebrow">🧹 MODUL KEBERSIHAN</span><h3>Pemeriksaan Kebersihan Kelas</h3><p>Catat hanya pemeriksaan yang dilakukan. Tidak ada daftar JP yang belum diperiksa.</p></div><button id="newClean" class="btn primary">+ Pemeriksaan Baru</button></div>
  <div class="card"><div class="section-head"><div><h3 style="margin:0">Pemeriksaan Hari Ini</h3><small>${list.length} pemeriksaan tercatat</small></div></div>
  <div class="clean-list">${list.length?list.map(cleanCard).join(''):'<div class="empty">Belum ada pemeriksaan kebersihan hari ini.</div>'}</div></div>`;
  $('#newClean').onclick=renderCleanForm;
}
function cleanCard(r){
  const status=cleanOverall(r);
  return `<div class="clean-item"><div class="clean-class"><b>${esc(r.classId)}</b><small>JP ${esc(r.jp)}</small></div><div class="clean-status ${status.cls}"><span></span><b>${status.label}</b></div><div class="clean-meta">${esc(r.timeLabel||'')}<br><small>${esc(r.createdByName||'Guru')}</small></div></div>`;
}
function cleanOverall(r){
  const vals=['floor','desks','bin','equipment'].map(k=>Number(r[k]||0));
  const min=Math.min(...vals);
  const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
  if(min===1 || avg<2) return {label:'Perlu Tindakan',cls:'bad'};
  if(vals.every(v=>v===3)) return {label:'Bersih & Rapi',cls:'good'};
  return {label:'Cukup',cls:'fair'};
}
function renderCleanForm(){
  const op=operationalInfo();
  if(!op.active){ cleanlinessPage(); return; }
  pageMeta('Pemeriksaan Kebersihan',`Pilih kelas dan JP 1–${op.jp}, lalu nilai 4 aspek`);
  const aspect=(key,label,icon,labels)=>`<div class="aspect-row"><div class="aspect-name"><span>${icon}</span><b>${label}</b></div><div class="tri-choice" data-aspect="${key}"><button data-v="3" class="good active">${labels[0]}</button><button data-v="2" class="fair">${labels[1]}</button><button data-v="1" class="bad">${labels[2]}</button></div></div>`;
  content.innerHTML=`<div class="section-head"><div><h3 style="margin:0">Pemeriksaan Baru</h3><small>${esc(op.label)} • ${op.jp} JP tersedia hari ini.</small></div><button class="btn ghost" id="backClean">← Kembali</button></div>
  <div class="card clean-form"><div class="form-grid"><label>Kelas<select id="cleanClass">${state.classes.map(c=>`<option>${esc(c)}</option>`).join('')}</select></label><label>JP<select id="cleanJp">${Array.from({length:op.jp},(_,i)=>`<option value="${i+1}">JP ${i+1}</option>`).join('')}</select></label></div>
  <div class="aspect-list">${aspect('floor','Lantai','🧹',['Bersih','Cukup Bersih','Kotor'])}${aspect('desks','Meja & Kursi','🪑',['Rapi','Cukup Rapi','Berantakan'])}${aspect('bin','Tempat Sampah','🗑️',['Terkelola','Hampir Penuh','Penuh / Meluber'])}${aspect('equipment','Perlengkapan Kelas','📚',['Rapi','Cukup Rapi','Berantakan'])}</div>
  <label>Catatan <small>(opsional)</small><textarea id="cleanNote" rows="3" placeholder="Contoh: tempat sampah hampir penuh"></textarea></label>
  <div class="clean-actions"><button id="allGood" class="btn secondary">✓ Semua Bersih & Rapi</button><button id="saveClean" class="btn primary">Simpan Pemeriksaan</button></div></div>`;
  const values={floor:3,desks:3,bin:3,equipment:3};
  document.querySelectorAll('.tri-choice button').forEach(b=>b.onclick=()=>{
    const wrap=b.parentElement; values[wrap.dataset.aspect]=Number(b.dataset.v);
    wrap.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));
  });
  $('#allGood').onclick=()=>{Object.keys(values).forEach(k=>values[k]=3);document.querySelectorAll('.tri-choice').forEach(w=>w.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x.dataset.v==='3')));};
  $('#backClean').onclick=cleanlinessPage;
  $('#saveClean').onclick=async()=>{
    const currentOp=operationalInfo(); if(!currentOp.active){toast('Hari ini sudah ditandai sebagai hari tidak aktif.');return;}
    const btn=$('#saveClean'); btn.disabled=true; btn.textContent='Menyimpan...';
    try{
      const now=new Date(), classId=$('#cleanClass').value, jp=Number($('#cleanJp').value);
      if(jp<1||jp>currentOp.jp) throw new Error('JP tidak tersedia untuk hari ini');
      const id=`${todayKey()}_${classId}_JP${jp}_${Date.now()}`;
      await setDoc(doc(db,'cleanliness',id),{date:todayKey(),classId,jp,...values,note:$('#cleanNote').value.trim(),createdByUid:state.user.uid,createdByName:state.profile.name,createdAt:now.toISOString(),timeLabel:now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})});
      await refreshCore(); toast(`Pemeriksaan ${classId} • JP ${jp} tersimpan`); cleanlinessPage();
    }catch(e){console.error(e);toast(`Gagal menyimpan pemeriksaan: ${e.code||e.message}`);btn.disabled=false;btn.textContent='Simpan Pemeriksaan';}
  };
}

function recap(){
  pageMeta('Rekap','Pilih modul rekap yang ingin dilihat');
  content.innerHTML=`<div class="recap-switch"><button class="recap-module active" data-recap="wadah">🥤<b>Wadah & Tumbler</b><small>Rekap pendataan siswa</small></button><button class="recap-module" data-recap="clean">🧹<b>Kebersihan Kelas</b><small>Riwayat pemeriksaan</small></button></div><div id="recapPanel"></div>`;
  document.querySelectorAll('.recap-module').forEach(b=>b.onclick=()=>{document.querySelectorAll('.recap-module').forEach(x=>x.classList.toggle('active',x===b)); b.dataset.recap==='clean'?renderCleanRecap():renderWadahRecap();});
  renderWadahRecap();
}
function renderWadahRecap(){
  const panel=$('#recapPanel'); panel.innerHTML=`<div class="card"><div class="section-head"><div><h3>Rekap Wadah & Tumbler</h3><small>Pilih tanggal dan kelas.</small></div><div class="row-actions"><input id="recapDate" class="input-inline" type="date" value="${todayKey()}"><select id="recapClass" class="input-inline"><option value="">Semua kelas</option>${state.classes.map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div></div><div id="recapBody"><div class="empty">Memuat...</div></div></div>`;
  $('#recapDate').onchange=loadRecapDate; $('#recapClass').onchange=loadRecapDate; loadRecapDate();
}
async function loadRecapDate(){
  const target=$('#recapBody'); if(!target)return;
  const date=$('#recapDate').value||todayKey(), cls=$('#recapClass').value||'';
  try{
    const snap=await getDocs(query(collection(db,'records'),where('date','==',date)));
    const records=snap.docs.map(d=>({id:d.id,...d.data()})); const classes=cls?[cls]:state.classes;
    const cards=classes.map(c=>{const r=records.find(x=>x.classId===c);if(!r)return {c,status:'Belum',hadir:0,food:0,tumb:0,both:0,by:'-'};const hadir=(r.items||[]).filter(i=>i.presence==='hadir');const pct=f=>hadir.length?Math.round(hadir.filter(f).length/hadir.length*100):0;return {c,status:'Selesai',hadir:hadir.length,food:pct(i=>i.food),tumb:pct(i=>i.tumbler),both:pct(i=>i.food&&i.tumbler),by:r.lastEditedByName||r.createdByName||'Guru'};});
    target.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Kelas</th><th>Status</th><th>Hadir</th><th>Wadah</th><th>Tumbler</th><th>Keduanya</th><th>Penginput</th></tr></thead><tbody>${cards.map(x=>`<tr><td><b>${x.c}</b></td><td><span class="badge ${x.status==='Selesai'?'ok':'neutral'}">${x.status}</span></td><td>${x.hadir||'-'}</td><td>${x.food}%</td><td>${x.tumb}%</td><td><b>${x.both}%</b></td><td>${esc(x.by)}</td></tr>`).join('')}</tbody></table></div>`;
  }catch(e){console.error(e);target.innerHTML='<div class="empty">Gagal memuat rekap.</div>';}
}
function renderCleanRecap(){
  const panel=$('#recapPanel'); panel.innerHTML=`<div class="card"><div class="section-head"><div><h3>Rekap Kebersihan Kelas</h3><small>Hanya pemeriksaan yang sudah dilakukan yang ditampilkan.</small></div><div class="row-actions"><input id="cleanRecapDate" class="input-inline" type="date" value="${todayKey()}"><select id="cleanRecapClass" class="input-inline"><option value="">Semua kelas</option>${state.classes.map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div></div><div id="cleanRecapBody"><div class="empty">Memuat...</div></div></div>`; $('#cleanRecapDate').onchange=loadCleanRecap;$('#cleanRecapClass').onchange=loadCleanRecap;loadCleanRecap();
}
async function loadCleanRecap(){
  const target=$('#cleanRecapBody'); if(!target)return; const date=$('#cleanRecapDate').value||todayKey(),cls=$('#cleanRecapClass').value||'';
  try{const snap=await getDocs(query(collection(db,'cleanliness'),where('date','==',date)));let rows=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));if(cls)rows=rows.filter(r=>r.classId===cls);target.innerHTML=rows.length?`<div class="clean-list">${rows.map(cleanCard).join('')}</div>`:'<div class="empty">Belum ada pemeriksaan kebersihan pada pilihan ini.</div>';}catch(e){console.error(e);target.innerHTML='<div class="empty">Gagal memuat rekap kebersihan. Pastikan Firestore Rules v2.9.1 sudah dipublish.</div>';}
}

function account(){ pageMeta('Akun','Informasi pengguna'); const type=state.profile.role==='admin'?'Administrator':(state.profile.isHomeroom?'Wali Kelas':'Guru'); const wali=state.profile.isHomeroom&&state.profile.homeroomClass?`<p><b>Kelas Wali:</b> ${esc(state.profile.homeroomClass)}</p>`:''; content.innerHTML=`<div class="card" style="max-width:600px"><h3>${esc(state.profile.name)}</h3><p><b>ID:</b> ${esc(state.profile.loginId||'-')}</p><p><b>Peran:</b> ${type}</p>${wali}<p><b>Status:</b> ${state.profile.active!==false?'Aktif':'Nonaktif'}</p><div class="notice">Guru dan wali kelas memiliki akses pendataan yang sama. Penanda wali kelas digunakan sebagai informasi tanggung jawab kelas.</div></div>`; }

async function master(){
  if(state.profile.role!=='admin'){state.page='home';return renderShell()}
  pageMeta('Kelola Data','Khusus Administrator • v2.9.1');
  content.innerHTML='<div class="card"><div class="empty">Memuat data master...</div></div>';
  const [stuSnap,userSnap]=await Promise.all([getDocs(collection(db,'students')),getDocs(collection(db,'users'))]);
  state.students=stuSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.classId||'').localeCompare(b.classId||'')||(a.name||'').localeCompare(b.name||''));
  window.masterUsers=userSnap.docs.map(d=>({uid:d.id,...d.data()}));
  const activeStudents=state.students.filter(s=>s.active!==false);
  const teachers=window.masterUsers.filter(u=>u.role==='guru');
  const pendingTeachers=teachers.filter(u=>u.approved===false && u.rejected!==true);
  const activeTeachers=teachers.filter(u=>u.active!==false && u.approved!==false);
  const homerooms=activeTeachers.filter(u=>u.isHomeroom===true);
  content.innerHTML=`
  <div class="grid stats admin-stats">
    <div class="stat"><span>Siswa aktif</span><strong>${activeStudents.length}</strong></div>
    <div class="stat"><span>Guru aktif</span><strong>${activeTeachers.length-homerooms.length}</strong></div>
    <div class="stat"><span>Wali kelas</span><strong>${homerooms.length}</strong></div>
    <div class="stat"><span>Menunggu approve</span><strong>${pendingTeachers.length}</strong></div>
  </div>
  <div class="master-tabs" style="margin-top:16px">
    <button class="master-tab ${state.masterTab==='students'?'active':''}" data-master-tab="students">👨‍🎓 Data Siswa</button>
    <button class="master-tab ${state.masterTab==='teachers'?'active':''}" data-master-tab="teachers">👨‍🏫 Guru & Wali Kelas${pendingTeachers.length?` <span class="tab-count">${pendingTeachers.length}</span>`:''}</button>
    <button class="master-tab ${state.masterTab==='classes'?'active':''}" data-master-tab="classes">🏫 Kelas & Import</button>
    <button class="master-tab ${state.masterTab==='calendar'?'active':''}" data-master-tab="calendar">📅 Kalender Sekolah</button>
    <button class="master-tab ${state.masterTab==='audit'?'active':''}" data-master-tab="audit">🕒 Riwayat</button>
  </div>
  <div id="masterTabContent"></div>`;
  document.querySelectorAll('[data-master-tab]').forEach(b=>b.onclick=()=>{state.masterTab=b.dataset.masterTab;renderMasterTab();document.querySelectorAll('[data-master-tab]').forEach(x=>x.classList.toggle('active',x.dataset.masterTab===state.masterTab));});
  renderMasterTab();
}
function renderMasterTab(){
  const target=$('#masterTabContent'); if(!target)return;
  if(state.masterTab==='students'){
    target.innerHTML=`<div class="card master-section">
      <div class="section-head"><div><h3>Data Siswa</h3><small>Kelola siswa tanpa mencampur akun guru.</small></div><div class="row-actions"><a class="btn ghost" href="format-import-pakkom-eco-track.xlsx" download>Format Siswa</a><button id="importStudents" class="btn primary">Upload Data Siswa</button></div></div>
      <div class="notice">Format: <b>NIS | Nama | Kelas | Status</b>. Upload hanya membuka preview; data baru masuk setelah menekan <b>Import Sekarang</b>.</div>
      <div class="master-tools"><input id="studentSearch" class="input-inline" placeholder="Cari NIS atau nama siswa"><select id="studentClassFilter" class="input-inline"><option value="">Semua kelas</option>${state.classes.map(c=>`<option value="${c}">${c}</option>`).join('')}</select><button id="addStudentLocal" class="btn secondary">+ Siswa</button><button id="bulkDeleteStudents" class="btn danger" disabled>Hapus Terpilih</button></div>
      <div id="studentTable"></div></div>`;
    $('#importStudents').onclick=()=>$('#studentImport').click(); $('#addStudentLocal').onclick=addStudentLocal;
    $('#studentSearch').oninput=renderStudentMasterTable; $('#studentClassFilter').onchange=renderStudentMasterTable;
    $('#bulkDeleteStudents').onclick=deleteSelectedStudents; renderStudentMasterTable(); return;
  }
  if(state.masterTab==='teachers'){
    target.innerHTML=`<div class="card master-section"><div class="section-head"><div><h3>Akun Guru & Wali Kelas</h3><small>Akun hasil pendaftaran baru harus disetujui Admin.</small></div><div class="row-actions"><button id="importTeachers" class="btn ghost">Upload Akun Guru</button><button id="addTeacher" class="btn primary">+ Guru</button></div></div><div id="pendingApprovals"></div>
    <div class="notice">Format: <b>NIP Guru | Nama | Password Awal | Jenis | Kelas Wali | Status</b>. Jenis: Guru atau Wali Kelas.</div>
    <div class="master-tools"><input id="teacherSearch" class="input-inline" placeholder="Cari ID atau nama guru"><select id="teacherTypeFilter" class="input-inline"><option value="">Semua jenis</option><option value="guru">Guru</option><option value="wali">Wali Kelas</option></select><select id="teacherStatusFilter" class="input-inline"><option value="">Semua status</option><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option></select></div><div id="teacherTable"></div></div>`;
    $('#importTeachers').onclick=()=>$('#teacherImport').click(); $('#addTeacher').onclick=addTeacherPrompt;
    $('#teacherSearch').oninput=renderTeacherMasterTable; $('#teacherTypeFilter').onchange=renderTeacherMasterTable; $('#teacherStatusFilter').onchange=renderTeacherMasterTable;
    renderPendingApprovals(); renderTeacherMasterTable(); return;
  }
  if(state.masterTab==='classes'){
    target.innerHTML=`<div class="card master-section"><div class="section-head"><div><h3>Kelas</h3><small>Menghapus kelas juga menghapus seluruh siswa di kelas tersebut dari master.</small></div><button id="seedClasses" class="btn ghost">Buat Kelas Standar 7A–9I</button></div>
    <div class="notice warn-note"><b>Catatan:</b> Hapus kelas akan menghapus semua siswa pada kelas itu dan melepas penugasan wali kelas. Riwayat pendataan lama tetap disimpan.</div>
    <div class="grid class-grid admin-class-grid">${state.classes.map(c=>{const n=state.students.filter(s=>s.classId===c).length;return `<div class="class-manage"><div><b>${c}</b><small>${n} siswa</small></div><button class="btn-mini danger" data-delete-class="${c}">Hapus</button></div>`}).join('')||'<div class="empty">Belum ada kelas.</div>'}</div></div>
    <div class="card master-section"><div class="section-head"><div><h3>Upload Pendataan Wadah & Tumbler</h3><small>Khusus Admin • upload → preview → import.</small></div><div class="row-actions"><a class="btn ghost" href="format-upload-pendataan-wadah.xlsx" download>Format Pendataan</a><button id="importAttendance" class="btn primary">Upload Pendataan</button></div></div>
    <div class="notice">Format: <b>Tanggal | Kelas | NIS | Nama | Kehadiran | Wadah | Tumbler</b>. Nama bersifat informasi; NIS harus sudah ada di master siswa.</div></div>`;
    $('#seedClasses').onclick=seedClasses; $('#importAttendance').onclick=()=>$('#attendanceImport').click();
    document.querySelectorAll('[data-delete-class]').forEach(b=>b.onclick=()=>deleteClassMaster(b.dataset.deleteClass)); return;
  }
  if(state.masterTab==='calendar'){
    renderCalendarSettings(); return;
  }
  target.innerHTML=`<div class="card master-section"><div class="section-head"><div><h3>Riwayat Koreksi Hari Ini</h3><small>Menampilkan perubahan pada pendataan hari ini.</small></div></div><div id="auditTable"></div></div>`; renderAuditTable();
}
function renderCalendarSettings(){
  const target=$('#masterTabContent'); if(!target)return;
  const key=window.calendarEditDate||todayKey(); const info=operationalInfo(key); const ov=state.calendarSettings?.overrides?.[key]||{};
  target.innerHTML=`<div class="card master-section"><div class="section-head"><div><h3>Kalender Operasional Sekolah</h3><small>Senin–Kamis 9 JP • Jumat 5 JP • Sabtu–Minggu dan libur nasional otomatis OFF.</small></div></div>
  <div class="notice">Libur nasional dimuat otomatis dari kalender Indonesia. Admin dapat mengubah status tanggal tertentu untuk libur sekolah atau kegiatan khusus.</div>
  <div class="calendar-editor"><label>Tanggal<input id="calendarDate" type="date" value="${key}"></label><div class="calendar-current"><span>Status otomatis</span><b class="${info.active?'text-ok':'text-off'}">${info.active?'AKTIF':'OFF'}</b><small>${esc(info.label)}${info.active?` • ${info.jp} JP`:''}</small></div></div>
  <div class="calendar-options"><label>Status Override<select id="calendarActive"><option value="auto" ${ov.active===undefined?'selected':''}>Ikuti kalender otomatis</option><option value="on" ${ov.active===true?'selected':''}>Paksa Aktif</option><option value="off" ${ov.active===false?'selected':''}>Paksa Libur / OFF</option></select></label><label>Jumlah JP<input id="calendarJp" type="number" min="1" max="12" value="${ov.jp||info.jp||9}"></label><label>Keterangan<input id="calendarLabel" value="${esc(ov.label||'')}" placeholder="Contoh: Libur sekolah / Kegiatan khusus"></label></div>
  <div class="clean-actions"><button id="removeCalendarOverride" class="btn ghost" ${ov.active===undefined&&!ov.label&&!ov.jp?'disabled':''}>Hapus Override</button><button id="saveCalendarOverride" class="btn primary">Simpan Pengaturan Tanggal</button></div></div>`;
  $('#calendarDate').onchange=e=>{window.calendarEditDate=e.target.value;renderCalendarSettings();};
  $('#saveCalendarOverride').onclick=saveCalendarOverride; $('#removeCalendarOverride').onclick=removeCalendarOverride;
}
async function saveCalendarOverride(){
  const key=$('#calendarDate').value, mode=$('#calendarActive').value, label=$('#calendarLabel').value.trim(), jp=Math.max(1,Math.min(12,Number($('#calendarJp').value)||9));
  const overrides={...(state.calendarSettings?.overrides||{})};
  if(mode==='auto'&&!label){delete overrides[key]} else {overrides[key]={...(mode==='on'?{active:true}:(mode==='off'?{active:false}:{})),jp,label};}
  try{await setDoc(doc(db,'settings','calendar'),{overrides,updatedAt:new Date().toISOString(),updatedByUid:state.user.uid,updatedByName:state.profile.name},{merge:true});await refreshCore();toast('Kalender sekolah diperbarui');renderCalendarSettings();}catch(e){console.error(e);toast('Gagal menyimpan kalender sekolah');}
}
async function removeCalendarOverride(){
  const key=$('#calendarDate').value,overrides={...(state.calendarSettings?.overrides||{})};delete overrides[key];
  try{await setDoc(doc(db,'settings','calendar'),{overrides,updatedAt:new Date().toISOString(),updatedByUid:state.user.uid,updatedByName:state.profile.name},{merge:true});await refreshCore();toast('Override tanggal dihapus');renderCalendarSettings();}catch(e){console.error(e);toast('Gagal menghapus override');}
}

function filteredMasterStudents(){
  const q=String($('#studentSearch')?.value||'').trim().toLowerCase(), cls=$('#studentClassFilter')?.value||'';
  return state.students.filter(s=>(!cls||s.classId===cls)&&(!q||String(s.nis||s.id).toLowerCase().includes(q)||String(s.name||'').toLowerCase().includes(q)));
}
function renderStudentMasterTable(){
  const target=$('#studentTable'); if(!target)return;
  const rows=filteredMasterStudents(); window.selectedStudentIds=window.selectedStudentIds||new Set();
  target.innerHTML=`<div class="bulk-summary"><span><b>${window.selectedStudentIds.size}</b> siswa dipilih</span><small>Centang beberapa siswa lalu pilih Hapus Terpilih.</small></div><div class="table-wrap"><table class="student-master"><thead><tr><th class="check-col"><input id="selectAllStudents" type="checkbox" aria-label="Pilih semua"></th><th>NIS</th><th>Nama</th><th>Kelas</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows.slice(0,500).map(st=>`<tr><td class="check-col"><input class="student-check" type="checkbox" data-student-id="${esc(st.id)}" ${window.selectedStudentIds.has(st.id)?'checked':''}></td><td><b>${esc(st.nis||st.id)}</b></td><td>${esc(st.name||'-')}</td><td>${esc(st.classId||'-')}</td><td><span class="badge ${st.active===false?'warn':'ok'}">${st.active===false?'Nonaktif':'Aktif'}</span></td><td><button class="btn-mini edit" data-edit-student="${esc(st.id)}">Edit</button> <button class="btn-mini danger" data-delete-student="${esc(st.id)}">Hapus</button></td></tr>`).join('')||'<tr><td colspan="6"><div class="empty">Tidak ada siswa yang cocok.</div></td></tr>'}</tbody></table></div>${rows.length>500?`<p class="demo-note">Menampilkan 500 dari ${rows.length} siswa. Gunakan pencarian/filter kelas.</p>`:''}`;
  document.querySelectorAll('[data-edit-student]').forEach(b=>b.onclick=()=>editStudent(b.dataset.editStudent));
  document.querySelectorAll('[data-delete-student]').forEach(b=>b.onclick=()=>deleteStudentMaster(b.dataset.deleteStudent));
  document.querySelectorAll('.student-check').forEach(c=>c.onchange=()=>{c.checked?window.selectedStudentIds.add(c.dataset.studentId):window.selectedStudentIds.delete(c.dataset.studentId);updateBulkStudentButton();});
  const selectAll=$('#selectAllStudents'); if(selectAll){const visible=rows.slice(0,500);selectAll.checked=visible.length>0&&visible.every(x=>window.selectedStudentIds.has(x.id));selectAll.onchange=()=>{visible.forEach(x=>selectAll.checked?window.selectedStudentIds.add(x.id):window.selectedStudentIds.delete(x.id));renderStudentMasterTable();};}
  updateBulkStudentButton();
}
function updateBulkStudentButton(){const b=$('#bulkDeleteStudents');if(b){const n=window.selectedStudentIds?.size||0;b.disabled=!n;b.textContent=n?`Hapus Terpilih (${n})`:'Hapus Terpilih';}}
async function deleteSelectedStudents(){
  const ids=[...(window.selectedStudentIds||[])]; if(!ids.length)return;
  const sample=ids.slice(0,3).map(id=>state.students.find(s=>s.id===id)?.name||id).join(', ');
  if(!confirm(`Hapus ${ids.length} siswa dari master?${sample?`\nContoh: ${sample}${ids.length>3?', ...':''}`:''}\nRiwayat pendataan lama tetap tersimpan.`))return;
  try{for(let i=0;i<ids.length;i+=400){const batch=writeBatch(db);ids.slice(i,i+400).forEach(id=>batch.delete(doc(db,'students',id)));await batch.commit();}window.selectedStudentIds=new Set();toast(`${ids.length} siswa berhasil dihapus`);await master();}catch(e){console.error(e);toast('Gagal menghapus beberapa siswa');}
}

function renderTeacherMasterTable(){
  const target=$('#teacherTable'); if(!target)return;
  const q=String($('#teacherSearch')?.value||'').trim().toLowerCase(), type=$('#teacherTypeFilter')?.value||'', status=$('#teacherStatusFilter')?.value||'';
  const rows=(window.masterUsers||[]).filter(u=>u.role==='guru'&&u.approved!==false).filter(u=>(!q||String(u.loginId||'').toLowerCase().includes(q)||String(u.name||'').toLowerCase().includes(q))&&(!type||(type==='wali'?u.isHomeroom===true:u.isHomeroom!==true))&&(!status||(status==='aktif'?u.active!==false:u.active===false))).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  target.innerHTML=`<div class="table-wrap"><table class="student-master"><thead><tr><th>NIP Guru</th><th>Nama</th><th>Jenis</th><th>Kelas Wali</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows.map(u=>`<tr><td><b>${esc(u.loginId||'-')}</b></td><td>${esc(u.name||'-')}</td><td><span class="badge ${u.isHomeroom?'ok':'neutral'}">${u.isHomeroom?'Wali Kelas':'Guru'}</span></td><td>${u.isHomeroom?esc(u.homeroomClass||'-'):'-'}</td><td><span class="badge ${u.active===false?'warn':'ok'}">${u.active===false?'Nonaktif':'Aktif'}</span></td><td><button class="btn-mini edit" data-edit-teacher="${esc(u.uid)}">Edit</button></td></tr>`).join('')||'<tr><td colspan="6"><div class="empty">Belum ada akun guru.</div></td></tr>'}</tbody></table></div>`;
  document.querySelectorAll('[data-edit-teacher]').forEach(b=>b.onclick=()=>editTeacherProfile(b.dataset.editTeacher));
}

function renderPendingApprovals(){
  const target=$('#pendingApprovals'); if(!target)return;
  const rows=(window.masterUsers||[]).filter(u=>u.role==='guru'&&u.approved===false&&u.rejected!==true);
  if(!rows.length){target.innerHTML='';return;}
  target.innerHTML=`<div class="approval-box"><div class="section-head"><div><h4 style="margin:0">Menunggu Persetujuan (${rows.length})</h4><small>Periksa jenis guru dan kelas wali sebelum menyetujui.</small></div></div><div class="table-wrap"><table><thead><tr><th>ID</th><th>Nama</th><th>Daftar Sebagai</th><th>Kelas Wali</th><th>Aksi</th></tr></thead><tbody>${rows.map(u=>`<tr><td><b>${esc(u.loginId||'-')}</b></td><td>${esc(u.name||'-')}</td><td>${u.requestedType==='wali'?'Wali Kelas':'Guru'}</td><td>${u.requestedType==='wali'?esc(u.requestedHomeroomClass||'-'):'-'}</td><td><button class="btn-mini edit" data-approve-teacher="${u.uid}">Approve</button> <button class="btn-mini danger" data-reject-teacher="${u.uid}">Tolak</button></td></tr>`).join('')}</tbody></table></div></div>`;
  document.querySelectorAll('[data-approve-teacher]').forEach(b=>b.onclick=()=>approveTeacher(b.dataset.approveTeacher));
  document.querySelectorAll('[data-reject-teacher]').forEach(b=>b.onclick=()=>rejectTeacher(b.dataset.rejectTeacher));
}
async function approveTeacher(uid){
  const u=(window.masterUsers||[]).find(x=>x.uid===uid); if(!u)return;
  const isHomeroom=u.requestedType==='wali', homeroomClass=isHomeroom?(u.requestedHomeroomClass||''):'';
  if(isHomeroom&&!state.classes.includes(homeroomClass))return toast(`Kelas ${homeroomClass||'-'} belum tersedia. Buat kelas terlebih dahulu.`);
  if(isHomeroom){const clash=(window.masterUsers||[]).find(x=>x.uid!==uid&&x.role==='guru'&&x.active!==false&&x.approved!==false&&x.isHomeroom===true&&x.homeroomClass===homeroomClass);if(clash)return toast(`${homeroomClass} sudah memiliki wali kelas: ${clash.name}`);}
  await setDoc(doc(db,'users',uid),{approved:true,active:true,rejected:false,isHomeroom,homeroomClass,approvedAt:new Date().toISOString(),approvedByUid:state.user.uid,approvedByName:state.profile.name},{merge:true});
  toast(`Akun ${u.loginId} disetujui`); await master();
}
async function rejectTeacher(uid){
  const u=(window.masterUsers||[]).find(x=>x.uid===uid); if(!u)return;
  if(!confirm(`Tolak pendaftaran ${u.loginId} - ${u.name}?`))return;
  await setDoc(doc(db,'users',uid),{approved:false,active:false,rejected:true,rejectedAt:new Date().toISOString(),rejectedByUid:state.user.uid,rejectedByName:state.profile.name},{merge:true});
  toast('Pendaftaran ditolak'); await master();
}
async function deleteStudentMaster(id){
  const st=state.students.find(x=>x.id===id); if(!st)return;
  if(!confirm(`Hapus siswa ${st.name} (${st.nis||st.id}) dari master? Riwayat pendataan lama tetap tersimpan.`))return;
  try{await deleteDoc(doc(db,'students',id));toast('Siswa dihapus dari master');await master();}catch(e){console.error(e);toast('Gagal menghapus siswa');}
}
async function deleteClassMaster(classId){
  const studentsInClass=state.students.filter(s=>s.classId===classId);
  const homerooms=(window.masterUsers||[]).filter(u=>u.role==='guru'&&u.isHomeroom===true&&u.homeroomClass===classId);
  if(!confirm(`Hapus kelas ${classId}?\n\n${studentsInClass.length} siswa di kelas ini akan ikut dihapus dari master.${homerooms.length?`\n${homerooms.length} wali kelas akan diubah menjadi Guru biasa.`:''}\n\nRiwayat pendataan lama tetap tersimpan.`))return;
  try{
    for(let i=0;i<studentsInClass.length;i+=350){const batch=writeBatch(db);studentsInClass.slice(i,i+350).forEach(st=>batch.delete(doc(db,'students',st.id)));await batch.commit();}
    for(let i=0;i<homerooms.length;i+=350){const batch=writeBatch(db);homerooms.slice(i,i+350).forEach(u=>batch.set(doc(db,'users',u.uid),{isHomeroom:false,homeroomClass:'',updatedAt:new Date().toISOString()},{merge:true}));await batch.commit();}
    await deleteDoc(doc(db,'classes',classId)); await refreshCore(); toast(`Kelas ${classId} dan ${studentsInClass.length} siswa berhasil dihapus`); await master();
  }catch(e){console.error(e);toast('Gagal menghapus kelas dan siswa');}
}

async function editTeacherProfile(uid){
  const u=(window.masterUsers||[]).find(x=>x.uid===uid); if(!u)return;
  openEditModal('Edit Guru',`
    <label>Nama<input id="mName" value="${esc(u.name||'')}"></label>
    <label>Jenis<select id="mType"><option value="guru" ${u.isHomeroom?'':'selected'}>Guru</option><option value="wali" ${u.isHomeroom?'selected':''}>Wali Kelas</option></select></label>
    <label>Kelas Wali<select id="mClass"><option value="">-</option>${state.classes.map(c=>`<option value="${c}" ${u.homeroomClass===c?'selected':''}>${c}</option>`).join('')}</select></label>
    <label>Status<select id="mActive"><option value="true" ${u.active!==false?'selected':''}>Aktif</option><option value="false" ${u.active===false?'selected':''}>Nonaktif</option></select></label>`,async()=>{
      const name=$('#mName').value.trim(), isHomeroom=$('#mType').value==='wali', homeroomClass=$('#mClass').value, active=$('#mActive').value==='true';
      if(!name)return toast('Nama guru wajib diisi'); if(isHomeroom&&!homeroomClass)return toast('Kelas wali wajib dipilih');
      if(isHomeroom){const clash=(window.masterUsers||[]).find(x=>x.uid!==uid&&x.role==='guru'&&x.active!==false&&x.isHomeroom===true&&x.homeroomClass===homeroomClass);if(clash)return toast(`${homeroomClass} sudah memiliki wali kelas: ${clash.name}`);}
      await setDoc(doc(db,'users',uid),{name,role:'guru',isHomeroom,homeroomClass:isHomeroom?homeroomClass:'',active,updatedAt:new Date().toISOString()},{merge:true}); closeEditModal(); toast('Data guru diperbarui'); await master();
    });
}

async function ensureClassesFromStudents(){
  const snap=await getDocs(collection(db,'students'));
  const ids=[...new Set(snap.docs.map(d=>String(d.data().classId||'').trim().toUpperCase()).filter(Boolean))];
  const existing=await getDocs(collection(db,'classes')); const have=new Set(existing.docs.map(d=>d.id));
  const missing=ids.filter(id=>!have.has(id)); if(!missing.length)return 0;
  for(let start=0;start<missing.length;start+=400){const batch=writeBatch(db);missing.slice(start,start+400).forEach(c=>batch.set(doc(db,'classes',c),{name:c,grade:Number(String(c).match(/^\d+/)?.[0]||0),active:true,createdAt:new Date().toISOString()},{merge:true}));await batch.commit();}
  await refreshCore(); return missing.length;
}

async function editStudent(id){
  const st=state.students.find(x=>x.id===id); if(!st)return;
  openEditModal('Edit Siswa',`<label>NIS<input value="${esc(st.nis||st.id)}" disabled></label><label>Nama<input id="mName" value="${esc(st.name||'')}"></label><label>Kelas<select id="mClass">${state.classes.map(c=>`<option value="${c}" ${st.classId===c?'selected':''}>${c}</option>`).join('')}</select></label><label>Status<select id="mActive"><option value="true" ${st.active!==false?'selected':''}>Aktif</option><option value="false" ${st.active===false?'selected':''}>Nonaktif</option></select></label>`,async()=>{
    const name=$('#mName').value.trim(), classId=$('#mClass').value, active=$('#mActive').value==='true'; if(!name||!classId)return toast('Nama dan kelas wajib diisi');
    await setDoc(doc(db,'students',id),{name,classId,active,updatedAt:new Date().toISOString(),updatedByUid:state.user.uid,updatedByName:state.profile.name},{merge:true}); closeEditModal(); toast('Data siswa diperbarui'); await master();
  });
}

async function addStudentLocal(){
  const nis=prompt('NIS siswa:'); if(!nis)return;
  const name=prompt('Nama siswa:'); if(!name)return;
  const classId=prompt('Kelas (contoh 7A):'); if(!classId)return;
  const key=nis.trim(); if(state.students.some(s=>String(s.nis||s.id).trim()===key))return toast('NIS sudah ada');
  try{await setDoc(doc(db,'students',key),{nis:key,name:name.trim(),classId:classId.trim().toUpperCase(),active:true,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()},{merge:false});await ensureClassesFromStudents();toast('Siswa berhasil ditambahkan');await master();}catch(e){console.error(e);toast('Gagal menambah siswa');}
}

$('#studentImport').addEventListener('change',async e=>{
  const f=e.target.files?.[0]; if(!f)return;
  try{
    const buf=await f.arrayBuffer(), wb=XLSX.read(buf), sheet=wb.Sheets['Siswa']||wb.Sheets[wb.SheetNames[0]], rows=XLSX.utils.sheet_to_json(sheet,{defval:''});
    let skipped=0;
    const normalized=rows.map(r=>({nis:String(r.NIS||r.nis||r['Nomor Induk']||'').trim(),name:String(r.Nama||r.nama||r['Nama Siswa']||'').trim(),classId:String(r.Kelas||r.kelas||r.KELAS||'').trim().toUpperCase(),active:!['nonaktif','tidak aktif','0','false'].includes(String(r.Status||r.status||'Aktif').trim().toLowerCase())})).filter(r=>{const ok=r.nis&&r.name&&r.classId;if(!ok)skipped++;return ok;});
    if(!normalized.length)throw new Error('Tidak ada data siswa valid');
    window.pendingStudentImport=normalized;
    openImportPreview('Preview Import Siswa',normalized.map(x=>[x.nis,x.name,x.classId,x.active?'Aktif':'Nonaktif']),['NIS','Nama','Kelas','Status'],skipped,async()=>{
      const data=window.pendingStudentImport||[];
      for(let start=0;start<data.length;start+=400){const batch=writeBatch(db);data.slice(start,start+400).forEach(st=>batch.set(doc(db,'students',st.nis),{...st,updatedAt:new Date().toISOString()},{merge:true}));await batch.commit();}
      await ensureClassesFromStudents(); closeEditModal(); toast(`Import siswa selesai: ${data.length} data`,6500); e.target.value=''; window.pendingStudentImport=null; await master();
    });
  }catch(err){console.error(err);toast(err.message||'Upload gagal. Gunakan format siswa yang benar.');e.target.value='';}
});

function normalizeImportDate(v){
  if(v instanceof Date&&!isNaN(v))return v.toLocaleDateString('en-CA');
  if(typeof v==='number'){const d=XLSX.SSF.parse_date_code(v);if(d)return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;}
  const t=String(v||'').trim(); if(/^\d{4}-\d{2}-\d{2}$/.test(t))return t;
  const m=t.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return '';
}
function boolImport(v){return ['ya','y','1','true','bawa','membawa','yes','✓'].includes(String(v||'').trim().toLowerCase());}
function presenceImport(v){const x=String(v||'hadir').trim().toLowerCase();return ['izin','sakit','alpa'].includes(x)?x:'hadir';}
$('#attendanceImport').addEventListener('change',async e=>{
  const f=e.target.files?.[0]; if(!f)return;
  try{
    const buf=await f.arrayBuffer(), wb=XLSX.read(buf), sheet=wb.Sheets['Pendataan Wadah']||wb.Sheets[wb.SheetNames[0]], rows=XLSX.utils.sheet_to_json(sheet,{defval:''});
    const studentMap=new Map(state.students.map(st=>[String(st.nis||st.id).trim(),st])); let skipped=0;
    const normalized=rows.map(r=>{const date=normalizeImportDate(r.Tanggal||r.tanggal||r.Date),classId=String(r.Kelas||r.kelas||'').trim().toUpperCase(),nis=String(r.NIS||r.nis||'').trim(),st=studentMap.get(nis),presence=presenceImport(r.Kehadiran||r.kehadiran);return {date,classId,nis,name:st?.name||String(r.Nama||r.nama||'').trim(),studentId:st?.id||'',presence,food:presence==='hadir'&&boolImport(r.Wadah||r.wadah),tumbler:presence==='hadir'&&boolImport(r.Tumbler||r.tumbler),valid:!!(date&&classId&&nis&&st&&st.classId===classId)};}).filter(r=>{if(!r.valid){skipped++;return false}return true;});
    if(!normalized.length)throw new Error('Tidak ada baris pendataan valid. Pastikan Tanggal, Kelas dan NIS sesuai master siswa.');
    window.pendingAttendanceImport=normalized;
    openImportPreview('Preview Upload Pendataan Wadah & Tumbler',normalized.map(x=>[x.date,x.classId,x.nis,x.name,x.presence,x.food?'Ya':'Tidak',x.tumbler?'Ya':'Tidak']),['Tanggal','Kelas','NIS','Nama','Kehadiran','Wadah','Tumbler'],skipped,()=>commitAttendanceImport(e));
  }catch(err){console.error(err);toast(err.message||'Upload pendataan gagal.');e.target.value='';}
});
async function commitAttendanceImport(e){
  const data=window.pendingAttendanceImport||[]; const groups=new Map();
  data.forEach(r=>{const k=`${r.date}_${r.classId}`;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);});
  let saved=0;
  for(const [id,rows] of groups){
    const oldSnap=await getDoc(doc(db,'records',id)), old=oldSnap.exists()?oldSnap.data():null, oldMap=new Map((old?.items||[]).map(i=>[String(i.studentId||i.nis),i]));
    rows.forEach(r=>oldMap.set(String(r.studentId),{studentId:r.studentId,nis:r.nis,name:r.name,presence:r.presence,food:r.food,tumbler:r.tumbler}));
    const now=new Date(), [date,...classParts]=id.split('_'), classId=classParts.join('_');
    const payload={date,classId,items:[...oldMap.values()],createdByUid:old?.createdByUid||state.user.uid,createdByName:old?.createdByName||state.profile.name,createdAt:old?.createdAt||now.toISOString(),lastEditedByUid:state.user.uid,lastEditedByName:state.profile.name,lastEditedAt:now.toISOString(),timeLabel:now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}),audit:[...(old?.audit||[]),...(old?[{editedAt:now.toISOString(),editedByUid:state.user.uid,editedByName:`${state.profile.name} (Upload Admin)`}]:[])]};
    await setDoc(doc(db,'records',id),payload,{merge:false}); saved++;
  }
  closeEditModal(); window.pendingAttendanceImport=null; e.target.value=''; await refreshCore(); toast(`Upload pendataan selesai: ${data.length} siswa pada ${saved} kelas/tanggal`,7000); state.masterTab='classes'; await master();
}
$('#teacherImport').addEventListener('change',async e=>{
  const f=e.target.files?.[0]; if(!f)return;
  try{
    const buf=await f.arrayBuffer(), wb=XLSX.read(buf), sheet=wb.Sheets['Guru']||wb.Sheets[wb.SheetNames[0]], rows=XLSX.utils.sheet_to_json(sheet,{defval:''});
    let skipped=0;
    const normalized=rows.map(r=>{const loginId=String(r['NIP Guru']||r.ID||r.loginId||'').trim().toUpperCase(),name=String(r.Nama||r.nama||'').trim(),password=String(r['Password Awal']||r.Password||r.password||'123456').trim()||'123456',jenis=String(r.Jenis||r.jenis||'Guru').trim().toLowerCase(),homeroomClass=String(r['Kelas Wali']||r.KelasWali||r.homeroomClass||'').trim().toUpperCase(),active=!['nonaktif','tidak aktif','0','false'].includes(String(r.Status||r.status||'Aktif').trim().toLowerCase());return {loginId,name,password,isHomeroom:jenis.includes('wali'),homeroomClass,active};}).filter(r=>{const ok=r.loginId&&r.name&&r.loginId!=='ADMIN'&&r.password.length>=6&&(!r.isHomeroom||r.homeroomClass);if(!ok)skipped++;return ok;});
    if(!normalized.length)throw new Error('Tidak ada akun guru valid');
    window.pendingTeacherImport=normalized;
    openImportPreview('Preview Import Akun Guru',normalized.map(x=>[x.loginId,x.name,x.isHomeroom?'Wali Kelas':'Guru',x.isHomeroom?x.homeroomClass:'-',x.active?'Aktif':'Nonaktif']),['NIP Guru','Nama','Jenis','Kelas Wali','Status'],skipped,()=>commitTeacherImport(e));
  }catch(err){console.error(err);toast(err.message||'Upload akun guru gagal.');e.target.value='';}
});
async function commitTeacherImport(e){
  const normalized=window.pendingTeacherImport||[];
  const existingSnap=await getDocs(collection(db,'users')), existingById=new Map(existingSnap.docs.map(d=>[String(d.data().loginId||'').toUpperCase(),{uid:d.id,...d.data()}]));
  let created=0,updated=0,failed=0;
  for(const t of normalized){
    if(t.isHomeroom){const clash=(window.masterUsers||[]).find(x=>x.role==='guru'&&x.active!==false&&x.approved!==false&&x.isHomeroom===true&&x.homeroomClass===t.homeroomClass&&String(x.loginId||'').toUpperCase()!==t.loginId);if(clash){failed++;continue;}}
    const existing=existingById.get(t.loginId);
    if(existing){await setDoc(doc(db,'users',existing.uid),{name:t.name,role:'guru',approved:true,active:t.active,rejected:false,isHomeroom:t.isHomeroom,homeroomClass:t.isHomeroom?t.homeroomClass:'',updatedAt:new Date().toISOString()},{merge:true});updated++;continue;}
    let secondary=null;
    try{secondary=initializeApp(cfg,`teacher-import-${Date.now()}-${Math.random()}`);const secondaryAuth=getAuth(secondary);const cred=await createUserWithEmailAndPassword(secondaryAuth,loginEmail(t.loginId),t.password);await setDoc(doc(db,'users',cred.user.uid),{loginId:t.loginId,name:t.name,role:'guru',approved:true,active:t.active,rejected:false,isHomeroom:t.isHomeroom,homeroomClass:t.isHomeroom?t.homeroomClass:'',createdAt:new Date().toISOString()});await signOut(secondaryAuth);created++;}catch(err){console.error('Gagal import guru',t.loginId,err);failed++;}finally{if(secondary)await deleteApp(secondary).catch(()=>{});}
  }
  closeEditModal(); window.pendingTeacherImport=null; e.target.value=''; toast(`Import guru selesai: ${created} baru, ${updated} diperbarui${failed?`, ${failed} gagal/dilewati`:''}`,7000); await master();
}
function openImportPreview(title,rows,headers,skipped,onConfirm){
  const preview=rows.slice(0,20), more=rows.length-preview.length;
  openEditModal(title,`<div class="notice"><b>${rows.length}</b> data siap diimport${skipped?` • <b>${skipped}</b> baris dilewati`:''}. Data belum masuk Firestore sampai Anda menekan tombol Import.</div><div class="table-wrap import-preview"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${preview.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${more?`<p class="demo-note">Menampilkan 20 data pertama dari ${rows.length}.</p>`:''}`,onConfirm);
  $('#editModalSave').textContent='Import Sekarang';
}

function openEditModal(title,body,onSave){ const modal=$('#editModal'); $('#editModalTitle').textContent=title; $('#editModalBody').innerHTML=body; modal.classList.remove('hidden'); $('#editModalSave').onclick=()=>Promise.resolve(onSave()).catch(e=>{console.error(e);toast('Gagal menyimpan perubahan')}); }
function closeEditModal(){ $('#editModal').classList.add('hidden'); $('#editModalBody').innerHTML=''; $('#editModalSave').textContent='Simpan'; $('#studentImport').value=''; $('#teacherImport').value=''; $('#attendanceImport').value=''; window.pendingStudentImport=null; window.pendingTeacherImport=null; window.pendingAttendanceImport=null; }
$('#editModalCancel').onclick=closeEditModal; $('#editModalClose').onclick=closeEditModal;
function renderAuditTable(){ const target=$('#auditTable'); if(!target)return; const rows=state.recordsToday.flatMap(r=>(r.audit||[]).map(a=>({classId:r.classId,...a}))).sort((a,b)=>String(b.editedAt||'').localeCompare(String(a.editedAt||''))); target.innerHTML=rows.length?`<div class="table-wrap"><table><thead><tr><th>Kelas</th><th>Dikoreksi oleh</th><th>Waktu</th></tr></thead><tbody>${rows.map(a=>`<tr><td><b>${esc(a.classId)}</b></td><td>${esc(a.editedByName||'-')}</td><td>${a.editedAt?new Date(a.editedAt).toLocaleString('id-ID'):'-'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Belum ada koreksi hari ini.</div>'; }

async function ensureDefaultClasses(){
  try{
    const snap=await getDocs(collection(db,'classes'));
    const existing=new Set(snap.docs.map(d=>d.id));
    const missing=classesDefault.filter(c=>!existing.has(c));
    if(!missing.length)return 0;
    const batch=writeBatch(db);
    missing.forEach(c=>batch.set(doc(db,'classes',c),{name:c,grade:Number(c[0]),active:true,createdAt:new Date().toISOString()},{merge:true}));
    await batch.commit();
    return missing.length;
  }catch(e){
    console.error('Gagal membuat kelas otomatis',e);
    return 0;
  }
}

async function seedClasses(){
  try{
    const count=await ensureDefaultClasses();
    await refreshCore();
    toast(count?`${count} kelas berhasil dibuat otomatis`:'Semua kelas 7A–9I sudah tersedia');
    master();
  }catch(e){console.error(e);toast('Gagal menyinkronkan kelas')}
}
async function addTeacherPrompt(){
  const loginId=prompt('NIP Guru (contoh G001):'); if(!loginId)return;
  const name=prompt('Nama Guru:'); if(!name)return;
  const isHomeroom=confirm('Apakah guru ini WALI KELAS? Klik OK untuk Wali Kelas, Batal untuk Guru.');
  let homeroomClass='';
  if(isHomeroom){homeroomClass=(prompt('Kelas wali (contoh 7A):')||'').trim().toUpperCase();if(!homeroomClass)return toast('Kelas wali wajib diisi'); const clash=(window.masterUsers||[]).find(x=>x.role==='guru'&&x.active!==false&&x.isHomeroom===true&&x.homeroomClass===homeroomClass);if(clash)return toast(`${homeroomClass} sudah memiliki wali kelas: ${clash.name}`);}
  const password=prompt('Password awal (minimal 6 karakter):','123456'); if(!password||password.length<6)return toast('Password minimal 6 karakter');
  let secondary=null;
  try{
    secondary=initializeApp(cfg,`teacher-${Date.now()}`); const secondaryAuth=getAuth(secondary);
    const cred=await createUserWithEmailAndPassword(secondaryAuth,loginEmail(loginId),password);
    await setDoc(doc(db,'users',cred.user.uid),{loginId:loginId.trim().toUpperCase(),name:name.trim(),role:'guru',approved:true,active:true,rejected:false,isHomeroom,homeroomClass:isHomeroom?homeroomClass:'',createdAt:new Date().toISOString()});
    await signOut(secondaryAuth); toast(`Akun ${loginId.toUpperCase()} berhasil dibuat`); master();
  }catch(e){console.error(e);toast(e.code==='auth/email-already-in-use'?'NIP Guru sudah digunakan':'Gagal membuat akun guru');}
  finally{if(secondary)await deleteApp(secondary).catch(()=>{})}
}



window.startPakKomApp = async function(core){
  try{
    console.log('PakKom Application Core v3.3.5 starting');
    app=core.app;
    auth=core.auth;
    db=core.db;
    state.user=core.user;
    state.profile=core.profile;
    authResolved=true;

    renderShell();
    await loadCoreDataInBackground();
  }catch(e){
    console.error('APP CORE START ERROR',e);
    const content=document.querySelector('#content');
    if(content){
      content.innerHTML='<div class="card"><h3>Aplikasi belum dapat dimuat</h3><p>'+esc(e.message||'Terjadi kesalahan pada Application Core.')+'</p><button class="btn primary" onclick="location.reload()">Muat Ulang</button></div>';
    }
  }
};

})();



(function(){
  'use strict';

  var cfg = window.PAKKOM_FIREBASE_CONFIG || {};
  var ADMIN_EMAIL = 'komarudingalasta@gmail.com';

  function qs(sel){ return document.querySelector(sel); }
  function showError(message){
    var el=qs('#loginError');
    if(!el) return;
    el.textContent=message||'';
    if(message) el.classList.remove('hidden');
    else el.classList.add('hidden');
  }
  function loginEmail(id){
    var normalized=String(id||'').trim().toUpperCase();
    if(normalized==='ADMIN') return ADMIN_EMAIL;
    return normalized.toLowerCase().replace(/[^a-z0-9._-]/g,'')+'@pakkom-ecotrack.app';
  }
  function authMessage(err){
    var code=err && err.code ? err.code : '';
    var map={
      'auth/invalid-credential':'NIP Guru/ADMIN atau password salah.',
      'auth/wrong-password':'Password salah.',
      'auth/user-not-found':'Akun tidak ditemukan.',
      'auth/user-disabled':'Akun dinonaktifkan.',
      'auth/operation-not-allowed':'Login Email/Password belum diaktifkan di Firebase.',
      'auth/network-request-failed':'Koneksi ke Firebase gagal.',
      'auth/too-many-requests':'Terlalu banyak percobaan login. Coba lagi beberapa saat.'
    };
    return map[code] || (err && err.message) || 'Login gagal.';
  }

  if(!window.firebase){
    showError('Firebase SDK gagal dimuat.');
    return;
  }

  try{
    if(!firebase.apps.length) firebase.initializeApp(cfg);
  }catch(e){
    console.error(e);
    showError('Firebase gagal diinisialisasi.');
    return;
  }

  var auth=firebase.auth();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(){});
  var db=firebase.firestore();

  window.PAKKOM_COMPAT_CORE={
    auth:auth,
    db:db,
    user:null,
    profile:null,
    logout:function(){
      return auth.signOut().finally(function(){ location.reload(); });
    }
  };

  var form=qs('#loginForm');
  var btn=qs('#loginBtn');

  if(!form) return;

  form.addEventListener('submit',function(ev){
    ev.preventDefault();
    var id=String(qs('#loginId').value||'').trim();
    var password=String(qs('#loginPassword').value||'');
    if(!id || !password){
      showError('ID dan password wajib diisi.');
      return;
    }

    showError('');
    btn.disabled=true;
    btn.textContent='MEMERIKSA...';

    auth.signOut().catch(function(){})
      .then(function(){
        return auth.signInWithEmailAndPassword(loginEmail(id),password);
      })
      .then(function(cred){
        if(id.toUpperCase()==='ADMIN' &&
           String(cred.user.email||'').toLowerCase()!==ADMIN_EMAIL.toLowerCase()){
          throw new Error('Akun ADMIN tidak sesuai konfigurasi.');
        }
        return db.collection('users').doc(cred.user.uid).get()
          .then(function(snap){
            if(!snap.exists) throw new Error('Profil Admin/Guru tidak ditemukan di Firestore.');
            var profile=Object.assign({uid:cred.user.uid},snap.data());
            if(profile.rejected===true) throw new Error('Pendaftaran akun tidak disetujui Admin.');
            if(profile.approved===false && profile.role==='guru') throw new Error('Akun masih menunggu persetujuan Admin.');
            if(profile.active===false) throw new Error('Akun dinonaktifkan administrator.');
            if(profile.role!=='admin' && profile.role!=='guru') throw new Error('Role akun tidak dikenali.');

            window.PAKKOM_COMPAT_CORE.user=cred.user;
            window.PAKKOM_COMPAT_CORE.profile=profile;

            qs('#loginView').classList.add('hidden');
            qs('#appView').classList.remove('hidden');

            // Application Core sudah dimuat sejak halaman dibuka.
            if(typeof window.startPakKomApp !== 'function'){
              throw new Error('Application Core tidak tersedia. Pastikan app-core.js sudah terunggah.');
            }
            return window.startPakKomApp(window.PAKKOM_COMPAT_CORE);
          });
      })
      .catch(function(err){
        console.error('LOGIN ERROR',err);
        auth.signOut().catch(function(){});
        qs('#loginView').classList.remove('hidden');
        qs('#appView').classList.add('hidden');
        showError(authMessage(err));
      })
      .finally(function(){
        btn.disabled=false;
        btn.textContent='MASUK';
      });
  });
})();

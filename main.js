/* PakKom Eco Track v4.6 — Stable Admin Student Activation
   Student Auth provisioning via Firebase REST; does not change Admin session.

   Legacy: PakKom Eco Track v3.3.6 — Unified Core
   Application Core + Authentication Core dalam satu file klasik.
*/

/* PakKom Eco Track v3.3.6 — Compat Application Core
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
function limit(n){ return {kind:'limit',n:Number(n)}; }
function query(ref){
  const clauses=Array.prototype.slice.call(arguments,1);
  let q=ref;
  clauses.forEach(c=>{
    if(!c) return;
    if(c.kind==='where') q=q.where(c.field,c.op,c.value);
    if(c.kind==='orderBy') q=q.orderBy(c.field,c.direction);
    if(c.kind==='limit') q=q.limit(c.n);
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
function onSnapshot(ref,next,error){
  return ref.onSnapshot(snap=>{
    if(snap && Array.isArray(snap.docs)) next(wrapQuerySnapshot(snap));
    else next(wrapDocSnapshot(snap));
  },error);
}
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
let state = { user:null, profile:null, page:'home', selectedClass:null, classes:[], classDocs:[], recordsToday:[], students:[], cleanlinessToday:[], masterTab:'students', holidays:{}, calendarSettings:{overrides:{}}, accessSettings:{homeroomCleanlinessEnabled:false}, operationalSettings:null, chatUnread:0, chatGroup:null, chatUnsub:null, chatReactionUnsub:null, chatNotifyTimer:null, chatUnreadInitialized:false };

const APP_VERSION='5.1.2';
function withTimeout(promise, ms=5000, label='Proses'){
  return Promise.race([
    promise,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label} terlalu lama.`)),ms))
  ]);
}
function resetCoreState(){
  state.classDocs=[]; state.classes=[]; state.recordsToday=[]; state.cleanlinessToday=[];
  state.students=[]; state.calendarSettings={overrides:{}}; state.accessSettings={homeroomCleanlinessEnabled:false}; state.operationalSettings=null; state.chatUnread=0; state.chatUnreadInitialized=false; if(state.chatUnsub){state.chatUnsub();state.chatUnsub=null;} if(state.chatReactionUnsub){state.chatReactionUnsub();state.chatReactionUnsub=null;} if(state.chatNotifyTimer){clearInterval(state.chatNotifyTimer);state.chatNotifyTimer=null;}
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
const ICON_WADAH_MAKAN=`<svg class="eco-icon eco-icon-food" viewBox="0 0 48 48" aria-hidden="true"><path fill="#A7E3D0" d="M8 19h32l-2.2 19H10.2L8 19Z"/><path fill="#DDF6ED" d="M10 15.5c0-3 2.4-5.5 5.5-5.5h17c3 0 5.5 2.4 5.5 5.5V19H10v-3.5Z"/><path fill="none" stroke="#176B5B" stroke-width="2.6" stroke-linejoin="round" d="M8 19h32l-2.2 19H10.2L8 19Zm2-3.5c0-3 2.4-5.5 5.5-5.5h17c3 0 5.5 2.4 5.5 5.5V19H10v-3.5Z"/><rect x="20" y="17" width="8" height="7" rx="2" fill="#5BC5A7" stroke="#176B5B" stroke-width="2.2"/></svg>`;
const ICON_TUMBLER=`<svg class="eco-icon eco-icon-bottle" viewBox="0 0 48 48" aria-hidden="true"><path fill="#B9E7F5" d="M17 15h14c2.2 3 3 5.4 3 8v17c0 2.2-1.8 4-4 4H18c-2.2 0-4-1.8-4-4V23c0-2.6.8-5 3-8Z"/><path fill="#58B8D6" d="M18 8h12v8H18z"/><path fill="none" stroke="#175B72" stroke-width="2.6" stroke-linejoin="round" d="M18 8h12v7H18zM17 15h14c2.2 3 3 5.4 3 8v17c0 2.2-1.8 4-4 4H18c-2.2 0-4-1.8-4-4V23c0-2.6.8-5 3-8Z"/><path fill="none" stroke="#175B72" stroke-width="2.4" stroke-linecap="round" d="M31 12h3c2 0 3.5 1.5 3.5 3.5S36 19 34 19h-1"/></svg>`;

function esc(v=''){ return String(v).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m])); }
function pageMeta(title,sub=''){ $('#pageTitle').textContent=title; $('#pageSubtitle').textContent=sub; }
function navItems(){
  if(state.profile?.role==='siswa') return [
    ['studenthome','<span class="nav-icon">⌂</span><span class="nav-label">Beranda</span>'],
    ['studenttasks','<span class="nav-icon">▣</span><span class="nav-label">Tugas</span>'],
    ['studentaccount','<span class="nav-icon">👤</span><span class="nav-label">Saya</span>']
  ];
  const badge=state.chatUnread>0?`<span class="nav-unread">${state.chatUnread>99?'99+':state.chatUnread}</span>`:'';
  const items=[
    ['home','<span class="nav-icon">⌂</span><span class="nav-label">Beranda</span>'],
    ['input','<span class="nav-icon">▣</span><span class="nav-label">Wadah</span>'],
    ['clean','<span class="nav-icon">✦</span><span class="nav-label">Kebersihan</span>']
  ];
  if(state.profile?.role==='admin' || state.profile?.isHomeroom===true){
    items.push(['tasks','<span class="nav-icon">📝</span><span class="nav-label">Tugas</span>']);
  }
  items.push(
    ['chat',`<span class="nav-icon">💬</span><span class="nav-label">EcoChat</span>${badge}`],
    ['more','<span class="nav-icon">☰</span><span class="nav-label">Lainnya</span>']
  );
  return items;
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
  if(!['admin','guru','siswa'].includes(profile.role)) throw new Error('Role akun tidak dikenali.');
  const studentPortal=window.PAKKOM_STUDENT_PORTAL===true;
  if(studentPortal && profile.role!=='siswa') throw new Error('Halaman ini khusus siswa.');
  if(!studentPortal && profile.role==='siswa'){ window.location.href='siswa/'; return profile; }
  return profile;
}
async function loadCoreDataInBackground(){
  try{
    await refreshCore();
    if(state.profile) renderShell();
    startChatNotificationPolling();
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



async function changeOwnPassword(oldPassword,newPassword){
  const user=auth.currentUser;
  if(!user || !user.email) throw new Error('Sesi pengguna tidak tersedia');
  const credential=firebase.auth.EmailAuthProvider.credential(user.email,oldPassword);
  await user.reauthenticateWithCredential(credential);
  await user.updatePassword(newPassword);
}
function passwordPanel(){
  pageMeta('Ubah Password','Keamanan akun');
  content.innerHTML=`<div class="password-page">
    <div class="password-card">
      <div class="password-hero-icon">🛡</div>
      <h3>Ubah Password</h3>
      <p class="password-subtitle">Jaga kerahasiaan akun Anda dengan password yang kuat.</p>

      <div class="modern-field">
        <label for="pwOld">Password Saat Ini</label>
        <div class="password-wrap"><span class="field-lock">🔒</span><input id="pwOld" type="password" autocomplete="current-password" placeholder="Masukkan password saat ini"><button type="button" class="pw-eye" data-eye="pwOld" aria-label="Tampilkan password">◉</button></div>
      </div>
      <div class="modern-field">
        <label for="pwNew">Password Baru</label>
        <div class="password-wrap"><span class="field-lock">🔒</span><input id="pwNew" type="password" autocomplete="new-password" placeholder="Masukkan password baru"><button type="button" class="pw-eye" data-eye="pwNew" aria-label="Tampilkan password">◉</button></div>
      </div>
      <div class="modern-field">
        <label for="pwNew2">Konfirmasi Password Baru</label>
        <div class="password-wrap"><span class="field-lock">🔒</span><input id="pwNew2" type="password" autocomplete="new-password" placeholder="Ulangi password baru"><button type="button" class="pw-eye" data-eye="pwNew2" aria-label="Tampilkan password">◉</button></div>
      </div>

      <div class="password-strength" id="passwordStrength">
        <b>Password yang kuat:</b>
        <span data-rule="length">○ Minimal 8 karakter</span>
        <span data-rule="case">○ Mengandung huruf besar & kecil</span>
        <span data-rule="number">○ Mengandung angka</span>
      </div>
      <div class="password-actions">
        <button id="cancelPassword" class="btn secondary">Batal</button>
        <button id="savePassword" class="btn primary">🔒 Simpan Password</button>
      </div>
    </div>
  </div>`;

  const updateStrength=()=>{
    const v=$('#pwNew').value||'';
    const checks={length:v.length>=8,case:/[a-z]/.test(v)&&/[A-Z]/.test(v),number:/\d/.test(v)};
    Object.entries(checks).forEach(([k,ok])=>{
      const el=document.querySelector(`[data-rule="${k}"]`);if(el){el.classList.toggle('pass',ok);el.textContent=(ok?'✓ ':'○ ')+el.textContent.replace(/^[✓○]\s*/,'')}
    });
  };
  document.querySelectorAll('[data-eye]').forEach(b=>b.onclick=()=>{
    const x=$('#'+b.dataset.eye),show=x.type==='password';
    x.type=show?'text':'password';b.textContent=show?'⊘':'◉';b.setAttribute('aria-label',show?'Sembunyikan password':'Tampilkan password');
  });
  $('#pwNew').addEventListener('input',updateStrength);
  $('#cancelPassword').onclick=()=>{state.page='account';renderShell()};
  $('#savePassword').onclick=async()=>{
    try{
      const a=$('#pwOld').value,b=$('#pwNew').value,c=$('#pwNew2').value;
      if(b.length<8)throw new Error('Password baru minimal 8 karakter');
      if(!/[a-z]/.test(b)||!/[A-Z]/.test(b)||!/\d/.test(b))throw new Error('Gunakan huruf besar, huruf kecil, dan angka');
      if(b!==c)throw new Error('Konfirmasi password tidak sama');
      await changeOwnPassword(a,b);toast('Password berhasil diubah. Silakan login kembali.');await signOut(auth);
    }catch(e){toast(e.message||'Gagal mengubah password')}
  };
}
async function logoutNow(){
  // v5: one deterministic logout path. Remove the temporary anonymous
  // student profile first, then sign out, then reload the current portal.
  const uid=state.user?.uid||window.PAKKOM_COMPAT_CORE?.user?.uid||'';
  const role=state.profile?.role||window.PAKKOM_COMPAT_CORE?.profile?.role||'';
  try{
    if(uid && role==='siswa'){
      await deleteDoc(doc(db,'users',uid)).catch(()=>{});
    }
  }catch(_){}
  try{
    if(window.PAKKOM_COMPAT_CORE){
      window.PAKKOM_COMPAT_CORE.intentionalLogout=true;
      window.PAKKOM_COMPAT_CORE.user=null;
      window.PAKKOM_COMPAT_CORE.profile=null;
      window.PAKKOM_COMPAT_CORE.startedUid=null;
    }
    const logoutAuth=window.PAKKOM_COMPAT_CORE?.auth||auth;
    await logoutAuth.signOut();
  }catch(e){
    console.warn('Logout',e);
  }finally{
    // Reload guarantees no stale dashboard/listener remains on screen.
    window.location.reload();
  }
}

const profileTrigger=$('#profileTrigger');
const profileMenu=$('#profileMenu');
if(profileTrigger) profileTrigger.onclick=(e)=>{e.stopPropagation();profileMenu?.classList.toggle('hidden')};
document.addEventListener('click',(e)=>{if(profileMenu && !profileMenu.contains(e.target) && !profileTrigger?.contains(e.target)) profileMenu.classList.add('hidden')});
if($('#quickLogout')) $('#quickLogout').onclick=()=>{profileMenu?.classList.add('hidden');$('#logoutModal')?.classList.remove('hidden')};
if($('#cancelLogout')) $('#cancelLogout').onclick=()=>$('#logoutModal')?.classList.add('hidden');
if($('#confirmLogout')) $('#confirmLogout').onclick=async()=>{const b=$('#confirmLogout');b.disabled=true;b.textContent='Keluar...';await logoutNow();$('#logoutModal')?.classList.add('hidden');b.disabled=false;b.textContent='Keluar'};
$('#menuBtn').onclick=()=>document.querySelector('.sidebar').classList.toggle('open');

async function refreshCore(){
  const jobs=[
    withTimeout(getDocs(query(collection(db,'classes'),orderBy('name'))),5000,'Memuat kelas'),
    withTimeout(getDocs(query(collection(db,'records'),where('date','==',todayKey()))),5000,'Memuat pendataan hari ini'),
    withTimeout(getDocs(query(collection(db,'cleanliness'),where('date','==',todayKey()))),5000,'Memuat kebersihan hari ini'),
    withTimeout(getDoc(doc(db,'settings','calendar')),5000,'Memuat kalender sekolah'),
    withTimeout(getDoc(doc(db,'settings','access')),5000,'Memuat pengaturan akses'),
    withTimeout(getDoc(doc(db,'settings','operational')),5000,'Memuat jadwal operasional')
  ];
  const [classRes,recordRes,cleanRes,calendarRes,accessRes,operationalRes]=await Promise.allSettled(jobs);

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

  if(accessRes.status==='fulfilled'){
    state.accessSettings=accessRes.value?.exists?.()
      ? accessRes.value.data()
      : {homeroomCleanlinessEnabled:false};
  } else {
    console.warn(accessRes.reason);
    state.accessSettings={homeroomCleanlinessEnabled:false};
  }
  if(operationalRes.status==='fulfilled'){
    state.operationalSettings=operationalRes.value?.exists?.()?operationalRes.value.data():null;
  } else console.warn(operationalRes.reason);

  return {
    classes:classRes.status,
    records:recordRes.status,
    cleanliness:cleanRes.status,
    calendar:calendarRes.status,
    access:accessRes.status,
    operational:operationalRes.status
  };
}

function classRecord(c){ return state.recordsToday.find(r=>r.classId===c); }


function applyResponsiveMode(){
  const coarse=window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const w=window.innerWidth;
  let mode;
  // Perangkat sentuh tidak dipaksa menjadi layout PC hanya karena browser memakai "Situs desktop".
  if(coarse){
    mode=w<700?'mobile':'tablet';
  }else{
    mode=w>=1180?'desktop':(w>=760?'tablet':'mobile');
  }
  document.documentElement.setAttribute('data-layout',mode);
  document.documentElement.classList.toggle('touch-device',coarse);
  return mode;
}
if(!window.__pakkomResponsiveBound){
  window.__pakkomResponsiveBound=true;
  let __responsiveTimer=null;
  window.addEventListener('resize',()=>{
    clearTimeout(__responsiveTimer);
    __responsiveTimer=setTimeout(()=>{
      const before=document.documentElement.getAttribute('data-layout');
      const active=document.activeElement;
      const typing=!!active && (
        active.tagName==='INPUT'
        || active.tagName==='TEXTAREA'
        || active.isContentEditable
      );
      const after=applyResponsiveMode();
      // Jangan pernah bongkar DOM ketika keyboard/input sedang aktif.
      if(state?.profile && before!==after && !typing) renderShell();
    },160);
  });
}
function renderShell(){
  applyResponsiveMode();
  if(!state.profile){
    $('#bootView')?.classList.add('hidden');
    $('#loginView').classList.remove('hidden');
    $('#appView').classList.add('hidden');
    return;
  }
  $('#bootView')?.classList.add('hidden');
  showLoginError(''); $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden');
  const chipRole=state.profile.role==='siswa' ? `Siswa • ${esc(state.profile.classId||'-')}` : state.profile.role==='admin'
    ? 'Administrator'
    : (state.profile.isHomeroom
        ? `Wali Kelas • ${esc(state.profile.homeroomClass||'-')}`
        : 'Guru');
  const displayName=state.profile.name||state.profile.loginId||'Pengguna';
  const initials=displayName.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'PK';
  $('#userChip').innerHTML=`<b>${esc(displayName)}</b><span class="role-label">${chipRole}</span>`;
  if($('#profileAvatar')) $('#profileAvatar').textContent=initials;
  if($('#profileMenuName')) $('#profileMenuName').textContent=displayName;
  if($('#profileMenuRole')) $('#profileMenuRole').textContent=chipRole;
  $('#nav').innerHTML=navItems().map(([k,l])=>`<button class="nav-btn ${state.page===k?'active':''}" data-page="${k}">${l}</button>`).join('');
  document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>{
    state.page=b.dataset.page;
    if(state.page==='chat'){
      state.selectedClass=null;
      return openEcoChatRoot();
    }
    state.selectedClass=null;
    window.scrollTo({top:0,left:0,behavior:'instant'});
    document.documentElement.scrollTop=0;
    document.body.scrollTop=0;
    renderShell();
    document.querySelector('.sidebar').classList.remove('open');
  });
  renderPage();
}
function renderPage(){
  if(content){
    content.classList.add('page-content-stable');
    content.setAttribute('data-page',state.page||'home');
  }
  if(state.profile?.role==='siswa' && !['studenthome','studenttasks','studentaccount'].includes(state.page)) state.page='studenthome';
  if(state.page==='studenthome')return studentHome();
  if(state.page==='studenttasks')return studentTasks();
  if(state.page==='studentaccount')return studentAccount();
  if(state.page==='tasks')return taskManagementPage();
  if(state.page==='home')return home();
  if(state.page==='input')return inputPage();
  if(state.page==='clean')return cleanlinessPage();
  if(state.page==='recap')return recap();
  if(state.page==='account')return account();
  if(state.page==='master')return master();
  if(state.page==='chat')return ecoChatPage();
  if(state.page==='more')return morePage();
  if(state.page==='classdata')return homeroomStudentDataPage();
}

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
  content.innerHTML=`<div class="welcome modern-welcome"><span>${state.profile.isHomeroom?'Wali Kelas '+esc(state.profile.homeroomClass||''):'PakKom EcoTrack'}</span><h2>Selamat datang, ${esc(state.profile.name)} 👋</h2><small>${dateID()}</small></div>
  ${!op.active?`<div class="holiday-banner"><div>🏖️</div><div><b>Hari Tidak Aktif</b><span>${esc(op.label)} • Pendataan harian dan pemeriksaan kebersihan dinonaktifkan.</span></div></div>`:''}
  <div class="module-grid modern-dashboard ${!op.active?'modules-off':''}">
    <div class="module-card module-wadah"><div class="module-icon">${ICON_TUMBLER}</div><div><span class="eyebrow">PENDATAAN HARI INI</span><h3>Wadah Makan & Tumbler</h3><strong>${done.size} dari ${state.classes.length} kelas</strong><div class="progress"><i style="width:${state.classes.length?Math.round(done.size/state.classes.length*100):0}%"></i></div><p>Wadah ${food}% • Tumbler ${tumb}%</p></div><button class="btn primary module-go" data-go="input" ${!op.active?'disabled':''}>${op.active?'Mulai Pendataan →':'Hari Libur'}</button></div>
    <div class="module-card module-clean"><div class="module-icon">🧹</div><div><span class="eyebrow">PEMERIKSAAN HARI INI</span><h3>Kebersihan Kelas</h3><strong>${state.cleanlinessToday.length} pemeriksaan</strong><p>${lastClean?`Terakhir: ${esc(lastClean.classId)} • JP ${esc(lastClean.jp)} • ${esc(lastClean.timeLabel||'')}`:'Belum ada pemeriksaan hari ini'}</p></div><button class="btn clean-btn module-go" data-go="clean" ${!op.active?'disabled':''}>${op.active?'+ Cek Kebersihan':'Hari Libur'}</button></div>
  </div>
  ${waliClass?`<div class="card homeroom-card"><span class="badge ok">⭐ Kelas Saya</span><h3>${esc(waliClass)}</h3><div class="wali-summary"><span>${ICON_TUMBLER} ${waliRec?'Sudah didata':'Belum didata'}</span><span>🧹 ${waliClean?`${cleanOverall(waliClean).label} • JP ${waliClean.jp}`:'Belum diperiksa'}</span></div><button class="btn secondary" id="openMyClassData">Lihat Data Siswa & Analisis →</button></div>`:''}
  ${op.active?`<div class="card"><div class="section-head"><div><h3 style="margin:0">Belum Pendataan Wadah Makan & Tumbler</h3><small>Kelas yang belum melakukan pendataan hari ini.</small></div></div><div class="chip-list">${state.classes.filter(c=>!done.has(c)).map(c=>`<button class="mini-chip" data-class="${c}">${c}</button>`).join('')||'<span class="badge ok">Semua kelas sudah didata ✓</span>'}</div></div>`:''}`;
  if(content && state.chatUnread>0) content.insertAdjacentHTML('beforeend',`<button class="card home-chat-card" data-go-chat="1"><div class="home-chat-icon">💬</div><div><b>EcoChat</b><span>${state.chatUnread} pesan belum dibaca</span></div><strong>Buka →</strong></button>`);
  document.querySelectorAll('.module-go').forEach(b=>b.onclick=()=>{state.page=b.dataset.go;window.scrollTo(0,0);renderShell()});
  document.querySelectorAll('[data-go-chat]').forEach(b=>b.onclick=()=>openEcoChatRoot());
  if($('#openMyClassData'))$('#openMyClassData').onclick=()=>{state.page='classdata';renderShell()};
  document.querySelectorAll('.mini-chip').forEach(b=>b.onclick=()=>{state.selectedClass=b.dataset.class;state.page='input';window.scrollTo(0,0);renderShell()});
}
function bindClassButtons(){ document.querySelectorAll('[data-class]').forEach(b=>b.onclick=()=>{state.page='input';state.selectedClass=b.dataset.class;window.scrollTo(0,0);renderShell()}); }


function openEcoChatRoot(){
  state.page='chat';
  state.chatGroup=null;
  window.ecoChatReply=null;
  window.ecoChatEdit=null;
  if(state.chatUnsub){state.chatUnsub();state.chatUnsub=null}
  if(state.chatReactionUnsub){state.chatReactionUnsub();state.chatReactionUnsub=null}
  if(window.ecoBotTimer){clearInterval(window.ecoBotTimer);window.ecoBotTimer=null}
  window.scrollTo(0,0);
  renderShell();
}
function availableChatGroups(){
  const p=state.profile||{}, groups=[
    {id:'announcements',icon:'📢',name:'Pengumuman Sekolah',desc:'Informasi resmi dari Administrator'},
    {id:'all-teachers',icon:'👥',name:'Semua Guru',desc:'Koordinasi seluruh guru'},
  ];
  if(p.role==='admin'||p.isHomeroom===true) groups.push({id:'homerooms',icon:'🎓',name:'Wali Kelas',desc:'Koordinasi khusus wali kelas'});
  if(p.role==='admin'){
    groups.push(
      {id:'grade-7',icon:'7',name:'Jenjang 7',desc:'Koordinasi wali kelas jenjang 7'},
      {id:'grade-8',icon:'8',name:'Jenjang 8',desc:'Koordinasi wali kelas jenjang 8'},
      {id:'grade-9',icon:'9',name:'Jenjang 9',desc:'Koordinasi wali kelas jenjang 9'}
    );
  }else if(p.isHomeroom){
    const g=String(p.homeroomClass||'').charAt(0);
    if(['7','8','9'].includes(g))groups.push({id:`grade-${g}`,icon:g,name:`Jenjang ${g}`,desc:`Koordinasi wali kelas jenjang ${g}`});
  }
  return groups;
}
function chatGroupById(id){return availableChatGroups().find(g=>g.id===id)}
function chatCanSend(groupId){
  if(groupId==='announcements')return state.profile.role==='admin';
  return !!chatGroupById(groupId);
}
async function getChatRead(groupId){
  try{
    const x=await getDoc(doc(db,'chatReads',`${groupId}_${state.user.uid}`));
    return x.exists()?String(x.data().lastReadAt||''):'';
  }catch(_){return ''}
}
async function markChatRead(groupId){
  try{
    await setDoc(doc(db,'chatReads',`${groupId}_${state.user.uid}`),{
      groupId,uid:state.user.uid,lastReadAt:new Date().toISOString()
    },{merge:true});
  }catch(e){console.warn('read marker',e)}
}
async function refreshChatUnread(){
  if(!state.user||!state.profile)return;
  const previous=Number(state.chatUnread||0);
  let total=0;
  const perGroup=[];
  for(const g of availableChatGroups()){
    try{
      const [snap,last]=await Promise.all([
        getDocs(query(collection(db,'chatMessages'),where('groupId','==',g.id))),
        getChatRead(g.id)
      ]);
      const rows=snap.docs.map(d=>d.data()).filter(m=>!m.deletedAt);
      const n=rows.filter(m=>m.senderUid!==state.user.uid && String(m.createdAtISO||m.createdAt||'')>last).length;
      total+=n;perGroup.push({g,n});
    }catch(_){}
  }
  state.chatUnread=total;

  if(state.chatUnreadInitialized && total>previous){
    const delta=total-previous;
    const group=perGroup.sort((a,b)=>b.n-a.n)[0]?.g;
    toast(`💬 ${delta} pesan baru EcoChat${group?` • ${group.name}`:''}`);
    if('Notification' in window && Notification.permission==='granted'){
      try{
        new Notification('PakKom EcoTrack • EcoChat',{
          body:`${delta} pesan baru${group?` di ${group.name}`:''}`,
          tag:'pakkom-ecochat',
          renotify:true
        });
      }catch(_){}
    }
  }
  state.chatUnreadInitialized=true;

  if(state.profile && state.page!=='chat'){
    const nav=$('#nav');
    if(nav){
      const btn=nav.querySelector('[data-page="chat"]');
      if(btn){
        const old=btn.querySelector('.nav-unread');if(old)old.remove();
        if(total){
          const b=document.createElement('span');
          b.className='nav-unread';b.textContent=total>99?'99+':String(total);btn.appendChild(b);
        }
      }
    }
  }
}
function startChatNotificationPolling(){
  if(state.chatNotifyTimer)clearInterval(state.chatNotifyTimer);
  refreshChatUnread().catch(()=>{});
  state.chatNotifyTimer=setInterval(()=>refreshChatUnread().catch(()=>{}),20000);
}
async function requestChatNotifications(){
  if(!('Notification' in window))return toast('Browser ini belum mendukung notifikasi web.');
  if(Notification.permission==='granted')return toast('🔔 Notifikasi EcoChat sudah aktif.');
  if(Notification.permission==='denied')return toast('Notifikasi diblokir browser. Aktifkan dari pengaturan situs.');
  try{
    const result=await Notification.requestPermission();
    toast(result==='granted'?'🔔 Notifikasi EcoChat diaktifkan.':'Notifikasi belum diizinkan.');
    if(state.page==='chat')ecoChatPage();
  }catch(e){console.error(e);toast('Tidak dapat meminta izin notifikasi.')}
}


function classDataAllowed(){
  return state.profile?.role==='admin' || state.profile?.isHomeroom===true;
}
function classDataTargetClass(){
  if(state.profile?.role==='admin') return window.classDataAdminClass || state.classes[0] || '';
  return String(state.profile?.homeroomClass||'');
}
function isoShift(dateKey,days){
  const [y,m,d]=String(dateKey).split('-').map(Number);
  const x=new Date(y,m-1,d);x.setDate(x.getDate()+days);
  return x.toLocaleDateString('en-CA');
}
function idDateShort(key){
  if(!key)return '-';
  const [y,m,d]=String(key).split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric'}).format(new Date(y,m-1,d));
}
async function fetchClassStudents(classId){
  const snap=await getDocs(query(collection(db,'students'),where('classId','==',classId)));
  return snap.docs.map(d=>({id:d.id,...d.data()}))
    .filter(x=>x.active!==false)
    .sort((a,b)=>(a.name||'').localeCompare(b.name||'','id',{sensitivity:'base'}));
}
async function fetchClassRecordsAll(classId){
  const snap=await getDocs(query(collection(db,'records'),where('classId','==',classId)));
  return snap.docs.map(d=>({id:d.id,...d.data()}))
    .sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
}
function itemForStudent(record,student){
  if(!record)return null;
  const sid=String(student.id||''),nis=String(student.nis||student.id||'');
  return (record.items||[]).find(i=>
    String(i.studentId||'')===sid
    || String(i.nis||'')===nis
  )||null;
}
function carryStatus(item){
  if(!item)return {key:'nodata',label:'Belum Ada Data',cls:'neutral'};
  if(item.presence!=='hadir')return {key:'absent',label:item.presence==='izin'?'Izin':item.presence==='sakit'?'Sakit':item.presence==='alpa'?'Alpa':'Tidak Hadir',cls:'neutral'};
  if(item.food&&item.tumbler)return {key:'both',label:'Wadah + Tumbler',cls:'good'};
  if(item.food&&!item.tumbler)return {key:'food',label:'Hanya Wadah',cls:'fair'};
  if(!item.food&&item.tumbler)return {key:'tumbler',label:'Hanya Tumbler',cls:'fair'};
  return {key:'none',label:'Tidak Membawa Keduanya',cls:'bad'};
}
function studentPeriodMetric(student,records){
  let present=0,food=0,tumbler=0,both=0,none=0;
  const history=[];
  records.forEach(r=>{
    const i=itemForStudent(r,student); if(!i)return;
    const st=carryStatus(i);
    history.push({date:r.date,item:i,status:st});
    if(i.presence==='hadir'){
      present++;
      if(i.food)food++;
      if(i.tumbler)tumbler++;
      if(i.food&&i.tumbler)both++;
      if(!i.food&&!i.tumbler)none++;
    }
  });
  const pct=n=>present?Math.round(n/present*100):0;
  return {student,present,food,tumbler,both,none,foodPct:pct(food),tumblerPct:pct(tumbler),bothPct:pct(both),history};
}
function trendForMetrics(records,students){
  if(records.length<2)return {label:'Belum cukup data',dir:'flat',delta:0,first:0,last:0};
  const mid=Math.ceil(records.length/2),a=records.slice(0,mid),b=records.slice(mid);
  const score=rs=>{
    let present=0,both=0;
    students.forEach(st=>rs.forEach(r=>{
      const i=itemForStudent(r,st);
      if(i?.presence==='hadir'){present++;if(i.food&&i.tumbler)both++}
    }));
    return present?Math.round(both/present*100):0;
  };
  const first=score(a),last=score(b),delta=last-first;
  return {label:delta>2?`Meningkat +${delta}%`:delta<-2?`Menurun ${delta}%`:'Relatif stabil',dir:delta>2?'up':delta<-2?'down':'flat',delta,first,last};
}
function analysisLabel(metric){
  if(metric.present===0)return {label:'Belum Ada Data',cls:'neutral'};
  if(metric.bothPct>=90)return {label:'Sangat Konsisten',cls:'good'};
  if(metric.bothPct>=75)return {label:'Konsisten',cls:'good'};
  if(metric.bothPct>=50)return {label:'Mulai Konsisten',cls:'fair'};
  return {label:'Perlu Diingatkan',cls:'bad'};
}
function homeroomStudentDataPage(){
  if(!classDataAllowed()){state.page='home';return renderShell()}
  const classId=classDataTargetClass();
  pageMeta(state.profile.role==='admin'?'Data Siswa per Kelas':'Data Kelas Saya',classId?`Kelas ${classId}`:'');
  content.innerHTML=`<div class="card classdata-loading"><div class="empty">Memuat data kelas...</div></div>`;
  loadHomeroomStudentData(classId);
}
async function loadHomeroomStudentData(classId){
  if(!classId){content.innerHTML='<div class="card"><div class="empty">Belum ada kelas yang dapat ditampilkan.</div></div>';return}
  try{
    const [students,records]=await Promise.all([fetchClassStudents(classId),fetchClassRecordsAll(classId)]);
    window.classDataStudents=students;
    window.classDataRecords=records;
    window.classDataClassId=classId;
    window.classDataTab=window.classDataTab||'daily';
    const dates=[...new Set(records.map(r=>r.date).filter(Boolean))].sort();
    window.classDataDailyDate=window.classDataDailyDate||dates.at(-1)||todayKey();
    window.classDataStart=window.classDataStart||isoShift(todayKey(),-13);
    window.classDataEnd=window.classDataEnd||todayKey();
    renderHomeroomStudentDataShell();
  }catch(e){
    console.error(e);
    content.innerHTML='<div class="card"><div class="empty">Data kelas belum dapat dimuat. Periksa koneksi dan Firestore Rules.</div></div>';
  }
}
function renderHomeroomStudentDataShell(){
  const classId=window.classDataClassId,students=window.classDataStudents||[],records=window.classDataRecords||[];
  const admin=state.profile.role==='admin';
  const tab=window.classDataTab||'daily';
  const selected=records.find(r=>r.date===window.classDataDailyDate);
  const todayPresent=selected?(selected.items||[]).filter(i=>i.presence==='hadir').length:0;
  const todayFood=selected?(selected.items||[]).filter(i=>i.presence==='hadir'&&i.food).length:0;
  const todayTumb=selected?(selected.items||[]).filter(i=>i.presence==='hadir'&&i.tumbler).length:0;
  const pct=(n,d)=>d?Math.round(n/d*100):0;
  content.innerHTML=`
    <div class="classdata-hero card">
      <div>
        <span class="eyebrow">👨‍🎓 DATA SISWA</span>
        <h3>${admin?'Data Wadah & Tumbler Siswa':`Kelas Saya • ${esc(classId)}`}</h3>
        <p>Lihat data harian, konsistensi, dan riwayat siswa. Halaman ini hanya untuk pemantauan.</p>
      </div>
      ${admin?`<label class="classdata-class-select">Kelas<select id="classDataClassSelect">${state.classes.map(c=>`<option value="${esc(c)}" ${c===classId?'selected':''}>${esc(c)}</option>`).join('')}</select></label>`:''}
    </div>

    <div class="classdata-mini-stats">
      <div><span>Siswa Aktif</span><b>${students.length}</b></div>
      <div><span>Wadah ${idDateShort(window.classDataDailyDate)}</span><b>${selected?pct(todayFood,todayPresent)+'%':'-'}</b></div>
      <div><span>Tumbler</span><b>${selected?pct(todayTumb,todayPresent)+'%':'-'}</b></div>
    </div>

    <div class="classdata-tabs">
      <button class="${tab==='daily'?'active':''}" data-classdata-tab="daily">📅 Harian</button>
      <button class="${tab==='analysis'?'active':''}" data-classdata-tab="analysis">📈 Analisis</button>
    </div>
    <div id="classDataBody"></div>`;

  if($('#classDataClassSelect'))$('#classDataClassSelect').onchange=async e=>{
    window.classDataAdminClass=e.target.value;
    window.classDataDailyDate=null;window.classDataStart=null;window.classDataEnd=null;
    content.innerHTML='<div class="card"><div class="empty">Memuat kelas...</div></div>';
    await loadHomeroomStudentData(e.target.value);
  };
  document.querySelectorAll('[data-classdata-tab]').forEach(b=>b.onclick=()=>{
    window.classDataTab=b.dataset.classdataTab;
    renderHomeroomStudentDataShell();
  });
  if(tab==='daily')renderClassDataDaily();else renderClassDataAnalysis();
}
function renderClassDataDaily(){
  const target=$('#classDataBody'),students=window.classDataStudents||[],records=window.classDataRecords||[];
  const dates=[...new Set(records.map(r=>r.date).filter(Boolean))].sort().reverse();
  const selected=records.find(r=>r.date===window.classDataDailyDate);
  window.classDataDailyFilter=window.classDataDailyFilter||'all';
  const rows=students.map(st=>({student:st,item:itemForStudent(selected,st)})).map(x=>({...x,status:carryStatus(x.item)}));
  const filtered=rows.filter(x=>{
    const f=window.classDataDailyFilter;
    if(f==='all')return true;
    if(f==='food-miss')return x.item?.presence==='hadir'&&!x.item.food;
    if(f==='tumb-miss')return x.item?.presence==='hadir'&&!x.item.tumbler;
    if(f==='none')return x.status.key==='none';
    if(f==='complete')return x.status.key==='both';
    return true;
  });
  const hadir=rows.filter(x=>x.item?.presence==='hadir').length;
  const food=rows.filter(x=>x.item?.presence==='hadir'&&x.item.food).length;
  const tumb=rows.filter(x=>x.item?.presence==='hadir'&&x.item.tumbler).length;
  const both=rows.filter(x=>x.status.key==='both').length;
  const none=rows.filter(x=>x.status.key==='none').length;
  const pct=n=>hadir?Math.round(n/hadir*100):0;
  target.innerHTML=`
    <div class="card classdata-controls">
      <label>Tanggal
        <select id="classDataDate">${dates.map(d=>`<option value="${d}" ${d===window.classDataDailyDate?'selected':''}>${idDateShort(d)}</option>`).join('')||`<option value="${todayKey()}">${idDateShort(todayKey())}</option>`}</select>
      </label>
      <div class="classdata-filterchips">
        ${[['all','Semua'],['complete','Lengkap'],['food-miss','Tidak Bawa Wadah'],['tumb-miss','Tidak Bawa Tumbler'],['none','Tidak Bawa Keduanya']].map(([k,l])=>`<button class="${window.classDataDailyFilter===k?'active':''}" data-daily-filter="${k}">${l}</button>`).join('')}
      </div>
    </div>
    ${selected?`<div class="classdata-summary-grid">
      <div class="summary-good"><span>✓ Wadah + Tumbler</span><b>${both}</b><small>${pct(both)}% siswa hadir</small></div>
      <div><span>🍱 Membawa Wadah</span><b>${food}</b><small>${pct(food)}%</small></div>
      <div><span>💧 Membawa Tumbler</span><b>${tumb}</b><small>${pct(tumb)}%</small></div>
      <div class="${none?'summary-bad':''}"><span>Perlu Diingatkan</span><b>${none}</b><small>Tidak membawa keduanya</small></div>
    </div>`:`<div class="card"><div class="empty">Belum ada pendataan kelas pada tanggal ini.</div></div>`}
    <div class="student-daily-list">
      ${filtered.map(({student,item,status},i)=>`<button class="student-daily-row" data-student-history="${esc(student.id)}">
        <span class="student-index">${i+1}</span>
        <div class="student-daily-name"><b>${esc(student.name||'-')}</b><small>NIS ${esc(student.nis||student.id||'-')}</small></div>
        <div class="daily-icons">
          <span class="${item?.presence==='hadir'&&item.food?'yes':'no'}" title="Wadah">${item?.presence==='hadir'&&item.food?'✓':'×'} 🍱</span>
          <span class="${item?.presence==='hadir'&&item.tumbler?'yes':'no'}" title="Tumbler">${item?.presence==='hadir'&&item.tumbler?'✓':'×'} 💧</span>
        </div>
        <span class="badge ${status.cls}">${esc(status.label)}</span>
        <strong>›</strong>
      </button>`).join('')||'<div class="card"><div class="empty">Tidak ada siswa pada filter ini.</div></div>'}
    </div>`;
  if($('#classDataDate'))$('#classDataDate').onchange=e=>{window.classDataDailyDate=e.target.value;renderHomeroomStudentDataShell()};
  document.querySelectorAll('[data-daily-filter]').forEach(b=>b.onclick=()=>{window.classDataDailyFilter=b.dataset.dailyFilter;renderClassDataDaily()});
  document.querySelectorAll('[data-student-history]').forEach(b=>b.onclick=()=>renderStudentCarryHistory(b.dataset.studentHistory));
}
function renderClassDataAnalysis(){
  const target=$('#classDataBody'),students=window.classDataStudents||[],all=window.classDataRecords||[];
  const start=window.classDataStart,end=window.classDataEnd;
  const records=all.filter(r=>String(r.date)>=start&&String(r.date)<=end);
  const metrics=students.map(st=>studentPeriodMetric(st,records));
  const presentTotal=metrics.reduce((a,m)=>a+m.present,0);
  const foodTotal=metrics.reduce((a,m)=>a+m.food,0);
  const tumbTotal=metrics.reduce((a,m)=>a+m.tumbler,0);
  const bothTotal=metrics.reduce((a,m)=>a+m.both,0);
  const pct=n=>presentTotal?Math.round(n/presentTotal*100):0;
  const trend=trendForMetrics(records,students);
  const need=metrics.filter(m=>m.present>=2&&m.bothPct<50).sort((a,b)=>a.bothPct-b.bothPct);
  target.innerHTML=`
    <div class="card classdata-period-controls">
      <label>Mulai<input id="classDataStart" type="date" value="${esc(start)}"></label>
      <label>Selesai<input id="classDataEnd" type="date" value="${esc(end)}"></label>
      <button id="applyClassDataPeriod" class="btn primary">Terapkan</button>
    </div>
    <div class="analysis-overview-grid">
      <div><span>🍱 Wadah</span><b>${pct(foodTotal)}%</b><small>${foodTotal}/${presentTotal} kehadiran</small></div>
      <div><span>💧 Tumbler</span><b>${pct(tumbTotal)}%</b><small>${tumbTotal}/${presentTotal} kehadiran</small></div>
      <div><span>✓ Keduanya</span><b>${pct(bothTotal)}%</b><small>Konsistensi kelas</small></div>
      <div class="trend-${trend.dir}"><span>Tren</span><b>${trend.dir==='up'?'↑':trend.dir==='down'?'↓':'→'} ${esc(trend.label)}</b><small>${trend.first}% → ${trend.last}%</small></div>
    </div>
    <div class="card classdata-analysis-card">
      <div class="section-head"><div><h3>Analisis per Siswa</h3><small>${records.length} hari pendataan • ${idDateShort(start)}–${idDateShort(end)}</small></div></div>
      <div class="table-wrap"><table class="classdata-analysis-table"><thead><tr><th>Siswa</th><th>Hadir</th><th>Wadah</th><th>Tumbler</th><th>Keduanya</th><th>Status</th></tr></thead><tbody>
        ${metrics.map(m=>{const a=analysisLabel(m);return `<tr data-student-analysis="${esc(m.student.id)}"><td><b>${esc(m.student.name||'-')}</b><small>NIS ${esc(m.student.nis||m.student.id||'-')}</small></td><td>${m.present}</td><td>${m.foodPct}%</td><td>${m.tumblerPct}%</td><td><b>${m.bothPct}%</b></td><td><span class="badge ${a.cls}">${a.label}</span></td></tr>`}).join('')}
      </tbody></table></div>
    </div>
    <div class="card attention-card">
      <div class="section-head"><div><h3>Perlu Diingatkan</h3><small>Berdasarkan konsistensi membawa Wadah + Tumbler di bawah 50% dan minimal 2 hari hadir.</small></div></div>
      <div class="attention-list">${need.map(m=>`<button data-student-analysis="${esc(m.student.id)}"><span>${esc(m.student.name)}</span><b>${m.bothPct}%</b><small>${m.both}/${m.present} hari lengkap</small></button>`).join('')||'<div class="empty">Tidak ada siswa dalam kategori ini pada periode terpilih. 👍</div>'}</div>
    </div>`;
  $('#applyClassDataPeriod').onclick=()=>{
    const a=$('#classDataStart').value,b=$('#classDataEnd').value;
    if(!a||!b||a>b)return toast('Rentang tanggal tidak valid');
    window.classDataStart=a;window.classDataEnd=b;renderClassDataAnalysis();
  };
  document.querySelectorAll('[data-student-analysis]').forEach(el=>el.onclick=()=>renderStudentCarryHistory(el.dataset.studentAnalysis,start,end));
}
function renderStudentCarryHistory(studentId,start=null,end=null){
  const student=(window.classDataStudents||[]).find(s=>s.id===studentId);if(!student)return;
  const all=window.classDataRecords||[];
  const records=start&&end?all.filter(r=>String(r.date)>=start&&String(r.date)<=end):all.slice(-14);
  const metric=studentPeriodMetric(student,records),a=analysisLabel(metric);
  pageMeta('Riwayat Siswa',`${student.name||''} • ${window.classDataClassId||''}`);
  content.innerHTML=`<div class="section-head"><div><h3 style="margin:0">${esc(student.name||'-')}</h3><small>NIS ${esc(student.nis||student.id||'-')}</small></div><button id="backClassData" class="btn ghost">← Data Kelas</button></div>
    <div class="student-history-summary">
      <div><span>Hari Hadir</span><b>${metric.present}</b></div>
      <div><span>Wadah</span><b>${metric.foodPct}%</b></div>
      <div><span>Tumbler</span><b>${metric.tumblerPct}%</b></div>
      <div><span>Keduanya</span><b>${metric.bothPct}%</b></div>
    </div>
    <div class="card"><div class="student-status-head"><span class="badge ${a.cls}">${a.label}</span><small>Riwayat hanya untuk pemantauan Wali Kelas/Admin.</small></div>
      <div class="student-history-list">${[...metric.history].reverse().map(h=>`<div class="history-row"><div><b>${idDateShort(h.date)}</b><small>${h.item?.presence==='hadir'?'Hadir':esc(h.status.label)}</small></div><span class="${h.item?.presence==='hadir'&&h.item.food?'yes':'no'}">${h.item?.presence==='hadir'&&h.item.food?'✓':'×'} Wadah</span><span class="${h.item?.presence==='hadir'&&h.item.tumbler?'yes':'no'}">${h.item?.presence==='hadir'&&h.item.tumbler?'✓':'×'} Tumbler</span><b class="badge ${h.status.cls}">${esc(h.status.label)}</b></div>`).join('')||'<div class="empty">Belum ada riwayat pada periode ini.</div>'}</div>
    </div>`;
  $('#backClassData').onclick=()=>{pageMeta(state.profile.role==='admin'?'Data Siswa per Kelas':'Data Kelas Saya',`Kelas ${window.classDataClassId}`);renderHomeroomStudentDataShell()};
}
function morePage(){
  pageMeta('Lainnya','Menu PakKom EcoTrack');
  const admin=state.profile.role==='admin';
  const homeroom=state.profile.isHomeroom===true;
  content.innerHTML=`<div class="more-grid">
    <button class="more-card" data-more-go="tasks"><span>📝</span><div><b>Tugas Siswa</b><small>${admin?'Buat tugas, pantau pengumpulan dan penilaian':'Periksa dan nilai tugas siswa'}</small></div><strong>›</strong></button>
    ${homeroom||admin?`<button class="more-card class-data-card" data-more-go="classdata"><span>👨‍🎓</span><div><b>${homeroom?'Data Kelas Saya':'Data Siswa per Kelas'}</b><small>Harian, riwayat Wadah & Tumbler, serta analisis siswa</small></div><strong>›</strong></button>`:''}
    <button class="more-card" data-more-go="recap"><span>📊</span><div><b>Rekap & Analisis</b><small>Rekap Wadah, Kebersihan, analisis dan apresiasi</small></div><strong>›</strong></button>
    ${admin?`<button class="more-card" data-more-go="master"><span>⚙️</span><div><b>Kelola Data</b><small>Siswa, guru, kelas, periode dan operasional</small></div><strong>›</strong></button>`:''}
    <button class="more-card" data-more-go="account"><span>👤</span><div><b>Akun</b><small>Profil dan keamanan akun</small></div><strong>›</strong></button>
    <button class="more-card danger-card" id="moreLogout"><span>↪</span><div><b>Keluar</b><small>Keluar dari PakKom EcoTrack</small></div><strong>›</strong></button>
  </div>`;
  document.querySelectorAll('[data-more-go]').forEach(b=>b.onclick=()=>{state.page=b.dataset.moreGo;renderShell()});
  $('#moreLogout').onclick=()=>$('#logoutModal')?.classList.remove('hidden');
}
// EcoChat tidak dirender ulang dari event resize.
 // Keyboard virtual Android/iOS juga memicu resize viewport dan sebelumnya
 // menyebabkan textarea kehilangan fokus.


if(!window.__ecoChatViewportBound && window.visualViewport){
  window.__ecoChatViewportBound=true;
  const syncEcoChatViewport=()=>{
    const vv=window.visualViewport;
    document.documentElement.style.setProperty('--ecochat-vh',`${vv.height}px`);
    const keyboardOpen=(window.innerHeight-vv.height)>120;
    document.documentElement.classList.toggle('ecochat-keyboard-open',keyboardOpen);
  };
  window.visualViewport.addEventListener('resize',syncEcoChatViewport);
  window.visualViewport.addEventListener('scroll',syncEcoChatViewport);
  syncEcoChatViewport();
}

function ecoChatPage(){
  pageMeta('EcoChat','Komunikasi & koordinasi EcoTrack');
  const groups=availableChatGroups();
  const mobile=(document.documentElement.getAttribute('data-layout')==='mobile');

  // EcoChat selalu menghormati state.chatGroup.
  // Saat menu EcoChat ditekan, state.chatGroup direset sehingga halaman
  // kembali ke daftar seluruh grup pada Mobile, Tablet, maupun Desktop.
  if(state.chatGroup && !chatGroupById(state.chatGroup)){
    state.chatGroup=null;
  }

  content.innerHTML=`<div class="ecochat-shell ${mobile?'is-mobile':''}">
    <section class="chat-groups ${mobile&&state.chatGroup?'mobile-hidden-when-chat':''}">
      <div class="chat-list-head">
        <div>
          <h3>💬 EcoChat</h3>
          <small>${groups.length} grup tersedia</small>
        </div>
        <div class="chat-head-actions">${('Notification' in window)?`<button id="chatNotifyBtn" class="chat-activity-btn">${Notification.permission==='granted'?'🔔 Aktif':'🔔 Notifikasi'}</button>`:''}${state.profile.role==='admin'?'<button id="chatActivityBtn" class="chat-activity-btn">Aktivitas</button>':''}</div>
      </div>

      <div class="chat-mobile-info">
        <span>Komunikasi internal PakKom EcoTrack</span>
        <small>Pilih grup untuk membuka percakapan</small>
      </div>

      <div class="chat-list-tools">
        <label class="chat-search"><span>⌕</span><input id="chatGroupSearch" type="search" placeholder="Cari grup..." autocomplete="off"></label>
        <button class="chat-filter-btn active" data-chat-list-filter="all">Semua</button>
        <button class="chat-filter-btn" data-chat-list-filter="unread">Belum dibaca</button>
      </div>
      <div id="chatGroupList">
        ${groups.map(g=>`
          <button class="chat-group-item ${state.chatGroup===g.id?'active':''}" data-chat-group="${g.id}" data-chat-name="${esc(g.name.toLowerCase())}">
            <span class="chat-group-icon">${g.icon}</span>
            <div class="chat-group-copy">
              <div class="chat-group-title">
                <b>${esc(g.name)}</b>
                <span class="group-unread" data-unread-group="${g.id}"></span>
              </div>
              <small class="chat-group-preview" data-group-preview="${g.id}">${esc(g.desc)}</small>
            </div>
            <span class="chat-group-chevron">›</span>
          </button>
        `).join('')}
      </div>
    </section>

    <section class="chat-room ${mobile&&state.chatGroup?'mobile-chat-open':''}">
      <div id="chatRoomBody">${!state.chatGroup?'<div class="chat-desktop-placeholder"><span>💬</span><b>Pilih grup EcoChat</b><small>Percakapan akan tampil di sini.</small></div>':''}</div>
    </section>
  </div>`;

  document.querySelectorAll('[data-chat-group]').forEach(b=>b.onclick=()=>{
    state.chatGroup=b.dataset.chatGroup;
    ecoChatPage();
  });
  const applyGroupListFilter=()=>{
    const q=String($('#chatGroupSearch')?.value||'').toLowerCase().trim();
    const mode=window.ecoChatListFilter||'all';
    document.querySelectorAll('.chat-group-item').forEach(el=>{
      const name=String(el.dataset.chatName||'');
      const unread=Number(el.dataset.unreadCount||0)>0;
      el.hidden=!!q&&!name.includes(q) || (mode==='unread'&&!unread);
    });
  };
  if($('#chatNotifyBtn'))$('#chatNotifyBtn').onclick=requestChatNotifications;
  if($('#chatActivityBtn'))$('#chatActivityBtn').onclick=()=>renderEcoChatActivity();
  if($('#chatGroupSearch'))$('#chatGroupSearch').oninput=applyGroupListFilter;
  document.querySelectorAll('[data-chat-list-filter]').forEach(b=>b.onclick=()=>{
    window.ecoChatListFilter=b.dataset.chatListFilter;
    document.querySelectorAll('[data-chat-list-filter]').forEach(x=>x.classList.toggle('active',x===b));
    applyGroupListFilter();
  });

  loadGroupUnreadBadges().then(applyGroupListFilter);
  loadChatGroupPreviews();

  if(state.chatGroup){
    openEcoChatGroup(state.chatGroup);
  }
}

async function renderEcoChatActivity(){
  if(state.profile.role!=='admin')return;
  pageMeta('Aktivitas EcoChat','Ringkasan komunikasi & moderasi');
  content.innerHTML='<div class="card"><div class="empty">Memuat aktivitas EcoChat...</div></div>';
  try{
    const snap=await getDocs(collection(db,'chatMessages'));
    const rows=snap.docs.map(d=>({id:d.id,...d.data()}));
    const today=todayKey();
    const todayRows=rows.filter(m=>String(m.createdAtISO||m.createdAt||'').slice(0,10)===today);
    const announcements=rows.filter(m=>m.type==='announcement'&&!m.deletedAt);
    const deleted=rows.filter(m=>m.deletedAt);
    const bots=rows.filter(m=>m.type==='bot'&&String(m.createdAtISO||'').slice(0,10)===today);
    const byGroup={};todayRows.forEach(m=>byGroup[m.groupId]=(byGroup[m.groupId]||0)+1);
    const active=Object.entries(byGroup).sort((a,b)=>b[1]-a[1]).slice(0,5);
    content.innerHTML=`<div class="section-head"><div><h3>💬 Pusat Aktivitas EcoChat</h3><small>Pemantauan komunikasi internal hari ini</small></div><button id="backEcoChat" class="btn secondary">← EcoChat</button></div>
      <div class="chat-activity-grid">
        <div><span>Pesan Hari Ini</span><b>${todayRows.length}</b></div>
        <div><span>Pengumuman Aktif</span><b>${announcements.length}</b></div>
        <div><span>EcoBot Hari Ini</span><b>${bots.length}</b></div>
        <div><span>Pesan Dimoderasi</span><b>${deleted.length}</b></div>
      </div>
      <div class="card"><h3>Grup Paling Aktif Hari Ini</h3><div class="activity-groups">${active.map(([id,n])=>`<button data-open-activity-group="${esc(id)}"><span>${esc(chatGroupById(id)?.name||id)}</span><b>${n} pesan</b></button>`).join('')||'<div class="empty">Belum ada aktivitas hari ini.</div>'}</div></div>
      <div class="card privacy-note"><b>🔐 Privasi</b><p>EcoChat menampilkan ringkasan komunikasi. Data individual siswa tidak dibagikan otomatis ke grup.</p></div>`;
    $('#backEcoChat').onclick=()=>{state.page='chat';state.chatGroup=null;renderShell()};
    document.querySelectorAll('[data-open-activity-group]').forEach(b=>b.onclick=()=>{state.page='chat';state.chatGroup=b.dataset.openActivityGroup;renderShell()});
  }catch(e){console.error(e);content.innerHTML='<div class="card"><div class="empty">Aktivitas belum dapat dimuat.</div></div>'}
}
async function loadChatGroupPreviews(){
  for(const g of availableChatGroups()){
    const el=document.querySelector(`[data-group-preview="${g.id}"]`);
    if(!el)continue;
    try{
      const snap=await getDocs(query(collection(db,'chatMessages'),where('groupId','==',g.id)));
      const rows=snap.docs.map(d=>({id:d.id,...d.data()}))
        .filter(m=>!m.deletedAt)
        .sort((a,b)=>String(b.createdAtISO||b.createdAt||'').localeCompare(String(a.createdAtISO||a.createdAt||'')));
      const last=rows[0];
      if(last){
        const who=last.type==='bot'?'EcoBot':(last.senderName||'Pesan');
        const txt=String(last.text||'').replace(/\s+/g,' ').trim();
        el.textContent=`${who}: ${txt.slice(0,70)}${txt.length>70?'…':''}`;
      }
    }catch(_){}
  }
}

async function loadGroupUnreadBadges(){
  for(const g of availableChatGroups()){
    try{
      const [snap,last]=await Promise.all([getDocs(query(collection(db,'chatMessages'),where('groupId','==',g.id))),getChatRead(g.id)]);
      const n=snap.docs.map(d=>d.data()).filter(m=>m.senderUid!==state.user.uid&&String(m.createdAt||'')>last).length;
      const el=document.querySelector(`[data-unread-group="${g.id}"]`);
      if(el){el.textContent=n?String(n):'';el.classList.toggle('show',n>0);const row=el.closest('.chat-group-item');if(row)row.dataset.unreadCount=String(n)}
    }catch(_){}
  }
}
function chatDisplayTime(m){
  const raw=m.createdAtISO||m.createdAt||'';
  try{
    const d=raw?.toDate?raw.toDate():new Date(raw);
    if(Number.isNaN(d.getTime()))return '';
    return d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
  }catch(_){return ''}
}
function formatChatText(text=''){
  return esc(text).replace(/(^|\s)(@[A-Za-zÀ-ÿ0-9._-]+)/g,'$1<span class="chat-mention">$2</span>').replace(/\n/g,'<br>');
}
function chatMessageAgeMinutes(m){
  const raw=m.createdAtISO||m.createdAt||'';
  try{const d=raw?.toDate?raw.toDate():new Date(raw);return (Date.now()-d.getTime())/60000}catch(_){return 999999}
}
function chatMessageCanOwnEdit(m){
  return m.senderUid===state.user.uid && m.type==='text' && !m.deletedAt && chatMessageAgeMinutes(m)<=15;
}
function chatMessageCanOwnDelete(m){
  return m.senderUid===state.user.uid && m.type!=='bot' && m.type!=='announcement';
}
function setChatReply(m){
  window.ecoChatReply={id:m.id,senderName:m.senderName||'Pengguna',text:String(m.text||'').slice(0,180)};
  window.ecoChatEdit=null;
  renderChatComposerState();
  $('#chatText')?.focus();
}
function clearChatReply(){
  window.ecoChatReply=null;
  renderChatComposerState();
}
function renderChatComposerState(){
  const host=$('#chatComposerState');if(!host)return;
  const r=window.ecoChatReply,e=window.ecoChatEdit;
  if(e){
    host.innerHTML=`<div class="composer-context"><div><b>✎ Edit pesan</b><small>${esc(String(e.text||'').slice(0,110))}</small></div><button id="cancelChatContext">×</button></div>`;
  }else if(r){
    host.innerHTML=`<div class="composer-context"><div><b>↩ Balas ${esc(r.senderName)}</b><small>${esc(r.text)}</small></div><button id="cancelChatContext">×</button></div>`;
  }else host.innerHTML='';
  if($('#cancelChatContext'))$('#cancelChatContext').onclick=()=>{window.ecoChatReply=null;window.ecoChatEdit=null;renderChatComposerState()};
}
async function ensureEcoBotMessages(groupId){
  if(state.profile.role!=='admin' || groupId!=='all-teachers')return;
  try{
    const op=operationalInfo();if(!op.active)return;
    const now=new Date(),done=new Set(state.recordsToday.map(r=>r.classId));
    const missing=state.classes.filter(c=>!done.has(c));
    const cleanClasses=new Set(state.cleanlinessToday.map(r=>r.classId));
    const wt=wadahTimeInfo();

    // Ringkasan harian: maksimal satu pesan per hari.
    const dailyKey=`ecobot_${todayKey()}_daily`;
    const dailyRef=doc(db,'chatMessages',dailyKey),dailyOld=await getDoc(dailyRef);
    if(!dailyOld.exists()){
      const text=[
        `Status EcoTrack hari ini`,
        `🍱 Wadah: ${done.size}/${state.classes.length} kelas selesai`,
        missing.length?`Belum pendataan: ${missing.join(' • ')}`:'Semua kelas sudah melakukan pendataan.',
        `✨ Kebersihan: ${cleanClasses.size}/${state.classes.length} kelas sudah diperiksa minimal 1 JP`,
        `⏱ Pendataan Wadah ditutup pukul ${wt.label}`
      ].join('\\n');
      await setDoc(dailyRef,{
        groupId:'all-teachers',type:'bot',text,
        senderUid:'ecobot',senderName:'EcoBot',senderLabel:'Sistem',
        createdAtISO:now.toISOString(),createdAtMs:now.getTime(),botKey:dailyKey,pinned:false
      });
    }

    // Pengingat 45 menit terakhir sebelum penutupan jika masih ada kelas belum input.
    const minuteNow=now.getHours()*60+now.getMinutes();
    const remaining=wt.close-minuteNow;
    if(missing.length && remaining>0 && remaining<=45){
      const remindKey=`ecobot_${todayKey()}_deadline`;
      const remindRef=doc(db,'chatMessages',remindKey),remindOld=await getDoc(remindRef);
      if(!remindOld.exists()){
        const text=`⏰ Pendataan Wadah ditutup ${remaining} menit lagi.
${missing.length} kelas belum selesai: ${missing.join(' • ')}
Mohon dilengkapi sebelum pukul ${wt.label}.`;
        await setDoc(remindRef,{
          groupId:'all-teachers',type:'bot',text,
          senderUid:'ecobot',senderName:'EcoBot',senderLabel:'Sistem',
          createdAtISO:now.toISOString(),createdAtMs:now.getTime(),botKey:remindKey,pinned:false
        });
      }
    }
  }catch(e){console.warn('EcoBot',e)}
}
function openEcoChatGroup(groupId){
  const g=chatGroupById(groupId),target=$('#chatRoomBody');if(!g||!target)return;
  if(state.chatUnsub){state.chatUnsub();state.chatUnsub=null}
  if(state.chatReactionUnsub){state.chatReactionUnsub();state.chatReactionUnsub=null}
  if(window.ecoBotTimer){clearInterval(window.ecoBotTimer);window.ecoBotTimer=null}
  window.ecoChatReply=null;window.ecoChatEdit=null;

  target.innerHTML=`<div class="chat-room-head"><button class="chat-mobile-back" id="chatMobileBack">←</button><span class="chat-group-icon">${g.icon}</span><div><b>${esc(g.name)}</b><small>${esc(g.desc)}</small></div>${state.profile.role==='admin'&&groupId==='all-teachers'?'<button id="runEcoBot" class="btn-mini chat-bot-btn">🤖 EcoBot</button>':''}</div>
    <div id="chatPinned" class="chat-pinned hidden"></div>
    <div id="chatMessages" class="chat-messages"><div class="empty">Memuat pesan...</div></div>
    ${chatCanSend(groupId)?`<div class="chat-composer-wrap"><div id="chatComposerState"></div><div class="chat-composer"><textarea id="chatText" rows="1" maxlength="1500" placeholder="${groupId==='announcements'?'Tulis pengumuman resmi...':'Tulis pesan... gunakan @nama untuk mention'}"></textarea><button id="sendChat" class="chat-send">➤</button></div></div>`:`<div class="chat-readonly">📢 Hanya Administrator yang dapat mengirim pengumuman.</div>`}`;

  if($('#chatMobileBack'))$('#chatMobileBack').onclick=()=>{
    state.chatGroup=null;
    ecoChatPage();
  };
  if($('#sendChat'))$('#sendChat').onclick=()=>sendEcoChatMessage(groupId);
  if($('#chatText')){
    $('#chatText').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendEcoChatMessage(groupId)}};
    $('#chatText').onfocus=()=>{
      document.documentElement.classList.add('ecochat-input-focused');
    };
    $('#chatText').onblur=()=>{
      document.documentElement.classList.remove('ecochat-input-focused');
    };
  }
  if($('#runEcoBot'))$('#runEcoBot').onclick=async()=>{await ensureEcoBotMessages(groupId);toast('EcoBot memperbarui ringkasan jika belum dibuat hari ini.')};

  let messages=[],reactions=[];
  const draw=()=>renderEcoMessages(groupId,messages,reactions);
  ensureEcoBotMessages(groupId);
  if(state.profile.role==='admin'&&groupId==='all-teachers'){
    window.ecoBotTimer=setInterval(()=>ensureEcoBotMessages(groupId),60000);
  }
  state.chatUnsub=onSnapshot(query(collection(db,'chatMessages'),where('groupId','==',groupId)),snap=>{
    messages=snap.docs.map(d=>({id:d.id,...d.data()}))
      .sort((a,b)=>String(a.createdAtISO||a.createdAt||'').localeCompare(String(b.createdAtISO||b.createdAt||''))).slice(-180);
    draw();markChatRead(groupId).then(()=>refreshChatUnread());
  },e=>{$('#chatMessages').innerHTML='<div class="empty">Pesan belum dapat dimuat. Pastikan Firestore Rules EcoChat v2 sudah dipublish.</div>';console.error(e)});
  state.chatReactionUnsub=onSnapshot(query(collection(db,'chatReactions'),where('groupId','==',groupId)),snap=>{
    reactions=snap.docs.map(d=>({id:d.id,...d.data()}));draw();
  },()=>{});
}
function renderEcoMessages(groupId,messages,reactions){
  const target=$('#chatMessages');if(!target)return;
  const pinHost=$('#chatPinned');
  const pinned=[...messages].filter(m=>m.pinned===true&&!m.deletedAt).slice(-1)[0];
  if(pinHost){
    pinHost.classList.toggle('hidden',!pinned);
    pinHost.innerHTML=pinned?`<span>📌</span><div><b>${esc(pinned.senderName||'Pesan dipin')}</b><small>${esc(String(pinned.text||'').slice(0,150))}</small></div>`:'';
  }
  if(!messages.length){target.innerHTML='<div class="chat-empty"><span>💬</span><b>Belum ada pesan</b><small>Mulai komunikasi EcoTrack di grup ini.</small></div>';return;}

  const rx=messageId=>{
    const r=reactions.filter(x=>x.messageId===messageId),map={};
    r.forEach(x=>map[x.type]=(map[x.type]||0)+1);
    return Object.entries(map).map(([k,n])=>`<button class="reaction-chip" data-react-msg="${messageId}" data-react="${k}">${k} ${n}</button>`).join('');
  };
  target.innerHTML=messages.map(m=>{
    const mine=m.senderUid===state.user.uid,announcement=m.type==='announcement',bot=m.type==='bot',deleted=!!m.deletedAt;
    const admin=state.profile.role==='admin';
    const menu=!deleted?`<div class="message-actions">
      ${chatCanSend(groupId)?`<button data-chat-reply="${m.id}" title="Balas">↩</button>`:''}
      ${admin?`<button data-chat-edit="${m.id}" title="Edit">✎</button><button data-chat-pin="${m.id}" title="${m.pinned?'Lepas pin':'Pin'}">${m.pinned?'📍':'📌'}</button><button data-chat-delete="${m.id}" title="Hapus">🗑</button>`:
        chatMessageCanOwnDelete(m)?`${chatMessageCanOwnEdit(m)?`<button data-chat-edit-own="${m.id}" title="Edit pesan (maks. 15 menit)">✎</button>`:''}<button data-chat-delete-own="${m.id}" title="Hapus pesan sendiri">🗑</button>`:''}
    </div>`:'';
    const reply=m.replyTo&&!deleted?`<button class="reply-quote" data-jump-msg="${esc(m.replyTo.id||'')}"><b>${esc(m.replyTo.senderName||'Pesan')}</b><span>${esc(String(m.replyTo.text||'').slice(0,120))}</span></button>`:'';
    return `<article id="msg-${esc(m.id)}" class="chat-message ${mine?'mine':''} ${announcement?'announcement-message':''} ${bot?'bot-message':''} ${deleted?'deleted-message':''}">
      ${!mine?`<div class="message-avatar">${bot?'🤖':esc((m.senderName||'?').charAt(0).toUpperCase())}</div>`:''}
      <div class="message-body"><div class="message-meta"><b>${esc(m.senderName||'Pengguna')}</b><span>${esc(m.senderLabel||'')}</span>${m.editedAt?'<em>diedit</em>':''}<time>${chatDisplayTime(m)}</time>${menu}</div>
      ${announcement?'<span class="announcement-label">📢 PENGUMUMAN</span>':''}${bot?'<span class="bot-label">🤖 ECOBOT • SISTEM</span>':''}
      ${deleted?`<div class="message-bubble deleted-bubble">${m.deletedByRole==='self'?'Pesan telah dihapus':'Pesan dihapus oleh Admin'}</div>`:`${reply}<div class="message-bubble">${formatChatText(m.text||'')}</div>
      <div class="message-reactions">${rx(m.id)}<button class="reaction-add" data-react-msg="${m.id}" data-react="👍">👍</button><button class="reaction-add" data-react-msg="${m.id}" data-react="✅">✅</button><button class="reaction-add" data-react-msg="${m.id}" data-react="👀">👀</button></div>`}</div>
    </article>`;
  }).join('');

  target.querySelectorAll('[data-react-msg]').forEach(b=>b.onclick=()=>toggleChatReaction(groupId,b.dataset.reactMsg,b.dataset.react));
  target.querySelectorAll('[data-chat-reply]').forEach(b=>b.onclick=()=>{const m=messages.find(x=>x.id===b.dataset.chatReply);if(m)setChatReply(m)});
  target.querySelectorAll('[data-chat-edit]').forEach(b=>b.onclick=()=>{const m=messages.find(x=>x.id===b.dataset.chatEdit);if(m)beginAdminEditMessage(m)});
  target.querySelectorAll('[data-chat-edit-own]').forEach(b=>b.onclick=()=>{const m=messages.find(x=>x.id===b.dataset.chatEditOwn);if(m)beginOwnEditMessage(m)});
  target.querySelectorAll('[data-chat-delete]').forEach(b=>b.onclick=()=>{const m=messages.find(x=>x.id===b.dataset.chatDelete);if(m)adminDeleteChatMessage(m)});
  target.querySelectorAll('[data-chat-delete-own]').forEach(b=>b.onclick=()=>{const m=messages.find(x=>x.id===b.dataset.chatDeleteOwn);if(m)deleteOwnChatMessage(m)});
  target.querySelectorAll('[data-chat-pin]').forEach(b=>b.onclick=()=>{const m=messages.find(x=>x.id===b.dataset.chatPin);if(m)adminTogglePinMessage(m)});
  target.querySelectorAll('[data-jump-msg]').forEach(b=>b.onclick=()=>{const el=document.getElementById(`msg-${b.dataset.jumpMsg}`);if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('message-flash');setTimeout(()=>el.classList.remove('message-flash'),1200)}});
  target.scrollTop=target.scrollHeight;
}
function beginOwnEditMessage(m){
  if(!chatMessageCanOwnEdit(m))return toast('Batas waktu edit pesan adalah 15 menit');
  window.ecoChatEdit={...m,ownEdit:true};
  window.ecoChatReply=null;
  const input=$('#chatText');if(input){input.value=m.text||'';input.focus()}
  renderChatComposerState();
}
async function saveOwnEditMessage(groupId){
  const e=window.ecoChatEdit,input=$('#chatText'),text=String(input?.value||'').trim();
  if(!e?.ownEdit||!chatMessageCanOwnEdit(e)||!text)return toast('Pesan tidak dapat diedit');
  try{
    await setDoc(doc(db,'chatMessages',e.id),{
      text,editedAt:new Date().toISOString(),editedByUid:state.user.uid,editedByName:state.profile.name
    },{merge:true});
    window.ecoChatEdit=null;input.value='';renderChatComposerState();toast('Pesan diperbarui');
  }catch(err){console.error(err);toast('Gagal mengedit pesan')}
}
function beginAdminEditMessage(m){
  if(state.profile.role!=='admin'||m.deletedAt||m.type==='bot')return;
  window.ecoChatEdit={...m};
  window.ecoChatReply=null;
  const input=$('#chatText');if(input){input.value=m.text||'';input.focus()}
  renderChatComposerState();
}
async function adminSaveEditMessage(groupId){
  const e=window.ecoChatEdit,input=$('#chatText'),text=String(input?.value||'').trim();
  if(!e||state.profile.role!=='admin'||!text)return;
  try{
    const now=new Date();
    await setDoc(doc(db,'chatMessages',e.id),{text,editedAt:now.toISOString(),editedByUid:state.user.uid,editedByName:state.profile.name},{merge:true});
    await addAdminAudit('EDIT_CHAT_MESSAGE',{messageId:e.id,groupId,ownerUid:e.senderUid,ownerName:e.senderName,oldText:e.text,newText:text});
    window.ecoChatEdit=null;input.value='';renderChatComposerState();toast('Pesan berhasil diedit');
  }catch(err){console.error(err);toast('Gagal mengedit pesan')}
}
async function adminDeleteChatMessage(m){
  if(state.profile.role!=='admin')return;
  if(!confirm(`Hapus pesan dari ${m.senderName||'pengguna'}?\n\nIsi lama tetap tercatat di Audit Log Admin.`))return;
  try{
    const now=new Date();
    await setDoc(doc(db,'chatMessages',m.id),{
      deletedAt:now.toISOString(),deletedByUid:state.user.uid,deletedByName:state.profile.name,
      deletedOriginalText:m.text||'',text:''
    },{merge:true});
    await addAdminAudit('DELETE_CHAT_MESSAGE',{messageId:m.id,groupId:m.groupId,ownerUid:m.senderUid,ownerName:m.senderName,originalText:m.text||''});
    toast('Pesan dihapus');
  }catch(e){console.error(e);toast('Gagal menghapus pesan')}
}
async function deleteOwnChatMessage(m){
  if(!chatMessageCanOwnDelete(m))return;
  if(!confirm('Hapus pesan Anda? Pesan akan ditandai sebagai telah dihapus.'))return;
  try{
    await setDoc(doc(db,'chatMessages',m.id),{
      deletedAt:new Date().toISOString(),deletedByUid:state.user.uid,deletedByName:state.profile.name,
      deletedByRole:'self',text:''
    },{merge:true});
    toast('Pesan telah dihapus');
  }catch(e){console.error(e);toast('Gagal menghapus pesan')}
}
async function adminTogglePinMessage(m){
  if(state.profile.role!=='admin'||m.deletedAt)return;
  try{
    const next=!(m.pinned===true);
    await setDoc(doc(db,'chatMessages',m.id),{pinned:next,pinnedAt:next?new Date().toISOString():null,pinnedByUid:next?state.user.uid:null},{merge:true});
    await addAdminAudit(next?'PIN_CHAT_MESSAGE':'UNPIN_CHAT_MESSAGE',{messageId:m.id,groupId:m.groupId,ownerName:m.senderName});
  }catch(e){console.error(e);toast('Gagal mengubah pin')}
}
async function sendEcoChatMessage(groupId){
  if(window.ecoChatEdit)return window.ecoChatEdit.ownEdit?saveOwnEditMessage(groupId):adminSaveEditMessage(groupId);
  const input=$('#chatText'),text=String(input?.value||'').trim();if(!text)return;
  if(!chatCanSend(groupId))return toast('Anda tidak memiliki akses mengirim di grup ini');
  const btn=$('#sendChat');if(btn)btn.disabled=true;
  try{
    const now=new Date(),id=`${now.getTime()}_${state.user.uid}_${Math.random().toString(36).slice(2,7)}`;
    const label=state.profile.role==='admin'?'Admin':state.profile.isHomeroom?`Wali Kelas ${state.profile.homeroomClass||''}`:'Guru';
    const reply=window.ecoChatReply?{...window.ecoChatReply}:null;
    await setDoc(doc(db,'chatMessages',id),{
      groupId,type:groupId==='announcements'?'announcement':'text',text,
      senderUid:state.user.uid,senderName:state.profile.name||state.profile.loginId||'Pengguna',senderLabel:label,
      createdAtISO:now.toISOString(),createdAtMs:now.getTime(),replyTo:reply,pinned:false
    });
    input.value='';window.ecoChatReply=null;renderChatComposerState();
  }catch(e){console.error(e);toast('Pesan gagal dikirim. Periksa Firestore Rules.')}
  if(btn)btn.disabled=false;
}
async function toggleChatReaction(groupId,messageId,type){
  try{
    const safeType=type==='👍'?'like':type==='✅'?'done':type==='👀'?'seen':'react';
    const id=`${messageId}_${state.user.uid}_${safeType}`;

    // Penting: jangan GET dokumen reaksi yang belum ada.
    // Rules read menggunakan resource.data.groupId; GET terhadap dokumen non-existent
    // dapat menghasilkan permission-denied. Cari reaksi pengguna dari snapshot/query grup.
    const snap=await getDocs(query(collection(db,'chatReactions'),where('groupId','==',groupId)));
    const existing=snap.docs.map(d=>({id:d.id,...d.data()}))
      .find(r=>r.messageId===messageId && r.uid===state.user.uid && r.type===type);

    if(existing){
      await deleteDoc(doc(db,'chatReactions',existing.id));
    }else{
      await setDoc(doc(db,'chatReactions',id),{
        groupId,messageId,type,uid:state.user.uid,
        name:state.profile.name||'',createdAt:new Date().toISOString()
      });
    }
  }catch(e){
    console.error('Reaction error',e);
    toast('Reaksi belum dapat disimpan. Pastikan Rules terbaru sudah dipublish.');
  }
}
function teacherWadahLocked(){
  if(state.profile?.role==='admin') return false;
  const op=operationalInfo();
  if(!op.active) return true;
  return !wadahTimeInfo().open;
}

function inactiveModuleCard(moduleType,reason){
  const isWadah=moduleType==='wadah';
  const title=isWadah?'Wadah Makan & Tumbler':'Kebersihan Kelas';
  const desc=isWadah
    ? 'Pendataan Wadah Makan & Tumbler tidak tersedia hari ini.'
    : 'Pemeriksaan Kebersihan Kelas tidak tersedia hari ini.';
  const icon=isWadah?'🌿':'🌿';
  return `<div class="inactive-state-wrap">
    <div class="card inactive-state-card">
      <div class="inactive-state-icon">${icon}</div>
      <span class="inactive-state-kicker">${esc(title)}</span>
      <h3>Hari Tidak Aktif</h3>
      <div class="inactive-reason">${esc(reason||'Jadwal tidak aktif')}</div>
      <p>${esc(desc)}</p>
      <small>Data sebelumnya tetap dapat dilihat melalui menu Rekap.</small>
    </div>
  </div>`;
}
function inputPage(){
  pageMeta('Wadah Makan & Tumbler','Pilih kelas lalu tandai kondisi siswa');
  const op=operationalInfo();
  if(!op.active){
    content.innerHTML=inactiveModuleCard('wadah',op.label);
    return;
  }

  const wt=wadahTimeInfo();
  const admin=state.profile.role==='admin';
  const closed=teacherWadahLocked();

  if(!state.selectedClass){
    content.innerHTML=`
      ${closed?`<div class="card wadah-closed-banner"><div class="lock-icon">🔒</div><div><h3>Pendataan Hari Ini Sudah Ditutup</h3><p>Waktu pengisian berakhir pukul <b>${esc(wt.label)}</b>. Data yang sudah masuk tetap dapat dilihat, tetapi Guru/Wali Kelas tidak dapat membuat atau mengedit pendataan lagi.</p></div></div>`:
      `<div class="wadah-open-info">🟢 Pendataan dibuka sampai <b>${esc(wt.label)}</b></div>`}
      <div class="card"><h3>Pilih Kelas</h3><div class="grid class-grid">${state.classes.map(c=>{
        const r=classRecord(c);
        return `<button class="class-btn ${r?'done':'pending'} ${closed&&!r?'locked':''}" data-class="${c}" ${closed&&!r?'disabled':''}><b>${c}</b><small>${r?'Sudah didata':closed?'🔒 Ditutup':'Belum didata'}</small></button>`;
      }).join('')}</div></div>`;
    bindClassButtons();
    return;
  }
  loadClassForm(state.selectedClass);
}
async function loadClassForm(c){
  if(teacherWadahLocked() && !classRecord(c)){
    state.selectedClass=null;
    toast(`🔒 Pendataan sudah ditutup pukul ${wadahTimeInfo().label}`);
    inputPage();
    return;
  }
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
    window.originalRecord=existing||null;
    const isAdmin=state.profile.role==='admin';
    const isCreator=!!(existing && existing.createdByUid===state.user.uid);
    const teacherEditUsed=Number(existing?.teacherEditCount||0)>=1;
    const wt=wadahTimeInfo();
    const timeClosed=teacherWadahLocked();
    // Setelah jam tutup, seluruh form Guru/Wali Kelas terkunci.
    // Sebelum jam tutup, pembuat data mendapat tepat 1x edit.
    window.wadahTimeClosed=timeClosed;
    window.wadahCloseLabel=wt.label;
    window.formLocked=!!(!isAdmin && (timeClosed || (existing && (!isCreator || teacherEditUsed))));
    window.teacherCanEditOnce=!!(existing && !isAdmin && !timeClosed && isCreator && !teacherEditUsed);
    renderClassForm(c);
  }catch(e){ console.error(e); content.innerHTML='<div class="card"><div class="empty">Gagal memuat siswa. Periksa Firestore Rules dan koneksi.</div></div>'; }
}
function renderClassForm(c){
  const existing=window.originalRecord;
  content.innerHTML=`<div class="section-head"><div><h3 style="margin:0">Kelas ${c}</h3><small>${existing?`Sudah didata oleh ${esc(existing.createdByName||'Guru')} • ${esc(existing.timeLabel||'-')}`:'Belum pernah disimpan hari ini'}</small></div><button class="btn ghost" id="backClasses">← Pilih kelas lain</button></div>
  ${window.formLocked?`<div class="notice ${window.wadahTimeClosed?'wadah-time-lock':''}">${state.profile.role==='admin'?'Administrator dapat melakukan koreksi.':window.wadahTimeClosed?`🔒 Waktu pendataan sudah berakhir pukul <b>${esc(window.wadahCloseLabel||'-')}</b>. Form hanya dapat dilihat.`:(window.originalRecord?.createdByUid===state.user.uid?'Kesempatan edit 1× untuk pendataan ini sudah digunakan. Data sekarang terkunci.':'Data dibuat oleh guru lain dan tidak dapat diedit dari akun ini.')}</div>`:''}
  ${window.teacherCanEditOnce?'<div class="notice edit-once-note">Anda memiliki <b>1 kali kesempatan edit</b> setelah data pertama dikirim. Setelah disimpan kembali, data akan terkunci.</div>':''}${window.rosterChanged?'<div class="notice">Daftar siswa aktif kelas ini berubah sejak pendataan terakhir. Form sudah disesuaikan dengan master siswa terbaru tanpa menghapus status siswa yang masih terdaftar.</div>':''}
  <div class="card attendance-card">
    <div class="wadah-sticky-tools">
      <div class="toolbar wadah-bulk"><button class="btn secondary bulk" data-bulk="presence">✓ Semua Hadir</button><button class="btn secondary bulk" data-bulk="food">🥡 Semua Bawa Wadah</button><button class="btn secondary bulk" data-bulk="tumbler">💧 Semua Bawa Tumbler</button></div>
      <div id="wadahSummary" class="wadah-summary"></div>
    </div>
    <div id="studentRows" class="student-card-list"></div>
    <div class="wadah-save-bar"><div id="wadahSaveSummary" class="save-summary"></div><button id="saveBtn" class="btn primary" ${window.formLocked?'disabled':''}>${window.wadahTimeClosed?'🔒 Pendataan Ditutup':`Simpan Data ${c}`}</button></div>
  </div>`;
  $('#backClasses').onclick=()=>{state.selectedClass=null;renderPage()};  document.querySelectorAll('.bulk').forEach(b=>b.onclick=()=>setAll(b.dataset.bulk));
  if($('#saveBtn')&&!window.formLocked) $('#saveBtn').onclick=()=>saveClass(c); renderStudentRows();
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
        <button type="button" class="carry-choice ${i.food&&hadir?'active':''}" data-toggle="food" data-index="${idx}" ${(!hadir||window.formLocked)?'disabled':''}><span>🥡</span><b>Wadah Makan</b><small>${i.food&&hadir?'Membawa':'Tidak'}</small></button>
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
  const wt=wadahTimeInfo(); if(teacherWadahLocked()){toast(`🔒 Pendataan sudah ditutup pukul ${wt.label}`);return;}
  if(!window.formItems?.length){toast('Belum ada siswa di kelas ini');return;}
  const btn=$('#saveBtn');btn.disabled=true;btn.textContent='Menyimpan...';
  try{
    const id=`${todayKey()}_${c}`; const old=window.originalRecord; const now=new Date();
    const audit=[...(old?.audit||[])]; if(old) audit.push({editedAt:now.toISOString(),editedByUid:state.user.uid,editedByName:state.profile.name});
    const isTeacherEdit=!!(old && state.profile.role!=='admin' && old.createdByUid===state.user.uid);
    const teacherEditCount=isTeacherEdit?Number(old.teacherEditCount||0)+1:Number(old?.teacherEditCount||0);
    if(isTeacherEdit && teacherEditCount>1) throw new Error('Kesempatan edit 1× sudah digunakan');
    const payload={date:todayKey(),classId:c,items:window.formItems,
      createdByUid:old?.createdByUid||state.user.uid,createdByName:old?.createdByName||state.profile.name,createdAt:old?.createdAt||now.toISOString(),
      teacherEditCount,
      teacherEditedAt:isTeacherEdit?now.toISOString():(old?.teacherEditedAt||null),
      lastEditedByUid:state.user.uid,lastEditedByName:state.profile.name,lastEditedAt:now.toISOString(),timeLabel:now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}),audit};
    if(teacherWadahLocked()) throw new Error(`Pendataan sudah ditutup pukul ${wadahTimeInfo().label}`);
    await setDoc(doc(db,'records',id),payload,{merge:false});
    await refreshCore(); toast(`Data ${c} berhasil disimpan`); state.selectedClass=null; renderPage();
  }catch(e){ console.error(e); toast(e.message||'Gagal menyimpan data'); btn.disabled=false;btn.textContent=`Simpan Data ${c}`; }
}



function wadahTimeInfo(){
  const n=new Date(),d=n.getDay(),m=n.getHours()*60+n.getMinutes();
  const cfg=state.operationalSettings||{};
  const hhmmToMin=(v,fallback)=>{
    const x=String(v||fallback).split(':').map(Number);
    return Number.isFinite(x[0])&&Number.isFinite(x[1])?x[0]*60+x[1]:0;
  };
  if(d>=1&&d<=4){
    const hardClose=14*60+10;
    const configured=hhmmToMin(cfg.wadahCloseMonThu,'14:10');
    const close=Math.min(hardClose,configured||hardClose);
    return {open:m<close,close,label:`${String(Math.floor(close/60)).padStart(2,'0')}.${String(close%60).padStart(2,'0')}`};
  }
  if(d===5){
    const hardClose=11*60+30;
    const configured=hhmmToMin(cfg.wadahCloseFri,'11:30');
    const close=Math.min(hardClose,configured||hardClose);
    return {open:m<close,close,label:`${String(Math.floor(close/60)).padStart(2,'0')}.${String(close%60).padStart(2,'0')}`};
  }
  return {open:false,close:0,label:'Hari libur'};
}
async function addAdminAudit(action, detail={}){
  if(state.profile?.role!=='admin')return;
  try{
    const now=new Date(), id=`${now.getTime()}_${state.user.uid}`;
    await setDoc(doc(db,'auditLogs',id),{
      action,detail,adminUid:state.user.uid,adminName:state.profile.name||'Admin',
      createdAt:now.toISOString(),date:todayKey()
    });
  }catch(e){console.warn('Audit log gagal',e)}
}
function jpScheduleInfo(){
  const now=new Date(),day=now.getDay(),mins=now.getHours()*60+now.getMinutes();
  const o=state.operationalSettings||{};
  const toMin=(v,f)=>{const a=String(v||f).split(':').map(Number);return a[0]*60+a[1]};
  const duration=Math.max(20,Math.min(60,Number(o.jpDuration||40)));
  let start,count,breaks=[];
  if(day>=1&&day<=4){
    start=toMin(o.jpStartMonThu,'07:10');count=9;
    breaks=[
      {after:Number(o.break1AfterMonThu||4),duration:Number(o.break1DurationMonThu||20)},
      {after:Number(o.break2AfterMonThu||7),duration:Number(o.break2DurationMonThu||40)}
    ];
  }else if(day===5){
    start=toMin(o.jpStartFri,'07:50');count=5;
    breaks=[{after:Number(o.breakAfterFri||3),duration:Number(o.breakDurationFri||20)}];
  }else return {active:false,day,mins,items:[]};
  const items=[];let cursor=start;
  for(let i=1;i<=count;i++){
    items.push({jp:i,start:cursor,end:cursor+duration});
    cursor+=duration;
    const br=breaks.find(b=>b.after===i);
    if(br)cursor+=Math.max(0,br.duration);
  }
  return {active:true,day,mins,items,duration};
}
function jpTimeState(jp){
  const sc=jpScheduleInfo(), x=sc.items.find(v=>v.jp===Number(jp));
  if(!sc.active||!x)return {code:'closed',label:'Tidak tersedia',canAssess:false};
  if(sc.mins<x.start)return {code:'future',label:'Belum Dibuka',canAssess:false,start:x.start,end:x.end};
  if(sc.mins>=x.end)return {code:'missed',label:'Terlewat',canAssess:false,start:x.start,end:x.end};
  return {code:'open',label:'Bisa Diperiksa',canAssess:true,start:x.start,end:x.end};
}
function hm(m){return String(Math.floor(m/60)).padStart(2,'0')+'.'+String(m%60).padStart(2,'0')}

function cleanlinessPage(){
  pageMeta('Kebersihan Kelas','Pantau kelas yang sudah dan belum diperiksa hari ini');
  const op=operationalInfo(); if(!op.active){content.innerHTML=inactiveModuleCard('clean',op.label);return;}
  window.cleanClassFilter=window.cleanClassFilter||'all';
  const own=state.profile.isHomeroom===true&&state.profile.role!=='admin'?String(state.profile.homeroomClass||''):'',ownAllowed=state.accessSettings?.homeroomCleanlinessEnabled===true;
  const stat=c=>{const rows=state.cleanlinessToday.filter(r=>r.classId===c),n=new Set(rows.map(r=>Number(r.jp))).size;return{rows,n}};
  const visible=state.classes.filter(c=>{const n=stat(c).n;return window.cleanClassFilter==='none'?n===0:window.cleanClassFilter==='done'?n>0:window.cleanClassFilter==='complete'?n>=op.jp:true});
  content.innerHTML=`<div class="clean-hero card"><div><span class="eyebrow">🧹 MODUL KEBERSIHAN</span><h3>Pemeriksaan Kebersihan Kelas</h3><p>Pilih kelas untuk melihat status setiap JP. JP yang sudah dinilai terkunci untuk guru lain.</p></div></div>
  <div class="clean-filterbar">${[['all','Semua'],['none','Belum Dinilai'],['done','Sudah Dinilai'],['complete','Lengkap']].map(x=>`<button class="clean-filter ${window.cleanClassFilter===x[0]?'active':''}" data-clean-filter="${x[0]}">${x[1]}</button>`).join('')}</div>
  <div class="grid clean-class-grid">${visible.map(c=>{const x=stat(c),locked=own&&c===own&&!ownAllowed,p=Math.round(x.n/op.jp*100);return `<button class="clean-class-card ${x.n===0?'not-started':x.n>=op.jp?'complete':'in-progress'} ${locked?'own-locked':''}" data-clean-class="${esc(c)}"><div class="class-card-top"><strong>${esc(c)}</strong><span>${x.n}/${op.jp} JP</span></div><div class="clean-progress"><i style="width:${p}%"></i></div><div class="clean-card-status">${locked?'🔒 Kelas wali sendiri belum dibuka':x.n===0?'Belum dinilai sama sekali':x.n>=op.jp?'Semua JP sudah dinilai':`${x.n} JP sudah dinilai`}</div></button>`}).join('')||'<div class="empty">Tidak ada kelas pada filter ini.</div>'}</div>`;
  document.querySelectorAll('[data-clean-filter]').forEach(b=>b.onclick=()=>{window.cleanClassFilter=b.dataset.cleanFilter;cleanlinessPage()});
  document.querySelectorAll('[data-clean-class]').forEach(b=>b.onclick=()=>renderCleanClass(b.dataset.cleanClass));
}
function renderCleanClass(classId){
  const op=operationalInfo(), sc=jpScheduleInfo(), own=state.profile.isHomeroom===true&&state.profile.role!=='admin'?String(state.profile.homeroomClass||''):'',ownLocked=!!(own&&classId===own&&state.accessSettings?.homeroomCleanlinessEnabled!==true);
  const rows=state.cleanlinessToday.filter(r=>r.classId===classId),byJp=Object.fromEntries(rows.map(r=>[Number(r.jp),r]));
  pageMeta(`Kebersihan ${classId}`,`Status pemeriksaan per JP hari ini`);
  const total=sc.active?sc.items.length:op.jp;
  content.innerHTML=`<div class="section-head"><div><h3 style="margin:0">Kelas ${esc(classId)}</h3><small>${rows.length} dari ${total} JP sudah diperiksa</small></div><div class="row-actions">${state.profile.role==='admin'&&rows.length?`<button id="resetCleanClass" class="btn danger">Reset Kebersihan Kelas</button>`:''}<button id="backCleanClasses" class="btn ghost">← Daftar Kelas</button></div></div>
  ${ownLocked?`<div class="notice">🔒 Pemeriksaan kelas wali sendiri belum dibuka Admin.</div>`:''}
  ${state.profile.role==='admin'?`<div class="card admin-reset-panel"><div><b>♻️ Reset Kebersihan</b><small>Pilih JP yang sudah diperiksa untuk mereset satu JP, atau reset seluruh pemeriksaan kelas hari ini.</small></div><div class="admin-reset-actions"><select id="resetCleanJpSelect"><option value="">Pilih JP yang sudah diperiksa</option>${rows.sort((a,b)=>Number(a.jp)-Number(b.jp)).map(r=>`<option value="${esc(r.id)}">JP ${r.jp} • ${esc(r.createdByName||'Guru')}</option>`).join('')}</select><button id="resetSelectedCleanJp" class="btn secondary" ${rows.length?'':'disabled'}>Reset JP Terpilih</button><button id="resetAllCleanClass" class="btn danger" ${rows.length?'':'disabled'}>Reset Semua JP Kelas ${esc(classId)}</button></div></div>`:''}
  <div class="schedule-note">⏱️ Pemeriksaan hanya dapat dibuat selama JP sedang berlangsung. JP yang lewat otomatis terkunci.</div>
  <div class="jp-status-grid">${Array.from({length:total},(_,i)=>{
    const jp=i+1,r=byJp[jp],ts=jpTimeState(jp),time=ts.start!=null?`${hm(ts.start)}–${hm(ts.end)}`:'';
    if(r){
      const mine=r.createdByUid===state.user.uid,used=Number(r.teacherEditCount||0)>=1,admin=state.profile.role==='admin',can=admin||(mine&&!used&&ts.canAssess),st=cleanOverall(r);
      return `<div class="jp-card-wrap"><button class="jp-card assessed ${can?'editable':'locked'}" data-edit-clean="${esc(r.id)}" ${can?'':'disabled'}><b>JP ${jp}</b><span>${time}</span><span class="${st.cls}-text">✓ Sudah Diperiksa</span><small>${esc(r.createdByName||'Guru')}${admin?' • Koreksi Admin':mine&&!used&&ts.canAssess?' • Edit 1× tersedia':mine&&!used?' • Waktu edit berakhir':' • Terkunci'}</small></button>${admin?`<button class="btn-mini danger clean-reset-jp" data-reset-clean="${esc(r.id)}">Reset JP ${jp}</button>`:''}</div>`;
    }
    const can=ts.canAssess&&!ownLocked;
    return `<button class="jp-card ${ts.code}" data-new-clean="${jp}" ${can?'':'disabled'}><b>JP ${jp}</b><span>${time}</span><strong>${ts.code==='missed'?'🔒 Terlewat':ts.code==='future'?'🔒 Belum Dibuka':ts.code==='open'?'🟢 Bisa Diperiksa':'🔒 Tidak tersedia'}</strong><small>${can?'Buka pemeriksaan':'Tidak dapat dinilai'}</small></button>`;
  }).join('')}</div>`;
  $('#backCleanClasses').onclick=cleanlinessPage;
  document.querySelectorAll('[data-new-clean]').forEach(b=>b.onclick=()=>renderCleanForm(classId,Number(b.dataset.newClean),null));
  document.querySelectorAll('[data-edit-clean]').forEach(b=>b.onclick=()=>{const r=state.cleanlinessToday.find(x=>x.id===b.dataset.editClean);if(r)renderCleanForm(classId,Number(r.jp),r)});
  document.querySelectorAll('[data-reset-clean]').forEach(b=>b.onclick=()=>resetCleanlinessRecord(b.dataset.resetClean));
  if($('#resetCleanClass')) $('#resetCleanClass').onclick=()=>resetCleanlinessClass(classId,todayKey());
  if($('#resetSelectedCleanJp')) $('#resetSelectedCleanJp').onclick=()=>{
    const id=$('#resetCleanJpSelect').value;
    if(!id)return toast('Pilih JP yang akan direset');
    resetCleanlinessRecord(id);
  };
  if($('#resetAllCleanClass')) $('#resetAllCleanClass').onclick=()=>resetCleanlinessClass(classId,todayKey());

}
function renderCleanForm(classId,jp,existing=null){
  const ts=jpTimeState(jp),isEdit=!!existing,admin=state.profile.role==='admin',mine=isEdit&&existing.createdByUid===state.user.uid;
  if(!admin&&!ts.canAssess){toast(`JP ${jp} sudah terkunci (${ts.label})`);renderCleanClass(classId);return;}
  if(isEdit&&!admin&&(!mine||Number(existing.teacherEditCount||0)>=1)){toast('Pemeriksaan ini sudah terkunci');return;}
  pageMeta(`${isEdit?'Edit':'Pemeriksaan'} Kebersihan`,`${classId} • JP ${jp} • ${ts.start!=null?hm(ts.start)+'–'+hm(ts.end):''}`);
  const aspect=(key,label,icon,labels)=>`<div class="aspect-row"><div class="aspect-name"><span>${icon}</span><b>${label}</b></div><div class="tri-choice" data-aspect="${key}">${[3,2,1].map((v,n)=>`<button data-v="${v}" class="${v===3?'good':v===2?'fair':'bad'} ${Number(existing?.[key]??3)===v?'active':''}">${labels[n]}</button>`).join('')}</div></div>`;
  content.innerHTML=`<div class="section-head"><div><h3>${isEdit?'Edit Pemeriksaan':'Pemeriksaan Baru'} • ${esc(classId)} • JP ${jp}</h3><small>${admin?'Admin dapat melakukan koreksi.':isEdit?'Kesempatan edit hanya 1× dan harus sebelum JP berakhir.':'Simpan sebelum JP berakhir.'}</small></div><button class="btn ghost" id="backClean">← Kembali</button></div><div class="card clean-form">${isEdit&&!admin?'<div class="notice edit-once-note">Anda sedang menggunakan <b>1 kali kesempatan edit</b>.</div>':''}<div class="aspect-list">${aspect('floor','Lantai','🧹',['Bersih','Cukup Bersih','Kotor'])}${aspect('desks','Meja & Kursi','🪑',['Rapi','Cukup Rapi','Berantakan'])}${aspect('bin','Tempat Sampah','🗑️',['Terkelola','Hampir Penuh','Penuh / Meluber'])}${aspect('equipment','Perlengkapan Kelas','📚',['Rapi','Cukup Rapi','Berantakan'])}</div><label>Catatan <small>(opsional)</small><textarea id="cleanNote" rows="3">${esc(existing?.note||'')}</textarea></label><div class="clean-actions"><button id="allGood" class="btn secondary">✓ Semua Bersih & Rapi</button><button id="saveClean" class="btn primary">${isEdit?'Simpan Edit Terakhir':'Simpan Pemeriksaan'}</button></div></div>`;
  const values={floor:Number(existing?.floor??3),desks:Number(existing?.desks??3),bin:Number(existing?.bin??3),equipment:Number(existing?.equipment??3)};
  document.querySelectorAll('.tri-choice button').forEach(b=>b.onclick=()=>{const w=b.parentElement;values[w.dataset.aspect]=Number(b.dataset.v);w.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b))});
  $('#allGood').onclick=()=>{Object.keys(values).forEach(k=>values[k]=3);document.querySelectorAll('.tri-choice').forEach(w=>w.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x.dataset.v==='3')))};
  $('#backClean').onclick=()=>renderCleanClass(classId);
  $('#saveClean').onclick=async()=>{const btn=$('#saveClean');btn.disabled=true;try{
    const fresh=jpTimeState(jp); if(!admin&&!fresh.canAssess)throw new Error(`Waktu JP ${jp} sudah berakhir`);
    const own=state.profile.isHomeroom===true&&state.profile.role!=='admin'?String(state.profile.homeroomClass||''):'';
    if(own&&classId===own&&state.accessSettings?.homeroomCleanlinessEnabled!==true&&!admin)throw new Error('Penilaian kelas wali sendiri belum dibuka Admin');
    const collision=state.cleanlinessToday.find(r=>r.classId===classId&&Number(r.jp)===jp);
    if(!isEdit&&collision)throw new Error(`JP ${jp} sudah diperiksa oleh ${collision.createdByName||'guru lain'}`);
    const now=new Date(),id=isEdit?existing.id:`${todayKey()}_${classId}_JP${jp}`,cnt=isEdit&&!admin?1:Number(existing?.teacherEditCount||0);
    await setDoc(doc(db,'cleanliness',id),{date:todayKey(),classId,jp,...values,note:$('#cleanNote').value.trim(),createdByUid:existing?.createdByUid||state.user.uid,createdByName:existing?.createdByName||state.profile.name,createdAt:existing?.createdAt||now.toISOString(),teacherEditCount:cnt,teacherEditedAt:isEdit&&!admin?now.toISOString():(existing?.teacherEditedAt||null),lastEditedByUid:state.user.uid,lastEditedByName:state.profile.name,lastEditedAt:now.toISOString(),timeLabel:now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})},{merge:false});
    await refreshCore();toast(isEdit?'Pemeriksaan diedit dan terkunci':'Pemeriksaan tersimpan');renderCleanClass(classId)
  }catch(e){console.error(e);toast(e.message||'Gagal menyimpan');btn.disabled=false}};
}

async function resetCleanlinessRecord(checkId){
  if(state.profile.role!=='admin')return;
  let r=state.cleanlinessToday.find(x=>x.id===checkId);
  if(!r){
    try{const snap=await getDoc(doc(db,'cleanliness',checkId));if(snap.exists())r={id:snap.id,...snap.data()};}catch(_){}
  }
  if(!r)return toast('Data pemeriksaan tidak ditemukan');
  const reason=prompt(`Alasan reset ${r.classId} • JP ${r.jp}:`,'Koreksi data');
  if(reason===null)return;
  if(!confirm(`Reset pemeriksaan ${r.classId} • JP ${r.jp} menjadi Belum Diperiksa?\n\nData lama tetap disimpan di arsip Admin.`))return;
  try{
    const now=new Date(),archiveId=`${checkId}_${now.getTime()}`;
    await setDoc(doc(db,'cleanlinessResetArchive',archiveId),{
      ...r,originalId:checkId,resetReason:reason,
      resetByUid:state.user.uid,resetByName:state.profile.name,resetAt:now.toISOString()
    });
    await deleteDoc(doc(db,'cleanliness',checkId));
    await addAdminAudit('RESET_CLEANLINESS_JP',{checkId,classId:r.classId,jp:r.jp,date:r.date,archiveId,reason});
    await refreshCore();
    toast(`${r.classId} • JP ${r.jp} kembali menjadi Belum Diperiksa`);
    renderCleanClass(r.classId);
  }catch(e){console.error(e);toast('Reset pemeriksaan gagal')}
}

async function resetCleanlinessClass(classId,date){
  if(state.profile.role!=='admin')return;
  const rows=state.cleanlinessToday.filter(r=>r.classId===classId && r.date===date);
  if(!rows.length)return toast('Belum ada pemeriksaan yang dapat direset');
  const reason=prompt(`Alasan reset seluruh pemeriksaan ${classId} tanggal ${date}:`,'Koreksi data');
  if(reason===null)return;
  if(!confirm(`Reset ${rows.length} pemeriksaan kelas ${classId} menjadi Belum Diperiksa?\n\nSemua data lama tetap diarsipkan.`))return;
  try{
    const now=new Date();
    const batch=writeBatch(db);
    for(const r of rows){
      const archiveId=`${r.id}_${now.getTime()}_${r.jp}`;
      batch.set(doc(db,'cleanlinessResetArchive',archiveId),{
        ...r,originalId:r.id,resetReason:reason,
        resetByUid:state.user.uid,resetByName:state.profile.name,resetAt:now.toISOString()
      });
      batch.delete(doc(db,'cleanliness',r.id));
    }
    await batch.commit();
    await addAdminAudit('RESET_CLEANLINESS_CLASS',{classId,date,count:rows.length,reason});
    await refreshCore();
    toast(`Kebersihan ${classId} kembali menjadi Belum Diperiksa`);
    renderCleanClass(classId);
  }catch(e){console.error(e);toast('Reset kebersihan kelas gagal')}
}

function cleanCard(r){const st=cleanOverall(r);return `<div class="clean-item"><div class="clean-class"><b>${esc(r.classId)}</b><small>JP ${esc(r.jp)}</small></div><div class="clean-status ${st.cls}"><b>${st.label}</b></div><div class="clean-meta">${esc(r.timeLabel||'')}<br><small>${esc(r.createdByName||'Guru')}</small></div></div>`}
function cleanOverall(r){const v=['floor','desks','bin','equipment'].map(k=>Number(r[k]||0)),min=Math.min(...v),avg=v.reduce((a,b)=>a+b,0)/v.length;if(min===1||avg<2)return{label:'Perlu Tindakan',cls:'bad'};if(v.every(x=>x===3))return{label:'Bersih & Rapi',cls:'good'};return{label:'Cukup',cls:'fair'}}
function renderCleanForm(classId,jp,existing=null){
  const op=operationalInfo(),isEdit=!!existing,admin=state.profile.role==='admin',mine=isEdit&&existing.createdByUid===state.user.uid;
  if(isEdit&&!admin&&(!mine||Number(existing.teacherEditCount||0)>=1)){toast('Pemeriksaan ini sudah terkunci');return;}
  pageMeta(`${isEdit?'Edit':'Pemeriksaan'} Kebersihan`,`${classId} • JP ${jp}`);
  const aspect=(key,label,icon,labels)=>`<div class="aspect-row"><div class="aspect-name"><span>${icon}</span><b>${label}</b></div><div class="tri-choice" data-aspect="${key}">${[3,2,1].map((v,n)=>`<button data-v="${v}" class="${v===3?'good':v===2?'fair':'bad'} ${Number(existing?.[key]??3)===v?'active':''}">${labels[n]}</button>`).join('')}</div></div>`;
  content.innerHTML=`<div class="section-head"><div><h3>${isEdit?'Edit 1×':'Pemeriksaan Baru'} • ${esc(classId)} • JP ${jp}</h3><small>${isEdit&&!admin?'Setelah disimpan, pemeriksaan terkunci.':'Nilai 4 aspek kebersihan.'}</small></div><button class="btn ghost" id="backClean">← Kembali</button></div><div class="card clean-form">${isEdit&&!admin?'<div class="notice edit-once-note">Anda sedang menggunakan <b>1 kali kesempatan edit</b>.</div>':''}<div class="aspect-list">${aspect('floor','Lantai','🧹',['Bersih','Cukup Bersih','Kotor'])}${aspect('desks','Meja & Kursi','🪑',['Rapi','Cukup Rapi','Berantakan'])}${aspect('bin','Tempat Sampah','🗑️',['Terkelola','Hampir Penuh','Penuh / Meluber'])}${aspect('equipment','Perlengkapan Kelas','📚',['Rapi','Cukup Rapi','Berantakan'])}</div><label>Catatan <small>(opsional)</small><textarea id="cleanNote" rows="3">${esc(existing?.note||'')}</textarea></label><div class="clean-actions"><button id="allGood" class="btn secondary">✓ Semua Bersih & Rapi</button><button id="saveClean" class="btn primary">${isEdit?'Simpan Edit Terakhir':'Simpan Pemeriksaan'}</button></div></div>`;
  const values={floor:Number(existing?.floor??3),desks:Number(existing?.desks??3),bin:Number(existing?.bin??3),equipment:Number(existing?.equipment??3)};
  document.querySelectorAll('.tri-choice button').forEach(b=>b.onclick=()=>{const w=b.parentElement;values[w.dataset.aspect]=Number(b.dataset.v);w.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b))});
  $('#allGood').onclick=()=>{Object.keys(values).forEach(k=>values[k]=3);document.querySelectorAll('.tri-choice').forEach(w=>w.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x.dataset.v==='3')))};
  $('#backClean').onclick=()=>renderCleanClass(classId);
  $('#saveClean').onclick=async()=>{const btn=$('#saveClean');btn.disabled=true;try{const own=state.profile.isHomeroom===true&&state.profile.role!=='admin'?String(state.profile.homeroomClass||''):'';if(own&&classId===own&&state.accessSettings?.homeroomCleanlinessEnabled!==true)throw new Error('Penilaian kelas wali sendiri belum dibuka Admin');const collision=state.cleanlinessToday.find(r=>r.classId===classId&&Number(r.jp)===jp);if(!isEdit&&collision)throw new Error(`JP ${jp} sudah dinilai oleh ${collision.createdByName||'guru lain'}`);const now=new Date(),id=isEdit?existing.id:`${todayKey()}_${classId}_JP${jp}`,cnt=isEdit&&!admin?1:Number(existing?.teacherEditCount||0);await setDoc(doc(db,'cleanliness',id),{date:todayKey(),classId,jp,...values,note:$('#cleanNote').value.trim(),createdByUid:existing?.createdByUid||state.user.uid,createdByName:existing?.createdByName||state.profile.name,createdAt:existing?.createdAt||now.toISOString(),teacherEditCount:cnt,teacherEditedAt:isEdit&&!admin?now.toISOString():(existing?.teacherEditedAt||null),lastEditedByUid:state.user.uid,lastEditedByName:state.profile.name,lastEditedAt:now.toISOString(),timeLabel:now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})},{merge:false});await refreshCore();toast(isEdit?'Pemeriksaan diedit dan sekarang terkunci':'Pemeriksaan tersimpan');renderCleanClass(classId)}catch(e){console.error(e);toast(e.message||'Gagal menyimpan');btn.disabled=false}};
}
function recap(){
  pageMeta('Rekap & Analisis','Pantau data, perkembangan, apresiasi, dan kelas yang perlu perhatian');
  content.innerHTML=`<div class="recap-switch recap-switch-four">
    <button class="recap-module active" data-recap="wadah">${ICON_WADAH_MAKAN}<b>Wadah Makan & Tumbler</b><small>Rekap pendataan</small></button>
    <button class="recap-module" data-recap="clean">🧹<b>Kebersihan</b><small>Riwayat pemeriksaan</small></button>
    <button class="recap-module" data-recap="analysis">📊<b>Analisis</b><small>Tren & perhatian</small></button>
    <button class="recap-module" data-recap="awards">🏆<b>Apresiasi</b><small>Performa kelas</small></button>
  </div><div id="recapPanel"></div>`;
  document.querySelectorAll('.recap-module').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('.recap-module').forEach(x=>x.classList.toggle('active',x===b));
    const mode=b.dataset.recap;
    if(mode==='clean') renderCleanRecap();
    else if(mode==='analysis') renderEcoAnalysis();
    else if(mode==='awards') renderEcoAwards();
    else renderWadahRecap();
  });
  renderWadahRecap();
}
function renderWadahRecap(){
  const panel=$('#recapPanel'); panel.innerHTML=`<div class="card"><div class="section-head"><div><h3>Rekap Wadah Makan & Tumbler</h3><small>Pilih tanggal dan kelas.</small></div><div class="row-actions"><input id="recapDate" class="input-inline" type="date" value="${todayKey()}"><select id="recapClass" class="input-inline"><option value="">Semua kelas</option>${state.classes.map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div></div><div id="recapBody"><div class="empty">Memuat...</div></div></div>`;
  $('#recapDate').onchange=loadRecapDate; $('#recapClass').onchange=loadRecapDate; loadRecapDate();
}
async function loadRecapDate(){
  const target=$('#recapBody'); if(!target)return;
  const date=$('#recapDate').value||todayKey(), cls=$('#recapClass').value||'';
  try{
    const snap=await getDocs(query(collection(db,'records'),where('date','==',date)));
    const records=snap.docs.map(d=>({id:d.id,...d.data()})); const classes=cls?[cls]:state.classes;
    const cards=classes.map(c=>{const r=records.find(x=>x.classId===c);if(!r)return {c,status:'Belum',hadir:0,food:0,tumb:0,both:0,by:'-'};const hadir=(r.items||[]).filter(i=>i.presence==='hadir');const pct=f=>hadir.length?Math.round(hadir.filter(f).length/hadir.length*100):0;return {c,status:'Selesai',hadir:hadir.length,food:pct(i=>i.food),tumb:pct(i=>i.tumbler),both:pct(i=>i.food&&i.tumbler),by:r.lastEditedByName||r.createdByName||'Guru'};});
    target.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Kelas</th><th>Status</th><th>Hadir</th><th>Wadah Makan</th><th>Tumbler</th><th>Keduanya</th><th>Penginput</th>${state.profile.role==='admin'?'<th>Aksi Admin</th>':''}</tr></thead><tbody>${cards.map(x=>{const rec=records.find(r=>r.classId===x.c);return `<tr><td><b>${x.c}</b></td><td><span class="badge ${x.status==='Selesai'?'ok':'neutral'}">${x.status}</span></td><td>${x.hadir||'-'}</td><td>${x.food}%</td><td>${x.tumb}%</td><td><b>${x.both}%</b></td><td>${esc(x.by)}</td>${state.profile.role==='admin'?`<td>${rec?`<button class="btn-mini danger" data-reset-wadah="${esc(rec.id)}">Reset → Belum</button>`:'-'}</td>`:''}</tr>`}).join('')}</tbody></table></div>`;
    document.querySelectorAll('[data-reset-wadah]').forEach(b=>b.onclick=()=>resetWadahRecord(b.dataset.resetWadah));
  }catch(e){console.error(e);target.innerHTML='<div class="empty">Gagal memuat rekap.</div>';}
}
function renderCleanRecap(){
  const panel=$('#recapPanel'); panel.innerHTML=`<div class="card"><div class="section-head"><div><h3>Rekap Kebersihan Kelas</h3><small>Hanya pemeriksaan yang sudah dilakukan yang ditampilkan.</small></div><div class="row-actions"><input id="cleanRecapDate" class="input-inline" type="date" value="${todayKey()}"><select id="cleanRecapClass" class="input-inline"><option value="">Semua kelas</option>${state.classes.map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div></div><div id="cleanRecapBody"><div class="empty">Memuat...</div></div></div>`; $('#cleanRecapDate').onchange=loadCleanRecap;$('#cleanRecapClass').onchange=loadCleanRecap;loadCleanRecap();
}
async function loadCleanRecap(){
  const target=$('#cleanRecapBody'); if(!target)return; const date=$('#cleanRecapDate').value||todayKey(),cls=$('#cleanRecapClass').value||'';
  try{const snap=await getDocs(query(collection(db,'cleanliness'),where('date','==',date)));let rows=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));if(cls)rows=rows.filter(r=>r.classId===cls);target.innerHTML=rows.length?`<div class="clean-list">${rows.map(cleanCard).join('')}</div>`:'<div class="empty">Belum ada pemeriksaan kebersihan pada pilihan ini.</div>';
    document.querySelectorAll('[data-reset-clean]').forEach(b=>b.onclick=()=>resetCleanlinessRecord(b.dataset.resetClean));}catch(e){console.error(e);target.innerHTML='<div class="empty">Gagal memuat rekap kebersihan. Pastikan Firestore Rules v2.9.1 sudah dipublish.</div>';}
}

function weekRange(offset=0){
  const now=new Date(); now.setHours(0,0,0,0);
  const day=(now.getDay()+6)%7;
  const start=new Date(now); start.setDate(now.getDate()-day+(offset*7));
  const end=new Date(start); end.setDate(start.getDate()+4);
  const key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return {start:key(start),end:key(end)};
}
async function fetchEcoPeriod(range){
  const [recordSnap,cleanSnap]=await Promise.all([
    getDocs(query(collection(db,'records'),where('date','>=',range.start),where('date','<=',range.end))),
    getDocs(query(collection(db,'cleanliness'),where('date','>=',range.start),where('date','<=',range.end)))
  ]);
  return {
    records:recordSnap.docs.map(d=>({id:d.id,...d.data()})),
    clean:cleanSnap.docs.map(d=>({id:d.id,...d.data()}))
  };
}
function classPeriodMetrics(cls,data){
  const records=data.records.filter(r=>r.classId===cls);
  let hadir=0,food=0,tumb=0;
  records.forEach(r=>(r.items||[]).forEach(i=>{if(i.presence==='hadir'){hadir++;if(i.food)food++;if(i.tumbler)tumb++;}}));
  const cleans=data.clean.filter(r=>r.classId===cls);
  let cleanPoints=0,cleanCount=0;
  cleans.forEach(r=>['floor','desks','bin','equipment'].forEach(k=>{const v=Number(r[k]||0);if(v){cleanPoints+=v;cleanCount++;}}));
  const foodPct=hadir?Math.round(food/hadir*100):null;
  const tumbPct=hadir?Math.round(tumb/hadir*100):null;
  const cleanPct=cleanCount?Math.round((cleanPoints/(cleanCount*3))*100):null;
  const available=[foodPct,tumbPct,cleanPct].filter(v=>v!==null);
  const eligible=records.length>0 && cleans.length>=2 && foodPct!==null && tumbPct!==null && cleanPct!==null;
  const eco=eligible?Math.round(foodPct*.30+tumbPct*.30+cleanPct*.40):(available.length?Math.round(available.reduce((a,b)=>a+b,0)/available.length):null);
  return {cls,records:records.length,checks:cleans.length,hadir,foodPct,tumbPct,cleanPct,eco,eligible};
}
function metricText(v){return v===null?'Belum ada data':`${v}%`}
function ecoClass(v){return v===null?'neutral':v>=85?'good':v>=70?'fair':'bad'}
async function loadEcoComparison(){
  const current=weekRange(0),previous=weekRange(-1);
  const [cur,prev]=await Promise.all([fetchEcoPeriod(current),fetchEcoPeriod(previous)]);
  const currentMetrics=state.classes.map(c=>classPeriodMetrics(c,cur));
  const prevMap=Object.fromEntries(state.classes.map(c=>[c,classPeriodMetrics(c,prev)]));
  currentMetrics.forEach(m=>{const p=prevMap[m.cls];m.change=(m.eco!==null&&p?.eco!==null)?m.eco-p.eco:null;});
  return {current,previous,currentMetrics,prevMap};
}
function renderEcoAnalysisLive(){
  const panel=$('#recapPanel');
  panel.innerHTML=`<div class="card analysis-shell"><div class="section-head"><div><h3>Analisis Mingguan</h3><small>Persentase dihitung berdasarkan siswa hadir. Kebersihan dinormalisasi agar jumlah pemeriksaan tidak menguntungkan kelas tertentu.</small></div></div><div id="analysisBody"><div class="empty">Menghitung analisis...</div></div></div>`;
  loadEcoComparison().then(({current,currentMetrics})=>{
    const target=$('#analysisBody'); if(!target)return;
    const withEco=currentMetrics.filter(m=>m.eco!==null).sort((a,b)=>b.eco-a.eco);
    const best=withEco[0];
    const improved=[...currentMetrics].filter(m=>m.change!==null).sort((a,b)=>b.change-a.change)[0];
    const attention=[...currentMetrics].filter(m=>m.eco!==null).sort((a,b)=>a.eco-b.eco)[0];
    target.innerHTML=`<div class="analysis-period">Periode ${current.start} s.d. ${current.end}</div>
      <div class="analysis-kpis">
        <div class="analysis-kpi"><span>🏆 Performa tertinggi</span><strong>${best?esc(best.cls):'-'}</strong><small>${best?.eco??'-'} poin Eco</small></div>
        <div class="analysis-kpi"><span>📈 Paling meningkat</span><strong>${improved&&improved.change>0?esc(improved.cls):'-'}</strong><small>${improved&&improved.change>0?`+${improved.change} poin`:'Belum ada peningkatan terukur'}</small></div>
        <div class="analysis-kpi attention"><span>⚠ Perlu perhatian</span><strong>${attention?esc(attention.cls):'-'}</strong><small>${attention?`${attention.eco} poin Eco`:'Data belum cukup'}</small></div>
      </div>
      <div class="analysis-list">${currentMetrics.map(m=>`<div class="analysis-row">
        <div class="analysis-class"><b>${esc(m.cls)}</b><small>${m.records} hari pendataan • ${m.checks} cek kebersihan</small></div>
        <div><span>Wadah Makan</span><b>${metricText(m.foodPct)}</b></div>
        <div><span>Tumbler</span><b>${metricText(m.tumbPct)}</b></div>
        <div><span>Kebersihan</span><b>${metricText(m.cleanPct)}</b></div>
        <div><span>Eco</span><b class="${ecoClass(m.eco)}-text">${m.eco??'-'}</b></div>
        <div><span>Perubahan</span><b>${m.change===null?'-':`${m.change>0?'+':''}${m.change}`}</b></div>
      </div>`).join('')}</div>
      <div class="analysis-note">Skor Eco untuk apresiasi resmi hanya berlaku jika kelas memiliki data Wadah Makan & Tumbler dan minimal 2 pemeriksaan kebersihan pada minggu tersebut.</div>`;
  }).catch(e=>{console.error(e);if($('#analysisBody'))$('#analysisBody').innerHTML='<div class="empty">Analisis belum dapat dimuat. Pastikan Firestore Rules mengizinkan pembacaan records dan cleanliness.</div>'});
}
function renderEcoAwardsLive(){
  const panel=$('#recapPanel');
  panel.innerHTML=`<div class="card awards-shell"><div class="section-head"><div><h3>Apresiasi & Kontrol Kelas</h3><small>Apresiasi mingguan berdasarkan persentase, bukan jumlah siswa atau banyaknya pemeriksaan.</small></div></div><div id="awardsBody"><div class="empty">Menentukan performa kelas...</div></div></div>`;
  loadEcoComparison().then(({current,currentMetrics})=>{
    const target=$('#awardsBody'); if(!target)return;
    const eligible=currentMetrics.filter(m=>m.eligible);
    const bestEco=[...eligible].sort((a,b)=>b.eco-a.eco)[0];
    const bestFood=[...currentMetrics].filter(m=>m.foodPct!==null).sort((a,b)=>b.foodPct-a.foodPct)[0];
    const bestTumb=[...currentMetrics].filter(m=>m.tumbPct!==null).sort((a,b)=>b.tumbPct-a.tumbPct)[0];
    const clean=[...currentMetrics].filter(m=>m.cleanPct!==null&&m.checks>=2).sort((a,b)=>b.cleanPct-a.cleanPct);
    const bestClean=clean[0];
    const improved=[...currentMetrics].filter(m=>m.change!==null&&m.change>0).sort((a,b)=>b.change-a.change)[0];
    const attention=[...currentMetrics].filter(m=>m.eco!==null).sort((a,b)=>a.eco-b.eco).slice(0,3);
    const award=(icon,title,m,value,sub)=>`<div class="award-card"><div class="award-icon">${icon}</div><span>${title}</span><strong>${m?esc(m.cls):'-'}</strong><small>${m?`${value}${sub||''}`:'Data belum cukup'}</small></div>`;
    target.innerHTML=`<div class="analysis-period">Periode ${current.start} s.d. ${current.end}</div>
      <div class="award-grid">
        ${award('🏆','Kelas Eco Terbaik',bestEco,bestEco?.eco??'', ' poin')}
        ${award(ICON_WADAH_MAKAN,'Wadah Makan Terbaik',bestFood,bestFood?.foodPct??'', '%')}
        ${award(ICON_TUMBLER,'Tumbler Terbaik',bestTumb,bestTumb?.tumbPct??'', '%')}
        ${award('✨','Kelas Terbersih',bestClean,bestClean?.cleanPct??'', '%')}
        ${award('📈','Paling Meningkat',improved,improved?`+${improved.change}`:'', ' poin')}
      </div>
      <div class="attention-box"><div class="section-head"><div><h4>Perlu Perhatian</h4><small>Bukan “kelas terburuk”. Bagian ini membantu menentukan fokus pembinaan.</small></div></div>
      ${attention.length?attention.map(m=>{
        const vals=[['Wadah Makan',m.foodPct],['Tumbler',m.tumbPct],['Kebersihan',m.cleanPct]].filter(x=>x[1]!==null).sort((a,b)=>a[1]-b[1]);
        const focus=vals[0];
        return `<div class="attention-row"><b>${esc(m.cls)}</b><span>Eco ${m.eco}</span><span>${m.change===null?'Belum ada pembanding':`${m.change>0?'↑':'↓'} ${Math.abs(m.change)} poin dari minggu lalu`}</span><strong>Fokus: ${focus?`${focus[0]} ${focus[1]}%`:'lengkapi data'}</strong></div>`;
      }).join(''):'<div class="empty">Belum ada data yang cukup.</div>'}</div>
      <div class="analysis-note">Bobot Kelas Eco: Wadah Makan 30% + Tumbler 30% + Kebersihan 40%. Hasil ini digunakan untuk apresiasi dan kontrol, bukan hukuman.</div>`;
  }).catch(e=>{console.error(e);if($('#awardsBody'))$('#awardsBody').innerHTML='<div class="empty">Apresiasi belum dapat dihitung.</div>'});
}

function periodLabel(p){return `${p.startDate||'-'} s.d. ${p.endDate||'-'}`}
function analysisPeriodStatus(p){
  const t=todayKey();
  if(p.archived===true)return 'archived';
  if(t<String(p.startDate||''))return 'scheduled';
  if(t<=String(p.endDate||''))return 'running';
  return 'finished';
}
function analysisStatusLabel(code){return ({scheduled:'Terjadwal',running:'Sedang Berjalan',finished:'Selesai',archived:'Arsip'})[code]||code}
async function listAnalysisPeriods(){
  let ref;
  if(state.profile?.role==='admin'){
    ref=collection(db,'analysisPeriods');
  }else if(state.profile?.isHomeroom===true){
    ref=query(collection(db,'analysisPeriods'),where('sharedToHomeroom','==',true));
  }else{
    return [];
  }
  const snap=await getDocs(ref);
  return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
}
function roleCanSeePeriod(p){return state.profile.role==='admin'||(state.profile.isHomeroom===true&&p.sharedToHomeroom===true&&!!p.snapshot)}
async function finalizeEndedPeriods(periods){
  // Analysis v2: opening the page must never calculate/write results automatically.
  // Schedule, calculation, and publication are deliberately separate.
  return periods;
}

async function renderEcoAnalysis(){
  const panel=$('#recapPanel');
  if(state.profile.role==='admin') return renderEcoAnalysisLive();
  panel.innerHTML=`<div class="card analysis-shell"><div class="section-head"><div><h3>Hasil Analisis</h3><small>Hasil periode dibagikan oleh administrator setelah periode selesai.</small></div></div><div id="analysisBody"><div class="empty">Memuat...</div></div></div>`;
  try{
    const periods=(await listAnalysisPeriods()).filter(roleCanSeePeriod);
    if(!periods.length){$('#analysisBody').innerHTML='<div class="empty">Belum ada hasil analisis yang dibagikan kepada wali kelas.</div>';return;}
    const own=state.profile.homeroomClass;
    $('#analysisBody').innerHTML=`<select id="publishedPeriod" class="input-inline">${periods.map(p=>`<option value="${p.id}">${esc(p.name)} • ${periodLabel(p)}</option>`).join('')}</select><div id="publishedSnapshot"></div>`;
    const show=async()=>{const id=$('#publishedPeriod').value,p=periods.find(x=>x.id===id)||{},rows=(p.snapshot?.classes||[]).filter(x=>x.cls===own),school=p.snapshot?.classes||[],avg=school.length?Math.round(school.reduce((n,x)=>n+(Number(x.eco)||0),0)/school.length):null,a=p.snapshot?.awards||{};$('#publishedSnapshot').innerHTML=`<div class="analysis-period"><b>${esc(p.name)}</b><small>${periodLabel(p)} • Hasil tersimpan</small></div>${rows.map(m=>`<div class="analysis-list"><div class="analysis-row"><div class="analysis-class"><b>${esc(m.cls)}</b><small>${avg!==null?(Number(m.eco)>=avg?'Di atas/setara rata-rata sekolah':'Di bawah rata-rata sekolah'):''}</small></div><div><span>Wadah Makan</span><b>${metricText(m.foodPct)}</b></div><div><span>Tumbler</span><b>${metricText(m.tumbPct)}</b></div><div><span>Kebersihan</span><b>${metricText(m.cleanPct)}</b></div><div><span>Eco</span><b>${m.eco??'-'}</b></div></div></div>`).join('')||'<div class="empty">Hasil kelas wali tidak tersedia pada periode ini.</div>'}<div class="award-grid compact-awards"><div class="award-card"><span>🏆 Kelas Eco Terbaik</span><strong>${esc(a.bestEco?.cls||'-')}</strong></div><div class="award-card"><span>✨ Kelas Terbersih</span><strong>${esc(a.bestClean?.cls||'-')}</strong></div></div><div class="analysis-note">Wali kelas hanya melihat hasil kelas walinya dan apresiasi umum. Nilai lengkap kelas lain tidak ditampilkan.</div>`};$('#publishedPeriod').onchange=show;show();
  }catch(e){console.error(e);$('#analysisBody').innerHTML='<div class="empty">Hasil analisis belum dapat dimuat.</div>'}
}
async function renderEcoAwards(){return renderEcoAnalysis()}
async function metricsForRange(startDate,endDate){const data=await fetchEcoPeriod({start:startDate,end:endDate});return state.classes.map(c=>classPeriodMetrics(c,data))}
function buildAwards(ms){const eligible=ms.filter(m=>m.eligible),desc=(key,filter=()=>true)=>[...ms].filter(filter).sort((a,b)=>(b[key]??-1)-(a[key]??-1))[0]||null;return{bestEco:[...eligible].sort((a,b)=>b.eco-a.eco)[0]||null,bestFood:desc('foodPct',m=>m.foodPct!==null),bestTumb:desc('tumbPct',m=>m.tumbPct!==null),bestClean:desc('cleanPct',m=>m.cleanPct!==null&&m.checks>=2)}}
function analysisProcessState(p){
  const dateState=analysisPeriodStatus(p);
  if(p.archived===true)return 'archived';
  if(p.snapshot)return p.sharedToHomeroom===true?'shared':'calculated';
  if(dateState==='finished')return 'pending';
  return dateState;
}
function analysisProcessLabel(code){
  return ({scheduled:'Terjadwal',running:'Berjalan',pending:'Menunggu Hasil',calculated:'Hasil Tersimpan',shared:'Dibagikan',archived:'Arsip'})[code]||code;
}
function analysisProcessBadge(code){
  return ({scheduled:'warn',running:'ok',pending:'warn',calculated:'info',shared:'ok',archived:'neutral'})[code]||'neutral';
}
function analysisTypeLabel(type){return ({daily:'Harian',weekly:'Mingguan',monthly:'Bulanan',custom:'Custom'})[type]||'Custom'}
function analysisSchedulePreview(type,startDate,endDate){
  if(!startDate||!endDate||startDate>endDate)return 'Lengkapi tanggal periode.';
  const days=Math.floor((new Date(endDate+'T12:00:00')-new Date(startDate+'T12:00:00'))/86400000)+1;
  const temp={startDate,endDate};
  const ds=analysisPeriodStatus(temp);
  return `${analysisTypeLabel(type)} • ${periodLabel(temp)} • ${days} hari kalender • ${analysisProcessLabel(ds==='finished'?'pending':ds)}`;
}
function groupAnalysisPeriods(periods){
  const groups={running:[],scheduled:[],pending:[],calculated:[],shared:[],archived:[]};
  periods.forEach(p=>(groups[analysisProcessState(p)]||groups.pending).push(p));
  return groups;
}
async function renderAnalysisPeriods(){
  const target=$('#masterTabContent');
  target.innerHTML=`<div class="card master-section analysis-v2-shell">
    <div class="section-head"><div><h3>Periode Analisis</h3><small>Jadwal, perhitungan hasil, dan pembagian ke Wali Kelas dipisahkan agar lebih stabil.</small></div><button id="newPeriod" class="btn primary">+ Buat Periode</button></div>
    <div id="periodList"><div class="empty">Memuat...</div></div>
  </div>`;
  $('#newPeriod').onclick=()=>editAnalysisPeriod();
  const periods=await listAnalysisPeriods(),g=groupAnalysisPeriods(periods);
  const sections=[
    ['running','Sedang Berjalan','Periode yang aktif berdasarkan tanggal.'],
    ['scheduled','Akan Datang','Jadwal yang belum dimulai.'],
    ['pending','Menunggu Hasil','Periode sudah selesai dan siap dihitung.'],
    ['calculated','Hasil Tersimpan','Snapshot hasil sudah tersedia dan masih privat.'],
    ['shared','Sudah Dibagikan','Hasil dapat dilihat oleh Wali Kelas.'],
    ['archived','Arsip','Periode lama yang diarsipkan.']
  ];
  const html=sections.filter(([k])=>g[k].length).map(([k,title,sub])=>`
    <section class="period-v2-section">
      <div class="period-v2-title"><div><b>${title}</b><small>${sub}</small></div><span>${g[k].length}</span></div>
      <div class="period-list">${g[k].map(p=>{
        const ps=analysisProcessState(p);
        return `<div class="period-card period-v2-card">
          <div class="period-main"><b>${esc(p.name||'Tanpa nama')}</b><small>${analysisTypeLabel(p.type)} • ${periodLabel(p)}</small></div>
          <span class="badge ${analysisProcessBadge(ps)}">${analysisProcessLabel(ps)}</span>
          <div class="period-access"><small>Hasil: <b>${p.snapshot?'Tersimpan':'Belum dihitung'}</b><br>Wali Kelas: <b>${p.sharedToHomeroom===true?'Dibagikan':'Privat'}</b></small></div>
          <div class="row-actions">
            <button class="btn-mini edit" data-edit-period="${p.id}">Buka</button>
            ${ps==='pending'?`<button class="btn-mini primary" data-calc-period="${p.id}">Hitung Hasil</button>`:''}
            ${ps==='calculated'?`<button class="btn-mini primary" data-share-period="${p.id}">Bagikan</button>`:''}
            ${ps==='shared'?`<button class="btn-mini danger" data-share-period="${p.id}">Tarik Akses</button>`:''}
          </div>
        </div>`;
      }).join('')}</div>
    </section>`).join('');
  $('#periodList').innerHTML=html||'<div class="empty">Belum ada periode analisis. Gunakan + Buat Periode.</div>';
  document.querySelectorAll('[data-edit-period]').forEach(b=>b.onclick=()=>editAnalysisPeriod(b.dataset.editPeriod));
  document.querySelectorAll('[data-calc-period]').forEach(b=>b.onclick=()=>calculateAnalysisPeriod(b.dataset.calcPeriod));
  document.querySelectorAll('[data-share-period]').forEach(b=>b.onclick=()=>togglePeriodShare(b.dataset.sharePeriod));
}
async function calculateAnalysisPeriod(id,recalculate=false){
  if(state.profile.role!=='admin')return;
  try{
    const ref=doc(db,'analysisPeriods',id),d=await getDoc(ref);
    if(!d.exists())return toast('Periode tidak ditemukan');
    const p={id:d.id,...d.data()};
    if(analysisPeriodStatus(p)!=='finished')return toast('Hasil dihitung setelah tanggal akhir periode.');
    if(p.sharedToHomeroom===true)return toast('Tarik akses Wali Kelas sebelum menghitung ulang.');
    const now=new Date().toISOString();
    if(recalculate&&p.snapshot){
      await setDoc(doc(db,'analysisPeriodRevisions',`${id}_${Date.now()}`),{
        periodId:id,snapshot:p.snapshot,revisedAt:now,revisedByUid:state.user.uid,revisedByName:state.profile.name
      });
    }
    const classes=await metricsForRange(p.startDate,p.endDate);
    const snapshot={classes,awards:buildAwards(classes),calculatedAt:now,calculatedByUid:state.user.uid,revisionNumber:Number(p.snapshot?.revisionNumber||0)+(p.snapshot?1:0),locked:true,final:true};
    await setDoc(ref,{snapshot,resultStatus:'calculated',correctionOpen:false,calculatedAt:now,updatedAt:now,updatedByUid:state.user.uid,updatedByName:state.profile.name},{merge:true});
    await addAdminAudit(recalculate?'RECALCULATE_ANALYSIS':'CALCULATE_ANALYSIS',{periodId:id,name:p.name,startDate:p.startDate,endDate:p.endDate});
    toast(recalculate?'Hasil berhasil dihitung ulang':'Hasil analisis berhasil dihitung dan disimpan');
    renderAnalysisPeriods();
  }catch(e){console.error('calculateAnalysisPeriod',e);toast(`Gagal menghitung hasil${e?.code?` • ${e.code}`:''}`)}
}
async function editAnalysisPeriod(id=null){
  let p={name:'',type:'weekly',startDate:todayKey(),endDate:todayKey(),notes:'',sharedToHomeroom:false};
  if(id){const d=await getDoc(doc(db,'analysisPeriods',id));if(d.exists())p={id:d.id,...d.data()}}
  const ps=id?analysisProcessState(p):'draft';
  const locked=!!p.snapshot;
  const host=$('#masterTabContent');
  host.innerHTML=`<div class="card master-section analysis-v2-editor">
    <div class="section-head"><div><h3>${id?'Detail Periode':'Buat Periode Analisis'}</h3><small>${id?`Status: ${analysisProcessLabel(ps)}`:'Simpan jadwal terlebih dahulu. Perhitungan hasil dilakukan terpisah.'}</small></div><button id="backPeriods" class="btn ghost">← Kembali</button></div>
    <div class="period-form">
      <label>Nama Periode<input id="periodName" value="${esc(p.name||'')}" ${locked?'disabled':''} placeholder="Contoh: Minggu 4 Agustus"></label>
      <label>Jenis Periode<select id="periodType" ${locked?'disabled':''}><option value="daily" ${p.type==='daily'?'selected':''}>Harian</option><option value="weekly" ${p.type==='weekly'?'selected':''}>Mingguan</option><option value="monthly" ${p.type==='monthly'?'selected':''}>Bulanan</option><option value="custom" ${p.type==='custom'?'selected':''}>Custom</option></select></label>
      <label>Tanggal Mulai<input id="periodStart" type="date" value="${p.startDate||todayKey()}" ${locked?'disabled':''}></label>
      <label>Tanggal Selesai<input id="periodEnd" type="date" value="${p.endDate||todayKey()}" ${locked?'disabled':''}></label>
      <label class="period-notes">Catatan (opsional)<textarea id="periodNotes" ${locked?'disabled':''} placeholder="Catatan periode...">${esc(p.notes||'')}</textarea></label>
    </div>
    <div id="schedulePreview" class="schedule-preview"></div>
    <div class="row-actions period-actions">
      ${!locked?'<button id="saveSchedule" class="btn primary">Simpan Jadwal</button>':''}
      ${id&&ps==='pending'?'<button id="calculatePeriod" class="btn primary">Hitung Hasil</button>':''}
      ${id&&ps==='calculated'?'<button id="shareHere" class="btn primary">📤 Bagikan ke Wali Kelas</button><button id="recalculatePeriod" class="btn secondary">↻ Hitung Ulang</button>':''}
      ${id&&ps==='shared'?'<button id="shareHere" class="btn danger">Tarik Akses Wali Kelas</button>':''}
      ${id&&!p.archived?'<button id="archivePeriod" class="btn ghost">Arsipkan</button>':''}
    </div>
    <div id="periodPreview">${p.snapshot?renderPeriodSnapshotHtml(p.snapshot):'<div class="empty">Belum ada hasil tersimpan.</div>'}</div>
  </div>`;
  $('#backPeriods').onclick=renderAnalysisPeriods;
  const syncPreview=()=>{
    const type=$('#periodType')?.value||'custom',start=$('#periodStart')?.value||'',end=$('#periodEnd')?.value||'';
    $('#schedulePreview').textContent=analysisSchedulePreview(type,start,end);
  };
  const autoDates=()=>{
    const type=$('#periodType').value,start=$('#periodStart').value;if(!start)return syncPreview();
    const d=new Date(start+'T12:00:00');
    if(type==='daily')$('#periodEnd').value=start;
    if(type==='weekly'){d.setDate(d.getDate()+6);$('#periodEnd').value=d.toISOString().slice(0,10)}
    if(type==='monthly'){const x=new Date(d.getFullYear(),d.getMonth()+1,0,12);$('#periodEnd').value=x.toISOString().slice(0,10)}
    syncPreview();
  };
  if($('#periodType'))$('#periodType').onchange=autoDates;
  if($('#periodStart'))$('#periodStart').onchange=autoDates;
  if($('#periodEnd'))$('#periodEnd').onchange=syncPreview;
  syncPreview();

  if($('#saveSchedule'))$('#saveSchedule').onclick=async()=>{
    const name=$('#periodName').value.trim(),type=$('#periodType').value,startDate=$('#periodStart').value,endDate=$('#periodEnd').value,notes=$('#periodNotes').value.trim();
    if(!name||!startDate||!endDate||startDate>endDate)return toast('Lengkapi jadwal periode dengan benar');
    try{
      const ref=id?doc(db,'analysisPeriods',id):collection(db,'analysisPeriods').doc(),now=new Date().toISOString();
      // Intentionally ONLY save schedule metadata here.
      await setDoc(ref,{
        name,type,startDate,endDate,notes,
        resultStatus:p.snapshot?'calculated':'pending',
        shareStatus:p.sharedToHomeroom===true?'shared':'private',
        sharedToHomeroom:p.sharedToHomeroom===true,
        archived:p.archived===true,
        updatedAt:now,updatedByUid:state.user.uid,updatedByName:state.profile.name,
        ...(!id?{createdAt:now,createdByUid:state.user.uid,createdByName:state.profile.name}: {})
      },{merge:true});
      // Audit failure must never cancel a successful schedule save.
      addAdminAudit('SAVE_ANALYSIS_SCHEDULE',{periodId:ref.id,name,type,startDate,endDate}).catch(e=>console.warn('Audit schedule',e));
      toast('Jadwal periode berhasil disimpan');
      renderAnalysisPeriods();
    }catch(e){
      console.error('SAVE_ANALYSIS_SCHEDULE',e);
      toast(`Gagal menyimpan periode${e?.code?` • ${e.code}`:''}`);
    }
  };
  if($('#calculatePeriod'))$('#calculatePeriod').onclick=()=>calculateAnalysisPeriod(id,false);
  if($('#recalculatePeriod'))$('#recalculatePeriod').onclick=()=>calculateAnalysisPeriod(id,true);
  if($('#shareHere'))$('#shareHere').onclick=()=>togglePeriodShare(id);
  if($('#archivePeriod'))$('#archivePeriod').onclick=async()=>{
    if(!confirm('Arsipkan periode ini?'))return;
    try{
      await setDoc(doc(db,'analysisPeriods',id),{archived:true,archivedAt:new Date().toISOString(),updatedAt:new Date().toISOString()},{merge:true});
      toast('Periode diarsipkan');renderAnalysisPeriods();
    }catch(e){console.error(e);toast(`Gagal mengarsipkan${e?.code?` • ${e.code}`:''}`)}
  };
}
function renderPeriodSnapshotHtml(snapshot){const rows=snapshot?.classes||[],a=snapshot?.awards||{};return `<div class="snapshot-head"><b>Hasil Akhir Tersimpan</b><small>${snapshot?.calculatedAt?new Date(snapshot.calculatedAt).toLocaleString('id-ID'):'-'}</small></div><div class="analysis-kpis"><div class="analysis-kpi"><span>🏆 Eco Terbaik</span><strong>${esc(a.bestEco?.cls||'-')}</strong><small>${a.bestEco?.eco??'-'} poin</small></div><div class="analysis-kpi"><span>Wadah Makan</span><strong>${esc(a.bestFood?.cls||'-')}</strong></div><div class="analysis-kpi"><span>Tumbler</span><strong>${esc(a.bestTumb?.cls||'-')}</strong></div></div><div class="analysis-list">${rows.map(m=>`<div class="analysis-row"><div class="analysis-class"><b>${esc(m.cls)}</b></div><div><span>Wadah</span><b>${metricText(m.foodPct)}</b></div><div><span>Tumbler</span><b>${metricText(m.tumbPct)}</b></div><div><span>Kebersihan</span><b>${metricText(m.cleanPct)}</b></div><div><span>Eco</span><b>${m.eco??'-'}</b></div></div>`).join('')}</div>`}
async function togglePeriodShare(id){
  const ref=doc(db,'analysisPeriods',id),snap=await getDoc(ref);if(!snap.exists())return;
  const p={id:snap.id,...snap.data()};
  if(!p.snapshot)return toast('Hitung dan simpan hasil terlebih dahulu.');
  if(p.correctionOpen===true)return toast('Selesaikan koreksi sebelum membagikan hasil.');
  const open=!(p.sharedToHomeroom===true),now=new Date().toISOString();
  try{
    await setDoc(ref,{
      sharedToHomeroom:open,shareStatus:open?'shared':'private',
      sharedAt:open?now:null,sharedByUid:state.user.uid,sharedByName:state.profile.name,updatedAt:now
    },{merge:true});
    addAdminAudit(open?'SHARE_ANALYSIS':'UNSHARE_ANALYSIS',{periodId:id,name:p.name,startDate:p.startDate,endDate:p.endDate}).catch(()=>{});
    toast(open?'Hasil dibagikan ke Wali Kelas':'Akses Wali Kelas ditarik');
    renderAnalysisPeriods();
  }catch(e){console.error(e);toast(`Gagal mengubah akses${e?.code?` • ${e.code}`:''}`)}
}

function account(){
  pageMeta('Akun','Informasi dan keamanan akun');
  const type=state.profile.role==='admin'?'Administrator':(state.profile.isHomeroom?'Wali Kelas':'Guru');
  const wali=state.profile.isHomeroom&&state.profile.homeroomClass
    ? `<div class="account-row"><span>Kelas Wali</span><b>${esc(state.profile.homeroomClass)}</b></div>`:'';
  content.innerHTML=`<div class="card account-card">
    <div class="account-name">${esc(state.profile.name)}</div>
    <div class="account-details">
      <div class="account-row"><span>NIP Guru</span><b>${state.profile.role==='admin'?'ADMIN':esc(state.profile.loginId||'-')}</b></div>
      <div class="account-row"><span>Peran</span><b>${type}${state.profile.isHomeroom&&state.profile.homeroomClass?` • ${esc(state.profile.homeroomClass)}`:''}</b></div>
      ${wali}
      <div class="account-row"><span>Status</span><b class="account-active">Aktif</b></div>
    </div>
    <div class="account-security">
      <h4>Keamanan Akun</h4>
      <p>Ubah password dengan memasukkan password saat ini. Setelah berhasil, Anda akan diminta login kembali.</p>
      <button id="accountChangePassword" class="btn secondary">🔐 Ubah Password</button>
    </div>
  </div>`;
  $('#accountChangePassword').onclick=passwordPanel;
}

async function master(){
  if(state.profile.role!=='admin'){state.page='home';return renderShell()}
  pageMeta('Kelola Data','Khusus Administrator');
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
    <button type="button" class="master-tab ${state.masterTab==='students'?'active':''}" data-master-tab="students">👨‍🎓 Data Siswa</button>
    <button type="button" class="master-tab ${state.masterTab==='teachers'?'active':''}" data-master-tab="teachers">👨‍🏫 Guru & Wali Kelas${pendingTeachers.length?` <span class="tab-count">${pendingTeachers.length}</span>`:''}</button>
    <button type="button" class="master-tab ${state.masterTab==='classes'?'active':''}" data-master-tab="classes">🏫 Kelas & Import</button>
    <button type="button" class="master-tab ${state.masterTab==='calendar'?'active':''}" data-master-tab="calendar">📅 Kalender Sekolah</button>
    <button type="button" class="master-tab ${state.masterTab==='operations'?'active':''}" data-master-tab="operations">🛠️ Operasional</button>
    <button type="button" class="master-tab ${state.masterTab==='periods'?'active':''}" data-master-tab="periods">📊 Periode Analisis</button>
    <button type="button" class="master-tab ${state.masterTab==='audit'?'active':''}" data-master-tab="audit">🕒 Riwayat</button>
  </div>
  <div id="masterTabContent"></div>`;
  bindMasterTabNavigation();
  renderMasterTab();
}
function setMasterTab(tab){
  const valid=['students','teachers','classes','calendar','operations','periods','audit'];
  if(!valid.includes(tab))tab='students';
  state.masterTab=tab;
  try{
    renderMasterTab();
  }catch(e){
    console.error('Master tab render error',tab,e);
    const host=$('#masterTabContent');
    if(host)host.innerHTML=`<div class="card"><div class="notice warn-note"><b>Panel tidak dapat ditampilkan.</b><br>${esc(e?.message||String(e))}</div></div>`;
  }
  document.querySelectorAll('[data-master-tab]').forEach(x=>x.classList.toggle('active',x.dataset.masterTab===state.masterTab));
}
function bindMasterTabNavigation(){
  const tabs=document.querySelector('.master-tabs');
  if(!tabs)return;
  tabs.onclick=(ev)=>{
    const btn=ev.target.closest('[data-master-tab]');
    if(!btn||!tabs.contains(btn))return;
    ev.preventDefault();
    ev.stopPropagation();
    setMasterTab(btn.dataset.masterTab);
  };
}

function renderMasterTab(){
  const target=$('#masterTabContent'); if(!target)return;
  if(state.masterTab==='students'){
    target.innerHTML=`<div class="card master-section">
      <div class="section-head"><div><h3>Data Siswa</h3><small>Kelola siswa tanpa mencampur akun guru.</small></div><div class="row-actions"><a class="btn ghost" href="format-import-pakkom-eco-track.xlsx" download>Format Siswa</a><button id="importStudents" class="btn primary">Upload Data Siswa</button></div></div>
      <div class="notice">Format: <b>NIS | Nama | Kelas | Status</b>. Upload hanya membuka preview; data baru masuk setelah menekan <b>Import Sekarang</b>.</div>
      <div class="master-tools"><input id="studentSearch" class="input-inline" placeholder="Cari NIS atau nama siswa"><select id="studentClassFilter" class="input-inline"><option value="">Semua kelas</option>${state.classes.map(c=>`<option value="${c}">${c}</option>`).join('')}</select><button id="addStudentLocal" class="btn secondary">+ Siswa</button><button id="bulkDeleteStudents" class="btn danger" disabled>Hapus Terpilih</button></div>
      <div class="notice"><b>Akses Login Siswa v5:</b> tidak membuat akun Email/Password satu per satu. Unduh template, isi/cek kolom Password dan Aktif, lalu upload. Secara default password dapat dibuat sama dengan NIS.</div>
      <div class="row-actions" style="margin:12px 0"><button type="button" id="downloadStudentAccess" class="btn ghost">Unduh Template Akses</button><button type="button" id="uploadStudentAccess" class="btn primary">Upload Akses Login</button></div>
      <div id="studentTable"></div></div>`;
    $('#importStudents').onclick=()=>$('#studentImport').click(); $('#addStudentLocal').onclick=addStudentLocal;
    $('#studentSearch').oninput=renderStudentMasterTable; $('#studentClassFilter').onchange=renderStudentMasterTable;
    $('#bulkDeleteStudents').onclick=deleteSelectedStudents;
    $('#downloadStudentAccess').onclick=downloadStudentAccessTemplate;
    $('#uploadStudentAccess').onclick=()=>$('#studentAccessImport').click();
    renderStudentMasterTable(); return;
  }
  if(state.masterTab==='teachers'){
    target.innerHTML=`<div class="card master-section"><div class="section-head"><div><h3>Akun Guru & Wali Kelas</h3><small>Akun hasil pendaftaran baru harus disetujui Admin.</small></div><div class="row-actions"><button id="importTeachers" class="btn ghost">Upload Akun Guru</button><button id="addTeacher" class="btn primary">+ Guru</button></div></div><div id="pendingApprovals"></div>
    <div class="notice">Format: <b>NIP Guru | Nama | Password Awal | Jenis | Kelas Wali | Status</b>. Jenis: Guru atau Wali Kelas.</div>
    <div class="master-tools teacher-tools"><input id="teacherSearch" class="input-inline" placeholder="Cari NIP atau nama guru"><select id="teacherTypeFilter" class="input-inline"><option value="">Semua jenis</option><option value="wali">Wali Kelas</option><option value="guru">Guru</option></select><select id="teacherStatusFilter" class="input-inline"><option value="">Semua status</option><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option></select><select id="teacherSort" class="input-inline"><option value="class">Urut: Kelas Wali</option><option value="az">Nama A–Z</option><option value="za">Nama Z–A</option></select></div><div id="teacherTable"></div></div>`;
    $('#importTeachers').onclick=()=>$('#teacherImport').click(); $('#addTeacher').onclick=addTeacherPrompt;
    $('#teacherSearch').oninput=renderTeacherMasterTable; $('#teacherTypeFilter').onchange=renderTeacherMasterTable; $('#teacherStatusFilter').onchange=renderTeacherMasterTable; $('#teacherSort').onchange=renderTeacherMasterTable;
    renderPendingApprovals(); renderTeacherMasterTable(); return;
  }
  if(state.masterTab==='classes'){
    target.innerHTML=`<div class="card master-section"><div class="section-head"><div><h3>Kelas</h3><small>Menghapus kelas juga menghapus seluruh siswa di kelas tersebut dari master.</small></div><button id="seedClasses" class="btn ghost">Buat Kelas Standar 7A–9I</button></div>
    <div class="notice warn-note"><b>Catatan:</b> Hapus kelas akan menghapus semua siswa pada kelas itu dan melepas penugasan wali kelas. Riwayat pendataan lama tetap disimpan.</div>
    <div class="grid class-grid admin-class-grid">${state.classes.map(c=>{const n=state.students.filter(s=>s.classId===c).length;return `<div class="class-manage"><div><b>${c}</b><small>${n} siswa</small></div><button class="btn-mini danger" data-delete-class="${c}">Hapus</button></div>`}).join('')||'<div class="empty">Belum ada kelas.</div>'}</div></div>
    <div class="card master-section"><div class="section-head"><div><h3>Upload Pendataan Wadah Makan & Tumbler</h3><small>Khusus Admin • upload → preview → import.</small></div><div class="row-actions"><a class="btn ghost" href="format-upload-pendataan-wadah.xlsx" download>Format Pendataan</a><button id="importAttendance" class="btn primary">Upload Pendataan</button></div></div>
    <div class="notice">Format: <b>Tanggal | Kelas | NIS | Nama | Kehadiran | Wadah | Tumbler</b>. Nama bersifat informasi; NIS harus sudah ada di master siswa.</div></div>`;
    $('#seedClasses').onclick=seedClasses; $('#importAttendance').onclick=()=>$('#attendanceImport').click();
    document.querySelectorAll('[data-delete-class]').forEach(b=>b.onclick=()=>deleteClassMaster(b.dataset.deleteClass)); return;
  }
  if(state.masterTab==='calendar'){
    renderCalendarSettings(); return;
  }
  if(state.masterTab==='operations'){
    renderOperationalSettings(); return;
  }
  if(state.masterTab==='periods'){
    renderAnalysisPeriods(); return;
  }
  renderAdminAuditTab(); return; renderAuditTable();
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


function renderOperationalSettings(){
  const target=$('#masterTabContent');if(!target)return;
  const o=state.operationalSettings||{};
  target.innerHTML=`<div class="card master-section">
    <div class="section-head"><div><h3>Jadwal Operasional</h3><small>Atur waktu pembelajaran tanpa mengedit kode web.</small></div></div>
    <h4>Wadah Makan & Tumbler</h4>
    <div class="operational-grid">
      <label>Jam Tutup Senin–Kamis<input id="opCloseMonThu" type="time" value="${esc(o.wadahCloseMonThu||'14:10')}"></label>
      <label>Jam Tutup Jumat<input id="opCloseFri" type="time" value="${esc(o.wadahCloseFri||'11:30')}"></label>
    </div>
    <h4>Jadwal JP Kebersihan</h4>
    <div class="operational-grid">
      <label>JP 1 Senin–Kamis<input id="opStartMonThu" type="time" value="${esc(o.jpStartMonThu||'07:10')}"></label>
      <label>JP 1 Jumat<input id="opStartFri" type="time" value="${esc(o.jpStartFri||'07:50')}"></label>
      <label>Durasi 1 JP (menit)<input id="opDuration" type="number" min="20" max="60" value="${Number(o.jpDuration||40)}"></label>
      <label>Istirahat 1 setelah JP<input id="opBreak1After" type="number" min="1" max="9" value="${Number(o.break1AfterMonThu||4)}"></label>
      <label>Durasi Istirahat 1 (menit)<input id="opBreak1Duration" type="number" min="0" max="90" value="${Number(o.break1DurationMonThu||20)}"></label>
      <label>Istirahat 2 setelah JP<input id="opBreak2After" type="number" min="1" max="9" value="${Number(o.break2AfterMonThu||7)}"></label>
      <label>Durasi Istirahat 2 (menit)<input id="opBreak2Duration" type="number" min="0" max="90" value="${Number(o.break2DurationMonThu||40)}"></label>
      <label>Jumat istirahat setelah JP<input id="opBreakFriAfter" type="number" min="1" max="5" value="${Number(o.breakAfterFri||3)}"></label>
      <label>Durasi istirahat Jumat<input id="opBreakFriDuration" type="number" min="0" max="90" value="${Number(o.breakDurationFri||20)}"></label>
    </div>
    <div class="notice">Nilai default sesuai jadwal sekolah saat ini. Perubahan berlaku untuk pemeriksaan berikutnya setelah disimpan.</div>
    <button id="saveOperational" class="btn primary">Simpan Jadwal Operasional</button>
  </div>`;
  $('#saveOperational').onclick=async()=>{
    const data={
      wadahCloseMonThu:$('#opCloseMonThu').value||'14:10',
      wadahCloseFri:$('#opCloseFri').value||'11:30',
      jpStartMonThu:$('#opStartMonThu').value||'07:10',
      jpStartFri:$('#opStartFri').value||'07:50',
      jpDuration:Number($('#opDuration').value||40),
      break1AfterMonThu:Number($('#opBreak1After').value||4),
      break1DurationMonThu:Number($('#opBreak1Duration').value||20),
      break2AfterMonThu:Number($('#opBreak2After').value||7),
      break2DurationMonThu:Number($('#opBreak2Duration').value||40),
      breakAfterFri:Number($('#opBreakFriAfter').value||3),
      breakDurationFri:Number($('#opBreakFriDuration').value||20)
    };
    try{
      await setDoc(doc(db,'settings','operational'),{...data,updatedAt:new Date().toISOString(),updatedByUid:state.user.uid,updatedByName:state.profile.name},{merge:true});
      state.operationalSettings=data;
      await addAdminAudit('UPDATE_OPERATIONAL_SCHEDULE',data);
      toast('Jadwal operasional disimpan');
    }catch(e){console.error(e);toast('Gagal menyimpan jadwal operasional')}
  };
}

function filteredMasterStudents(){
  const q=String($('#studentSearch')?.value||'').trim().toLowerCase(), cls=$('#studentClassFilter')?.value||'';
  return state.students.filter(s=>(!cls||s.classId===cls)&&(!q||String(s.nis||s.id).toLowerCase().includes(q)||String(s.name||'').toLowerCase().includes(q)));
}
function renderStudentMasterTable(){
  const target=$('#studentTable'); if(!target)return;
  const rows=filteredMasterStudents(); window.selectedStudentIds=window.selectedStudentIds||new Set();
  const activeCount=rows.filter(s=>s.loginEnabled===true).length;
  const pendingCount=rows.filter(s=>s.loginEnabled!==true&&s.active!==false).length;
  target.innerHTML=`<div class="teacher-list-summary"><span><b>${activeCount}</b> akses login aktif</span><span><b>${pendingCount}</b> belum aktif</span></div><div class="bulk-summary"><span><b>${window.selectedStudentIds.size}</b> siswa dipilih</span><small>Centang siswa hanya untuk pengelolaan data/hapus. Akses login dikelola melalui file Excel.</small></div><div class="table-wrap"><table class="student-master"><thead><tr><th class="check-col"><input id="selectAllStudents" type="checkbox" aria-label="Pilih semua"></th><th>NIS</th><th>Nama</th><th>Kelas</th><th>Status Data</th><th>Akses Login</th><th>Aksi</th></tr></thead><tbody>${rows.slice(0,500).map(st=>`<tr><td class="check-col"><input class="student-check" type="checkbox" data-student-id="${esc(st.id)}" ${window.selectedStudentIds.has(st.id)?'checked':''}></td><td><b>${esc(st.nis||st.id)}</b></td><td>${esc(st.name||'-')}</td><td>${esc(st.classId||'-')}</td><td><span class="badge ${st.active===false?'warn':'ok'}">${st.active===false?'Nonaktif':'Aktif'}</span></td><td>${st.loginEnabled===true?'<span class="badge ok">Login Aktif</span>':'<span class="badge warn">Belum Aktif</span>'}</td><td><div class="row-actions"><button class="btn-mini edit" data-edit-student="${esc(st.id)}">Edit</button><button class="btn-mini danger" data-delete-student="${esc(st.id)}">Hapus</button></div></td></tr>`).join('')||'<tr><td colspan="7"><div class="empty">Tidak ada siswa yang cocok.</div></td></tr>'}</tbody></table></div>${rows.length>500?`<p class="demo-note">Menampilkan 500 dari ${rows.length} siswa. Gunakan pencarian/filter kelas.</p>`:''}`;
  document.querySelectorAll('[data-edit-student]').forEach(b=>b.onclick=()=>editStudent(b.dataset.editStudent));
  document.querySelectorAll('[data-delete-student]').forEach(b=>b.onclick=()=>deleteStudentMaster(b.dataset.deleteStudent));
  document.querySelectorAll('.student-check').forEach(c=>c.onchange=()=>{c.checked?window.selectedStudentIds.add(c.dataset.studentId):window.selectedStudentIds.delete(c.dataset.studentId);updateBulkStudentButton();});
  const selectAll=$('#selectAllStudents'); if(selectAll){const visible=rows.slice(0,500);selectAll.checked=visible.length>0&&visible.every(x=>window.selectedStudentIds.has(x.id));selectAll.onchange=()=>{visible.forEach(x=>selectAll.checked?window.selectedStudentIds.add(x.id):window.selectedStudentIds.delete(x.id));renderStudentMasterTable();};}
  updateBulkStudentButton();
}
function updateBulkStudentButton(){
  const n=window.selectedStudentIds?.size||0;
  const del=$('#bulkDeleteStudents');
  if(del){del.disabled=!n;del.textContent=n?`Hapus Terpilih (${n})`:'Hapus Terpilih';}
}
async function deleteSelectedStudents(){
  const ids=[...(window.selectedStudentIds||[])]; if(!ids.length)return;
  const sample=ids.slice(0,3).map(id=>state.students.find(s=>s.id===id)?.name||id).join(', ');
  if(!confirm(`Hapus ${ids.length} siswa dari master?${sample?`\nContoh: ${sample}${ids.length>3?', ...':''}`:''}\nRiwayat pendataan lama tetap tersimpan.`))return;
  try{for(let i=0;i<ids.length;i+=400){const batch=writeBatch(db);ids.slice(i,i+400).forEach(id=>batch.delete(doc(db,'students',id)));await batch.commit();}window.selectedStudentIds=new Set();toast(`${ids.length} siswa berhasil dihapus`);await master();}catch(e){console.error(e);toast('Gagal menghapus beberapa siswa');}
}

function classSortKey(c){const m=String(c||'').toUpperCase().match(/^(\d+)\s*([A-Z]+)$/);return m?Number(m[1])*1000+m[2].split('').reduce((n,ch)=>n*26+(ch.charCodeAt(0)-64),0):999999}
function renderTeacherMasterTable(){
 const target=$('#teacherTable');if(!target)return;const q=String($('#teacherSearch')?.value||'').trim().toLowerCase(),type=$('#teacherTypeFilter')?.value||'',status=$('#teacherStatusFilter')?.value||'',sort=$('#teacherSort')?.value||'class';
 const rows=(window.masterUsers||[]).filter(u=>u.role==='guru'&&u.approved!==false).filter(u=>(!q||String(u.loginId||'').toLowerCase().includes(q)||String(u.name||'').toLowerCase().includes(q))&&(!type||(type==='wali'?u.isHomeroom===true:u.isHomeroom!==true))&&(!status||(status==='aktif'?u.active!==false:u.active===false))).sort((a,b)=>{const aw=a.isHomeroom===true,bw=b.isHomeroom===true;if(aw!==bw)return aw?-1:1;if(sort==='class'&&aw&&bw){const d=classSortKey(a.homeroomClass)-classSortKey(b.homeroomClass);if(d)return d}const n=(a.name||'').localeCompare(b.name||'','id',{sensitivity:'base'});return sort==='za'?-n:n});
 const wc=rows.filter(x=>x.isHomeroom).length,gc=rows.length-wc;
 target.innerHTML=`<div class="teacher-list-summary"><span><b>${wc}</b> Wali Kelas</span><span><b>${gc}</b> Guru</span></div><div class="table-wrap"><table class="student-master"><thead><tr><th>NIP Guru</th><th>Nama</th><th>Jenis</th><th>Kelas Wali</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows.map((u,i)=>`${i===wc&&gc?'<tr class="teacher-divider"><td colspan="6">Guru</td></tr>':''}<tr><td><b>${esc(u.loginId||'-')}</b></td><td>${esc(u.name||'-')}</td><td><span class="badge ${u.isHomeroom?'ok':'neutral'}">${u.isHomeroom?'Wali Kelas':'Guru'}</span></td><td>${u.isHomeroom?esc(u.homeroomClass||'-'):'-'}</td><td><span class="badge ${u.active===false?'warn':'ok'}">${u.active===false?'Nonaktif':'Aktif'}</span></td><td><div class="row-actions"><button class="btn-mini edit" data-edit-teacher="${esc(u.uid)}">Edit</button><button class="btn-mini" data-reset-password="${esc(u.uid)}">Reset Password</button><button class="btn-mini danger" data-delete-teacher="${esc(u.uid)}">Hapus Akun</button></div></td></tr>`).join('')||'<tr><td colspan="6"><div class="empty">Belum ada akun guru.</div></td></tr>'}</tbody></table></div>`;
 document.querySelectorAll('[data-edit-teacher]').forEach(b=>b.onclick=()=>editTeacherProfile(b.dataset.editTeacher));document.querySelectorAll('[data-reset-password]').forEach(b=>b.onclick=()=>adminResetTeacherPassword(b.dataset.resetPassword));
  document.querySelectorAll('[data-delete-teacher]').forEach(b=>b.onclick=()=>deleteTeacherAccount(b.dataset.deleteTeacher));
}


async function resetWadahRecord(recordId){
  if(state.profile.role!=='admin')return;
  let r=state.recordsToday.find(x=>x.id===recordId);
  if(!r){
    try{const snap=await getDoc(doc(db,'records',recordId));if(snap.exists())r={id:snap.id,...snap.data()};}catch(_){}
  }
  if(!r){toast('Data pendataan tidak ditemukan');return;}
  const reason=prompt(`Alasan reset pendataan ${r.classId} tanggal ${r.date}:`,'Koreksi data');
  if(reason===null)return;
  if(!confirm(`Reset ${r.classId} menjadi Belum Pendataan?

Data lama tetap disimpan di arsip Admin.`))return;
  try{
    const now=new Date(),archiveId=`${recordId}_${now.getTime()}`;
    await setDoc(doc(db,'recordResetArchive',archiveId),{...r,originalId:recordId,resetReason:reason,resetByUid:state.user.uid,resetByName:state.profile.name,resetAt:now.toISOString()});
    await deleteDoc(doc(db,'records',recordId));
    await addAdminAudit('RESET_WADAH',{recordId,classId:r.classId,date:r.date,archiveId,reason});
    await refreshCore();
    toast(`${r.classId} kembali menjadi Belum Pendataan`);
    if(state.page==='recap')renderWadahRecap();else renderShell();
  }catch(e){console.error(e);toast('Reset pendataan gagal')}
}

async function adminResetTeacherPassword(uid){
  if(state.profile.role!=='admin')return;
  const u=(window.masterUsers||[]).find(x=>x.uid===uid);if(!u)return;
  const temp=prompt(`Masukkan password baru sementara untuk ${u.name||u.loginId}.\nMinimal 6 karakter.`);
  if(temp===null)return;
  if(temp.length<6)return toast('Password minimal 6 karakter');
  if(!confirm(`Reset password akun ${u.loginId} - ${u.name}?\n\nPengguna harus memakai password baru ini untuk login.`))return;
  try{
    const token=await auth.currentUser.getIdToken(true);
    const url=`https://us-central1-${cfg.projectId}.cloudfunctions.net/adminResetTeacherPassword`;
    const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({uid,newPassword:temp})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||data.ok!==true)throw new Error(data.error||'Cloud Function reset password belum tersedia');
    await addAdminAudit('RESET_TEACHER_PASSWORD',{uid,loginId:u.loginId,name:u.name});
    toast(`Password ${u.name||u.loginId} berhasil direset`);
  }catch(e){
    console.error(e);
    toast('Reset password memerlukan Cloud Function Admin. Lihat SETUP_RESET_PASSWORD.md.',7000);
  }
}

async function deleteTeacherAccount(uid){
  const u=(window.masterUsers||[]).find(x=>x.uid===uid);
  if(!u) return;
  if(u.role==='admin') return toast('Akun Administrator tidak dapat dihapus dari menu ini.');
  const label=u.isHomeroom?`Wali Kelas ${u.homeroomClass||''}`:'Guru';
  const ok=confirm(`Hapus akun ${label} ${u.name||u.loginId||''}?\n\nAkses PakKom Eco Track akan langsung dicabut.`);
  if(!ok) return;
  try{
    await deleteDoc(doc(db,'users',uid));
    toast(`Akun ${u.name||u.loginId||''} berhasil dihapus.`);
    await master();
  }catch(e){
    console.error(e);
    toast('Gagal menghapus akun guru.');
  }
}

function renderPendingApprovals(){
  const target=$('#pendingApprovals'); if(!target)return;
  const rows=(window.masterUsers||[]).filter(u=>u.role==='guru'&&u.approved===false&&u.rejected!==true);
  if(!rows.length){target.innerHTML='';return;}
  target.innerHTML=`<div class="approval-box">
    <div class="section-head approval-head">
      <div><h4 style="margin:0">Menunggu Persetujuan (${rows.length})</h4><small>Pilih beberapa akun atau setujui semuanya sekaligus. Wali kelas yang bentrok akan dilewati otomatis.</small></div>
      <div class="approval-actions">
        <button id="approveSelected" class="btn secondary" disabled>✓ Approve Terpilih</button>
        <button id="approveAllPending" class="btn primary">✓ Approve Semua</button>
      </div>
    </div>
    <div class="bulk-summary approval-summary"><span id="approvalSelectedInfo">Belum ada akun dipilih</span><button id="selectAllPendingBtn" class="btn-mini edit">Pilih Semua</button></div>
    <div class="table-wrap"><table class="approval-table"><thead><tr><th class="check-col"><input id="pendingSelectAll" type="checkbox" aria-label="Pilih semua akun pending"></th><th>NIP Guru</th><th>Nama</th><th>Daftar Sebagai</th><th>Kelas Wali</th><th>Aksi</th></tr></thead><tbody>${rows.map(u=>`<tr><td class="check-col"><input class="pending-check" type="checkbox" value="${esc(u.uid)}" aria-label="Pilih ${esc(u.name||u.loginId||'akun')}"></td><td><b>${esc(u.loginId||'-')}</b></td><td>${esc(u.name||'-')}</td><td><span class="badge ${u.requestedType==='wali'?'ok':'neutral'}">${u.requestedType==='wali'?'Wali Kelas':'Guru'}</span></td><td>${u.requestedType==='wali'?esc(u.requestedHomeroomClass||'-'):'-'}</td><td><button class="btn-mini edit" data-approve-teacher="${u.uid}">Approve</button> <button class="btn-mini danger" data-reject-teacher="${u.uid}">Tolak</button></td></tr>`).join('')}</tbody></table></div>
  </div>`;

  const checks=()=>[...document.querySelectorAll('.pending-check')];
  const updateSelection=()=>{
    const all=checks(), selected=all.filter(x=>x.checked);
    const master=$('#pendingSelectAll');
    if(master){master.checked=all.length>0&&selected.length===all.length;master.indeterminate=selected.length>0&&selected.length<all.length;}
    if($('#approveSelected')) $('#approveSelected').disabled=selected.length===0;
    if($('#approvalSelectedInfo')) $('#approvalSelectedInfo').textContent=selected.length?`${selected.length} akun dipilih`:'Belum ada akun dipilih';
    if($('#selectAllPendingBtn')) $('#selectAllPendingBtn').textContent=selected.length===all.length?'Batal Pilih Semua':'Pilih Semua';
  };
  checks().forEach(c=>c.onchange=updateSelection);
  if($('#pendingSelectAll')) $('#pendingSelectAll').onchange=e=>{checks().forEach(c=>c.checked=e.target.checked);updateSelection()};
  if($('#selectAllPendingBtn')) $('#selectAllPendingBtn').onclick=()=>{const all=checks();const choose=!all.every(c=>c.checked);all.forEach(c=>c.checked=choose);updateSelection()};
  if($('#approveSelected')) $('#approveSelected').onclick=()=>approvePendingBulk(checks().filter(c=>c.checked).map(c=>c.value),false);
  if($('#approveAllPending')) $('#approveAllPending').onclick=()=>approvePendingBulk(rows.map(u=>u.uid),true);

  document.querySelectorAll('[data-approve-teacher]').forEach(b=>b.onclick=()=>approveTeacher(b.dataset.approveTeacher));
  document.querySelectorAll('[data-reject-teacher]').forEach(b=>b.onclick=()=>rejectTeacher(b.dataset.rejectTeacher));
  updateSelection();
}
function pendingApprovalPlan(uid,occupied){
  const u=(window.masterUsers||[]).find(x=>x.uid===uid);
  if(!u) return {ok:false,reason:'Akun tidak ditemukan'};
  const isHomeroom=u.requestedType==='wali';
  const homeroomClass=isHomeroom?(u.requestedHomeroomClass||''):'';
  if(isHomeroom&&!state.classes.includes(homeroomClass)) return {ok:false,u,reason:`Kelas ${homeroomClass||'-'} belum tersedia`};
  if(isHomeroom&&occupied.has(homeroomClass)) return {ok:false,u,reason:`${homeroomClass} sudah memiliki wali kelas`};
  return {ok:true,u,isHomeroom,homeroomClass};
}

async function approveTeacher(uid){
  const occupied=new Set((window.masterUsers||[]).filter(x=>x.role==='guru'&&x.active!==false&&x.approved!==false&&x.isHomeroom===true&&x.homeroomClass).map(x=>x.homeroomClass));
  const plan=pendingApprovalPlan(uid,occupied);
  if(!plan.ok) return toast(plan.reason);
  await setDoc(doc(db,'users',uid),{approved:true,active:true,rejected:false,isHomeroom:plan.isHomeroom,homeroomClass:plan.homeroomClass,approvedAt:new Date().toISOString(),approvedByUid:state.user.uid,approvedByName:state.profile.name},{merge:true});
  toast(`Akun ${plan.u.loginId} disetujui`);
  await master();
}

async function approvePendingBulk(uids,allMode=false){
  const unique=[...new Set(uids||[])].filter(Boolean);
  if(!unique.length) return toast('Pilih akun yang ingin disetujui.');
  const label=allMode?'semua akun pending':`${unique.length} akun terpilih`;
  if(!confirm(`Approve ${label}?\n\nAkun Wali Kelas yang kelasnya belum tersedia atau bentrok dengan wali kelas lain akan dilewati.`)) return;

  const occupied=new Set((window.masterUsers||[]).filter(x=>x.role==='guru'&&x.active!==false&&x.approved!==false&&x.isHomeroom===true&&x.homeroomClass).map(x=>x.homeroomClass));
  const approved=[], skipped=[];
  const now=new Date().toISOString();

  for(const uid of unique){
    const plan=pendingApprovalPlan(uid,occupied);
    if(!plan.ok){skipped.push(`${plan.u?.loginId||uid}: ${plan.reason}`);continue;}
    try{
      await setDoc(doc(db,'users',uid),{
        approved:true,active:true,rejected:false,
        isHomeroom:plan.isHomeroom,
        homeroomClass:plan.homeroomClass,
        approvedAt:now,
        approvedByUid:state.user.uid,
        approvedByName:state.profile.name
      },{merge:true});
      approved.push(plan.u.loginId||plan.u.name||uid);
      if(plan.isHomeroom&&plan.homeroomClass) occupied.add(plan.homeroomClass);
    }catch(e){
      console.error(e);
      skipped.push(`${plan.u.loginId||uid}: gagal menyimpan`);
    }
  }

  let msg=`${approved.length} akun berhasil di-approve`;
  if(skipped.length) msg+=` • ${skipped.length} dilewati`;
  toast(msg,6500);
  await master();
  if(skipped.length) console.warn('Approval dilewati:',skipped);
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
      await setDoc(doc(db,'users',uid),{
        name,role:'guru',approved:true,
        isHomeroom,
        homeroomClass:isHomeroom?homeroomClass:'',
        requestedType:isHomeroom?'wali':'guru',
        requestedHomeroomClass:isHomeroom?homeroomClass:'',
        active,
        updatedAt:new Date().toISOString(),
        updatedByUid:state.user.uid,
        updatedByName:state.profile.name
      },{merge:true});
      const verify=await getDoc(doc(db,'users',uid));
      if(!verify.exists() || Boolean(verify.data().isHomeroom)!==isHomeroom || String(verify.data().homeroomClass||'')!==(isHomeroom?homeroomClass:'')){
        throw new Error('Perubahan peran belum tersimpan');
      }
      await addAdminAudit('UPDATE_TEACHER_ROLE',{uid,loginId:u.loginId,name,isHomeroom,homeroomClass:isHomeroom?homeroomClass:'',active}); closeEditModal(); toast(isHomeroom?`Akun diubah menjadi Wali Kelas ${homeroomClass}`:'Akun diubah menjadi Guru'); await master();
    });
  const syncTeacherType=()=>{
    const wali=$('#mType')?.value==='wali';
    if($('#mClass')){ $('#mClass').disabled=!wali; if(!wali) $('#mClass').value=''; }
  };
  if($('#mType')) $('#mType').onchange=syncTeacherType;
  syncTeacherType();
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


window.pakkomSha256Text = async function(value){
  const data=new TextEncoder().encode(String(value||''));
  const hash=await crypto.subtle.digest('SHA-256',data);
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
};
async function sha256Text(value){
  return window.pakkomSha256Text(value);
}
function downloadStudentAccessTemplate(){
  if(!window.XLSX)return toast('Library Excel belum siap.');
  const rows=state.students
    .slice()
    .sort((a,b)=>classSortKey(a.classId)-classSortKey(b.classId)||String(a.name||'').localeCompare(String(b.name||''),'id'))
    .map(st=>({
      NIS:String(st.nis||st.id||''),
      Nama:String(st.name||''),
      Kelas:String(st.classId||''),
      Password:String(st.nis||st.id||''),
      Aktif:st.active===false?'TIDAK':'YA'
    }));
  const ws=XLSX.utils.json_to_sheet(rows,{header:['NIS','Nama','Kelas','Password','Aktif']});
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Akses Login Siswa');
  XLSX.writeFile(wb,'akses-login-siswa-pakkom-ecotrack.xlsx');
}
$('#studentAccessImport')?.addEventListener('change',async e=>{
  const f=e.target.files?.[0]; if(!f)return;
  try{
    const buf=await f.arrayBuffer(),wb=XLSX.read(buf),sheet=wb.Sheets['Akses Login Siswa']||wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(sheet,{defval:''});
    const master=new Map(state.students.map(st=>[String(st.nis||st.id||'').trim(),st]));
    let skipped=0;
    const normalized=[];
    for(const r of rows){
      const nis=String(r.NIS||r.nis||'').trim();
      const password=String(r.Password||r.password||nis).trim();
      const active=['ya','y','yes','1','true','aktif'].includes(String(r.Aktif||r.aktif||'YA').trim().toLowerCase());
      const st=master.get(nis);
      if(!nis||!password||!st){skipped++;continue;}
      normalized.push({nis,studentId:st.id,name:st.name||'',classId:st.classId||'',active,passwordHash:await sha256Text(password)});
    }
    if(!normalized.length)throw new Error('Tidak ada baris akses yang cocok dengan master siswa.');
    openImportPreview('Preview Akses Login Siswa',normalized.map(x=>[x.nis,x.name,x.classId,x.active?'Aktif':'Nonaktif']),['NIS','Nama','Kelas','Akses'],skipped,async()=>{
      const now=new Date().toISOString();
      for(let i=0;i<normalized.length;i+=350){
        const batch=writeBatch(db);
        normalized.slice(i,i+350).forEach(x=>{
          batch.set(doc(db,'studentAccess',x.nis),{nis:x.nis,studentId:x.studentId,name:x.name,classId:x.classId,passwordHash:x.passwordHash,active:x.active,updatedAt:now,updatedByUid:state.user.uid},{merge:true});
          batch.set(doc(db,'students',x.studentId),{loginEnabled:x.active,loginUpdatedAt:now},{merge:true});
        });
        await batch.commit();
      }
      closeEditModal(); e.target.value=''; toast(`Akses login tersimpan: ${normalized.length} siswa`,7000); await master();
    });
  }catch(err){console.error(err);toast(err.message||'Upload akses login gagal.');e.target.value='';}
});

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
    const buf=await f.arrayBuffer(), wb=XLSX.read(buf), sheet=wb.Sheets['Pendataan Wadah Makan & Tumbler']||wb.Sheets[wb.SheetNames[0]], rows=XLSX.utils.sheet_to_json(sheet,{defval:''});
    const studentMap=new Map(state.students.map(st=>[String(st.nis||st.id).trim(),st])); let skipped=0;
    const normalized=rows.map(r=>{const date=normalizeImportDate(r.Tanggal||r.tanggal||r.Date),classId=String(r.Kelas||r.kelas||'').trim().toUpperCase(),nis=String(r.NIS||r.nis||'').trim(),st=studentMap.get(nis),presence=presenceImport(r.Kehadiran||r.kehadiran);return {date,classId,nis,name:st?.name||String(r.Nama||r.nama||'').trim(),studentId:st?.id||'',presence,food:presence==='hadir'&&boolImport(r.Wadah||r.wadah),tumbler:presence==='hadir'&&boolImport(r.Tumbler||r.tumbler),valid:!!(date&&classId&&nis&&st&&st.classId===classId)};}).filter(r=>{if(!r.valid){skipped++;return false}return true;});
    if(!normalized.length)throw new Error('Tidak ada baris pendataan valid. Pastikan Tanggal, Kelas dan NIS sesuai master siswa.');
    window.pendingAttendanceImport=normalized;
    openImportPreview('Preview Upload Pendataan Wadah Makan & Tumbler',normalized.map(x=>[x.date,x.classId,x.nis,x.name,x.presence,x.food?'Ya':'Tidak',x.tumbler?'Ya':'Tidak']),['Tanggal','Kelas','NIS','Nama','Kehadiran','Wadah Makan','Tumbler'],skipped,()=>commitAttendanceImport(e));
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
    console.log('PakKom Application Core v3.3.6 starting');
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




// ===== TUGAS SISWA v6 : INDIVIDU + KELOMPOK + DRAF + LINK =====
function taskStatusLabel(sub){
  if(!sub)return ['Belum dikerjakan','warn'];
  if(sub.status==='draft')return ['Draf','neutral'];
  if(sub.status==='revision')return ['Perlu perbaikan','warn'];
  if(sub.status==='graded')return ['Sudah dinilai','ok'];
  if(sub.status==='submitted')return ['Dikumpulkan','neutral'];
  return ['Belum dikerjakan','warn'];
}
function taskTypeLabel(t){return t.taskType==='group'?'Kelompok':'Individu'}
function taskIsLate(t){return !!(t.dueDate && todayId()>t.dueDate)}
function myNis(){return String(state.profile?.loginId||state.profile?.nis||'').trim()}
function groupForStudent(t){
  if(t.taskType!=='group')return null;
  const nis=myNis(), cls=state.profile?.classId;
  const groups=t.groupAssignments?.[cls]||[];
  return groups.find(g=>(g.members||[]).some(m=>String(m.nis)===nis))||null;
}
function makeAutoGroups(classId,count){
  const rows=state.students.filter(s=>s.active!==false&&s.classId===classId).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'id'));
  const groups=Array.from({length:Math.max(1,count)},(_,i)=>({groupNo:i+1,members:[]}));
  rows.forEach((st,i)=>groups[i%groups.length].members.push({studentId:st.id,nis:String(st.nis||st.id||''),name:st.name||''}));
  return groups.filter(g=>g.members.length);
}
async function fetchAssignmentsForClass(classId){
  if(!classId)return [];
  // Query harus sesuai Firestore Rules siswa. Membaca seluruh collection akan ditolak
  // karena di dalamnya dapat terdapat tugas untuk kelas lain.
  const snap=await getDocs(query(collection(db,'assignments'),where('targetClasses','array-contains',classId)));
  return snap.docs.map(d=>({id:d.id,...d.data()}))
    .filter(a=>a.archived!==true&&a.published===true)
    .sort((a,b)=>String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999')));
}
async function fetchMySubmissions(){
  const nis=myNis();
  if(!nis)return [];
  // Individu dan kelompok dibaca dengan query berbeda agar Rules dapat memverifikasi
  // bahwa siswa memang pemilik / anggota submission tanpa composite index.
  const [ownSnap,groupSnap]=await Promise.all([
    getDocs(query(collection(db,'taskSubmissions'),where('nis','==',nis))),
    getDocs(query(collection(db,'taskSubmissions'),where('memberNis','array-contains',nis)))
  ]);
  const map=new Map();
  [...ownSnap.docs,...groupSnap.docs].forEach(d=>map.set(d.id,{id:d.id,...d.data()}));
  return [...map.values()];
}
async function studentHome(){
  pageMeta('Tugas Saya',`${state.profile.name||'Siswa'} • ${state.profile.classId||'-'}`);
  content.innerHTML='<div class="card"><div class="empty">Memuat tugas...</div></div>';
  let tasks=[],subs=[];
  try{
    [tasks,subs]=await Promise.all([fetchAssignmentsForClass(state.profile.classId),fetchMySubmissions()]);
  }catch(e){
    console.error('Student task dashboard error',e);
    content.innerHTML=`<div class="student-hero"><div><small>Halo,</small><h2>${esc(state.profile.name||'Siswa')} 👋</h2><p>Kelas ${esc(state.profile.classId||'-')}</p></div><div class="student-lock">🔒 Akun siswa</div></div><div class="card"><div class="empty"><b>Tugas belum dapat dimuat.</b><br><small>${esc(e?.message||'Periksa Firestore Rules Tugas Siswa v6.1.')}</small></div></div>`;
    return;
  }
  const sm=new Map(subs.map(x=>[x.taskId,x]));
  const active=tasks.filter(t=>!t.openDate||t.openDate<=todayId());
  const pending=active.filter(t=>!sm.has(t.id)).length, drafts=subs.filter(s=>s.status==='draft'||s.status==='revision').length, done=subs.filter(s=>s.status==='graded').length;
  content.innerHTML=`<div class="student-hero"><div><small>Halo,</small><h2>${esc(state.profile.name||'Siswa')} 👋</h2><p>Kelas ${esc(state.profile.classId||'-')}</p></div><div class="student-lock">🔒 Akun siswa</div></div>
  <div class="grid stats student-task-stats"><div class="stat"><span>Belum</span><strong>${pending}</strong></div><div class="stat"><span>Draf/Revisi</span><strong>${drafts}</strong></div><div class="stat"><span>Selesai</span><strong>${done}</strong></div></div>
  <div class="section-head"><div><h3>Tugas Aktif</h3><small>Tugas individu dan kelompokmu.</small></div></div>
  <div class="task-card-list">${active.sort((a,b)=>(sm.has(a.id)?1:0)-(sm.has(b.id)?1:0)).map(t=>studentTaskCard(t,sm.get(t.id))).join('')||'<div class="card empty">Belum ada tugas aktif.</div>'}</div>`;
  document.querySelectorAll('[data-student-task]').forEach(b=>b.onclick=()=>studentTaskDetail(b.dataset.studentTask));
}
function studentTaskCard(t,sub){
  const [label,cls]=taskStatusLabel(sub), g=groupForStudent(t);
  const late=taskIsLate(t)&&!sub;
  return `<button class="task-student-card" data-student-task="${esc(t.id)}"><div><div class="task-mini-tags"><span class="badge neutral">${taskTypeLabel(t)}</span>${g?`<span class="badge neutral">Kelompok ${g.groupNo}</span>`:''}${late?'<span class="badge warn">Terlambat</span>':''}</div><b>${esc(t.title||'Tugas')}</b><small>${t.dueDate?'Batas: '+esc(t.dueDate):'Tanpa batas waktu'}</small><span class="badge ${cls}">${label}</span></div><strong>›</strong></button>`
}
async function studentTasks(){return studentHome()}
function studentAccount(){pageMeta('Saya','Akun siswa');content.innerHTML=`<div class="card account-card"><div class="account-name">${esc(state.profile.name||'-')}</div><div class="account-details"><div class="account-row"><span>NIS</span><b>${esc(myNis()||'-')}</b></div><div class="account-row"><span>Kelas</span><b>${esc(state.profile.classId||'-')}</b></div><div class="account-row"><span>Password</span><b>Sama dengan NIS • tidak dapat diubah</b></div></div><div class="notice">Akun ini hanya dapat mengakses tugas milikmu.</div><button id="studentLogout" class="btn danger">Keluar</button></div>`;$('#studentLogout').onclick=()=>$('#logoutModal')?.classList.remove('hidden')}
async function studentTaskDetail(id){
  const d=await getDoc(doc(db,'assignments',id)); if(!d.exists())return toast('Tugas tidak ditemukan'); const t={id:d.id,...d.data()};
  const subs=await fetchMySubmissions(), sub=subs.find(x=>x.taskId===id), group=groupForStudent(t);
  if(t.taskType==='group'&&!group)return toast('Kamu belum masuk kelompok pada tugas ini. Hubungi Admin.');
  const locked=sub?.status==='graded'; const comps=Array.isArray(t.components)?t.components:[];
  pageMeta(t.title||'Tugas','Pengumpulan Tugas');
  content.innerHTML=`<button id="backStudentTasks" class="btn ghost">← Tugas Saya</button><div class="card task-detail"><div class="task-mini-tags"><span class="badge neutral">${taskTypeLabel(t)}</span>${group?`<span class="badge neutral">Kelompok ${group.groupNo}</span>`:''}</div><div class="task-deadline">📅 ${t.dueDate?'Batas '+esc(t.dueDate):'Tanpa batas waktu'}</div><h2>${esc(t.title||'Tugas')}</h2><p>${esc(t.description||'')}</p>${group?`<div class="group-member-box"><b>Anggota Kelompok ${group.groupNo}</b><p>${group.members.map(m=>esc(m.name)).join(' • ')}</p><small>Cukup satu anggota yang mengumpulkan. Semua anggota akan otomatis tercatat.</small></div>`:''}<h3>Yang harus dikumpulkan</h3><form id="studentSubmissionForm">${comps.map((c,i)=>submissionComponentHtml(c,i,sub,locked)).join('')} ${t.requireReflection?`<label class="field-label">${esc(t.reflectionLabel||'Refleksi Akhir')} ${t.reflectionRequired===false?'':'*'}</label><textarea class="input-inline task-textarea" name="reflection" maxlength="${Number(t.reflectionMax||500)}" ${t.reflectionRequired===false?'':'required'} ${locked?'disabled':''}>${esc(sub?.reflection||'')}</textarea>`:''}${locked?'':`<div class="task-submit-actions"><button id="saveDraftTask" class="btn secondary" type="button">Simpan Draf</button><button class="btn primary" type="submit">${sub?.status==='submitted'?'Perbarui Pengumpulan':'Kumpulkan Tugas'}</button></div>`}</form>${sub?.submittedByName&&t.taskType==='group'?`<div class="notice">Terakhir dikumpulkan oleh <b>${esc(sub.submittedByName)}</b>.</div>`:''}${sub?.status==='revision'?`<div class="notice warn"><b>Perlu perbaikan.</b><br>${esc(sub.feedback||'Silakan perbaiki lalu kumpulkan kembali.')}</div>`:''}${sub?.status==='graded'?`<div class="grade-result"><b>${sub.score==null?'Selesai':'Nilai '+esc(sub.score)}</b><p>${esc(sub.feedback||'')}</p></div>`:''}</div>`;
  $('#backStudentTasks').onclick=()=>{state.page='studenthome';renderShell()};
  if(!locked){$('#studentSubmissionForm').onsubmit=e=>saveStudentSubmission(e,t,sub,'submitted');$('#saveDraftTask').onclick=()=>saveStudentSubmission({preventDefault(){},target:$('#studentSubmissionForm')},t,sub,'draft')}
}
function submissionComponentHtml(c,i,sub,locked=false){
  const old=sub?.answers?.[i]||{}, req=c.required!==false?'required':'';
  if(c.type==='link')return `<div class="submission-component"><label><b>${esc(c.label||'Link')}</b> ${req?'*':''}</label><input class="input-inline" type="url" name="link_${i}" placeholder="https://..." value="${esc(old.url||'')}" ${req} ${locked?'disabled':''}><label class="field-label">${esc(c.descriptionLabel||'Keterangan link')}</label><textarea name="desc_${i}" maxlength="${Number(c.descriptionMax||500)}" ${locked?'disabled':''}>${esc(old.description||'')}</textarea>${c.linkHint?`<small>${esc(c.linkHint)}</small>`:''}</div>`;
  if(['photo','video','document'].includes(c.type))return `<div class="submission-component"><label><b>${esc(c.label||c.type)}</b> ${req?'*':''}</label><input type="file" name="file_${i}" accept="${c.type==='photo'?'image/*':c.type==='video'?'video/*':'.pdf,.doc,.docx'}" ${!old.fileName&&req?'required':''} ${locked?'disabled':''}><label class="field-label">${esc(c.descriptionLabel||'Deskripsi bukti')} *</label><textarea name="desc_${i}" maxlength="${Number(c.descriptionMax||500)}" required ${locked?'disabled':''}>${esc(old.description||'')}</textarea>${old.fileName?`<small>File sebelumnya: ${esc(old.fileName)}</small>`:''}</div>`;
  return `<div class="submission-component"><label><b>${esc(c.label||'Jawaban')}</b> ${req?'*':''}</label><textarea name="text_${i}" maxlength="${Number(c.maxLength||500)}" ${req} ${locked?'disabled':''}>${esc(old.text||'')}</textarea></div>`
}
async function saveStudentSubmission(e,t,existing,status){
  e.preventDefault(); const form=e.target, fd=new FormData(form), answers=[], comps=t.components||[];
  if(status==='submitted' && taskIsLate(t) && t.allowLate===false){toast('Batas pengumpulan sudah berakhir. Hubungi guru jika perlu dibuka kembali.');return}
  if(status==='submitted'&&!form.reportValidity())return;
  for(let i=0;i<comps.length;i++){
    const c=comps[i],old=existing?.answers?.[i]||{};
    if(c.type==='link')answers.push({url:String(fd.get(`link_${i}`)||'').trim(),description:String(fd.get(`desc_${i}`)||'').trim()});
    else if(['photo','video','document'].includes(c.type)){const f=fd.get(`file_${i}`);if(f&&f.size>0){toast('Upload file belum diaktifkan. Untuk video gunakan komponen Link Video/Media Sosial.');return}answers.push({...old,description:String(fd.get(`desc_${i}`)||'').trim()})}
    else answers.push({text:String(fd.get(`text_${i}`)||'').trim()});
  }
  const now=new Date().toISOString(), group=groupForStudent(t), ref=existing?doc(db,'taskSubmissions',existing.id):collection(db,'taskSubmissions').doc();
  const memberNis=group?group.members.map(m=>String(m.nis)):[];
  await setDoc(ref,{taskId:t.id,taskType:t.taskType||'individual',studentUid:state.user.uid,studentId:state.profile.studentId||'',nis:myNis(),studentName:state.profile.name||'',classId:state.profile.classId||'',groupNo:group?.groupNo||null,groupKey:group?`${state.profile.classId}-G${group.groupNo}`:'',memberNis,memberNames:group?group.members.map(m=>m.name):[],answers,reflection:String(fd.get('reflection')||''),status,submittedAt:status==='submitted'?now:(existing?.submittedAt||null),submittedByNis:status==='submitted'?myNis():(existing?.submittedByNis||''),submittedByName:status==='submitted'?(state.profile.name||''):(existing?.submittedByName||''),updatedAt:now,updatedByNis:myNis()},{merge:true});
  toast(status==='draft'?'Draf berhasil disimpan':'Tugas berhasil dikumpulkan'); state.page='studenthome';renderShell();
}
async function taskManagementPage(){
  if(state.profile.role==='siswa')return;
  if(state.profile.role!=='admin' && state.profile.isHomeroom!==true){toast('Menu Tugas Siswa hanya untuk Admin dan Wali Kelas.');state.page='home';return renderShell()}
  pageMeta('Tugas Siswa',state.profile.role==='admin'?'Kelola tugas dan pengumpulan':'Periksa dan nilai tugas kelas');
  // Tombol utama dirender lebih dulu sehingga Admin tetap dapat membuat tugas meski
  // pembacaan submission mengalami masalah Rules/jaringan.
  content.innerHTML=`${state.profile.role==='admin'?'<div class="section-head"><div><h3>Kelola Tugas</h3><small>Individu atau kelompok, dengan komponen fleksibel.</small></div><button id="newAssignment" class="btn primary">+ Buat Tugas</button></div>':''}<div id="taskAdminLoad" class="task-admin-list"><div class="card"><div class="empty">Memuat daftar tugas...</div></div></div>`;
  $('#newAssignment')&&($('#newAssignment').onclick=()=>assignmentBuilder());
  try{
    const as=await getDocs(collection(db,'assignments'));
    const tasks=as.docs.map(d=>({id:d.id,...d.data()})).filter(t=>t.archived!==true);
    let subs=[];
    try{
      const ss=state.profile.role==='admin'
        ? await getDocs(collection(db,'taskSubmissions'))
        : await getDocs(query(collection(db,'taskSubmissions'),where('classId','==',state.profile.homeroomClass)));
      subs=ss.docs.map(d=>({id:d.id,...d.data()}));
    }catch(subErr){
      console.error('Task submissions read error',subErr);
      // Daftar tugas dan Task Builder tetap dapat digunakan walau submission belum terbaca.
    }
    const allowed=state.profile.role==='admin'?tasks:tasks.filter(t=>!Array.isArray(t.targetClasses)||t.targetClasses.includes(state.profile.homeroomClass));
    const box=$('#taskAdminLoad'); if(!box)return;
    box.innerHTML=allowed.map(t=>{const x=subs.filter(s=>s.taskId===t.id&&(state.profile.role==='admin'||s.classId===state.profile.homeroomClass));return `<div class="card task-admin-card"><div><div class="task-mini-tags"><span class="badge neutral">${taskTypeLabel(t)}</span>${t.taskType==='group'?`<span class="badge neutral">${t.groupCount||6} kelompok/kelas</span>`:''}</div><h3>${esc(t.title||'Tugas')}</h3><small>${esc((t.targetClasses||[]).join(', ')||'Semua kelas')} • Batas ${esc(t.dueDate||'-')}</small></div><div class="task-admin-metrics"><span><b>${x.filter(s=>s.status==='submitted'||s.status==='graded').length}</b> dikumpulkan</span><span><b>${x.filter(s=>s.status==='draft'||s.status==='revision').length}</b> draf/revisi</span><span><b>${x.filter(s=>s.status==='graded').length}</b> dinilai</span></div><div class="row-actions"><button class="btn secondary" data-review-task="${t.id}">Pengumpulan</button>${state.profile.role==='admin'?`<button class="btn ghost" data-edit-task="${t.id}">Edit</button>`:''}</div></div>`}).join('')||'<div class="card empty">Belum ada tugas. Tekan <b>+ Buat Tugas</b> untuk membuat tugas pertama.</div>';
    document.querySelectorAll('[data-edit-task]').forEach(b=>b.onclick=()=>assignmentBuilder(b.dataset.editTask));
    document.querySelectorAll('[data-review-task]').forEach(b=>b.onclick=()=>reviewTask(b.dataset.reviewTask));
  }catch(e){
    console.error('Task management error',e);
    const box=$('#taskAdminLoad');
    if(box)box.innerHTML=`<div class="card"><div class="empty"><b>Daftar tugas belum dapat dimuat.</b><br><small>${esc(e?.message||'Periksa Firestore Rules Tugas Siswa v6.1.')}</small></div></div>`;
  }
}
async function assignmentBuilder(id=''){
  try{
    if(String(state.profile?.role||'').toLowerCase()!=='admin'){
      toast('Task Builder hanya dapat dibuka oleh Admin.');
      return;
    }
    let t={title:'',description:'',taskType:'individual',groupCount:6,targetClasses:[],components:[{type:'link',label:'Link Video / Media Sosial',required:true,descriptionLabel:'Deskripsi kegiatan',descriptionMax:500,linkHint:'Google Drive, YouTube, Instagram, TikTok, atau link lain yang dapat dibuka guru.'}],published:true,requireReflection:false,allowLate:true};
    if(id){
      const d=await getDoc(doc(db,'assignments',id));
      if(d.exists()) t={id:d.id,...d.data()};
    }
    const classes=Array.isArray(state.classes)?state.classes.filter(Boolean):[];
    pageMeta(id?'Edit Tugas':'Buat Tugas','Task Builder');
    content.innerHTML=`<div class="card task-builder">
      <div class="section-head"><div><h3>${id?'Edit Tugas':'Buat Tugas Baru'}</h3><small>Atur jenis tugas, kelas sasaran, dan bukti yang harus dikumpulkan.</small></div></div>
      <label>Judul Tugas *</label><input id="taskTitle" class="input-inline" value="${esc(t.title||'')}" placeholder="Contoh: Kampanye Peduli Lingkungan">
      <label>Deskripsi / Petunjuk</label><textarea id="taskDescription" placeholder="Tuliskan petunjuk tugas...">${esc(t.description||'')}</textarea>
      <div class="form-grid"><div><label>Jenis Tugas</label><select id="taskType" class="input-inline"><option value="individual" ${t.taskType!=='group'?'selected':''}>Individu</option><option value="group" ${t.taskType==='group'?'selected':''}>Kelompok</option></select></div><div id="groupCountWrap" ${t.taskType==='group'?'':'class="hidden"'}><label>Jumlah kelompok per kelas</label><input id="taskGroupCount" type="number" min="2" max="12" class="input-inline" value="${Number(t.groupCount||6)}"><small>Default 6 kelompok per kelas.</small></div></div>
      <div class="form-grid"><div><label>Tanggal mulai</label><input id="taskOpen" type="date" class="input-inline" value="${esc(t.openDate||todayId())}"></div><div><label>Batas pengumpulan</label><input id="taskDue" type="date" class="input-inline" value="${esc(t.dueDate||'')}"></div></div>
      <label>Kelas Sasaran *</label>
      <div class="class-checks">${classes.length?classes.map(c=>`<label><input type="checkbox" data-task-class="${esc(c)}" ${Array.isArray(t.targetClasses)&&t.targetClasses.includes(c)?'checked':''}> ${esc(c)}</label>`).join(''):'<div class="notice warn">Data kelas belum termuat. Kembali ke Beranda lalu buka menu Tugas lagi.</div>'}</div>
      <div id="groupInfo" class="notice ${t.taskType==='group'?'':'hidden'}">Saat disimpan, siswa tiap kelas akan dibagi otomatis menjadi <b>${Number(t.groupCount||6)} kelompok</b>. Cukup satu anggota yang mengumpulkan.</div>
      <div class="section-head"><div><h3>Komponen Pengumpulan</h3><small>Video disarankan menggunakan link agar tidak memakai kapasitas Drive EcoTrack.</small></div><button id="addTaskComponent" class="btn secondary" type="button">+ Komponen</button></div>
      <div id="taskComponents"></div>
      <label class="check-line"><input id="taskReflection" type="checkbox" ${t.requireReflection?'checked':''}> Tambahkan Refleksi Akhir</label>
      <label class="check-line"><input id="taskAllowLate" type="checkbox" ${t.allowLate!==false?'checked':''}> Izinkan pengumpulan setelah deadline</label>
      <label class="check-line"><input id="taskPublished" type="checkbox" ${t.published!==false?'checked':''}> Terbitkan tugas ke siswa</label>
      <div id="taskSaveError" class="notice warn hidden"></div>
      <div class="row-actions"><button id="saveAssignment" class="btn primary" type="button">Simpan Tugas</button><button id="cancelAssignment" class="btn ghost" type="button">Batal</button></div>
    </div>`;
    window.taskBuilderComponents=JSON.parse(JSON.stringify(Array.isArray(t.components)&&t.components.length?t.components:[{type:'link',label:'Link Video / Media Sosial',required:true,descriptionLabel:'Deskripsi kegiatan',descriptionMax:500}]));
    renderTaskComponents();
    const add=$('#addTaskComponent'), save=$('#saveAssignment'), cancel=$('#cancelAssignment'), type=$('#taskType'), count=$('#taskGroupCount');
    if(add) add.onclick=addTaskComponent;
    if(save) save.onclick=()=>saveAssignment(t);
    if(cancel) cancel.onclick=taskManagementPage;
    if(type) type.onchange=()=>{$('#groupCountWrap')?.classList.toggle('hidden',type.value!=='group');$('#groupInfo')?.classList.toggle('hidden',type.value!=='group')};
    if(count) count.oninput=()=>{const b=$('#groupInfo b');if(b)b.textContent=count.value+' kelompok'};
  }catch(e){
    console.error('Task Builder error',e);
    toast('Task Builder gagal dibuka: '+(e?.message||e));
    content.innerHTML=`<div class="card"><div class="empty"><b>Task Builder gagal dibuka.</b><br><small>${esc(e?.message||String(e))}</small></div><div class="row-actions"><button id="backTaskError" class="btn ghost">Kembali</button></div></div>`;
    $('#backTaskError')&&($('#backTaskError').onclick=taskManagementPage);
  }
}
function renderTaskComponents(){
  const box=$('#taskComponents');if(!box)return;
  const arr=Array.isArray(window.taskBuilderComponents)?window.taskBuilderComponents:[];
  box.innerHTML=arr.map((c,i)=>`<div class="builder-component"><div class="form-grid"><select data-comp-type="${i}" class="input-inline"><option value="text" ${c.type==='text'?'selected':''}>Jawaban Teks</option><option value="link" ${c.type==='link'?'selected':''}>Link Video / Media Sosial</option><option value="photo" ${c.type==='photo'?'selected':''}>Foto Upload (belum aktif)</option><option value="video" ${c.type==='video'?'selected':''}>Video Upload (belum aktif)</option><option value="document" ${c.type==='document'?'selected':''}>Dokumen (belum aktif)</option></select><input data-comp-label="${i}" class="input-inline" value="${esc(c.label||'')}" placeholder="Judul komponen"></div><div class="form-grid"><input data-comp-desc="${i}" class="input-inline" value="${esc(c.descriptionLabel||'Deskripsi bukti')}" placeholder="Label deskripsi"><label class="check-line"><input data-comp-required="${i}" type="checkbox" ${c.required!==false?'checked':''}> Wajib</label></div><button class="btn-mini danger" type="button" data-remove-comp="${i}">Hapus</button></div>`).join('') || '<div class="notice">Belum ada komponen. Tekan <b>+ Komponen</b>.</div>';
  document.querySelectorAll('[data-remove-comp]').forEach(b=>b.onclick=()=>{window.taskBuilderComponents.splice(Number(b.dataset.removeComp),1);renderTaskComponents()});
}
function addTaskComponent(){
  if(!Array.isArray(window.taskBuilderComponents))window.taskBuilderComponents=[];
  window.taskBuilderComponents.push({type:'link',label:'Bukti / Link',required:true,descriptionLabel:'Deskripsi bukti',descriptionMax:500});
  renderTaskComponents();
}
async function saveAssignment(old){
  const btn=$('#saveAssignment'), errBox=$('#taskSaveError');
  try{
    if(btn){btn.disabled=true;btn.textContent='Menyimpan...'}
    if(errBox){errBox.classList.add('hidden');errBox.textContent=''}
    document.querySelectorAll('[data-comp-type]').forEach(el=>{
      const i=Number(el.dataset.compType),c=window.taskBuilderComponents[i];if(!c)return;
      c.type=el.value;
      c.label=(document.querySelector(`[data-comp-label="${i}"]`)?.value||'').trim() || `Komponen ${i+1}`;
      c.descriptionLabel=(document.querySelector(`[data-comp-desc="${i}"]`)?.value||'').trim() || 'Deskripsi bukti';
      c.required=!!document.querySelector(`[data-comp-required="${i}"]`)?.checked;
      c.descriptionMax=Number(c.descriptionMax||500);
      if(c.type==='link')c.linkHint='Pastikan link dapat dibuka guru tanpa meminta izin akses.';
    });
    const title=($('#taskTitle')?.value||'').trim();
    if(!title)throw new Error('Judul tugas wajib diisi.');
    const targetClasses=[...document.querySelectorAll('[data-task-class]:checked')].map(x=>x.dataset.taskClass).filter(Boolean);
    if(!targetClasses.length)throw new Error('Pilih minimal satu kelas sasaran.');
    if(!Array.isArray(window.taskBuilderComponents)||!window.taskBuilderComponents.length)throw new Error('Tambahkan minimal satu komponen pengumpulan.');
    const taskType=$('#taskType')?.value==='group'?'group':'individual';
    const groupCount=Math.max(2,Math.min(12,Number($('#taskGroupCount')?.value||6)));
    let groupAssignments={};
    if(taskType==='group'){
      targetClasses.forEach(c=>{groupAssignments[c]=makeAutoGroups(c,groupCount)});
      const empty=targetClasses.filter(c=>!(groupAssignments[c]||[]).length);
      if(empty.length)throw new Error('Data siswa belum tersedia untuk kelas: '+empty.join(', ')+'. Muat ulang data lalu coba lagi.');
    }
    const now=new Date().toISOString();
    const ref=old?.id?doc(db,'assignments',old.id):collection(db,'assignments').doc();
    const payload={
      title,
      description:($('#taskDescription')?.value||'').trim(),
      taskType,
      groupCount,
      groupAssignments,
      openDate:$('#taskOpen')?.value||'',
      dueDate:$('#taskDue')?.value||'',
      targetClasses,
      components:window.taskBuilderComponents,
      requireReflection:!!$('#taskReflection')?.checked,
      allowLate:!!$('#taskAllowLate')?.checked,
      published:!!$('#taskPublished')?.checked,
      archived:false,
      updatedAt:now,
      updatedByUid:state.user.uid,
      createdAt:old?.createdAt||now
    };
    await setDoc(ref,payload,{merge:true});
    toast(taskType==='group'?`Tugas berhasil disimpan. ${groupCount} kelompok dibuat per kelas.`:'Tugas individu berhasil disimpan.');
    await taskManagementPage();
  }catch(e){
    console.error('Save assignment error',e);
    const msg=e?.code==='permission-denied'?'Firestore menolak penyimpanan. Pastikan Rules v6.1/v6.2 sudah dipublish dan akun yang login benar-benar Admin.':(e?.message||String(e));
    if(errBox){errBox.textContent=msg;errBox.classList.remove('hidden')}
    toast('Tugas belum tersimpan: '+msg);
  }finally{
    if(btn && document.body.contains(btn)){btn.disabled=false;btn.textContent='Simpan Tugas'}
  }
}
async function reviewTask(taskId){
  const td=await getDoc(doc(db,'assignments',taskId));if(!td.exists())return;const t={id:td.id,...td.data()};const ss=await getDocs(query(collection(db,'taskSubmissions'),where('taskId','==',taskId)));let subs=ss.docs.map(d=>({id:d.id,...d.data()}));if(state.profile.role!=='admin'&&state.profile.isHomeroom)subs=subs.filter(s=>s.classId===state.profile.homeroomClass);
  pageMeta(t.title,'Pengumpulan siswa');content.innerHTML=`<button id="backTaskManage" class="btn ghost">← Tugas Siswa</button><div class="card"><div class="table-wrap"><table><thead><tr><th>${t.taskType==='group'?'Kelompok':'Siswa'}</th><th>Kelas</th><th>Status</th><th>Dikumpulkan oleh</th><th>Nilai</th><th></th></tr></thead><tbody>${subs.sort((a,b)=>String(a.classId).localeCompare(String(b.classId))||Number(a.groupNo||0)-Number(b.groupNo||0)).map(s=>`<tr><td><b>${t.taskType==='group'?`Kelompok ${esc(s.groupNo||'-')}`:esc(s.studentName||s.nis)}</b>${t.taskType==='group'?`<small class="table-subline">${(s.memberNames||[]).map(esc).join(', ')}</small>`:''}</td><td>${esc(s.classId)}</td><td>${taskStatusLabel(s)[0]}</td><td>${esc(s.submittedByName||'-')}</td><td>${esc(s.score??'-')}</td><td><button class="btn-mini edit" data-grade-sub="${s.id}">Periksa</button></td></tr>`).join('')||'<tr><td colspan="6">Belum ada pengumpulan.</td></tr>'}</tbody></table></div></div>`;$('#backTaskManage').onclick=taskManagementPage;document.querySelectorAll('[data-grade-sub]').forEach(b=>b.onclick=()=>gradeSubmission(b.dataset.gradeSub,t))
}
async function gradeSubmission(id,t){
  const d=await getDoc(doc(db,'taskSubmissions',id));if(!d.exists())return;const s={id:d.id,...d.data()};pageMeta('Penilaian',`${t.taskType==='group'?'Kelompok '+s.groupNo:s.studentName||s.nis} • ${s.classId}`);content.innerHTML=`<button id="backReview" class="btn ghost">← Pengumpulan</button><div class="review-layout"><div class="card"><h3>Bukti & Deskripsi</h3>${t.taskType==='group'?`<div class="group-member-box"><b>Anggota</b><p>${(s.memberNames||[]).map(esc).join(' • ')}</p></div>`:''}${(s.answers||[]).map((a,i)=>`<div class="review-proof"><b>${esc(t.components?.[i]?.label||'Bukti '+(i+1))}</b>${a.url?`<p><a href="${esc(a.url)}" target="_blank" rel="noopener">Buka Link ↗</a></p>`:''}${a.fileName?`<small>${esc(a.fileName)}</small>`:''}<p>${esc(a.description||a.text||'-')}</p></div>`).join('')}${s.reflection?`<div class="review-proof"><b>Refleksi Akhir</b><p>${esc(s.reflection)}</p></div>`:''}</div><div class="card grade-panel"><label>Nilai (0–100)</label><input id="gradeScore" type="number" min="0" max="100" class="input-inline" value="${esc(s.score??'')}"><label>Catatan untuk siswa</label><textarea id="gradeFeedback">${esc(s.feedback||'')}</textarea><div class="task-grade-actions"><button id="requestRevision" class="btn secondary">Perlu Perbaikan</button><button id="saveGrade" class="btn primary">Simpan Penilaian</button></div></div></div>`;$('#backReview').onclick=()=>reviewTask(t.id);$('#requestRevision').onclick=async()=>{await setDoc(doc(db,'taskSubmissions',id),{feedback:$('#gradeFeedback').value.trim(),status:'revision',gradedAt:null,updatedAt:new Date().toISOString()},{merge:true});toast('Tugas dikembalikan untuk diperbaiki');reviewTask(t.id)};$('#saveGrade').onclick=async()=>{const raw=$('#gradeScore').value.trim(),score=raw===''?null:Number(raw);if(score!==null&&(!Number.isFinite(score)||score<0||score>100))return toast('Nilai harus 0–100');await setDoc(doc(db,'taskSubmissions',id),{score,feedback:$('#gradeFeedback').value.trim(),status:'graded',gradedAt:new Date().toISOString(),gradedByUid:state.user.uid,gradedByName:state.profile.name||''},{merge:true});toast('Penilaian tersimpan');reviewTask(t.id)}
}

function studentAccessStats(){
  const active=state.students.filter(s=>s.active!==false);
  const loginActive=active.filter(s=>!!s.authUid);
  const pending=active.filter(s=>!s.authUid);
  return {active,loginActive,pending};
}
function renderStudentAccessPanel(){
  const target=$('#masterTabContent'); if(!target)return;
  const {active,loginActive,pending}=studentAccessStats();
  const report=window.studentProvisionReport||[];
  const classRows=state.classes.map(c=>{
    const rows=active.filter(s=>s.classId===c), on=rows.filter(s=>!!s.authUid).length, off=rows.length-on;
    return `<tr><td><b>${esc(c)}</b></td><td>${rows.length}</td><td><span class="badge ok">${on} aktif</span></td><td>${off?`<span class="badge warn">${off} belum</span>`:'<span class="badge ok">Lengkap</span>'}</td><td><button type="button" class="btn-mini edit" data-activate-class="${esc(c)}" ${off?'':'disabled'}>Generate Kelas</button></td></tr>`;
  }).join('');
  const studentRows=active.slice().sort((a,b)=>String(a.classId||'').localeCompare(String(b.classId||''))||String(a.name||'').localeCompare(String(b.name||''))).map(st=>{
    const nis=String(st.nis||st.id||'').trim();
    return `<tr><td>${esc(nis||'-')}</td><td><b>${esc(st.name||'-')}</b></td><td>${esc(st.classId||'-')}</td><td>${st.authUid?'<span class="badge ok">Aktif</span>':'<span class="badge warn">Belum</span>'}</td><td>${st.authUid?`<button type="button" class="btn-mini" data-repair-student="${esc(st.id)}">Sinkronkan</button>`:`<button type="button" class="btn-mini edit" data-activate-student="${esc(st.id)}">Generate Login</button>`}</td></tr>`;
  }).join('');
  target.innerHTML=`<div class="grid stats admin-stats student-access-stats">
      <div class="stat"><span>Siswa aktif</span><strong>${active.length}</strong></div>
      <div class="stat"><span>Login aktif</span><strong>${loginActive.length}</strong></div>
      <div class="stat"><span>Belum aktif</span><strong>${pending.length}</strong></div>
      <div class="stat"><span>Terakhir gagal</span><strong>${report.filter(x=>x.status==='failed').length}</strong></div>
    </div>
    <div class="card master-section">
      <div class="section-head"><div><h3>🔐 Generate Akses Login Siswa</h3><small>Admin membuat akses login langsung dari data siswa yang sudah ada. Data siswa tidak digandakan.</small></div><div class="row-actions"><button type="button" id="syncStudentProfiles" class="btn ghost">↻ Sinkronkan Semua</button><button type="button" id="activateAllStudents" class="btn primary" ${pending.length?'':'disabled'}>Generate Semua (${pending.length})</button></div></div>
      <div class="notice">Login siswa: <b>NIS = password</b>. Contoh NIS <b>24001</b>, siswa tetap mengetik <b>24001</b>. Sistem Firebase menyimpan password internal <b>S24001</b>.</div>
      <div class="table-wrap"><table><thead><tr><th>Kelas</th><th>Siswa</th><th>Login Aktif</th><th>Belum Aktif</th><th>Aksi</th></tr></thead><tbody>${classRows||'<tr><td colspan="5">Belum ada kelas.</td></tr>'}</tbody></table></div>
    </div>
    <div class="card master-section">
      <div class="section-head"><div><h3>Akses per Siswa</h3><small>Gunakan ini untuk uji satu siswa terlebih dahulu sebelum generate massal.</small></div></div>
      <div class="table-wrap"><table><thead><tr><th>NIS</th><th>Nama</th><th>Kelas</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${studentRows||'<tr><td colspan="5">Belum ada data siswa.</td></tr>'}</tbody></table></div>
    </div>
    ${report.length?`<div class="card master-section"><div class="section-head"><div><h3>Hasil Generate Terakhir</h3><small>${report.filter(x=>x.status==='success').length} berhasil • ${report.filter(x=>x.status==='repaired').length} diperbaiki • ${report.filter(x=>x.status==='failed').length} gagal</small></div><button type="button" id="clearStudentProvisionReport" class="btn ghost">Bersihkan</button></div><div class="table-wrap"><table><thead><tr><th>NIS</th><th>Nama</th><th>Kelas</th><th>Status</th><th>Keterangan</th></tr></thead><tbody>${report.map(r=>`<tr><td>${esc(r.nis)}</td><td>${esc(r.name)}</td><td>${esc(r.classId)}</td><td>${r.status==='success'?'<span class="badge ok">Berhasil</span>':r.status==='repaired'?'<span class="badge ok">Diperbaiki</span>':'<span class="badge bad">Gagal</span>'}</td><td>${esc(r.message||'-')}</td></tr>`).join('')}</tbody></table></div></div>`:''}`;
  $('#activateAllStudents')?.addEventListener('click',()=>provisionStudentAccounts({mode:'all'}));
  $('#syncStudentProfiles')?.addEventListener('click',syncStudentLoginProfiles);
  $('#clearStudentProvisionReport')?.addEventListener('click',()=>{window.studentProvisionReport=[];renderStudentAccessPanel()});
  document.querySelectorAll('[data-activate-class]').forEach(b=>b.onclick=()=>provisionStudentAccounts({mode:'class',classId:b.dataset.activateClass}));
  document.querySelectorAll('[data-activate-student]').forEach(b=>b.onclick=()=>provisionStudentAccounts({mode:'student',studentId:b.dataset.activateStudent}));
  document.querySelectorAll('[data-repair-student]').forEach(b=>b.onclick=()=>repairLinkedStudentProfile(b.dataset.repairStudent));
}
function studentInternalEmail(nis){
  return String(nis||'').trim().toLowerCase().replace(/[^a-z0-9._-]/g,'')+'@pakkom-ecotrack.app';
}
function studentInternalPassword(nis){ return 'S'+String(nis||'').trim(); }
function authErrorText(e){
  const code=String(e?.code||'');
  const map={
    'auth/operation-not-allowed':'Email/Password Authentication belum diaktifkan di Firebase.',
    'auth/email-already-in-use':'Akun Authentication sudah ada. EcoTrack akan mencoba menautkannya otomatis.',
    'auth/invalid-credential':'Akun sudah ada tetapi password internalnya berbeda.',
    'auth/wrong-password':'Akun sudah ada tetapi password internalnya berbeda.',
    'auth/invalid-email':'Format NIS menghasilkan email internal yang tidak valid.',
    'auth/weak-password':'Password internal ditolak Firebase.',
    'auth/network-request-failed':'Koneksi ke Firebase terputus.',
    'auth/too-many-requests':'Firebase membatasi permintaan sementara. Coba lagi beberapa saat.',
    'auth/api-key-missing':'Firebase API key tidak ditemukan.',
    'student/uid-missing':'Akun dibuat tetapi UID Firebase tidak diterima.'
  };
  return map[code]||`${code||'error'}${e?.message?` • ${String(e.message).replace(/^Firebase:\s*/,'')}`:''}`;
}
async function writeStudentLoginLink(st,uid){
  const nis=String(st.nis||st.id||'').trim();
  const now=new Date().toISOString();
  await setDoc(doc(db,'users',uid),{
    role:'siswa',active:true,approved:true,name:st.name||'',loginId:nis,nis,
    studentId:st.id,classId:st.classId||'',updatedAt:now,createdAt:now
  },{merge:true});
  await setDoc(doc(db,'students',st.id),{authUid:uid,loginEnabled:true,loginEnabledAt:now},{merge:true});
  st.authUid=uid; st.loginEnabled=true;
}
async function firebaseAuthRest(endpoint,payload){
  const apiKey=String((window.PAKKOM_FIREBASE_CONFIG||{}).apiKey||'').trim();
  if(!apiKey) throw Object.assign(new Error('Firebase API key tidak ditemukan.'),{code:'auth/api-key-missing'});
  const res=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${encodeURIComponent(apiKey)}`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok||data?.error){
    const raw=String(data?.error?.message||`HTTP_${res.status}`);
    const map={
      EMAIL_EXISTS:'auth/email-already-in-use',
      EMAIL_NOT_FOUND:'auth/user-not-found',
      INVALID_PASSWORD:'auth/wrong-password',
      INVALID_LOGIN_CREDENTIALS:'auth/invalid-credential',
      OPERATION_NOT_ALLOWED:'auth/operation-not-allowed',
      TOO_MANY_ATTEMPTS_TRY_LATER:'auth/too-many-requests',
      NETWORK_REQUEST_FAILED:'auth/network-request-failed'
    };
    let code=map[raw]||'';
    if(raw.startsWith('WEAK_PASSWORD'))code='auth/weak-password';
    if(raw.startsWith('INVALID_EMAIL'))code='auth/invalid-email';
    if(!code)code='auth/rest-'+raw.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    throw Object.assign(new Error(raw),{code,rawFirebaseMessage:raw});
  }
  return data;
}
async function generateOneStudentLogin(st){
  const nis=String(st.nis||st.id||'').trim();
  if(!nis) throw Object.assign(new Error('NIS kosong.'),{code:'student/nis-empty'});
  const email=studentInternalEmail(nis), password=studentInternalPassword(nis);
  try{
    // REST signUp membuat akun Auth tanpa pernah mengganti sesi Admin di browser.
    const data=await firebaseAuthRest('signUp',{email,password,returnSecureToken:true});
    const uid=String(data.localId||'').trim();
    if(!uid) throw Object.assign(new Error('UID akun siswa tidak diterima dari Firebase.'),{code:'student/uid-missing'});
    await writeStudentLoginLink(st,uid);
    return {status:'success',message:`Login berhasil dibuat • ${email}`};
  }catch(e){
    if(String(e?.code||'')==='auth/email-already-in-use'){
      // Jika akun sudah tercipta pada percobaan sebelumnya, validasi password internal
      // melalui REST. Token hasil REST tidak disimpan ke browser sehingga sesi Admin tetap aman.
      const data=await firebaseAuthRest('signInWithPassword',{email,password,returnSecureToken:true});
      const uid=String(data.localId||'').trim();
      if(!uid) throw Object.assign(new Error('UID akun lama tidak ditemukan.'),{code:'student/uid-missing'});
      await writeStudentLoginLink(st,uid);
      return {status:'repaired',message:'Akun Authentication lama ditemukan dan berhasil ditautkan kembali.'};
    }
    throw e;
  }
}
async function provisionStudentAccounts(options={mode:'all'}){
  if(state.profile.role!=='admin')return;
  const mode=options.mode||'all';
  let candidates=state.students.filter(s=>s.active!==false&&!s.authUid);
  if(mode==='class')candidates=candidates.filter(s=>s.classId===options.classId);
  if(mode==='student')candidates=candidates.filter(s=>s.id===options.studentId);
  if(mode==='selected'){
    const ids=new Set(options.studentIds||[]);
    candidates=candidates.filter(s=>ids.has(s.id));
  }
  if(!candidates.length)return toast('Tidak ada siswa yang perlu diaktifkan login.');
  const scope=mode==='student'?`${candidates[0].name||candidates[0].nis||'siswa ini'}`:mode==='class'?`kelas ${options.classId}`:mode==='selected'?`${candidates.length} siswa terpilih`:'semua siswa yang belum aktif';
  if(!confirm(`Aktifkan akses login untuk ${scope}?\n\nJumlah: ${candidates.length} siswa.\nID dan password siswa = NIS.`))return;

  const triggerButtons=[...document.querySelectorAll('#activateSelectedStudents,[data-approve-student-login]')];
  triggerButtons.forEach(b=>{b.disabled=true; b.dataset.oldText=b.textContent;});
  const selectedButton=$('#activateSelectedStudents');
  if(selectedButton)selectedButton.textContent='Mengaktifkan...';

  const report=[];
  try{
    for(const st of candidates){
      const nis=String(st.nis||st.id||'').trim();
      try{
        const result=await generateOneStudentLogin(st);
        report.push({nis,name:st.name||'',classId:st.classId||'',status:result.status,message:result.message});
      }catch(e){
        console.warn('student provision',nis,e);
        report.push({nis,name:st.name||'',classId:st.classId||'',status:'failed',message:e?.code==='student/nis-empty'?'NIS kosong.':authErrorText(e)});
      }
    }
  }finally{
    triggerButtons.forEach(b=>{b.disabled=false;if(b.dataset.oldText)b.textContent=b.dataset.oldText;delete b.dataset.oldText;});
  }

  window.studentProvisionReport=report;
  const ok=report.filter(x=>x.status==='success').length;
  const repaired=report.filter(x=>x.status==='repaired').length;
  const fail=report.filter(x=>x.status==='failed').length;
  if(ok||repaired){
    const successful=new Set(report.filter(x=>x.status==='success'||x.status==='repaired').map(x=>x.nis));
    if(window.selectedStudentIds){
      [...window.selectedStudentIds].forEach(id=>{
        const st=state.students.find(s=>s.id===id);
        if(st&&successful.has(String(st.nis||st.id||'').trim()))window.selectedStudentIds.delete(id);
      });
    }
  }
  // Refresh the student master data after activation so Login Aktif appears immediately.
  // This read does not touch Firebase Authentication or the Admin session.
  if(ok||repaired){
    try{
      const fresh=await getDocs(collection(db,'students'));
      state.students=fresh.docs.map(d=>({id:d.id,...d.data()}));
    }catch(refreshErr){
      console.warn('Refresh student login status',refreshErr);
    }
  }
  toast(`Akses siswa: ${ok} dibuat, ${repaired} ditautkan, ${fail} gagal.`,8000);

  // Penting: hanya render ulang panel Data Siswa. Jangan memanggil auth/signOut/render login.
  if(state.page==='master'&&state.masterTab==='students')renderStudentMasterTable();

  if(fail){
    const sample=report.filter(x=>x.status==='failed').slice(0,5).map(x=>`${x.nis||'-'}: ${x.message}`).join('\n');
    setTimeout(()=>alert(`Ada ${fail} akun yang gagal diaktifkan.\n\n${sample}${fail>5?'\n\nLihat Console untuk detail lainnya.':''}`),100);
  }
}
async function repairLinkedStudentProfile(studentId){
  if(state.profile.role!=='admin')return;
  const st=state.students.find(s=>s.id===studentId);
  if(!st||!st.authUid)return toast('Akun siswa belum tertaut. Gunakan Generate Login.');
  try{
    const nis=String(st.nis||st.id||'').trim();
    await setDoc(doc(db,'users',st.authUid),{role:'siswa',active:true,approved:true,name:st.name||'',loginId:nis,nis,studentId:st.id,classId:st.classId||'',updatedAt:new Date().toISOString()},{merge:true});
    toast(`Profil login ${st.name||nis} sudah disinkronkan.`);
  }catch(e){console.error(e);toast('Sinkronisasi akun siswa gagal: '+(e.message||e.code||'error'),6500)}
  if(state.page==='master'&&state.masterTab==='students')renderStudentMasterTable();else renderStudentAccessPanel();
}

async function syncStudentLoginProfiles(){
  if(state.profile.role!=='admin')return;
  const linked=state.students.filter(s=>s.active!==false&&s.authUid);
  if(!linked.length)return toast('Belum ada akun siswa yang tertaut.');
  let ok=0,fail=0;
  for(const st of linked){
    try{
      await setDoc(doc(db,'users',st.authUid),{name:st.name||'',loginId:String(st.nis||st.id||'').trim(),nis:String(st.nis||st.id||'').trim(),studentId:st.id,classId:st.classId||'',role:'siswa',updatedAt:new Date().toISOString()},{merge:true});ok++;
    }catch(e){console.warn('sync student profile',st.id,e);fail++}
  }
  toast(`Sinkronisasi profil siswa: ${ok} berhasil, ${fail} gagal.`);
  renderStudentAccessPanel();
}

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
      'auth/invalid-credential':'ID/NIS atau password salah.',
      'auth/wrong-password':'Password salah.',
      'auth/user-not-found':'Akun tidak ditemukan.',
      'auth/user-disabled':'Akun dinonaktifkan.',
      'auth/operation-not-allowed':'Login Email/Password belum diaktifkan di Firebase.',
      'auth/network-request-failed':'Koneksi ke Firebase gagal.',
      'auth/too-many-requests':'Terlalu banyak percobaan login. Coba lagi beberapa saat.',
      'student/access-not-found':'NIS belum memiliki akses login.',
      'student/access-disabled':'Akses login siswa belum aktif.',
      'student/wrong-password':'NIS atau password salah.',
      'student/master-not-found':'Data siswa tidak ditemukan.'
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
  if(window.PAKKOM_STUDENT_PORTAL===true){
    auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(function(){});
  }else{
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(){});
  }
  var db=firebase.firestore();
  // Portal is determined by the page: root = staff, /siswa/ = student.
  var studentPortal=window.PAKKOM_STUDENT_PORTAL===true;
  var startingUid=null;
  var startingPromise=null;

  window.PAKKOM_COMPAT_CORE={
    auth:auth,
    db:db,
    user:null,
    profile:null,
    startedUid:null,
    intentionalLogout:false,
    logout:function(){
      this.intentionalLogout=true;
      this.user=null;
      this.profile=null;
      this.startedUid=null;
      return auth.signOut();
    }
  };
  function startAuthenticatedUser(user){
    if(!user) return Promise.resolve();
    if(window.PAKKOM_COMPAT_CORE.startedUid===user.uid) return Promise.resolve();
    if(startingUid===user.uid && startingPromise) return startingPromise;
    startingUid=user.uid;
    startingPromise=db.collection('users').doc(user.uid).get().then(function(snap){
      if(!snap.exists) throw new Error('Profil pengguna tidak ditemukan di Firestore.');
      var profile=Object.assign({uid:user.uid},snap.data());
      if(profile.rejected===true) throw new Error('Pendaftaran akun tidak disetujui Admin.');
      if(profile.approved===false && profile.role==='guru') throw new Error('Akun masih menunggu persetujuan Admin.');
      if(profile.active===false) throw new Error('Akun dinonaktifkan administrator.');
      if(profile.role!=='admin' && profile.role!=='guru' && profile.role!=='siswa') throw new Error('Role akun tidak dikenali.');

      if(studentPortal && profile.role!=='siswa'){
        throw new Error('Halaman ini khusus siswa. Guru/Admin silakan masuk dari halaman utama EcoTrack.');
      }
      if(!studentPortal && profile.role==='siswa'){
        // Firebase Auth persistence is shared by the root and /siswa/ on the same origin.
        // Clear a leftover student session so ADMIN/Guru can still reach the staff login.
        throw new Error('Sesi siswa terdeteksi. Silakan masuk dengan akun Guru/Admin.');
      }

      window.PAKKOM_COMPAT_CORE.user=user;
      window.PAKKOM_COMPAT_CORE.profile=profile;
      window.PAKKOM_COMPAT_CORE.startedUid=user.uid;

      qs('#loginView').classList.add('hidden');
      qs('#appView').classList.remove('hidden');

      if(typeof window.startPakKomApp!=='function'){
        throw new Error('Application Core tidak tersedia.');
      }
      return window.startPakKomApp(window.PAKKOM_COMPAT_CORE);
    }).finally(function(){
      if(startingUid===user.uid){ startingUid=null; startingPromise=null; }
    });
    return startingPromise;
  }

  // Pulihkan sesi secara diam-diam setelah refresh. Tidak ada splash "memeriksa sesi".
  var bootResolved=false;
  var bootTimer=setTimeout(function(){
    if(bootResolved) return;
    bootResolved=true;
    qs('#bootView')?.classList.add('hidden');
    if(!auth.currentUser){
      qs('#loginView').classList.remove('hidden');
      qs('#appView').classList.add('hidden');
    }
  },1800);

  window.PAKKOM_STUDENT_LOGIN_IN_PROGRESS=false;

  auth.onAuthStateChanged(function(user){
    if(window.PAKKOM_STUDENT_PORTAL===true && window.PAKKOM_STUDENT_LOGIN_IN_PROGRESS===true){
      // Anonymous sign-in fires this observer before NIS/password verification
      // and before the temporary student profile is created. Do not render
      // the dashboard until the login promise explicitly finishes.
      return;
    }
    if(window.PAKKOM_COMPAT_CORE.intentionalLogout){
      window.PAKKOM_COMPAT_CORE.intentionalLogout=false;
      bootResolved=true; clearTimeout(bootTimer);
      qs('#bootView')?.classList.add('hidden');
      qs('#loginView').classList.remove('hidden');
      qs('#appView').classList.add('hidden');
      return;
    }
    if(user && window.PAKKOM_COMPAT_CORE.startedUid!==user.uid){
      startAuthenticatedUser(user).then(function(){
        bootResolved=true; clearTimeout(bootTimer);
        qs('#bootView')?.classList.add('hidden');
      }).catch(function(err){
        bootResolved=true; clearTimeout(bootTimer);
        console.error('SESSION RESTORE',err);
        auth.signOut().catch(function(){});
        qs('#bootView')?.classList.add('hidden');
        qs('#loginView').classList.remove('hidden');
        qs('#appView').classList.add('hidden');
        showError(authMessage(err));
      });
    } else if(!user){
      bootResolved=true; clearTimeout(bootTimer);
      qs('#bootView')?.classList.add('hidden');
      qs('#loginView').classList.remove('hidden');
      qs('#appView').classList.add('hidden');
    }
  });


  var form=qs('#loginForm');
  var btn=qs('#loginBtn');

  if(!form) return;

  form.addEventListener('submit',function(ev){
    ev.preventDefault();
    var id=String(qs('#loginId').value||'').trim();
    var password=String(qs('#loginPassword').value||'');
    if(!id || !password){
      showError('ID/NIS dan password wajib diisi.');
      return;
    }

    showError('');
    btn.disabled=true;
    btn.textContent='MEMERIKSA...';

    window.PAKKOM_COMPAT_CORE.startedUid=null;
    var signInPromise;
    if(window.PAKKOM_STUDENT_PORTAL===true){
      // v5.1.2: keep the auth observer quiet until NIS/password verification
      // and the temporary student profile are fully ready.
      window.PAKKOM_STUDENT_LOGIN_IN_PROGRESS=true;
      signInPromise=auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
        .then(function(){ return auth.signInAnonymously(); })
        .then(async function(cred){
          const accessSnap=await db.collection('studentAccess').doc(id).get();
          if(!accessSnap.exists) throw Object.assign(new Error('NIS belum memiliki akses login.'),{code:'student/access-not-found'});
          const access=accessSnap.data()||{};
          if(access.active!==true) throw Object.assign(new Error('Akses login siswa belum aktif.'),{code:'student/access-disabled'});
          const enteredHash=await window.pakkomSha256Text(password);
          if(enteredHash!==String(access.passwordHash||'')) throw Object.assign(new Error('NIS atau password salah.'),{code:'student/wrong-password'});
          const studentSnap=await db.collection('students').doc(String(access.studentId||id)).get();
          if(!studentSnap.exists) throw Object.assign(new Error('Data siswa tidak ditemukan.'),{code:'student/master-not-found'});
          const st=studentSnap.data()||{};
          const profile={
            role:'siswa',active:true,approved:true,name:st.name||access.name||'',
            loginId:id,nis:id,studentId:studentSnap.id,classId:st.classId||access.classId||'',
            sessionType:'anonymous',createdAt:new Date().toISOString()
          };
          await db.collection('users').doc(cred.user.uid).set(profile,{merge:false});
          window.PAKKOM_STUDENT_LOGIN_IN_PROGRESS=false;
          return cred;
        });
    }else{
      signInPromise=auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(function(){ return auth.signInWithEmailAndPassword(loginEmail(id),password); });
    }
    signInPromise
      .then(function(cred){
        if(id.toUpperCase()==='ADMIN' &&
           String(cred.user.email||'').toLowerCase()!==ADMIN_EMAIL.toLowerCase()){
          throw new Error('Akun ADMIN tidak sesuai konfigurasi.');
        }
        return startAuthenticatedUser(cred.user);
      })
      .catch(function(err){
        window.PAKKOM_STUDENT_LOGIN_IN_PROGRESS=false;
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

async function adminAuditPage(){
  if(state.profile.role!=='admin')return;
  pageMeta('Riwayat Aktivitas Admin','Hanya dapat dilihat Administrator');
  const q=await getDocs(query(collection(db,'auditLogs'),orderBy('createdAt','desc'),limit(200)));
  const rows=q.docs.map(d=>({id:d.id,...d.data()}));
  content.innerHTML=`<div class="card"><div class="master-tools"><input id="auditSearch" class="input-inline" placeholder="Cari aktivitas, kelas, atau admin"></div><div id="auditList"></div></div>`;
  const draw=()=>{const x=($('#auditSearch').value||'').toLowerCase();$('#auditList').innerHTML=`<div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Admin</th><th>Aktivitas</th><th>Detail</th></tr></thead><tbody>${rows.filter(r=>JSON.stringify(r).toLowerCase().includes(x)).map(r=>`<tr><td>${esc(r.createdAt||'-')}</td><td>${esc(r.adminName||'-')}</td><td><b>${esc(r.action||'-')}</b></td><td>${esc(JSON.stringify(r.detail||{}))}</td></tr>`).join('')}</tbody></table></div>`};$('#auditSearch').oninput=draw;draw();
}

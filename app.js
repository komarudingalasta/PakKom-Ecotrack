import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, query, where, orderBy, writeBatch, serverTimestamp, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js';

const cfg = window.PAKKOM_FIREBASE_CONFIG || {};
const configured = cfg.apiKey && !String(cfg.apiKey).includes('GANTI_') && cfg.projectId && !String(cfg.projectId).includes('GANTI_');
const $ = s => document.querySelector(s);
const content = $('#content');
const classesDefault = ['7A','7B','7C','7D','7E','7F','7G','7H','7I','8A','8B','8C','8D','8E','8F','8G','8H','8I','9A','9B','9C','9D','9E','9F','9G','9H','9I'];
const todayKey = () => new Date().toLocaleDateString('en-CA');
const dateID = () => new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
const ADMIN_LOGIN_EMAIL = 'komarudingalasta@gmail.com';
const loginEmail = id => {
  const normalized = String(id).trim().toUpperCase();
  if (normalized === 'ADMIN') return ADMIN_LOGIN_EMAIL;
  return `${normalized.toLowerCase().replace(/[^a-z0-9._-]/g,'')}@pakkom-ecotrack.app`;
};
let app, auth, db;
let state = { user:null, profile:null, page:'home', selectedClass:null, classes:[], classDocs:[], recordsToday:[], students:[] };

function toast(msg, ms=4200){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(window.__toastTimer); window.__toastTimer=setTimeout(()=>t.classList.remove('show'),ms); }
function authErrorMessage(e){
  const code=e?.code||'';
  const map={
    'auth/invalid-credential':'Email/ID atau password tidak cocok dengan Firebase Authentication.',
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
function navItems(){ const base=[['home','🏠 Beranda'],['input','📝 Pendataan'],['recap','📊 Rekap'],['account','👤 Akun']]; if(state.profile?.role==='admin') base.splice(3,0,['master','⚙️ Kelola Data']); return base; }

if(!configured){
  $('#loginHint').innerHTML='Firebase belum dikonfigurasi. Isi <b>firebase-config.js</b> terlebih dahulu.';
  $('#loginBtn').disabled=true;
  $('#loginBtn').textContent='Firebase belum aktif';
} else {
  app=initializeApp(cfg); auth=getAuth(app); db=getFirestore(app);
  onAuthStateChanged(auth, async user=>{
    if(!user){ state.user=null; state.profile=null; renderShell(); return; }
    try{
      const snap=await getDoc(doc(db,'users',user.uid));
      if(!snap.exists()){ await signOut(auth); toast(`Authentication berhasil, tetapi profil users/${user.uid} tidak ditemukan.`,6500); return; }
      if(snap.data().active===false){ await signOut(auth); toast('Akun ditemukan tetapi status active = false.',6500); return; }
      state.user=user; state.profile={uid:user.uid,...snap.data()};
      if(state.profile.role==='admin') await ensureDefaultClasses();
      await refreshCore(); renderShell();
    }catch(e){ console.error(e); toast(`Authentication berhasil, tetapi Firestore gagal membaca profil: ${e.code||e.message||'unknown error'}`,7000); }
  });
}

$('#loginForm').addEventListener('submit',async e=>{
  e.preventDefault(); if(!configured)return;
  const id=$('#loginId').value.trim(); const password=$('#loginPassword').value;
  $('#loginBtn').disabled=true; $('#loginBtn').textContent='Memeriksa...';
  try{
    const email=loginEmail(id);
    const cred=await signInWithEmailAndPassword(auth,email,password);
    if(id.trim().toUpperCase()==='ADMIN' && cred.user.email?.toLowerCase()!==ADMIN_LOGIN_EMAIL.toLowerCase()){
      await signOut(auth); throw new Error('Admin login terhubung ke email yang tidak sesuai.');
    }
  }
  catch(e){ console.error(e); toast(authErrorMessage(e),6500); }
  finally{ $('#loginBtn').disabled=false; $('#loginBtn').textContent='Masuk'; }
});
$('#logoutBtn').onclick=()=>signOut(auth);
$('#menuBtn').onclick=()=>document.querySelector('.sidebar').classList.toggle('open');

async function refreshCore(){
  const [classSnap, recordSnap] = await Promise.all([
    getDocs(query(collection(db,'classes'),orderBy('name'))).catch(()=>null),
    getDocs(query(collection(db,'records'),where('date','==',todayKey()))).catch(()=>null)
  ]);
  state.classDocs = classSnap && !classSnap.empty ? classSnap.docs.map(d=>({id:d.id,...d.data()})) : classesDefault.map(id=>({id,name:id,active:true}));
  state.classes = state.classDocs.filter(c=>c.active!==false).map(c=>c.id);
  state.recordsToday = recordSnap ? recordSnap.docs.map(d=>({id:d.id,...d.data()})) : [];
}
function classRecord(c){ return state.recordsToday.find(r=>r.classId===c); }

function renderShell(){
  if(!state.profile){ $('#loginView').classList.remove('hidden'); $('#appView').classList.add('hidden'); return; }
  $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden');
  const chipRole=state.profile.role==='admin'?'Admin':(state.profile.isHomeroom?`Wali Kelas${state.profile.homeroomClass?' • '+esc(state.profile.homeroomClass):''}`:'Guru');
  $('#userChip').innerHTML=`<b>${esc(state.profile.name)}</b><br>${chipRole}`;
  $('#nav').innerHTML=navItems().map(([k,l])=>`<button class="nav-btn ${state.page===k?'active':''}" data-page="${k}">${l}</button>`).join('');
  document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>{state.page=b.dataset.page;state.selectedClass=null;renderShell();document.querySelector('.sidebar').classList.remove('open')});
  renderPage();
}
function renderPage(){ if(state.page==='home')return home(); if(state.page==='input')return inputPage(); if(state.page==='recap')return recap(); if(state.page==='account')return account(); if(state.page==='master')return master(); }

function home(){
  pageMeta('Beranda',dateID());
  const done=new Set(state.recordsToday.map(r=>r.classId));
  const items=state.recordsToday.flatMap(r=>(r.items||[]).filter(i=>i.presence==='hadir'));
  const food=items.length?Math.round(items.filter(i=>i.food).length/items.length*100):0;
  const tumb=items.length?Math.round(items.filter(i=>i.tumbler).length/items.length*100):0;
  const both=items.length?Math.round(items.filter(i=>i.food&&i.tumbler).length/items.length*100):0;
  const waliClass=state.profile?.isHomeroom?state.profile.homeroomClass:'';
  const waliRec=waliClass?classRecord(waliClass):null;
  let waliHtml='';
  if(waliClass){
    const hadir=(waliRec?.items||[]).filter(i=>i.presence==='hadir');
    const wp=hadir.length?Math.round(hadir.filter(i=>i.food&&i.tumbler).length/hadir.length*100):0;
    waliHtml=`<div class="card homeroom-card"><div class="section-head"><div><span class="badge ok">Wali Kelas</span><h3 style="margin:8px 0 0">Kelas Saya • ${esc(waliClass)}</h3></div><button class="btn secondary" data-class="${esc(waliClass)}">${waliRec?'Lihat / Koreksi':'Input Sekarang'}</button></div><p>${waliRec?`Pendataan hari ini selesai • kepatuhan keduanya <b>${wp}%</b>`:'Kelas binaan Anda belum didata hari ini.'}</p></div>`;
  }
  content.innerHTML=`<div class="grid stats"><div class="stat"><span>Kelas selesai</span><strong>${done.size}/${state.classes.length}</strong></div><div class="stat"><span>Belum didata</span><strong>${state.classes.length-done.size}</strong></div><div class="stat"><span>Membawa wadah</span><strong>${food}%</strong></div><div class="stat"><span>Membawa tumbler</span><strong>${tumb}%</strong></div></div>
  ${waliHtml}
  <div class="grid two-col" style="margin-top:16px"><div class="card"><div class="section-head"><h3>Status Pendataan Hari Ini</h3><button class="btn primary" id="startInput">Mulai Pendataan</button></div><div class="grid class-grid">${state.classes.map(c=>{const r=classRecord(c);return `<button class="class-btn ${r?'done':'pending'}" data-class="${c}"><b>${c}</b><small>${r?'✓ '+esc(r.lastEditedByName||r.createdByName||'Guru'):'Belum didata'}</small></button>`}).join('')}</div></div><div class="card"><h3>Ringkasan Sekolah</h3><p>Semua guru aktif dapat mendata kelas mana pun. Koreksi tetap mencatat pengguna dan waktu perubahan.</p><div class="notice">Kepatuhan membawa <b>wadah + tumbler ${both}%</b>. Hari ini masih ada <b>${state.classes.length-done.size}</b> kelas yang belum didata.</div></div></div>`;
  $('#startInput').onclick=()=>{state.page='input';renderShell()}; bindClassButtons();
}
function bindClassButtons(){ document.querySelectorAll('[data-class]').forEach(b=>b.onclick=()=>{state.page='input';state.selectedClass=b.dataset.class;renderShell()}); }

function inputPage(){
  pageMeta('Pendataan','Pilih kelas lalu tandai kondisi siswa');
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
  <div class="card"><div class="toolbar"><button class="btn secondary bulk" data-bulk="presence">Semua Hadir</button><button class="btn secondary bulk" data-bulk="food">Semua Bawa Wadah</button><button class="btn secondary bulk" data-bulk="tumbler">Semua Bawa Tumbler</button>${window.formLocked?'<button id="unlockBtn" class="btn ghost">Koreksi Data</button>':''}</div>
  <div class="table-wrap"><table><thead><tr><th>No</th><th>NIS</th><th>Nama Siswa</th><th>Kehadiran</th><th>Wadah</th><th>Tumbler</th></tr></thead><tbody id="studentRows"></tbody></table></div>
  <div style="display:flex;justify-content:flex-end;margin-top:16px"><button id="saveBtn" class="btn primary" ${window.formLocked?'disabled':''}>Simpan Data ${c}</button></div></div>`;
  $('#backClasses').onclick=()=>{state.selectedClass=null;renderPage()};
  if($('#unlockBtn')) $('#unlockBtn').onclick=()=>{window.formLocked=false;$('#saveBtn').disabled=false;$('#unlockBtn').disabled=true;renderStudentRows();toast('Mode koreksi aktif')};
  document.querySelectorAll('.bulk').forEach(b=>b.onclick=()=>setAll(b.dataset.bulk));
  $('#saveBtn').onclick=()=>saveClass(c); renderStudentRows();
}
function setAll(field){ if(window.formLocked)return; window.formItems.forEach(i=>{if(field==='presence')i.presence='hadir';else if(i.presence==='hadir')i[field]=true}); renderStudentRows(); }
function renderStudentRows(){
  const rows=$('#studentRows'); if(!rows)return;
  rows.innerHTML=window.formItems.map((i,idx)=>`<tr><td>${idx+1}</td><td>${esc(i.nis)}</td><td><b>${esc(i.name)}</b></td><td><select ${window.formLocked?'disabled':''} data-presence="${idx}"><option value="hadir" ${i.presence==='hadir'?'selected':''}>Hadir</option><option value="izin" ${i.presence==='izin'?'selected':''}>Izin</option><option value="sakit" ${i.presence==='sakit'?'selected':''}>Sakit</option><option value="alpa" ${i.presence==='alpa'?'selected':''}>Alpa</option></select></td><td><div class="switch ${i.food&&i.presence==='hadir'?'on':''}" data-toggle="food" data-index="${idx}"></div></td><td><div class="switch ${i.tumbler&&i.presence==='hadir'?'on':''}" data-toggle="tumbler" data-index="${idx}"></div></td></tr>`).join('');
  document.querySelectorAll('[data-presence]').forEach(s=>s.onchange=()=>{if(window.formLocked)return;const i=window.formItems[+s.dataset.presence];i.presence=s.value;if(s.value!=='hadir'){i.food=false;i.tumbler=false}renderStudentRows()});
  document.querySelectorAll('[data-toggle]').forEach(t=>t.onclick=()=>{if(window.formLocked)return;const i=window.formItems[+t.dataset.index];if(i.presence!=='hadir')return;i[t.dataset.toggle]=!i[t.dataset.toggle];renderStudentRows()});
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

function recap(){
  pageMeta('Rekap','Filter tanggal dan kelas');
  content.innerHTML=`<div class="card"><div class="section-head"><div><h3>Rekap Pendataan</h3><small>Pilih tanggal untuk melihat histori pendataan.</small></div><div class="row-actions"><input id="recapDate" class="input-inline" type="date" value="${todayKey()}"><select id="recapClass" class="input-inline"><option value="">Semua kelas</option>${state.classes.map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div></div><div id="recapBody"><div class="empty">Memuat rekap...</div></div></div>`;
  $('#recapDate').onchange=loadRecapDate; $('#recapClass').onchange=loadRecapDate; loadRecapDate();
}
async function loadRecapDate(){
  const target=$('#recapBody'); if(!target)return;
  const date=$('#recapDate').value||todayKey(), cls=$('#recapClass').value||'';
  target.innerHTML='<div class="empty">Memuat...</div>';
  try{
    const snap=await getDocs(query(collection(db,'records'),where('date','==',date)));
    const records=snap.docs.map(d=>({id:d.id,...d.data()}));
    const classes=cls?[cls]:state.classes;
    const cards=classes.map(c=>{const r=records.find(x=>x.classId===c);if(!r)return {c,status:'Belum',hadir:0,food:0,tumb:0,both:0,by:'-'};const hadir=(r.items||[]).filter(i=>i.presence==='hadir');const pct=f=>hadir.length?Math.round(hadir.filter(f).length/hadir.length*100):0;return {c,status:'Selesai',hadir:hadir.length,food:pct(i=>i.food),tumb:pct(i=>i.tumbler),both:pct(i=>i.food&&i.tumbler),by:r.lastEditedByName||r.createdByName||'Guru'};});
    target.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Kelas</th><th>Status</th><th>Hadir</th><th>Wadah</th><th>Tumbler</th><th>Keduanya</th><th>Penginput</th></tr></thead><tbody>${cards.map(x=>`<tr><td><b>${x.c}</b></td><td><span class="badge ${x.status==='Selesai'?'ok':'warn'}">${x.status}</span></td><td>${x.hadir||'-'}</td><td>${x.food}%</td><td>${x.tumb}%</td><td><b>${x.both}%</b></td><td>${esc(x.by)}</td></tr>`).join('')}</tbody></table></div>`;
  }catch(e){console.error(e);target.innerHTML='<div class="empty">Gagal memuat rekap tanggal tersebut.</div>';}
}

function account(){ pageMeta('Akun','Informasi pengguna'); const type=state.profile.role==='admin'?'Administrator':(state.profile.isHomeroom?'Wali Kelas':'Guru'); const wali=state.profile.isHomeroom&&state.profile.homeroomClass?`<p><b>Kelas Wali:</b> ${esc(state.profile.homeroomClass)}</p>`:''; content.innerHTML=`<div class="card" style="max-width:600px"><h3>${esc(state.profile.name)}</h3><p><b>ID:</b> ${esc(state.profile.loginId||'-')}</p><p><b>Peran:</b> ${type}</p>${wali}<p><b>Status:</b> ${state.profile.active!==false?'Aktif':'Nonaktif'}</p><div class="notice">Guru dan wali kelas memiliki akses pendataan yang sama. Penanda wali kelas digunakan sebagai informasi tanggung jawab kelas.</div></div>`; }

async function master(){
  if(state.profile.role!=='admin'){state.page='home';return renderShell()}
  pageMeta('Kelola Data','Khusus Administrator • v2.6.1');
  content.innerHTML='<div class="card"><div class="empty">Memuat data master...</div></div>';
  const [stuSnap,userSnap]=await Promise.all([getDocs(collection(db,'students')),getDocs(collection(db,'users'))]);
  state.students=stuSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.classId||'').localeCompare(b.classId||'')||(a.name||'').localeCompare(b.name||''));
  window.masterUsers=userSnap.docs.map(d=>({uid:d.id,...d.data()}));
  const activeStudents=state.students.filter(s=>s.active!==false);
  const teachers=window.masterUsers.filter(u=>u.role==='guru');
  const activeTeachers=teachers.filter(u=>u.active!==false);
  const homerooms=activeTeachers.filter(u=>u.isHomeroom===true);
  content.innerHTML=`
  <div class="grid stats admin-stats">
    <div class="stat"><span>Siswa aktif</span><strong>${activeStudents.length}</strong></div>
    <div class="stat"><span>Guru aktif</span><strong>${activeTeachers.length-homerooms.length}</strong></div>
    <div class="stat"><span>Wali kelas</span><strong>${homerooms.length}</strong></div>
    <div class="stat"><span>Kelas aktif</span><strong>${state.classes.length}</strong></div>
  </div>
  <div class="card" style="margin-top:16px">
    <div class="section-head"><div><h3>Master Siswa</h3><small>Import Excel atau kelola langsung. Siswa tidak memiliki akun dan password.</small></div><div class="row-actions"><a class="btn ghost" href="format-import-pak-kom-eco-track.xlsx" download>Format Import</a><button id="importStudents" class="btn primary">Import Siswa</button></div></div>
    <div class="notice">Format siswa: <b>NIS | Nama | Kelas | Status</b>. Kolom Status boleh kosong dan akan dianggap Aktif. NIS yang sama akan memperbarui data lama.</div>
    <div class="master-tools"><input id="studentSearch" class="input-inline" placeholder="Cari NIS atau nama siswa"><select id="studentClassFilter" class="input-inline"><option value="">Semua kelas</option>${state.classes.map(c=>`<option value="${c}">${c}</option>`).join('')}</select><button id="addStudentLocal" class="btn secondary">+ Siswa</button></div>
    <div id="studentTable"></div>
  </div>
  <div class="card" style="margin-top:16px">
    <div class="section-head"><div><h3>Akun Guru & Wali Kelas</h3><small>Wali kelas tetap berperan sebagai guru, dengan informasi kelas binaan.</small></div><div class="row-actions"><button id="importTeachers" class="btn ghost">Import Akun Guru</button><button id="addTeacher" class="btn primary">+ Guru</button></div></div>
    <div class="notice">Format guru: <b>ID Guru | Nama | Password Awal | Jenis | Kelas Wali | Status</b>. Jenis diisi <b>Guru</b> atau <b>Wali Kelas</b>. Jika Password Awal kosong, digunakan <b>123456</b>.</div>
    <div class="master-tools"><input id="teacherSearch" class="input-inline" placeholder="Cari ID atau nama guru"><select id="teacherTypeFilter" class="input-inline"><option value="">Semua jenis</option><option value="guru">Guru</option><option value="wali">Wali Kelas</option></select><select id="teacherStatusFilter" class="input-inline"><option value="">Semua status</option><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option></select></div><div id="teacherTable"></div>
  </div>
  <div class="card" style="margin-top:16px"><div class="section-head"><div><h3>Riwayat Koreksi Hari Ini</h3><small>Menampilkan perubahan pada pendataan hari ini.</small></div></div><div id="auditTable"></div></div><div class="card" style="margin-top:16px"><div class="section-head"><h3>Daftar Kelas</h3><button id="seedClasses" class="btn ghost">Pastikan Kelas 7A–9I</button></div><div class="grid class-grid">${state.classes.map(c=>`<div class="class-btn done"><b>${c}</b><small>Aktif</small></div>`).join('')}</div></div>`;
  $('#importStudents').onclick=()=>$('#studentImport').click();
  $('#importTeachers').onclick=()=>$('#teacherImport').click();
  $('#addTeacher').onclick=addTeacherPrompt;
  $('#seedClasses').onclick=seedClasses;
  $('#addStudentLocal').onclick=addStudentLocal;
  $('#studentSearch').oninput=renderStudentMasterTable;
  $('#studentClassFilter').onchange=renderStudentMasterTable;
  $('#teacherSearch').oninput=renderTeacherMasterTable; $('#teacherTypeFilter').onchange=renderTeacherMasterTable; $('#teacherStatusFilter').onchange=renderTeacherMasterTable;
  renderStudentMasterTable();
  renderTeacherMasterTable();
  renderAuditTable();
}

function renderStudentMasterTable(){
  const target=$('#studentTable'); if(!target)return;
  const q=String($('#studentSearch')?.value||'').trim().toLowerCase();
  const cls=$('#studentClassFilter')?.value||'';
  const rows=state.students.filter(s=>(!cls||s.classId===cls)&&(!q||String(s.nis||s.id).toLowerCase().includes(q)||String(s.name||'').toLowerCase().includes(q)));
  target.innerHTML=`<div class="table-wrap"><table class="student-master"><thead><tr><th>NIS</th><th>Nama</th><th>Kelas</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows.slice(0,500).map(s=>`<tr><td><b>${esc(s.nis||s.id)}</b></td><td>${esc(s.name||'-')}</td><td>${esc(s.classId||'-')}</td><td><span class="badge ${s.active===false?'warn':'ok'}">${s.active===false?'Nonaktif':'Aktif'}</span></td><td><button class="btn-mini edit" data-edit-student="${esc(s.id)}">Edit</button></td></tr>`).join('')||'<tr><td colspan="5"><div class="empty">Tidak ada siswa yang cocok.</div></td></tr>'}</tbody></table></div>${rows.length>500?`<p class="demo-note">Menampilkan 500 dari ${rows.length} siswa. Gunakan pencarian/filter kelas.</p>`:''}`;
  document.querySelectorAll('[data-edit-student]').forEach(b=>b.onclick=()=>editStudent(b.dataset.editStudent));
}

function renderTeacherMasterTable(){
  const target=$('#teacherTable'); if(!target)return;
  const q=String($('#teacherSearch')?.value||'').trim().toLowerCase(), type=$('#teacherTypeFilter')?.value||'', status=$('#teacherStatusFilter')?.value||'';
  const rows=(window.masterUsers||[]).filter(u=>u.role==='guru').filter(u=>(!q||String(u.loginId||'').toLowerCase().includes(q)||String(u.name||'').toLowerCase().includes(q))&&(!type||(type==='wali'?u.isHomeroom===true:u.isHomeroom!==true))&&(!status||(status==='aktif'?u.active!==false:u.active===false))).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  target.innerHTML=`<div class="table-wrap"><table class="student-master"><thead><tr><th>ID Guru</th><th>Nama</th><th>Jenis</th><th>Kelas Wali</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows.map(u=>`<tr><td><b>${esc(u.loginId||'-')}</b></td><td>${esc(u.name||'-')}</td><td><span class="badge ${u.isHomeroom?'ok':'neutral'}">${u.isHomeroom?'Wali Kelas':'Guru'}</span></td><td>${u.isHomeroom?esc(u.homeroomClass||'-'):'-'}</td><td><span class="badge ${u.active===false?'warn':'ok'}">${u.active===false?'Nonaktif':'Aktif'}</span></td><td><button class="btn-mini edit" data-edit-teacher="${esc(u.uid)}">Edit</button></td></tr>`).join('')||'<tr><td colspan="6"><div class="empty">Belum ada akun guru.</div></td></tr>'}</tbody></table></div>`;
  document.querySelectorAll('[data-edit-teacher]').forEach(b=>b.onclick=()=>editTeacherProfile(b.dataset.editTeacher));
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
    const buf=await f.arrayBuffer(); const wb=XLSX.read(buf);
    const sheet=wb.Sheets['Siswa']||wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(sheet,{defval:''});
    let skipped=0;
    const normalized=rows.map(r=>({
      nis:String(r.NIS||r.nis||r['Nomor Induk']||'').trim(),
      name:String(r.Nama||r.nama||r['Nama Siswa']||'').trim(),
      classId:String(r.Kelas||r.kelas||r.KELAS||'').trim().toUpperCase(),
      active:!['nonaktif','tidak aktif','0','false'].includes(String(r.Status||r.status||'Aktif').trim().toLowerCase())
    })).filter(r=>{const ok=r.nis&&r.name&&r.classId;if(!ok)skipped++;return ok;});
    if(!normalized.length)throw new Error('Kolom tidak cocok');
    for(let start=0; start<normalized.length; start+=400){
      const batch=writeBatch(db);
      normalized.slice(start,start+400).forEach(st=>batch.set(doc(db,'students',st.nis),{...st,updatedAt:new Date().toISOString()},{merge:true}));
      await batch.commit();
    }
    await ensureClassesFromStudents(); toast(`Import siswa selesai: ${normalized.length} diproses${skipped?`, ${skipped} dilewati karena data tidak lengkap`:''}`,7000); e.target.value=''; await master();
  }catch(err){console.error(err);toast('Import gagal. Gunakan kolom NIS, Nama, Kelas, Status.');}
});

$('#teacherImport').addEventListener('change',async e=>{
  const f=e.target.files?.[0]; if(!f)return;
  try{
    const buf=await f.arrayBuffer(); const wb=XLSX.read(buf);
    const sheet=wb.Sheets['Guru']||wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(sheet,{defval:''});
    const normalized=rows.map(r=>{
      const loginId=String(r['ID Guru']||r.ID||r.loginId||'').trim().toUpperCase();
      const name=String(r.Nama||r.nama||'').trim();
      const password=String(r['Password Awal']||r.Password||r.password||'123456').trim()||'123456';
      const jenis=String(r.Jenis||r.jenis||'Guru').trim().toLowerCase();
      const homeroomClass=String(r['Kelas Wali']||r.KelasWali||r.homeroomClass||'').trim().toUpperCase();
      const active=!['nonaktif','tidak aktif','0','false'].includes(String(r.Status||r.status||'Aktif').trim().toLowerCase());
      return {loginId,name,password,isHomeroom:jenis.includes('wali'),homeroomClass,active};
    }).filter(r=>r.loginId&&r.name&&r.loginId!=='ADMIN');
    if(!normalized.length)throw new Error('Tidak ada akun guru valid');
    if(normalized.some(r=>r.password.length<6))throw new Error('Password minimal 6 karakter');
    const existingSnap=await getDocs(collection(db,'users'));
    const existingById=new Map(existingSnap.docs.map(d=>[String(d.data().loginId||'').toUpperCase(),{uid:d.id,...d.data()}]));
    let created=0,updated=0,failed=0;
    for(const t of normalized){
      if(t.isHomeroom&&!t.homeroomClass){failed++;continue;}
      if(t.isHomeroom){const clash=(window.masterUsers||[]).find(x=>x.role==='guru'&&x.active!==false&&x.isHomeroom===true&&x.homeroomClass===t.homeroomClass&&String(x.loginId||'').toUpperCase()!==t.loginId);if(clash){console.warn('Kelas wali duplikat',t.loginId,t.homeroomClass);failed++;continue;}}
      const existing=existingById.get(t.loginId);
      if(existing){
        await setDoc(doc(db,'users',existing.uid),{name:t.name,role:'guru',active:t.active,isHomeroom:t.isHomeroom,homeroomClass:t.isHomeroom?t.homeroomClass:'',updatedAt:new Date().toISOString()},{merge:true});
        updated++; continue;
      }
      let secondary=null;
      try{
        secondary=initializeApp(cfg,`teacher-import-${Date.now()}-${Math.random()}`);
        const secondaryAuth=getAuth(secondary);
        const cred=await createUserWithEmailAndPassword(secondaryAuth,loginEmail(t.loginId),t.password);
        await setDoc(doc(db,'users',cred.user.uid),{loginId:t.loginId,name:t.name,role:'guru',active:t.active,isHomeroom:t.isHomeroom,homeroomClass:t.isHomeroom?t.homeroomClass:'',createdAt:new Date().toISOString()});
        await signOut(secondaryAuth); created++;
      }catch(err){console.error('Gagal import guru',t.loginId,err);failed++;}
      finally{if(secondary)await deleteApp(secondary).catch(()=>{});}
    }
    toast(`Import guru selesai: ${created} akun baru, ${updated} diperbarui${failed?`, ${failed} gagal/dilewati`:''}`,7000);
    e.target.value=''; await master();
  }catch(err){console.error(err);toast(err.message||'Import akun guru gagal.');}
});

function openEditModal(title,body,onSave){ const modal=$('#editModal'); $('#editModalTitle').textContent=title; $('#editModalBody').innerHTML=body; modal.classList.remove('hidden'); $('#editModalSave').onclick=()=>Promise.resolve(onSave()).catch(e=>{console.error(e);toast('Gagal menyimpan perubahan')}); }
function closeEditModal(){ $('#editModal').classList.add('hidden'); $('#editModalBody').innerHTML=''; }
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
  const loginId=prompt('ID Guru (contoh G001):'); if(!loginId)return;
  const name=prompt('Nama Guru:'); if(!name)return;
  const isHomeroom=confirm('Apakah guru ini WALI KELAS? Klik OK untuk Wali Kelas, Batal untuk Guru.');
  let homeroomClass='';
  if(isHomeroom){homeroomClass=(prompt('Kelas wali (contoh 7A):')||'').trim().toUpperCase();if(!homeroomClass)return toast('Kelas wali wajib diisi'); const clash=(window.masterUsers||[]).find(x=>x.role==='guru'&&x.active!==false&&x.isHomeroom===true&&x.homeroomClass===homeroomClass);if(clash)return toast(`${homeroomClass} sudah memiliki wali kelas: ${clash.name}`);}
  const password=prompt('Password awal (minimal 6 karakter):','123456'); if(!password||password.length<6)return toast('Password minimal 6 karakter');
  let secondary=null;
  try{
    secondary=initializeApp(cfg,`teacher-${Date.now()}`); const secondaryAuth=getAuth(secondary);
    const cred=await createUserWithEmailAndPassword(secondaryAuth,loginEmail(loginId),password);
    await setDoc(doc(db,'users',cred.user.uid),{loginId:loginId.trim().toUpperCase(),name:name.trim(),role:'guru',active:true,isHomeroom,homeroomClass:isHomeroom?homeroomClass:'',createdAt:new Date().toISOString()});
    await signOut(secondaryAuth); toast(`Akun ${loginId.toUpperCase()} berhasil dibuat`); master();
  }catch(e){console.error(e);toast(e.code==='auth/email-already-in-use'?'ID Guru sudah digunakan':'Gagal membuat akun guru');}
  finally{if(secondary)await deleteApp(secondary).catch(()=>{})}
}

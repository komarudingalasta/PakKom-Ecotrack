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
const loginEmail = id => `${String(id).trim().toLowerCase().replace(/[^a-z0-9._-]/g,'')}@pakkom-ecotrack.app`;
let app, auth, db;
let state = { user:null, profile:null, page:'home', selectedClass:null, classes:[], recordsToday:[], students:[] };

function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2400); }
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
      if(!snap.exists() || snap.data().active===false){ await signOut(auth); toast('Akun tidak aktif atau belum terdaftar'); return; }
      state.user=user; state.profile={uid:user.uid,...snap.data()};
      await refreshCore(); renderShell();
    }catch(e){ console.error(e); toast('Gagal membaca profil akun'); }
  });
}

$('#loginForm').addEventListener('submit',async e=>{
  e.preventDefault(); if(!configured)return;
  const id=$('#loginId').value.trim(); const password=$('#loginPassword').value;
  $('#loginBtn').disabled=true; $('#loginBtn').textContent='Memeriksa...';
  try{ await signInWithEmailAndPassword(auth,loginEmail(id),password); }
  catch(e){ console.error(e); toast('ID Guru/Admin atau password salah'); }
  finally{ $('#loginBtn').disabled=false; $('#loginBtn').textContent='Masuk'; }
});
$('#logoutBtn').onclick=()=>signOut(auth);
$('#menuBtn').onclick=()=>document.querySelector('.sidebar').classList.toggle('open');

async function refreshCore(){
  const [classSnap, recordSnap] = await Promise.all([
    getDocs(query(collection(db,'classes'),orderBy('name'))).catch(()=>null),
    getDocs(query(collection(db,'records'),where('date','==',todayKey()))).catch(()=>null)
  ]);
  state.classes = classSnap && !classSnap.empty ? classSnap.docs.map(d=>d.id) : classesDefault;
  state.recordsToday = recordSnap ? recordSnap.docs.map(d=>({id:d.id,...d.data()})) : [];
}
function classRecord(c){ return state.recordsToday.find(r=>r.classId===c); }

function renderShell(){
  if(!state.profile){ $('#loginView').classList.remove('hidden'); $('#appView').classList.add('hidden'); return; }
  $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden');
  $('#userChip').innerHTML=`<b>${esc(state.profile.name)}</b><br>${state.profile.role==='admin'?'Admin':'Guru'}`;
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
  content.innerHTML=`<div class="grid stats"><div class="stat"><span>Kelas selesai</span><strong>${done.size}/${state.classes.length}</strong></div><div class="stat"><span>Belum didata</span><strong>${state.classes.length-done.size}</strong></div><div class="stat"><span>Membawa wadah</span><strong>${food}%</strong></div><div class="stat"><span>Membawa tumbler</span><strong>${tumb}%</strong></div></div>
  <div class="grid two-col" style="margin-top:16px"><div class="card"><div class="section-head"><h3>Status Pendataan Hari Ini</h3><button class="btn primary" id="startInput">Mulai Pendataan</button></div><div class="grid class-grid">${state.classes.map(c=>{const r=classRecord(c);return `<button class="class-btn ${r?'done':'pending'}" data-class="${c}"><b>${c}</b><small>${r?'✓ '+esc(r.lastEditedByName||r.createdByName||'Guru'):'Belum didata'}</small></button>`}).join('')}</div></div><div class="card"><h3>Ringkasan</h3><p>Semua guru aktif dapat mendata kelas mana pun. Koreksi tetap mencatat pengguna dan waktu perubahan.</p><div class="notice">Hari ini masih ada <b>${state.classes.length-done.size}</b> kelas yang belum didata.</div></div></div>`;
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
    const students=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    const existing=classRecord(c);
    window.formItems=existing ? JSON.parse(JSON.stringify(existing.items||[])) : students.map(s=>({studentId:s.id,nis:s.nis||s.id,name:s.name,presence:'hadir',food:true,tumbler:true}));
    window.originalRecord=existing||null; window.formLocked=!!(existing && existing.createdByUid!==state.user.uid && state.profile.role!=='admin');
    renderClassForm(c);
  }catch(e){ console.error(e); content.innerHTML='<div class="card"><div class="empty">Gagal memuat siswa. Periksa Firestore Rules dan koneksi.</div></div>'; }
}
function renderClassForm(c){
  const existing=window.originalRecord;
  content.innerHTML=`<div class="section-head"><div><h3 style="margin:0">Kelas ${c}</h3><small>${existing?`Sudah didata oleh ${esc(existing.createdByName||'Guru')} • ${esc(existing.timeLabel||'-')}`:'Belum pernah disimpan hari ini'}</small></div><button class="btn ghost" id="backClasses">← Pilih kelas lain</button></div>
  ${window.formLocked?'<div class="notice">Data dibuat guru lain. Saat ini hanya ditampilkan. Gunakan “Koreksi Data” jika memang perlu mengubahnya.</div>':''}
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
  pageMeta('Rekap','Ringkasan kepatuhan wadah dan tumbler');
  const cards=state.classes.map(c=>{const r=classRecord(c);if(!r)return {c,food:0,tumb:0,both:0,status:'Belum'};const hadir=(r.items||[]).filter(i=>i.presence==='hadir');const pct=f=>hadir.length?Math.round(hadir.filter(f).length/hadir.length*100):0;return {c,food:pct(i=>i.food),tumb:pct(i=>i.tumbler),both:pct(i=>i.food&&i.tumbler),status:'Selesai'}});
  content.innerHTML=`<div class="card"><div class="section-head"><h3>Rekap Hari Ini</h3><span class="badge neutral">${dateID()}</span></div><div class="table-wrap"><table><thead><tr><th>Kelas</th><th>Status</th><th>Wadah</th><th>Tumbler</th><th>Keduanya</th></tr></thead><tbody>${cards.map(x=>`<tr><td><b>${x.c}</b></td><td><span class="badge ${x.status==='Selesai'?'ok':'warn'}">${x.status}</span></td><td>${x.food}%</td><td>${x.tumb}%</td><td><div style="display:flex;align-items:center;gap:8px"><div class="progress" style="width:120px"><i style="width:${x.both}%"></i></div><b>${x.both}%</b></div></td></tr>`).join('')}</tbody></table></div></div>`;
}
function account(){ pageMeta('Akun','Informasi pengguna'); content.innerHTML=`<div class="card" style="max-width:600px"><h3>${esc(state.profile.name)}</h3><p><b>ID:</b> ${esc(state.profile.loginId||'-')}</p><p><b>Peran:</b> ${state.profile.role==='admin'?'Administrator':'Guru'}</p><p><b>Status:</b> ${state.profile.active!==false?'Aktif':'Nonaktif'}</p><div class="notice">Guru dapat input seluruh kelas, melihat rekap, dan melakukan koreksi terbatas. Master data hanya untuk admin.</div></div>`; }

async function master(){
  if(state.profile.role!=='admin'){state.page='home';return renderShell()}
  pageMeta('Kelola Data','Khusus Administrator');
  content.innerHTML='<div class="card"><div class="empty">Memuat data master...</div></div>';
  const [stuSnap,userSnap]=await Promise.all([getDocs(collection(db,'students')),getDocs(collection(db,'users'))]);
  state.students=stuSnap.docs.map(d=>({id:d.id,...d.data()})); const users=userSnap.docs.map(d=>({uid:d.id,...d.data()}));
  content.innerHTML=`<div class="grid two-col"><div class="card"><div class="section-head"><div><h3>Master Siswa</h3><small>${state.students.length} siswa</small></div><button id="importStudents" class="btn primary">Import Excel</button></div><p>Kolom yang dikenali: <b>NIS</b>, <b>Nama</b>, <b>Kelas</b>.</p><div class="notice">Import akan menambah/memperbarui siswa berdasarkan NIS.</div></div>
  <div class="card"><div class="section-head"><div><h3>Akun Guru</h3><small>${users.filter(u=>u.role==='guru').length} guru</small></div><button id="addTeacher" class="btn primary">+ Guru</button></div>${users.filter(u=>u.role==='guru').slice(0,8).map(u=>`<p><b>${esc(u.name)}</b><br><small>${esc(u.loginId||'')} • ${u.active===false?'Nonaktif':'Aktif'}</small></p>`).join('')||'<div class="empty">Belum ada guru.</div>'}</div></div>
  <div class="card" style="margin-top:16px"><div class="section-head"><h3>Daftar Kelas</h3><button id="seedClasses" class="btn ghost">Pastikan 7A–9I Tersedia</button></div><div class="grid class-grid">${state.classes.map(c=>`<div class="class-btn done"><b>${c}</b><small>Aktif</small></div>`).join('')}</div></div>`;
  $('#importStudents').onclick=()=>$('#studentImport').click(); $('#addTeacher').onclick=addTeacherPrompt; $('#seedClasses').onclick=seedClasses;
}
$('#studentImport').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const buf=await f.arrayBuffer();const wb=XLSX.read(buf);const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});const normalized=rows.map(r=>({nis:String(r.NIS||r.nis||r['Nomor Induk']||'').trim(),name:String(r.Nama||r.nama||r['Nama Siswa']||'').trim(),classId:String(r.Kelas||r.kelas||r['KELAS']||'').trim().toUpperCase()})).filter(r=>r.nis&&r.name&&r.classId);if(!normalized.length)throw new Error('Kolom tidak cocok');const chunkSize=450;
    for(let start=0; start<normalized.length; start+=chunkSize){
      const batch=writeBatch(db);
      normalized.slice(start,start+chunkSize).forEach(s=>batch.set(doc(db,'students',s.nis),{...s,active:true,updatedAt:new Date().toISOString()},{merge:true}));
      await batch.commit();
    }
    toast(`${normalized.length} siswa berhasil diimport`);e.target.value='';master();}catch(err){console.error(err);toast('Import gagal. Pastikan kolom NIS, Nama, Kelas tersedia.')}});

async function seedClasses(){try{const batch=writeBatch(db);classesDefault.forEach(c=>batch.set(doc(db,'classes',c),{name:c,active:true},{merge:true}));await batch.commit();await refreshCore();toast('Daftar kelas 7A–9I siap');master();}catch(e){console.error(e);toast('Gagal membuat kelas')}}
async function addTeacherPrompt(){
  const loginId=prompt('ID Guru (contoh G001):'); if(!loginId)return;
  const name=prompt('Nama Guru:'); if(!name)return;
  const password=prompt('Password awal (minimal 6 karakter):','123456'); if(!password||password.length<6)return toast('Password minimal 6 karakter');
  let secondary=null;
  try{
    secondary=initializeApp(cfg,`teacher-${Date.now()}`); const secondaryAuth=getAuth(secondary);
    const cred=await createUserWithEmailAndPassword(secondaryAuth,loginEmail(loginId),password);
    await setDoc(doc(db,'users',cred.user.uid),{loginId:loginId.trim().toUpperCase(),name:name.trim(),role:'guru',active:true,createdAt:new Date().toISOString()});
    await signOut(secondaryAuth); toast(`Akun ${loginId.toUpperCase()} berhasil dibuat`); master();
  }catch(e){console.error(e);toast(e.code==='auth/email-already-in-use'?'ID Guru sudah digunakan':'Gagal membuat akun guru');}
  finally{if(secondary)await deleteApp(secondary).catch(()=>{})}
}

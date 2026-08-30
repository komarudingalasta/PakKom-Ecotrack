(()=>{'use strict';
const $=s=>document.querySelector(s), cfg=window.PAKKOM_FIREBASE_CONFIG||{};
const app=(firebase.apps.find(a=>a.name==='PAKKOM_STUDENT')||firebase.initializeApp(cfg,'PAKKOM_STUDENT'));
const auth=app.auth(), db=app.firestore();
let user=null, profile=null, tasks=[], subs=[], loginInProgress=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const normClass=s=>String(s||'').trim().toUpperCase().replace(/^KELAS\s*/,'').replace(/\s+/g,'');
const sha256=async text=>{const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(text)));return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')};
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function showLogin(msg=''){$('#boot').classList.add('hidden');$('#app').classList.add('hidden');$('#login').classList.remove('hidden');$('#loginError').classList.toggle('hidden',!msg);$('#loginError').textContent=msg}
function showApp(){$('#boot').classList.add('hidden');$('#login').classList.add('hidden');$('#app').classList.remove('hidden')}
function subFor(taskId){return subs.find(s=>s.taskId===taskId)}
function st(task){const s=subFor(task.id);if(!s)return 'todo';if(s.status==='revision')return 'revision';if(s.status==='graded'||s.status==='submitted')return 'done';return 'todo'}
function statusLabel(k){return k==='revision'?'Perlu Perbaikan':k==='done'?'Selesai':'Belum Dikerjakan'}
async function loadData(){
  const c=normClass(profile.classId); profile.classId=c; tasks=[]; subs=[];
  try{const a=await db.collection('assignments').where('targetClasses','array-contains',c).get();tasks=a.docs.map(d=>({id:d.id,...d.data()})).filter(t=>t.published===true&&t.archived!==true)}catch(e){console.warn('Tugas belum dapat dimuat:',e)}
  const nis=String(profile.loginId);
  try{const own=await db.collection('taskSubmissions').where('nis','==',nis).get();own.docs.forEach(d=>subs.push({id:d.id,...d.data()}))}catch(e){console.warn('Pengumpulan individu belum dapat dimuat:',e)}
  try{const gm=await db.collection('taskSubmissions').where('memberNis','array-contains',nis).get();const map=new Map(subs.map(x=>[x.id,x]));gm.docs.forEach(d=>map.set(d.id,{id:d.id,...d.data()}));subs=[...map.values()]}catch(e){console.warn('Pengumpulan kelompok belum dapat dimuat:',e)}
}
function home(){
  const todo=tasks.filter(t=>st(t)==='todo').length, rev=tasks.filter(t=>st(t)==='revision').length, done=tasks.filter(t=>st(t)==='done').length;
  const recent=tasks.slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,5);
  $('#content').innerHTML=`<section class="hero"><small>Selamat datang</small><h2>${esc(profile.name||'Siswa')}</h2><p>NIS ${esc(profile.loginId)} • Kelas ${esc(profile.classId)}</p><div class="stats"><div class="stat"><strong>${todo}</strong><span>Belum</span></div><div class="stat"><strong>${rev}</strong><span>Perbaikan</span></div><div class="stat"><strong>${done}</strong><span>Selesai</span></div></div></section><section class="card"><h3>Tugas Terbaru</h3><div class="task-list">${recent.length?recent.map(t=>{const k=st(t);return `<div class="task-row"><div><h4>${esc(t.title)}</h4><div class="meta">Batas: ${esc(t.dueDate||'Tanpa batas')}</div></div><div><span class="badge ${k}">${statusLabel(k)}</span></div></div>`}).join(''):'<p class="muted">Belum ada tugas yang diterbitkan untuk kelas Anda.</p>'}</div>${recent.length?'<p><a class="btn primary" href="tugas/" style="display:inline-block;text-decoration:none">Buka Semua Tugas</a></p>':''}</section>`;
}
function me(){
  $('#content').innerHTML=`<section class="card"><h3>Profil Saya</h3><div class="profile-grid"><div>Nama</div><strong>${esc(profile.name||'-')}</strong><div>NIS</div><strong>${esc(profile.loginId||'-')}</strong><div>Kelas</div><strong>${esc(profile.classId||'-')}</strong><div>Status</div><strong>Aktif</strong></div></section><section class="card"><h3>Akun</h3><p class="muted">Data profil bersumber dari data siswa EcoTrack. Jika ada kesalahan nama atau kelas, hubungi wali kelas/Admin.</p><button id="meLogout" class="btn ghost">Keluar dari Akun</button></section>`;$('#meLogout').onclick=logout;
}
function render(page='home'){document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page)); if(page==='me')me(); else home()}
async function logout(){try{if(user)await db.collection('users').doc(user.uid).delete()}catch(_){}sessionStorage.removeItem('pakkomStudentNis');try{await auth.signOut()}finally{location.href='./'}}
$('#logoutBtn').onclick=logout; $('#togglePwd').onclick=()=>{$('#password').type=$('#password').type==='password'?'text':'password'};
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>render(b.dataset.page));
$('#loginForm').onsubmit=async e=>{e.preventDefault();loginInProgress=true;const nis=$('#nis').value.trim(),pwd=$('#password').value;const btn=$('#loginBtn');if(!nis||!pwd)return;btn.disabled=true;btn.textContent='MEMERIKSA...';try{
  await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
  if(auth.currentUser) await auth.signOut();
  const cred=await auth.signInAnonymously();
  const accessSnap=await db.collection('studentAccess').doc(nis).get();
  if(!accessSnap.exists)throw new Error('NIS belum memiliki akses login.');
  const a=accessSnap.data()||{};if(a.active!==true)throw new Error('Status siswa tidak aktif.');if(a.loginEnabled===false)throw new Error('Akses login dinonaktifkan oleh Admin.');
  if(await sha256(pwd)!==String(a.passwordHash||''))throw new Error('NIS atau password salah.');
  const c=normClass(a.classId);if(!c)throw new Error('Kelas siswa belum terisi pada data akses.');
  profile={role:'siswa',active:true,approved:true,name:a.name||'Siswa',loginId:nis,nis,studentId:String(a.studentId||''),classId:c,sessionType:'anonymous',createdAt:new Date().toISOString()};
  sessionStorage.setItem('pakkomStudentNis',nis);
  await db.collection('users').doc(cred.user.uid).set(profile);
  user=cred.user;await loadData();showApp();render('home');
}catch(err){console.error(err);try{await auth.signOut()}catch(_){}showLogin(err.message||'Login gagal.')}finally{loginInProgress=false;btn.disabled=false;btn.textContent='MASUK'}};
auth.onAuthStateChanged(async u=>{if(loginInProgress)return;if(!u)return showLogin();user=u;try{const d=await db.collection('users').doc(u.uid).get();if(!d.exists||d.data().role!=='siswa'||d.data().active!==true)return showLogin();profile=d.data();profile.classId=normClass(profile.classId);if(profile.loginId)sessionStorage.setItem('pakkomStudentNis',String(profile.loginId));await loadData();showApp();render('home')}catch(e){console.error(e);showLogin('Sesi siswa perlu diperbarui. Silakan masuk kembali.')}});
})();

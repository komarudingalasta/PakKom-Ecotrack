(()=>{'use strict';
const $=s=>document.querySelector(s),cfg=window.PAKKOM_FIREBASE_CONFIG||{};
if(!firebase.apps.length) firebase.initializeApp(cfg);
const auth=firebase.auth(),db=firebase.firestore();
let user=null,profile=null,tasks=[],subs=[],activeFilter='all';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const norm=s=>String(s||'').trim().toUpperCase().replace(/\s+/g,'');
function showError(m,detail=''){$('#loading').classList.add('hidden');$('#app').classList.add('hidden');$('#error').classList.remove('hidden');$('#error').innerHTML=`<h2>Tugas belum dapat dibuka</h2><p>${esc(m)}</p>${detail?`<div class="notice"><small>${esc(detail)}</small></div>`:''}<a class="secondary btnlink" href="../">Kembali ke Beranda</a>`}
function modal(h){$('#modalBody').innerHTML=h;$('#modal').classList.remove('hidden')}
function close(){$('#modal').classList.add('hidden')}
$('#closeModal').onclick=close; $('#modal').onclick=e=>{if(e.target===$('#modal'))close()};
function statusOf(t,s){if(!s)return 'todo';if(s.status==='revision')return 'revision';if(s.status==='graded')return 'graded';if(s.status==='submitted')return 'submitted';return 'draft'}
function statusLabel(k){return ({todo:'Belum Dikerjakan',draft:'Draf',submitted:'Sudah Dikumpulkan',revision:'Perlu Perbaikan',graded:'Sudah Dinilai'})[k]||k}
function dueText(t){if(!t.dueDate)return 'Tanpa batas waktu';const d=new Date(t.dueDate+'T23:59:59');return `${t.dueDate}${Date.now()>d.getTime()?' • Lewat batas':''}`}
async function load(){
  const classId=norm(profile.classId);
  if(!classId) throw new Error('Kelas pada profil siswa kosong.');
  // Query ini sengaja mengikuti Rules: siswa hanya meminta assignment untuk kelasnya sendiri.
  const assignmentSnap=await db.collection('assignments').where('targetClasses','array-contains',classId).get();
  tasks=assignmentSnap.docs.map(d=>({id:d.id,...d.data()})).filter(t=>t.published!==false&&t.archived!==true);
  const ownSnap=await db.collection('taskSubmissions').where('nis','==',String(profile.loginId)).get();
  subs=ownSnap.docs.map(d=>({id:d.id,...d.data()}));
  tasks.sort((a,b)=>String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999')));
  draw();
}
function draw(){
  const sm=new Map(subs.map(s=>[s.taskId,s]));
  const counts={todo:0,draft:0,submitted:0,revision:0,graded:0};
  tasks.forEach(t=>counts[statusOf(t,sm.get(t.id))]++);
  $('#summary').innerHTML=`<button data-filter="todo"><b>${counts.todo}</b><span>Belum</span></button><button data-filter="revision"><b>${counts.revision}</b><span>Perbaikan</span></button><button data-filter="submitted"><b>${counts.submitted}</b><span>Dikumpulkan</span></button><button data-filter="graded"><b>${counts.graded}</b><span>Dinilai</span></button>`;
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{activeFilter=b.dataset.filter;draw()});
  const list=tasks.filter(t=>activeFilter==='all'||statusOf(t,sm.get(t.id))===activeFilter);
  $('#filterRow').innerHTML=`<button class="chip ${activeFilter==='all'?'active':''}" data-f="all">Semua</button>${['todo','draft','revision','submitted','graded'].map(k=>`<button class="chip ${activeFilter===k?'active':''}" data-f="${k}">${statusLabel(k)}</button>`).join('')}`;
  document.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{activeFilter=b.dataset.f;draw()});
  $('#view').innerHTML=list.length?`<div class="grid">${list.map(t=>{const s=sm.get(t.id),st=statusOf(t,s);return `<article class="card task"><div class="tags"><span class="tag">${t.taskType==='group'?'Kelompok':'Individu'}</span><span class="tag status-${st}">${statusLabel(st)}</span></div><h3>${esc(t.title)}</h3><p>${esc(t.description||'')}</p><div class="meta">Batas: ${esc(dueText(t))}</div>${s?.feedback?`<div class="notice"><b>Catatan guru:</b> ${esc(s.feedback)}</div>`:''}<button class="primary" data-open="${t.id}">${st==='graded'?'Lihat Nilai':st==='submitted'?'Lihat Pengumpulan':st==='revision'?'Perbaiki Tugas':'Kerjakan'}</button></article>`}).join('')}</div>`:'<div class="card empty">Tidak ada tugas pada kategori ini.</div>';
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openTask(b.dataset.open));
}
function taskComponents(t){if(Array.isArray(t.components)&&t.components.length)return t.components;return [{type:t.answerType||'link',label:'Jawaban',required:true,count:1,requireDescription:(t.answerType||'link')==='link'}]}
function answerKey(ci,ii){return `${ci}_${ii}`}
function openTask(id){
  const t=tasks.find(x=>x.id===id),s=subs.find(x=>x.taskId===id); if(!t)return;
  if(t.taskType==='group')return modal('<h2>Tugas Kelompok</h2><div class="notice">Tugas kelompok akan diaktifkan setelah alur tugas individu selesai diuji.</div>');
  const st=statusOf(t,s),locked=st==='graded'||st==='submitted',components=taskComponents(t),oldAnswers=Array.isArray(s?.answers)?s.answers:[];
  const fields=components.map((c,ci)=>Array.from({length:Math.max(1,Number(c.count)||1)},(_,ii)=>{const old=oldAnswers.find(a=>a.componentIndex===ci&&a.itemIndex===ii)||(components.length===1&&ii===0?oldAnswers[0]:{})||{},label=`${c.label||'Jawaban'}${Number(c.count)>1?' '+(ii+1):''}`,key=answerKey(ci,ii);if(c.type==='text')return `<div class="field"><label>${esc(label)}${c.required?' *':''}</label><textarea data-answer="${key}" data-type="text" ${locked?'disabled':''}>${esc(old.text||'')}</textarea></div>`;const ph=c.type==='photo'?'Link foto Google Drive':c.type==='video'?'Link video Google Drive/YouTube/Instagram/TikTok':c.type==='document'?'Link dokumen Google Drive/Docs':'https://...';return `<div class="field"><label>${esc(label)}${c.required?' *':''}</label><input data-answer="${key}" data-type="${esc(c.type)}" type="url" placeholder="${esc(ph)}" value="${esc(old.url||'')}" ${locked?'disabled':''}></div><div class="field"><label>Keterangan${c.requireDescription?' *':''}</label><textarea data-description="${key}" ${locked?'disabled':''}>${esc(old.description||'')}</textarea></div>`}).join('')).join('');
  modal(`<h2>${esc(t.title)}</h2><p>${esc(t.description||'')}</p><div class="meta">Batas: ${esc(dueText(t))}</div>${fields}<div class="notice"><small>Foto, video, dan dokumen dikumpulkan melalui link. Jika menggunakan Google Drive, pastikan guru dapat membuka file tanpa meminta izin akses.</small></div>${s?.feedback?`<div class="notice"><b>Catatan guru:</b> ${esc(s.feedback)}</div>`:''}${st==='graded'?`<div class="card"><b>Nilai: ${esc(s.score??'-')}</b></div>`:st==='submitted'?`<div class="notice"><b>Sudah dikumpulkan.</b><br><small>${esc(s.submittedAt||'')}</small></div>`:`<div class="actions"><button id="draft" class="secondary">Simpan Draf</button><button id="submit" class="primary">${st==='revision'?'Kumpulkan Ulang':'Kumpulkan'}</button></div>`}`);
  if(!locked){$('#draft').onclick=()=>save(t,s,'draft');$('#submit').onclick=()=>save(t,s,'submitted')}
}
async function save(t,s,status){
  const components=taskComponents(t),answers=[];
  for(let ci=0;ci<components.length;ci++){const c=components[ci];for(let ii=0;ii<Math.max(1,Number(c.count)||1);ii++){const key=answerKey(ci,ii),el=document.querySelector(`[data-answer="${key}"]`),v=(el?.value||'').trim(),desc=(document.querySelector(`[data-description="${key}"]`)?.value||'').trim(),label=`${c.label||'Jawaban'}${Number(c.count)>1?' '+(ii+1):''}`;if(status==='submitted'&&c.required&&!v)return alert(`${label} wajib diisi.`);if(status==='submitted'&&v&&c.requireDescription&&c.type!=='text'&&!desc)return alert(`Keterangan untuk ${label} wajib diisi.`);if(c.type!=='text'&&v){try{const u=new URL(v);if(!['http:','https:'].includes(u.protocol))throw new Error()}catch(_){return alert(`Link ${label} belum valid. Awali dengan https://`)}}answers.push({componentIndex:ci,itemIndex:ii,type:c.type,label,url:c.type==='text'?'':v,text:c.type==='text'?v:'',description:c.type==='text'?'':desc})}}
  const now=new Date().toISOString(),ref=s?db.collection('taskSubmissions').doc(s.id):db.collection('taskSubmissions').doc(`${t.id}_${profile.loginId}`);
  const data={taskId:t.id,taskType:'individual',studentUid:user.uid,studentId:profile.studentId||'',nis:String(profile.loginId),studentName:profile.name||'',classId:norm(profile.classId),groupNo:null,groupKey:'',memberNis:[],memberNames:[],answers,reflection:'',status,submittedAt:status==='submitted'?now:(s?.submittedAt||null),submittedByNis:status==='submitted'?String(profile.loginId):(s?.submittedByNis||''),submittedByName:status==='submitted'?(profile.name||''):(s?.submittedByName||''),updatedAt:now,updatedByNis:String(profile.loginId)};
  try{await ref.set(data,{merge:true});close();await load();alert(status==='draft'?'Draf berhasil disimpan.':'Tugas berhasil dikumpulkan.')}catch(e){alert('Gagal menyimpan: '+e.message)}
}
$('#logout').onclick=async()=>{try{if(user)await db.collection('users').doc(user.uid).delete()}catch(_){}try{await auth.signOut()}finally{location.href='../'}};
auth.onAuthStateChanged(async u=>{
  if(!u)return showError('Sesi siswa tidak ditemukan.','Silakan login dari halaman siswa terlebih dahulu.'); user=u;
  try{const d=await db.collection('users').doc(u.uid).get();if(!d.exists)throw new Error('Profil sesi siswa tidak ditemukan.');profile=d.data();if(profile.role!=='siswa'||profile.active!==true)throw new Error('Halaman ini khusus siswa aktif.');profile.classId=norm(profile.classId);$('#loading').classList.add('hidden');$('#app').classList.remove('hidden');$('#profileLabel').textContent=`${profile.name||'Siswa'} • Kelas ${profile.classId}`;$('#diagnostic').textContent=`NIS ${profile.loginId} • Kelas ${profile.classId}`;await load()}catch(e){showError(e.message, e.code==='permission-denied'?'Sesi siswa lama perlu diperbarui. Kembali ke Beranda, keluar, lalu login kembali agar kelas siswa tersinkron.':'Pastikan tugas sudah diterbitkan dan kelas siswa termasuk kelas sasaran.')}
});
})();

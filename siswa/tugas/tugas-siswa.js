const app=(firebase.apps.find(a=>a.name==='PAKKOM_STUDENT')||firebase.initializeApp(window.PAKKOM_FIREBASE_CONFIG,'PAKKOM_STUDENT'));
const auth=app.auth(),db=app.firestore();
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const norm=v=>String(v||'').toUpperCase().replace(/KELAS/g,'').replace(/\s+/g,'').trim();
let user=null,profile=null,tasks=[],subs=[],groups=[],programs=[],activeFilter='all',assessmentCuts=[69,79,89],groupMaxMembers=6;
function ranges(){const [a,b,c]=assessmentCuts;return[{min:0,max:a,label:'Perlu Bimbingan'},{min:a+1,max:b,label:'Berkembang'},{min:b+1,max:c,label:'Cakap'},{min:c+1,max:100,label:'Mahir'}]}
function scoreCategory(score){const n=Number(score);if(!Number.isFinite(n)||n<0||n>100)return '';return ranges().find(r=>n>=r.min&&n<=r.max)?.label||''}
function modal(html){$('#modalBody').innerHTML=html;$('#modal').classList.remove('hidden')}
function close(){ $('#modal').classList.add('hidden'); $('#modalBody').innerHTML=''; }
$('#closeModal').onclick=close;
$('#logout').onclick=async()=>{try{await db.collection('users').doc(user.uid).delete()}catch(_){}sessionStorage.removeItem('pakkomStudentNis');await auth.signOut();location.href='../'};
function groupScope(t){return String(t.programId||t.id||'')}
function groupForTask(taskId){const t=tasks.find(x=>x.id===taskId);if(!t)return null;const scope=groupScope(t);return groups.find(g=>String(g.programId||g.taskId)===scope&&Array.isArray(g.memberNis)&&g.memberNis.map(String).includes(String(profile.loginId)))}
function subForTask(t){if(t.taskType==='group'){const g=groupForTask(t.id);if(!g)return null;const gk=String(g.groupKey||g.id||'').trim();return subs.find(s=>String(s.taskId||'')===String(t.id)&&String(s.groupKey||'').trim()===gk)||null}return subs.find(s=>String(s.taskId||'')===String(t.id)&&String(s.nis||'').trim()===String(profile.loginId).trim())}
function statusOf(t){const s=subForTask(t);if(t.taskType==='group'&&!groupForTask(t.id))return 'nogroup';if(!s)return 'todo';if(s.status==='revision')return 'revision';if(s.status==='graded')return 'graded';if(s.status==='submitted')return 'submitted';return 'draft'}
function statusLabel(k){return ({nogroup:'Belum Punya Kelompok',todo:'Belum Dikerjakan',draft:'Draf',submitted:'Sudah Dikumpulkan',revision:'Perlu Perbaikan',graded:'Sudah Dinilai'})[k]||k}
function dueText(t){return t.dueDate||'Tanpa batas'}
async function loadAssessment(){try{const d=await db.collection('settings').doc('taskAssessment').get();if(d.exists&&Array.isArray(d.data().cutoffs)){const c=d.data().cutoffs.map(Number);if(c.length===3&&c[0]>=0&&c[0]<c[1]&&c[1]<c[2]&&c[2]<100)assessmentCuts=c}}catch(_){}}
async function loadGroupSettings(){try{const d=await db.collection('settings').doc('taskGroup').get();const n=d.exists?Number(d.data().maxMembers):6;groupMaxMembers=Number.isInteger(n)&&n>=2&&n<=36?n:6}catch(_){groupMaxMembers=6}}
async function resolveStudentProfile(u){
  const ud=await db.collection('users').doc(u.uid).get();
  const raw=ud.exists?ud.data():{};
  const nis=String(raw.loginId||sessionStorage.getItem('pakkomStudentNis')||'').trim();
  if(!nis)throw new Error('Sesi siswa tidak lengkap. Silakan masuk kembali dari Beranda siswa.');
  const aSnap=await db.collection('studentAccess').doc(nis).get();
  if(!aSnap.exists)throw new Error('Akses login siswa tidak ditemukan.');
  const a=aSnap.data()||{};
  if(a.active!==true)throw new Error('Status siswa tidak aktif.');
  if(a.loginEnabled===false)throw new Error('Akses login siswa dinonaktifkan oleh Admin.');
  const classId=norm(a.classId||raw.classId);
  if(!classId)throw new Error('Kelas siswa belum terisi.');
  sessionStorage.setItem('pakkomStudentNis',nis);
  return {role:'siswa',active:true,approved:true,name:a.name||raw.name||'Siswa',loginId:nis,nis,studentId:String(a.studentId||raw.studentId||''),classId};
}
async function load(){
  await Promise.all([loadAssessment(),loadGroupSettings()]);
  const classId=norm(profile.classId),nis=String(profile.loginId);const errors=[];
  try{const ps=await db.collection('cocurricularPrograms').where('active','==',true).get();programs=ps.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.archived!==true)}catch(e){programs=[];errors.push('program: '+(e.code||e.message))}
  try{const a=await db.collection('assignments').where('targetClasses','array-contains',classId).get();tasks=a.docs.map(d=>({id:d.id,...d.data()})).filter(t=>t.published===true&&t.archived!==true)}catch(e){tasks=[];errors.push('tugas: '+(e.code||e.message))}
  // Muat kelompok lebih dahulu. Status tugas kelompok ditentukan oleh taskId + groupKey,
  // bukan oleh NIS siswa yang kebetulan mengunggah tugas.
  try{const gs=await db.collection('taskGroups').where('classId','==',classId).get();groups=gs.docs.map(d=>({id:d.id,...d.data()})).filter(g=>Array.isArray(g.memberNis)&&g.memberNis.map(x=>String(x).trim()).includes(nis))}catch(e){groups=[];errors.push('kelompok: '+(e.code||e.message))}
  const map=new Map();
  try{const own=await db.collection('taskSubmissions').where('nis','==',nis).get();own.docs.forEach(d=>map.set(d.id,{id:d.id,...d.data()}))}catch(e){errors.push('pengumpulan individu: '+(e.code||e.message))}
  // Pertahankan query lama untuk kompatibilitas data submission yang sudah ada.
  try{const member=await db.collection('taskSubmissions').where('memberNis','array-contains',nis).get();member.docs.forEach(d=>map.set(d.id,{id:d.id,...d.data()}))}catch(e){errors.push('pengumpulan kelompok lama: '+(e.code||e.message))}
  // Jalur utama v9.7.8: baca dokumen submission langsung berdasarkan taskId + groupKey.
  // Ini membuat semua anggota kelompok melihat status yang sama walaupun bukan pengunggah.
  for(const t of tasks.filter(x=>x.taskType==='group')){
    const g=groupForTask(t.id); if(!g) continue;
    const gk=String(g.groupKey||g.id||'').trim(); if(!gk) continue;
    const ids=[`${t.id}_${gk}`,gk];
    for(const sid of ids){
      if(map.has(sid)) continue;
      try{const snap=await db.collection('taskSubmissions').doc(sid).get();if(snap.exists){const d={id:snap.id,...snap.data()};if(String(d.taskId||'')===String(t.id)&&String(d.groupKey||'')===gk)map.set(snap.id,d)}}catch(e){if(e.code!=='permission-denied')errors.push('pengumpulan kelompok '+t.id+': '+(e.code||e.message))}
    }
  }
  subs=[...map.values()];
  if(errors.length)console.warn('Sebagian data tugas belum dapat dimuat:',errors.join(' | '));
  draw();
}
function draw(){
  const counts={nogroup:0,todo:0,draft:0,revision:0,submitted:0,graded:0};tasks.forEach(t=>counts[statusOf(t)]++);
  $('#summary').innerHTML=`<button data-f="todo"><b>${counts.todo+counts.nogroup}</b><span>Belum</span></button><button data-f="revision"><b>${counts.revision}</b><span>Perbaikan</span></button><button data-f="submitted"><b>${counts.submitted}</b><span>Dikumpulkan</span></button><button data-f="graded"><b>${counts.graded}</b><span>Dinilai</span></button>`;
  const list=tasks.filter(t=>activeFilter==='all'||statusOf(t)===activeFilter||(activeFilter==='todo'&&statusOf(t)==='nogroup'));
  $('#filterRow').innerHTML=`<button class="chip ${activeFilter==='all'?'active':''}" data-f="all">Semua</button>${['todo','revision','submitted','graded'].map(k=>`<button class="chip ${activeFilter===k?'active':''}" data-f="${k}">${statusLabel(k)}</button>`).join('')}`;
  document.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{activeFilter=b.dataset.f;draw()});
  $('#view').innerHTML=list.length?`<div class="grid">${list.map(t=>{const s=subForTask(t),st=statusOf(t),g=groupForTask(t.id),p=programs.find(x=>x.id===t.programId);return `<article class="card task">${p?`<div class="notice"><b>${esc(p.name||'Kokurikuler')}</b><br><small>Tema: ${esc(p.theme||'-')}<br>Topik: ${esc(p.topic||'-')}</small></div>`:''}<div class="tags"><span class="tag">${t.taskType==='group'?'Kelompok':'Individu'}</span><span class="tag status-${st}">${statusLabel(st)}</span></div><h3>${esc(t.title)}</h3>${t.taskType==='group'&&g?`<div class="notice"><b>Kelompok ${esc(g.groupNo||'-')}</b><br><small>${esc((g.memberNames||[]).join(', '))}</small></div>`:''}<p>${esc(t.description||'')}</p><div class="meta">Batas: ${esc(dueText(t))}</div>${s?.feedback?`<div class="notice"><b>Catatan guru:</b> ${esc(s.feedback)}</div>`:''}${st==='graded'?`<div class="meta"><b>Nilai ${esc(s.score??'-')} • ${esc(scoreCategory(s.score)||'-')}</b></div>`:''}${s&&t.taskType==='group'&&s.submittedByName?`<div class="meta">Dikumpulkan oleh: <b>${esc(s.submittedByName)}</b></div>`:''}<button class="primary" data-open="${t.id}">${st==='nogroup'?'Buat Kelompok':st==='graded'?'Lihat Nilai':st==='draft'?'Lanjutkan Draf':(t.taskType==='group'&&s&&st==='submitted'&&String(s.submittedByNis||'')!==String(profile.loginId))?'Lihat Pengumpulan':st==='submitted'?'Perbaiki Pengumpulan':st==='revision'?'Perbaiki Tugas':'Kerjakan'}</button></article>`}).join('')}</div>`:'<div class="card empty">Tidak ada tugas pada kategori ini.</div>';
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openTask(b.dataset.open));
}
function taskComponents(t){if(Array.isArray(t.components)&&t.components.length)return t.components;return[{type:t.answerType||'link',label:'Jawaban',required:true,count:1,requireDescription:(t.answerType||'link')==='link'}]}
function answerKey(ci,ii){return `${ci}_${ii}`}
async function openTask(id){const t=tasks.find(x=>x.id===id);if(!t)return;let g=t.taskType==='group'?groupForTask(t.id):null;if(t.taskType==='group'&&!g)return openCreateGroup(t);const s=subForTask(t),st=statusOf(t),locked=st==='graded',isOtherGroupSubmitter=t.taskType==='group'&&!!s&&st==='submitted'&&String(s.submittedByNis||'')!==String(profile.loginId),readOnly=locked||isOtherGroupSubmitter,components=taskComponents(t),oldAnswers=Array.isArray(s?.answers)?s.answers:[];const fields=components.map((c,ci)=>Array.from({length:Math.max(1,Number(c.count)||1)},(_,ii)=>{const old=oldAnswers.find(a=>Number(a.componentIndex)===ci&&Number(a.itemIndex)===ii)||{},key=answerKey(ci,ii),label=`${c.label||'Jawaban'}${Number(c.count)>1?' '+(ii+1):''}`;if(c.type==='text')return `<div class="field"><label>${esc(label)} ${c.required?'*':''}</label><textarea data-answer="${key}" ${readOnly?'disabled':''}>${esc(old.text||'')}</textarea></div>`;return `<div class="field"><label>${esc(label)} ${c.required?'*':''}</label><input data-answer="${key}" type="url" placeholder="https://..." value="${esc(old.url||'')}" ${readOnly?'disabled':''}><small>${c.type==='photo'?'Link foto':c.type==='video'?'Link video':c.type==='document'?'Link dokumen':'Link'}</small><textarea data-description="${key}" placeholder="Keterangan ${c.requireDescription?'(wajib)':''}" ${readOnly?'disabled':''}>${esc(old.description||'')}</textarea></div>`}).join('')).join('');modal(`<h2>${esc(t.title)}</h2>${g?`<div class="notice"><b>Kelompok ${esc(g.groupNo||'-')}</b><br>${esc((g.memberNames||[]).join(', '))}<br><small>Kelompok dibuat oleh siswa. Cukup satu anggota mengumpulkan dan seluruh anggota melihat status yang sama.</small></div>`:''}<p>${esc(t.description||'')}</p><div class="meta">Batas: ${esc(dueText(t))}</div>${fields}<div class="notice"><small>Foto, video, dan dokumen dikumpulkan melalui link. Jika menggunakan Google Drive, pastikan guru dapat membuka file tanpa meminta izin akses.</small></div>${s?.feedback?`<div class="notice"><b>Catatan guru:</b> ${esc(s.feedback)}</div>`:''}${s&&t.taskType==='group'&&s.submittedByName?`<div class="notice"><b>Dikumpulkan oleh: ${esc(s.submittedByName)}</b><br><small>Semua anggota kelompok mendapatkan status pengumpulan yang sama.</small></div>`:''}${st==='graded'?`<div class="card"><b>Nilai: ${esc(s.score??'-')}</b><div class="meta">Kategori: <b>${esc(scoreCategory(s.score)||'-')}</b></div></div>`:`${s&&['submitted','revision'].includes(st)?`<div class="notice"><b>${st==='revision'?'Tugas perlu diperbaiki.':'Tugas sudah dikumpulkan.'}</b><br><small>Pengiriman terakhir: ${esc(s.lastSubmittedAt||s.submittedAt||'-')}${Number(s.resubmissionCount||0)>0?` • Diperbarui ${esc(s.resubmissionCount)} kali`:''}</small></div>`:''}${isOtherGroupSubmitter?`<div class="notice"><small>Anda adalah anggota kelompok. Pengumpulan ini hanya dapat dilihat; perubahan dilakukan oleh siswa yang mengumpulkan.</small></div>`:`<div class="actions">${!s||st==='draft'?'<button id="draft" class="secondary">Simpan Draf</button>':''}<button id="submit" class="primary">${s&&['submitted','revision'].includes(st)?'Kirim Ulang':'Kumpulkan'}</button></div>`}`}`);if(!readOnly){const draftBtn=$('#draft');if(draftBtn)draftBtn.onclick=()=>save(t,s,g,'draft');const submitBtn=$('#submit');if(submitBtn)submitBtn.onclick=()=>save(t,s,g,'submitted')}}
async function openCreateGroup(t){
  try{
    const classId=norm(profile.classId),nis=String(profile.loginId),programId=String(t.programId||''),scope=programId||t.id;
    const groupQuery=programId
      ? db.collection('taskGroups').where('programId','==',programId).where('classId','==',classId)
      : db.collection('taskGroups').where('taskId','==',t.id).where('classId','==',classId);
    const [ss,gs]=await Promise.all([
      db.collection('students').where('classId','==',classId).get(), groupQuery.get()
    ]);
    const allStudents=ss.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.active!==false).map(x=>({nis:String(x.nis||x.id),name:String(x.name||x.nis||x.id)})).sort((a,b)=>a.name.localeCompare(b.name));
    const existing=gs.docs.map(d=>({id:d.id,...d.data()}));
    const myExisting=existing.find(g=>Array.isArray(g.memberNis)&&g.memberNis.map(String).includes(nis));
    if(myExisting){groups=groups.filter(x=>x.id!==myExisting.id).concat(myExisting);close();draw();return openTask(t.id)}
    const used=new Set(existing.flatMap(g=>(g.memberNis||[]).map(String)));
    const available=allStudents.filter(st=>st.nis===nis||!used.has(st.nis));
    const p=programs.find(x=>x.id===programId);
    modal(`<h2>Buat Kelompok Kokurikuler</h2><p><b>${esc(p?.name||t.title)}</b></p><div class="notice">Kelompok ini berlaku untuk <b>semua tugas kelompok dalam ${programId?'Tema/Program Kokurikuler yang sama':'tugas ini'}</b>. Pilih 2–${groupMaxMembers} siswa dari kelas ${esc(classId)}. Anda otomatis menjadi anggota.</div><div class="field"><label>Anggota Kelompok</label><div class="classes">${available.map(st=>`<label class="classcheck"><input type="checkbox" data-member="${esc(st.nis)}" data-name="${esc(st.name)}" ${st.nis===nis?'checked disabled':''}> ${esc(st.name)} <small>(${esc(st.nis)})</small></label>`).join('')}</div></div><div class="actions"><button id="createGroup" class="primary">Buat Kelompok</button></div>`);
    $('#createGroup').onclick=async()=>{
      const selected=[...document.querySelectorAll('[data-member]')].filter(x=>x.checked).map(x=>({nis:String(x.dataset.member),name:String(x.dataset.name)}));
      if(selected.length<2||selected.length>groupMaxMembers)return alert(`Kelompok harus terdiri dari 2 sampai ${groupMaxMembers} siswa.`);
      try{
        const fresh=await groupQuery.get(),current=fresh.docs.map(d=>({id:d.id,...d.data()}));
        const conflict=current.find(g=>(g.memberNis||[]).some(x=>selected.some(st=>st.nis===String(x))));
        if(conflict)return alert('Salah satu siswa yang dipilih sudah tergabung dalam kelompok untuk program ini. Muat ulang dan pilih anggota lain.');
        const usedNos=new Set(current.map(g=>Number(g.groupNo)||0)),groupNo=Array.from({length:99},(_,i)=>i+1).find(n=>!usedNos.has(n))||current.length+1;
        const ref=db.collection('taskGroups').doc(),groupKey=ref.id,now=new Date().toISOString();
        const data={programId,taskId:programId?'':t.id,sourceTaskId:t.id,classId,groupNo,groupKey,memberNis:selected.map(x=>x.nis),memberNames:selected.map(x=>x.name),createdByUid:user.uid,createdByNis:nis,createdByName:profile.name||'',createdAt:now,updatedAt:now};
        await ref.set(data);groups.push({id:ref.id,...data});close();draw();openTask(t.id);
      }catch(e){alert('Kelompok belum dapat dibuat: '+(e.message||e))}
    };
  }catch(e){modal(`<h2>Kelompok belum dapat dibuat</h2><div class="notice">${esc(e.message||e)}</div><p>Pastikan Rules terbaru sudah dipublikasikan.</p>`)}
}
async function save(t,s,g,status){const components=taskComponents(t),answers=[];for(let ci=0;ci<components.length;ci++){const c=components[ci];for(let ii=0;ii<Math.max(1,Number(c.count)||1);ii++){const key=answerKey(ci,ii),el=document.querySelector(`[data-answer="${key}"]`),v=(el?.value||'').trim(),desc=(document.querySelector(`[data-description="${key}"]`)?.value||'').trim(),label=`${c.label||'Jawaban'}${Number(c.count)>1?' '+(ii+1):''}`;if(status==='submitted'&&c.required&&!v)return alert(`${label} wajib diisi.`);if(status==='submitted'&&v&&c.requireDescription&&c.type!=='text'&&!desc)return alert(`Keterangan untuk ${label} wajib diisi.`);if(c.type!=='text'&&v){try{const u=new URL(v);if(!['http:','https:'].includes(u.protocol))throw new Error()}catch(_){return alert(`Link ${label} belum valid. Awali dengan https://`)}}answers.push({componentIndex:ci,itemIndex:ii,type:c.type,label,url:c.type==='text'?'':v,text:c.type==='text'?v:'',description:c.type==='text'?'':desc})}}const now=new Date().toISOString(),isGroup=t.taskType==='group';if(isGroup&&!g)return alert('Buat kelompok terlebih dahulu.');const docId=isGroup?`${t.id}_${g.groupKey}`:`${t.id}_${profile.loginId}`,ref=s?db.collection('taskSubmissions').doc(s.id):db.collection('taskSubmissions').doc(docId);const wasSubmitted=!!s&&['submitted','revision'].includes(String(s.status||''));const firstSubmittedAt=status==='submitted'?(s?.firstSubmittedAt||s?.submittedAt||now):(s?.firstSubmittedAt||null);const lastSubmittedAt=status==='submitted'?now:(s?.lastSubmittedAt||s?.submittedAt||null);const resubmissionCount=status==='submitted'?(wasSubmitted?Number(s?.resubmissionCount||0)+1:Number(s?.resubmissionCount||0)):Number(s?.resubmissionCount||0);const data={taskId:t.id,taskType:isGroup?'group':'individual',studentUid:user.uid,studentId:profile.studentId||'',nis:String(profile.loginId),studentName:profile.name||'',classId:norm(profile.classId),groupNo:isGroup?Number(g.groupNo):null,groupKey:isGroup?g.groupKey:'',memberNis:isGroup?(s?.memberNis||g.memberNis||[]):[],memberNames:isGroup?(s?.memberNames||g.memberNames||[]):[],answers,reflection:'',status,submittedAt:lastSubmittedAt,firstSubmittedAt,lastSubmittedAt,resubmissionCount,submittedByNis:status==='submitted'?String(profile.loginId):(s?.submittedByNis||''),submittedByName:status==='submitted'?(profile.name||'Siswa'):(s?.submittedByName||''),updatedAt:now,updatedByNis:String(profile.loginId)};try{await ref.set(data,{merge:!!s});const snap=await ref.get(),fresh={id:snap.id,...snap.data()};subs=subs.filter(x=>x.id!==fresh.id).concat(fresh);close();draw()}catch(e){alert('Gagal menyimpan tugas: '+(e.message||e))}}
function showError(msg,tip=''){ $('#loading').classList.add('hidden');$('#app').classList.add('hidden');$('#error').classList.remove('hidden');$('#error').innerHTML=`<h2>Tugas belum dapat dibuka</h2><p>${esc(msg)}</p>${tip?`<div class="notice">${esc(tip)}</div>`:''}<a class="primary btnlink" href="../">Kembali ke Beranda</a>` }
auth.onAuthStateChanged(async u=>{if(!u)return showError('Sesi siswa tidak ditemukan.','Silakan login dari halaman siswa.');user=u;try{profile=await resolveStudentProfile(u);$('#loading').classList.add('hidden');$('#error').classList.add('hidden');$('#app').classList.remove('hidden');$('#profileLabel').textContent=`${profile.name||'Siswa'} • Kelas ${profile.classId}`;$('#diagnostic').textContent=`NIS ${profile.loginId} • Kelas ${profile.classId}`;await load()}catch(e){showError(e.message,e.code==='permission-denied'?'Firestore Rules terbaru perlu dipublikasikan.':'Silakan kembali ke Beranda siswa dan login ulang.')}});

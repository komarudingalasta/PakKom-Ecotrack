const app=firebase.apps.length?firebase.app():firebase.initializeApp(window.PAKKOM_FIREBASE_CONFIG);
const auth=firebase.auth(),db=firebase.firestore();
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const normClass=v=>String(v||'').toUpperCase().replace(/KELAS/g,'').replace(/\s+/g,'').trim();
const normNis=v=>String(v??'').trim().replace(/\s+/g,'');
const DEFAULT_CUTS=[69,79,89];
let user=null,profile=null,tasks=[],programs=[],assessmentCuts=[...DEFAULT_CUTS];
function ranges(){const [a,b,c]=assessmentCuts;return[{min:0,max:a,label:'Perlu Bimbingan'},{min:a+1,max:b,label:'Berkembang'},{min:b+1,max:c,label:'Cakap'},{min:c+1,max:100,label:'Mahir'}]}
function scoreCategory(score){const n=Number(score);if(!Number.isFinite(n)||n<0||n>100)return '';return ranges().find(r=>n>=r.min&&n<=r.max)?.label||''}
function rangeText(){return ranges().map(r=>`${r.min}–${r.max} ${r.label}`).join(' • ')}
function modal(html){$('#modalBody').innerHTML=html;$('#modal').classList.remove('hidden')}
function close(){ $('#modal').classList.add('hidden'); $('#modalBody').innerHTML=''; }
$('#closeModal').onclick=close;
$('#logout').onclick=async()=>{await auth.signOut();location.href='../'};
async function loadAssessment(){try{const d=await db.collection('settings').doc('taskAssessment').get();const x=d.exists?d.data():{};const cuts=Array.isArray(x.cutoffs)?x.cutoffs.map(Number):DEFAULT_CUTS;if(cuts.length===3&&cuts.every(Number.isFinite)&&cuts[0]>=0&&cuts[0]<cuts[1]&&cuts[1]<cuts[2]&&cuts[2]<100)assessmentCuts=cuts;else assessmentCuts=[...DEFAULT_CUTS]}catch(_){assessmentCuts=[...DEFAULT_CUTS]}}
async function load(){await loadAssessment();const [snap,ps]=await Promise.all([db.collection('assignments').get(),db.collection('cocurricularPrograms').get()]);programs=ps.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.archived!==true);tasks=snap.docs.map(d=>({id:d.id,...d.data()})).filter(t=>t.archived!==true).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));draw()}
function programOf(t){return programs.find(p=>p.id===t.programId)}
function draw(){
  const admin=profile.role==='admin',wali=profile.role==='guru'&&profile.isHomeroom===true;
  let list=tasks;
  if(wali){const c=normClass(profile.homeroomClass||'');list=list.filter(t=>(t.targetClasses||[]).map(normClass).includes(c))}
  const grouped=new Map();
  list.forEach(t=>{const key=t.programId||'__none__';if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(t)});
  const sections=[...grouped.entries()].map(([pid,items])=>{const p=pid==='__none__'?null:programs.find(x=>x.id===pid);return `<section class="program-card"><div class="program-head"><div><small>${p?'PROGRAM KOKURIKULER':'TUGAS LAINNYA'}</small><h2>${esc(p?.name||'Tanpa Program')}</h2>${p?`<p>Tema: <b>${esc(p.theme||'-')}</b> • Topik: ${esc(p.topic||'-')}</p>`:''}</div><span class="count-pill">${items.length} tugas</span></div><div class="task-list">${items.map(t=>`<article class="task-row"><div class="task-main"><div class="tags"><span class="tag">${t.taskType==='group'?'Kelompok':'Individu'}</span><span class="tag ${t.published===false?'muted':''}">${t.published===false?'Draf':'Terbit'}</span></div><h3>${esc(t.title)}</h3><div class="meta">Kelas ${esc((t.targetClasses||[]).join(', '))} • Batas ${esc(t.dueDate||'Tanpa batas')}</div></div><div class="task-actions">${admin?`<button class="secondary" data-edit="${t.id}">Edit</button>`:''}${admin&&t.taskType==='group'?`<button class="secondary" data-groups="${t.id}">Kelompok</button>`:''}<button class="primary" data-review="${t.id}">Monitoring</button></div></article>`).join('')}</div></section>`}).join('');
  $('#view').innerHTML=`${admin?`<div class="toolbar"><button id="newProgram" class="secondary">+ Program Kokurikuler</button><button id="assessmentSettings" class="secondary">Atur Rentang Nilai</button><button id="activityLog" class="secondary">Riwayat Aktivitas</button></div>`:''}${sections||'<div class="card empty">Belum ada tugas.</div>'}`;
  if(admin){$('#assessmentSettings').onclick=openAssessmentSettings;$('#newProgram').onclick=openProgramBuilder;$('#activityLog').onclick=openActivityLog}
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openBuilder(tasks.find(t=>t.id===b.dataset.edit)));
  document.querySelectorAll('[data-groups]').forEach(b=>b.onclick=()=>manageGroups(tasks.find(t=>t.id===b.dataset.groups)));
  document.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>review(b.dataset.review));
}
function openProgramBuilder(){modal(`<h2>Program Kokurikuler</h2><form id="programForm"><div class="field"><label>Nama Program</label><input id="pname" required placeholder="Kokurikuler Semester 1"></div><div class="field"><label>Tema</label><input id="ptheme" required placeholder="Kesadaran tentang Sampah"></div><div class="field"><label>Topik</label><input id="ptopic" required placeholder="Aku Peduli Lingkungan"></div><div class="field"><label>Deskripsi</label><textarea id="pdesc"></textarea></div><div class="field"><label>Periode</label><input id="pperiod" placeholder="Agustus 2026"></div><div class="actions"><button class="primary">Simpan Program</button></div></form>`);$('#programForm').onsubmit=async e=>{e.preventDefault();try{await db.collection('cocurricularPrograms').add({name:$('#pname').value.trim(),theme:$('#ptheme').value.trim(),topic:$('#ptopic').value.trim(),description:$('#pdesc').value.trim(),period:$('#pperiod').value.trim(),active:true,archived:false,createdAt:new Date().toISOString(),createdByUid:user.uid});close();await load()}catch(err){alert('Gagal menyimpan program: '+err.message)}}}
function openAssessmentSettings(){const r=ranges();modal(`<h2>Atur Rentang Nilai</h2><p class="meta">Kategori tetap, Admin dapat mengubah batas rentangnya. Rentang harus berurutan dan mencakup 0–100 tanpa celah.</p><div class="tablewrap"><table class="table"><thead><tr><th>Kategori</th><th>Rentang</th></tr></thead><tbody>${r.map((x,i)=>`<tr><td><b>${x.label}</b></td><td>${i===0?`0 – <input id="cut1" type="number" min="0" max="97" value="${assessmentCuts[0]}" style="width:90px">`:i===1?`<span id="min2">${x.min}</span> – <input id="cut2" type="number" min="1" max="98" value="${assessmentCuts[1]}" style="width:90px">`:i===2?`<span id="min3">${x.min}</span> – <input id="cut3" type="number" min="2" max="99" value="${assessmentCuts[2]}" style="width:90px">`:`<span id="min4">${x.min}</span> – 100`}</td></tr>`).join('')}</tbody></table></div><div id="rangePreview" class="notice">${esc(rangeText())}</div><div class="actions"><button id="resetRanges" class="secondary">Kembalikan Default</button><button id="saveRanges" class="primary">Simpan Rentang</button></div>`);const refresh=()=>{const a=Number($('#cut1').value),b=Number($('#cut2').value),c=Number($('#cut3').value);$('#min2').textContent=Number.isFinite(a)?a+1:'-';$('#min3').textContent=Number.isFinite(b)?b+1:'-';$('#min4').textContent=Number.isFinite(c)?c+1:'-';const valid=[a,b,c].every(Number.isFinite)&&a>=0&&a<b&&b<c&&c<100;$('#rangePreview').textContent=valid?`0–${a} Perlu Bimbingan • ${a+1}–${b} Berkembang • ${b+1}–${c} Cakap • ${c+1}–100 Mahir`:'Rentang belum valid.';$('#saveRanges').disabled=!valid};['cut1','cut2','cut3'].forEach(id=>$('#'+id).oninput=refresh);$('#resetRanges').onclick=()=>{$('#cut1').value=69;$('#cut2').value=79;$('#cut3').value=89;refresh()};$('#saveRanges').onclick=async()=>{const cuts=[$('#cut1'),$('#cut2'),$('#cut3')].map(x=>Number(x.value));if(!(cuts[0]>=0&&cuts[0]<cuts[1]&&cuts[1]<cuts[2]&&cuts[2]<100))return alert('Rentang nilai belum valid.');try{await db.collection('settings').doc('taskAssessment').set({cutoffs:cuts,updatedAt:new Date().toISOString(),updatedByUid:user.uid},{merge:true});assessmentCuts=cuts;close();draw();alert('Rentang nilai berhasil disimpan.')}catch(e){alert('Gagal menyimpan rentang: '+e.message)}};refresh()}
function openBuilder(t={}){const cls=['7A','7B','7C','7D','7E','7F','7G','7H','7I','8A','8B','8C','8D','8E','8F','8G','8H','8I','9A','9B','9C','9D','9E','9F','9G','9H','9I'];let components=Array.isArray(t.components)&&t.components.length?t.components.map(x=>({...x})):[{type:t.answerType||'link',label:'Jawaban',required:true,count:1,requireDescription:(t.answerType||'link')==='link'}];modal(`<h2>${t.id?'Edit':'Buat'} Tugas</h2><form id="taskForm"><div class="field"><label>Program Kokurikuler</label><select id="programId"><option value="">Tanpa Program</option>${programs.map(p=>`<option value="${p.id}" ${t.programId===p.id?'selected':''}>${esc(p.name||'Kokurikuler')} — ${esc(p.theme||'')} / ${esc(p.topic||'')}</option>`).join('')}</select></div><div class="field"><label>Judul</label><input id="title" required value="${esc(t.title||'')}"></div><div class="field"><label>Petunjuk</label><textarea id="desc">${esc(t.description||'')}</textarea></div><div class="field"><label>Jenis</label><select id="type"><option value="individual">Individu</option><option value="group" ${t.taskType==='group'?'selected':''}>Kelompok</option></select><small>Untuk tugas kelompok, kelompok tidak dibuat otomatis. Siswa membentuk kelompok sendiri dari teman sekelas. Satu anggota cukup mengumpulkan untuk seluruh kelompok.</small></div><div class="field"><label>Kelas sasaran</label><div class="classes">${cls.map(c=>`<label class="classcheck"><input type="checkbox" data-cls="${c}" ${(t.targetClasses||[]).map(normClass).includes(c)?'checked':''}> ${c}</label>`).join('')}</div></div><div class="field"><label>Batas pengumpulan</label><input id="due" type="date" value="${esc(t.dueDate||'')}"></div><div class="field"><label>Komponen pengumpulan</label><div id="components"></div><button id="addComponent" class="secondary" type="button">+ Tambah Komponen</button><small>Foto, video, dan dokumen dikumpulkan sebagai link agar penyimpanan Firebase tetap ringan.</small></div><label><input id="published" type="checkbox" ${t.published!==false?'checked':''}> Terbitkan</label><div class="actions"><button class="primary" type="submit">Simpan Tugas</button></div></form>`);function renderComponents(){const box=$('#components');box.innerHTML=components.map((c,i)=>`<div class="card" style="margin:8px 0;padding:12px"><div class="field"><label>Jenis komponen</label><select data-ctype="${i}"><option value="text" ${c.type==='text'?'selected':''}>Jawaban Teks</option><option value="link" ${c.type==='link'?'selected':''}>Link</option><option value="photo" ${c.type==='photo'?'selected':''}>Foto</option><option value="video" ${c.type==='video'?'selected':''}>Video</option><option value="document" ${c.type==='document'?'selected':''}>Dokumen</option></select></div><div class="field"><label>Judul/label</label><input data-clabel="${i}" value="${esc(c.label)}"></div><div class="field"><label>Jumlah item</label><input data-ccount="${i}" type="number" min="1" max="10" value="${c.count}"></div><label><input data-crequired="${i}" type="checkbox" ${c.required?'checked':''}> Wajib</label>${['link','photo','video','document'].includes(c.type)?`<label><input data-cdesc="${i}" type="checkbox" ${c.requireDescription?'checked':''}> Keterangan wajib</label>`:''}<button type="button" class="secondary" data-remove-component="${i}">Hapus</button></div>`).join('');box.querySelectorAll('[data-ctype]').forEach(el=>el.onchange=()=>{components[+el.dataset.ctype].type=el.value;renderComponents()});box.querySelectorAll('[data-clabel]').forEach(el=>el.oninput=()=>components[+el.dataset.clabel].label=el.value);box.querySelectorAll('[data-ccount]').forEach(el=>el.oninput=()=>components[+el.dataset.ccount].count=Math.max(1,Math.min(10,Number(el.value)||1)));box.querySelectorAll('[data-crequired]').forEach(el=>el.onchange=()=>components[+el.dataset.crequired].required=el.checked);box.querySelectorAll('[data-cdesc]').forEach(el=>el.onchange=()=>components[+el.dataset.cdesc].requireDescription=el.checked);box.querySelectorAll('[data-remove-component]').forEach(el=>el.onclick=()=>{components.splice(+el.dataset.removeComponent,1);renderComponents()})}renderComponents();$('#addComponent').onclick=()=>{components.push({type:'photo',label:'Foto Dokumentasi',required:true,count:1,requireDescription:true});renderComponents()};$('#taskForm').onsubmit=async e=>{e.preventDefault();const targetClasses=[...document.querySelectorAll('[data-cls]:checked')].map(x=>normClass(x.dataset.cls));if(!targetClasses.length)return alert('Pilih minimal satu kelas.');if(!components.length)return alert('Tambahkan minimal satu komponen pengumpulan.');components=components.map(c=>({...c,label:String(c.label||'').trim()||({photo:'Foto',video:'Video',document:'Dokumen',text:'Jawaban Teks',link:'Link'}[c.type]||'Jawaban')}));const now=new Date().toISOString(),payload={programId:$('#programId').value||'',title:$('#title').value.trim(),description:$('#desc').value.trim(),taskType:$('#type').value,targetClasses,dueDate:$('#due').value,components,answerType:components.length===1&&['link','text'].includes(components[0].type)?components[0].type:'media',published:$('#published').checked,archived:false,updatedAt:now,updatedByUid:user.uid,createdAt:t.createdAt||now};try{let taskId=t.id;if(taskId)await db.collection('assignments').doc(taskId).set(payload,{merge:true});else{const ref=db.collection('assignments').doc();taskId=ref.id;await ref.set(payload)}if(payload.taskType!=='group'&&t.id&&t.taskType==='group'&&!t.programId){const old=await db.collection('taskGroups').where('taskId','==',taskId).get();const b=db.batch();old.docs.forEach(d=>b.delete(d.ref));await b.commit()}close();await load();if(payload.taskType==='group')alert('Tugas kelompok berhasil disimpan. Kelompok dibuat sendiri oleh siswa dan berlaku untuk semua tugas kelompok dalam Program Kokurikuler yang sama.')}catch(err){alert('Gagal menyimpan: '+err.message)}}}
async function review(id){
  const t=tasks.find(x=>x.id===id);
  try{
    const wali=profile.role==='guru'&&profile.isHomeroom===true,readOnly=profile.role==='guru'&&!wali;
    const allowedClasses=(wali?[profile.homeroomClass]:(t.targetClasses||[])).map(normClass).filter(Boolean);
    const normNis=v=>String(v??'').trim().replace(/\s+/g,'');
    const statusRank={graded:5,revision:4,submitted:3,draft:2,not_submitted:1};
    const pickLatest=(a,b)=>{
      if(!a)return b;if(!b)return a;
      const ta=String(a.updatedAt||a.submittedAt||''),tb=String(b.updatedAt||b.submittedAt||'');
      if(tb!==ta)return tb>ta?b:a;
      return (statusRank[b.status]||0)>(statusRank[a.status]||0)?b:a;
    };

    // Ambil semua submission tugas terlebih dahulu. Wali difilter berdasarkan kelas secara
    // client-side setelah normalisasi agar data lama seperti "9 F" tetap terbaca sebagai "9F".
    const s=await db.collection('taskSubmissions').where('taskId','==',id).get();
    const submissions=s.docs.map(d=>({id:d.id,...d.data()}))
      .filter(x=>allowedClasses.includes(normClass(x.classId)));

    // Ambil master siswa sekali saja dan cocokkan kelas setelah normalisasi. Ini menghindari
    // data siswa lama yang format classId-nya tidak persis sama dengan data tugas.
    const ss=await db.collection('students').get();
    const studentDocs=ss.docs.map(d=>({sid:d.id,...d.data()}))
      .map(st=>({...st,classId:normClass(st.classId)}))
      .filter(st=>st.active!==false&&allowedClasses.includes(st.classId));

    let rows=[],ungrouped=[],orphanCount=0;
    if(t.taskType==='group'){
      let gq=t.programId?db.collection('taskGroups').where('programId','==',t.programId):db.collection('taskGroups').where('taskId','==',id);
      const gs=await gq.get();
      const allGroups=gs.docs.map(d=>({id:d.id,...d.data()}))
        .filter(g=>allowedClasses.includes(normClass(g.classId)))
        .map(g=>({...g,classId:normClass(g.classId)}));

      const subByGroup=new Map();
      submissions.forEach(x=>{
        const k=String(x.groupKey||'').trim();
        if(k)subByGroup.set(k,pickLatest(subByGroup.get(k),x));
      });
      const matchedIds=new Set();
      rows=allGroups.map(g=>{
        const found=subByGroup.get(String(g.groupKey||g.id||'').trim());
        if(found){matchedIds.add(found.id);return {...g,...found,classId:normClass(found.classId||g.classId),memberNis:found.memberNis||g.memberNis||[],memberNames:found.memberNames||g.memberNames||[]};}
        return {...g,id:'',status:'not_submitted',score:null,feedback:''};
      });

      // Submission yang benar-benar ada di Firestore tidak boleh hilang hanya karena dokumen
      // taskGroups lama/bermasalah. Tampilkan sebagai baris pemulihan agar Admin/Wali tetap bisa menilai.
      submissions.filter(x=>!matchedIds.has(x.id)).forEach(x=>{
        rows.push({...x,_unmapped:true,classId:normClass(x.classId)});
        orphanCount++;
      });

      // Anggota dianggap sudah berkelompok bila ditemukan di taskGroups ATAU di submission kelompok.
      const used=new Set();
      allGroups.forEach(g=>(g.memberNis||[]).forEach(n=>used.add(normNis(n))));
      submissions.forEach(x=>(x.memberNis||[]).forEach(n=>used.add(normNis(n))));
      studentDocs.filter(st=>!used.has(normNis(st.nis||st.sid))).forEach(st=>ungrouped.push({nis:normNis(st.nis||st.sid),name:st.name||st.nis||st.sid,classId:st.classId}));
    }else{
      const byNis=new Map();
      submissions.forEach(x=>{
        // Dukungan dokumen lama: coba NIS utama, submittedByNis, lalu studentId.
        [x.nis,x.submittedByNis,x.studentId].map(normNis).filter(Boolean).forEach(k=>byNis.set(k,pickLatest(byNis.get(k),x)));
      });
      const matchedIds=new Set();
      rows=studentDocs.map(st=>{
        const keys=[st.nis,st.sid,st.studentId].map(normNis).filter(Boolean);
        const found=keys.map(k=>byNis.get(k)).find(Boolean);
        if(found){matchedIds.add(found.id);return {...found,studentName:found.studentName||st.name||st.nis||st.sid,classId:normClass(found.classId||st.classId)};}
        return {id:'',nis:normNis(st.nis||st.sid),studentName:st.name||st.nis||st.sid,classId:st.classId,status:'not_submitted',score:null};
      });

      // Jangan sembunyikan submission hanya karena NIS/master siswa tidak berhasil dipasangkan.
      submissions.filter(x=>!matchedIds.has(x.id)).forEach(x=>{
        rows.push({...x,_unmapped:true,classId:normClass(x.classId),studentName:x.studentName||x.submittedByName||x.nis||'Data submission'});
        orphanCount++;
      });
    }

    const counts={
      done:rows.filter(r=>r.id&&['submitted','graded','revision'].includes(r.status)).length,
      missing:rows.filter(r=>!r.id||r.status==='draft').length,
      revision:rows.filter(r=>r.status==='revision').length,
      graded:rows.filter(r=>r.status==='graded').length
    };
    if(t.taskType==='group')counts.missing+=ungrouped.length;
    const recovery=orphanCount?`<div class="notice"><b>${orphanCount} pengumpulan ditemukan dari data aktual Firestore</b><br><small>Data ini belum dapat dipasangkan sempurna dengan master ${t.taskType==='group'?'kelompok':'siswa'}, tetapi tetap ditampilkan agar tidak hilang dari monitoring.</small></div>`:'';
    modal(`<h2>Monitoring • ${esc(t.title)}</h2><div class="notice"><b>${counts.done} sudah mengumpulkan • ${counts.missing} belum • ${counts.revision} perbaikan • ${counts.graded} dinilai</b><br><small>Rentang Nilai: ${esc(rangeText())}</small></div>${recovery}${t.taskType==='group'&&ungrouped.length?`<div class="notice"><b>${ungrouped.length} siswa belum membentuk kelompok</b><br><small>${esc(ungrouped.map(x=>`${x.name} (${x.classId})`).join(', '))}</small></div>`:''}<div class="tablewrap"><table class="table"><thead><tr><th>${t.taskType==='group'?'Kelompok':'Siswa'}</th><th>Kelas</th><th>Status</th><th>Nilai</th><th>Kategori</th><th></th></tr></thead><tbody>${rows.sort((a,b)=>String(a.classId||'').localeCompare(String(b.classId||''))||Number(a.groupNo||0)-Number(b.groupNo||0)||String(a.studentName||'').localeCompare(String(b.studentName||''))).map(r=>{const st=r.status||'not_submitted',label=st==='revision'?'Belum Diperbaiki':st==='submitted'?'Sudah Mengumpulkan':st==='graded'?'Sudah Dinilai':st==='draft'?'Draf':'Belum Mengumpulkan';let action='<span class="tag">Monitoring</span>';if(!readOnly){action=!r.id?'<span class="tag">Belum masuk</span>':st==='revision'?'<span class="tag">Menunggu siswa</span>':`<button class="secondary" data-grade="${r.id}">${st==='graded'?'Lihat':'Periksa'}</button>`}const recoveryTag=r._unmapped?'<small style="display:block">Data aktual pengumpulan</small>':'';return `<tr><td>${t.taskType==='group'?`<b>Kelompok ${esc(r.groupNo||'-')}</b><small style="display:block">${esc((r.memberNames||[]).join(', '))}</small>${recoveryTag}`:`${esc(r.studentName||r.nis)}${recoveryTag}`}</td><td>${esc(r.classId)}</td><td>${esc(label)}</td><td>${esc(r.score??'-')}</td><td>${esc(scoreCategory(r.score)||'-')}</td><td>${action}</td></tr>`}).join('')||'<tr><td colspan="6">Belum ada kelompok/pengumpulan.</td></tr>'}</tbody></table></div>`);
    if(!readOnly)document.querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>grade(b.dataset.grade,t));
  }catch(err){modal(`<h2>Monitoring belum dapat dimuat</h2><p>${esc(err.message)}</p><div class="notice">Firestore Rules v9.7.6 perlu dipublikasikan karena pengumpulan siswa sekarang dapat diperbaiki sampai dinilai.</div>`)}
}
async function grade(id,t){const d=await db.collection('taskSubmissions').doc(id).get(),s={id:d.id,...d.data()};modal(`<h2>Periksa • ${esc(t.title)}</h2><p><b>${esc(t.taskType==='group'?`Kelompok ${s.groupNo}`:(s.studentName||s.nis))}</b> • ${esc(s.classId)}</p>${t.taskType==='group'?`<div class="notice"><b>Anggota:</b> ${esc((s.memberNames||[]).join(', '))}<br><small>Dikumpulkan oleh ${esc(s.submittedByName||'-')}</small></div>`:''}${(s.answers||[]).map(a=>`<div class="answer"><b>${esc(a.label||'Jawaban')}</b>${a.url?`<div><a href="${esc(a.url)}" target="_blank" rel="noopener">${a.type==='photo'?'Buka Foto':a.type==='video'?'Tonton Video':a.type==='document'?'Buka Dokumen':'Buka Link'} ↗</a></div>`:''}${a.text?`<p>${esc(a.text)}</p>`:''}${a.description?`<p><small>Keterangan:</small> ${esc(a.description)}</p>`:''}</div>`).join('')}<div class="notice"><b>Kategori Nilai</b><br>${esc(rangeText())}</div><div class="field"><label>Nilai 0–100</label><input id="score" type="number" min="0" max="100" value="${esc(s.score??'')}"><div id="scoreCategory" class="notice" style="margin-top:8px">${s.score!==null&&s.score!==undefined&&s.score!==''?`Kategori: <b>${esc(scoreCategory(s.score))}</b>`:'Masukkan nilai untuk melihat kategori.'}</div></div><div class="field"><label>Catatan</label><textarea id="feedback">${esc(s.feedback||'')}</textarea></div><div class="actions"><button id="revision" class="secondary">Perlu Perbaikan</button><button id="saveGrade" class="primary">Simpan Nilai</button></div>`);const scoreEl=$('#score'),catEl=$('#scoreCategory');scoreEl.oninput=()=>{const raw=scoreEl.value,n=Number(raw);catEl.innerHTML=raw!==''&&Number.isFinite(n)&&n>=0&&n<=100?`Kategori: <b>${esc(scoreCategory(n))}</b>`:'Masukkan nilai 0–100 untuk melihat kategori.'};$('#revision').onclick=()=>saveGrade(id,'revision');$('#saveGrade').onclick=()=>saveGrade(id,'graded')}
async function saveGrade(id,status){const feedback=$('#feedback')?.value.trim()||'',scoreRaw=$('#score')?.value??'',score=status==='graded'?Number(scoreRaw):null;if(status==='graded'&&(scoreRaw===''||!Number.isFinite(score)||score<0||score>100))return alert('Nilai wajib 0–100.');try{await db.collection('taskSubmissions').doc(id).set({score,feedback,status,gradedAt:status==='graded'?new Date().toISOString():null,gradedByUid:user.uid,gradedByName:profile.name||'',updatedAt:new Date().toISOString()},{merge:true});close();await load();alert(status==='graded'?'Nilai berhasil disimpan.':'Tugas dikembalikan untuk diperbaiki.')}catch(e){alert('Gagal menyimpan: '+e.message)}}

async function logTaskActivity(action,data={}){try{await db.collection('taskActivity').add({action,...data,actorUid:user.uid,actorName:profile.name||'',actorRole:profile.role,createdAt:new Date().toISOString()})}catch(e){console.warn('activity log',e)}}
async function openActivityLog(){try{const q=await db.collection('taskActivity').orderBy('createdAt','desc').limit(100).get();const rows=q.docs.map(d=>d.data());modal(`<h2>Riwayat Aktivitas Tugas</h2><p class="meta">100 aktivitas terbaru untuk membantu penelusuran perubahan tugas dan kelompok.</p><div class="activity-list">${rows.map(x=>`<div class="activity-item"><b>${esc(x.actorName||'Sistem')}</b> • ${esc(x.action||'-')}<small>${esc(x.detail||'')} ${x.classId?'• Kelas '+esc(x.classId):''}<br>${esc(String(x.createdAt||'').replace('T',' ').slice(0,16))}</small></div>`).join('')||'<div class="empty">Belum ada aktivitas.</div>'}</div>`)}catch(e){alert('Riwayat belum dapat dimuat: '+e.message)}}
async function manageGroups(t){
  if(profile.role!=='admin')return;
  try{
    const classes=(t.targetClasses||[]).map(normClass);
    const [ss,gs]=await Promise.all([db.collection('students').get(),t.programId?db.collection('taskGroups').where('programId','==',t.programId).get():db.collection('taskGroups').where('taskId','==',t.id).get()]);
    const students=ss.docs.map(d=>({id:d.id,...d.data(),classId:normClass(d.data().classId)})).filter(x=>x.active!==false&&classes.includes(x.classId));
    const groups=gs.docs.map(d=>({id:d.id,...d.data(),classId:normClass(d.data().classId)})).filter(g=>classes.includes(g.classId));
    const used=new Set(groups.flatMap(g=>(g.memberNis||[]).map(normNis)));
    const ungrouped=students.filter(st=>!used.has(normNis(st.nis||st.id)));
    modal(`<h2>Kelola Kelompok • ${esc(t.title)}</h2><div class="notice"><b>${groups.length} kelompok • ${ungrouped.length} siswa belum berkelompok</b><br><small>Perubahan anggota berlaku untuk tugas berikutnya. Pengumpulan lama tetap menyimpan daftar anggota saat dikirim.</small></div><div class="group-list">${groups.sort((a,b)=>a.classId.localeCompare(b.classId)||Number(a.groupNo)-Number(b.groupNo)).map(g=>`<div class="group-card"><div><b>${esc(g.classId)} • Kelompok ${esc(g.groupNo||'-')}</b><small>${esc((g.memberNames||[]).join(', '))}</small></div><button class="secondary" data-editgroup="${g.id}">Kelola Anggota</button></div>`).join('')||'<div class="empty">Belum ada kelompok.</div>'}</div>${ungrouped.length?`<div class="notice"><b>Belum Berkelompok</b><br><small>${esc(ungrouped.map(x=>`${x.name||x.nis} (${x.classId})`).join(', '))}</small></div>`:''}`);
    document.querySelectorAll('[data-editgroup]').forEach(b=>b.onclick=()=>editGroupMembers(t,groups.find(g=>g.id===b.dataset.editgroup),students,groups));
  }catch(e){alert('Kelompok belum dapat dimuat: '+e.message)}
}
async function editGroupMembers(t,g,students,groups){
  const sameClass=students.filter(x=>x.classId===g.classId),current=new Set((g.memberNis||[]).map(normNis));
  const occupied=new Set(groups.filter(x=>x.id!==g.id).flatMap(x=>(x.memberNis||[]).map(normNis)));
  modal(`<h2>${esc(g.classId)} • Kelompok ${esc(g.groupNo||'-')}</h2><p class="meta">Pilih 2–6 siswa. Siswa yang sudah berada di kelompok lain tidak dapat dipilih.</p><div class="member-picker">${sameClass.map(st=>{const nis=normNis(st.nis||st.id),disabled=occupied.has(nis);return `<label class="member-option ${disabled?'disabled':''}"><input type="checkbox" data-member="${esc(nis)}" ${current.has(nis)?'checked':''} ${disabled?'disabled':''}><span><b>${esc(st.name||nis)}</b><small>${esc(nis)}</small></span></label>`}).join('')}</div><div class="actions"><button id="saveMembers" class="primary">Simpan Anggota</button></div>`);
  $('#saveMembers').onclick=async()=>{const selected=[...document.querySelectorAll('[data-member]:checked')].map(x=>normNis(x.dataset.member));if(selected.length<2||selected.length>6)return alert('Anggota kelompok harus 2–6 siswa.');const chosen=sameClass.filter(st=>selected.includes(normNis(st.nis||st.id)));const before=(g.memberNames||[]).join(', '),after=chosen.map(x=>x.name||x.nis).join(', ');try{await db.collection('taskGroups').doc(g.id).set({memberNis:selected,memberNames:chosen.map(x=>x.name||x.nis||x.id),updatedAt:new Date().toISOString(),updatedByUid:user.uid,updatedByName:profile.name||''},{merge:true});await logTaskActivity('Anggota kelompok diubah',{taskId:t.id,programId:t.programId||'',groupKey:g.groupKey||g.id,classId:g.classId,detail:`Kelompok ${g.groupNo}: ${before} → ${after}`});close();alert('Anggota kelompok berhasil diperbarui. Submission yang sudah ada tidak diubah.');}catch(e){alert('Gagal mengubah anggota: '+e.message)}}
}
function showErr(msg){$('#loading').classList.add('hidden');$('#app').classList.add('hidden');$('#error').classList.remove('hidden');$('#error').innerHTML=`<h2>Tugas belum dapat dibuka</h2><p>${esc(msg)}</p><p><a href="../">Kembali ke EcoTrack</a></p>`}
$('#newTask').onclick=()=>openBuilder();
auth.onAuthStateChanged(async u=>{if(!u)return showErr('Sesi Admin/Guru tidak ditemukan. Silakan login dari EcoTrack terlebih dahulu.');user=u;try{const d=await db.collection('users').doc(u.uid).get();if(!d.exists)throw new Error('Profil akun tidak ditemukan.');profile=d.data();if(profile.active!==true)throw new Error('Akun tidak aktif.');if(profile.role!=='admin'&&!(profile.role==='guru'&&profile.isHomeroom===true))throw new Error('Menu Tugas hanya tersedia untuk Admin dan Wali Kelas.');profile.homeroomClass=normClass(profile.homeroomClass||'');$('#loading').classList.add('hidden');$('#error').classList.add('hidden');$('#app').classList.remove('hidden');$('#roleLabel').textContent=profile.role==='admin'?'ADMIN':'WALI KELAS';$('#profileLabel').textContent=profile.name+(profile.homeroomClass?' • '+profile.homeroomClass:'');$('#taskVersion').textContent=profile.role==='admin'?'Tugas Siswa • v9.7.7':'Tugas Siswa';if(profile.role==='admin')$('#newTask').classList.remove('hidden');await load()}catch(e){showErr(e.message)}});

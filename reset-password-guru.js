// Jalankan hanya di komputer admin. Jangan unggah serviceAccountKey.json ke hosting/repository.
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const keyPath = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(keyPath)) { console.error('File serviceAccountKey.json belum tersedia.'); process.exit(1); }
admin.initializeApp({credential:admin.credential.cert(require(keyPath))});
const db=admin.firestore();
(async()=>{
 const nip=process.argv[2];
 if(!nip){console.error('Cara pakai: node reset-password-guru.js NIP_GURU');process.exitCode=1;return;}
 const snap=await db.collection('users').where('loginId','==',nip).get();
 const matches=snap.docs.filter(d=>d.data().role==='guru');
 if(matches.length!==1){throw new Error('Harus tepat satu akun guru dengan NIP tersebut; ditemukan '+matches.length);}
 const doc=matches[0];const user=await admin.auth().getUser(doc.id);
 if(!user || user.disabled)throw new Error('Akun Authentication tidak ditemukan atau dinonaktifkan');
 await admin.auth().updateUser(doc.id,{password:'123456'});
 console.log('Password sementara berhasil direset untuk NIP '+nip+'. Minta guru segera mengganti password.');
})().catch(e=>{console.error('Reset gagal:',e.message);process.exitCode=1;});

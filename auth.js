import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const cfg = window.PAKKOM_FIREBASE_CONFIG || {};
const configured = !!(cfg.apiKey && cfg.projectId);
const ADMIN_EMAIL = 'komarudingalasta@gmail.com';

const $ = s => document.querySelector(s);
const loginView = $('#loginView');
const appView = $('#appView');
const form = $('#loginForm');
const loginBtn = $('#loginBtn');
const loginError = $('#loginError');

function loginEmail(id){
  const normalized = String(id || '').trim().toUpperCase();
  if(normalized === 'ADMIN') return ADMIN_EMAIL;
  return `${normalized.toLowerCase().replace(/[^a-z0-9._-]/g,'')}@pakkom-ecotrack.app`;
}

function showError(message=''){
  if(!loginError) return;
  loginError.textContent = message;
  loginError.classList.toggle('hidden', !message);
}

function authMessage(e){
  const code=e?.code||'';
  const map={
    'auth/invalid-credential':'ID atau password salah.',
    'auth/wrong-password':'Password salah.',
    'auth/user-not-found':'Akun tidak ditemukan.',
    'auth/user-disabled':'Akun dinonaktifkan.',
    'auth/operation-not-allowed':'Login Email/Password belum diaktifkan di Firebase.',
    'auth/network-request-failed':'Koneksi ke Firebase gagal. Periksa internet.',
    'auth/too-many-requests':'Terlalu banyak percobaan login. Coba lagi beberapa saat.'
  };
  return map[code] || e?.message || 'Login gagal.';
}

async function readProfile(db, uid){
  const timeout = new Promise((_,reject)=>
    setTimeout(()=>reject(new Error('Profil pengguna terlalu lama dimuat.')),5000)
  );
  const snap = await Promise.race([getDoc(doc(db,'users',uid)), timeout]);
  if(!snap.exists()) throw new Error(`Profil users/${uid} tidak ditemukan.`);
  const profile={uid,...snap.data()};
  if(profile.rejected === true) throw new Error('Pendaftaran akun tidak disetujui Admin.');
  if(profile.approved === false && profile.role === 'guru') throw new Error('Akun masih menunggu persetujuan Admin.');
  if(profile.active === false) throw new Error('Akun dinonaktifkan administrator.');
  if(!['admin','guru'].includes(profile.role)) throw new Error('Role akun tidak dikenali.');
  return profile;
}

let app, auth, db;

if(!configured){
  showError('Firebase belum dikonfigurasi.');
  if(loginBtn){ loginBtn.disabled=true; loginBtn.textContent='FIREBASE BELUM AKTIF'; }
} else {
  try{
    app = initializeApp(cfg);
    auth = getAuth(app);
    db = getFirestore(app);
  }catch(e){
    console.error('Firebase init',e);
    showError('Firebase gagal dimulai. Periksa firebase-config.js.');
    if(loginBtn) loginBtn.disabled=true;
  }
}

window.PAKKOM_AUTH_CORE = {
  get app(){ return app; },
  get auth(){ return auth; },
  get db(){ return db; },
  user:null,
  profile:null,
  async logout(){
    this.user=null;
    this.profile=null;
    await signOut(auth).catch(()=>{});
    location.reload();
  }
};

form?.addEventListener('submit', async e=>{
  e.preventDefault();
  if(!auth || !db) return;

  const id=$('#loginId')?.value.trim() || '';
  const password=$('#loginPassword')?.value || '';
  if(!id || !password){
    showError('ID dan password wajib diisi.');
    return;
  }

  showError('');
  loginBtn.disabled=true;
  loginBtn.textContent='MEMERIKSA...';

  try{
    if(auth.currentUser) await signOut(auth).catch(()=>{});
    const email=loginEmail(id);
    const credential=await signInWithEmailAndPassword(auth,email,password);

    if(id.toUpperCase()==='ADMIN' &&
       credential.user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()){
      throw new Error('Akun ADMIN tidak sesuai konfigurasi.');
    }

    const profile=await readProfile(db, credential.user.uid);

    window.PAKKOM_AUTH_CORE.user=credential.user;
    window.PAKKOM_AUTH_CORE.profile=profile;

    // Authentication sudah selesai. Baru muat aplikasi utama.
    loginView?.classList.add('hidden');
    appView?.classList.remove('hidden');

    const mod=await import('./app.js?v=3.2');
    if(typeof mod.startPakKomApp === 'function'){
      await mod.startPakKomApp(window.PAKKOM_AUTH_CORE);
    }
  }catch(e){
    console.error('Login',e);
    await signOut(auth).catch(()=>{});
    window.PAKKOM_AUTH_CORE.user=null;
    window.PAKKOM_AUTH_CORE.profile=null;
    loginView?.classList.remove('hidden');
    appView?.classList.add('hidden');
    showError(authMessage(e));
  }finally{
    loginBtn.disabled=false;
    loginBtn.textContent='MASUK';
  }
});

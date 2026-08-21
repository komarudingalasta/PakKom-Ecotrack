
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
      'auth/invalid-credential':'ID atau password salah.',
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

            // Baru sesudah login valid, muat aplikasi utama.
            var script=document.createElement('script');
            script.src='app-core.js?v=3.3';
            script.onload=function(){
              if(window.startPakKomApp){ window.startPakKomApp(window.PAKKOM_COMPAT_CORE); }
            };
            script.onerror=function(){
              console.error('app.js gagal dimuat');
              var content=qs('#content');
              if(content) content.innerHTML='<div class="card"><h3>Login berhasil</h3><p>Aplikasi utama gagal dimuat. Silakan refresh atau hubungi Admin.</p></div>';
            };
            document.body.appendChild(script);
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

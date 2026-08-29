const {onRequest} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

exports.adminResetTeacherPassword = onRequest(
  {region:"us-central1", cors:true},
  async (req,res) => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ok:false,error:"Method not allowed"});
      }

      const authHeader = req.headers.authorization || "";
      if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ok:false,error:"Unauthorized"});
      }

      const idToken = authHeader.substring(7);
      const decoded = await admin.auth().verifyIdToken(idToken);

      const adminSnap = await admin.firestore().doc(`users/${decoded.uid}`).get();
      const profile = adminSnap.exists ? adminSnap.data() : null;
      if (!profile || profile.role !== "admin" || profile.active !== true) {
        return res.status(403).json({ok:false,error:"Admin access required"});
      }

      const {uid,newPassword} = req.body || {};
      if (!uid || typeof newPassword !== "string" || newPassword.length < 6) {
        return res.status(400).json({ok:false,error:"UID/password tidak valid"});
      }

      const targetSnap = await admin.firestore().doc(`users/${uid}`).get();
      const target = targetSnap.exists ? targetSnap.data() : null;
      if (!target || target.role !== "guru") {
        return res.status(400).json({ok:false,error:"Akun guru/wali kelas tidak ditemukan"});
      }

      await admin.auth().updateUser(uid,{password:newPassword});
      return res.json({ok:true});
    } catch (err) {
      console.error(err);
      return res.status(500).json({ok:false,error:err.message || "Reset password gagal"});
    }
  }
);

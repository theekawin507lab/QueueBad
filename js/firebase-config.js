/* =============================================
   firebase-config.js — การตั้งค่าและการเชื่อมต่อ Firebase
   (Firebase v10 Compat Mode สำหรับ Vanilla HTML/JS)
   ============================================= */

const firebaseConfig = {
    apiKey: "AIzaSyCbygskhcG8tCnL8qFnQHKrHjdA11e-WVo",
    authDomain: "queuebad-c598e.firebaseapp.com",
    projectId: "queuebad-c598e",
    storageBucket: "queuebad-c598e.firebasestorage.app",
    messagingSenderId: "496380359567",
    appId: "1:496380359567:web:6accfc313341b7d5b011fa",
    measurementId: "G-DTTW3DDGRV"
};

// ตรวจสอบว่ามี Firebase SDK โหลดมาแล้วหรือไม่
let db = null;
let auth = null;

try {
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();
        auth = firebase.auth();
        console.log("🔥 Firebase เชื่อมต่อสำเร็จ (QueueBad)");
    } else {
        console.warn("⚠️ ไม่พบ Firebase SDK โปรดโหลด Firebase CDN scripts ก่อนไฟล์นี้");
    }
} catch (error) {
    console.error("❌ เกิดข้อผิดพลาดในการเชื่อมต่อ Firebase:", error);
}

/* =============================================
   login.js — JavaScript สำหรับหน้า Login
   รองรับทั้ง Admin (hardcoded fallback / firebase) และ Player (Firebase Auth)
   ============================================= */

// ฟังก์ชันไปหน้า Public
function goToPublic() {
    window.location.href = 'public.html';
}

// ระบบตรวจสอบ Login
document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const userInput = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    const errorBox = document.getElementById('errorMessage');
    const loginBtn = document.getElementById('loginBtn');

    errorBox.classList.add('hidden');
    errorBox.textContent = '';

    // 1. ตรวจสอบรหัสผ่าน Admin โต๊ะกลาง
    if (userInput.toLowerCase() === 'admin' && (pass === 'Upbaminton12345!' || pass === 'Upbadminton12345!')) {
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('adminName', 'Admin');
        window.location.href = 'index.html';
        return;
    }

    // 2. ถ้ากรอกเป็น Email ให้ตรวจสอบผ่าน Firebase Authentication
    if (auth && db) {
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span>กำลังตรวจสอบ...</span>';

        try {
            const userCredential = await auth.signInWithEmailAndPassword(userInput, pass);
            const user = userCredential.user;

            // ดึงข้อมูล Role และ Profile จาก Firestore
            const userDoc = await db.collection('users').doc(user.uid).get();

            if (userDoc.exists) {
                const userData = userDoc.data();

                if (userData.role === 'admin') {
                    sessionStorage.setItem('isLoggedIn', 'true');
                    sessionStorage.setItem('adminName', userData.nickname || 'Admin');
                    sessionStorage.setItem('adminUid', user.uid);
                    window.location.href = 'index.html';
                } else {
                    // ผู้เล่นทั่วไป (Player)
                    sessionStorage.setItem('isPlayerLoggedIn', 'true');
                    sessionStorage.setItem('playerUid', user.uid);
                    sessionStorage.setItem('playerNickname', userData.nickname || user.displayName || 'ผู้เล่น');
                    sessionStorage.setItem('playerData', JSON.stringify(userData));

                    // อัปเดตสถานะว่ามาแล้ว
                    try {
                        await db.collection('players').doc(user.uid).set({
                            uid: user.uid,
                            name: userData.nickname,
                            fullName: `${userData.firstName} ${userData.lastName}`,
                            isPresent: true,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                    } catch (pErr) {
                        console.warn('Cannot update presence:', pErr);
                    }

                    window.location.href = 'public.html';
                }
            } else {
                // บัญชีมีใน Auth แต่ไม่มีใน doc users ให้เข้าแบบผู้เล่นทั่วไป
                sessionStorage.setItem('isPlayerLoggedIn', 'true');
                sessionStorage.setItem('playerUid', user.uid);
                sessionStorage.setItem('playerNickname', user.displayName || user.email.split('@')[0]);
                window.location.href = 'public.html';
            }

        } catch (err) {
            console.error('Firebase Auth Error:', err);
            errorBox.classList.remove('hidden');
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                errorBox.textContent = 'อีเมล หรือ รหัสผ่าน ไม่ถูกต้อง!';
            } else if (err.code === 'auth/invalid-email') {
                errorBox.textContent = 'รูปแบบอีเมลไม่ถูกต้อง กรุณากรอกเป็น example@email.com';
            } else {
                errorBox.textContent = 'เข้าสู่ระบบไม่สำเร็จ: ' + err.message;
            }
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<span>เข้าสู่ระบบ</span>';
        }
    } else {
        // กรณีไม่มีเน็ต หรือ Firebase ไม่พร้อม
        errorBox.classList.remove('hidden');
        errorBox.textContent = 'ชื่อผู้ใช้งาน หรือ รหัสผ่าน ไม่ถูกต้อง!';
    }
});

// โหลด Theme ตอนเปิดหน้า
window.onload = initTheme;

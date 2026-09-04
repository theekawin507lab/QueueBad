/* =============================================
   login.js — JavaScript สำหรับหน้า Login
   รองรับทั้ง Admin (hardcoded fallback / firebase) และ Player (Firebase Auth & Google Sign-In)
   พร้อมระบบ Persistent Login (จดจำผู้ใช้เมื่อรีเฟรชหน้าต่าง)
   ============================================= */

// ฟังก์ชันไปหน้า Public
function goToPublic() {
    window.location.href = 'public.html';
}

// ฟังก์ชันบันทึกเซสชันลง Storage (รองรับทั้ง localStorage และ sessionStorage)
function saveSession(key, value, remember = true) {
    if (remember) {
        localStorage.setItem(key, value);
    }
    sessionStorage.setItem(key, value);
}

// ฟังก์ชันนำทางและบันทึกสิทธิ์ตาม Role ของผู้ใช้งาน
async function handleUserSessionRouting(user, remember = true) {
    if (!db) {
        saveSession('isPlayerLoggedIn', 'true', remember);
        saveSession('playerUid', user.uid, remember);
        saveSession('playerNickname', user.displayName || (user.email ? user.email.split('@')[0] : 'ผู้เล่น'), remember);
        window.location.replace('public.html');
        return;
    }

    try {
        const userDoc = await db.collection('users').doc(user.uid).get();

        if (userDoc.exists) {
            const userData = userDoc.data();

            if (userData.role === 'admin') {
                saveSession('isLoggedIn', 'true', remember);
                saveSession('adminName', userData.nickname || 'Admin', remember);
                saveSession('adminUid', user.uid, remember);
                window.location.replace('index.html');
                return;
            } else {
                // ผู้เล่นทั่วไป (Player)
                const nickname = userData.nickname || user.displayName || 'ผู้เล่น';
                saveSession('isPlayerLoggedIn', 'true', remember);
                saveSession('playerUid', user.uid, remember);
                saveSession('playerNickname', nickname, remember);
                saveSession('playerData', JSON.stringify(userData), remember);

                // อัปเดตสถานะว่ามาสนามแล้วในคอลเลกชัน players
                try {
                    await db.collection('players').doc(user.uid).set({
                        uid: user.uid,
                        name: nickname,
                        fullName: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
                        isPresent: true,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                } catch (pErr) {
                    console.warn('Cannot update presence:', pErr);
                }

                window.location.replace('public.html');
                return;
            }
        } else {
            // บัญชีมีใน Auth แต่ไม่มีใน doc users (เช่น Login ด้วย Google ครั้งแรก)
            const fallbackNickname = user.displayName ? user.displayName.split(' ')[0] : (user.email ? user.email.split('@')[0] : 'ผู้เล่น');
            const defaultUserData = {
                uid: user.uid,
                email: user.email || '',
                nickname: fallbackNickname,
                firstName: user.displayName || fallbackNickname,
                lastName: '',
                role: 'player',
                provider: user.providerData && user.providerData[0] ? user.providerData[0].providerId : 'google.com',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                await db.collection('users').doc(user.uid).set(defaultUserData, { merge: true });
                await db.collection('players').doc(user.uid).set({
                    uid: user.uid,
                    name: fallbackNickname,
                    fullName: defaultUserData.firstName,
                    isPresent: true,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            } catch (pErr) {
                console.warn('Cannot create user profile doc:', pErr);
            }

            saveSession('isPlayerLoggedIn', 'true', remember);
            saveSession('playerUid', user.uid, remember);
            saveSession('playerNickname', fallbackNickname, remember);
            saveSession('playerData', JSON.stringify(defaultUserData), remember);
            window.location.replace('public.html');
            return;
        }
    } catch (e) {
        console.error('handleUserSessionRouting error:', e);
        saveSession('isPlayerLoggedIn', 'true', remember);
        saveSession('playerUid', user.uid, remember);
        saveSession('playerNickname', user.displayName || 'ผู้เล่น', remember);
        window.location.replace('public.html');
    }
}

// ตรวจสอบเซสชันเดิม (Persistent Session Check)
async function checkExistingSession() {
    // 1. ตรวจสอบสถานะ Admin จาก Storage ก่อน
    const isAdmin = localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true';
    if (isAdmin) {
        window.location.replace('index.html');
        return;
    }

    // 2. ตรวจสอบสถานะ Player จาก Storage
    const isPlayer = localStorage.getItem('isPlayerLoggedIn') === 'true' || sessionStorage.getItem('isPlayerLoggedIn') === 'true';
    if (isPlayer) {
        window.location.replace('public.html');
        return;
    }

    // 3. ตรวจสอบ Firebase Auth State Persistence
    if (auth) {
        const notice = document.getElementById('autoCheckingNotice');
        if (notice) notice.classList.remove('hidden');

        try {
            await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        } catch (persErr) {
            console.warn('Set persistence warning:', persErr);
        }

        auth.onAuthStateChanged(async (user) => {
            if (user) {
                try {
                    await handleUserSessionRouting(user, true);
                } catch (e) {
                    console.warn('Auto login error:', e);
                    if (notice) notice.classList.add('hidden');
                }
            } else {
                if (notice) notice.classList.add('hidden');
            }
        });
    }
}

// ระบบตรวจสอบ Login แบบกรอก Email / Password
document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const userInput = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    const rememberMe = document.getElementById('rememberMe') ? document.getElementById('rememberMe').checked : true;
    const errorBox = document.getElementById('errorMessage');
    const loginBtn = document.getElementById('loginBtn');

    errorBox.classList.add('hidden');
    errorBox.textContent = '';

    // 1. ตรวจสอบรหัสผ่าน Admin โต๊ะกลาง
    if (userInput.toLowerCase() === 'admin' && (pass === 'Upbaminton12345!' || pass === 'Upbadminton12345!')) {
        saveSession('isLoggedIn', 'true', rememberMe);
        saveSession('adminName', 'Admin', rememberMe);
        window.location.replace('index.html');
        return;
    }

    // 2. ถ้ากรอกเป็น Email ให้ตรวจสอบผ่าน Firebase Authentication
    if (auth && db) {
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span>กำลังตรวจสอบ...</span>';

        try {
            await auth.setPersistence(rememberMe ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION);
            const userCredential = await auth.signInWithEmailAndPassword(userInput, pass);
            const user = userCredential.user;

            await handleUserSessionRouting(user, rememberMe);
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

// ระบบเข้าสู่ระบบด้วย Google (Google Sign-In)
const googleLoginBtn = document.getElementById('googleLoginBtn');
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
        const errorBox = document.getElementById('errorMessage');
        const rememberMe = document.getElementById('rememberMe') ? document.getElementById('rememberMe').checked : true;

        errorBox.classList.add('hidden');
        errorBox.textContent = '';

        if (!auth || !db) {
            errorBox.classList.remove('hidden');
            errorBox.textContent = 'ระบบเชื่อมต่อ Firebase ไม่พร้อม กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต';
            return;
        }

        try {
            googleLoginBtn.disabled = true;
            googleLoginBtn.classList.add('opacity-60', 'cursor-not-allowed');
            googleLoginBtn.innerHTML = `
                <span class="inline-block animate-spin">🔄</span>
                <span>กำลังเชื่อมต่อ Google...</span>
            `;

            await auth.setPersistence(rememberMe ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION);

            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });

            const result = await auth.signInWithPopup(provider);
            const user = result.user;

            await handleUserSessionRouting(user, rememberMe);
        } catch (err) {
            console.error('Google Sign-In Error:', err);
            errorBox.classList.remove('hidden');
            if (err.code === 'auth/popup-closed-by-user') {
                errorBox.textContent = 'การเข้าสู่ระบบถูกยกเลิก (หน้าต่าง Google ถูกปิด)';
            } else if (err.code === 'auth/cancelled-popup-request') {
                errorBox.textContent = 'มีการเรียกหน้าต่างเข้าสู่ระบบซ้ำซ้อน กรุณาลองใหม่อีกครั้ง';
            } else if (err.code === 'auth/operation-not-allowed') {
                errorBox.textContent = 'ยังไม่ได้เปิดใช้งาน Google Sign-in ใน Firebase Console (Authentication > Sign-in method > Google)';
            } else if (err.code === 'auth/unauthorized-domain') {
                errorBox.textContent = 'โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase Console (Authorized Domains)';
            } else {
                errorBox.textContent = 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ: ' + (err.message || 'เกิดข้อผิดพลาด');
            }
        } finally {
            googleLoginBtn.disabled = false;
            googleLoginBtn.classList.remove('opacity-60', 'cursor-not-allowed');
            googleLoginBtn.innerHTML = `
                <svg class="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>เข้าสู่ระบบด้วย Google</span>
            `;
        }
    });
}

// ตรวจสอบและเริ่มต้นการทำงานเมื่อโหลดหน้า
window.addEventListener('DOMContentLoaded', () => {
    initTheme();
    checkExistingSession();
});

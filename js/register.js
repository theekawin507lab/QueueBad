/* =============================================
   register.js — ระบบลงทะเบียนผู้เล่นใหม่ (Firebase Auth + Firestore)
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    const registerForm = document.getElementById('registerForm');
    const errorBox = document.getElementById('registerError');
    const submitBtn = document.getElementById('btnRegister');

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorBox.classList.add('hidden');
        errorBox.textContent = '';

        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;
        const confirmPassword = document.getElementById('regConfirmPassword').value;
        const nickname = document.getElementById('regNickname').value.trim();
        const firstName = document.getElementById('regFirstName').value.trim();
        const lastName = document.getElementById('regLastName').value.trim();
        const studentId = document.getElementById('regStudentId').value.trim();
        const phone = document.getElementById('regPhone').value.trim();
        const faculty = document.getElementById('regFaculty').value.trim();
        const major = document.getElementById('regMajor').value.trim();
        const year = document.getElementById('regYear').value;

        // ตรวจสอบความถูกต้องเบื้องต้น
        if (password !== confirmPassword) {
            showError('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
            return;
        }

        if (password.length < 6) {
            showError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
            return;
        }

        if (!auth || !db) {
            showError('ไม่สามารถเชื่อมต่อระบบฐานข้อมูล Firebase ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
            return;
        }

        // เริ่มลงทะเบียน
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>กำลังบันทึกข้อมูล...</span>';

        try {
            // 1. สร้างบัญชีใน Firebase Authentication
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // อัปเดต DisplayName ใน Firebase Auth ให้เป็นชื่อเล่น
            await user.updateProfile({
                displayName: nickname
            });

            // 2. บันทึกข้อมูลโปรไฟล์ลงใน Firestore collection 'users'
            const userData = {
                uid: user.uid,
                email: email,
                nickname: nickname,
                firstName: firstName,
                lastName: lastName,
                studentId: studentId || '',
                phone: phone,
                faculty: faculty,
                major: major,
                year: year,
                role: 'player', // ค่าเริ่มต้นเป็นผู้เล่น
                isPresent: true, // ค่าเริ่มต้นคือมาสนาม
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('users').doc(user.uid).set(userData);

            // 3. เพิ่มชื่อลงในรายชื่อผู้เล่นในสนามอัตโนมัติ (players)
            try {
                const playerRef = db.collection('players').doc(user.uid);
                await playerRef.set({
                    uid: user.uid,
                    name: nickname,
                    fullName: `${firstName} ${lastName}`,
                    isPresent: true,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (pErr) {
                console.warn('เตือน: ไม่สามารถบันทึกลง players ได้ในทันที:', pErr);
            }

            // 4. บันทึกข้อมูลลง local session ด้วยเพื่อความรวดเร็วในการเปิดหน้าถัดไป
            sessionStorage.setItem('isPlayerLoggedIn', 'true');
            sessionStorage.setItem('playerUid', user.uid);
            sessionStorage.setItem('playerNickname', nickname);
            sessionStorage.setItem('playerData', JSON.stringify(userData));

            alert(`🎉 ลงทะเบียนสำเร็จ!\nยินดีต้อนรับคุณ "${nickname}" เข้าสู่ระบบจัดคิว`);
            window.location.href = 'public.html';

        } catch (error) {
            console.error('Registration Error:', error);
            let message = 'เกิดข้อผิดพลาดในการลงทะเบียน กรุณาลองใหม่อีกครั้ง';
            if (error.code === 'auth/email-already-in-use') {
                message = 'อีเมลนี้ถูกใช้งานในระบบแล้ว กรุณาใช้อีเมลอื่น หรือไปที่หน้าเข้าสู่ระบบ';
            } else if (error.code === 'auth/invalid-email') {
                message = 'รูปแบบอีเมลไม่ถูกต้อง';
            } else if (error.code === 'auth/weak-password') {
                message = 'รหัสผ่านง่ายเกินไป ควรมีความยาวอย่างน้อย 6 ตัวอักษร';
            }
            showError(message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>ยืนยันการลงทะเบียน</span>';
        }
    });

    function showError(msg) {
        errorBox.textContent = msg;
        errorBox.classList.remove('hidden');
        errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
});

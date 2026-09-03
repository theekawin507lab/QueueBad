/* =============================================
   guide.js — ระบบคู่มือการใช้งาน (ใช้ร่วมกันทุกหน้า)
   แสดง Modal คู่มือที่มีเนื้อหาต่างกันตาม context
   ============================================= */

const GUIDE_CONTENT = {
    admin: `
        <div class="space-y-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-100 dark:border-blue-800">
                <h3 class="font-bold text-blue-700 dark:text-blue-400 mb-1">ภาพรวม</h3>
                <p>หน้า Admin Dashboard ใช้สำหรับจัดการคิวการแข่งขัน, รายชื่อผู้เล่น และดูผลการแข่งขัน</p>
            </div>

            <div>
                <h3 class="font-bold text-gray-800 dark:text-white mb-2">การจัดการรายชื่อผู้เล่น</h3>
                <ul class="list-disc list-inside space-y-1 ml-2">
                    <li>พิมพ์ชื่อใหม่แล้วกด <strong>+</strong> เพื่อเพิ่มผู้เล่น</li>
                    <li>กดปุ่ม ✅/❌ เพื่อเปลี่ยนสถานะ "มาแล้ว" / "ยังไม่มา"</li>
                    <li>คลิกที่ชื่อผู้เล่นเพื่อเลือกลงช่องทีม (ต้องมีสถานะ ✅)</li>
                    <li>ใช้ช่องค้นหาเพื่อกรองรายชื่อตามชื่อหรือสถานะ</li>
                </ul>
            </div>

            <div>
                <h3 class="font-bold text-gray-800 dark:text-white mb-2">การจัดคิว</h3>
                <ul class="list-disc list-inside space-y-1 ml-2">
                    <li>เลือกผู้เล่น 4 คน (ทีม A 2 คน, ทีม B 2 คน) + เลขสนาม</li>
                    <li>กด <strong>"เพิ่มลงคิว"</strong> เพื่อสร้างคิวใหม่</li>
                    <li>กด <strong>"ลงสนาม"</strong> เพื่อเริ่มเกม (สนามต้องว่าง)</li>
                    <li>กด <strong>"บันทึกคะแนน"</strong> เพื่อจบเกมและบันทึกผล</li>
                </ul>
            </div>

            <div>
                <h3 class="font-bold text-gray-800 dark:text-white mb-2">ระบบเรียกคิวอัตโนมัติ</h3>
                <ul class="list-disc list-inside space-y-1 ml-2">
                    <li>เมื่อจบเกม ระบบจะ<strong>เรียกคิวถัดไป</strong>ในสนามเดียวกันโดยอัตโนมัติ</li>
                    <li>คิวที่ถูกเรียกจะมีเวลา <strong>90 วินาที</strong> เพื่อเตรียมตัว</li>
                    <li>กด <strong>"✅ พร้อม"</strong> เพื่อเริ่มเกม หรือ <strong>"⏭️ ข้าม"</strong> หากผู้เล่นไม่พร้อม</li>
                    <li>หากหมดเวลา คิวจะถูกดันไปท้ายแถว และเรียกคิวถัดไปแทน</li>
                </ul>
            </div>

            <div>
                <h3 class="font-bold text-gray-800 dark:text-white mb-2">Quick Swap (สลับตัวผู้เล่น)</h3>
                <ul class="list-disc list-inside space-y-1 ml-2">
                    <li>กดปุ่มข้างชื่อผู้เล่นในคิวเพื่อสลับตัว</li>
                    <li>ใช้กรณีฉุกเฉิน เช่น ผู้เล่นบาดเจ็บ หรือต้องไปห้องน้ำ</li>
                    <li>ไม่ต้องลบคิวแล้วสร้างใหม่</li>
                </ul>
            </div>

            <div>
                <h3 class="font-bold text-gray-800 dark:text-white mb-2">รายงานปัญหา</h3>
                <ul class="list-disc list-inside space-y-1 ml-2">
                    <li>ดูรายงานปัญหาจากผู้ใช้ในแถบด้านล่าง</li>
                    <li>กดอ่านแล้วเพื่อทำเครื่องหมาย หรือกดลบเพื่อลบรายงาน</li>
                </ul>
            </div>
        </div>
    `,

    public: `
        <div class="space-y-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-100 dark:border-blue-800">
                <h3 class="font-bold text-blue-700 dark:text-blue-400 mb-1">ภาพรวม</h3>
                <p>หน้า Live Dashboard แสดงสถานะคิวแบดมินตันแบบเรียลไทม์ ทุกคนดูได้</p>
            </div>

            <div>
                <h3 class="font-bold text-gray-800 dark:text-white mb-2">การดู Dashboard</h3>
                <ul class="list-disc list-inside space-y-1 ml-2">
                    <li>แต่ละการ์ดแสดงสถานะสนาม: <strong class="text-red-500">กำลังแข่งขัน</strong> หรือ <strong class="text-green-500">ว่าง</strong></li>
                    <li>ดูเวลาที่แข่งขันแบบเรียลไทม์พร้อมนาฬิกาจับเวลา</li>
                    <li>ดูคิวรอลงสนามของแต่ละสนาม</li>
                    <li>สถานะ <strong class="text-amber-500">"กำลังเรียก"</strong> หมายถึงคิวกำลังถูกเรียกให้เตรียมตัว</li>
                </ul>
            </div>

            <div>
                <h3 class="font-bold text-gray-800 dark:text-white mb-2">รายชื่อผู้เล่น</h3>
                <ul class="list-disc list-inside space-y-1 ml-2">
                    <li>ฝั่งขวาแสดงผู้เล่นที่อยู่ที่สนามแล้ว (สถานะพร้อม)</li>
                    <li>จุดสีเขียวกระพริบ = ผู้เล่นมาแล้ว</li>
                </ul>
            </div>

            <div>
                <h3 class="font-bold text-gray-800 dark:text-white mb-2">การสร้างคิว & เข้าร่วมคิว (Lobby)</h3>
                <ul class="list-disc list-inside space-y-1 ml-2">
                    <li>เข้าสู่ระบบด้วยบัญชีผู้เล่นของคุณ</li>
                    <li>กดปุ่มลอย <strong>"🏸 สร้างคิว / เปิดห้อง"</strong> เพื่อเปิดคิวใหม่ สามารถเปิดสล็อตว่างรอคนเข้าร่วมได้</li>
                    <li>หากพบคิวที่ยังไม่ครบ 4 คน สามารถกดปุ่ม <strong>"+ เข้าร่วม"</strong> เพื่อเลือกลงทีม A หรือทีม B ได้ทันที</li>
                    <li>สามารถกดยกเลิกหรือออกจากคิวได้จากแถบสถานะด้านบน</li>
                    <li>สามารถกดสลับสถานะ <strong>"พร้อมลงสนาม / พักผ่อน"</strong> ได้ในหน้าโปรไฟล์</li>
                </ul>
            </div>

            <div>
                <h3 class="font-bold text-gray-800 dark:text-white mb-2">รายงานปัญหา</h3>
                <ul class="list-disc list-inside space-y-1 ml-2">
                    <li>กดปุ่ม "รายงานปัญหา" ที่แถบด้านบนเพื่อแจ้งปัญหา</li>
                    <li>กรอกหัวข้อและรายละเอียด จากนั้นกดส่ง</li>
                    <li>ทีม Admin จะได้รับรายงานของคุณ</li>
                </ul>
            </div>
        </div>
    `,

    booking: `
        <div class="space-y-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            <div class="bg-violet-50 dark:bg-violet-900/20 rounded-lg p-3 border border-violet-100 dark:border-violet-800">
                <h3 class="font-bold text-violet-700 dark:text-violet-400 mb-1">ภาพรวม</h3>
                <p>ฟอร์มจองสนามแบดมินตันล่วงหน้า สำหรับนิสิตมหาวิทยาลัยพะเยา</p>
            </div>

            <div>
                <h3 class="font-bold text-gray-800 dark:text-white mb-2">วิธีจองสนาม</h3>
                <ol class="list-decimal list-inside space-y-1 ml-2">
                    <li>กรอกข้อมูลผู้จอง: ชื่อ, นามสกุล, คณะ, สาขา, เบอร์โทร</li>
                    <li>กรอกวัตถุประสงค์ในการจอง</li>
                    <li>เลือกวันที่เริ่มจองและวันที่สิ้นสุด</li>
                    <li>เลือกช่วงเวลา (ตามเวลาทำการ)</li>
                    <li>เลือกสนามที่ต้องการ (1-6 สนาม)</li>
                    <li>กด "ยืนยันการจอง" เพื่อดาวน์โหลดเอกสาร Word</li>
                </ol>
            </div>

            <div>
                <h3 class="font-bold text-gray-800 dark:text-white mb-2">เวลาทำการ</h3>
                <ul class="list-disc list-inside space-y-1 ml-2">
                    <li><strong>จันทร์-ศุกร์:</strong> 16:00 - 21:30 น.</li>
                    <li><strong>เสาร์-อาทิตย์ / วันหยุด:</strong> 10:00 - 17:00 น.</li>
                </ul>
            </div>

            <div>
                <h3 class="font-bold text-gray-800 dark:text-white mb-2">รายงานปัญหา</h3>
                <ul class="list-disc list-inside space-y-1 ml-2">
                    <li>หากพบปัญหาในการจอง กดปุ่ม "รายงานปัญหา" ด้านบน</li>
                </ul>
            </div>
        </div>
    `,

    login: `
        <div class="space-y-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-100 dark:border-blue-800">
                <h3 class="font-bold text-blue-700 dark:text-blue-400 mb-1">ภาพรวมระบบบัญชีผู้ใช้</h3>
                <p>ระบบจัดคิวแบดมินตัน — UP Badminton Queue System รองรับทั้งผู้จัด (Admin) และผู้เล่นทั่วไป</p>
            </div>

            <div>
                <h3 class="font-bold text-gray-800 dark:text-white mb-2">การเข้าสู่ระบบสำหรับ Admin</h3>
                <ul class="list-disc list-inside space-y-1 ml-2">
                    <li>ใช้บัญชีและรหัสผ่านเฉพาะของผู้ดูแลระบบ</li>
                    <li>จะเข้าสู่หน้า Admin Dashboard เพื่อจัดการคิวและสนาม</li>
                </ul>
            </div>

            <div>
                <h3 class="font-bold text-gray-800 dark:text-white mb-2">สำหรับผู้เล่นทั่วไป</h3>
                <ul class="list-disc list-inside space-y-1 ml-2">
                    <li>กด <strong>"ลงทะเบียนผู้เล่นใหม่"</strong> เพื่อกรอกชื่อจริง-นามสกุล, รหัสนิสิต, คณะ, และชื่อเล่น</li>
                    <li>เมื่อเข้าสู่ระบบ จะสามารถดูโปรไฟล์และสถานะคิวของตนเองแบบเรียลไทม์ได้</li>
                    <li>หรือกด <strong>"ดูกระดานคิวสด (Public View)"</strong> เพื่อดูสถานะสนามโดยไม่ต้องล็อกอิน</li>
                </ul>
            </div>
        </div>
    `
};

// สร้าง Modal คู่มือแบบ Dynamic
function initGuideModal() {
    if (document.getElementById('guideModal')) return;

    const modal = document.createElement('div');
    modal.id = 'guideModal';
    modal.className = 'modal-hidden fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4';
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col transform transition-all animate-modal-in">
            <div class="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700 shrink-0">
                <h2 class="text-xl font-bold text-gray-800 dark:text-white">คู่มือการใช้งาน</h2>
                <button onclick="closeGuideModal()" class="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 text-2xl leading-none transition cursor-pointer" title="ปิด">&times;</button>
            </div>
            <div id="guideContent" class="overflow-y-auto flex-1 px-6 py-4">
            </div>
            <div class="px-6 py-3 border-t dark:border-gray-700 shrink-0">
                <button onclick="closeGuideModal()"
                    class="w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2.5 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition cursor-pointer">
                    ปิด
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // คลิก backdrop เพื่อปิด
    modal.addEventListener('click', function (e) {
        if (e.target === modal) closeGuideModal();
    });
}

function openGuideModal(page) {
    initGuideModal();
    const content = GUIDE_CONTENT[page] || GUIDE_CONTENT['public'];
    document.getElementById('guideContent').innerHTML = content;
    document.getElementById('guideModal').classList.remove('modal-hidden');
}

function closeGuideModal() {
    const modal = document.getElementById('guideModal');
    if (modal) modal.classList.add('modal-hidden');
}

// ปิด modal ด้วย Escape key (ใช้ได้กับทุก modal ในระบบ)
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        // ปิด Guide Modal
        const guideModal = document.getElementById('guideModal');
        if (guideModal && !guideModal.classList.contains('modal-hidden')) {
            closeGuideModal();
            return;
        }
        // ปิด Report Modal (จาก report.js)
        const reportModal = document.getElementById('reportModal');
        if (reportModal && !reportModal.classList.contains('modal-hidden')) {
            if (typeof closeReportModal === 'function') closeReportModal();
            return;
        }
        // ปิด Score Modal (จาก index.js)
        const scoreModal = document.getElementById('scoreModal');
        if (scoreModal && !scoreModal.classList.contains('modal-hidden')) {
            if (typeof closeScoreModal === 'function') closeScoreModal();
            return;
        }
        // ปิด Swap Modal (จาก index.js)
        const swapModal = document.getElementById('swapModal');
        if (swapModal && !swapModal.classList.contains('modal-hidden')) {
            if (typeof closeSwapModal === 'function') closeSwapModal();
            return;
        }
    }
});

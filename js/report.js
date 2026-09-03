/* =============================================
   report.js — ระบบรายงานปัญหา (ใช้ร่วมกันทุกหน้า)
   ใช้ใน public.html และ booking.html
   Admin ดูรายงานจาก index.html
   ============================================= */

// สร้าง Modal รายงานปัญหาแบบ Dynamic (inject เข้า DOM)
function initReportModal() {
    if (document.getElementById('reportModal')) return; // ป้องกันซ้ำ

    const modal = document.createElement('div');
    modal.id = 'reportModal';
    modal.className = 'modal-hidden fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4';
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all animate-modal-in">
            <div class="flex items-center justify-between mb-5 border-b dark:border-gray-700 pb-3">
                <h2 class="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <span></span> รายงานปัญหา
                </h2>
                <button onclick="closeReportModal()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none">&times;</button>
            </div>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">หัวข้อเรื่อง <span class="text-red-500">*</span></label>
                    <input type="text" id="reportSubject" required
                        class="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-sm"
                        placeholder="เช่น สนาม 3 พื้นลื่น, ไฟดับ, ลูกแบดหมด">
                </div>
                <div>
                    <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">รายละเอียด <span class="text-red-500">*</span></label>
                    <textarea id="reportDetail" required rows="4"
                        class="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-sm resize-y"
                        placeholder="อธิบายรายละเอียดปัญหาที่พบ..."></textarea>
                </div>
            </div>
            <div class="flex gap-3 mt-6">
                <button onclick="closeReportModal()"
                    class="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2.5 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition">
                    ยกเลิก
                </button>
                <button onclick="submitReport()"
                    class="flex-1 bg-orange-600 text-white py-2.5 rounded-lg font-bold hover:bg-orange-700 transition shadow">
                    ส่งรายงาน
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // ปิด modal เมื่อคลิก backdrop
    modal.addEventListener('click', function (e) {
        if (e.target === modal) closeReportModal();
    });
}

function openReportModal() {
    initReportModal();
    document.getElementById('reportSubject').value = '';
    document.getElementById('reportDetail').value = '';
    document.getElementById('reportModal').classList.remove('modal-hidden');
}

function closeReportModal() {
    const modal = document.getElementById('reportModal');
    if (modal) modal.classList.add('modal-hidden');
}

function submitReport() {
    const subject = document.getElementById('reportSubject').value.trim();
    const detail = document.getElementById('reportDetail').value.trim();

    if (!subject) {
        alert('กรุณากรอกหัวข้อเรื่อง');
        document.getElementById('reportSubject').focus();
        return;
    }
    if (!detail) {
        alert('กรุณากรอกรายละเอียด');
        document.getElementById('reportDetail').focus();
        return;
    }

    const reports = JSON.parse(localStorage.getItem('problemReports')) || [];
    reports.push({
        id: Date.now(),
        subject: subject,
        detail: detail,
        page: document.title,
        timestamp: new Date().toISOString(),
        isRead: false
    });
    localStorage.setItem('problemReports', JSON.stringify(reports));

    closeReportModal();
    alert('ส่งรายงานปัญหาเรียบร้อยแล้ว!\nขอบคุณสำหรับข้อมูลครับ');
}

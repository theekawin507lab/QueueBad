/* =============================================
   report.js — ระบบรายงานปัญหา (ใช้ร่วมกันทุกหน้า)
   ใช้ใน public.html และ booking.html
   Admin ดูรายงานจาก index.html
   v2.1.4: เพิ่มการแนบรูปภาพ (Optional)
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

                <!-- แนบรูปภาพ (Optional) -->
                <div>
                    <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                        แนบรูปภาพ <span class="text-gray-400 font-normal text-xs">(ไม่บังคับ — สูงสุด 3 รูป)</span>
                    </label>
                    <div id="reportImageDropzone"
                        class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center cursor-pointer hover:border-orange-400 dark:hover:border-orange-500 transition-colors"
                        onclick="document.getElementById('reportImageInput').click()">
                        <input type="file" id="reportImageInput" accept="image/*" multiple style="display:none"
                            onchange="handleReportImages(this)">
                        <p class="text-xs text-gray-500 dark:text-gray-400">คลิกเพื่อเลือกรูปภาพ<br><span class="text-[10px]">รองรับ JPG, PNG, WEBP ขนาดสูงสุด 2MB ต่อรูป</span></p>
                    </div>
                    <!-- Preview รูปภาพ -->
                    <div id="reportImagePreview" class="flex flex-wrap gap-2 mt-2"></div>
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

// เก็บ Base64 รูปภาพที่แนบ
let _reportImages = [];

function handleReportImages(input) {
    const files = Array.from(input.files);
    const remaining = 3 - _reportImages.length;
    if (files.length > remaining) {
        alert(`แนบรูปได้สูงสุด 3 รูป (เหลือที่ว่างอีก ${remaining} รูป)`);
    }
    const toProcess = files.slice(0, remaining);

    toProcess.forEach(file => {
        if (file.size > 2 * 1024 * 1024) {
            alert(`ไฟล์ "${file.name}" มีขนาดเกิน 2MB กรุณาเลือกรูปที่มีขนาดเล็กกว่า`);
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            _reportImages.push({ name: file.name, data: e.target.result });
            renderReportImagePreview();
        };
        reader.readAsDataURL(file);
    });

    // reset input เพื่อให้เลือกซ้ำได้
    input.value = '';
}

function renderReportImagePreview() {
    const container = document.getElementById('reportImagePreview');
    if (!container) return;
    container.innerHTML = _reportImages.map((img, i) => `
        <div class="relative w-16 h-16 group">
            <img src="${img.data}" alt="${img.name}" class="w-16 h-16 object-cover rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm">
            <button onclick="removeReportImage(${i})"
                class="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">
                ✕
            </button>
        </div>
    `).join('');

    // อัปเดต dropzone ถ้าเต็มแล้ว
    const dropzone = document.getElementById('reportImageDropzone');
    if (dropzone) {
        dropzone.style.display = _reportImages.length >= 3 ? 'none' : '';
    }
}

function removeReportImage(index) {
    _reportImages.splice(index, 1);
    renderReportImagePreview();
    const dropzone = document.getElementById('reportImageDropzone');
    if (dropzone) dropzone.style.display = '';
}

function openReportModal() {
    initReportModal();
    _reportImages = [];
    document.getElementById('reportSubject').value = '';
    document.getElementById('reportDetail').value = '';
    document.getElementById('reportImagePreview').innerHTML = '';
    const dz = document.getElementById('reportImageDropzone');
    if (dz) dz.style.display = '';
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
        images: _reportImages.map(img => ({ name: img.name, data: img.data })),
        page: document.title,
        timestamp: new Date().toISOString(),
        isRead: false
    });
    localStorage.setItem('problemReports', JSON.stringify(reports));

    _reportImages = [];
    closeReportModal();
    alert('ส่งรายงานปัญหาเรียบร้อยแล้ว!\nขอบคุณสำหรับข้อมูลครับ');
}

/* =============================================
   register.js — ระบบลงทะเบียนผู้เล่นใหม่ (Firebase Auth + Firestore)
   v2.1.2: เพิ่ม Username, สถานะผู้ใช้, กลุ่มวิชา, Dropdown คณะ/สาขา ม.พะเยา
   ============================================= */

// =============================================
// ข้อมูลหลักสูตรมหาวิทยาลัยพะเยา (ปีการศึกษา 2569)
// จัดกลุ่มตาม: กลุ่มวิชา → คณะ → สาขาวิชา
// =============================================
const UP_CURRICULUM = {
    "วิทยาศาสตร์สุขภาพ": {
        "คณะแพทยศาสตร์": [
            "แพทยศาสตรบัณฑิต (พ.บ.)",
            "วิทยาศาสตรบัณฑิต สาขาวิชาปฏิบัติการฉุกเฉินการแพทย์"
        ],
        "คณะทันตแพทยศาสตร์": [
            "ทันตแพทยศาสตรบัณฑิต (ท.บ.)"
        ],
        "คณะเภสัชศาสตร์": [
            "เภสัชศาสตรบัณฑิต สาขาวิชาการบริบาลทางเภสัชกรรม (ภ.บ.)",
            "วิทยาศาสตรบัณฑิต สาขาวิชาวิทยาศาสตร์เครื่องสำอาง (วท.บ.)",
            "วิทยาศาสตรมหาบัณฑิต สาขาวิชานวัตกรรมทางเภสัชศาสตร์ (วท.ม.)",
            "ปรัชญาดุษฎีบัณฑิต สาขาวิชานวัตกรรมทางเภสัชศาสตร์ (ปร.ด.)"
        ],
        "คณะพยาบาลศาสตร์": [
            "พยาบาลศาสตรบัณฑิต (พย.บ.)",
            "พยาบาลศาสตรมหาบัณฑิต สาขาวิชาการพยาบาลผู้ใหญ่และผู้สูงอายุ (พย.ม.)"
        ],
        "คณะสหเวชศาสตร์": [
            "วิทยาศาสตรบัณฑิต สาขาวิชาเทคนิคการแพทย์ (วท.บ.)",
            "กายภาพบำบัดบัณฑิต (กภ.บ.)"
        ],
        "คณะสาธารณสุขศาสตร์": [
            "การแพทย์แผนไทยประยุกต์บัณฑิต (พทป.บ.)",
            "การแพทย์แผนจีนบัณฑิต (พจ.บ.)",
            "วิทยาศาสตรบัณฑิต สาขาวิชาการส่งเสริมสุขภาพ (วท.บ.)",
            "วิทยาศาสตรบัณฑิต สาขาวิชาอนามัยสิ่งแวดล้อม (วท.บ.)",
            "วิทยาศาสตรบัณฑิต สาขาวิชาอาชีวอนามัยและความปลอดภัย (วท.บ.)",
            "สาธารณสุขศาสตรบัณฑิต สาขาวิชาอนามัยชุมชน (ส.บ.)",
            "สาธารณสุขศาสตรมหาบัณฑิต (ส.ม.)",
            "สาธารณสุขศาสตรดุษฎีบัณฑิต (ส.ด.)"
        ],
        "คณะวิทยาศาสตร์การแพทย์": [
            "วิทยาศาสตรบัณฑิต สาขาวิชาโภชนาการและการกำหนดอาหาร (วท.บ.)",
            "วิทยาศาสตรบัณฑิต สาขาวิชาจุลชีววิทยา (วท.บ.)",
            "วิทยาศาสตรบัณฑิต สาขาวิชาชีวเคมี (วท.บ.)"
        ]
    },
    "วิทยาศาสตร์และเทคโนโลยี": {
        "คณะเทคโนโลยีสารสนเทศและการสื่อสาร (ICT)": [
            "ศิลปกรรมศาสตรบัณฑิต สาขาวิชาคอมพิวเตอร์กราฟิกและมัลติมีเดีย (ศป.บ.)",
            "บริหารธุรกิจบัณฑิต สาขาวิชาธุรกิจดิจิทัล (บธ.บ.)",
            "วิทยาศาสตรบัณฑิต สาขาวิชาเทคโนโลยีสารสนเทศ (วท.บ.)",
            "วิทยาศาสตรบัณฑิต สาขาวิชาภูมิสารสนเทศศาสตร์ (วท.บ.)",
            "วิทยาศาสตรบัณฑิต สาขาวิชาวิทยาการข้อมูลและการประยุกต์ (วท.บ.)",
            "วิทยาศาสตรบัณฑิต สาขาวิชาวิทยาการคอมพิวเตอร์ (วท.บ.)",
            "วิศวกรรมศาสตรบัณฑิต สาขาวิชาวิศวกรรมคอมพิวเตอร์ (วศ.บ.)",
            "วิศวกรรมศาสตรบัณฑิต สาขาวิชาวิศวกรรมซอฟต์แวร์ (วศ.บ.)",
            "วิทยาศาสตรมหาบัณฑิต สาขาวิชาภูมิสารสนเทศประยุกต์ (วท.ม.)",
            "วิทยาศาสตรมหาบัณฑิต สาขาวิชาการจัดการเทคโนโลยีและข้อมูลดิจิทัล (วท.ม.)",
            "วิศวกรรมมหาบัณฑิต สาขาวิชาวิศวกรรมคอมพิวเตอร์ (วศ.ม.)",
            "วิทยาศาสตรมหาบัณฑิต สาขาวิชาวิทยาการข้อมูลเชิงพื้นที่ (วท.ม.)",
            "ปรัชญาดุษฎีบัณฑิต สาขาวิชาภูมิสารสนเทศประยุกต์ (ปร.ด.)",
            "วิทยาศาสตรดุษฎีบัณฑิต สาขาวิชาวิทยาการข้อมูลเชิงพื้นที่ (วท.ด.)",
            "ปรัชญาดุษฎีบัณฑิต สาขาวิชาวิศวกรรมคอมพิวเตอร์ (ปร.ด.)"
        ],
        "คณะวิศวกรรมศาสตร์": [
            "วิศวกรรมศาสตรบัณฑิต สาขาวิชาวิศวกรรมเครื่องกล (วศ.บ.)",
            "วิศวกรรมศาสตรบัณฑิต สาขาวิชาวิศวกรรมโยธา (วศ.บ.)",
            "วิศวกรรมศาสตรบัณฑิต สาขาวิศวกรรมไฟฟ้า (วศ.บ.)",
            "วิศวกรรมศาสตรบัณฑิต สาขาวิศวกรรมอุตสาหการ (วศ.บ.)",
            "วิศวกรรมศาสตรมหาบัณฑิต สาขาวิชาวิศวกรรมเครื่องกล (วศ.ม.)",
            "วิศวกรรมศาสตรมหาบัณฑิต สาขาวิชาวิศวกรรมโยธา (วศ.ม.)",
            "วิศวกรรมศาสตรมหาบัณฑิต สาขาวิชาวิศวกรรมไฟฟ้า (วศ.ม.)",
            "วิศวกรรมศาสตรมหาบัณฑิต สาขาวิศวกรรมและเทคโนโลยีระบบราง (วศ.ม.)",
            "ปรัชญาดุษฎีบัณฑิต สาขาวิชาวิศวกรรมไฟฟ้า (ปร.ด.)",
            "ปรัชญาดุษฎีบัณฑิต สาขาวิชาวิศวกรรมโยธา (ปร.ด.)",
            "ปรัชญาดุษฎีบัณฑิต สาขาวิศวกรรมและเทคโนโลยีระบบราง (ปร.ด.)"
        ],
        "คณะวิทยาศาสตร์": [
            "วิทยาศาสตรบัณฑิต สาขาวิชาเคมี (วท.บ.)",
            "วิทยาศาสตรบัณฑิต สาขาวิชาคณิตศาสตร์ (วท.บ.)",
            "วิทยาศาสตรบัณฑิต สาขาวิชาชีววิทยา (วท.บ.)",
            "วิทยาศาสตรบัณฑิต สาขาวิชาฟิสิกส์ (วท.บ.)",
            "วิทยาศาสตรบัณฑิต สาขาวิชาวิทยาศาสตร์การออกกำลังกายและการกีฬา (วท.บ.)",
            "วิทยาศาสตรบัณฑิต สาขาวิชาสถิติประยุกต์และการจัดการข้อมูล (วท.บ.)",
            "วิทยาศาสตรมหาบัณฑิต สาขาวิชาคณิตศาสตร์ (วท.ม.)",
            "วิทยาศาสตรมหาบัณฑิต สาขาวิชาชีววิทยา (วท.ม.)",
            "วิทยาศาสตรมหาบัณฑิต สาขาวิชาวิทยาศาสตร์การออกกำลังกายและการกีฬา (วท.ม.)",
            "วิทยาศาสตรมหาบัณฑิต สาขาวิชาเคมีประยุกต์ (วท.ม.)",
            "ปรัชญาดุษฎีบัณฑิต สาขาวิชาคณิตศาสตร์ (ปร.ด.)",
            "ปรัชญาดุษฎีบัณฑิต สาขาวิชาวิทยาศาสตร์ประยุกต์ (ปร.ด.)",
            "วิทยาศาสตรดุษฎีบัณฑิต สาขาวิชาวิทยาศาสตร์การออกกำลังกายและการกีฬา (วท.ด.)",
            "วิทยาศาสตรดุษฎีบัณฑิต สาขาวิชาชีววิทยา (วท.ด.)"
        ],
        "คณะเกษตรศาสตร์และทรัพยากรธรรมชาติ": [
            "วิทยาศาสตรบัณฑิต สาขาวิชาเกษตรศาสตร์ (วท.บ.)",
            "วิทยาศาสตรบัณฑิต สาขาวิชาเทคโนโลยีนวัตกรรมการประมง (วท.บ.)",
            "วิทยาศาสตรบัณฑิต สาขาวิชาความปลอดภัยทางอาหาร (วท.บ.)",
            "วิทยาศาสตรบัณฑิต สาขาวิชาวิทยาศาสตร์และเทคโนโลยีการอาหาร (วท.บ.)",
            "วิทยาศาสตรบัณฑิต สาขาวิชาสัตวศาสตร์ (วท.บ.)",
            "เทคโนโลยีบัณฑิต สาขาวิชาเทคโนโลยีการเกษตร (ทล.บ.)",
            "วิทยาศาสตรมหาบัณฑิต สาขาวิชาเทคโนโลยีชีวภาพ (วท.ม.)",
            "วิทยาศาสตรมหาบัณฑิต สาขาวิทยาศาสตร์การอาหารและการจัดการความปลอดภัยทางอาหาร (วท.ม.)",
            "วิทยาศาสตรมหาบัณฑิต สาขาวิชาสัตวศาสตร์ (วท.ม.)",
            "ปรัชญาดุษฎีบัณฑิต สาขาวิชานวัตกรรมผลิตภาพทางทรัพยากรธรรมชาติและการจัดการ (ปร.ด.)"
        ],
        "คณะพลังงานและสิ่งแวดล้อม": [
            "วิศวกรรมศาสตรบัณฑิต สาขาวิชาวิศวกรรมสิ่งแวดล้อม (วศ.บ.)",
            "วิทยาศาสตรบัณฑิต สาขาวิชาการจัดการพลังงานและสิ่งแวดล้อม (วท.บ.)",
            "วิศวกรรมศาสตรมหาบัณฑิต สาขาวิชาการจัดการพลังงานและนวัตกรรม (วศ.ม.)",
            "วิทยาศาสตรมหาบัณฑิต สาขาวิชาเทคโนโลยีและการจัดการสิ่งแวดล้อม (วท.ม.)",
            "วิศวกรรมศาสตรมหาบัณฑิต สาขาวิชาวิศวกรรมสิ่งแวดล้อม (วศ.ม.)",
            "ปรัชญาดุษฎีบัณฑิต สาขาวิชาเทคโนโลยีและการจัดการสิ่งแวดล้อม (ปร.ด.)",
            "ปรัชญาดุษฎีบัณฑิต สาขาวิชาการจัดการพลังงานและสมาร์ตกริดเทคโนโลยี (ปร.ด.)",
            "ปรัชญาดุษฎีบัณฑิต สาขาวิชาการจัดการพลังงานและนวัตกรรม (ปร.ด.)"
        ],
        "คณะสถาปัตยกรรมศาสตร์และศิลปกรรมศาสตร์": [
            "ศิลปกรรมศาสตรบัณฑิต สาขาวิชาดนตรีและนาฏศิลป์ (ศป.บ.)",
            "ศิลปกรรมศาสตรบัณฑิต สาขาวิชาศิลปะและการออกแบบ (ศป.บ.)",
            "สถาปัตยกรรมศาสตรบัณฑิต สาขาวิชาสถาปัตยกรรม (สถ.บ.)",
            "สถาปัตยกรรมศาสตรบัณฑิต สาขาวิชาสถาปัตยกรรมภายใน (สถ.บ.)",
            "สถาปัตยกรรมศาสตรมหาบัณฑิต สาขาวิชาสหวิทยาการสถาปัตยกรรมสร้างสรรค์ (สถ.ม.)"
        ]
    },
    "มนุษยศาสตร์และสังคมศาสตร์": {
        "คณะนิติศาสตร์": [
            "นิติศาสตรบัณฑิต (น.บ.)",
            "นิติศาสตรมหาบัณฑิต (น.ม.)",
            "นิติศาสตรดุษฎีบัณฑิต (น.ด.)"
        ],
        "คณะรัฐศาสตร์และสังคมศาสตร์": [
            "รัฐประศาสนศาสตรบัณฑิต สาขาวิชาการจัดการนวัตกรรมสาธารณะ (รป.บ.)",
            "รัฐศาสตรบัณฑิต (ร.บ.)",
            "ศิลปศาสตรบัณฑิต สาขาวิชาพัฒนาสังคม (ศศ.บ.)",
            "รัฐประศาสนศาสตรมหาบัณฑิต สาขาวิชานโยบายสาธารณะ (รป.ม.)"
        ],
        "คณะบริหารธุรกิจและนิเทศศาสตร์ (BCA)": [
            "เศรษฐศาสตรบัณฑิต (ศ.บ.)",
            "นิเทศศาสตรบัณฑิต สาขาวิชาการจัดการการสื่อสาร (นศ.บ.)",
            "นิเทศศาสตรบัณฑิต สาขาวิชาการสื่อสารสื่อใหม่ (นศ.บ.)",
            "บริหารธุรกิจบัณฑิต สาขาวิชาการเงินและการลงทุน (บธ.บ.)",
            "บริหารธุรกิจบัณฑิต สาขาวิชาการจัดการธุรกิจ (บธ.บ.)",
            "บริหารธุรกิจบัณฑิต สาขาวิชาการตลาดดิจิทัล (บธ.บ.)",
            "บัญชีบัณฑิต (บช.บ.)",
            "ศิลปศาสตรบัณฑิต สาขาวิชาการท่องเที่ยวและการโรงแรม (ศศ.บ.)",
            "บริหารธุรกิจมหาบัณฑิต (บธ.ม. / MBA)",
            "ศิลปศาสตรมหาบัณฑิต สาขาวิชาการจัดการการท่องเที่ยวและการโรงแรม (ศศ.ม.)",
            "ปรัชญาดุษฎีบัณฑิต สาขาวิชาการจัดการการท่องเที่ยวและโรงแรม (ปร.ด.)",
            "ปรัชญาดุษฎีบัณฑิต สาขาวิชาบริหารธุรกิจ (ปร.ด.)"
        ],
        "คณะศิลปศาสตร์": [
            "ศิลปศาสตรบัณฑิต สาขาวิชาภาษาไทย (ศศ.บ.)",
            "ศิลปศาสตรบัณฑิต สาขาวิชาภาษาจีน (ศศ.บ.)",
            "ศิลปศาสตรบัณฑิต สาขาวิชาภาษาญี่ปุ่น (ศศ.บ.)",
            "ศิลปศาสตรบัณฑิต สาขาวิชาภาษาฝรั่งเศส (ศศ.บ.)",
            "ศิลปศาสตรบัณฑิต สาขาวิชาภาษาอังกฤษ (ศศ.บ.)",
            "ศิลปศาสตรมหาบัณฑิต สาขาวิชาภาษาไทย (ศศ.ม.)",
            "ศิลปศาสตรมหาบัณฑิต สาขาวิชาภาษาศาสตร์ประยุกต์ (ศศ.ม.)",
            "ศิลปศาสตรมหาบัณฑิต สาขาวิชาภาษาอังกฤษ (ศศ.ม.)",
            "ปรัชญาดุษฎีบัณฑิต สาขาวิชาภาษาไทย (ปร.ด.)",
            "ปรัชญาดุษฎีบัณฑิต สาขาวิชาภาษาศาสตร์ประยุกต์ (ปร.ด.)",
            "ปรัชญาดุษฎีบัณฑิต สาขาวิชาภาษาอังกฤษ (ปร.ด.)"
        ],
        "วิทยาลัยการศึกษา": [
            "การศึกษาบัณฑิต สาขาวิชาการศึกษา (กศ.บ.)",
            "การศึกษามหาบัณฑิต สาขาวิชาการบริหารการศึกษา (กศ.ม.)",
            "การศึกษามหาบัณฑิต สาขาวิชาหลักสูตรและการสอน (กศ.ม.)",
            "การศึกษามหาบัณฑิต สาขาวิชานวัตกรทางการศึกษา (กศ.ม.)",
            "การศึกษามหาบัณฑิต สาขาวิชาสะเต็มศึกษา (กศ.ม.)",
            "ปรัชญาดุษฎีบัณฑิต สาขาวิชาการบริหารการศึกษา (ปร.ด.)",
            "ปรัชญาดุษฎีบัณฑิต สาขาวิชาหลักสูตรและการสอน (ปร.ด.)"
        ],
        "วิทยาลัยการจัดการ (กรุงเทพฯ)": [
            "บริหารธุรกิจมหาบัณฑิต (MBA)",
            "การศึกษามหาบัณฑิต สาขาวิชาการบริหารการศึกษา",
            "ศิลปศาสตรมหาบัณฑิต สาขาวิชาการจัดการการท่องเที่ยว โรงแรม และธุรกิจบริการ",
            "ปรัชญาดุษฎีบัณฑิต สาขาวิชาการบริหารการศึกษา",
            "ปรัชญาดุษฎีบัณฑิต สาขาวิชาการจัดการการท่องเที่ยว โรงแรม และธุรกิจบริการ",
            "ปรัชญาดุษฎีบัณฑิต สาขาวิชาบริหารธุรกิจ"
        ]
    }
};

// สถานะที่ต้องแสดงฟิลด์คณะ/สาขา
const STUDENT_STATUSES = new Set(['นิสิต/นักศึกษา', 'บัณฑิตศึกษา (ป.โท)', 'บัณฑิตศึกษา (ป.เอก)']);

// =============================================
// Dropdown Logic — กลุ่มวิชา → คณะ → สาขา
// =============================================
function initDropdownCascade() {
    const statusSel = document.getElementById('regUserStatus');
    const fieldGroupWrap = document.getElementById('fieldGroup');
    const facultyWrap = document.getElementById('facultyGroup');
    const majorWrap = document.getElementById('majorGroup');
    const fieldGroupSel = document.getElementById('regFieldGroup');
    const facultySel = document.getElementById('regFaculty');
    const majorSel = document.getElementById('regMajor');

    // เมื่อเปลี่ยนสถานะผู้ใช้ — ซ่อน/แสดงฟิลด์คณะ-สาขา
    statusSel.addEventListener('change', () => {
        const isStudent = STUDENT_STATUSES.has(statusSel.value);
        fieldGroupWrap.style.display = isStudent ? '' : 'none';
        facultyWrap.style.display = isStudent ? '' : 'none';
        majorWrap.style.display = isStudent ? '' : 'none';
        if (!isStudent) {
            fieldGroupSel.value = '';
            populateFaculty('');
            populateMajor('', '');
        }
    });

    // เมื่อเปลี่ยนกลุ่มวิชา — อัปเดต Dropdown คณะ
    fieldGroupSel.addEventListener('change', () => {
        populateFaculty(fieldGroupSel.value);
        populateMajor('', '');
        facultyWrap.style.display = fieldGroupSel.value ? '' : 'none';
        majorWrap.style.display = 'none';
    });

    // เมื่อเปลี่ยนคณะ — อัปเดต Dropdown สาขา
    facultySel.addEventListener('change', () => {
        const group = fieldGroupSel.value;
        const faculty = facultySel.value;
        populateMajor(group, faculty);
        majorWrap.style.display = faculty ? '' : 'none';
    });
}

function populateFaculty(group) {
    const sel = document.getElementById('regFaculty');
    sel.innerHTML = '<option value="">-- เลือกคณะ --</option>';
    if (!group || !UP_CURRICULUM[group]) return;
    Object.keys(UP_CURRICULUM[group]).forEach(faculty => {
        const opt = document.createElement('option');
        opt.value = faculty;
        opt.textContent = faculty;
        sel.appendChild(opt);
    });
}

function populateMajor(group, faculty) {
    const sel = document.getElementById('regMajor');
    sel.innerHTML = '<option value="">-- เลือกสาขาวิชา --</option>';
    if (!group || !faculty) return;
    const majors = (UP_CURRICULUM[group] || {})[faculty] || [];
    majors.forEach(major => {
        const opt = document.createElement('option');
        opt.value = major;
        opt.textContent = major;
        sel.appendChild(opt);
    });
}

// =============================================
// Main Registration Logic
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initDropdownCascade();

    const registerForm = document.getElementById('registerForm');
    const errorBox = document.getElementById('registerError');
    const submitBtn = document.getElementById('btnRegister');

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorBox.classList.add('hidden');
        errorBox.textContent = '';

        const email        = document.getElementById('regEmail').value.trim();
        const username     = document.getElementById('regUsername').value.trim();
        const password     = document.getElementById('regPassword').value;
        const confirmPwd   = document.getElementById('regConfirmPassword').value;
        const nickname     = document.getElementById('regNickname').value.trim();
        const firstName    = document.getElementById('regFirstName').value.trim();
        const lastName     = document.getElementById('regLastName').value.trim();
        const studentId    = document.getElementById('regStudentId').value.trim();
        const phone        = document.getElementById('regPhone').value.trim();
        const userStatus   = document.getElementById('regUserStatus').value;
        const fieldGroup   = document.getElementById('regFieldGroup').value;
        const faculty      = document.getElementById('regFaculty').value;
        const major        = document.getElementById('regMajor').value;

        // ตรวจสอบพื้นฐาน
        if (password !== confirmPwd) { showError('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน'); return; }
        if (password.length < 6)     { showError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร'); return; }
        if (!userStatus)             { showError('กรุณาเลือกสถานะผู้ใช้'); return; }

        if (username && !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
            showError('Username ต้องมีความยาว 3-30 ตัวอักษร และใช้ได้เฉพาะ a-z, A-Z, 0-9 และ _ (ขีดล่าง)');
            return;
        }

        if (!auth || !db) {
            showError('ไม่สามารถเชื่อมต่อระบบฐานข้อมูล Firebase ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>กำลังบันทึกข้อมูล...</span>';

        try {
            // 1. สร้างบัญชีใน Firebase Authentication
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            await user.updateProfile({ displayName: nickname });

            // 2. บันทึก Profile ลง Firestore collection 'users'
            const userData = {
                uid: user.uid,
                email: email,
                username: username || '',
                nickname: nickname,
                firstName: firstName,
                lastName: lastName,
                studentId: studentId || '',
                phone: phone,
                userStatus: userStatus,
                fieldGroup: fieldGroup || '',
                faculty: faculty || '',
                major: major || '',
                role: 'player',
                isPresent: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('users').doc(user.uid).set(userData);

            // 3. เพิ่มลงรายชื่อผู้เล่นในสนาม (players)
            try {
                await db.collection('players').doc(user.uid).set({
                    uid: user.uid,
                    name: nickname,
                    fullName: `${firstName} ${lastName}`,
                    isPresent: true,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (pErr) {
                console.warn('เตือน: ไม่สามารถบันทึกลง players ได้ในทันที:', pErr);
            }

            // 4. บันทึก Session ลงทั้ง localStorage และ sessionStorage
            localStorage.setItem('isPlayerLoggedIn', 'true');
            localStorage.setItem('playerUid', user.uid);
            localStorage.setItem('playerNickname', nickname);
            localStorage.setItem('playerData', JSON.stringify(userData));
            sessionStorage.setItem('isPlayerLoggedIn', 'true');
            sessionStorage.setItem('playerUid', user.uid);
            sessionStorage.setItem('playerNickname', nickname);
            sessionStorage.setItem('playerData', JSON.stringify(userData));

            alert(`ลงทะเบียนสำเร็จ!\nยินดีต้อนรับคุณ "${nickname}" เข้าสู่ระบบจัดคิว`);
            window.location.href = 'public.html';

        } catch (error) {
            console.error('Registration Error:', error);
            let message = 'เกิดข้อผิดพลาดในการลงทะเบียน กรุณาลองใหม่อีกครั้ง';
            if (error.code === 'auth/email-already-in-use') {
                // ตรวจสอบกรณี Admin เพิ่งลบข้อมูลผู้เล่นออกจาก Firestore เพื่อให้ลงทะเบียนใหม่
                try {
                    const existingCredential = await auth.signInWithEmailAndPassword(email, password);
                    const existingUser = existingCredential.user;
                    const existingDoc = await db.collection('users').doc(existingUser.uid).get();

                    if (!existingDoc.exists) {
                        // บัญชีถูกลบข้อมูลออกจาก Firestore จริง -> ทำการลงทะเบียนใหม่ด้วย UID เดิมทันที
                        await existingUser.updateProfile({ displayName: nickname });

                        const newUserData = {
                            uid: existingUser.uid,
                            email: email,
                            username: username || '',
                            nickname: nickname,
                            firstName: firstName,
                            lastName: lastName,
                            studentId: studentId || '',
                            phone: phone,
                            userStatus: userStatus,
                            fieldGroup: fieldGroup || '',
                            faculty: faculty || '',
                            major: major || '',
                            role: 'player',
                            isPresent: true,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        };

                        await db.collection('users').doc(existingUser.uid).set(newUserData);
                        await db.collection('players').doc(existingUser.uid).set({
                            uid: existingUser.uid,
                            name: nickname,
                            fullName: `${firstName} ${lastName}`,
                            isPresent: true,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });

                        localStorage.setItem('isPlayerLoggedIn', 'true');
                        localStorage.setItem('playerUid', existingUser.uid);
                        localStorage.setItem('playerNickname', nickname);
                        localStorage.setItem('playerData', JSON.stringify(newUserData));
                        sessionStorage.setItem('isPlayerLoggedIn', 'true');
                        sessionStorage.setItem('playerUid', existingUser.uid);
                        sessionStorage.setItem('playerNickname', nickname);
                        sessionStorage.setItem('playerData', JSON.stringify(newUserData));

                        alert(`ลงทะเบียนข้อมูลใหม่สำเร็จ!\nยินดีต้อนรับคุณ "${nickname}" เข้าสู่ระบบจัดคิว`);
                        window.location.href = 'public.html';
                        return;
                    } else {
                        message = 'อีเมลนี้ถูกใช้งานในระบบแล้ว กรุณาใช้อีเมลอื่น หรือไปที่หน้าเข้าสู่ระบบ';
                    }
                } catch (reAuthErr) {
                    message = 'อีเมลนี้เคยลงทะเบียนไว้แล้ว (หาก Admin ได้ลบข้อมูลเดิมออกเพื่อแก้ไข กรุณากรอกรหัสผ่านเดิมที่เคยใช้ หรือไปที่หน้าเข้าสู่ระบบ)';
                }
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

/* =============================================
   index.js — JavaScript สำหรับหน้า Admin Dashboard
   (แยกจาก index.html)
   ============================================= */

let matches = JSON.parse(localStorage.getItem('badmintonMatches')) || [];
let matchCounter = parseInt(localStorage.getItem('matchCounter')) || 1;

let rawPlayers = JSON.parse(localStorage.getItem('badmintonPlayers')) || [
    { name: 'วา-ขาจร', isPresent: true }, { name: 'ยันต์69', isPresent: true },
    { name: 'คริสตัน', isPresent: true }, { name: 'ชัยโรงสี', isPresent: true }
];
let playerList = rawPlayers.map(p => typeof p === 'string' ? { name: p, isPresent: true } : p);

let currentEditingMatchId = null;
let timerInterval = null;

// =============================================
// ระบบ CALLING — ตัวแปรสำหรับ countdown
// =============================================
const CALLING_TIMEOUT = 90; // วินาที
let callingTimers = {}; // { matchId: { startTime, intervalId } }

// =============================================
// ระบบ Quick Swap — ตัวแปร
// =============================================
let swapTarget = null; // { matchId, team ('A'|'B'), playerIndex (0|1) }

function displayDate() {
    const dateOpts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDateDisplay').innerText = new Date().toLocaleDateString('th-TH', dateOpts);
}

document.getElementById('addPlayerForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const newName = document.getElementById('newPlayerName').value.trim();
    const exists = playerList.some(p => p.name === newName);

    if (newName && !exists) {
        playerList.push({ name: newName, isPresent: true });
        savePlayers();
        renderPlayerList();
    } else if (exists) {
        alert('ชื่อนี้มีอยู่ในระบบแล้ว');
    }
    document.getElementById('newPlayerName').value = '';
});

function savePlayers() {
    localStorage.setItem('badmintonPlayers', JSON.stringify(playerList));
    syncPlayersToCloud();
}

async function syncPlayersToCloud() {
    if (!db) return;
    try {
        const batch = db.batch();
        const currentNames = new Set(playerList.map(p => p.name));

        // ลบผู้เล่นที่ไม่มีใน playerList ออกจาก Firestore
        const snap = await db.collection('players').get();
        snap.forEach(doc => {
            const data = doc.data();
            const docName = data.name || data.nickname;
            if (docName && !currentNames.has(docName)) {
                batch.delete(doc.ref);
            }
        });

        // บันทึก/อัปเดตผู้เล่นปัจจุบัน
        playerList.forEach(p => {
            const docId = p.uid || p.name;
            const docRef = db.collection('players').doc(docId);
            batch.set(docRef, {
                name: p.name,
                isPresent: p.isPresent,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });

        await batch.commit();
    } catch (e) {
        console.warn('Sync players to cloud error:', e);
    }
}

function togglePresence(index) {
    playerList[index].isPresent = !playerList[index].isPresent;
    savePlayers();
    renderPlayerList();
}

async function removePlayer(index) {
    const p = playerList[index];
    if (!p) return;

    if (confirm(`ลบชื่อ "${p.name}" ออกจากรายชื่อผู้เล่น?`)) {
        playerList.splice(index, 1);
        localStorage.setItem('badmintonPlayers', JSON.stringify(playerList));
        renderPlayerList();

        if (db) {
            try {
                // ลบออกจาก Firestore ทั้ง docId ที่เป็น uid, ชื่อจริง หรือ encoded
                const idsToDelete = [p.uid, p.name, encodeURIComponent(p.name)].filter(Boolean);
                for (let id of idsToDelete) {
                    await db.collection('players').doc(id).delete().catch(() => {});
                }
            } catch (err) {
                console.error('Error deleting player from Firestore:', err);
            }
        }
    }
}

function selectPlayer(name) {
    const inputs = ['p1', 'p2', 'p3', 'p4'];
    for (let id of inputs) {
        const el = document.getElementById(id);
        if (!el.value) {
            el.value = name;
            break;
        }
    }
}

function clearFormInputs() {
    document.getElementById('p1').value = '';
    document.getElementById('p2').value = '';
    document.getElementById('p3').value = '';
    document.getElementById('p4').value = '';
}

function clearAllData() {
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการล้างกระดานคิวทั้งหมด?\n(แนะนำให้บันทึกเข้าประวัติก่อนล้างข้อมูลครับ)')) {
        // เคลียร์ timers ทั้งหมด
        Object.keys(callingTimers).forEach(id => {
            if (callingTimers[id].intervalId) clearInterval(callingTimers[id].intervalId);
        });
        callingTimers = {};

        matches = [];
        matchCounter = 1;
        saveData();
        renderTable();
    }
}

// =============================================
// ฟีเจอร์ 2: ค้นหา/กรองรายชื่อผู้เล่น
// =============================================
function renderPlayerList() {
    const container = document.getElementById('playerListContainer');
    container.innerHTML = '';

    // ดึงค่า filter
    const searchInput = document.getElementById('playerSearchInput');
    const statusFilter = document.getElementById('playerStatusFilter');
    const searchText = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const statusValue = statusFilter ? statusFilter.value : 'all';

    const playersWithIndex = playerList.map((p, index) => ({ ...p, originalIndex: index }));
    playersWithIndex.sort((a, b) => a.name.localeCompare(b.name));

    // กรอง
    const filtered = playersWithIndex.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchText);
        const matchesStatus = statusValue === 'all' ||
            (statusValue === 'present' && p.isPresent) ||
            (statusValue === 'absent' && !p.isPresent);
        return matchesSearch && matchesStatus;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-400 dark:text-gray-500 text-center py-4">ไม่พบผู้เล่นที่ตรงกับเงื่อนไข</p>';
        return;
    }

    filtered.forEach(p => {
        const div = document.createElement('div');
        div.className = `flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 border dark:border-gray-600 rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-600 transition group ${p.isPresent ? '' : 'opacity-60'}`;

        const clickAction = p.isPresent ? `selectPlayer('${p.name.replace(/'/g, "\\'")}')` : `alert('ผู้เล่นนี้ยังไม่มา ไม่สามารถลงคิวได้')`;
        const textStyle = p.isPresent ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500 line-through';
        const statusBadge = p.isPresent
            ? '<span class="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">พร้อม</span>'
            : '<span class="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">ไม่พร้อม</span>';

        div.innerHTML = `
            <button onclick="togglePresence(${p.originalIndex})" class="mr-2 focus:outline-none" title="คลิกเพื่อเปลี่ยนสถานะความพร้อม">
                ${statusBadge}
            </button>
            <button onclick="${clickAction}" class="flex-1 text-left font-medium ${textStyle} focus:outline-none transition">
                ${p.name}
            </button>
            <button onclick="removePlayer(${p.originalIndex})" class="text-red-400 hover:text-red-600 text-xs px-2 opacity-0 group-hover:opacity-100 transition">ลบ</button>
        `;
        container.appendChild(div);
    });
}

function loadData() {
    // ===== Session Guard =====
    // ซิงค์เซสชันจาก localStorage เข้าสู่ sessionStorage
    ['isLoggedIn', 'adminName', 'adminUid'].forEach(k => {
        const val = localStorage.getItem(k);
        if (val && !sessionStorage.getItem(k)) {
            sessionStorage.setItem(k, val);
        }
    });

    // ถ้าไม่ได้ล็อกอินผ่าน login.html ให้ Redirect กลับ
    if (!sessionStorage.getItem('isLoggedIn') && !localStorage.getItem('isLoggedIn')) {
        window.location.replace('login.html');
        return;
    }
    // =========================

    initTheme();
    displayDate();
    matches.forEach(m => {
        if (m.startTime) m.startTime = new Date(m.startTime);
        if (m.callingStartTime) m.callingStartTime = new Date(m.callingStartTime);
    });
    renderPlayerList();
    renderTable();
    startLiveTimer();
    renderReports();
    updateReportBadge();
    renderHistoryPanel();

    // คืนค่า calling timers สำหรับคิวที่ยังอยู่ในสถานะ CALLING
    matches.forEach(m => {
        if (m.status === 'CALLING') {
            startCallingCountdown(m.id);
        }
    });

    // เริ่มต้นระบบ Cloud Firestore
    initAdminFirestore();
}

function saveData() {
    localStorage.setItem('badmintonMatches', JSON.stringify(matches));
    localStorage.setItem('matchCounter', matchCounter);
    syncMatchesToCloud();
}

// ซิงค์คิวการแข่งขันขึ้น Cloud Firestore
async function syncMatchesToCloud() {
    if (!db) return;
    try {
        const snapshot = await db.collection('matches').get();
        const currentIds = new Set(matches.map(m => String(m.id)));
        const batch = db.batch();

        // ลบเอกสารที่ไม่ได้อยู่ใน matches แล้ว
        snapshot.forEach(doc => {
            if (!currentIds.has(doc.id)) {
                batch.delete(doc.ref);
            }
        });

        // อัปเดตคิวปัจจุบันทั้งหมด
        matches.forEach(m => {
            const docRef = db.collection('matches').doc(String(m.id));
            batch.set(docRef, {
                id: m.id,
                teamA: m.teamA,
                teamB: m.teamB,
                court: m.court,
                status: m.status,
                startTime: m.startTime ? (m.startTime.toISOString ? m.startTime.toISOString() : m.startTime) : null,
                callingStartTime: m.callingStartTime ? (m.callingStartTime.toISOString ? m.callingStartTime.toISOString() : m.callingStartTime) : null,
                scoreA: m.scoreA !== undefined ? m.scoreA : null,
                scoreB: m.scoreB !== undefined ? m.scoreB : null,
                playDuration: m.playDuration !== undefined ? m.playDuration : null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();
    } catch (e) {
        console.warn('Sync matches to cloud warning:', e);
    }
}

// เริ่มต้นระบบ Firestore สำหรับแอดมิน
function initAdminFirestore() {
    if (!db) return;
    const badge = document.getElementById('adminCloudBadge');
    if (badge) badge.classList.remove('hidden');

    // 1. ดักฟังการเปลี่ยนแปลงของ Matches (คิวการแข่งขัน) จาก Cloud แบบ Real-time
    db.collection('matches').onSnapshot((snapshot) => {
        const cloudMatches = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            cloudMatches.push({
                ...data,
                docId: doc.id,
                startTime: data.startTime ? (data.startTime.toDate ? data.startTime.toDate() : new Date(data.startTime)) : null,
                callingStartTime: data.callingStartTime ? (data.callingStartTime.toDate ? data.callingStartTime.toDate() : new Date(data.callingStartTime)) : null
            });
        });

        if (cloudMatches.length > 0) {
            cloudMatches.sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));
            matches = cloudMatches;

            // อัปเดต matchCounter ให้มากกว่า ID สูงสุดเสมอ
            let maxId = 0;
            matches.forEach(m => {
                const idNum = parseInt(m.id) || 0;
                if (idNum > maxId) maxId = idNum;
            });
            matchCounter = maxId + 1;

            localStorage.setItem('badmintonMatches', JSON.stringify(matches));
            localStorage.setItem('matchCounter', matchCounter);
            renderTable();
        } else if (matches.length > 0) {
            // ถ้า Cloud ว่างแต่เครื่องเรามี ให้ซิงค์ขึ้น Cloud
            syncMatchesToCloud();
        }
    }, (err) => console.warn('Admin matches snapshot error:', err));

    // 2. ดักฟังผู้เล่นจาก Cloud (ซิงค์แบบ 2 ทาง รวมทั้งการเพิ่มและการลบ)
    db.collection('players').onSnapshot((snapshot) => {
        if (snapshot.empty && playerList.length > 0) {
            syncPlayersToCloud();
            return;
        }

        const cloudPlayers = [];
        snapshot.forEach(doc => {
            const pData = doc.data();
            const pName = pData.name || pData.nickname;
            if (pName && pName.trim()) {
                cloudPlayers.push({
                    name: pName.trim(),
                    isPresent: pData.isPresent !== false,
                    uid: doc.id,
                    fullName: pData.fullName || ''
                });
            }
        });

        cloudPlayers.sort((a, b) => a.name.localeCompare(b.name));
        playerList = cloudPlayers;
        localStorage.setItem('badmintonPlayers', JSON.stringify(playerList));
        renderPlayerList();
    }, (err) => console.warn('Admin players snapshot error:', err));
}

// ฟังก์ชันออกจากระบบ Admin
function logoutAdmin() {
    if (confirm('ต้องการออกจากระบบ Admin หรือไม่?')) {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('adminName');
        localStorage.removeItem('adminUid');
        sessionStorage.removeItem('isLoggedIn');
        sessionStorage.removeItem('adminName');
        sessionStorage.removeItem('adminUid');
        if (auth) {
            auth.signOut().catch(() => {});
        }
        window.location.href = 'login.html';
    }
}

// Failsafe 1: แก้บั้กบังคับเช็คตัวเลข (Integer) แบบเป๊ะๆ ไม่ให้มีปัญหาช่องว่างหรือ 01
function isCourtBusy(courtNumber) {
    return matches.some(match => parseInt(match.court) === parseInt(courtNumber) && (match.status === 'PLAYING' || match.status === 'CALLING'));
}

document.getElementById('addQueueForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const p1 = document.getElementById('p1').value.trim();
    const p2 = document.getElementById('p2').value.trim();
    const p3 = document.getElementById('p3').value.trim();
    const p4 = document.getElementById('p4').value.trim();

    const selectedPlayers = [p1, p2, p3, p4];

    const uniquePlayers = new Set(selectedPlayers);
    if (uniquePlayers.size < 4) {
        alert('ข้อผิดพลาด: มีชื่อผู้เล่นซ้ำกันในคิวนี้');
        return;
    }

    let absentPlayers = [];
    for (let name of selectedPlayers) {
        const playerObj = playerList.find(p => p.name === name);
        if (playerObj && playerObj.isPresent === false) {
            absentPlayers.push(name);
        }
    }
    if (absentPlayers.length > 0) {
        alert(`ไม่สามารถจัดคิวได้\n\nผู้เล่นต่อไปนี้มีสถานะ "ยังไม่มา":\n- ${absentPlayers.join('\n- ')}\n\nกรุณาเปลี่ยนสถานะในรายชื่อด้านซ้ายให้พร้อมก่อนครับ`);
        return;
    }

    let busyPlayers = [];
    matches.forEach(match => {
        if (match.status === 'WAITING' || match.status === 'PLAYING' || match.status === 'CALLING') {
            const matchPlayers = [...match.teamA, ...match.teamB];
            selectedPlayers.forEach(p => {
                if (matchPlayers.includes(p)) busyPlayers.push(p);
            });
        }
    });
    if (busyPlayers.length > 0) {
        const uniqueBusy = [...new Set(busyPlayers)];
        alert(`ไม่สามารถจองคิวซ้อนได้\n\nผู้เล่นต่อไปนี้มีชื่อค้างอยู่ในคิว "รอลงสนาม" หรือ "กำลังเล่น" แล้ว:\n- ${uniqueBusy.join('\n- ')}`);
        return;
    }

    const courtVal = document.getElementById('court').value;
    let assignedCourt = null;
    let initialStatus = 'WAITING';
    let initialCallingStartTime = null;

    if (courtVal !== 'auto' && courtVal) {
        assignedCourt = parseInt(courtVal);
    } else {
        // หาคอร์ทว่างใน 1-4
        for (let c = 1; c <= 4; c++) {
            if (!isCourtBusy(c)) {
                assignedCourt = c;
                initialStatus = 'CALLING';
                initialCallingStartTime = new Date();
                break;
            }
        }
    }

    const newMatch = {
        id: matchCounter++,
        teamA: [p1, p2],
        teamB: [p3, p4],
        court: assignedCourt,
        status: initialStatus,
        startTime: null,
        callingStartTime: initialCallingStartTime,
        playDuration: 0,
        scoreA: 0,
        scoreB: 0
    };

    matches.push(newMatch);
    saveData();
    clearFormInputs();
    renderTable();

    if (initialStatus === 'CALLING') {
        startCallingCountdown(newMatch.id);
    }
});

function openScoreModal(id) {
    const match = matches.find(m => String(m.id) === String(id));
    if (!match) {
        alert('ไม่พบข้อมูลคิวที่ ' + id);
        return;
    }
    currentEditingMatchId = match.id;
    document.getElementById('modalMatchId').innerText = match.id;
    document.getElementById('modalCourt').innerText = match.court || '-';
    const teamAStr = `${(match.teamA && match.teamA[0]) || '(ว่าง)'} / ${(match.teamA && match.teamA[1]) || '(ว่าง)'}`;
    const teamBStr = `${(match.teamB && match.teamB[0]) || '(ว่าง)'} / ${(match.teamB && match.teamB[1]) || '(ว่าง)'}`;
    document.getElementById('modalTeamA').innerText = teamAStr;
    document.getElementById('modalTeamB').innerText = teamBStr;
    document.getElementById('inputScoreA').value = '';
    document.getElementById('inputScoreB').value = '';
    document.getElementById('scoreModal').classList.remove('modal-hidden');
}

function closeScoreModal() {
    document.getElementById('scoreModal').classList.add('modal-hidden');
    currentEditingMatchId = null;
}

function confirmScore(withScore = true) {
    const scoreA = document.getElementById('inputScoreA').value;
    const scoreB = document.getElementById('inputScoreB').value;

    // ถ้า withScore=true แต่กรอกมาแค่ฝั่งเดียว ให้เตือน
    if (withScore && (scoreA !== '' || scoreB !== '') && (scoreA === '' || scoreB === '')) {
        return alert('กรุณากรอกคะแนนให้ครบทั้งสองทีม หรือกด "จบเกม (ไม่ระบุคะแนน)" หากไม่ต้องการบันทึกคะแนน');
    }

    const matchIndex = matches.findIndex(m => String(m.id) === String(currentEditingMatchId));
    if (matchIndex !== -1) {
        const courtNumber = matches[matchIndex].court;

        if (withScore && scoreA !== '' && scoreB !== '') {
            matches[matchIndex].scoreA = parseInt(scoreA) || 0;
            matches[matchIndex].scoreB = parseInt(scoreB) || 0;
        } else {
            matches[matchIndex].scoreA = null;
            matches[matchIndex].scoreB = null;
        }

        const startTime = matches[matchIndex].startTime ? new Date(matches[matchIndex].startTime) : new Date();
        const validStartTime = isNaN(startTime.getTime()) ? new Date() : startTime;
        matches[matchIndex].playDuration = Math.max(0, Math.floor((new Date() - validStartTime) / 1000));
        matches[matchIndex].status = 'FINISHED';
        saveData();
        renderTable();

        // ฟีเจอร์ 1: เรียกคิวถัดไปอัตโนมัติ
        autoCallNextQueue(courtNumber);
    } else {
        alert('เกิดข้อผิดพลาด: ไม่พบข้อมูลคิวที่กำลังบันทึกคะแนน');
    }
    closeScoreModal();
}


// =============================================
// ฟีเจอร์ 1: ระบบเรียกคิว Auto + Countdown 90s
// =============================================

function autoCallNextQueue(courtNumber) {
    if (!courtNumber) return;

    // 1. หาคิว WAITING ที่เจาะจงสนามนี้ไว้โดยเฉพาะ
    let nextMatch = matches.find(m =>
        parseInt(m.court) === parseInt(courtNumber) && m.status === 'WAITING'
    );

    // 2. ถ้าไม่มี ให้หาคิวแรกใน Central Queue ที่ยังไม่มีสนาม (หรือ auto) และมีผู้เล่นครบ 4 คน
    if (!nextMatch) {
        nextMatch = matches.find(m =>
            (!m.court || m.court === 'auto') && m.status === 'WAITING' &&
            [...(m.teamA || []), ...(m.teamB || [])].filter(n => n && n.trim().length > 0).length === 4
        );
    }

    if (nextMatch) {
        nextMatch.court = parseInt(courtNumber);
        nextMatch.status = 'CALLING';
        nextMatch.callingStartTime = new Date();
        saveData();
        renderTable();
        startCallingCountdown(nextMatch.id);
    }
}

function startCallingCountdown(matchId) {
    // เคลียร์ timer เก่าถ้ามี
    if (callingTimers[matchId] && callingTimers[matchId].intervalId) {
        clearInterval(callingTimers[matchId].intervalId);
    }

    const match = matches.find(m => m.id === matchId);
    if (!match || match.status !== 'CALLING') return;

    callingTimers[matchId] = {
        startTime: match.callingStartTime ? new Date(match.callingStartTime) : new Date(),
        intervalId: null
    };

    callingTimers[matchId].intervalId = setInterval(() => {
        const elapsed = Math.floor((new Date() - callingTimers[matchId].startTime) / 1000);
        const remaining = CALLING_TIMEOUT - elapsed;

        // อัปเดต countdown display
        const countdownEl = document.getElementById(`calling-countdown-${matchId}`);
        const barEl = document.getElementById(`calling-bar-${matchId}`);

        if (countdownEl) {
            countdownEl.innerText = `${remaining > 0 ? remaining : 0} วินาที`;
        }
        if (barEl) {
            const pct = Math.max(0, (remaining / CALLING_TIMEOUT) * 100);
            barEl.style.width = pct + '%';
        }

        // หมดเวลา → ข้ามคิว
        if (remaining <= 0) {
            skipQueue(matchId);
        }
    }, 1000);
}

function confirmReady(id) {
    const matchIndex = matches.findIndex(m => String(m.id) === String(id));
    if (matchIndex === -1) return;

    const idStr = String(id);
    if (callingTimers[idStr] && callingTimers[idStr].intervalId) {
        clearInterval(callingTimers[idStr].intervalId);
        delete callingTimers[idStr];
    }

    matches[matchIndex].status = 'PLAYING';
    matches[matchIndex].startTime = new Date();
    matches[matchIndex].callingStartTime = null;
    saveData();
    renderTable();
}

function skipQueue(id) {
    const matchIndex = matches.findIndex(m => String(m.id) === String(id));
    if (matchIndex === -1) return;

    const courtNumber = matches[matchIndex].court;
    const idStr = String(id);

    if (callingTimers[idStr] && callingTimers[idStr].intervalId) {
        clearInterval(callingTimers[idStr].intervalId);
        delete callingTimers[idStr];
    }

    matches[matchIndex].status = 'WAITING';
    matches[matchIndex].callingStartTime = null;

    const skippedMatch = matches.splice(matchIndex, 1)[0];
    matches.push(skippedMatch);

    saveData();
    renderTable();

    autoCallNextQueue(courtNumber);
}

function changeStatus(id, newStatus) {
    const matchIndex = matches.findIndex(m => String(m.id) === String(id));
    if (matchIndex === -1) return;

    if (newStatus === 'FINISHED') return openScoreModal(id);

    // Failsafe 2: ดักจับหากพยายามกด 'ลงสนาม'
    if (newStatus === 'PLAYING') {
        const m = matches[matchIndex];
        const allPlayers = [...(m.teamA || []), ...(m.teamB || [])].filter(n => n && n.trim().length > 0);
        if (allPlayers.length < 4) {
            if (!confirm(`คิวนี้มีผู้เล่นเพียง ${allPlayers.length} คน (ยังไม่ครบ 4 คน)\nต้องการให้ลงสนามเลยหรือไม่?`)) {
                return;
            }
        }
        if (isCourtBusy(matches[matchIndex].court)) {
            alert('ไม่สามารถลงสนามได้!\nคอร์ทนี้มีคิวอื่นกำลังเล่นอยู่ครับ');
            return;
        }
        matches[matchIndex].startTime = new Date();
    }

    matches[matchIndex].status = newStatus;
    saveData();
    renderTable();
}

function deleteMatch(id) {
    if (confirm(`ต้องการลบคิวที่ ${id} ใช่หรือไม่?`)) {
        const idStr = String(id);
        if (callingTimers[idStr] && callingTimers[idStr].intervalId) {
            clearInterval(callingTimers[idStr].intervalId);
            delete callingTimers[idStr];
        }
        matches = matches.filter(m => String(m.id) !== idStr);
        if (matches.length === 0) {
            matchCounter = 1;
            localStorage.setItem('matchCounter', 1);
        }
        saveData();
        renderTable();

        if (db) {
            db.collection('matches').doc(idStr).delete().catch(() => {});
        }
    }
}

function editCourt(id) {
    const matchIndex = matches.findIndex(m => String(m.id) === String(id));
    if (matchIndex === -1) return;

    const currentCourt = matches[matchIndex].court || '';
    const newCourt = prompt(`เลือกสนามสำหรับคิวที่ ${id} (กรอก 1, 2, 3, 4 หรือพิมพ์ 0 / ว่าง เพื่อตั้งเป็นคิวกลางอัตโนมัติ):`, currentCourt);
    if (newCourt === null) return;

    const trimmed = newCourt.trim();
    if (trimmed === '' || trimmed === '0' || trimmed.toLowerCase() === 'auto') {
        matches[matchIndex].court = null;
        saveData();
        renderTable();
        return;
    }

    const parsedCourt = parseInt(trimmed);
    if (parsedCourt >= 1 && parsedCourt <= 4) {
        if (matches[matchIndex].status === 'PLAYING') {
            const isNewCourtBusy = matches.some(m => String(m.id) !== String(id) && parseInt(m.court) === parsedCourt && m.status === 'PLAYING');
            if (isNewCourtBusy) {
                alert(`ย้ายไม่ได้!\nสนาม ${parsedCourt} มีคิวอื่นกำลังเล่นอยู่ครับ`);
                return;
            }
        }
        matches[matchIndex].court = parsedCourt;
        saveData();
        renderTable();
    } else {
        alert('กรุณาระบุเลขสนาม 1 ถึง 4 เท่านั้นครับ');
    }
}

function assignCourtToMatch(matchId) {
    const match = matches.find(m => String(m.id) === String(matchId));
    if (!match) return;

    for (let c = 1; c <= 4; c++) {
        if (!isCourtBusy(c)) {
            match.court = c;
            match.status = 'CALLING';
            match.callingStartTime = new Date();
            saveData();
            renderTable();
            startCallingCountdown(match.id);
            alert(`จัดสรรคิวที่ ${match.id} ลงสนาม ${c} และเริ่มเรียกคิวแล้ว`);
            return;
        }
    }
    alert('ขณะนี้สนาม 1-4 กำลังแข่งขันอยู่ทั้งหมด กรุณารอให้มีสนามแข่งขันเสร็จสิ้นครับ');
}

// ฟังก์ชันจัดเรียงหมายเลขคิวใหม่เริ่มต้นจากคิวที่ 1
function renumberMatches() {
    if (matches.length === 0) {
        matchCounter = 1;
        localStorage.setItem('matchCounter', 1);
        alert('ไม่มีคิวในระบบ รีเซ็ตตัวนับเริ่มต้นที่ 1 เรียบร้อยครับ');
        return;
    }

    if (confirm(`ต้องการจัดเรียงหมายเลขคิวทั้งหมดใหม่ (${matches.length} คิว) ให้เริ่มต้นจากคิวที่ 1 ใช่หรือไม่?`)) {
        // ลบเอกสารเก่าใน Firestore ก่อนซิงค์ใหม่
        if (db) {
            matches.forEach(m => {
                db.collection('matches').doc(String(m.id)).delete().catch(() => {});
            });
        }

        matches.forEach((m, idx) => {
            m.id = idx + 1;
        });
        matchCounter = matches.length + 1;
        localStorage.setItem('matchCounter', matchCounter);
        saveData();
        renderTable();
        alert('จัดเรียงหมายเลขคิวใหม่เริ่มต้นจากคิวที่ 1 เรียบร้อยแล้ว');
    }
}

function exportToCSV() {
    if (matches.length === 0) return alert('ไม่มีข้อมูล');
    let csvContent = '\uFEFFคิวที่,ทีม A,ทีม B,สนาม,สถานะ,เริ่มเวลา,เวลาที่ใช้แข่ง,คะแนนทีม A,คะแนนทีม B\n';
    matches.forEach(m => {
        const teamA = `${m.teamA[0]} และ ${m.teamA[1]}`; const teamB = `${m.teamB[0]} และ ${m.teamB[1]}`;
        const start = m.startTime ? m.startTime.toLocaleTimeString('th-TH') : '-';
        const duration = m.status === 'FINISHED' ? `${Math.floor(m.playDuration / 60)} นาที ${m.playDuration % 60} วิ` : (m.status === 'PLAYING' ? 'กำลังแข่ง' : '-');
        const statusTh = m.status === 'WAITING' ? 'รอลงสนาม' : (m.status === 'PLAYING' ? 'กำลังเล่น' : (m.status === 'CALLING' ? 'เรียกคิว' : 'จบเกม'));
        csvContent += `"${m.id}","${teamA}","${teamB}","${m.court}","${statusTh}","${start}","${duration}","${m.scoreA}","${m.scoreB}"\n`;
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `Queue_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

// =============================================
// ฟีเจอร์ 4: Quick Swap — สลับตัวผู้เล่น
// =============================================

function openSwapModal(matchId, team, playerIndex) {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    const oldName = team === 'A' ? match.teamA[playerIndex] : match.teamB[playerIndex];
    swapTarget = { matchId, team, playerIndex, oldName };

    document.getElementById('swapMatchId').innerText = matchId;
    document.getElementById('swapOldName').innerText = oldName;
    document.getElementById('swapSearchInput').value = '';
    document.getElementById('swapModal').classList.remove('modal-hidden');
    filterSwapPlayers();
}

function closeSwapModal() {
    document.getElementById('swapModal').classList.add('modal-hidden');
    swapTarget = null;
}

function filterSwapPlayers() {
    const searchText = document.getElementById('swapSearchInput').value.trim().toLowerCase();
    const container = document.getElementById('swapPlayerList');
    container.innerHTML = '';

    if (!swapTarget) return;

    // หาผู้เล่นที่ไม่ได้อยู่ในคิว WAITING/PLAYING/CALLING
    const busyNames = new Set();
    matches.forEach(m => {
        if (m.status === 'WAITING' || m.status === 'PLAYING' || m.status === 'CALLING') {
            [...m.teamA, ...m.teamB].forEach(name => busyNames.add(name));
        }
    });

    // ลบชื่อเก่าออกจาก busy (เพราะจะถูกแทนที่)
    busyNames.delete(swapTarget.oldName);

    const availablePlayers = playerList
        .filter(p => p.isPresent && !busyNames.has(p.name))
        .filter(p => p.name.toLowerCase().includes(searchText))
        .sort((a, b) => a.name.localeCompare(b.name));

    if (availablePlayers.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-400 dark:text-gray-500 text-center py-4">ไม่มีผู้เล่นที่พร้อม</p>';
        return;
    }

    availablePlayers.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'w-full text-left px-3 py-2 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-sm font-medium text-gray-700 dark:text-gray-300 transition';
        btn.innerHTML = p.name;
        btn.onclick = () => executeSwap(p.name);
        container.appendChild(btn);
    });
}

function executeSwap(newName) {
    if (!swapTarget) return;

    const matchIndex = matches.findIndex(m => m.id === swapTarget.matchId);
    if (matchIndex === -1) return;

    if (swapTarget.team === 'A') {
        matches[matchIndex].teamA[swapTarget.playerIndex] = newName;
    } else {
        matches[matchIndex].teamB[swapTarget.playerIndex] = newName;
    }

    saveData();
    renderTable();
    closeSwapModal();
}

// =============================================
// Render Table — รวมทุกสถานะ
// =============================================
function renderTable() {
    const tbody = document.getElementById('queueTableBody');
    tbody.innerHTML = '';
    matches.forEach(match => {
        const tr = document.createElement('tr');

        let statusText = 'รอลงสนาม', rowClass = 'text-gray-800 dark:text-gray-200', actionButton = '', trExtraClass = '';

        // สร้างปุ่ม swap สำหรับชื่อผู้เล่น (รองรับสล็อตว่าง)
        function playerNameWithSwap(matchId, team, idx, name, colorClass) {
            const hasName = name && name.trim().length > 0;
            const displayName = hasName ? name : '<span class="text-amber-500 dark:text-amber-400 font-semibold italic text-xs">(ว่าง)</span>';
            if (match.status === 'WAITING' || match.status === 'PLAYING' || match.status === 'CALLING') {
                return `<span class="${colorClass}">${displayName}</span><button onclick="openSwapModal(${matchId},'${team}',${idx})" class="ml-1 text-xs text-gray-400 hover:text-blue-500 opacity-60 hover:opacity-100 transition" title="${hasName ? 'สลับตัวผู้เล่น' : 'ใส่ผู้เล่นลงช่องนี้'}">✎</button>`;
            }
            return `<span class="${colorClass}">${displayName}</span>`;
        }

        const teamAHtml = `${playerNameWithSwap(match.id, 'A', 0, match.teamA[0], '')} <span class="text-gray-400">/</span> ${playerNameWithSwap(match.id, 'A', 1, match.teamA[1], '')}`;
        const teamBHtml = `${playerNameWithSwap(match.id, 'B', 0, match.teamB[0], '')} <span class="text-gray-400">/</span> ${playerNameWithSwap(match.id, 'B', 1, match.teamB[1], '')}`;

        if (match.status === 'WAITING') {
            if (!match.court || match.court === 'auto') {
                actionButton = `<button onclick="assignCourtToMatch(${match.id})" class="bg-indigo-600 text-white w-full px-2 py-1.5 rounded text-xs hover:bg-indigo-700 mb-1 font-bold shadow-sm">จัดลงสนามว่าง</button>`;
            } else if (isCourtBusy(match.court)) {
                actionButton = `<button disabled class="bg-gray-300 dark:bg-gray-700 text-gray-500 w-full px-2 py-1 rounded text-xs cursor-not-allowed mb-1 font-bold">สนาม ${match.court} ไม่ว่าง</button>`;
            } else {
                actionButton = `<button onclick="changeStatus(${match.id}, 'PLAYING')" class="bg-blue-500 text-white w-full px-2 py-1 rounded text-sm hover:bg-blue-600 mb-1 font-bold">ลงสนาม ${match.court}</button>`;
            }
            actionButton += `<div class="flex gap-1"><button onclick="editCourt(${match.id})" class="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs flex-1 font-semibold">แก้สนาม</button><button onclick="deleteMatch(${match.id})" class="bg-gray-400 hover:bg-gray-500 text-white px-2 py-1 rounded text-xs flex-1 font-semibold">ลบ</button></div>`;
        } else if (match.status === 'CALLING') {
            // สถานะเรียกคิว
            statusText = `<span class="text-amber-500 font-bold">เรียกคิว</span> <span class="dot-pulse-amber"></span>
                <br><span class="text-xs text-amber-600 dark:text-amber-400 font-normal" id="calling-countdown-${match.id}">${CALLING_TIMEOUT} วินาที</span>
                <div class="countdown-bar-track mt-1"><div class="countdown-bar-fill" id="calling-bar-${match.id}" style="width:100%"></div></div>`;
            rowClass = 'status-calling dark:text-amber-400';
            trExtraClass = 'row-calling';
            actionButton = `
                <button onclick="confirmReady(${match.id})" class="bg-green-500 text-white w-full px-2 py-1 rounded text-sm hover:bg-green-600 mb-1 font-bold">พร้อม</button>
                <button onclick="skipQueue(${match.id})" class="bg-orange-500 text-white w-full px-2 py-1 rounded text-sm hover:bg-orange-600 font-bold">ข้าม</button>
            `;
        } else if (match.status === 'PLAYING') {
            const st = match.startTime ? match.startTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '';
            statusText = `กำลังเล่น <span class="dot-pulse"></span><br><span class="text-xs text-blue-500 font-normal">เริ่ม ${st} <span class="bg-blue-100 px-1 rounded timer-font" id="timer-${match.id}">00:00</span></span>`;
            rowClass = 'status-playing dark:text-blue-400';
            actionButton = `<button onclick="changeStatus(${match.id}, 'FINISHED')" class="bg-red-500 text-white w-full h-[50px] rounded text-sm font-bold">บันทึกคะแนน</button>`;
        } else if (match.status === 'FINISHED') {
            statusText = `จบเกม <br><span class="text-xs text-gray-500">[ ${Math.floor(match.playDuration / 60)} นาที ${match.playDuration % 60} วิ ]</span>`;
            rowClass = 'status-finished dark:text-gray-500';
            actionButton = `<div class="font-bold text-center bg-gray-100 dark:bg-gray-700 rounded py-2 px-2 text-lg">${match.scoreA} - ${match.scoreB}</div>`;
        }

        let courtDisplay = '';
        if (match.court && match.court !== 'auto') {
            courtDisplay = match.status === 'WAITING'
                ? `<div onclick="editCourt(${match.id})" class="rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 w-8 h-8 flex items-center justify-center mx-auto cursor-pointer font-bold" title="คลิกเพื่อเปลี่ยนสนาม">${match.court}</div>`
                : `<div class="rounded-full bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 w-8 h-8 flex items-center justify-center mx-auto font-bold">${match.court}</div>`;
        } else {
            courtDisplay = `<button onclick="editCourt(${match.id})" class="px-2 py-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-xs font-bold whitespace-nowrap shadow-sm hover:bg-amber-200 transition" title="คลิกเพื่อกำหนดสนาม">รอจัดสนาม</button>`;
        }

        tr.className = `hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b dark:border-gray-700 ${trExtraClass}`;

        tr.innerHTML = `
            <td class="p-2 text-center font-bold ${rowClass}">${match.id}</td>
            <td class="p-2 ${rowClass}">${teamAHtml}</td>
            <td class="p-2 ${rowClass}">${teamBHtml}</td>
            <td class="p-2 text-center">${courtDisplay}</td>
            <td class="p-2 text-center ${rowClass}">${statusText}</td>
            <td class="p-2 align-middle">${actionButton}</td>
        `;
        tbody.appendChild(tr);
    });
}

// =============================================
// ฟีเจอร์ 3: ระบบรายงานปัญหา (Admin side)
// =============================================

// toggleReportPanel และ openReportPanel
// ปรับให้ทำงานเป็น Tab Switch แทน Accordion
function toggleReportPanel() {
    if (typeof switchAdminTab === 'function') {
        switchAdminTab('report');
    }
}

function openReportPanel() {
    if (typeof switchAdminTab === 'function') {
        switchAdminTab('report');
        // Scroll ให้ Tab อยู่ใน viewport
        const tabArea = document.getElementById('tabBtn-report');
        if (tabArea) tabArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function renderReports() {
    const reports = JSON.parse(localStorage.getItem('problemReports')) || [];
    const container = document.getElementById('reportListContainer');
    const badge = document.getElementById('reportCountBadge');

    if (!container) return;

    const unreadCount = reports.filter(r => !r.isRead).length;
    // Badge จัดการผ่าน updateReportBadge() แล้ว — ไม่ต้อง overwrite className ที่นี่

    if (reports.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-400 dark:text-gray-500 text-center py-6">ไม่มีรายงานปัญหา</p>';
        return;
    }

    container.innerHTML = '';
    // แสดงรายงานใหม่สุดก่อน
    [...reports].reverse().forEach((report, reverseIdx) => {
        const idx = reports.length - 1 - reverseIdx;
        const date = new Date(report.timestamp).toLocaleString('th-TH');
        const readClass = report.isRead ? 'opacity-60' : '';
        const unreadDot = report.isRead ? '' : '<span class="w-2 h-2 bg-orange-500 rounded-full shrink-0"></span>';

        const div = document.createElement('div');
        div.className = `bg-gray-50 dark:bg-gray-700/50 border dark:border-gray-600 rounded-lg p-3 ${readClass} transition`;
        div.innerHTML = `
            <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                        ${unreadDot}
                        <span class="font-bold text-sm text-gray-800 dark:text-gray-200 truncate">${report.subject}</span>
                    </div>
                    <p class="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-line break-words">${report.detail}</p>
                    <p class="text-[10px] text-gray-400 mt-1.5">${date} — จาก: ${report.page || 'ไม่ระบุ'}</p>
                </div>
                <div class="flex gap-1 shrink-0">
                    ${!report.isRead ? `<button onclick="markReportRead(${idx})" class="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded hover:bg-blue-200 transition" title="อ่านแล้ว">✓</button>` : ''}
                    <button onclick="deleteReport(${idx})" class="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-1 rounded hover:bg-red-200 transition" title="ลบ">✕</button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

function markReportRead(index) {
    const reports = JSON.parse(localStorage.getItem('problemReports')) || [];
    if (reports[index]) {
        reports[index].isRead = true;
        localStorage.setItem('problemReports', JSON.stringify(reports));
        renderReports();
        updateReportBadge();
    }
}

function deleteReport(index) {
    const reports = JSON.parse(localStorage.getItem('problemReports')) || [];
    reports.splice(index, 1);
    localStorage.setItem('problemReports', JSON.stringify(reports));
    renderReports();
    updateReportBadge();
}

function clearAllReports() {
    if (confirm('ลบรายงานปัญหาทั้งหมด?')) {
        localStorage.setItem('problemReports', JSON.stringify([]));
        renderReports();
        updateReportBadge();
    }
}

function updateReportBadge() {
    const reports = JSON.parse(localStorage.getItem('problemReports')) || [];
    const unread = reports.filter(r => !r.isRead).length;

    // Badge บนปุ่ม Navbar (รายงานปัญหา)
    const navBadge = document.getElementById('reportBadge');
    if (navBadge) {
        if (unread > 0) {
            navBadge.innerText = unread;
            navBadge.classList.remove('hidden');
        } else {
            navBadge.classList.add('hidden');
        }
    }

    // Badge บนแท็บ (reportCountBadge) ใน Admin Tabbed View
    const tabBadge = document.getElementById('reportCountBadge');
    if (tabBadge) {
        if (unread > 0) {
            tabBadge.textContent = unread;
            tabBadge.classList.remove('hidden');
        } else {
            tabBadge.classList.add('hidden');
        }
    }
}

// ดักจับ storage event เพื่ออัปเดตข้ามแท็บ
window.addEventListener('storage', function (e) {
    if (e.key === 'badmintonMatches') {
        matches = JSON.parse(e.newValue || '[]');
        matches.forEach(m => {
            if (m.startTime) m.startTime = new Date(m.startTime);
            if (m.callingStartTime) m.callingStartTime = new Date(m.callingStartTime);
        });
        renderTable();
    }
    if (e.key === 'badmintonPlayers') {
        playerList = JSON.parse(e.newValue || '[]').map(p => typeof p === 'string' ? { name: p, isPresent: true } : p);
        renderPlayerList();
    }
    if (e.key === 'problemReports') {
        renderReports();
        updateReportBadge();
    }
    if (e.key === 'badmintonHistory') {
        renderHistoryPanel();
    }
});

function startLiveTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        matches.forEach(match => {
            if (match.status === 'PLAYING' && match.startTime) {
                const diff = Math.floor((new Date() - match.startTime) / 1000);
                const el = document.getElementById(`timer-${match.id}`);
                if (el) el.innerText = `${Math.floor(diff / 60).toString().padStart(2, '0')}:${(diff % 60).toString().padStart(2, '0')}`;
            }
        });
    }, 1000);
}

window.onload = loadData;

// =============================================
// ฟีเจอร์ 5: ระบบประวัติการเล่น (History Match)
// =============================================

// ===== Admin Tab System =====
let currentAdminTab = 'queue';

function switchAdminTab(tab) {
    const tabs = ['queue', 'history', 'report'];
    currentAdminTab = tab;

    tabs.forEach(t => {
        const btn = document.getElementById(`tabBtn-${t}`);
        const panel = document.getElementById(`tabPanel-${t}`);
        if (!btn || !panel) return;

        if (t === tab) {
            // Active tab styles
            panel.classList.remove('hidden');
            if (t === 'queue') {
                btn.className = 'admin-tab-btn flex-1 py-3 text-sm font-semibold text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 transition';
            } else if (t === 'history') {
                btn.className = 'admin-tab-btn flex-1 py-3 text-sm font-semibold text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 transition';
            } else if (t === 'report') {
                btn.className = 'admin-tab-btn flex-1 py-3 text-sm font-semibold text-orange-600 dark:text-orange-400 border-b-2 border-orange-600 dark:border-orange-400 transition relative';
            }
        } else {
            // Inactive tab styles
            panel.classList.add('hidden');
            const baseClass = 'admin-tab-btn flex-1 py-3 text-sm font-semibold text-gray-500 dark:text-gray-400 border-b-2 border-transparent transition';
            btn.className = t === 'report' ? baseClass + ' relative' : baseClass;
        }
    });
}
// ============================

function saveToHistory() {
    const finishedMatches = matches.filter(m => m.status === 'FINISHED');
    if (finishedMatches.length === 0) {
        alert('ไม่มีแมตช์ที่จบเกมแล้ว\nต้องมีแมตช์สถานะ "จบเกม" อย่างน้อย 1 คิว จึงจะบันทึกได้');
        return;
    }

    // เช็คว่ามีคิวที่ยังไม่จบอยู่หรือไม่
    const activeMatches = matches.filter(m => m.status === 'PLAYING' || m.status === 'CALLING');
    if (activeMatches.length > 0) {
        if (!confirm(`ยังมี ${activeMatches.length} คิวที่กำลังเล่น/เรียกอยู่\nต้องการบันทึกเฉพาะแมตช์ที่จบแล้วหรือไม่?`)) {
            return;
        }
    }

    const today = new Date().toISOString().split('T')[0];
    const history = JSON.parse(localStorage.getItem('badmintonHistory')) || [];

    // บันทึกแต่ละแมตช์ที่ FINISHED เข้า history
    finishedMatches.forEach(m => {
        history.push({
            id: m.id,
            teamA: [...m.teamA],
            teamB: [...m.teamB],
            court: m.court,
            scoreA: m.scoreA,
            scoreB: m.scoreB,
            playDuration: m.playDuration,
            startTime: m.startTime,
            date: today,
            savedAt: new Date().toISOString()
        });
    });

    localStorage.setItem('badmintonHistory', JSON.stringify(history));

    // ลบแมตช์ที่จบแล้วออกจากกระดานคิวสด
    matches = matches.filter(m => m.status !== 'FINISHED');
    saveData();
    renderTable();
    renderHistoryPanel();

    alert(`บันทึกเข้าประวัติเรียบร้อย ${finishedMatches.length} แมตช์`);
}

function renderHistoryPanel() {
    const history = JSON.parse(localStorage.getItem('badmintonHistory')) || [];
    const tbody = document.getElementById('historyTableBody');
    const badge = document.getElementById('historyCountBadge');
    const emptyMsg = document.getElementById('historyEmptyMsg');
    if (!tbody) return;

    // กรองตามวันที่ (ถ้ามี)
    const dateFilter = document.getElementById('historyDateFilter');
    const filterDate = dateFilter ? dateFilter.value : '';

    const filtered = filterDate
        ? history.filter(h => h.date === filterDate)
        : history;

    // อัปเดต Badge บนแท็บ — แสดงเมื่อมีประวัติ
    if (badge) {
        if (history.length > 0) {
            badge.textContent = history.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.classList.remove('hidden');
        emptyMsg.innerText = filterDate
            ? `ไม่พบประวัติในวันที่เลือก`
            : 'ยังไม่มีประวัติการเล่น';
        return;
    }

    emptyMsg.classList.add('hidden');
    tbody.innerHTML = '';

    // แสดงรายการใหม่สุดก่อน
    [...filtered].reverse().forEach(h => {
        const dur = h.playDuration
            ? `${Math.floor(h.playDuration / 60)} น. ${h.playDuration % 60} วิ`
            : '-';
        const teamA = `${h.teamA[0]} / ${h.teamA[1]}`;
        const teamB = `${h.teamB[0]} / ${h.teamB[1]}`;

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300';
        tr.innerHTML = `
            <td class="p-2 text-center font-bold">${h.id}</td>
            <td class="p-2 text-blue-600 dark:text-blue-400">${teamA}</td>
            <td class="p-2 text-red-500 dark:text-red-400">${teamB}</td>
            <td class="p-2 text-center">${h.court}</td>
            <td class="p-2 text-center font-bold">${h.scoreA} - ${h.scoreB}</td>
            <td class="p-2 text-center text-xs">${dur}</td>
            <td class="p-2 text-center text-xs">${h.date}</td>
        `;
        tbody.appendChild(tr);
    });
}

function exportHistoryCSV() {
    const history = JSON.parse(localStorage.getItem('badmintonHistory')) || [];

    // กรองตามวันที่ (ถ้ามี)
    const dateFilter = document.getElementById('historyDateFilter');
    const filterDate = dateFilter ? dateFilter.value : '';
    const filtered = filterDate
        ? history.filter(h => h.date === filterDate)
        : history;

    if (filtered.length === 0) return alert('ไม่มีข้อมูลสำหรับส่งออก');

    let csvContent = '\uFEFFคิวที่,ทีม A,ทีม B,สนาม,คะแนนทีม A,คะแนนทีม B,เวลาที่ใช้แข่ง,วันที่\n';
    filtered.forEach(h => {
        const teamA = `${h.teamA[0]} และ ${h.teamA[1]}`;
        const teamB = `${h.teamB[0]} และ ${h.teamB[1]}`;
        const dur = h.playDuration
            ? `${Math.floor(h.playDuration / 60)} นาที ${h.playDuration % 60} วิ`
            : '-';
        csvContent += `"${h.id}","${teamA}","${teamB}","${h.court}","${h.scoreA}","${h.scoreB}","${dur}","${h.date}"\n`;
    });

    const link = document.createElement('a');
    const filename = filterDate
        ? `History_${filterDate}.csv`
        : `History_All_${new Date().toISOString().split('T')[0]}.csv`;
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = filename;
    link.click();
}

function clearAllHistory() {
    const history = JSON.parse(localStorage.getItem('badmintonHistory')) || [];
    if (history.length === 0) return alert('ไม่มีประวัติให้ลบ');
    if (confirm(`ต้องการลบประวัติทั้งหมด ${history.length} รายการ?`)) {
        localStorage.setItem('badmintonHistory', JSON.stringify([]));
        renderHistoryPanel();
    }
}

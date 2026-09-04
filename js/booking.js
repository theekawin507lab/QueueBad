/* =============================================
   booking.js — JavaScript สำหรับหน้าจองคิวแบดมินตัน
   =============================================
   [STATUS: DRAFT / ยังไม่ได้ใช้งาน]
   ไฟล์นี้เป็นโค้ดต้นแบบสำหรับฟีเจอร์ "ผู้เล่นลงคิวเองผ่านมือถือ 4 คน"
   ซึ่งยังไม่ได้นำไปใช้ใน HTML ไหน
   หากต้องการต่อยอดในอนาคต สามารถนำโค้ดนี้มาสร้าง self-booking.html ได้
   ============================================= */

let selectedPlayers = [];
const MAX_PLAYERS = 4;

// โหลดรายชื่อผู้เล่นที่พร้อม
function loadAvailablePlayers() {
    const rawPlayers = JSON.parse(localStorage.getItem('badmintonPlayers')) || [];
    const players = rawPlayers
        .filter(p => {
            const n = typeof p === 'string' ? p : (p && p.name);
            return n && !['วา-ขาจร', 'ยันต์69', 'คริสตัน', 'ชัยโรงสี'].includes(n.trim());
        })
        .map(p => typeof p === 'string' ? { name: p, isPresent: true } : p);
    return players.filter(p => p.isPresent).sort((a, b) => a.name.localeCompare(b.name));
}

// โหลดรายชื่อผู้เล่นที่กำลังอยู่ในคิว (WAITING / PLAYING)
function getPlayersInActiveQueue() {
    const matches = JSON.parse(localStorage.getItem('badmintonMatches')) || [];
    const busyNames = new Set();
    matches.forEach(m => {
        if (m.status === 'WAITING' || m.status === 'PLAYING') {
            [...m.teamA, ...m.teamB].forEach(name => busyNames.add(name));
        }
    });
    return busyNames;
}

// Render รายชื่อผู้เล่นให้เลือก
function renderPlayerSelection() {
    const container = document.getElementById('playerGrid');
    container.innerHTML = '';

    const availablePlayers = loadAvailablePlayers();
    const busyPlayers = getPlayersInActiveQueue();

    if (availablePlayers.length === 0) {
        container.innerHTML = '<p class="text-gray-400 dark:text-gray-500 text-center col-span-full py-8">ยังไม่มีผู้เล่นในระบบ หรือทุกคนยังไม่มา</p>';
        return;
    }

    availablePlayers.forEach(player => {
        const isBusy = busyPlayers.has(player.name);
        const isSelected = selectedPlayers.includes(player.name);
        const slotIndex = selectedPlayers.indexOf(player.name);

        const div = document.createElement('div');

        if (isBusy) {
            div.className = 'player-card relative border-2 border-gray-200 dark:border-gray-600 rounded-xl p-3 opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-700/50';
            div.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="text-lg">⏳</span>
                    <span class="font-medium text-gray-400 dark:text-gray-500 text-sm">${player.name}</span>
                </div>
                <span class="text-xs text-orange-500 dark:text-orange-400 mt-1 block">อยู่ในคิวแล้ว</span>
            `;
        } else {
            div.className = `player-card relative border-2 rounded-xl p-3 ${isSelected
                ? 'selected'
                : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 hover:border-blue-300 dark:hover:border-blue-500'}`;
            div.onclick = () => togglePlayer(player.name);

            let slotLabel = '';
            if (isSelected) {
                const teamLabel = slotIndex < 2 ? 'A' : 'B';
                const teamColor = slotIndex < 2
                    ? 'bg-blue-500 text-white'
                    : 'bg-red-500 text-white';
                slotLabel = `<span class="slot-badge ${teamColor}">ทีม ${teamLabel}</span>`;
            }

            div.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="text-lg">${isSelected ? '✅' : '🏸'}</span>
                        <span class="font-medium text-gray-700 dark:text-gray-200 text-sm">${player.name}</span>
                    </div>
                    <div class="flex items-center gap-1">
                        ${slotLabel}
                        <div class="player-check w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                            <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
                            </svg>
                        </div>
                    </div>
                </div>
            `;
        }

        container.appendChild(div);
    });
}

// สลับเลือก/ยกเลิกเลือกผู้เล่น
function togglePlayer(name) {
    const idx = selectedPlayers.indexOf(name);
    if (idx !== -1) {
        selectedPlayers.splice(idx, 1);
    } else {
        if (selectedPlayers.length >= MAX_PLAYERS) {
            showToast('⚠️ เลือกได้สูงสุด 4 คน! ยกเลิกคนเดิมก่อนครับ', 'warning');
            return;
        }
        selectedPlayers.push(name);
    }
    renderPlayerSelection();
    updateSlotDisplay();
    updateBookingButton();
}

// อัปเดตแสดง Slot ที่เลือก
function updateSlotDisplay() {
    for (let i = 1; i <= 4; i++) {
        const slot = document.getElementById(`slot${i}`);
        const name = selectedPlayers[i - 1] || '';
        const label = slot.querySelector('.slot-name');
        const container = slot;

        if (name) {
            label.textContent = name;
            container.classList.add('slot-filled');
            container.classList.remove('border-dashed');
        } else {
            const teamLabel = i <= 2 ? 'ทีม A' : 'ทีม B';
            label.textContent = `ผู้เล่นคนที่ ${i} (${teamLabel})`;
            container.classList.remove('slot-filled');
            container.classList.add('border-dashed');
        }
    }

    // อัปเดตจำนวนที่เลือก
    document.getElementById('selectedCount').textContent = `${selectedPlayers.length}/${MAX_PLAYERS}`;
    const countEl = document.getElementById('selectedCount');
    if (selectedPlayers.length === MAX_PLAYERS) {
        countEl.className = 'text-sm font-bold text-green-600 dark:text-green-400';
    } else {
        countEl.className = 'text-sm font-bold text-gray-500 dark:text-gray-400';
    }
}

// อัปเดตปุ่มจอง
function updateBookingButton() {
    const btn = document.getElementById('bookingBtn');
    const courtInput = document.getElementById('courtInput');
    const ready = selectedPlayers.length === MAX_PLAYERS && courtInput.value && parseInt(courtInput.value) > 0;

    btn.disabled = !ready;
    if (ready) {
        btn.className = 'w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg hover:from-green-600 hover:to-emerald-700 transition-all transform hover:scale-[1.02] active:scale-95 text-lg';
    } else {
        btn.className = 'w-full bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 font-bold py-4 rounded-xl cursor-not-allowed text-lg';
    }
}

// ส่งจองคิว
function submitBooking() {
    const courtInput = document.getElementById('courtInput');
    const courtNumber = parseInt(courtInput.value);

    if (selectedPlayers.length < MAX_PLAYERS) {
        showToast('❌ กรุณาเลือกผู้เล่นให้ครบ 4 คน', 'error');
        return;
    }
    if (!courtNumber || courtNumber < 1) {
        showToast('❌ กรุณาระบุหมายเลขสนาม', 'error');
        courtInput.classList.add('shake');
        setTimeout(() => courtInput.classList.remove('shake'), 500);
        return;
    }

    // ตรวจซ้ำ (กันกรณี race condition)
    const busyPlayers = getPlayersInActiveQueue();
    const conflicting = selectedPlayers.filter(p => busyPlayers.has(p));
    if (conflicting.length > 0) {
        showToast(`🚫 ผู้เล่น ${conflicting.join(', ')} อยู่ในคิวแล้ว`, 'error');
        return;
    }

    // สร้าง Match ใหม่
    let matches = JSON.parse(localStorage.getItem('badmintonMatches')) || [];
    let matchCounter = parseInt(localStorage.getItem('matchCounter')) || 1;

    const newMatch = {
        id: matchCounter++,
        teamA: [selectedPlayers[0], selectedPlayers[1]],
        teamB: [selectedPlayers[2], selectedPlayers[3]],
        court: courtNumber,
        status: 'WAITING',
        startTime: null,
        playDuration: 0,
        scoreA: 0,
        scoreB: 0
    };

    matches.push(newMatch);
    localStorage.setItem('badmintonMatches', JSON.stringify(matches));
    localStorage.setItem('matchCounter', matchCounter);

    // แสดง Success
    showToast('✅ จองคิวสำเร็จ! รอ Admin ลงสนามครับ', 'success');

    // Reset ฟอร์ม
    selectedPlayers = [];
    courtInput.value = '';
    renderPlayerSelection();
    updateSlotDisplay();
    updateBookingButton();
    renderMiniQueue();
}

// Toast Notification
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');

    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500'
    };

    toast.className = `${colors[type]} text-white px-6 py-3 rounded-xl shadow-2xl text-sm font-medium success-anim flex items-center gap-2`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'all 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Render คิวปัจจุบัน (mini view)
function renderMiniQueue() {
    const matches = JSON.parse(localStorage.getItem('badmintonMatches')) || [];
    const container = document.getElementById('miniQueueList');
    container.innerHTML = '';

    const activeMatches = matches.filter(m => m.status === 'WAITING' || m.status === 'PLAYING');

    if (activeMatches.length === 0) {
        container.innerHTML = '<p class="text-gray-400 dark:text-gray-500 text-center py-6 text-sm">ยังไม่มีคิวในขณะนี้</p>';
        return;
    }

    activeMatches.forEach(match => {
        const div = document.createElement('div');
        const isPlaying = match.status === 'PLAYING';

        div.className = `mini-queue-card flex items-center gap-3 p-3 rounded-lg border ${isPlaying
            ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30'}`;

        const statusBadge = isPlaying
            ? '<span class="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">กำลังเล่น</span>'
            : '<span class="bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs px-2 py-0.5 rounded-full font-medium">รอคิว</span>';

        div.innerHTML = `
            <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center font-bold text-sm">${match.court}</div>
            <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                    ${match.teamA.join(' / ')} <span class="text-gray-400 mx-1">vs</span> ${match.teamB.join(' / ')}
                </div>
            </div>
            <div>${statusBadge}</div>
        `;
        container.appendChild(div);
    });
}

// ดัก localStorage เปลี่ยนจากแท็บอื่น
window.addEventListener('storage', function (e) {
    if (e.key === 'badmintonMatches' || e.key === 'badmintonPlayers') {
        renderPlayerSelection();
        renderMiniQueue();
    }
});

// โหลดหน้า
window.onload = function () {
    initTheme();
    renderPlayerSelection();
    updateSlotDisplay();
    updateBookingButton();
    renderMiniQueue();

    // ผูก event listener
    document.getElementById('courtInput').addEventListener('input', updateBookingButton);
    document.getElementById('bookingBtn').addEventListener('click', submitBooking);
    document.getElementById('clearBtn').addEventListener('click', function () {
        selectedPlayers = [];
        document.getElementById('courtInput').value = '';
        renderPlayerSelection();
        updateSlotDisplay();
        updateBookingButton();
    });
};

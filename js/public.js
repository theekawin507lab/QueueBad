/* =============================================
   public.js — JavaScript สำหรับหน้า Public Dashboard & Player Profile
   เฟส 2: ระบบห้องคิว (Lobby), สร้างคิว, เข้าร่วมคิว (Join), และ Self Check-in
   ============================================= */

let matches = [];
let onlinePlayersList = [];
let timerInterval = null;
let currentUserProfile = null;
let currentJoiningMatchId = null;

// ซิงค์เซสชันจาก localStorage เข้าสู่ sessionStorage อัตโนมัติ เพื่อรักษาเซสชันเมื่อเปิดแท็บใหม่หรือรีเฟรช
['isPlayerLoggedIn', 'playerUid', 'playerNickname', 'playerData', 'isLoggedIn', 'adminName', 'adminUid'].forEach(key => {
    const val = localStorage.getItem(key);
    if (val && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, val);
    }
});

// ฟังก์ชันแสดงวันที่
function displayDate() {
    const dateOpts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateEl = document.getElementById('currentDateDisplay');
    if (dateEl) {
        dateEl.innerText = new Date().toLocaleDateString('th-TH', dateOpts);
    }
}

// โหลดข้อมูลเริ่มต้น (จาก LocalStorage + Firebase Firestore)
function loadData() {
    // 1. โหลดจาก LocalStorage มาแสดงผลก่อนทันทีเพื่อความเร็ว
    const savedMatches = localStorage.getItem('badmintonMatches');
    if (savedMatches) {
        try {
            matches = JSON.parse(savedMatches) || [];
            matches.forEach(m => {
                if (m.startTime) {
                    const d = new Date(m.startTime);
                    m.startTime = isNaN(d.getTime()) ? null : d;
                }
                if (m.callingStartTime) {
                    const d = new Date(m.callingStartTime);
                    m.callingStartTime = isNaN(d.getTime()) ? null : d;
                }
            });
        } catch (e) {
            matches = [];
        }
    }
    displayDate();
    renderDashboard();
    renderOnlinePlayers();
    checkMyQueueStatus();

    // 2. เชื่อมต่อ Firebase Real-time Listener (Cloud Sync)
    initFirestoreListeners();
}

// ฟังก์ชันจัดรูปแบบเวลาอย่างปลอดภัย ไม่ error แม้เวลาไม่ถูกต้อง
function formatTimeSafe(dateVal) {
    if (!dateVal) return '';
    try {
        const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '';
    }
}

// =============================================
// ระบบ Firebase Firestore Real-time Listeners
// =============================================
function initFirestoreListeners() {
    if (!db) {
        console.warn('Firebase DB ยังไม่พร้อมใช้งาน ใช้โหมด LocalStorage');
        return;
    }

    const cloudBadge = document.getElementById('cloudSyncBadge');
    if (cloudBadge) cloudBadge.classList.remove('hidden');

    // 1. ดักฟังการเปลี่ยนแปลงของ Matches (คิวการแข่งขัน) แบบ Real-time
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

        cloudMatches.sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));
        matches = cloudMatches;
        localStorage.setItem('badmintonMatches', JSON.stringify(matches));
        renderDashboard();
        checkMyQueueStatus();
    }, (error) => {
        console.warn('Firestore Matches Listener Error:', error);
    });

    const LEGACY_DUMMY_NAMES = ['วา-ขาจร', 'ยันต์69', 'คริสตัน', 'ชัยโรงสี'];

    // 2. ดักฟังรายชื่อผู้เล่นที่มาสนาม (Players Presence) แบบ Real-time
    db.collection('players').onSnapshot((snapshot) => {
        const cloudPlayers = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const name = data.name || data.nickname;
            if (name && name.trim()) {
                const trimmedName = name.trim();
                if (LEGACY_DUMMY_NAMES.includes(trimmedName) || LEGACY_DUMMY_NAMES.includes(doc.id.trim())) {
                    return;
                }
                cloudPlayers.push({
                    name: trimmedName,
                    isPresent: data.isPresent !== false,
                    fullName: data.fullName || '',
                    uid: doc.id
                });
            }
        });

        cloudPlayers.sort((a, b) => a.name.localeCompare(b.name));
        onlinePlayersList = cloudPlayers;
        renderOnlinePlayers(cloudPlayers);
        updateSelfPresenceUI();
    }, (error) => {
        console.warn('Firestore Players Listener Error:', error);
    });
}

// ดักจับการเปลี่ยนแปลงข้ามแท็บ (กรณีเปิดบนเครื่องเดียวกัน)
window.addEventListener('storage', function (e) {
    if (e.key === 'badmintonMatches' || e.key === 'badmintonPlayers') {
        loadData();
    }
});

// ตรวจสอบว่าผู้เล่นคนนี้อยู่ในคิวที่กำลังแข่ง/รออยู่หรือไม่ (Single Queue Rule)
function getActiveMatchForUser(nickname) {
    if (!nickname) return null;
    return matches.find(m =>
        (m.status === 'PLAYING' || m.status === 'CALLING' || m.status === 'WAITING') &&
        [...(m.teamA || []), ...(m.teamB || [])].includes(nickname)
    );
}

// ==========================================
// ฟังก์ชันวาด Dashboard แยกตามสนาม
// ==========================================
// ==========================================
// ฟังก์ชันวาด Dashboard แยกตามสนาม (จำกัด 4 สนามคงที่)
// และกระดานคิวกลาง (Central Queue)
// ==========================================
const TOTAL_COURTS = 4;

// ฟังก์ชันจัดรูปแบบชื่อผู้เล่นในคิว (ไฮไลต์ชื่อตนเองเป็นสีเขียว + ปรับสีทีม B ให้เป็นสีเดียวกับทีม A)
function formatPlayerForQueue(name, currentNickname) {
    if (!name || name === '(ว่าง)' || !name.trim()) {
        return '<span class="text-slate-400 font-normal italic">(ว่าง)</span>';
    }
    const cleanName = name.trim();
    const isMe = currentNickname && (cleanName.toLowerCase() === currentNickname.trim().toLowerCase());
    if (isMe) {
        return `<span class="text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-50 dark:bg-emerald-950/70 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-700 shadow-sm inline-block">👤 ${cleanName} (คุณ)</span>`;
    }
    return `<span class="text-blue-600 dark:text-blue-400 font-bold">${cleanName}</span>`;
}

function renderDashboard() {
    const dashboard = document.getElementById('courtsDashboard');
    if (!dashboard) return;
    dashboard.innerHTML = '';

    const CALLING_TIMEOUT = 90;
    const currentNickname = sessionStorage.getItem('playerNickname') || localStorage.getItem('playerNickname') || '';
    const userActiveMatch = getActiveMatchForUser(currentNickname);

    // วาดการ์ด 4 สนามคงที่ (สนาม 1 ถึง สนาม 4)
    for (let i = 1; i <= TOTAL_COURTS; i++) {
        const courtMatches = matches.filter(m => parseInt(m.court) === i && (m.status === 'PLAYING' || m.status === 'CALLING'));
        const playingMatch = courtMatches.find(m => m.status === 'PLAYING');
        const callingMatch = courtMatches.find(m => m.status === 'CALLING');

        let statusLabel, statusClass;
        if (playingMatch) {
            statusLabel = 'กำลังแข่งขัน';
            statusClass = 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400';
        } else if (callingMatch) {
            statusLabel = 'กำลังเรียกคิว';
            statusClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400';
        } else {
            statusLabel = 'สนามว่าง';
            statusClass = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400';
        }

        let cardHtml = `
            <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border-2 border-slate-200/90 dark:border-slate-700/90 overflow-hidden flex flex-col justify-between h-full transform transition hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600">
                <!-- หัวการ์ด (Header สนาม) -->
                <div class="bg-slate-100 dark:bg-slate-700/50 py-3 px-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <div class="flex items-center gap-2">
                        <span class="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center text-xs">${i}</span>
                        <h3 class="text-base font-bold text-slate-800 dark:text-white">สนามที่ ${i}</h3>
                    </div>
                    <span class="text-xs font-bold px-2.5 py-1 rounded-full ${statusClass}">
                        ${statusLabel}
                    </span>
                </div>
                
                <div class="p-4 flex-1 flex flex-col justify-center">
        `;

        if (playingMatch) {
            const st = formatTimeSafe(playingMatch.startTime);
            const pTeamA0 = (playingMatch.teamA && playingMatch.teamA[0]) || '(ว่าง)';
            const pTeamA1 = (playingMatch.teamA && playingMatch.teamA[1]) || '(ว่าง)';
            const pTeamB0 = (playingMatch.teamB && playingMatch.teamB[0]) || '(ว่าง)';
            const pTeamB1 = (playingMatch.teamB && playingMatch.teamB[1]) || '(ว่าง)';

            cardHtml += `
                <div class="relative bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-700 dark:to-slate-800 rounded-xl p-4 border border-blue-100 dark:border-slate-600 shadow-inner">
                    <span class="absolute top-3 right-3 flex h-3 w-3">
                        <span class="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                    </span>
                    
                    <div class="text-center mb-3">
                        <div class="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1 tracking-wide">กำลังแข่งขัน (คิวที่ ${playingMatch.id})</div>
                        <div class="text-xl font-black text-slate-800 dark:text-white timer-font bg-white dark:bg-slate-900 inline-block px-3 py-1 rounded-lg shadow-sm" id="timer-${playingMatch.id}">00:00</div>
                        ${st ? `<div class="text-[10px] text-slate-400 mt-1">เริ่ม ${st} น.</div>` : ''}
                    </div>

                    <div class="flex justify-between items-center bg-white dark:bg-slate-800 rounded-lg p-3 shadow-sm border border-slate-100 dark:border-slate-600">
                        <div class="text-center w-[45%]">
                            <div class="text-xs text-slate-400 mb-1">ทีม A</div>
                            <div class="text-sm truncate mb-0.5">${formatPlayerForQueue(pTeamA0, currentNickname)}</div>
                            <div class="text-sm truncate">${formatPlayerForQueue(pTeamA1, currentNickname)}</div>
                        </div>
                        <div class="text-xs font-black text-slate-300 dark:text-slate-500">VS</div>
                        <div class="text-center w-[45%]">
                            <div class="text-xs text-slate-400 mb-1">ทีม B</div>
                            <div class="text-sm truncate mb-0.5">${formatPlayerForQueue(pTeamB0, currentNickname)}</div>
                            <div class="text-sm truncate">${formatPlayerForQueue(pTeamB1, currentNickname)}</div>
                        </div>
                    </div>
                </div>
            `;
        } else if (callingMatch) {
            const cTeamA0 = (callingMatch.teamA && callingMatch.teamA[0]) || '(ว่าง)';
            const cTeamA1 = (callingMatch.teamA && callingMatch.teamA[1]) || '(ว่าง)';
            const cTeamB0 = (callingMatch.teamB && callingMatch.teamB[0]) || '(ว่าง)';
            const cTeamB1 = (callingMatch.teamB && callingMatch.teamB[1]) || '(ว่าง)';

            const elapsed = callingMatch.callingStartTime ? Math.floor((new Date() - new Date(callingMatch.callingStartTime)) / 1000) : 0;
            const remaining = Math.max(0, CALLING_TIMEOUT - elapsed);
            const barPct = (remaining / CALLING_TIMEOUT) * 100;

            cardHtml += `
                <div class="relative bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-700 dark:to-slate-800 rounded-xl p-4 border border-amber-200 dark:border-amber-800/50 shadow-inner">
                    <span class="absolute top-3 right-3 flex h-3 w-3">
                        <span class="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                    </span>
                    
                    <div class="text-center mb-3">
                        <div class="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1 tracking-wide">กำลังเรียกคิว (คิวที่ ${callingMatch.id})</div>
                        <div class="text-xl font-black text-amber-600 dark:text-amber-400 timer-font bg-white dark:bg-slate-900 inline-block px-3 py-1 rounded-lg shadow-sm" id="calling-public-countdown-${callingMatch.id}">${remaining} วินาที</div>
                        <div class="countdown-bar-track mt-2">
                            <div class="countdown-bar-fill" id="calling-public-bar-${callingMatch.id}" style="width:${barPct}%"></div>
                        </div>
                        <div class="text-[10px] text-amber-500 mt-1 font-medium">กรุณาเตรียมตัวลงสนาม!</div>
                    </div>

                    <div class="flex justify-between items-center bg-white dark:bg-slate-800 rounded-lg p-3 shadow-sm border border-amber-100 dark:border-slate-600">
                        <div class="text-center w-[45%]">
                            <div class="text-xs text-slate-400 mb-1">ทีม A</div>
                            <div class="text-sm truncate mb-0.5">${formatPlayerForQueue(cTeamA0, currentNickname)}</div>
                            <div class="text-sm truncate">${formatPlayerForQueue(cTeamA1, currentNickname)}</div>
                        </div>
                        <div class="text-xs font-black text-slate-300 dark:text-slate-500">VS</div>
                        <div class="text-center w-[45%]">
                            <div class="text-xs text-slate-400 mb-1">ทีม B</div>
                            <div class="text-sm truncate mb-0.5">${formatPlayerForQueue(cTeamB0, currentNickname)}</div>
                            <div class="text-sm truncate">${formatPlayerForQueue(cTeamB1, currentNickname)}</div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // สนามว่าง
            cardHtml += `
                <div class="flex flex-col items-center justify-center py-8 px-4 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-xl border-2 border-dashed border-emerald-200 dark:border-emerald-900/50 text-center">
                    <div class="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs mb-2">ว่าง</div>
                    <p class="text-emerald-700 dark:text-emerald-400 text-sm font-bold">สนามว่าง</p>
                    <p class="text-slate-400 dark:text-slate-500 text-xs mt-1">พร้อมรับคิวถัดไปลงเล่นทันที</p>
                </div>
            `;
        }

        cardHtml += `
                </div>
            </div>
        `;
        dashboard.innerHTML += cardHtml;
    }

    // วาดแถวคิวรอกลาง (Central Waiting Queue Pool)
    renderCentralWaitingQueue(currentNickname, userActiveMatch);
}

// วาดแถวคิวรอกลาง
function renderCentralWaitingQueue(currentNickname, userActiveMatch) {
    const centralQueueContainer = document.getElementById('centralQueueContainer');
    const centralQueueBadge = document.getElementById('centralQueueCountBadge');
    if (!centralQueueContainer) return;

    const waitingMatches = matches.filter(m => m.status === 'WAITING').sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));
    if (centralQueueBadge) centralQueueBadge.innerText = `${waitingMatches.length} คิว`;

    if (waitingMatches.length === 0) {
        centralQueueContainer.innerHTML = `
            <div class="col-span-full py-8 text-center bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <p class="text-slate-500 dark:text-slate-400 text-sm font-medium">ขณะนี้ไม่มีคิวรอลงสนาม</p>
                <p class="text-slate-400 text-xs mt-0.5">กดปุ่ม <b>"สร้างคิวใหม่"</b> ด้านบนเพื่อเปิดห้องลงชื่อได้เลยครับ</p>
            </div>
        `;
        return;
    }

    centralQueueContainer.innerHTML = '';
    waitingMatches.forEach((m, idx) => {
        const teamA = Array.isArray(m.teamA) ? m.teamA : [];
        const teamB = Array.isArray(m.teamB) ? m.teamB : [];
        const allPlayers = [...teamA, ...teamB];
        const filledPlayers = allPlayers.filter(name => name && typeof name === 'string' && name.trim().length > 0);
        const isFull = filledPlayers.length >= 4;
        const isUserInThisMatch = currentNickname && allPlayers.includes(currentNickname);

        let courtText = m.court ? `สนาม ${m.court}` : 'รอจัดสนามอัตโนมัติ';
        let courtClass = m.court ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';

        let priorityBadge = '';
        if (idx === 0 && isFull) {
            priorityBadge = '<span class="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">คิวถัดไป</span>';
        } else if (isFull) {
            priorityBadge = `<span class="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-semibold">รอคิวที่ ${idx + 1}</span>`;
        }

        let joinActionHtml = '';
        if (!isFull) {
            const emptyCount = 4 - filledPlayers.length;
            if (isUserInThisMatch) {
                joinActionHtml = `<span class="text-blue-600 dark:text-blue-400 font-bold text-[10px] bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">(คุณอยู่ในคิวนี้)</span>`;
            } else if (currentNickname && !userActiveMatch) {
                joinActionHtml = `
                    <button onclick="openJoinQueueModal(${m.id})"
                        class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1 rounded-lg text-xs transition shadow-sm hover:scale-105 active:scale-95 flex items-center gap-1">
                        <span>+</span><span>เข้าร่วม</span>
                    </button>
                `;
            } else {
                joinActionHtml = `<span class="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-bold">ขาด ${emptyCount} คน</span>`;
            }
        }

        const pA0 = (m.teamA && m.teamA[0]) || '';
        const pA1 = (m.teamA && m.teamA[1]) || '';
        const pB0 = (m.teamB && m.teamB[0]) || '';
        const pB1 = (m.teamB && m.teamB[1]) || '';

        const teamAHtml = `${formatPlayerForQueue(pA0, currentNickname)}, ${formatPlayerForQueue(pA1, currentNickname)}`;
        const teamBHtml = `${formatPlayerForQueue(pB0, currentNickname)}, ${formatPlayerForQueue(pB1, currentNickname)}`;

        const isCreator = (m.createdBy && m.createdBy === sessionStorage.getItem('playerUid')) || (m.creatorName && m.creatorName === currentNickname);

        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between gap-3';
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex items-center gap-2">
                    <span class="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs shadow-sm">${idx + 1}</span>
                    <div>
                        <div class="font-bold text-slate-800 dark:text-white text-sm">คิวที่ ${m.id}</div>
                        <div class="text-[10px] ${courtClass} px-1.5 py-0.5 rounded font-semibold inline-block mt-0.5">${courtText}</div>
                    </div>
                </div>
                <div class="flex items-center gap-1.5">
                    ${priorityBadge}
                    ${joinActionHtml}
                </div>
            </div>

            <div class="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-2.5 text-xs space-y-1.5 border border-slate-100 dark:border-slate-700">
                <div class="flex justify-between items-center">
                    <span class="text-slate-400 shrink-0 mr-2">ทีม A:</span>
                    <span class="truncate text-right">${teamAHtml}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-slate-400 shrink-0 mr-2">ทีม B:</span>
                    <span class="truncate text-right">${teamBHtml}</span>
                </div>
            </div>

            <div class="flex justify-between items-center text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700">
                <span>${m.creatorName ? `สร้างโดย: <b class="text-slate-600 dark:text-slate-300">${m.creatorName}</b>` : ''}</span>
                ${isCreator ? `
                    <button onclick="cancelOrLeaveMatch(${m.id})" class="text-red-500 hover:text-red-700 font-semibold transition">
                        ยกเลิกคิว
                    </button>
                ` : (isUserInThisMatch ? `
                    <button onclick="cancelOrLeaveMatch(${m.id})" class="text-amber-500 hover:text-amber-700 font-semibold transition">
                        ออกจากคิว
                    </button>
                ` : '')}
            </div>
        `;
        centralQueueContainer.appendChild(card);
    });
}

// วาดรายชื่อผู้เล่นที่ "มาสนามแล้ว" แบบ Compact Chips พร้อมระบบค้นหาและพับเก็บ
let allOnlinePlayersCache = [];
let isOnlinePlayersCollapsed = false;

function toggleOnlinePlayersCollapse() {
    isOnlinePlayersCollapsed = !isOnlinePlayersCollapsed;
    const wrapper = document.getElementById('onlinePlayersWrapper');
    const icon = document.getElementById('onlineCollapseIcon');
    const text = document.getElementById('onlineCollapseText');
    if (wrapper) wrapper.classList.toggle('hidden', isOnlinePlayersCollapsed);
    if (icon) icon.innerText = isOnlinePlayersCollapsed ? '▼' : '▲';
    if (text) text.innerText = isOnlinePlayersCollapsed ? 'แสดง' : 'พับเก็บ';
}

function filterOnlinePlayers() {
    applyOnlinePlayersFilter();
}

function applyOnlinePlayersFilter() {
    const container = document.getElementById('onlinePlayersContainer');
    if (!container) return;
    container.innerHTML = '';

    const query = (document.getElementById('searchOnlinePlayerInput')?.value || '').trim().toLowerCase();
    const filtered = allOnlinePlayersCache.filter(p =>
        p.name.toLowerCase().includes(query) || (p.fullName && p.fullName.toLowerCase().includes(query))
    );

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 py-2">ไม่พบรายชื่อผู้เล่นที่ค้นหา</p>';
        return;
    }

    filtered.forEach(p => {
        const chip = document.createElement('div');
        chip.className = 'inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-700/60 hover:bg-blue-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full px-3 py-1.5 text-xs transition shadow-sm select-none';
        chip.innerHTML = `
            <span class="relative flex h-2 w-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span class="font-semibold text-slate-800 dark:text-slate-200">${p.name}</span>
            ${p.fullName ? `<span class="text-[10px] text-slate-400">(${p.fullName})</span>` : ''}
        `;
        container.appendChild(chip);
    });
}

function renderOnlinePlayers(playersFromCloud = null) {
    let players = [];
    if (playersFromCloud && Array.isArray(playersFromCloud)) {
        players = playersFromCloud;
    } else {
        const rawPlayers = JSON.parse(localStorage.getItem('badmintonPlayers')) || [];
        players = rawPlayers
            .filter(p => {
                const n = typeof p === 'string' ? p : (p && p.name);
                return n && !['วา-ขาจร', 'ยันต์69', 'คริสตัน', 'ชัยโรงสี'].includes(n.trim());
            })
            .map(p => typeof p === 'string' ? { name: p, isPresent: true } : p);
    }

    allOnlinePlayersCache = players.filter(p => p && p.isPresent && p.name).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const badge = document.getElementById('onlineCountBadge');
    if (badge) badge.innerText = `${allOnlinePlayersCache.length} คน`;

    applyOnlinePlayersFilter();
}

// =============================================
// ระบบ Player Profile & Mobile Personal Banner
// =============================================
function initProfileUI() {
    const isPlayerLoggedIn = sessionStorage.getItem('isPlayerLoggedIn') === 'true';
    const authNavContainer = document.getElementById('authNavContainer');
    const myQueueBanner = document.getElementById('myQueueBanner');

    if (!authNavContainer) return;

    if (isPlayerLoggedIn) {
        const nickname = sessionStorage.getItem('playerNickname') || 'ผู้เล่น';
        const rawData = sessionStorage.getItem('playerData');
        if (rawData) {
            try {
                currentUserProfile = JSON.parse(rawData);
            } catch (e) { }
        }

        authNavContainer.innerHTML = `
            <button onclick="openProfileDrawer()"
                class="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow transition border border-blue-400/40">
                <span>👤</span>
                <span class="truncate max-w-[100px]">${nickname}</span>
            </button>
        `;

        populateProfileDrawer(nickname, currentUserProfile);
        checkMyQueueStatus();
        updateSelfPresenceUI();
    } else {
        authNavContainer.innerHTML = `
            <a href="login.html"
                class="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1">
                <span>👤</span>
                <span>เข้าสู่ระบบ / ลงทะเบียน</span>
            </a>
        `;
        if (myQueueBanner) myQueueBanner.classList.add('hidden');
    }
}

function populateProfileDrawer(nickname, profile) {
    if (!profile) profile = {};
    const avatar = document.getElementById('profileAvatar');
    const nickEl = document.getElementById('profileNickname');
    const fullEl = document.getElementById('profileFullName');
    const stdEl = document.getElementById('profileStudentId');
    const phoneEl = document.getElementById('profilePhone');
    const facEl = document.getElementById('profileFaculty');
    const majEl = document.getElementById('profileMajor');
    const yearEl = document.getElementById('profileYear');

    if (avatar) avatar.textContent = (nickname || 'P').charAt(0).toUpperCase();
    if (nickEl) nickEl.textContent = nickname;
    if (fullEl) fullEl.textContent = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'ผู้เล่นทั่วไป';
    if (stdEl) stdEl.textContent = profile.studentId || '-';
    if (phoneEl) phoneEl.textContent = profile.phone || '-';
    if (facEl) facEl.textContent = profile.faculty || '-';
    if (majEl) majEl.textContent = profile.major || '-';
    if (yearEl) yearEl.textContent = profile.year ? `ปี ${profile.year}` : '-';
}

// อัปเดต UI ของสวิตช์เช็คชื่อมาสนาม (Self Presence)
function updateSelfPresenceUI() {
    const isPlayerLoggedIn = sessionStorage.getItem('isPlayerLoggedIn') === 'true';
    const playerUid = sessionStorage.getItem('playerUid');
    const nickname = sessionStorage.getItem('playerNickname');
    const label = document.getElementById('selfPresenceLabel');
    const btn = document.getElementById('btnTogglePresence');

    if (!isPlayerLoggedIn || !label || !btn) return;

    // ค้นหาสถานะปัจจุบันจาก onlinePlayersList
    const myRecord = onlinePlayersList.find(p => p.uid === playerUid || p.name === nickname);
    const isPresent = myRecord ? myRecord.isPresent : true;

    if (isPresent) {
        label.textContent = 'พร้อมลงสนาม (อยู่ที่สนาม)';
        label.className = 'text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5';
        btn.textContent = 'เปลี่ยนเป็น: พักผ่อน';
        btn.className = 'px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-red-100 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition';
    } else {
        label.textContent = 'พักผ่อน / ยังไม่พร้อมลงเล่น';
        label.className = 'text-xs text-red-500 font-semibold mt-0.5';
        btn.textContent = 'เปลี่ยนเป็น: พร้อมเล่น';
        btn.className = 'px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow';
    }
}

// สลับสถานะเช็คชื่อมาสนามด้วยตนเอง
async function toggleSelfPresence() {
    const isPlayerLoggedIn = sessionStorage.getItem('isPlayerLoggedIn') === 'true';
    const playerUid = sessionStorage.getItem('playerUid');
    const nickname = sessionStorage.getItem('playerNickname');

    if (!isPlayerLoggedIn || !nickname) {
        alert('กรุณาเข้าสู่ระบบก่อนครับ');
        return;
    }

    const myRecord = onlinePlayersList.find(p => p.uid === playerUid || p.name === nickname);
    const currentStatus = myRecord ? myRecord.isPresent : true;
    const newStatus = !currentStatus;

    if (db && playerUid) {
        try {
            await db.collection('players').doc(playerUid).set({
                uid: playerUid,
                name: nickname,
                isPresent: newStatus,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            alert(newStatus ? 'เช็คชื่อพร้อมลงสนามเรียบร้อย' : 'ปรับสถานะเป็นพักผ่อนเรียบร้อย');
        } catch (e) {
            console.error('Error toggling presence:', e);
            alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ กรุณาลองใหม่');
        }
    }
}

// ตรวจสอบคิวปัจจุบันของผู้เล่นที่ล็อกอินอยู่
function checkMyQueueStatus() {
    const isPlayerLoggedIn = sessionStorage.getItem('isPlayerLoggedIn') === 'true';
    const nickname = sessionStorage.getItem('playerNickname');
    const playerUid = sessionStorage.getItem('playerUid');
    const myQueueBanner = document.getElementById('myQueueBanner');
    const bannerActionContainer = document.getElementById('bannerActionBtnContainer');
    const profileQueueBox = document.getElementById('profileCurrentQueue');

    if (!isPlayerLoggedIn || !nickname || !myQueueBanner) return;

    // ค้นหาว่าชื่อเล่นของผู้เล่นอยู่ในคิวใดบ้าง
    let activeMatch = null;
    for (let m of matches) {
        if (m.status === 'PLAYING' || m.status === 'CALLING' || m.status === 'WAITING') {
            const allPlayers = [...(m.teamA || []), ...(m.teamB || [])];
            if (allPlayers.includes(nickname)) {
                activeMatch = m;
                break;
            }
        }
    }

    const nameSpan = document.getElementById('bannerPlayerName');
    const statusSpan = document.getElementById('bannerStatusText');
    if (nameSpan) nameSpan.textContent = nickname;

    if (activeMatch) {
        myQueueBanner.classList.remove('hidden');

        const courtDesc = activeMatch.court ? `สนาม ${activeMatch.court}` : 'รอจัดสนามอัตโนมัติ';
        if (activeMatch.status === 'PLAYING') {
            statusDesc = `กำลังแข่งขันอยู่ที่ ${courtDesc} (คิวที่ ${activeMatch.id})`;
            badgeColor = 'text-green-300';
        } else if (activeMatch.status === 'CALLING') {
            statusDesc = `ถึงคิวแล้ว! กรุณาลง${courtDesc} ทันที (คิวที่ ${activeMatch.id})`;
            badgeColor = 'text-amber-300 font-bold';
        } else {
            statusDesc = `อยู่ในคิวรอลงสนาม: ${courtDesc} (คิวที่ ${activeMatch.id})`;
            badgeColor = 'text-blue-200';
        }

        if (statusSpan) statusSpan.innerHTML = `<span class="${badgeColor}">${statusDesc}</span>`;

        // ปุ่ม Action: ยกเลิกคิว (ถ้าเป็นผู้สร้าง) หรือ ออกจากคิว (ถ้าแจมเข้ามา)
        const isCreator = (activeMatch.createdBy && activeMatch.createdBy === playerUid) || (activeMatch.creatorName === nickname);
        let actionBtnHtml = '';
        if (activeMatch.status === 'WAITING') {
            if (isCreator) {
                actionBtnHtml = `<button onclick="cancelOrLeaveMatch(${activeMatch.id})" class="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-xl font-bold shadow transition">ยกเลิกคิว</button>`;
            } else {
                actionBtnHtml = `<button onclick="cancelOrLeaveMatch(${activeMatch.id})" class="bg-orange-500 hover:bg-orange-600 text-white text-xs px-3 py-1.5 rounded-xl font-bold shadow transition">ออกจากคิว</button>`;
            }
        }

        if (bannerActionContainer) bannerActionContainer.innerHTML = actionBtnHtml;

        if (profileQueueBox) {
            profileQueueBox.className = 'p-4 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900 text-sm space-y-2';
            profileQueueBox.innerHTML = `
                <div class="font-bold text-blue-700 dark:text-blue-300 flex items-center justify-between">
                    <span>คิวที่ ${activeMatch.id} (${courtDesc})</span>
                    <span class="text-xs px-2 py-0.5 rounded-full bg-blue-600 text-white font-semibold">${activeMatch.status}</span>
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-400">
                    ทีม A: ${(activeMatch.teamA || []).filter(n => n).map(n => formatPlayerForQueue(n, nickname)).join(', ') || '(ว่าง)'} <br>
                    ทีม B: ${(activeMatch.teamB || []).filter(n => n).map(n => formatPlayerForQueue(n, nickname)).join(', ') || '(ว่าง)'}
                </p>
                ${actionBtnHtml ? `<div class="pt-1">${actionBtnHtml}</div>` : ''}
            `;
        }
    } else {
        // ยังไม่มีคิว
        myQueueBanner.classList.add('hidden');
        if (bannerActionContainer) bannerActionContainer.innerHTML = '';
        if (profileQueueBox) {
            profileQueueBox.className = 'p-4 bg-slate-50 dark:bg-slate-700/40 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-center text-slate-500 dark:text-slate-400';
            profileQueueBox.innerHTML = `<p>คุณยังไม่มีคิวที่รอดำเนินการในขณะนี้</p>`;
        }
    }
}

// =============================================
// ระบบสร้างคิวใหม่ (Create Queue Lobby)
// =============================================
function openCreateQueueModal() {
    const isPlayerLoggedIn = sessionStorage.getItem('isPlayerLoggedIn') === 'true';
    const nickname = sessionStorage.getItem('playerNickname');

    if (!isPlayerLoggedIn || !nickname) {
        alert('กรุณาเข้าสู่ระบบหรือลงทะเบียนก่อนสร้างคิวครับ');
        window.location.href = 'login.html';
        return;
    }

    // ตรวจสอบกฎ 1 คน 1 คิว (Single Queue Rule)
    const activeMatch = getActiveMatchForUser(nickname);
    if (activeMatch) {
        alert(`คุณมีคิวที่กำลังรอหรือแข่งขันอยู่แล้ว (คิวที่ ${activeMatch.id} สนาม ${activeMatch.court})\nไม่สามารถสร้างคิวซ้ำได้จนกว่าจะเล่นจบหรือออกจากคิวเดิมครับ`);
        return;
    }

    const modal = document.getElementById('createQueueModal');
    const a1Input = document.getElementById('cqA1');
    const errorBox = document.getElementById('cqError');
    if (errorBox) errorBox.classList.add('hidden');

    if (a1Input) a1Input.value = `${nickname} (คุณ)`;

    // โหลดรายชื่อเพื่อนที่เช็คชื่อมาสนามแล้วใส่ใน dropdowns
    populatePlayerDropdowns(nickname);

    if (modal) modal.classList.remove('hidden');
}

function closeCreateQueueModal() {
    const modal = document.getElementById('createQueueModal');
    if (modal) modal.classList.add('hidden');
}

function populatePlayerDropdowns(currentNick) {
    const dropdowns = ['cqA2', 'cqB1', 'cqB2'];
    const presentPlayers = onlinePlayersList.filter(p => p.isPresent && p.name !== currentNick);

    dropdowns.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = `<option value="">ว่าง</option>`;

        presentPlayers.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name;
            opt.textContent = `${p.name} ${p.fullName ? `(${p.fullName})` : ''}`;
            select.appendChild(opt);
        });
    });
}

function setQuickSlotFormat(type) {
    const a2 = document.getElementById('cqA2');
    const b1 = document.getElementById('cqB1');
    const b2 = document.getElementById('cqB2');
    if (!a2 || !b1 || !b2) return;

    if (type === 'solo') {
        a2.value = '';
        b1.value = '';
        b2.value = '';
    } else if (type === 'pair') {
        b1.value = '';
        b2.value = '';
    }
}

async function submitCreateQueue(e) {
    e.preventDefault();
    const nickname = sessionStorage.getItem('playerNickname');
    const playerUid = sessionStorage.getItem('playerUid');
    const court = document.getElementById('cqCourt').value;
    const a2 = document.getElementById('cqA2').value.trim();
    const b1 = document.getElementById('cqB1').value.trim();
    const b2 = document.getElementById('cqB2').value.trim();
    const errorBox = document.getElementById('cqError');
    const submitBtn = document.getElementById('btnSubmitCreateQueue');

    if (errorBox) errorBox.classList.add('hidden');

    // ตรวจสอบชื่อซ้ำในคิวเดียวกัน
    const selected = [nickname, a2, b1, b2].filter(n => n.length > 0);
    const unique = new Set(selected);
    if (selected.length !== unique.size) {
        errorBox.textContent = 'มีชื่อผู้เล่นซ้ำกันในคิวเดียวกัน กรุณาเลือกคนไม่ซ้ำกันครับ';
        errorBox.classList.remove('hidden');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'กำลังสร้างห้อง...';

    try {
        // หา nextId
        let maxId = 0;
        matches.forEach(m => {
            if (parseInt(m.id) > maxId) maxId = parseInt(m.id);
        });
        const nextId = maxId + 1;

        let assignedCourt = null;
        let initialStatus = 'WAITING';
        let initialCallingStartTime = null;

        if (court === 'auto' || !court) {
            // ถ้าเลือกอัตโนมัติ และผู้เล่นครบ 4 คนแล้ว ให้เช็คว่ามีสนามใดใน 1-4 ว่างหรือไม่
            if (selected.length === 4) {
                for (let c = 1; c <= TOTAL_COURTS; c++) {
                    const isBusy = matches.some(m => parseInt(m.court) === c && (m.status === 'PLAYING' || m.status === 'CALLING'));
                    if (!isBusy) {
                        assignedCourt = c;
                        initialStatus = 'CALLING';
                        initialCallingStartTime = firebase.firestore.FieldValue.serverTimestamp();
                        break;
                    }
                }
            }
        } else {
            assignedCourt = parseInt(court);
        }

        const newMatch = {
            id: nextId,
            teamA: [nickname, a2 || ''],
            teamB: [b1 || '', b2 || ''],
            court: assignedCourt,
            status: initialStatus,
            createdBy: playerUid || '',
            creatorName: nickname,
            startTime: null,
            callingStartTime: initialCallingStartTime,
            scoreA: null,
            scoreB: null,
            playDuration: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (db) {
            await db.collection('matches').doc(String(nextId)).set(newMatch);
        } else {
            matches.push(newMatch);
            localStorage.setItem('badmintonMatches', JSON.stringify(matches));
            renderDashboard();
            checkMyQueueStatus();
        }

        closeCreateQueueModal();
        const alertCourtText = assignedCourt ? `สนาม ${assignedCourt}` : 'รอจัดสนามอัตโนมัติ (Central Queue)';
        alert(`เปิดห้องคิวที่ ${nextId} (${alertCourtText}) สำเร็จแล้ว`);
    } catch (err) {
        console.error('Create queue error:', err);
        if (errorBox) {
            errorBox.textContent = 'เกิดข้อผิดพลาดในการสร้างคิว: ' + err.message;
            errorBox.classList.remove('hidden');
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'ยืนยันเปิดคิว';
    }
}

// =============================================
// ระบบเข้าร่วมคิว (Join Queue)
// =============================================
function openJoinQueueModal(matchId) {
    const isPlayerLoggedIn = sessionStorage.getItem('isPlayerLoggedIn') === 'true';
    const nickname = sessionStorage.getItem('playerNickname');

    if (!isPlayerLoggedIn || !nickname) {
        alert('กรุณาเข้าสู่ระบบก่อนเข้าร่วมคิวครับ');
        window.location.href = 'login.html';
        return;
    }

    // ตรวจสอบกฎ 1 คน 1 คิว
    const activeMatch = getActiveMatchForUser(nickname);
    if (activeMatch) {
        alert(`คุณมีคิวที่กำลังรอหรือแข่งขันอยู่แล้ว (คิวที่ ${activeMatch.id})\nไม่สามารถจอยคิวซ้ำได้ครับ`);
        return;
    }

    const match = matches.find(m => String(m.id) === String(matchId));
    if (!match) return;

    currentJoiningMatchId = match.id;
    document.getElementById('jqMatchId').textContent = match.id;
    document.getElementById('jqCourt').textContent = match.court ? `สนาม ${match.court}` : 'อัตโนมัติ';
    const errorBox = document.getElementById('jqError');
    if (errorBox) errorBox.classList.add('hidden');

    // วาดสล็อตสำหรับเลือกเข้าร่วม
    renderJoinSlots(match, nickname);

    const modal = document.getElementById('joinQueueModal');
    if (modal) modal.classList.remove('hidden');
}

function closeJoinQueueModal() {
    const modal = document.getElementById('joinQueueModal');
    if (modal) modal.classList.add('hidden');
    currentJoiningMatchId = null;
}

function renderJoinSlots(match, nickname) {
    const slots = [
        { id: 'jqSlotA1', team: 'teamA', idx: 0, label: 'ทีม A (ผู้เล่น 1)' },
        { id: 'jqSlotA2', team: 'teamA', idx: 1, label: 'ทีม A (ผู้เล่น 2)' },
        { id: 'jqSlotB1', team: 'teamB', idx: 0, label: 'ทีม B (ผู้เล่น 1)' },
        { id: 'jqSlotB2', team: 'teamB', idx: 1, label: 'ทีม B (ผู้เล่น 2)' }
    ];

    slots.forEach(s => {
        const el = document.getElementById(s.id);
        if (!el) return;

        const currentName = match[s.team] && match[s.team][s.idx] ? match[s.team][s.idx].trim() : '';

        if (currentName) {
            el.className = 'p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 text-xs flex justify-between items-center opacity-70';
            el.innerHTML = `
                <span class="font-medium text-slate-700 dark:text-slate-300">${s.label}: <strong>${currentName}</strong></span>
                <span class="text-[10px] text-slate-400 font-bold">เต็ม</span>
            `;
        } else {
            el.className = 'p-2.5 rounded-xl border-2 border-dashed border-emerald-400 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20 text-xs flex justify-between items-center hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 cursor-pointer transition';
            el.innerHTML = `
                <span class="font-bold text-emerald-700 dark:text-emerald-300">${s.label}: <em>(ว่าง)</em></span>
                <button onclick="submitJoinSlot('${s.team}', ${s.idx})" class="bg-emerald-600 text-white font-bold px-3 py-1 rounded-lg text-xs shadow-sm">
                    กดเข้าสล็อตนี้
                </button>
            `;
        }
    });
}

async function submitJoinSlot(team, slotIdx) {
    const nickname = sessionStorage.getItem('playerNickname');
    if (!nickname || !currentJoiningMatchId) return;

    const match = matches.find(m => String(m.id) === String(currentJoiningMatchId));
    if (!match) return;

    try {
        const teamArray = [...(match[team] || ['', ''])];
        if (teamArray[slotIdx] && teamArray[slotIdx].trim().length > 0) {
            alert('ขออภัย ช่องนี้มีคนอื่นเพิ่งกดเข้าร่วมไปแล้วครับ');
            return;
        }

        teamArray[slotIdx] = nickname;

        const otherTeam = team === 'teamA' ? 'teamB' : 'teamA';
        const otherTeamArray = match[otherTeam] || ['', ''];
        const allFour = [...teamArray, ...otherTeamArray].filter(n => n && n.trim().length > 0);

        const updatePayload = {};
        updatePayload[team] = teamArray;

        // ถ้าครบ 4 คนแล้ว และคิวยังไม่มีสนาม (รอจัดสนามอัตโนมัติ)
        // ตรวจสอบว่ามีสนาม 1-4 ว่างหรือไม่
        if (allFour.length === 4 && (!match.court || match.court === 'auto')) {
            for (let c = 1; c <= TOTAL_COURTS; c++) {
                const isBusy = matches.some(m => parseInt(m.court) === c && (m.status === 'PLAYING' || m.status === 'CALLING'));
                if (!isBusy) {
                    updatePayload.court = c;
                    updatePayload.status = 'CALLING';
                    updatePayload.callingStartTime = firebase.firestore.FieldValue.serverTimestamp();
                    break;
                }
            }
        }

        if (db) {
            await db.collection('matches').doc(String(match.id)).update(updatePayload);
        } else {
            match[team] = teamArray;
            if (updatePayload.court) {
                match.court = updatePayload.court;
                match.status = updatePayload.status;
                match.callingStartTime = new Date();
            }
            localStorage.setItem('badmintonMatches', JSON.stringify(matches));
            renderDashboard();
            checkMyQueueStatus();
        }

        closeJoinQueueModal();
        alert(`เข้าร่วมคิวที่ ${match.id} ในตำแหน่ง ${team === 'teamA' ? 'ทีม A' : 'ทีม B'} สำเร็จ`);
    } catch (err) {
        console.error('Join queue error:', err);
        alert('เกิดข้อผิดพลาดในการเข้าร่วมคิว: ' + err.message);
    }
}

// =============================================
// ระบบยกเลิกคิว / ออกจากคิว (Cancel / Leave Queue)
// =============================================
async function cancelOrLeaveMatch(matchId) {
    const nickname = sessionStorage.getItem('playerNickname');
    const playerUid = sessionStorage.getItem('playerUid');
    if (!nickname) return;

    const match = matches.find(m => String(m.id) === String(matchId));
    if (!match) return;

    const isCreator = (match.createdBy && match.createdBy === playerUid) || (match.creatorName === nickname);

    if (isCreator) {
        // เจ้าของคิว: ยกเลิกทั้งคิว
        if (!confirm(`คุณคือผู้สร้างคิวที่ ${matchId} (สนาม ${match.court || 'อัตโนมัติ'})\nต้องการ "ยกเลิกคิวนี้" ทั้งหมดหรือไม่?`)) {
            return;
        }

        try {
            if (db) {
                await db.collection('matches').doc(String(matchId)).delete();
            } else {
                matches = matches.filter(m => m.id !== matchId);
                localStorage.setItem('badmintonMatches', JSON.stringify(matches));
                renderDashboard();
                checkMyQueueStatus();
            }
            alert(`ยกเลิกคิวที่ ${matchId} เรียบร้อยแล้ว`);
        } catch (err) {
            console.error('Delete match error:', err);
            alert('ไม่สามารถยกเลิกคิวได้: ' + err.message);
        }
    } else {
        // คนที่จอยเข้ามา: เคลียร์ชื่อตนเองออกจากสล็อต
        if (!confirm(`ต้องการ "ออกจากคิวที่ ${matchId}" หรือไม่?`)) {
            return;
        }

        try {
            const newTeamA = (match.teamA || []).map(n => n === nickname ? '' : n);
            const newTeamB = (match.teamB || []).map(n => n === nickname ? '' : n);

            if (db) {
                await db.collection('matches').doc(String(matchId)).update({
                    teamA: newTeamA,
                    teamB: newTeamB
                });
            } else {
                match.teamA = newTeamA;
                match.teamB = newTeamB;
                localStorage.setItem('badmintonMatches', JSON.stringify(matches));
                renderDashboard();
                checkMyQueueStatus();
            }
            alert(`ออกจากคิวที่ ${matchId} เรียบร้อยแล้ว`);
        } catch (err) {
            console.error('Leave match error:', err);
            alert('ไม่สามารถออกจากคิวได้: ' + err.message);
        }
    }
}

function openProfileDrawer() {
    const drawer = document.getElementById('profileDrawer');
    if (drawer) {
        drawer.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeProfileDrawer() {
    const drawer = document.getElementById('profileDrawer');
    if (drawer) {
        drawer.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

function logoutPlayer() {
    if (confirm('ต้องการออกจากระบบโปรไฟล์หรือไม่?')) {
        localStorage.removeItem('isPlayerLoggedIn');
        localStorage.removeItem('playerUid');
        localStorage.removeItem('playerNickname');
        localStorage.removeItem('playerData');
        sessionStorage.removeItem('isPlayerLoggedIn');
        sessionStorage.removeItem('playerUid');
        sessionStorage.removeItem('playerNickname');
        sessionStorage.removeItem('playerData');

        if (auth) {
            auth.signOut().catch(() => {});
        }

        closeProfileDrawer();
        initProfileUI();
        alert('ออกจากระบบเรียบร้อยแล้ว');
    }
}

// ระบบจับเวลาการแข่งขัน + countdown สำหรับ CALLING
function startLiveTimer() {
    const CALLING_TIMEOUT = 90;

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        matches.forEach(match => {
            // Timer สำหรับ PLAYING
            if (match.status === 'PLAYING' && match.startTime) {
                const startTime = match.startTime instanceof Date ? match.startTime : new Date(match.startTime);
                if (!isNaN(startTime.getTime())) {
                    const diff = Math.max(0, Math.floor((new Date() - startTime) / 1000));
                    const el = document.getElementById(`timer-${match.id}`);
                    if (el) el.innerText = `${Math.floor(diff / 60).toString().padStart(2, '0')}:${(diff % 60).toString().padStart(2, '0')}`;
                }
            }

            // Countdown สำหรับ CALLING
            if (match.status === 'CALLING' && match.callingStartTime) {
                const cStartTime = match.callingStartTime instanceof Date ? match.callingStartTime : new Date(match.callingStartTime);
                if (!isNaN(cStartTime.getTime())) {
                    const elapsed = Math.floor((new Date() - cStartTime) / 1000);
                    const remaining = Math.max(0, CALLING_TIMEOUT - elapsed);

                    const countdownEl = document.getElementById(`calling-public-countdown-${match.id}`);
                    const barEl = document.getElementById(`calling-public-bar-${match.id}`);

                    if (countdownEl) countdownEl.innerText = `${remaining} วินาที`;
                    if (barEl) barEl.style.width = `${(remaining / CALLING_TIMEOUT) * 100}%`;
                }
            }
        });
    }, 1000);
}

// =============================================
// ฟังก์ชันเต็มจอ (TV Mode) สำหรับจอแสดงผลสนาม
// =============================================
function toggleFullscreen() {
    const icon = document.getElementById('fullscreenIcon');
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => {
            if (icon) icon.textContent = '⊡';
        }).catch(err => {
            console.warn('ไม่สามารถเปิดเต็มจอได้:', err);
        });
    } else {
        document.exitFullscreen().then(() => {
            if (icon) icon.textContent = '⛶';
        });
    }
}

// อัปเดตไอคอนเมื่อ Fullscreen เปลี่ยนสถานะจากการกด Esc
document.addEventListener('fullscreenchange', () => {
    const icon = document.getElementById('fullscreenIcon');
    if (icon) {
        icon.textContent = document.fullscreenElement ? '⊡' : '⛶';
    }
});

// ทำงานเมื่อโหลดหน้าเว็บ
window.onload = () => {
    if (typeof initTheme === 'function') initTheme();
    loadData();
    initProfileUI();
    startLiveTimer();
    initEditProfileCascade();
};

// =============================================
// แก้ไขข้อมูลโปรไฟล์ผู้เล่น (Edit Profile)
// =============================================

// ข้อมูลหลักสูตรแบบย่อสำหรับ Cascade dropdown ในหน้า public
const _FACULTY_MAP = {
    "วิทยาศาสตร์สุขภาพ": ["คณะแพทยศาสตร์","คณะทันตแพทยศาสตร์","คณะเภสัชศาสตร์","คณะพยาบาลศาสตร์","คณะสหเวชศาสตร์","คณะสาธารณสุขศาสตร์","คณะวิทยาศาสตร์การแพทย์"],
    "วิทยาศาสตร์และเทคโนโลยี": ["คณะเทคโนโลยีสารสนเทศและการสื่อสาร (ICT)","คณะวิศวกรรมศาสตร์","คณะวิทยาศาสตร์","คณะเกษตรศาสตร์และทรัพยากรธรรมชาติ","คณะพลังงานและสิ่งแวดล้อม","คณะสถาปัตยกรรมศาสตร์และศิลปกรรมศาสตร์"],
    "มนุษยศาสตร์และสังคมศาสตร์": ["คณะนิติศาสตร์","คณะรัฐศาสตร์และสังคมศาสตร์","คณะบริหารธุรกิจและนิเทศศาสตร์ (BCA)","คณะศิลปศาสตร์","วิทยาลัยการศึกษา","วิทยาลัยการจัดการ (กรุงเทพฯ)"]
};

const _STUDENT_STATUSES_SET = new Set(['นิสิต/นักศึกษา','บัณฑิตศึกษา (ป.โท)','บัณฑิตศึกษา (ป.เอก)']);

function initEditProfileCascade() {
    const statusSel = document.getElementById('editUserStatus');
    const fieldGroupSel = document.getElementById('editFieldGroup');
    const facultySel = document.getElementById('editFaculty');
    if (!statusSel) return;

    statusSel.addEventListener('change', () => {
        const show = _STUDENT_STATUSES_SET.has(statusSel.value);
        document.getElementById('editFieldGroupWrap').style.display = show ? '' : 'none';
        document.getElementById('editFacultyWrap').style.display = 'none';
        document.getElementById('editMajorWrap').style.display = 'none';
        if (!show) { fieldGroupSel.value = ''; facultySel.innerHTML = '<option value="">-- เลือกคณะ --</option>'; }
    });

    fieldGroupSel.addEventListener('change', () => {
        const group = fieldGroupSel.value;
        facultySel.innerHTML = '<option value="">-- เลือกคณะ --</option>';
        (_FACULTY_MAP[group] || []).forEach(f => {
            const o = document.createElement('option'); o.value = f; o.textContent = f; facultySel.appendChild(o);
        });
        document.getElementById('editFacultyWrap').style.display = group ? '' : 'none';
        document.getElementById('editMajorWrap').style.display = 'none';
    });

    facultySel.addEventListener('change', () => {
        document.getElementById('editMajorWrap').style.display = facultySel.value ? '' : 'none';
    });
}

function openEditProfileModal() {
    const raw = localStorage.getItem('playerData');
    if (!raw) return;
    const pd = JSON.parse(raw);

    document.getElementById('editNickname').value   = pd.nickname   || '';
    document.getElementById('editFirstName').value  = pd.firstName  || '';
    document.getElementById('editLastName').value   = pd.lastName   || '';
    document.getElementById('editStudentId').value  = pd.studentId  || '';
    document.getElementById('editPhone').value      = pd.phone      || '';

    // สถานะผู้ใช้ (รองรับทั้ง userStatus ใหม่ และ year เก่า)
    const statusVal = pd.userStatus || pd.year || '';
    document.getElementById('editUserStatus').value = statusVal;

    // ซ่อน/แสดง field group ตามสถานะ
    const showGroup = _STUDENT_STATUSES_SET.has(statusVal);
    document.getElementById('editFieldGroupWrap').style.display = showGroup ? '' : 'none';
    document.getElementById('editFacultyWrap').style.display    = showGroup && pd.fieldGroup ? '' : 'none';
    document.getElementById('editMajorWrap').style.display      = showGroup && pd.faculty    ? '' : 'none';

    if (showGroup) {
        document.getElementById('editFieldGroup').value = pd.fieldGroup || '';
        // populate faculty dropdown
        const fg = pd.fieldGroup || '';
        const facSel = document.getElementById('editFaculty');
        facSel.innerHTML = '<option value="">-- เลือกคณะ --</option>';
        (_FACULTY_MAP[fg] || []).forEach(f => {
            const o = document.createElement('option'); o.value = f; o.textContent = f; facSel.appendChild(o);
        });
        facSel.value = pd.faculty || '';
        document.getElementById('editMajor').value = pd.major || '';
    }

    document.getElementById('editProfileError').classList.add('hidden');
    document.getElementById('editProfileModal').classList.remove('modal-hidden');
}

function closeEditProfileModal() {
    document.getElementById('editProfileModal').classList.add('modal-hidden');
}

async function saveEditProfile() {
    const nickname  = document.getElementById('editNickname').value.trim();
    const firstName = document.getElementById('editFirstName').value.trim();
    const lastName  = document.getElementById('editLastName').value.trim();
    const phone     = document.getElementById('editPhone').value.trim();
    const userStatus = document.getElementById('editUserStatus').value;
    const fieldGroup = document.getElementById('editFieldGroup').value;
    const faculty    = document.getElementById('editFaculty').value;
    const major      = document.getElementById('editMajor').value;
    const studentId  = document.getElementById('editStudentId').value.trim();
    const errBox     = document.getElementById('editProfileError');

    errBox.classList.add('hidden');

    if (!nickname)   { errBox.textContent = 'กรุณากรอกชื่อเล่น';    errBox.classList.remove('hidden'); return; }
    if (!firstName)  { errBox.textContent = 'กรุณากรอกชื่อจริง';    errBox.classList.remove('hidden'); return; }
    if (!lastName)   { errBox.textContent = 'กรุณากรอกนามสกุล';    errBox.classList.remove('hidden'); return; }
    if (!phone)      { errBox.textContent = 'กรุณากรอกเบอร์โทร';    errBox.classList.remove('hidden'); return; }
    if (!userStatus) { errBox.textContent = 'กรุณาเลือกสถานะผู้ใช้'; errBox.classList.remove('hidden'); return; }

    const raw = localStorage.getItem('playerData');
    const oldData = raw ? JSON.parse(raw) : {};
    const uid = localStorage.getItem('playerUid');

    const updatedData = {
        ...oldData,
        nickname,
        firstName,
        lastName,
        phone,
        studentId: studentId || '',
        userStatus,
        fieldGroup: fieldGroup || '',
        faculty: faculty || '',
        major: major || ''
    };

    // อัปเดต localStorage / sessionStorage
    localStorage.setItem('playerData', JSON.stringify(updatedData));
    localStorage.setItem('playerNickname', nickname);
    sessionStorage.setItem('playerData', JSON.stringify(updatedData));
    sessionStorage.setItem('playerNickname', nickname);

    // อัปเดต Firestore (ถ้าเชื่อมต่ออยู่)
    if (db && uid) {
        try {
            await db.collection('users').doc(uid).update({
                nickname, firstName, lastName, phone,
                studentId: studentId || '',
                userStatus, fieldGroup: fieldGroup || '',
                faculty: faculty || '', major: major || ''
            });
            // อัปเดตชื่อใน players collection ด้วย
            await db.collection('players').doc(uid).update({
                name: nickname,
                fullName: `${firstName} ${lastName}`
            });
        } catch (e) {
            console.warn('Firestore update warning:', e);
        }
    }

    closeEditProfileModal();
    currentUserProfile = updatedData;
    renderProfileDrawer(updatedData);
    alert('บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว!');
}
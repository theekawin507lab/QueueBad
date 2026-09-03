/* =============================================
   common.js — ฟังก์ชันที่ใช้ร่วมกันทุกหน้า
   (Dark Mode / Theme Management)
   แยกจาก index.html, login.html, public.html
   ============================================= */

function toggleDarkMode() {
    const html = document.documentElement;
    html.classList.toggle('dark');
    localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
    updateThemeIcon();
}

function updateThemeIcon() {
    document.getElementById('themeIcon').innerText =
        document.documentElement.classList.contains('dark') ? '☀️' : '🌙';
}

function initTheme() {
    if (
        localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') &&
            window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
        document.documentElement.classList.add('dark');
    }
    updateThemeIcon();
}

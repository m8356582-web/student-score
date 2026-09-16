/* ============================================
   منطق صفحه اصلی (index.html)
   نمایش امتیاز، سرچ، برترین‌ها، گروه‌ها
   ============================================ */

let allStudents = [];
let allGroups = [];

/* ============================================
   راه‌اندازی اولیه
   ============================================ */
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    await loadData();
    setupSearch();
});

/* ============================================
   تم روشن/تاریک
   ============================================ */
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        document.getElementById('themeToggle').textContent = '☀️';
    }

    document.getElementById('themeToggle').addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        const isLight = document.body.classList.contains('light-mode');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        document.getElementById('themeToggle').textContent = isLight ? '☀️' : '🌙';
    });
}

/* ============================================
   بارگذاری داده‌ها
   ============================================ */
async function loadData() {
    try {
        const [students, groups] = await Promise.all([
            Students.getAll(),
            Groups.getWithCount()
        ]);
        allStudents = students;
        allGroups = groups;

        renderLeaderboard();
        renderGroups();
    } catch (err) {
        console.error('خطا در بارگذاری:', err);
        showToast('خطا در بارگذاری اطلاعات', 'error');
    }
}

/* ============================================
   نمایش برترین‌ها
   ============================================ */
function renderLeaderboard() {
    const container = document.getElementById('leaderboard');
    const top = allStudents.slice(0, 3);

    if (top.length === 0) {
        container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-icon">🏆</div>
        <p>هنوز دانش‌آموزی ثبت نشده</p>
      </div>
    `;
        return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    const classes = ['gold', 'silver', 'bronze'];

    container.innerHTML = top.map((s, i) => `
    <div class="top-card ${classes[i]} pop-in" onclick="showProfile('${s.id}')">
      <span class="medal">${medals[i]}</span>
      <div class="top-card-info">
        <div class="top-card-name">${s.full_name}</div>
        <div class="top-card-score">${s.total_score || 0} امتیاز</div>
      </div>
      <div class="rank-badge">${i + 1}</div>
    </div>
  `).join('');
}

/* ============================================
   نمایش گروه‌ها
   ============================================ */
function renderGroups() {
    const container = document.getElementById('groupsGrid');

    if (allGroups.length === 0) {
        container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-icon">📁</div>
        <p>هنوز گروهی ساخته نشده</p>
      </div>
    `;
        return;
    }

    container.innerHTML = allGroups.map(g => `
    <div class="group-card pop-in" onclick="showGroup('${g.id}')">
      <div class="group-name">${g.name}</div>
      <div class="group-count">👥 ${g.student_count || 0} نفر</div>
    </div>
  `).join('');
}

/* ============================================
   سرچ زنده
   ============================================ */
function setupSearch() {
    const input = document.getElementById('searchInput');
    let timer;

    input.addEventListener('input', (e) => {
        clearTimeout(timer);
        const query = e.target.value.trim();

        if (query.length < 1) {
            document.getElementById('searchResults').style.display = 'none';
            document.getElementById('topSection').style.display = 'block';
            return;
        }

        timer = setTimeout(() => doSearch(query), 250);
    });
}

async function doSearch(query) {
    try {
        const results = await Students.search(query);
        const container = document.getElementById('searchResultsList');
        const wrap = document.getElementById('searchResults');

        wrap.style.display = 'block';
        document.getElementById('topSection').style.display = 'none';

        if (results.length === 0) {
            container.innerHTML = `<div class="no-result">نتیجه‌ای پیدا نشد 😕</div>`;
            return;
        }

        container.innerHTML = results.map(s => `
      <div class="search-result" onclick="showProfile('${s.id}')">
        <div class="avatar" style="background:${s.avatar_color || '#06b6d4'}">
          ${getInitial(s.full_name)}
        </div>
        <div class="student-info">
          <div class="student-name">${s.full_name}</div>
          <div class="student-group-name">${s.groups?.name || 'بدون گروه'}</div>
        </div>
        <div class="student-score">${s.total_score || 0}</div>
      </div>
    `).join('');
    } catch (err) {
        console.error(err);
        showToast('خطا در جستجو', 'error');
    }
}

/* ============================================
   مودال پروفایل
   ============================================ */
async function showProfile(studentId) {
    const modal = document.getElementById('profileModal');
    const content = document.getElementById('profileContent');
    modal.classList.add('active');

    content.innerHTML = `
    <div class="loading-screen">
      <div class="loader loader-lg"></div>
      <p>در حال بارگذاری...</p>
    </div>
  `;

    try {
        const [student, scores] = await Promise.all([
            Students.getById(studentId),
            Scores.getByStudent(studentId)
        ]);

        const scoreHTML = scores.length === 0
            ? `<div class="no-result">هنوز امتیازی ثبت نشده</div>`
            : scores.map(sc => {
                const isNeg = sc.amount < 0;
                const icon = sc.score_type === 'attendance' ? '✅'
                    : sc.score_type === 'bonus' ? '🎁'
                        : '📝';
                return `
            <div class="history-item ${isNeg ? 'negative' : ''}">
              <div class="history-icon">${icon}</div>
              <div class="history-content">
                <div class="history-reason">${sc.reason || 'بدون توضیح'}</div>
                <div class="history-meta">
                  ${sc.session_title ? `<span>📚 ${sc.session_title}</span>` : ''}
                  <span>📅 ${toJalaliFull(sc.created_at)}</span>
                </div>
              </div>
              <div class="history-amount ${isNeg ? 'negative' : ''}">
                ${sc.amount > 0 ? '+' : ''}${sc.amount}
              </div>
            </div>
          `;
            }).join('');

        content.innerHTML = `
      <div class="profile-hero">
        <div class="profile-avatar" style="background:${student.avatar_color || '#06b6d4'}">
          ${getInitial(student.full_name)}
        </div>
        <div class="profile-name">${student.full_name}</div>
        <div class="profile-group">📁 ${student.groups?.name || 'بدون گروه'}</div>
        <div class="total-score-big">${student.total_score || 0}</div>
        <div class="total-score-label">امتیاز کل</div>
      </div>

      <h3 class="section-title" style="margin-top:20px;">📊 تاریخچه امتیازات</h3>
      <div>${scoreHTML}</div>
    `;
    } catch (err) {
        console.error(err);
        content.innerHTML = `<div class="no-result">خطا در بارگذاری 😕</div>`;
    }
}

function closeProfile() {
    document.getElementById('profileModal').classList.remove('active');
}

/* ============================================
   مودال گروه
   ============================================ */
async function showGroup(groupId) {
    const modal = document.getElementById('groupModal');
    const content = document.getElementById('groupContent');
    const group = allGroups.find(g => g.id === groupId);

    modal.classList.add('active');
    document.getElementById('groupModalTitle').textContent = group?.name || 'گروه';

    content.innerHTML = `
    <div class="loading-screen">
      <div class="loader loader-lg"></div>
      <p>در حال بارگذاری...</p>
    </div>
  `;

    try {
        const students = await Students.getByGroup(groupId);

        if (students.length === 0) {
            content.innerHTML = `<div class="no-result">هنوز دانش‌آموزی به این گروه اضافه نشده</div>`;
            return;
        }

        // مرتب‌سازی بر اساس امتیاز
        students.sort((a, b) => (b.total_score || 0) - (a.total_score || 0));

        content.innerHTML = students.map((s, i) => `
      <div class="student-row" onclick="closeGroup(); showProfile('${s.id}')">
        <div class="avatar" style="background:${s.avatar_color || '#06b6d4'}">
          ${getInitial(s.full_name)}
        </div>
        <div class="student-info">
          <div class="student-name">${s.full_name}</div>
          <div class="student-group-name">رتبه ${i + 1} در گروه</div>
        </div>
        <div class="student-score">${s.total_score || 0}</div>
      </div>
    `).join('');
    } catch (err) {
        console.error(err);
        content.innerHTML = `<div class="no-result">خطا در بارگذاری 😕</div>`;
    }
}

function closeGroup() {
    document.getElementById('groupModal').classList.remove('active');
}

/* ============================================
   بستن مودال با کلیک بیرون
   ============================================ */
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    }
});
/* ============================================
   منطق پنل ادمین (admin.html)
   ============================================ */

let currentAdmin = null;
let allGroupsCache = [];
let allStudentsCache = [];
let selectedAttendance = new Set();
let manualSelectedStudent = null;

/* ============================================
   راه‌اندازی
   ============================================ */
document.addEventListener('DOMContentLoaded', async () => {
    currentAdmin = requireAdmin();
    if (!currentAdmin) return;

    initHeader();
    initTheme();
    initTabs();
    initModals();

    await loadAll();
    renderStats();
    renderRecentScores();
});

/* ============================================
   هدر
   ============================================ */
function initHeader() {
    document.getElementById('adminName').textContent = currentAdmin.full_name;

    const roleBadge = document.getElementById('roleBadge');
    if (currentAdmin.role === 'super') {
        roleBadge.textContent = '👑 سوپر ادمین';
        roleBadge.className = 'role-badge super';
    } else {
        roleBadge.textContent = '🔑 ادمین';
        roleBadge.className = 'role-badge admin';
        // مخفی کردن تب ادمین‌ها برای ادمین معمولی
        document.getElementById('adminsTab').style.display = 'none';
    }

    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('از پنل خارج می‌شی؟')) {
            Auth.clear();
            window.location.href = 'login.html';
        }
    });
}

/* ============================================
   تم
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
   تب‌ها
   ============================================ */
function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
            onTabOpen(tab.dataset.tab);
        });
    });
}

async function onTabOpen(tabName) {
    if (tabName === 'groups') await renderGroupsList();
    else if (tabName === 'students') await renderStudents();
    else if (tabName === 'attendance') await renderAttendance();
    else if (tabName === 'sessions') await renderSessionsList();
    else if (tabName === 'admins') await renderAdminsList();
    else if (tabName === 'dashboard') {
        renderStats();
        renderRecentScores();
    }
}

/* ============================================
   مودال
   ============================================ */
function initModals() {
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('active');
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

function openModal(title, bodyHTML) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHTML;
    document.getElementById('mainModal').classList.add('active');
}

function closeModal() {
    document.getElementById('mainModal').classList.remove('active');
}

/* ============================================
   بارگذاری همه داده‌ها
   ============================================ */
async function loadAll() {
    try {
        const [groups, students] = await Promise.all([
            Groups.getAll(),
            Students.getAll()
        ]);
        allGroupsCache = groups;
        allStudentsCache = students;

        fillGroupSelects();
    } catch (err) {
        console.error(err);
        showToast('خطا در بارگذاری اطلاعات', 'error');
    }
}

function fillGroupSelects() {
    const options = allGroupsCache.map(g =>
        `<option value="${g.id}">${g.name}</option>`
    ).join('');

    const filterGroup = document.getElementById('filterGroup');
    if (filterGroup) filterGroup.innerHTML = `<option value="">همه گروه‌ها</option>${options}`;

    const attGroup = document.getElementById('attGroup');
    if (attGroup) attGroup.innerHTML = `<option value="">انتخاب گروه...</option>${options}`;
}

/* ============================================
   داشبورد - آمار
   ============================================ */
function renderStats() {
    const container = document.getElementById('statsGrid');

    const totalStudents = allStudentsCache.length;
    const totalGroups = allGroupsCache.length;
    const totalScores = allStudentsCache.reduce((sum, s) => sum + (s.total_score || 0), 0);

    container.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon">👥</div>
      <div class="stat-value">${totalStudents}</div>
      <div class="stat-label">دانش‌آموز</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">📁</div>
      <div class="stat-value">${totalGroups}</div>
      <div class="stat-label">گروه</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">⭐</div>
      <div class="stat-value">${totalScores}</div>
      <div class="stat-label">مجموع امتیازات</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">🥇</div>
      <div class="stat-value">${allStudentsCache[0]?.total_score || 0}</div>
      <div class="stat-label">بالاترین امتیاز</div>
    </div>
  `;
}

async function renderRecentScores() {
    const container = document.getElementById('recentScores');
    container.innerHTML = '<div class="loading-screen"><div class="loader loader-lg"></div></div>';

    try {
        const scores = await Scores.getRecent(10);

        if (scores.length === 0) {
            container.innerHTML = '<div class="no-result">هنوز امتیازی ثبت نشده</div>';
            return;
        }

        container.innerHTML = scores.map(sc => {
            const isNeg = sc.amount < 0;
            return `
        <div class="history-item ${isNeg ? 'negative' : ''}">
          <div class="history-icon">⭐</div>
          <div class="history-content">
            <div class="history-reason">${sc.students?.full_name || '?'} — ${sc.reason || 'بدون توضیح'}</div>
            <div class="history-meta"><span>📅 ${toJalaliFull(sc.created_at)}</span></div>
          </div>
          <div class="history-amount ${isNeg ? 'negative' : ''}">${sc.amount > 0 ? '+' : ''}${sc.amount}</div>
        </div>
      `;
        }).join('');
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="no-result">خطا در بارگذاری</div>';
    }
}

/* ============================================
   گروه‌ها
   ============================================ */
async function renderGroupsList() {
    const container = document.getElementById('groupsList');
    container.innerHTML = '<div class="loading-screen"><div class="loader loader-lg"></div></div>';

    try {
        const groups = await Groups.getWithCount();
        allGroupsCache = groups;

        if (groups.length === 0) {
            container.innerHTML = '<div class="no-result">هنوز گروهی ساخته نشده</div>';
            return;
        }

        container.innerHTML = groups.map(g => `
      <div class="session-row">
        <div class="session-info">
          <div class="session-title-text">${g.name}</div>
          <div class="session-meta">
            <span>👥 ${g.student_count || 0} نفر</span>
            ${g.description ? `<span>📝 ${g.description}</span>` : ''}
          </div>
        </div>
        <button class="btn btn-ghost btn-small" onclick="editGroup('${g.id}', '${g.name.replace(/'/g, "\\'")}', '${(g.description || '').replace(/'/g, "\\'")}')">✏️</button>
        <button class="btn btn-danger btn-small" onclick="deleteGroup('${g.id}', '${g.name.replace(/'/g, "\\'")}')">🗑️</button>
      </div>
    `).join('');
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="no-result">خطا در بارگذاری</div>';
    }
}

function openGroupForm() {
    openModal('📁 گروه جدید', `
    <div class="form-group">
      <label class="form-label">نام گروه</label>
      <input type="text" class="form-input" id="groupNameInput" placeholder="مثلاً: فرهنگی شهید مطهری">
    </div>
    <div class="form-group">
      <label class="form-label">توضیحات (اختیاری)</label>
      <input type="text" class="form-input" id="groupDescInput" placeholder="توضیح کوتاه">
    </div>
    <button class="btn btn-primary" style="width:100%;" onclick="saveGroup()">💾 ذخیره</button>
  `);
}

async function saveGroup() {
    const name = document.getElementById('groupNameInput').value.trim();
    const desc = document.getElementById('groupDescInput').value.trim();

    if (!name) {
        showToast('اسم گروه رو وارد کن', 'warning');
        return;
    }

    try {
        await Groups.create(name, desc, currentAdmin.id);
        showToast('گروه ساخته شد ✅', 'success');
        closeModal();
        await loadAll();
        await renderGroupsList();
    } catch (err) {
        console.error(err);
        showToast('خطا در ساخت گروه: ' + err.message, 'error');
    }
}

function editGroup(id, name, desc) {
    openModal('✏️ ویرایش گروه', `
    <div class="form-group">
      <label class="form-label">نام گروه</label>
      <input type="text" class="form-input" id="groupNameInput" value="${name}">
    </div>
    <div class="form-group">
      <label class="form-label">توضیحات</label>
      <input type="text" class="form-input" id="groupDescInput" value="${desc}">
    </div>
    <button class="btn btn-primary" style="width:100%;" onclick="updateGroup('${id}')">💾 ذخیره تغییرات</button>
  `);
}

async function updateGroup(id) {
    const name = document.getElementById('groupNameInput').value.trim();
    const desc = document.getElementById('groupDescInput').value.trim();

    if (!name) {
        showToast('اسم گروه رو وارد کن', 'warning');
        return;
    }

    try {
        await Groups.update(id, name, desc);
        showToast('گروه ویرایش شد ✅', 'success');
        closeModal();
        await loadAll();
        await renderGroupsList();
    } catch (err) {
        console.error(err);
        showToast('خطا در ویرایش', 'error');
    }
}

async function deleteGroup(id, name) {
    if (!confirm(`گروه "${name}" حذف بشه؟ دانش‌آموزانش بدون گروه می‌شن.`)) return;

    try {
        await Groups.delete(id);
        showToast('گروه حذف شد', 'success');
        await loadAll();
        await renderGroupsList();
    } catch (err) {
        console.error(err);
        showToast('خطا در حذف', 'error');
    }
}

/* ============================================
   دانش‌آموزان
   ============================================ */
async function renderStudents() {
    const container = document.getElementById('studentsList');
    const filterGroup = document.getElementById('filterGroup').value;
    const search = document.getElementById('studentSearch').value.trim();

    let students = allStudentsCache;

    if (filterGroup) students = students.filter(s => s.group_id === filterGroup);
    if (search) students = students.filter(s => s.full_name.includes(search));

    if (students.length === 0) {
        container.innerHTML = '<div class="no-result">دانش‌آموزی یافت نشد</div>';
        return;
    }

    students.sort((a, b) => (b.total_score || 0) - (a.total_score || 0));

    container.innerHTML = students.map(s => `
    <div class="session-row">
      <div class="avatar" style="background:${s.avatar_color || '#06b6d4'};width:40px;height:40px;font-size:16px;">
        ${getInitial(s.full_name)}
      </div>
      <div class="session-info">
        <div class="session-title-text">${s.full_name}</div>
        <div class="session-meta">
          <span>📁 ${s.groups?.name || 'بدون گروه'}</span>
          ${s.phone ? `<span>📱 ${s.phone}</span>` : ''}
          <span>⭐ ${s.total_score || 0} امتیاز</span>
        </div>
      </div>
      <button class="btn btn-ghost btn-small" onclick="editStudent('${s.id}')">✏️</button>
      <button class="btn btn-danger btn-small" onclick="deleteStudent('${s.id}', '${s.full_name.replace(/'/g, "\\'")}')">🗑️</button>
    </div>
  `).join('');
}

function openStudentForm() {
    const groupOptions = allGroupsCache.map(g =>
        `<option value="${g.id}">${g.name}</option>`
    ).join('');

    openModal('👤 دانش‌آموز جدید', `
    <div class="form-group">
      <label class="form-label">نام و نام خانوادگی</label>
      <input type="text" class="form-input" id="studentNameInput" placeholder="مثلاً: علی محمدی">
    </div>
    <div class="form-group">
      <label class="form-label">شماره تلفن (اختیاری)</label>
      <input type="tel" class="form-input" id="studentPhoneInput" placeholder="09xxxxxxxxx">
    </div>
    <div class="form-group">
      <label class="form-label">گروه</label>
      <select class="form-select" id="studentGroupInput">
        <option value="">بدون گروه</option>
        ${groupOptions}
      </select>
    </div>
    <button class="btn btn-primary" style="width:100%;" onclick="saveStudent()">💾 ذخیره</button>
  `);
}

async function saveStudent() {
    const name = document.getElementById('studentNameInput').value.trim();
    const phone = document.getElementById('studentPhoneInput').value.trim();
    const groupId = document.getElementById('studentGroupInput').value || null;

    if (!name) {
        showToast('اسم رو وارد کن', 'warning');
        return;
    }

    try {
        await Students.create(name, phone, groupId);
        showToast('دانش‌آموز اضافه شد ✅', 'success');
        closeModal();
        await loadAll();
        await renderStudents();
    } catch (err) {
        console.error(err);
        showToast('خطا: ' + err.message, 'error');
    }
}

function editStudent(id) {
    const student = allStudentsCache.find(s => s.id === id);
    if (!student) return;

    const groupOptions = allGroupsCache.map(g =>
        `<option value="${g.id}" ${g.id === student.group_id ? 'selected' : ''}>${g.name}</option>`
    ).join('');

    openModal('✏️ ویرایش دانش‌آموز', `
    <div class="form-group">
      <label class="form-label">نام و نام خانوادگی</label>
      <input type="text" class="form-input" id="studentNameInput" value="${student.full_name}">
    </div>
    <div class="form-group">
      <label class="form-label">شماره تلفن</label>
      <input type="tel" class="form-input" id="studentPhoneInput" value="${student.phone || ''}">
    </div>
    <div class="form-group">
      <label class="form-label">گروه</label>
      <select class="form-select" id="studentGroupInput">
        <option value="">بدون گروه</option>
        ${groupOptions}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">امتیاز کل (دستی)</label>
      <input type="number" class="form-input" id="studentScoreInput" value="${student.total_score || 0}">
    </div>
    <button class="btn btn-primary" style="width:100%;" onclick="updateStudent('${id}')">💾 ذخیره تغییرات</button>
  `);
}

async function updateStudent(id) {
    const full_name = document.getElementById('studentNameInput').value.trim();
    const phone = document.getElementById('studentPhoneInput').value.trim();
    const group_id = document.getElementById('studentGroupInput').value || null;
    const total_score = Number(document.getElementById('studentScoreInput').value) || 0;

    if (!full_name) {
        showToast('اسم رو وارد کن', 'warning');
        return;
    }

    try {
        await Students.update(id, { full_name, phone, group_id, total_score });
        showToast('ویرایش شد ✅', 'success');
        closeModal();
        await loadAll();
        await renderStudents();
    } catch (err) {
        console.error(err);
        showToast('خطا: ' + err.message, 'error');
    }
}

async function deleteStudent(id, name) {
    if (!confirm(`دانش‌آموز "${name}" حذف بشه؟ همه امتیازاش هم پاک می‌شن.`)) return;

    try {
        await Students.delete(id);
        showToast('حذف شد', 'success');
        await loadAll();
        await renderStudents();
    } catch (err) {
        console.error(err);
        showToast('خطا در حذف', 'error');
    }
}

/* ============================================
   ثبت حضور
   ============================================ */
async function renderAttendance() {
    const groupId = document.getElementById('attGroup').value;
    const container = document.getElementById('attendanceList');
    selectedAttendance.clear();
    updateAttendanceCounter();

    if (!groupId) {
        container.innerHTML = '<div class="no-result">اول یه گروه انتخاب کن</div>';
        return;
    }

    container.innerHTML = '<div class="loading-screen"><div class="loader loader-lg"></div></div>';

    try {
        const students = await Students.getByGroup(groupId);

        if (students.length === 0) {
            container.innerHTML = '<div class="no-result">این گروه دانش‌آموزی نداره</div>';
            return;
        }

        container.innerHTML = students.map(s => `
      <div class="attendance-item" data-id="${s.id}" onclick="toggleAttendance('${s.id}')">
        <div class="custom-checkbox"></div>
        <div class="avatar" style="background:${s.avatar_color || '#06b6d4'};width:38px;height:38px;font-size:15px;">
          ${getInitial(s.full_name)}
        </div>
        <div class="student-info">
          <div class="student-name">${s.full_name}</div>
          <div class="student-group-name">امتیاز فعلی: ${s.total_score || 0}</div>
        </div>
      </div>
    `).join('');
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="no-result">خطا در بارگذاری</div>';
    }
}

function toggleAttendance(studentId) {
    const el = document.querySelector(`.attendance-item[data-id="${studentId}"]`);
    if (!el) return;

    if (selectedAttendance.has(studentId)) {
        selectedAttendance.delete(studentId);
        el.classList.remove('selected');
    } else {
        selectedAttendance.add(studentId);
        el.classList.add('selected');
    }
    updateAttendanceCounter();
}

function selectAllAttendance() {
    document.querySelectorAll('.attendance-item').forEach(el => {
        const id = el.dataset.id;
        selectedAttendance.add(id);
        el.classList.add('selected');
    });
    updateAttendanceCounter();
}

function deselectAllAttendance() {
    document.querySelectorAll('.attendance-item').forEach(el => {
        el.classList.remove('selected');
    });
    selectedAttendance.clear();
    updateAttendanceCounter();
}

function updateAttendanceCounter() {
    const count = selectedAttendance.size;
    document.getElementById('attCounter').textContent = `${count} نفر انتخاب شده`;
}

async function submitAttendance() {
    if (selectedAttendance.size === 0) {
        showToast('حداقل یه نفر رو انتخاب کن', 'warning');
        return;
    }

    const reason = document.getElementById('attReason').value.trim() || 'حضور در جلسه';
    const sessionTitle = document.getElementById('attSessionTitle').value.trim();
    const groupId = document.getElementById('attGroup').value;

    const entries = Array.from(selectedAttendance).map(studentId => ({
        studentId,
        amount: 5,
        reason,
        sessionTitle
    }));

    try {
        await Scores.addBulk(entries, 'attendance', currentAdmin.id);

        // اگه عنوان جلسه داشت، تو جدول sessions هم ثبت کن
        if (sessionTitle) {
            try {
                await Sessions.create(sessionTitle, new Date().toISOString().split('T')[0], groupId, reason, currentAdmin.id);
            } catch (e) { console.warn('خطا در ثبت جلسه:', e); }
        }

        showToast(`✅ ${entries.length} نفر ثبت شدن (+۵ امتیاز)`, 'success');

        // ریست کردن
        selectedAttendance.clear();
        document.getElementById('attReason').value = '';
        document.getElementById('attSessionTitle').value = '';
        await loadAll();
        await renderAttendance();
        renderStats();
    } catch (err) {
        console.error(err);
        showToast('خطا در ثبت: ' + err.message, 'error');
    }
}

/* ============================================
   امتیاز متفرقه
   ============================================ */
async function searchManualStudent() {
    const query = document.getElementById('manualSearch').value.trim();
    const container = document.getElementById('manualSearchResults');

    if (query.length < 1) {
        container.innerHTML = '';
        return;
    }

    try {
        const results = await Students.search(query);

        if (results.length === 0) {
            container.innerHTML = '<div class="no-result">نتیجه‌ای پیدا نشد</div>';
            return;
        }

        container.innerHTML = results.map(s => `
      <div class="search-result" onclick='selectManualStudent(${JSON.stringify({ id: s.id, full_name: s.full_name, avatar_color: s.avatar_color, group: s.groups?.name, total_score: s.total_score }).replace(/'/g, "&#39;")})'>
        <div class="avatar" style="background:${s.avatar_color || '#06b6d4'}">
          ${getInitial(s.full_name)}
        </div>
        <div class="student-info">
          <div class="student-name">${s.full_name}</div>
          <div class="student-group-name">${s.groups?.name || 'بدون گروه'} — ${s.total_score || 0} امتیاز</div>
        </div>
      </div>
    `).join('');
    } catch (err) {
        console.error(err);
    }
}

function selectManualStudent(student) {
    manualSelectedStudent = student;
    document.getElementById('manualSearchResults').innerHTML = '';
    document.getElementById('manualSearch').value = student.full_name;

    const box = document.getElementById('manualSelectedBox');
    box.style.display = 'block';

    document.getElementById('manualAvatar').textContent = getInitial(student.full_name);
    document.getElementById('manualAvatar').style.background = student.avatar_color || '#06b6d4';
    document.getElementById('manualName').textContent = student.full_name;
    document.getElementById('manualGroup').textContent = `📁 ${student.group || 'بدون گروه'} — امتیاز فعلی: ${student.total_score || 0}`;
}

async function submitManualScore() {
    if (!manualSelectedStudent) {
        showToast('اول یه دانش‌آموز انتخاب کن', 'warning');
        return;
    }

    const amount = Number(document.getElementById('manualAmount').value);
    if (!amount) {
        showToast('مقدار امتیاز رو وارد کن', 'warning');
        return;
    }

    const reason = document.getElementById('manualReason').value.trim() || 'امتیاز متفرقه';
    const sessionTitle = document.getElementById('manualSession').value.trim();

    try {
        const newTotal = await Scores.add(manualSelectedStudent.id, amount, reason, sessionTitle, 'manual', currentAdmin.id);
        showToast(`✅ ${amount > 0 ? '+' : ''}${amount} امتیاز ثبت شد. جمع: ${newTotal}`, 'success');

        // ریست
        document.getElementById('manualAmount').value = '';
        document.getElementById('manualReason').value = '';
        document.getElementById('manualSession').value = '';
        document.getElementById('manualSearch').value = '';
        document.getElementById('manualSelectedBox').style.display = 'none';
        manualSelectedStudent = null;

        await loadAll();
        renderStats();
        renderRecentScores();
    } catch (err) {
        console.error(err);
        showToast('خطا: ' + err.message, 'error');
    }
}

/* ============================================
   جلسات
   ============================================ */
async function renderSessionsList() {
    const container = document.getElementById('sessionsList');
    container.innerHTML = '<div class="loading-screen"><div class="loader loader-lg"></div></div>';

    try {
        const sessions = await Sessions.getAll();

        if (sessions.length === 0) {
            container.innerHTML = '<div class="no-result">هنوز جلسه‌ای ثبت نشده</div>';
            return;
        }

        container.innerHTML = sessions.map(s => `
      <div class="session-row">
        <div class="session-info">
          <div class="session-title-text">📚 ${s.title}</div>
          <div class="session-meta">
            <span>📅 ${toJalali(s.session_date)}</span>
            ${s.groups?.name ? `<span>📁 ${s.groups.name}</span>` : ''}
            ${s.notes ? `<span>📝 ${s.notes}</span>` : ''}
          </div>
        </div>
        <button class="btn btn-ghost btn-small" onclick="editSession('${s.id}')">✏️</button>
        <button class="btn btn-danger btn-small" onclick="deleteSession('${s.id}', '${s.title.replace(/'/g, "\\'")}')">🗑️</button>
      </div>
    `).join('');
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="no-result">خطا در بارگذاری</div>';
    }
}

function openSessionForm() {
    const today = new Date().toISOString().split('T')[0];
    const groupOptions = allGroupsCache.map(g =>
        `<option value="${g.id}">${g.name}</option>`
    ).join('');

    openModal('📚 جلسه جدید', `
    <div class="form-group">
      <label class="form-label">عنوان جلسه</label>
      <input type="text" class="form-input" id="sessionTitleInput" placeholder="مثلاً: قصه‌های قرآنی - جلسه ۵">
    </div>
    <div class="form-group">
      <label class="form-label">تاریخ</label>
      <input type="date" class="form-input" id="sessionDateInput" value="${today}">
    </div>
    <div class="form-group">
      <label class="form-label">گروه (اختیاری)</label>
      <select class="form-select" id="sessionGroupInput">
        <option value="">همه / عمومی</option>
        ${groupOptions}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">توضیحات</label>
      <textarea class="form-textarea" id="sessionNotesInput" placeholder="توضیحات اضافه..."></textarea>
    </div>
    <button class="btn btn-primary" style="width:100%;" onclick="saveSession()">💾 ذخیره</button>
  `);
}

async function saveSession() {
    const title = document.getElementById('sessionTitleInput').value.trim();
    const date = document.getElementById('sessionDateInput').value;
    const groupId = document.getElementById('sessionGroupInput').value || null;
    const notes = document.getElementById('sessionNotesInput').value.trim();

    if (!title) {
        showToast('عنوان جلسه رو وارد کن', 'warning');
        return;
    }

    try {
        await Sessions.create(title, date, groupId, notes, currentAdmin.id);
        showToast('جلسه ثبت شد ✅', 'success');
        closeModal();
        await renderSessionsList();
    } catch (err) {
        console.error(err);
        showToast('خطا: ' + err.message, 'error');
    }
}

async function editSession(id) {
    try {
        const sessions = await Sessions.getAll();
        const s = sessions.find(x => x.id === id);
        if (!s) return;

        const groupOptions = allGroupsCache.map(g =>
            `<option value="${g.id}" ${g.id === s.group_id ? 'selected' : ''}>${g.name}</option>`
        ).join('');

        openModal('✏️ ویرایش جلسه', `
      <div class="form-group">
        <label class="form-label">عنوان</label>
        <input type="text" class="form-input" id="sessionTitleInput" value="${s.title}">
      </div>
      <div class="form-group">
        <label class="form-label">تاریخ</label>
        <input type="date" class="form-input" id="sessionDateInput" value="${s.session_date}">
      </div>
      <div class="form-group">
        <label class="form-label">گروه</label>
        <select class="form-select" id="sessionGroupInput">
          <option value="">همه / عمومی</option>
          ${groupOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">توضیحات</label>
        <textarea class="form-textarea" id="sessionNotesInput">${s.notes || ''}</textarea>
      </div>
      <button class="btn btn-primary" style="width:100%;" onclick="updateSession('${id}')">💾 ذخیره تغییرات</button>
    `);
    } catch (err) {
        console.error(err);
    }
}

async function updateSession(id) {
    const title = document.getElementById('sessionTitleInput').value.trim();
    const session_date = document.getElementById('sessionDateInput').value;
    const group_id = document.getElementById('sessionGroupInput').value || null;
    const notes = document.getElementById('sessionNotesInput').value.trim();

    try {
        await Sessions.update(id, { title, session_date, group_id, notes });
        showToast('ویرایش شد ✅', 'success');
        closeModal();
        await renderSessionsList();
    } catch (err) {
        console.error(err);
        showToast('خطا', 'error');
    }
}

async function deleteSession(id, title) {
    if (!confirm(`جلسه "${title}" حذف بشه؟`)) return;
    try {
        await Sessions.delete(id);
        showToast('حذف شد', 'success');
        await renderSessionsList();
    } catch (err) {
        console.error(err);
        showToast('خطا', 'error');
    }
}

/* ============================================
   ادمین‌ها
   ============================================ */
async function renderAdminsList() {
    const container = document.getElementById('adminsList');
    container.innerHTML = '<div class="loading-screen"><div class="loader loader-lg"></div></div>';

    try {
        const admins = await Admins.getAll();

        container.innerHTML = admins.map(a => `
      <div class="admin-row">
        <div class="avatar" style="background:${a.role === 'super' ? '#fbbf24' : '#06b6d4'};width:44px;height:44px;">
          ${getInitial(a.full_name)}
        </div>
        <div class="admin-row-info">
          <div class="admin-row-name">
            ${a.full_name}
            ${a.role === 'super' ? '<span class="role-badge super" style="margin-right:8px;">سوپر</span>' : ''}
          </div>
          <div class="admin-row-phone">📱 ${a.phone}</div>
        </div>
        ${a.role !== 'super' ? `
          <button class="btn btn-ghost btn-small" onclick="changeAdminPassword('${a.id}', '${a.full_name.replace(/'/g, "\\'")}')">🔒 رمز</button>
          <button class="btn btn-danger btn-small" onclick="deleteAdmin('${a.id}', '${a.full_name.replace(/'/g, "\\'")}')">🗑️</button>
        ` : ''}
      </div>
    `).join('');
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="no-result">خطا</div>';
    }
}

function openAdminForm() {
    openModal('🔑 ادمین جدید', `
    <div class="form-group">
      <label class="form-label">نام و نام خانوادگی</label>
      <input type="text" class="form-input" id="adminNameInput" placeholder="مثلاً: علی محمدی">
    </div>
    <div class="form-group">
      <label class="form-label">شماره تلفن</label>
      <input type="tel" class="form-input" id="adminPhoneInput" placeholder="09xxxxxxxxx">
    </div>
    <div class="form-group">
      <label class="form-label">رمز عبور</label>
      <input type="password" class="form-input" id="adminPasswordInput" placeholder="حداقل ۶ کاراکتر">
    </div>
    <button class="btn btn-primary" style="width:100%;" onclick="saveAdmin()">💾 ذخیره</button>
  `);
}

async function saveAdmin() {
    const name = document.getElementById('adminNameInput').value.trim();
    const phone = document.getElementById('adminPhoneInput').value.trim();
    const password = document.getElementById('adminPasswordInput').value;

    if (!name || !phone || !password) {
        showToast('همه فیلدها رو پر کن', 'warning');
        return;
    }

    if (password.length < 6) {
        showToast('رمز حداقل ۶ کاراکتر', 'warning');
        return;
    }

    try {
        await Admins.create(phone, password, name, 'admin', currentAdmin.id);
        showToast('ادمین اضافه شد ✅', 'success');
        closeModal();
        await renderAdminsList();
    } catch (err) {
        console.error(err);
        if (err.message.includes('duplicate')) {
            showToast('این شماره قبلاً ثبت شده', 'error');
        } else {
            showToast('خطا: ' + err.message, 'error');
        }
    }
}

function changeAdminPassword(id, name) {
    openModal('🔒 تغییر رمز ادمین', `
    <p style="color:var(--gray);margin-bottom:16px;font-size:14px;">تغییر رمز برای: <b>${name}</b></p>
    <div class="form-group">
      <label class="form-label">رمز جدید</label>
      <input type="password" class="form-input" id="newPasswordInput" placeholder="حداقل ۶ کاراکتر">
    </div>
    <button class="btn btn-primary" style="width:100%;" onclick="updateAdminPassword('${id}')">💾 ذخیره</button>
  `);
}

async function updateAdminPassword(id) {
    const password = document.getElementById('newPasswordInput').value;
    if (password.length < 6) {
        showToast('رمز حداقل ۶ کاراکتر', 'warning');
        return;
    }
    try {
        await Admins.updatePassword(id, password);
        showToast('رمز تغییر کرد ✅', 'success');
        closeModal();
    } catch (err) {
        console.error(err);
        showToast('خطا', 'error');
    }
}

async function deleteAdmin(id, name) {
    if (!confirm(`ادمین "${name}" حذف بشه؟`)) return;
    try {
        await Admins.delete(id);
        showToast('حذف شد', 'success');
        await renderAdminsList();
    } catch (err) {
        console.error(err);
        showToast('خطا', 'error');
    }
}
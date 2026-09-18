/* ============================================
   منطق پنل ادمین (admin.html)
   ============================================ */

let currentAdmin = null;
let allGroupsCache = [];
let allStudentsCache = [];
let selectedAttendance = new Set();
let manualSelectedStudent = null;
let selectedMembers = new Set();
let currentGroupForMembers = null;

/* ============================================
   راه‌اندازی
   ============================================ */
document.addEventListener('DOMContentLoaded', async () => {
  currentAdmin = requireAdmin();
  if (!currentAdmin) return;

  const valid = await Auth.verify();
  if (!valid) {
    Auth.clear();
    window.location.href = 'login.html';
    return;
  }

  initHeader();
  initTheme();
  initTabs();
  initModals();

  await loadAll();
  renderStats();
  renderRecentScores();

  if (typeof renderSmartAnalysis === 'function') {
    setTimeout(() => renderSmartAnalysis(), 300);
  }
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
  else if (tabName === 'history') await renderHistory();
  else if (tabName === 'audit') await renderAuditLog();
  else if (tabName === 'dashboard') {
    renderStats();
    renderRecentScores();
    if (typeof renderSmartAnalysis === 'function') renderSmartAnalysis();
    if (typeof renderCharts === 'function') renderCharts();
    if (typeof renderLeaderboard === 'function') renderLeaderboard('all');
  }
  else if (tabName === 'import') {
    if (typeof initImportZone === 'function') initImportZone();
  }
}

/* ============================================
   مودال
   ============================================ */
function initModals() {
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('active');
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
   بارگذاری
   ============================================ */
async function loadAll() {
  try {
    const [groups, students] = await Promise.all([
      Groups.getAll(),
      Students.getAllWithGroups()
    ]);
    allGroupsCache = groups;
    allStudentsCache = students;
    fillGroupSelects();
  } catch (err) {
    console.error(err);
    showToast('خطا در بارگذاری', 'error');
  }
}

function fillGroupSelects() {
  const options = allGroupsCache.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

  const filterGroup = document.getElementById('filterGroup');
  if (filterGroup) filterGroup.innerHTML = `<option value="">همه گروه‌ها</option>${options}`;

  const attGroup = document.getElementById('attGroup');
  if (attGroup) attGroup.innerHTML = `<option value="">انتخاب گروه...</option>${options}`;

  const histFilter = document.getElementById('historyGroupFilter');
  if (histFilter) histFilter.innerHTML = `<option value="">همه گروه‌ها</option>${options}`;
}

/* ============================================
   داشبورد
   ============================================ */
function renderStats() {
  const container = document.getElementById('statsGrid');
  if (!container) return;
  const totalStudents = allStudentsCache.length;
  const totalGroups = allGroupsCache.length;
  const totalScores = allStudentsCache.reduce((sum, s) => sum + (s.total_score || 0), 0);

  container.innerHTML = `
    <div class="stat-card"><div class="stat-icon">👥</div><div class="stat-value">${totalStudents}</div><div class="stat-label">دانش‌آموز</div></div>
    <div class="stat-card"><div class="stat-icon">📁</div><div class="stat-value">${totalGroups}</div><div class="stat-label">گروه</div></div>
    <div class="stat-card"><div class="stat-icon">⭐</div><div class="stat-value">${totalScores}</div><div class="stat-label">مجموع امتیازات</div></div>
    <div class="stat-card"><div class="stat-icon">🥇</div><div class="stat-value">${allStudentsCache[0]?.total_score || 0}</div><div class="stat-label">بالاترین امتیاز</div></div>
  `;
}

async function renderRecentScores() {
  const container = document.getElementById('recentScores');
  if (!container) return;
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
    container.innerHTML = '<div class="no-result">خطا</div>';
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
        <button class="btn btn-primary btn-small" onclick="manageGroupMembers('${g.id}', '${g.name.replace(/'/g, "\\'")}')">👥 اعضا</button>
        <button class="btn btn-ghost btn-small" onclick="editGroup('${g.id}', '${g.name.replace(/'/g, "\\'")}', '${(g.description || '').replace(/'/g, "\\'")}')">✏️</button>
        <button class="btn btn-danger btn-small" onclick="deleteGroup('${g.id}', '${g.name.replace(/'/g, "\\'")}')">🗑️</button>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="no-result">خطا</div>';
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
  if (!name) { showToast('اسم گروه رو وارد کن', 'warning'); return; }
  try {
    await Groups.create(name, desc);
    showToast('گروه ساخته شد ✅', 'success');
    closeModal();
    await loadAll();
    await renderGroupsList();
  } catch (err) {
    console.error(err);
    showToast('خطا: ' + err.message, 'error');
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
  if (!name) { showToast('اسم گروه رو وارد کن', 'warning'); return; }
  try {
    await Groups.update(id, name, desc);
    showToast('ویرایش شد ✅', 'success');
    closeModal();
    await loadAll();
    await renderGroupsList();
  } catch (err) {
    console.error(err);
    showToast('خطا: ' + err.message, 'error');
  }
}

async function deleteGroup(id, name) {
  if (!confirm(`گروه "${name}" حذف بشه؟`)) return;
  try {
    await Groups.delete(id);
    showToast('حذف شد', 'success');
    await loadAll();
    await renderGroupsList();
  } catch (err) {
    console.error(err);
    showToast('خطا: ' + err.message, 'error');
  }
}

/* ============================================
   مدیریت اعضای گروه
   ============================================ */
async function manageGroupMembers(groupId, groupName) {
  currentGroupForMembers = groupId;
  selectedMembers.clear();

  try {
    const currentMembers = await Groups.getStudents(groupId);
    currentMembers.forEach(s => selectedMembers.add(s.id));
  } catch (err) {
    console.error('خطا در گرفتن اعضا:', err);
  }

  const allStudents = [...allStudentsCache].sort((a, b) => a.full_name.localeCompare(b.full_name, 'fa'));

  const membersHTML = allStudents.length === 0
    ? '<div class="no-result">هنوز دانش‌آموزی ثبت نشده</div>'
    : allStudents.map(s => `
        <div class="member-item ${selectedMembers.has(s.id) ? 'selected' : ''}" data-id="${s.id}" onclick="toggleMember('${s.id}')">
          <div class="custom-checkbox"></div>
          <div class="avatar" style="background:${s.avatar_color || '#06b6d4'};width:36px;height:36px;font-size:14px;">
            ${getInitial(s.full_name)}
          </div>
          <div class="member-name">${s.full_name}</div>
          <span style="font-size:12px;color:var(--gray);">${s.total_score || 0} امتیاز</span>
        </div>
      `).join('');

  openModal(`👥 اعضای گروه: ${groupName}`, `
    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
      <button class="btn btn-ghost btn-small" onclick="selectAllMembers()">✅ انتخاب همه</button>
      <button class="btn btn-ghost btn-small" onclick="deselectAllMembers()">❌ هیچ‌کدام</button>
      <span class="counter-badge" id="memberCounter">${selectedMembers.size} نفر</span>
    </div>
    <div style="max-height:400px;overflow-y:auto;padding-left:6px;" id="membersList">
      ${membersHTML}
    </div>
    <button class="btn btn-primary" style="width:100%;margin-top:16px;" onclick="saveGroupMembers()">
      💾 ذخیره اعضا
    </button>
  `);
}

function toggleMember(studentId) {
  const el = document.querySelector(`.member-item[data-id="${studentId}"]`);
  if (!el) return;
  if (selectedMembers.has(studentId)) {
    selectedMembers.delete(studentId);
    el.classList.remove('selected');
  } else {
    selectedMembers.add(studentId);
    el.classList.add('selected');
  }
  updateMemberCounter();
}

function selectAllMembers() {
  allStudentsCache.forEach(s => selectedMembers.add(s.id));
  document.querySelectorAll('.member-item').forEach(el => el.classList.add('selected'));
  updateMemberCounter();
}

function deselectAllMembers() {
  selectedMembers.clear();
  document.querySelectorAll('.member-item').forEach(el => el.classList.remove('selected'));
  updateMemberCounter();
}

function updateMemberCounter() {
  const counter = document.getElementById('memberCounter');
  if (counter) counter.textContent = `${selectedMembers.size} نفر`;
}

async function saveGroupMembers() {
  if (!currentGroupForMembers) return;
  try {
    const currentMembers = await Groups.getStudents(currentGroupForMembers);
    const currentIds = currentMembers.map(s => s.id);
    const toAdd = [...selectedMembers].filter(id => !currentIds.includes(id));
    const toRemove = currentIds.filter(id => !selectedMembers.has(id));

    for (const sid of toAdd) {
      await Students.addToGroup(sid, currentGroupForMembers);
    }
    for (const sid of toRemove) {
      await Students.removeFromGroup(sid, currentGroupForMembers);
    }

    showToast(`✅ ${toAdd.length} نفر اضافه، ${toRemove.length} نفر حذف شد`, 'success');
    closeModal();
    await loadAll();
    await renderGroupsList();
  } catch (err) {
    console.error(err);
    showToast('خطا: ' + err.message, 'error');
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
  if (filterGroup) students = students.filter(s => s.groups.some(g => g.id === filterGroup));
  if (search) students = students.filter(s => s.full_name.includes(search));

  if (students.length === 0) {
    container.innerHTML = '<div class="no-result">دانش‌آموزی یافت نشد</div>';
    return;
  }

  students.sort((a, b) => (b.total_score || 0) - (a.total_score || 0));

  container.innerHTML = students.map(s => {
    const groupsText = s.groups.length > 0
      ? s.groups.map(g => g.name).join(' • ')
      : 'بدون گروه';

    return `
      <div class="session-row">
        <div class="avatar" style="background:${s.avatar_color || '#06b6d4'};width:40px;height:40px;font-size:16px;">
          ${getInitial(s.full_name)}
        </div>
        <div class="session-info">
          <div class="session-title-text">${s.full_name}</div>
          <div class="session-meta">
            <span>📁 ${groupsText}</span>
            ${s.phone ? `<span>📱 ${s.phone}</span>` : ''}
            <span>⭐ ${s.total_score || 0} امتیاز</span>
          </div>
        </div>
        <button class="btn btn-ghost btn-small" onclick="exportStudentReport('${s.id}')" title="کارنامه">📄</button>
        <button class="btn btn-ghost btn-small" onclick="editStudent('${s.id}')">✏️</button>
        <button class="btn btn-danger btn-small" onclick="deleteStudent('${s.id}', '${s.full_name.replace(/'/g, "\\'")}')">🗑️</button>
      </div>
    `;
  }).join('');
}

function openStudentForm() {
  const groupsCheckbox = allGroupsCache.map(g => `
    <label style="display:flex;align-items:center;gap:8px;padding:8px;background:rgba(30,41,59,0.4);border-radius:8px;margin-bottom:6px;cursor:pointer;">
      <input type="checkbox" value="${g.id}" class="student-group-cb">
      <span>${g.name}</span>
    </label>
  `).join('');

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
      <label class="form-label">گروه‌ها</label>
      <div>${groupsCheckbox || '<div class="no-result">هنوز گروهی ساخته نشده</div>'}</div>
    </div>
    <button class="btn btn-primary" style="width:100%;" onclick="saveStudent()">💾 ذخیره</button>
  `);
}

async function saveStudent() {
  const name = document.getElementById('studentNameInput').value.trim();
  const phone = document.getElementById('studentPhoneInput').value.trim();
  const groupIds = Array.from(document.querySelectorAll('.student-group-cb:checked')).map(cb => cb.value);

  if (!name) { showToast('اسم رو وارد کن', 'warning'); return; }

  try {
    await Students.create(name, phone, groupIds);
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

  const studentGroupIds = student.groups.map(g => g.id);

  const groupsCheckbox = allGroupsCache.map(g => `
    <label style="display:flex;align-items:center;gap:8px;padding:8px;background:rgba(30,41,59,0.4);border-radius:8px;margin-bottom:6px;cursor:pointer;">
      <input type="checkbox" value="${g.id}" class="student-group-cb" ${studentGroupIds.includes(g.id) ? 'checked' : ''}>
      <span>${g.name}</span>
    </label>
  `).join('');

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
      <label class="form-label">گروه‌ها</label>
      <div>${groupsCheckbox || '<div class="no-result">هنوز گروهی ساخته نشده</div>'}</div>
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
  const total_score = Number(document.getElementById('studentScoreInput').value) || 0;
  const groupIds = Array.from(document.querySelectorAll('.student-group-cb:checked')).map(cb => cb.value);

  if (!full_name) { showToast('اسم رو وارد کن', 'warning'); return; }

  try {
    await Students.update(id, { full_name, phone, total_score });
    await Students.setGroups(id, groupIds);
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
    showToast('خطا: ' + err.message, 'error');
  }
}

/* ============================================
   ثبت حضور (۵۰ امتیاز)
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
    selectedAttendance.add(el.dataset.id);
    el.classList.add('selected');
  });
  updateAttendanceCounter();
}

function deselectAllAttendance() {
  document.querySelectorAll('.attendance-item').forEach(el => el.classList.remove('selected'));
  selectedAttendance.clear();
  updateAttendanceCounter();
}

function updateAttendanceCounter() {
  const counter = document.getElementById('attCounter');
  if (counter) counter.textContent = `${selectedAttendance.size} نفر انتخاب شده`;
}

async function submitAttendance() {
  if (selectedAttendance.size === 0) {
    showToast('حداقل یه نفر رو انتخاب کن', 'warning');
    return;
  }

  const reason = document.getElementById('attReason').value.trim() || 'حضور در جلسه';
  const sessionTitle = document.getElementById('attSessionTitle').value.trim() || 'جلسه عمومی';
  const groupId = document.getElementById('attGroup').value;

  const entries = Array.from(selectedAttendance).map(studentId => ({
    studentId, amount: 50, reason, sessionTitle
  }));

  try {
    await Scores.addBulk(entries, 'attendance');
    const sessionResult = await Sessions.create(sessionTitle, new Date().toISOString().split('T')[0], groupId, reason);
    if (sessionResult.success) {
      await AttendanceRecords.addBulk(sessionResult.id, Array.from(selectedAttendance));
    }

    showToast(`✅ ${entries.length} نفر ثبت شدن (+۵۰ امتیاز)`, 'success');

    if (typeof quickConfetti === 'function' && entries.length >= 5) {
      quickConfetti();
    }

    selectedAttendance.clear();
    document.getElementById('attReason').value = '';
    document.getElementById('attSessionTitle').value = '';
    await loadAll();
    await renderAttendance();
    renderStats();
    if (typeof renderSmartAnalysis === 'function') renderSmartAnalysis();
  } catch (err) {
    console.error(err);
    showToast('خطا: ' + err.message, 'error');
  }
}

/* ============================================
   امتیاز متفرقه
   ============================================ */
async function searchManualStudent() {
  const query = document.getElementById('manualSearch').value.trim();
  const container = document.getElementById('manualSearchResults');

  if (query.length < 1) { container.innerHTML = ''; return; }

  try {
    const results = await Students.search(query);
    if (results.length === 0) {
      container.innerHTML = '<div class="no-result">نتیجه‌ای پیدا نشد</div>';
      return;
    }

    const withGroups = await Promise.all(
      results.map(async s => ({
        ...s,
        groups: await Students.getGroups(s.id)
      }))
    );

    container.innerHTML = withGroups.map(s => {
      const groupsText = s.groups.length > 0 ? s.groups.map(g => g.name).join(' • ') : 'بدون گروه';
      return `
        <div class="search-result" data-id="${s.id}">
          <div class="avatar" style="background:${s.avatar_color || '#06b6d4'}">
            ${getInitial(s.full_name)}
          </div>
          <div class="student-info">
            <div class="student-name">${s.full_name}</div>
            <div class="student-group-name">${groupsText} — ${s.total_score || 0} امتیاز</div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.search-result').forEach(el => {
      el.addEventListener('click', () => {
        const student = withGroups.find(x => x.id === el.dataset.id);
        selectManualStudent({
          id: student.id,
          full_name: student.full_name,
          avatar_color: student.avatar_color,
          group: student.groups.map(g => g.name).join(' • ') || 'بدون گروه',
          total_score: student.total_score
        });
      });
    });
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
  document.getElementById('manualGroup').textContent = `📁 ${student.group} — امتیاز فعلی: ${student.total_score || 0}`;
}

async function submitManualScore() {
  if (!manualSelectedStudent) { showToast('اول یه دانش‌آموز انتخاب کن', 'warning'); return; }
  const amount = Number(document.getElementById('manualAmount').value);
  if (!amount) { showToast('مقدار امتیاز رو وارد کن', 'warning'); return; }

  const reason = document.getElementById('manualReason').value.trim() || 'امتیاز متفرقه';
  const sessionTitle = document.getElementById('manualSession').value.trim();
  const oldTotal = manualSelectedStudent.total_score || 0;

  try {
    const newTotal = await Scores.add(manualSelectedStudent.id, amount, reason, sessionTitle, 'manual');
    showToast(`✅ ${amount > 0 ? '+' : ''}${amount} امتیاز ثبت شد. جمع: ${newTotal}`, 'success');

    if (typeof checkMilestone === 'function') {
      checkMilestone(oldTotal, newTotal);
    }

    document.getElementById('manualAmount').value = '';
    document.getElementById('manualReason').value = '';
    document.getElementById('manualSession').value = '';
    document.getElementById('manualSearch').value = '';
    document.getElementById('manualSelectedBox').style.display = 'none';
    manualSelectedStudent = null;

    await loadAll();
    renderStats();
    renderRecentScores();
    if (typeof renderSmartAnalysis === 'function') renderSmartAnalysis();
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
    container.innerHTML = '<div class="no-result">خطا</div>';
  }
}

function openSessionForm() {
  const today = new Date().toISOString().split('T')[0];
  const groupOptions = allGroupsCache.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

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
      <textarea class="form-textarea" id="sessionNotesInput" placeholder="توضیحات..."></textarea>
    </div>
    <button class="btn btn-primary" style="width:100%;" onclick="saveSession()">💾 ذخیره</button>
  `);
}

async function saveSession() {
  const title = document.getElementById('sessionTitleInput').value.trim();
  const date = document.getElementById('sessionDateInput').value;
  const groupId = document.getElementById('sessionGroupInput').value || null;
  const notes = document.getElementById('sessionNotesInput').value.trim();

  if (!title) { showToast('عنوان رو وارد کن', 'warning'); return; }

  try {
    await Sessions.create(title, date, groupId, notes);
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
    const s = await Sessions.getById(id);
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
      <button class="btn btn-primary" style="width:100%;" onclick="updateSession('${id}')">💾 ذخیره</button>
    `);
  } catch (err) { console.error(err); }
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
    showToast('خطا: ' + err.message, 'error');
  }
}

async function deleteSession(id, title) {
  if (!confirm(`جلسه "${title}" حذف بشه؟`)) return;
  try {
    await Sessions.delete(id);
    showToast('حذف شد', 'success');
    await renderSessionsList();
    await renderHistory();
  } catch (err) {
    console.error(err);
    showToast('خطا: ' + err.message, 'error');
  }
}

/* ============================================
   تاریخچه حضور
   ============================================ */
async function renderHistory() {
  const container = document.getElementById('historyList');
  container.innerHTML = '<div class="loading-screen"><div class="loader loader-lg"></div></div>';

  try {
    const sessions = await AttendanceRecords.getSessionsWithStats();
    const filterGroup = document.getElementById('historyGroupFilter')?.value;
    const search = document.getElementById('historySearch')?.value.trim().toLowerCase();

    let filtered = sessions;
    if (filterGroup) filtered = filtered.filter(s => s.group_id === filterGroup);
    if (search) filtered = filtered.filter(s => s.title.toLowerCase().includes(search));

    if (filtered.length === 0) {
      container.innerHTML = '<div class="no-result">تاریخچه‌ای یافت نشد</div>';
      return;
    }

    container.innerHTML = filtered.map(s => `
      <div class="session-row" onclick="showSessionDetails('${s.id}')" style="cursor:pointer;">
        <div class="session-info">
          <div class="session-title-text">📚 ${s.title}</div>
          <div class="session-meta">
            <span>📅 ${toJalali(s.session_date)}</span>
            ${s.groups?.name ? `<span>📁 ${s.groups.name}</span>` : ''}
            <span style="color:var(--emerald);font-weight:600;">✅ ${s.attendee_count} حاضر</span>
          </div>
        </div>
        <button class="btn btn-ghost btn-small">👁️ جزئیات</button>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="no-result">خطا</div>';
  }
}

async function showSessionDetails(sessionId) {
  try {
    const [session, records] = await Promise.all([
      Sessions.getById(sessionId),
      AttendanceRecords.getBySession(sessionId)
    ]);

    const attendeesHTML = records.length === 0
      ? '<div class="no-result">کسی حاضر نبوده</div>'
      : records.map(r => `
          <div class="member-item">
            <div class="avatar" style="background:${r.students?.avatar_color || '#06b6d4'};width:36px;height:36px;font-size:14px;">
              ${getInitial(r.students?.full_name)}
            </div>
            <div class="member-name">${r.students?.full_name || '?'}</div>
          </div>
        `).join('');

    openModal(`📚 ${session.title}`, `
      <div class="session-meta" style="margin-bottom:16px;flex-direction:column;gap:8px;align-items:flex-start;">
        <span>📅 ${toJalali(session.session_date)}</span>
        ${session.groups?.name ? `<span>📁 ${session.groups.name}</span>` : ''}
        ${session.notes ? `<span>📝 ${session.notes}</span>` : ''}
        <span style="color:var(--emerald);font-weight:600;">✅ ${records.length} نفر حاضر</span>
      </div>
      <h4 style="margin-bottom:12px;font-size:15px;">لیست حاضرین:</h4>
      <div style="max-height:400px;overflow-y:auto;">${attendeesHTML}</div>
    `);
  } catch (err) {
    console.error(err);
    showToast('خطا در بارگذاری', 'error');
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

  if (!name || !phone || !password) { showToast('همه فیلدها رو پر کن', 'warning'); return; }
  if (password.length < 6) { showToast('رمز حداقل ۶ کاراکتر', 'warning'); return; }

  try {
    await Admins.create(phone, password, name, 'admin');
    showToast('ادمین اضافه شد ✅', 'success');
    closeModal();
    await renderAdminsList();
  } catch (err) {
    console.error(err);
    showToast('خطا: ' + err.message, 'error');
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
  if (password.length < 6) { showToast('رمز حداقل ۶ کاراکتر', 'warning'); return; }
  try {
    await Admins.updatePassword(id, password);
    showToast('رمز تغییر کرد ✅', 'success');
    closeModal();
  } catch (err) {
    console.error(err);
    showToast('خطا: ' + err.message, 'error');
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
    showToast('خطا: ' + err.message, 'error');
  }
}

/* ============================================
   Audit Log
   ============================================ */
async function renderAuditLog() {
  const container = document.getElementById('auditList');
  if (!container) return;
  container.innerHTML = '<div class="loading-screen"><div class="loader loader-lg"></div></div>';

  try {
    const logs = await AuditLog.getRecent(50);
    if (logs.length === 0) {
      container.innerHTML = '<div class="no-result">فعالیتی ثبت نشده</div>';
      return;
    }

    const actionIcons = {
      'login': '🔓', 'add_score': '⭐', 'bulk_score': '✅',
      'create_student': '👤', 'create_group': '📁', 'create_admin': '🔑',
      'create_session': '📚', 'update_student': '✏️', 'update_group': '✏️',
      'update_session': '✏️', 'update_password': '🔒', 'add_to_group': '➕',
      'remove_from_group': '➖', 'set_groups': '🔀', 'delete': '🗑️',
      'bulk_import': '📥'
    };

    container.innerHTML = logs.map(log => {
      const icon = actionIcons[log.action] || '📌';
      return `
        <div class="history-item">
          <div class="history-icon">${icon}</div>
          <div class="history-content">
            <div class="history-reason">${log.admin_name || 'سیستم'} — ${log.action}</div>
            <div class="history-meta">
              <span>📅 ${toJalaliFull(log.created_at)}</span>
              ${log.table_name ? `<span>📋 ${log.table_name}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="no-result">خطا در بارگذاری</div>';
  }
}

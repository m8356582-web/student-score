/* ============================================
   🧠 موتور تحلیل هوشمند
   ============================================ */

/* ============================================
   تحلیل هوشمند داشبورد
   ============================================ */
async function renderSmartAnalysis() {
  const container = document.getElementById('smartAnalysis');
  if (!container) return;

  container.innerHTML = '<div class="loading-screen"><div class="loader loader-lg"></div></div>';

  try {
    const [students, groups, recentScores, sessions] = await Promise.all([
      Students.getAllWithGroups(),
      Groups.getAll(),
      Scores.getRecent(200),
      Sessions.getAll()
    ]);

    // آمار امروز
    const today = new Date().toISOString().split('T')[0];
    const todayScores = recentScores.filter(s =>
      s.created_at && s.created_at.startsWith(today)
    );
    const todayStudents = new Set(todayScores.map(s => s.student_id)).size;
    const todayTotal = todayScores.reduce((sum, s) => sum + s.amount, 0);

    // آمار دیروز
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const yesterdayScores = recentScores.filter(s =>
      s.created_at && s.created_at.startsWith(yesterday)
    );
    const yesterdayTotal = yesterdayScores.reduce((sum, s) => sum + s.amount, 0);

    let percentChange = 0;
    if (yesterdayTotal > 0) {
      percentChange = Math.round(((todayTotal - yesterdayTotal) / yesterdayTotal) * 100);
    }

    // Streak
    const streaks = detectStreaks(recentScores);

    // هشدارها
    const alerts = generateAlerts(students, groups, recentScores);

    // پیشنهادها
    const suggestions = generateSuggestions(students, groups, sessions);

    // گروه فعال
    let topGroup = null;
    let topGroupScore = 0;
    groups.forEach(g => {
      const groupStudents = students.filter(s => s.groups.some(sg => sg.id === g.id));
      const groupTotal = groupStudents.reduce((sum, s) => sum + (s.total_score || 0), 0);
      if (groupTotal > topGroupScore) {
        topGroupScore = groupTotal;
        topGroup = g;
      }
    });

    container.innerHTML = `
      <div class="smart-grid">
        <div class="smart-card">
          <div class="smart-card-header">
            <span class="smart-card-icon">📊</span>
            <span class="smart-card-title">امروز</span>
          </div>
          <div class="smart-card-body">
            <div class="smart-stat-big">${todayStudents}</div>
            <div class="smart-stat-label">نفر حاضر</div>
            <div class="smart-stat-divider"></div>
            <div class="smart-stat-small">${todayTotal.toLocaleString('fa-IR')} امتیاز</div>
            ${yesterdayTotal > 0 ? `
              <div class="smart-stat-change ${percentChange >= 0 ? 'positive' : 'negative'}">
                ${percentChange >= 0 ? '📈' : '📉'} ${Math.abs(percentChange)}٪ نسبت به دیروز
              </div>
            ` : ''}
          </div>
        </div>

        <div class="smart-card">
          <div class="smart-card-header">
            <span class="smart-card-icon">🏆</span>
            <span class="smart-card-title">گروه فعال</span>
          </div>
          <div class="smart-card-body">
            ${topGroup ? `
              <div class="smart-stat-big" style="font-size:18px;">${topGroup.name}</div>
              <div class="smart-stat-label">مجموع امتیاز</div>
              <div class="smart-stat-divider"></div>
              <div class="smart-stat-small">⭐ ${topGroupScore.toLocaleString('fa-IR')} امتیاز</div>
            ` : '<div class="no-result">گروهی یافت نشد</div>'}
          </div>
        </div>

        <div class="smart-card">
          <div class="smart-card-header">
            <span class="smart-card-icon">🔥</span>
            <span class="smart-card-title">حضور پیاپی</span>
          </div>
          <div class="smart-card-body">
            ${streaks.length > 0 ? `
              ${streaks.slice(0, 3).map((s, i) => `
                <div class="streak-item">
                  <span class="streak-rank">${i + 1}</span>
                  <span class="streak-name">${s.name}</span>
                  <span class="streak-count">🔥 ${s.count}</span>
                </div>
              `).join('')}
            ` : '<div class="no-result" style="font-size:12px;">هنوز کسی ۲ جلسه پیاپی نیومده</div>'}
          </div>
        </div>

        <div class="smart-card ${alerts.length > 0 ? 'warning' : ''}">
          <div class="smart-card-header">
            <span class="smart-card-icon">⚠️</span>
            <span class="smart-card-title">هشدارها</span>
            ${alerts.length > 0 ? `<span class="smart-badge">${alerts.length}</span>` : ''}
          </div>
          <div class="smart-card-body">
            ${alerts.length > 0 ? `
              ${alerts.slice(0, 3).map(a => `
                <div class="alert-item ${a.severity}">
                  <span>${a.icon}</span>
                  <span>${a.text}</span>
                </div>
              `).join('')}
              ${alerts.length > 3 ? `<div class="smart-more">و ${alerts.length - 3} مورد دیگه</div>` : ''}
            ` : '<div class="no-result" style="font-size:12px;">همه چی عالیه ✅</div>'}
          </div>
        </div>

        <div class="smart-card">
          <div class="smart-card-header">
            <span class="smart-card-icon">💡</span>
            <span class="smart-card-title">پیشنهادها</span>
          </div>
          <div class="smart-card-body">
            ${suggestions.slice(0, 3).map(s => `
              <div class="suggestion-item">
                <span>${s.icon}</span>
                <span>${s.text}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

  } catch (err) {
    console.error('خطا در تحلیل:', err);
    container.innerHTML = '<div class="no-result">خطا در تحلیل هوشمند</div>';
  }
}

/* ============================================
   تشخیص Streak
   ============================================ */
function detectStreaks(recentScores) {
  const attendanceByStudent = {};

  recentScores
    .filter(s => s.score_type === 'attendance')
    .forEach(s => {
      if (!attendanceByStudent[s.student_id]) {
        attendanceByStudent[s.student_id] = [];
      }
      attendanceByStudent[s.student_id].push({
        name: s.students?.full_name || '?',
        time: new Date(s.created_at).getTime()
      });
    });

  const streaks = [];
  Object.keys(attendanceByStudent).forEach(sid => {
    const records = attendanceByStudent[sid];
    if (records.length < 2) return;

    records.sort((a, b) => b.time - a.time);

    let count = 1;
    for (let i = 1; i < records.length; i++) {
      const diff = records[i - 1].time - records[i].time;
      const hoursDiff = diff / (1000 * 60 * 60);
      if (hoursDiff < 72) {
        count++;
      } else {
        break;
      }
    }

    if (count >= 2) {
      streaks.push({
        student_id: sid,
        name: records[0].name,
        count: count
      });
    }
  });

  return streaks.sort((a, b) => b.count - a.count);
}

/* ============================================
   تولید هشدارها
   ============================================ */
function generateAlerts(students, groups, recentScores) {
  const alerts = [];

  const noGroup = students.filter(s => !s.groups || s.groups.length === 0);
  if (noGroup.length > 0) {
    alerts.push({
      severity: 'warning',
      icon: '👤',
      text: `${noGroup.length} نفر بدون گروه`
    });
  }

  const emptyGroups = groups.filter(g => {
    const count = students.filter(s => s.groups?.some(sg => sg.id === g.id)).length;
    return count === 0;
  });
  if (emptyGroups.length > 0) {
    alerts.push({
      severity: 'info',
      icon: '📁',
      text: `${emptyGroups.length} گروه خالی`
    });
  }

  const zeroScore = students.filter(s => (s.total_score || 0) === 0 && s.groups?.length > 0);
  if (zeroScore.length > 0) {
    alerts.push({
      severity: 'info',
      icon: '0️⃣',
      text: `${zeroScore.length} نفر امتیاز صفر`
    });
  }

  const now = Date.now();
  const twoWeeksAgo = now - (14 * 24 * 60 * 60 * 1000);
  const attendanceStudents = new Set(
    recentScores
      .filter(s => s.score_type === 'attendance' && new Date(s.created_at).getTime() > twoWeeksAgo)
      .map(s => s.student_id)
  );

  const longAbsent = students.filter(s =>
    s.groups?.length > 0 &&
    (s.total_score || 0) > 0 &&
    !attendanceStudents.has(s.id)
  );

  if (longAbsent.length > 0 && longAbsent.length < students.length / 2) {
    alerts.push({
      severity: 'warning',
      icon: '😴',
      text: `${longAbsent.length} نفر ۲ هفته غایب`
    });
  }

  return alerts;
}

/* ============================================
   تولید پیشنهادها
   ============================================ */
function generateSuggestions(students, groups, sessions) {
  const suggestions = [];
  const now = new Date();
  const dayOfWeek = now.getDay();

  if (dayOfWeek === 5) {
    suggestions.push({ icon: '📚', text: 'امروز جمعه‌ست، یه جلسه خوبه!' });
  }

  if (groups.length < 3 && students.length > 20) {
    suggestions.push({ icon: '📁', text: 'گروه‌های بیشتری بساز' });
  }

  const emptyGroups = groups.filter(g => {
    const count = students.filter(s => s.groups?.some(sg => sg.id === g.id)).length;
    return count === 0;
  });
  if (emptyGroups.length > 0) {
    suggestions.push({ icon: '👥', text: `به گروه "${emptyGroups[0].name}" اعضا اضافه کن` });
  }

  if (sessions.length > 0) {
    const lastSession = sessions[0];
    const daysSince = Math.floor((now - new Date(lastSession.session_date).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince >= 3) {
      suggestions.push({ icon: '📅', text: `${daysSince} روزه جلسه‌ای نداشتی` });
    }
  } else {
    suggestions.push({ icon: '🎯', text: 'اولین جلسه‌ت رو بساز!' });
  }

  const zeroScore = students.filter(s => (s.total_score || 0) === 0);
  if (zeroScore.length > 10) {
    suggestions.push({ icon: '💯', text: 'به دانش‌آموزان جدید امتیاز بده' });
  }

  if (suggestions.length === 0) {
    suggestions.push({ icon: '✨', text: 'همه چی مرتبه! ادامه بده' });
  }

  return suggestions;
}

/* ============================================
   Command Palette (Ctrl+K)
   ============================================ */
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'k') {
    e.preventDefault();
    openCommandPalette();
  }
});

function openCommandPalette() {
  let modal = document.getElementById('cmdPalette');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'cmdPalette';
    modal.className = 'cmd-palette-overlay';
    modal.innerHTML = `
      <div class="cmd-palette">
        <div class="cmd-palette-input-wrap">
          <span style="font-size:20px;">🔍</span>
          <input type="text" id="cmdInput" placeholder="جستجو در دانش‌آموزان، گروه‌ها، جلسات..." autofocus>
          <span class="cmd-hint">Esc</span>
        </div>
        <div class="cmd-results" id="cmdResults"></div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeCommandPalette();
    });
  }

  modal.classList.add('active');
  setTimeout(() => document.getElementById('cmdInput')?.focus(), 100);

  const input = document.getElementById('cmdInput');
  input.value = '';
  input.oninput = () => searchCommandPalette(input.value);

  renderCommandResults('', []);
}

function closeCommandPalette() {
  const modal = document.getElementById('cmdPalette');
  if (modal) modal.classList.remove('active');
}

async function searchCommandPalette(query) {
  if (!query || query.length < 1) {
    renderCommandResults('', []);
    return;
  }

  try {
    const [students, groups, sessions] = await Promise.all([
      Students.search(query),
      Groups.getAll(),
      Sessions.getAll()
    ]);

    const q = query.toLowerCase();

    const results = [
      ...students.slice(0, 5).map(s => ({
        type: 'student',
        icon: '👤',
        title: s.full_name,
        subtitle: `${s.total_score || 0} امتیاز`,
        action: () => {
          closeCommandPalette();
          if (typeof editStudent === 'function') editStudent(s.id);
        }
      })),
      ...groups.filter(g => g.name.toLowerCase().includes(q)).slice(0, 3).map(g => ({
        type: 'group',
        icon: '📁',
        title: g.name,
        subtitle: 'گروه',
        action: () => {
          closeCommandPalette();
          if (typeof manageGroupMembers === 'function') manageGroupMembers(g.id, g.name);
        }
      })),
      ...sessions.filter(s => s.title.toLowerCase().includes(q)).slice(0, 3).map(s => ({
        type: 'session',
        icon: '📚',
        title: s.title,
        subtitle: toJalali(s.session_date),
        action: () => {
          closeCommandPalette();
          if (typeof showSessionDetails === 'function') showSessionDetails(s.id);
        }
      }))
    ];

    renderCommandResults(query, results);
  } catch (err) {
    console.error(err);
  }
}

function renderCommandResults(query, results) {
  const container = document.getElementById('cmdResults');
  if (!container) return;

  const commands = [
    { icon: '👥', title: 'رفتن به دانش‌آموزان', action: () => { switchTab('students'); closeCommandPalette(); } },
    { icon: '📁', title: 'رفتن به گروه‌ها', action: () => { switchTab('groups'); closeCommandPalette(); } },
    { icon: '✅', title: 'ثبت حضور', action: () => { switchTab('attendance'); closeCommandPalette(); } },
    { icon: '📝', title: 'امتیاز متفرقه', action: () => { switchTab('manual'); closeCommandPalette(); } },
    { icon: '📥', title: 'ورودی اکسل', action: () => { switchTab('import'); closeCommandPalette(); } },
    { icon: '📜', title: 'گزارش فعالیت', action: () => { switchTab('audit'); closeCommandPalette(); } }
  ];

  if (!query) {
    container.innerHTML = `
      <div class="cmd-section-title">دستورات سریع</div>
      ${commands.map((c, i) => `
        <div class="cmd-item" data-cmd="${i}">
          <span class="cmd-item-icon">${c.icon}</span>
          <span class="cmd-item-title">${c.title}</span>
        </div>
      `).join('')}
    `;
    container.querySelectorAll('.cmd-item').forEach((el, i) => {
      el.addEventListener('click', commands[i].action);
    });
    return;
  }

  if (results.length === 0) {
    container.innerHTML = '<div class="no-result" style="padding:20px;">نتیجه‌ای پیدا نشد</div>';
    return;
  }

  container.innerHTML = results.map((r, i) => `
    <div class="cmd-item" data-idx="${i}">
      <span class="cmd-item-icon">${r.icon}</span>
      <div style="flex:1;">
        <div class="cmd-item-title">${r.title}</div>
        <div class="cmd-item-sub">${r.subtitle}</div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.cmd-item').forEach((el, i) => {
    el.addEventListener('click', () => results[i].action());
  });
}

function switchTab(tabName) {
  const tab = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  if (tab) tab.click();
}

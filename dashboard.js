   /* ============================================
   📊 داشبورد تحلیلی + نمودارها + Leaderboard
   ============================================ */

let trendChart = null;
let typeChart = null;
let groupChart = null;
let leaderboardPeriod = 'all';

/* ============================================
   نمودارها
   ============================================ */
async function renderCharts() {
  const container = document.getElementById('chartsSection');
  if (!container) return;

  container.innerHTML = '<div class="loading-screen"><div class="loader loader-lg"></div></div>';

  try {
    const token = Auth.getToken();
    if (!token) return;

    const { data, error } = await db.rpc('get_dashboard_stats', { p_token: token });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);

    const trend = data.daily_trend || [];
    const types = data.score_types || [];

    const [groups, students] = await Promise.all([
      Groups.getAll(),
      Students.getAllWithGroups()
    ]);

    const groupData = groups.map(g => {
      const groupStudents = students.filter(s => s.groups.some(sg => sg.id === g.id));
      const totalScore = groupStudents.reduce((sum, s) => sum + (s.total_score || 0), 0);
      return { name: g.name, count: groupStudents.length, total: totalScore };
    }).sort((a, b) => b.total - a.total).slice(0, 8);

    container.innerHTML = `
      <div class="charts-grid">
        <div class="chart-card chart-full">
          <div class="chart-header">
            <h3>📈 روند امتیاز ۳۰ روز اخیر</h3>
          </div>
          <div class="chart-body">
            <canvas id="trendChart"></canvas>
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <h3>🍩 توزیع نوع امتیازها</h3>
          </div>
          <div class="chart-body">
            <canvas id="typeChart"></canvas>
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-header">
            <h3>📊 مقایسه گروه‌ها</h3>
          </div>
          <div class="chart-body">
            <canvas id="groupChart"></canvas>
          </div>
        </div>
      </div>
    `;

    renderTrendChart(trend);
    renderTypeChart(types);
    renderGroupChart(groupData);

  } catch (err) {
    console.error('خطا در نمودارها:', err);
    container.innerHTML = '<div class="no-result">خطا در بارگذاری نمودارها</div>';
  }
}

/* ============================================
   نمودار خطی
   ============================================ */
function renderTrendChart(trend) {
  const canvas = document.getElementById('trendChart');
  if (!canvas) return;
  if (trendChart) trendChart.destroy();

  const days = [];
  const dailyTotals = [];
  const dailyStudents = [];

  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    const found = trend.find(t => t.day === dateStr);
    days.push(toJalali(dateStr).split(' ').slice(0, 2).join(' '));
    dailyTotals.push(found ? Number(found.daily_total) : 0);
    dailyStudents.push(found ? Number(found.daily_students) : 0);
  }

  trendChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: days,
      datasets: [
        {
          label: 'امتیاز روزانه',
          data: dailyTotals,
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.1)',
          tension: 0.4,
          fill: true,
          borderWidth: 2,
          pointBackgroundColor: '#06b6d4',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 6,
          yAxisID: 'y'
        },
        {
          label: 'تعداد دانش‌آموز',
          data: dailyStudents,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          borderWidth: 2,
          pointBackgroundColor: '#10b981',
          pointRadius: 2,
          pointHoverRadius: 5,
          yAxisID: 'y1',
          borderDash: [5, 5]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { family: 'Vazirmatn' } }
        }
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8', font: { family: 'Vazirmatn', size: 10 }, maxRotation: 45 },
          grid: { color: 'rgba(148, 163, 184, 0.1)' }
        },
        y: {
          position: 'right',
          ticks: { color: '#94a3b8', font: { family: 'Vazirmatn' } },
          grid: { color: 'rgba(148, 163, 184, 0.1)' }
        },
        y1: {
          position: 'left',
          ticks: { color: '#94a3b8', font: { family: 'Vazirmatn' } },
          grid: { display: false }
        }
      }
    }
  });
}

/* ============================================
   نمودار دایره‌ای
   ============================================ */
function renderTypeChart(types) {
  const canvas = document.getElementById('typeChart');
  if (!canvas) return;
  if (typeChart) typeChart.destroy();

  const typeNames = { 'attendance': 'حضور', 'manual': 'متفرقه', 'bonus': 'پاداش' };

  const labels = types.map(t => typeNames[t.score_type] || t.score_type);
  const values = types.map(t => Number(t.total));
  const colors = ['#06b6d4', '#10b981', '#f59e0b'];

  if (labels.length === 0) {
    labels.push('هنوز داده‌ای نیست');
    values.push(1);
  }

  typeChart = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: '#1e293b',
        borderWidth: 3,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#94a3b8',
            font: { family: 'Vazirmatn', size: 12 },
            padding: 16,
            usePointStyle: true
          }
        }
      },
      cutout: '65%'
    }
  });
}

/* ============================================
   نمودار میله‌ای
   ============================================ */
function renderGroupChart(groupData) {
  const canvas = document.getElementById('groupChart');
  if (!canvas) return;
  if (groupChart) groupChart.destroy();

  if (groupData.length === 0) {
    canvas.parentElement.innerHTML = '<div class="no-result">گروهی یافت نشد</div>';
    return;
  }

  const labels = groupData.map(g => g.name.length > 15 ? g.name.slice(0, 15) + '...' : g.name);
  const totals = groupData.map(g => g.total);

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(6, 182, 212, 0.9)');
  gradient.addColorStop(1, 'rgba(16, 185, 129, 0.6)');

  groupChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'امتیاز کل',
        data: totals,
        backgroundColor: gradient,
        borderColor: '#06b6d4',
        borderWidth: 1,
        borderRadius: 8,
        barThickness: 30
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: '#94a3b8', font: { family: 'Vazirmatn', size: 10 }, maxRotation: 45 },
          grid: { display: false }
        },
        y: {
          position: 'right',
          ticks: { color: '#94a3b8', font: { family: 'Vazirmatn' } },
          grid: { color: 'rgba(148, 163, 184, 0.1)' }
        }
      }
    }
  });
}

/* ============================================
   Leaderboard
   ============================================ */
async function renderLeaderboard(period = 'all') {
  leaderboardPeriod = period;

  const container = document.getElementById('leaderboardSection');
  if (!container) return;

  container.innerHTML = '<div class="loading-screen"><div class="loader loader-lg"></div></div>';

  try {
    const token = Auth.getToken();
    const { data, error } = await db.rpc('get_leaderboard', {
      p_token: token,
      p_period: period
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);

    const leaders = data.leaders || [];

    container.innerHTML = `
      <div class="leaderboard-header">
        <h3>🏆 برترین‌ها</h3>
        <div class="leaderboard-tabs">
          <button class="lb-tab ${period === 'week' ? 'active' : ''}" onclick="renderLeaderboard('week')">این هفته</button>
          <button class="lb-tab ${period === 'month' ? 'active' : ''}" onclick="renderLeaderboard('month')">این ماه</button>
          <button class="lb-tab ${period === 'all' ? 'active' : ''}" onclick="renderLeaderboard('all')">همه دوران</button>
        </div>
      </div>

      ${leaders.length === 0 ? `
        <div class="no-result">هنوز داده‌ای برای این بازه نیست</div>
      ` : `
        <div class="leaderboard-list">
          ${leaders.map((l, i) => {
            const medals = ['🥇', '🥈', '🥉'];
            const isTop3 = i < 3;
            const score = period === 'all' ? l.total_score : l.period_score;
            return `
              <div class="lb-item ${isTop3 ? 'top-' + (i + 1) : ''} pop-in" onclick="showStudentProfile('${l.id}')">
                <div class="lb-rank">${isTop3 ? medals[i] : (i + 1)}</div>
                <div class="avatar" style="background:${l.avatar_color || '#06b6d4'};width:42px;height:42px;font-size:16px;">
                  ${getInitial(l.full_name)}
                </div>
                <div class="lb-info">
                  <div class="lb-name">${l.full_name}</div>
                  <div class="lb-meta">${l.score_count || 0} امتیاز ثبت‌شده</div>
                </div>
                <div class="lb-score">${score}</div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;
  } catch (err) {
    console.error('خطا در Leaderboard:', err);
    container.innerHTML = '<div class="no-result">خطا در بارگذاری Leaderboard</div>';
  }
}

/* ============================================
   پروفایل دانش‌آموز (مودال)
   ============================================ */
async function showStudentProfile(studentId) {
  openModal('👤 پروفایل دانش‌آموز', '<div class="loading-screen"><div class="loader loader-lg"></div></div>');

  try {
    const [student, scores, groups, attendance] = await Promise.all([
      Students.getById(studentId),
      Scores.getByStudent(studentId),
      Students.getGroups(studentId),
      AttendanceRecords.getByStudent(studentId)
    ]);

    const groupsText = groups.length > 0
      ? groups.map(g => g.name).join(' • ')
      : 'بدون گروه';

    const recentScores = scores.slice(0, 10);

    document.getElementById('modalBody').innerHTML = `
      <div class="profile-hero" style="margin-bottom:20px;">
        <div class="profile-avatar" style="background:${student.avatar_color || '#06b6d4'}">
          ${getInitial(student.full_name)}
        </div>
        <div class="profile-name">${student.full_name}</div>
        <div class="profile-group">📁 ${groupsText}</div>
        <div class="total-score-big">${student.total_score || 0}</div>
        <div class="total-score-label">امتیاز کل</div>
        ${attendance.length > 0 ? `<div style="margin-top:12px;font-size:13px;color:var(--gray);">✅ حضور در ${attendance.length} جلسه</div>` : ''}
      </div>

      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <button class="btn btn-ghost btn-small" style="flex:1;" onclick="exportStudentReport('${studentId}')">
          📄 دانلود کارنامه
        </button>
      </div>

      <h4 style="margin-bottom:12px;font-size:15px;">📊 آخرین امتیازها</h4>
      <div style="max-height:300px;overflow-y:auto;">
        ${recentScores.length === 0 ? '<div class="no-result">هنوز امتیازی ثبت نشده</div>' :
          recentScores.map(sc => {
            const isNeg = sc.amount < 0;
            return `
              <div class="history-item ${isNeg ? 'negative' : ''}">
                <div class="history-icon">${sc.score_type === 'attendance' ? '✅' : '📝'}</div>
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
          }).join('')
        }
      </div>
    `;
  } catch (err) {
    console.error(err);
    document.getElementById('modalBody').innerHTML = '<div class="no-result">خطا در بارگذاری</div>';
  }
}

/* ============================================
   📄 خروجی Excel/CSV + 🎯 Confetti
   ============================================ */

/* ============================================
   دانلود Excel (XLSX)
   ============================================ */
function downloadXLSX(data, filename, sheetName = 'Sheet1') {
  try {
    // ساخت workbook و worksheet
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();

    // تنظیم عرض ستون‌ها
    const colWidths = data[0].map((_, i) => {
      let maxLen = 10;
      data.forEach(row => {
        const len = String(row[i] || '').length;
        if (len > maxLen) maxLen = len;
      });
      return { wch: Math.min(maxLen + 2, 40) };
    });
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
    showToast('✅ فایل دانلود شد', 'success');
  } catch (err) {
    console.error(err);
    showToast('خطا در ساخت فایل: ' + err.message, 'error');
  }
}

/* ============================================
   دانلود CSV
   ============================================ */
function downloadCSV(data, filename) {
  try {
    const BOM = '\uFEFF';
    const csv = BOM + data.map(row =>
      row.map(cell => {
        const val = String(cell ?? '');
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      }).join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('✅ فایل دانلود شد', 'success');
  } catch (err) {
    console.error(err);
    showToast('خطا: ' + err.message, 'error');
  }
}

/* ============================================
   خروجی دانش‌آموزان (کامل)
   ============================================ */
async function exportStudents() {
  try {
    showToast('در حال آماده‌سازی...', 'success');

    const students = await Students.getAllWithGroups();

    if (students.length === 0) {
      showToast('دانش‌آموزی وجود نداره', 'warning');
      return;
    }

    // هدر
    const header = ['ردیف', 'نام', 'تلفن', 'گروه‌ها', 'امتیاز کل'];

    // داده‌ها
    const rows = students.map((s, i) => [
      i + 1,
      s.full_name,
      s.phone || '',
      s.groups.map(g => g.name).join(' • ') || 'بدون گروه',
      s.total_score || 0
    ]);

    const data = [header, ...rows];

    // سؤال: XLSX یا CSV؟
    const choice = confirm('OK = Excel (XLSX)\nCancel = CSV\n\nکدوم رو می‌خوای؟');

    if (choice) {
      downloadXLSX(data, `دانش‌آموزان-${new Date().toISOString().split('T')[0]}.xlsx`, 'دانش‌آموزان');
    } else {
      downloadCSV(data, `دانش‌آموزان-${new Date().toISOString().split('T')[0]}.csv`);
    }

  } catch (err) {
    console.error(err);
    showToast('خطا: ' + err.message, 'error');
  }
}

/* ============================================
   خروجی جلسات + حضور
   ============================================ */
async function exportSessions() {
  try {
    showToast('در حال آماده‌سازی...', 'success');

    const sessions = await AttendanceRecords.getSessionsWithStats();

    if (sessions.length === 0) {
      showToast('جلسه‌ای وجود نداره', 'warning');
      return;
    }

    const header = ['ردیف', 'عنوان جلسه', 'تاریخ', 'گروه', 'تعداد حاضر', 'توضیحات'];

    const rows = sessions.map((s, i) => [
      i + 1,
      s.title,
      toJalali(s.session_date),
      s.groups?.name || 'عمومی',
      s.attendee_count || 0,
      s.notes || ''
    ]);

    const data = [header, ...rows];

    const choice = confirm('OK = Excel (XLSX)\nCancel = CSV');

    if (choice) {
      downloadXLSX(data, `جلسات-${new Date().toISOString().split('T')[0]}.xlsx`, 'جلسات');
    } else {
      downloadCSV(data, `جلسات-${new Date().toISOString().split('T')[0]}.csv`);
    }

  } catch (err) {
    console.error(err);
    showToast('خطا: ' + err.message, 'error');
  }
}

/* ============================================
   خروجی تفصیلی امتیازها
   ============================================ */
async function exportAllScores() {
  try {
    showToast('در حال آماده‌سازی...', 'success');

    const { data: scores, error } = await db
      .from('scores')
      .select('*, students(full_name)')
      .order('created_at', { ascending: false })
      .limit(10000);

    if (error) throw error;
    if (!scores || scores.length === 0) {
      showToast('امتیازی ثبت نشده', 'warning');
      return;
    }

    const typeNames = {
      'attendance': 'حضور',
      'manual': 'متفرقه',
      'bonus': 'پاداش'
    };

    const header = ['ردیف', 'نام دانش‌آموز', 'نوع', 'مقدار', 'دلیل', 'جلسه', 'تاریخ'];

    const rows = scores.map((s, i) => [
      i + 1,
      s.students?.full_name || '?',
      typeNames[s.score_type] || s.score_type,
      s.amount,
      s.reason || '',
      s.session_title || '',
      toJalaliFull(s.created_at)
    ]);

    const data = [header, ...rows];

    const choice = confirm('OK = Excel (XLSX)\nCancel = CSV');

    if (choice) {
      downloadXLSX(data, `تاریخچه-امتیازات-${new Date().toISOString().split('T')[0]}.xlsx`, 'امتیازات');
    } else {
      downloadCSV(data, `تاریخچه-امتیازات-${new Date().toISOString().split('T')[0]}.csv`);
    }

  } catch (err) {
    console.error(err);
    showToast('خطا: ' + err.message, 'error');
  }
}

/* ============================================
   کارنامه فردی (خروجی برای یک دانش‌آموز)
   ============================================ */
async function exportStudentReport(studentId) {
  try {
    showToast('در حال آماده‌سازی کارنامه...', 'success');

    const [student, scores, groups, attendance] = await Promise.all([
      Students.getById(studentId),
      Scores.getByStudent(studentId),
      Students.getGroups(studentId),
      AttendanceRecords.getByStudent(studentId)
    ]);

    const groupsText = groups.map(g => g.name).join(' • ') || 'بدون گروه';

    // اطلاعات کلی
    const infoData = [
      ['کارنامه دانش‌آموز'],
      [''],
      ['نام', student.full_name],
      ['تلفن', student.phone || 'ثبت نشده'],
      ['گروه‌ها', groupsText],
      ['امتیاز کل', student.total_score || 0],
      ['تعداد جلسات حاضر', attendance.length],
      ['تاریخ گزارش', toJalaliFull(new Date().toISOString())],
      ['']
    ];

    // تاریخچه امتیازها
    const scoreHeader = [''];
    const scoreHeaderRow = ['ردیف', 'نوع', 'مقدار', 'دلیل', 'جلسه', 'تاریخ'];

    const typeNames = {
      'attendance': 'حضور',
      'manual': 'متفرقه',
      'bonus': 'پاداش'
    };

    const scoreRows = scores.map((s, i) => [
      i + 1,
      typeNames[s.score_type] || s.score_type,
      s.amount,
      s.reason || '',
      s.session_title || '',
      toJalaliFull(s.created_at)
    ]);

    const fullData = [
      ...infoData,
      ['تاریخچه امتیازات:'],
      scoreHeaderRow,
      ...scoreRows
    ];

    const filename = `کارنامه-${student.full_name.replace(/\s+/g, '-')}.xlsx`;
    downloadXLSX(fullData, filename, 'کارنامه');

  } catch (err) {
    console.error(err);
    showToast('خطا: ' + err.message, 'error');
  }
}

/* ============================================
   🎯 Confetti (جشن و افکت)
   ============================================ */
function celebrateConfetti() {
  // بررسی اینکه کتابخانه لود شده
  if (typeof confetti !== 'function') {
    console.warn('canvas-confetti لود نشده');
    return;
  }

  // دو انفجار از دو طرف
  const duration = 2000;
  const animationEnd = Date.now() + duration;
  const defaults = {
    startVelocity: 30,
    spread: 360,
    ticks: 60,
    zIndex: 9999
  };

  function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  const interval = setInterval(function () {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);

    confetti(Object.assign({}, defaults, {
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
    }));

    confetti(Object.assign({}, defaults, {
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
    }));
  }, 250);
}

/* ============================================
   بررسی امتیاز گِرد (۱۰۰، ۵۰۰، ۱۰۰۰، ...)
   ============================================ */
function checkMilestone(oldTotal, newTotal) {
  const milestones = [100, 250, 500, 750, 1000, 1500, 2000, 3000, 5000];

  for (const m of milestones) {
    if (oldTotal < m && newTotal >= m) {
      celebrateConfetti();
      showToast(`🎉 ${newTotal} امتیاز! تبریک`, 'success');
      return true;
    }
  }
  return false;
}

/* ============================================
   Confetti سریع (یه انفجار)
   ============================================ */
function quickConfetti() {
  if (typeof confetti !== 'function') return;

  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#06b6d4', '#10b981', '#0ea5e9', '#14b8a6']
  });
}

/* ============================================
   دکمه‌های Export در admin.html
   ============================================ */
function initExportButtons() {
  const container = document.getElementById('exportButtons');
  if (!container) return;

  container.innerHTML = `
    <div class="section-card">
      <div class="section-header">
        <h3>📄 خروجی گرفتن</h3>
      </div>
      <p style="color:var(--gray);font-size:13px;margin-bottom:16px;">
        داده‌ها رو به فرمت Excel یا CSV دانلود کن
      </p>
      <div class="export-grid">
        <button class="export-btn" onclick="exportStudents()">
          <span class="export-icon">👥</span>
          <div>
            <div class="export-title">دانش‌آموزان</div>
            <div class="export-desc">همه با گروه‌ها و امتیاز</div>
          </div>
        </button>
        <button class="export-btn" onclick="exportSessions()">
          <span class="export-icon">📚</span>
          <div>
            <div class="export-title">جلسات</div>
            <div class="export-desc">با تعداد حاضرین</div>
          </div>
        </button>
        <button class="export-btn" onclick="exportAllScores()">
          <span class="export-icon">📊</span>
          <div>
            <div class="export-title">تاریخچه امتیازها</div>
            <div class="export-desc">همه ثبت‌ها با جزئیات</div>
          </div>
        </button>
      </div>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    initExportButtons();
  }, 1200);
});

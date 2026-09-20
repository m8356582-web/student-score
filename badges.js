/* ============================================
   🏅 سیستم نشان‌ها (Badges)
   ============================================ */

/* ============================================
   تعریف نشان‌ها
   ============================================ */
const BADGES = {
  'first_step': {
    icon: '🥉',
    title: 'اولین قدم',
    description: 'رسیدن به ۱۰۰ امتیاز',
    color: '#cd7f32',
    check: (student) => (student.total_score || 0) >= 100
  },
  'rising_star': {
    icon: '⭐',
    title: 'ستاره نوظهور',
    description: 'رسیدن به ۵۰۰ امتیاز',
    color: '#fbbf24',
    check: (student) => (student.total_score || 0) >= 500
  },
  'champion': {
    icon: '🥇',
    title: 'قهرمان',
    description: 'رسیدن به ۱۰۰۰ امتیاز',
    color: '#f59e0b',
    check: (student) => (student.total_score || 0) >= 1000
  },
  'legend': {
    icon: '👑',
    title: 'افسانه',
    description: 'رسیدن به ۲۰۰۰ امتیاز',
    color: '#ec4899',
    check: (student) => (student.total_score || 0) >= 2000
  },
  'loyal': {
    icon: '🔥',
    title: 'پایدار',
    description: '۵ جلسه حضور پیاپی',
    color: '#ef4444',
    check: (student) => (student._streak || 0) >= 5
  },
  'active': {
    icon: '💪',
    title: 'فعال',
    description: '۱۰ جلسه حضور',
    color: '#06b6d4',
    check: (student) => (student._attendanceCount || 0) >= 10
  },
  'super_active': {
    icon: '🚀',
    title: 'فوق فعال',
    description: '۲۵ جلسه حضور',
    color: '#10b981',
    check: (student) => (student._attendanceCount || 0) >= 25
  },
  'always_present': {
    icon: '🎯',
    title: 'همیشه حاضر',
    description: '۵۰ جلسه حضور',
    color: '#8b5cf6',
    check: (student) => (student._attendanceCount || 0) >= 50
  }
};

/* ============================================
   گرفتن نشان‌های یک دانش‌آموز
   ============================================ */
async function getStudentBadges(studentId) {
  try {
    const { data, error } = await db
      .from('student_badges')
      .select('badge_type')
      .eq('student_id', studentId);

    if (error) throw error;
    return (data || []).map(b => b.badge_type);
  } catch (err) {
    console.warn('خطا در گرفتن نشان‌ها:', err);
    return [];
  }
}

/* ============================================
   گرفتن همه نشان‌ها (برای یک دانش‌آموز)
   ============================================ */
async function getAllBadgesForStudent(studentId) {
  const earnedTypes = await getStudentBadges(studentId);

  return Object.entries(BADGES).map(([type, badge]) => ({
    type,
    ...badge,
    earned: earnedTypes.includes(type)
  }));
}

/* ============================================
   بررسی و اعطای نشان‌های جدید
   ============================================ */
async function checkAndAwardBadges(studentId) {
  try {
    // گرفتن اطلاعات کامل دانش‌آموز
    const student = await Students.getById(studentId);
    if (!student) return [];

    // گرفتن آمار
    const [scores, attendance] = await Promise.all([
      Scores.getByStudent(studentId),
      AttendanceRecords.getByStudent(studentId)
    ]);

    // محاسبه Streak
    const attendanceScores = scores
      .filter(s => s.score_type === 'attendance')
      .map(s => new Date(s.created_at).getTime())
      .sort((a, b) => b - a);

    let streak = 0;
    for (let i = 1; i < attendanceScores.length; i++) {
      const diff = (attendanceScores[i - 1] - attendanceScores[i]) / (1000 * 60 * 60);
      if (diff < 72) streak++;
      else break;
    }
    if (attendanceScores.length > 0) streak++;

    // ساختن شیء با آمار
    const enrichedStudent = {
      ...student,
      _streak: streak,
      _attendanceCount: attendance.length
    };

    // گرفتن نشان‌های فعلی
    const currentBadges = await getStudentBadges(studentId);

    // بررسی هر نشان
    const newBadges = [];
    for (const [type, badge] of Object.entries(BADGES)) {
      if (!currentBadges.includes(type) && badge.check(enrichedStudent)) {
        // اعطای نشان
        try {
          await db.from('student_badges').insert([{
            student_id: studentId,
            badge_type: type
          }]);
          newBadges.push({ type, ...badge });

          // ساخت اعلان
          if (typeof createNotification === 'function') {
            await createNotification(
              'badge',
              `${badge.icon} ${student.full_name} نشان "${badge.title}" گرفت!`,
              badge.description,
              badge.icon,
              studentId
            );
          }
        } catch (err) {
          // احتمالاً قبلاً وجود داره
          console.warn('نشان قبلاً وجود داره:', type);
        }
      }
    }

    return newBadges;
  } catch (err) {
    console.warn('خطا در بررسی نشان‌ها:', err);
    return [];
  }
}

/* ============================================
   بررسی همه دانش‌آموزان
   ============================================ */
async function checkAllStudentsBadges() {
  try {
    showToast('🔍 در حال بررسی نشان‌ها...', 'success');

    const students = await Students.getAll();
    let awardedCount = 0;

    for (const student of students) {
      const newBadges = await checkAndAwardBadges(student.id);
      awardedCount += newBadges.length;
    }

    if (awardedCount > 0) {
      showToast(`🏅 ${awardedCount} نشان جدید اعطا شد!`, 'success');
      if (typeof quickConfetti === 'function') quickConfetti();
    } else {
      showToast('✅ نشان جدیدی برای اعطا نبود', 'success');
    }

    return awardedCount;
  } catch (err) {
    console.warn('خطا:', err);
    showToast('خطا در بررسی نشان‌ها', 'error');
    return 0;
  }
}

/* ============================================
   نمایش نشان‌ها در HTML
   ============================================ */
function renderBadgesHTML(badges) {
  if (!badges || badges.length === 0) {
    return '<div class="no-result" style="font-size:12px;">هنوز نشانی نگرفته</div>';
  }

  return `
    <div class="badges-grid">
      ${badges.map(b => `
        <div class="badge-item ${b.earned ? 'earned' : 'locked'}" title="${b.description}">
          <div class="badge-icon" style="filter: ${b.earned ? 'none' : 'grayscale(1) opacity(0.3)'};">
            ${b.icon}
          </div>
          <div class="badge-title">${b.title}</div>
          ${b.earned ? '<div class="badge-check">✓</div>' : '<div class="badge-lock">🔒</div>'}
        </div>
      `).join('')}
    </div>
  `;
}

/* ============================================
   نمایش خلاصه نشان‌ها (صفحه اصلی)
   ============================================ */
async function renderStudentBadgesSummary(studentId) {
  const badges = await getAllBadgesForStudent(studentId);
  const earnedBadges = badges.filter(b => b.earned);

  if (earnedBadges.length === 0) {
    return '';
  }

  return `
    <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:12px;">
      ${earnedBadges.map(b => `
        <span style="
          display:inline-flex;
          align-items:center;
          gap:4px;
          padding:4px 10px;
          background: rgba(6, 182, 212, 0.15);
          border: 1px solid ${b.color};
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        " title="${b.description}">
          ${b.icon} ${b.title}
        </span>
      `).join('')}
    </div>
  `;
}




/* ============================================
   🌐 اتصال به Window
   ============================================ */
if (typeof window !== 'undefined') {
  window.BADGES = BADGES;
  window.getStudentBadges = getStudentBadges;
  window.getAllBadgesForStudent = getAllBadgesForStudent;
  window.checkAndAwardBadges = checkAndAwardBadges;
  window.checkAllStudentsBadges = checkAllStudentsBadges;
  window.renderBadgesHTML = renderBadgesHTML;
  window.renderStudentBadgesSummary = renderStudentBadgesSummary;
}

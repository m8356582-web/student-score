/* ============================================
   🏅 سیستم نشان‌ها - نسخه پیشرفته
   ============================================ */

const BADGE_DEFS = {
  '100':    { name: 'صدتایی',       icon: '💯', color: '#06b6d4', desc: '۱۰۰ امتیاز گرفته' },
  '500':    { name: 'پانصدتایی',    icon: '🏅', color: '#10b981', desc: '۵۰۰ امتیاز گرفته' },
  '1000':   { name: 'هزارتایی',     icon: '👑', color: '#fbbf24', desc: '۱۰۰۰ امتیاز گرفته' },
  'att5':   { name: 'حضور ۵ جلسه',  icon: '🔥', color: '#f59e0b', desc: '۵ جلسه حضور داشته' },
  'att10':  { name: 'حضور ۱۰ جلسه', icon: '⚡', color: '#8b5cf6', desc: '۱۰ جلسه حضور داشته' },
  'att20':  { name: 'حضور ۲۰ جلسه', icon: '💎', color: '#ec4899', desc: '۲۰ جلسه حضور داشته' }
};

/* ============================================
   نمایش نشان‌های یک دانش‌آموز
   ============================================ */
async function renderStudentBadges(studentId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '<div style="text-align:center;padding:20px;"><div class="loader"></div></div>';

  try {
    const badges = await getStudentBadges(studentId);

    if (badges.length === 0) {
      container.innerHTML = `
        <div class="badges-empty">
          <div style="font-size:32px;opacity:0.4;margin-bottom:8px;">🏅</div>
          <p style="font-size:13px;color:var(--gray);">هنوز نشانی نگرفته</p>
          <p style="font-size:11px;color:var(--gray-2);margin-top:6px;">
            با امتیازگیری و حضور، نشان بگیر
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="badges-grid">
        ${badges.map(b => {
          const def = BADGE_DEFS[b.badge_type] || {};
          return `
            <div class="badge-card pop-in" style="--badge-color: ${def.color || '#06b6d4'};">
              <div class="badge-icon-big">${b.badge_icon}</div>
              <div class="badge-name-big">${b.badge_name}</div>
              <div class="badge-date">${toJalali(b.earned_at)}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="no-result">خطا در بارگذاری نشان‌ها</div>';
  }
}

/* ============================================
   نشان‌های در دسترس (که می‌تونه بگیره)
   ============================================ */
async function renderAvailableBadges(studentId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    const earned = await getStudentBadges(studentId);
    const earnedTypes = earned.map(b => b.badge_type);

    const locked = Object.keys(BADGE_DEFS).filter(t => !earnedTypes.includes(t));

    if (locked.length === 0) {
      container.innerHTML = `
        <div class="badges-complete">
          🎉 همه نشان‌ها گرفته شده!
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="badges-grid">
        ${locked.map(t => {
          const def = BADGE_DEFS[t];
          return `
            <div class="badge-card locked" style="--badge-color: ${def.color};">
              <div class="badge-icon-big">${def.icon}</div>
              <div class="badge-name-big">${def.name}</div>
              <div class="badge-date">${def.desc}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    console.error(err);
  }
}

/* ============================================
   نشون دادن همه نشان‌ها تو یه صفحه
   ============================================ */
async function renderAllBadgesOverview(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    const { data, error } = await db
      .from('badges')
      .select('*, students(full_name, avatar_color)')
      .order('earned_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = '<div class="no-result">هنوز کسی نشانی نگرفته</div>';
      return;
    }

    container.innerHTML = `
      <div class="badges-feed">
        ${data.map(b => {
          const def = BADGE_DEFS[b.badge_type] || {};
          return `
            <div class="badge-feed-item">
              <div class="avatar" style="background:${b.students?.avatar_color || '#06b6d4'};width:36px;height:36px;font-size:14px;">
                ${getInitial(b.students?.full_name)}
              </div>
              <div class="badge-feed-content">
                <div class="badge-feed-name">${b.students?.full_name || '?'}</div>
                <div class="badge-feed-text">
                  <span style="font-size:16px;">${b.badge_icon}</span>
                  نشان «${b.badge_name}» گرفت
                </div>
              </div>
              <div class="badge-feed-time">${timeAgo(b.earned_at)}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="no-result">خطا در بارگذاری</div>';
  }
}

/* ============================================
   شمارش نشان‌ها
   ============================================ */
async function getBadgesCount(studentId) {
  try {
    const { count, error } = await db
      .from('badges')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId);

    if (error) throw error;
    return count || 0;
  } catch (err) {
    return 0;
  }
}

/* ============================================
   چک کردن نشان برای یک دانش‌آموز (خارجی)
   ============================================ */
async function triggerBadgeCheck(studentId, studentName) {
  const newBadges = await checkStudentBadges(studentId);

  if (newBadges.length > 0) {
    const names = newBadges.map(b => b.icon + ' ' + b.name).join('، ');
    showToast(`🎉 ${studentName} نشان جدید گرفت: ${names}`, 'success');
  }

  return newBadges;
}

/* ============================================
   نمایش خلاصه نشان‌های دانش‌آموز (تو لیست)
   ============================================ */
async function renderBadgesSummary(studentId) {
  try {
    const badges = await getStudentBadges(studentId);
    if (badges.length === 0) return '';

    return badges.slice(0, 5).map(b => `
      <span style="font-size:14px;" title="${b.badge_name}">${b.badge_icon}</span>
    `).join('');
  } catch (err) {
    return '';
  }
}

/* ============================================
   راه‌اندازی - مشاهده کلی نشان‌ها
   ============================================ */
function initBadgesTab() {
  const container = document.getElementById('badgesOverview');
  if (!container) return;

  renderAllBadgesOverview('badgesOverview');
}
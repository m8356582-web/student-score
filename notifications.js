/* ============================================
   🔔 سیستم اعلان‌ها + 🏅 نشان‌ها
   ============================================ */

let notificationsCache = [];
let notificationPanelOpen = false;

/* ============================================
   🔔 اعلان‌ها
   ============================================ */

// لود اعلان‌های اخیر
async function loadNotifications() {
  try {
    const { data, error } = await db
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;
    notificationsCache = data || [];

    updateNotificationBadge();
    renderNotifications();
  } catch (err) {
    console.error('خطا در اعلان‌ها:', err);
  }
}

// آپدیت شمارنده اعلان‌های نخوانده
function updateNotificationBadge() {
  const badge = document.getElementById('notifBadge');
  if (!badge) return;

  const unread = notificationsCache.filter(n => !n.is_read).length;

  if (unread > 0) {
    badge.style.display = 'flex';
    badge.textContent = unread > 99 ? '99+' : unread;
  } else {
    badge.style.display = 'none';
  }
}

// رندر پنل اعلان‌ها
function renderNotifications() {
  const container = document.getElementById('notifList');
  if (!container) return;

  if (notificationsCache.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:30px 20px;">
        <div class="empty-icon">🔕</div>
        <p style="font-size:13px;">هنوز اعلانی نداری</p>
      </div>
    `;
    return;
  }

  const typeStyles = {
    'score': { bg: 'rgba(6,182,212,0.1)', border: '#06b6d4' },
    'session': { bg: 'rgba(16,185,129,0.1)', border: '#10b981' },
    'student': { bg: 'rgba(139,92,246,0.1)', border: '#8b5cf6' },
    'alert': { bg: 'rgba(245,158,11,0.1)', border: '#f59e0b' },
    'group': { bg: 'rgba(236,72,153,0.1)', border: '#ec4899' },
    'badge': { bg: 'rgba(251,191,36,0.1)', border: '#fbbf24' }
  };

  container.innerHTML = notificationsCache.map(n => {
    const style = typeStyles[n.type] || typeStyles['score'];
    return `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" style="border-right-color: ${style.border}; background: ${n.is_read ? 'transparent' : style.bg};">
        <div class="notif-icon">${n.icon || '🔔'}</div>
        <div class="notif-content">
          <div class="notif-title">${n.title}</div>
          ${n.message ? `<div class="notif-message">${n.message}</div>` : ''}
          <div class="notif-time">${timeAgo(n.created_at)}</div>
        </div>
      </div>
    `;
  }).join('');
}

// باز/بسته کردن پنل اعلان‌ها
function toggleNotificationPanel() {
  const panel = document.getElementById('notifPanel');
  if (!panel) return;

  notificationPanelOpen = !notificationPanelOpen;

  if (notificationPanelOpen) {
    panel.classList.add('active');
    loadNotifications();
  } else {
    panel.classList.remove('active');
  }
}

// علامت‌گذاری همه به‌عنوان خوانده‌شده
async function markAllAsRead() {
  try {
    const { error } = await db
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false);

    if (error) throw error;

    notificationsCache.forEach(n => n.is_read = true);
    updateNotificationBadge();
    renderNotifications();
    showToast('✅ همه خوانده شد', 'success');
  } catch (err) {
    console.error(err);
  }
}

// ساخت اعلان جدید
async function createNotification(type, title, message = '', icon = '🔔', relatedId = null) {
  try {
    const token = Auth.getToken();
    if (!token) return;

    const { data, error } = await db.rpc('create_notification', {
      p_token: token,
      p_type: type,
      p_title: title,
      p_message: message,
      p_icon: icon,
      p_related_id: relatedId
    });

    if (error) throw error;
    if (data.success) {
      await loadNotifications();
    }
  } catch (err) {
    console.error('خطا در ساخت اعلان:', err);
  }
}

/* ============================================
   🏅 نشان‌ها
   ============================================ */

// گرفتن نشان‌های یک دانش‌آموز
async function getStudentBadges(studentId) {
  try {
    const { data, error } = await db
      .from('badges')
      .select('*')
      .eq('student_id', studentId)
      .order('earned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('خطا در نشان‌ها:', err);
    return [];
  }
}

// چک کردن و اعطای نشان جدید
async function checkStudentBadges(studentId) {
  try {
    const token = Auth.getToken();
    if (!token) return [];

    const { data, error } = await db.rpc('check_and_award_badges', {
      p_token: token,
      p_student_id: studentId
    });

    if (error) throw error;
    if (!data.success) return [];

    const newBadges = data.new_badges || [];

    // برای هر نشان جدید، اعلان بساز
    for (const badge of newBadges) {
      await createNotification(
        'badge',
        `${badge.icon} نشان جدید!`,
        `دانش‌آموز نشان «${badge.name}» گرفت`,
        badge.icon
      );
    }

    // اگه نشان جدید داشت، جشن بگیر
    if (newBadges.length > 0 && typeof quickConfetti === 'function') {
      quickConfetti();
    }

    return newBadges;
  } catch (err) {
    console.error('خطا در چک نشان:', err);
    return [];
  }
}

// رندر نشان‌ها تو پروفایل
async function renderBadgesInProfile(studentId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const badges = await getStudentBadges(studentId);

  if (badges.length === 0) {
    container.innerHTML = '<div class="no-result" style="font-size:12px;">هنوز نشانی نگرفته</div>';
    return;
  }

  container.innerHTML = badges.map(b => `
    <div class="badge-item">
      <div class="badge-icon">${b.badge_icon}</div>
      <div class="badge-name">${b.badge_name}</div>
    </div>
  `).join('');
}

/* ============================================
   ⏱️ زمان نسبی (چند دقیقه پیش)
   ============================================ */
function timeAgo(dateStr) {
  if (!dateStr) return '';

  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000); // ثانیه

  if (diff < 60) return 'همین الان';
  if (diff < 3600) return `${Math.floor(diff / 60)} دقیقه پیش`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ساعت پیش`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} روز پیش`;

  return toJalali(dateStr);
}

/* ============================================
   راه‌اندازی
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    // اگه پنل ادمین بازه
    if (document.getElementById('notifBell')) {
      loadNotifications();

      // هر ۳۰ ثانیه اعلان‌ها رو بروز کن
      setInterval(loadNotifications, 30000);
    }
  }, 1500);
});

/* ============================================
   کلیک بیرون برای بستن پنل اعلان
   ============================================ */
document.addEventListener('click', (e) => {
  const panel = document.getElementById('notifPanel');
  const bell = document.getElementById('notifBell');

  if (!panel || !bell) return;

  if (notificationPanelOpen &&
      !panel.contains(e.target) &&
      !bell.contains(e.target)) {
    notificationPanelOpen = false;
    panel.classList.remove('active');
  }
});
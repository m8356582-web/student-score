/* ============================================
   🔔 سیستم اعلان‌ها
   ============================================ */

let notificationsCache = [];
let unreadCount = 0;

/* ============================================
   ساخت اعلان (از طریق RPC)
   ============================================ */
async function createNotification(type, title, message = '', icon = '📌', relatedId = null) {
  try {
    const token = Auth.getToken();
    if (!token) return;

    await db.rpc('add_notification_secure', {
      p_token: token,
      p_type: type,
      p_title: title,
      p_message: message,
      p_icon: icon,
      p_related_id: relatedId
    });
  } catch (err) {
    console.warn('خطا در ساخت اعلان:', err);
  }
}

/* ============================================
   بارگذاری اعلان‌ها
   ============================================ */
async function loadNotifications() {
  try {
    const admin = Auth.get();
    if (!admin) return;

    const { data, error } = await db
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;
    notificationsCache = data || [];
    unreadCount = notificationsCache.filter(n => !n.is_read).length;
    updateNotificationBadge();

  } catch (err) {
    console.warn('خطا در بارگذاری اعلان‌ها:', err);
  }
}

/* ============================================
   به‌روزرسانی بج
   ============================================ */
function updateNotificationBadge() {
  const badge = document.getElementById('notifBadge');
  if (!badge) return;

  if (unreadCount > 0) {
    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

/* ============================================
   باز کردن پنل اعلان‌ها
   ============================================ */
function openNotificationPanel() {
  const panel = document.getElementById('notifPanel');
  if (!panel) return;

  const isOpen = panel.classList.contains('active');

  if (isOpen) {
    panel.classList.remove('active');
    return;
  }

  panel.classList.add('active');
  renderNotifications();

  // بستن با کلیک بیرون
  setTimeout(() => {
    document.addEventListener('click', closeNotifOnClickOutside);
  }, 100);
}

function closeNotifOnClickOutside(e) {
  const panel = document.getElementById('notifPanel');
  const btn = document.getElementById('notifBtn');
  if (!panel || !btn) return;

  if (!panel.contains(e.target) && !btn.contains(e.target)) {
    panel.classList.remove('active');
    document.removeEventListener('click', closeNotifOnClickOutside);
  }
}

/* ============================================
   نمایش اعلان‌ها
   ============================================ */
function renderNotifications() {
  const container = document.getElementById('notifList');
  if (!container) return;

  if (notificationsCache.length === 0) {
    container.innerHTML = `
      <div class="no-result" style="padding:40px 20px;text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;opacity:0.5;">🔕</div>
        <p style="font-size:13px;">اعلانی وجود نداره</p>
      </div>
    `;
    return;
  }

  container.innerHTML = notificationsCache.map(n => `
    <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="markAsRead('${n.id}')">
      <div class="notif-icon">${n.icon || '📌'}</div>
      <div class="notif-content">
        <div class="notif-title">${n.title}</div>
        ${n.message ? `<div class="notif-message">${n.message}</div>` : ''}
        <div class="notif-time">${timeAgo(n.created_at)}</div>
      </div>
      ${!n.is_read ? '<div class="notif-dot"></div>' : ''}
    </div>
  `).join('');
}

/* ============================================
   علامت‌گذاری به‌عنوان خوانده‌شده
   ============================================ */
async function markAsRead(notifId) {
  try {
    await db.from('notifications').update({ is_read: true }).eq('id', notifId);
    await loadNotifications();
    renderNotifications();
  } catch (err) {
    console.warn('خطا:', err);
  }
}

/* ============================================
   خواندن همه
   ============================================ */
async function markAllAsRead() {
  try {
    await db.from('notifications').update({ is_read: true }).eq('is_read', false);
    await loadNotifications();
    renderNotifications();
    showToast('✅ همه خونده شدن', 'success');
  } catch (err) {
    console.warn('خطا:', err);
  }
}

/* ============================================
   زمان نسبی (چند دقیقه/ساعت پیش)
   ============================================ */
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

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
  setTimeout(async () => {
    const btn = document.getElementById('notifBtn');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openNotificationPanel();
      });
      await loadNotifications();

      // بارگذاری خودکار هر ۶۰ ثانیه
      setInterval(loadNotifications, 60000);
    }
  }, 1500);
});

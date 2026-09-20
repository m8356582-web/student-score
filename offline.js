/* ============================================
   📴 حالت آفلاین + صف سینک خودکار
   ============================================ */

const OFFLINE_QUEUE_KEY = 'offline_queue';
const OFFLINE_MODE_KEY = 'offline_mode_enabled';

let isOnline = navigator.onLine;
let isSyncing = false;
let syncRetryCount = 0;

/* ============================================
   راه‌اندازی اولیه
   ============================================ */
function initOfflineMode() {
  updateOnlineStatus();

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // چک هر ۱۰ ثانیه (اگه online API خطا داد)
  setInterval(() => {
    const wasOnline = isOnline;
    isOnline = navigator.onLine;
    if (wasOnline !== isOnline) {
      wasOnline ? handleOffline() : handleOnline();
    }
  }, 10000);

  // اگه بار اول اومد و صف داشت
  if (isOnline && getOfflineQueue().length > 0) {
    setTimeout(() => syncOfflineQueue(), 2000);
  }

  // دکمه سینک دستی
  setTimeout(() => {
    const btn = document.getElementById('syncNowBtn');
    if (btn) {
      btn.addEventListener('click', () => syncOfflineQueue(true));
    }
  }, 1500);

  updateQueueBadge();
}

/* ============================================
   مدیریت آنلاین/آفلاین
   ============================================ */
function handleOnline() {
  isOnline = true;
  updateOnlineStatus();
  showToast('🟢 آنلاین شدی', 'success');

  // سینک خودکار
  setTimeout(() => {
    if (getOfflineQueue().length > 0) {
      syncOfflineQueue();
    }
  }, 1000);
}

function handleOffline() {
  isOnline = false;
  updateOnlineStatus();
  showToast('🔴 آفلاین شدی — می‌تونی ادامه بدی', 'warning');
}

/* ============================================
   به‌روزرسانی نشانگر وضعیت
   ============================================ */
function updateOnlineStatus() {
  const indicator = document.getElementById('onlineIndicator');
  const icon = document.getElementById('onlineIcon');
  const text = document.getElementById('onlineText');

  if (!indicator) return;

  if (isOnline) {
    indicator.className = 'online-indicator online';
    if (icon) icon.textContent = '🟢';
    if (text) text.textContent = 'آنلاین';
  } else {
    indicator.className = 'online-indicator offline';
    if (icon) icon.textContent = '🔴';
    if (text) text.textContent = 'آفلاین';
  }

  updateQueueBadge();
}

/* ============================================
   به‌روزرسانی بج صف
   ============================================ */
function updateQueueBadge() {
  const badge = document.getElementById('queueBadge');
  const queue = getOfflineQueue();

  if (!badge) return;

  if (queue.length > 0) {
    badge.textContent = queue.length;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

/* ============================================
   صف آفلاین (Offline Queue)
   ============================================ */
function getOfflineQueue() {
  try {
    const data = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function setOfflineQueue(queue) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  updateQueueBadge();
}

function addToQueue(action) {
  const queue = getOfflineQueue();

  const item = {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: action.type,
    data: action.data,
    created_at: new Date().toISOString(),
    retries: 0
  };

  queue.push(item);
  setOfflineQueue(queue);

  console.log('📥 به صف اضافه شد:', item.type, item.data);
  return item;
}

/* ============================================
   سینک صف
   ============================================ */
async function syncOfflineQueue(manual = false) {
  if (isSyncing) {
    if (manual) showToast('⏳ در حال سینک...', 'warning');
    return;
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) {
    if (manual) showToast('✅ چیزی برای سینک نیست', 'success');
    return;
  }

  if (!isOnline) {
    if (manual) showToast('🔴 اینترنت قطع است', 'error');
    return;
  }

  isSyncing = true;
  showSyncProgress(0, queue.length);

  let successCount = 0;
  let failCount = 0;
  const failedItems = [];

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];

    try {
      showSyncProgress(i + 1, queue.length, `در حال سینک: ${getActionLabel(item.type)}`);
      await processQueueItem(item);
      successCount++;

      // ثبت تو لاگ
      try {
        await db.from('offline_queue_log').insert([{
          admin_id: Auth.get()?.id,
          admin_name: Auth.get()?.full_name || 'سیستم',
          action_type: item.type,
          action_data: item.data,
          was_offline: true
        }]);
      } catch (e) { /* نادیده */ }

    } catch (err) {
      console.error('خطا در سینک:', item.type, err);
      failCount++;
      item.retries = (item.retries || 0) + 1;

      // اگه کمتر از ۳ بار تلاش کرده، نگهش دار
      if (item.retries < 3) {
        failedItems.push(item);
      }
    }

    // تاخیر کوچیک
    await new Promise(r => setTimeout(r, 100));
  }

  // ذخیره موارد ناموفق
  setOfflineQueue(failedItems);

  isSyncing = false;
  hideSyncProgress();

  if (successCount > 0 && failCount === 0) {
    showToast(`✅ ${successCount} مورد سینک شد`, 'success');
    if (typeof quickConfetti === 'function') quickConfetti();

    // رفرش اطلاعات
    if (typeof loadAll === 'function') await loadAll();
    if (typeof renderStats === 'function') renderStats();
    if (typeof renderRecentScores === 'function') renderRecentScores();
  } else if (successCount > 0 && failCount > 0) {
    showToast(`✅ ${successCount} موفق، ❌ ${failCount} ناموفق`, 'warning');
  } else if (failCount > 0) {
    showToast(`❌ ${failCount} مورد ناموفق`, 'error');
  }
}

/* ============================================
   پردازش یه آیتم از صف
   ============================================ */
async function processQueueItem(item) {
  switch (item.type) {

    case 'add_score': {
      const { studentId, amount, reason, sessionTitle, scoreType } = item.data;
      await Scores.add(studentId, amount, reason, sessionTitle || '', scoreType || 'manual');
      break;
    }

    case 'add_bulk_scores': {
      const { studentIds, amount, reason, sessionTitle, scoreType } = item.data;

      // ثبت امتیازها
      const entries = studentIds.map(studentId => ({
        studentId,
        amount,
        reason,
        sessionTitle
      }));
      await Scores.addBulk(entries, scoreType || 'attendance');

      // اگه جلسه داشت
      if (sessionTitle) {
        const sessionResult = await Sessions.create(
          sessionTitle,
          new Date().toISOString().split('T')[0],
          item.data.groupId,
          reason
        );
        if (sessionResult.success) {
          await AttendanceRecords.addBulk(sessionResult.id, studentIds);
        }
      }

      // بررسی نشان‌ها
      if (typeof checkAndAwardBadges === 'function') {
        for (const sid of studentIds) {
          try { await checkAndAwardBadges(sid); } catch (e) {}
        }
      }
      break;
    }

    case 'create_student': {
      const { full_name, phone, groupIds } = item.data;
      const student = await Students.create(full_name, phone, groupIds || []);

      // اگه گروه جدید بود
      if (student.success && groupIds && groupIds.length > 0) {
        await Students.setGroups(student.id, groupIds);
      }
      break;
    }

    case 'create_group': {
      const { name, description } = item.data;
      await Groups.create(name, description || '');
      break;
    }

    case 'create_session': {
      const { title, date, groupId, notes } = item.data;
      await Sessions.create(title, date, groupId, notes || '');
      break;
    }

    case 'update_student': {
      const { studentId, updates } = item.data;
      await Students.update(studentId, updates);
      break;
    }

    default:
      throw new Error(`نوع ناشناخته: ${item.type}`);
  }
}

/* ============================================
   برچسب اکشن
   ============================================ */
function getActionLabel(type) {
  const labels = {
    'add_score': 'ثبت امتیاز',
    'add_bulk_scores': 'ثبت حضور',
    'create_student': 'ساخت دانش‌آموز',
    'create_group': 'ساخت گروه',
    'create_session': 'ساخت جلسه',
    'update_student': 'ویرایش دانش‌آموز'
  };
  return labels[type] || type;
}

/* ============================================
   Progress Modal
   ============================================ */
function showSyncProgress(current, total, message = '') {
  let modal = document.getElementById('syncProgressModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'syncProgressModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width:400px;text-align:center;">
        <div style="font-size:56px;margin-bottom:16px;animation:pulse 1.5s infinite;">🔄</div>
        <h3 style="margin-bottom:12px;">در حال سینک اطلاعات</h3>
        <p id="syncMessage" style="color:var(--gray);font-size:13px;margin-bottom:16px;">شروع سینک...</p>
        <div style="background:rgba(6,182,212,0.1);border-radius:12px;height:12px;overflow:hidden;margin-bottom:12px;">
          <div id="syncBar" style="height:100%;width:0%;background:var(--gradient);transition:width 0.3s;border-radius:12px;"></div>
        </div>
        <p id="syncCounter" style="color:var(--cyan);font-weight:700;font-size:16px;">0 از 0</p>
      </div>
    `;
    document.body.appendChild(modal);
  }

  modal.classList.add('active');

  const bar = document.getElementById('syncBar');
  const counter = document.getElementById('syncCounter');
  const msg = document.getElementById('syncMessage');

  const percent = total > 0 ? (current / total) * 100 : 0;
  if (bar) bar.style.width = percent + '%';
  if (counter) counter.textContent = `${current} از ${total}`;
  if (msg && message) msg.textContent = message;
}

function hideSyncProgress() {
  const modal = document.getElementById('syncProgressModal');
  if (modal) modal.classList.remove('active');
}

/* ============================================
   توابع کمکی برای ثبت آفلاین
   ============================================ */

// ثبت امتیاز آفلاین
async function addScoreOffline(studentId, amount, reason, sessionTitle, scoreType) {
  return addToQueue({
    type: 'add_score',
    data: { studentId, amount, reason, sessionTitle, scoreType }
  });
}

// ثبت حضور آفلاین
async function addBulkScoresOffline(studentIds, amount, reason, sessionTitle, groupId) {
  return addToQueue({
    type: 'add_bulk_scores',
    data: { studentIds, amount, reason, sessionTitle, groupId }
  });
}

// ساخت دانش‌آموز آفلاین
async function createStudentOffline(full_name, phone, groupIds) {
  return addToQueue({
    type: 'create_student',
    data: { full_name, phone, groupIds }
  });
}

// ساخت گروه آفلاین
async function createGroupOffline(name, description) {
  return addToQueue({
    type: 'create_group',
    data: { name, description }
  });
}

// ساخت جلسه آفلاین
async function createSessionOffline(title, date, groupId, notes) {
  return addToQueue({
    type: 'create_session',
    data: { title, date, groupId, notes }
  });
}

/* ============================================
   نمایش پیش‌نمایش صف
   ============================================ */
function showQueuePreview() {
  const queue = getOfflineQueue();

  if (queue.length === 0) {
    openModal('📥 صف آفلاین', '<div class="no-result">صف خالیه ✅</div>');
    return;
  }

  const html = queue.map((item, i) => `
    <div class="queue-item">
      <div class="queue-index">${i + 1}</div>
      <div class="queue-info">
        <div class="queue-type">${getActionLabel(item.type)}</div>
        <div class="queue-time">📅 ${toJalaliFull(item.created_at)}</div>
        ${item.retries > 0 ? `<div class="queue-retry">⚠️ ${item.retries} بار تلاش ناموفق</div>` : ''}
      </div>
      <button class="btn btn-danger btn-small" onclick="removeFromQueue('${item.id}')">🗑️</button>
    </div>
  `).join('');

  openModal(`📥 صف آفلاین (${queue.length} مورد)`, `
    <div class="queue-list" style="max-height:400px;overflow-y:auto;margin-bottom:16px;">
      ${html}
    </div>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-ghost" style="flex:1;" onclick="clearQueue()">🗑️ پاک کردن همه</button>
      <button class="btn btn-primary" style="flex:2;" onclick="syncOfflineQueue(true)">🔄 سینک الان</button>
    </div>
  `);
}

function removeFromQueue(id) {
  const queue = getOfflineQueue().filter(item => item.id !== id);
  setOfflineQueue(queue);
  showToast('✅ حذف شد', 'success');
  showQueuePreview();
}

function clearQueue() {
  if (!confirm('همه صف پاک بشه؟ (اطلاعات از دست می‌ره!)')) return;
  setOfflineQueue([]);
  closeModal();
  showToast('🗑️ صف پاک شد', 'success');
}

/* ============================================
   راه‌اندازی
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => initOfflineMode(), 800);
});





/* ============================================
   🌐 اتصال به Window
   ============================================ */
if (typeof window !== 'undefined') {
  window.initOfflineMode = initOfflineMode;
  window.getOfflineQueue = getOfflineQueue;
  window.setOfflineQueue = setOfflineQueue;
  window.addToQueue = addToQueue;
  window.syncOfflineQueue = syncOfflineQueue;
  window.processQueueItem = processQueueItem;
  window.showSyncProgress = showSyncProgress;
  window.hideSyncProgress = hideSyncProgress;
  window.addScoreOffline = addScoreOffline;
  window.addBulkScoresOffline = addBulkScoresOffline;
  window.createStudentOffline = createStudentOffline;
  window.createGroupOffline = createGroupOffline;
  window.createSessionOffline = createSessionOffline;
  window.showQueuePreview = showQueuePreview;
  window.removeFromQueue = removeFromQueue;
  window.clearQueue = clearQueue;
  window.getActionLabel = getActionLabel;
}

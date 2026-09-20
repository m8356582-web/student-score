/* ============================================
   💾 بکاپ خودکار روی گوشی
   ============================================ */

const AUTO_BACKUP_KEY = 'auto_backup_settings';
const BACKUP_DB_NAME = 'StudentScoresBackups';
const BACKUP_STORE = 'backups';
const MAX_BACKUPS = 7; // نگه‌داشتن ۷ بکاپ اخیر

let backupDB = null;
let autoBackupTimer = null;

/* ============================================
   تنظیمات پیش‌فرض
   ============================================ */
function getBackupSettings() {
  try {
    const data = localStorage.getItem(AUTO_BACKUP_KEY);
    return data ? JSON.parse(data) : {
      enabled: true,
      hour: 20,
      minute: 0,
      lastBackup: null
    };
  } catch {
    return { enabled: true, hour: 20, minute: 0, lastBackup: null };
  }
}

function saveBackupSettings(settings) {
  localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(settings));
}

/* ============================================
   راه‌اندازی IndexedDB
   ============================================ */
async function initBackupDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BACKUP_DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      backupDB = request.result;
      resolve(backupDB);
    };

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(BACKUP_STORE)) {
        const store = db.createObjectStore(BACKUP_STORE, {
          keyPath: 'id',
          autoIncrement: true
        });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/* ============================================
   ذخیره بکاپ تو IndexedDB
   ============================================ */
async function saveBackupToDB(backup) {
  if (!backupDB) await initBackupDB();

  return new Promise((resolve, reject) => {
    const tx = backupDB.transaction([BACKUP_STORE], 'readwrite');
    const store = tx.objectStore(BACKUP_STORE);

    const item = {
      timestamp: Date.now(),
      date: new Date().toISOString(),
      admin_name: Auth.get()?.full_name || 'سیستم',
      data: backup,
      size: JSON.stringify(backup).length,
      records: Object.values(backup.stats || {}).reduce((a, b) => a + b, 0)
    };

    const request = store.add(item);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* ============================================
   گرفتن همه بکاپ‌ها
   ============================================ */
async function getAllBackups() {
  if (!backupDB) await initBackupDB();

  return new Promise((resolve, reject) => {
    const tx = backupDB.transaction([BACKUP_STORE], 'readonly');
    const store = tx.objectStore(BACKUP_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const backups = (request.result || []).sort((a, b) => b.timestamp - a.timestamp);
      resolve(backups);
    };
    request.onerror = () => reject(request.error);
  });
}

/* ============================================
   گرفتن یه بکاپ
   ============================================ */
async function getBackup(id) {
  if (!backupDB) await initBackupDB();

  return new Promise((resolve, reject) => {
    const tx = backupDB.transaction([BACKUP_STORE], 'readonly');
    const store = tx.objectStore(BACKUP_STORE);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* ============================================
   حذف بکاپ
   ============================================ */
async function deleteBackup(id) {
  if (!backupDB) await initBackupDB();

  return new Promise((resolve, reject) => {
    const tx = backupDB.transaction([BACKUP_STORE], 'readwrite');
    const store = tx.objectStore(BACKUP_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/* ============================================
   پاک کردن همه بکاپ‌ها
   ============================================ */
async function clearAllBackups() {
  if (!backupDB) await initBackupDB();

  return new Promise((resolve, reject) => {
    const tx = backupDB.transaction([BACKUP_STORE], 'readwrite');
    const store = tx.objectStore(BACKUP_STORE);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/* ============================================
   گرفتن آمار بکاپ‌ها
   ============================================ */
async function getBackupsStats() {
  const backups = await getAllBackups();

  if (backups.length === 0) {
    return { count: 0, totalSize: 0, latest: null, oldest: null };
  }

  const totalSize = backups.reduce((sum, b) => sum + (b.size || 0), 0);

  return {
    count: backups.length,
    totalSize: totalSize,
    latest: backups[0],
    oldest: backups[backups.length - 1]
  };
}

/* ============================================
   ساخت بکاپ جدید
   ============================================ */
async function createAutoBackup(showToastMsg = false) {
  try {
    if (showToastMsg) showToast('📦 در حال ساخت بکاپ...', 'success');

    // گرفتن داده‌ها
    const [admins, groups, students, studentGroups, scores, sessions, attendanceRecords, badges] = await Promise.all([
      db.from('admins').select('*').then(r => r.data || []),
      db.from('groups').select('*').then(r => r.data || []),
      db.from('students').select('*').then(r => r.data || []),
      db.from('student_groups').select('*').then(r => r.data || []),
      db.from('scores').select('*').limit(10000).then(r => r.data || []),
      db.from('sessions').select('*').then(r => r.data || []),
      db.from('attendance_records').select('*').limit(10000).then(r => r.data || []),
      db.from('student_badges').select('*').then(r => r.data || [])
    ]);

    const backup = {
      version: '3.1',
      type: 'auto',
      exported_at: new Date().toISOString(),
      exported_by: Auth.get()?.full_name || 'سیستم',
      stats: {
        admins: admins.length,
        groups: groups.length,
        students: students.length,
        student_groups: studentGroups.length,
        scores: scores.length,
        sessions: sessions.length,
        attendance_records: attendanceRecords.length,
        student_badges: badges.length
      },
      data: {
        admins, groups, students,
        student_groups: studentGroups,
        scores, sessions,
        attendance_records: attendanceRecords,
        student_badges: badges
      }
    };

    // ذخیره تو IndexedDB
    await saveBackupToDB(backup);

    // حذف بکاپ‌های قدیمی (بیش از MAX_BACKUPS)
    await cleanupOldBackups();

    // آپدیت تنظیمات
    const settings = getBackupSettings();
    settings.lastBackup = new Date().toISOString();
    saveBackupSettings(settings);

    if (showToastMsg) {
      showToast('✅ بکاپ خودکار ذخیره شد', 'success');
    }

    console.log('✅ بکاپ خودکار ساخته شد');
    return backup;

  } catch (err) {
    console.error('خطا در بکاپ خودکار:', err);
    if (showToastMsg) showToast('خطا در بکاپ: ' + err.message, 'error');
    return null;
  }
}

/* ============================================
   پاک کردن بکاپ‌های قدیمی
   ============================================ */
async function cleanupOldBackups() {
  const backups = await getAllBackups();

  if (backups.length > MAX_BACKUPS) {
    const toDelete = backups.slice(MAX_BACKUPS);
    for (const backup of toDelete) {
      await deleteBackup(backup.id);
    }
    console.log(`🗑️ ${toDelete.length} بکاپ قدیمی حذف شد`);
  }
}

/* ============================================
   زمان‌بندی بکاپ خودکار
   ============================================ */
function scheduleAutoBackup() {
  if (autoBackupTimer) {
    clearTimeout(autoBackupTimer);
    autoBackupTimer = null;
  }

  const settings = getBackupSettings();
  if (!settings.enabled) return;

  const now = new Date();
  const target = new Date();
  target.setHours(settings.hour, settings.minute, 0, 0);

  // اگه گذشته، برا فردا
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  const delay = target.getTime() - now.getTime();
  console.log(`⏰ بکاپ بعدی: ${target.toLocaleString('fa-IR')} (${Math.round(delay / 60000)} دقیقه دیگه)`);

  autoBackupTimer = setTimeout(async () => {
    // اگه دیروز بکاپ گرفته نشده، بگیر
    await checkAndBackup();
    scheduleAutoBackup(); // برنامه بعدی
  }, delay);
}

/* ============================================
   چک کن اگه بکاپ امروز گرفته شده
   ============================================ */
async function checkAndBackup() {
  const settings = getBackupSettings();
  if (!settings.enabled) return;

  const backups = await getAllBackups();
  const lastBackup = backups[0];

  if (!lastBackup) {
    // هیچ بکاپی نبود
    await createAutoBackup();
    return;
  }

  const lastDate = new Date(lastBackup.timestamp);
  const today = new Date();

  // اگه بکاپ امروز گرفته نشده
  if (lastDate.toDateString() !== today.toDateString()) {
    console.log('📦 بکاپ امروز گرفته نشده — می‌گیرم');
    await createAutoBackup();
  }
}

/* ============================================
   دانلود بکاپ از IndexedDB
   ============================================ */
async function downloadBackupFromDB(id) {
  try {
    const backup = await getBackup(id);
    if (!backup) {
      showToast('بکاپ پیدا نشد', 'error');
      return;
    }

    const json = JSON.stringify(backup.data, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const date = new Date(backup.timestamp);
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().slice(0, 5).replace(':', '-');
    link.download = `backup-${dateStr}-${timeStr}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('✅ بکاپ دانلود شد', 'success');
  } catch (err) {
    console.error(err);
    showToast('خطا: ' + err.message, 'error');
  }
}

/* ============================================
   تغییر تنظیمات
   ============================================ */
async function toggleAutoBackup() {
  const settings = getBackupSettings();
  settings.enabled = !settings.enabled;
  saveBackupSettings(settings);

  if (settings.enabled) {
    scheduleAutoBackup();
    showToast('✅ بکاپ خودکار فعال شد', 'success');
  } else {
    if (autoBackupTimer) clearTimeout(autoBackupTimer);
    showToast('⏸️ بکاپ خودکار خاموش شد', 'warning');
  }

  renderAutoBackupTab();
}

async function setBackupTime() {
  const hour = prompt('ساعت بکاپ (۰ تا ۲۳):', '20');
  if (hour === null) return;

  const hourNum = parseInt(hour);
  if (isNaN(hourNum) || hourNum < 0 || hourNum > 23) {
    showToast('ساعت نامعتبر', 'warning');
    return;
  }

  const settings = getBackupSettings();
  settings.hour = hourNum;
  settings.minute = 0;
  saveBackupSettings(settings);

  scheduleAutoBackup();
  renderAutoBackupTab();
  showToast(`✅ ساعت بکاپ: ${hourNum}:۰۰`, 'success');
}

/* ============================================
   رندر تب بکاپ
   ============================================ */
async function renderAutoBackupTab() {
  const container = document.getElementById('backupSection');
  if (!container) return;

  const settings = getBackupSettings();
  const backups = await getAllBackups();
  const stats = await getBackupsStats();

  const totalSizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);

  const backupsHTML = backups.length === 0
    ? '<div class="no-result">هنوز بکاپی گرفته نشده</div>'
    : backups.map((b, i) => {
        const date = new Date(b.timestamp);
        const isToday = date.toDateString() === new Date().toDateString();

        return `
          <div class="backup-item">
            <div class="backup-icon">${i === 0 ? '⭐' : '📦'}</div>
            <div class="backup-info">
              <div class="backup-title">
                ${isToday ? 'امروز' : toJalali(b.date)} - ${date.toTimeString().slice(0, 5)}
                ${i === 0 ? ' <span class="backup-badge">آخرین</span>' : ''}
              </div>
              <div class="backup-meta">
                <span>📊 ${b.records || 0} رکورد</span>
                <span>💾 ${((b.size || 0) / 1024).toFixed(1)} KB</span>
                <span>👤 ${b.admin_name}</span>
              </div>
            </div>
            <button class="btn btn-primary btn-small" onclick="downloadBackupFromDB(${b.id})">⬇️</button>
            <button class="btn btn-danger btn-small" onclick="removeBackup(${b.id})">🗑️</button>
          </div>
        `;
      }).join('');

  container.innerHTML = `
    <div class="section-card">
      <div class="section-header">
        <h3>💾 بکاپ خودکار</h3>
        <button class="btn btn-primary" onclick="createAutoBackup(true)">
          🔄 بکاپ الان
        </button>
      </div>

      <!-- وضعیت -->
      <div class="backup-status ${settings.enabled ? 'active' : 'inactive'}">
        <div class="backup-status-icon">${settings.enabled ? '🟢' : '⏸️'}</div>
        <div class="backup-status-info">
          <div class="backup-status-title">
            ${settings.enabled ? 'بکاپ خودکار فعال' : 'بکاپ خودکار خاموش'}
          </div>
          <div class="backup-status-desc">
            ${settings.enabled
              ? `هر روز ساعت ${settings.hour}:۰۰ خودکار گرفته می‌شه`
              : 'روی دکمه فعال بزن'}
            ${settings.lastBackup
              ? `<br>آخرین بکاپ: ${toJalaliFull(settings.lastBackup)}`
              : ''}
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn ${settings.enabled ? 'btn-ghost' : 'btn-success'} btn-small" 
                  onclick="toggleAutoBackup()">
            ${settings.enabled ? '⏸️ خاموش' : '▶️ فعال'}
          </button>
          <button class="btn btn-ghost btn-small" onclick="setBackupTime()">
            ⏰ ${settings.hour}:۰۰
          </button>
        </div>
      </div>

      <!-- آمار -->
      ${stats.count > 0 ? `
        <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin:20px 0;">
          <div class="stat-card">
            <div class="stat-icon">📦</div>
            <div class="stat-value">${stats.count}</div>
            <div class="stat-label">بکاپ</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">💾</div>
            <div class="stat-value" style="font-size:20px;">${totalSizeMB}</div>
            <div class="stat-label">مگابایت</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📅</div>
            <div class="stat-value" style="font-size:14px;">${stats.latest ? toJalali(stats.latest.date) : '-'}</div>
            <div class="stat-label">آخرین</div>
          </div>
        </div>
      ` : ''}

      <!-- لیست بکاپ‌ها -->
      <h4 style="margin:20px 0 12px;font-size:14px;color:var(--gray);">
        📜 بکاپ‌های موجود (${backups.length}/${MAX_BACKUPS}):
      </h4>
      <div class="backup-list">
        ${backupsHTML}
      </div>

      ${backups.length > 0 ? `
        <button class="btn btn-danger" style="width:100%;margin-top:16px;" onclick="clearAllBackupsUI()">
          🗑️ پاک کردن همه بکاپ‌ها
        </button>
      ` : ''}

      <!-- دانلود بکاپ کامل (خارج از IndexedDB) -->
      <div style="margin-top:20px;padding-top:20px;border-top:1px solid rgba(6,182,212,0.15);">
        <button class="btn btn-ghost" style="width:100%;" onclick="downloadFullBackup()">
          📥 دانلود بکاپ کامل (خارج از مرورگر)
        </button>
      </div>
    </div>
  `;
}

/* ============================================
   حذف بکاپ
   ============================================ */
async function removeBackup(id) {
  if (!confirm('این بکاپ حذف بشه؟')) return;
  await deleteBackup(id);
  showToast('✅ حذف شد', 'success');
  renderAutoBackupTab();
}

async function clearAllBackupsUI() {
  if (!confirm('⚠️ همه بکاپ‌ها پاک بشن؟ این کار برگشت‌پذیر نیست!')) return;
  await clearAllBackups();
  showToast('🗑️ همه بکاپ‌ها پاک شد', 'success');
  renderAutoBackupTab();
}

/* ============================================
   راه‌اندازی
   ============================================ */
document.addEventListener('DOMContentLoaded', async () => {
  // فقط تو پنل ادمین
  if (typeof Auth === 'undefined' || !Auth.isAdmin()) return;

  setTimeout(async () => {
    await initBackupDB();

    // چک کن اگه بکاپ امروز گرفته نشده
    setTimeout(() => checkAndBackup(), 5000);

    // زمان‌بندی
    scheduleAutoBackup();

    console.log('💾 سیستم بکاپ خودکار آماده');
  }, 3000);
});



/* ============================================
   🌐 اتصال به Window
   ============================================ */
if (typeof window !== 'undefined') {
  window.getBackupSettings = getBackupSettings;
  window.saveBackupSettings = saveBackupSettings;
  window.initBackupDB = initBackupDB;
  window.saveBackupToDB = saveBackupToDB;
  window.getAllBackups = getAllBackups;
  window.getBackup = getBackup;
  window.deleteBackup = deleteBackup;
  window.clearAllBackups = clearAllBackups;
  window.getBackupsStats = getBackupsStats;
  window.createAutoBackup = createAutoBackup;
  window.cleanupOldBackups = cleanupOldBackups;
  window.scheduleAutoBackup = scheduleAutoBackup;
  window.checkAndBackup = checkAndBackup;
  window.downloadBackupFromDB = downloadBackupFromDB;
  window.toggleAutoBackup = toggleAutoBackup;
  window.setBackupTime = setBackupTime;
  window.renderAutoBackupTab = renderAutoBackupTab;
  window.removeBackup = removeBackup;
  window.clearAllBackupsUI = clearAllBackupsUI;
}



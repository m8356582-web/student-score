/* ============================================
   💾 Backup / Restore
   ============================================ */

/* ============================================
   دانلود بکاپ کامل (JSON)
   ============================================ */
async function downloadFullBackup() {
  try {
    showToast('📦 در حال آماده‌سازی بکاپ...', 'success');

    // گرفتن همه داده‌ها به صورت موازی
    const [
      admins,
      groups,
      students,
      studentGroups,
      scores,
      sessions,
      attendanceRecords,
      badges,
      notifications,
      auditLog,
      importLogs
    ] = await Promise.all([
      db.from('admins').select('*').then(r => r.data || []),
      db.from('groups').select('*').then(r => r.data || []),
      db.from('students').select('*').then(r => r.data || []),
      db.from('student_groups').select('*').then(r => r.data || []),
      db.from('scores').select('*').then(r => r.data || []),
      db.from('sessions').select('*').then(r => r.data || []),
      db.from('attendance_records').select('*').then(r => r.data || []),
      db.from('student_badges').select('*').then(r => r.data || []),
      db.from('notifications').select('*').then(r => r.data || []),
      db.from('audit_log').select('*').then(r => r.data || []),
      db.from('import_logs').select('*').then(r => r.data || [])
    ]);

    // ساختار بکاپ
    const backup = {
      version: '3.0',
      exported_at: new Date().toISOString(),
      exported_by: (Auth.get()?.full_name) || 'سیستم',
      stats: {
        admins: admins.length,
        groups: groups.length,
        students: students.length,
        student_groups: studentGroups.length,
        scores: scores.length,
        sessions: sessions.length,
        attendance_records: attendanceRecords.length,
        student_badges: badges.length,
        notifications: notifications.length,
        audit_log: auditLog.length,
        import_logs: importLogs.length
      },
      data: {
        admins,
        groups,
        students,
        student_groups: studentGroups,
        scores,
        sessions,
        attendance_records: attendanceRecords,
        student_badges: badges,
        notifications,
        audit_log: auditLog,
        import_logs: importLogs
      }
    };

    // ذخیره تو دیتابیس
    try {
      await db.from('backup_logs').insert([{
        admin_id: Auth.get()?.id,
        admin_name: Auth.get()?.full_name || 'سیستم',
        backup_type: 'manual',
        record_count: Object.values(backup.stats).reduce((a, b) => a + b, 0)
      }]);
    } catch (e) {
      console.warn('خطا در ذخیره لاگ بکاپ:', e);
    }

    // دانلود
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().slice(0, 5).replace(':', '-');
    link.download = `backup-student-scores-${date}-${time}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('✅ بکاپ دانلود شد', 'success');
    if (typeof quickConfetti === 'function') quickConfetti();

    return backup;
  } catch (err) {
    console.error('خطا در بکاپ:', err);
    showToast('خطا در ساخت بکاپ: ' + err.message, 'error');
  }
}

/* ============================================
   انتخاب فایل بکاپ
   ============================================ */
function selectBackupFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await restoreFromBackup(file);
  };
  input.click();
}

/* ============================================
   بازگردانی از بکاپ
   ============================================ */
async function restoreFromBackup(file) {
  if (!confirm('⚠️ هشدار!\n\nاین کار همه داده‌های فعلی رو پاک می‌کنه و از بکاپ بازیابی می‌کنه.\n\nمطمئنی؟')) {
    return;
  }

  try {
    showToast('📂 در حال خواندن فایل بکاپ...', 'success');

    const text = await file.text();
    const backup = JSON.parse(text);

    if (!backup.version || !backup.data) {
      throw new Error('فایل بکاپ معتبر نیست');
    }

    // تایید دوم
    const stats = backup.stats;
    const confirmMsg = `
📦 اطلاعات بکاپ:

• ادمین‌ها: ${stats.admins}
• گروه‌ها: ${stats.groups}
• دانش‌آموزان: ${stats.students}
• امتیازها: ${stats.scores}
• جلسات: ${stats.sessions}
• رکوردهای حضور: ${stats.attendance_records}

📅 تاریخ بکاپ: ${toJalaliFull(backup.exported_at)}
👤 سازنده: ${backup.exported_by}

آیا مطمئنی؟ (همه داده‌های فعلی پاک می‌شن)
    `;

    if (!confirm(confirmMsg)) return;

    await performRestore(backup);
  } catch (err) {
    console.error('خطا در بازگردانی:', err);
    showToast('خطا: ' + err.message, 'error');
  }
}

/* ============================================
   انجام بازگردانی
   ============================================ */
async function performRestore(backup) {
  const data = backup.data;
  const progressModal = showRestoreProgress();

  try {
    // پاک کردن همه داده‌های فعلی
    progressModal.update('🗑️ پاک کردن داده‌های فعلی...', 5);

    // ترتیب پاک کردن مهمه (از فرزند به والد)
    const deleteOrder = [
      'attendance_records',
      'student_badges',
      'student_groups',
      'scores',
      'notifications',
      'audit_log',
      'import_logs',
      'sessions',
      'students',
      'groups'
    ];

    for (const table of deleteOrder) {
      try {
        await db.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (e) {
        console.warn(`خطا در پاک کردن ${table}:`, e);
      }
    }

    progressModal.update('📥 در حال بازیابی داده‌ها...', 15);

    // ترتیب بازگردانی (از والد به فرزند)
    const restoreOrder = [
      'groups',
      'students',
      'sessions',
      'student_groups',
      'scores',
      'attendance_records',
      'student_badges',
      'notifications',
      'audit_log',
      'import_logs'
    ];

    let totalRecords = 0;
    const total = Object.values(backup.stats).reduce((a, b) => a + b, 0) - backup.stats.admins;

    for (let i = 0; i < restoreOrder.length; i++) {
      const table = restoreOrder[i];
      const records = data[table] || [];

      if (records.length === 0) continue;

      progressModal.update(`📥 بازیابی ${table}... (${records.length} رکورد)`, 15 + (i / restoreOrder.length) * 80);

      // درج به صورت batch
      const batchSize = 100;
      for (let j = 0; j < records.length; j += batchSize) {
        const batch = records.slice(j, j + batchSize);
        try {
          const { error } = await db.from(table).insert(batch);
          if (error) {
            console.warn(`خطا در درج ${table}:`, error);
          } else {
            totalRecords += batch.length;
          }
        } catch (e) {
          console.warn(`خطا در batch ${table}:`, e);
        }
      }
    }

    progressModal.update('✅ تکمیل شد!', 100);

    setTimeout(() => {
      progressModal.close();
      showToast(`✅ ${totalRecords} رکورد بازیابی شد`, 'success');
      if (typeof quickConfetti === 'function') quickConfetti();

      setTimeout(() => window.location.reload(), 1500);
    }, 1000);

  } catch (err) {
    console.error('خطا در بازگردانی:', err);
    progressModal.close();
    showToast('خطا: ' + err.message, 'error');
  }
}

/* ============================================
   مودال Progress
   ============================================ */
function showRestoreProgress() {
  let modal = document.getElementById('restoreModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'restoreModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width:400px;text-align:center;">
        <div style="font-size:64px;margin-bottom:20px;">💾</div>
        <h3 style="margin-bottom:16px;">در حال بازگردانی</h3>
        <p id="restoreText" style="color:var(--gray);font-size:13px;margin-bottom:16px;">آماده‌سازی...</p>
        <div style="background:rgba(6,182,212,0.1);border-radius:12px;height:12px;overflow:hidden;">
          <div id="restoreBar" style="height:100%;width:0%;background:var(--gradient);transition:width 0.3s;border-radius:12px;"></div>
        </div>
        <p id="restorePercent" style="color:var(--cyan);font-weight:700;font-size:18px;margin-top:12px;">0%</p>
      </div>
    `;
    document.body.appendChild(modal);
  }

  modal.classList.add('active');

  return {
    update(text, percent) {
      const textEl = document.getElementById('restoreText');
      const barEl = document.getElementById('restoreBar');
      const pctEl = document.getElementById('restorePercent');
      if (textEl) textEl.textContent = text;
      if (barEl) barEl.style.width = percent + '%';
      if (pctEl) pctEl.textContent = Math.round(percent) + '%';
    },
    close() {
      modal.classList.remove('active');
    }
  };
}

/* ============================================
   تب بکاپ در پنل ادمین
   ============================================ */
async function renderBackupTab() {
  const container = document.getElementById('backupSection');
  if (!container) return;

  // گرفتن لاگ‌های قبلی
  let backupLogs = [];
  try {
    const { data } = await db
      .from('backup_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    backupLogs = data || [];
  } catch (e) {
    console.warn(e);
  }

  // آمار فعلی
  const stats = {
    students: allStudentsCache.length,
    groups: allGroupsCache.length
  };

  container.innerHTML = `
    <div class="section-card">
      <div class="section-header">
        <h3>💾 بکاپ و بازیابی</h3>
      </div>

      <div style="background:rgba(245,158,11,0.1);border:1px solid var(--warning);border-radius:12px;padding:14px;margin-bottom:20px;">
        <strong>⚠️ هشدار:</strong>
        <p style="font-size:13px;margin-top:6px;line-height:1.7;">
          قبل از هر بازگردانی، مطمئن شو بکاپ فعلی رو دانلود کردی.
          بازگردانی، همه داده‌های فعلی رو پاک می‌کنه.
        </p>
      </div>

      <div class="export-grid" style="margin-bottom:20px;">
        <button class="export-btn" onclick="downloadFullBackup()">
          <span class="export-icon">📦</span>
          <div>
            <div class="export-title">دانلود بکاپ</div>
            <div class="export-desc">همه داده‌ها (JSON)</div>
          </div>
        </button>
        <button class="export-btn" onclick="selectBackupFile()" style="border-color: var(--warning);">
          <span class="export-icon">📂</span>
          <div>
            <div class="export-title">بازگردانی از فایل</div>
            <div class="export-desc">انتخاب فایل JSON</div>
          </div>
        </button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
        <div class="stat-card">
          <div class="stat-icon">👥</div>
          <div class="stat-value">${stats.students}</div>
          <div class="stat-label">دانش‌آموز</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📁</div>
          <div class="stat-value">${stats.groups}</div>
          <div class="stat-label">گروه</div>
        </div>
      </div>

      <h4 style="margin-bottom:12px;font-size:15px;">📜 آخرین بکاپ‌ها:</h4>
      <div>
        ${backupLogs.length === 0 ? '<div class="no-result">هنوز بکاپی گرفته نشده</div>' : backupLogs.map(log => `
          <div class="session-row">
            <div class="session-info">
              <div class="session-title-text">💾 ${log.admin_name || 'سیستم'}</div>
              <div class="session-meta">
                <span>📅 ${toJalaliFull(log.created_at)}</span>
                <span>📦 ${log.record_count || 0} رکورد</span>
                <span>${log.backup_type === 'manual' ? '👤 دستی' : '⏰ خودکار'}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

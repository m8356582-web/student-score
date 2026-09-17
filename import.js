/* ============================================
   📥 Import هوشمند Excel/CSV
   ============================================ */

let importPreviewData = null;
let importSelectedGroups = [];

/* ============================================
   دانلود فایل نمونه CSV
   ============================================ */
async function downloadSampleFile() {
  try {
    showToast('در حال ساخت فایل نمونه...', 'success');

    // گرفتن گروه‌های موجود
    const groups = await Groups.getAll();
    const groupNames = groups.map(g => g.name);

    // اگر گروهی نبود، پیش‌فرض
    if (groupNames.length === 0) {
      groupNames.push('گروه نمونه');
    }

    // ساخت هدر: نام, تلفن, گروه1, گروه2, ...
    const headers = ['نام', 'تلفن', ...groupNames];

    // سه ردیف خالی برای راهنما
    const emptyRow = new Array(headers.length).fill('');

    // ساخت CSV با BOM برای پشتیبانی از فارسی در Excel
    const BOM = '\uFEFF';
    let csv = BOM + headers.join(',') + '\n';
    csv += emptyRow.join(',') + '\n';
    csv += emptyRow.join(',') + '\n';
    csv += emptyRow.join(',') + '\n';

    // دانلود
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `نمونه-ورودی-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('✅ فایل نمونه دانلود شد. با Excel بازش کن.', 'success');
  } catch (err) {
    console.error(err);
    showToast('خطا در ساخت فایل: ' + err.message, 'error');
  }
}

/* ============================================
   پردازش فایل آپلودی
   ============================================ */
async function handleFileUpload(file) {
  if (!file) return;

  const fileName = file.name.toLowerCase();

  try {
    showToast('در حال خواندن فایل...', 'success');

    let rows = [];

    if (fileName.endsWith('.csv')) {
      rows = await parseCSV(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      rows = await parseXLSX(file);
    } else {
      showToast('فقط CSV یا XLSX پشتیبانی می‌شه', 'error');
      return;
    }

    if (rows.length < 2) {
      showToast('فایل خالیه یا فقط هدر داره', 'warning');
      return;
    }

    // پردازش هوشمند
    const processed = await processRows(rows, file.name);

    // نمایش پیش‌نمایش
    showImportPreview(processed, file.name);

  } catch (err) {
    console.error(err);
    showToast('خطا در پردازش فایل: ' + err.message, 'error');
  }
}

/* ============================================
   پارس CSV
   ============================================ */
function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data);
      },
      error: (err) => reject(err)
    });
  });
}

/* ============================================
   پارس XLSX
   ============================================ */
function parseXLSX(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
        resolve(rows.filter(r => r.some(c => String(c).trim() !== '')));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/* ============================================
   پردازش هوشمند ردیف‌ها
   ============================================ */
async function processRows(rows, fileName) {
  // ردیف اول = هدر
  const header = rows[0].map(h => String(h || '').trim());
  const dataRows = rows.slice(1);

  // تشخیص ستون‌ها
  const nameIdx = findColumnIndex(header, ['نام', 'اسم', 'name', 'full_name', 'fullname', 'نام و نام خانوادگی']);
  const phoneIdx = findColumnIndex(header, ['تلفن', 'موبایل', 'شماره', 'phone', 'mobile', 'tel']);

  if (nameIdx === -1) {
    throw new Error('ستون «نام» پیدا نشد. مطمئن شو ستون اول یا دومی «نام» یا «اسم» هست.');
  }

  // ستون‌های گروه = بقیه ستون‌ها (به‌جز نام و تلفن)
  const groupColumns = [];
  header.forEach((h, i) => {
    if (i !== nameIdx && i !== phoneIdx && h && h !== '') {
      groupColumns.push({ index: i, name: h });
    }
  });

  if (groupColumns.length === 0) {
    throw new Error('هیچ ستون گروهی پیدا نشد. باید حداقل یه ستون گروه داشته باشی.');
  }

  // گرفتن گروه‌های موجود
  const existingGroups = await Groups.getAll();
  const existingGroupNames = existingGroups.map(g => g.name.toLowerCase().trim());

  // پردازش هر ردیف
  const processed = [];
  const newGroups = new Set();
  const existingStudents = await Students.getAllWithGroups();
  const existingKeys = new Set(
    existingStudents.map(s => `${s.full_name.trim()}|${(s.phone || '').trim()}`)
  );

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const fullName = String(row[nameIdx] || '').trim();
    const phone = phoneIdx >= 0 ? normalizePhone(String(row[phoneIdx] || '')) : '';

    // ردیف خالی رو نادیده بگیر
    if (!fullName) continue;

    // گروه‌های این دانش‌آموز
    const studentGroups = [];
    groupColumns.forEach(gc => {
      const value = String(row[gc.index] || '').trim();
      if (isChecked(value)) {
        studentGroups.push(gc.name);
        // چک گروه جدید
        if (!existingGroupNames.includes(gc.name.toLowerCase().trim())) {
          newGroups.add(gc.name);
        }
      }
    });

    // چک تکراری
    const key = `${fullName}|${phone}`;
    const isDuplicate = existingKeys.has(key);

    processed.push({
      full_name: fullName,
      phone: phone,
      groups: studentGroups,
      isDuplicate: isDuplicate,
      rowNumber: i + 2
    });
  }

  return {
    students: processed,
    newGroups: Array.from(newGroups),
    totalRows: processed.length,
    duplicateCount: processed.filter(s => s.isDuplicate).length,
    newCount: processed.filter(s => !s.isDuplicate).length,
    fileName: fileName
  };
}

/* ============================================
   پیدا کردن ایندکس ستون
   ============================================ */
function findColumnIndex(header, possibleNames) {
  const normalized = header.map(h => String(h).toLowerCase().trim());
  for (const name of possibleNames) {
    const idx = normalized.indexOf(name.toLowerCase().trim());
    if (idx !== -1) return idx;
  }
  return -1;
}

/* ============================================
   تشخیص علامت (✓ / x / 1 / بله / ...)
   ============================================ */
function isChecked(value) {
  if (!value) return false;
  const v = String(value).trim().toLowerCase();

  if (v === '') return false;
  if (v === '0' || v === 'false' || v === 'no' || v === 'خیر' || v === 'نه' || v === '-') return false;

  // هر چیز دیگه‌ای = بله
  return true;
}

/* ============================================
   نرمال‌سازی شماره تلفن
   ============================================ */
function normalizePhone(phone) {
  if (!phone) return '';

  // تبدیل اعداد فارسی به انگلیسی
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  let result = String(phone);

  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(persianDigits[i], 'g'), i);
    result = result.replace(new RegExp(arabicDigits[i], 'g'), i);
  }

  // حذف کاراکترهای غیرعددی
  result = result.replace(/[^\d]/g, '');

  return result;
}

/* ============================================
   نمایش پیش‌نمایش Import
   ============================================ */
function showImportPreview(data, fileName) {
  importPreviewData = data;

  const previewHTML = `
    <div style="margin-bottom:20px;">
      <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px;">
        <div class="stat-card">
          <div class="stat-icon">📄</div>
          <div class="stat-value" style="font-size:22px;">${data.totalRows}</div>
          <div class="stat-label">کل ردیف‌ها</div>
        </div>
        <div class="stat-card" style="border-color:var(--emerald);">
          <div class="stat-icon">✅</div>
          <div class="stat-value" style="font-size:22px;background:var(--emerald);-webkit-background-clip:text;">${data.newCount}</div>
          <div class="stat-label">دانش‌آموز جدید</div>
        </div>
        <div class="stat-card" style="border-color:var(--warning);">
          <div class="stat-icon">⚠️</div>
          <div class="stat-value" style="font-size:22px;background:var(--warning);-webkit-background-clip:text;">${data.duplicateCount}</div>
          <div class="stat-label">تکراری</div>
        </div>
      </div>

      ${data.newGroups.length > 0 ? `
        <div style="background:rgba(6,182,212,0.1);border:1px solid var(--cyan);border-radius:12px;padding:14px;margin-bottom:16px;">
          <strong>🆕 گروه‌های جدید (${data.newGroups.length}):</strong>
          <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">
            ${data.newGroups.map(g => `<span class="role-badge admin">${g}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      <details style="margin-bottom:16px;">
        <summary style="cursor:pointer;padding:10px;background:rgba(6,182,212,0.1);border-radius:8px;font-weight:600;">
          📋 مشاهده پیش‌نمایش ردیف‌ها (${data.students.length})
        </summary>
        <div style="max-height:300px;overflow-y:auto;margin-top:12px;padding-left:6px;">
          ${data.students.slice(0, 100).map(s => `
            <div class="member-item" style="${s.isDuplicate ? 'border-color:var(--warning);' : ''}">
              <div class="avatar" style="background:${s.isDuplicate ? '#f59e0b' : '#10b981'};width:32px;height:32px;font-size:13px;">
                ${s.isDuplicate ? '⚠' : '✓'}
              </div>
              <div class="member-name">${s.full_name}</div>
              <div style="font-size:11px;color:var(--gray);">
                ${s.phone ? `📱 ${s.phone}` : ''}
                ${s.groups.length > 0 ? ` • 📁 ${s.groups.join(', ')}` : ''}
              </div>
            </div>
          `).join('')}
          ${data.students.length > 100 ? `<p style="text-align:center;color:var(--gray);font-size:12px;margin-top:8px;">... و ${data.students.length - 100} ردیف دیگه</p>` : ''}
        </div>
      </details>

      <div class="form-group">
        <label class="form-label">🔄 رفتار با دانش‌آموزان تکراری:</label>
        <label style="display:flex;align-items:center;gap:8px;padding:10px;cursor:pointer;">
          <input type="radio" name="dupBehavior" value="skip" checked>
          <span>نادیده بگیر (فقط جدیدها اضافه بشن)</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;padding:10px;cursor:pointer;">
          <input type="radio" name="dupBehavior" value="merge">
          <span>ادغام کن (گروه‌های جدید به تکراری‌ها اضافه بشن)</span>
        </label>
      </div>

      <div style="display:flex;gap:10px;margin-top:20px;">
        <button class="btn btn-ghost" style="flex:1;" onclick="cancelImport()">❌ انصراف</button>
        <button class="btn btn-primary" style="flex:2;" onclick="confirmImport()">
          ✅ تایید و Import (${data.totalRows} نفر)
        </button>
      </div>
    </div>
  `;

  document.getElementById('importZone').style.display = 'none';
  document.getElementById('importPreview').style.display = 'block';
  document.getElementById('importPreview').innerHTML = previewHTML;
}

/* ============================================
   انصراف از Import
   ============================================ */
function cancelImport() {
  importPreviewData = null;
  document.getElementById('importZone').style.display = 'block';
  document.getElementById('importPreview').style.display = 'none';
  document.getElementById('importPreview').innerHTML = '';
  document.getElementById('fileInput').value = '';
}

/* ============================================
   تایید و Import نهایی
   ============================================ */
async function confirmImport() {
  if (!importPreviewData) return;

  const dupBehavior = document.querySelector('input[name="dupBehavior"]:checked').value;

  // فیلتر دانش‌آموزان
  let toImport = importPreviewData.students;

  if (dupBehavior === 'skip') {
    toImport = toImport.filter(s => !s.isDuplicate);
  }

  if (toImport.length === 0) {
    showToast('چیزی برای Import نیست', 'warning');
    return;
  }

  // نمایش Progress
  const progressHTML = `
    <div style="text-align:center;padding:40px 20px;">
      <div class="loader loader-lg"></div>
      <h3 style="margin-top:20px;font-size:16px;">در حال Import ${toImport.length} نفر...</h3>
      <p style="color:var(--gray);font-size:13px;margin-top:8px;" id="importProgressText">لطفاً صبر کن...</p>
      <div style="margin-top:20px;background:rgba(6,182,212,0.1);border-radius:12px;height:8px;overflow:hidden;">
        <div id="importProgressBar" style="height:100%;width:0%;background:var(--gradient);transition:width 0.3s;"></div>
      </div>
    </div>
  `;

  document.getElementById('importPreview').innerHTML = progressHTML;

  try {
    const token = Auth.getToken();

    // تبدیل به فرمت RPC
    const studentsData = toImport.map(s => ({
      full_name: s.full_name,
      phone: s.phone || '',
      groups: s.groups.map(g => ({ name: g }))
    }));

    // انیمیشن
    let progress = 0;
    const interval = setInterval(() => {
      progress = Math.min(progress + 15, 90);
      const bar = document.getElementById('importProgressBar');
      const text = document.getElementById('importProgressText');
      if (bar) bar.style.width = progress + '%';
      if (text) text.textContent = `پردازش شده: ${Math.floor(toImport.length * progress / 100)} از ${toImport.length}`;
    }, 200);

    // فراخوانی RPC
    const { data, error } = await db.rpc('bulk_import_students', {
      p_token: token,
      p_students: studentsData
    });

    clearInterval(interval);

    const bar = document.getElementById('importProgressBar');
    if (bar) bar.style.width = '100%';

    if (error) throw error;
    if (!data.success) throw new Error(data.error);

    // نتیجه نهایی
    setTimeout(() => {
      document.getElementById('importPreview').innerHTML = `
        <div style="text-align:center;padding:30px 20px;">
          <div style="font-size:64px;margin-bottom:16px;">🎉</div>
          <h3 style="font-size:20px;margin-bottom:16px;">Import با موفقیت انجام شد!</h3>

          <div class="stats-grid" style="grid-template-columns:repeat(2,1fr);margin-top:20px;">
            <div class="stat-card" style="border-color:var(--emerald);">
              <div class="stat-icon">✅</div>
              <div class="stat-value" style="background:var(--emerald);-webkit-background-clip:text;">${data.added}</div>
              <div class="stat-label">دانش‌آموز جدید</div>
            </div>
            <div class="stat-card" style="border-color:var(--cyan);">
              <div class="stat-icon">📁</div>
              <div class="stat-value">${data.groups_created}</div>
              <div class="stat-label">گروه جدید</div>
            </div>
          </div>

          <button class="btn btn-primary" style="width:100%;margin-top:20px;" onclick="finishImport()">
            🎯 تمام
          </button>
        </div>
      `;
    }, 400);

  } catch (err) {
    console.error(err);
    showToast('خطا در Import: ' + err.message, 'error');

    // برگشت به Preview
    document.getElementById('importPreview').innerHTML = `
      <div style="text-align:center;padding:40px;">
        <div style="font-size:48px;margin-bottom:16px;">❌</div>
        <h3>خطا در Import</h3>
        <p style="color:var(--danger);margin-top:12px;font-size:14px;">${err.message}</p>
        <button class="btn btn-primary" style="margin-top:20px;" onclick="cancelImport()">بازگشت</button>
      </div>
    `;
  }
}

/* ============================================
   پایان Import
   ============================================ */
async function finishImport() {
  cancelImport();
  await loadAll();
  await renderGroupsList();
  await renderStudents();
  renderStats();
  showToast('✅ همه چیز بروز شد', 'success');
}

/* ============================================
   راه‌اندازی Drag & Drop
   ============================================ */
function initImportZone() {
  const zone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');

  if (!zone || !fileInput) return;

  // کلیک روی zone
  zone.addEventListener('click', () => fileInput.click());

  // انتخاب فایل
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFileUpload(file);
  });

  // Drag over
  ['dragenter', 'dragover'].forEach(eventName => {
    zone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.add('dragover');
    });
  });

  // Drag leave
  ['dragleave', 'drop'].forEach(eventName => {
    zone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('dragover');
    });
  });

  // Drop
  zone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  });
}

/* ============================================
   راه‌اندازی اولیه
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
  // کمی تاخیر تا admin.js لود بشه
  setTimeout(() => {
    initImportZone();
  }, 500);
});

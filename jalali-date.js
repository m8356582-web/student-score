/* ============================================
   📅 تقویم شمسی حرفه‌ای
   ============================================ */

/* ============================================
   تبدیل تاریخ میلادی به شمسی
   ============================================ */
function gregorianToJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return [jy, jm, jd];
}

/* ============================================
   تبدیل تاریخ شمسی به میلادی
   ============================================ */
function jalaliToGregorian(jy, jm, jd) {
  let gy = (jy <= 979) ? 621 : 1600;
  jy -= (jy <= 979) ? 0 : 979;
  let days = (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal_a = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm;
  for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
  return [gy, gm, gd];
}

/* ============================================
   نام ماه‌های شمسی
   ============================================ */
const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

const JALALI_WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

/* ============================================
   گرفتن تاریخ شمسی امروز
   ============================================ */
function getTodayJalali() {
  const today = new Date();
  return gregorianToJalali(today.getFullYear(), today.getMonth() + 1, today.getDate());
}

/* ============================================
   تبدیل تاریخ شمسی به رشته ISO (میلادی)
   ============================================ */
function jalaliToISO(jy, jm, jd) {
  const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
  const pad = (n) => String(n).padStart(2, '0');
  return `${gy}-${pad(gm)}-${pad(gd)}`;
}

/* ============================================
   تبدیل ISO به شمسی
   ============================================ */
function isoToJalali(isoDate) {
  if (!isoDate) return null;
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3) return null;
  const [jy, jm, jd] = gregorianToJalali(parts[0], parts[1], parts[2]);
  return { year: jy, month: jm, day: jd };
}

/* ============================================
   فرمت شمسی: ۱۴۰۴/۰۶/۲۷
   ============================================ */
function formatJalali(jy, jm, jd, format = 'full') {
  const pad = (n) => String(n).padStart(2, '0');
  
  if (format === 'full') {
    return `${jy}/${pad(jm)}/${pad(jd)}`;
  } else if (format === 'text') {
    return `${jd} ${JALALI_MONTHS[jm - 1]} ${jy}`;
  } else if (format === 'short') {
    return `${jy}/${pad(jm)}/${pad(jd)}`;
  }
  return `${jy}/${pad(jm)}/${pad(jd)}`;
}

/* ============================================
   فرمت ISO به شمسی خوانا
   ============================================ */
function formatISOToJalali(isoDate, format = 'text') {
  const j = isoToJalali(isoDate);
  if (!j) return isoDate;
  return formatJalali(j.year, j.month, j.day, format);
}

/* ============================================
   📅 انتخابگر تاریخ شمسی (مودال)
   ============================================ */
let jalaliPickerState = {
  currentYear: 0,
  currentMonth: 0,
  selectedYear: 0,
  selectedMonth: 0,
  selectedDay: 0,
  onSelect: null
};

function openJalaliPicker(initialISO, onSelect) {
  const j = initialISO ? isoToJalali(initialISO) : null;
  const today = getTodayJalali();

  jalaliPickerState = {
    currentYear: j ? j.year : today[0],
    currentMonth: j ? j.month : today[1],
    selectedYear: j ? j.year : today[0],
    selectedMonth: j ? j.month : today[1],
    selectedDay: j ? j.day : today[2],
    onSelect: onSelect
  };

  renderJalaliPicker();
}

function renderJalaliPicker() {
  let modal = document.getElementById('jalaliPickerModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'jalaliPickerModal';
    modal.className = 'modal-overlay jalali-picker-overlay';
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeJalaliPicker();
    });
  }

  modal.classList.add('active');

  const { currentYear, currentMonth, selectedYear, selectedMonth, selectedDay } = jalaliPickerState;

  // روزهای ماه جاری
  const daysInMonth = getDaysInJalaliMonth(currentYear, currentMonth);
  const firstDayOfMonth = getFirstDayOfWeek(currentYear, currentMonth);

  // سلول‌های خالی
  let daysHTML = '';
  for (let i = 0; i < firstDayOfMonth; i++) {
    daysHTML += '<div class="jalali-day empty"></div>';
  }

  // روزها
  for (let d = 1; d <= daysInMonth; d++) {
    const isSelected = (d === selectedDay && currentMonth === selectedMonth && currentYear === selectedYear);
    const isToday = isTodayJalali(currentYear, currentMonth, d);
    daysHTML += `
      <div class="jalali-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}" 
           onclick="selectJalaliDay(${d})">
        ${toPersianDigits(d)}
      </div>
    `;
  }

  modal.innerHTML = `
    <div class="jalali-picker">
      <div class="jalali-header">
        <button class="jalali-nav" onclick="jalaliNavigate(-1)">‹</button>
        <div class="jalali-title">
          <div class="jalali-month-year">${JALALI_MONTHS[currentMonth - 1]} ${toPersianDigits(currentYear)}</div>
        </div>
        <button class="jalali-nav" onclick="jalaliNavigate(1)">›</button>
      </div>

      <div class="jalali-weekdays">
        ${['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map(d => `<div>${d}</div>`).join('')}
      </div>

      <div class="jalali-days">
        ${daysHTML}
      </div>

      <div class="jalali-actions">
        <button class="btn btn-ghost" onclick="closeJalaliPicker()">انصراف</button>
        <button class="btn btn-ghost" onclick="jumpToToday()">امروز</button>
        <button class="btn btn-primary" onclick="confirmJalaliDate()">تایید</button>
      </div>
    </div>
  `;
}

function jalaliNavigate(direction) {
  jalaliPickerState.currentMonth += direction;
  if (jalaliPickerState.currentMonth > 12) {
    jalaliPickerState.currentMonth = 1;
    jalaliPickerState.currentYear++;
  } else if (jalaliPickerState.currentMonth < 1) {
    jalaliPickerState.currentMonth = 12;
    jalaliPickerState.currentYear--;
  }
  renderJalaliPicker();
}

function selectJalaliDay(day) {
  jalaliPickerState.selectedYear = jalaliPickerState.currentYear;
  jalaliPickerState.selectedMonth = jalaliPickerState.currentMonth;
  jalaliPickerState.selectedDay = day;
  renderJalaliPicker();
}

function jumpToToday() {
  const today = getTodayJalali();
  jalaliPickerState.currentYear = today[0];
  jalaliPickerState.currentMonth = today[1];
  jalaliPickerState.selectedYear = today[0];
  jalaliPickerState.selectedMonth = today[1];
  jalaliPickerState.selectedDay = today[2];
  renderJalaliPicker();
}

function confirmJalaliDate() {
  const { selectedYear, selectedMonth, selectedDay, onSelect } = jalaliPickerState;
  const isoDate = jalaliToISO(selectedYear, selectedMonth, selectedDay);
  
  if (typeof onSelect === 'function') {
    onSelect(isoDate, `${selectedYear}/${String(selectedMonth).padStart(2, '0')}/${String(selectedDay).padStart(2, '0')}`);
  }
  
  closeJalaliPicker();
}

function closeJalaliPicker() {
  const modal = document.getElementById('jalaliPickerModal');
  if (modal) modal.classList.remove('active');
}

/* ============================================
   توابع کمکی
   ============================================ */
function getDaysInJalaliMonth(year, month) {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  // اسفند: چک کبیسه
  return isLeapJalaliYear(year) ? 30 : 29;
}

function isLeapJalaliYear(year) {
  const leapYears = [1, 5, 9, 13, 17, 22, 26, 30];
  const mod = year % 33;
  return leapYears.includes(mod);
}

function getFirstDayOfWeek(year, month) {
  const isoDate = jalaliToISO(year, month, 1);
  const date = new Date(isoDate + 'T00:00:00');
  // شنبه = 0، یکشنبه = 1، ...
  const jsDay = date.getDay(); // 0=Sunday, 6=Saturday
  // تبدیل: شنبه=0، یکشنبه=1، دوشنبه=2، ...
  return (jsDay + 1) % 7;
}

function isTodayJalali(year, month, day) {
  const today = getTodayJalali();
  return year === today[0] && month === today[1] && day === today[2];
}

function toPersianDigits(num) {
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  return String(num).split('').map(d => persianDigits[parseInt(d)] || d).join('');
}

/* ============================================
   اتصال به input تاریخ
   ============================================ */
function initJalaliInputs() {
  document.querySelectorAll('.jalali-date-input').forEach(input => {
    input.setAttribute('readonly', 'readonly');
    input.style.cursor = 'pointer';
    input.placeholder = 'کلیک کن برای انتخاب';

    input.addEventListener('click', () => {
      const currentValue = input.dataset.isoValue || '';
      openJalaliPicker(currentValue, (isoDate, jalaliText) => {
        input.value = jalaliText;
        input.dataset.isoValue = isoDate;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => initJalaliInputs(), 2000);
});



/* ============================================
   🌐 اتصال به Window
   ============================================ */
if (typeof window !== 'undefined') {
  window.JALALI_MONTHS = JALALI_MONTHS;
  window.JALALI_WEEKDAYS = JALALI_WEEKDAYS;
  window.gregorianToJalali = gregorianToJalali;
  window.jalaliToGregorian = jalaliToGregorian;
  window.getTodayJalali = getTodayJalali;
  window.jalaliToISO = jalaliToISO;
  window.isoToJalali = isoToJalali;
  window.formatJalali = formatJalali;
  window.formatISOToJalali = formatISOToJalali;
  window.openJalaliPicker = openJalaliPicker;
  window.closeJalaliPicker = closeJalaliPicker;
  window.renderJalaliPicker = renderJalaliPicker;
  window.getDaysInJalaliMonth = getDaysInJalaliMonth;
  window.isLeapJalaliYear = isLeapJalaliYear;
  window.toPersianDigits = toPersianDigits;
  window.initJalaliInputs = initJalaliInputs;
}

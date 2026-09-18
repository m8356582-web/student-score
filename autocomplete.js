/* ============================================
   ⚡ Auto-complete هوشمند
   ============================================ */

/* ============================================
   رندر لیست پیشنهاد برای اسم دانش‌آموز
   ============================================ */
function renderAutocompleteSuggestions(inputElement, container, students, onSelect) {
  if (!students || students.length === 0) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = students.slice(0, 8).map((s, i) => `
    <div class="autocomplete-item" data-idx="${i}">
      <div class="avatar" style="background:${s.avatar_color || '#06b6d4'};width:32px;height:32px;font-size:13px;">
        ${getInitial(s.full_name)}
      </div>
      <div class="autocomplete-info">
        <div class="autocomplete-name">${highlightMatch(s.full_name, inputElement.value)}</div>
        <div class="autocomplete-meta">⭐ ${s.total_score || 0} امتیاز</div>
      </div>
    </div>
  `).join('');

  // کلیک روی هر آیتم
  container.querySelectorAll('.autocomplete-item').forEach((el, i) => {
    el.addEventListener('click', () => {
      onSelect(students[i]);
      container.style.display = 'none';
      container.innerHTML = '';
    });
  });

  // انتخاب با کیبورد
  let selectedIdx = -1;
  const handleKey = (e) => {
    const items = container.querySelectorAll('.autocomplete-item');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIdx = (selectedIdx + 1) % items.length;
      items.forEach(it => it.classList.remove('selected'));
      items[selectedIdx].classList.add('selected');
      items[selectedIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIdx = (selectedIdx - 1 + items.length) % items.length;
      items.forEach(it => it.classList.remove('selected'));
      items[selectedIdx].classList.add('selected');
      items[selectedIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && selectedIdx >= 0) {
      e.preventDefault();
      items[selectedIdx].click();
      inputElement.removeEventListener('keydown', handleKey);
    } else if (e.key === 'Escape') {
      container.style.display = 'none';
      inputElement.removeEventListener('keydown', handleKey);
    }
  };

  inputElement.removeEventListener('keydown', handleKey);
  inputElement.addEventListener('keydown', handleKey);
}

/* ============================================
   هایلایت بخش منطبق
   ============================================ */
function highlightMatch(text, query) {
  if (!query) return text;
  const idx = text.indexOf(query);
  if (idx === -1) return text;
  return text.slice(0, idx) +
    `<mark style="background: rgba(6, 182, 212, 0.3); color: var(--cyan); padding: 1px 3px; border-radius: 3px;">${text.slice(idx, idx + query.length)}</mark>` +
    text.slice(idx + query.length);
}

/* ============================================
   اتصال به input سرچ
   ============================================ */
function setupAutocomplete(inputId, containerId, studentsCache, onSelect) {
  const input = document.getElementById(inputId);
  const container = document.getElementById(containerId);
  if (!input || !container) return;

  let timer;

  input.addEventListener('input', (e) => {
    clearTimeout(timer);
    const query = e.target.value.trim();

    if (query.length < 1) {
      container.style.display = 'none';
      return;
    }

    timer = setTimeout(() => {
      const matches = studentsCache
        .filter(s => s.full_name && s.full_name.includes(query))
        .sort((a, b) => (b.total_score || 0) - (a.total_score || 0));

      renderAutocompleteSuggestions(input, container, matches, onSelect);
    }, 150);
  });

  // مخفی کردن با کلیک بیرون
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !container.contains(e.target)) {
      container.style.display = 'none';
    }
  });

  // مخفی کردن با Escape
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') container.style.display = 'none';
  });
}

/* ============================================
   پیشنهاد امتیاز بر اساس تاریخچه
   ============================================ */
async function getSuggestedAmounts(studentId) {
  try {
    const scores = await Scores.getByStudent(studentId);

    if (scores.length === 0) {
      return [10, 20, 30, 50];
    }

    // میانگین امتیازها
    const positiveScores = scores.filter(s => s.amount > 0).map(s => s.amount);
    const avg = positiveScores.length > 0
      ? Math.round(positiveScores.reduce((a, b) => a + b, 0) / positiveScores.length)
      : 20;

    // بیشترین تکرار
    const freq = {};
    positiveScores.forEach(a => freq[a] = (freq[a] || 0) + 1);
    const mostCommon = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(e => Number(e[0]));

    // ترکیب پیشنهادها
    const suggestions = new Set([avg, ...mostCommon, 20, 50, 100]);
    return Array.from(suggestions).filter(a => a > 0).sort((a, b) => a - b).slice(0, 6);

  } catch (err) {
    console.warn('خطا:', err);
    return [10, 20, 30, 50];
  }
}

/* ============================================
   نمایش پیشنهادها زیر input
   ============================================ */
function renderAmountSuggestions(containerId, amounts, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!amounts || amounts.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">
      ${amounts.map(a => `
        <button type="button" class="amount-chip" data-amount="${a}">
          ${a}
        </button>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('.amount-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const amount = Number(btn.dataset.amount);
      onSelect(amount);
    });
  });
}

/* ============================================
   پیشنهاد دلیل بر اساس تاریخچه
   ============================================ */
async function getSuggestedReasons() {
  try {
    const { data, error } = await db
      .from('scores')
      .select('reason')
      .not('reason', 'is', null)
      .limit(500);

    if (error) throw error;

    // شمارش تکرار
    const freq = {};
    (data || []).forEach(s => {
      if (s.reason && s.reason.trim().length > 0) {
        const r = s.reason.trim();
        freq[r] = (freq[r] || 0) + 1;
      }
    });

    // ۵ تای اول
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(e => e[0]);

  } catch (err) {
    console.warn('خطا:', err);
    return [];
  }
}

/* ============================================
   نمایش پیشنهاد دلیل
   ============================================ */
function renderReasonSuggestions(containerId, reasons, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!reasons || reasons.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">
      ${reasons.map(r => `
        <button type="button" class="reason-chip" data-reason="${r.replace(/"/g, '&quot;')}">
          ${r}
        </button>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('.reason-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      onSelect(btn.dataset.reason);
    });
  });
}

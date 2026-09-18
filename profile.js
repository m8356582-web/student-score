/* ============================================
   👤 پروفایل ادمین
   ============================================ */

let adminProfileCache = null;

/* ============================================
   بارگذاری پروفایل
   ============================================ */
async function loadAdminProfile() {
  try {
    const token = Auth.getToken();
    if (!token) return null;

    const { data, error } = await db.rpc('get_admin_profile_secure', {
      p_token: token
    });

    if (error) throw error;
    if (!data.success) return null;

    adminProfileCache = data.profile;
    return adminProfileCache;
  } catch (err) {
    console.warn('خطا در بارگذاری پروفایل:', err);
    return null;
  }
}

/* ============================================
   باز کردن پروفایل (مودال)
   ============================================ */
async function openAdminProfile() {
  openModal('👤 پروفایل من', '<div class="loading-screen"><div class="loader loader-lg"></div></div>');

  try {
    const profile = await loadAdminProfile();
    if (!profile) throw new Error('پروفایل پیدا نشد');

    const colors = ['#06b6d4', '#10b981', '#0ea5e9', '#14b8a6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444'];

    document.getElementById('modalBody').innerHTML = `
      <div class="profile-hero" style="padding:24px;">
        <div class="profile-avatar" id="profileAvatar" style="background:${profile.avatar_color || '#06b6d4'}">
          ${getInitial(profile.full_name)}
        </div>
        <div class="profile-name" id="profileNameDisplay">${profile.full_name}</div>
        <div class="profile-group">${profile.role === 'super' ? '👑 سوپر ادمین' : '🔑 ادمین'}</div>
        <div style="font-size:13px;color:var(--gray);margin-top:8px;">📱 ${profile.phone}</div>
        ${profile.bio ? `<div style="margin-top:12px;font-size:13px;color:var(--gray);font-style:italic;">"${profile.bio}"</div>` : ''}
      </div>

      <div class="form-group">
        <label class="form-label">نام نمایشی</label>
        <input type="text" class="form-input" id="profileNameInput" value="${profile.full_name}">
      </div>

      <div class="form-group">
        <label class="form-label">درباره من (اختیاری)</label>
        <textarea class="form-textarea" id="profileBioInput" placeholder="مثلاً: مدیر مجموعه فرهنگی">${profile.bio || ''}</textarea>
      </div>

      <div class="form-group">
        <label class="form-label">رنگ پروفایل</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
          ${colors.map(c => `
            <div class="color-picker-item" data-color="${c}" 
                 style="width:40px;height:40px;border-radius:50%;background:${c};cursor:pointer;border:3px solid ${c === (profile.avatar_color || '#06b6d4') ? 'white' : 'transparent'};box-shadow:0 4px 12px ${c}55;"
                 onclick="selectProfileColor('${c}')">
            </div>
          `).join('')}
        </div>
        <input type="hidden" id="profileColorInput" value="${profile.avatar_color || '#06b6d4'}">
      </div>

      <div style="display:flex;gap:8px;margin-top:20px;">
        <button class="btn btn-ghost" style="flex:1;" onclick="openChangePassword()">🔒 تغییر رمز</button>
        <button class="btn btn-primary" style="flex:2;" onclick="saveAdminProfile()">💾 ذخیره تغییرات</button>
      </div>
    `;
  } catch (err) {
    console.error(err);
    document.getElementById('modalBody').innerHTML = '<div class="no-result">خطا در بارگذاری پروفایل</div>';
  }
}

/* ============================================
   انتخاب رنگ
   ============================================ */
function selectProfileColor(color) {
  document.getElementById('profileColorInput').value = color;
  const avatar = document.getElementById('profileAvatar');
  if (avatar) avatar.style.background = color;

  document.querySelectorAll('.color-picker-item').forEach(el => {
    if (el.dataset.color === color) {
      el.style.borderColor = 'white';
      el.style.transform = 'scale(1.15)';
    } else {
      el.style.borderColor = 'transparent';
      el.style.transform = 'scale(1)';
    }
  });
}

/* ============================================
   ذخیره پروفایل
   ============================================ */
async function saveAdminProfile() {
  const fullName = document.getElementById('profileNameInput').value.trim();
  const bio = document.getElementById('profileBioInput').value.trim();
  const avatarColor = document.getElementById('profileColorInput').value;

  if (!fullName) {
    showToast('نام رو وارد کن', 'warning');
    return;
  }

  try {
    const token = Auth.getToken();
    const { data, error } = await db.rpc('update_admin_profile_secure', {
      p_token: token,
      p_full_name: fullName,
      p_avatar_color: avatarColor,
      p_bio: bio
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error);

    // آپدیت localStorage
    const admin = Auth.get();
    if (admin) {
      admin.full_name = fullName;
      Auth.set(token, admin);
      document.getElementById('adminName').textContent = fullName;
    }

    showToast('✅ پروفایل ذخیره شد', 'success');
    if (typeof quickConfetti === 'function') quickConfetti();

    closeModal();
  } catch (err) {
    console.error(err);
    showToast('خطا: ' + err.message, 'error');
  }
}

/* ============================================
   تغییر رمز
   ============================================ */
function openChangePassword() {
  openModal('🔒 تغییر رمز عبور', `
    <div class="form-group">
      <label class="form-label">رمز فعلی</label>
      <input type="password" class="form-input" id="currentPasswordInput" placeholder="رمز فعلی">
    </div>
    <div class="form-group">
      <label class="form-label">رمز جدید</label>
      <input type="password" class="form-input" id="newPasswordInput" placeholder="حداقل ۶ کاراکتر">
    </div>
    <div class="form-group">
      <label class="form-label">تکرار رمز جدید</label>
      <input type="password" class="form-input" id="confirmPasswordInput" placeholder="تکرار رمز جدید">
    </div>
    <button class="btn btn-primary" style="width:100%;" onclick="changeMyPassword()">💾 ذخیره رمز جدید</button>
  `);
}

async function changeMyPassword() {
  const current = document.getElementById('currentPasswordInput').value;
  const newPass = document.getElementById('newPasswordInput').value;
  const confirmPass = document.getElementById('confirmPasswordInput').value;

  if (!current || !newPass || !confirmPass) {
    showToast('همه فیلدها رو پر کن', 'warning');
    return;
  }

  if (newPass.length < 6) {
    showToast('رمز جدید حداقل ۶ کاراکتر', 'warning');
    return;
  }

  if (newPass !== confirmPass) {
    showToast('رمز جدید و تکرارش یکی نیستن', 'warning');
    return;
  }

  try {
    // اول: چک رمز فعلی با لاگین دوباره
    const admin = Auth.get();
    const loginResult = await Auth.login(admin.phone, current);

    if (!loginResult.success) {
      showToast('رمز فعلی اشتباهه', 'error');
      return;
    }

    // بعد: تغییر رمز
    const token = Auth.getToken();
    const { data, error } = await db.rpc('update_admin_password_secure', {
      p_token: token,
      p_admin_id: admin.id,
      p_new_password: newPass
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error);

    showToast('✅ رمز تغییر کرد', 'success');
    if (typeof quickConfetti === 'function') quickConfetti();

    closeModal();

  } catch (err) {
    console.error(err);
    showToast('خطا: ' + err.message, 'error');
  }
}

/* ============================================
   نمایش اطلاعات پروفایل در هدر
   ============================================ */
async function updateHeaderProfile() {
  const profile = await loadAdminProfile();
  if (!profile) return;

  const adminNameEl = document.getElementById('adminName');
  if (adminNameEl) adminNameEl.textContent = profile.full_name;

  // دکمه پروفایل در هدر
  const avatar = document.querySelector('.admin-info .logo-circle');
  if (avatar) {
    avatar.style.background = `linear-gradient(135deg, ${profile.avatar_color}, ${profile.avatar_color}dd)`;
    avatar.style.fontSize = '20px';
    avatar.innerHTML = getInitial(profile.full_name);
  }
}

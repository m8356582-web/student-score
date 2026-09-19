/* ============================================
   👥 مدیریت Session ها + کاربران آنلاین
   ============================================ */

let deviceInfo = null;

/* ============================================
   تشخیص اطلاعات دستگاه
   ============================================ */
function detectDeviceInfo() {
  const ua = navigator.userAgent;

  // نوع دستگاه
  let deviceType = 'Desktop';
  if (/Mobile|Android|iPhone|iPad|iPod/i.test(ua)) deviceType = 'Mobile';
  if (/Tablet|iPad/i.test(ua)) deviceType = 'Tablet';

  // مرورگر
  let browser = 'Unknown';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

  // سیستم عامل
  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux') && !ua.includes('Android')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';

  return { deviceType, browser, os, userAgent: ua };
}

/* ============================================
   گرفتن IP کاربر
   ============================================ */
async function getUserIP() {
  try {
    // استفاده از یه API رایگان
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip;
  } catch (err) {
    // اگه خطا داد، از localStorage استفاده کن
    return localStorage.getItem('cached_ip') || 'unknown';
  }
}

/* ============================================
   گرفتن موقعیت جغرافیایی از IP
   ============================================ */
async function getGeoFromIP(ip) {
  try {
    // API رایگان برای IP
    const res = await fetch(`https://ipapi.co/${ip}/json/`);
    const data = await res.json();
    return {
      country: data.country_name || 'نامشخص',
      city: data.city || 'نامشخص'
    };
  } catch (err) {
    return { country: 'نامشخص', city: 'نامشخص' };
  }
}

/* ============================================
   ثبت Session جدید (بعد از لاگین)
   ============================================ */
async function registerUserSession(token, userId, userType, userName) {
  try {
    if (!deviceInfo) {
      deviceInfo = detectDeviceInfo();
    }

    const ip = await getUserIP();
    localStorage.setItem('cached_ip', ip);

    const geo = await getGeoFromIP(ip);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // آپدیت info با geo
    const completeInfo = { ...deviceInfo, ip, ...geo };

    // ذخیره تو دیتابیس
    const { data, error } = await db.rpc('register_session', {
      p_token: token,
      p_user_id: userId,
      p_user_type: userType,
      p_user_name: userName,
      p_device_type: completeInfo.deviceType,
      p_browser: completeInfo.browser,
      p_os: completeInfo.os,
      p_user_agent: completeInfo.userAgent,
      p_ip_address: completeInfo.ip,
      p_expires_at: expiresAt.toISOString()
    });

    if (error) throw error;

    // ذخیره تو localStorage برای Ping
    localStorage.setItem('session_token', token);
    localStorage.setItem('session_info', JSON.stringify(completeInfo));

    // شروع Ping
    startPinging(token);

    return data;
  } catch (err) {
    console.warn('خطا در ثبت Session:', err);
    return null;
  }
}

/* ============================================
   Ping دوره‌ای (هر ۳۰ ثانیه)
   ============================================ */
let pingInterval = null;

function startPinging(token) {
  if (pingInterval) clearInterval(pingInterval);

  // اولین Ping فوری
  pingNow(token);

  // هر ۳۰ ثانیه
  pingInterval = setInterval(() => {
    pingNow(token);
  }, 30000);
}

async function pingNow(token) {
  try {
    await db.rpc('ping_session', { p_token: token });
  } catch (err) {
    console.warn('Ping fail:', err);
  }
}

function stopPinging() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

/* ============================================
   ثبت بازدید
   ============================================ */
async function registerPageVisit(page) {
  try {
    const admin = Auth.get();
    const token = Auth.getToken();
    const ip = localStorage.getItem('cached_ip') || 'unknown';
    const ua = navigator.userAgent;

    let userType = 'guest';
    let userId = null;
    let userName = null;

    if (token && admin) {
      userType = 'admin';
      userId = admin.id;
      userName = admin.full_name;
    }

    await db.rpc('register_visit', {
      p_page: page,
      p_user_type: userType,
      p_user_id: userId,
      p_user_name: userName,
      p_ip_address: ip,
      p_user_agent: ua
    });
  } catch (err) {
    console.warn('خطا در ثبت بازدید:', err);
  }
}

/* ============================================
   گرفتن نشست‌های فعال
   ============================================ */
async function fetchActiveSessions() {
  try {
    const token = Auth.getToken();
    const { data, error } = await db.rpc('get_active_sessions', {
      p_token: token
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return data.sessions || [];
  } catch (err) {
    console.error('خطا:', err);
    return [];
  }
}

/* ============================================
   گرفتن کاربران آنلاین
   ============================================ */
async function fetchOnlineUsers() {
  try {
    const token = Auth.getToken();
    const { data, error } = await db.rpc('get_online_users', {
      p_token: token
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return { online: data.online || [], count: data.count || 0 };
  } catch (err) {
    console.error('خطا:', err);
    return { online: [], count: 0 };
  }
}

/* ============================================
   حذف نشست (Logout از راه دور)
   ============================================ */
async function killUserSession(sessionId) {
  if (!confirm('این نشست رو قطع کنی؟ کاربر از سایت خارج می‌شه.')) return false;

  try {
    const token = Auth.getToken();
    const { data, error } = await db.rpc('kill_session', {
      p_token: token,
      p_session_id: sessionId
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);

    showToast('✅ نشست قطع شد', 'success');
    return true;
  } catch (err) {
    console.error(err);
    showToast('خطا: ' + err.message, 'error');
    return false;
  }
}

/* ============================================
   بلاک IP
   ============================================ */
async function blockUserIP(ip, reason = '') {
  if (!confirm(`IP "${ip}" بلاک بشه؟`)) return false;

  try {
    const token = Auth.getToken();
    const { data, error } = await db.rpc('block_ip', {
      p_token: token,
      p_ip: ip,
      p_reason: reason
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);

    showToast('🚫 IP بلاک شد', 'success');
    return true;
  } catch (err) {
    console.error(err);
    showToast('خطا: ' + err.message, 'error');
    return false;
  }
}

async function unblockUserIP(ip) {
  if (!confirm(`IP "${ip}" آنبلاک بشه؟`)) return false;

  try {
    const token = Auth.getToken();
    const { data, error } = await db.rpc('unblock_ip', {
      p_token: token,
      p_ip: ip
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);

    showToast('✅ آنبلاک شد', 'success');
    return true;
  } catch (err) {
    console.error(err);
    showToast('خطا: ' + err.message, 'error');
    return false;
  }
}

/* ============================================
   فرمت زمان نسبی
   ============================================ */
function formatDuration(seconds) {
  if (seconds < 60) return `${seconds} ثانیه`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} دقیقه`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} ساعت`;
  return `${Math.floor(seconds / 86400)} روز`;
}

/* ============================================
   آیکون دستگاه
   ============================================ */
function getDeviceIcon(deviceType) {
  if (deviceType === 'Mobile') return '📱';
  if (deviceType === 'Tablet') return '📱';
  return '💻';
      }

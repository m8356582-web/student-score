/* ============================================
   اتصال به Supabase + توابع دیتابیس (نسخه امنیتی)
   ============================================ */

const SUPABASE_URL = 'https://jbbrvrldxsrknensbkzd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiYnJ2cmxkeHNya25lbnNia3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NjYzNjcsImV4cCI6MjEwNTE0MjM2N30.4LcfU7ayXbh5iUC8yGIcjOs-yOw2QtvAZaZPjVTqoJg';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ============================================
   🔐 Auth - مدیریت امن لاگین با توکن
   ============================================ */
const Auth = {
  TOKEN_KEY: 'auth_token',
  ADMIN_KEY: 'auth_admin',

  set(token, admin) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.ADMIN_KEY, JSON.stringify(admin));
  },

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  get() {
    const data = localStorage.getItem(this.ADMIN_KEY);
    return data ? JSON.parse(data) : null;
  },

  clear() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.ADMIN_KEY);
  },

  isSuper() {
    const a = this.get();
    return a && a.role === 'super';
  },

  isAdmin() {
    return !!this.getToken();
  },

  // لاگین امن از طریق RPC
  async login(phone, password) {
    try {
      const { data, error } = await db.rpc('login_admin', {
        p_phone: phone,
        p_password: password
      });
      if (error) throw error;

      if (data.success) {
        this.set(data.token, data.admin);
      }
      return data;
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'خطا در اتصال. لطفاً دوباره تلاش کن.' };
    }
  },

  // چک کردن اعتبار توکن
  async verify() {
    const token = this.getToken();
    if (!token) return false;

    try {
      const { data, error } = await db.rpc('verify_token', { p_token: token });
      if (error) throw error;
      return data.success;
    } catch (err) {
      console.error('Verify error:', err);
      return false;
    }
  },

  // چک کردن توکن قبل از هر عملیات (خروجی: توکن یا خطا)
  requireToken() {
    const token = this.getToken();
    if (!token) {
      window.location.href = 'login.html';
      throw new Error('توکن ندارید');
    }
    return token;
  }
};

/* ============================================
   ادمین‌ها (فقط خواندن - عملیات از RPC)
   ============================================ */
const Admins = {
  async getAll() {
    // از طریق RPC امن - چون policy نداره، نمی‌شه مستقیم خوند
    // راه‌حل: از یه RPC برای گرفتن لیست ادمین‌ها استفاده می‌کنیم
    // ولی چون ساده‌ترش می‌کنیم، فعلاً این تابع کار نمی‌کنه
    // بعداً با RPC اضافه می‌کنیم
    try {
      const { data, error } = await db
        .from('admins')
        .select('id, phone, full_name, role, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('خطا در گرفتن ادمین‌ها:', err);
      return [];
    }
  },

  async create(phone, password, fullName, role = 'admin', createdBy = null) {
    const token = Auth.requireToken();

    // از طریق RPC امن
    const { data, error } = await db.rpc('create_admin_secure', {
      p_token: token,
      p_phone: phone,
      p_password: password,
      p_full_name: fullName,
      p_role: role
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return data;
  },

  async delete(id) {
    const token = Auth.requireToken();
    const { data, error } = await db.rpc('delete_secure', {
      p_token: token,
      p_table: 'admins',
      p_id: id
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return data;
  },

  async updatePassword(id, newPassword) {
    const token = Auth.requireToken();
    const { data, error } = await db.rpc('update_admin_password_secure', {
      p_token: token,
      p_admin_id: id,
      p_new_password: newPassword
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return data;
  }
};

/* ============================================
   گروه‌ها (خواندن عمومی + نوشتن از RPC)
   ============================================ */
const Groups = {
  async getAll() {
    const { data, error } = await db
      .from('groups')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getWithCount() {
    const { data, error } = await db
      .from('groups')
      .select('*, student_groups(count)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(g => ({
      ...g,
      student_count: g.student_groups?.[0]?.count || 0
    }));
  },

  async getById(id) {
    const { data, error } = await db.from('groups').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  async create(name, description = '') {
    const token = Auth.requireToken();
    const { data, error } = await db.rpc('create_group_secure', {
      p_token: token,
      p_name: name,
      p_description: description
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return data;
  },

  async update(id, name, description) {
    const token = Auth.requireToken();
    const { data, error } = await db.rpc('update_group_secure', {
      p_token: token,
      p_group_id: id,
      p_name: name,
      p_description: description
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return data;
  },

  async delete(id) {
    const token = Auth.requireToken();
    const { data, error } = await db.rpc('delete_secure', {
      p_token: token,
      p_table: 'groups',
      p_id: id
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return data;
  },

  async getStudents(groupId) {
    const { data, error } = await db
      .from('student_groups')
      .select('student_id, students(*)')
      .eq('group_id', groupId);
    if (error) throw error;
    return (data || []).map(r => r.students).filter(Boolean);
  }
};

/* ============================================
   دانش‌آموزان
   ============================================ */
const Students = {
  async getAll() {
    const { data, error } = await db
      .from('students')
      .select('*')
      .order('total_score', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getAllWithGroups() {
    const [students, relations] = await Promise.all([
      this.getAll(),
      db.from('student_groups').select('student_id, groups(id, name)').then(r => r.data || [])
    ]);

    const groupsByStudent = {};
    relations.forEach(r => {
      if (!groupsByStudent[r.student_id]) groupsByStudent[r.student_id] = [];
      if (r.groups) groupsByStudent[r.student_id].push(r.groups);
    });

    return students.map(s => ({
      ...s,
      groups: groupsByStudent[s.id] || []
    }));
  },

  async getGroups(studentId) {
    const { data, error } = await db
      .from('student_groups')
      .select('group_id, groups(name)')
      .eq('student_id', studentId);
    if (error) throw error;
    return (data || []).map(r => r.groups).filter(Boolean);
  },

  async getByGroup(groupId) {
    const { data, error } = await db
      .from('student_groups')
      .select('students(*)')
      .eq('group_id', groupId);
    if (error) throw error;
    const students = (data || []).map(r => r.students).filter(Boolean);
    students.sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
    return students;
  },

  async getById(id) {
    const { data, error } = await db.from('students').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  async search(query) {
    const { data, error } = await db
      .from('students')
      .select('*')
      .ilike('full_name', `%${query}%`)
      .order('total_score', { ascending: false })
      .limit(20);
    if (error) throw error;
    return data || [];
  },

  async getTop(limit = 3) {
    const { data, error } = await db
      .from('students')
      .select('*')
      .order('total_score', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async create(fullName, phone, groupIds = []) {
    const token = Auth.requireToken();
    const { data, error } = await db.rpc('create_student_secure', {
      p_token: token,
      p_full_name: fullName,
      p_phone: phone || '',
      p_group_ids: groupIds
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return data;
  },

  async update(id, updates) {
    const token = Auth.requireToken();
    const { data, error } = await db.rpc('update_student_secure', {
      p_token: token,
      p_student_id: id,
      p_full_name: updates.full_name,
      p_phone: updates.phone,
      p_total_score: updates.total_score
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return data;
  },

  async delete(id) {
    const token = Auth.requireToken();
    const { data, error } = await db.rpc('delete_secure', {
      p_token: token,
      p_table: 'students',
      p_id: id
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return data;
  },

  async addToGroup(studentId, groupId) {
    const token = Auth.requireToken();
    const { data, error } = await db.rpc('add_student_to_group_secure', {
      p_token: token,
      p_student_id: studentId,
      p_group_id: groupId
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return data;
  },

  async removeFromGroup(studentId, groupId) {
    const token = Auth.requireToken();
    const { data, error } = await db.rpc('remove_student_from_group_secure', {
      p_token: token,
      p_student_id: studentId,
      p_group_id: groupId
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return data;
  },

  async setGroups(studentId, groupIds) {
    const token = Auth.requireToken();
    const { data, error } = await db.rpc('set_student_groups_secure', {
      p_token: token,
      p_student_id: studentId,
      p_group_ids: groupIds
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return data;
  }
};

/* ============================================
   امتیازها
   ============================================ */
const Scores = {
  async getByStudent(studentId) {
    const { data, error } = await db
      .from('scores')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getRecent(limit = 20) {
    const { data, error } = await db
      .from('scores')
      .select('*, students(full_name)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  async add(studentId, amount, reason, sessionTitle = '', scoreType = 'manual') {
    const token = Auth.requireToken();
    const { data, error } = await db.rpc('add_score_secure', {
      p_token: token,
      p_student_id: studentId,
      p_amount: amount,
      p_reason: reason,
      p_session_title: sessionTitle,
      p_score_type: scoreType
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return data.new_total;
  },

  async addBulk(entries, scoreType = 'attendance') {
    const token = Auth.requireToken();

    const studentIds = entries.map(e => e.studentId);
    const amount = entries[0]?.amount || 0;
    const reason = entries[0]?.reason || '';
    const sessionTitle = entries[0]?.sessionTitle || '';

    const { data, error } = await db.rpc('add_bulk_scores_secure', {
      p_token: token,
      p_student_ids: studentIds,
      p_amount: amount,
      p_reason: reason,
      p_session_title: sessionTitle,
      p_score_type: scoreType
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return data;
  },

  async delete(id) {
    const token = Auth.requireToken();
    const { data, error } = await db.rpc('delete_secure', {
      p_token: token,
      p_table: 'scores',
      p_id: id
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return data;
  }
};

/* ============================================
   جلسات
   ============================================ */
const Sessions = {
  async getAll() {
    const { data, error } = await db
      .from('sessions')
      .select('*, groups(name)')
      .order('session_date', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getById(id) {
    const { data, error } = await db
      .from('sessions')
      .select('*, groups(name)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(title, sessionDate, groupId, notes = '') {
    const token = Auth.requireToken();
    const { data, error } = await db.rpc('create_session_secure', {
      p_token: token,
      p_title: title,
      p_session_date: sessionDate,
      p_group_id: groupId,
      p_notes: notes
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return data;
  },

  async update(id, updates) {
    const token = Auth.requireToken();
    const { data, error } = await db.rpc('update_session_secure', {
      p_token: token,
      p_session_id: id,
      p_title: updates.title,
      p_session_date: updates.session_date,
      p_group_id: updates.group_id,
      p_notes: updates.notes
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return data;
  },

  async delete(id) {
    const token = Auth.requireToken();
    const { data, error } = await db.rpc('delete_secure', {
      p_token: token,
      p_table: 'sessions',
      p_id: id
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return data;
  }
};

/* ============================================
   تاریخچه حضور
   ============================================ */
const AttendanceRecords = {
  async getBySession(sessionId) {
    const { data, error } = await db
      .from('attendance_records')
      .select('*, students(full_name, avatar_color)')
      .eq('session_id', sessionId);
    if (error) throw error;
    return data || [];
  },

  async getByStudent(studentId) {
    const { data, error } = await db
      .from('attendance_records')
      .select('*, sessions(title, session_date)')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async addBulk(sessionId, studentIds) {
    const token = Auth.requireToken();
    const { data, error } = await db.rpc('add_attendance_secure', {
      p_token: token,
      p_session_id: sessionId,
      p_student_ids: studentIds
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return data;
  },

  async getSessionsWithStats() {
    const { data: sessions, error } = await db
      .from('sessions')
      .select('*, groups(name)')
      .order('session_date', { ascending: false });
    if (error) throw error;

    const { data: records } = await db.from('attendance_records').select('session_id');

    const countMap = {};
    (records || []).forEach(r => {
      countMap[r.session_id] = (countMap[r.session_id] || 0) + 1;
    });

    return (sessions || []).map(s => ({
      ...s,
      attendee_count: countMap[s.id] || 0
    }));
  }
};

/* ============================================
   Audit Log
   ============================================ */
const AuditLog = {
  async getRecent(limit = 50) {
    const { data, error } = await db
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }
};

/* ============================================
   توابع کمکی
   ============================================ */
function toJalali(dateStr) {
  if (!dateStr) return '';
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric', month: 'long', day: 'numeric'
    }).format(new Date(dateStr));
  } catch { return dateStr; }
}

function toJalaliFull(dateStr) {
  if (!dateStr) return '';
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(dateStr));
  } catch { return dateStr; }
}

function getInitial(name) {
  if (!name) return '؟';
  return name.trim().charAt(0);
}

function showToast(message, type = 'success') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  const icons = { success: '✅', error: '❌', warning: '⚠️' };
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function showLoading(container, text = 'در حال بارگذاری...') {
  if (!container) return;
  container.innerHTML = `<div class="loading-screen"><div class="loader loader-lg"></div><p>${text}</p></div>`;
}

function requireAdmin() {
  const admin = Auth.get();
  if (!admin || !Auth.getToken()) {
    window.location.href = 'login.html';
    return null;
  }
  return admin;
       }

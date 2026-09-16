/* ============================================
   اتصال به Supabase + توابع دیتابیس (نسخه ۲)
   ============================================ */

const SUPABASE_URL = 'https://jbbrvrldxsrknensbkzd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiYnJ2cmxkeHNya25lbnNia3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1NjYzNjcsImV4cCI6MjEwNTE0MjM2N30.4LcfU7ayXbh5iUC8yGIcjOs-yOw2QtvAZaZPjVTqoJg';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ============================================
   هش رمز
   ============================================ */
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ============================================
   ادمین‌ها
   ============================================ */
const Admins = {
  async login(phone, password) {
    const passwordHash = await hashPassword(password);
    const { data, error } = await db
      .from('admins')
      .select('*')
      .eq('phone', phone)
      .eq('password_hash', passwordHash)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getAll() {
    const { data, error } = await db
      .from('admins').select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async create(phone, password, fullName, role = 'admin', createdBy = null) {
    const passwordHash = await hashPassword(password);
    const { data, error } = await db
      .from('admins')
      .insert([{ phone, password_hash: passwordHash, full_name: fullName, role, created_by: createdBy }])
      .select().single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await db.from('admins').delete().eq('id', id);
    if (error) throw error;
  },

  async updatePassword(id, newPassword) {
    const passwordHash = await hashPassword(newPassword);
    const { error } = await db.from('admins').update({ password_hash: passwordHash }).eq('id', id);
    if (error) throw error;
  }
};

/* ============================================
   گروه‌ها
   ============================================ */
const Groups = {
  async getAll() {
    const { data, error } = await db.from('groups').select('*').order('created_at', { ascending: false });
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

  async create(name, description = '', createdBy = null) {
    const { data, error } = await db
      .from('groups')
      .insert([{ name, description, created_by: createdBy }])
      .select().single();
    if (error) throw error;
    return data;
  },

  async update(id, name, description) {
    const { error } = await db.from('groups').update({ name, description }).eq('id', id);
    if (error) throw error;
  },

  async delete(id) {
    const { error } = await db.from('groups').delete().eq('id', id);
    if (error) throw error;
  },

  // گرفتن دانش‌آموزان یک گروه (چند به چند)
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

  // گرفتن گروه‌های یک دانش‌آموز
  async getGroups(studentId) {
    const { data, error } = await db
      .from('student_groups')
      .select('group_id, groups(name)')
      .eq('student_id', studentId);
    if (error) throw error;
    return (data || []).map(r => r.groups).filter(Boolean);
  },

  // گرفتن دانش‌آموزان چند گروه (برای نمایش)
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

  async create(fullName, phone, avatarColor = null) {
    const colors = ['#06b6d4', '#10b981', '#0ea5e9', '#14b8a6', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444'];
    const color = avatarColor || colors[Math.floor(Math.random() * colors.length)];
    const { data, error } = await db
      .from('students')
      .insert([{ full_name: fullName, phone, avatar_color: color }])
      .select().single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { error } = await db.from('students').update(updates).eq('id', id);
    if (error) throw error;
  },

  async delete(id) {
    const { error } = await db.from('students').delete().eq('id', id);
    if (error) throw error;
  },

  // اضافه کردن دانش‌آموز به گروه
  async addToGroup(studentId, groupId) {
    const { error } = await db
      .from('student_groups')
      .insert([{ student_id: studentId, group_id: groupId }]);
    if (error && !error.message.includes('duplicate')) throw error;
  },

  // حذف دانش‌آموز از گروه
  async removeFromGroup(studentId, groupId) {
    const { error } = await db
      .from('student_groups')
      .delete()
      .eq('student_id', studentId)
      .eq('group_id', groupId);
    if (error) throw error;
  },

  // ست کردن گروه‌های یک دانش‌آموز (جایگزینی کامل)
  async setGroups(studentId, groupIds) {
    // اول همه رو حذف کن
    const { error: delErr } = await db
      .from('student_groups')
      .delete()
      .eq('student_id', studentId);
    if (delErr) throw delErr;

    // بعد اضافه کن
    if (groupIds.length > 0) {
      const rows = groupIds.map(gid => ({ student_id: studentId, group_id: gid }));
      const { error } = await db.from('student_groups').insert(rows);
      if (error) throw error;
    }
  },

  // گرفتن دانش‌آموزان با گروه‌هاشون (برای نمایش)
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
  }
};

/* ============================================
   امتیازها
   ============================================ */
const Scores = {
  async getByStudent(studentId) {
    const { data, error } = await db
      .from('scores').select('*')
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

  async add(studentId, amount, reason, sessionTitle = '', scoreType = 'manual', createdBy = null) {
    const { error: scoreError } = await db
      .from('scores')
      .insert([{
        student_id: studentId, amount: Number(amount), reason,
        session_title: sessionTitle, score_type: scoreType, created_by: createdBy
      }]);
    if (scoreError) throw scoreError;

    const student = await Students.getById(studentId);
    const newTotal = (student.total_score || 0) + Number(amount);
    await Students.update(studentId, { total_score: newTotal });
    return newTotal;
  },

  async addBulk(entries, scoreType = 'attendance', createdBy = null) {
    const scoreInserts = entries.map(e => ({
      student_id: e.studentId, amount: Number(e.amount),
      reason: e.reason || '', session_title: e.sessionTitle || '',
      score_type: scoreType, created_by: createdBy
    }));
    const { error } = await db.from('scores').insert(scoreInserts);
    if (error) throw error;

    for (const e of entries) {
      const student = await Students.getById(e.studentId);
      const newTotal = (student.total_score || 0) + Number(e.amount);
      await Students.update(e.studentId, { total_score: newTotal });
    }
  },

  async delete(id) {
    const { data: score } = await db.from('scores').select('*').eq('id', id).single();
    if (score) {
      const student = await Students.getById(score.student_id);
      const newTotal = (student.total_score || 0) - score.amount;
      await Students.update(score.student_id, { total_score: newTotal });
    }
    const { error } = await db.from('scores').delete().eq('id', id);
    if (error) throw error;
  }
};

/* ============================================
   جلسات
   ============================================ */
const Sessions = {
  async getAll() {
    const { data, error } = await db
      .from('sessions').select('*, groups(name)')
      .order('session_date', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getById(id) {
    const { data, error } = await db
      .from('sessions').select('*, groups(name)')
      .eq('id', id).single();
    if (error) throw error;
    return data;
  },

  async create(title, sessionDate, groupId, notes = '', createdBy = null) {
    const { data, error } = await db
      .from('sessions')
      .insert([{ title, session_date: sessionDate, group_id: groupId, notes, created_by: createdBy }])
      .select().single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { error } = await db.from('sessions').update(updates).eq('id', id);
    if (error) throw error;
  },

  async delete(id) {
    const { error } = await db.from('sessions').delete().eq('id', id);
    if (error) throw error;
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
    if (studentIds.length === 0) return;
    const rows = studentIds.map(sid => ({ session_id: sessionId, student_id: sid }));
    const { error } = await db.from('attendance_records').insert(rows);
    if (error && !error.message.includes('duplicate')) throw error;
  },

  async getSessionsWithStats() {
    // گرفتن همه جلسات + تعداد حاضرین
    const { data: sessions, error } = await db
      .from('sessions')
      .select('*, groups(name)')
      .order('session_date', { ascending: false });
    if (error) throw error;

    const { data: records } = await db
      .from('attendance_records')
      .select('session_id');

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
   توابع کمکی
   ============================================ */
function toJalali(dateStr) {
  if (!dateStr) return '';
  try {
    return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(dateStr));
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

const Auth = {
  set(admin) { localStorage.setItem('currentAdmin', JSON.stringify(admin)); },
  get() {
    const data = localStorage.getItem('currentAdmin');
    return data ? JSON.parse(data) : null;
  },
  clear() { localStorage.removeItem('currentAdmin'); },
  isSuper() { const a = this.get(); return a && a.role === 'super'; },
  isAdmin() { return !!this.get(); }
};

function requireAdmin() {
  const admin = Auth.get();
  if (!admin) {
    window.location.href = 'login.html';
    return null;
  }
  return admin;
       }

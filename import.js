<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>پنل مدیریت | سیستم امتیازدهی</title>
    <link rel="stylesheet" href="style.css">
    <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <style>
        .admin-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 24px;
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(20px);
            border-radius: var(--radius);
            border: 1px solid rgba(6, 182, 212, 0.2);
            margin-bottom: 20px;
            box-shadow: var(--shadow);
            flex-wrap: wrap;
            gap: 12px;
        }

        body.light-mode .admin-header {
            background: rgba(255, 255, 255, 0.8);
        }

        .admin-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .admin-actions {
            display: flex;
            gap: 8px;
            align-items: center;
            flex-wrap: wrap;
        }

        .section-card {
            background: rgba(30, 41, 59, 0.6);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(6, 182, 212, 0.15);
            border-radius: var(--radius);
            padding: 24px;
            margin-bottom: 20px;
        }

        body.light-mode .section-card {
            background: rgba(255, 255, 255, 0.8);
        }

        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            flex-wrap: wrap;
            gap: 12px;
        }

            .section-header h3 {
                font-size: 18px;
                display: flex;
                align-items: center;
                gap: 10px;
            }

        .action-bar {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-bottom: 20px;
            align-items: center;
        }

            .action-bar .form-select {
                width: auto;
                min-width: 200px;
            }

        .attendance-list {
            max-height: 500px;
            overflow-y: auto;
            padding-left: 8px;
        }

        .counter-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            background: rgba(6, 182, 212, 0.15);
            color: var(--cyan);
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
        }

        .admin-row {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 14px 18px;
            background: rgba(30, 41, 59, 0.4);
            border-radius: var(--radius-sm);
            margin-bottom: 10px;
            border: 1px solid rgba(6, 182, 212, 0.1);
        }

        body.light-mode .admin-row {
            background: rgba(241, 245, 249, 0.8);
        }

        .admin-row-info {
            flex: 1;
        }

        .admin-row-name {
            font-size: 15px;
            font-weight: 700;
            margin-bottom: 4px;
        }

        .admin-row-phone {
            font-size: 12px;
            color: var(--gray);
            direction: ltr;
            text-align: right;
        }

        .session-row {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 16px 18px;
            background: rgba(30, 41, 59, 0.4);
            border-radius: var(--radius-sm);
            margin-bottom: 10px;
            border-right: 4px solid var(--cyan);
        }

        body.light-mode .session-row {
            background: rgba(241, 245, 249, 0.8);
        }

        .session-info {
            flex: 1;
        }

        .session-title-text {
            font-size: 15px;
            font-weight: 700;
            margin-bottom: 4px;
        }

        .session-meta {
            font-size: 12px;
            color: var(--gray);
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        }

        .btn-small {
            padding: 6px 12px;
            font-size: 12px;
        }

        @media (max-width: 640px) {
            .admin-header {
                padding: 12px 16px;
            }

            .section-card {
                padding: 18px;
            }

            .action-bar .form-select {
                width: 100%;
            }
        }
    </style>
</head>
<body>

    <div class="container">

        <!-- ============ هدر ادمین ============ -->
        <header class="admin-header">
            <div class="admin-info">
                <div class="logo-circle" style="width:44px;height:44px;font-size:20px;">👑</div>
                <div>
                    <div style="font-weight:700;font-size:15px;" id="adminName">ادمین</div>
                    <div style="font-size:11px;color:var(--gray);">پنل مدیریت</div>
                </div>
                <span class="role-badge super" id="roleBadge">سوپر ادمین</span>
            </div>
            <div class="admin-actions">
                <button class="btn btn-icon" id="themeToggle" title="تغییر تم">🌙</button>
                <a href="index.html" class="btn btn-ghost">🏠 صفحه اصلی</a>
                <button class="btn btn-danger" id="logoutBtn">🚪 خروج</button>
            </div>
        </header>

        <!-- ============ تب‌ها ============ -->
        <div class="tabs">
            <button class="tab-btn active" data-tab="dashboard">📊 داشبورد</button>
            <button class="tab-btn" data-tab="groups">📁 گروه‌ها</button>
            <button class="tab-btn" data-tab="students">👥 دانش‌آموزان</button>
            <button class="tab-btn" data-tab="attendance">✅ ثبت حضور</button>
            <button class="tab-btn" data-tab="manual">📝 امتیاز متفرقه</button>
            <button class="tab-btn" data-tab="sessions">📚 جلسات</button>
            <button class="tab-btn" data-tab="admins" id="adminsTab">🔑 ادمین‌ها</button>
        </div>

        <!-- ============ تب داشبورد ============ -->
        <div class="tab-content active" id="tab-dashboard">
            <div class="stats-grid" id="statsGrid"></div>

            <div class="section-card">
                <div class="section-header">
                    <h3>🕐 آخرین امتیازهای ثبت‌شده</h3>
                </div>
                <div id="recentScores"></div>
            </div>
        </div>

        <!-- ============ تب گروه‌ها ============ -->
        <div class="tab-content" id="tab-groups">
            <div class="section-card">
                <div class="section-header">
                    <h3>📁 مدیریت گروه‌ها</h3>
                    <button class="btn btn-primary" onclick="openGroupForm()">➕ گروه جدید</button>
                </div>
                <div id="groupsList"></div>
            </div>
        </div>

        <!-- ============ تب دانش‌آموزان ============ -->
        <div class="tab-content" id="tab-students">
            <div class="section-card">
                <div class="section-header">
                    <h3>👥 مدیریت دانش‌آموزان</h3>
                    <button class="btn btn-primary" onclick="openStudentForm()">➕ دانش‌آموز جدید</button>
                </div>

                <div class="action-bar">
                    <select class="form-select" id="filterGroup" onchange="renderStudents()">
                        <option value="">همه گروه‌ها</option>
                    </select>
                    <input type="text" class="form-input" style="flex:1;min-width:200px;" id="studentSearch" placeholder="🔍 جستجو در اسم..." oninput="renderStudents()">
                </div>

                <div id="studentsList"></div>
            </div>
        </div>

        <!-- ============ تب ثبت حضور ============ -->
        <div class="tab-content" id="tab-attendance">
            <div class="section-card">
                <div class="section-header">
                    <h3>✅ ثبت حضور</h3>
                    <span class="counter-badge" id="attCounter">۰ نفر انتخاب شده</span>
                </div>

                <div class="action-bar">
                    <select class="form-select" id="attGroup" onchange="renderAttendance()">
                        <option value="">انتخاب گروه...</option>
                    </select>
                    <input type="text" class="form-input" style="flex:1;min-width:200px;" id="attSessionTitle" placeholder="📚 عنوان جلسه (مثلاً: قصه‌های قرآنی)">
                    <button class="btn btn-ghost btn-small" onclick="selectAllAttendance()">همه</button>
                    <button class="btn btn-ghost btn-small" onclick="deselectAllAttendance()">هیچ‌کدام</button>
                </div>

                <div class="attendance-list" id="attendanceList"></div>

                <div style="margin-top:20px;">
                    <div class="form-group">
                        <label class="form-label">📝 توضیحات / دلیل (اختیاری)</label>
                        <textarea class="form-textarea" id="attReason" placeholder="مثلاً: جلسه هفتگی، حضور فعال..."></textarea>
                    </div>
                    <button class="btn btn-primary" style="width:100%;" onclick="submitAttendance()">
                        ✅ ثبت حضور و افزودن ۵ امتیاز
                    </button>
                </div>
            </div>
        </div>

        <!-- ============ تب امتیاز متفرقه ============ -->
        <div class="tab-content" id="tab-manual">
            <div class="section-card">
                <div class="section-header">
                    <h3>📝 ثبت امتیاز متفرقه</h3>
                </div>

                <div class="form-group">
                    <label class="form-label">🔍 جستجوی دانش‌آموز</label>
                    <input type="text" class="form-input" id="manualSearch" placeholder="اسم دانش‌آموز رو تایپ کن..." oninput="searchManualStudent()">
                </div>

                <div id="manualSearchResults"></div>

                <div id="manualSelectedBox" style="display:none;margin-top:20px;">
                    <div class="profile-hero" style="padding:20px;">
                        <div class="profile-avatar" id="manualAvatar" style="width:60px;height:60px;font-size:24px;">؟</div>
                        <div class="profile-name" style="font-size:18px;" id="manualName">-</div>
                        <div class="profile-group" id="manualGroup">-</div>
                    </div>

                    <div class="grid-2">
                        <div class="form-group">
                            <label class="form-label">💯 مقدار امتیاز</label>
                            <input type="number" class="form-input" id="manualAmount" placeholder="مثلاً: 20 یا -5">
                        </div>
                        <div class="form-group">
                            <label class="form-label">📚 عنوان جلسه (اختیاری)</label>
                            <input type="text" class="form-input" id="manualSession" placeholder="مثلاً: مسابقه قرآنی">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">📝 دلیل</label>
                        <textarea class="form-textarea" id="manualReason" placeholder="مثلاً: پاسخ صحیح به سوال..."></textarea>
                    </div>

                    <button class="btn btn-primary" style="width:100%;" onclick="submitManualScore()">
                        💾 ثبت امتیاز
                    </button>
                </div>
            </div>
        </div>

        <!-- ============ تب جلسات ============ -->
        <div class="tab-content" id="tab-sessions">
            <div class="section-card">
                <div class="section-header">
                    <h3>📚 مدیریت جلسات</h3>
                    <button class="btn btn-primary" onclick="openSessionForm()">➕ جلسه جدید</button>
                </div>
                <div id="sessionsList"></div>
            </div>
        </div>

        <!-- ============ تب ادمین‌ها ============ -->
        <div class="tab-content" id="tab-admins">
            <div class="section-card">
                <div class="section-header">
                    <h3>🔑 مدیریت ادمین‌ها</h3>
                    <button class="btn btn-primary" id="addAdminBtn" onclick="openAdminForm()">➕ ادمین جدید</button>
                </div>
                <div id="adminsList"></div>
            </div>
        </div>

    </div>

    <!-- ============ مودال عمومی ============ -->
    <div class="modal-overlay" id="mainModal">
        <div class="modal">
            <div class="modal-header">
                <h3 class="modal-title" id="modalTitle">عنوان</h3>
                <button class="modal-close" onclick="closeModal()">×</button>
            </div>
            <div id="modalBody"></div>
        </div>
    </div>

    <script src="supabase.js"></script>
    <script src="admin.js"></script>
</body>
</html>
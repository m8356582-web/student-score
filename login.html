<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ورود ادمین | سیستم امتیازدهی</title>
    <link rel="stylesheet" href="style.css">
    <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <style>
        .login-wrapper {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .login-card {
            width: 100%;
            max-width: 420px;
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(24px);
            border: 1px solid rgba(6, 182, 212, 0.2);
            border-radius: 24px;
            padding: 40px 32px;
            box-shadow: 0 24px 64px rgba(0, 0, 0, 0.4);
            animation: slideUp 0.5s;
        }

        body.light-mode .login-card {
            background: rgba(255, 255, 255, 0.9);
        }

        .login-logo {
            text-align: center;
            margin-bottom: 28px;
        }

            .login-logo .logo-circle {
                width: 70px;
                height: 70px;
                font-size: 32px;
                margin: 0 auto 16px;
            }

            .login-logo h1 {
                font-size: 22px;
                font-weight: 700;
                background: var(--gradient);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                margin-bottom: 6px;
            }

            .login-logo p {
                font-size: 13px;
                color: var(--gray);
            }

        .login-form .form-group {
            margin-bottom: 18px;
        }

        .login-btn {
            width: 100%;
            padding: 14px;
            font-size: 15px;
            margin-top: 8px;
        }

        .error-box {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #fca5a5;
            padding: 12px 16px;
            border-radius: 10px;
            font-size: 13px;
            margin-bottom: 16px;
            display: none;
            text-align: center;
        }

            .error-box.show {
                display: block;
                animation: pop 0.3s;
            }

        .back-link {
            text-align: center;
            margin-top: 20px;
            font-size: 13px;
        }

            .back-link a {
                color: var(--gray);
                display: inline-flex;
                align-items: center;
                gap: 6px;
                transition: color 0.3s;
            }

                .back-link a:hover {
                    color: var(--cyan);
                    text-decoration: none;
                }
    </style>
</head>
<body>

    <div class="login-wrapper">
        <div class="login-card">

            <div class="login-logo">
                <div class="logo-circle">👑</div>
                <h1>ورود ادمین</h1>
                <p>فقط مدیران می‌توانند وارد شوند</p>
            </div>

            <div id="errorBox" class="error-box"></div>

            <form class="login-form" id="loginForm">
                <div class="form-group">
                    <label class="form-label">📱 شماره تلفن</label>
                    <input type="tel" class="form-input" id="phone" placeholder="09xxxxxxxxx" required autocomplete="username">
                </div>

                <div class="form-group">
                    <label class="form-label">🔒 رمز عبور</label>
                    <input type="password" class="form-input" id="password" placeholder="••••••••" required autocomplete="current-password">
                </div>

                <button type="submit" class="btn btn-primary login-btn" id="submitBtn">
                    ورود به پنل مدیریت
                </button>
            </form>

            <div class="back-link">
                <a href="index.html">← بازگشت به صفحه اصلی</a>
            </div>

        </div>
    </div>

    <script src="supabase.js"></script>
    <script>
    /* ============================================
       منطق ورود ادمین
       ============================================ */

    // اگه از قبل لاگین کرده، مستقیم بره پنل
    if (Auth.isAdmin()) {
      window.location.href = 'admin.html';
    }

    const form = document.getElementById('loginForm');
    const errorBox = document.getElementById('errorBox');
    const submitBtn = document.getElementById('submitBtn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const phone = document.getElementById('phone').value.trim();
      const password = document.getElementById('password').value;

      errorBox.classList.remove('show');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="loader"></span> در حال ورود...';

      try {
        const admin = await Admins.login(phone, password);

        if (!admin) {
          throw new Error('شماره تلفن یا رمز عبور اشتباه است');
        }

        Auth.set(admin);
        showToast(`خوش آمدی ${admin.full_name} 👋`, 'success');

        setTimeout(() => {
          window.location.href = 'admin.html';
        }, 600);

      } catch (err) {
        console.error(err);
        errorBox.textContent = '❌ ' + (err.message || 'خطا در ورود');
        errorBox.classList.add('show');
        submitBtn.disabled = false;
        submitBtn.textContent = 'ورود به پنل مدیریت';
      }
    });
    </script>
</body>
</html>
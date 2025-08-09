# TimeBox - MVP (Timeboxing Planner)

نسخه اولیهٔ TimeBox: برنامه‌ریز تایم‌باکس با قابلیت‌های زیر:
- برنامه‌ریزی روزانه/هفتگی/ماهانه/سالانه (ایجاد بلوک زمانی)
- لیست تسک‌ها و اتصال ساده
- تایمر بلوک (شروع/توقف/علامت‌گذاری انجام‌شده)
- ورود اختیاری با Google (Firebase Auth) و ذخیره اولیه در Firestore
- همگام‌سازی رویدادها از Google Calendar به عنوان بلوک‌های زمانی (خواندن و وارد کردن)
- ذخیره محلی کامل برای کاربران مهمان
- خروجی JSON برای پشتیبان‌گیری

## راه‌اندازی محلی و آماده‌سازی برای GitHub Pages

1. پوشه را روی سیستم‌تان اکسترکت کنید. برای فقط فرانت‌اند نیازی به Node نیست؛ کافیست `index.html` را در مرورگر باز کنید.
2. **فعال کردن ورود گوگل و Firestore (اختیاری اما برای همگام‌سازی لازم)**:
   - به [Google Cloud Console](https://console.cloud.google.com) برو.
   - یک پروژه بساز و **OAuth 2.0 Client ID** از بخش Credentials اضافه کن (Type: Web application).
   - در **Authorized JavaScript origins** آدرس `https://yourusername.github.io` (یا لوکال `http://localhost:5500`) را اضافه کن.
   - **Google Calendar API** را فعال کن (APIs & Services → Library → Google Calendar API → Enable).
   - در Firebase Console، یک پروژه بساز، Firestore و Authentication (Google sign-in) را فعال کن.
   - تنظیمات Firebase را در `index.html` (window.__FIREBASE_CONFIG__) قرار بده.
   - مقدار `window.__GOOGLE_CLIENT_ID__` را هم با Client ID که ساختی پر کن.
3. اگر نمی‌خواهی Firebase استفاده کنی، برنامه در حالت مهمان (localStorage) کامل کار خواهد کرد. دکمهٔ ورود گوگل مخفی می‌شود.
4. برای انتشار در **GitHub Pages**:
   - یک repo جدید بساز، فایل‌ها را push کن.
   - در Settings → Pages، شاخه `main` و پوشه `/ (root)` را انتخاب کن.
   - صبر کن تا صفحه منتشر شود و دامنه `https://yourusername.github.io/yourrepo` فعال شود.
   - اگر از Google OAuth استفاده می‌کنی، آدرس منشأ مجاز را در Google Cloud Console اضافه کن.

## نکات فنی
- همگام‌سازی کامل دوطرفه با Google Calendar در این نسخه وجود ندارد؛ تنها خواندن رویدادها و وارد کردن به عنوان timebox پیاده‌سازی شده است. نوشتن رویدادها از بلوک‌ها نیز از طریق Google Calendar API ممکن است (می‌توان اضافه کرد).
- Firestore برای نگهداری دائم timebox ها و تنظیمات کاربر استفاده شده است (در صورت ورود).
- برای تولید نسخهٔ پیشرفته‌تر (drag & drop دقیق، conflict detection، پیشنهاد خودکار زمان‌بندی)، می‌توان React و کتابخانه‌های تقویم مثل FullCalendar را استفاده کرد.

## فایل‌های مهم
- `index.html`, `style.css`, `app.js` — کد اصلی فرانت‌اند
- `ding-placeholder.txt` — جایگزین برای ding.mp3؛ لطفاً یک فایل MP3 واقعی با نام `ding.mp3` بگذارید.

اگر دوست داری من:
- فایل ZIP را آماده کنم (انجام شده) و یا repo GitHub را بسازم و فایل‌ها را push کنم.
- قابلیت نوشتن رویدادها به Google Calendar یا همگام‌سازی دوطرفه را اضافه کنم.
- UI را زیباتر و واکنش‌گرا تر کنم، یا ترجمه‌ها را بهتر کنم.

بگو ادامه بدم و Zip رو تحویل بدم یا می‌خوای تغییر قبل از زیپ انجام بدی.

# مشروع إدارة المنتجات - Flask App

## 🚀 النشر على الإنترنت

### المتطلبات:
- Python 3.8+
- PostgreSQL (للنشر السحابي)
- SQLite (للتطوير المحلي)

### 📋 خطوات النشر:

#### 1. **Render** (الأسهل - مجاني)
1. اذهب إلى [render.com](https://render.com)
2. أنشئ حساب جديد
3. اختر "New Web Service"
4. اربط مستودع GitHub
5. استخدم الإعدادات:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python server.py`
   - **Environment**: Python 3

#### 2. **إعداد قاعدة البيانات:**

##### على Render:
1. أنشئ "PostgreSQL Database" جديد
2. انسخ رابط قاعدة البيانات (DATABASE_URL)
3. أضف متغير البيئة في إعدادات Web Service:
   ```
   DATABASE_URL=postgresql://username:password@hostname:port/database
   ```

##### على Railway:
1. أضف PostgreSQL Plugin
2. سيتم إنشاء DATABASE_URL تلقائياً

##### على Heroku:
```bash
# إضافة PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# النشر
git push heroku main
```

### 🔧 متغيرات البيئة المطلوبة:

```env
DATABASE_URL=postgresql://username:password@hostname:port/database
SECRET_KEY=your-secret-key-here
DEBUG=False
PORT=5000
```

### 🏠 التشغيل المحلي:

```bash
# تثبيت المتطلبات
pip install -r requirements.txt

# تشغيل الخادم
python server.py
```

### 📁 هيكل المشروع:

```
├── server.py              # الخادم الرئيسي
├── database_cloud.py      # قاعدة البيانات (SQLite + PostgreSQL)
├── database.py           # قاعدة البيانات القديمة (SQLite فقط)
├── requirements.txt      # المتطلبات
├── Procfile             # إعدادات Heroku
├── index.html           # الصفحة الرئيسية
├── login.html           # صفحة تسجيل الدخول
├── script.js            # JavaScript
├── styles.css           # التنسيقات
└── fonts/               # الخطوط
```

### 🔒 الأمان:

1. **غيّر SECRET_KEY** في server.py:
```python
app.secret_key = os.environ.get('SECRET_KEY', 'your-new-secret-key')
```

2. **استخدم HTTPS** في الإنتاج

3. **لا تكشف معلومات حساسة** في الكود

### 📊 قاعدة البيانات:

- **محلياً**: SQLite (app.db)
- **سحابياً**: PostgreSQL
- **التبديل التلقائي**: يعتمد على متغير DATABASE_URL

### 🖼️ الصور:

- **محلياً**: مجلد saved_images/
- **سحابياً**: يُنصح باستخدام خدمة تخزين سحابية مثل:
  - Cloudinary
  - AWS S3
  - Google Cloud Storage

### 🆘 استكشاف الأخطاء:

1. **خطأ قاعدة البيانات**: تأكد من صحة DATABASE_URL
2. **خطأ الاستيراد**: تأكد من تثبيت psycopg2-binary
3. **خطأ الاتصال**: تأكد من إعدادات الشبكة

### 📞 الدعم:

إذا واجهت أي مشاكل، تأكد من:
- صحة متغيرات البيئة
- تثبيت جميع المتطلبات
- صحة إعدادات قاعدة البيانات
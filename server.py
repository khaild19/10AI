from flask import Flask, request, jsonify, send_from_directory, session
from flask_cors import CORS
import sys
import os
import requests
import uuid
from urllib.parse import urlparse
from database_cloud import Database
from functools import wraps

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-this-in-production'  # غير هذا في الإنتاج
CORS(app, supports_credentials=True)  # للسماح بطلبات من المتصفح مع الكوكيز

# إنشاء قاعدة البيانات
db = Database()

# إنشاء مجلد للصور المحفوظة
UPLOADS_DIR = 'saved_images'
if not os.path.exists(UPLOADS_DIR):
    os.makedirs(UPLOADS_DIR)

# وظائف البريد الإلكتروني
# تم إزالة دوال البريد الإلكتروني لأنها لم تعد مطلوبة

# دالة للتحقق من تسجيل الدخول
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'يجب تسجيل الدخول أولاً', 'login_required': True}), 401
        return f(*args, **kwargs)
    return decorated_function

# نقاط النهاية للمصادقة
@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        
        if not username or not email or not password:
            return jsonify({'error': 'جميع الحقول مطلوبة'}), 400
        
        # التحقق من وجود المستخدم
        try:
            existing_user = db.authenticate_user(username, 'dummy')
            if existing_user:
                return jsonify({'error': 'اسم المستخدم موجود بالفعل'}), 400
        except:
            pass
        
        # إنشاء المستخدم مباشرة بدون تحقق من البريد الإلكتروني
        user_id = db.create_user(username, email, password)
        
        if user_id:
            # تسجيل دخول المستخدم تلقائياً
            session['user_id'] = user_id
            session['username'] = username
            
            return jsonify({
                'message': 'تم إنشاء الحساب بنجاح',
                'user': {
                    'id': user_id,
                    'username': username,
                    'email': email
                }
            }), 201
        else:
            return jsonify({'error': 'فشل في إنشاء الحساب'}), 500
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': 'خطأ في الخادم'}), 500

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'error': 'اسم المستخدم وكلمة المرور مطلوبان'}), 400
        
        # التحقق من بيانات الدخول الثابتة
        if username == '10AI' and password == '10AI':
            session['user_id'] = 1
            session['username'] = '10AI'
            return jsonify({
                'message': 'تم تسجيل الدخول بنجاح',
                'user': {
                    'id': 1,
                    'username': '10AI',
                    'email': '10ai@10ai.com'
                }
            }), 200
        else:
            return jsonify({'error': 'اسم المستخدم أو كلمة المرور غير صحيحة'}), 401
            
    except Exception as e:
        return jsonify({'error': 'خطأ في الخادم'}), 500

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'تم تسجيل الخروج بنجاح'}), 200

@app.route('/api/current-user', methods=['GET'])
def current_user():
    if 'user_id' in session:
        user = db.get_user_by_id(session['user_id'])
        if user:
            return jsonify({'user': user}), 200
    return jsonify({'user': None}), 200

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/saved_images/<path:filename>')
def serve_saved_images(filename):
    """تقديم الصور المحفوظة محلياً"""
    return send_from_directory(UPLOADS_DIR, filename)

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('.', filename)



@app.route('/save-images-locally', methods=['POST'])
@login_required
def save_images_locally():
    try:
        data = request.get_json()
        product_name = data.get('product_name')
        image_urls = data.get('image_urls')
        product_id = data.get('product_id')
        season = data.get('season', 'غير محدد')
        
        if not product_name or not image_urls:
            return jsonify({'error': 'اسم المنتج وروابط الصور مطلوبة'}), 400
        
        # إنشاء مجلد للمنتج
        product_folder = os.path.join(UPLOADS_DIR, product_name.replace(' ', '_'))
        if not os.path.exists(product_folder):
            os.makedirs(product_folder)
        
        saved_images = []
        
        for i, url in enumerate(image_urls):
            success = False
            max_retries = 3
            
            for attempt in range(max_retries):
                try:
                    # تحميل الصورة مع timeout أطول وheaders
                    headers = {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                    response = requests.get(url, timeout=60, headers=headers, stream=True)
                    response.raise_for_status()
                    
                    # تحديد امتداد الملف
                    parsed_url = urlparse(url)
                    file_extension = os.path.splitext(parsed_url.path)[1]
                    if not file_extension:
                        content_type = response.headers.get('content-type', '')
                        if 'jpeg' in content_type or 'jpg' in content_type:
                            file_extension = '.jpg'
                        elif 'png' in content_type:
                            file_extension = '.png'
                        elif 'webp' in content_type:
                            file_extension = '.webp'
                        else:
                            file_extension = '.jpg'  # افتراضي
                    
                    # إنشاء اسم ملف فريد
                    filename = f"{product_name.replace(' ', '_')}_image_{i+1}_{uuid.uuid4().hex[:8]}{file_extension}"
                    file_path = os.path.join(product_folder, filename)
                    
                    # حفظ الصورة
                    with open(file_path, 'wb') as f:
                        for chunk in response.iter_content(chunk_size=8192):
                            f.write(chunk)
                    
                    saved_images.append({
                        'filename': filename,
                        'path': file_path,
                        'size': os.path.getsize(file_path)
                    })
                    
                    success = True
                    print(f"Successfully downloaded image {i+1}: {filename}")
                    break
                    
                except Exception as e:
                    print(f"Attempt {attempt + 1} failed for image {url}: {e}")
                    if attempt == max_retries - 1:
                        print(f"Failed to download image after {max_retries} attempts: {url}")
                    else:
                        import time
                        time.sleep(2)  # انتظار قبل المحاولة التالية
        
        if saved_images:
            # حفظ المنتج في قاعدة البيانات
            try:
                # تحضير قائمة الصور المحفوظة محلياً (مسارات نسبية)
                local_image_paths = [os.path.join('saved_images', product_name.replace(' ', '_'), os.path.basename(img['path'])) for img in saved_images]
                
                product_db_id = db.create_product(
                    user_id=session['user_id'],
                    name=product_name,
                    season=season,
                    images=local_image_paths,
                    url=data.get('url', ''),
                    description=data.get('description', '')
                )
                
                total_images = len(image_urls)
                success_count = len(saved_images)
                
                return jsonify({
                    'success': True,
                    'saved_count': success_count,
                    'total_count': total_images,
                    'folder_path': product_folder,
                    'images': saved_images,
                    'product_id': product_db_id,
                    'message': f'تم حفظ {success_count} من أصل {total_images} صورة محلياً في مجلد: {product_folder}'
                })
            except Exception as db_error:
                print(f"Database error: {db_error}")
                # حتى لو فشل حفظ قاعدة البيانات، الصور محفوظة
                total_images = len(image_urls)
                success_count = len(saved_images)
                
                return jsonify({
                    'success': True,
                    'saved_count': success_count,
                    'total_count': total_images,
                    'folder_path': product_folder,
                    'images': saved_images,
                    'warning': 'تم حفظ الصور ولكن فشل في حفظ البيانات في قاعدة البيانات',
                    'message': f'تم حفظ {success_count} من أصل {total_images} صورة محلياً في مجلد: {product_folder}'
                })
        else:
            total_images = len(image_urls)
            return jsonify({
                'success': False,
                'saved_count': 0,
                'total_count': total_images,
                'error': f'فشل في تحميل جميع الصور ({total_images} صور). يرجى التحقق من اتصال الإنترنت أو صحة روابط الصور.',
                'suggestions': [
                    'تحقق من اتصال الإنترنت',
                    'تأكد من صحة روابط الصور',
                    'حاول مرة أخرى بعد قليل'
                ]
            }), 400
            
    except Exception as e:
        print(f"Error saving images locally: {e}")
        return jsonify({'error': str(e)}), 500

# نقاط النهاية لإدارة المنتجات
@app.route('/api/products', methods=['GET'])
@login_required
def get_products():
    try:
        products = db.get_user_products(session['user_id'])
        return jsonify({'products': products}), 200
    except Exception as e:
        return jsonify({'error': 'خطأ في جلب المنتجات'}), 500

@app.route('/api/products', methods=['POST'])
@login_required
def create_product():
    try:
        data = request.get_json()
        
        name = data.get('name')
        description = data.get('description')
        price = data.get('price', 0)
        url = data.get('url')
        images = data.get('images', [])
        season = data.get('season')
        currency = data.get('currency', 'SAR')
        
        if not name or not description or not url:
            return jsonify({'error': 'الاسم والوصف والرابط مطلوبة'}), 400
        
        product_id = db.create_product(
            user_id=session['user_id'],
            name=name,
            url=url,
            description=description,
            price=price,
            images=images,
            season=season,
            currency=currency
        )
        
        return jsonify({
            'message': 'تم حفظ المنتج بنجاح',
            'product_id': product_id
        }), 201
        
    except Exception as e:
        print(f"Error creating product: {e}")
        return jsonify({'error': 'خطأ في حفظ المنتج'}), 500

@app.route('/api/products/<int:product_id>', methods=['PUT'])
@login_required
def update_product(product_id):
    try:
        data = request.get_json()
        
        # إزالة الحقول غير المطلوبة
        allowed_fields = ['name', 'description', 'price', 'url', 'images', 'season', 'status', 'currency']
        update_data = {k: v for k, v in data.items() if k in allowed_fields}
        
        db.update_product(product_id, session['user_id'], **update_data)
        
        return jsonify({'message': 'تم تحديث المنتج بنجاح'}), 200
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 403
    except Exception as e:
        print(f"Error updating product: {e}")
        return jsonify({'error': 'خطأ في تحديث المنتج'}), 500

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
@login_required
def delete_product(product_id):
    try:
        success = db.delete_product(product_id, session['user_id'])
        
        if success:
            return jsonify({'message': 'تم حذف المنتج بنجاح'}), 200
        else:
            return jsonify({'error': 'المنتج غير موجود أو غير مسموح بحذفه'}), 404
            
    except Exception as e:
        print(f"Error deleting product: {e}")
        return jsonify({'error': 'خطأ في حذف المنتج'}), 500

@app.route('/api/delete_all_products', methods=['DELETE'])
@login_required
def delete_all_products():
    try:
        user_id = session['user_id']
        success = db.delete_all_products(user_id)
        if success:
            return jsonify({'message': 'تم حذف جميع المنتجات بنجاح'})
        else:
            return jsonify({'error': 'فشل في حذف المنتجات'}), 400
    except Exception as e:
        print(f"خطأ في حذف جميع المنتجات: {e}")
        return jsonify({'error': 'حدث خطأ في الخادم'}), 500

@app.route('/api/seasons', methods=['GET'])
@login_required
def get_seasons():
    try:
        seasons = db.get_user_seasons(session['user_id'])
        return jsonify({'seasons': seasons}), 200
    except Exception as e:
        print(f"Error getting seasons: {e}")
        return jsonify({'error': 'خطأ في جلب المواسم'}), 500

@app.route('/api/seasons', methods=['POST'])
@login_required
def save_season():
    try:
        data = request.get_json()
        season_name = data.get('name')
        
        if not season_name:
            return jsonify({'error': 'اسم الموسم مطلوب'}), 400
        
        success = db.save_season(session['user_id'], season_name)
        
        if success:
            return jsonify({'message': 'تم حفظ الموسم بنجاح'}), 201
        else:
            return jsonify({'error': 'هذا الموسم موجود بالفعل'}), 400
            
    except Exception as e:
        print(f"Error saving season: {e}")
        return jsonify({'error': 'خطأ في حفظ الموسم'}), 500

@app.route('/api/seasons/<season_name>', methods=['DELETE'])
@login_required
def delete_season(season_name):
    try:
        success = db.delete_season(session['user_id'], season_name)
        
        if success:
            return jsonify({'message': 'تم حذف الموسم بنجاح'}), 200
        else:
            return jsonify({'error': 'فشل في حذف الموسم'}), 400
            
    except Exception as e:
        print(f"Error deleting season: {e}")
        return jsonify({'error': 'خطأ في حذف الموسم'}), 500

@app.route('/api/seasons/<old_name>', methods=['PUT'])
@login_required
def update_season(old_name):
    try:
        data = request.get_json()
        new_name = data.get('new_name')
        
        if not new_name:
            return jsonify({'error': 'الاسم الجديد مطلوب'}), 400
        
        success = db.update_season_name(session['user_id'], old_name, new_name)
        
        if success:
            return jsonify({'message': 'تم تحديث اسم الموسم بنجاح'}), 200
        else:
            return jsonify({'error': 'هذا الاسم موجود بالفعل'}), 400
            
    except Exception as e:
        print(f"Error updating season: {e}")
        return jsonify({'error': 'خطأ في تحديث الموسم'}), 500

if __name__ == '__main__':
    print("بدء تشغيل الخادم...")
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('DEBUG', 'True').lower() == 'true'
    
    if debug:
        print(f"الموقع متاح على: http://localhost:{port}")
    
    app.run(debug=debug, port=port, host='0.0.0.0')
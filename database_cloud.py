import os
import hashlib
from datetime import datetime
import json

# للنشر السحابي - استخدام PostgreSQL
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    POSTGRES_AVAILABLE = True
except ImportError:
    POSTGRES_AVAILABLE = False

# للتطوير المحلي - استخدام SQLite
import sqlite3

class Database:
    def __init__(self, db_url=None):
        self.db_url = db_url or os.environ.get('DATABASE_URL')
        self.use_postgres = bool(self.db_url and POSTGRES_AVAILABLE)
        
        if not self.use_postgres:
            self.db_path = 'app.db'
            
        self.init_database()
    
    def get_connection(self):
        """الحصول على اتصال قاعدة البيانات"""
        if self.use_postgres:
            return psycopg2.connect(self.db_url, cursor_factory=RealDictCursor)
        else:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            return conn
    
    def init_database(self):
        """إنشاء قاعدة البيانات والجداول"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if self.use_postgres:
            # PostgreSQL syntax
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    is_verified BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_active BOOLEAN DEFAULT TRUE
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS products (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    url TEXT,
                    description TEXT,
                    price DECIMAL(10,2) DEFAULT 0,
                    images TEXT,
                    status VARCHAR(50) DEFAULT 'pending',
                    season VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS seasons (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            ''')
        else:
            # SQLite syntax (للتطوير المحلي)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    is_verified BOOLEAN DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_active BOOLEAN DEFAULT 1
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    url TEXT,
                    description TEXT,
                    price REAL DEFAULT 0,
                    images TEXT,
                    status TEXT DEFAULT 'pending',
                    season TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS seasons (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id)
                )
            ''')
        
        conn.commit()
        conn.close()
    
    def hash_password(self, password):
        """تشفير كلمة المرور"""
        return hashlib.sha256(password.encode()).hexdigest()
    
    def create_user(self, username, email, password):
        """إنشاء مستخدم جديد"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        password_hash = self.hash_password(password)
        
        try:
            if self.use_postgres:
                cursor.execute(
                    "INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s) RETURNING id",
                    (username, email, password_hash)
                )
                user_id = cursor.fetchone()['id']
            else:
                cursor.execute(
                    "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
                    (username, email, password_hash)
                )
                user_id = cursor.lastrowid
            
            conn.commit()
            return user_id
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    def authenticate_user(self, username, password):
        """التحقق من صحة بيانات المستخدم"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        password_hash = self.hash_password(password)
        
        if self.use_postgres:
            cursor.execute(
                "SELECT * FROM users WHERE username = %s AND password_hash = %s AND is_active = TRUE",
                (username, password_hash)
            )
        else:
            cursor.execute(
                "SELECT * FROM users WHERE username = ? AND password_hash = ? AND is_active = 1",
                (username, password_hash)
            )
        
        user = cursor.fetchone()
        conn.close()
        
        return dict(user) if user else None
    
    def get_user_by_username(self, username):
        """الحصول على المستخدم بالاسم"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if self.use_postgres:
            cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
        else:
            cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        
        user = cursor.fetchone()
        conn.close()
        
        return dict(user) if user else None
    
    def create_product(self, user_id, name, url=None, description=None, price=0, images=None, season=None):
        """إنشاء منتج جديد"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        images_json = json.dumps(images) if images else None
        
        try:
            if self.use_postgres:
                cursor.execute(
                    """INSERT INTO products (user_id, name, url, description, price, images, season) 
                       VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                    (user_id, name, url, description, price, images_json, season)
                )
                product_id = cursor.fetchone()['id']
            else:
                cursor.execute(
                    """INSERT INTO products (user_id, name, url, description, price, images, season) 
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (user_id, name, url, description, price, images_json, season)
                )
                product_id = cursor.lastrowid
            
            conn.commit()
            return product_id
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    def get_user_products(self, user_id):
        """الحصول على منتجات المستخدم"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if self.use_postgres:
            cursor.execute("SELECT * FROM products WHERE user_id = %s ORDER BY created_at DESC", (user_id,))
        else:
            cursor.execute("SELECT * FROM products WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
        
        products = cursor.fetchall()
        conn.close()
        
        # تحويل النتائج إلى قائمة من القواميس
        result = []
        for product in products:
            product_dict = dict(product)
            if product_dict['images']:
                try:
                    product_dict['images'] = json.loads(product_dict['images'])
                except:
                    product_dict['images'] = []
            else:
                product_dict['images'] = []
            result.append(product_dict)
        
        return result
    
    def update_product(self, product_id, user_id, **kwargs):
        """تحديث منتج"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # بناء استعلام التحديث
        set_clauses = []
        values = []
        
        for key, value in kwargs.items():
            if key == 'images' and value is not None:
                value = json.dumps(value)
            set_clauses.append(f"{key} = {'%s' if self.use_postgres else '?'}")
            values.append(value)
        
        if not set_clauses:
            return False
        
        # إضافة updated_at
        set_clauses.append(f"updated_at = {'CURRENT_TIMESTAMP' if self.use_postgres else 'CURRENT_TIMESTAMP'}")
        
        query = f"UPDATE products SET {', '.join(set_clauses)} WHERE id = {'%s' if self.use_postgres else '?'} AND user_id = {'%s' if self.use_postgres else '?'}"
        values.extend([product_id, user_id])
        
        try:
            cursor.execute(query, values)
            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    def delete_product(self, product_id, user_id):
        """حذف منتج"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            if self.use_postgres:
                cursor.execute("DELETE FROM products WHERE id = %s AND user_id = %s", (product_id, user_id))
            else:
                cursor.execute("DELETE FROM products WHERE id = ? AND user_id = ?", (product_id, user_id))
            
            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    def delete_all_products(self, user_id):
        """حذف جميع منتجات المستخدم"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            if self.use_postgres:
                cursor.execute("DELETE FROM products WHERE user_id = %s", (user_id,))
            else:
                cursor.execute("DELETE FROM products WHERE user_id = ?", (user_id,))
            
            conn.commit()
            return cursor.rowcount
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    def create_season(self, user_id, name, description=None):
        """إنشاء موسم جديد"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            if self.use_postgres:
                cursor.execute(
                    "INSERT INTO seasons (user_id, name, description) VALUES (%s, %s, %s) RETURNING id",
                    (user_id, name, description)
                )
                season_id = cursor.fetchone()['id']
            else:
                cursor.execute(
                    "INSERT INTO seasons (user_id, name, description) VALUES (?, ?, ?)",
                    (user_id, name, description)
                )
                season_id = cursor.lastrowid
            
            conn.commit()
            return season_id
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    def get_user_seasons(self, user_id):
        """الحصول على مواسم المستخدم"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if self.use_postgres:
            cursor.execute("SELECT * FROM seasons WHERE user_id = %s ORDER BY created_at DESC", (user_id,))
        else:
            cursor.execute("SELECT * FROM seasons WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
        
        seasons = cursor.fetchall()
        conn.close()
        
        return [dict(season) for season in seasons]
    
    def delete_season(self, season_name, user_id):
        """حذف موسم"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            if self.use_postgres:
                cursor.execute("DELETE FROM seasons WHERE name = %s AND user_id = %s", (season_name, user_id))
            else:
                cursor.execute("DELETE FROM seasons WHERE name = ? AND user_id = ?", (season_name, user_id))
            
            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    def update_season(self, old_name, new_name, user_id, description=None):
        """تحديث موسم"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            if self.use_postgres:
                cursor.execute(
                    "UPDATE seasons SET name = %s, description = %s WHERE name = %s AND user_id = %s",
                    (new_name, description, old_name, user_id)
                )
            else:
                cursor.execute(
                    "UPDATE seasons SET name = ?, description = ? WHERE name = ? AND user_id = ?",
                    (new_name, description, old_name, user_id)
                )
            
            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
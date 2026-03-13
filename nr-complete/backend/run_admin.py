from flask import Flask, send_from_directory, redirect
from flask_cors import CORS
import os

ADMIN_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'admin'))

admin_app = Flask(__name__)
CORS(admin_app)

@admin_app.route('/')
@admin_app.route('/admin-panel')
@admin_app.route('/admin-panel/')
def dashboard():
    return send_from_directory(ADMIN_DIR, 'index.html')

@admin_app.route('/admin-panel/login')
def login():
    return send_from_directory(ADMIN_DIR, 'login.html')

@admin_app.route('/admin-panel/src/<path:path>')
def static_files(path):
    return send_from_directory(os.path.join(ADMIN_DIR, 'src'), path)

if __name__ == '__main__':
    print("\n  Admin Login     → http://localhost:5001/admin-panel/login")
    print("  Admin Dashboard → http://localhost:5001/admin-panel")
    print("  API (must also be running) → http://localhost:5000\n")
    admin_app.run(host='0.0.0.0', port=5001, debug=True)
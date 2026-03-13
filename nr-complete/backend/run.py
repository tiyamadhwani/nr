from app import create_app, socketio
from flask import send_from_directory, redirect
import os, sys

app = create_app()

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ADMIN_DIR    = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'admin'))

def frontend(f): return send_from_directory(FRONTEND_DIR, f)

# ── Customer site ─────────────────────────────────────────────────────────────
@app.route('/')
def serve_index():      return frontend('index.html')
@app.route('/products')
def serve_products():   return frontend('products.html')
@app.route('/checkout')
def serve_checkout():   return frontend('checkout.html')
@app.route('/orders')
def serve_orders():     return frontend('orders.html')
@app.route('/profile')
def serve_profile():    return frontend('profile.html')
@app.route('/offline')
def serve_offline():    return frontend('offline.html')

# .html redirects
@app.route('/index.html')
def r_index():     return redirect('/', 301)
@app.route('/products.html')
def r_products():  return redirect('/products', 301)
@app.route('/checkout.html')
def r_checkout():  return redirect('/checkout', 301)
@app.route('/orders.html')
def r_orders():    return redirect('/orders', 301)
@app.route('/profile.html')
def r_profile():   return redirect('/profile', 301)

# ── Static files ──────────────────────────────────────────────────────────────
@app.route('/src/<path:path>')
def serve_static(path):
    return send_from_directory(os.path.join(FRONTEND_DIR, 'src'), path)
@app.route('/sw.js')
def serve_sw():        return frontend('sw.js')
@app.route('/manifest.json')
def serve_manifest():  return frontend('manifest.json')

# ── Admin panel ───────────────────────────────────────────────────────────────
@app.route('/admin-panel')
@app.route('/admin-panel/')
def serve_admin():
    return send_from_directory(ADMIN_DIR, 'index.html')
@app.route('/admin-panel/login')
def serve_admin_login():
    return send_from_directory(ADMIN_DIR, 'login.html')
@app.route('/admin-panel/src/<path:path>')
def serve_admin_static(path):
    return send_from_directory(os.path.join(ADMIN_DIR, 'src'), path)

# ── Socket.IO ─────────────────────────────────────────────────────────────────
@socketio.on('join_admin')
def join_admin(data):
    from flask_socketio import join_room
    join_room('admins')

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    print(f"\n  Customer site → http://localhost:{port}")
    print(f"  Admin panel   → http://localhost:{port}/admin-panel/login\n")
    socketio.run(app, host='0.0.0.0', port=port, debug=True, allow_unsafe_werkzeug=True)

    
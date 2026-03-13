from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user import User
from app.models.order import Order

admin_bp = Blueprint("admin", __name__)


def _require_admin():
    uid  = int(get_jwt_identity())
    user = User.query.get(uid)
    if not user or user.role != "admin":
        return None
    return user


# ── Customer management ─────────────────────────────────────────────────────

@admin_bp.route("/customers", methods=["GET"])
@jwt_required()
def list_customers():
    if not _require_admin():
        return jsonify({"error": "Admin access required"}), 403

    page  = int(request.args.get("page", 1))
    users = User.query.filter_by(role="customer")\
                .order_by(User.created_at.desc())\
                .paginate(page=page, per_page=20, error_out=False)

    return jsonify({
        "customers": [u.to_dict() for u in users.items],
        "total":     users.total,
        "pages":     users.pages,
    }), 200


@admin_bp.route("/customers/<int:uid>/toggle", methods=["PUT"])
@jwt_required()
def toggle_customer(uid):
    if not _require_admin():
        return jsonify({"error": "Admin access required"}), 403

    user = User.query.get_or_404(uid)
    user.is_active = not user.is_active
    db.session.commit()
    status = "activated" if user.is_active else "deactivated"
    return jsonify({"message": f"Customer {status}"}), 200


# ── Admin login (separate endpoint for admin panel) ─────────────────────────

@admin_bp.route("/login", methods=["POST"])
def admin_login():
    from flask_jwt_extended import create_access_token
    data = request.get_json()
    user = User.query.filter_by(email=data.get("email"), role="admin").first()

    if not user or not user.check_password(data.get("password", "")):
        return jsonify({"error": "Invalid admin credentials"}), 401

    token = create_access_token(identity=str(user.id))
    return jsonify({
        "message": "Admin login successful",
        "token":   token,
        "user":    user.to_dict(),
    }), 200
